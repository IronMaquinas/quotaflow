// backend/services/convitesFornecedor.js
//
// Convite ao fornecedor LOCAL para o portal (etapa 10).
//
//   tenant → POST /api/fornecedores/:id/convidar
//            gera token (7 dias), e-mail transacional (grátis) com o link
//            <FRONTEND_URL>/#convite?token=...
//   fornecedor → GET  /api/auth/convite/validar?token=
//                POST /api/auth/convite/aceitar { token, nome, senha }
//            cria o login em fornecedor_usuarios e já devolve o JWT do portal
//
// Regras:
//   • Só fornecedor LOCAL do próprio tenant (global já é da plataforma).
//   • Fornecedor que já tem login no portal não recebe convite.
//   • E-mail que já é login de outro fornecedor: bloqueia (juntar cadastros
//     da mesma empresa é a etapa 2, deixada para depois).
//   • Novo convite cancela o anterior pendente do mesmo fornecedor.
//   • Token cru nunca é guardado — só o SHA-256.

const crypto = require('crypto');
const { DB } = require('../db');
const { enviarEmailFornecedor } = require('./emailService');

const DIAS_VALIDADE = 7;
const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const hash = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const esc = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const normEmail = (e) => String(e || '').trim().toLowerCase();

async function temLoginNoPortal(fornecedorId) {
  const logins = (await DB.select('fornecedor_usuarios', { fornecedor_id: fornecedorId })) || [];
  return logins.length > 0;
}

// Mapa fornecedor_id → { portal_ativo, convite_pendente_ate } para a lista do tenant
async function situacaoPortal(tenantId, fornecedorIds) {
  const ids = new Set((fornecedorIds || []).map(String));
  const saida = {};
  if (!ids.size) return saida;
  const [logins, convites] = await Promise.all([
    DB.select('fornecedor_usuarios', {}),
    DB.select('fornecedor_convites', { tenant_id: tenantId }),
  ]);
  for (const l of logins || []) {
    if (ids.has(String(l.fornecedor_id))) saida[String(l.fornecedor_id)] = { portal_ativo: true };
  }
  const agora = Date.now();
  for (const c of convites || []) {
    const k = String(c.fornecedor_id);
    if (!ids.has(k) || saida[k]?.portal_ativo) continue;
    if (c.aceito_em || c.cancelado_em || new Date(c.expira_em).getTime() < agora) continue;
    const atual = saida[k]?.convite_pendente_ate;
    if (!atual || new Date(c.expira_em) > new Date(atual)) {
      saida[k] = { portal_ativo: false, convite_pendente_ate: c.expira_em, convite_email: c.email };
    }
  }
  return saida;
}

function emailConvite({ link, fornecedor, tenant, expiraEm }) {
  const empresa = fornecedor.nome_fantasia || fornecedor.nome || 'sua empresa';
  const cliente = tenant?.nome || 'Um cliente';
  const assunto = `${cliente} convidou ${empresa} para o portal de fornecedores QuotaFlow`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
    <div style="font-size:12px;color:#64748b;letter-spacing:.08em;">QUOTAFLOW · PORTAL DO FORNECEDOR</div>
    <h2 style="margin:6px 0 10px;font-size:20px;">Você foi convidado</h2>
    <p style="font-size:14px;color:#334155;line-height:1.6;">
      <b>${esc(cliente)}</b> usa o QuotaFlow para compras e convidou <b>${esc(empresa)}</b> para o portal de fornecedores.
    </p>
    <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 6px;">No portal, gratuitamente, você:</p>
    <ul style="font-size:14px;color:#334155;line-height:1.7;margin:0 0 14px;padding-left:20px;">
      <li>recebe e responde pedidos de cotação;</li>
      <li>acompanha pedidos e envia a NF-e;</li>
      <li>vê demandas urgentes de peças (Canal Spot) de transportadoras de todo o Brasil;</li>
      <li>mantém os dados da sua empresa sempre atualizados.</li>
    </ul>
    <div style="text-align:center;margin:20px 0;">
      <a href="${esc(link)}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:700;font-size:14px;display:inline-block;">
        Criar meu acesso
      </a>
    </div>
    <p style="font-size:12px;color:#64748b;line-height:1.5;">
      O link vale até ${esc(new Date(expiraEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }))}.
      Se você não esperava este convite, pode ignorar este e-mail.
    </p>
  </div>`;
  return { assunto, html };
}

// tenant convida fornecedor local → { ok, expira_em, email } ou { erro, status }
async function convidar({ tenantId, fornecedorId, email, criadoPor }) {
  const f = await DB.selectOne('fornecedores', { id: fornecedorId });
  if (!f || f.tipo === 'global' || String(f.tenant_id) !== String(tenantId)) {
    return { status: 404, erro: 'Fornecedor não encontrado' };
  }
  if (await temLoginNoPortal(f.id)) {
    return { status: 409, erro: 'Este fornecedor já tem acesso ao portal' };
  }
  const destino = normEmail(email || f.email || f.email_contato);
  if (!EMAIL_VALIDO.test(destino)) {
    return { status: 400, erro: 'Informe um e-mail válido para o convite' };
  }
  const emUso = await DB.selectOne('fornecedor_usuarios', { email: destino });
  if (emUso) {
    return { status: 409, erro: 'Este e-mail já é usado por outra empresa no portal. Use outro e-mail do fornecedor.' };
  }
  const urlPortal = String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  if (!urlPortal) return { status: 500, erro: 'FRONTEND_URL não configurada no servidor' };

  // cancela convites pendentes anteriores deste fornecedor
  const anteriores = (await DB.select('fornecedor_convites', { fornecedor_id: f.id })) || [];
  const agoraIso = new Date().toISOString();
  for (const c of anteriores) {
    if (!c.aceito_em && !c.cancelado_em) await DB.update('fornecedor_convites', c.id, { cancelado_em: agoraIso });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiraEm = new Date(Date.now() + DIAS_VALIDADE * 24 * 3600 * 1000).toISOString();
  await DB.insert('fornecedor_convites', {
    token_hash: hash(token),
    fornecedor_id: f.id,
    tenant_id: tenantId,
    email: destino,
    criado_por: criadoPor ? String(criadoPor) : null,
    expira_em: expiraEm,
  });

  const tenant = await DB.selectOne('tenants', { id: tenantId });
  const { assunto, html } = emailConvite({ link: `${urlPortal}/#convite?token=${token}`, fornecedor: f, tenant, expiraEm });
  await enviarEmailFornecedor(destino, assunto, html);
  return { ok: true, expira_em: expiraEm, email: destino };
}

// valida token → { convite, fornecedor, tenant } ou { motivo }
async function carregarConvite(token) {
  if (!/^[0-9a-f]{64}$/i.test(String(token || ''))) return { motivo: 'invalido' };
  const c = await DB.selectOne('fornecedor_convites', { token_hash: hash(token) });
  if (!c) return { motivo: 'invalido' };
  if (c.aceito_em) return { motivo: 'usado' };
  if (c.cancelado_em) return { motivo: 'cancelado' };
  if (new Date(c.expira_em).getTime() < Date.now()) return { motivo: 'expirado' };
  const [fornecedor, tenant] = await Promise.all([
    DB.selectOne('fornecedores', { id: c.fornecedor_id }),
    DB.selectOne('tenants', { id: c.tenant_id }),
  ]);
  if (!fornecedor) return { motivo: 'invalido' };
  if (await temLoginNoPortal(fornecedor.id)) return { motivo: 'usado' };
  return { convite: c, fornecedor, tenant };
}

// cria o login do fornecedor → { usuario, fornecedor } ou { motivo }
async function aceitar({ token, nome, senhaHash }) {
  const r = await carregarConvite(token);
  if (r.motivo) return r;
  const { convite, fornecedor } = r;
  if (await DB.selectOne('fornecedor_usuarios', { email: convite.email })) return { motivo: 'email_em_uso' };

  // perfil e ativo ficam com o padrão da tabela (mesmo comportamento dos logins atuais)
  const usuario = await DB.insert('fornecedor_usuarios', {
    fornecedor_id: fornecedor.id,
    nome: String(nome).trim(),
    email: convite.email,
    senha_hash: senhaHash,
  });
  await DB.update('fornecedor_convites', convite.id, { aceito_em: new Date().toISOString() });
  return { usuario, fornecedor };
}

module.exports = { convidar, carregarConvite, aceitar, situacaoPortal, temLoginNoPortal, DIAS_VALIDADE };
