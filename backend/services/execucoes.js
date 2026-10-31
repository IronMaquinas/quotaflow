// backend/services/execucoes.js — etapa 16a
//
// 🚛 PROGRAMAÇÃO — EXECUÇÕES (decidido com o Marcony, 29/10/2026):
//   • GENÉRICO: o modelo de BID diz o que o aceite gera (tipo_execucao). O PV é igual para todos; a EXECUÇÃO muda:
//       transporte → AT (esta etapa) · locacao → contrato de locação que já existe (depois) · servico → AS (futuro) · venda (futuro).
//   • AT-AAAA-NNNN — UMA POR TRECHO do pedido: itens do trecho SEM valores, coleta/entrega (local, data e hora),
//     MOTORISTA (selo de conformidade: 🔴 algo vencido BLOQUEIA — gestor/admin libera com justificativa registrada; 🟡 só avisa),
//     CONJUNTO = cavalo + até 2 implementos (algum BLOQUEADO por inspeção → bloqueia), anexos NF-e / CT-e / MDF-e.
//   • CONFLITO: o mesmo motorista ou equipamento em outra AT no mesmo período → pede confirmação (agenda da frota).
//   • STATUS programada → em execução → concluída | cancelada e atualiza SOZINHO os itens do pedido
//     (programado → em execução → concluído; cancelada volta para "a programar").
//   • Ver: admin, gestor, operação (comercial vê pelo pedido). Alterar: admin, gestor, operação. Liberar 🔴: admin, gestor.
// Regras do backend: sem DB.raw; ids com String(); filtros sem null; o mock não aplica default do banco.

const crypto = require('crypto');
const B = () => require('./bids');
const FV = () => require('./fluxoViagem'); // 16e: fluxo da viagem

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const idOk = (v) => /^\d+$/.test(String(v ?? '')) || /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const hojeBR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const quando = (v) => { const t = String(v || '').trim(); if (!t) return null; const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t}T08:00:00-03:00` : /T\d{2}:\d{2}$/.test(t) ? `${t}:00-03:00` : t); return Number.isNaN(d.getTime()) ? undefined : d.toISOString(); };
const dataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '');

const TIPOS = { transporte: 'Transporte (AT)', locacao: 'Locação', servico: 'Serviço (AS)', venda: 'Venda / entrega' };
const STATUS = { rascunho: 'Rascunho', programada: 'Programada', em_execucao: 'Em execução', concluida: 'Concluída', cancelada: 'Cancelada' };
const ATIVAS = ['programada', 'em_execucao'];
const ANEXOS = { nfe: 'NF-e', cte: 'CT-e', mdfe: 'MDF-e', outro: 'Outro' };
const MIME = { 'application/pdf': 'pdf', 'application/xml': 'xml', 'text/xml': 'xml', 'image/jpeg': 'jpg', 'image/png': 'png' };
const LIMITE = 10 * 1024 * 1024;
const BUCKET = 'documentos';
const TTL_LINK = 12 * 3600; // links assinados do kit do motorista (renovados a cada abertura)
const novoToken = () => crypto.randomBytes(20).toString('hex');
const linkMotorista = (token) => (token ? `${String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/^FRONTEND_URL=/, '').replace(/\/+$/, '')}/#at?t=${token}` : null);
const STATUS_ITEM_PV = { programada: 'programado', em_execucao: 'em_execucao', concluida: 'concluido', cancelada: 'a_programar' };

/** selo de conformidade de cada colaborador (mesmo cálculo de 👷 Pessoas). Trocável nos testes. */
let calcularSelos = async (supabase, tenantId, colabs) => {
  const F = require('./funcoes'); const EE = require('./epiEntregas'); const TR = require('./treinamentos'); const K = require('./competencias'); const CF = require('./conformidade');
  const tenta = async (fn, padrao) => { try { return await fn(); } catch { return padrao; } };
  const fichas = await tenta(() => F.fichasDoTenant(supabase, tenantId, colabs), new Map());
  const [bE, bT, bK] = await Promise.all([tenta(() => EE.carregarBase(supabase, tenantId), null), tenta(() => TR.carregarBase(supabase, tenantId), null), tenta(() => K.carregarBase(supabase, tenantId), null)]);
  const out = new Map();
  for (const c of colabs) {
    const f = fichas.get(String(c.id));
    try {
      out.set(String(c.id), CF.selo({ funcaoLigada: !!f?.funcao, docs: f?.resumo, epi: bE ? EE.statusColaborador(c, bE).resumo : null, trein: bT ? TR.statusColaborador(c, bT).resumo : null,
        comp: bK ? K.statusColaborador(c, bK, F.ESCOLARIDADES).resumo : null }));
    } catch { out.set(String(c.id), { nivel: 'sem_funcao', geral: null, vencidos: 0, pilares: [] }); }
  }
  return out;
};
function _definirSelos(fn) { calcularSelos = fn; }

const podeLiberar = (perfis = []) => perfis.some((p) => ['admin', 'gestor'].includes(p));

// ─── 16c: documentos do motorista (CNH) e do conjunto (CRLV) — puxados do cadastro (👷 Pessoas / documentos) ──
//   status pela DATA DA VIAGEM: ok · vence (até 30 dias depois) · vencido (antes/na viagem → BLOQUEIA; gestor/admin libera) · ausente (só avisa)
const DOCS_KIT = { motorista: { codigo: 'cnh', rotulo: 'CNH', rx: /\bcnh\b/i }, equipamento: { codigo: 'crlv', rotulo: 'CRLV', rx: /\bcrlv\b/i } };
async function carregarDocs(supabase, tenantId) {
  const [docs, tipos] = await Promise.all([q(supabase.from('documentos').select('*').eq('tenant_id', tenantId)).catch(() => []), q(supabase.from('documento_tipos').select('*')).catch(() => [])]);
  const codigoDe = new Map(tipos.map((x) => [String(x.id), x.codigo]));
  return docs.filter((d) => !d.substituido_por).map((d) => ({ ...d, codigo: codigoDe.get(String(d.tipo_id)) || null }));
}
function avaliarDocs(base, { motorista_id, motorista_nome, conjunto = [], inicio, fim }) {
  const ref = String(fim || inicio || new Date().toISOString()).slice(0, 10);
  const mais30 = new Date(new Date(`${ref}T12:00:00Z`).getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const um = (alvo, donoId, dono, papel) => {
    const def = DOCS_KIT[alvo];
    const doc = base.filter((d) => (alvo === 'motorista' ? String(d.colaborador_id) === String(donoId) : String(d.equipamento_id) === String(donoId)) && (d.codigo === def.codigo || def.rx.test(String(d.tipo_nome || ''))))
      .sort((a, b) => String(b.vence_em || '9999').localeCompare(String(a.vence_em || '9999')))[0];
    const status = !doc ? 'ausente' : !doc.vence_em ? 'ok' : doc.vence_em < ref ? 'vencido' : doc.vence_em <= mais30 ? 'vence' : 'ok';
    return { chave: `${alvo}:${donoId}`, alvo, papel, dono, dono_id: donoId, rotulo: def.rotulo, status, vence_em: doc?.vence_em || null, documento_id: doc?.id || null, numero: doc?.numero || null, tem_arquivo: !!doc?.arquivo_path, path: doc?.arquivo_path || null, arquivo_nome: doc?.arquivo_nome || null };
  };
  const out = [];
  if (motorista_id != null && motorista_id !== '') out.push(um('motorista', motorista_id, motorista_nome, 'motorista'));
  for (const c of conjunto) out.push(um('equipamento', c.id, c.tag || c.nome, c.papel));
  return out;
}
const semPath = (docs) => docs.map(({ path, ...d }) => d);
/** POST /checar-docs — para o modal: docs do motorista/conjunto escolhidos na data */
async function docsDoConjunto(supabase, tenantId, { motorista_id, cavalo_id, implementos = [], inicio, fim } = {}) {
  const b = await base(supabase, tenantId); const mot = b.motoristas.find((m) => String(m.id) === String(motorista_id));
  const conjunto = [cavalo_id, ...(implementos || [])].filter((x) => x != null && x !== '').map((id, i) => { const e = b.equipamentos.find((x) => String(x.id) === String(id)); return e ? { id: e.id, tag: e.tag, nome: e.nome, papel: i === 0 ? 'cavalo' : 'implemento' } : null; }).filter(Boolean);
  return { docs: semPath(avaliarDocs(await carregarDocs(supabase, tenantId), { motorista_id: mot ? mot.id : null, motorista_nome: mot?.nome, conjunto, inicio: quando(inicio), fim: quando(fim) })) };
}
/** link para abrir o arquivo de um documento do cadastro (só CNH/CRLV de quem pode estar numa AT) */
async function linkDocCadastro(supabase, tenantId, docId) {
  const d = /^\d+$/.test(String(docId)) ? (await q(supabase.from('documentos').select('*').eq('tenant_id', tenantId).eq('id', docId)))[0] : null;
  if (!d || !d.arquivo_path) return { status: 404, erro: 'Documento sem arquivo no cadastro' };
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(d.arquivo_path, 3600, { download: false });
  if (error) throw new Error(error.message);
  return { url: data?.signedUrl || null, nome: d.arquivo_nome || d.tipo_nome, mime: d.arquivo_mime || null };
}

/** motoristas (colaboradores ativos, com selo) e equipamentos (com bloqueio) para escolher na AT */
async function base(supabase, tenantId) {
  const [colabs, equips] = await Promise.all([q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId)).catch(() => []), q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId))]);
  const ativos = colabs.filter((c) => c.situacao !== 'desligado');
  const selos = await calcularSelos(supabase, tenantId, ativos);
  const ehMotorista = (c) => /motorista|condutor/i.test(String(c.funcao?.nome || c.funcao || ''));
  return {
    motoristas: ativos.map((c) => ({ id: c.id, nome: c.nome, funcao: c.funcao?.nome || c.funcao || null, cnh: c.cnh_categoria || null, motorista: ehMotorista(c), selo: selos.get(String(c.id)) || null }))
      .sort((a, b) => (b.motorista - a.motorista) || String(a.nome).localeCompare(String(b.nome), 'pt-BR')),
    equipamentos: equips.filter((e) => e.ativo !== false).map((e) => ({ id: e.id, tag: e.tag || '', nome: e.nome || '', bloqueado: !!e.bloqueado, bloqueio_motivo: e.bloqueio_motivo || null, inspecao_modelo_id: e.inspecao_modelo_id ?? null }))
      .sort((a, b) => String(a.tag || a.nome).localeCompare(String(b.tag || b.nome))),
    tipos: TIPOS, status: STATUS, anexos: ANEXOS, modelos_inspecao: await FV().modelosInspecao(supabase, tenantId), marcos: FV().MARCOS,
  };
}

async function exDoTenant(supabase, tenantId, id) { return /^\d+$/.test(String(id)) ? (await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null : null; }
async function proximoNumero(supabase, tenantId, prefixo = 'AT') {
  const pre = `${prefixo}-${hojeBR().slice(0, 4)}-`;
  const nums = (await q(supabase.from('execucoes').select('numero').eq('tenant_id', tenantId))).map((x) => String(x.numero || '')).filter((n) => n.startsWith(pre)).map((n) => Number(n.slice(pre.length)) || 0);
  return `${pre}${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
}
const fimEfetivo = (e) => e.fim_previsto || (e.inicio_previsto ? new Date(new Date(e.inicio_previsto).getTime() + 24 * 3600000).toISOString() : null);
const sobrepoe = (a, b) => !!a.inicio_previsto && !!b.inicio_previsto && a.inicio_previsto < fimEfetivo(b) && b.inicio_previsto < fimEfetivo(a);
/** outras ATs ativas no mesmo período com o mesmo motorista ou equipamento */
function conflitos(nova, outras) {
  const eqs = new Set((nova.conjunto || []).map((c) => String(c.id)));
  return outras.filter((o) => String(o.id) !== String(nova.id || '') && ATIVAS.includes(o.status) && sobrepoe(nova, o)).flatMap((o) => {
    const l = [];
    if (nova.motorista_id != null && String(o.motorista_id) === String(nova.motorista_id)) l.push({ at: o.numero, id: o.id, tipo: 'motorista', texto: `${nova.motorista_nome || 'O motorista'} já está na ${o.numero} (${dataHora(o.inicio_previsto)} → ${dataHora(fimEfetivo(o))})` });
    for (const c of o.conjunto || []) if (eqs.has(String(c.id))) l.push({ at: o.numero, id: o.id, tipo: 'equipamento', texto: `${c.tag || c.nome} já está na ${o.numero} (${dataHora(o.inicio_previsto)} → ${dataHora(fimEfetivo(o))})` });
    return l;
  });
}

/** 16b: mesa de programação — confere conflitos das linhas ANTES de salvar (contra as ATs existentes e entre as próprias linhas)
 *  linhas: [{ chave, inicio, fim, motorista_id, motorista_nome, cavalo_id, implementos }] → { chave: [conflitos] } */
async function checar(supabase, tenantId, linhas = []) {
  const l = (Array.isArray(linhas) ? linhas : []).slice(0, 200).map((x) => ({ id: `linha:${x.chave}`, numero: x.rotulo || 'outra linha desta mesa', status: 'programada',
    inicio_previsto: quando(x.inicio) || null, fim_previsto: quando(x.fim) || null, motorista_id: x.motorista_id || null, motorista_nome: x.motorista_nome || null,
    conjunto: [x.cavalo_id, ...(x.implementos || [])].filter((y) => y != null && y !== '').map((id) => ({ id, tag: x.tags?.[id] || null })), chave: x.chave }));
  const outras = await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId));
  const r = {};
  for (const n of l) if (n.inicio_previsto) r[n.chave] = conflitos(n, [...outras, ...l.filter((o) => o !== n && o.inicio_previsto)]);
  return { conflitos: r };
}
/** monta e valida os dados da AT. body: { inicio, fim, origem, destino, motorista_id, cavalo_id, implementos: [ids], observacoes, liberacao_justificativa, ignorar_conflito } */
async function montar(supabase, tenantId, quem, body, atual = {}) {
  const inicio = quando(body.inicio ?? atual.inicio_previsto); const fim = quando(body.fim ?? atual.fim_previsto);
  if (!inicio) return { status: 400, erro: 'Informe a data e hora da coleta (início)' };
  if (fim === undefined || inicio === undefined) return { status: 400, erro: 'Data/hora inválida' };
  if (fim && fim <= inicio) return { status: 400, erro: 'A entrega (fim) precisa ser depois da coleta (início)' };
  const b = await base(supabase, tenantId);
  const motId = body.motorista_id !== undefined ? body.motorista_id : atual.motorista_id;
  const mot = motId != null && motId !== '' ? b.motoristas.find((m) => String(m.id) === String(motId)) : null;
  if (motId != null && motId !== '' && !mot) return { status: 400, erro: 'Motorista não encontrado (ou desligado)' };
  const cavId = body.cavalo_id !== undefined ? body.cavalo_id : atual.cavalo_id;
  if (cavId == null || cavId === '') return { status: 400, erro: 'Escolha o cavalo (veículo trator)' };
  const implIds = Array.isArray(body.implementos) ? body.implementos.filter((x) => x != null && x !== '') : (atual.conjunto || []).filter((c) => c.papel === 'implemento').map((c) => c.id);
  if (implIds.length > 2) return { status: 400, erro: 'No máximo 2 implementos (ex.: prancha + dolly)' };
  const ids = [cavId, ...implIds].map(String);
  if (new Set(ids).size !== ids.length) return { status: 400, erro: 'O mesmo equipamento foi escolhido duas vezes' };
  const conjunto = [];
  for (const [i, idEq] of ids.entries()) {
    const e = b.equipamentos.find((x) => String(x.id) === idEq); if (!e) return { status: 400, erro: 'Equipamento não encontrado' };
    if (e.bloqueado) return { status: 409, erro: `🔒 ${e.tag || e.nome} está BLOQUEADO por inspeção${e.bloqueio_motivo ? ` (${e.bloqueio_motivo})` : ''} — libere em 🔍 Inspeções antes de programar` };
    conjunto.push({ id: e.id, tag: e.tag, nome: e.nome, papel: i === 0 ? 'cavalo' : 'implemento' });
  }
  const avisos = []; let liberacao = atual.liberacao || null;
  if (mot) {
    const nivel = mot.selo?.nivel;
    const mudouMotorista = String(motId) !== String(atual.motorista_id ?? '');
    if (nivel === 'atencao' && (mudouMotorista || !liberacao)) {
      const j = texto(body.liberacao_justificativa, 500);
      if (!j) return { status: 409, erro: `🔴 ${mot.nome} tem ${mot.selo?.vencidos || ''} item(ns) VENCIDO(s) no selo de conformidade (CNH, ASO, treinamento…). Só gestor/admin libera, com justificativa.`, codigo: 'motorista_bloqueado', selo: mot.selo };
      if (!podeLiberar(quem.perfis)) return { status: 409, erro: 'Só gestor ou admin pode liberar motorista com item vencido', codigo: 'motorista_bloqueado', selo: mot.selo };
      if (j.length < 15) return { status: 400, erro: 'Justificativa da liberação: mínimo 15 caracteres (fica registrada)' };
      liberacao = { por: quem.usuarioNome || null, em: new Date().toISOString(), justificativa: j, vencidos: mot.selo?.vencidos || null };
    } else if (mudouMotorista) liberacao = null;
    if (nivel === 'em_andamento') avisos.push(`🟡 ${mot.nome}: ${mot.selo?.faltam ?? ''} item(ns) sem registro no selo de conformidade (nada vencido)`);
    if (nivel === 'sem_funcao') avisos.push(`⚪ ${mot.nome} não tem função cadastrada — o selo de conformidade não pôde ser conferido`);
  }
  const dados = { inicio_previsto: inicio, fim_previsto: fim || null, origem: texto(body.origem ?? atual.origem, 300), destino: texto(body.destino ?? atual.destino, 300),
    motorista_id: mot ? mot.id : null, motorista_nome: mot ? mot.nome : null, motorista_selo: mot ? (mot.selo || null) : null, liberacao, cavalo_id: conjunto[0].id, conjunto,
    observacoes: texto(body.observacoes ?? atual.observacoes, 2000) };
  // 16c: CNH do motorista e CRLV do conjunto, pela data da viagem
  const docs = avaliarDocs(await carregarDocs(supabase, tenantId), { motorista_id: dados.motorista_id, motorista_nome: dados.motorista_nome, conjunto, inicio, fim });
  const vencidos = docs.filter((d) => d.status === 'vencido');
  let liberacao_docs = atual.liberacao_docs || null;
  if (vencidos.length) {
    const chaves = vencidos.map((d) => d.chave).sort().join(',');
    if (!liberacao_docs || liberacao_docs.chaves !== chaves) {
      const lista = vencidos.map((d) => `${d.rotulo} de ${d.dono} (venceu ${String(d.vence_em).split('-').reverse().join('/')})`).join(' · ');
      const j = texto(body.liberacao_docs_justificativa, 500);
      if (!j) return { status: 409, erro: `📄 Documento vencido na data da viagem: ${lista}. Só gestor/admin libera, com justificativa.`, codigo: 'docs_vencidos', docs: semPath(vencidos) };
      if (!podeLiberar(quem.perfis)) return { status: 409, erro: `📄 Documento vencido na data da viagem: ${lista}. Só gestor ou admin pode liberar.`, codigo: 'docs_vencidos', docs: semPath(vencidos) };
      if (j.length < 15) return { status: 400, erro: 'Justificativa da liberação do documento: mínimo 15 caracteres (fica registrada)' };
      liberacao_docs = { por: quem.usuarioNome || null, em: new Date().toISOString(), justificativa: j, chaves, docs: vencidos.map((d) => `${d.rotulo} ${d.dono}`) };
    }
  } else liberacao_docs = null;
  dados.liberacao_docs = liberacao_docs;
  for (const d of docs) {
    if (d.status === 'ausente') avisos.push(`📄 ${d.rotulo} de ${d.dono} não está cadastrado — o motorista leva em mãos`);
    if (d.status === 'vence') avisos.push(`🟡 ${d.rotulo} de ${d.dono} vence em ${String(d.vence_em).split('-').reverse().join('/')} (até 30 dias depois da viagem)`);
  }
  const outras = await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId));
  const cf = conflitos({ ...dados, id: atual.id }, outras);
  if (cf.length && body.ignorar_conflito !== true) return { status: 409, erro: `Conflito de agenda: ${cf.map((c) => c.texto).join(' · ')}`, codigo: 'conflito', conflitos: cf };
  return { dados, avisos, conflitos: cf, docs: semPath(docs) };
}

/** itens do pedido acompanham o status da AT */
async function sincronizarPV(supabase, tenantId, ex, status) {
  const PV = require('./pedidosVenda');
  const pv = (await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId).eq('id', ex.pv_id)))[0]; if (!pv) return;
  const ids = new Set((ex.itens || []).map((i) => String(i.id)));
  const novo = STATUS_ITEM_PV[status];
  const grupos = (pv.grupos || []).map((g) => ({ ...g, itens: (g.itens || []).map((i) => (ids.has(String(i.id)) && i.status !== 'cancelado' ? { ...i, status: novo } : i)) }));
  await supabase.from('pedidos_venda').update({ grupos, status: PV.statusPV(grupos, pv.status), atualizado_em: new Date().toISOString() }).eq('id', pv.id).eq('tenant_id', tenantId);
}
async function registrar(supabase, tenantId, quem, ex, txt) {
  const pv = (await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId).eq('id', ex.pv_id)))[0];
  if (pv?.bid_id) await require('./bids').atividade(supabase, tenantId, quem, { bid_id: pv.bid_id, cliente_id: pv.cliente_id, tipo: 'evento', texto: txt });
}

// ─── 16d: rastreabilidade — nº do item no BID + nº de série; referência "BID-… · item 3 · PV-…" ───
const pvNumerado = (pv) => ({ ...pv, grupos: B().numerarItens(pv?.grupos || []).grupos });
const volumesOk = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isInteger(n) && n > 0 && n <= 999 ? n : null; };
const itemAT = (i, series = {}, volumes = {}) => ({ id: i.id, n: i.n ?? null, serie: texto(series[String(i.id)] ?? i.serie, 80) || '', volumes: volumesOk(volumes[String(i.id)] ?? i.volumes), // 16e.1: volumes (peças) no transporte
  valores: i.valores || {}, quantidade: i.quantidade ?? 1 }); // SEM valores
function aplicarSeries(itens = [], series, volumes) { // nº de série e volumes editáveis na programação
  const s = series && typeof series === 'object' ? series : {}; const v = volumes && typeof volumes === 'object' ? volumes : {};
  return itens.map((i) => ({ ...i, ...(s[String(i.id)] !== undefined ? { serie: texto(s[String(i.id)], 80) || '' } : {}), ...(v[String(i.id)] !== undefined ? { volumes: volumesOk(v[String(i.id)]) } : {}) }));
}
const refAT = (e, bidNumero) => [bidNumero, (e.itens || []).length ? `item ${(e.itens || []).map((i) => i.n ?? '?').join(', ')}` : null, e.pv_numero].filter(Boolean).join(' · ');
const comRef = (e, pvs) => {
  const pv = pvs.find((p) => String(p.id) === String(e.pv_id));
  // 16d.1: AT criada antes da 16d não guardou o nº do item — completa pelo pedido (mesma numeração do card)
  const nDe = new Map(pv ? pvNumerado(pv).grupos.flatMap((g) => (g.itens || []).map((i) => [String(i.id), i.n])) : []);
  const itens = (e.itens || []).map((i) => (i.n ? i : { ...i, n: nDe.get(String(i.id)) ?? null }));
  const e2 = { ...e, itens };
  return { ...e2, bid_numero: pv?.bid_numero || null, ref: refAT(e2, pv?.bid_numero) };
};

// ─── criar / editar / status ────────────────────────────────────────────────
/** 🚛 Programar um trecho do pedido */
async function criar(supabase, tenantId, quem, pvId, body = {}) {
  const pv = /^\d+$/.test(String(pvId)) ? (await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId).eq('id', pvId)))[0] : null;
  if (!pv) return { status: 404, erro: 'Pedido não encontrado' };
  if (['cancelado', 'concluido'].includes(pv.status)) return { status: 409, erro: `Pedido ${pv.status} — não dá para programar` };
  const tipo = pv.tipo_execucao || 'transporte';
  if (tipo !== 'transporte') return { status: 409, erro: `Pedidos do tipo "${TIPOS[tipo] || tipo}" ainda não geram execução por aqui (só transporte nesta etapa)` };
  const g = (pvNumerado(pv).grupos || []).find((x) => String(x.id) === String(body.grupo_id)); if (!g) return { status: 400, erro: 'Escolha o trecho do pedido' };
  // 16a.1: um trecho pode ter VÁRIAS ATs (uma por conjunto) — cada item entra em no máximo uma AT ativa
  const doPedido = (await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId).eq('pv_id', pv.id))).filter((e) => e.status !== 'cancelada');
  const emAT = new Map(); doPedido.forEach((e) => (e.itens || []).forEach((i) => emAT.set(String(i.id), e)));
  const ativos = (g.itens || []).filter((i) => i.status !== 'cancelado');
  const pedidos = Array.isArray(body.itens) && body.itens.length ? body.itens.map(String) : ativos.filter((i) => !emAT.has(String(i.id))).map((i) => String(i.id));
  for (const id of pedidos) {
    if (!ativos.some((i) => String(i.id) === id)) return { status: 400, erro: 'Item não encontrado no trecho (ou cancelado)' };
    if (emAT.has(id)) return { status: 409, erro: `Um dos itens já está na ${emAT.get(id).numero} (${STATUS[emAT.get(id).status].toLowerCase()})`, existente: emAT.get(id).id };
  }
  if (!ativos.length) return { status: 409, erro: 'O trecho não tem itens ativos' };
  if (!pedidos.length) return { status: 409, erro: 'Todos os itens deste trecho já estão programados' };
  const itens = ativos.filter((i) => pedidos.includes(String(i.id))).map((i) => itemAT(i, body.series || {}, body.volumes || {})); // SEM valores · 16d: nº do item + série
  if (!itens.length) return { status: 409, erro: 'O trecho não tem itens ativos' };
  // 16b: rota padrão = a do trecho (BID/pedido) → senão a última AT do trecho; a programação pode editar
  const ultima = doPedido.filter((e) => String(e.grupo_id) === String(g.id)).sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')))[0];
  if (!texto(body.origem, 300)) body = { ...body, origem: g.coleta || ultima?.origem || '' };
  if (!texto(body.destino, 300)) body = { ...body, destino: g.entrega || ultima?.destino || '' };
  const agora = new Date().toISOString();
  const comum = { tenant_id: tenantId, tipo, pv_id: pv.id, pv_numero: pv.numero, grupo_id: g.id, grupo_titulo: g.titulo || null, itens, colunas: pv.conteudo?.colunas || [],
    cliente_id: pv.cliente_id, cliente_nome: pv.cliente_nome, anexos: [], iniciada_em: null, concluida_em: null, cancelada_em: null, cancelada_motivo: null, criado_por_nome: quem.usuarioNome || null, criado_em: agora, atualizado_em: agora };
  if (body.rascunho === true) { // 16c: 💾 salvar rascunho — sem validar, não mexe no pedido
    const d = await dadosRascunho(supabase, tenantId, body, {});
    const { data, error } = await supabase.from('execucoes').insert([{ ...comum, numero: `RASC-${crypto.randomBytes(5).toString('hex')}`, status: 'rascunho', token: null, ...d }]).select();
    if (error) throw new Error(error.message);
    return { execucao: data[0], avisos: [] };
  }
  const m = await montar(supabase, tenantId, quem, body); if (m.erro) return m;
  const fx = await montarFluxo(supabase, tenantId, body, m.dados.conjunto); if (fx.erro) return fx;
  const reg = { ...comum, fluxo: fx.fluxo, token: novoToken(), numero: await proximoNumero(supabase, tenantId), tipo, pv_id: pv.id, pv_numero: pv.numero, grupo_id: g.id, grupo_titulo: g.titulo || null, itens, colunas: pv.conteudo?.colunas || [],
    cliente_id: pv.cliente_id, cliente_nome: pv.cliente_nome, status: 'programada', ...m.dados, anexos: [], iniciada_em: null, concluida_em: null, cancelada_em: null, cancelada_motivo: null,
    criado_por_nome: quem.usuarioNome || null, criado_em: agora, atualizado_em: agora };
  const { data, error } = await supabase.from('execucoes').insert([reg]).select();
  if (error) throw new Error(error.message);
  const ex = data[0];
  await sincronizarPV(supabase, tenantId, ex, 'programada');
  await registrar(supabase, tenantId, quem, ex, `🚛 ${ex.numero} programada — ${ex.grupo_titulo || 'trecho'} · ${dataHora(ex.inicio_previsto)}${ex.motorista_nome ? ` · ${ex.motorista_nome}` : ''} · ${ex.conjunto.map((c) => c.tag || c.nome).join(' + ')}${ex.liberacao ? ' · ⚠ motorista liberado pelo gestor' : ''}`);
  return { execucao: ex, avisos: m.avisos, conflitos: m.conflitos, docs: m.docs };
}
/** 16e: fluxo da viagem — o que veio da tela (validado) ou o padrão; etapas já feitas ficam */
async function montarFluxo(supabase, tenantId, body, conjunto, antigo = [], conjuntoMudou = false) {
  const fv = FV(); const modelos = await fv.modelosInspecao(supabase, tenantId);
  if (body.fluxo !== undefined) { const r = fv.validarFluxo(body.fluxo, { conjunto, modelos }); if (r.erro) return { status: 400, erro: r.erro }; return { fluxo: fv.mesclar(antigo, r.fluxo) }; }
  if (antigo.length && !conjuntoMudou) return { fluxo: antigo };
  const equipamentos = await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId)).catch(() => []);
  return { fluxo: fv.mesclar(antigo, fv.fluxoPadrao({ conjunto, modelos, equipamentos })) };
}
/** 16c: rascunho — guarda o que veio, sem validar (equipamento/motorista desconhecido é ignorado) */
async function dadosRascunho(supabase, tenantId, body, atual) {
  const b = await base(supabase, tenantId);
  const tem = (k) => body[k] !== undefined;
  const motId = tem('motorista_id') ? body.motorista_id : atual.motorista_id; const mot = b.motoristas.find((m) => String(m.id) === String(motId ?? ''));
  const ids = tem('cavalo_id') || tem('implementos') ? [body.cavalo_id, ...(Array.isArray(body.implementos) ? body.implementos : [])] : (atual.conjunto || []).map((c) => c.id);
  const conjunto = []; ids.forEach((id, i) => { if (id == null || id === '') return; const e = b.equipamentos.find((x) => String(x.id) === String(id)); if (e && !conjunto.some((c) => String(c.id) === String(e.id))) conjunto.push({ id: e.id, tag: e.tag, nome: e.nome, papel: i === 0 ? 'cavalo' : 'implemento' }); });
  const cav = conjunto.find((c) => c.papel === 'cavalo');
  const ini = tem('inicio') ? quando(body.inicio) : atual.inicio_previsto; const fim = tem('fim') ? quando(body.fim) : atual.fim_previsto;
  return { inicio_previsto: ini || null, fim_previsto: fim || null, origem: texto(tem('origem') ? body.origem : atual.origem, 300), destino: texto(tem('destino') ? body.destino : atual.destino, 300),
    motorista_id: mot ? mot.id : null, motorista_nome: mot ? mot.nome : null, motorista_selo: mot ? (mot.selo || null) : null, liberacao: null, liberacao_docs: null,
    cavalo_id: cav ? cav.id : null, conjunto, observacoes: texto(tem('observacoes') ? body.observacoes : atual.observacoes, 2000),
    fluxo: Array.isArray(body.fluxo) ? body.fluxo.slice(0, 20) : (atual.fluxo || []) }; // 16e: o fluxo escolhido fica no rascunho
}
async function editar(supabase, tenantId, quem, id, body = {}) {
  const ex = await exDoTenant(supabase, tenantId, id); if (!ex) return { status: 404, erro: 'AT não encontrada' };
  const itensSerie = aplicarSeries(ex.itens || [], body.series, body.volumes); // 16d: nº de série editável na programação
  if (ex.status === 'rascunho') {
    if (body.rascunho === true) {
      const d = await dadosRascunho(supabase, tenantId, body, ex);
      const { data, error } = await supabase.from('execucoes').update({ ...d, itens: itensSerie, atualizado_em: new Date().toISOString() }).eq('id', ex.id).eq('tenant_id', tenantId).select();
      if (error) throw new Error(error.message);
      return { execucao: data[0], avisos: [] };
    }
    // 🚛 programar o rascunho: valida tudo, ganha número AT, link do motorista e atualiza o pedido
    const m = await montar(supabase, tenantId, quem, body, { ...ex, liberacao: null, liberacao_docs: null }); if (m.erro) return m;
    const fx = await montarFluxo(supabase, tenantId, body, m.dados.conjunto); if (fx.erro) return fx;
    const agora = new Date().toISOString();
    const { data, error } = await supabase.from('execucoes').update({ ...m.dados, fluxo: fx.fluxo, itens: itensSerie, status: 'programada', numero: await proximoNumero(supabase, tenantId), token: ex.token || novoToken(), criado_por_nome: quem.usuarioNome || ex.criado_por_nome || null, atualizado_em: agora }).eq('id', ex.id).eq('tenant_id', tenantId).select();
    if (error) throw new Error(error.message);
    const nova = data[0];
    await sincronizarPV(supabase, tenantId, nova, 'programada');
    await registrar(supabase, tenantId, quem, nova, `🚛 ${nova.numero} programada — ${nova.grupo_titulo || 'trecho'} · ${dataHora(nova.inicio_previsto)}${nova.motorista_nome ? ` · ${nova.motorista_nome}` : ''} · ${(nova.conjunto || []).map((c) => c.tag || c.nome).join(' + ')}`);
    return { execucao: nova, avisos: m.avisos, conflitos: m.conflitos, docs: m.docs };
  }
  if (ex.status !== 'programada') return { status: 409, erro: `AT ${STATUS[ex.status].toLowerCase()} — só dá para editar enquanto está programada` };
  const m = await montar(supabase, tenantId, quem, body, ex); if (m.erro) return m;
  const mudouConj = (m.dados.conjunto || []).map((c) => String(c.id)).join(',') !== (ex.conjunto || []).map((c) => String(c.id)).join(',');
  const fx = await montarFluxo(supabase, tenantId, body, m.dados.conjunto, ex.fluxo || [], mudouConj); if (fx.erro) return fx;
  const { data, error } = await supabase.from('execucoes').update({ ...m.dados, fluxo: fx.fluxo, itens: itensSerie, atualizado_em: new Date().toISOString() }).eq('id', ex.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { execucao: data[0], avisos: m.avisos, conflitos: m.conflitos, docs: m.docs };
}
/** 💾 descartar um rascunho (só rascunho — AT programada se cancela, com motivo) */
async function descartar(supabase, tenantId, quem, id) {
  const ex = await exDoTenant(supabase, tenantId, id); if (!ex) return { status: 404, erro: 'AT não encontrada' };
  if (ex.status !== 'rascunho') return { status: 409, erro: 'Só rascunho pode ser descartado — AT programada se cancela (com motivo)' };
  const { error } = await supabase.from('execucoes').delete().eq('id', ex.id).eq('tenant_id', tenantId); if (error) throw new Error(error.message);
  for (const a of ex.anexos || []) { try { await supabase.storage.from(BUCKET).remove([a.path]); } catch { /* arquivo órfão não impede descartar */ } }
  return { ok: true };
}
/** ▶ iniciar · ✓ concluir · ✕ cancelar (motivo) · ↺ reabrir (concluída/cancelada → programada) */
async function mudarStatus(supabase, tenantId, quem, id, { acao, motivo } = {}) {
  const ex = await exDoTenant(supabase, tenantId, id); if (!ex) return { status: 404, erro: 'AT não encontrada' };
  const agora = new Date().toISOString(); let upd; let txt;
  if (acao === 'iniciar') {
    if (ex.status !== 'programada') return { status: 409, erro: 'Só uma AT programada pode ser iniciada' };
    if (!ex.motorista_id) return { status: 409, erro: 'Defina o motorista antes de iniciar' };
    const eqs = await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId));
    const bloq = (ex.conjunto || []).map((c) => eqs.find((e) => String(e.id) === String(c.id))).find((e) => e?.bloqueado);
    if (bloq) return { status: 409, erro: `🔒 ${bloq.tag || bloq.nome} foi BLOQUEADO por inspeção depois da programação — troque o equipamento ou libere em 🔍 Inspeções` };
    upd = { status: 'em_execucao', iniciada_em: agora }; txt = `▶ ${ex.numero} em execução`;
  } else if (acao === 'concluir') {
    if (ex.status !== 'em_execucao') return { status: 409, erro: 'Só uma AT em execução pode ser concluída' };
    upd = { status: 'concluida', concluida_em: agora }; txt = `✓ ${ex.numero} concluída`;
  } else if (acao === 'cancelar') {
    if (!ATIVAS.includes(ex.status)) return { status: 409, erro: 'AT já encerrada' };
    const m = texto(motivo, 500); if (!m || m.length < 10) return { status: 400, erro: 'Descreva o motivo do cancelamento (mínimo 10 caracteres)' };
    upd = { status: 'cancelada', cancelada_em: agora, cancelada_motivo: m }; txt = `✕ ${ex.numero} cancelada: ${m} — o trecho volta para "a programar"`;
  } else if (acao === 'reabrir') {
    if (ex.status === 'cancelada') {
      const meus = new Set((ex.itens || []).map((i) => String(i.id)));
      const outra = (await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId).eq('pv_id', ex.pv_id))).find((e) => e.status !== 'cancelada' && String(e.id) !== String(ex.id) && (e.itens || []).some((i) => meus.has(String(i.id))));
      if (outra) return { status: 409, erro: `Os itens já foram reprogramados na ${outra.numero}` };
    } else if (ex.status !== 'concluida') return { status: 409, erro: 'Só uma AT concluída ou cancelada pode ser reaberta' };
    upd = { status: 'programada', concluida_em: null, cancelada_em: null, cancelada_motivo: null, iniciada_em: ex.status === 'concluida' ? ex.iniciada_em : null }; txt = `↺ ${ex.numero} reaberta (programada)`;
  } else return { status: 400, erro: 'Ação inválida' };
  const { data, error } = await supabase.from('execucoes').update({ ...upd, atualizado_em: agora }).eq('id', ex.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  await sincronizarPV(supabase, tenantId, ex, upd.status);
  await registrar(supabase, tenantId, quem, ex, txt);
  return { execucao: data[0] };
}

// ─── anexos (NF-e, CT-e, MDF-e) ─────────────────────────────────────────────
async function anexar(supabase, tenantId, quem, id, { tipo, nome, mime, base64 } = {}) {
  const ex = await exDoTenant(supabase, tenantId, id); if (!ex) return { status: 404, erro: 'AT não encontrada' };
  if (!ANEXOS[tipo]) return { status: 400, erro: 'Tipo de anexo inválido (NF-e, CT-e, MDF-e ou outro)' };
  if (!MIME[mime]) return { status: 400, erro: 'Arquivo: PDF, XML, JPG ou PNG' };
  const buf = Buffer.from(String(base64 || ''), 'base64'); if (!buf.length) return { status: 400, erro: 'Arquivo vazio' };
  if (buf.length > LIMITE) return { status: 400, erro: 'Arquivo maior que 10 MB' };
  const aid = crypto.randomBytes(6).toString('hex');
  const path = `tenant-${tenantId}/execucoes/${ex.id}/${Date.now()}-${aid}.${MIME[mime]}`;
  const { error: eu } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: false });
  if (eu) throw new Error(`Falha ao subir o arquivo: ${eu.message}`);
  const anexo = { id: aid, tipo, nome: texto(nome, 160) || `${ANEXOS[tipo]}.${MIME[mime]}`, path, mime, tamanho: buf.length, em: new Date().toISOString(), por: quem.usuarioNome || null };
  const { data, error } = await supabase.from('execucoes').update({ anexos: [...(ex.anexos || []), anexo], atualizado_em: new Date().toISOString() }).eq('id', ex.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { execucao: data[0], anexo };
}
async function linkAnexo(supabase, tenantId, id, anexoId) {
  const ex = await exDoTenant(supabase, tenantId, id); const a = (ex?.anexos || []).find((x) => x.id === anexoId);
  if (!a) return { status: 404, erro: 'Anexo não encontrado' };
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.path, 3600, { download: false });
  if (error) throw new Error(error.message);
  return { url: data?.signedUrl || null, nome: a.nome };
}
async function removerAnexo(supabase, tenantId, quem, id, anexoId) {
  const ex = await exDoTenant(supabase, tenantId, id); const a = (ex?.anexos || []).find((x) => x.id === anexoId);
  if (!a) return { status: 404, erro: 'Anexo não encontrado' };
  if (ex.status === 'concluida') return { status: 409, erro: 'AT concluída — reabra para mexer nos anexos' };
  try { await supabase.storage.from(BUCKET).remove([a.path]); } catch { /* não bloqueia */ }
  const { data, error } = await supabase.from('execucoes').update({ anexos: (ex.anexos || []).filter((x) => x.id !== anexoId), atualizado_em: new Date().toISOString() }).eq('id', ex.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { execucao: data[0] };
}

// ─── leitura ────────────────────────────────────────────────────────────────
const enfeitar = (e) => ({ ...e, fluxo_resumo: e.status === 'rascunho' ? null : FV().resumo(e.fluxo || []), link_motorista: e.status !== 'rascunho' ? linkMotorista(e.token) : null, status_nome: STATUS[e.status] || e.status, tipo_nome: TIPOS[e.tipo] || e.tipo, fim_efetivo: fimEfetivo(e), qtd_itens: (e.itens || []).length,
  anexos_tipos: [...new Set((e.anexos || []).map((a) => a.tipo))], atrasada: e.status === 'programada' && !!e.inicio_previsto && e.inicio_previsto < new Date().toISOString() });
async function listar(supabase, tenantId, { status, de, ate } = {}) {
  const pvs = await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId)).catch(() => []);
  let l = (await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId))).map(enfeitar).map((e) => comRef(e, pvs));
  if (status === 'ativas') l = l.filter((e) => ATIVAS.includes(e.status)); else if (STATUS[status]) l = l.filter((e) => e.status === status);
  if (de) l = l.filter((e) => !e.inicio_previsto || String(fimEfetivo(e)).slice(0, 10) >= de);
  if (ate) l = l.filter((e) => !e.inicio_previsto || String(e.inicio_previsto).slice(0, 10) <= ate);
  const todas = l;
  return todas.map((e) => ({ ...e, conflitos: ATIVAS.includes(e.status) ? conflitos(e, todas) : [] })).sort((a, b) => String(a.inicio_previsto || '9').localeCompare(String(b.inicio_previsto || '9')));
}
async function detalhe(supabase, tenantId, id) {
  let ex = await exDoTenant(supabase, tenantId, id); if (!ex) return { status: 404, erro: 'AT não encontrada' };
  if (!ex.token && !['rascunho', 'cancelada'].includes(ex.status)) { // ATs da 16a ganham o link do motorista na primeira abertura
    const { data } = await supabase.from('execucoes').update({ token: novoToken() }).eq('id', ex.id).eq('tenant_id', tenantId).select(); if (data?.[0]) ex = data[0];
  }
  const outras = await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId));
  const eqs = await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId));
  const bloqueados = (ex.conjunto || []).map((c) => eqs.find((e) => String(e.id) === String(c.id))).filter((e) => e?.bloqueado).map((e) => ({ tag: e.tag, nome: e.nome, motivo: e.bloqueio_motivo }));
  const docs = semPath(avaliarDocs(await carregarDocs(supabase, tenantId), { motorista_id: ex.motorista_id, motorista_nome: ex.motorista_nome, conjunto: ex.conjunto || [], inicio: ex.inicio_previsto, fim: ex.fim_previsto }));
  const pvs = await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId).eq('id', ex.pv_id)).catch(() => []);
  return { execucao: { ...comRef(enfeitar(ex), pvs), fluxo: ex.status === 'rascunho' ? (ex.fluxo || []) : FV().comLiberacao(ex.fluxo || []), conflitos: ATIVAS.includes(ex.status) ? conflitos(ex, outras) : [], bloqueados, docs }, status: STATUS, anexos_tipos: ANEXOS };
}
/** trechos do pedido com as ATs ativas e os itens ainda livres (sem valores) */
function trechosComATs(pv0, ex, docsBase = null) {
  const pv = pvNumerado(pv0);
  const ativas = ex.filter((e) => e.status !== 'cancelada');
  const emAT = new Map(); ativas.forEach((e) => (e.itens || []).forEach((i) => emAT.set(String(i.id), e.numero)));
  return (pv.grupos || []).map((g) => {
    const itens = (g.itens || []).filter((i) => i.status !== 'cancelado').map((i) => ({ ...itemAT(i), at: emAT.get(String(i.id)) || null }));
    const doTrecho = ativas.filter((e) => String(e.grupo_id) === String(g.id)).sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
    return { id: g.id, titulo: g.titulo, qtd: itens.length, itens, livres: itens.filter((i) => !i.at).length,
      coleta: g.coleta || doTrecho[0]?.origem || '', entrega: g.entrega || doTrecho[0]?.destino || '', rota_do_bid: !!(g.coleta || g.entrega), // 16b
      datas: [...new Set(itens.map((i) => i.valores?.data_prevista).filter(Boolean))].sort(),
      a_programar: itens.filter((i) => !i.at || /^RASC-/.test(i.at)).length,
      ats: ativas.filter((e) => String(e.grupo_id) === String(g.id)).map((e) => (docsBase ? { ...enfeitar(e), docs: semPath(avaliarDocs(docsBase, { motorista_id: e.motorista_id, motorista_nome: e.motorista_nome, conjunto: e.conjunto || [], inicio: e.inicio_previsto, fim: e.fim_previsto })) } : e)).sort((a, b) => String(a.inicio_previsto || '').localeCompare(String(b.inicio_previsto || ''))) };
  });
}
/** ATs do pedido (o comercial vê por aqui) + quais trechos faltam programar */
async function doPV(supabase, tenantId, pvId) {
  const pv = /^\d+$/.test(String(pvId)) ? (await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId).eq('id', pvId)))[0] : null;
  if (!pv) return { status: 404, erro: 'Pedido não encontrado' };
  const ex = (await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId).eq('pv_id', pv.id))).map(enfeitar);
  return { execucoes: ex.sort((a, b) => String(a.inicio_previsto || '').localeCompare(String(b.inicio_previsto || ''))), tipo_execucao: pv.tipo_execucao || 'transporte',
    trechos: trechosComATs(pv, ex) };
}
/** 🗓 agenda da frota: ATs no período, por dia, com conflitos */
async function agenda(supabase, tenantId, { de, ate } = {}) {
  const d0 = /^\d{4}-\d{2}-\d{2}$/.test(String(de || '')) ? de : hojeBR();
  const d1 = /^\d{4}-\d{2}-\d{2}$/.test(String(ate || '')) ? ate : new Date(new Date(`${d0}T12:00:00Z`).getTime() + 13 * 86400000).toISOString().slice(0, 10);
  const l = (await listar(supabase, tenantId, { de: d0, ate: d1 })).filter((e) => !['cancelada', 'rascunho'].includes(e.status) && e.inicio_previsto);
  return { de: d0, ate: d1, execucoes: l, com_conflito: l.filter((e) => e.conflitos.length).length };
}
/** 16c.1: CNH vem dos DOCUMENTOS do colaborador (número + validade); telefone do colaborador ou do usuário ligado a ele */
async function dadosMotorista(supabase, tenantId, col) {
  const docs = await carregarDocs(supabase, tenantId);
  const cnh = docs.filter((d) => String(d.colaborador_id) === String(col.id) && (d.codigo === 'cnh' || /\bcnh\b/i.test(String(d.tipo_nome || '')))).sort((a, b) => String(b.vence_em || '9999').localeCompare(String(a.vence_em || '9999')))[0];
  let tel = col.telefone || null;
  if (!tel) {
    const us = await q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId)).catch(() => []);
    const u = us.find((x) => col.usuario_id != null && String(x.id) === String(col.usuario_id)) || us.find((x) => col.email && String(x.email || '').toLowerCase() === String(col.email).toLowerCase());
    tel = u?.telefone || null;
  }
  const cnhTxt = cnh ? [cnh.numero, col.cnh_categoria ? `cat. ${col.cnh_categoria}` : null, cnh.vence_em ? `validade ${String(cnh.vence_em).split('-').reverse().join('/')}` : null].filter(Boolean).join(' · ') : (col.cnh_categoria || null);
  return { nome: col.nome, cpf: col.cpf || null, cnh: cnhTxt, telefone: tel };
}
/** PDF da AT para o motorista (SEM valores) */
async function documento(supabase, tenantId, id) {
  const ex = await exDoTenant(supabase, tenantId, id); if (!ex) return { status: 404, erro: 'AT não encontrada' };
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || {};
  const pv = (await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId).eq('id', ex.pv_id)))[0] || {};
  const col = ex.motorista_id != null ? (await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId).eq('id', ex.motorista_id)).catch(() => []))[0] : null;
  return { ...comRef(enfeitar(ex), [pv]), empresa: { nome: emp.nome_fantasia || emp.razao_social || emp.nome || '', razao_social: emp.razao_social || '', cnpj: emp.cnpj || '', telefone: emp.telefone || '' },
    contato_cliente: pv.contato_nome || null, referencia: pv.referencia || null, motorista: col ? await dadosMotorista(supabase, tenantId, col) : null };
}

// ─── 17b: 🚦 MULTA × PROGRAMAÇÃO — quem estava com o veículo na hora da infração ───
//   procura ATs (programadas, em execução ou concluídas — nunca rascunho/cancelada) cujo CONJUNTO tem o veículo (id da frota ou a placa/tag)
//   e cujo período cobre a data/hora: usa o REAL (iniciada_em → concluida_em) quando há; senão o PREVISTO (coleta → entrega, ou +24 h).
//   Sem hora: qualquer AT que pegue o dia. Devolve do mais provável para o menos (real antes de previsto).
const soAlnum = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
async function provavelCondutor(supabase, tenantId, { equipamento_id, veiculo, data, hora } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) return { atas: [] };
  const placa = soAlnum(veiculo);
  if (!equipamento_id && !placa) return { atas: [] };
  const eqs = await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId)).catch(() => []);
  const alvo = equipamento_id ? eqs.find((e) => String(e.id) === String(equipamento_id)) : eqs.find((e) => placa && [e.tag, e.placa, e.nome].some((x) => soAlnum(x) === placa));
  const bate = (c) => (alvo && String(c.id) === String(alvo.id)) || (placa && [c.tag, c.nome].some((x) => soAlnum(x) === placa));
  const h = /^\d{2}:\d{2}$/.test(String(hora || '')) ? hora : null;
  const ini = new Date(`${data}T${h || '00:00'}:00-03:00`).toISOString(); const fim = new Date(`${data}T${h || '23:59'}:59-03:00`).toISOString();
  const pvs = await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId)).catch(() => []);
  const l = (await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId))).filter((e) => !['rascunho', 'cancelada'].includes(e.status) && (e.conjunto || []).some(bate));
  const out = [];
  for (const e of l) {
    const real = !!e.iniciada_em;
    const a = e.iniciada_em || e.inicio_previsto; if (!a) continue;
    const b = e.concluida_em || (real && e.status === 'em_execucao' ? new Date().toISOString() : (e.fim_previsto || fimEfetivo(e)));
    if (!(a <= fim && b >= ini)) continue;
    const x = comRef(enfeitar(e), pvs);
    out.push({ id: e.id, numero: e.numero, ref: x.ref, status: e.status, status_nome: STATUS[e.status], motorista_id: e.motorista_id ?? null, motorista_nome: e.motorista_nome || null,
      origem: e.origem, destino: e.destino, de: a, ate: b, base: real ? 'real' : 'previsto', conjunto: (e.conjunto || []).map((c) => c.tag || c.nome) });
  }
  out.sort((p, r) => (p.base === r.base ? String(r.de).localeCompare(String(p.de)) : p.base === 'real' ? -1 : 1));
  return { atas: out, veiculo: alvo ? (alvo.tag || alvo.nome) : (veiculo || null) };
}

// ─── 17a: 🚛 MINHAS VIAGENS — motorista logado (perfil colaborador ligado a colaboradores.usuario_id) ───
//   minhas: as ATs em que ele é o motorista — ativas + concluídas/canceladas dos últimos 90 dias (com o token: abre o mesmo fluxo do 📲 link)
//   colegas: só a AGENDA (leitura) das ATs ativas dos outros — AT, rota, datas, motorista, conjunto e etapa; sem documentos, sem token
async function minhasViagens(supabase, tenantId, colaborador) {
  const todas = (await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId))).filter((e) => e.status !== 'rascunho');
  const pvs = await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId)).catch(() => []);
  const limite = new Date(Date.now() - 90 * 86400000).toISOString();
  const recente = (e) => ATIVAS.includes(e.status) || String(e.concluida_em || e.cancelada_em || e.atualizado_em || e.criado_em || '') >= limite;
  const ordem = (a, b) => String(a.inicio_previsto || '9').localeCompare(String(b.inicio_previsto || '9'));
  const minhas = todas.filter((e) => String(e.motorista_id) === String(colaborador.id) && recente(e)).map((e) => comRef(enfeitar(e), pvs))
    .map((e) => ({ id: e.id, numero: e.numero, ref: e.ref, status: e.status, status_nome: e.status_nome, cliente_nome: e.cliente_nome, grupo_titulo: e.grupo_titulo, origem: e.origem, destino: e.destino,
      inicio_previsto: e.inicio_previsto, fim_previsto: e.fim_previsto, concluida_em: e.concluida_em, cancelada_em: e.cancelada_em, conjunto: (e.conjunto || []).map((c) => ({ tag: c.tag, nome: c.nome, papel: c.papel })),
      itens: (e.itens || []).map((i) => ({ n: i.n, serie: i.serie, volumes: i.volumes, valores: i.valores, quantidade: i.quantidade })), colunas: (e.colunas || []).filter((c) => c.chave !== 'data_prevista' && c.tipo !== 'moeda'),
      fluxo_resumo: e.fluxo_resumo, token: e.token, atrasada: e.atrasada }));
  const ativas = minhas.filter((e) => ATIVAS.includes(e.status)).sort(ordem);
  const historico = minhas.filter((e) => !ATIVAS.includes(e.status)).sort((a, b) => String(b.concluida_em || b.cancelada_em || b.inicio_previsto || '').localeCompare(String(a.concluida_em || a.cancelada_em || a.inicio_previsto || '')));
  const colegas = todas.filter((e) => ATIVAS.includes(e.status) && String(e.motorista_id) !== String(colaborador.id)).map(enfeitar).sort(ordem)
    .map((e) => ({ id: e.id, numero: e.numero, status: e.status, status_nome: e.status_nome, origem: e.origem, destino: e.destino, inicio_previsto: e.inicio_previsto, fim_previsto: e.fim_previsto,
      motorista_nome: e.motorista_nome || null, conjunto: (e.conjunto || []).map((c) => c.tag || c.nome), etapa: e.fluxo_resumo ? (e.fluxo_resumo.travada ? `⛔ ${e.fluxo_resumo.reprovada}` : e.fluxo_resumo.atual || 'fluxo concluído') : null,
      progresso: e.fluxo_resumo ? `${e.fluxo_resumo.feitas}/${e.fluxo_resumo.total}` : null }));
  return { eu: { nome: colaborador.nome }, ativas, historico, colegas };
}

// ─── 16c: 📲 link do motorista (público, sem login, sem valores) ─────────────────
async function porToken(supabase, token) { return /^[0-9a-f]{40}$/.test(String(token || '')) ? (await q(supabase.from('execucoes').select('*').eq('token', token)))[0] || null : null; }
async function paginaMotorista(supabase, ex) {
  if (ex.status === 'rascunho') return { status: 404, erro: 'AT não encontrada' };
  if (!ex.link_visto_em) await supabase.from('execucoes').update({ link_visto_em: new Date().toISOString() }).eq('id', ex.id);
  const emp = (await q(supabase.from('tenants').select('*').eq('id', ex.tenant_id)))[0] || {};
  const assinar = async (path) => { if (!path) return null; const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, TTL_LINK, { download: false }); return data?.signedUrl || null; };
  const docs = avaliarDocs(await carregarDocs(supabase, ex.tenant_id), { motorista_id: ex.motorista_id, motorista_nome: ex.motorista_nome, conjunto: ex.conjunto || [], inicio: ex.inicio_previsto, fim: ex.fim_previsto });
  const kit = [];
  for (const d of docs) kit.push({ grupo: 'cadastro', rotulo: `${d.rotulo} — ${d.dono}`, status: d.status, vence_em: d.vence_em, url: await assinar(d.path), nome: d.arquivo_nome || null });
  for (const a of ex.anexos || []) kit.push({ grupo: 'fiscal', rotulo: ANEXOS[a.tipo] || a.tipo, status: 'ok', url: await assinar(a.path), nome: a.nome, mime: a.mime });
  const pvM = await q(supabase.from('pedidos_venda').select('*').eq('id', ex.pv_id)).catch(() => []);
  const exR = comRef(ex, pvM);
  return { numero: ex.numero, ref: exR.ref, status: ex.status, status_nome: STATUS[ex.status], cliente_nome: ex.cliente_nome, pv_numero: ex.pv_numero, grupo_titulo: ex.grupo_titulo,
    origem: ex.origem, destino: ex.destino, inicio_previsto: ex.inicio_previsto, fim_previsto: ex.fim_previsto, motorista_nome: ex.motorista_nome, conjunto: ex.conjunto || [],
    itens: (exR.itens || []).map((i) => ({ id: i.id, n: i.n ?? null, serie: i.serie || '', volumes: i.volumes ?? null, valores: i.valores || {}, quantidade: i.quantidade ?? 1 })), colunas: (ex.colunas || []).filter((c) => c.chave !== 'data_prevista' && c.tipo !== 'moeda'),
    observacoes: ex.observacoes, cancelada_motivo: ex.cancelada_motivo, empresa: { nome: emp.nome_fantasia || emp.nome || emp.razao_social || '', telefone: emp.telefone || '' }, kit,
    fluxo: FV().comLiberacao(ex.fluxo || []).map((x) => ({ id: x.id, tipo: x.tipo, rotulo: x.rotulo, status: x.status, liberada: x.liberada, feita_em: x.feita_em || null, por: x.por || null,
      inspecao_numero: x.inspecao_numero || null, resultado: x.resultado || null, liberacao: x.liberacao ? { em: x.liberacao.em } : null, equipamento_tag: x.equipamento_tag || null, modelo_nome: x.modelo_nome || null })),
    motorista_id: ex.motorista_id ?? null };
}

module.exports = { provavelCondutor, minhasViagens, refDe: (e, pvs) => comRef(e, pvs).ref, sincronizarPV, registrar, porToken, paginaMotorista, linkMotorista, docsDoConjunto, linkDocCadastro, descartar, carregarDocs, avaliarDocs, checar, trechosComATs, TIPOS, STATUS, ANEXOS, base, criar, editar, mudarStatus, anexar, linkAnexo, removerAnexo, listar, detalhe, doPV, agenda, documento, conflitos, _definirSelos };
