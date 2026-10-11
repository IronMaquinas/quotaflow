// backend/services/NCEmailTemplates.js
//
// M4.4-etapa-10d: templates de email padronizados pra NC. Os 3 eventos
// (responder, devolver, reenviar) usam o MESMO formato — o fornecedor/
// comprador precisa ver cliente, item, PN, quantidade e descrição em
// qualquer email da NC (evita "quem é essa NC?" com 100 clientes).
//
// Hoje cada NC tem 1 item (não existe tabela nao_conformidade_itens).
// Quando houver N:N, este template vira loop.

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function blocoDadosNC({ nc, ov, fornecedor, tenant, itemNome, sku }) {
  const linhas = [
    `<div><strong>🏢 Cliente:</strong> ${esc(tenant?.nome || '—')}</div>`,
    `<div><strong>📋 NC:</strong> ${esc(nc.numero_nc)}${nc.rodada ? ` · rodada ${nc.rodada}` : ''}</div>`,
    `<div><strong>📄 OC:</strong> ${esc(nc.numero_pedido || ov?.numero || '—')}` +
      `${nc.numero_nota_fiscal ? ` · NF ${esc(nc.numero_nota_fiscal)}` : ''}</div>`,
    `<div style="margin-top:10px"><strong>📦 Item:</strong> ${esc(itemNome || '—')}</div>`,
    `<div><strong>🔖 Part Number:</strong> ${esc(sku || '—')}</div>`,
    `<div><strong>🔢 Quantidade:</strong> ${esc(nc.quantidade)} ${esc(nc.unidade_medida || 'UN')}</div>`,
    nc.lote ? `<div><strong>🏷️ Lote:</strong> ${esc(nc.lote)}</div>` : '',
    nc.numero_serie ? `<div><strong>🔢 Série:</strong> ${esc(nc.numero_serie)}</div>` : '',
    nc.validade ? `<div><strong>📆 Validade:</strong> ${esc(nc.validade)}</div>` : '',
    `<div style="margin-top:10px"><strong>📝 Descrição:</strong> ${esc(nc.descricao_problema || nc.motivo_recusa || '—')}</div>`,
  ].filter(Boolean);
  return `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;line-height:1.6">${linhas.join('')}</div>`;
}

/**
 * Corpo do email pro FORNECEDOR (devolução, contestação, etc).
 * `acao`: texto curto do que aconteceu ("devolvida para revisão", "resolvida etc")
 * `motivo`: motivo/observação opcional
 * `linkPortal`: URL pra abrir o portal
 */
function corpoParaFornecedor({ nc, ov, fornecedor, tenant, itemNome, sku, acao, motivo, linkPortal, rodapeContato, contexto = 'devolucao' }) {
  // M4.4-etapa-10d: `contexto` diferencia o tom da abertura e do CTA.
  //   - 'criacao'   → fornecedor descobre a NC agora, nunca respondeu
  //   - 'devolucao' → fornecedor já respondeu, comprador devolveu (default)
  const abertura = contexto === 'criacao'
    ? `<p>Foi registrada uma <strong>Não Conformidade</strong> contra um recebimento seu.</p>`
    : `<p>Sua tratativa na <strong>${esc(nc.numero_nc)}</strong> foi <strong>${esc(acao)}</strong>.</p>`;

  const cta = contexto === 'criacao'
    ? `Acesse o portal para ver os detalhes, responder e anexar evidências:`
    : `Acesse o portal, ajuste sua proposta e reenvie:`;

  return `
    <h2>${esc(nc.numero_nc)} — ${esc(acao)}</h2>
    <p>Olá <strong>${esc(fornecedor?.nome || 'fornecedor')}</strong>,</p>
    ${abertura}
    ${blocoDadosNC({ nc, ov, fornecedor, tenant, itemNome, sku })}
    ${motivo ? `<p style="margin-top:12px"><strong>💬 Motivo:</strong></p><blockquote style="border-left:3px solid #f59e0b;padding-left:12px;color:#374151">${esc(motivo)}</blockquote>` : ''}
    <p style="margin-top:16px">${cta}</p>
    <p><a href="${linkPortal}" style="background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Abrir Portal do Fornecedor</a></p>
    ${rodapeContato ? `<div style="background:#f5f5f5;border-left:4px solid #2563eb;padding:12px 16px;margin:20px 0;border-radius:4px"><p style="margin:0;font-size:13px;color:#555;"><strong>Dúvidas sobre esta NC?</strong></p>${rodapeContato}</div>` : ''}
  `;
}

/**
 * Corpo do email pro COMPRADOR (reenvio, contestação, resolução).
 */
function corpoParaComprador({ nc, ov, fornecedor, tenant, itemNome, sku, acao, motivo, linkApp }) {
  return `
    <h2>${esc(nc.numero_nc)} — ${esc(acao)}</h2>
    <p><strong>${esc(fornecedor?.nome || '—')}</strong> ${esc(acao)}.</p>
    ${blocoDadosNC({ nc, ov, fornecedor, tenant, itemNome, sku })}
    ${motivo ? `<p style="margin-top:12px"><strong>💬 Observação do fornecedor:</strong></p><blockquote style="border-left:3px solid #3b82f6;padding-left:12px;color:#374151">${esc(motivo)}</blockquote>` : ''}
    <p style="margin-top:16px"><a href="${linkApp}" style="background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Abrir QuotaFlow</a></p>
  `;
}

module.exports = { corpoParaFornecedor, corpoParaComprador };