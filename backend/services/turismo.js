// services/turismo.js — etapa T1 (+T1.1: planejamento de uma vez, veículos "a definir", sugestão de frota, itinerário, vários motoristas, pagamentos e embarques opcionais): 🚌 VIAGENS E EMBARQUE — mapas de poltronas, viagens (eventos), ônibus, reservas e passageiros
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

// T1.1: melhor conjunto de veículos para N pessoas — menos veículos primeiro, depois menos lugares sobrando (até 6 veículos)
function sugerirVeiculos(pessoas, tipos) {
  const n = parseInt(pessoas, 10); if (!(n > 0)) return [];
  const ts = []; for (const t of tipos) if (t.lugares > 0 && !ts.some((x) => x.lugares === t.lugares)) ts.push(t); ts.sort((a, b) => b.lugares - a.lugares);
  const res = []; const rec = (i, combo, soma) => { if (soma >= n) { res.push({ itens: combo.slice(), lugares: soma }); return; } if (combo.length >= 6) return;
    for (let j = i; j < ts.length; j++) { combo.push(ts[j]); rec(j, combo, soma + ts[j].lugares); combo.pop(); } };
  rec(0, [], 0);
  res.sort((a, b) => a.itens.length - b.itens.length || a.lugares - b.lugares);
  const vistos = new Set(); const out = [];
  for (const r of res) { const k = r.itens.map((t) => t.id).join('|'); if (vistos.has(k)) continue; vistos.add(k);
    const grupos = []; for (const t of r.itens) { const g = grupos.find((x) => x.id === t.id); if (g) g.qtd++; else grupos.push({ id: t.id, nome: t.nome, lugares: t.lugares, qtd: 1 }); }
    out.push({ veiculos: grupos, total_veiculos: r.itens.length, lugares: r.lugares, sobra: r.lugares - n }); if (out.length >= 3) break; }
  return out;
}
async function sugestaoVeiculos(sb, tenantId, pessoas) { const { mapas } = await listarMapas(sb, tenantId); return { opcoes: sugerirVeiculos(pessoas, [...mapas.map((m) => ({ id: m.id, nome: m.nome, lugares: m.lugares })), ...MODELOS]) }; }

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
    const pend = o.filter((x) => !x.placa && !x.equipamento_id).length + o.filter((x) => !(x.motoristas || []).length && !x.motorista_nome).length;
    return { ...v, onibus: o.length, lugares: lug, pendencias: pend, passageiros: ps.filter((x) => String(x.viagem_id) === String(v.id)).length }; });
  if (f.status) l = l.filter((v) => (f.status === 'ativas' ? ['planejada', 'em_andamento'].includes(v.status) : v.status === f.status));
  if (f.busca) { const t = String(f.busca).toLowerCase(); l = l.filter((v) => [v.nome, v.destino, v.numero].some((x) => String(x || '').toLowerCase().includes(t))); }
  l.sort((a, b) => String(a.saida_em || '9').localeCompare(String(b.saida_em || '9')));
  return { viagens: l };
}
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const coord = (v, lim) => { const x = num(v); return x != null && Math.abs(x) <= lim ? x : null; };
function limparParadas(l) {
  return (Array.isArray(l) ? l : []).slice(0, 30).map((p, i) => ({ id: txt(p?.id, 20) || `p${Date.now().toString(36)}${i}`, nome: txt(p?.nome, 160), lat: coord(p?.lat, 90), lng: coord(p?.lng, 180),
    chegada: quando(p?.chegada), minutos: num(p?.minutos) != null ? Math.max(0, Math.min(1440, Math.round(num(p.minutos)))) : null, conferir: !!p?.conferir, embarque: !!p?.embarque })).filter((p) => p.nome);
}
async function salvarViagem(sb, tenantId, quem, id, b = {}) {
  const nome = txt(b.nome, 120); if (!nome) return { status: 400, erro: 'Dê um nome à viagem.' };
  const d = { nome, origem: txt(b.origem, 200), origem_lat: coord(b.origem_lat, 90), origem_lng: coord(b.origem_lng, 180), destino: txt(b.destino, 200), destino_lat: coord(b.destino_lat, 90), destino_lng: coord(b.destino_lng, 180),
    saida_em: quando(b.saida_em), retorno_em: quando(b.retorno_em), local_saida: txt(b.local_saida, 200), obs: txt(b.obs, 2000),
    pessoas_previstas: num(b.pessoas_previstas) > 0 ? Math.min(5000, Math.round(num(b.pessoas_previstas))) : null,
    acompanhar_pagamentos: !!b.acompanhar_pagamentos, valor_pessoa: b.acompanhar_pagamentos && num(b.valor_pessoa) >= 0 ? num(b.valor_pessoa) : null, embarques_diferentes: !!b.embarques_diferentes, foto_obrigatoria: !!b.foto_obrigatoria,
    paradas: limparParadas(b.paradas), atualizado_em: new Date().toISOString() };
  if (!d.origem) return { status: 400, erro: 'Informe a origem.' }; if (!d.destino) return { status: 400, erro: 'Informe o destino.' };
  if (!d.saida_em) return { status: 400, erro: 'Informe a data e hora de saída.' };
  if (d.retorno_em && d.retorno_em < d.saida_em) return { status: 400, erro: 'O retorno precisa ser depois da saída.' };
  const foraDoPeriodo = d.paradas.find((p) => p.chegada && (p.chegada < d.saida_em || (d.retorno_em && p.chegada > d.retorno_em))); if (foraDoPeriodo) return { status: 400, erro: `A parada "${foraDoPeriodo.nome}" está fora do período da viagem.` };
  if (id) {
    if (b.status && ['planejada', 'em_andamento', 'concluida', 'cancelada'].includes(b.status)) d.status = b.status;
    const ant = (await q(sb.from('viagens').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!ant) return { status: 404, erro: 'Viagem não encontrada.' };
    const embarques = new Set(d.embarques_diferentes ? d.paradas.filter((p) => p.embarque).map((p) => p.id) : []);
    const usando = (await q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('viagem_id', id))).filter((p) => p.embarque_parada_id && !embarques.has(p.embarque_parada_id));
    if (usando.length && d.embarques_diferentes) return { status: 409, erro: `${usando.length} passageiro(s) embarcam numa parada que você tirou ou desmarcou como embarque (${usando.slice(0, 3).map((p) => p.nome).join(', ')}…). Mude o embarque deles antes.` };
    const r = (await q(sb.from('viagens').update(d).eq('tenant_id', tenantId).eq('id', id).select()))[0]; return { viagem: r };
  }
  const ano = (d.saida_em || new Date().toISOString()).slice(0, 4); const todas = await q(sb.from('viagens').select('*').eq('tenant_id', tenantId));
  const numero = `VIA-${ano}-${String(todas.filter((v) => String(v.numero || '').startsWith(`VIA-${ano}-`)).length + 1).padStart(3, '0')}`;
  const v = (await q(sb.from('viagens').insert([{ ...d, tenant_id: tenantId, numero, status: 'planejada', criado_por: quem?.nome || null, criado_em: d.atualizado_em }]).select()))[0];
  const veic = (Array.isArray(b.veiculos) ? b.veiculos : []).slice(0, 20); const erros = [];
  for (const x of veic) { const r = await salvarOnibus(sb, tenantId, v.id, null, { mapa_id: x.mapa_id }); if (r.erro) erros.push(r.erro); }
  return { viagem: v, ...(erros.length ? { aviso: `Viagem salva, mas ${erros.length} veículo(s) não entraram: ${erros[0]}` } : {}) };
}
async function detalhe(sb, tenantId, id) {
  const v = (await q(sb.from('viagens').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!v) return { status: 404, erro: 'Viagem não encontrada.' };
  const [os, rs, ps] = await Promise.all([q(sb.from('viagem_onibus').select('*').eq('tenant_id', tenantId).eq('viagem_id', id)), q(sb.from('viagem_reservas').select('*').eq('tenant_id', tenantId).eq('viagem_id', id)), q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('viagem_id', id))]);
  const hoje = new Date();
  const idade = (n) => { if (!n) return null; const d = new Date(`${n}T12:00:00Z`); let a = hoje.getFullYear() - d.getUTCFullYear(); const m = hoje.getMonth() - d.getUTCMonth(); if (m < 0 || (m === 0 && hoje.getDate() < d.getUTCDate())) a--; return a; };
  const pass = ps.map((p) => { const id2 = idade(p.nascimento); const r = rs.find((x) => String(x.id) === String(p.reserva_id));
    return { ...p, idade: id2, menor: id2 != null && id2 < 18, reserva_codigo: r?.codigo || null, reserva_tipo: r?.tipo || null, responsavel: r?.responsavel || null, incompleto: !p.documento || !p.nascimento || !p.telefone && !r?.telefone }; });
  const onibus = os.sort((a, b) => a.ordem - b.ordem).map((o) => { const pl = poltronas(o.layout); const ocup = pass.filter((p) => String(p.onibus_id) === String(o.id));
    const motoristas = (o.motoristas || []).length ? o.motoristas : o.motorista_nome ? [{ nome: o.motorista_nome, colaborador_id: o.motorista_colaborador_id, telefone: o.motorista_telefone }] : [];
    return { ...o, motoristas, falta_veiculo: !o.placa && !o.equipamento_id, falta_motorista: !motoristas.length, lugares: pl.length, livres: pl.length - ocup.length - (o.bloqueadas || []).filter((n) => !ocup.some((p) => p.poltrona === n)).length, ocupados: ocup.length }; });
  const lugares = onibus.reduce((t, o) => t + o.lugares - (o.bloqueadas || []).length, 0);
  const pag = v.acompanhar_pagamentos ? rs.reduce((t, r) => { const val = Number(r.valor || 0); const pg = r.situacao_pagamento === 'pago' ? val : r.situacao_pagamento === 'parcial' ? Number(r.valor_pago || 0) : 0; return { total: t.total + val, recebido: t.recebido + pg }; }, { total: 0, recebido: 0 }) : null;
  return { viagem: v, lugares, faltam_lugares: v.pessoas_previstas ? Math.max(0, v.pessoas_previstas - lugares) : 0, pagamentos: pag ? { ...pag, a_receber: pag.total - pag.recebido } : null,
    pendencias: { veiculo: onibus.filter((o) => o.falta_veiculo).length, motorista: onibus.filter((o) => o.falta_motorista).length }, onibus, reservas: rs.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo))), passageiros: pass, sem_poltrona: pass.filter((p) => !p.onibus_id || !p.poltrona).length, incompletos: pass.filter((p) => p.incompleto).length, MODELOS: MODELOS.map(({ id: i, nome, lugares }) => ({ id: i, nome, lugares })) };
}

// ─── ônibus da viagem ───────────────────────────────────────────────────────
async function salvarOnibus(sb, tenantId, viagemId, id, b = {}) {
  const v = (await q(sb.from('viagens').select('*').eq('tenant_id', tenantId).eq('id', viagemId)))[0]; if (!v) return { status: 404, erro: 'Viagem não encontrada.' };
  const mots = (Array.isArray(b.motoristas) ? b.motoristas : b.motorista_nome ? [{ nome: b.motorista_nome, colaborador_id: b.motorista_colaborador_id, telefone: b.motorista_telefone }] : [])
    .slice(0, 4).map((m) => ({ nome: txt(m?.nome, 120), colaborador_id: m?.colaborador_id != null && m.colaborador_id !== '' ? String(m.colaborador_id) : null, telefone: txt(m?.telefone, 30) })).filter((m) => m.nome);
  const d = { empresa: txt(b.empresa, 120), motoristas: mots, motorista_nome: mots[0]?.nome || null, motorista_colaborador_id: mots[0]?.colaborador_id || null, motorista_telefone: mots[0]?.telefone || null, atualizado_em: new Date().toISOString() };
  if (b.equipamento_id) { const e = (await q(sb.from('equipamentos').select('*').eq('tenant_id', tenantId).eq('id', b.equipamento_id)))[0]; if (e) { d.equipamento_id = String(e.id); d.placa = e.placa || null; d.nome = txt(b.nome, 80) || e.tag || e.nome; } }
  if (!d.equipamento_id) { d.equipamento_id = null; d.placa = txt(b.placa, 10); }
  d.nome = d.nome || txt(b.nome, 80);
  if (id) {
    const o = (await q(sb.from('viagem_onibus').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!o) return { status: 404, erro: 'Ônibus não encontrado.' };
    if (!d.nome) d.nome = o.nome;
    const tplAtual = MODELOS.find((m) => m.nome === o.tipo_nome)?.id; if (b.mapa_id && String(b.mapa_id) !== String(o.mapa_id || tplAtual || '')) { const ly = await layoutDe(sb, tenantId, b.mapa_id); if (!ly) return { status: 400, erro: 'Mapa não encontrado.' };
      const novas = new Set(poltronas(ly.layout).map((x) => x.n)); const ps = (await q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('onibus_id', id))).filter((p) => p.poltrona && !novas.has(p.poltrona));
      if (ps.length) return { status: 409, erro: `O mapa novo não tem as poltronas ${ps.map((p) => p.poltrona).join(', ')} — mude esses passageiros antes.` };
      Object.assign(d, { mapa_id: ly.mapa_id, layout: ly.layout, tipo_nome: ly.nome, bloqueadas: (o.bloqueadas || []).filter((n) => novas.has(n)) }); }
    return { onibus: (await q(sb.from('viagem_onibus').update(d).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
  }
  const ly = await layoutDe(sb, tenantId, b.mapa_id); if (!ly) return { status: 400, erro: 'Escolha o mapa de poltronas do ônibus.' };
  const existentes = await q(sb.from('viagem_onibus').select('*').eq('tenant_id', tenantId).eq('viagem_id', viagemId));
  return { onibus: (await q(sb.from('viagem_onibus').insert([{ ...d, nome: d.nome || `Ônibus ${existentes.length + 1}`, tenant_id: tenantId, viagem_id: v.id, ordem: existentes.length + 1, mapa_id: ly.mapa_id, tipo_nome: ly.nome, layout: ly.layout, bloqueadas: [], criado_em: d.atualizado_em }]).select()))[0] };
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
const limparPass = (p) => ({ nome: txt(p?.nome, 120), documento: txt(p?.documento, 40), nascimento: dataISO(p?.nascimento), telefone: txt(p?.telefone, 30), emergencia_nome: txt(p?.emergencia_nome, 120), emergencia_telefone: txt(p?.emergencia_telefone, 30), obs: txt(p?.obs, 500), assistencia: !!p?.assistencia,
  plano_saude: !!p?.plano_saude, plano_saude_nome: p?.plano_saude ? txt(p.plano_saude_nome, 80) : null, plano_saude_numero: p?.plano_saude ? txt(p.plano_saude_numero, 40) : null,
  seguro_viagem: !!p?.seguro_viagem, seguro_nome: p?.seguro_viagem ? txt(p.seguro_nome, 80) : null, seguro_apolice: p?.seguro_viagem ? txt(p.seguro_apolice, 40) : null,
  tipo_sanguineo: TIPOS_SANGUE.includes(p?.tipo_sanguineo) ? p.tipo_sanguineo : null });
const TIPOS_SANGUE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const SITUACOES = ['pago', 'parcial', 'embarque', 'pendente'];
// embarque: só vale com o toggle ligado e numa parada marcada como ponto de embarque; senão é a origem (null)
const embarqueDe = (v, id) => (v?.embarques_diferentes && id && (v.paradas || []).some((p) => p.embarque && String(p.id) === String(id)) ? String(id) : null);
function pagamento(v, b, n) { if (!v?.acompanhar_pagamentos) return {}; const sit = SITUACOES.includes(b.situacao_pagamento) ? b.situacao_pagamento : 'pendente';
  const valor = num(b.valor) != null ? num(b.valor) : v.valor_pessoa != null ? Number(v.valor_pessoa) * n : null;
  return { valor, situacao_pagamento: sit, valor_pago: sit === 'parcial' ? num(b.valor_pago) : null, pago: sit === 'pago' }; }
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
  const passageiros = (Array.isArray(b.passageiros) ? b.passageiros : []).slice(0, 80).map((p) => ({ ...limparPass(p), embarque_parada_id: embarqueDe(v, p.embarque_parada_id ?? b.embarque_parada_id), onibus_id: p.onibus_id || null, poltrona: txt(p.poltrona, 6), menor_de: Number.isInteger(p.menor_de) ? p.menor_de : null })).filter((p) => p.nome);
  if (!passageiros.length) return { status: 400, erro: 'Inclua ao menos um passageiro.' };
  const responsavel = txt(b.responsavel, 120) || passageiros[0].nome;
  const err = await conferirPoltronas(sb, tenantId, v.id, passageiros); if (err) return { status: 409, erro: err };
  const todas = await q(sb.from('viagem_reservas').select('*').eq('tenant_id', tenantId).eq('viagem_id', v.id)); const agora = new Date().toISOString();
  const r = (await q(sb.from('viagem_reservas').insert([{ tenant_id: tenantId, viagem_id: v.id, codigo: `R${String(todas.length + 1).padStart(3, '0')}`, tipo: passageiros.length > 1 || b.tipo === 'grupo' ? 'grupo' : 'individual', responsavel, telefone: txt(b.telefone, 30) || passageiros[0].telefone, email: txt(b.email, 120), origem_venda: txt(b.origem_venda, 60), pago: !!b.pago, ...pagamento(v, b, passageiros.length), obs: txt(b.obs, 1000), criado_por: quem?.nome || null, criado_em: agora, atualizado_em: agora }]).select()))[0];
  const criados = [];
  for (const p of passageiros) { const { menor_de, ...resto } = p; criados.push((await q(sb.from('viagem_passageiros').insert([{ ...resto, tenant_id: tenantId, viagem_id: v.id, reserva_id: r.id, criado_em: agora, atualizado_em: agora }]).select()))[0]); }
  for (let i = 0; i < passageiros.length; i++) if (passageiros[i].menor_de != null && criados[passageiros[i].menor_de]) await q(sb.from('viagem_passageiros').update({ responsavel_passageiro_id: criados[passageiros[i].menor_de].id }).eq('tenant_id', tenantId).eq('id', criados[i].id).select());
  return { reserva: r, passageiros: criados };
}
async function editarReserva(sb, tenantId, id, b = {}) {
  const r0 = (await q(sb.from('viagem_reservas').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!r0) return { status: 404, erro: 'Reserva não encontrada.' };
  const up = { atualizado_em: new Date().toISOString() }; for (const k of ['responsavel', 'telefone', 'email', 'origem_venda', 'obs']) if (k in b) up[k] = txt(b[k], k === 'obs' ? 1000 : 120); if ('pago' in b) { up.pago = !!b.pago; up.situacao_pagamento = b.pago ? 'pago' : 'pendente'; }
  if ('responsavel' in up && !up.responsavel) return { status: 400, erro: 'Informe o responsável.' };
  if ('situacao_pagamento' in b || 'valor' in b) { const v = (await q(sb.from('viagens').select('*').eq('tenant_id', tenantId).eq('id', r0.viagem_id)))[0]; const n = (await q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('reserva_id', id))).length;
    Object.assign(up, pagamento(v, { situacao_pagamento: r0.situacao_pagamento, valor: r0.valor, valor_pago: r0.valor_pago, ...b }, n));
    if (up.situacao_pagamento === 'parcial' && !(up.valor_pago > 0)) return { status: 400, erro: 'Informe quanto já foi pago.' }; }
  if ('embarque_parada_id' in b) { const v = (await q(sb.from('viagens').select('*').eq('tenant_id', tenantId).eq('id', r0.viagem_id)))[0]; await q(sb.from('viagem_passageiros').update({ embarque_parada_id: embarqueDe(v, b.embarque_parada_id) }).eq('tenant_id', tenantId).eq('reserva_id', id).select()); }
  const r = (await q(sb.from('viagem_reservas').update(up).eq('tenant_id', tenantId).eq('id', id).select()))[0]; return { reserva: r };
}
async function excluirReserva(sb, tenantId, id) { await q(sb.from('viagem_passageiros').delete().eq('tenant_id', tenantId).eq('reserva_id', id)); await q(sb.from('viagem_reservas').delete().eq('tenant_id', tenantId).eq('id', id)); return { ok: true }; }
async function salvarPassageiro(sb, tenantId, id, b = {}) {
  const p = (await q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!p) return { status: 404, erro: 'Passageiro não encontrado.' };
  const d = limparPass({ ...p, ...b }); if (!d.nome) return { status: 400, erro: 'Informe o nome.' };
  if ('embarque_parada_id' in b) { const v = (await q(sb.from('viagens').select('*').eq('tenant_id', tenantId).eq('id', p.viagem_id)))[0]; d.embarque_parada_id = embarqueDe(v, b.embarque_parada_id); }
  return { passageiro: (await q(sb.from('viagem_passageiros').update({ ...d, atualizado_em: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
}
async function adicionarPassageiro(sb, tenantId, reservaId, b = {}) {
  const r = (await q(sb.from('viagem_reservas').select('*').eq('tenant_id', tenantId).eq('id', reservaId)))[0]; if (!r) return { status: 404, erro: 'Reserva não encontrada.' };
  const vg = (await q(sb.from('viagens').select('*').eq('tenant_id', tenantId).eq('id', r.viagem_id)))[0];
  const d = { ...limparPass(b), embarque_parada_id: embarqueDe(vg, b.embarque_parada_id), onibus_id: b.onibus_id || null, poltrona: txt(b.poltrona, 6) }; if (!d.nome) return { status: 400, erro: 'Informe o nome.' };
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
function sugerir(onibus, ocupadas, n, perto = []) { // T1.2: perto = poltronas de quem já está sentado da mesma reserva (fica ao lado)
  const livres = new Set(poltronas(onibus.layout).map((x) => x.n).filter((k) => !ocupadas.has(k) && !(onibus.bloqueadas || []).includes(k))); const fileiras = [];
  for (const p of onibus.layout?.pisos || []) for (const lin of p.linhas || []) { const lados = []; let atual = []; for (const c of lin) { if (c.t === 'p') atual.push(c.n); else { if (atual.length) lados.push(atual); atual = []; } } if (atual.length) lados.push(atual); fileiras.push(lados); }
  let lista = []; fileiras.forEach((f, fi) => f.forEach((lado) => { const l = lado.filter((k) => livres.has(k)); if (l.length) lista.push(Object.assign(l, { fi, junto: lado.some((k) => perto.includes(k)) })); }));
  if (perto.length) { const fs = lista.length ? fileiras.map((f, fi) => (f.some((lado) => lado.some((k) => perto.includes(k))) ? fi : null)).filter((x) => x != null) : []; const dist = (l) => (l.junto ? -1 : Math.min(...fs.map((x) => Math.abs(x - l.fi)), 999)); lista = lista.sort((a, b) => dist(a) - dist(b)); }
  const mesmo = lista.find((l) => l.length >= n); if (mesmo) return mesmo.slice(0, n);
  const plano = lista.flat(); return plano.length >= n ? plano.slice(0, n) : plano;
}
async function sugestao(sb, tenantId, onibusId, n) {
  const o = (await q(sb.from('viagem_onibus').select('*').eq('tenant_id', tenantId).eq('id', onibusId)))[0]; if (!o) return { status: 404, erro: 'Ônibus não encontrado.' };
  const oc = new Set((await q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('onibus_id', o.id))).map((p) => p.poltrona).filter(Boolean));
  return { poltronas: sugerir(o, oc, Math.max(1, Math.min(parseInt(n, 10) || 1, 60))) };
}
// T1.2: ⚡ distribuir automaticamente quem está sem poltrona — reserva junta (família lado a lado, menor com o responsável),
//   quem precisa de assistência primeiro e na frente; prefere o ônibus onde a reserva já tem gente; grupo que não cabe junto vai no ônibus com mais lugar.
async function distribuir(sb, tenantId, viagemId, b = {}) {
  const os = (await q(sb.from('viagem_onibus').select('*').eq('tenant_id', tenantId).eq('viagem_id', viagemId))).sort((a, c) => a.ordem - c.ordem); if (!os.length) return { status: 409, erro: 'Inclua um veículo antes.' };
  const alvo = b.onibus_id ? os.filter((o) => String(o.id) === String(b.onibus_id)) : os;
  const ps = await q(sb.from('viagem_passageiros').select('*').eq('tenant_id', tenantId).eq('viagem_id', viagemId));
  const ocup = new Map(os.map((o) => [String(o.id), new Set(ps.filter((p) => String(p.onibus_id) === String(o.id) && p.poltrona).map((p) => p.poltrona))]));
  const livres = (o) => poltronas(o.layout).length - ocup.get(String(o.id)).size - (o.bloqueadas || []).filter((n) => !ocup.get(String(o.id)).has(n)).length;
  const sem = ps.filter((p) => !p.onibus_id || !p.poltrona); const grupos = new Map(); for (const p of sem) { const k = String(p.reserva_id); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(p); }
  const ordenar = (l) => { const out = []; const add = (p) => { if (out.includes(p)) return; out.push(p); l.filter((x) => String(x.responsavel_passageiro_id) === String(p.id)).forEach(add); }; l.filter((p) => !p.responsavel_passageiro_id || !l.some((x) => String(x.id) === String(p.responsavel_passageiro_id))).forEach(add); l.forEach(add); return out; };
  const lista = [...grupos.entries()].map(([k, l]) => ({ k, l: ordenar(l), assist: l.some((p) => p.assistencia) }))
    .sort((a, c) => (c.assist - a.assist) || (c.l.length - a.l.length));
  let n = 0; const naoCouberam = [];
  for (const g of lista) {
    const ja = ps.find((p) => String(p.reserva_id) === g.k && p.onibus_id && p.poltrona); const ord = [...alvo].sort((a, c) => (ja && String(c.id) === String(ja.onibus_id) ? 1 : 0) - (ja && String(a.id) === String(ja.onibus_id) ? 1 : 0));
    let escolhido = null; let lugares = [];
    const perto = (o) => ps.filter((p) => String(p.reserva_id) === g.k && String(p.onibus_id) === String(o.id) && p.poltrona).map((p) => p.poltrona);
    for (const o of ord) { const sug = sugerir(o, ocup.get(String(o.id)), g.l.length, perto(o)); if (sug.length === g.l.length && sugerirJuntos(o, ocup.get(String(o.id)), sug)) { escolhido = o; lugares = sug; break; } }
    if (!escolhido) { const o = [...alvo].sort((a, c) => livres(c) - livres(a))[0]; const sug = sugerir(o, ocup.get(String(o.id)), g.l.length); if (sug.length) { escolhido = o; lugares = sug; } }
    if (!escolhido) { naoCouberam.push(...g.l.map((p) => p.nome)); continue; }
    for (let i = 0; i < g.l.length; i++) { if (!lugares[i]) { naoCouberam.push(g.l[i].nome); continue; } await q(sb.from('viagem_passageiros').update({ onibus_id: escolhido.id, poltrona: lugares[i] }).eq('tenant_id', tenantId).eq('id', g.l[i].id).select()); ocup.get(String(escolhido.id)).add(lugares[i]); n++; }
  }
  return { distribuidos: n, sem_lugar: naoCouberam };
}
// o bloco sugerido está numa mesma fileira/lado (ou em fileiras seguidas)? — evita separar família quando outro ônibus comporta junto
function sugerirJuntos(o, ocup, sug) { if (sug.length <= 1) return true; const pos = new Map(); (o.layout?.pisos || []).forEach((p, pi) => (p.linhas || []).forEach((l, li) => l.forEach((c) => { if (c.t === 'p') pos.set(c.n, pi * 1000 + li); })));
  const ls = sug.map((x) => pos.get(x)); return Math.max(...ls) - Math.min(...ls) <= Math.ceil(sug.length / 2) - 1 + (sug.length > 2 ? 1 : 0); }

// importar planilha colada (Excel → linhas): nome, documento, nascimento, telefone, poltrona, responsável/grupo, ônibus (opcional)
async function importar(sb, tenantId, quem, viagemId, b = {}) {
  const v = (await q(sb.from('viagens').select('*').eq('tenant_id', tenantId).eq('id', viagemId)))[0]; if (!v) return { status: 404, erro: 'Viagem não encontrada.' };
  const os = await q(sb.from('viagem_onibus').select('*').eq('tenant_id', tenantId).eq('viagem_id', v.id)); const linhas = (Array.isArray(b.linhas) ? b.linhas : []).slice(0, 500);
  const achaOnibus = (t) => { if (!t) return os.length === 1 ? os[0] : null; const s = String(t).trim().toLowerCase(); return os.find((o) => String(o.ordem) === s || String(o.nome).toLowerCase() === s || String(o.placa || '').toLowerCase() === s) || null; };
  const grupos = new Map(); const erros = [];
  linhas.forEach((l, i) => { const nome = txt(l.nome, 120); if (!nome) return; const o = l.poltrona ? achaOnibus(l.onibus) : null; if (l.poltrona && !o) erros.push(`Linha ${i + 1} (${nome}): diga em qual ônibus (há ${os.length}).`);
    const chave = txt(l.grupo, 120) || `__${i}`; const g = grupos.get(chave) || { responsavel: txt(l.grupo, 120) || nome, passageiros: [] }; const emb = l.embarque ? (v.paradas || []).find((p) => p.embarque && String(p.nome).toLowerCase().includes(String(l.embarque).trim().toLowerCase())) : null;
    if (l.embarque && v.embarques_diferentes && !emb) erros.push(`Linha ${i + 1} (${nome}): não achei o ponto de embarque "${l.embarque}".`);
    g.passageiros.push({ ...l, embarque_parada_id: emb?.id || null, nome, onibus_id: o?.id || null, poltrona: o ? txt(l.poltrona, 6) : null }); grupos.set(chave, g); });
  if (erros.length) return { status: 400, erro: erros.slice(0, 5).join(' · ') };
  const todos = [...grupos.values()].flatMap((g) => g.passageiros); const err = await conferirPoltronas(sb, tenantId, v.id, todos); if (err) return { status: 409, erro: `Nada importado — ${err}` };
  let n = 0; for (const g of grupos.values()) { const r = await criarReserva(sb, tenantId, quem, v.id, { responsavel: g.responsavel, passageiros: g.passageiros, origem_venda: txt(b.origem_venda, 60) }); if (r.erro) return { status: r.status, erro: `Parou em ${g.responsavel}: ${r.erro} (${n} importado(s) antes)` }; n += r.passageiros.length; }
  return { importados: n, reservas: grupos.size };
}

module.exports = { distribuir, sugerirVeiculos, sugestaoVeiculos, TIPOS_SANGUE, MODELOS, poltronas, validarLayout, sugerir, listarMapas, salvarMapa, listarViagens, salvarViagem, detalhe, salvarOnibus, excluirOnibus, bloquear, criarReserva, editarReserva, excluirReserva, salvarPassageiro, adicionarPassageiro, excluirPassageiro, mover, sugestao, importar };
