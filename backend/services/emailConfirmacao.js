// backend/services/emailConfirmacao.js
//
// Confirmação de e-mail (etapa 11a.3) — para quem cria conta pelo "Criar conta".
//
//   enviarConfirmacao({ tipo, loginId, email, nome })
//       tipo: 'usuario' (transportadora) | 'fornecedor_usuario'
//       gera token (7 dias), cancela o anterior, manda o e-mail com o link
//       <FRONTEND_URL>/#confirmar-email?token=...
//   confirmarEmail(token) → { ok, tipo } | { motivo }
//   reenviarConfirmacao({ tipo, loginId }) → { ok } | { status, erro }
//
// NÃO bloqueia nada: a conta funciona sem confirmar. Serve de camada de
// confiança — a plataforma vê, na aprovação, quem confirmou.
// Token cru nunca é guardado (só o SHA-256), como no reset de senha.

const crypto = require('crypto');
const { DB } = require('../db');
const { enviarEmailFornecedor } = require('./emailService');

const DIAS_VALIDADE = 7;
const TABELA_LOGIN = { usuario: 'usuarios', fornecedor_usuario: 'fornecedor_usuarios' };

const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const esc = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function emailDeConfirmacao({ link, nome, tipo, expiraEm }) {
  const ate = new Date(expiraEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const oQue = tipo === 'usuario'
    ? 'a conta da sua transportadora no QuotaFlow'
    : 'o cadastro da sua empresa no portal de fornecedores QuotaFlow';
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
    <div style="font-size:12px;color:#64748b;letter-spacing:.08em;">QUOTAFLOW</div>
    <h2 style="margin:6px 0 10px;font-size:20px;">Confirme seu e-mail</h2>
    <p style="font-size:14px;color:#334155;line-height:1.6;">
      Olá${nome ? `, ${esc(nome)}` : ''}! Você criou ${oQue}. Confirme que este e-mail é seu:
    </p>
    <div style="text-align:center;margin:22px 0;">
      <a href="${esc(link)}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:700;font-size:14px;display:inline-block;">
        Confirmar meu e-mail
      </a>
    </div>
    <p style="font-size:13px;color:#334155;line-height:1.6;">
      A confirmação faz parte da análise do cadastro pela nossa equipe.
    </p>
    <p style="font-size:12px;color:#64748b;line-height:1.5;">
      O link vale até ${esc(ate)}. Se não foi você que criou esta conta, ignore este e-mail.
    </p>
  </div>`;
  return { assunto: 'Confirme seu e-mail no QuotaFlow', html };
}

async function enviarConfirmacao({ tipo, loginId, email, nome }) {
  const portal = String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  if (!TABELA_LOGIN[tipo] || !loginId || !email || !portal) return { ok: false };

  // um link ativo por login: cancela os anteriores
  const anteriores = (await DB.select('email_confirmacoes', { tipo, login_id: String(loginId) })) || [];
  const agora = new Date().toISOString();
  for (const c of anteriores) {
    if (!c.confirmado_em && !c.cancelado_em) await DB.update('email_confirmacoes', c.id, { cancelado_em: agora });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiraEm = new Date(Date.now() + DIAS_VALIDADE * 24 * 3600 * 1000).toISOString();
  await DB.insert('email_confirmacoes', {
    token_hash: hash(token),
    tipo,
    login_id: String(loginId),
    email,
    expira_em: expiraEm,
  });
  const { assunto, html } = emailDeConfirmacao({ link: `${portal}/#confirmar-email?token=${token}`, nome, tipo, expiraEm });
  await enviarEmailFornecedor(email, assunto, html);
  return { ok: true, expira_em: expiraEm };
}

async function confirmarEmail(token) {
  if (!/^[0-9a-f]{64}$/i.test(String(token || ''))) return { motivo: 'invalido' };
  const c = await DB.selectOne('email_confirmacoes', { token_hash: hash(token) });
  if (!c) return { motivo: 'invalido' };
  if (c.confirmado_em) return { ok: true, tipo: c.tipo, ja: true };
  if (c.cancelado_em) return { motivo: 'substituido' };
  if (new Date(c.expira_em).getTime() < Date.now()) return { motivo: 'expirado' };

  const tabela = TABELA_LOGIN[c.tipo];
  const login = await DB.selectOne(tabela, { id: c.login_id });
  if (!login) return { motivo: 'invalido' };
  // o e-mail do login mudou depois do envio: este link não vale mais
  if (String(login.email || '').trim().toLowerCase() !== String(c.email).trim().toLowerCase()) return { motivo: 'substituido' };

  const agora = new Date().toISOString();
  await DB.update(tabela, login.id, { email_confirmado_em: agora });
  await DB.update('email_confirmacoes', c.id, { confirmado_em: agora });
  return { ok: true, tipo: c.tipo };
}

async function reenviarConfirmacao({ tipo, loginId }) {
  const tabela = TABELA_LOGIN[tipo];
  if (!tabela) return { status: 400, erro: 'Tipo inválido' };
  const login = await DB.selectOne(tabela, { id: loginId });
  if (!login) return { status: 404, erro: 'Usuário não encontrado' };
  if (login.email_confirmado_em) return { status: 409, erro: 'Seu e-mail já está confirmado.' };

  // no máximo 1 reenvio a cada 2 minutos
  const anteriores = (await DB.select('email_confirmacoes', { tipo, login_id: String(login.id) })) || [];
  const ultimo = anteriores.map((c) => new Date(c.criado_em || 0).getTime()).sort((a, b) => b - a)[0];
  if (ultimo && Date.now() - ultimo < 2 * 60 * 1000) {
    return { status: 429, erro: 'Acabamos de enviar um link. Aguarde 2 minutos para pedir outro.' };
  }
  const r = await enviarConfirmacao({ tipo, loginId: login.id, email: login.email, nome: login.nome });
  if (!r.ok) return { status: 500, erro: 'Não foi possível enviar o e-mail agora.' };
  return { ok: true, email: login.email };
}

module.exports = { enviarConfirmacao, confirmarEmail, reenviarConfirmacao };
