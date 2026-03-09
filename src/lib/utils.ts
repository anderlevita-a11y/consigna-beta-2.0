import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function printFallback(payload: any) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Por favor, permita popups para imprimir.');
    return;
  }

  const isEtiqueta = payload.tipo_documento === 'etiqueta';
  const total = payload.itens.reduce((acc: number, item: any) => acc + (item.total || 0), 0);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Impressão - Consigna Beauty</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #18181b; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #00a86b; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { margin: 0; color: #00a86b; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; }
          .header p { margin: 5px 0 0; color: #71717a; font-size: 12px; font-weight: bold; }
          .info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; font-size: 13px; }
          .info-block b { display: block; color: #71717a; text-transform: uppercase; font-size: 10px; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { text-align: left; border-bottom: 2px solid #f4f4f5; padding: 12px 8px; font-size: 11px; color: #71717a; text-transform: uppercase; }
          td { padding: 12px 8px; border-bottom: 1px solid #f4f4f5; font-size: 13px; }
          .text-right { text-align: right; }
          .footer { border-top: 2px solid #f4f4f5; padding-top: 20px; }
          .total-row { display: flex; justify-content: flex-end; align-items: center; gap: 20px; }
          .total-label { font-size: 12px; font-weight: bold; color: #71717a; text-transform: uppercase; }
          .total-value { font-size: 24px; font-weight: 900; color: #18181b; }
          .no-print { background: #f4f4f5; padding: 15px; border-radius: 12px; margin-bottom: 40px; display: flex; align-items: center; justify-content: space-between; border: 1px solid #e4e4e7; }
          .btn-print { background: #00a86b; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
          .btn-print:hover { background: #008f5b; transform: translateY(-1px); }
          @media print { .no-print { display: none; } body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="no-print">
          <div>
            <b style="display: block; font-size: 14px; color: #18181b;">Modo de Segurança Ativado</b>
            <span style="font-size: 12px; color: #71717a;">O servidor de PDF está offline. Use esta versão simplificada para imprimir.</span>
          </div>
          <button class="btn-print" onclick="window.print()">Imprimir Documento</button>
        </div>
        
        <div class="header">
          <h1>Consigna Beauty</h1>
          <p>${isEtiqueta ? 'Etiqueta de Identificação' : 'Nota de Entrega / Acerto'}</p>
        </div>

        <div class="info">
          <div class="info-block">
            <b>Cliente / Destinatário</b>
            <span>${payload.dados_cliente.nome}</span>
          </div>
          <div class="info-block" style="text-align: right;">
            <b>Data de Emissão</b>
            <span>${new Date().toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Descrição do Produto</th>
              <th class="text-right">Qtd</th>
              <th class="text-right">Unitário</th>
              <th class="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${payload.itens.map((item: any) => `
              <tr>
                <td>${item.nome}</td>
                <td class="text-right">${item.qtd}</td>
                <td class="text-right">R$ ${item.preco.toFixed(2)}</td>
                <td class="text-right">R$ ${(item.total || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div class="total-row">
            <span class="total-label">Valor Total</span>
            <span class="total-value">R$ ${total.toFixed(2)}</span>
          </div>
        </div>
        
        <div style="margin-top: 50px; font-size: 10px; color: #a1a1aa; text-align: center;">
          Gerado automaticamente por Consigna Beauty - Sistema de Gestão
        </div>
      </body>
    </html>
  `;

  win.document.write(html);
  win.document.close();
}
