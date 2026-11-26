// services/turismo.js — etapa T1: 🚌 VIAGENS E EMBARQUE — mapas de poltronas, viagens (eventos), ônibus, reservas e passageiros
//   Layout = { pisos: [{ nome, linhas: [[célula…]] }] } · célula = { t: 'p' (poltrona, n = número) | 'c' corredor | 'x' vazio | 'porta' |
//   'escada' | 'wc' | 'gel' (geladeira) | 'mot' (motorista) | 'mesa' }. Modelos prontos (convencional 2+2 44/46, executivo 2+1, double deck 60,
//   micro 28, van 15) + mapas da empresa. Passageiro = poltrona (única no ônibus). Reserva individual ou grupo/família (responsável).
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const txt = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);
const dataISO = (v) => { const s = String(v || '').trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); if (!m) return null; const a = m[3].length === 2 ? `19${m[3]}` : m[3]; return `${a}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; };
const quando = (v) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
const TIPOS_CELULA = ['p', 'c', 'x', 'porta', 'escada', 'wc', 'gel', 'mot', 'mesa'];

// ─── modelos prontos ─────────────────────────────────────────────────────────
const P = (n) => ({ t: 'p', n: String(n) }); const C = { t: 'c' }; const X = { t: 'x' }; const K = (t) => ({ t });
function conv(total) { // 2+2: fileira k → (4k-3, 4k-2 | 4k, 4k-1); fundo com banheiro
  const linhas = [[K('mot'), X, C, X, K('porta')]]; const filas = Math.floor(total / 4);
  for (let k = 1; k <= filas; k++) linhas.push([P(4 * k - 3), P(4 * k - 2), C, P(4 * k), P(4 * k - 1)]);
  const resto = total - filas * 4; if (resto) linhas.push([P(filas * 4 + 1), resto > 1 ? P(filas * 4 + 2) : X, C, K('wc'), K('wc')]); else linhas.push([X, X, C, K('wc'), K('gel')]);
  return { pisos: [{ nome: 'Piso único', linhas }] };
}
function exec21(total) { const linhas = [[K('mot'), X, C, K('porta')]]; let n = 1; while (n <= total) { linhas.push([P(n), n + 1 <= total ? P(n + 1) : X, C, n + 2 <= total ? P(n + 2) : X]); n += 3; } linhas.push([X, X, C, K('wc')]); return { pisos: [{ nome: 'Piso único', linhas }] }; }
function dd60() {
  const sup = [[P(1), P(2), C, P(4), P(3)], [P(5), P(6), C, K('escada'), K('porta')], [P(7), P(8), C, K('gel'), X]];
  for (let k = 3; k <= 11; k++) sup.push([P(4 * k - 3), P(4 * k - 2), C, P(4 * k), P(4 * k - 1)]);
  const inf = [[K('mot'), X, C, K('porta')], [P(45), P(46), C, P(47)], [P(48), P(49), C, P(50)], [P(51), P(52), C, P(53)], [P(54), P(55), C, P(56)], [P(57), P(58), C, P(59)], [P(60), X, C, K('wc')]];
  return { pisos: [{ nome: 'Piso superior', linhas: sup }, { nome: 'Piso inferior', linhas: inf }] };
}
function van15() { const linhas = [[K('mot'), X, K('porta')]]; let n = 1; while (n <= 15) { linhas.push([P(n), P(n + 1), P(n + 2)].map((c) => (Number(c.n) <= 15 ? c : X))); n += 3; } return { pisos: [{ nome: 'Van', linhas }] }; }
const MODELOS = [
  { id: 'tpl:conv44', nome: 'Convencional 2+2 — 44 lugares', tipo: 'Rodoviário single deck', layout: conv(44) },
  { id: 'tpl:conv46', nome: 'Convencional 2+2 — 46 lugares', tipo: 'Rodoviário single deck', layout: conv(46) },
  { id: 'tpl:exec42', nome: 'Executivo / semileito 2+1 — 42 lugares', tipo: 'Rodoviário single deck', layout: exec21(42) },
  { id: 'tpl:dd60', nome: 'Double deck — 60 lugares (44 em cima + 16 embaixo)', tipo: 'Double deck', layout: dd60() },
  { id: 'tpl:micro28', nome: 'Micro-ônibus — 28 lugares', tipo: 'Micro', layout: conv(28) },
  { id: 'tpl:van15', nome: 'Van — 15 lugares', tipo: 'Van', layout: van15() },
].map((m) => ({ ...m, lugares: poltronas(m.layout).length, pronto: true }));

function poltronas(layout) { const l = []; for (const p of layout?.pisos || []) for (const lin of p.linhas || []) for (const c of lin) if (c?.t === 'p' && c.n) l.push({ n: String(c.n), piso: p.nome }); return l; }
function validarLayout(layout) {
  const pisos = (Array.isArray(layout?.pisos) ? layout.pisos : []).slice(0, 3).map((p, i) => ({ nome: txt(p?.nome, 30) || `Piso ${i + 1}`,
    linhas: (Array.isArray(p?.linhas) ? p.linhas : []).slice(0, 30).map((lin) => (Array.isArray(lin) ? lin : []).slice(0, 8).map((c) => { const t = TIPOS_CELULA.includes(c?.t) ? c.t : 'x'; return t === 'p' ? { t, n: txt(c.n, 6) || '' } : { t }; })) }));
  const nums = poltronas({ pisos }).map((x) => x.n);
  if (!nums.length) return { erro: 'O mapa precisa de ao menos uma poltrona.' };
  if (nums.some((n) => !n)) return { erro: 'Toda poltrona precisa de número.' };
  const dup = nums.find((n, i) => nums.indexOf(n) !== i); if (dup) return { erro: `Poltrona ${dup} repetida no mapa.` };
  return { layout: { pisos }, lugares: nums.length };
}

// ─── mapas da empresa ────────────────────────────────────────────────────────
async function listarMapas(sb, tenantId) { const l = (await q(sb.from('mapas_poltronas').select('*').eq('tenant_id', tenantId))).filter((m) => m.ativo !== false).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')); return { mapas: l, modelos: MODELOS }; }
async function salvarMapa(sb, tenantId, id, b = {}) {
  const nome = txt(b.nome, 80); if (!nome) return { status: 400, erro: 'Dê um nome ao mapa.' };
  const v = validarLayout(b.layout); if (v.erro) return { status: 400, erro: v.erro };
  const d = { nome, tipo: txt(b.tipo, 40), layout: v.layout, lugares: v.lugares, atualizado_em: new Date().toISOString() };
  if (id) { const r = (await q(sb.from('mapas_poltronas').update({ ...d, ...('ativo' in b ? { ativo: !!b.ativo } : {}) }).eq('tenant_id', tenantId).eq('id', id).select()))[0]; return r ? { mapa: r } : { status: 404, erro: 'Mapa não encontrado.' }; }
  return { mapa: (await q(sb.from('mapas_poltronas').insert([{ ...d, tenant_id: tenantId, ativo: true, criado_em: d.atualizado_em }]).select()))[0] };
}
async function layoutDe(sb, tenantId, mapaId) {
  const tpl = MODELOS.find((m) => m.id === mapaId); if (tpl) return { layout: tpl.layout, nome: tpl.nome, mapa_id: null };
  const m = (await q(sb.from('mapas_poltronas').select('*').eq('tenant_id', tenantId).eq('id', mapaId)))[0]; return m ? { layout: m.layout, nome: m.nome, mapa_id: m.id } : null;
}

// ─── viagens ────────────────────────────────────────────────────────────────
async function listarViagens(sb, tenantId, f = {}) {
  const [vs, os, ps] = await Promise.all([q(sb.from('viagens').select('*').eq('tenant_id', tenantId)), q(sb.from('viagem_onibus').select('*').eq('tenant_id', tenantId)), q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId))]);
  let l = vs.map((v) => { const o = os.filter((x) => String(x.viagem_id) === String(v.id)); const lug = o.reduce((s, x) => s + poltronas(x.layout).length - (x.bloqueadas || []).length, 0);
    return { ...v, onibus: o.length, lugares: lug, passageiros: ps.filter((x) => String(x.viagem_id) === String(v.id)).length }; });
  if (f.status) l = l.filter((v) => (f.status === 'ativas' ? ['planejada', 'em_andamento'].includes(v.status) : v.status === f.status));
  if (f.busca) { const t = String(f.busca).toLowerCase(); l = l.filter((v) => [v.nome, v.destino, v.numero].some((x) => String(x || '').toLowerCase().includes(t))); }
  l.sort((a, b) => String(a.saida_em || '9').localeCompare(String(b.saida_em || '9')));
  return { viagens: l };
}
async function salvarViagem(sb, tenantId, quem, id, b = {}) {
  const nome = txt(b.nome, 120); if (!nome) return { status: 400, erro: 'Dê um nome à viagem.' };
  const d = { nome, destino: txt(b.destino, 160), saida_em: quando(b.saida_em), retorno_em: quando(b.retorno_em), local_saida: txt(b.local_saida, 200), obs: txt(b.obs, 2000),
    paradas: (Array.isArray(b.paradas) ? b.paradas : []).slice(0, 20).map((p) => ({ nome: txt(p?.nome, 120), hora: txt(p?.hora, 20) })).filter((p) => p.nome), atualizado_em: new Date().toISOString() };
  if (d.saida_em && d.retorno_em && d.retorno_em < d.saida_em) return { status: 400, erro: 'O retorno precisa ser depois da saída.' };
  if (id) { if (b.status && ['planejada', 'em_andamento', 'concluida', 'cancelada'].includes(b.status)) d.status = b.status; const r = (await q(sb.from('viagens').update(d).eq('tenant_id', tenantId).eq('id', id).select()))[0]; return r ? { viagem: r } : { status: 404, erro: 'Viagem não encontrada.' }; }
  const ano = (d.saida_em || new Date().toISOString()).slice(0, 4); const todas = await q(sb.from('viagens').select('*').eq('tenant_id', tenantId));
  const numero = `VIA-${ano}-${String(todas.filter((v) => String(v.numero || '').startsWith(`VIA-${ano}-`)).length + 1).padStart(3, '0')}`;
  return { viagem: (await q(sb.from('viagens').insert([{ ...d, tenant_id: tenantId, numero, status: 'planejada', criado_por: quem?.nome || null, criado_em: d.atualizado_em }]).select()))[0] };
}
async function detalhe(sb, tenantId, id) {
  const v = (await q(sb.from('viagens').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!v) return { status: 404, erro: 'Viagem não encontrada.' };
  const [os, rs, ps] = await Promise.all([q(sb.from('viagem_onibus').select('*').eq('tenant_id', tenantId).eq('viagem_id', id)), q(sb.from('viagem_reservas').select('*').eq('tenant_id', tenantId).eq('viagem_id', id)), q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('viagem_id', id))]);
  const hoje = new Date();
  const idade = (n) => { if (!n) return null; const d = new Date(`${n}T12:00:00Z`); let a = hoje.getFullYear() - d.getUTCFullYear(); const m = hoje.getMonth() - d.getUTCMonth(); if (m < 0 || (m === 0 && hoje.getDate() < d.getUTCDate())) a--; return a; };
  const pass = ps.map((p) => { const id2 = idade(p.nascimento); const r = rs.find((x) => String(x.id) === String(p.reserva_id));
    return { ...p, idade: id2, menor: id2 != null && id2 < 18, reserva_codigo: r?.codigo || null, reserva_tipo: r?.tipo || null, responsavel: r?.responsavel || null, incompleto: !p.documento || !p.nascimento || !p.telefone && !r?.telefone }; });
  const onibus = os.sort((a, b) => a.ordem - b.ordem).map((o) => { const pl = poltronas(o.layout); const ocup = pass.filter((p) => String(p.onibus_id) === String(o.id));
    return { ...o, lugares: pl.length, livres: pl.length - ocup.length - (o.bloqueadas || []).filter((n) => !ocup.some((p) => p.poltrona === n)).length, ocupados: ocup.length }; });
  return { viagem: v, onibus, reservas: rs.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo))), passageiros: pass, sem_poltrona: pass.filter((p) => !p.onibus_id || !p.poltrona).length, incompletos: pass.filter((p) => p.incompleto).length, MODELOS: MODELOS.map(({ id: i, nome, lugares }) => ({ id: i, nome, lugares })) };
}

// ─── ônibus da viagem ───────────────────────────────────────────────────────
async function salvarOnibus(sb, tenantId, viagemId, id, b = {}) {
  const v = (await q(sb.from('viagens').select('*').eq('tenant_id', tenantId).eq('id', viagemId)))[0]; if (!v) return { status: 404, erro: 'Viagem não encontrada.' };
  const d = { empresa: txt(b.empresa, 120), motorista_nome: txt(b.motorista_nome, 120), motorista_colaborador_id: b.motorista_colaborador_id != null && b.motorista_colaborador_id !== '' ? String(b.motorista_colaborador_id) : null, motorista_telefone: txt(b.motorista_telefone, 30), atualizado_em: new Date().toISOString() };
  if (b.equipamento_id) { const e = (await q(sb.from('equipamentos').select('*').eq('tenant_id', tenantId).eq('id', b.equipamento_id)))[0]; if (e) { d.equipamento_id = String(e.id); d.placa = e.placa || null; d.nome = txt(b.nome, 80) || e.tag || e.nome; } }
  if (!d.equipamento_id) { d.equipamento_id = null; d.placa = txt(b.placa, 10); }
  d.nome = d.nome || txt(b.nome, 80);
  if (id) {
    const o = (await q(sb.from('viagem_onibus').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!o) return { status: 404, erro: 'Ônibus não encontrado.' };
    if (!d.nome) d.nome = o.nome;
    if (b.mapa_id && String(b.mapa_id) !== String(o.mapa_id || '')) { const ly = await layoutDe(sb, tenantId, b.mapa_id); if (!ly) return { status: 400, erro: 'Mapa não encontrado.' };
      const novas = new Set(poltronas(ly.layout).map((x) => x.n)); const ps = (await q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('onibus_id', id))).filter((p) => p.poltrona && !novas.has(p.poltrona));
      if (ps.length) return { status: 409, erro: `O mapa novo não tem as poltronas ${ps.map((p) => p.poltrona).join(', ')} — mude esses passageiros antes.` };
      Object.assign(d, { mapa_id: ly.mapa_id, layout: ly.layout }); }
    return { onibus: (await q(sb.from('viagem_onibus').update(d).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
  }
  const ly = await layoutDe(sb, tenantId, b.mapa_id); if (!ly) return { status: 400, erro: 'Escolha o mapa de poltronas do ônibus.' };
  const existentes = await q(sb.from('viagem_onibus').select('*').eq('tenant_id', tenantId).eq('viagem_id', viagemId));
  return { onibus: (await q(sb.from('viagem_onibus').insert([{ ...d, nome: d.nome || `Ônibus ${existentes.length + 1}`, tenant_id: tenantId, viagem_id: v.id, ordem: existentes.length + 1, mapa_id: ly.mapa_id, layout: ly.layout, bloqueadas: [], criado_em: d.atualizado_em }]).select()))[0] };
}
async function excluirOnibus(sb, tenantId, id) {
  const ps = await q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('onibus_id', id)); if (ps.length) return { status: 409, erro: `Há ${ps.length} passageiro(s) neste ônibus — mude ou tire antes.` };
  await q(sb.from('viagem_onibus').delete().eq('tenant_id', tenantId).eq('id', id)); return { ok: true };
}
async function bloquear(sb, tenantId, id, poltrona, bloquear) {
  const o = (await q(sb.from('viagem_onibus').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!o) return { status: 404, erro: 'Ônibus não encontrado.' };
  const n = String(poltrona); if (!poltronas(o.layout).some((x) => x.n === n)) return { status: 400, erro: 'Poltrona não existe neste ônibus.' };
  if (bloquear && (await q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('onibus_id', id))).some((p) => p.poltrona === n)) return { status: 409, erro: 'Poltrona ocupada — tire o passageiro antes de bloquear.' };
  const bl = new Set(o.bloqueadas || []); if (bloquear) bl.add(n); else bl.delete(n);
  return { onibus: (await q(sb.from('viagem_onibus').update({ bloqueadas: [...bl], atualizado_em: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
}

// ─── reservas e passageiros ─────────────────────────────────────────────────
const limparPass = (p) => ({ nome: txt(p?.nome, 120), documento: txt(p?.documento, 40), nascimento: dataISO(p?.nascimento), telefone: txt(p?.telefone, 30), emergencia_nome: txt(p?.emergencia_nome, 120), emergencia_telefone: txt(p?.emergencia_telefone, 30), obs: txt(p?.obs, 500), assistencia: !!p?.assistencia });
async function conferirPoltronas(sb, tenantId, viagemId, itens, ignorar = []) {
  const os = await q(sb.from('viagem_onibus').select('*').eq('tenant_id', tenantId).eq('viagem_id', viagemId)); const ps = (await q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('viagem_id', viagemId))).filter((p) => !ignorar.includes(String(p.id)));
  const usadas = new Set();
  for (const it of itens) { if (!it.onibus_id || !it.poltrona) continue; const o = os.find((x) => String(x.id) === String(it.onibus_id)); if (!o) return `Ônibus não encontrado para ${it.nome}.`;
    const n = String(it.poltrona); if (!poltronas(o.layout).some((x) => x.n === n)) return `${o.nome}: não existe a poltrona ${n}.`; if ((o.bloqueadas || []).includes(n)) return `${o.nome}: a poltrona ${n} está bloqueada.`;
    const k = `${o.id}|${n}`; if (usadas.has(k)) return `Poltrona ${n} escolhida duas vezes.`; usadas.add(k);
    const dono = ps.find((p) => String(p.onibus_id) === String(o.id) && p.poltrona === n); if (dono) return `${o.nome}: a poltrona ${n} já é de ${dono.nome}.`; }
  return null;
}
async function criarReserva(sb, tenantId, quem, viagemId, b = {}) {
  const v = (await q(sb.from('viagens').select('*').eq('tenant_id', tenantId).eq('id', viagemId)))[0]; if (!v) return { status: 404, erro: 'Viagem não encontrada.' };
  const passageiros = (Array.isArray(b.passageiros) ? b.passageiros : []).slice(0, 80).map((p) => ({ ...limparPass(p), onibus_id: p.onibus_id || null, poltrona: txt(p.poltrona, 6), menor_de: Number.isInteger(p.menor_de) ? p.menor_de : null })).filter((p) => p.nome);
  if (!passageiros.length) return { status: 400, erro: 'Inclua ao menos um passageiro.' };
  const responsavel = txt(b.responsavel, 120) || passageiros[0].nome;
  const err = await conferirPoltronas(sb, tenantId, v.id, passageiros); if (err) return { status: 409, erro: err };
  const todas = await q(sb.from('viagem_reservas').select('*').eq('tenant_id', tenantId).eq('viagem_id', v.id)); const agora = new Date().toISOString();
  const r = (await q(sb.from('viagem_reservas').insert([{ tenant_id: tenantId, viagem_id: v.id, codigo: `R${String(todas.length + 1).padStart(3, '0')}`, tipo: passageiros.length > 1 || b.tipo === 'grupo' ? 'grupo' : 'individual', responsavel, telefone: txt(b.telefone, 30) || passageiros[0].telefone, email: txt(b.email, 120), origem_venda: txt(b.origem_venda, 60), pago: !!b.pago, obs: txt(b.obs, 1000), criado_por: quem?.nome || null, criado_em: agora, atualizado_em: agora }]).select()))[0];
  const criados = [];
  for (const p of passageiros) { const { menor_de, ...resto } = p; criados.push((await q(sb.from('viagem_passageiros').insert([{ ...resto, tenant_id: tenantId, viagem_id: v.id, reserva_id: r.id, criado_em: agora, atualizado_em: agora }]).select()))[0]); }
  for (let i = 0; i < passageiros.length; i++) if (passageiros[i].menor_de != null && criados[passageiros[i].menor_de]) await q(sb.from('viagem_passageiros').update({ responsavel_passageiro_id: criados[passageiros[i].menor_de].id }).eq('tenant_id', tenantId).eq('id', criados[i].id).select());
  return { reserva: r, passageiros: criados };
}
async function editarReserva(sb, tenantId, id, b = {}) {
  const up = { atualizado_em: new Date().toISOString() }; for (const k of ['responsavel', 'telefone', 'email', 'origem_venda', 'obs']) if (k in b) up[k] = txt(b[k], k === 'obs' ? 1000 : 120); if ('pago' in b) up.pago = !!b.pago;
  if ('responsavel' in up && !up.responsavel) return { status: 400, erro: 'Informe o responsável.' };
  const r = (await q(sb.from('viagem_reservas').update(up).eq('tenant_id', tenantId).eq('id', id).select()))[0]; return r ? { reserva: r } : { status: 404, erro: 'Reserva não encontrada.' };
}
async function excluirReserva(sb, tenantId, id) { await q(sb.from('viagem_passageiros').delete().eq('tenant_id', tenantId).eq('reserva_id', id)); await q(sb.from('viagem_reservas').delete().eq('tenant_id', tenantId).eq('id', id)); return { ok: true }; }
async function salvarPassageiro(sb, tenantId, id, b = {}) {
  const p = (await q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!p) return { status: 404, erro: 'Passageiro não encontrado.' };
  const d = limparPass({ ...p, ...b }); if (!d.nome) return { status: 400, erro: 'Informe o nome.' };
  return { passageiro: (await q(sb.from('viagem_passageiros').update({ ...d, atualizado_em: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
}
async function adicionarPassageiro(sb, tenantId, reservaId, b = {}) {
  const r = (await q(sb.from('viagem_reservas').select('*').eq('tenant_id', tenantId).eq('id', reservaId)))[0]; if (!r) return { status: 404, erro: 'Reserva não encontrada.' };
  const d = { ...limparPass(b), onibus_id: b.onibus_id || null, poltrona: txt(b.poltrona, 6) }; if (!d.nome) return { status: 400, erro: 'Informe o nome.' };
  const err = await conferirPoltronas(sb, tenantId, r.viagem_id, [d]); if (err) return { status: 409, erro: err };
  const agora = new Date().toISOString(); const novo = (await q(sb.from('viagem_passageiros').insert([{ ...d, tenant_id: tenantId, viagem_id: r.viagem_id, reserva_id: r.id, criado_em: agora, atualizado_em: agora }]).select()))[0];
  if (r.tipo === 'individual') await q(sb.from('viagem_reservas').update({ tipo: 'grupo' }).eq('tenant_id', tenantId).eq('id', r.id).select());
  return { passageiro: novo };
}
async function excluirPassageiro(sb, tenantId, id) {
  const p = (await q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!p) return { status: 404, erro: 'Passageiro não encontrado.' };
  await q(sb.from('viagem_passageiros').delete().eq('tenant_id', tenantId).eq('id', id));
  const resto = await q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('reserva_id', p.reserva_id)); if (!resto.length) await q(sb.from('viagem_reservas').delete().eq('tenant_id', tenantId).eq('id', p.reserva_id));
  return { ok: true };
}
// mover para outra poltrona; se estiver ocupada (mesma viagem), troca os dois de lugar
async function mover(sb, tenantId, id, b = {}) {
  const p = (await q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!p) return { status: 404, erro: 'Passageiro não encontrado.' };
  if (!b.onibus_id || !b.poltrona) { await q(sb.from('viagem_passageiros').update({ onibus_id: null, poltrona: null }).eq('tenant_id', tenantId).eq('id', id).select()); return { ok: true, trocou: null }; }
  const o = (await q(sb.from('viagem_onibus').select('*').eq('tenant_id', tenantId).eq('id', b.onibus_id)))[0]; if (!o || String(o.viagem_id) !== String(p.viagem_id)) return { status: 400, erro: 'Ônibus de outra viagem.' };
  const n = String(b.poltrona); if (!poltronas(o.layout).some((x) => x.n === n)) return { status: 400, erro: `Não existe a poltrona ${n}.` }; if ((o.bloqueadas || []).includes(n)) return { status: 409, erro: `A poltrona ${n} está bloqueada.` };
  const dono = (await q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('onibus_id', o.id))).find((x) => x.poltrona === n && String(x.id) !== String(p.id));
  if (dono) { await q(sb.from('viagem_passageiros').update({ onibus_id: null, poltrona: null }).eq('tenant_id', tenantId).eq('id', dono.id).select()); }
  await q(sb.from('viagem_passageiros').update({ onibus_id: o.id, poltrona: n }).eq('tenant_id', tenantId).eq('id', p.id).select());
  if (dono) await q(sb.from('viagem_passageiros').update({ onibus_id: p.onibus_id, poltrona: p.poltrona }).eq('tenant_id', tenantId).eq('id', dono.id).select());
  return { ok: true, trocou: dono ? { id: dono.id, nome: dono.nome } : null };
}
// poltronas livres lado a lado para um grupo de n (mesma fileira primeiro, depois fileiras seguidas)
function sugerir(onibus, ocupadas, n) {
  const livres = new Set(poltronas(onibus.layout).map((x) => x.n).filter((k) => !ocupadas.has(k) && !(onibus.bloqueadas || []).includes(k))); const fileiras = [];
  for (const p of onibus.layout?.pisos || []) for (const lin of p.linhas || []) { const lados = []; let atual = []; for (const c of lin) { if (c.t === 'p') atual.push(c.n); else { if (atual.length) lados.push(atual); atual = []; } } if (atual.length) lados.push(atual); fileiras.push(lados); }
  const lista = []; for (const f of fileiras) for (const lado of f) { const l = lado.filter((k) => livres.has(k)); if (l.length) lista.push(l); }
  const mesmo = lista.find((l) => l.length >= n); if (mesmo) return mesmo.slice(0, n);
  const plano = lista.flat(); return plano.length >= n ? plano.slice(0, n) : plano;
}
async function sugestao(sb, tenantId, onibusId, n) {
  const o = (await q(sb.from('viagem_onibus').select('*').eq('tenant_id', tenantId).eq('id', onibusId)))[0]; if (!o) return { status: 404, erro: 'Ônibus não encontrado.' };
  const oc = new Set((await q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('onibus_id', o.id))).map((p) => p.poltrona).filter(Boolean));
  return { poltronas: sugerir(o, oc, Math.max(1, Math.min(parseInt(n, 10) || 1, 60))) };
}
// importar planilha colada (Excel → linhas): nome, documento, nascimento, telefone, poltrona, responsável/grupo, ônibus (opcional)
async function importar(sb, tenantId, quem, viagemId, b = {}) {
  const v = (await q(sb.from('viagens').select('*').eq('tenant_id', tenantId).eq('id', viagemId)))[0]; if (!v) return { status: 404, erro: 'Viagem não encontrada.' };
  const os = await q(sb.from('viagem_onibus').select('*').eq('tenant_id', tenantId).eq('viagem_id', v.id)); const linhas = (Array.isArray(b.linhas) ? b.linhas : []).slice(0, 500);
  const achaOnibus = (t) => { if (!t) return os.length === 1 ? os[0] : null; const s = String(t).trim().toLowerCase(); return os.find((o) => String(o.ordem) === s || String(o.nome).toLowerCase() === s || String(o.placa || '').toLowerCase() === s) || null; };
  const grupos = new Map(); const erros = [];
  linhas.forEach((l, i) => { const nome = txt(l.nome, 120); if (!nome) return; const o = l.poltrona ? achaOnibus(l.onibus) : null; if (l.poltrona && !o) erros.push(`Linha ${i + 1} (${nome}): diga em qual ônibus (há ${os.length}).`);
    const chave = txt(l.grupo, 120) || `__${i}`; const g = grupos.get(chave) || { responsavel: txt(l.grupo, 120) || nome, passageiros: [] }; g.passageiros.push({ ...l, nome, onibus_id: o?.id || null, poltrona: o ? txt(l.poltrona, 6) : null }); grupos.set(chave, g); });
  if (erros.length) return { status: 400, erro: erros.slice(0, 5).join(' · ') };
  const todos = [...grupos.values()].flatMap((g) => g.passageiros); const err = await conferirPoltronas(sb, tenantId, v.id, todos); if (err) return { status: 409, erro: `Nada importado — ${err}` };
  let n = 0; for (const g of grupos.values()) { const r = await criarReserva(sb, tenantId, quem, v.id, { responsavel: g.responsavel, passageiros: g.passageiros, origem_venda: txt(b.origem_venda, 60) }); if (r.erro) return { status: r.status, erro: `Parou em ${g.responsavel}: ${r.erro} (${n} importado(s) antes)` }; n += r.passageiros.length; }
  return { importados: n, reservas: grupos.size };
}

module.exports = { MODELOS, poltronas, validarLayout, sugerir, listarMapas, salvarMapa, listarViagens, salvarViagem, detalhe, salvarOnibus, excluirOnibus, bloquear, criarReserva, editarReserva, excluirReserva, salvarPassageiro, adicionarPassageiro, excluirPassageiro, mover, sugestao, importar };
