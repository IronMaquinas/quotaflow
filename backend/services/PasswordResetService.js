// backend/services/PasswordResetService.js
//
// M4.6: fluxo "esqueci minha senha" com token por email. Serve tenant
// (usuarios) E fornecedor (fornecedor_usuarios) — a tabela password_resets
// tem colunas pra ambos.
//
// Segurança:
//   - Token aleatório (crypto) — não sequencial, não previsível
//   - Guardado como HASH (SHA-256) — se vazar o banco, o token não é usável
//   - Expira em 1h
//   - Marca usado_em quando consumido (não dá pra reusar)
//   - Resposta sempre 200 no /forgot (não vaza se o email existe)

const crypto = require('crypto');
const { DB } = require('../db');

const TTL_MINUTOS = 60;
const RATE_LIMIT_MINUTOS = 15;
const RATE_LIMIT_MAX = 3;

function gerarToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Aplica rate limit: máx N pedidos por email em X minutos.
 */
async function podeEnviarReset(email) {
  const desde = new Date(Date.now() - RATE_LIMIT_MINUTOS * 60 * 1000).toISOString();
  const pedidos = await DB.select('password_resets', { email }, null).catch(() => []);
  const recentes = (pedidos || []).filter(p => p.criado_em && p.criado_em >= desde);
  return recentes.length < RATE_LIMIT_MAX;
}

/**
 * Procura o email nas duas tabelas (usuarios e fornecedor_usuarios).
 * Retorna { tipo: 'usuario' | 'fornecedor', id, nome, tenant_id } ou null.
 */
async function encontrarUsuarioPorEmail(email) {
  // 1) Tenta usuário do tenant
  const usuarios = await DB.select('usuarios', { email }).catch(() => []);
  if (usuarios && usuarios.length > 0) {
    const u = usuarios[0];
    return { tipo: 'usuario', id: u.id, nome: u.nome, tenant_id: u.tenant_id, email: u.email };
  }
  // 2) Tenta usuário do fornecedor
  const fornUsers = await DB.select('fornecedor_usuarios', { email }).catch(() => []);
  if (fornUsers && fornUsers.length > 0) {
    const f = fornUsers[0];
    return { tipo: 'fornecedor', id: f.id, nome: f.nome, tenant_id: null, email: f.email };
  }
  return null;
}

/**
 * Cria o registro de reset e retorna o token cru (só nessa chamada).
 * @returns { token: string, ttlMinutos: number } | null (se não achou email)
 */
async function gerarReset(email) {
  const alvo = await encontrarUsuarioPorEmail(email);
  if (!alvo) return null;

  const token = gerarToken();
  const token_hash = hashToken(token);
  const expira_em = new Date(Date.now() + TTL_MINUTOS * 60 * 1000).toISOString();

  await DB.insert('password_resets', {
    tenant_id: alvo.tenant_id,
    usuario_id: alvo.tipo === 'usuario' ? alvo.id : null,
    fornecedor_usuario_id: alvo.tipo === 'fornecedor' ? alvo.id : null,
    email: alvo.email,
    token_hash,
    expira_em,
  }, null);

  return { token, ttlMinutos: TTL_MINUTOS, alvo };
}

/**
 * Valida o token. Retorna o registro ou null se inválido/expirado/usado.
 */
async function validarToken(token) {
  if (!token || typeof token !== 'string') return null;
  const token_hash = hashToken(token);

  const todos = await DB.select('password_resets', { token_hash }, null).catch(() => []);
  if (!todos || todos.length === 0) return null;
  const r = todos[0];

  if (r.usado_em) return { erro: 'usado', registro: r };
  if (r.expira_em && new Date(r.expira_em) < new Date()) return { erro: 'expirado', registro: r };
  return { ok: true, registro: r };
}

/**
 * Consome o token e atualiza a senha do usuário/fornecedor.
 */
async function aplicarNovaSenha(token, senhaHash) {
  const v = await validarToken(token);
  if (!v || !v.ok) return { ok: false, motivo: v?.erro || 'invalido' };

  const r = v.registro;

  // Atualiza senha
  if (r.usuario_id) {
    await DB.update('usuarios', r.usuario_id, { senha_hash: senhaHash }, null);
  } else if (r.fornecedor_usuario_id) {
    await DB.update('fornecedor_usuarios', r.fornecedor_usuario_id, { senha_hash: senhaHash }, null);
  } else {
    return { ok: false, motivo: 'sem_alvo' };
  }

  // Marca como usado
  await DB.update('password_resets', r.id, {
    usado_em: new Date().toISOString(),
  }, null);

  return { ok: true, tipo: r.usuario_id ? 'usuario' : 'fornecedor', email: r.email };
}

module.exports = {
  podeEnviarReset,
  gerarReset,
  validarToken,
  aplicarNovaSenha,
  TTL_MINUTOS,
};