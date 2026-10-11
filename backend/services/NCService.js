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
  // M4.4-etapa-9d: usa whitelist centralizada. Se o fornecedor já vê a NC
  // no portal (qualquer status visível), não precisa re-notificar. Isso
  // cobre 'devolvida' também — o fornecedor sabe que tem ação pendente
  // pelo bloco de reenvio, sem precisar de email novo.
  const { STATUS_VISIVEIS_FORNECEDOR } = require('../constants/fornecedorStatus');
  if (STATUS_VISIVEIS_FORNECEDOR.includes(nc.fornecedor_tratativa_status)) {
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

  // M4.4-etapa-10d: usa o template padronizado (corpoParaFornecedor).
  // Monta o rodapé de contato como HTML solto (só as linhas internas)
  // e passa pro template, que envolve no bloco cinza padrão.
  const { corpoParaFornecedor } = require('./NCEmailTemplates');
  const itemConsumo = nc.item_catalogo_id
    ? await DB.selectOne('itens_consumo', { catalogo_item_id: nc.item_catalogo_id, tenant_id: tenantId }, tenantId)
    : null;

  const rodapeContato = (contatoNome || contatoTel || contatoMail)
    ? [
        contatoNome ? `<p style="margin:6px 0 0 0;font-size:13px;color:#333;"><strong>${contatoNome}</strong></p>` : '',
        contatoMail ? `<p style="margin:2px 0 0 0;font-size:12px;color:#555;">📧 ${contatoMail}</p>` : '',
        contatoTel ? `<p style="margin:2px 0 0 0;font-size:12px;color:#555;">📞 ${contatoTel}</p>` : '',
      ].filter(Boolean).join('')
    : '';

  const corpo = corpoParaFornecedor({
    nc, ov, fornecedor: forn, tenant,
    itemNome: itemConsumo?.nome || null,
    sku: itemConsumo?.sku || null,
    acao: 'Não conformidade registrada',
    motivo: null,
    linkPortal,
    rodapeContato,
    contexto: 'criacao',
  });

  await enviarEmailCotacao(
    forn.email,
    `Não Conformidade ${nc.numero_nc} — ${forn.nome}`,
    corpo
  );

  // M4.4-etapa-9b: zera `fornecedor_ciente_em` ao notificar. Sem isso,
  // se a NC voltar pra 'enviado' (ex: reenvio, reset), o timestamp antigo
  // de "fornecedor visualizou" faz o chip mentir.
  await DB.update('nao_conformidades', ncId, {
    fornecedor_tratativa_status: 'enviado',
    fornecedor_ciente_em: null,
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