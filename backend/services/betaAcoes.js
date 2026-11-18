// services/betaAcoes.js — etapa B3: 👋 a Beta FAZ coisas simples — sempre com "Confirmar ✓" (gestor/admin)
//   Fluxo: a Beta entende o pedido → preparar() resolve nomes e datas, confere as regras e devolve uma PROPOSTA
//   (resumo + avisos) com um token assinado (HMAC, 15 min) → a pessoa confirma no app → confirmar() executa com as
//   regras de sempre (as mesmas da tela) e registra "feito pela 👋 Beta a pedido de <pessoa>". Nada acontece sem o clique.
//   ➕ Ação nova: um objeto em ACOES { nome, descricao, args, exemplo, preparar(ctx,args) → { resumo[], avisos[], dados } | { texto, falta },
//   executar(ctx, dados) → { texto, link } }. O roteador da Beta passa a oferecer a ação automaticamente.
const crypto = require('crypto');
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const BC = () => require('./betaConsultas');
const hojeBR = () => new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
const dBR = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—');
const somaD = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
const GESTAO = ['admin', 'gestor'];
const SEGREDO = () => process.env.JWT_SECRET || process.env.BETA_SEGREDO || 'qf-beta-dev';
const assinar = (obj) => { const b = Buffer.from(JSON.stringify(obj)).toString('base64url'); return `${b}.${crypto.createHmac('sha256', SEGREDO()).update(b).digest('base64url')}`; };
const abrir = (tok) => { const [b, s] = String(tok || '').split('.'); if (!b || !s) return null; const ok = crypto.createHmac('sha256', SEGREDO()).update(b).digest('base64url');
  if (ok.length !== s.length || !crypto.timingSafeEqual(Buffer.from(ok), Buffer.from(s))) return null; try { return JSON.parse(Buffer.from(b, 'base64url').toString()); } catch { return null; } };

/** pessoa do cadastro (funcionário ou usuário) pelo nome aproximado */
async function acharPessoa(ctx, termo) {
  const ps = await require('./tarefas').pessoas(ctx.sb, ctx.tenantId);
  const xs = BC().achar(ps, termo, ['nome']);
  if (!xs.length) return { erro: `Não encontrei ninguém chamado "${termo}" no cadastro.` };
  if (xs.length > 1) return { erro: `Encontrei ${xs.length} pessoas com "${termo}": ${xs.slice(0, 5).map((p) => p.nome).join(' · ')}. Qual delas?`, falta: 'pessoa' };
  return { pessoa: xs[0] };
}
const data = (v) => (v ? BC().lerData(String(v), hojeBR()) : null);

const ACOES = [
  {
    nome: 'criar_tarefa',
    descricao: 'CRIAR uma tarefa/pendência para alguém ("cria uma tarefa para a Paula emitir o CT-e até amanhã").',
    args: { titulo: 'o que fazer', responsavel: 'nome de quem vai fazer (opcional)', prazo: 'data do prazo (ex.: amanhã, 25/11)', prioridade: 'baixa, media, alta (opcional)' },
    exemplo: 'Cria uma tarefa para a Paula emitir o CT-e até amanhã',
    async preparar(ctx, a) {
      if (!a.titulo) return { texto: 'O que deve ser feito? (ex.: "emitir o CT-e do PV-2026-0001")', falta: 'titulo' };
      const prazo = data(a.prazo); if (!prazo) return { texto: 'Para quando é o prazo? (ex.: amanhã, 25/11)', falta: 'prazo' };
      let p = null; if (a.responsavel) { const r = await acharPessoa(ctx, a.responsavel); if (r.erro) return { texto: r.erro, falta: r.falta || 'responsavel' }; p = r.pessoa; }
      const pr = ['baixa', 'media', 'alta'].includes(String(a.prioridade || '').toLowerCase().replace('é', 'e')) ? String(a.prioridade).toLowerCase().replace('é', 'e') : 'media';
      const avisos = []; if (prazo < hojeBR()) avisos.push('⚠ O prazo já passou.');
      if (p) { try { const aus = await require('./ferias').ausencias(ctx.sb, ctx.tenantId, prazo, prazo); const f = aus.find((x) => (p.colaborador_id && String(x.colaborador_id) === String(p.colaborador_id)) || (p.usuario_id && String(x.usuario_id) === String(p.usuario_id))); if (f) avisos.push(`🏖 ${p.nome} estará de férias de ${dBR(f.inicio)} a ${dBR(f.fim)}.`); } catch { /* ok */ } }
      const titulo = String(a.titulo).trim().replace(/^./, (c) => c.toUpperCase()).slice(0, 200);
      return { resumo: [`📋 Nova tarefa: "${titulo}"`, `👤 Responsável: ${p ? p.nome : 'sem responsável'}`, `📅 Prazo: ${dBR(prazo)}`, `Prioridade: ${pr}`], avisos, dados: { titulo, ref: p?.ref || null, prazo, prioridade: pr } };
    },
    async executar(ctx, d) {
      const T = require('./tarefas'); const r = await T.criar(ctx.sb, ctx.tenantId, ctx.quem, { titulo: d.titulo, responsavel_ref: d.ref, prazo: d.prazo, prioridade: d.prioridade, detalhe: `Criada pela 👋 Beta a pedido de ${ctx.quem.nome}.` });
      if (r.erro) return { erro: r.erro }; return { texto: `✅ Tarefa ${r.numero || ''} criada${r.responsavel ? ` para ${r.responsavel}` : ''} — prazo ${dBR(d.prazo)}.`, link: { tela: 'plano' } };
    },
  },
  {
    nome: 'lancar_ferias',
    descricao: 'LANÇAR/MARCAR/PROGRAMAR férias de um funcionário (início + quantidade de dias, ou de X a Y).',
    args: { pessoa: 'nome do funcionário', inicio: 'data de saída', dias: 'quantidade de dias (ou)', fim: 'último dia (opcional)', vendidos: 'dias vendidos/abono (opcional)' },
    exemplo: 'Marca férias da Ana de 03/01 a 22/01',
    async preparar(ctx, a) {
      if (!a.pessoa) return { texto: 'De quem são as férias?', falta: 'pessoa' };
      const r = await acharPessoa(ctx, a.pessoa); if (r.erro) return { texto: r.erro, falta: r.falta || 'pessoa' }; const p = r.pessoa;
      if (!p.colaborador_id) return { texto: `${p.nome} é usuário do sistema mas não está no cadastro de funcionários — cadastre em Pessoas para lançar férias.` };
      const ini = data(a.inicio); if (!ini) return { texto: `Qual a data de saída de ${p.nome.split(' ')[0]}?`, falta: 'inicio' };
      let fim = data(a.fim); const n = parseInt(a.dias, 10); if (!fim && n > 0) fim = somaD(ini, n - 1);
      if (!fim) return { texto: 'Quantos dias de férias? (ex.: 30, 20, 15)', falta: 'dias' };
      if (fim < ini) return { texto: 'O último dia ficou antes da saída — confira as datas.' };
      const ab = parseInt(a.vendidos, 10) || 0;
      const FE = require('./ferias'); const an = await FE.analisar(ctx.sb, ctx.tenantId, { colaborador_id: p.colaborador_id, inicio: ini, fim, abono_dias: ab });
      const qtd = Math.round((Date.parse(fim) - Date.parse(ini)) / 864e5) + 1;
      return { resumo: [`🏖 Férias de ${p.nome}`, `Saída ${dBR(ini)} · último dia ${dBR(fim)} · volta ${dBR(somaD(fim, 1))}`, `${qtd} dia(s)${ab ? ` + ${ab} vendido(s)` : ''}${an.periodo ? ` · período ${an.periodo.rotulo}` : ''}`],
        avisos: an.avisos.filter((x) => x.nivel !== 'ok').map((x) => `${x.nivel === 'erro' ? '❌' : x.nivel === 'alerta' ? '⚠' : '💡'} ${x.texto}`), bloqueia: !!an.bloqueia, dados: { colaborador_id: p.colaborador_id, inicio: ini, fim, abono_dias: ab } };
    },
    async executar(ctx, d) {
      const r = await require('./ferias').criar(ctx.sb, ctx.tenantId, { ...d, obs: 'Lançada pela 👋 Beta' }, `${ctx.quem.nome} (via Beta)`);
      if (r.erro) return { erro: r.erro }; return { texto: `✅ Férias lançadas: ${dBR(d.inicio)} a ${dBR(d.fim)}.`, link: { tela: 'pessoas', aba: 'ferias' } };
    },
  },
  {
    nome: 'registrar_falta',
    descricao: 'REGISTRAR falta injustificada de um funcionário (data e quantos dias).',
    args: { pessoa: 'nome do funcionário', data: 'dia da falta (ex.: hoje, ontem, 12/11)', dias: 'quantos dias (opcional, padrão 1)', obs: 'observação (opcional)' },
    exemplo: 'Registra falta do João ontem',
    async preparar(ctx, a) {
      if (!a.pessoa) return { texto: 'Falta de quem?', falta: 'pessoa' };
      const r = await acharPessoa(ctx, a.pessoa); if (r.erro) return { texto: r.erro, falta: r.falta || 'pessoa' }; const p = r.pessoa;
      if (!p.colaborador_id) return { texto: `${p.nome} não está no cadastro de funcionários.` };
      let d = /ontem/.test(String(a.data || '').toLowerCase()) ? somaD(hojeBR(), -1) : data(a.data); if (!d) return { texto: 'Em que dia foi a falta?', falta: 'data' };
      const n = Math.max(1, Math.min(60, parseInt(a.dias, 10) || 1));
      const avisos = d > hojeBR() ? ['❌ A falta não pode ser no futuro.'] : [];
      return { resumo: [`⚠ Falta injustificada — ${p.nome}`, `Data: ${dBR(d)}${n > 1 ? ` (${n} dias)` : ''}`, ...(a.obs ? [`Obs.: ${a.obs}`] : [])], avisos, bloqueia: avisos.length > 0, dados: { colaborador_id: p.colaborador_id, data: d, dias: n, obs: a.obs || null } };
    },
    async executar(ctx, d) {
      const r = await require('./ferias').registrarFalta(ctx.sb, ctx.tenantId, d.colaborador_id, { data: d.data, dias: d.dias, obs: `${d.obs ? `${d.obs} · ` : ''}via 👋 Beta` }, ctx.quem.nome);
      if (r.erro) return { erro: r.erro }; return { texto: `✅ Falta registrada em ${dBR(d.data)}.`, link: { tela: 'pessoas', colaborador: d.colaborador_id } };
    },
  },
  {
    nome: 'avisar_pessoa',
    descricao: 'AVISAR/MANDAR MENSAGEM para alguém da equipe pelo sininho do sistema ("avisa o João que a AT mudou para amanhã").',
    args: { pessoa: 'para quem', mensagem: 'o recado' },
    exemplo: 'Avisa a Paula que o CT-e é prioridade hoje',
    async preparar(ctx, a) {
      if (!a.pessoa) return { texto: 'Avisar quem?', falta: 'pessoa' };
      const r = await acharPessoa(ctx, a.pessoa); if (r.erro) return { texto: r.erro, falta: r.falta || 'pessoa' }; const p = r.pessoa;
      if (!a.mensagem) return { texto: `Qual o recado para ${p.nome.split(' ')[0]}?`, falta: 'mensagem' };
      if (!p.usuario_id) { const c = p.colaborador_id ? (await q(ctx.sb.from('colaboradores').select('*').eq('tenant_id', ctx.tenantId).eq('id', p.colaborador_id)))[0] : null;
        return { texto: `${p.nome} não tem login no sistema, então não recebe aviso no sininho.${c?.telefone ? ' Fale direto:' : ''}`, acoes: c?.telefone ? [{ rotulo: p.nome, telefone: c.telefone }] : [] }; }
      const msg = String(a.mensagem).trim().slice(0, 400);
      return { resumo: [`🔔 Aviso para ${p.nome}`, `"${msg}"`, `De: ${ctx.quem.nome}`], avisos: [], dados: { usuario_id: p.usuario_id, nome: p.nome, msg } };
    },
    async executar(ctx, d) {
      await require('./notificacoes').criar(ctx.sb, { tipo: 'usuario', id: String(d.usuario_id) }, { tenantId: ctx.tenantId, tipo: 'recado', titulo: `💬 Recado de ${ctx.quem.nome}`, texto: d.msg, link: {}, chave: `recado:${ctx.quem.id}:${Date.now()}` });
      return { texto: `✅ ${d.nome.split(' ')[0]} foi avisado(a) no sininho.` };
    },
  },
  {
    nome: 'reatribuir_tarefa',
    descricao: 'PASSAR/TRANSFERIR/REATRIBUIR uma tarefa (TSK-…) para outra pessoa, ou mudar o prazo dela.',
    args: { tarefa: 'nº da tarefa (TSK-…)', responsavel: 'novo responsável (opcional)', prazo: 'novo prazo (opcional)' },
    exemplo: 'Passa a TSK-TR-2026-0001 para o Carlos',
    async preparar(ctx, a) {
      if (!a.tarefa) return { texto: 'Qual tarefa? (o número, ex.: TSK-TR-2026-0001)', falta: 'tarefa' };
      const ts = (await q(ctx.sb.from('tarefas').select('*').eq('tenant_id', ctx.tenantId))).filter((x) => x.status !== 'cancelada'); const c = String(a.tarefa).replace(/[^a-z0-9]/gi, '').toLowerCase();
      const t = ts.find((x) => x.numero && String(x.numero).replace(/[^a-z0-9]/gi, '').toLowerCase() === c) || ts.find((x) => x.numero && c.length >= 4 && String(x.numero).replace(/[^a-z0-9]/gi, '').toLowerCase().endsWith(c.replace(/^tsk/, '')));
      if (!t) return { texto: `Não encontrei a tarefa "${a.tarefa}".`, falta: 'tarefa' };
      let p = null; if (a.responsavel) { const r = await acharPessoa(ctx, a.responsavel); if (r.erro) return { texto: r.erro, falta: r.falta || 'responsavel' }; p = r.pessoa; }
      const prazo = a.prazo ? data(a.prazo) : null; if (!p && !prazo) return { texto: 'Mudar o quê — o responsável ou o prazo?', falta: 'responsavel' };
      return { resumo: [`📋 ${t.numero} — ${t.titulo}`, ...(p ? [`👤 ${t.responsavel || 'sem responsável'} → ${p.nome}`] : []), ...(prazo ? [`📅 ${t.prazo ? dBR(t.prazo) : 'sem prazo'} → ${dBR(prazo)}`] : [])], avisos: t.status === 'concluida' ? ['⚠ A tarefa está concluída.'] : [], dados: { id: t.id, ref: p?.ref || null, prazo } };
    },
    async executar(ctx, d) {
      const body = {}; if (d.ref) body.responsavel_ref = d.ref; if (d.prazo) body.prazo = d.prazo;
      const r = await require('./tarefas').atualizar(ctx.sb, ctx.tenantId, ctx.quem, d.id, body); if (r?.erro) return { erro: r.erro };
      return { texto: `✅ Tarefa atualizada${r?.responsavel && d.ref ? ` — agora com ${r.responsavel}` : ''}${d.prazo ? ` · prazo ${dBR(d.prazo)}` : ''}.`, link: { tela: 'plano' } };
    },
  },
];

const permitidas = (perfis) => (perfis.some((p) => GESTAO.includes(p)) ? ACOES : []);

/** monta a proposta (não executa nada) */
async function preparar(sb, { tenantId, userId, perfis, quem }, nome, args = {}) {
  const a = permitidas(perfis).find((x) => x.nome === nome); if (!a) return { texto: 'Essa ação não está liberada para o seu perfil.' };
  const limpos = {}; for (const k of Object.keys(a.args)) { const v = args?.[k]; if (v != null && String(v).trim()) limpos[k] = String(v).trim().slice(0, 400); }
  const r = await a.preparar({ sb, tenantId, userId, perfis, quem }, limpos);
  if (!r.resumo) return { ...r, assunto: { consulta: `acao:${nome}`, args: limpos } };
  const token = r.bloqueia ? null : assinar({ acao: nome, dados: r.dados, tenantId: String(tenantId), userId: String(userId), exp: Date.now() + 15 * 60e3 });
  return { proposta: { acao: nome, resumo: r.resumo, avisos: r.avisos || [], bloqueia: !!r.bloqueia, token }, texto: r.bloqueia ? 'Não dá para fazer assim — veja o que impede:' : 'Confere e confirma? Nada é feito sem o seu ✓.', assunto: { consulta: `acao:${nome}`, args: limpos } };
}
/** executa a proposta confirmada */
async function confirmar(sb, { tenantId, userId, perfis, quem }, token) {
  const t = abrir(token); if (!t) return { status: 400, erro: 'Confirmação inválida.' };
  if (t.exp < Date.now()) return { status: 409, erro: 'Esta proposta expirou (15 min). Peça de novo à Beta.' };
  if (String(t.tenantId) !== String(tenantId) || String(t.userId) !== String(userId)) return { status: 403, erro: 'Esta proposta é de outra pessoa.' };
  const a = permitidas(perfis).find((x) => x.nome === t.acao); if (!a) return { status: 403, erro: 'Ação não liberada para o seu perfil.' };
  try { const r = await a.executar({ sb, tenantId, userId, perfis, quem }, t.dados); if (r.erro) return { status: 409, erro: r.erro };
    console.log(`👋 [beta] ação ${t.acao} confirmada por ${quem?.nome || userId} (tenant ${tenantId})`); return r; }
  catch (e) { console.error('❌ [beta] ação', t.acao, e.message); return { status: 500, erro: 'Não consegui fazer agora. Tente pela tela.' }; }
}
module.exports = { ACOES, permitidas, preparar, confirmar, assinar, abrir };
