// backend/services/epiEntregas.js — etapa 12d.2
//
// Entrega de EPI ao colaborador (ficha NR-6):
//   • Painel por colaborador: kit da função × o que ele tem em uso (✓ em dia · ⚠ troca em até 15 dias ·
//     🔴 troca vencida · ✗ não entregue), tamanhos e o item sugerido de cada tipo (tamanho certo, com saldo).
//   • Entrega: valida CA (NR-6: sem CA válido não entrega), saldo e assinatura; dá baixa no Estoque
//     (itens_consumo.saldo_atual + itens_consumo_enderecos — endereço EPI primeiro) com movimento MOV-…;
//     grava a ficha EPI-AAAA-NNNN com cópia de nome/CA/tamanho da data. NÃO passa pela aprovação de
//     retirada (decisão 19/10: a ficha assinada é o controle).
//   • Entregar um tipo que já está em uso fecha o anterior como 'substituido'.
//   • Devolução: 'bom' volta ao endereço EPI (entrada no estoque); 'danificado' = descarte.
//
// Regras do backend: sem DB.raw; ids com String(); filtros sem null.

const crypto = require('crypto');
const E = require('./epi');

const SISTEMA_UUID = '00000000-0000-0000-0000-000000000000';
const MOTIVOS = ['entrega', 'admissao', 'troca', 'reposicao', 'perda', 'dano', 'outro'];
const AVISO_TROCA_DIAS = 15;
const MAX_ASSINATURA = 400 * 1024; // data URL

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const hojeBR = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600000).toISOString().slice(0, 10);
const somaDias = (iso, dias) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + Number(dias)); return d.toISOString().slice(0, 10); };
const diasAte = (de, ate) => Math.round((Date.parse(ate + 'T00:00:00Z') - Date.parse(de + 'T00:00:00Z')) / 86400000);
const GRADE_COL = { calcado: 'tam_calcado', camisa: 'tam_camisa', calca: 'tam_calca', luva: 'tam_luva' };
const normTam = (t) => String(t || '').trim().toUpperCase();

/** Situação de um tipo do kit para um colaborador */
function situacaoTipo(k, emUso, hoje) {
  const meus = emUso.filter((i) => i.tipo === k.tipo);
  if (!meus.length) return { situacao: 'nao_entregue', dias: null, item: null, quantidade: 0 };
  const qtd = meus.reduce((s, i) => s + Number(i.quantidade || 0), 0);
  const datas = meus.map((i) => i.proxima_troca).filter(Boolean).sort();
  const prox = datas[0] || null; // a mais próxima manda
  const ultimo = [...meus].sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)))[0];
  if (!prox) return { situacao: 'ok', dias: null, proxima_troca: null, item: ultimo, quantidade: qtd };
  const dias = diasAte(hoje, String(prox).slice(0, 10));
  return { situacao: dias < 0 ? 'vencido' : dias <= AVISO_TROCA_DIAS ? 'vence' : 'ok', dias, proxima_troca: prox, item: ultimo, quantidade: qtd };
}

/** Item de EPI sugerido para o tipo: tamanho do colaborador > com saldo > qualquer */
function sugerirItem(tipo, tiposPor, epiItens, colab) {
  const cands = epiItens.filter((e) => e.tipo === tipo && e.item_ativo);
  if (!cands.length) return null;
  const grade = tiposPor.get(tipo)?.grade;
  const tam = grade ? normTam(colab[GRADE_COL[grade]]) : '';
  const nota = (e) => (tam && normTam(e.tamanho) === tam ? 4 : 0) + (e.saldo_total > 0 ? 2 : 0) + (e.ca_situacao !== 'vencido' ? 1 : 0);
  return [...cands].sort((a, b) => nota(b) - nota(a) || b.saldo_total - a.saldo_total)[0];
}

async function carregarBase(supabase, tenantId) {
  const [colabs, funcoes, itensUso, epiItens, tipos] = await Promise.all([
    q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId)),
    q(supabase.from('funcoes').select('*').eq('tenant_id', tenantId)),
    q(supabase.from('epi_entrega_itens').select('*').eq('tenant_id', tenantId)),
    E.listarEpiItens(supabase, tenantId),
    E.tiposDoTenant(supabase, tenantId),
  ]);
  return { colabs, funcoes, emUsoTodos: itensUso.filter((i) => !i.devolvido_em), epiItens, tipos };
}

/** Status de EPI de um colaborador (usado no painel, na ficha e no selo de conformidade) */
function statusColaborador(colab, base, hoje = hojeBR()) {
  const funcao = colab.funcao_id != null ? base.funcoes.find((f) => String(f.id) === String(colab.funcao_id)) : null;
  const kit = (funcao?.epis || []);
  const emUso = base.emUsoTodos.filter((i) => String(i.colaborador_id) === String(colab.id));
  const tiposPor = new Map(base.tipos.map((t) => [t.codigo, t]));
  const itens = kit.map((k) => {
    const s = situacaoTipo(k, emUso, hoje);
    const sug = sugerirItem(k.tipo, tiposPor, base.epiItens, colab);
    return {
      tipo: k.tipo, tipo_nome: tiposPor.get(k.tipo)?.nome || k.tipo, grade: tiposPor.get(k.tipo)?.grade || null,
      quantidade_kit: k.quantidade || 1, troca_dias_kit: k.troca_dias || null,
      ...s, item: s.item ? { id: s.item.id, item_nome: s.item.item_nome, tamanho: s.item.tamanho, ca: s.item.ca, entregue_em: s.item.criado_em } : null,
      sugerido: sug ? { epi_item_id: sug.id, item_nome: sug.item_nome, tamanho: sug.tamanho, saldo: sug.saldo_total, unidade: sug.unidade, ca: sug.ca, ca_situacao: sug.ca_situacao } : null,
    };
  });
  const r = { total: itens.length, ok: 0, vence: 0, vencido: 0, nao_entregue: 0 };
  for (const i of itens) r[i.situacao]++;
  // fora do kit (entregue mas a função não pede): aparece na ficha, não conta no %
  const extras = emUso.filter((i) => !kit.some((k) => k.tipo === i.tipo)).map((i) => ({ id: i.id, tipo: i.tipo, item_nome: i.item_nome, proxima_troca: i.proxima_troca }));
  return { funcao: funcao ? { id: funcao.id, nome: funcao.nome } : null, itens, resumo: r, extras, em_uso: emUso };
}

/** Painel "Gestão de funcionários" */
async function painel(supabase, tenantId, { agora } = {}) {
  const base = await carregarBase(supabase, tenantId);
  const hoje = hojeBR(agora);
  return base.colabs.filter((c) => c.situacao !== 'desligado').map((c) => {
    const s = statusColaborador(c, base, hoje);
    return {
      id: c.id, nome: c.nome, situacao: c.situacao, funcao_id: c.funcao_id, funcao_nome: s.funcao?.nome || c.funcao || null,
      tamanhos: { calcado: c.tam_calcado || null, camisa: c.tam_camisa || null, calca: c.tam_calca || null, luva: c.tam_luva || null },
      itens: s.itens, resumo: s.resumo, extras: s.extras,
    };
  }).sort((a, b) => (b.resumo.vencido - a.resumo.vencido) || (b.resumo.nao_entregue - a.resumo.nao_entregue) || String(a.nome).localeCompare(String(b.nome)));
}

async function proximoNumero(supabase, tenantId, ano) {
  const l = await q(supabase.from('epi_entregas').select('*').eq('tenant_id', tenantId));
  const pref = `EPI-${ano}-`;
  const max = l.map((e) => e.numero).filter((n) => n && n.startsWith(pref)).map((n) => parseInt(n.slice(pref.length), 10) || 0).reduce((a, b) => Math.max(a, b), 0);
  return `${pref}${String(max + 1).padStart(4, '0')}`;
}
async function proximoMovimento(supabase, tenantId) {
  const ano = new Date().getFullYear(), pref = `MOV-${ano}-`;
  const l = await q(supabase.from('movimentacoes_estoque').select('*').eq('tenant_id', tenantId)).catch(() => []);
  const max = l.map((m) => m.numero_movimento).filter((n) => n && n.startsWith(pref)).map((n) => parseInt((n.match(/(\d+)$/) || [])[1], 10) || 0).reduce((a, b) => Math.max(a, b), 0);
  return (k) => `${pref}${String(max + k).padStart(4, '0')}`;
}

/** Tira `qtd` dos endereços do item: EPI primeiro, depois os outros com saldo (RECEBIMENTO por último) */
function planoBaixa(enderecos, qtd) {
  const ordem = [...enderecos].filter((e) => Number(e.saldo) > 0)
    .sort((a, b) => (a.endereco === E.ENDERECO_EPI ? -1 : b.endereco === E.ENDERECO_EPI ? 1 : 0) || (a.endereco === 'RECEBIMENTO') - (b.endereco === 'RECEBIMENTO') || Number(b.saldo) - Number(a.saldo));
  const plano = []; let falta = qtd;
  for (const e of ordem) { if (falta <= 0) break; const t = Math.min(falta, Number(e.saldo)); plano.push({ linha: e, qtd: t }); falta -= t; }
  return { plano, falta };
}

function validarAssinatura(png) {
  if (typeof png !== 'string' || !png.startsWith('data:image/png;base64,')) return 'Falta a assinatura do colaborador';
  if (png.length > MAX_ASSINATURA) return 'Assinatura muito grande';
  if (png.length < 200) return 'Assinatura vazia — peça para o colaborador assinar';
  return null;
}

/**
 * Registra a entrega. body: { colaborador_id, motivo, obs, assinatura_png, itens: [{ epi_item_id, quantidade, troca_dias? }] }
 * usuario: { id, nome }
 */
async function registrarEntrega(supabase, tenantId, usuario, body, { agora = new Date() } = {}) {
  const colab = (await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId).eq('id', body?.colaborador_id)))[0];
  if (!colab) return { status: 404, erro: 'Colaborador não encontrado' };
  if (colab.situacao === 'desligado') return { status: 400, erro: 'Colaborador desligado não recebe EPI' };
  const motivo = MOTIVOS.includes(body.motivo) ? body.motivo : 'entrega';
  const ass = validarAssinatura(body.assinatura_png); if (ass) return { status: 400, erro: ass };
  const pedidos = Array.isArray(body.itens) ? body.itens.filter((i) => i && i.epi_item_id && Number(i.quantidade) > 0) : [];
  if (!pedidos.length) return { status: 400, erro: 'Escolha pelo menos um EPI' };
  if (pedidos.length > 40) return { status: 400, erro: 'Itens demais numa entrega' };

  const epiItens = await E.listarEpiItens(supabase, tenantId, { agora });
  const hoje = hojeBR(agora);
  const funcao = colab.funcao_id != null ? (await q(supabase.from('funcoes').select('*').eq('tenant_id', tenantId).eq('id', colab.funcao_id)))[0] : null;
  const kit = funcao?.epis || [];

  // 1) valida tudo antes de mexer no estoque
  const linhas = [];
  const enderecosPor = new Map();
  for (const p of pedidos) {
    const e = epiItens.find((x) => String(x.id) === String(p.epi_item_id));
    if (!e) return { status: 400, erro: 'EPI não encontrado' };
    if (!e.ca) return { status: 400, erro: `${e.item_nome}: sem nº de CA — cadastre o CA antes de entregar (NR-6)` };
    if (e.ca_situacao === 'vencido') return { status: 400, erro: `${e.item_nome}: CA ${e.ca} vencido — não pode ser entregue (NR-6)` };
    const qtd = Number(p.quantidade);
    const chave = String(e.item_consumo_id);
    if (!enderecosPor.has(chave)) enderecosPor.set(chave, await q(supabase.from('itens_consumo_enderecos').select('*').eq('tenant_id', tenantId).eq('item_consumo_id', e.item_consumo_id)));
    const jaPedido = linhas.filter((l) => String(l.e.item_consumo_id) === chave).reduce((s, l) => s + l.qtd, 0);
    if (e.saldo_total < jaPedido + qtd) return { status: 400, erro: `${e.item_nome}: saldo ${e.saldo_total} ${e.unidade}, pediu ${jaPedido + qtd}` };
    const trocaKit = kit.find((k) => k.tipo === e.tipo)?.troca_dias;
    const troca = p.troca_dias ? parseInt(p.troca_dias, 10) : (trocaKit || e.troca_dias || null);
    linhas.push({ e, qtd, troca: troca && troca >= 1 && troca <= 3650 ? troca : null });
  }

  // 2) número da ficha + baixa no estoque
  const numero = await proximoNumero(supabase, tenantId, hoje.slice(0, 4));
  const mov = await proximoMovimento(supabase, tenantId);
  const nome = colab.nome;
  let kmov = 0;
  const feitos = []; // para desfazer se algo quebrar no meio
  try {
    for (const l of linhas) {
      const ends = enderecosPor.get(String(l.e.item_consumo_id));
      const { plano, falta } = planoBaixa(ends, l.qtd);
      // saldo sem endereço (itens antigos): baixa só no total
      for (const pb of plano) {
        const novo = Number(pb.linha.saldo) - pb.qtd;
        const r = await supabase.from('itens_consumo_enderecos').update({ saldo: novo, atualizado_em: new Date().toISOString() }).eq('id', pb.linha.id).eq('tenant_id', tenantId);
        if (r.error) throw new Error(r.error.message);
        feitos.push({ t: 'end', id: pb.linha.id, volta: Number(pb.linha.saldo) });
        pb.linha.saldo = novo;
      }
      const it = (await q(supabase.from('itens_consumo').select('*').eq('tenant_id', tenantId).eq('id', l.e.item_consumo_id)))[0];
      const antes = Number(it?.saldo_atual) || 0;
      const r2 = await supabase.from('itens_consumo').update({ saldo_atual: antes - l.qtd, atualizado_em: new Date().toISOString() }).eq('id', l.e.item_consumo_id).eq('tenant_id', tenantId);
      if (r2.error) throw new Error(r2.error.message);
      feitos.push({ t: 'item', id: l.e.item_consumo_id, volta: antes });
      l.endereco = plano.map((p) => p.linha.endereco).join(', ') || (falta > 0 ? 'sem endereço' : null);
      l.movimento = mov(++kmov);
      const r3 = await supabase.from('movimentacoes_estoque').insert([{
        tenant_id: tenantId, numero_movimento: l.movimento, item_consumo_id: l.e.item_consumo_id, tipo: 'saida', quantidade: l.qtd,
        responsavel_id: usuario?.id || null, observacao: `Entrega de EPI ${numero} — ${nome}`,
        aprovado_por: usuario?.id || SISTEMA_UUID, aprovado_em: new Date().toISOString(), status: 'aprovado',
      }]).select();
      if (r3.error) throw new Error(r3.error.message);
      feitos.push({ t: 'mov', id: r3.data[0].id });
    }

    // 3) ficha
    const hash = crypto.createHash('sha256').update(JSON.stringify({ numero, colaborador: String(colab.id), itens: linhas.map((l) => [l.e.id, l.qtd, l.e.ca]), em: agora.toISOString() }) + body.assinatura_png).digest('hex');
    const { data: ent, error: e1 } = await supabase.from('epi_entregas').insert([{
      tenant_id: tenantId, numero, colaborador_id: colab.id, funcao_nome: funcao?.nome || colab.funcao || null, motivo,
      entregue_em: agora.toISOString(), entregue_por: usuario?.id || null, entregue_por_nome: usuario?.nome || null,
      assinatura_png: body.assinatura_png, assinatura_hash: hash, obs: body.obs ? String(body.obs).slice(0, 1000) : null,
    }]).select();
    if (e1) throw new Error(e1.message);
    const entrega = ent[0];
    feitos.push({ t: 'ent', id: entrega.id });

    const { data: its, error: e2 } = await supabase.from('epi_entrega_itens').insert(linhas.map((l) => ({
      tenant_id: tenantId, entrega_id: entrega.id, colaborador_id: colab.id, epi_item_id: l.e.id, item_consumo_id: l.e.item_consumo_id,
      tipo: l.e.tipo, item_nome: l.e.item_nome, ca: l.e.ca, tamanho: l.e.tamanho || null, quantidade: l.qtd,
      troca_dias: l.troca, proxima_troca: l.troca ? somaDias(hoje, l.troca) : null, endereco_saida: l.endereco, movimento_numero: l.movimento,
    }))).select();
    if (e2) throw new Error(e2.message);
    // fecha o que estava em uso do mesmo tipo (troca)
    const emUso = (await q(supabase.from('epi_entrega_itens').select('*').eq('tenant_id', tenantId).eq('colaborador_id', colab.id))).filter((i) => !i.devolvido_em);
    const tiposNovos = new Set(linhas.map((l) => l.e.tipo));
    const novos = new Set(its.map((i) => String(i.id)));
    for (const u of emUso.filter((i) => tiposNovos.has(i.tipo) && !novos.has(String(i.id)))) {
      await supabase.from('epi_entrega_itens').update({ devolvido_em: agora.toISOString(), devolucao_estado: 'substituido', devolucao_obs: `Substituído na entrega ${numero}` }).eq('id', u.id).eq('tenant_id', tenantId);
    }

    return { entrega: { ...entrega, assinatura_png: undefined }, itens: its };
  } catch (err) {
    // desfaz o que deu para desfazer (melhor esforço — o erro original sobe)
    for (const f of feitos.reverse()) {
      try {
        if (f.t === 'end') await supabase.from('itens_consumo_enderecos').update({ saldo: f.volta }).eq('id', f.id).eq('tenant_id', tenantId);
        if (f.t === 'item') await supabase.from('itens_consumo').update({ saldo_atual: f.volta }).eq('id', f.id).eq('tenant_id', tenantId);
        if (f.t === 'mov') await supabase.from('movimentacoes_estoque').delete().eq('id', f.id).eq('tenant_id', tenantId);
        if (f.t === 'ent') await supabase.from('epi_entregas').delete().eq('id', f.id).eq('tenant_id', tenantId);
      } catch { /* segue */ }
    }
    throw err;
  }
}

/** Devolução de um item em uso: 'bom' volta ao estoque (endereço EPI); 'danificado' = descarte */
async function devolver(supabase, tenantId, usuario, itemId, { estado, obs } = {}) {
  if (!['bom', 'danificado'].includes(estado)) return { status: 400, erro: 'Informe o estado: bom ou danificado' };
  const it = (await q(supabase.from('epi_entrega_itens').select('*').eq('tenant_id', tenantId).eq('id', itemId)))[0];
  if (!it) return { status: 404, erro: 'Item de entrega não encontrado' };
  if (it.devolvido_em) return { status: 400, erro: 'Esse EPI já foi devolvido' };
  let movimento = null;
  if (estado === 'bom' && it.item_consumo_id) {
    const qtd = Number(it.quantidade);
    const ic = (await q(supabase.from('itens_consumo').select('*').eq('tenant_id', tenantId).eq('id', it.item_consumo_id)))[0];
    if (ic) {
      await E.garantirEnderecoEpi(supabase, tenantId);
      const ends = await q(supabase.from('itens_consumo_enderecos').select('*').eq('tenant_id', tenantId).eq('item_consumo_id', it.item_consumo_id));
      const l = ends.find((x) => x.endereco === E.ENDERECO_EPI);
      if (l) await supabase.from('itens_consumo_enderecos').update({ saldo: Number(l.saldo) + qtd, atualizado_em: new Date().toISOString() }).eq('id', l.id).eq('tenant_id', tenantId);
      else await supabase.from('itens_consumo_enderecos').insert([{ tenant_id: tenantId, item_consumo_id: it.item_consumo_id, endereco: E.ENDERECO_EPI, saldo: qtd, atualizado_em: new Date().toISOString() }]);
      await supabase.from('itens_consumo').update({ saldo_atual: (Number(ic.saldo_atual) || 0) + qtd, atualizado_em: new Date().toISOString() }).eq('id', ic.id).eq('tenant_id', tenantId);
      movimento = (await proximoMovimento(supabase, tenantId))(1);
      await supabase.from('movimentacoes_estoque').insert([{
        tenant_id: tenantId, numero_movimento: movimento, item_consumo_id: it.item_consumo_id, tipo: 'entrada', quantidade: qtd,
        responsavel_id: usuario?.id || null, observacao: `Devolução de EPI (bom estado) — ${it.item_nome}`,
        aprovado_por: usuario?.id || SISTEMA_UUID, aprovado_em: new Date().toISOString(), status: 'aprovado',
      }]);
    }
  }
  const { data, error } = await supabase.from('epi_entrega_itens').update({
    devolvido_em: new Date().toISOString(), devolucao_estado: estado,
    devolucao_obs: [obs ? String(obs).slice(0, 500) : null, movimento ? `Voltou ao estoque (${movimento})` : estado === 'danificado' ? 'Descartado' : null].filter(Boolean).join(' · ') || null,
  }).eq('id', it.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { item: data[0] };
}

/** Histórico de entregas de um colaborador (para a ficha NR-6) */
async function historico(supabase, tenantId, colaboradorId, { comAssinatura = false } = {}) {
  const ents = await q(supabase.from('epi_entregas').select('*').eq('tenant_id', tenantId).eq('colaborador_id', colaboradorId));
  const its = await q(supabase.from('epi_entrega_itens').select('*').eq('tenant_id', tenantId).eq('colaborador_id', colaboradorId));
  return ents.sort((a, b) => String(a.entregue_em).localeCompare(String(b.entregue_em))).map((e) => ({
    ...e, assinatura_png: comAssinatura ? e.assinatura_png : undefined,
    itens: its.filter((i) => String(i.entrega_id) === String(e.id)).sort((a, b) => String(a.item_nome).localeCompare(String(b.item_nome))),
  }));
}

module.exports = { MOTIVOS, AVISO_TROCA_DIAS, situacaoTipo, sugerirItem, statusColaborador, carregarBase, painel, planoBaixa, validarAssinatura, registrarEntrega, devolver, historico, hojeBR };
