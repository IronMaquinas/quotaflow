// backend/services/multas.js — etapa 12g
//
// Multas de trânsito — decidido com o Marcony (21/10/2026):
//   • cadastro do auto: veículo (equipamento da frota ou placa em texto), motorista responsável, data/hora, local, órgão,
//     infração (código CTB, descrição, gravidade → pontos sugeridos), valor, vencimento, notificação anexa;
//   • PRAZO DE INDICAÇÃO DO CONDUTOR (padrão: recebida + 15 dias) — o mais crítico;
//   • situação: recebida → condutor indicado → em recurso → FINAL separado: paga | descontada | cancelada;
//   • DESCONTADA: valor descontado (e parcelas). "Aceite do colaborador requerido" (desmarcado por padrão) — marcado,
//     o colaborador assina na tela o termo de desconto (PNG + hash) — vale para cálculo trabalhista/rescisão;
//   • quem monitora (usuário) → tarefa automática no ✅ Plano (tabela tarefas) com o próximo prazo; a tarefa acompanha
//     a situação e fecha quando a multa chega ao final;
//   • calendário (camada 🚦), e-mail diário do GESTOR (nunca do motorista), Ficha e dossiê.
// O motorista "de quem estava com o veículo" virá da futura tela de saída/viagem do veículo (ver readme).
// Regras do backend: sem DB.raw; ids com String(); filtros sem null.

const crypto = require('crypto');
const D = require('./documentos');

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const texto = (v, max) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const hojeBR = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600000).toISOString().slice(0, 10);
const somaDias = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diasAte = (de, ate) => Math.round((Date.parse(`${String(ate).slice(0, 10)}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000);
const num = (v) => { if (v === '' || v == null) return null; const t = String(v).trim(); return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); }; // "1.234,56" ou "1234.56"

const STATUS = ['recebida', 'condutor_indicado', 'em_recurso', 'paga', 'descontada', 'cancelada'];
const ABERTOS = ['recebida', 'condutor_indicado', 'em_recurso'];
const FINAIS = ['paga', 'descontada', 'cancelada'];
const STATUS_NOME = { recebida: 'Recebida', condutor_indicado: 'Condutor indicado', em_recurso: 'Em recurso', paga: 'Paga', descontada: 'Descontada do colaborador', cancelada: 'Cancelada' };
// CTB art. 258/259 — valores-base vigentes desde 11/2016 (fatores multiplicadores à parte); só SUGESTÃO no formulário
const GRAVIDADES = [
  { codigo: 'leve', nome: 'Leve', pontos: 3, valor: 88.38 },
  { codigo: 'media', nome: 'Média', pontos: 4, valor: 130.16 },
  { codigo: 'grave', nome: 'Grave', pontos: 5, valor: 195.23 },
  { codigo: 'gravissima', nome: 'Gravíssima', pontos: 7, valor: 293.47 },
];
const PRAZO_INDICACAO_DIAS = 15;

function validar(body, { parcial = false } = {}) {
  const erros = [], out = {};
  const tem = (k) => body[k] !== undefined;
  const data = (k, nome, obrig) => {
    if (!tem(k) && parcial) return;
    const v = body[k];
    if (!v) { if (obrig) erros.push(`Informe ${nome}`); else out[k] = null; return; }
    if (!DATA.test(String(v))) erros.push(`${nome[0].toUpperCase()}${nome.slice(1)} inválida`); else out[k] = v;
  };
  data('data_infracao', 'a data da infração', !parcial);
  data('recebida_em', 'a data de recebimento', !parcial);
  data('prazo_indicacao', 'o prazo de indicação', false);
  data('vencimento', 'o vencimento', false);
  if (tem('hora_infracao')) { const h = texto(body.hora_infracao, 5); if (h && !/^\d{2}:\d{2}$/.test(h)) erros.push('Hora no formato 00:00'); else out.hora_infracao = h; }
  for (const [k, max] of [['local', 200], ['auto_numero', 40], ['orgao', 80], ['infracao_codigo', 20], ['infracao_descricao', 300], ['veiculo', 80], ['obs', 2000]]) if (tem(k)) out[k] = texto(body[k], max);
  if (tem('gravidade')) { const g = texto(body.gravidade, 20); if (g && !GRAVIDADES.some((x) => x.codigo === g)) erros.push('Gravidade inválida'); else out.gravidade = g; }
  if (tem('pontos')) { const p = body.pontos === '' || body.pontos == null ? null : parseInt(body.pontos, 10); if (p !== null && !(p >= 0 && p <= 40)) erros.push('Pontos inválidos'); else out.pontos = p; }
  if (tem('valor')) { const v = num(body.valor); if (v !== null && !(v >= 0 && v < 1e6)) erros.push('Valor inválido'); else out.valor = v; }
  if (tem('equipamento_id')) out.equipamento_id = body.equipamento_id ? String(body.equipamento_id) : null;
  if (tem('colaborador_id')) out.colaborador_id = body.colaborador_id && /^\d+$/.test(String(body.colaborador_id)) ? String(body.colaborador_id) : null;
  if (tem('responsavel_id')) out.responsavel_id = body.responsavel_id || null;
  if (tem('aceite_requerido')) out.aceite_requerido = body.aceite_requerido === true;
  if (!parcial && !out.veiculo && !out.equipamento_id) erros.push('Informe o veículo (da frota ou a placa)');
  if (out.data_infracao && out.data_infracao > hojeBR()) erros.push('A data da infração não pode ser futura');
  return { erros, dados: out };
}

async function multaDoTenant(supabase, tenantId, id) {
  if (!/^\d+$/.test(String(id))) return null;
  return (await q(supabase.from('multas').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null;
}

/** Confere vínculos do tenant e copia nomes */
async function conferirVinculos(supabase, tenantId, dados) {
  if (dados.colaborador_id) {
    const c = (await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId).eq('id', dados.colaborador_id)))[0];
    if (!c) return 'Motorista não encontrado';
    dados.colaborador_nome = c.nome;
  } else if (dados.colaborador_id === null) dados.colaborador_nome = null;
  if (dados.equipamento_id) {
    const e = (await q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId).eq('id', dados.equipamento_id)))[0];
    if (!e) return 'Veículo não encontrado';
    if (!dados.veiculo) dados.veiculo = [e.tag, e.nome].filter(Boolean).join(' — ').slice(0, 80);
  }
  if (dados.responsavel_id) {
    const u = (await q(supabase.from('usuarios').select('*').eq('tenant_id', tenantId).eq('id', dados.responsavel_id)))[0];
    if (!u) return 'Responsável não encontrado';
    dados.responsavel_nome = u.nome;
  } else if (dados.responsavel_id === null) dados.responsavel_nome = null;
  return null;
}

// ─── situação calculada (prazos) ──────────────────────────────────────────
/** Próximo prazo da multa aberta: indicação (se ainda "recebida") ou vencimento */
function proximoPrazo(m, hoje = hojeBR()) {
  if (!ABERTOS.includes(m.status)) return null;
  if (m.status === 'recebida' && m.prazo_indicacao) {
    const dias = diasAte(hoje, m.prazo_indicacao);
    return { tipo: 'indicacao', nome: 'Indicar o condutor', data: String(m.prazo_indicacao).slice(0, 10), dias };
  }
  if (m.vencimento) {
    const dias = diasAte(hoje, m.vencimento);
    return { tipo: 'vencimento', nome: m.status === 'em_recurso' ? 'Vencimento (em recurso)' : 'Pagar / vencimento', data: String(m.vencimento).slice(0, 10), dias };
  }
  return null;
}
const enriquecer = (m, hoje) => ({ ...m, aceite_png: undefined, tem_aceite: !!m.aceite_png, tem_arquivo: !!m.arquivo_path, status_nome: STATUS_NOME[m.status], aberta: ABERTOS.includes(m.status), prazo: proximoPrazo(m, hoje) });

async function listar(supabase, tenantId, { colaboradorId, agora } = {}) {
  let base = supabase.from('multas').select('*').eq('tenant_id', tenantId);
  if (colaboradorId) base = base.eq('colaborador_id', colaboradorId);
  const hoje = hojeBR(agora);
  return (await q(base)).map((m) => enriquecer(m, hoje))
    .sort((a, b) => (b.aberta - a.aberta) || ((a.prazo?.dias ?? 9999) - (b.prazo?.dias ?? 9999)) || String(b.data_infracao).localeCompare(String(a.data_infracao)));
}

/** Resumo por colaborador nos últimos 12 meses (Ficha / selo informativo) */
function resumoColaborador(multas, hoje = hojeBR()) {
  const ha12 = somaDias(hoje, -365);
  const doze = multas.filter((m) => m.status !== 'cancelada' && String(m.data_infracao) >= ha12);
  return { total_12m: doze.length, pontos_12m: doze.reduce((s, m) => s + (m.pontos || 0), 0), abertas: multas.filter((m) => ABERTOS.includes(m.status)).length,
    descontado_total: Math.round(multas.filter((m) => m.status === 'descontada').reduce((s, m) => s + Number(m.valor_descontado || 0), 0) * 100) / 100 };
}

// ─── tarefa no ✅ Plano ─────────────────────────────────────────────────────
function textoTarefa(m) {
  const p = proximoPrazo(m);
  const titulo = `🚦 Multa ${m.auto_numero || ''} — ${m.veiculo || 'veículo'}${m.colaborador_nome ? ` (${m.colaborador_nome})` : ''}`.replace(/\s+/g, ' ').slice(0, 200);
  const detalhe = [`Situação: ${STATUS_NOME[m.status]}.`, p ? `Próximo passo: ${p.nome} até ${p.data.split('-').reverse().join('/')}.` : null,
    m.infracao_descricao ? `Infração: ${m.infracao_descricao}.` : null, m.valor != null ? `Valor: R$ ${Number(m.valor).toFixed(2).replace('.', ',')}.` : null,
    'Acompanhe em Pessoas → 🚦 Multas (tarefa criada pelo QuotaFlow).'].filter(Boolean).join(' ');
  return { titulo, detalhe, prazo: p?.data || null };
}
/** Cria/atualiza a tarefa do Plano. Falha aqui não derruba a multa (só avisa no log). */
async function sincronizarTarefa(supabase, tenantId, m) {
  try {
    const t = textoTarefa(m);
    const final = FINAIS.includes(m.status);
    if (m.tarefa_id) {
      const upd = final ? { status: m.status === 'cancelada' ? 'cancelada' : 'concluida', detalhe: t.detalhe } : { titulo: t.titulo, detalhe: t.detalhe, prazo: t.prazo, responsavel: m.responsavel_nome || null };
      await supabase.from('tarefas').update(upd).eq('id', m.tarefa_id).eq('tenant_id', tenantId);
      return m.tarefa_id;
    }
    if (final || !m.responsavel_id) return null;
    const { data, error } = await supabase.from('tarefas').insert([{ tenant_id: tenantId, titulo: t.titulo, detalhe: t.detalhe, responsavel: m.responsavel_nome || null, prazo: t.prazo, prioridade: 'alta', status: 'pendente', criado_em: new Date().toISOString() }]).select();
    if (error) throw new Error(error.message);
    const id = String(data[0].id);
    await supabase.from('multas').update({ tarefa_id: id }).eq('id', m.id).eq('tenant_id', tenantId);
    return id;
  } catch (e) { console.warn('⚠️ [multas] tarefa do Plano:', e.message); return m.tarefa_id || null; }
}

const evento = (status, por, obs) => ({ em: new Date().toISOString(), status, por: por || null, obs: obs || null });

async function subirArquivo(supabase, tenantId, multaId, { base64, mime }) {
  const msg = D.validarArquivo({ base64, mime }); if (msg) return { erro: msg };
  const path = `tenant-${tenantId}/multa-${multaId}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${D.MIME_OK[mime]}`;
  const { error } = await supabase.storage.from(D.BUCKET).upload(path, Buffer.from(String(base64), 'base64'), { contentType: mime, upsert: false });
  if (error) throw new Error(`Falha ao subir a notificação: ${error.message}`);
  return { path };
}

async function criar(supabase, tenantId, { usuarioId, usuarioNome }, body) {
  const { erros, dados } = validar(body || {});
  if (erros.length) return { status: 400, erro: erros[0] };
  if (!dados.prazo_indicacao) dados.prazo_indicacao = somaDias(dados.recebida_em, PRAZO_INDICACAO_DIAS);
  const ve = await conferirVinculos(supabase, tenantId, dados); if (ve) return { status: 400, erro: ve };
  const { data, error } = await supabase.from('multas').insert([{ ...dados, tenant_id: tenantId, status: 'recebida', criado_por: usuarioId || null, historico: [evento('recebida', usuarioNome, 'Multa cadastrada')] }]).select();
  if (error) throw new Error(error.message);
  let m = data[0];
  if (body.arquivo_base64) {
    const up = await subirArquivo(supabase, tenantId, m.id, { base64: body.arquivo_base64, mime: body.arquivo_mime });
    if (up.erro) { await supabase.from('multas').delete().eq('id', m.id).eq('tenant_id', tenantId); return { status: 400, erro: up.erro }; }
    const r = await supabase.from('multas').update({ arquivo_path: up.path, arquivo_nome: texto(body.arquivo_nome, 200) || 'notificacao', arquivo_mime: body.arquivo_mime }).eq('id', m.id).eq('tenant_id', tenantId).select();
    if (!r.error) m = r.data[0];
  }
  m.tarefa_id = await sincronizarTarefa(supabase, tenantId, m);
  return { multa: enriquecer(m) };
}

async function editar(supabase, tenantId, { usuarioNome }, m, body) {
  if (FINAIS.includes(m.status)) return { status: 400, erro: 'Multa finalizada — não dá para editar' };
  const { erros, dados } = validar(body || {}, { parcial: true });
  if (erros.length) return { status: 400, erro: erros[0] };
  const ve = await conferirVinculos(supabase, tenantId, dados); if (ve) return { status: 400, erro: ve };
  const { data, error } = await supabase.from('multas').update({ ...dados, atualizado_em: new Date().toISOString() }).eq('id', m.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  let n = data[0];
  if (body.arquivo_base64) {
    const up = await subirArquivo(supabase, tenantId, n.id, { base64: body.arquivo_base64, mime: body.arquivo_mime });
    if (up.erro) return { status: 400, erro: up.erro };
    if (n.arquivo_path) await D.removerArquivo(supabase, n.arquivo_path);
    const r = await supabase.from('multas').update({ arquivo_path: up.path, arquivo_nome: texto(body.arquivo_nome, 200) || 'notificacao', arquivo_mime: body.arquivo_mime }).eq('id', n.id).eq('tenant_id', tenantId).select();
    if (!r.error) n = r.data[0];
  }
  n.tarefa_id = await sincronizarTarefa(supabase, tenantId, n);
  return { multa: enriquecer(n) };
}

/** Termo do desconto (o que o colaborador assina) */
function termoDesconto(m, { valor, parcelas }) {
  const v = `R$ ${Number(valor).toFixed(2).replace('.', ',')}`;
  return `Eu, ${m.colaborador_nome || 'colaborador(a)'}, reconheço a infração de trânsito auto nº ${m.auto_numero || '—'} (${m.infracao_descricao || 'infração'}), `
    + `de ${String(m.data_infracao).split('-').reverse().join('/')}${m.hora_infracao ? ` às ${m.hora_infracao}` : ''}, com o veículo ${m.veiculo || '—'}, cometida sob minha condução, `
    + `e autorizo o desconto de ${v}${parcelas > 1 ? ` em ${parcelas} parcelas` : ''} na minha remuneração, conforme acordado com a empresa (CLT, art. 462, § 1º).`;
}

/** Muda a situação. body: { status, obs, valor_pago, valor_descontado, parcelas, motivo_cancelamento, finalizada_em, aceite_png } */
async function mudarStatus(supabase, tenantId, { usuarioNome }, m, body = {}) {
  const novo = body.status;
  if (!STATUS.includes(novo)) return { status: 400, erro: 'Situação inválida' };
  if (FINAIS.includes(m.status)) return { status: 400, erro: 'Multa já finalizada' };
  if (novo === m.status) return { status: 400, erro: 'A multa já está nessa situação' };
  const upd = { status: novo, atualizado_em: new Date().toISOString() };
  const fim = DATA.test(String(body.finalizada_em || '')) ? body.finalizada_em : hojeBR();
  if (novo === 'paga') {
    const v = num(body.valor_pago); if (!(v >= 0)) return { status: 400, erro: 'Informe o valor pago' };
    Object.assign(upd, { valor_pago: v, finalizada_em: fim });
  }
  if (novo === 'descontada') {
    if (!m.colaborador_id) return { status: 400, erro: 'Escolha o motorista responsável antes de descontar' };
    const v = num(body.valor_descontado); if (!(v > 0)) return { status: 400, erro: 'Informe o valor descontado' };
    const parcelas = body.parcelas ? parseInt(body.parcelas, 10) : 1;
    if (!(parcelas >= 1 && parcelas <= 24)) return { status: 400, erro: 'Parcelas de 1 a 24' };
    Object.assign(upd, { valor_descontado: v, parcelas_desconto: parcelas, finalizada_em: fim });
    const exige = body.aceite_requerido !== undefined ? body.aceite_requerido === true : m.aceite_requerido;
    upd.aceite_requerido = exige;
    if (exige) {
      const png = body.aceite_png;
      if (typeof png !== 'string' || !png.startsWith('data:image/png;base64,') || png.length < 200) return { status: 400, erro: 'Falta a assinatura do colaborador no termo de desconto' };
      if (png.length > 400 * 1024) return { status: 400, erro: 'Assinatura muito grande' };
      const termo = termoDesconto(m, { valor: v, parcelas });
      const em = new Date().toISOString();
      Object.assign(upd, { aceite_texto: termo, aceite_png: png, aceite_em: em,
        aceite_hash: crypto.createHash('sha256').update(JSON.stringify({ multa: String(m.id), colaborador: String(m.colaborador_id), termo, em }) + png).digest('hex') });
    }
  }
  if (novo === 'cancelada') {
    const mot = texto(body.motivo_cancelamento, 300); if (!mot) return { status: 400, erro: 'Informe o motivo (recurso deferido, auto anulado…)' };
    Object.assign(upd, { motivo_cancelamento: mot, finalizada_em: fim });
  }
  upd.historico = [...(Array.isArray(m.historico) ? m.historico : []), evento(novo, usuarioNome, texto(body.obs, 300))];
  const { data, error } = await supabase.from('multas').update(upd).eq('id', m.id).eq('tenant_id', tenantId).eq('status', m.status).select();
  if (error) throw new Error(error.message);
  if (!data?.length) return { status: 409, erro: 'A multa mudou enquanto você editava — recarregue' };
  const n = data[0];
  await sincronizarTarefa(supabase, tenantId, n);
  return { multa: enriquecer(n) };
}

/** Comprovante do desconto (termo + assinatura) para imprimir */
async function termoAssinado(supabase, tenantId, m) {
  if (!m.aceite_png) return { status: 404, erro: 'Sem aceite assinado' };
  const emp = (await q(supabase.from('tenants').select('*').eq('id', tenantId)))[0] || {};
  const col = m.colaborador_id ? (await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId).eq('id', m.colaborador_id)))[0] : null;
  return { empresa: { nome: emp.nome_fantasia || emp.nome || emp.razao_social || 'Empresa', razao_social: emp.razao_social || emp.nome || null, cnpj: emp.cnpj || null },
    colaborador: { nome: m.colaborador_nome, cpf: col?.cpf || null, funcao: col?.funcao || null },
    multa: { ...enriquecer(m), aceite_png: m.aceite_png }, gerado_em: new Date().toISOString() };
}

/** Calendário (camada 🚦): prazos de indicação e vencimentos das multas abertas */
async function eventosNoIntervalo(supabase, tenantId, de, ate, { agora, equipamentoId } = {}) {
  const hoje = hojeBR(agora);
  const out = [];
  for (const m of (await q(supabase.from('multas').select('*').eq('tenant_id', tenantId))).filter((x) => ABERTOS.includes(x.status) && (!equipamentoId || String(x.equipamento_id) === String(equipamentoId)))) {
    const add = (tipo, data, titulo) => { if (data && String(data).slice(0, 10) >= de && String(data).slice(0, 10) <= ate) { const dias = diasAte(hoje, data); out.push({ id: `multa-${m.id}-${tipo}`, tipo, data: String(data).slice(0, 10), dias, situacao: dias < 0 ? 'vencido' : dias <= 5 ? 'vence' : 'ok', titulo, de: [m.veiculo, m.colaborador_nome].filter(Boolean).join(' · ') }); } };
    if (m.status === 'recebida') add('indicacao', m.prazo_indicacao, `Indicar condutor — auto ${m.auto_numero || ''}`.trim());
    add('vencimento', m.vencimento, `Multa vence — auto ${m.auto_numero || ''}`.trim());
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}

module.exports = { STATUS, ABERTOS, FINAIS, STATUS_NOME, GRAVIDADES, PRAZO_INDICACAO_DIAS, validar, multaDoTenant, listar, resumoColaborador, proximoPrazo,
  criar, editar, mudarStatus, termoDesconto, termoAssinado, eventosNoIntervalo, sincronizarTarefa, hojeBR };
