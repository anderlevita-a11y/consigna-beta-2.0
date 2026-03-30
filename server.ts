import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright-chromium";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import cron from "node-cron";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runFavoritaSync(supabase: any) {
  console.log(`[${new Date().toISOString()}] Starting Favorita Sync...`);
  let browser;
  
  const categorias = [
    'lancamentos', 'feminino', 'masculino', 'moda-intima', 'cosmeticos', 
    'sex-shop', 'rmc-casa', 'empreendedora', 'institucional', 
    'acessorios', 'sacolas', 'acao-da-semana', 'outlet-torra'
  ];

  const results = {
    new: 0,
    updated: 0,
    normal: 0,
    errors: 0
  };

  try {
    // 0. Buscar produtos da Central para usar como base de comparação
    const { data: centralProducts, error: centralError } = await supabase
      .from('central_products')
      .select('ean, name, sale_price');
    
    if (centralError) {
      console.error("Error fetching central products:", centralError);
    }

    const centralMap = new Map();
    if (centralProducts) {
      centralProducts.forEach((p: any) => {
        if (p.ean && p.ean !== '0' && p.ean !== '') {
          centralMap.set(p.ean, p);
        }
        if (p.name) {
          centralMap.set(p.name.toLowerCase().trim(), p);
        }
      });
    }

    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    
    // Aumentar o timeout padrão para 120 segundos (2 minutos)
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Login no site da Favorita
    console.log("Navegando para a página de login...");
    try {
      // Usar 'domcontentloaded' em vez de 'networkidle' para evitar timeouts por scripts lentos
      await page.goto('https://www.catalogofavorita.com.br/login', { 
        waitUntil: 'domcontentloaded',
        timeout: 120000 
      });
    } catch (gotoError) {
      console.error("Erro ao navegar para login:", gotoError);
      throw new Error("O site da Favorita demorou muito para responder. Tente novamente em instantes.");
    }
    
    // Esperar explicitamente pelos campos de login
    try {
      console.log("Aguardando campos de login...");
      await page.waitForSelector('input[name="login"], #cpf, #login', { timeout: 60000 });
      
      // Tentar preencher o CPF com um pequeno atraso entre as teclas
      const cpf = process.env.FAVORITA_CPF!;
      const senha = process.env.FAVORITA_SENHA!;

      try {
        await page.type('input[name="login"]', cpf, { delay: 50 });
      } catch {
        try {
          await page.type('#cpf', cpf, { delay: 50 });
        } catch {
          await page.type('#login', cpf, { delay: 50 });
        }
      }
      
      // Tentar preencher a senha
      try {
        await page.type('input[name="senha"]', senha, { delay: 50 });
      } catch {
        try {
          await page.type('#senha', senha, { delay: 50 });
        } catch {
          await page.type('input[type="password"]', senha, { delay: 50 });
        }
      }
      
      console.log("Clicando no botão de login...");
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'load', timeout: 120000 }).catch(() => console.log("Aviso: Navegação de login demorada, mas continuando..."))
      ]);
    } catch (loginError) {
      console.error("Erro no processo de login:", loginError);
      throw new Error("Falha ao interagir com a página de login. O site pode estar instável.");
    }

    for (const cat of categorias) {
      console.log(`Syncing category: ${cat}`);
      try {
        await page.goto(`https://www.catalogofavorita.com.br/${cat}`, { 
          waitUntil: 'domcontentloaded', 
          timeout: 60000 
        });
        
        // Esperar um pouco para o conteúdo dinâmico carregar
        await page.waitForTimeout(2000);
      } catch (catError) {
        console.error(`Erro ao carregar categoria ${cat}:`, catError);
        continue; // Pular para a próxima categoria se uma falhar
      }
      
      // Seletores ajustados para o padrão de e-commerce da Favorita
      const produtosSite = await page.$$eval('.product-item, .product-card', (items) => {
        return items.map(item => {
          const sku = item.getAttribute('data-product-id') || item.getAttribute('data-id') || item.querySelector('.sku')?.textContent?.trim();
          const nome = (item.querySelector('.product-name') || item.querySelector('.name'))?.textContent?.trim() || '';
          const precoText = (item.querySelector('.price-value') || item.querySelector('.price'))?.textContent || '0';
          const preco = parseFloat(precoText.replace('R$', '').replace('.', '').replace(',', '.').trim());
          return { sku, nome, preco };
        });
      });

      console.log(`Found ${produtosSite.length} products in ${cat}.`);

      // 3. Lógica de Comparação no Supabase
      for (const item of produtosSite) {
        if (!item.sku || isNaN(item.preco)) continue;

        // Verificar se o produto existe na Central (Base de Referência)
        const centralProd = centralMap.get(item.sku) || centralMap.get(item.nome.toLowerCase().trim());
        
        // Verificar se já existe no log de sincronização
        const { data: existente, error: fetchError } = await supabase
          .from('produtos_favorita')
          .select('*')
          .eq('sku', item.sku)
          .maybeSingle();

        if (fetchError) {
          console.error(`Error fetching product ${item.sku}:`, fetchError);
          results.errors++;
          continue;
        }

        // Se não existe na Central, é um produto novo para o sistema
        // Se existe na Central mas o preço é diferente, é uma alteração
        
        const precoReferencia = centralProd ? centralProd.sale_price : (existente ? existente.preco_atual : null);
        const isNovo = !centralProd && !existente;
        const isAlterado = precoReferencia !== null && precoReferencia !== item.preco;

        if (isNovo) {
          // PRODUTO NOVO (Não está na Central nem no Log)
          const { error: insertError } = await supabase.from('produtos_favorita').upsert({
            sku: item.sku, 
            nome: item.nome, 
            preco_atual: item.preco, 
            categoria: cat,
            status: 'novo',
            ultima_atualizacao: new Date()
          }, { onConflict: 'sku' });
          
          if (insertError) {
            console.error(`Error inserting product ${item.sku}:`, insertError);
            results.errors++;
          } else {
            results.new++;
          }
        } else if (isAlterado) {
          // PREÇO ALTERADO (Diferente da Central ou do Log)
          const { error: updateError } = await supabase.from('produtos_favorita').upsert({
            sku: item.sku,
            nome: item.nome,
            preco_anterior: precoReferencia,
            preco_atual: item.preco,
            categoria: cat,
            status: 'alterado',
            ultima_atualizacao: new Date()
          }, { onConflict: 'sku' });
          
          if (updateError) {
            console.error(`Error updating product ${item.sku}:`, updateError);
            results.errors++;
          } else {
            results.updated++;
          }
        } else {
          // SEM MUDANÇA
          const { error: updateError } = await supabase.from('produtos_favorita').upsert({ 
            sku: item.sku,
            nome: item.nome,
            preco_atual: item.preco,
            status: 'normal',
            categoria: cat,
            ultima_atualizacao: new Date()
          }, { onConflict: 'sku' });
          
          if (updateError) {
            console.error(`Error resetting status for product ${item.sku}:`, updateError);
          } else {
            results.normal++;
          }
        }
      }
    }

    console.log(`Sync finished. New: ${results.new}, Updated: ${results.updated}, Normal: ${results.normal}, Errors: ${results.errors}`);
    return { success: true, results };
  } catch (error: any) {
    console.error("Sync error:", error);
    return { success: false, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  );

  // Schedule Favorita Sync: Every Monday at 08:00
  // Cron expression: 0 8 * * 1
  cron.schedule("0 8 * * 1", async () => {
    console.log("Running scheduled Favorita Sync...");
    await runFavoritaSync(supabase);
  });

  // API Route for manual Favorita Sync
  app.post("/api/sync-favorita", async (req, res) => {
    const result = await runFavoritaSync(supabase);
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
