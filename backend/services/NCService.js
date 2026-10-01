// services/NCService.js
//
// M4.1 — Notificação de NC ao fornecedor.
//
// Centralizado aqui porque 2 fluxos chamam a mesma coisa:
//   1) Auto — quando a policy do tenant é 'direta', o próprio
//      aprovar-saldo dispara o email na criação da NC.
//   2) Manual — quando a policy é 'aprovacao' (default), o gestor
//      clica em "📤 Notificar fornecedor" no modal da NC.
//
// A função é idempotente: se a NC já está 'notificado', retorna sem
// reenviar (evita email duplicado por clique duplo).

const { DB } = require('../db');
const { enviarEmailCotacao } = require('./emailService');

async function notificarFornecedorNC(ncId, tenantId, opts = {}) {
  const nc = await DB.selectOne('nao_conformidades', { id: ncId, tenant_id: tenantId }, tenantId);
  if (!nc) throw new Error('NC não encontrada');
  if (!nc.fornecedor_id) {
    throw new Error('NC sem fornecedor vinculado — não é possível notificar');
  }

  // Idempotência: já enviado (ou além)? Não refaz.
  if (['enviado', 'visualizado', 'aceita', 'contestada', 'resolvida_fornecedor'].includes(nc.fornecedor_tratativa_status)) {
    return { ja_notificado: true };
  }

  const forn = await DB.selectOne('fornecedores', { id: nc.fornecedor_id, tenant_id: tenantId }, tenantId);
  if (!forn?.email) {
    throw new Error(`Fornecedor "${forn?.nome || nc.fornecedor_nome || '—'}" sem email cadastrado`);
  }

  // Buscar OC pra contexto no email
  const ov = nc.ordem_venda_id
    ? await DB.selectOne('ordens_venda', { id: nc.ordem_venda_id }, tenantId)
    : null;

  const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const linkPortal = `${baseUrl}/#portal`;

  // M4.1: contato do comprador — respeita as policies do tenant
  // (comunicacao_*_policy). Reusa o mesmo padrão do /portal/cotacao.
  // M4.1: se as colunas não estiverem na tabela, cai nos fallbacks.
  const tenant = await DB.selectOne('tenants', { id: tenantId });
  const comprador = nc.inspetor_id
    ? await DB.selectOne('usuarios', { id: nc.inspetor_id }, tenantId)
    : null;

  const usarEmpresaNome = (tenant?.comunicacao_nome_policy || 'empresa') === 'empresa';
  const usarEmpresaTel = (tenant?.comunicacao_telefone_policy || 'empresa') === 'empresa';
  const usarEmpresaMail = (tenant?.comunicacao_email_policy || 'empresa') === 'empresa';

  const contatoNome = usarEmpresaNome
    ? (tenant?.nome || null)
    : (comprador?.nome || tenant?.nome || null);
  const contatoTel = usarEmpresaTel
    ? (tenant?.telefone || null)
    : (comprador?.telefone || tenant?.telefone || null);
  const contatoMail = usarEmpresaMail
    ? (tenant?.email_contato || tenant?.email_admin || null)
    : (comprador?.email || tenant?.email_contato || tenant?.email_admin || null);

  // M4.1: campos opcionais do recebimento (lote, série, validade).
  // Só renderiza a linha quando o valor está preenchido.
  const linhaLote = nc.lote
    ? `<li><strong>Lote:</strong> ${nc.lote}</li>`
    : '';
  const linhaSerie = nc.numero_serie
    ? `<li><strong>Nº de série:</strong> ${nc.numero_serie}</li>`
    : '';
  const linhaValidade = nc.validade
    ? `<li><strong>Validade:</strong> ${new Date(nc.validade).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</li>`
    : '';
  const linhaQtd = nc.quantidade
    ? `<li><strong>Qtd recusada:</strong> ${nc.quantidade} ${nc.unidade_medida || 'UN'}</li>`
    : '';

  // Rodapé — só renderiza o bloco de contato se ao menos um campo existir.
  const rodape = (contatoNome || contatoTel || contatoMail)
    ? `
      <div style="background:#f5f5f5;border-left:4px solid #2563eb;padding:12px 16px;margin:20px 0;">
        <p style="margin:0;font-size:13px;color:#555;"><strong>Dúvidas sobre esta NC?</strong></p>
        ${contatoNome ? `<p style="margin:6px 0 0 0;font-size:13px;color:#333;"><strong>${contatoNome}</strong></p>` : ''}
        ${contatoMail ? `<p style="margin:2px 0 0 0;font-size:12px;color:#555;">📧 ${contatoMail}</p>` : ''}
        ${contatoTel ? `<p style="margin:2px 0 0 0;font-size:12px;color:#555;">📞 ${contatoTel}</p>` : ''}
      </div>
    `
    : '';

  const corpo = `
    <h2>Não Conformidade registrada</h2>
    <p>Olá <strong>${forn.nome}</strong>,</p>
    <p>Foi registrada uma <strong>Não Conformidade</strong> contra um recebimento seu:</p>
    <ul>
      <li><strong>NC:</strong> ${nc.numero_nc}</li>
      ${ov?.numero ? `<li><strong>Pedido:</strong> ${ov.numero}</li>` : ''}
      ${nc.numero_nota_fiscal ? `<li><strong>NF:</strong> ${nc.numero_nota_fiscal}</li>` : ''}
      ${linhaQtd}
      ${linhaLote}
      ${linhaSerie}
      ${linhaValidade}
      <li><strong>Motivo:</strong> ${nc.descricao_problema || nc.motivo_recusa || '—'}</li>
    </ul>
    <p>Acesse o Portal do Fornecedor para ver detalhes, responder e anexar evidências:</p>
    <p><a href="${linkPortal}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;">Abrir Portal</a></p>
    ${rodape}
    <hr/>
    <p><small>Mensagem automática do QuotaFlow.</small></p>
  `;

  await enviarEmailCotacao(
    forn.email,
    `Não Conformidade ${nc.numero_nc} — ${forn.nome}`,
    corpo
  );

  // M4.2: pipeline de 6 estados. Renomeia 'notificado' → 'enviado'.
  await DB.update('nao_conformidades', ncId, {
    fornecedor_tratativa_status: 'enviado',
    atualizado_em: new Date().toISOString(),
  }, tenantId);

  // Evento visível pro fornecedor — registra o envio
  const origem = opts.origem || 'manual'; // 'manual' | 'auto'
  await DB.insert('nao_conformidade_eventos', {
    tenant_id: tenantId,
    nc_id: ncId,
    tipo: 'notificacao_enviada',
    descricao: `Fornecedor notificado por email (${forn.email})${origem === 'auto' ? ' — envio automático pela configuração do tenant' : ''}`,
    dados: { email: forn.email, origem },
    criado_por: opts.userId || null,
    criado_por_nome: opts.userNome || 'Sistema',
    visivel_fornecedor: true,
    autor_tipo: origem === 'auto' ? 'sistema' : 'comprador',
  }, tenantId);

  return { ok: true, email: forn.email, numero_nc: nc.numero_nc };
}

module.exports = { notificarFornecedorNC };