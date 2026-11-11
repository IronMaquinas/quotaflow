// backend/services/fichaCte.js — etapa 18g.3: 📋 ficha do CT-e (para quem emite sem o XML) + 🛡 apólices
//
// Tudo o que o emissor de CT-e pede, já preenchido a partir do pedido, da AT e das NF-e lidas na tarefa fiscal do trecho:
// emitente (dados da empresa + ⚙️ CT-e), tomador (cliente do pedido), remetente/destinatário (das NF-e; sem NF-e, o tomador),
// prestação (origem → destino, CFOP), carga (produto, peso, volumes, valor, chaves das NF-e), frete e ICMS, RNTRC, seguro
// (apólice vigente + averbação) e veículo/motorista da AT. Campo sem dado vem marcado "⚠ falta" para preencher no emissor.
// Na tela: copiar campo a campo, PDF (A4) e CSV. O XML do CT-e fica para depois.
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const sem080 = (e) => /fiscal_cte|tenant_apolices|does not exist|schema cache/i.test(String(e?.message || e));
const RAMOS = ['RCTR-C', 'RC-DC', 'RC-V', 'RCF-DC', 'Outro'];
const RESP = { emitente: 'Emitente do CT-e (transportadora)', remetente: 'Remetente', expedidor: 'Expedidor', recebedor: 'Recebedor', destinatario: 'Destinatário', tomador: 'Tomador' };
const CAMPOS_CFG = ['ie', 'uf', 'rntrc', 'cfop_estadual', 'cfop_interestadual', 'cst', 'aliquota_icms', 'produto_padrao', 'tomador_padrao'];
const txt = (v, n = 120) => String(v ?? '').trim().slice(0, n);
const dig = (v) => String(v || '').replace(/\D/g, '');
const fmtDoc = (v) => { const d = dig(v); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : v || ''; };
const brl = (v) => (v == null ? '' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const UF_RE = /(?:^|[\s/,-])([A-Z]{2})\s*$/;
const semUf = (s) => String(s || '').replace(/\s*[/,-]\s*[A-Za-z]{2}\s*$/, '').trim(); // 18g.3: "Contagem/MG" → "Contagem"
const ufDe = (s) => (String(s || '').toUpperCase().match(UF_RE) || [])[1] || null;

// ─── ⚙️ configuração do CT-e e apólices ─────────────────────────────────────
async function config(supabase, tenantId) {
  const t = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || {};
  let apolices = []; let migrou = 'fiscal_cte' in t;
  try { apolices = (await q(supabase.from('tenant_apolices').select('*').eq('tenant_id', tenantId))).sort((a, b) => (b.ativo - a.ativo) || String(b.vigencia_fim || '').localeCompare(String(a.vigencia_fim || ''))); } catch (e) { if (!sem080(e)) throw e; migrou = false; }
  return { migrou, cte: t.fiscal_cte || {}, apolices, ramos: RAMOS, responsaveis: RESP, empresa: { razao_social: t.razao_social || t.nome, cnpj: t.cnpj, cidade: t.cidade } };
}
async function salvarConfig(supabase, tenantId, body = {}) {
  const v = {}; for (const k of CAMPOS_CFG) if (body[k] !== undefined) v[k] = txt(body[k], k === 'produto_padrao' ? 120 : 40);
  if (v.uf) v.uf = v.uf.toUpperCase().slice(0, 2);
  for (const k of ['cfop_estadual', 'cfop_interestadual']) if (v[k] && !/^\d{4}$/.test(v[k])) return { status: 400, erro: 'CFOP tem 4 dígitos (ex.: 5353, 6353)' };
  if (v.aliquota_icms && Number.isNaN(Number(String(v.aliquota_icms).replace(',', '.')))) return { status: 400, erro: 'Alíquota do ICMS em % (ex.: 12)' };
  const t = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0]; if (!t) return { status: 404, erro: 'Empresa não encontrada' };
  if (!('fiscal_cte' in t)) return { status: 409, erro: 'Falta rodar a migration 080 no Supabase.' };
  const r = await supabase.from('tenants').update({ fiscal_cte: { ...(t.fiscal_cte || {}), ...v } }).eq('id', tenantId); if (r.error) throw new Error(r.error.message);
  return config(supabase, tenantId);
}
async function salvarApolice(supabase, tenantId, id, body = {}) {
  const linha = { tenant_id: tenantId, seguradora: txt(body.seguradora), seguradora_cnpj: dig(body.seguradora_cnpj) || null, numero: txt(body.numero, 60), ramo: RAMOS.includes(body.ramo) ? body.ramo : 'RCTR-C',
    responsavel: RESP[body.responsavel] ? body.responsavel : 'emitente', vigencia_inicio: /^\d{4}-\d{2}-\d{2}$/.test(body.vigencia_inicio || '') ? body.vigencia_inicio : null,
    vigencia_fim: /^\d{4}-\d{2}-\d{2}$/.test(body.vigencia_fim || '') ? body.vigencia_fim : null, obs: txt(body.obs, 300) || null, ativo: body.ativo !== false };
  if (!linha.seguradora || !linha.numero) return { status: 400, erro: 'Informe a seguradora e o número da apólice' };
  if (linha.vigencia_inicio && linha.vigencia_fim && linha.vigencia_fim < linha.vigencia_inicio) return { status: 400, erro: 'O fim da vigência é antes do início' };
  try {
    const r = id ? await supabase.from('tenant_apolices').update(linha).eq('id', id).eq('tenant_id', tenantId).select() : await supabase.from('tenant_apolices').insert([linha]).select();
    if (r.error) throw new Error(r.error.message);
  } catch (e) { if (sem080(e)) return { status: 409, erro: 'Falta rodar a migration 080 no Supabase.' }; throw e; }
  return config(supabase, tenantId);
}
async function excluirApolice(supabase, tenantId, id) {
  const r = await supabase.from('tenant_apolices').delete().eq('id', id).eq('tenant_id', tenantId); if (r.error) throw new Error(r.error.message);
  return config(supabase, tenantId);
}
/** a apólice que vale na data (vigente e ativa; RCTR-C primeiro) */
function apoliceNa(apolices, data) {
  const d = data || new Date().toISOString().slice(0, 10);
  const ok = apolices.filter((a) => a.ativo !== false && (!a.vigencia_inicio || a.vigencia_inicio <= d) && (!a.vigencia_fim || a.vigencia_fim >= d));
  return ok.sort((a, b) => (a.ramo === 'RCTR-C' ? -1 : 0) - (b.ramo === 'RCTR-C' ? -1 : 0))[0] || null;
}

// ─── 📋 a ficha ─────────────────────────────────────────────────────────────
async function ficha(supabase, tenantId, tarefaId) {
  const t = /^\d+$/.test(String(tarefaId)) ? (await q(supabase.from('tarefas').select('*').eq('tenant_id', tenantId).eq('id', tarefaId)))[0] : null;
  if (!t || t.origem !== 'fiscal') return { status: 404, erro: 'Tarefa fiscal não encontrada' };
  const [pvId, grupoId] = String(t.origem_ref || '').split(':');
  const pv = (await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId).eq('id', pvId)))[0];
  if (!pv) return { status: 404, erro: 'Pedido do trecho não encontrado' };
  const g = (pv.grupos || []).find((x) => String(x.id) === String(grupoId)) || {};
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || {}; const cfg = emp.fiscal_cte || {};
  const cli = pv.cliente_id ? (await q(supabase.from('clientes').select('*').eq('tenant_id', tenantId).eq('id', pv.cliente_id)).catch(() => []))[0] : null;
  const ats = (await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId).eq('pv_id', pv.id)).catch(() => [])).filter((e) => String(e.grupo_id) === String(g.id) && !['cancelada', 'rascunho'].includes(e.status))
    .sort((a, b) => String(a.inicio_previsto || '').localeCompare(String(b.inicio_previsto || '')));
  const at = ats[0] || null;
  let apolices = []; try { apolices = await q(supabase.from('tenant_apolices').select('*').eq('tenant_id', tenantId)); } catch { /* sem a 080 */ }
  const ck = t.checklist || {}; const ents = (k) => (ck[k]?.entradas || []);
  const nfes = ents('nfe').map((e) => e.dados).filter(Boolean); const nfe1 = nfes[0] || null;
  const aver = ents('averbacao').map((e) => e.numero).filter(Boolean);
  const dataTr = ck.data_trecho || (at?.inicio_previsto ? String(at.inicio_previsto).slice(0, 10) : null) || g.data_prevista || null;
  const apol = apoliceNa(apolices, dataTr);

  const enderecoCli = cli ? [cli.endereco, cli.numero, cli.complemento, cli.bairro].filter(Boolean).join(', ') : '';
  const tomador = { nome: cli?.razao_social || cli?.nome || pv.cliente_nome, doc: cli?.documento, ie: null, endereco: enderecoCli, municipio: cli?.cidade, uf: cli?.uf, cep: cli?.cep };
  const parteNfe = (p) => (p ? { nome: p.nome, doc: p.cnpj, ie: p.ie, endereco: '', municipio: p.municipio, uf: p.uf, cep: null } : null);
  const remetente = parteNfe(nfe1?.emitente) || tomador; const destinatario = parteNfe(nfe1?.destinatario) || null;
  const origem = at?.origem || g.coleta || ''; const destino = at?.destino || g.entrega || '';
  const ufIni = remetente?.uf || ufDe(origem); const ufFim = destinatario?.uf || ufDe(destino);
  const mesmoEstado = ufIni && ufFim ? ufIni === ufFim : null;
  const cfop = mesmoEstado === true ? cfg.cfop_estadual : mesmoEstado === false ? cfg.cfop_interestadual : null;
  // carga: NF-e primeiro; senão, os itens da AT/trecho
  const itens = (at?.itens?.length ? at.itens : g.itens || []).filter((i) => i.status !== 'cancelado');
  const produto = itens.map((i) => [i.valores?.veiculo, i.valores?.modelo].filter(Boolean).join(' ')).filter(Boolean).join(' + ') || cfg.produto_padrao || '';
  const pesoNfe = nfes.reduce((s, n) => s + (Number(n.peso) || 0), 0);
  const pesoItens = itens.reduce((s, i) => s + (Number(String(i.valores?.peso ?? '').replace(',', '.')) || 0) * 1000 * (Number(i.quantidade) || 1), 0); // peso operacional em t → kg
  const peso = pesoNfe || pesoItens || null;
  const volumes = nfes.reduce((s, n) => s + (Number(n.volumes) || 0), 0) || itens.reduce((s, i) => s + (Number(i.volumes) || Number(i.quantidade) || 1), 0) || null;
  const valorCarga = nfes.reduce((s, n) => s + (Number(n.valor) || 0), 0) || null;
  // frete: subtotal do trecho, senão a soma dos itens
  const frete = g.subtotal != null && g.subtotal !== '' ? Number(g.subtotal) : itens.reduce((s, i) => s + (Number(i.valor) || 0) * (Number(i.quantidade) || 1), 0) || null;
  const aliq = cfg.aliquota_icms != null && cfg.aliquota_icms !== '' ? Number(String(cfg.aliquota_icms).replace(',', '.')) : null;
  const icms = frete != null && aliq != null ? Math.round(frete * aliq) / 100 : null;
  const cavalo = (at?.conjunto || []).find((c) => c.papel === 'cavalo'); const impl = (at?.conjunto || []).filter((c) => c.papel !== 'cavalo');
  const enderecoEmp = [emp.endereco, emp.numero, emp.complemento, emp.bairro].filter(Boolean).join(', ');

  const F = (rotulo, valor, { obrig = true, dica = null } = {}) => ({ rotulo, valor: valor == null || valor === '' ? '' : String(valor), falta: obrig && (valor == null || valor === ''), dica });
  const parte = (p, obrig = true) => (p ? [F('Nome / razão social', p.nome, { obrig }), F('CNPJ / CPF', fmtDoc(p.doc), { obrig }), F('Inscrição estadual', p.ie, { obrig: false, dica: 'ISENTO se não tiver' }), F('Endereço', p.endereco, { obrig: false }), F('Município', p.municipio, { obrig }), F('UF', p.uf, { obrig }), F('CEP', p.cep, { obrig: false })]
    : [F('Nome / razão social', '', { obrig })]);
  const secoes = [
    { id: 'ide', titulo: '🧾 Identificação', campos: [F('Tipo do CT-e', 'Normal'), F('Modal', 'Rodoviário'), F('Tipo de serviço', 'Normal'), F('CFOP', cfop, { dica: mesmoEstado == null ? 'confira as UFs de início e fim' : `${mesmoEstado ? 'dentro' : 'fora'} do estado — ⚙️ Configurações → CT-e` }),
      F('Natureza da operação', 'Prestação de serviço de transporte'), F('Município de início', (nfe1 && remetente?.municipio) || semUf(origem), { dica: nfe1 ? null : `do endereço: ${origem || '—'}` }), F('UF de início', ufIni), F('Município de fim', (nfe1 && destinatario?.municipio) || semUf(destino), { dica: nfe1 ? null : `do endereço: ${destino || '—'}` }), F('UF de fim', ufFim), F('Data prevista', dataTr ? dataTr.split('-').reverse().join('/') : '', { obrig: false })] },
    { id: 'emit', titulo: '🚚 Emitente (sua empresa)', campos: [F('Razão social', emp.razao_social || emp.nome), F('CNPJ', fmtDoc(emp.cnpj)), F('Inscrição estadual', cfg.ie), F('Endereço', enderecoEmp, { obrig: false }), F('Município', emp.cidade), F('UF', cfg.uf), F('CEP', emp.cep, { obrig: false }), F('RNTRC', cfg.rntrc)] },
    { id: 'toma', titulo: '💼 Tomador do serviço', campos: [F('Quem é o tomador', cfg.tomador_padrao || 'Remetente', { obrig: false }), ...parte(tomador)] },
    { id: 'rem', titulo: '📤 Remetente', campos: parte(remetente) },
    { id: 'dest', titulo: '📥 Destinatário', campos: parte(destinatario) },
    { id: 'carga', titulo: '📦 Carga', campos: [F('Produto predominante', produto), F('Valor da carga (R$)', valorCarga != null ? brl(valorCarga) : '', { dica: 'soma das NF-e' }), F('Peso bruto (kg)', peso != null ? peso.toLocaleString('pt-BR') : ''), F('Volumes', volumes),
      F('Unidade de medida', 'KG'), ...(nfes.length ? nfes.map((n, k) => F(`Chave NF-e ${k + 1}`, n.chave)) : [F('Chave(s) da NF-e', '', { dica: 'anexe o XML da NF-e na tarefa fiscal' })])] },
    { id: 'valores', titulo: '💲 Valores e ICMS', campos: [F('Valor total da prestação (R$)', frete != null ? brl(frete) : ''), F('Componente: Frete valor (R$)', frete != null ? brl(frete) : ''), F('Valor a receber (R$)', frete != null ? brl(frete) : ''),
      F('CST do ICMS', cfg.cst), F('Base de cálculo (R$)', frete != null ? brl(frete) : ''), F('Alíquota ICMS (%)', aliq != null ? String(aliq).replace('.', ',') : ''), F('Valor do ICMS (R$)', icms != null ? brl(icms) : '')] },
    { id: 'seguro', titulo: '🛡 Seguro', campos: [F('Responsável pelo seguro', apol ? RESP[apol.responsavel] : ''), F('Seguradora', apol?.seguradora), F('CNPJ da seguradora', fmtDoc(apol?.seguradora_cnpj), { obrig: false }), F('Nº da apólice', apol?.numero, { dica: apol ? `${apol.ramo}${apol.vigencia_fim ? ` · vigente até ${apol.vigencia_fim.split('-').reverse().join('/')}` : ''}` : 'cadastre em ⚙️ Configurações → Apólices' }),
      F('Nº da averbação', aver.join(', '), { obrig: false, dica: 'vem do passo Averbação da tarefa' })] },
    { id: 'rodo', titulo: '🛣 Rodoviário e veículo', campos: [F('RNTRC', cfg.rntrc), F('Placa do veículo (tração)', cavalo?.placa || cavalo?.tag || '', { obrig: false }), F('Reboque(s)', impl.map((c) => c.placa || c.tag).filter(Boolean).join(', '), { obrig: false }), F('Motorista', at?.motorista_nome || '', { obrig: false }), F('AT', at?.numero || '', { obrig: false })] },
  ];
  const faltam = secoes.flatMap((s) => s.campos.filter((c) => c.falta).map((c) => `${s.titulo.replace(/^\S+\s/, '')}: ${c.rotulo}`));
  return { tarefa: { id: t.id, numero: t.numero }, pedido: { id: pv.id, numero: pv.numero }, trecho: g.titulo || null, at: at ? { id: at.id, numero: at.numero } : null, nfes: nfes.length, secoes, faltam, migrou: 'fiscal_cte' in emp };
}

module.exports = { RAMOS, RESP, config, salvarConfig, salvarApolice, excluirApolice, apoliceNa, ficha };
