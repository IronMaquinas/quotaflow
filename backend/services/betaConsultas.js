// services/betaConsultas.js — etapa B1.5: 👋 as CONSULTAS RÁPIDAS da Beta ("quando vence a CNH da Ana?")
//
//   Como funciona: a IA só ENTENDE a pergunta e escolhe UMA consulta desta lista com os argumentos
//   (ex.: { consulta: 'vencimento_documento', args: { pessoa: 'Ana Beatriz', documento: 'CNH' } }).
//   Quem lê o banco é ESTE arquivo — sempre do tenant da sessão, respeitando o perfil (perfis) —
//   e a resposta é montada aqui, por texto fixo: sem número inventado, sem conferência, custo mínimo.
//
//   ➕ PARA INCLUIR UMA CONSULTA NOVA: acrescente um objeto em CONSULTAS (no fim do arquivo):
//     nome       — identificador (snake_case), é o que a IA devolve
//     descricao  — 1 linha para a IA saber QUANDO usar (seja específico)
//     args       — { nomeDoArg: 'o que é (opcional?)' }
//     perfis     — quem pode perguntar (gestor/admin sempre podem)
//     exemplo    — uma pergunta típica (vira sugestão no painel da Beta)
//     executar   — async (ctx, args) => ({ texto, link? })   ctx = { sb, tenantId, userId, perfis, hoje }
//   Use os ajudantes achar()/listaNomes() para nome aproximado e "qual delas?" quando houver mais de um.
//   Depois: um teste em testes/tb15.js e uma linha no readme (seção 👋 Beta).

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const hojeBR = () => new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
const d10 = (v) => (v ? String(v).slice(0, 10) : null);
const dBR = (v) => (v ? d10(v).split('-').reverse().join('/') : '—');
const dhBR = (v) => { if (!v) return '—'; const d = new Date(Date.parse(v) - 3 * 36e5).toISOString(); return `${dBR(d)} às ${d.slice(11, 16)}`; };
const diasEntre = (a, b) => Math.round((Date.parse(d10(b)) - Date.parse(d10(a))) / 864e5);
const brl = (n) => (n == null || isNaN(Number(n)) ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const GESTAO = ['admin', 'gestor'];

// ── nomes aproximados (sem acento, maiúscula, ordem) ─────────────────────────
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const compacto = (s) => norm(s).replace(/ /g, '');
/** devolve os itens cujo(s) campo(s) contêm TODAS as palavras do termo; um igualzinho ganha sozinho */
function achar(lista, termo, campos) {
  const t = norm(termo); if (!t) return [];
  const palavras = t.split(' '); const tc = compacto(termo);
  const texto = (x) => campos.map((c) => x[c]).filter(Boolean).join(' ');
  const exatos = lista.filter((x) => campos.some((c) => x[c] && (norm(x[c]) === t || compacto(x[c]) === tc)));
  if (exatos.length) return exatos;
  return lista.filter((x) => { const n = norm(texto(x)); const nc = compacto(texto(x)); return palavras.every((p) => n.includes(p)) || (tc.length >= 3 && nc.includes(tc)); });
}
// B2.1: "hoje às 14h", "ontem às 10h", "anteontem", "em 12/11"
const quandoRel = (iso) => { if (!iso) return 'há pouco'; const l = new Date(Date.parse(iso) - 3 * 36e5).toISOString(); const d = l.slice(0, 10); const h = l.slice(11, 16).replace(':00', 'h').replace(':', 'h'); const n = diasEntre(d, hojeBR());
  return n <= 0 ? `hoje às ${h}` : n === 1 ? `ontem às ${h}` : n === 2 ? `anteontem às ${h}` : `em ${dBR(d)} às ${h}`; };
const listaNomes = (xs, f, max = 5) => xs.slice(0, max).map(f).join(' · ') + (xs.length > max ? ` · e mais ${xs.length - max}` : '');
const situacaoVenc = (v, hoje) => { if (!v) return 'sem vencimento'; const d = diasEntre(hoje, v); return d < 0 ? `⛔ venceu em ${dBR(v)} (há ${-d} dia(s))` : d === 0 ? `⚠ vence HOJE (${dBR(v)})` : d <= 30 ? `⚠ vence em ${dBR(v)} (em ${d} dia(s))` : `vence em ${dBR(v)} (em ${d} dias)`; };

async function acharColaborador(ctx, termo) {
  const cs = (await q(ctx.sb.from('colaboradores').select('*').eq('tenant_id', ctx.tenantId))).filter((c) => c.situacao !== 'desligado');
  return achar(cs, termo, ['nome']);
}
const qualPessoa = (xs, termo) => (!xs.length ? { texto: `Não encontrei ninguém chamado "${termo}" no cadastro de pessoas.` }
  : { texto: `Encontrei ${xs.length} pessoas com "${termo}": ${listaNomes(xs, (c) => c.nome)}. Qual delas?` });

// ═════════════════════════════════════════════════════════════════════════════
// ── B2.0: datas em português ("01/01/2027", "1/1", "amanhã", "dia 15", "de 05 a 10/01") ──
function lerData(txt, hoje) {
  const s = norm(txt); if (!s) return null;
  if (/\bdepois de amanha\b/.test(s)) return somaD(hoje, 2); if (/\bamanha\b/.test(s)) return somaD(hoje, 1); if (/\bhoje\b|\bagora\b/.test(s)) return hoje;
  let m = String(txt).match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = String(txt).match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (m) { let a = m[3] ? +m[3] : +hoje.slice(0, 4); if (a < 100) a += 2000; let d = `${a}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`; if (!m[3] && d < hoje) d = `${a + 1}${d.slice(4)}`; return isNaN(Date.parse(d)) ? null : d; }
  m = s.match(/\bdia (\d{1,2})\b/); if (m) { let d = `${hoje.slice(0, 8)}${String(m[1]).padStart(2, '0')}`; if (d < hoje) d = new Date(Date.UTC(+hoje.slice(0, 4), +hoje.slice(5, 7), +m[1])).toISOString().slice(0, 10); return d; }
  return null;
}
const somaD = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
function lerPeriodo(txt, hoje) {
  const m = String(txt).match(/(?:de|entre)\s+(.+?)\s+(?:a|ate|até|e)\s+(.+)$/i);
  if (m) { const b = lerData(m[2], hoje); let a = lerData(m[1], hoje); if (!a && b && /^\s*\d{1,2}\s*$/.test(m[1])) a = `${b.slice(0, 8)}${String(m[1].trim()).padStart(2, '0')}`; if (a && b) return a <= b ? [a, b] : [b, a]; }
  const d = lerData(txt, hoje); return d ? [d, d] : null;
}

// ── B2.0: ocupação de um equipamento num intervalo (AT, contrato de locação, OS do calendário, OS aberta, bloqueio) ──
async function mapaOcupacao(ctx, de, ate) {
  const [eqs, ats, cts, chs, oss] = await Promise.all([
    q(ctx.sb.from('equipamentos').select('*').eq('tenant_id', ctx.tenantId)),
    q(ctx.sb.from('execucoes').select('*').eq('tenant_id', ctx.tenantId)).catch(() => []),
    q(ctx.sb.from('locacao_contratos').select('*').eq('tenant_id', ctx.tenantId)).catch(() => []),
    q(ctx.sb.from('chamados').select('*').eq('tenant_id', ctx.tenantId)).catch(() => []),
    q(ctx.sb.from('ordens_servico').select('*').eq('tenant_id', ctx.tenantId)).catch(() => [])]);
  const sob = (a1, a2, b1, b2) => !(a2 < b1 || a1 > b2);
  const oc = new Map(); const add = (id, x) => { const k = String(id); if (!oc.has(k)) oc.set(k, []); oc.get(k).push(x); };
  for (const e of eqs) if (e.bloqueado) add(e.id, { motivo: `⛔ bloqueado na inspeção${e.bloqueio_motivo ? ` (${e.bloqueio_motivo})` : ''}`, ate: null });
  for (const a of ats.filter((x) => ['programada', 'em_execucao'].includes(x.status))) {
    const i = d10(a.inicio_previsto); if (!i) continue; const f = d10(a.fim_previsto) || i; if (!sob(de, ate, i, f)) continue;
    const ids = [a.cavalo_id, ...((Array.isArray(a.conjunto) ? a.conjunto : []).map((c) => c.id))].filter((x) => x != null);
    for (const id of new Set(ids.map(String))) add(id, { motivo: `🚛 ${a.numero}${a.cliente_nome ? ` (${a.cliente_nome})` : ''}`, ate: f });
  }
  for (const e of eqs.filter((x) => x.locacao_id)) { const c = cts.find((x) => String(x.id) === String(e.locacao_id)); if (!c || c.status !== 'ativo') continue;
    const i = d10(c.inicio) || '0000-01-01', f = d10(c.fim_previsto) || '9999-12-31'; if (sob(de, ate, i, f)) add(e.id, { motivo: `📄 locado — ${c.numero}${c.cliente ? ` (${c.cliente})` : ''}`, ate: d10(c.fim_previsto) }); }
  for (const o of chs.filter((x) => x.equipamento_id && !x.concluida_em && !['cancelada', 'cancelado', 'concluida', 'finalizada'].includes(x.status))) {
    const i = d10(o.data_inicio_prevista); if (!i) continue; const f = d10(o.data_fim_prevista) || i; if (sob(de, ate, i, f)) add(o.equipamento_id, { motivo: `🔧 manutenção ${o.numero || ''}`.trim(), ate: f }); }
  for (const o of oss.filter((x) => x.equipamento_id && !['concluida', 'finalizada', 'fechada', 'cancelada', 'encerrada'].includes(x.status)))
    if (de <= somaD(hojeBR(), 3)) add(o.equipamento_id, { motivo: `🔧 OS aberta ${o.numero || ''} (sem previsão)`.trim(), ate: null });
  return { eqs, oc };
}

const CONSULTAS = [
  {
    nome: 'vencimento_documento',
    descricao: 'Quando vence a CNH, ASO, exame, treinamento ou outro documento de um funcionário (ou todos os documentos dele).',
    args: { pessoa: 'nome do funcionário', documento: 'qual documento, ex.: CNH, ASO (opcional)' },
    perfis: ['qualidade', 'operacao'],
    exemplo: 'Quando vence a CNH do João?',
    async executar(ctx, { pessoa, documento }) {
      const xs = await acharColaborador(ctx, pessoa); if (xs.length !== 1) return qualPessoa(xs, pessoa);
      const c = xs[0]; const docs = [];
      if (c.cnh_validade) docs.push({ nome: `CNH${c.cnh_categoria ? ` ${c.cnh_categoria}` : ''}`, vence: d10(c.cnh_validade) });
      for (const d of await q(ctx.sb.from('documentos').select('*').eq('tenant_id', ctx.tenantId).eq('colaborador_id', c.id))) {
        if (d.substituido_por) continue;
        if (/cnh/i.test(d.tipo_nome) && docs.some((x) => x.nome.startsWith('CNH'))) continue;
        docs.push({ nome: d.tipo_nome, vence: d10(d.vence_em) });
      }
      const filtro = documento ? docs.filter((d) => norm(d.nome).includes(norm(documento)) || norm(documento).includes(norm(d.nome))) : docs;
      if (!filtro.length) return { texto: documento ? `Não encontrei ${documento} cadastrada para ${c.nome}.${docs.length ? ` Documentos dela/dele: ${docs.map((d) => d.nome).join(', ')}.` : ''}` : `${c.nome} não tem documentos com vencimento cadastrados.`, link: { tela: 'pessoas', colaborador: c.id } };
      if (filtro.length === 1) return { texto: `${filtro[0].nome} de ${c.nome}: ${situacaoVenc(filtro[0].vence, ctx.hoje)}.`, link: { tela: 'pessoas', colaborador: c.id } };
      return { texto: `Documentos de ${c.nome}:\n${filtro.sort((a, b) => String(a.vence || '9').localeCompare(String(b.vence || '9'))).map((d) => `• ${d.nome}: ${situacaoVenc(d.vence, ctx.hoje)}`).join('\n')}`, link: { tela: 'pessoas', colaborador: c.id } };
    },
  },
  {
    nome: 'dados_cadastro',
    descricao: 'Dados de cadastro de um FUNCIONÁRIO: CPF, admissão (tempo de casa), função, telefone, e-mail, nascimento, CNH, situação, contato de emergência, plano de saúde (carteirinha).',
    args: { pessoa: 'nome do funcionário', campo: 'qual dado, ex.: CPF, telefone (opcional)' },
    perfis: ['qualidade'],
    exemplo: 'Qual o telefone da Ana?',
    async executar(ctx, { pessoa, campo }) { // B1.8: mesma regra da tela Pessoas — CPF completo só para quem edita (admin/gestor/qualidade)
      const xs = await acharColaborador(ctx, pessoa); if (xs.length !== 1) return qualPessoa(xs, pessoa);
      const c = xs[0]; const edita = ctx.perfis.some((p) => ['admin', 'gestor', 'qualidade'].includes(p));
      const cpf = c.cpf ? (edita ? String(c.cpf).replace(/\D/g, '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : `***.***.***-${String(c.cpf).slice(-2)}`) : null;
      const casa = (() => { if (!c.admissao) return null; const m = Math.floor(diasEntre(c.admissao, ctx.hoje) / 30.44); return m >= 12 ? `${Math.floor(m / 12)} ano(s)${m % 12 ? ` e ${m % 12} mês(es)` : ''}` : `${m} mês(es)`; })();
      const F = [['cpf', 'CPF', cpf], ['admissao', 'Admissão', c.admissao ? `${dBR(c.admissao)}${casa ? ` (${casa} de casa)` : ''}` : null], ['funcao', 'Função', c.funcao], ['telefone', 'Telefone', c.telefone], ['email', 'E-mail', c.email],
        ['nascimento', 'Nascimento', c.data_nascimento ? dBR(c.data_nascimento) : null], ['cnh', 'CNH', c.cnh_categoria ? `categoria ${c.cnh_categoria}${c.cnh_validade ? ` · validade ${dBR(c.cnh_validade)}` : ''}` : null], ['situacao', 'Situação', c.situacao],
        // B1.10: 🚑 emergência e 🩺 plano de saúde
        ['emergencia', 'Contato de emergência', c.emergencia_nome || c.emergencia_telefone ? `${c.emergencia_nome || '—'}${c.emergencia_parentesco ? ` (${c.emergencia_parentesco})` : ''}${c.emergencia_telefone ? ` · ${c.emergencia_telefone}` : ''}` : null],
        ['plano', 'Plano de saúde', c.plano_saude_operadora || c.plano_saude_carteira ? `${c.plano_saude_operadora || '—'}${c.plano_saude_plano ? ` · ${c.plano_saude_plano}` : ''}${c.plano_saude_carteira ? ` · carteirinha ${c.plano_saude_carteira}` : ''}${c.plano_saude_validade ? ` · validade ${dBR(c.plano_saude_validade)}` : ''}` : null]];
      const pedido = campo ? F.filter(([k, rot]) => norm(campo).includes(k) || norm(rot).includes(norm(campo)) || (k === 'admissao' && /contrat|entrou|casa/.test(norm(campo))) || (k === 'telefone' && /celular|fone|whats|contato|ligar/.test(norm(campo)) && !/emerg/.test(norm(campo))) || (k === 'emergencia' && /emerg|parente|familia|avisar/.test(norm(campo))) || (k === 'plano' && /saude|carteir|unimed|convenio|medic/.test(norm(campo)))) : [];
      const lista = pedido.length ? pedido : F;
      return { texto: `${c.nome}:\n${lista.map(([, rot, v]) => `• ${rot}: ${v || 'não cadastrado'}`).join('\n')}${cpf && !edita && lista.some(([k]) => k === 'cpf') ? '\n(CPF completo só para quem edita Pessoas.)' : ''}`, link: { tela: 'pessoas', colaborador: c.id },
        acoes: [...(lista.some(([k]) => ['telefone', 'email'].includes(k)) && (c.telefone || c.email) ? [{ rotulo: c.nome.split(' ')[0], telefone: c.telefone || null, email: c.email || null }] : []),
          ...(lista.some(([k]) => k === 'emergencia') && c.emergencia_telefone ? [{ rotulo: `🚑 ${c.emergencia_nome || 'emergência'}`, telefone: c.emergencia_telefone }] : [])] }; // B1.10: ligar/WhatsApp/e-mail
    },
  },
  {
    nome: 'contato_empresa',
    descricao: 'Telefone, e-mail e pessoa de contato de um CLIENTE ou FORNECEDOR (por nome ou CNPJ).',
    args: { empresa: 'nome ou CNPJ do cliente/fornecedor' },
    perfis: ['comprador', 'comercial', 'operacao', 'qualidade', 'financeiro', 'fiscal'],
    exemplo: 'Qual o telefone da Rolamentos Brasil?',
    async executar(ctx, { empresa }) { // B1.10
      const cli = (await q(ctx.sb.from('clientes').select('*').eq('tenant_id', ctx.tenantId)).catch(() => [])).filter((x) => x.ativo !== false).map((x) => ({ tipo: 'Cliente', nome: x.nome, doc: x.documento, contato: x.contato_nome, telefone: x.contato_telefone, email: x.contato_email, tela: 'clientes' }));
      const Visiveis = require('./fornecedoresVisiveis');
      const db = { select: async (tab, filtros = {}, tid) => { let r = ctx.sb.from(tab).select('*'); if (tid && tab !== 'tenant_fornecedores' && !filtros.tipo) r = r.eq('tenant_id', tid); for (const [k, v] of Object.entries(filtros)) r = r.eq(k, v); return q(r); } };
      const fm = await Visiveis.mapaFornecedoresDoTenant(db, ctx.tenantId, {}).catch(() => ({}));
      const forn = Object.values(fm).map((x) => ({ tipo: 'Fornecedor', nome: x.nome_fantasia || x.nome, razao: x.nome, doc: x.cnpj || x.documento, contato: x.contato_nome, telefone: x.contato_whatsapp || x.contato_telefone || x.telefone, email: x.contato_email || x.email, tela: 'fornecedores' }));
      const todos = [...cli, ...forn]; const d = String(empresa).replace(/\D/g, '');
      let xs = d.length >= 8 ? todos.filter((x) => String(x.doc || '').replace(/\D/g, '').startsWith(d)) : [];
      if (!xs.length) xs = achar(todos, empresa, ['nome', 'razao']);
      if (!xs.length) return { texto: `Não encontrei cliente nem fornecedor "${empresa}".` };
      if (xs.length > 4) return { texto: `Encontrei ${xs.length}: ${listaNomes(xs, (x) => `${x.nome} (${x.tipo.toLowerCase()})`)}. Qual deles?` };
      return { texto: xs.map((x) => `${x.tipo === 'Cliente' ? '🏢' : '🏭'} ${x.nome} (${x.tipo.toLowerCase()})\n• Contato: ${x.contato || 'não cadastrado'}\n• Telefone: ${x.telefone || 'não cadastrado'}\n• E-mail: ${x.email || 'não cadastrado'}`).join('\n\n'),
        link: { tela: xs[0].tela }, acoes: xs.filter((x) => x.telefone || x.email).map((x) => ({ rotulo: x.nome, telefone: x.telefone || null, email: x.email || null })) };
    },
  },
  {
    nome: 'ferias',
    descricao: 'Férias: quando um funcionário sai/volta de férias e o saldo de dias a gozar/vencimento, ou quem está de férias agora e quem sai nos próximos 30 dias (sem pessoa).',
    args: { pessoa: 'nome do funcionário (opcional)' },
    perfis: ['qualidade', 'operacao'],
    exemplo: 'Quem está de férias?',
    async executar(ctx, { pessoa }) {
      const FE = require('./ferias');
      let todas; try { todas = await FE.listar(ctx.sb, ctx.tenantId); } catch { return { texto: 'O controle de férias ainda não está ativo (falta a migration 105).' }; }
      if (pessoa) {
        const xs = await acharColaborador(ctx, pessoa); if (xs.length !== 1) return qualPessoa(xs, pessoa);
        const c = xs[0]; const m = todas.filter((f) => String(f.colaborador_id) === String(c.id));
        const agora = m.find((f) => f.situacao === 'em_gozo'); const prox = m.filter((f) => f.situacao === 'programada').sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
        const ult = m.filter((f) => f.situacao === 'concluida').sort((a, b) => b.fim.localeCompare(a.fim))[0];
        let saldo = ''; try { const s = (await FE.saldos(ctx.sb, ctx.tenantId, { colaboradorId: c.id })).colaboradores[0]; // B1.6
          if (s && !s.admissao) saldo = '\n⚠ Sem data de admissão no cadastro — não consigo calcular o saldo.';
          else if (s?.atual?.situacao === 'em_aquisicao' && !s.a_gozar) { const p = s.atual; const fimP = p.fim; const prox = new Date(Date.parse(fimP) + 864e5).toISOString().slice(0, 10); // B1.8
            saldo = `\nPeríodo aquisitivo em andamento (admissão ${dBR(s.admissao)}): completa em ${dBR(prox)}, aí terá ${p.direito - p.gozado - p.programado} dia(s) para gozar até ${dBR(p.limite)}${p.faltas ? ` · ${p.faltas} falta(s) no período` : ''}.`; }
          else if (s?.atual) saldo = `\nSaldo: ${s.a_gozar} dia(s) a gozar${s.programado ? ` · ${s.programado} programado(s)` : ''}${s.proximo_limite ? ` · limite ${dBR(s.proximo_limite)}` : ''}${s.alerta === 'vencido' ? ' · ⛔ período vencido' : ''}${s.faltas_periodo > 5 ? ` · ${s.faltas_periodo} faltas no período` : ''}.`; } catch { /* sem 106 */ }
        if (agora) return { texto: `🏖 ${c.nome} está de férias até ${dBR(agora.fim)} — volta em ${dBR(agora.retorno)}.${prox ? ` Próximo período: ${dBR(prox.inicio)} a ${dBR(prox.fim)}.` : ''}${saldo}`, link: { tela: 'pessoas', aba: 'ferias' } };
        if (prox) return { texto: `${c.nome} sai de férias em ${dBR(prox.inicio)} (em ${prox.faltam_dias} dia(s)) e volta em ${dBR(prox.retorno)} — ${prox.dias} dia(s).${saldo}`, link: { tela: 'pessoas', aba: 'ferias' } };
        return { texto: `${c.nome} não tem férias programadas.${ult ? ` As últimas foram de ${dBR(ult.inicio)} a ${dBR(ult.fim)}.` : ''}${saldo}`, link: { tela: 'pessoas', aba: 'ferias' } };
      }
      const agora = todas.filter((f) => f.situacao === 'em_gozo');
      const prox = todas.filter((f) => f.situacao === 'programada' && f.faltam_dias <= 30).sort((a, b) => a.inicio.localeCompare(b.inicio));
      if (!agora.length && !prox.length) return { texto: 'Ninguém de férias agora, e ninguém sai nos próximos 30 dias.', link: { tela: 'pessoas', aba: 'ferias' } };
      const l = [];
      if (agora.length) l.push(`🏖 De férias agora (${agora.length}):\n${agora.map((f) => `• ${f.colaborador_nome} — volta em ${dBR(f.retorno)}`).join('\n')}`);
      if (prox.length) l.push(`📅 Saem nos próximos 30 dias (${prox.length}):\n${prox.map((f) => `• ${f.colaborador_nome} — ${dBR(f.inicio)} a ${dBR(f.fim)}`).join('\n')}`);
      return { texto: l.join('\n\n'), link: { tela: 'pessoas', aba: 'ferias' } };
    },
  },
  {
    nome: 'frota_disponivel',
    descricao: 'Quais equipamentos/ativos (de um TIPO — carreta, cavalo, ônibus, contêiner, gerador… — ou todos) estão LIVRES numa data ou período, e quando os ocupados ficam livres.',
    args: { tipo: 'tipo do equipamento, ex.: carreta, contêiner escritório (opcional)', data: 'data ou período, ex.: 01/01/2027, de 05 a 10/01, amanhã' },
    perfis: ['comprador', 'operacao', 'comercial'],
    exemplo: 'Tenho carreta livre em 01/01/2027?',
    async executar(ctx, { tipo, data }) { // B2.0
      const per = lerPeriodo(data || '', ctx.hoje); if (!per) return { texto: 'Para qual data (ou período)? Ex.: "01/01/2027", "amanhã", "de 05 a 10/01".' };
      const [de, ate] = per; if (ate < ctx.hoje) return { texto: `${dBR(de)}${ate !== de ? ` a ${dBR(ate)}` : ''} já passou — me diga uma data a partir de hoje.` };
      const T = require('./tiposEquipamento'); let tipos = []; try { tipos = await T.listar(ctx.sb, ctx.tenantId); } catch { /* sem 110 */ }
      const alvo = tipo ? T.tiposNaFrase(tipo, tipos) : [];
      if (tipo && !alvo.length && tipos.length) return { texto: `Não encontrei o tipo "${tipo}". Tipos cadastrados: ${tipos.filter((x) => x.ativo !== false).map((x) => x.nome).join(' · ')}. (Configurações → Tipos de equipamento)` };
      const { eqs, oc } = await mapaOcupacao(ctx, de, ate);
      const ids = new Set(alvo.map((x) => String(x.id)));
      const lista = eqs.filter((e) => e.situacao !== 'baixado' && e.ativo !== false && (!ids.size || ids.has(String(e.tipo_id))));
      const semTipo = ids.size ? eqs.filter((e) => !e.tipo_id).length : 0;
      const quando = de === ate ? `em ${dBR(de)}` : `de ${dBR(de)} a ${dBR(ate)}`;
      const nomeT = alvo.length ? alvo.map((x) => x.nome.toLowerCase()).join(' / ') : 'equipamento';
      if (!lista.length) return { texto: `Não há ${nomeT} cadastrado${semTipo ? ` (${semTipo} equipamento(s) estão sem tipo — Configurações → Tipos de equipamento → revisar)` : ''}.`, link: { tela: 'equipamentos' } };
      const rot = (e) => [e.tag, e.placa && e.placa !== e.tag ? e.placa : null, e.nome && e.nome !== e.tag ? e.nome : null].filter(Boolean).join(' · ');
      const livres = lista.filter((e) => !oc.has(String(e.id))); const ocup = lista.filter((e) => oc.has(String(e.id)));
      const grupo = (xs) => { if (ids.size <= 1 && alvo.length) return [[null, xs]]; const m = new Map(); for (const e of xs) { const t = tipos.find((x) => String(x.id) === String(e.tipo_id)); const k = t ? t.nome : 'Sem tipo'; if (!m.has(k)) m.set(k, []); m.get(k).push(e); } return [...m]; };
      const l = [livres.length ? `✅ Sim — ${livres.length} ${nomeT}${livres.length > 1 ? '(s)' : ''} livre(s) ${quando}:` : `⛔ Nenhum ${nomeT} livre ${quando}.`];
      for (const [k, xs] of grupo(livres)) l.push(`${k ? `${k}: ` : ''}${listaNomes(xs, rot, 12)}`);
      if (ocup.length) { l.push(`\nOcupados (${ocup.length}):`); for (const e of ocup.slice(0, 10)) { const os = oc.get(String(e.id)); const lib = os.every((x) => x.ate) ? os.map((x) => x.ate).sort().pop() : null; l.push(`• ${rot(e)} — ${os.map((x) => x.motivo).join(' + ')}${lib ? ` · livre a partir de ${dBR(somaD(lib, 1))}` : ''}`); } if (ocup.length > 10) l.push(`…e mais ${ocup.length - 10}`); }
      if (semTipo) l.push(`\n(${semTipo} equipamento(s) sem tipo não entraram — Configurações → Tipos de equipamento → revisar.)`);
      return { texto: l.join('\n'), link: { tela: 'programacao' } };
    },
  },
  {
    nome: 'disponibilidade_equipamento',
    descricao: 'Agenda/programação de uma carreta, cavalo, caminhão, máquina ou equipamento (por placa, TAG ou nome): próxima AT/viagem programada, se está livre, quando fica disponível, bloqueado, locado ou em manutenção.',
    args: { equipamento: 'placa, TAG ou nome do equipamento' },
    perfis: ['comprador', 'operacao'],
    exemplo: 'A carreta CR-07 está livre?',
    async executar(ctx, { equipamento }) {
      const eqs = await q(ctx.sb.from('equipamentos').select('*').eq('tenant_id', ctx.tenantId));
      const xs = achar(eqs, equipamento, ['tag', 'placa', 'nome']);
      if (!xs.length) return { texto: `Não encontrei o equipamento "${equipamento}" no cadastro.` };
      if (xs.length > 1) return { texto: `Encontrei ${xs.length} equipamentos com "${equipamento}": ${listaNomes(xs, (e) => [e.tag, e.nome].filter(Boolean).join(' '))}. Qual deles?` };
      const e = xs[0]; const rot = [e.tag, e.nome].filter(Boolean).join(' — '); const ag = new Date().toISOString();
      const ats = (await q(ctx.sb.from('execucoes').select('id, numero, status, inicio_previsto, fim_previsto, cliente_nome, destino, cavalo_id, conjunto').eq('tenant_id', ctx.tenantId)))
        .filter((x) => ['programada', 'em_execucao'].includes(x.status) && (String(x.cavalo_id) === String(e.id) || (Array.isArray(x.conjunto) && x.conjunto.some((c) => String(c.id) === String(e.id)))));
      const emCurso = ats.find((x) => x.status === 'em_execucao');
      const proximas = ats.filter((x) => x.status === 'programada').sort((a, b) => String(a.inicio_previsto || '9').localeCompare(String(b.inicio_previsto || '9')));
      let os = []; try { os = (await q(ctx.sb.from('ordens_servico').select('id, numero, status, descricao, servico_nome, equipamento_id').eq('tenant_id', ctx.tenantId).eq('equipamento_id', e.id))).filter((o) => !['concluida', 'finalizada', 'fechada', 'cancelada', 'encerrada'].includes(o.status)); } catch { /* sem OS */ }
      let contrato = null; if (e.locacao_id) { try { contrato = (await q(ctx.sb.from('locacao_contratos').select('id, numero, cliente, fim_previsto, status').eq('tenant_id', ctx.tenantId).eq('id', e.locacao_id)))[0] || null; } catch { /* ok */ } }
      const l = [];
      if (e.bloqueado) l.push(`⛔ BLOQUEADO na inspeção${e.bloqueio_motivo ? ` (${e.bloqueio_motivo})` : ''}${e.bloqueado_em ? ` desde ${dBR(e.bloqueado_em)}` : ''} — não sai até liberar.`);
      if (contrato && contrato.status === 'ativo') l.push(`📄 Locado no contrato ${contrato.numero} — ${contrato.cliente}${contrato.fim_previsto ? `, previsão de devolução ${dBR(contrato.fim_previsto)}` : ', sem data de devolução'}.`);
      if (os.length) l.push(`🔧 ${os.length} OS aberta(s): ${listaNomes(os, (o) => `${o.numero || ''} ${o.servico_nome || o.descricao || ''}`.trim(), 3)}.`);
      if (emCurso) l.push(`🚛 Em viagem na ${emCurso.numero}${emCurso.cliente_nome ? ` (${emCurso.cliente_nome}${emCurso.destino ? ` → ${emCurso.destino}` : ''})` : ''}${emCurso.fim_previsto ? `, término previsto ${dhBR(emCurso.fim_previsto)}` : ', sem término previsto'}.`);
      if (proximas.length) l.push(`📅 Próxima AT: ${proximas[0].numero} em ${dhBR(proximas[0].inicio_previsto)}${proximas[0].cliente_nome ? ` (${proximas[0].cliente_nome})` : ''}${proximas.length > 1 ? ` — e mais ${proximas.length - 1} programada(s)` : ''}.`);
      const livreAgora = !e.bloqueado && !emCurso && !(contrato && contrato.status === 'ativo') && !os.length;
      let resumo;
      if (livreAgora) resumo = proximas.length && proximas[0].inicio_previsto ? `✅ ${rot} está livre agora, até ${dhBR(proximas[0].inicio_previsto)}.` : `✅ ${rot} está livre — sem AT, OS, locação ou bloqueio.`;
      else if (e.bloqueado) resumo = `${rot} não está disponível.`;
      else if (emCurso) resumo = `${rot} fica disponível depois de ${emCurso.fim_previsto ? dhBR(emCurso.fim_previsto) : 'concluir a viagem atual'}${os.length ? ' e das OS abertas' : ''}.`;
      else resumo = `${rot} está ocupado.`;
      if (e.situacao && !['ativo', 'disponivel', 'operando'].includes(String(e.situacao))) l.push(`Situação no cadastro: ${e.situacao}.`);
      return { texto: [resumo, ...l].join('\n'), link: { tela: 'programacao' } };
    },
  },
  {
    nome: 'situacao_at',
    descricao: 'Situação de uma AT (autorização de transporte/viagem) pelo número: status, motorista, conjunto, horários.',
    args: { numero: 'número da AT, ex.: AT-0231' },
    perfis: ['operacao'],
    exemplo: 'Como está a AT-0231?',
    async executar(ctx, { numero }) {
      const ats = await q(ctx.sb.from('execucoes').select('*').eq('tenant_id', ctx.tenantId));
      const n = compacto(numero).replace(/^at/, '');
      let xs = ats.filter((a) => compacto(a.numero) === compacto(numero)); if (!xs.length) xs = ats.filter((a) => compacto(a.numero).endsWith(n) && n.length >= 2);
      if (!xs.length) return { texto: `Não encontrei a AT "${numero}".` };
      if (xs.length > 1) return { texto: `Encontrei ${xs.length} ATs: ${listaNomes(xs, (a) => a.numero)}. Qual delas?` };
      const a = xs[0]; const ST = { programada: '📅 programada', em_execucao: '🚛 em viagem', concluida: '✅ concluída', cancelada: '✕ cancelada' };
      const conj = Array.isArray(a.conjunto) && a.conjunto.length ? a.conjunto.map((c) => c.tag || c.nome).join(' + ') : null;
      return { texto: [`${a.numero} — ${ST[a.status] || a.status}${a.cliente_nome ? ` · ${a.cliente_nome}` : ''}`,
        `${a.origem || '?'} → ${a.destino || '?'}`,
        `Motorista: ${a.motorista_nome || '⚠ sem motorista'}${conj ? ` · Conjunto: ${conj}` : ''}`,
        a.status === 'concluida' ? `Concluída em ${dhBR(a.concluida_em)}` : a.status === 'em_execucao' ? `Saiu ${dhBR(a.iniciada_em)} · término previsto ${dhBR(a.fim_previsto)}` : `Início previsto ${dhBR(a.inicio_previsto)} · término ${dhBR(a.fim_previsto)}`].join('\n'), link: { tela: 'programacao' } };
    },
  },
  {
    nome: 'tarefas_pessoa',
    descricao: 'Tarefas abertas (atrasadas, de hoje, próximas) de uma pessoa — sem pessoa = as minhas.',
    args: { pessoa: 'nome (opcional; vazio = quem pergunta)' },
    perfis: ['comprador', 'operacao', 'qualidade', 'financeiro', 'comercial', 'fiscal'],
    exemplo: 'Quais são as minhas tarefas?',
    async executar(ctx, { pessoa }) {
      const ts = (await q(ctx.sb.from('tarefas').select('*').eq('tenant_id', ctx.tenantId))).filter((t) => ['pendente', 'em_andamento'].includes(t.status));
      let minhas, quem;
      const euMesmo = !pessoa || /^(eu|minhas?|meu|meus|mim)$/i.test(norm(pessoa));
      if (euMesmo) { minhas = ts.filter((t) => String(t.responsavel_usuario_id) === String(ctx.userId)); quem = 'Você'; }
      else {
        if (!ctx.perfis.some((p) => GESTAO.includes(p))) return { texto: 'Consigo mostrar só as suas tarefas — as de outras pessoas ficam com a gestão.' };
        const nomes = [...new Set(ts.map((t) => t.responsavel).filter(Boolean))].map((n) => ({ nome: n }));
        const xs = achar(nomes, pessoa, ['nome']);
        if (!xs.length) return { texto: `Não encontrei tarefas abertas de "${pessoa}".` };
        if (xs.length > 1) return { texto: `Encontrei ${xs.length} pessoas: ${listaNomes(xs, (x) => x.nome)}. Qual delas?` };
        quem = xs[0].nome; minhas = ts.filter((t) => t.responsavel === quem);
      }
      if (!minhas.length) return { texto: `${quem} não tem tarefas abertas. 🎉`, link: { tela: 'plano' } };
      const p = (t) => d10(t.prazo);
      const atr = minhas.filter((t) => p(t) && p(t) < ctx.hoje), hj = minhas.filter((t) => p(t) === ctx.hoje), res = minhas.filter((t) => !p(t) || p(t) > ctx.hoje).sort((a, b) => String(p(a) || '9').localeCompare(String(p(b) || '9')));
      const lin = (t) => `• ${t.numero ? `${t.numero} ` : ''}${t.titulo || 'Tarefa'}${p(t) ? ` — prazo ${dBR(p(t))}` : ''}`;
      const l = [`${quem} tem ${minhas.length} tarefa(s) aberta(s).`];
      if (atr.length) l.push(`⏰ Atrasadas (${atr.length}):\n${atr.slice(0, 5).map(lin).join('\n')}${atr.length > 5 ? `\n…e mais ${atr.length - 5}` : ''}`);
      if (hj.length) l.push(`📌 Para hoje:\n${hj.slice(0, 5).map(lin).join('\n')}`);
      if (res.length) l.push(`Próximas:\n${res.slice(0, 3).map(lin).join('\n')}`);
      return { texto: l.join('\n\n'), link: { tela: 'plano' } };
    },
  },
  {
    nome: 'contrato_cliente',
    descricao: 'Contratos de locação de um cliente: número, situação, início, previsão de término e equipamentos locados.',
    args: { cliente: 'nome do cliente' },
    perfis: ['comprador', 'operacao', 'qualidade', 'comercial'],
    exemplo: 'Qual o contrato ativo da Construtora Alfa?',
    async executar(ctx, { cliente }) {
      const cs = await q(ctx.sb.from('locacao_contratos').select('*').eq('tenant_id', ctx.tenantId));
      const xs = achar(cs, cliente, ['cliente', 'numero']);
      if (!xs.length) return { texto: `Não encontrei contrato de locação do cliente "${cliente}".` };
      const clientes = [...new Set(xs.map((c) => c.cliente))];
      if (clientes.length > 1) return { texto: `Encontrei contratos de ${clientes.length} clientes: ${listaNomes(clientes.map((n) => ({ n })), (x) => x.n)}. Qual deles?` };
      const eqs = await q(ctx.sb.from('equipamentos').select('id, tag, nome, locacao_id').eq('tenant_id', ctx.tenantId));
      const ativos = xs.filter((c) => c.status === 'ativo'), enc = xs.filter((c) => c.status !== 'ativo');
      const lin = (c) => { const e = eqs.filter((x) => String(x.locacao_id) === String(c.id)); return `• ${c.numero} — ${c.status === 'ativo' ? '🟢 ativo' : 'encerrado'} · início ${dBR(c.inicio)}${c.status === 'ativo' ? ` · término previsto ${c.fim_previsto ? dBR(c.fim_previsto) : 'em aberto'}` : c.fim_real ? ` · encerrado ${dBR(c.fim_real)}` : ''}${c.local ? ` · ${c.local}` : ''}${e.length ? `\n   Equipamentos: ${listaNomes(e, (x) => x.tag || x.nome, 6)}` : ''}`; };
      return { texto: `${clientes[0]}: ${ativos.length} contrato(s) ativo(s)${enc.length ? `, ${enc.length} encerrado(s)` : ''}.\n${[...ativos, ...enc.slice(0, 2)].map(lin).join('\n')}`, link: { tela: 'contratos' } };
    },
  },
  {
    nome: 'status_cotacao',
    descricao: 'Situação de uma cotação de compra (COT-…): quantos fornecedores responderam e quais ainda faltam. Sem número = cotações em aberto.',
    args: { numero: 'número da cotação, ex.: COT-2026-0012 (opcional)' },
    perfis: ['comprador'],
    exemplo: 'Quais fornecedores faltam responder a cotação 12?',
    async executar(ctx, { numero }) {
      const cots = await q(ctx.sb.from('cotacoes').select('*').eq('tenant_id', ctx.tenantId));
      const cfs = await q(ctx.sb.from('cotacao_fornecedores').select('*').eq('tenant_id', ctx.tenantId));
      const Visiveis = require('./fornecedoresVisiveis');
      const db = { select: async (tab, filtros = {}, tid) => { let r = ctx.sb.from(tab).select('*'); if (tid && tab !== 'tenant_fornecedores' && !filtros.tipo) r = r.eq('tenant_id', tid); for (const [k, v] of Object.entries(filtros)) r = r.eq(k, v); return q(r); } };
      const forn = await Visiveis.mapaFornecedoresDoTenant(db, ctx.tenantId, {}).catch(() => ({}));
      const nomeF = (id) => forn[String(id)]?.nome_fantasia || forn[String(id)]?.nome || `fornecedor ${id}`;
      const respondeu = (f) => ['respondido', 'respondida'].includes(f.status) || !!f.data_resposta;
      const resumo = (c) => { const fs = cfs.filter((f) => String(f.cotacao_id) === String(c.id)); const r = fs.filter(respondeu), rec = fs.filter((f) => f.status === 'recusado'), pend = fs.filter((f) => !respondeu(f) && f.status !== 'recusado'); return { fs, r, rec, pend }; };
      if (numero) {
        const n = compacto(numero).replace(/^cot/, '');
        let xs = cots.filter((c) => compacto(c.numero) === compacto(numero)); if (!xs.length && n) xs = cots.filter((c) => compacto(c.numero).endsWith(n.replace(/^0+/, '')) || compacto(c.numero).endsWith(n));
        if (!xs.length) return { texto: `Não encontrei a cotação "${numero}".` };
        if (xs.length > 1) return { texto: `Encontrei ${xs.length} cotações: ${listaNomes(xs, (c) => c.numero)}. Qual delas?` };
        const c = xs[0]; const { fs, r, rec, pend } = resumo(c);
        const l = [`${c.numero} — ${String(c.status || '').replace(/_/g, ' ')} · aberta em ${dBR(c.criado_em)}`, `${r.length} de ${fs.length} fornecedor(es) responderam${rec.length ? `, ${rec.length} recusou(aram)` : ''}.`];
        if (pend.length) l.push(`⏳ Faltam responder: ${listaNomes(pend, (f) => nomeF(f.fornecedor_id), 8)}.`);
        if (r.length) { const melhor = r.filter((f) => f.valor != null).sort((a, b) => Number(a.valor) - Number(b.valor))[0]; if (melhor) l.push(`💰 Menor preço até agora: ${nomeF(melhor.fornecedor_id)} — ${brl(melhor.valor)}${melhor.prazo ? ` · prazo ${melhor.prazo}` : ''}.`); }
        return { texto: l.join('\n'), link: { tela: 'compradora' } };
      }
      const abertas = cots.filter((c) => !['finalizada', 'finalizado', 'cancelada', 'concluida', 'aprovada'].includes(c.status));
      if (!abertas.length) return { texto: 'Nenhuma cotação em aberto agora.', link: { tela: 'compradora' } };
      return { texto: `${abertas.length} cotação(ões) em aberto:\n${abertas.sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em))).slice(0, 8).map((c) => { const { fs, r, pend } = resumo(c); return `• ${c.numero} — ${r.length}/${fs.length} responderam${pend.length ? ` · faltam ${pend.length}` : ''}`; }).join('\n')}`, link: { tela: 'compradora' } };
    },
  },
  {
    nome: 'status_bid',
    descricao: 'Situação de um BID/proposta comercial (por número ou cliente): se o cliente já viu, respondeu, pediu revisão ou aceitou.',
    args: { bid: 'número do BID ou nome do cliente' },
    perfis: ['comercial'],
    exemplo: 'O cliente já respondeu o BID da Transportes Beta?',
    async executar(ctx, { bid }) {
      const bs = await q(ctx.sb.from('bids').select('*').eq('tenant_id', ctx.tenantId));
      let xs = achar(bs, bid, ['numero']); if (!xs.length) xs = achar(bs, bid, ['cliente_nome', 'titulo', 'referencia']);
      if (!xs.length) return { texto: `Não encontrei BID de "${bid}".` };
      const vivos = xs.filter((b) => !['aceito', 'perdido'].includes(b.fase));
      if (xs.length > 1 && vivos.length !== 1) { const ys = vivos.length ? vivos : xs; if (ys.length > 1) return { texto: `Encontrei ${ys.length} BIDs: ${listaNomes(ys.sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em))), (b) => `${b.numero} (${b.cliente_nome})`)}. Qual deles?` }; xs = ys; }
      const b = vivos.length === 1 ? vivos[0] : xs[0];
      const FASE = { elaboracao: '✏ em elaboração (ainda não enviado)', aguardando_cliente: '⏳ aguardando o cliente', revisao_solicitada: '↩ o cliente pediu revisão', aguardando_aceite: '⏳ proposta final aguardando aceite', aceito: '✅ ACEITO', perdido: '✕ perdido' };
      const l = [`${b.numero} — ${b.cliente_nome}${b.titulo ? ` · ${b.titulo}` : ''}`, `Situação: ${FASE[b.fase] || b.fase}${b.valor_total != null ? ` · ${brl(b.valor_total)}` : ''}`];
      if (b.enviado_em && b.fase !== 'elaboracao') l.push(`Enviado em ${dhBR(b.enviado_em)}${b.versao_enviada ? ` (versão ${b.versao_enviada})` : ''}.`);
      // B2.1: resposta direta, como alguém do comercial falaria
      if (['aguardando_cliente', 'aguardando_aceite'].includes(b.fase)) l.unshift(b.visto_ultimo_em ? `👀 Leu ${quandoRel(b.visto_ultimo_em)}${(b.visto_qtd || 1) > 1 ? ` (abriu ${b.visto_qtd} vezes)` : ''}, mas ainda não respondeu.` : '📭 Ainda não abriu a proposta.');
      if (b.fase === 'revisao_solicitada') l.unshift(`↩ Respondeu ${quandoRel(b.respondido_em || b.atualizado_em)} pedindo revisão${b.revisao_motivo || b.comentario_cliente ? `: "${String(b.revisao_motivo || b.comentario_cliente).slice(0, 160)}"` : ''}.`);
      if (b.fase === 'aceito') l.unshift(`✅ Respondeu ${quandoRel(b.aceite_em || b.ganho_em)} — ACEITOU.`);
      if (b.fase === 'perdido') l.unshift(`✕ Recusou / perdido${b.motivo_perda ? ` — ${b.motivo_perda}` : ''}.`);
      if (b.fase === 'aceito') l.push(`Aceito ${b.aceite_nome ? `por ${b.aceite_nome}${b.aceite_cargo ? ` (${b.aceite_cargo})` : ''} ` : ''}em ${dhBR(b.aceite_em || b.ganho_em)}.`);
      if (b.fase === 'perdido' && b.motivo_perda) l.push(`Motivo: ${b.motivo_perda}.`);
      if (b.valido_ate && !['aceito', 'perdido'].includes(b.fase)) l.push(`Validade da proposta: ${dBR(b.valido_ate)}${d10(b.valido_ate) < ctx.hoje ? ' (⚠ vencida)' : ''}.`);
      return { texto: l.join('\n'), link: { tela: 'comercial' } };
    },
  },
  {
    nome: 'documentacao_transporte',
    descricao: 'Documentação fiscal do transporte (NF-e, CT-e, averbação, MDF-e) de um pedido/cliente/AT: o que já foi emitido e o que falta.',
    args: { ref: 'nome do cliente, nº do pedido (PV) ou da AT' },
    perfis: ['fiscal', 'financeiro', 'comercial', 'operacao'],
    exemplo: 'Como está a documentação do transporte da Iron Maquinas?',
    async executar(ctx, { ref }) { // B2.1: lê a tarefa fiscal (checklist) de cada trecho
      const TF = require('./tarefasFiscais');
      const pvs = (await q(ctx.sb.from('pedidos_venda').select('*').eq('tenant_id', ctx.tenantId))).filter((p) => p.status !== 'cancelado');
      const ats = await q(ctx.sb.from('execucoes').select('*').eq('tenant_id', ctx.tenantId)).catch(() => []);
      let alvo = []; const c = compacto(ref);
      const at = ats.find((a) => compacto(a.numero) === c || (c.length >= 3 && compacto(a.numero).endsWith(c.replace(/^at/, ''))));
      if (/^(at|pv|\d)/.test(c) && at) alvo = pvs.filter((p) => String(p.id) === String(at.pv_id)).map((p) => ({ pv: p, grupo: at.grupo_id }));
      if (!alvo.length) { const xs = pvs.filter((p) => compacto(p.numero) === c || (c.length >= 3 && /\d/.test(c) && compacto(p.numero).endsWith(c.replace(/^pv/, '')))); alvo = xs.map((p) => ({ pv: p })); }
      if (!alvo.length) { const xs = achar(pvs, ref, ['cliente_nome', 'titulo', 'referencia']).filter((p) => p.status !== 'concluido'); alvo = xs.map((p) => ({ pv: p })); }
      if (!alvo.length) return { texto: `Não encontrei pedido de transporte em aberto de "${ref}".` };
      const ts = (await q(ctx.sb.from('tarefas').select('*').eq('tenant_id', ctx.tenantId))).filter((x) => x.origem === 'fiscal' && x.status !== 'cancelada');
      const IT = TF.ITENS; const l = [];
      for (const { pv, grupo } of alvo.slice(0, 4)) {
        const grupos = (pv.grupos || []).filter((g) => !grupo || String(g.id) === String(grupo));
        for (const g of grupos) {
          const tf = ts.find((x) => String(x.origem_ref) === `${pv.id}:${g.id}`); const titulo = `${pv.numero} · ${pv.cliente_nome || ''} · ${g.titulo || 'trecho'}`;
          if (!tf) { l.push(`• ${titulo}: sem tarefa fiscal ainda (ela nasce com a programação).`); continue; }
          const rs = TF.resumo(tf.checklist || {}); if (!rs) { l.push(`• ${titulo}: checklist vazio.`); continue; }
          if (rs.dispensa) { l.push(`• ${titulo}: documentação dispensada — ${rs.dispensa.motivo || ''}`); continue; }
          const marca = TF.ORDEM.map((k) => `${IT[k]} ${rs.itens[k] ? '✓' : '✗'}`).join(' · '); const falta = TF.ORDEM.filter((k) => !rs.itens[k]).map((k) => IT[k]);
          const sit = !falta.length ? (rs.encerramento?.pendentes?.length ? '✅ emitida — falta encerrar o MDF-e' : '✅ completa') : rs.feitos ? `🟡 parcialmente emitida — falta ${falta.join(', ').replace(/, ([^,]*)$/, ' e $1').toLowerCase()}` : `⛔ nada emitido ainda — falta ${falta.join(', ')}`;
          l.push(`• ${titulo}: ${sit}\n   ${marca}${tf.prazo ? ` · prazo ${dBR(tf.prazo)}` : ''}${rs.alertas?.length ? `\n   ⚠ ${rs.alertas[0]}` : ''}`);
        }
      }
      return { texto: l.join('\n') || 'Sem trechos de transporte nesse pedido.', link: { tela: 'plano' } };
    },
  },
  {
    nome: 'situacao_os',
    descricao: 'Situação da manutenção / OS (ordem de serviço) de um equipamento (por TAG, placa ou nome) ou pelo nº da OS: % concluída e o que falta.',
    args: { ref: 'TAG/placa/nome do equipamento ou nº da OS' },
    perfis: ['operacao', 'comprador'],
    exemplo: 'Como está a manutenção da carreta CR-07?',
    async executar(ctx, { ref }) { // B2.1: % pela mesma regra da tela da OS (material aplicado; serviço concluído ou horas apontadas ÷ previstas)
      const chs = (await q(ctx.sb.from('chamados').select('*').eq('tenant_id', ctx.tenantId)).catch(() => []));
      const eqs = await q(ctx.sb.from('equipamentos').select('*').eq('tenant_id', ctx.tenantId)).catch(() => []);
      const aberta = (o) => !o.concluida_em && !['concluida', 'concluido', 'finalizada', 'finalizado', 'cancelada', 'cancelado', 'fechada'].includes(o.status);
      const c = compacto(ref); let os = chs.filter((o) => o.numero && (compacto(o.numero) === c || (c.length >= 3 && /\d/.test(c) && compacto(o.numero).endsWith(c.replace(/^os/, '')))));
      let eq = null;
      if (!os.length) { let xs = achar(eqs, ref, ['tag', 'placa']); if (!xs.length) xs = achar(eqs, ref, ['nome']);
        if (!xs.length) return { texto: `Não encontrei a OS nem o equipamento "${ref}".` };
        if (xs.length > 1) return { texto: `Encontrei ${xs.length} equipamentos: ${listaNomes(xs, (e) => [e.tag, e.nome].filter(Boolean).join(' '))}. Qual deles?` };
        eq = xs[0]; os = chs.filter((o) => String(o.equipamento_id) === String(eq.id) && aberta(o));
        if (!os.length) { const ult = chs.filter((o) => String(o.equipamento_id) === String(eq.id)).sort((a, b) => String(b.concluida_em || b.criado_em || '').localeCompare(String(a.concluida_em || a.criado_em || '')))[0];
          return { texto: `✅ ${[eq.tag, eq.nome].filter(Boolean).join(' — ')} não tem manutenção em aberto.${ult ? ` Última OS: ${ult.numero || ''} (${String(ult.status || '').replace(/_/g, ' ')}${ult.concluida_em ? `, concluída ${dBR(ult.concluida_em)}` : ''}).` : ''}${eq.bloqueado ? `\n⛔ Mas está BLOQUEADO na inspeção${eq.bloqueio_motivo ? ` (${eq.bloqueio_motivo})` : ''}.` : ''}`, link: { tela: 'equipamentos' } }; } }
      const itensT = await q(ctx.sb.from('chamado_itens').select('*').eq('tenant_id', ctx.tenantId)).catch(() => []);
      const apont = await q(ctx.sb.from('chamado_apontamentos').select('*').eq('tenant_id', ctx.tenantId)).catch(() => []);
      const horas = (it) => apont.filter((a) => String(a.chamado_item_id) === String(it.id) && a.status === 'ativo'); const somaH = (xs) => xs.reduce((s, a) => s + ['horas_normais_diurnas', 'horas_normais_noturnas', 'horas_excepcionais', 'horas_extras_diurnas', 'horas_extras_noturnas'].reduce((t, k) => t + (parseFloat(a[k]) || 0), 0), 0);
      const plan = (it) => { if (!it.data_inicio_prevista || !it.data_fim_prevista) return null; const h = (Date.parse(it.data_fim_prevista) - Date.parse(it.data_inicio_prevista)) / 36e5; return h > 0 ? h * (Number(it.qtd_pessoas_planejada) || 1) : null; };
      const prog = (it) => { if (it.tipo === 'material') { if (it.status_aplicacao === 'nao_aplicado') return 1; const p = parseFloat(it.quantidade) || 0; return p > 0 ? Math.min(1, (parseFloat(it.quantidade_aplicada) || 0) / p) : 0; }
        if (it.servico_concluido_manual) return 1; const h = horas(it); const pl = plan(it); if (pl == null) return h.length ? 1 : 0; const tot = somaH(h); return tot >= pl ? 1 : Math.min(0.99, tot / pl); };
      const l = [];
      for (const o of os.slice(0, 3)) {
        const its = itensT.filter((i) => String(i.chamado_id) === String(o.id) && i.status !== 'cancelado'); const ps = its.map(prog);
        const pct = its.length ? Math.round(ps.reduce((a, b) => a + b, 0) / its.length * 100) : (o.percentual_conclusao ?? null);
        const e2 = eq || eqs.find((x) => String(x.id) === String(o.equipamento_id));
        const falta = its.map((it, k) => [it, ps[k]]).filter(([, p]) => p < 1).map(([it, p]) => `${it.descricao || it.item_nome || it.nome || 'item'}${it.tipo === 'material' ? ` (material ${parseFloat(it.quantidade_aplicada) || 0}/${parseFloat(it.quantidade) || 0})` : p > 0 ? ` (${Math.round(p * 100)}% das horas)` : ''}`);
        l.push(`🔧 ${o.numero || 'OS'}${e2 ? ` · ${[e2.tag, e2.nome].filter(Boolean).join(' — ')}` : ''} — ${String(o.status || 'aberta').replace(/_/g, ' ')}${pct != null ? ` · ${pct}% concluída` : ''}${o.data_fim_prevista ? ` · previsão ${dBR(o.data_fim_prevista)}` : ''}${o.responsavel ? ` · resp. ${o.responsavel}` : ''}`);
        if (falta.length) l.push(`   Faltam: ${falta.slice(0, 6).join(' · ')}${falta.length > 6 ? ` · e mais ${falta.length - 6}` : ''}`); else if (its.length) l.push('   Todos os itens concluídos — falta encerrar a OS.');
      }
      if (os.length > 3) l.push(`…e mais ${os.length - 3} OS em aberto.`);
      return { texto: l.join('\n'), link: { tela: 'equipamentos' } };
    },
  },
  {
    nome: 'peca_fornecedor',
    descricao: 'Procura uma peça pelo part number/código (ou nome) no catálogo e diz quais fornecedores cadastrados vendem, com preço da tabela.',
    args: { peca: 'part number, código ou nome da peça' },
    perfis: ['comprador', 'operacao'],
    exemplo: 'Quem tem a peça SKF-6205?',
    async executar(ctx, { peca }) {
      const cat = await q(ctx.sb.from('catalogo_itens').select('*').eq('tenant_id', ctx.tenantId));
      let itens = achar(cat, peca, ['codigo']); if (!itens.length) itens = achar(cat, peca, ['nome', 'marca', 'modelo']);
      const fi = await q(ctx.sb.from('fornecedor_itens').select('*').eq('tenant_id', ctx.tenantId)).catch(() => []);
      // o fornecedor pode ter o código próprio dele
      const tc = compacto(peca);
      if (!itens.length && tc.length >= 3) { const ids = new Set(fi.filter((x) => Object.entries(x).some(([k, v]) => /codigo|part|descricao/.test(k) && v && compacto(v).includes(tc))).map((x) => String(x.item_catalogo_id))); itens = cat.filter((c) => ids.has(String(c.id))); }
      if (!itens.length) return { texto: `Não encontrei "${peca}" no catálogo de peças — nenhum fornecedor cadastrado tem esse código.`, link: { tela: 'catalogo' } };
      if (itens.length > 4) return { texto: `Encontrei ${itens.length} peças com "${peca}": ${listaNomes(itens, (c) => `${c.codigo ? `${c.codigo} ` : ''}${c.nome}`)}. Qual delas (pode mandar o código)?`, link: { tela: 'catalogo' } };
      const Visiveis = require('./fornecedoresVisiveis');
      const db = { select: async (tab, filtros = {}, tid) => { let r = ctx.sb.from(tab).select('*'); if (tid && tab !== 'tenant_fornecedores' && !filtros.tipo) r = r.eq('tenant_id', tid); for (const [k, v] of Object.entries(filtros)) r = r.eq(k, v); return q(r); } };
      const forn = await Visiveis.mapaFornecedoresDoTenant(db, ctx.tenantId, { somenteAtivos: true }).catch(() => ({}));
      const l = [];
      for (const it of itens) {
        const ofertas = fi.filter((x) => String(x.item_catalogo_id) === String(it.id) && x.ativo !== false && forn[String(x.fornecedor_id)])
          .sort((a, b) => (Number(a.preco_unitario) || 9e12) - (Number(b.preco_unitario) || 9e12));
        const nome = `${it.codigo ? `${it.codigo} — ` : ''}${it.nome}${it.marca ? ` (${it.marca})` : ''}`;
        if (!ofertas.length) { l.push(`• ${nome}: está no catálogo, mas nenhum fornecedor ativo tem na tabela.`); continue; }
        l.push(`• ${nome}: ${ofertas.length} fornecedor(es)\n${ofertas.slice(0, 5).map((o) => `   ${forn[String(o.fornecedor_id)].nome_fantasia || forn[String(o.fornecedor_id)].nome} — ${o.preco_unitario != null ? brl(o.preco_unitario) : 'sem preço'}${o.data_tabela ? ` (tabela de ${dBR(o.data_tabela)})` : ''}`).join('\n')}`);
      }
      return { texto: l.join('\n'), link: { tela: 'catalogo' } };
    },
  },
];

/** B2.0: ⚡ roteador local (sem IA) — perguntas comuns por palavras-chave; null = deixa para o modelo */
async function rotearLocal(sb, ctx, texto, hist = []) {
  const s = norm(texto); const ok = (n) => permitidas(ctx.perfis).some((c) => c.nome === n);
  if (/\b(como (esta|anda|vai) (a |minha |nossa )?empresa|visao geral|resumo (do dia|da empresa|geral)|como estamos)\b/.test(s)) return { consulta: '__painel', local: true };
  let m = String(texto).match(/\bAT[-\s]?(\d{2,})/i); if (m && ok('situacao_at')) return { consulta: 'situacao_at', args: { numero: m[0].replace(/\s/, '-') }, local: true };
  m = String(texto).match(/\bBID[-\s]?\d{2,}/i); if (m && ok('status_bid')) return { consulta: 'status_bid', args: { bid: m[0] }, local: true };
  m = s.match(/\b(?:cot|cotacao)(?: n[oº]?)?\s*(\d{1,})/); if (m && ok('status_cotacao')) return { consulta: 'status_cotacao', args: { numero: m[1] }, local: true };
  m = String(texto).match(/\bOS[-\s]?\d{2,}[-\d]*/i); if (m && ok('situacao_os')) return { consulta: 'situacao_os', args: { ref: m[0] }, local: true }; // B2.1
  if (/\b(manutencao|conserto|oficina)\b/.test(s) && ok('situacao_os')) { const eqs = await q(sb.from('equipamentos').select('id, tag, placa, nome').eq('tenant_id', ctx.tenantId)).catch(() => []);
    const tok = String(texto).split(/[\s,?!.]+/).filter((w) => w.length >= 3 && /\d/.test(w)); const eq = eqs.find((e) => tok.some((w) => [e.tag, e.placa].filter(Boolean).some((x) => compacto(x) === compacto(w))));
    if (eq) return { consulta: 'situacao_os', args: { ref: eq.tag || eq.placa }, local: true }; }
  if (/\b(livres?|disponive(l|is)|vagos?|desocupad[oa]s?|parad[oa]s? no patio)\b/.test(s)) {
    const eqs = await q(sb.from('equipamentos').select('id, tag, placa, nome').eq('tenant_id', ctx.tenantId)).catch(() => []);
    const tok = String(texto).split(/[\s,?!.]+/).filter((w) => w.length >= 3 && /\d/.test(w));
    const eq = eqs.find((e) => tok.some((w) => [e.tag, e.placa].filter(Boolean).some((x) => compacto(x) === compacto(w))));
    if (eq && ok('disponibilidade_equipamento')) return { consulta: 'disponibilidade_equipamento', args: { equipamento: eq.tag || eq.placa }, local: true };
    if (ok('frota_disponivel') && lerPeriodo(texto, hojeBR())) { let tps = []; try { tps = require('./tiposEquipamento').tiposNaFrase(texto, await require('./tiposEquipamento').listar(sb, ctx.tenantId)); } catch { /* ok */ }
      return { consulta: 'frota_disponivel', args: { tipo: tps.length ? tps.map((x) => x.nome).join(', ') : undefined, data: texto }, local: true }; }
  }
  return null;
}

const permitidas = (perfis) => CONSULTAS.filter((c) => perfis.some((p) => GESTAO.includes(p) || c.perfis.includes(p)));

async function executar(sb, { tenantId, userId, perfis }, nome, args = {}) {
  const c = permitidas(perfis).find((x) => x.nome === nome);
  if (!c) return { texto: 'Essa consulta não está liberada para o seu perfil.' };
  const limpos = {}; for (const k of Object.keys(c.args)) { const v = args?.[k]; if (v != null && String(v).trim()) limpos[k] = String(v).trim().slice(0, 120); }
  const obrig = Object.entries(c.args).filter(([, d]) => !/opcional/.test(d)).map(([k]) => k).filter((k) => !limpos[k]);
  if (obrig.length) return { texto: `Me diga ${obrig.map((k) => c.args[k].split(',')[0]).join(' e ')}, por favor.` };
  return c.executar({ sb, tenantId, userId, perfis, hoje: hojeBR() }, limpos);
}

module.exports = { CONSULTAS, permitidas, executar, achar, norm, rotearLocal, lerData, lerPeriodo, mapaOcupacao };
