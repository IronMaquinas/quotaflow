// services/auditorias.js — etapa A1: 🔎 AUDITORIAS do sistema de gestão (ISO 9001 9.2) — simples de propósito
//   • Programa do ano: auditorias planejadas por mês + COBERTURA dos requisitos 4–10 (o que já foi auditado no ano).
//   • Auditoria: tipo (interna, externa, certificação, fornecedor, cliente), norma, escopo, processos, requisitos, auditor (do cadastro
//     ou externo), auditados (do cadastro), datas, status, conclusão.
//   • Constatações: NC maior · NC menor · observação · oportunidade de melhoria · conforme — com requisito e evidência.
//     NC e observação viram TAREFA tipo AU (🔎 Auditoria) com responsável e prazo; o status da ação vem da própria tarefa.
//   • Entrada "resultados de auditorias" da Análise Crítica (ISO 9.3).
//   A1.1 — a auditoria é FEITA no sistema, em 3 etapas do mesmo registro:
//     📅 Planejar (criar/editar só enquanto planejada) → ▶ Iniciar (em andamento: auditados, data realizada, constatações com fotos,
//     conclusão com salvamento automático) → ■ Encerrar execução (relatório pronto, travado) → ✍ assinaturas do AUDITOR e do
//     RESPONSÁVEL da área → ✅ Concluída e aprovada. "Reabrir" volta a execução enquanto faltar assinatura (apaga as assinaturas).
//     NC maior/menor: sugere ☑ abrir NC no módulo de Não Conformidades (origem 'auditoria', fotos viram anexos) e ☑ tarefa AU.
//     Observação: tarefa (desmarcável). Oportunidade: tarefa opcional (desmarcada). Conforme: só registro.
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const TIPOS = { interna: 'Interna', externa: 'Externa', certificacao: 'Certificação / manutenção', fornecedor: 'Em fornecedor', cliente: 'Do cliente' };
const STATUS = { planejada: 'Planejada', em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada' };
const CONST = { nc_maior: { nome: 'NC maior', acao: true, nc: true, prazo: 15 }, nc_menor: { nome: 'NC menor', acao: true, nc: true, prazo: 30 }, observacao: { nome: 'Observação', acao: true, prazo: 45 }, oportunidade: { nome: 'Oportunidade de melhoria', acao: false, opcional: true, prazo: 60 }, conforme: { nome: 'Conforme', acao: false } };
const ISO9001 = [
  ['4', 'Contexto da organização'], ['4.1', 'Contexto'], ['4.2', 'Partes interessadas'], ['4.3', 'Escopo do SGQ'], ['4.4', 'SGQ e processos'],
  ['5', 'Liderança'], ['5.1', 'Liderança e comprometimento'], ['5.2', 'Política da qualidade'], ['5.3', 'Papéis e responsabilidades'],
  ['6', 'Planejamento'], ['6.1', 'Riscos e oportunidades'], ['6.2', 'Objetivos da qualidade'], ['6.3', 'Planejamento de mudanças'],
  ['7', 'Apoio'], ['7.1', 'Recursos'], ['7.2', 'Competência'], ['7.3', 'Conscientização'], ['7.4', 'Comunicação'], ['7.5', 'Informação documentada'],
  ['8', 'Operação'], ['8.1', 'Planejamento operacional'], ['8.2', 'Requisitos de produtos e serviços'], ['8.3', 'Projeto e desenvolvimento'], ['8.4', 'Provedores externos'], ['8.5', 'Produção e prestação do serviço'], ['8.6', 'Liberação'], ['8.7', 'Saídas não conformes'],
  ['9', 'Avaliação de desempenho'], ['9.1', 'Monitoramento e medição'], ['9.2', 'Auditoria interna'], ['9.3', 'Análise crítica pela direção'],
  ['10', 'Melhoria'], ['10.1', 'Generalidades'], ['10.2', 'NC e ação corretiva'], ['10.3', 'Melhoria contínua'],
].map(([c, n]) => ({ codigo: c, nome: n, principal: !c.includes('.') }));
const txt = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);
const lista = (v, n = 30, m = 80) => [...new Set((Array.isArray(v) ? v : String(v || '').split(/[,;\n]/)).map((x) => String(x?.nome ?? x).trim().slice(0, m)).filter(Boolean))].slice(0, n);
const data = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null);
const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const somaDias = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

async function proximoNumero(sb, tenantId, ano) { const l = await q(sb.from('auditorias').select('*').eq('tenant_id', tenantId)); return `AUD-${ano}-${String(l.filter((a) => String(a.numero || '').startsWith(`AUD-${ano}-`)).length + 1).padStart(2, '0')}`; }
function limpar(d = {}) {
  const titulo = txt(d.titulo, 160); if (!titulo) return { erro: 'Dê um título — ex.: Auditoria interna — Operação e Manutenção.' };
  const o = { titulo, tipo: TIPOS[d.tipo] ? d.tipo : 'interna', norma: txt(d.norma, 60) || 'ISO 9001:2015', escopo: txt(d.escopo, 2000), processos: lista(d.processos), requisitos: lista(d.requisitos, 40, 10),
    auditor_nome: txt(d.auditor_nome, 120), auditor_colaborador_id: d.auditor_colaborador_id != null && d.auditor_colaborador_id !== '' ? String(d.auditor_colaborador_id) : null, auditor_usuario_id: d.auditor_usuario_id != null && d.auditor_usuario_id !== '' ? String(d.auditor_usuario_id) : null,
    auditor_externo: txt(d.auditor_externo, 160), auditados: (Array.isArray(d.auditados) ? d.auditados : []).map((p) => ({ nome: txt(p?.nome, 120), colaborador_id: p?.colaborador_id ?? p?.id ?? null, usuario_id: p?.usuario_id ?? null })).filter((p) => p.nome).slice(0, 20),
    data_prevista: data(d.data_prevista) };
  if (!o.data_prevista) return { erro: 'Informe a data prevista.' };
  delete o.auditados; // auditados entram na execução
  return { o };
}
async function criar(sb, tenantId, quem, d) {
  const r = limpar(d); if (r.erro) return { status: 400, erro: r.erro }; const ano = r.o.data_prevista.slice(0, 4); const agora = new Date().toISOString();
  const a = (await q(sb.from('auditorias').insert([{ tenant_id: tenantId, numero: await proximoNumero(sb, tenantId, ano), status: 'planejada', ...r.o, criado_por: quem?.nome || null, criado_em: agora, atualizado_em: agora }]).select()))[0];
  return { auditoria: a };
}
async function uma(sb, tenantId, id) { return (await q(sb.from('auditorias').select('*').eq('tenant_id', tenantId).eq('id', id)))[0] || null; }
const PLANO = ['titulo', 'tipo', 'norma', 'escopo', 'processos', 'requisitos', 'auditor_nome', 'auditor_colaborador_id', 'auditor_usuario_id', 'auditor_externo', 'data_prevista'];
const travada = (a) => a.status === 'concluida' || a.status === 'cancelada' || !!a.encerrada_em;
const MSG_TRAVADA = 'Execução encerrada — o relatório está travado. Use "Reabrir" (apaga as assinaturas) para alterar.';
/** planejada: dados do plano · em andamento: auditados, data realizada e conclusão (salvamento automático) */
async function atualizar(sb, tenantId, id, d = {}) {
  const a = await uma(sb, tenantId, id); if (!a) return { status: 404, erro: 'Auditoria não encontrada.' };
  if (travada(a)) return { status: 409, erro: a.status === 'cancelada' ? 'Auditoria cancelada.' : MSG_TRAVADA };
  let up;
  if (a.status === 'planejada') { const r = limpar({ ...a, ...d }); if (r.erro) return { status: 400, erro: r.erro }; up = Object.fromEntries(PLANO.map((k) => [k, r.o[k]])); }
  else {
    up = {}; if (d.conclusao !== undefined) up.conclusao = txt(d.conclusao, 6000);
    if (d.data_realizada !== undefined) { up.data_realizada = data(d.data_realizada); if (!up.data_realizada) return { status: 400, erro: 'Data realizada inválida.' }; }
    if (d.auditados !== undefined) up.auditados = (Array.isArray(d.auditados) ? d.auditados : []).map((p) => ({ nome: txt(p?.nome, 120), colaborador_id: p?.colaborador_id ?? p?.id ?? null, usuario_id: p?.usuario_id ?? null })).filter((p) => p.nome).slice(0, 20);
  }
  return { auditoria: (await q(sb.from('auditorias').update({ ...up, atualizado_em: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
}
async function iniciar(sb, tenantId, id) {
  const a = await uma(sb, tenantId, id); if (!a) return { status: 404, erro: 'Auditoria não encontrada.' };
  if (a.status !== 'planejada') return { status: 409, erro: 'A auditoria já foi iniciada.' };
  const agora = new Date().toISOString();
  return { auditoria: (await q(sb.from('auditorias').update({ status: 'em_andamento', iniciada_em: agora, data_realizada: a.data_realizada || hojeBR(), atualizado_em: agora }).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
}
async function encerrar(sb, tenantId, id) {
  const a = await uma(sb, tenantId, id); if (!a) return { status: 404, erro: 'Auditoria não encontrada.' };
  if (a.status !== 'em_andamento' || a.encerrada_em) return { status: 409, erro: 'Só encerra uma auditoria em andamento.' };
  const cs = await q(sb.from('auditoria_constatacoes').select('*').eq('tenant_id', tenantId).eq('auditoria_id', id));
  if (!cs.length) return { status: 409, erro: 'Registre ao menos uma constatação (pode ser "Conforme") antes de encerrar.' };
  if (!String(a.conclusao || '').trim()) return { status: 409, erro: 'Escreva a conclusão do auditor antes de encerrar.' };
  const agora = new Date().toISOString();
  return { auditoria: (await q(sb.from('auditorias').update({ encerrada_em: agora, assinaturas: [], atualizado_em: agora }).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
}
async function reabrir(sb, tenantId, id) {
  const a = await uma(sb, tenantId, id); if (!a) return { status: 404, erro: 'Auditoria não encontrada.' };
  if (a.status === 'concluida') return { status: 409, erro: 'Auditoria concluída e aprovada — é registro, não reabre.' };
  if (!a.encerrada_em) return { status: 409, erro: 'A execução não está encerrada.' };
  return { auditoria: (await q(sb.from('auditorias').update({ encerrada_em: null, assinaturas: [], atualizado_em: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
}
const PAPEIS = { auditor: 'Auditor', auditado: 'Responsável pela área auditada' };
async function assinar(sb, tenantId, quem, id, d = {}) {
  const a = await uma(sb, tenantId, id); if (!a) return { status: 404, erro: 'Auditoria não encontrada.' };
  if (!a.encerrada_em || a.status !== 'em_andamento') return { status: 409, erro: a.status === 'concluida' ? 'Auditoria já aprovada.' : 'Encerre a execução antes de assinar.' };
  const papel = PAPEIS[d.papel] ? d.papel : null; if (!papel) return { status: 400, erro: 'Quem está assinando: auditor ou responsável da área?' };
  const nome = txt(d.nome, 120); if (!nome) return { status: 400, erro: 'Informe o nome de quem assina.' };
  const png = String(d.png || ''); if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(png) || png.length < 200 || png.length > 600000) return { status: 400, erro: 'Assine no quadro antes de confirmar.' };
  const agora = new Date().toISOString();
  const nova = { papel, nome, colaborador_id: d.colaborador_id ?? null, usuario_id: d.usuario_id ?? null, png, em: agora, registrado_por: quem?.nome || null };
  const ass = [...(a.assinaturas || []).filter((x) => x.papel !== papel), nova];
  const ok = Object.keys(PAPEIS).every((k) => ass.some((x) => x.papel === k));
  const up = { assinaturas: ass, atualizado_em: agora, ...(ok ? { status: 'concluida', aprovada_em: agora } : {}) };
  return { auditoria: (await q(sb.from('auditorias').update(up).eq('tenant_id', tenantId).eq('id', id).select()))[0], aprovada: ok };
}
async function cancelar(sb, tenantId, id) {
  const a = await uma(sb, tenantId, id); if (!a) return { status: 404, erro: 'Auditoria não encontrada.' };
  if (a.status === 'concluida') return { status: 409, erro: 'Auditoria concluída e aprovada não é cancelada.' };
  return { auditoria: (await q(sb.from('auditorias').update({ status: 'cancelada', atualizado_em: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
}
async function tarefasPorId(sb, tenantId, ids) { if (!ids.length) return new Map(); const l = await q(sb.from('tarefas').select('*').eq('tenant_id', tenantId)).catch(() => []); const s = new Set(ids.map(String)); return new Map(l.filter((t) => s.has(String(t.id))).map((t) => [String(t.id), t])); }
async function detalhe(sb, tenantId, id) {
  const a = await uma(sb, tenantId, id); if (!a) return { status: 404, erro: 'Auditoria não encontrada.' };
  const cs = (await q(sb.from('auditoria_constatacoes').select('*').eq('tenant_id', tenantId).eq('auditoria_id', id))).sort((x, y) => String(x.criado_em).localeCompare(String(y.criado_em)));
  const ts = await tarefasPorId(sb, tenantId, cs.map((c) => c.tarefa_id).filter(Boolean));
  let ncs = new Map(); if (cs.some((c) => c.nc_id)) { const l = await q(sb.from('nao_conformidades').select('*').eq('tenant_id', tenantId)).catch(() => []); ncs = new Map(l.map((n) => [String(n.id), n])); }
  return { auditoria: a, travada: travada(a), PAPEIS, constatacoes: cs.map((c) => { const t = ts.get(String(c.tarefa_id)); const n = ncs.get(String(c.nc_id)); return { ...c, tipo_nome: CONST[c.tipo]?.nome, tarefa: t ? { id: t.id, numero: t.numero, status: t.status, prazo: t.prazo, responsavel: t.responsavel } : null, nc: n ? { id: n.id, numero: n.numero_nc, status: n.status } : null }; }) };
}
function limparFotos(v) { return (Array.isArray(v) ? v : []).map(String).filter((f) => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(f) && f.length <= 1600000).slice(0, 4); }
async function numeroNC(sb, tenantId) {
  const ano = new Date().getFullYear(); const pre = `NC-${ano}-`; const l = await q(sb.from('nao_conformidades').select('*').eq('tenant_id', tenantId)).catch(() => []);
  const n = l.map((x) => String(x.numero_nc || '')).filter((x) => x.startsWith(pre)).map((x) => parseInt((x.match(/(\d+)$/) || [])[1] || 0, 10)); return `${pre}${String((n.length ? Math.max(...n) : 0) + 1).padStart(4, '0')}`;
}
/** NC no módulo de Não Conformidades (origem 'auditoria'); fotos → anexos. Falha não derruba a constatação. */
async function abrirNC(sb, tenantId, quem, a, c, resp) {
  const numero = await numeroNC(sb, tenantId); const desc = `[${a.numero} · ${CONST[c.tipo].nome}${c.requisito ? ` · ISO ${c.requisito}` : ''}${c.processo ? ` · ${c.processo}` : ''}] ${c.descricao}`;
  const nc = (await q(sb.from('nao_conformidades').insert([{ tenant_id: tenantId, numero_nc: numero, origem: 'auditoria', descricao_problema: desc.slice(0, 2000), acao_imediata: null, disposicao: 'pendente', status: 'aberta',
    responsavel_nome: resp || null, data_ocorrencia: a.data_realizada || hojeBR(), inspetor_id: quem?.id ?? null, criado_por_nome: quem?.nome || null, motivo_recusa: desc.slice(0, 2000) }]).select()))[0];
  for (let i = 0; i < (c.fotos || []).length; i++) { const f = c.fotos[i]; const mime = (f.match(/^data:([^;]+);/) || [])[1] || 'image/jpeg'; await sb.from('nao_conformidade_anexos').insert([{ tenant_id: tenantId, nc_id: nc.id, url: f, nome_arquivo: `${numero}-evidencia-${String(i + 1).padStart(2, '0')}.${mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1]}`, mime_type: mime, tamanho_bytes: Math.round(f.length * 0.75), criado_por: quem?.id ?? null, criado_por_nome: quem?.nome || null }]).then(() => null, () => null); }
  await sb.from('nao_conformidade_eventos').insert([{ tenant_id: tenantId, nc_id: nc.id, tipo: 'criacao', descricao: `NC aberta pela auditoria ${a.numero}${c.evidencia ? ` — evidência: ${String(c.evidencia).slice(0, 200)}` : ''}`, dados: { origem: 'auditoria', auditoria_id: a.id, constatacao_id: c.id }, criado_por: quem?.id ?? null, criado_por_nome: quem?.nome || null, visivel_fornecedor: false, autor_tipo: 'comprador' }]).then(() => null, () => null);
  return nc;
}
async function constatar(sb, tenantId, quem, auditoriaId, d = {}) {
  let a = await uma(sb, tenantId, auditoriaId); if (!a) return { status: 404, erro: 'Auditoria não encontrada.' };
  if (travada(a)) return { status: 409, erro: a.status === 'cancelada' ? 'Auditoria cancelada.' : MSG_TRAVADA };
  if (a.status === 'planejada') a = (await iniciar(sb, tenantId, a.id)).auditoria || a; // constatar já inicia
  const tipo = CONST[d.tipo] ? d.tipo : null; if (!tipo) return { status: 400, erro: 'Escolha o tipo da constatação.' };
  const descricao = txt(d.descricao, 2000); if (!descricao) return { status: 400, erro: 'Descreva a constatação.' };
  const agora = new Date().toISOString();
  const c = (await q(sb.from('auditoria_constatacoes').insert([{ tenant_id: tenantId, auditoria_id: a.id, tipo, requisito: txt(d.requisito, 10), processo: txt(d.processo, 80), descricao, evidencia: txt(d.evidencia, 2000), fotos: limparFotos(d.fotos), criado_por: quem?.nome || null, criado_em: agora, atualizado_em: agora }]).select()))[0];
  let tarefa = null; let nc = null; const avisos = []; const resp = txt(d.responsavel, 120);
  if (CONST[tipo].nc && d.abrir_nc !== false) { try { nc = await abrirNC(sb, tenantId, quem, a, c, resp); await sb.from('auditoria_constatacoes').update({ nc_id: String(nc.id) }).eq('id', c.id).eq('tenant_id', tenantId); c.nc_id = String(nc.id); } catch (e) { avisos.push(`a NC não foi aberta (${e.message})`); } }
  const querTarefa = CONST[tipo].acao ? d.criar_tarefa !== false : CONST[tipo].opcional ? d.criar_tarefa === true : false;
  if (querTarefa) {
    const T = require('./tarefas'); const prazo = data(d.prazo) || somaDias(hojeBR(), CONST[tipo].prazo);
    const t = await T.criar(sb, tenantId, quem, { tipo: 'AU', titulo: `${CONST[tipo].nome}${c.requisito ? ` (${c.requisito})` : ''} — ${a.numero}: ${descricao.slice(0, 120)}`, prioridade: tipo === 'nc_maior' ? 'alta' : tipo === 'oportunidade' ? 'baixa' : 'media', prazo,
      responsavel_ref: d.responsavel_ref || null, responsavel: d.responsavel_ref ? null : (resp || 'Gestão'),
      detalhe: `${a.numero} · ${a.titulo}${nc ? ` · ${nc.numero_nc}` : ''}\n${CONST[tipo].nome}${c.requisito ? ` · requisito ${c.requisito}` : ''}${c.processo ? ` · processo ${c.processo}` : ''}\n\n${descricao}${c.evidencia ? `\n\nEvidência: ${c.evidencia}` : ''}\n\n${tipo === 'oportunidade' ? 'Avaliar a melhoria e implantar se fizer sentido.' : 'Tratar: correção imediata, causa raiz e ação corretiva; anexar a evidência da eficácia.'}` });
    if (t?.erro) avisos.push(`a tarefa não foi criada (${t.erro})`); else if (t?.id) { tarefa = t; await sb.from('auditoria_constatacoes').update({ tarefa_id: String(t.id) }).eq('id', c.id).eq('tenant_id', tenantId); c.tarefa_id = String(t.id); }
  }
  return { constatacao: c, tarefa: tarefa ? { id: tarefa.id, numero: tarefa.numero } : null, nc: nc ? { id: nc.id, numero: nc.numero_nc } : null, aviso: avisos.length ? `Constatação registrada, mas ${avisos.join(' e ')}.` : null };
}
/** rascunho: corrigir texto/fotos de uma constatação durante a execução (NC e tarefa já abertas não mudam) */
async function editarConstatacao(sb, tenantId, id, d = {}) {
  const c = (await q(sb.from('auditoria_constatacoes').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!c) return { status: 404, erro: 'Constatação não encontrada.' };
  const a = await uma(sb, tenantId, c.auditoria_id); if (!a || travada(a)) return { status: 409, erro: MSG_TRAVADA };
  const up = { atualizado_em: new Date().toISOString() };
  if (d.descricao !== undefined) { up.descricao = txt(d.descricao, 2000); if (!up.descricao) return { status: 400, erro: 'A descrição não pode ficar vazia.' }; }
  if (d.evidencia !== undefined) up.evidencia = txt(d.evidencia, 2000); if (d.requisito !== undefined) up.requisito = txt(d.requisito, 10); if (d.processo !== undefined) up.processo = txt(d.processo, 80); if (d.fotos !== undefined) up.fotos = limparFotos(d.fotos);
  return { constatacao: (await q(sb.from('auditoria_constatacoes').update(up).eq('tenant_id', tenantId).eq('id', id).select()))[0] };
}
async function excluirConstatacao(sb, tenantId, id) {
  const c = (await q(sb.from('auditoria_constatacoes').select('*').eq('tenant_id', tenantId).eq('id', id)))[0]; if (!c) return { status: 404, erro: 'Constatação não encontrada.' };
  const a = await uma(sb, tenantId, c.auditoria_id); if (!a || travada(a)) return { status: 409, erro: 'Execução encerrada — as constatações ficam como registro.' };
  if (c.tarefa_id || c.nc_id) return { status: 409, erro: 'Esta constatação já abriu NC ou tarefa. Cancele-as antes, se foi lançada por engano.' };
  await q(sb.from('auditoria_constatacoes').delete().eq('tenant_id', tenantId).eq('id', id).select()); return { ok: true };
}

/** programa do ano: auditorias, contagens, cobertura de requisitos (principais 4–10 e subitens) */
async function programa(sb, tenantId, ano) {
  ano = /^\d{4}$/.test(String(ano || '')) ? String(ano) : hojeBR().slice(0, 4);
  const todas = await q(sb.from('auditorias').select('*').eq('tenant_id', tenantId));
  const doAno = todas.filter((a) => String(a.data_prevista || a.data_realizada || '').startsWith(ano)).sort((x, y) => String(x.data_prevista || x.data_realizada).localeCompare(String(y.data_prevista || y.data_realizada)));
  const cs = (await q(sb.from('auditoria_constatacoes').select('*').eq('tenant_id', tenantId))).filter((c) => doAno.some((a) => String(a.id) === String(c.auditoria_id)));
  const ts = await tarefasPorId(sb, tenantId, cs.map((c) => c.tarefa_id).filter(Boolean));
  const hoje = hojeBR(); const aberta = (c) => { const t = ts.get(String(c.tarefa_id)); return t && !['concluida', 'cancelada'].includes(t.status); };
  const atrasada = (a) => a.status === 'planejada' && a.data_prevista && a.data_prevista < hoje;
  const cobertos = new Set(); for (const a of doAno.filter((x) => ['concluida', 'em_andamento'].includes(x.status))) for (const r of a.requisitos || []) { cobertos.add(r); cobertos.add(String(r).split('.')[0]); }
  const porA = (a) => { const xs = cs.filter((c) => String(c.auditoria_id) === String(a.id)); const n = (t) => xs.filter((c) => c.tipo === t).length; return { nc_maior: n('nc_maior'), nc_menor: n('nc_menor'), observacao: n('observacao'), oportunidade: n('oportunidade'), conforme: n('conforme'), acoes_abertas: xs.filter(aberta).length }; };
  const t = (k) => cs.filter((c) => c.tipo === k).length;
  return { ano, TIPOS, STATUS, CONST: Object.fromEntries(Object.entries(CONST).map(([k, v]) => [k, v.nome])), REGRAS: CONST, requisitos: ISO9001.map((r) => ({ ...r, coberto: cobertos.has(r.codigo) })),
    resumo: { total: doAno.length, concluidas: doAno.filter((a) => a.status === 'concluida').length, atrasadas: doAno.filter(atrasada).length, nc_maior: t('nc_maior'), nc_menor: t('nc_menor'), observacoes: t('observacao'), oportunidades: t('oportunidade'), acoes_abertas: cs.filter(aberta).length,
      cobertura_pct: Math.round((ISO9001.filter((r) => r.principal && cobertos.has(r.codigo)).length / ISO9001.filter((r) => r.principal).length) * 100) },
    auditorias: doAno.map((a) => ({ ...a, atrasada: atrasada(a), contagem: porA(a) })) };
}

module.exports = { TIPOS, STATUS, CONST, ISO9001, PAPEIS, criar, atualizar, iniciar, encerrar, reabrir, assinar, cancelar, detalhe, constatar, editarConstatacao, excluirConstatacao, programa };
