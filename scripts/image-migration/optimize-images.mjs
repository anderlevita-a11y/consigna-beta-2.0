#!/usr/bin/env node
/**
 * Consigna Beauty — otimização em lote das imagens já existentes no Supabase Storage.
 *
 * Fluxo por arquivo:
 *   1. Coleta as URLs referenciadas nas tabelas (text, text[] e jsonb)
 *   2. Baixa o arquivo do bucket
 *   3. sharp: corrige EXIF, redimensiona (máx 1920x1080 / 1080x1920) e converte para WebP q80
 *   4. Backup local do original
 *   5. Upload do .webp
 *   6. Atualiza as referências no Postgres via RPC (rollback do upload se falhar)
 *   7. (opcional) apaga o original
 *
 * Padrão = DRY-RUN (não altera nada). Use --apply para executar de verdade.
 *
 *   node --env-file=.env optimize-images.mjs                     # simulação
 *   node --env-file=.env optimize-images.mjs --apply --limit=5   # teste real com 5 arquivos
 *   node --env-file=.env optimize-images.mjs --apply             # tudo
 *   node --env-file=.env optimize-images.mjs --apply --delete-originals
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

/* ------------------------------------------------------------------ config */

const args = parseArgs(process.argv.slice(2));

const CONFIG = {
  apply: Boolean(args.apply),
  deleteOriginals: Boolean(args['delete-originals']),
  backup: !args['no-backup'],
  buckets: String(args.buckets ?? 'products').split(',').map((s) => s.trim()).filter(Boolean),
  limit: args.limit ? Number(args.limit) : Infinity,
  batchSize: Number(args.batch ?? 10),         // arquivos por lote
  concurrency: Number(args.concurrency ?? 3),  // arquivos processados em paralelo dentro do lote
  batchDelayMs: Number(args.delay ?? 500),     // pausa entre lotes (rate limit)
  maxLongSide: Number(args['max-long'] ?? 1920),
  maxShortSide: Number(args['max-short'] ?? 1080),
  quality: Number(args.quality ?? 80),
  minSavingRatio: Number(args['min-saving'] ?? 0.1), // só troca se economizar ≥ 10%
  backupDir: path.resolve(String(args['backup-dir'] ?? './backups')),
  logDir: path.resolve(String(args['log-dir'] ?? './logs')),
};

// Colunas que guardam URLs do Storage (espelha a função SQL image_migration_replace_ref).
const SOURCES = [
  { table: 'products', column: 'photo_url', kind: 'text' },
  { table: 'products', column: 'image_url', kind: 'text' },
  { table: 'products', column: 'image_urls', kind: 'array' },
  { table: 'central_products', column: 'photo_url', kind: 'text' },
  { table: 'central_products', column: 'image_urls', kind: 'array' },
  { table: 'store_settings', column: 'logo_url', kind: 'text' },
  { table: 'store_settings', column: 'banner_url', kind: 'text' },
  { table: 'store_settings', column: 'instagram_feed', kind: 'jsonb' },
  { table: 'product_reviews', column: 'customer_photo_url', kind: 'text' },
  { table: 'customers', column: 'document_photo_url', kind: 'text' },
  { table: 'customers', column: 'documento_url', kind: 'text' },
  { table: 'customers', column: 'residence_proof_url', kind: 'text' },
  { table: 'customers', column: 'comprovante_url', kind: 'text' },
  { table: 'profiles', column: 'documento_url', kind: 'text' },
  { table: 'profiles', column: 'comprovante_url', kind: 'text' },
  { table: 'payments', column: 'comprovante_url', kind: 'text' },
  { table: 'payment_receipts', column: 'receipt_url', kind: 'text' },
  { table: 'receipts', column: 'url', kind: 'text' },
  { table: 'mystery_bags', column: 'receipt_url', kind: 'text' },
  { table: 'raffle_tickets', column: 'receipt_url', kind: 'text' },
  { table: 'sweepstakes_participants', column: 'receipt_url', kind: 'text' },
];

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'jfif', 'png', 'webp']);
const PUBLIC_URL_RE = /\/storage\/v1\/object\/public\/([^/?#"\s]+)\/([^?#"\s]+)/g;
const PAGE_SIZE = 1000;

/* ------------------------------------------------------------------ setup */

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (veja .env.example).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Limita memória do libvips: sem cache e poucas threads por imagem.
sharp.cache(false);
sharp.concurrency(2);

const stats = { total: 0, converted: 0, dryRun: 0, skipped: 0, failed: 0, bytesBefore: 0, bytesAfter: 0 };
let logFile;

/* ------------------------------------------------------------------ main */

async function main() {
  await fs.mkdir(CONFIG.logDir, { recursive: true });
  logFile = path.join(CONFIG.logDir, `migration-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);

  console.log(`\n🖼️  Otimização de imagens — ${CONFIG.apply ? '⚠️  MODO REAL (--apply)' : 'DRY-RUN (nada será alterado)'}`);
  console.log(`   Buckets: ${CONFIG.buckets.join(', ')} | lote ${CONFIG.batchSize} | paralelo ${CONFIG.concurrency}`);
  console.log(`   Apagar originais: ${CONFIG.deleteOriginals ? 'sim' : 'não'} | Backup local: ${CONFIG.backup ? CONFIG.backupDir : 'desligado'}\n`);

  if (CONFIG.apply) await assertRpcExists();

  const files = await collectReferencedFiles();
  const queue = files.slice(0, CONFIG.limit);
  stats.total = queue.length;
  console.log(`📋 ${files.length} arquivo(s) referenciado(s) encontrado(s); processando ${queue.length}.\n`);

  for (let i = 0; i < queue.length; i += CONFIG.batchSize) {
    const batch = queue.slice(i, i + CONFIG.batchSize);
    const n = Math.floor(i / CONFIG.batchSize) + 1;
    const total = Math.ceil(queue.length / CONFIG.batchSize);
    console.log(`── Lote ${n}/${total} (${batch.length} arquivos) ──`);

    await runPool(batch, CONFIG.concurrency, (file) => processFile(file));

    const mem = Math.round(process.memoryUsage().rss / 1024 / 1024);
    console.log(`   progresso ${Math.min(i + batch.length, queue.length)}/${queue.length} · memória ${mem} MB\n`);
    if (i + CONFIG.batchSize < queue.length) await sleep(CONFIG.batchDelayMs);
  }

  printSummary();
}

/* ------------------------------------------------------------ coleta */

async function collectReferencedFiles() {
  const found = new Map(); // "bucket/path" -> { bucket, path }

  for (const src of SOURCES) {
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from(src.table)
        .select(src.column)
        .not(src.column, 'is', null)
        .order(src.column, { ascending: true }) // ordem estável para paginação
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        // tabela/coluna inexistente → só avisa e segue
        console.warn(`   ⚠️  ${src.table}.${src.column}: ${error.message}`);
        break;
      }
      for (const row of data) {
        const text = typeof row[src.column] === 'string' ? row[src.column] : JSON.stringify(row[src.column]);
        for (const m of text.matchAll(PUBLIC_URL_RE)) {
          const bucket = decodeURIComponent(m[1]);
          const objectPath = decodeURIComponent(m[2]);
          if (!CONFIG.buckets.includes(bucket)) continue;
          if (!IMAGE_EXT.has(extOf(objectPath))) continue;
          found.set(`${bucket}/${objectPath}`, { bucket, path: objectPath });
        }
      }
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  // Detecta colisões: foto.jpg e foto.png viraram ambas foto.webp?
  const targetCount = new Map();
  for (const f of found.values()) {
    const t = `${f.bucket}/${toWebpPath(f.path)}`;
    targetCount.set(t, (targetCount.get(t) ?? 0) + 1);
  }
  for (const f of found.values()) {
    const renamed = toWebpPath(f.path) !== f.path;
    if (renamed && targetCount.get(`${f.bucket}/${toWebpPath(f.path)}`) > 1) f.collision = true;
  }
  return [...found.values()];
}

/* ------------------------------------------------------------ processamento */

async function processFile({ bucket, path: objectPath, collision }) {
  const label = `${bucket}/${objectPath}`;
  const started = Date.now();
  try {
    if (collision) return skip(label, 'colisão de nome com outro arquivo .webp');

    const newPath = toWebpPath(objectPath);
    const sameName = newPath === objectPath; // já era .webp → sobrescreve
    // Nunca sobrescreve um .webp que já existe no Storage (mesmo que não referenciado no banco).
    if (!sameName && (await withRetry(() => objectExists(bucket, newPath), `verificar ${bucket}/${newPath}`))) {
      return skip(label, `destino ${newPath} já existe no Storage`);
    }

    const original = await withRetry(() => download(bucket, objectPath), `download ${label}`);
    const meta = await sharp(original, { failOn: 'none' }).metadata();

    if ((meta.pages ?? 1) > 1) return skip(label, 'imagem animada');

    const { buffer: optimized, info } = await optimize(original, meta);
    const saving = 1 - optimized.length / original.length;

    if (saving < CONFIG.minSavingRatio) {
      return skip(label, `economia insuficiente (${pct(saving)})`, { before: original.length, after: optimized.length });
    }

    const detail = {
      from: `${meta.width}x${meta.height} ${meta.format}`,
      to: `${info.width}x${info.height} webp`,
      before: original.length,
      after: optimized.length,
    };

    if (!CONFIG.apply) {
      stats.dryRun++;
      addBytes(detail);
      log('🔎', label, `${kb(detail.before)} → ${kb(detail.after)} (−${pct(saving)}) [simulação]`);
      return record({ status: 'dry_run', file: label, newPath, ...detail });
    }

    if (CONFIG.backup) await saveBackup(bucket, objectPath, original);

    try {
      await withRetry(() => upload(bucket, newPath, optimized, sameName), `upload ${bucket}/${newPath}`);
    } catch (err) {
      // Destino criado entre a verificação e o upload: não sobrescreve nem apaga no rollback.
      if (err.targetExists) return skip(label, `destino ${newPath} já existe no Storage`);
      throw err;
    }

    let dbUpdates = {};
    if (!sameName) {
      try {
        dbUpdates = await replaceReferences(bucket, objectPath, newPath);
      } catch (err) {
        // rollback: remove o .webp recém-enviado; original e banco continuam intactos
        await supabase.storage.from(bucket).remove([newPath]).catch(() => {});
        throw new Error(`falha ao atualizar banco (upload revertido): ${err.message}`);
      }

      const rows = Object.values(dbUpdates).reduce((a, b) => a + b, 0);
      if (rows === 0) {
        log('⚠️ ', label, 'nenhuma linha atualizada no banco — original mantido');
      } else if (CONFIG.deleteOriginals) {
        const { error } = await supabase.storage.from(bucket).remove([objectPath]);
        if (error) log('⚠️ ', label, `não consegui apagar o original: ${error.message}`);
      }
    }

    stats.converted++;
    addBytes(detail);
    log('✅', label, `${kb(detail.before)} → ${kb(detail.after)} (−${pct(saving)}) ${detail.from} → ${detail.to} · ${Date.now() - started} ms`);
    return record({ status: 'converted', file: label, newPath: `${bucket}/${newPath}`, dbUpdates, ...detail });
  } catch (err) {
    stats.failed++;
    log('❌', label, err.message);
    return record({ status: 'failed', file: label, error: err.message });
  }
}

async function optimize(input, meta) {
  // Orientações EXIF 5–8 trocam largura/altura após rotate()
  const rotated = (meta.orientation ?? 1) >= 5;
  const w = rotated ? meta.height : meta.width;
  const h = rotated ? meta.width : meta.height;
  const landscape = w >= h;

  return sharp(input, { failOn: 'none' })
    .rotate() // aplica EXIF e remove a tag
    .resize({
      width: landscape ? CONFIG.maxLongSide : CONFIG.maxShortSide,
      height: landscape ? CONFIG.maxShortSide : CONFIG.maxLongSide,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: CONFIG.quality, effort: 5, smartSubsample: true })
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => ({ buffer: data, info }));
}

/* ------------------------------------------------------------ Supabase I/O */

async function download(bucket, objectPath) {
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

async function upload(bucket, objectPath, buffer, overwrite) {
  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType: 'image/webp',
    cacheControl: overwrite ? '3600' : '31536000',
    // Só sobrescreve quando o destino é o próprio original (.webp → .webp).
    // Para nomes novos, upsert=false garante que um .webp pré-existente nunca é
    // substituído — e, portanto, que o rollback só remove o que este script criou.
    upsert: overwrite,
  });
  if (error) {
    if (!overwrite && isAlreadyExists(error)) {
      const err = new Error(`destino já existe: ${bucket}/${objectPath}`);
      err.targetExists = true;
      err.noRetry = true;
      throw err;
    }
    throw error;
  }
}

async function objectExists(bucket, objectPath) {
  const dir = path.posix.dirname(objectPath);
  const name = path.posix.basename(objectPath);
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(dir === '.' ? '' : dir, { search: name, limit: 100 });
  if (error) throw error;
  return (data ?? []).some((o) => o.name === name);
}

function isAlreadyExists(error) {
  return (
    String(error.statusCode ?? error.status) === '409' ||
    /already exists|duplicate/i.test(error.message ?? '')
  );
}

async function replaceReferences(bucket, oldPath, newPath) {
  const { data, error } = await supabase.rpc('image_migration_replace_ref', {
    p_old: `/object/public/${bucket}/${oldPath}`,
    p_new: `/object/public/${bucket}/${newPath}`,
  });
  if (error) throw error;
  return data ?? {};
}

async function assertRpcExists() {
  // Chamada inválida de propósito: se a função existir, ela mesma rejeita os parâmetros.
  const { error } = await supabase.rpc('image_migration_replace_ref', { p_old: 'x', p_new: 'y' });
  if (error && /could not find|does not exist|PGRST202/i.test(`${error.code} ${error.message}`)) {
    console.error('❌ Função image_migration_replace_ref não encontrada. Rode sql/001_image_migration_replace_ref.sql antes.');
    process.exit(1);
  }
}

async function saveBackup(bucket, objectPath, buffer) {
  const dest = path.join(CONFIG.backupDir, bucket, objectPath);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buffer);
}

/* ------------------------------------------------------------ utilitários */

async function runPool(items, size, worker) {
  let idx = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (idx < items.length) await worker(items[idx++]);
  });
  await Promise.all(runners);
}

async function withRetry(fn, what, attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err?.noRetry) throw err;
      if (i >= attempts) throw new Error(`${what}: ${err.message ?? err}`);
      const wait = 1000 * 2 ** (i - 1);
      console.warn(`   ↻ ${what} falhou (${err.message ?? err}); nova tentativa em ${wait} ms`);
      await sleep(wait);
    }
  }
}

function skip(label, reason, extra = {}) {
  stats.skipped++;
  log('⏭️ ', label, reason);
  return record({ status: 'skipped', file: label, reason, ...extra });
}

function record(entry) {
  return fs.appendFile(logFile, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
}

function addBytes({ before, after }) {
  stats.bytesBefore += before;
  stats.bytesAfter += after;
}

function printSummary() {
  const saved = stats.bytesBefore - stats.bytesAfter;
  console.log('════════════════ RESUMO ════════════════');
  console.log(`Arquivos analisados : ${stats.total}`);
  console.log(`Convertidos         : ${stats.converted}`);
  if (!CONFIG.apply) console.log(`Seriam convertidos  : ${stats.dryRun}`);
  console.log(`Ignorados           : ${stats.skipped}`);
  console.log(`Falhas              : ${stats.failed}`);
  console.log(`Tamanho             : ${mb(stats.bytesBefore)} → ${mb(stats.bytesAfter)} (economia ${mb(saved)})`);
  console.log(`Log detalhado       : ${logFile}`);
  if (!CONFIG.apply) console.log('\nNada foi alterado. Rode com --apply para executar.');
  if (stats.failed) process.exitCode = 2;
}

function toWebpPath(p) {
  return p.replace(/\.[^./]+$/, '') + '.webp';
}
function extOf(p) {
  return (p.match(/\.([^./]+)$/)?.[1] ?? '').toLowerCase();
}
function log(icon, label, msg) {
  console.log(`   ${icon} ${label} — ${msg}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kb = (b) => `${(b / 1024).toFixed(0)} KB`;
const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const pct = (r) => `${(r * 100).toFixed(0)}%`;

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? true;
  }
  return out;
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
