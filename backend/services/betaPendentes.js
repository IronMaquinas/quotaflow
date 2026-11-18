// services/betaPendentes.js — etapa B2.0: 👋 perguntas que a Beta ainda não sabe responder (de TODAS as empresas)
//   Só o admin da plataforma vê (Console → 👋 Beta). Ao marcar "atendida" com aviso, quem perguntou recebe 🔔 "Agora já sei responder".
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
async function listar(sb, { status = 'pendente' } = {}) {
  let x = sb.from('beta_pendentes').select('*'); if (status && status !== 'todas') x = x.eq('status', status);
  const l = (await q(x)).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em))).slice(0, 500);
  const ids = [...new Set(l.map((p) => String(p.tenant_id)).filter(Boolean))];
  const ts = ids.length ? await q(sb.from('tenants').select('*')).catch(() => []) : [];
  const nomeT = (id) => { const t = ts.find((x) => String(x.id) === String(id)); return t ? (t.nome_fantasia || t.nome || t.razao_social) : '—'; };
  const todas = await q(sb.from('beta_pendentes').select('status')).catch(() => []);
  return { itens: l.map((p) => ({ ...p, empresa: nomeT(p.tenant_id) })), totais: { pendente: todas.filter((x) => x.status === 'pendente').length, atendida: todas.filter((x) => x.status === 'atendida').length, descartada: todas.filter((x) => x.status === 'descartada').length } };
}
async function resolver(sb, id, { status, nota = null, avisar = false } = {}) {
  if (!['pendente', 'atendida', 'descartada'].includes(status)) return { status: 400, erro: 'Situação inválida.' };
  const p = (await q(sb.from('beta_pendentes').select('*').eq('id', id)))[0]; if (!p) return { status: 404, erro: 'Pergunta não encontrada.' };
  await q(sb.from('beta_pendentes').update({ status, nota: nota ? String(nota).slice(0, 500) : null, resolvido_em: status === 'pendente' ? null : new Date().toISOString() }).eq('id', id));
  if (status === 'atendida' && avisar && p.usuario_id && p.tenant_id) {
    await require('./notificacoes').criar(sb, { tipo: 'usuario', id: String(p.usuario_id) }, { tenantId: p.tenant_id, tipo: 'beta_aprendeu', titulo: '👋 A Beta aprendeu!', texto: `Agora já sei responder: "${String(p.pergunta).slice(0, 140)}" — pode perguntar de novo.`, link: {}, chave: `beta_aprendeu:${p.id}` }).catch(() => null);
  }
  return { ok: true };
}
module.exports = { listar, resolver };
