// backend/services/fluxoViagem.js — etapa 16e
//
// 🧭 FLUXO DA VIAGEM (decidido com o Marcony, 30/10/2026):
//   • ao programar, a AT ganha uma SEQUÊNCIA de etapas (padrão já marcado; o programador tira, acrescenta e reordena):
//       🔍 inspeção de liberação do conjunto (uma por equipamento) → 🏭 saída da base → 📍 chegada no cliente →
//       🔍 inspeção de carregamento → 🛣 saída para a viagem → 🔍 inspeção em trânsito → 🏁 chegada ao destino → 🔍 inspeção de descarregamento
//     cada inspeção usa um modelo de 🔍 Inspeções (tipos equipamento · carregamento · trânsito · descarregamento) e um equipamento do conjunto.
//   • A ORDEM É OBRIGATÓRIA: uma etapa só abre com a anterior concluída (o servidor confere — vale para o link, o perfil e terceiros).
//   • Inspeção REPROVADA trava a etapa seguinte até o gestor liberar (com motivo — libera também o equipamento bloqueado).
//   • STATUS AUTOMÁTICO: 1ª etapa feita → AT "em execução"; última → "concluída" (o pedido acompanha). Cada etapa grava hora e GPS (se houver).
//   • Sem internet: a inspeção fica na fila do celular (já existia) e as marcações também; ao sincronizar, o servidor confere a ordem.
// Regras do backend: sem DB.raw; ids com String(); o mock não aplica default do banco.

const crypto = require('crypto');

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const novoId = () => crypto.randomBytes(4).toString('hex');

const MARCOS = { saida_base: '🏭 Saída da base', chegada_cliente: '📍 Chegada no cliente (coleta)', saida_viagem: '🛣 Saída para a viagem (carregado)', chegada_destino: '🏁 Chegada ao destino' };
const INSP = { equipamento: '🔍 Inspeção de liberação', carregamento: '🔍 Inspeção de carregamento', transito: '🔍 Inspeção em trânsito', descarregamento: '🔍 Inspeção de descarregamento' };
const MAX = 20;

/** modelos de inspeção da empresa (ativos) — para escolher em cada etapa */
async function modelosInspecao(supabase, tenantId) {
  return (await q(supabase.from('inspecao_modelos').select('*').eq('tenant_id', tenantId)).catch(() => []))
    .filter((m) => m.ativo !== false).map((m) => ({ id: m.id, nome: m.nome, tipo: m.tipo || 'equipamento', categoria: m.categoria || null }))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

const marco = (k) => ({ id: novoId(), tipo: 'marco', marco: k, rotulo: MARCOS[k], status: 'pendente' });
const inspecao = (tipo, m, e) => ({ id: novoId(), tipo: 'inspecao', rotulo: `${INSP[tipo]}${tipo === 'equipamento' && e ? ` — ${e.tag || e.nome}` : ''}`, modelo_tipo: tipo,
  modelo_id: m?.id ?? null, modelo_nome: m?.nome || null, equipamento_id: e?.id ?? null, equipamento_tag: e ? (e.tag || e.nome) : null, status: 'pendente' });

/** sequência sugerida — inspeção sem modelo do tipo fica de fora (a tela avisa) */
function fluxoPadrao({ conjunto = [], modelos = [], equipamentos = [] }) {
  const doTipo = (t) => modelos.filter((m) => m.tipo === t);
  const cavalo = conjunto.find((c) => c.papel === 'cavalo') || conjunto[0];
  const ultimo = conjunto[conjunto.length - 1] || cavalo; // a carga vai no último implemento
  const out = [];
  for (const c of conjunto) { // liberação: uma por equipamento — o modelo padrão do equipamento, senão o 1º do tipo
    const eq = equipamentos.find((e) => String(e.id) === String(c.id));
    const m = doTipo('equipamento').find((x) => String(x.id) === String(eq?.inspecao_modelo_id)) || doTipo('equipamento')[0];
    if (m) out.push(inspecao('equipamento', m, c));
  }
  out.push(marco('saida_base'), marco('chegada_cliente'));
  if (doTipo('carregamento')[0]) out.push(inspecao('carregamento', doTipo('carregamento')[0], ultimo));
  out.push(marco('saida_viagem'));
  if (doTipo('transito')[0]) out.push(inspecao('transito', doTipo('transito')[0], ultimo));
  out.push(marco('chegada_destino'));
  if (doTipo('descarregamento')[0]) out.push(inspecao('descarregamento', doTipo('descarregamento')[0], ultimo));
  return out;
}

/** valida a lista vinda da tela (só etapas ainda não feitas) */
function validarFluxo(lista, { conjunto = [], modelos = [] }) {
  if (!Array.isArray(lista)) return { erro: 'Fluxo inválido' };
  if (lista.length > MAX) return { erro: `No máximo ${MAX} etapas` };
  const out = [];
  for (const [i, x] of lista.entries()) {
    const id = texto(x?.id, 20) || novoId();
    if (x?.tipo === 'marco') {
      if (!MARCOS[x.marco]) return { erro: `Etapa ${i + 1}: marcação inválida` };
      out.push({ id, tipo: 'marco', marco: x.marco, rotulo: texto(x.rotulo, 120) || MARCOS[x.marco], status: 'pendente' });
    } else if (x?.tipo === 'inspecao') {
      const m = modelos.find((y) => String(y.id) === String(x.modelo_id)); if (!m) return { erro: `Etapa ${i + 1}: escolha o modelo de inspeção` };
      const e = conjunto.find((y) => String(y.id) === String(x.equipamento_id)); if (!e) return { erro: `Etapa ${i + 1}: escolha um equipamento do conjunto` };
      out.push({ id, tipo: 'inspecao', rotulo: texto(x.rotulo, 120) || `${INSP[m.tipo] || '🔍 Inspeção'}`, modelo_tipo: m.tipo, modelo_id: m.id, modelo_nome: m.nome,
        equipamento_id: e.id, equipamento_tag: e.tag || e.nome, status: 'pendente' });
    } else return { erro: `Etapa ${i + 1}: tipo inválido` };
  }
  return { fluxo: out };
}

const concluida = (x) => x.status === 'feita' || (x.status === 'reprovada' && !!x.liberacao);
/** etapas já feitas ficam (na ordem, no começo); as pendentes vêm da tela */
function mesclar(antigo = [], novas = []) {
  const feitas = antigo.filter((x) => x.status !== 'pendente');
  const ids = new Set(feitas.map((x) => x.id));
  return [...feitas, ...novas.filter((x) => !ids.has(x.id))];
}
/** índice da próxima etapa a fazer (-1 = acabou) e se ela está travada por uma reprovação */
function proxima(fluxo = []) {
  for (let i = 0; i < fluxo.length; i++) {
    const x = fluxo[i];
    if (x.status === 'reprovada' && !x.liberacao) return { i: i + 1 < fluxo.length ? i + 1 : -1, travada: true, motivo: x };
    if (x.status === 'pendente') return { i, travada: false };
  }
  return { i: -1, travada: false };
}
function resumo(fluxo = []) {
  if (!fluxo.length) return null;
  const p = proxima(fluxo);
  return { total: fluxo.length, feitas: fluxo.filter(concluida).length + fluxo.filter((x) => x.status === 'reprovada' && !x.liberacao).length,
    atual: p.i >= 0 ? fluxo[p.i].rotulo : null, travada: p.travada, reprovada: p.travada ? p.motivo.rotulo : null };
}
/** para a tela: cada etapa com "liberada" (pode fazer agora) */
const comLiberacao = (fluxo = []) => { const p = proxima(fluxo); return fluxo.map((x, i) => ({ ...x, liberada: i === p.i && !p.travada })); };

/** confere se a etapa pode ser feita agora; devolve { i, etapa } ou { status, erro } */
function conferir(ex, etapaId) {
  if (ex.status === 'rascunho') return { status: 404, erro: 'AT não encontrada' };
  if (['cancelada', 'concluida'].includes(ex.status)) return { status: 409, erro: `Esta viagem está ${ex.status === 'cancelada' ? 'cancelada' : 'concluída'}` };
  const fluxo = ex.fluxo || [];
  const i = fluxo.findIndex((x) => x.id === etapaId); if (i < 0) return { status: 404, erro: 'Etapa não encontrada — atualize a página' };
  if (fluxo[i].status !== 'pendente') return { status: 409, erro: 'Esta etapa já foi feita', ja: true, i };
  const p = proxima(fluxo);
  if (p.travada) return { status: 409, erro: `⛔ Aguardando o gestor liberar: ${p.motivo.rotulo} foi reprovada. Ligue para a programação.`, codigo: 'travada' };
  if (p.i !== i) return { status: 409, erro: `Etapa ainda não liberada — conclua primeiro: ${fluxo[p.i].rotulo}`, codigo: 'fora_de_ordem' };
  return { i, etapa: fluxo[i] };
}

const gpsOk = (g) => (g && Number.isFinite(Number(g.lat)) && Number.isFinite(Number(g.lng)) ? { lat: Number(g.lat), lng: Number(g.lng), precisao: Number(g.precisao) || null } : null);
/** horário vindo do celular (marcação feita sem internet e enviada depois) — aceita até 3 dias para trás, nunca no futuro */
const quandoOk = (v) => { const t = Date.parse(v || ''); const agora = Date.now(); return Number.isFinite(t) && t <= agora + 5 * 60000 && t >= agora - 3 * 86400000 ? new Date(t).toISOString() : new Date(agora).toISOString(); };

/** grava a etapa e anda o status da AT (1ª → em execução; última → concluída) */
async function gravarEtapa(supabase, ex, i, patch, quem) {
  const E = require('./execucoes');
  const fluxo = (ex.fluxo || []).map((x, k) => (k === i ? { ...x, ...patch } : x));
  const agora = new Date().toISOString(); const upd = { fluxo, atualizado_em: agora };
  let novoStatus = null;
  if (ex.status === 'programada') { upd.status = 'em_execucao'; upd.iniciada_em = patch.feita_em || agora; novoStatus = 'em_execucao'; }
  if (fluxo.every(concluida)) { upd.status = 'concluida'; upd.concluida_em = patch.feita_em || agora; novoStatus = 'concluida'; }
  const { data, error } = await supabase.from('execucoes').update(upd).eq('id', ex.id).eq('tenant_id', ex.tenant_id).select();
  if (error) throw new Error(error.message);
  const nova = data[0];
  if (novoStatus) await E.sincronizarPV(supabase, ex.tenant_id, nova, novoStatus);
  const et = fluxo[i];
  await E.registrar(supabase, ex.tenant_id, quem, nova, `🧭 ${nova.numero} · ${et.rotulo}${et.inspecao_numero ? ` (${et.inspecao_numero} — ${et.resultado})` : ''}${novoStatus === 'em_execucao' ? ' · viagem iniciada' : novoStatus === 'concluida' ? ' · viagem concluída' : ''}`).catch(() => null);
  return nova;
}

/** 📲 marcação (saída, chegada…) pelo link */
async function marcar(supabase, ex, etapaId, { gps, em, por } = {}) {
  const c = conferir(ex, etapaId);
  if (c.ja) return { execucao: ex, repetido: true };
  if (c.erro) return c;
  if (c.etapa.tipo !== 'marco') return { status: 400, erro: 'Esta etapa é uma inspeção — faça a inspeção' };
  const nova = await gravarEtapa(supabase, ex, c.i, { status: 'feita', feita_em: quandoOk(em), gps: gpsOk(gps), por: texto(por, 120) || ex.motorista_nome || null }, { usuarioNome: texto(por, 120) || ex.motorista_nome || 'motorista' });
  return { ok: true, status_at: nova.status };
}
/** 📲 dados para começar a inspeção da etapa (mesmo "preparar" do app de inspeção) */
async function prepararInspecao(supabase, ex, etapaId) {
  const c = conferir(ex, etapaId);
  if (c.erro && !c.ja) return c;
  const et = (ex.fluxo || [])[c.i];
  if (et.tipo !== 'inspecao') return { status: 400, erro: 'Esta etapa não é uma inspeção' };
  const I = require('./inspecoes');
  const prep = await I.preparar(supabase, ex.tenant_id, et.equipamento_id, et.modelo_id);
  if (prep.erro) return prep;
  return { prep: { ...prep, inicial: await inicialInspecao(supabase, ex, et) }, etapa: et };
}
/** 16e.2: o que a AT já sabe para a 1ª tela da inspeção — o motorista confere e corrige
 *  local: liberação → endereço da empresa (senão a coleta) · carregamento → coleta · trânsito → "Em trânsito: A ➜ B" · descarregamento → entrega
 *  cliente: "Cliente · AT-… · BID-… item N" (rastreabilidade dentro da própria inspeção) */
async function inicialInspecao(supabase, ex, et) {
  const E = require('./execucoes');
  const pvs = await q(supabase.from('pedidos_venda').select('*').eq('id', ex.pv_id)).catch(() => []);
  const emp = (await q(supabase.from('tenants').select('*').eq('id', ex.tenant_id)).catch(() => []))[0] || {};
  const curto = (e) => String(e || '').split(',').slice(-2).join(',').replace(/CEP.*$/i, '').trim() || e;
  // 16e.3: opções de local (botões na 1ª tela da inspeção) — a sugestão depende do tipo
  const opcoes = [];
  opcoes.push({ chave: 'base', rotulo: '📍 Base', origem: 'pátio / base da frota', valor: texto(emp.base_endereco, 200) || '' }); // 16e.4: sempre (vazio = avisa para cadastrar)
  if (ex.origem) opcoes.push({ chave: 'coleta', rotulo: '📍 Coleta', origem: 'coleta da AT', valor: String(ex.origem).slice(0, 200) });
  if (ex.origem && ex.destino) opcoes.push({ chave: 'transito', rotulo: '🛣 Em trânsito', origem: 'rota da AT', valor: `Em trânsito: ${curto(ex.origem)} ➜ ${curto(ex.destino)}`.slice(0, 200) });
  if (ex.destino) opcoes.push({ chave: 'entrega', rotulo: '🏁 Entrega', origem: 'entrega da AT', valor: String(ex.destino).slice(0, 200) });
  const pref = { equipamento: ['base', 'coleta'], carregamento: ['coleta'], transito: ['transito'], descarregamento: ['entrega'] }[et.modelo_tipo] || ['coleta'];
  const sug = pref.map((k) => opcoes.find((o) => o.chave === k && o.valor)).find(Boolean) || opcoes.find((o) => o.valor) || null;
  const ref = E.refDe ? E.refDe(ex, pvs) : null;
  const cliente = [ex.cliente_nome, ex.numero, ref && ref.replace(` · ${ex.pv_numero}`, '')].filter(Boolean).join(' · ').slice(0, 200);
  return { local: sug?.valor || '', cliente, _origem: { local: sug?.origem || null, cliente: 'dados da AT' }, _opcoes_local: opcoes };
}
/** 📲 envio da inspeção da etapa (idempotente: a fila offline pode reenviar) */
async function enviarInspecao(supabase, ex, etapaId, body = {}) {
  const I = require('./inspecoes');
  const fluxo = ex.fluxo || []; const i0 = fluxo.findIndex((x) => x.id === etapaId);
  // reenvio da fila: a inspeção já entrou e a etapa já está gravada
  if (i0 >= 0 && fluxo[i0].status !== 'pendente' && fluxo[i0].inspecao_id) return { inspecao: { id: fluxo[i0].inspecao_id, numero: fluxo[i0].inspecao_numero, resultado: fluxo[i0].resultado }, repetido: true };
  const c = conferir(ex, etapaId); if (c.erro) return c;
  const et = c.etapa; if (et.tipo !== 'inspecao') return { status: 400, erro: 'Esta etapa não é uma inspeção' };
  const ter = body.terceiro && texto(body.terceiro.nome, 120) ? { nome: texto(body.terceiro.nome, 120), cpf: String(body.terceiro.cpf || '').replace(/\D/g, '').slice(0, 11) || null, empresa: texto(body.terceiro.empresa, 120), telefone: texto(body.terceiro.telefone, 30) } : null;
  const executor = ter ? { tipo: 'terceiro', nome: ter.nome, terceiro: ter } : ex.motorista_id != null ? { tipo: 'colaborador', colaborador_id: ex.motorista_id, nome: ex.motorista_nome } : { tipo: 'terceiro', nome: 'Motorista (link da AT)', terceiro: null };
  const r = await I.enviar(supabase, ex.tenant_id, executor, { ...body, equipamento_id: et.equipamento_id, modelo_id: et.modelo_id }, { origem: 'at' });
  if (r.erro) return r;
  let ins = r.inspecao;
  if (r.repetido || !ins?.numero) ins = (await q(supabase.from('inspecoes').select('*').eq('tenant_id', ex.tenant_id).eq('cliente_uid', String(body.cliente_uid || ''))))[0] || ins;
  if (ins?.id) await supabase.from('inspecoes').update({ execucao_id: ex.id, etapa_id: et.id }).eq('id', ins.id).eq('tenant_id', ex.tenant_id);
  const reprovada = ins?.resultado === 'reprovado';
  await gravarEtapa(supabase, ex, c.i, { status: reprovada ? 'reprovada' : 'feita', feita_em: new Date().toISOString(), gps: gpsOk(body.gps), por: executor.nome,
    inspecao_id: ins?.id ?? null, inspecao_numero: ins?.numero || null, resultado: ins?.resultado || null }, { usuarioNome: executor.nome });
  return { inspecao: { id: ins?.id, numero: ins?.numero, resultado: ins?.resultado, nao_ok: r.inspecao?.nao_ok, bloqueou: reprovada }, travou_fluxo: reprovada };
}
/** gestor/admin: libera a etapa reprovada (e o equipamento que a inspeção bloqueou) */
async function liberar(supabase, tenantId, quem, ex, etapaId, motivo) {
  if (!(quem.perfis || []).some((p) => ['admin', 'gestor'].includes(p))) return { status: 409, erro: 'Só gestor ou admin libera uma etapa reprovada' };
  const m = texto(motivo, 500); if (!m || m.length < 10) return { status: 400, erro: 'Explique a liberação (mínimo 10 caracteres) — fica registrada na AT' };
  const fluxo = ex.fluxo || []; const i = fluxo.findIndex((x) => x.id === etapaId);
  if (i < 0 || fluxo[i].status !== 'reprovada' || fluxo[i].liberacao) return { status: 409, erro: 'Esta etapa não está aguardando liberação' };
  const eq = (await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId).eq('id', fluxo[i].equipamento_id)))[0];
  if (eq?.bloqueado) { const r = await require('./inspecoes').liberar(supabase, tenantId, quem, eq.id, m); if (r?.erro && !/não está bloqueado/.test(r.erro)) return r; }
  const nova = await gravarEtapa(supabase, ex, i, { liberacao: { por: quem.usuarioNome || null, em: new Date().toISOString(), motivo: m } }, quem);
  return { execucao: nova };
}

module.exports = { inicialInspecao, MARCOS, INSP, modelosInspecao, fluxoPadrao, validarFluxo, mesclar, proxima, resumo, comLiberacao, conferir, marcar, prepararInspecao, enviarInspecao, liberar, concluida };
