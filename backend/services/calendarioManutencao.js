// services/calendarioManutencao.js — etapa 12a (calendário anual de manutenção)
//
// Só LEITURA. Monta, para um intervalo de datas, as OS programadas do tenant
// com situação e as três camadas de custo:
//   planejado     → quanto a OS deve custar (preço da OV ligada; senão último
//                   preço pago do item; senão preço do catálogo)
//   comprometido  → OV emitida e ainda não recebida
//   realizado     → OV recebida (quantidade_recebida × valor unitário)
// e o "% de custo conhecido" (itens ativos com algum valor ÷ itens ativos).
//
// Ligação do custo: item da OS → item da RM (chamado_itens.origem_os_item_id)
// → item da OV (ordem_venda_itens.chamado_item_id). Também aceita OV ligada
// direto no item da OS.
//
// Mão de obra própria (12b): horas × pessoas × tenants.valor_hora. Sem valor
// de hora cadastrado, o serviço sem OV entra só em HORAS e conta como "sem valor".
// Serviço sem horário próprio (OS com "programação geral") usa a janela da OS:
// até 24 h = horas reais; mais que isso = 8 h por dia de calendário.
//
// Regras do backend respeitadas: nada de DB.raw; nada de filtro com null;
// ids comparados com String(); numeric chega como string → Number().

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const idStr = (v) => (v === null || v === undefined ? null : String(v));

function horasHomem(ini, fim, pessoas) {
  if (!ini || !fim || !pessoas) return 0;
  const diffMs = new Date(fim) - new Date(ini);
  if (isNaN(diffMs) || diffMs <= 0) return 0;
  return (diffMs / 3600000) * Number(pessoas);
}

// Horas de um serviço sem horário próprio, estimadas pela janela da OS
function horasPelaJanela(os, pessoas) {
  if (!os.data_inicio_prevista) return 0;
  const ini = new Date(os.data_inicio_prevista);
  const fim = new Date(os.data_fim_prevista || os.data_inicio_prevista);
  const h = (fim - ini) / 3600000;
  if (!(h > 0)) return 0;
  const p = Math.max(Number(pessoas) || 1, 1);
  if (h <= 24) return h * p;
  const dia = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const local = (d) => new Date(d.getTime() - 3 * 3600000);
  const dias = Math.round((dia(local(fim)) - dia(local(ini))) / 86400000) + 1;
  return dias * 8 * p;
}

function ehOS(ch) {
  return (ch.tipo_documento || 'os') === 'os';
}

// programada | em_execucao | concluida | atrasada
function situacaoOS(os, agora = new Date()) {
  if (os.concluida_em) return 'concluida';
  if (os.status === 'em_andamento') return 'em_execucao';
  const limite = os.data_fim_prevista || os.data_inicio_prevista;
  if (limite && new Date(limite) < agora) return 'atrasada';
  return 'programada';
}

// A OS ocupa o intervalo [de, ate]? (datas 'YYYY-MM-DD', fim do dia incluso)
function ocupaIntervalo(os, de, ate) {
  if (!os.data_inicio_prevista) return false;
  const ini = new Date(os.data_inicio_prevista);
  const fim = new Date(os.data_fim_prevista || os.data_inicio_prevista);
  const deD = new Date(`${de}T00:00:00-03:00`);
  const ateD = new Date(`${ate}T23:59:59.999-03:00`);
  return ini <= ateD && fim >= deD;
}

const ovValida = (ov) => ov && !String(ov.status || '').includes('cancel');

/**
 * Cálculo puro (testável sem banco).
 * @param {object} dados { osList, itensOS, itensRM, itensOV, ordensVenda,
 *                         precosUltimos (Map catalogoId→valor), precosCatalogo (Map), equipamentos }
 */
function montarCalendario(dados, { agora = new Date() } = {}) {
  const { osList, itensOS, itensRM, itensOV, ordensVenda, precosUltimos, precosCatalogo, equipamentos } = dados;
  const valorHora = num(dados.valorHora) > 0 ? num(dados.valorHora) : 0;

  const ovPorId = new Map(ordensVenda.map((o) => [idStr(o.id), o]));
  const eqPorId = new Map((equipamentos || []).map((e) => [idStr(e.id), e]));

  // item da OS → ids de chamado_item que podem estar na OV (o próprio + os da RM)
  const rmPorItemOS = new Map();
  for (const r of itensRM) {
    const k = idStr(r.origem_os_item_id);
    if (!k || r.status === 'cancelado') continue;
    if (!rmPorItemOS.has(k)) rmPorItemOS.set(k, []);
    rmPorItemOS.get(k).push(idStr(r.id));
  }
  const ovItensPorChamadoItem = new Map();
  for (const oi of itensOV) {
    if (!ovValida(ovPorId.get(idStr(oi.ordem_venda_id)))) continue;
    const k = idStr(oi.chamado_item_id);
    if (!k) continue;
    if (!ovItensPorChamadoItem.has(k)) ovItensPorChamadoItem.set(k, []);
    ovItensPorChamadoItem.get(k).push(oi);
  }

  const itensPorOS = new Map();
  for (const it of itensOS) {
    const k = idStr(it.chamado_id);
    if (!itensPorOS.has(k)) itensPorOS.set(k, []);
    itensPorOS.get(k).push(it);
  }

  const resultado = [];
  for (const os of osList) {
    const itens = (itensPorOS.get(idStr(os.id)) || []).filter((it) => it.status !== 'cancelado');
    let planejado = 0, comprometido = 0, realizado = 0, horas = 0, maoDeObra = 0;
    let comValor = 0, semPreco = 0;

    for (const it of itens) {
      const ligados = [idStr(it.id), ...(rmPorItemOS.get(idStr(it.id)) || [])];
      const ovItens = ligados.flatMap((k) => ovItensPorChamadoItem.get(k) || []);

      let comp = 0, real = 0, totalOV = 0;
      for (const oi of ovItens) {
        const vu = num(oi.valor_unitario);
        const q = num(oi.quantidade);
        const qr = Math.min(num(oi.quantidade_recebida), q);
        real += vu * qr;
        comp += vu * (q - qr);
        totalOV += vu * q;
      }
      comprometido += comp;
      realizado += real;

      if (it.tipo === 'servico') {
        const h = (it.data_inicio_prevista && it.data_fim_prevista)
          ? horasHomem(it.data_inicio_prevista, it.data_fim_prevista, it.qtd_pessoas_planejada)
          : horasPelaJanela(os, it.qtd_pessoas_planejada);
        horas += h;
        if (ovItens.length) { planejado += totalOV; comValor++; }        // serviço de terceiro (OV)
        else if (valorHora > 0 && h > 0) { planejado += h * valorHora; maoDeObra += h * valorHora; comValor++; } // mão de obra própria
        continue;
      }

      // material
      if (ovItens.length) { planejado += totalOV; comValor++; continue; }
      const cat = idStr(it.item_catalogo_id);
      const preco = cat ? (precosUltimos.get(cat) ?? precosCatalogo.get(cat) ?? null) : null;
      if (preco !== null && preco !== undefined && num(preco) > 0) {
        planejado += num(preco) * num(it.quantidade || 1);
        comValor++;
      } else {
        semPreco++;
      }
    }

    const eq = eqPorId.get(idStr(os.equipamento_id));
    resultado.push({
      id: os.id,
      numero: os.numero,
      descricao: os.servico_nome || os.descricao_geral || '',
      categoria: os.categoria || null,
      urgencia: os.urgencia || null,
      equipamento_id: os.equipamento_id || null,
      equipamento: eq ? `${eq.tag ? eq.tag + ' - ' : ''}${eq.nome || ''}` : null,
      inicio: os.data_inicio_prevista,
      fim: os.data_fim_prevista || os.data_inicio_prevista,
      situacao: situacaoOS(os, agora),
      origem_plano_id: os.origem_plano_id || null,
      responsavel_id: os.responsavel_id || null,
      custo: {
        planejado: arred(planejado),
        comprometido: arred(comprometido),
        realizado: arred(realizado),
        horas: Math.round(horas * 10) / 10,
        mao_de_obra: arred(maoDeObra),
        itens: itens.length,
        itens_com_valor: comValor,
        itens_sem_preco: semPreco,
        percentual_conhecido: itens.length ? Math.round((comValor / itens.length) * 100) : 0,
      },
    });
  }

  resultado.sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)) || String(a.numero).localeCompare(String(b.numero)));
  return { os: resultado, totais: totalizar(resultado) };
}

function arred(v) { return Math.round(v * 100) / 100; }

function totalizar(lista) {
  const t = { os: lista.length, planejado: 0, comprometido: 0, realizado: 0, horas: 0, itens: 0, itens_com_valor: 0, por_situacao: {} };
  for (const o of lista) {
    t.planejado += o.custo.planejado;
    t.comprometido += o.custo.comprometido;
    t.realizado += o.custo.realizado;
    t.horas += o.custo.horas;
    t.itens += o.custo.itens;
    t.itens_com_valor += o.custo.itens_com_valor;
    t.por_situacao[o.situacao] = (t.por_situacao[o.situacao] || 0) + 1;
  }
  t.planejado = arred(t.planejado);
  t.comprometido = arred(t.comprometido);
  t.realizado = arred(t.realizado);
  t.horas = Math.round(t.horas * 10) / 10;
  t.falta = arred(Math.max(t.planejado - t.realizado - t.comprometido, 0));
  t.percentual_conhecido = t.itens ? Math.round((t.itens_com_valor / t.itens) * 100) : 0;
  return t;
}

// ─── Leitura no banco (supabase-js; filtros explícitos, sem DB.raw) ───────
async function emLotes(ids, fn, tam = 200) {
  const out = [];
  for (let i = 0; i < ids.length; i += tam) out.push(...(await fn(ids.slice(i, i + tam))));
  return out;
}

async function carregar(supabase, tenantId, { de, ate, equipamentoId }) {
  if (!tenantId) throw new Error('tenant obrigatório');
  const q = async (p) => { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; };

  // OS com início até o fim do intervalo (as que terminam antes de "de" saem no filtro em JS)
  let base = supabase.from('chamados').select('*')
    .eq('tenant_id', tenantId)
    .not('data_inicio_prevista', 'is', null)
    .lte('data_inicio_prevista', `${ate}T23:59:59.999-03:00`);
  if (equipamentoId) base = base.eq('equipamento_id', equipamentoId);
  const osList = (await q(base)).filter((c) => ehOS(c) && !c.cancelada_em && ocupaIntervalo(c, de, ate));

  const osIds = osList.map((o) => o.id);
  const vazio = { osList, itensOS: [], itensRM: [], itensOV: [], ordensVenda: [], precosUltimos: new Map(), precosCatalogo: new Map(), equipamentos: [], valorHora: null };
  if (!osIds.length) return vazio;

  const itensOS = await emLotes(osIds, (l) => q(supabase.from('chamado_itens').select('*').eq('tenant_id', tenantId).in('chamado_id', l)));
  const itemIds = itensOS.map((i) => i.id);
  const itensRM = itemIds.length
    ? await emLotes(itemIds, (l) => q(supabase.from('chamado_itens').select('*').eq('tenant_id', tenantId).in('origem_os_item_id', l)))
    : [];
  const ligados = [...itemIds, ...itensRM.map((r) => r.id)];
  const itensOV = await emLotes(ligados, (l) => q(supabase.from('ordem_venda_itens').select('*').eq('tenant_id', tenantId).in('chamado_item_id', l)));
  const ovIds = [...new Set(itensOV.map((i) => i.ordem_venda_id))];
  const ordensVenda = ovIds.length
    ? await emLotes(ovIds, (l) => q(supabase.from('ordens_venda').select('*').eq('tenant_id', tenantId).in('id', l)))
    : [];

  // Preço de referência dos materiais sem OV: último preço pago, senão catálogo
  const catIds = [...new Set(itensOS.filter((i) => i.tipo !== 'servico' && i.item_catalogo_id).map((i) => i.item_catalogo_id))];
  const { precosUltimos, precosCatalogo } = await buscarPrecos(supabase, tenantId, catIds);
  const valorHora = await buscarValorHora(supabase, tenantId);

  const eqIds = [...new Set(osList.map((o) => o.equipamento_id).filter(Boolean))];
  const equipamentos = eqIds.length
    ? await q(supabase.from('equipamentos').select('id, tag, nome').eq('tenant_id', tenantId).in('id', eqIds))
    : [];

  return { osList, itensOS, itensRM, itensOV, ordensVenda, precosUltimos, precosCatalogo, equipamentos, valorHora };
}

async function buscarPrecos(supabase, tenantId, catIds) {
  const q = async (p) => { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; };
  const precosUltimos = new Map();
  const precosCatalogo = new Map();
  if (!catIds.length) return { precosUltimos, precosCatalogo };
  const historico = await emLotes(catIds, (l) => q(supabase.from('ordem_venda_itens').select('item_catalogo_id, valor_unitario, criado_em').eq('tenant_id', tenantId).in('item_catalogo_id', l)));
  historico
    .filter((h) => num(h.valor_unitario) > 0)
    .sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')))
    .forEach((h) => { const k = idStr(h.item_catalogo_id); if (!precosUltimos.has(k)) precosUltimos.set(k, num(h.valor_unitario)); });
  // select('*'): o catálogo do tenant pode não ter coluna de preço (12a.1 —
  // pedir coluna inexistente derrubava a rota). Usa a primeira que existir.
  const catalogo = await emLotes(catIds, (l) => q(supabase.from('catalogo_itens').select('*').eq('tenant_id', tenantId).in('id', l)));
  catalogo.forEach((c) => {
    const preco = ['preco_unitario', 'preco_referencia', 'preco', 'valor_unitario', 'custo_medio']
      .map((k) => num(c[k])).find((v) => v > 0);
    if (preco) precosCatalogo.set(idStr(c.id), preco);
  });
  return { precosUltimos, precosCatalogo };
}

/** Map catalogoId → preço de referência (último pago, senão catálogo). Usado pelos planos (12b). */
async function precosReferencia(supabase, tenantId, catIds) {
  const { precosUltimos, precosCatalogo } = await buscarPrecos(supabase, tenantId, catIds);
  const m = new Map(precosCatalogo);
  for (const [k, v] of precosUltimos) m.set(k, v);
  return m;
}

// tenants.valor_hora (migration 019). select('*') para não quebrar antes da migration.
async function buscarValorHora(supabase, tenantId) {
  const { data, error } = await supabase.from('tenants').select('*').eq('id', tenantId);
  if (error) return null;
  const v = num(data?.[0]?.valor_hora);
  return v > 0 ? v : null;
}

module.exports = { montarCalendario, carregar, situacaoOS, ocupaIntervalo, horasHomem, horasPelaJanela, precosReferencia, buscarValorHora, num };