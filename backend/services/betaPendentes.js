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
/** B2.2: ✉ resumo diário ao admin da plataforma (PLATAFORMA_ADMINS) — só quando houve pergunta nova nas últimas 24h */
async function resumoDiario(sb, { enviarEmail = require('./emailService').enviarEmailCotacao, para = process.env.PLATAFORMA_ADMINS } = {}) {
  const destinos = String(para || '').split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /@/.test(x)); if (!destinos.length) return { enviados: 0, motivo: 'sem PLATAFORMA_ADMINS' };
  const desde = new Date(Date.now() - 24 * 36e5).toISOString();
  let r; try { r = await listar(sb, { status: 'pendente' }); } catch { return { enviados: 0, motivo: 'sem a migration 110' }; }
  const novas = r.itens.filter((p) => String(p.criado_em) >= desde); if (!novas.length) return { enviados: 0, novas: 0 };
  const esc = (v) => String(v || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const html = `<p>👋 <b>${novas.length} pergunta(s) nova(s)</b> que a Beta ainda não sabe responder (${r.totais.pendente} pendente(s) no total):</p><ul>${novas.slice(0, 40).map((p) => `<li>"${esc(p.pergunta)}" — <span style="color:#666">${esc(p.empresa)} · ${esc(p.usuario_nome || '—')}${p.perfis ? ` (${esc(p.perfis)})` : ''}</span></li>`).join('')}</ul><p>Console da Plataforma → 👋 Beta — o que perguntam.</p>`;
  let n = 0; for (const d of destinos) { try { await enviarEmail(d, `👋 Beta: ${novas.length} pergunta(s) nova(s) para aprender`, html); n++; } catch (e) { console.error('❌ [beta-pendentes] e-mail:', e.message); } }
  return { enviados: n, novas: novas.length };
}
module.exports = { listar, resolver, resumoDiario };
