// backend/services/bids.js — etapa 15a
//
// 📈 Comercial (mini-CRM) + BID (decidido com o Marcony, 27/10/2026):
//   • MODELO de BID (biblioteca do QuotaFlow: tenant_id NULL → a empresa importa uma cópia e adapta):
//       seções de texto (antes/depois da precificação), COLUNAS do item, CONDIÇÕES comerciais (com N/A).
//       O 1º modelo é "Transporte de equipamentos"; modelos futuros (locação, serviços) mudam só colunas e textos.
//   • BID-AAAA-NNNN: cliente (cadastro Clientes 14b.3.1), itens agrupados por grupo/trecho — valor por item,
//     subtotal por grupo (digitado ou soma dos itens) e total (digitado ou soma dos grupos) —, condições, validade.
//   • VERSÕES v1, v2… congeladas com "o que mudou" e hash. Marcar como Enviado fecha a versão se houve mudança.
//   • FUNIL (kanban) — 15b: QUEM FAZ O BID ANDAR É O CLIENTE (services/bidsCliente.js). O comercial só marca Perdido.
//       elaboração → aguardando o cliente → revisão solicitada (vez do comercial) → aguardando aceite → aceito | perdido
//     Depois do envio, nada muda em silêncio: só "Criar revisão" (em_revisao) → nova versão → o cliente é avisado.
//   • ATIVIDADES (linha do tempo do CRM): ligação, e-mail, reunião, nota, tarefa com data; eventos automáticos.
// Regras do backend: sem DB.raw; ids com String(); filtros sem null; o mock não aplica default do banco.

const crypto = require('crypto');

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const idOk = (v) => /^\d+$/.test(String(v ?? ''));
const hojeBR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const somaDias = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const num = (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const t = String(v).trim().replace(/^R\$\s*/, ''); // "73.500" (milhar) = 73500; "25,5" = 25.5; "2.000,00" = 2000
  const n = Number(t.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : NaN;
};
const brl = (v) => (v == null ? null : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' '));
const novoId = () => crypto.randomBytes(5).toString('hex');

const FASES = ['elaboracao', 'aguardando_cliente', 'revisao_solicitada', 'aguardando_aceite', 'aceito', 'perdido'];
const FASE_NOME = { elaboracao: 'Elaboração', aguardando_cliente: 'Aguardando o cliente', revisao_solicitada: 'Revisão solicitada', aguardando_aceite: 'Aguardando aceite', aceito: 'Aceito', perdido: 'Perdido' };
const ABERTAS = ['elaboracao', 'aguardando_cliente', 'revisao_solicitada', 'aguardando_aceite'];
const COM_CLIENTE = ['aguardando_cliente', 'aguardando_aceite']; // a bola está com o cliente
const MOTIVOS_PERDA = { preco: 'Preço', prazo: 'Prazo', veiculo: 'Tipo de veículo / disponibilidade', concorrente: 'Fechou com concorrente', desistiu: 'Cliente desistiu do serviço', recusado_cliente: 'Recusado pelo cliente (no link)', outro: 'Outro motivo' };
/** 15b: dá para editar o documento? elaboração e revisão solicitada; com o cliente, só depois de "Criar revisão" */
const podeEditar = (b) => ['elaboracao', 'revisao_solicitada'].includes(b.fase) || (b.em_revisao === true && COM_CLIENTE.includes(b.fase));
const TIPOS_ATIV = { ligacao: '📞 Ligação', email: '✉ E-mail', whatsapp: '💬 WhatsApp', reuniao: '🤝 Reunião', nota: '📝 Nota', tarefa: '⏰ Tarefa', evento: '•' };
const TIPOS_COLUNA = ['texto', 'numero', 'sim_nao', 'data'];
const TIPOS_CONDICAO = ['texto', 'moeda', 'numero'];
const OPCOES_FISCAIS = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI'];
/** 16a: o que o aceite gera — só transporte nesta etapa; os outros já ficam marcados no modelo */
const TIPOS_EXECUCAO = { transporte: 'Transporte → AT por trecho', locacao: 'Locação → contrato de locação (em breve)', servico: 'Serviço / manutenção → AS (em breve)', venda: 'Venda de peça/produto → entrega (em breve)' };
/** Campos automáticos que os textos das seções podem usar */
const CAMPOS = [['empresa.razao_social', 'Sua razão social'], ['empresa.nome', 'Seu nome fantasia'], ['cliente.nome', 'Nome do cliente'], ['cliente.razao_social', 'Razão social do cliente'],
  ['bid.numero', 'Nº do BID'], ['bid.referencia', 'Referência do cliente'], ['bid.validade', 'Validade (dias)']];
const NOMES_CAMPOS = new Set(CAMPOS.map((c) => c[0]));

// ─── modelos ────────────────────────────────────────────────────────────────
function chaveDe(v) { return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40); }
function validarModelo(body = {}, parcial = false) {
  const out = {}; const tem = (k) => body[k] !== undefined;
  if (!parcial || tem('nome')) { const n = texto(body.nome, 120); if (!n) return { erro: 'Informe o nome do modelo' }; out.nome = n; }
  if (tem('descricao')) out.descricao = texto(body.descricao, 500);
  if (tem('titulo_documento')) out.titulo_documento = texto(body.titulo_documento, 160);
  if (tem('rotulo_grupo')) out.rotulo_grupo = texto(body.rotulo_grupo, 40) || 'Grupo';
  if (tem('tipo_execucao')) { if (!TIPOS_EXECUCAO[body.tipo_execucao]) return { erro: 'Tipo de execução inválido' }; out.tipo_execucao = body.tipo_execucao; } // 16a
  if (tem('validade_dias')) { const n = num(body.validade_dias); if (!Number.isInteger(n) || n < 1 || n > 365) return { erro: 'Validade: de 1 a 365 dias' }; out.validade_dias = n; }
  if (!parcial || tem('secoes')) { const r = validarSecoes(body.secoes); if (r.erro) return r; out.secoes = r.secoes; }
  if (!parcial || tem('colunas')) {
    const l = Array.isArray(body.colunas) ? body.colunas : [];
    if (l.length > 16) return { erro: 'No máximo 16 colunas' };
    const vistas = new Set(); const cols = [];
    for (const c of l) {
      const rotulo = texto(c?.rotulo, 40); if (!rotulo) continue;
      let chave = chaveDe(c.chave || rotulo) || `c${cols.length + 1}`; while (vistas.has(chave)) chave += '_2';
      vistas.add(chave);
      cols.push({ chave, rotulo, tipo: TIPOS_COLUNA.includes(c.tipo) ? c.tipo : 'texto', ...(texto(c.unidade, 12) ? { unidade: texto(c.unidade, 12) } : {}) });
    }
    out.colunas = cols;
  }
  if (!parcial || tem('condicoes')) {
    const l = Array.isArray(body.condicoes) ? body.condicoes : [];
    if (l.length > 30) return { erro: 'No máximo 30 condições' };
    const vistas = new Set(); const conds = [];
    for (const c of l) {
      const rotulo = texto(c?.rotulo, 60); if (!rotulo) continue;
      let chave = chaveDe(c.chave || rotulo) || `k${conds.length + 1}`; while (vistas.has(chave)) chave += '_2';
      vistas.add(chave);
      conds.push({ chave, rotulo, tipo: TIPOS_CONDICAO.includes(c.tipo) ? c.tipo : 'texto', grupo: c.grupo === 'pagamento' ? 'pagamento' : 'comercial',
        ...(texto(c.unidade, 12) ? { unidade: texto(c.unidade, 12) } : {}), ...(texto(c.padrao, 300) ? { padrao: texto(c.padrao, 300) } : {}) });
    }
    out.condicoes = conds;
  }
  return { dados: out };
}
function validarSecoes(lista) {
  const l = Array.isArray(lista) ? lista : [];
  if (l.length > 20) return { erro: 'No máximo 20 seções' };
  const secoes = [];
  for (const s of l) {
    const titulo = texto(s?.titulo, 120); const t = String(s?.texto || '').replace(/\r\n/g, '\n').trim().slice(0, 8000);
    if (!titulo && !t) continue;
    if (!titulo) return { erro: 'Toda seção precisa de título' };
    const desconhecido = [...t.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).find((n) => !NOMES_CAMPOS.has(n));
    if (desconhecido) return { erro: `Campo desconhecido no texto: {{${desconhecido}}}` };
    secoes.push({ titulo, texto: t, posicao: s.posicao === 'depois' ? 'depois' : 'antes' });
  }
  return { secoes };
}
async function bibliotecaTodos(supabase) { return (await q(supabase.from('bid_modelos').select('*').is('tenant_id', null))).sort((a, b) => String(a.nome).localeCompare(String(b.nome))); }
async function modelosTenant(supabase, tenantId) {
  const l = (await q(supabase.from('bid_modelos').select('*').eq('tenant_id', tenantId))).filter((m) => m.ativo !== false);
  const bib = l.some((m) => m.origem_id != null) ? new Map((await bibliotecaTodos(supabase)).map((m) => [String(m.id), Number(m.versao || 1)])) : new Map();
  return l.map((m) => ({ ...m, versao_nova: m.origem_id != null && (bib.get(String(m.origem_id)) || 0) > Number(m.origem_versao || 0) })).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
}
async function bibliotecaParaTenant(supabase, tenantId) {
  const meus = await q(supabase.from('bid_modelos').select('*').eq('tenant_id', tenantId));
  const ja = new Set(meus.filter((m) => m.origem_id != null && m.ativo !== false).map((m) => String(m.origem_id)));
  return (await bibliotecaTodos(supabase)).filter((m) => m.ativo !== false).map((m) => ({ ...m, ja_importado: ja.has(String(m.id)) }));
}
const COPIAVEIS = ['nome', 'descricao', 'titulo_documento', 'secoes', 'colunas', 'condicoes', 'rotulo_grupo', 'validade_dias', 'tipo_execucao'];
const copiar = (m) => Object.fromEntries(COPIAVEIS.map((k) => [k, m[k] ?? null]));
async function importar(supabase, tenantId, bibId) {
  const m = idOk(bibId) ? (await q(supabase.from('bid_modelos').select('*').is('tenant_id', null).eq('id', bibId)))[0] : null;
  if (!m || m.ativo === false) return { status: 404, erro: 'Modelo não encontrado' };
  const { data, error } = await supabase.from('bid_modelos').insert([{ ...copiar(m), tenant_id: tenantId, origem_id: m.id, origem_versao: m.versao || 1, versao: 1, ativo: true }]).select();
  if (error) throw new Error(error.message);
  return { modelo: data[0] };
}
async function atualizarDaBiblioteca(supabase, tenantId, id) {
  const t = idOk(id) ? (await q(supabase.from('bid_modelos').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] : null;
  if (!t || t.origem_id == null) return { status: 404, erro: 'Modelo não veio da biblioteca' };
  const m = (await q(supabase.from('bid_modelos').select('*').is('tenant_id', null).eq('id', t.origem_id)))[0];
  if (!m) return { status: 404, erro: 'O modelo saiu da biblioteca' };
  const { data, error } = await supabase.from('bid_modelos').update({ ...copiar(m), origem_versao: m.versao || 1, atualizado_em: new Date().toISOString() }).eq('id', t.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { modelo: data[0] };
}
async function salvarModelo(supabase, tenantId, id, body = {}) {
  if (id && body.ativo === false && Object.keys(body).length === 1) {
    const { data, error } = await supabase.from('bid_modelos').update({ ativo: false, atualizado_em: new Date().toISOString() }).eq('id', id).eq('tenant_id', tenantId).select();
    if (error) throw new Error(error.message);
    return data?.length ? { ok: true } : { status: 404, erro: 'Modelo não encontrado' };
  }
  const v = validarModelo(body, !!id); if (v.erro) return { status: 400, erro: v.erro };
  if (id) {
    const { data, error } = await supabase.from('bid_modelos').update({ ...v.dados, atualizado_em: new Date().toISOString() }).eq('id', id).eq('tenant_id', tenantId).select();
    if (error) throw new Error(error.message);
    return data?.length ? { modelo: data[0] } : { status: 404, erro: 'Modelo não encontrado' };
  }
  const { data, error } = await supabase.from('bid_modelos').insert([{ titulo_documento: null, rotulo_grupo: 'Grupo', validade_dias: 10, ...v.dados, tenant_id: tenantId, versao: 1, ativo: true }]).select();
  if (error) throw new Error(error.message);
  return { modelo: data[0] };
}

// ─── itens, condições e totais ─────────────────────────────────────────────
/** grupos (do corpo) → grupos limpos, só com as colunas do BID */
function validarGrupos(grupos, colunas = []) {
  const l = Array.isArray(grupos) ? grupos : [];
  if (l.length > 60) throw new Error('No máximo 60 grupos');
  const chaves = new Map(colunas.map((c) => [c.chave, c]));
  return l.map((g, gi) => {
    const itens = Array.isArray(g?.itens) ? g.itens : [];
    if (itens.length > 200) throw new Error('No máximo 200 itens por grupo');
    const valorG = num(g?.valor); if (Number.isNaN(valorG) || (valorG != null && valorG < 0)) throw new Error(`Valor inválido no grupo ${gi + 1}`);
    return {
      id: texto(g?.id, 20) || novoId(), titulo: texto(g?.titulo, 160) || '', valor: valorG,
      coleta: texto(g?.coleta, 300) || '', entrega: texto(g?.entrega, 300) || '', // 16b: rota do trecho (vai para o pedido e a AT)
      itens: itens.map((it, ii) => {
        const valores = {};
        for (const [k, v] of Object.entries(it?.valores || {})) {
          const c = chaves.get(k); if (!c) continue;
          if (c.tipo === 'numero') { const n = num(v); if (Number.isNaN(n)) throw new Error(`${c.rotulo}: número inválido (grupo ${gi + 1}, item ${ii + 1})`); if (n != null) valores[k] = n; }
          else if (c.tipo === 'sim_nao') { if (['sim', 'nao', 'na'].includes(v)) valores[k] = v; }
          else if (c.tipo === 'data') { if (/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) valores[k] = v; }
          else { const t = texto(v, 200); if (t) valores[k] = t; }
        }
        const valor = num(it?.valor); if (Number.isNaN(valor) || (valor != null && valor < 0)) throw new Error(`Valor inválido (grupo ${gi + 1}, item ${ii + 1})`);
        const qtd = num(it?.quantidade); if (Number.isNaN(qtd) || (qtd != null && qtd <= 0)) throw new Error(`Quantidade inválida (grupo ${gi + 1}, item ${ii + 1})`);
        const nItem = Number(it?.n); // 16d: número do item no BID (fixo — o servidor numera os novos)
        return { id: texto(it?.id, 20) || novoId(), n: Number.isInteger(nItem) && nItem > 0 ? nItem : null, serie: texto(it?.serie, 80) || '', valores, quantidade: qtd ?? 1, valor };
      }),
    };
  });
}
/** 16d: número fixo de cada item no BID (1, 2, 3…). Mantém o que já tem; item novo (ou número repetido) ganha o próximo.
 *  seqMin = o maior número já usado neste BID (conteudo.item_seq) — item tirado não devolve o número. Sem número salvo
 *  (BID/pedido antigo) a numeração sai na ordem em que os itens aparecem. */
function numerarItens(grupos = [], seqMin = 0) {
  let max = Math.max(Number(seqMin) || 0, ...grupos.flatMap((g) => (g.itens || []).map((i) => (Number.isInteger(i.n) && i.n > 0 ? i.n : 0))));
  const usados = new Set();
  const gs = grupos.map((g) => ({ ...g, itens: (g.itens || []).map((i) => {
    let n = Number.isInteger(i.n) && i.n > 0 && !usados.has(i.n) ? i.n : null;
    if (n == null) n = ++max; usados.add(n); return { ...i, n };
  }) }));
  return { grupos: gs, seq: max };
}
/** total do item = valor × quantidade; subtotal do grupo = digitado ou soma dos itens; total = digitado ou soma dos grupos */
function totais(grupos = [], valorTotalManual = null) {
  const gs = grupos.map((g) => {
    const comValor = g.itens.filter((i) => i.valor != null); // 15a.1: item sem valor não zera o subtotal
    const somaItens = comValor.length ? comValor.reduce((s, i) => s + Number(i.valor) * Number(i.quantidade || 1), 0) : null;
    return { ...g, subtotal: g.valor != null ? Number(g.valor) : somaItens };
  });
  const soma = gs.length && gs.every((g) => g.subtotal != null) ? gs.reduce((s, g) => s + g.subtotal, 0) : null;
  return { grupos: gs, total: valorTotalManual != null ? Number(valorTotalManual) : soma, soma_grupos: soma };
}
function validarCondicoes(c = {}, defs = []) {
  const out = {}; const chaves = new Map(defs.map((d) => [d.chave, d]));
  const na = Array.isArray(c.na) ? c.na.filter((k) => chaves.has(k)) : [];
  for (const [k, d] of chaves) {
    if (na.includes(k) || c[k] === undefined) continue;
    if (d.tipo === 'texto') { out[k] = texto(c[k], 600); continue; }
    const n = num(c[k]); if (Number.isNaN(n) || (n != null && n < 0)) throw new Error(`Valor inválido: ${d.rotulo}`);
    out[k] = n;
  }
  out.na = na;
  return out;
}

// ─── BID ────────────────────────────────────────────────────────────────────
async function bidDoTenant(supabase, tenantId, id) { return idOk(id) ? (await q(supabase.from('bids').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null : null; }
async function proximoNumero(supabase, tenantId) {
  const ano = hojeBR().slice(0, 4); const pre = `BID-${ano}-`;
  const nums = (await q(supabase.from('bids').select('numero').eq('tenant_id', tenantId))).map((b) => String(b.numero || '')).filter((n) => n.startsWith(pre)).map((n) => Number(n.slice(pre.length)) || 0);
  return `${pre}${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
}
async function atividade(supabase, tenantId, quem, dados) {
  const { error } = await supabase.from('bid_atividades').insert([{ tenant_id: tenantId, bid_id: dados.bid_id ?? null, cliente_id: dados.cliente_id ?? null, tipo: dados.tipo, texto: dados.texto,
    prevista_para: dados.prevista_para || null, concluida_em: null, usuario_id: quem?.usuarioId ?? null, usuario_nome: quem?.usuarioNome || null, criado_em: new Date().toISOString() }]);
  if (error) console.error('⚠️ [bids] atividade não gravada:', error.message);
}
async function responsaveis(supabase, tenantId) {
  const us = (await q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId))).filter((u) => u.ativo !== false);
  const ups = us.length ? await q(supabase.from('usuario_perfis').select('*').in('usuario_id', us.map((u) => u.id))).catch(() => []) : [];
  const perfis = (u) => new Set([u.perfil, ...ups.filter((p) => String(p.usuario_id) === String(u.id)).map((p) => p.perfil_codigo)]);
  return us.filter((u) => [...perfis(u)].some((p) => ['admin', 'gestor', 'comercial'].includes(p))).map((u) => ({ id: u.id, nome: u.nome || u.email })).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

async function criar(supabase, tenantId, quem, body = {}) {
  if (!idOk(body.cliente_id)) return { status: 400, erro: 'Escolha o cliente' };
  const cli = (await q(supabase.from('clientes').select('*').eq('tenant_id', tenantId).eq('id', body.cliente_id)))[0];
  if (!cli) return { status: 400, erro: 'Cliente não encontrado' };
  if (!idOk(body.modelo_id)) return { status: 400, erro: 'Escolha o modelo de BID' };
  const m = (await q(supabase.from('bid_modelos').select('*').eq('tenant_id', tenantId).eq('id', body.modelo_id)))[0];
  if (!m || m.ativo === false) return { status: 400, erro: 'Modelo não encontrado — importe um da biblioteca em 🧩 Modelos' };
  let resp = { id: quem.usuarioId ?? null, nome: quem.usuarioNome || null };
  if (body.responsavel_id && String(body.responsavel_id) !== String(quem.usuarioId)) {
    const r = (await responsaveis(supabase, tenantId)).find((u) => String(u.id) === String(body.responsavel_id));
    if (!r) return { status: 400, erro: 'Responsável precisa ser admin, gestor ou comercial ativo' };
    resp = r;
  }
  const condicoes = { na: [] }; for (const d of m.condicoes || []) if (d.padrao) condicoes[d.chave] = d.padrao;
  // assinatura: a da última proposta deste responsável (cargo, registro, telefones) — senão só o nome
  const anteriores = (await q(supabase.from('bids').select('*').eq('tenant_id', tenantId))).filter((b) => resp.id != null && String(b.responsavel_id) === String(resp.id)).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
  const assinante = anteriores[0]?.assinante?.nome ? anteriores[0].assinante : { nome: resp.nome || '', cargo: '', registro: '', telefones: '' };
  const agora = new Date().toISOString();
  const reg = {
    tenant_id: tenantId, numero: await proximoNumero(supabase, tenantId), titulo: texto(body.titulo, 160), referencia: texto(body.referencia, 60),
    cliente_id: cli.id, cliente_nome: cli.nome, contato_nome: texto(body.contato_nome, 120) ?? cli.contato_nome ?? null, contato_email: texto(body.contato_email, 160) ?? cli.contato_email ?? null,
    contato_telefone: texto(body.contato_telefone, 30) ?? cli.contato_telefone ?? null,
    modelo_id: m.id, modelo_nome: m.nome,
    conteudo: { titulo_documento: m.titulo_documento || null, rotulo_grupo: m.rotulo_grupo || 'Grupo', secoes: m.secoes || [], colunas: m.colunas || [], condicoes: m.condicoes || [] },
    grupos: [{ id: novoId(), titulo: '', valor: null, itens: [{ id: novoId(), valores: {}, quantidade: 1, valor: null }] }], condicoes,
    valor_total_manual: null, valor_total: null, validade_dias: m.validade_dias || 10, valido_ate: null,
    previsao_fechamento: /^\d{4}-\d{2}-\d{2}$/.test(String(body.previsao_fechamento || '')) ? body.previsao_fechamento : null,
    assinante, responsavel_id: resp.id, responsavel_nome: resp.nome, fase: 'elaboracao', fase_desde: agora, versao_atual: 0, alterado_desde_versao: true,
    criado_por_nome: quem.usuarioNome || null, criado_em: agora, atualizado_em: agora,
  };
  if (/^\d+$/.test(String(body.evento_id ?? ''))) reg.evento_id = Number(body.evento_id); // 18b: BID nascido da campanha do evento
  const { data, error } = await supabase.from('bids').insert([reg]).select();
  if (error) throw new Error(error.message);
  await atividade(supabase, tenantId, quem, { bid_id: data[0].id, cliente_id: cli.id, tipo: 'evento', texto: `BID ${reg.numero} criado (modelo ${m.nome})` });
  return { bid: data[0] };
}

const FECHADAS = ['aceito', 'perdido'];
async function editar(supabase, tenantId, quem, id, body = {}) {
  const b = await bidDoTenant(supabase, tenantId, id); if (!b) return { status: 404, erro: 'BID não encontrado' };
  const tem = (k) => body[k] !== undefined;
  // só o responsável e a previsão mudam a qualquer momento (não mexem no documento)
  const soInterno = Object.keys(body).every((k) => ['responsavel_id', 'previsao_fechamento'].includes(k));
  if (FECHADAS.includes(b.fase) && !soInterno) return { status: 409, erro: `BID ${FASE_NOME[b.fase].toLowerCase()} — reabra para editar` };
  if (!podeEditar(b) && !soInterno) return { status: 409, erro: 'O BID está com o cliente — use ✏ Criar revisão para preparar uma nova versão' };
  const upd = {};
  for (const [k, n] of [['titulo', 160], ['referencia', 60], ['contato_nome', 120], ['contato_email', 160], ['contato_telefone', 30]]) if (tem(k)) upd[k] = texto(body[k], n);
  if (upd.contato_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(upd.contato_email)) return { status: 400, erro: 'E-mail do contato inválido' };
  const conteudo = { ...(b.conteudo || {}) };
  if (tem('secoes')) { const r = validarSecoes(body.secoes); if (r.erro) return { status: 400, erro: r.erro }; conteudo.secoes = r.secoes; upd.conteudo = conteudo; }
  try {
    if (tem('grupos')) { const r = numerarItens(validarGrupos(body.grupos, conteudo.colunas || []), b.conteudo?.item_seq || 0); upd.grupos = r.grupos; conteudo.item_seq = r.seq; upd.conteudo = conteudo; }
    if (tem('condicoes')) upd.condicoes = validarCondicoes(body.condicoes, conteudo.condicoes || []);
  } catch (e) { return { status: 400, erro: e.message }; }
  if (tem('valor_total_manual')) { const n = num(body.valor_total_manual); if (Number.isNaN(n) || (n != null && n < 0)) return { status: 400, erro: 'Valor total inválido' }; upd.valor_total_manual = n; }
  if (tem('validade_dias')) { const n = num(body.validade_dias); if (!Number.isInteger(n) || n < 1 || n > 365) return { status: 400, erro: 'Validade: de 1 a 365 dias' }; upd.validade_dias = n; }
  if (tem('previsao_fechamento')) upd.previsao_fechamento = /^\d{4}-\d{2}-\d{2}$/.test(String(body.previsao_fechamento || '')) ? body.previsao_fechamento : null;
  if (tem('assinante')) { const a = body.assinante || {}; upd.assinante = { nome: texto(a.nome, 120) || '', cargo: texto(a.cargo, 120) || '', registro: texto(a.registro, 80) || '', telefones: texto(a.telefones, 120) || '' }; }
  if (tem('responsavel_id')) {
    const r = (await responsaveis(supabase, tenantId)).find((u) => String(u.id) === String(body.responsavel_id));
    if (!r) return { status: 400, erro: 'Responsável precisa ser admin, gestor ou comercial ativo' };
    if (String(r.id) !== String(b.responsavel_id)) { upd.responsavel_id = r.id; upd.responsavel_nome = r.nome; }
  }
  if (!Object.keys(upd).length) return { bid: b };
  const t = totais(upd.grupos || b.grupos || [], upd.valor_total_manual !== undefined ? upd.valor_total_manual : b.valor_total_manual);
  upd.valor_total = t.total;
  // mudar só o responsável não "suja" a versão (não muda o documento)
  if (Object.keys(upd).some((k) => !['responsavel_id', 'responsavel_nome', 'previsao_fechamento', 'valor_total'].includes(k))) upd.alterado_desde_versao = true;
  upd.atualizado_em = new Date().toISOString();
  const { data, error } = await supabase.from('bids').update(upd).eq('id', b.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  if (upd.responsavel_nome) await atividade(supabase, tenantId, quem, { bid_id: b.id, cliente_id: b.cliente_id, tipo: 'evento', texto: `Responsável: ${b.responsavel_nome || '—'} → ${upd.responsavel_nome}` });
  return { bid: data[0] };
}

/** retrato do documento (o que vai no PDF) */
const retrato = (b) => ({ titulo: b.titulo || null, referencia: b.referencia || null, cliente_nome: b.cliente_nome, contato_nome: b.contato_nome || null, conteudo: b.conteudo || {},
  grupos: b.grupos || [], condicoes: b.condicoes || {}, valor_total_manual: b.valor_total_manual ?? null, valor_total: b.valor_total ?? null, validade_dias: b.validade_dias, assinante: b.assinante || {} });
/** "o que mudou" entre dois retratos — frases curtas para a linha do tempo da versão */
function diferencas(a, b) {
  if (!a) return ['Primeira versão'];
  const out = []; const rot = b.conteudo?.rotulo_grupo || 'Grupo';
  const colNome = new Map((b.conteudo?.colunas || []).map((c) => [c.chave, c.rotulo]));
  const ga = new Map((a.grupos || []).map((g) => [g.id, g])); const gb = new Map((b.grupos || []).map((g) => [g.id, g]));
  const nomeG = (g, i) => g.titulo || `${rot} ${i + 1}`;
  (b.grupos || []).forEach((g, i) => {
    const o = ga.get(g.id);
    if (!o) { out.push(`${rot} incluído: ${nomeG(g, i)} (${g.itens.length} item(ns))`); return; }
    if ((o.titulo || '') !== (g.titulo || '')) out.push(`${rot} renomeado: ${o.titulo || '—'} → ${g.titulo || '—'}`);
    if ((o.coleta || '') !== (g.coleta || '')) out.push(`${nomeG(g, i)} — coleta: ${o.coleta || '—'} → ${g.coleta || '—'}`);
    if ((o.entrega || '') !== (g.entrega || '')) out.push(`${nomeG(g, i)} — entrega: ${o.entrega || '—'} → ${g.entrega || '—'}`);
    if (o.valor !== g.valor) out.push(`${nomeG(g, i)} — subtotal ${brl(o.valor) || 'pela soma'} → ${brl(g.valor) || 'pela soma'}`);
    const ia = new Map(o.itens.map((x) => [x.id, x]));
    g.itens.forEach((it, k) => {
      const ant = ia.get(it.id); const nomeI = it.valores?.modelo || it.valores?.veiculo || `item ${k + 1}`;
      if (!ant) { out.push(`${nomeG(g, i)} — item incluído: ${nomeI}`); return; }
      if (ant.valor !== it.valor) out.push(`${nomeG(g, i)} — ${nomeI}: valor ${brl(ant.valor) || '—'} → ${brl(it.valor) || '—'}`);
      if ((ant.serie || '') !== (it.serie || '')) out.push(`${nomeG(g, i)} — ${nomeI}: nº de série ${ant.serie || '—'} → ${it.serie || '—'}`);
      if (Number(ant.quantidade || 1) !== Number(it.quantidade || 1)) out.push(`${nomeG(g, i)} — ${nomeI}: quantidade ${ant.quantidade || 1} → ${it.quantidade || 1}`);
      for (const k2 of new Set([...Object.keys(ant.valores || {}), ...Object.keys(it.valores || {})])) {
        if (String(ant.valores?.[k2] ?? '') !== String(it.valores?.[k2] ?? '')) out.push(`${nomeG(g, i)} — ${nomeI}: ${colNome.get(k2) || k2} ${ant.valores?.[k2] ?? '—'} → ${it.valores?.[k2] ?? '—'}`);
      }
    });
    for (const x of o.itens) if (!g.itens.some((y) => y.id === x.id)) out.push(`${nomeG(g, i)} — item retirado: ${x.valores?.modelo || x.valores?.veiculo || 'item'}`);
  });
  (a.grupos || []).forEach((g, i) => { if (!gb.has(g.id)) out.push(`${rot} retirado: ${nomeG(g, i)}`); });
  if (a.valor_total !== b.valor_total) out.push(`Valor total: ${brl(a.valor_total) || '—'} → ${brl(b.valor_total) || '—'}`);
  const condNome = new Map((b.conteudo?.condicoes || []).map((c) => [c.chave, c.rotulo]));
  for (const k of new Set([...Object.keys(a.condicoes || {}), ...Object.keys(b.condicoes || {})])) {
    if (k === 'na') continue;
    if (String(a.condicoes?.[k] ?? '') !== String(b.condicoes?.[k] ?? '')) out.push(`${condNome.get(k) || k}: ${a.condicoes?.[k] ?? '—'} → ${b.condicoes?.[k] ?? '—'}`);
  }
  const naA = new Set(a.condicoes?.na || []); const naB = new Set(b.condicoes?.na || []);
  for (const k of naB) if (!naA.has(k)) out.push(`${condNome.get(k) || k}: não se aplica`);
  if (a.validade_dias !== b.validade_dias) out.push(`Validade: ${a.validade_dias} → ${b.validade_dias} dias`);
  if (JSON.stringify(a.conteudo?.secoes || []) !== JSON.stringify(b.conteudo?.secoes || [])) out.push('Textos das seções alterados');
  if (!out.length) out.push('Sem mudanças no documento');
  return out.slice(0, 60);
}
async function fecharVersao(supabase, tenantId, quem, id, { nota } = {}, b0 = null) {
  const b = b0 || await bidDoTenant(supabase, tenantId, id); if (!b) return { status: 404, erro: 'BID não encontrado' };
  if (b.versao_atual > 0 && !b.alterado_desde_versao) return { status: 409, erro: `Nada mudou desde a v${b.versao_atual}` };
  const vers = await q(supabase.from('bid_versoes').select('*').eq('tenant_id', tenantId).eq('bid_id', b.id));
  const ult = vers.sort((x, y) => y.versao - x.versao)[0];
  const snap = retrato(b); const v = (b.versao_atual || 0) + 1; const agora = new Date().toISOString();
  const mudancas = diferencas(ult?.snapshot || null, snap);
  const hash = crypto.createHash('sha256').update(JSON.stringify({ t: String(tenantId), n: b.numero, v, snap, em: agora })).digest('hex');
  const { error } = await supabase.from('bid_versoes').insert([{ tenant_id: tenantId, bid_id: b.id, versao: v, snapshot: snap, valor_total: snap.valor_total, mudancas, nota: texto(nota, 500), hash, criado_por_nome: quem.usuarioNome || null, criado_em: agora }]);
  if (error) throw new Error(error.message);
  const { error: e2 } = await supabase.from('bids').update({ versao_atual: v, alterado_desde_versao: false, atualizado_em: agora }).eq('id', b.id).eq('tenant_id', tenantId);
  if (e2) throw new Error(e2.message);
  await atividade(supabase, tenantId, quem, { bid_id: b.id, cliente_id: b.cliente_id, tipo: 'evento', texto: `Versão v${v} fechada${nota ? ` — ${texto(nota, 200)}` : ''}${v > 1 ? ` · ${mudancas.length} mudança(s)` : ''}` });
  return { ok: true, versao: v, mudancas, hash };
}

/** 15b: a fase muda sozinha pelo cliente. À mão, só: ✕ Perdido (com motivo, de qualquer fase aberta) e ↺ Reabrir um perdido. */
async function mudarFase(supabase, tenantId, quem, id, { fase, motivo, obs } = {}) {
  const b = await bidDoTenant(supabase, tenantId, id); if (!b) return { status: 404, erro: 'BID não encontrado' };
  const agora = new Date().toISOString();
  if (fase === 'reabrir') {
    if (b.fase !== 'perdido') return { status: 409, erro: 'Só um BID perdido pode ser reaberto' };
    const volta = b.versao_enviada > 0 ? 'revisao_solicitada' : 'elaboracao';
    const { data, error } = await supabase.from('bids').update({ fase: volta, fase_desde: agora, perdido_em: null, motivo_perda: null, perda_obs: null, em_revisao: false, atualizado_em: agora }).eq('id', b.id).eq('tenant_id', tenantId).select();
    if (error) throw new Error(error.message);
    await atividade(supabase, tenantId, quem, { bid_id: b.id, cliente_id: b.cliente_id, tipo: 'evento', texto: `↺ Reaberto → ${FASE_NOME[volta]}` });
    return { bid: data[0] };
  }
  if (fase !== 'perdido') return { status: 409, erro: 'A fase muda sozinha, pelo que o cliente faz no link. À mão, só ✕ Perdido.' };
  if (!ABERTAS.includes(b.fase)) return { status: 409, erro: `BID já ${FASE_NOME[b.fase].toLowerCase()}` };
  if (!MOTIVOS_PERDA[motivo] || motivo === 'recusado_cliente') return { status: 400, erro: 'Escolha o motivo da perda' };
  if (motivo === 'outro' && !texto(obs, 300)) return { status: 400, erro: 'Descreva o motivo' };
  const { data, error } = await supabase.from('bids').update({ fase: 'perdido', fase_desde: agora, motivo_perda: motivo, perda_obs: texto(obs, 300), perdido_em: agora, ganho_em: null, em_revisao: false, codigo_hash: null, atualizado_em: agora }).eq('id', b.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  await atividade(supabase, tenantId, quem, { bid_id: b.id, cliente_id: b.cliente_id, tipo: 'evento', texto: `${FASE_NOME[b.fase]} → Perdido (${MOTIVOS_PERDA[motivo]}${texto(obs, 300) ? `: ${texto(obs, 300)}` : ''})` });
  return { bid: data[0] };
}

const diasEntre = (a, b = new Date()) => Math.max(0, Math.floor((new Date(b) - new Date(a)) / 86400000));
const linkCliente = (token) => `${String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/^FRONTEND_URL=/, '').replace(/\/+$/, '')}/#bid?t=${token}`;
const horas = (a, b) => (a && b ? (new Date(b) - new Date(a)) / 3600000 : null);
/** 15b: alertas do comercial (calculados na hora — sem rotina): sem abrir, aberto sem resposta, aceite pendente, validade */
function alertas(b, hoje = hojeBR()) {
  const l = []; if (!ABERTAS.includes(b.fase)) return l;
  // 15b.4: decisão esperada (previsao_fechamento) já passou e o BID segue aberto
  if (b.previsao_fechamento && b.previsao_fechamento < hoje) l.push({ tipo: 'decisao_passou', texto: `Decisão esperada em ${b.previsao_fechamento.split('-').reverse().join('/')} — já passou`, tarefa: 'Ligar: o cliente já decidiu? Atualizar a data esperada' });
  if (!COM_CLIENTE.includes(b.fase) && b.fase !== 'revisao_solicitada') return l;
  const dEnv = b.enviado_em ? diasEntre(b.enviado_em) : 0;
  if (b.fase === 'aguardando_cliente' && !b.em_revisao) {
    if (!b.visto_primeiro_em && dEnv >= 2) l.push({ tipo: 'sem_abrir', texto: `Enviado há ${dEnv} dias e ainda não aberto`, tarefa: 'Ligar: o cliente ainda não viu a proposta' });
    else if (b.visto_primeiro_em && (Number(b.visto_qtd || 0) >= 3 || diasEntre(b.visto_primeiro_em) >= 2)) l.push({ tipo: 'sem_resposta', texto: `Aberto ${b.visto_qtd}× e sem resposta`, tarefa: 'Ligar: ficou alguma dúvida na proposta?' });
  }
  if (b.fase === 'aguardando_aceite' && diasEntre(b.fase_desde) >= 2) l.push({ tipo: 'aceite_pendente', texto: `Aprovado há ${diasEntre(b.fase_desde)} dias — falta assinar o aceite`, tarefa: 'Ligar: lembrar o cliente de assinar o aceite' });
  if (COM_CLIENTE.includes(b.fase) && b.valido_ate) {
    if (b.valido_ate < hoje) l.push({ tipo: 'vencido', texto: `Validade vencida em ${b.valido_ate.split('-').reverse().join('/')}`, tarefa: 'Ligar: renovar a proposta (validade vencida)' });
    else if (b.valido_ate <= somaDias(hoje, 2)) l.push({ tipo: 'vence', texto: `Validade vence em ${b.valido_ate.split('-').reverse().join('/')}`, tarefa: 'Ligar: a proposta vence em breve' });
  }
  return l;
}
function enfeitar(b, pendentes = []) {
  const hoje = hojeBR();
  const t = totais(b.grupos || [], b.valor_total_manual);
  const minhas = pendentes.filter((a) => String(a.bid_id) === String(b.id));
  return { ...b, token: undefined, codigo_hash: undefined, fase_nome: FASE_NOME[b.fase], dias_na_fase: diasEntre(b.fase_desde || b.criado_em),
    expirado: COM_CLIENTE.includes(b.fase) && !!b.valido_ate && b.valido_ate < hoje,
    bola: COM_CLIENTE.includes(b.fase) && !b.em_revisao ? 'cliente' : ABERTAS.includes(b.fase) ? 'voce' : null, pode_editar: podeEditar(b), alertas: alertas(b, hoje),
    qtd_itens: (b.grupos || []).reduce((s, g) => s + (g.itens || []).length, 0), qtd_grupos: (b.grupos || []).length, soma_grupos: t.soma_grupos,
    proxima_tarefa: minhas.sort((x, y) => String(x.prevista_para || '9').localeCompare(String(y.prevista_para || '9')))[0] || null };
}
async function listar(supabase, tenantId) {
  // 15c: aditivos (PV-…-A1) ficam no pedido, fora do kanban/lista de BIDs
  const [bs, pend] = await Promise.all([q(supabase.from('bids').select('*').eq('tenant_id', tenantId)), q(supabase.from('bid_atividades').select('*').eq('tenant_id', tenantId).eq('tipo', 'tarefa').is('concluida_em', null))]);
  return bs.filter((b) => b.tipo !== 'aditivo').map((b) => enfeitar(b, pend)).sort((a, b) => String(b.atualizado_em || b.criado_em).localeCompare(String(a.atualizado_em || a.criado_em)));
}
async function detalhe(supabase, tenantId, id) {
  const b = await bidDoTenant(supabase, tenantId, id); if (!b) return { status: 404, erro: 'BID não encontrado' };
  const [vers, ativs] = await Promise.all([q(supabase.from('bid_versoes').select('*').eq('tenant_id', tenantId).eq('bid_id', b.id)), q(supabase.from('bid_atividades').select('*').eq('tenant_id', tenantId).eq('bid_id', b.id))]);
  const t = totais(b.grupos || [], b.valor_total_manual);
  return { bid: { ...enfeitar(b, ativs.filter((a) => a.tipo === 'tarefa' && !a.concluida_em)), grupos: t.grupos },
    versoes: vers.map(({ snapshot, ...v }) => v).sort((x, y) => y.versao - x.versao),
    // 15b: o que o cliente respondeu na última versão enviada (comentários por linha) e o link
    resposta: vers.find((v) => v.versao === b.versao_enviada)?.resposta || null,
    link: b.token ? linkCliente(b.token) : null,
    pv: b.pv_id ? (await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId).eq('id', b.pv_id)).catch(() => []))[0] || null : null, // 15c
    atividades: ativs.sort((x, y) => String(y.criado_em).localeCompare(String(x.criado_em))) };
}

// ─── atividades ─────────────────────────────────────────────────────────────
async function criarAtividade(supabase, tenantId, quem, body = {}) {
  const tipo = body.tipo; if (!TIPOS_ATIV[tipo] || tipo === 'evento') return { status: 400, erro: 'Tipo de atividade inválido' };
  const t = texto(body.texto, 2000); if (!t) return { status: 400, erro: 'Escreva a atividade' };
  let bidId = null; let clienteId = null;
  if (body.bid_id != null) { const b = await bidDoTenant(supabase, tenantId, body.bid_id); if (!b) return { status: 404, erro: 'BID não encontrado' }; bidId = b.id; clienteId = b.cliente_id; }
  else if (idOk(body.cliente_id)) { const c = (await q(supabase.from('clientes').select('*').eq('tenant_id', tenantId).eq('id', body.cliente_id)))[0]; if (!c) return { status: 404, erro: 'Cliente não encontrado' }; clienteId = c.id; }
  else return { status: 400, erro: 'Atividade sem BID nem cliente' };
  let prevista = null;
  if (tipo === 'tarefa') {
    const p = String(body.prevista_para || ''); if (!/^\d{4}-\d{2}-\d{2}/.test(p)) return { status: 400, erro: 'Informe a data da tarefa' };
    prevista = p.length === 10 ? new Date(`${p}T09:00:00-03:00`).toISOString() : new Date(p).toISOString();
  }
  // 15c.1: tarefa atribuída a um usuário (admin, gestor ou comercial ativo) — sem escolha, fica para quem criou
  let atrib = null;
  if (tipo === 'tarefa') {
    if (body.atribuido_id != null && body.atribuido_id !== '') {
      atrib = (await responsaveis(supabase, tenantId)).find((u) => String(u.id) === String(body.atribuido_id));
      if (!atrib) return { status: 400, erro: 'A tarefa só pode ir para um usuário comercial, gestor ou admin ativo' };
    } else if (quem.usuarioId != null) atrib = { id: quem.usuarioId, nome: quem.usuarioNome };
  }
  const reg = { tenant_id: tenantId, bid_id: bidId, cliente_id: clienteId, tipo, texto: t, prevista_para: prevista, concluida_em: null,
    usuario_id: quem.usuarioId ?? null, usuario_nome: quem.usuarioNome || null, criado_em: new Date().toISOString() };
  if (/^\d+$/.test(String(body.evento_id ?? ''))) reg.evento_id = Number(body.evento_id); // 18b: contato da campanha do evento
  if (atrib) Object.assign(reg, { atribuido_id: atrib.id, atribuido_nome: atrib.nome || null });
  const { data, error } = await supabase.from('bid_atividades').insert([reg]).select();
  if (error) { if (/atribuido/.test(error.message)) return { status: 409, erro: 'Rode a migration 054 antes (tarefa atribuída)' }; if (/evento_id|tipo_check/.test(error.message)) return { status: 409, erro: 'Rode a migration 060 antes (prospecção por evento)' }; throw new Error(error.message); }
  if (atrib && String(atrib.id) !== String(quem.usuarioId)) await avisarTarefa(supabase, tenantId, quem, atrib, reg, bidId);
  if (bidId) await supabase.from('bids').update({ atualizado_em: new Date().toISOString() }).eq('id', bidId).eq('tenant_id', tenantId);
  return { atividade: data[0] };
}
/** e-mail para quem recebeu a tarefa (não falha a criação) */
let enviarEmail = async (para, assunto, html) => require('./emailService').enviarEmailFornecedor(para, assunto, html);
function _definirEnvio(fn) { enviarEmail = fn; }
async function avisarTarefa(supabase, tenantId, quem, atrib, a, bidId) {
  try {
    const u = (await q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId).eq('id', atrib.id)))[0];
    if (!u?.email) return;
    const b = bidId ? await bidDoTenant(supabase, tenantId, bidId) : null;
    const esc = (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const data = a.prevista_para ? new Date(a.prevista_para).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '';
    await enviarEmail(u.email, `⏰ Nova tarefa para você${data ? ` até ${data}` : ''}: ${a.texto.slice(0, 80)}`,
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#111"><p><b>${esc(quem.usuarioNome || 'Um colega')}</b> criou uma tarefa para você${data ? `, para <b>${data}</b>` : ''}:</p><p style="background:#f4f4f5;padding:10px 12px;border-radius:6px">${esc(a.texto)}</p>${b ? `<p>BID: <b>${esc(b.numero)}</b> — ${esc(b.cliente_nome)}</p>` : ''}<p>Veja em 📈 Comercial → 📊 Funil → ⏰ Tarefas.</p></div>`);
  } catch (e) { console.error('⚠️ [tarefa] e-mail não enviado:', e?.message || e); }
}
async function concluirAtividade(supabase, tenantId, id, feita = true) {
  const a = idOk(id) ? (await q(supabase.from('bid_atividades').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] : null;
  if (!a || a.tipo !== 'tarefa') return { status: 404, erro: 'Tarefa não encontrada' };
  const { error } = await supabase.from('bid_atividades').update({ concluida_em: feita ? new Date().toISOString() : null }).eq('id', a.id).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  return { ok: true };
}
/** tarefas abertas (todas ou de um usuário), atrasadas primeiro */
async function tarefas(supabase, tenantId, usuarioId = null) {
  const [l, bs] = await Promise.all([q(supabase.from('bid_atividades').select('*').eq('tenant_id', tenantId).eq('tipo', 'tarefa').is('concluida_em', null)), q(supabase.from('bids').select('*').eq('tenant_id', tenantId))]);
  const porId = new Map(bs.map((b) => [String(b.id), b]));
  const agora = new Date().toISOString();
  // 15c.1: "minhas" = atribuídas a mim; tarefa antiga (sem atribuição) segue a regra de antes (criei ou sou o responsável do BID)
  return l.filter((a) => !usuarioId || (a.atribuido_id != null ? String(a.atribuido_id) === String(usuarioId) : String(a.usuario_id) === String(usuarioId) || String(porId.get(String(a.bid_id))?.responsavel_id) === String(usuarioId)))
    .map((a) => { const b = porId.get(String(a.bid_id)); return { ...a, atrasada: !!a.prevista_para && a.prevista_para < agora, bid_numero: b?.numero || null, cliente_nome: b?.cliente_nome || null }; })
    .sort((x, y) => String(x.prevista_para || '9').localeCompare(String(y.prevista_para || '9')));
}

// ─── funil e cliente 360° ───────────────────────────────────────────────────
async function funil(supabase, tenantId, { de, ate } = {}) {
  const ateD = /^\d{4}-\d{2}-\d{2}$/.test(String(ate || '')) ? ate : hojeBR();
  const deD = /^\d{4}-\d{2}-\d{2}$/.test(String(de || '')) ? de : somaDias(ateD, -89);
  const [bs0, vers] = await Promise.all([q(supabase.from('bids').select('*').eq('tenant_id', tenantId)), q(supabase.from('bid_versoes').select('*').eq('tenant_id', tenantId))]);
  const bs = bs0.filter((b) => b.tipo !== 'aditivo').map((b) => enfeitar(b)); // 15c: aditivo não conta no funil
  const diaBR = (iso) => new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10); // 15b.1: dia no horário de Brasília (depois das 21h já é amanhã em UTC)
  const noPeriodo = (iso) => !!iso && diaBR(iso) >= deD && diaBR(iso) <= ateD;
  const colunas = FASES.map((f) => { const l = bs.filter((b) => b.fase === f); return { fase: f, nome: FASE_NOME[f], qtd: l.length, valor: l.reduce((s, b) => s + Number(b.valor_total || 0), 0) }; });
  const abertos = bs.filter((b) => ABERTAS.includes(b.fase));
  const ganhos = bs.filter((b) => b.fase === 'aceito' && noPeriodo(b.ganho_em));
  const perdidos = bs.filter((b) => b.fase === 'perdido' && noPeriodo(b.perdido_em));
  const decididos = ganhos.length + perdidos.length;
  const motivos = Object.entries(MOTIVOS_PERDA).map(([k, nome]) => ({ motivo: k, nome, qtd: perdidos.filter((b) => b.motivo_perda === k).length, valor: perdidos.filter((b) => b.motivo_perda === k).reduce((s, b) => s + Number(b.valor_total || 0), 0) })).filter((m) => m.qtd);
  const valorGanho = ganhos.reduce((s, b) => s + Number(b.valor_total || 0), 0);
  return {
    periodo: { de: deD, ate: ateD }, colunas,
    kpis: {
      em_aberto: abertos.reduce((s, b) => s + Number(b.valor_total || 0), 0), qtd_aberto: abertos.length,
      ganhos: ganhos.length, valor_ganho: valorGanho, perdidos: perdidos.length,
      conversao_pct: decididos ? Math.round((ganhos.length / decididos) * 1000) / 10 : null,
      ticket_medio: ganhos.length ? valorGanho / ganhos.length : null,
      dias_ate_aceite: ganhos.length ? Math.round(ganhos.reduce((s, b) => s + diasEntre(b.criado_em, b.ganho_em), 0) / ganhos.length) : null,
      expirados: abertos.filter((b) => b.expirado).length, parados: abertos.filter((b) => COM_CLIENTE.includes(b.fase) && b.dias_na_fase > 7).length,
      ...visualizacao(vers.filter((v) => noPeriodo(v.enviada_em)), bs),
    },
    previsao: previsaoReceita(abertos),
    motivos,
  };
}
/** 15b.4: previsão de receita — BIDs abertos pela "decisão esperada" (este mês, próximo, atrasados, sem data) */
function previsaoReceita(abertos, hoje = hojeBR()) {
  const mes = hoje.slice(0, 7); const d = new Date(`${mes}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); const prox = d.toISOString().slice(0, 7);
  const soma = (l) => ({ qtd: l.length, valor: l.reduce((s, b) => s + Number(b.valor_total || 0), 0) });
  const p = (b) => b.previsao_fechamento || '';
  return { mes, proximo_mes: prox,
    este_mes: soma(abertos.filter((b) => p(b).startsWith(mes) && p(b) >= hoje)), proximo: soma(abertos.filter((b) => p(b).startsWith(prox))),
    atrasados: soma(abertos.filter((b) => p(b) && p(b) < hoje)), sem_data: soma(abertos.filter((b) => !p(b))) };
}
/** 15b: envio → visualização → resposta (versões enviadas no período) */
function visualizacao(enviadas, bs) {
  const media = (l) => (l.length ? Math.round((l.reduce((s, x) => s + x, 0) / l.length) * 10) / 10 : null);
  const vistas = enviadas.filter((v) => v.vista_em);
  return {
    enviadas: enviadas.length, abertas: vistas.length, taxa_abertura_pct: enviadas.length ? Math.round((vistas.length / enviadas.length) * 1000) / 10 : null,
    horas_ate_ver: media(vistas.map((v) => horas(v.enviada_em, v.vista_em))),
    horas_ate_responder: media(vistas.filter((v) => v.respondida_em).map((v) => horas(v.vista_em, v.respondida_em))),
    abertos_sem_resposta: bs.filter((b) => b.fase === 'aguardando_cliente' && !b.em_revisao && b.visto_primeiro_em).length,
    sem_abrir: bs.filter((b) => b.fase === 'aguardando_cliente' && !b.em_revisao && !b.visto_primeiro_em).length,
  };
}
async function cliente360(supabase, tenantId, clienteId) {
  const c = idOk(clienteId) ? (await q(supabase.from('clientes').select('*').eq('tenant_id', tenantId).eq('id', clienteId)))[0] : null;
  if (!c) return { status: 404, erro: 'Cliente não encontrado' };
  const [bs, ativs, contratos] = await Promise.all([
    q(supabase.from('bids').select('*').eq('tenant_id', tenantId).eq('cliente_id', c.id)),
    q(supabase.from('bid_atividades').select('*').eq('tenant_id', tenantId).eq('cliente_id', c.id)),
    q(supabase.from('locacao_contratos').select('*').eq('tenant_id', tenantId).eq('cliente_id', c.id)).catch(() => []),
  ]);
  const l = bs.filter((b) => b.tipo !== 'aditivo').map((b) => enfeitar(b));
  const ganhos = l.filter((b) => b.fase === 'aceito'); const perdidos = l.filter((b) => b.fase === 'perdido');
  return {
    cliente: c,
    resumo: { abertos: l.filter((b) => ABERTAS.includes(b.fase)).length, ganhos: ganhos.length, perdidos: perdidos.length, valor_ganho: ganhos.reduce((s, b) => s + Number(b.valor_total || 0), 0),
      em_aberto: l.filter((b) => ABERTAS.includes(b.fase)).reduce((s, b) => s + Number(b.valor_total || 0), 0), contratos_ativos: contratos.filter((k) => k.status === 'ativo').length },
    bids: l.sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em))),
    pedidos: await require('./pedidosVenda').doCliente(supabase, tenantId, c.id), // 15c
    contratos: contratos.map((k) => ({ id: k.id, numero: k.numero, status: k.status, local: k.local, inicio: k.inicio, fim_previsto: k.fim_previsto })).sort((a, b) => String(b.inicio || '').localeCompare(String(a.inicio || ''))),
    atividades: ativs.sort((x, y) => String(y.criado_em).localeCompare(String(x.criado_em))).slice(0, 100),
  };
}

// ─── documento (PDF) ────────────────────────────────────────────────────────
/** Dados para o PDF: o atual (rascunho) ou uma versão congelada. Textos com os campos automáticos preenchidos. */
async function documento(supabase, tenantId, id, versao = null) {
  const b = await bidDoTenant(supabase, tenantId, id); if (!b) return { status: 404, erro: 'BID não encontrado' };
  let snap = retrato(b); let v = null;
  if (versao != null && versao !== '') {
    const linha = (await q(supabase.from('bid_versoes').select('*').eq('tenant_id', tenantId).eq('bid_id', b.id))).find((x) => String(x.versao) === String(versao));
    if (!linha) return { status: 404, erro: 'Versão não encontrada' };
    snap = linha.snapshot; v = { versao: linha.versao, hash: linha.hash, em: linha.criado_em, por: linha.criado_por_nome };
  }
  const [emp, cli] = await Promise.all([q(supabase.from('tenants').select('*').eq('id', tenantId)).then((r) => r[0] || {}), b.cliente_id ? q(supabase.from('clientes').select('*').eq('tenant_id', tenantId).eq('id', b.cliente_id)).then((r) => r[0] || null) : null]);
  const vals = { 'empresa.razao_social': emp.razao_social || emp.nome, 'empresa.nome': emp.nome_fantasia || emp.nome, 'cliente.nome': cli?.nome || snap.cliente_nome, 'cliente.razao_social': cli?.razao_social || cli?.nome || snap.cliente_nome,
    'bid.numero': b.numero, 'bid.referencia': snap.referencia || '', 'bid.validade': String(snap.validade_dias || '') };
  const preencher = (t) => String(t || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => vals[k] ?? '');
  const t = totais(snap.grupos || [], snap.valor_total_manual);
  return {
    numero: b.numero, versao: v, rascunho: !v, fase: b.fase, valido_ate: b.valido_ate,
    empresa: { razao_social: emp.razao_social || emp.nome || '', nome_fantasia: emp.nome_fantasia || '', cnpj: emp.cnpj || '', inscricao_estadual: emp.inscricao_estadual || '', opcao_fiscal: emp.opcao_fiscal || '',
      endereco: emp.endereco || '', numero: emp.numero || '', complemento: emp.complemento || '', bairro: emp.bairro || '', cidade: emp.cidade || '', uf: emp.regiao || '', cep: emp.cep || '', telefone: emp.telefone || '', email: emp.email || '' },
    cliente: { nome: cli?.nome || snap.cliente_nome, razao_social: cli?.razao_social || null, documento: cli?.documento || null, contato: snap.contato_nome || null },
    ...snap, conteudo: { ...(snap.conteudo || {}), secoes: (snap.conteudo?.secoes || []).map((s) => ({ ...s, texto: preencher(s.texto) })) },
    grupos: t.grupos, total: t.total,
  };
}

module.exports = { numerarItens, TIPOS_EXECUCAO, _definirEnvio, brl, FASES, FASE_NOME, COM_CLIENTE, ABERTAS, podeEditar, bidDoTenant, atividade, retrato, linkCliente, hojeBR, somaDias, diasEntre, enfeitar, q, texto, FASES_ABERTAS: ABERTAS, MOTIVOS_PERDA, TIPOS_ATIV, CAMPOS, OPCOES_FISCAIS, validarModelo, validarGrupos, validarCondicoes, totais, diferencas,
  modelosTenant, bibliotecaParaTenant, importar, atualizarDaBiblioteca, salvarModelo, responsaveis,
  criar, editar, fecharVersao, mudarFase, listar, detalhe, criarAtividade, concluirAtividade, tarefas, funil, cliente360, documento, proximoNumero };
