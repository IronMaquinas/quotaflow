// backend/services/medicoes.js — etapa 18d · 18d.2 (simplificada) · 18d.3 (em preparação acompanha o contrato): 📏 MEDIÇÃO MENSAL DO CONTRATO DE LOCAÇÃO
//
// 18d.2 (decidido com o Marcony, 03/11/2026 — "bem simples, sentir o mercado"; 90% são locações de valor fixo mensal):
//   • o SISTEMA monta a medição de cada ciclo dos contratos ativos (relatório "pronto"): por equipamento, o valor mensal do
//     contrato, os dias em que ele esteve no contrato dentro do ciclo e o VALOR RECOMENDADO (proporcional aos dias —
//     ex.: entrou dia 15 num ciclo de 1 a 30 → 16/30 do mensal). Nada de horas/dias digitados.
//   • o COMERCIAL revisa (edita o valor a cobrar e a observação), salva e 📤 envia ao cliente — ou, sem o toggle
//     "Medição pelo locatário", só ✓ fecha.
//   • o CLIENTE (locatário) recebe o e-mail e a pendência no perfil dele: ✓ aprova, ou ✕ contesta comentando na linha do item.
//     Contestada volta para o comercial ajustar e reenviar.
//   • situação (coluna status): aberta = em preparação · enviada = aguardando o cliente · aprovada · devolvida = contestada.
//   • informativo automático (inspeções do ciclo) continua, congelado no fechamento. Ciclo: dia de início (1–28) ou mês do
//     calendário; vencimento da cobrança (dia) no contrato — só informativo no boletim.
// Regras do backend: sem DB.raw; ids com String(); 409 para trava de regra.

const R = require('./rotinasInspecao');

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const hojeBR = R.hojeBR;
const diaBR = (iso) => (iso ? new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10) : null);
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
const r2 = (n) => Math.round(Number(n) * 100) / 100;
// 18d.4: a medição do ciclo corrente só aparece (e é gerada) nos últimos D_ANTES dias do ciclo — antes disso é ruído na tela
const D_ANTES = 10;
const naJanela = (x, hoje) => x.fim < hoje || diasEntre(hoje, x.fim) <= D_ANTES;
const STATUS_NOME = { aberta: 'Em preparação', enviada: 'Aguardando o cliente', aprovada: 'Aprovada', devolvida: 'Contestada pelo cliente', pendente: 'A gerar' };
const STATUS_NOME_CLIENTE = { enviada: 'Aguardando a sua aprovação', aprovada: 'Aprovada', devolvida: 'Contestada — a locadora vai revisar' };
const ERRO_062 = { status: 409, erro: 'Rode a migration 062 antes (medição da locação)' };
const sem062 = (e) => /locacao_medicoes|medicao_|checklist_locatario|does not exist|schema cache/.test(String(e?.message || ''));

// ─── ciclos ─────────────────────────────────────────────────────────────────
const ultimoDia = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate(); // m 1–12
const ymd = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
/** ciclo que contém a data d → { inicio, fim, rotulo } */
function cicloDe(dia, d) {
  const a = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)), dd = Number(d.slice(8, 10));
  const ini = dia && dia > 1 ? dia : 1;
  let ia = a, im = m; if (dd < ini) { im--; if (im < 1) { im = 12; ia--; } }
  const inicio = ymd(ia, im, ini);
  let fa = ia, fm = im + 1; if (fm > 12) { fm = 1; fa++; }
  const fim = ini === 1 ? ymd(ia, im, ultimoDia(ia, im)) : ymd(fa, fm, ini - 1);
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return { inicio, fim, rotulo: ini === 1 ? `${MES[im - 1]}/${ia}` : `${inicio.slice(8)}/${inicio.slice(5, 7)} a ${fim.slice(8)}/${fim.slice(5, 7)}/${fim.slice(0, 4)}` };
}
/** ciclos do início do contrato até o ciclo de hoje (ou o fim do contrato), mais recentes primeiro */
function ciclos(c, hoje = hojeBR()) {
  const out = []; const ate = c.status === 'encerrado' && c.fim_real ? c.fim_real : hoje;
  if (!DATA.test(String(c.inicio || ''))) return out;
  for (let x = cicloDe(c.medicao_dia_inicio, c.inicio), n = 0; x.inicio <= ate && n < 120; n++) {
    out.push(x);
    const prox = new Date(Date.parse(`${x.fim}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
    x = cicloDe(c.medicao_dia_inicio, prox);
  }
  return out.reverse();
}

/** informativo automático do ciclo: inspeções (rotinas das locações do contrato) e horímetro por equipamento */
async function informativo(supabase, tenantId, c, inicio, fim) {
  const hoje = hojeBR();
  const locs = await q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id));
  const lids = new Set(locs.map((l) => String(l.id)));
  const eids = new Set(locs.map((l) => String(l.equipamento_id)));
  const rel = await R.relatorioCumprimento(supabase, tenantId, inicio, fim < hoje ? fim : hoje).catch(() => null);
  const linhas = (rel?.linhas || []).filter((l) => (l.locacao_id != null ? lids.has(String(l.locacao_id)) : eids.has(String(l.equipamento_id))));
  const ins = (await q(supabase.from('inspecoes').select('*').eq('tenant_id', tenantId)).catch(() => []))
    .filter((i) => eids.has(String(i.equipamento_id)) && diaBR(i.concluida_em) >= inicio && diaBR(i.concluida_em) <= fim);
  const porEq = {};
  for (const id of eids) {
    const l = linhas.filter((x) => String(x.equipamento_id) === id);
    const hs = ins.filter((i) => String(i.equipamento_id) === id && i.horimetro != null).map((i) => Number(i.horimetro)).filter(Number.isFinite);
    porEq[id] = { previstas: l.reduce((t, x) => t + x.esperadas, 0), no_prazo: l.reduce((t, x) => t + x.cumpridas, 0), feitas: ins.filter((i) => String(i.equipamento_id) === id).length,
      reprovadas: ins.filter((i) => String(i.equipamento_id) === id && i.resultado === 'reprovado').length,
      horimetro: hs.length >= 2 ? { de: Math.min(...hs), ate: Math.max(...hs), horas: Math.round((Math.max(...hs) - Math.min(...hs)) * 10) / 10 } : null,
      rotinas: l.map((x) => ({ modelo: x.modelo_nome, frequencia: x.frequencia_nome, responsavel: x.responsavel_nome, previstas: x.esperadas, no_prazo: x.cumpridas, pct: x.pct })) };
  }
  const tot = Object.values(porEq);
  return { gerado_em: new Date().toISOString(), por_equipamento: porEq,
    total: { previstas: tot.reduce((t, x) => t + x.previstas, 0), no_prazo: tot.reduce((t, x) => t + x.no_prazo, 0), feitas: tot.reduce((t, x) => t + x.feitas, 0), reprovadas: tot.reduce((t, x) => t + x.reprovadas, 0) } };
}

// ─── leitura ────────────────────────────────────────────────────────────────
async function contratoDo(supabase, tenantId, id) {
  return /^\d+$/.test(String(id)) ? (await q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null : null;
}
async function medicaoDo(supabase, tenantId, id) {
  return /^\d+$/.test(String(id)) ? (await q(supabase.from('locacao_medicoes').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null : null;
}
const resumo = (m) => {
  const itens = m.itens || [];
  return { total_itens: itens.length, total_cobrar: r2(itens.reduce((t, i) => t + Number(i.valor || 0), 0)), total_recomendado: r2(itens.reduce((t, i) => t + Number(i.valor_recomendado || 0), 0)),
    comentarios: itens.filter((i) => i.comentario_cliente).length, ajustados: itens.filter((i) => i.valor != null && i.valor_recomendado != null && Number(i.valor) !== Number(i.valor_recomendado)).length };
};
async function listar(supabase, tenantId, contratoId) {
  const c = await contratoDo(supabase, tenantId, contratoId); if (!c) return { status: 404, erro: 'Contrato não encontrado' };
  let ms = [];
  try { ms = await q(supabase.from('locacao_medicoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id)); } catch (e) { if (sem062(e)) return ERRO_062; throw e; }
  const hoje = hojeBR();
  for (let k = 0; k < ms.length; k++) if (ms[k].status === 'aberta') ms[k] = await sincronizar(supabase, tenantId, ms[k], c).catch(() => ms[k]); // 18d.3
  const lista = ciclos(c, hoje).filter((x) => { const m = ms.find((y) => y.inicio === x.inicio); return naJanela(x, hoje) || (m && m.status !== 'aberta'); }).map((x) => { // 18d.4: D-10
    const m = ms.find((y) => y.inicio === x.inicio) || null;
    return { ...x, medicao_id: m?.id || null, status: m?.status || 'pendente', status_nome: STATUS_NOME[m?.status || 'pendente'], em_andamento: x.fim >= hoje, ...(m ? resumo(m) : {}) };
  });
  return { contrato: { id: c.id, numero: c.numero, cliente: c.cliente, medicao_dia_inicio: c.medicao_dia_inicio ?? null, medicao_vencimento_dia: c.medicao_vencimento_dia ?? null, medicao_locatario: !!c.medicao_locatario, checklist_locatario: !!c.checklist_locatario }, ciclos: lista };
}

/** detalhe: a medição + o informativo (ao vivo enquanto não fechada; congelado depois) */
async function detalhe(supabase, tenantId, medicaoId, { cliente = false } = {}) {
  let m; try { m = await medicaoDo(supabase, tenantId, medicaoId); } catch (e) { if (sem062(e)) return ERRO_062; throw e; }
  if (!m) return { status: 404, erro: 'Medição não encontrada' };
  const c = await contratoDo(supabase, tenantId, m.contrato_id);
  if (!cliente) m = await sincronizar(supabase, tenantId, m, c); // 18d.3
  const info = m.status === 'aprovada' && m.informativo ? m.informativo : await informativo(supabase, tenantId, c, m.inicio, m.fim);
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || {};
  return { medicao: { ...m, status_nome: (cliente ? STATUS_NOME_CLIENTE : STATUS_NOME)[m.status] || STATUS_NOME[m.status], rotulo: cicloDe(c.medicao_dia_inicio, m.inicio).rotulo, ...resumo(m) },
    contrato: { id: c.id, numero: c.numero, cliente: c.cliente, local: c.local, medicao_locatario: !!c.medicao_locatario, medicao_vencimento_dia: c.medicao_vencimento_dia ?? null, tipo: c.tipo || 'locacao',
      envio_automatico_em: c.medicao_auto && (!c.medicao_auto_desde || m.fim >= c.medicao_auto_desde) ? dataAuto(c, m.fim) : null },
    informativo: info,
    paradas: await require('./ocorrencias').paradasDoContrato(supabase, tenantId, c.id, m.inicio, m.fim).catch(() => []), // 18h: só informa — o comercial decide
    empresa: { nome: emp.nome_fantasia || emp.nome || emp.razao_social || '', razao_social: emp.razao_social || null, cnpj: emp.cnpj || null } };
}

// ─── geração ────────────────────────────────────────────────────────────────
const evento = (acao, por, obs) => ({ em: new Date().toISOString(), acao, por: por || null, obs: obs || null });
/** itens do ciclo: equipamentos que estiveram no contrato em algum dia do ciclo, com dias e valor recomendado (proporcional) */
async function montarItens(supabase, tenantId, c, x) {
  const locs = (await q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id)))
    .filter((l) => l.inicio <= x.fim && (!(l.fim_real || null) || l.fim_real >= x.inicio));
  const eqs = new Map((await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId))).map((e) => [String(e.id), e]));
  const diasCiclo = diasEntre(x.inicio, x.fim) + 1;
  return locs.map((l) => {
    const e = eqs.get(String(l.equipamento_id)) || {};
    const de = l.inicio > x.inicio ? l.inicio : x.inicio;
    const fimLoc = l.fim_real || null; const ate = fimLoc && fimLoc < x.fim ? fimLoc : x.fim;
    const dias = Math.max(0, diasEntre(de, ate) + 1);
    const mensal = l.valor_mensal != null ? Number(l.valor_mensal) : null;
    const rec = mensal == null ? null : dias >= diasCiclo ? r2(mensal) : r2((mensal * dias) / diasCiclo);
    return { locacao_id: l.id, equipamento_id: l.equipamento_id, tag: e.tag || null, nome: e.nome || null, de, ate, dias, dias_ciclo: diasCiclo,
      valor_mensal: mensal, valor_recomendado: rec, valor: rec, obs: null, comentario_cliente: null };
  }).sort((a, b) => String(a.tag || '').localeCompare(String(b.tag || ''))).concat(await itensGuarda(supabase, tenantId, c, x, diasCiclo));
}
// 18za/18zb: 📦 guarda no pátio (contrato de armazenagem CA) — um item por equipamento do cliente que esteve no pátio no ciclo: m² × dias × preço do m²·dia
//   (preço ao mês → ÷ dias do ciclo). Diária: conta o dia da entrada e não o da saída (mesmo dia = 1) — a mesma da ficha de movimentação.
//   Mínimo contratado (m²/mês): se o m²·dia do ciclo ficar abaixo de mínimo × dias do ciclo, entra uma linha de complemento.
const doCliente = (c, b) => require('./patio').doClienteContrato(c, b);
const brl4 = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 }).replace(/\u00a0/g, ' ');
const m2f = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
async function itensGuarda(supabase, tenantId, c, x, diasCiclo) {
  if (c.tipo !== 'armazenagem' || !(Number(c.arm_preco) > 0)) return []; // 18zb: só o contrato de armazenagem (CA)
  let bens; try { bens = await q(supabase.from('patio_bens').select('*').eq('tenant_id', tenantId)); } catch { return []; }
  const P = require('./patio');
  const precoDia = c.arm_unidade === 'm2_dia' ? Number(c.arm_preco) : Number(c.arm_preco) / diasCiclo;
  const un = c.arm_unidade === 'm2_dia' ? 'm²·dia' : 'm²·mês';
  const out = [];
  for (const b of bens.filter((y) => y.status !== 'pre_entrada' && doCliente(c, y))) {
    const dias = P.diasNoPeriodo(b, x.inicio, x.fim); if (!dias) continue;
    const de = b.entrada_em > x.inicio ? b.entrada_em : x.inicio; const sai = b.status === 'saiu' && b.saida_em && b.saida_em <= x.fim ? b.saida_em : null;
    const area = b.area_m2 != null ? Number(b.area_m2) : null; const m2dia = area != null ? r2(area * dias) : null; const rec = m2dia != null ? r2(m2dia * precoDia) : null;
    out.push({ tipo: 'armazenagem', locacao_id: `pat-${b.id}`, patio_bem_id: b.id, equipamento_id: null, tag: b.numero, nome: `📦 Guarda no pátio — ${[b.descricao, b.modelo].filter(Boolean).join(' · ')}${b.numero_serie ? ` · série ${b.numero_serie}` : ''}`,
      de, ate: sai || x.fim, saiu_em: sai, dias, dias_ciclo: diasCiclo, area_m2: area, m2_dia: m2dia, preco: Number(c.arm_preco), unidade: c.arm_unidade, preco_m2_dia: Math.round(precoDia * 1e6) / 1e6,
      base: area != null ? `${m2f(area)} m² × ${dias} dia(s) × ${brl4(c.arm_preco)}/${un}${c.arm_unidade === 'm2_mes' ? ` ÷ ${diasCiclo}` : ''}` : 'sem m² informado na ficha do pátio',
      valor_mensal: null, valor_recomendado: rec, valor: rec, obs: null, comentario_cliente: null });
  }
  out.sort((a, b) => String(a.tag).localeCompare(String(b.tag)));
  const min = Number(c.arm_minimo_m2) || 0;
  if (min > 0) {
    const usado = out.reduce((t, i) => t + (i.m2_dia || 0), 0); const minimo = min * diasCiclo;
    if (usado < minimo) { const falta = r2(minimo - usado); const rec = r2(falta * precoDia);
      out.push({ tipo: 'armazenagem_minimo', locacao_id: 'pat-minimo', patio_bem_id: null, equipamento_id: null, tag: '📦', nome: `Mínimo contratado de guarda — ${m2f(min)} m²/mês (usou ${m2f(r2(usado / diasCiclo))} m² em média)`,
        de: x.inicio, ate: x.fim, dias: diasCiclo, dias_ciclo: diasCiclo, area_m2: null, m2_dia: falta, preco: Number(c.arm_preco), unidade: c.arm_unidade, preco_m2_dia: Math.round(precoDia * 1e6) / 1e6,
        base: `complemento: ${m2f(falta)} m²·dia × ${brl4(Math.round(precoDia * 1e4) / 1e4)}`, valor_mensal: null, valor_recomendado: rec, valor: rec, obs: null, comentario_cliente: null }); }
  }
  return out;
}
/** gera (se ainda não existe) a medição do ciclo — já com o valor recomendado como "valor a cobrar" */
async function abrir(supabase, tenantId, quem, contratoId, inicio) {
  const c = await contratoDo(supabase, tenantId, contratoId); if (!c) return { status: 404, erro: 'Contrato não encontrado' };
  const x = ciclos(c).find((y) => y.inicio === inicio); if (!x) return { status: 400, erro: 'Ciclo inválido para este contrato' };
  let ja; try { ja = (await q(supabase.from('locacao_medicoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id))).find((m) => m.inicio === x.inicio); } catch (e) { if (sem062(e)) return ERRO_062; throw e; }
  if (ja) return { medicao: ja };
  const itens = await montarItens(supabase, tenantId, c, x);
  if (!itens.length) return { status: 409, erro: 'Nenhum equipamento locado neste período — não há o que medir', vazia: true }; // 18y.1: não abre medição vazia
  const agora = new Date().toISOString();
  const { data, error } = await supabase.from('locacao_medicoes').insert([{ tenant_id: tenantId, contrato_id: c.id, inicio: x.inicio, fim: x.fim, status: 'aberta', itens, obs: null, informativo: null,
    preenchido_por: null, preenchido_em: null, enviado_por: null, enviado_em: null, aprovado_por: null, aprovado_em: null, devolvido_motivo: null,
    historico: [evento('gerada', quem?.usuarioNome || 'QuotaFlow')], criado_em: agora, atualizado_em: agora }]).select();
  if (error) { if (/locacao_medicoes_uk|duplicate/.test(error.message)) return { medicao: (await q(supabase.from('locacao_medicoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id))).find((m) => m.inicio === x.inicio) }; if (sem062(error)) return ERRO_062; throw new Error(error.message); }
  return { medicao: data[0] };
}
/** 18d.3: mantém a medição EM PREPARAÇÃO em dia com o contrato (equipamento que entrou/saiu, valor mensal ou datas que mudaram
 *  depois que ela foi gerada). Sem revisão do comercial ainda → refaz tudo; já revisada → só acrescenta o equipamento que faltava
 *  e tira o que não está mais no ciclo (os valores que ele digitou ficam). Medição enviada/aprovada não muda. */
const chaveItens = (l) => JSON.stringify((l || []).map((i) => [String(i.locacao_id), i.de, i.ate, i.valor_mensal, i.area_m2 ?? null, i.preco_m2_dia ?? null, i.m2_dia ?? null]).sort());
async function sincronizar(supabase, tenantId, m, c = null) {
  if (m.status !== 'aberta') return m;
  c = c || await contratoDo(supabase, tenantId, m.contrato_id); if (!c) return m;
  const novos = await montarItens(supabase, tenantId, c, { inicio: m.inicio, fim: m.fim });
  if (chaveItens(novos) === chaveItens(m.itens)) return m;
  let itens;
  if (!m.preenchido_em) itens = novos.map((n) => { const v = (m.itens || []).find((i) => String(i.locacao_id) === String(n.locacao_id)); return v ? { ...n, obs: v.obs } : n; });
  else itens = novos.map((n) => { const v = (m.itens || []).find((i) => String(i.locacao_id) === String(n.locacao_id)); return v ? { ...n, valor: v.valor, obs: v.obs, comentario_cliente: v.comentario_cliente } : { ...n, novo: true }; });
  const r = await mudar(supabase, tenantId, m, { itens }, evento('atualizada com o contrato', 'QuotaFlow'));
  return r.medicao;
}
/** ↻ recalcular: refaz os itens (equipamentos/valores do contrato mudaram) — só em preparação ou contestada; mantém observações */
async function recalcular(supabase, tenantId, quem, m) {
  if (!['aberta', 'devolvida'].includes(m.status)) return { status: 409, erro: 'Só dá para recalcular a medição em preparação ou contestada' };
  const c = await contratoDo(supabase, tenantId, m.contrato_id);
  const novos = await montarItens(supabase, tenantId, c, { inicio: m.inicio, fim: m.fim });
  const itens = novos.map((n) => { const v = (m.itens || []).find((i) => String(i.locacao_id) === String(n.locacao_id)); return v ? { ...n, obs: v.obs, comentario_cliente: v.comentario_cliente } : n; });
  return mudar(supabase, tenantId, m, { itens }, evento('recalculada', quem.usuarioNome));
}

// ─── escrita ────────────────────────────────────────────────────────────────
async function mudar(supabase, tenantId, m, upd, ev) {
  const { data, error } = await supabase.from('locacao_medicoes').update({ ...upd, ...(ev ? { historico: [...(m.historico || []), ev].slice(-60) } : {}), atualizado_em: new Date().toISOString() }).eq('id', m.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { medicao: data[0] };
}
const valorOk = (v) => { if (v === '' || v == null) return null; const n = Number(String(v).replace(/\./g, (x, i, t) => (t.includes(',') ? '' : x)).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? r2(n) : undefined; };
/** comercial: salva o valor a cobrar e as observações (em preparação ou contestada). body: { itens: [{ locacao_id, valor, obs }], obs } */
async function salvar(supabase, tenantId, quem, m, body = {}) {
  if (!['aberta', 'devolvida'].includes(m.status)) return { status: 409, erro: m.status === 'aprovada' ? 'Medição aprovada — reabra para alterar' : 'Medição com o cliente — aguarde a resposta' };
  const por = new Map((Array.isArray(body.itens) ? body.itens : []).map((i) => [String(i.locacao_id), i]));
  for (const v of por.values()) if (v.valor !== undefined && valorOk(v.valor) === undefined) return { status: 400, erro: 'Valor a cobrar inválido' };
  const itens = (m.itens || []).map((i) => { const v = por.get(String(i.locacao_id)); if (!v) return i;
    return { ...i, ...(v.valor !== undefined ? { valor: valorOk(v.valor) } : {}), ...(v.obs !== undefined ? { obs: texto(v.obs, 300) } : {}) }; });
  const upd = { itens, preenchido_por: quem.usuarioNome || null, preenchido_em: new Date().toISOString() };
  if (body.obs !== undefined) upd.obs = texto(body.obs, 1000);
  return mudar(supabase, tenantId, m, upd, null);
}
const semValor = (m) => (m.itens || []).filter((i) => i.valor == null);
/** comercial: 📤 envia ao cliente (com o toggle) ou ✓ fecha (sem o toggle) */
async function enviar(supabase, tenantId, quem, m) {
  if (!['aberta', 'devolvida'].includes(m.status)) return { status: 409, erro: 'Esta medição já foi enviada' };
  if (!(m.itens || []).length) return { status: 400, erro: 'Nenhum equipamento no contrato neste ciclo' };
  if (semValor(m).length) return { status: 400, erro: `Informe o valor a cobrar de ${semValor(m).length} item(ns) — ${semValor(m).map((i) => i.tag).join(', ')} (sem valor mensal no contrato${semValor(m).some((i) => i.tipo === 'armazenagem') ? ' ou sem m² na ficha do pátio' : ''})` };
  const c = await contratoDo(supabase, tenantId, m.contrato_id);
  if (!c.medicao_locatario) { // fecha direto — a empresa cuida de tudo
    const info = await informativo(supabase, tenantId, c, m.inicio, m.fim);
    return mudar(supabase, tenantId, m, { status: 'aprovada', enviado_por: quem.usuarioNome || null, enviado_em: new Date().toISOString(), aprovado_por: quem.usuarioNome || null, aprovado_em: new Date().toISOString(), informativo: info }, evento('fechada', quem.usuarioNome));
  }
  const itens = (m.itens || []).map((i) => ({ ...i, comentario_cliente: null })); // nova rodada: comentários anteriores ficam no histórico
  const r = await mudar(supabase, tenantId, m, { itens, status: 'enviada', enviado_por: quem.usuarioNome || null, enviado_em: new Date().toISOString(), devolvido_motivo: null }, evento('enviada', quem.usuarioNome, m.status === 'devolvida' ? 'reenviada após contestação' : null));
  await avisarCliente(supabase, tenantId, c, r.medicao).catch((e) => console.warn('⚠️ [medição] e-mail ao cliente:', e.message));
  return r;
}
async function reabrir(supabase, tenantId, quem, m, motivo) {
  if (!['aprovada', 'enviada'].includes(m.status)) return { status: 409, erro: 'Só a medição enviada ou aprovada pode ser reaberta' };
  const mot = texto(motivo, 500); if (!mot) return { status: 400, erro: 'Conte por que está reabrindo' };
  return mudar(supabase, tenantId, m, { status: 'aberta', aprovado_por: null, aprovado_em: null, informativo: null }, evento('reaberta', quem.usuarioNome, mot));
}
/** cliente: ✓ aprova */
async function aprovarCliente(supabase, tenantId, quem, m) {
  if (m.status !== 'enviada') return { status: 409, erro: 'Esta medição não está aguardando a sua aprovação' };
  const c = await contratoDo(supabase, tenantId, m.contrato_id);
  const info = await informativo(supabase, tenantId, c, m.inicio, m.fim);
  return mudar(supabase, tenantId, m, { status: 'aprovada', aprovado_por: quem.usuarioNome || null, aprovado_em: new Date().toISOString(), informativo: info }, evento('aprovada pelo cliente', quem.usuarioNome));
}
/** cliente: ✕ contesta — comentário na linha do item (pelo menos um) e/ou geral. body: { itens: [{ locacao_id, comentario }], motivo } */
async function contestar(supabase, tenantId, quem, m, body = {}) {
  if (m.status !== 'enviada') return { status: 409, erro: 'Esta medição não está aguardando a sua aprovação' };
  const por = new Map((Array.isArray(body.itens) ? body.itens : []).map((i) => [String(i.locacao_id), texto(i.comentario, 500)]));
  const itens = (m.itens || []).map((i) => ({ ...i, comentario_cliente: por.get(String(i.locacao_id)) || null }));
  const geral = texto(body.motivo, 1000);
  if (!geral && !itens.some((i) => i.comentario_cliente)) return { status: 400, erro: 'Comente na linha do item (ou no campo geral) o que não está de acordo' };
  const resumoTxt = [geral, ...itens.filter((i) => i.comentario_cliente).map((i) => `${i.tag}: ${i.comentario_cliente}`)].filter(Boolean).join(' · ');
  const r = await mudar(supabase, tenantId, m, { itens, status: 'devolvida', devolvido_motivo: resumoTxt.slice(0, 1000) }, evento('contestada pelo cliente', quem.usuarioNome, resumoTxt.slice(0, 500)));
  try { // 18r: 🔔 para quem enviou a medição (pelo nome) e para os gestores
    const N = require('./notificacoes'); const c = (await q(supabase.from('locacao_contratos').select('*').eq('id', m.contrato_id)).catch(() => []))[0] || {};
    const gs = await N.usuariosComPerfis(supabase, tenantId, ['gestor']);
    const quemEnviou = m.enviado_por ? (await q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId)).catch(() => [])).filter((u) => u.nome === m.enviado_por) : [];
    await N.avisarUsuarios(supabase, tenantId, [...quemEnviou, ...gs].map((u) => u.id), { tipo: 'medicao_contestada', chave: `medicao:${m.id}`,
      titulo: `📏 Medição contestada pelo cliente — ${c.numero || 'contrato'}${c.cliente ? ` · ${c.cliente}` : ''}`, texto: resumoTxt.slice(0, 140) || null, link: { tela: 'contratos', contrato_id: m.contrato_id, medicao_id: m.id } });
  } catch (e) { console.error('⚠️ [medicoes] 🔔:', e?.message || e); }
  return r;
}

// ─── visão da empresa (rotas) ───────────────────────────────────────────────
async function acaoEmpresa(supabase, tenantId, quem, medicaoId, acao, body = {}) {
  let m; try { m = await medicaoDo(supabase, tenantId, medicaoId); } catch (e) { if (sem062(e)) return ERRO_062; throw e; }
  if (!m) return { status: 404, erro: 'Medição não encontrada' };
  if (acao === 'salvar') return salvar(supabase, tenantId, quem, m, body);
  if (acao === 'enviar') return enviar(supabase, tenantId, quem, m);
  if (acao === 'recalcular') return recalcular(supabase, tenantId, quem, m);
  if (acao === 'reabrir') return reabrir(supabase, tenantId, quem, m, body.motivo);
  return { status: 400, erro: 'Ação inválida' };
}
/** 📏 relatórios da empresa: GERA sozinho a medição do ciclo corrente (e dos anteriores sem medição) dos contratos ativos
 *  e lista o que precisa de ação: em preparação (prontas para revisar e enviar), contestadas, aguardando o cliente */
async function pendencias(supabase, tenantId, quem = { usuarioNome: 'QuotaFlow' }) {
  let cs, ms; try { [cs, ms] = await Promise.all([q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId)), q(supabase.from('locacao_medicoes').select('*').eq('tenant_id', tenantId))]); }
  catch (e) { if (sem062(e)) return ERRO_062; throw e; }
  const hoje = hojeBR(); const out = [];
  for (const c of cs.filter((x) => x.status === 'ativo')) {
    for (const x of ciclos(c, hoje).slice(0, 3)) {
      let m = ms.find((y) => String(y.contrato_id) === String(c.id) && y.inicio === x.inicio);
      if (!naJanela(x, hoje) && (!m || m.status === 'aberta')) continue; // 18d.4: ciclo corrente só a partir de D-10
      if (!m) { const r = await abrir(supabase, tenantId, quem, c.id, x.inicio).catch(() => null); m = r?.medicao; if (!m) continue; }
      else m = await sincronizar(supabase, tenantId, m, c).catch(() => m); // 18d.3: equipamento que entrou depois de gerar
      if (m.status === 'aberta' && !(m.itens || []).length) { try { await supabase.from('locacao_medicoes').delete().eq('id', m.id).eq('tenant_id', tenantId); } catch { /* fica */ } continue; } // 18y.1: ficou vazia (nenhum equipamento no ciclo) → descarta
      if (m.status === 'aprovada') continue;
      out.push({ contrato_id: c.id, numero: c.numero, cliente: c.cliente, ...x, medicao_id: m.id, status: m.status, status_nome: STATUS_NOME[m.status], medicao_locatario: !!c.medicao_locatario, em_andamento: x.fim >= hoje, ...resumo(m) });
    }
  }
  const ord = { devolvida: 0, aberta: 1, enviada: 2 };
  return { pendencias: out.sort((a, b) => (ord[a.status] - ord[b.status]) || a.inicio.localeCompare(b.inicio)) };
}

/** 18d.5: 📏 aba Medições (empresa) — resumo + pendências + histórico (filtros de período/contrato/cliente/equipamento na tela) */
async function painelEmpresa(supabase, tenantId, quem) {
  const pend = await pendencias(supabase, tenantId, quem); if (pend.erro) return pend;
  const [cs, ms, locs, eqs] = await Promise.all([
    q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId)), q(supabase.from('locacao_medicoes').select('*').eq('tenant_id', tenantId)),
    q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId)), q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId)),
  ]);
  const hoje = hojeBR(); const ativos = cs.filter((c) => c.status === 'ativo'); const cid = new Set(ativos.map((c) => String(c.id)));
  const locAtivas = locs.filter((l) => l.status === 'ativa' && cid.has(String(l.contrato_id)) && l.inicio <= hoje);
  const porC = new Map(cs.map((c) => [String(c.id), c]));
  // mês anterior (ciclo do calendário que terminou antes do mês corrente)
  const d = new Date(`${hoje.slice(0, 7)}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); const mesAnt = d.toISOString().slice(0, 7);
  const doMesAnt = ms.filter((m) => m.inicio.slice(0, 7) === mesAnt);
  const tot = (m) => r2((m.itens || []).reduce((t, i) => t + Number(i.valor || 0), 0));
  const em60 = new Date(Date.parse(`${hoje}T12:00:00Z`) + 60 * 86400000).toISOString().slice(0, 10);
  const vencendo = ativos.filter((c) => c.fim_previsto && c.fim_previsto >= hoje && c.fim_previsto <= em60);
  const eqDe = new Map(eqs.map((e) => [String(e.id), e]));
  const resumo = {
    // 18y.1: o detalhe de cada número (cartões clicáveis)
    valor_mensal_itens: locAtivas.map((l) => { const c = porC.get(String(l.contrato_id)) || {}; const e = eqDe.get(String(l.equipamento_id)) || {}; return { contrato_id: c.id, numero: c.numero, cliente: c.cliente, tag: e.tag || null, nome: e.nome || null, inicio: l.inicio, valor_mensal: l.valor_mensal ?? null }; })
      .sort((a, b) => String(a.numero).localeCompare(String(b.numero)) || String(a.tag).localeCompare(String(b.tag))),
    valor_mensal: r2(locAtivas.reduce((t, l) => t + Number(l.valor_mensal || 0), 0)), equipamentos: locAtivas.length, contratos_ativos: ativos.length,
    para_revisar: pend.pendencias.filter((x) => ['aberta', 'devolvida'].includes(x.status)).length, contestadas: pend.pendencias.filter((x) => x.status === 'devolvida').length,
    aguardando: pend.pendencias.filter((x) => x.status === 'enviada').length, aguardando_valor: r2(pend.pendencias.filter((x) => x.status === 'enviada').reduce((t, x) => t + Number(x.total_cobrar || 0), 0)),
    mes_anterior: { mes: mesAnt, medido: r2(doMesAnt.filter((m) => m.status === 'aprovada').reduce((t, m) => t + tot(m), 0)), previsto: r2(doMesAnt.reduce((t, m) => t + (m.itens || []).reduce((s2, i) => s2 + Number(i.valor_recomendado || 0), 0), 0)),
      fechadas: doMesAnt.filter((m) => m.status === 'aprovada').length, total: doMesAnt.length,
      itens: doMesAnt.flatMap((m) => { const c = porC.get(String(m.contrato_id)) || {}; return (m.itens || []).map((i) => ({ medicao_id: m.id, contrato_id: c.id, numero: c.numero, cliente: c.cliente, status: m.status, status_nome: STATUS_NOME[m.status],
        tag: i.tag || null, nome: i.nome || null, de: i.de, ate: i.ate, dias: i.dias, dias_ciclo: i.dias_ciclo, valor_mensal: i.valor_mensal ?? null, valor_recomendado: i.valor_recomendado ?? null, valor: i.valor ?? null })); }) },
    vencendo: vencendo.length, vencendo_lista: vencendo.map((c) => ({ id: c.id, numero: c.numero, cliente: c.cliente, fim_previsto: c.fim_previsto })).sort((a, b) => a.fim_previsto.localeCompare(b.fim_previsto)),
  };
  const eqNome = new Map(eqs.map((e) => [String(e.id), e]));
  const historico = ms.filter((m) => { const c = porC.get(String(m.contrato_id)); return c && (naJanela({ inicio: m.inicio, fim: m.fim }, hoje) || m.status !== 'aberta'); })
    .map((m) => { const c = porC.get(String(m.contrato_id));
      return { medicao_id: m.id, contrato_id: c.id, numero: c.numero, cliente: c.cliente, cliente_id: c.cliente_id ?? null, inicio: m.inicio, fim: m.fim, rotulo: cicloDe(c.medicao_dia_inicio, m.inicio).rotulo,
        status: m.status, status_nome: STATUS_NOME[m.status], total: tot(m), aprovado_em: m.aprovado_em || null,
        itens: (m.itens || []).map((i) => ({ equipamento_id: i.equipamento_id, tag: i.tag || eqNome.get(String(i.equipamento_id))?.tag || null, nome: i.nome, valor: i.valor, dias: i.dias, dias_ciclo: i.dias_ciclo })) }; })
    .sort((a, b) => b.inicio.localeCompare(a.inicio) || String(a.numero).localeCompare(String(b.numero)));
  const opcoes = { contratos: cs.map((c) => ({ id: c.id, numero: c.numero, cliente: c.cliente })).sort((a, b) => String(b.numero).localeCompare(String(a.numero))),
    clientes: [...new Set(cs.map((c) => c.cliente).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    equipamentos: [...new Map(historico.flatMap((h) => h.itens).map((i) => [String(i.equipamento_id), { id: i.equipamento_id, tag: i.tag, nome: i.nome }])).values()].sort((a, b) => String(a.tag).localeCompare(String(b.tag))) };
  return { resumo, pendencias: pend.pendencias, historico, opcoes };
}

// ─── visão do LOCATÁRIO (escopo pelo usuário logado — services/contratosLocacao.escopoLocatario) ─────────
async function contratosDoLocatario(supabase, tenantId, usuarioId) {
  const esc = await require('./contratosLocacao').escopoLocatario(supabase, tenantId, usuarioId);
  return esc.contratos.filter((c) => c.medicao_locatario);
}
/** o cliente só vê as medições que o comercial já enviou (enviada, contestada, aprovada) */
async function painelLocatario(supabase, tenantId, usuarioId) {
  let cs; try { cs = await contratosDoLocatario(supabase, tenantId, usuarioId); } catch (e) { if (sem062(e)) return { contratos: [] }; throw e; }
  const ms = cs.length ? await q(supabase.from('locacao_medicoes').select('*').eq('tenant_id', tenantId)).catch(() => []) : [];
  return { contratos: cs.map((c) => ({ id: c.id, numero: c.numero, cliente: c.cliente, medicoes: ms.filter((m) => String(m.contrato_id) === String(c.id) && (m.status !== 'aberta' || m.enviado_em))
    .sort((a, b) => b.inicio.localeCompare(a.inicio)).slice(0, 12)
    .map((m) => ({ medicao_id: m.id, inicio: m.inicio, fim: m.fim, rotulo: cicloDe(c.medicao_dia_inicio, m.inicio).rotulo, status: m.status === 'aberta' ? 'devolvida' : m.status,
      status_nome: m.status === 'aberta' ? 'Em revisão pela locadora' : STATUS_NOME_CLIENTE[m.status], ...resumo(m) })) })).filter((c) => c.medicoes.length) };
}
async function medicaoDoLocatario(supabase, tenantId, usuarioId, medicaoId) {
  const cs = await contratosDoLocatario(supabase, tenantId, usuarioId);
  const m = await medicaoDo(supabase, tenantId, medicaoId);
  return m && (m.status !== 'aberta' || m.enviado_em) && cs.some((c) => String(c.id) === String(m.contrato_id)) ? m : null;
}
async function acaoLocatario(supabase, tenantId, usuario, acao, { medicaoId, body = {} } = {}) {
  const quem = { usuarioId: usuario.id, usuarioNome: usuario.nome || usuario.email };
  try {
    const m = await medicaoDoLocatario(supabase, tenantId, usuario.id, medicaoId); if (!m) return { status: 404, erro: 'Medição não encontrada' };
    if (acao === 'ver') return detalhe(supabase, tenantId, m.id, { cliente: true });
    if (acao === 'aprovar') return aprovarCliente(supabase, tenantId, quem, m);
    if (acao === 'contestar') return contestar(supabase, tenantId, quem, m, body);
    return { status: 400, erro: 'Ação inválida' };
  } catch (e) { if (sem062(e)) return ERRO_062; throw e; }
}

// ─── ✉ e-mails ao LOCATÁRIO ─────────────────────────────────────────────────
const escH = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dBR = (d) => String(d || '').slice(0, 10).split('-').reverse().join('/');
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
let mandarEmail = (para, assunto, html) => require('./emailService').enviarEmailCotacao(para, assunto, html);
function _definirEnvio(fn) { mandarEmail = fn; }
async function destinatarios(supabase, tenantId, contratoId) {
  const [vinc, usuarios] = await Promise.all([q(supabase.from('locacao_contrato_usuarios').select('*').eq('tenant_id', tenantId)), q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId))]);
  return vinc.filter((v) => String(v.contrato_id) === String(contratoId)).map((v) => usuarios.find((u) => String(u.id) === String(v.usuario_id))).filter((u) => u && u.ativo !== false && u.email);
}
async function empresaNome(supabase, tenantId) { const e = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || {}; return e.nome_fantasia || e.nome || e.razao_social || 'a locadora'; }
const portal = () => String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
/** no envio: "a medição de out/2026 está pronta para a sua aprovação" */
async function avisarCliente(supabase, tenantId, c, m) {
  const para = await destinatarios(supabase, tenantId, c.id); if (!para.length) return 0;
  const emp = await empresaNome(supabase, tenantId); const rot = cicloDe(c.medicao_dia_inicio, m.inicio).rotulo; const tot = resumo(m).total_cobrar;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#111"><p>Olá! A medição do contrato <b>${escH(c.numero)}</b> de <b>${escH(rot)}</b> (${dBR(m.inicio)} a ${dBR(m.fim)}) está pronta para a sua aprovação.</p>
    <p>Total: <b>${brl(tot)}</b>${c.medicao_vencimento_dia ? ` · vencimento dia ${String(c.medicao_vencimento_dia).padStart(2, '0')}` : ''}</p><p>Confira, aprove ou comente o que não estiver de acordo.</p>
    ${portal() ? `<p><a href="${portal()}/#medicoes" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Abrir a medição no QuotaFlow</a></p>` : ''}<p style="color:#666;font-size:12px">${escH(emp)} — enviado pelo QuotaFlow.</p></div>`;
  let n = 0; for (const u of para) { try { await mandarEmail(u.email, `📏 Medição ${rot} do contrato ${c.numero} — aguardando a sua aprovação`, html); n++; } catch (e) { console.error('❌ [medição] e-mail:', e.message || e); } }
  return n;
}
/** lembretes diários (cron das 7h / POST /api/recomendacoes/resumo-diario):
 *  • medição enviada e ainda sem resposta do cliente: lembrete 3 dias depois do envio (uma vez)
 *  • inspeção (toggle "Checklist pelo locatário"): rotina do locatário atrasada → uma vez por vencimento
 *  Controle em avisos_enviados (migration 029); sem ela não avisa. */
async function avisosDiarios(supabase, { hoje = hojeBR(), enviar = null } = {}) {
  const mandar = enviar || mandarEmail;
  const r = { medicao: 0, inspecao: 0, emails: 0, falhas: 0 };
  let cs; try { cs = (await q(supabase.from('locacao_contratos').select('*'))).filter((c) => c.status === 'ativo' && (c.medicao_locatario || c.checklist_locatario)); } catch (e) { if (sem062(e)) return r; throw e; }
  const porTenant = new Map(); for (const c of cs) { const k = String(c.tenant_id); if (!porTenant.has(k)) porTenant.set(k, []); porTenant.get(k).push(c); }
  for (const [tenantId, lista] of porTenant) {
    let enviados; try { enviados = await q(supabase.from('avisos_enviados').select('*').eq('tenant_id', tenantId)); } catch { continue; } // sem a 029
    const ja = new Set(enviados.map((a) => `${a.chave}|${a.marco}`));
    const ms = await q(supabase.from('locacao_medicoes').select('*').eq('tenant_id', tenantId)).catch(() => []);
    const emp = await empresaNome(supabase, tenantId);
    let painel = null;
    for (const c of lista) {
      const para = await destinatarios(supabase, tenantId, c.id); if (!para.length) continue;
      const itens = [];
      if (c.medicao_locatario) for (const m of ms.filter((y) => String(y.contrato_id) === String(c.id) && y.status === 'enviada' && y.enviado_em)) {
        if (diasEntre(diaBR(m.enviado_em), hoje) < 3) continue;
        const chave = `medicao_aprov:${m.id}:${diaBR(m.enviado_em)}`; if (ja.has(`${chave}|3`)) continue;
        itens.push({ chave, marco: '3', tipo: 'medicao', linha: `📏 <b>Medição ${escH(cicloDe(c.medicao_dia_inicio, m.inicio).rotulo)}</b> (${brl(resumo(m).total_cobrar)}) aguardando a sua aprovação desde ${dBR(diaBR(m.enviado_em))}.` });
      }
      if (c.checklist_locatario) {
        if (!painel) painel = await R.painel(supabase, tenantId).catch(() => ({}));
        const locs = new Set((await q(supabase.from('equipamento_locacoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id))).filter((l) => l.status === 'ativa').map((l) => String(l.id)));
        for (const pe of Object.values(painel)) for (const rt of pe.rotinas || []) {
          if (rt.responsavel !== 'locatario' || !locs.has(String(rt.locacao_id)) || rt.estado !== 'atrasada') continue;
          const chave = `insp_loc:${rt.id}:${rt.proxima}`; if (ja.has(`${chave}|vencido`)) continue;
          itens.push({ chave, marco: 'vencido', tipo: 'inspecao', linha: `🔍 <b>${escH(rt.equipamento_nome)}</b> — ${escH(rt.modelo_nome)} (${escH(String(rt.frequencia_nome).toLowerCase())}) atrasada desde ${dBR(rt.proxima)}.` });
        }
      }
      if (!itens.length) continue;
      const nMed = itens.filter((i) => i.tipo === 'medicao').length; const nIns = itens.length - nMed;
      const assunto = `${nMed ? `📏 Medição do contrato ${c.numero} aguardando aprovação` : ''}${nMed && nIns ? ' e ' : ''}${nIns ? `🔍 ${nIns} inspeção(ões) atrasada(s)` : ''} — ${emp}`;
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#111"><p>Olá! Pendências do contrato <b>${escH(c.numero)}</b> com <b>${escH(emp)}</b>:</p><ul>${itens.map((i) => `<li>${i.linha}</li>`).join('')}</ul>${portal() ? `<p><a href="${portal()}/#${nMed ? 'medicoes' : 'contratos'}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Abrir no QuotaFlow</a></p>` : ''}<p style="color:#666;font-size:12px">Aviso automático do QuotaFlow.</p></div>`;
      let ok = 0;
      for (const u of para) { try { await mandar(u.email, assunto, html); ok++; r.emails++; } catch (e) { r.falhas++; console.error('❌ [medição] e-mail:', e.message || e); } }
      if (ok) { await supabase.from('avisos_enviados').upsert(itens.map((i) => ({ tenant_id: tenantId, chave: i.chave, marco: i.marco, destinatarios: ok })), { onConflict: 'tenant_id,chave,marco', ignoreDuplicates: true }); r.medicao += nMed; r.inspecao += nIns; }
    }
  }
  console.log(`📏 [medição] lembretes ao locatário: ${r.medicao} medição(ões), ${r.inspecao} inspeção(ões), ${r.emails} e-mail(s), ${r.falhas} falha(s)`);
  return r;
}

// ─── 18zc: 📤 ENVIO AUTOMÁTICO (cron diário das 7h) ─────────────────────────────────────────────────────────────────────────────
//   Contrato com "Envio automático" ligado: N dias depois do fim do ciclo (medicao_auto_dias), a medição vai sozinha —
//   com aprovação do cliente → enviada para ele aprovar; sem → fechada e o resumo vai por e-mail ao contato do contrato.
//   Véspera: 🔔 ao gestor ("amanhã vai sozinha — revise se quiser"). Não vai sozinha (e o gestor é avisado do motivo) quando:
//   item sem valor/sem m², nenhum item no ciclo, ou o cliente contestou (status devolvida — precisa de alguém).
//   Só ciclos que terminam a partir do dia em que o envio automático foi ligado (medicao_auto_desde).
const somaDias = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const dataAuto = (c, fim) => somaDias(fim, Number.isInteger(Number(c.medicao_auto_dias)) ? Number(c.medicao_auto_dias) : 1);
const QUEM_AUTO = { usuarioNome: 'QuotaFlow (envio automático)' };
async function resumoPorEmail(supabase, tenantId, c, m) {
  const para = String(c.contato_email || '').trim(); if (!para) return 0;
  const emp = await empresaNome(supabase, tenantId); const rot = cicloDe(c.medicao_dia_inicio, m.inicio).rotulo; const tot = resumo(m).total_cobrar;
  const linhas = (m.itens || []).map((i) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee"><b>${escH(i.tag || '')}</b> ${escH(i.nome || '')}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${brl(i.valor)}</td></tr>`).join('');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#111"><p>Olá! Segue a medição do contrato <b>${escH(c.numero)}</b> de <b>${escH(rot)}</b> (${dBR(m.inicio)} a ${dBR(m.fim)}).</p>
    <table style="border-collapse:collapse;font-size:13px">${linhas}<tr><td style="padding:6px 8px"><b>Total</b></td><td style="padding:6px 8px;text-align:right"><b>${brl(tot)}</b></td></tr></table>
    ${c.medicao_vencimento_dia ? `<p>Vencimento: dia ${String(c.medicao_vencimento_dia).padStart(2, '0')}.</p>` : ''}<p style="color:#666;font-size:12px">${escH(emp)} — enviado pelo QuotaFlow.</p></div>`;
  try { await mandarEmail(para, `📏 Medição ${rot} do contrato ${c.numero} — ${emp}`, html); return 1; } catch (e) { console.error('❌ [medição auto] e-mail:', e.message || e); return 0; }
}
async function envioAutomatico(supabase, { hoje = hojeBR() } = {}) {
  const N = require('./notificacoes');
  const r = { enviadas: 0, fechadas: 0, avisos_vespera: 0, bloqueadas: 0 };
  let cs; try { cs = (await q(supabase.from('locacao_contratos').select('*'))).filter((c) => c.status === 'ativo' && c.medicao_auto); } catch { return r; } // sem a 087
  for (const c of cs) {
    const tenantId = c.tenant_id;
    for (const x of ciclos(c, hoje)) {
      if (x.fim >= hoje || (c.medicao_auto_desde && x.fim < c.medicao_auto_desde)) continue;
      const quando = dataAuto(c, x.fim); if (quando > somaDias(hoje, 1)) continue;
      if (quando < somaDias(hoje, -30)) continue; // atraso muito antigo: não manda sozinho (alguém olha)
      let m = (await q(supabase.from('locacao_medicoes').select('*').eq('tenant_id', tenantId).eq('contrato_id', c.id)).catch(() => [])).find((y) => y.inicio === x.inicio) || null;
      if (m && !['aberta', 'devolvida'].includes(m.status)) continue; // já foi
      const total = () => brl(resumo(m || { itens: [] }).total_cobrar);
      if (quando === somaDias(hoje, 1)) { // véspera
        if (!m) { const a = await abrir(supabase, tenantId, QUEM_AUTO, c.id, x.inicio); m = a.medicao || null; } else m = await sincronizar(supabase, tenantId, m, c);
        if (!m || m.status !== 'aberta') continue;
        await N.avisarPerfis(supabase, tenantId, ['gestor'], { tipo: 'medicao_auto', chave: `medicao-auto-vespera:${m.id}`, titulo: `📏 Amanhã a medição ${x.rotulo} do ${c.numero} vai sozinha (${total()})`,
          texto: `${c.cliente} — ${c.medicao_locatario ? 'será enviada para o cliente aprovar' : 'será fechada e o resumo vai por e-mail ao contato'}. Revise se quiser.`, link: { tela: 'contratos' } }).catch(() => 0);
        r.avisos_vespera++; continue;
      }
      // dia do envio (ou atrasado até 30 dias — o cron pode ter falhado)
      if (m?.status === 'devolvida') { await N.avisarPerfis(supabase, tenantId, ['gestor'], { tipo: 'medicao_auto', chave: `medicao-auto-bloq:${m.id}`, titulo: `📏 Medição ${x.rotulo} do ${c.numero} não foi sozinha — o cliente contestou`, texto: `${c.cliente}: revise os comentários e reenvie.`, link: { tela: 'contratos' } }).catch(() => 0); r.bloqueadas++; continue; }
      if (!m) { const a = await abrir(supabase, tenantId, QUEM_AUTO, c.id, x.inicio); if (a.vazia) continue; m = a.medicao || null; if (!m) continue; } else m = await sincronizar(supabase, tenantId, m, c);
      const e = await enviar(supabase, tenantId, QUEM_AUTO, m);
      if (e.erro) { await N.avisarPerfis(supabase, tenantId, ['gestor'], { tipo: 'medicao_auto', chave: `medicao-auto-bloq:${m.id}`, titulo: `📏 Medição ${x.rotulo} do ${c.numero} não foi sozinha`, texto: `${c.cliente}: ${e.erro}`, link: { tela: 'contratos' } }).catch(() => 0); r.bloqueadas++; continue; }
      m = e.medicao;
      if (m.status === 'aprovada') { await resumoPorEmail(supabase, tenantId, c, m); r.fechadas++; } else r.enviadas++;
      await N.avisarPerfis(supabase, tenantId, ['gestor'], { tipo: 'medicao_auto', chave: `medicao-auto-ok:${m.id}`, titulo: `📏 Medição ${x.rotulo} do ${c.numero} ${m.status === 'aprovada' ? 'fechada' : 'enviada ao cliente'} automaticamente (${brl(resumo(m).total_cobrar)})`,
        texto: `${c.cliente}${m.status === 'aprovada' ? (c.contato_email ? ` — resumo enviado para ${c.contato_email}` : ' — contrato sem e-mail de contato: o resumo não foi enviado') : ' — aguardando a aprovação do cliente'}.`, link: { tela: 'contratos' } }).catch(() => 0);
    }
  }
  console.log(`📤 [medição auto] ${r.enviadas} enviada(s), ${r.fechadas} fechada(s), ${r.avisos_vespera} aviso(s) de véspera, ${r.bloqueadas} bloqueada(s)`);
  return r;
}

module.exports = { envioAutomatico, dataAuto, itensGuarda, painelEmpresa, D_ANTES, naJanela, STATUS_NOME, cicloDe, ciclos, listar, detalhe, abrir, recalcular, salvar, enviar, reabrir, aprovarCliente, contestar, acaoEmpresa, pendencias, painelLocatario, acaoLocatario, informativo, avisosDiarios, _definirEnvio };
