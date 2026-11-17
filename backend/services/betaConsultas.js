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
const listaNomes = (xs, f, max = 5) => xs.slice(0, max).map(f).join(' · ') + (xs.length > max ? ` · e mais ${xs.length - max}` : '');
const situacaoVenc = (v, hoje) => { if (!v) return 'sem vencimento'; const d = diasEntre(hoje, v); return d < 0 ? `⛔ venceu em ${dBR(v)} (há ${-d} dia(s))` : d === 0 ? `⚠ vence HOJE (${dBR(v)})` : d <= 30 ? `⚠ vence em ${dBR(v)} (em ${d} dia(s))` : `vence em ${dBR(v)} (em ${d} dias)`; };

async function acharColaborador(ctx, termo) {
  const cs = (await q(ctx.sb.from('colaboradores').select('*').eq('tenant_id', ctx.tenantId))).filter((c) => c.situacao !== 'desligado');
  return achar(cs, termo, ['nome']);
}
const qualPessoa = (xs, termo) => (!xs.length ? { texto: `Não encontrei ninguém chamado "${termo}" no cadastro de pessoas.` }
  : { texto: `Encontrei ${xs.length} pessoas com "${termo}": ${listaNomes(xs, (c) => c.nome)}. Qual delas?` });

// ═════════════════════════════════════════════════════════════════════════════
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
    descricao: 'Dados de cadastro de um funcionário: CPF, admissão (tempo de casa), função, telefone, e-mail, nascimento, categoria da CNH, situação.',
    args: { pessoa: 'nome do funcionário', campo: 'qual dado, ex.: CPF, telefone (opcional)' },
    perfis: ['qualidade'],
    exemplo: 'Qual o telefone da Ana?',
    async executar(ctx, { pessoa, campo }) { // B1.8: mesma regra da tela Pessoas — CPF completo só para quem edita (admin/gestor/qualidade)
      const xs = await acharColaborador(ctx, pessoa); if (xs.length !== 1) return qualPessoa(xs, pessoa);
      const c = xs[0]; const edita = ctx.perfis.some((p) => ['admin', 'gestor', 'qualidade'].includes(p));
      const cpf = c.cpf ? (edita ? String(c.cpf).replace(/\D/g, '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : `***.***.***-${String(c.cpf).slice(-2)}`) : null;
      const casa = (() => { if (!c.admissao) return null; const m = Math.floor(diasEntre(c.admissao, ctx.hoje) / 30.44); return m >= 12 ? `${Math.floor(m / 12)} ano(s)${m % 12 ? ` e ${m % 12} mês(es)` : ''}` : `${m} mês(es)`; })();
      const F = [['cpf', 'CPF', cpf], ['admissao', 'Admissão', c.admissao ? `${dBR(c.admissao)}${casa ? ` (${casa} de casa)` : ''}` : null], ['funcao', 'Função', c.funcao], ['telefone', 'Telefone', c.telefone], ['email', 'E-mail', c.email],
        ['nascimento', 'Nascimento', c.data_nascimento ? dBR(c.data_nascimento) : null], ['cnh', 'CNH', c.cnh_categoria ? `categoria ${c.cnh_categoria}${c.cnh_validade ? ` · validade ${dBR(c.cnh_validade)}` : ''}` : null], ['situacao', 'Situação', c.situacao]];
      const pedido = campo ? F.filter(([k, rot]) => norm(campo).includes(k) || norm(rot).includes(norm(campo)) || (k === 'admissao' && /contrat|entrou|casa/.test(norm(campo))) || (k === 'telefone' && /celular|fone|whats/.test(norm(campo)))) : [];
      const lista = pedido.length ? pedido : F;
      return { texto: `${c.nome}:\n${lista.map(([, rot, v]) => `• ${rot}: ${v || 'não cadastrado'}`).join('\n')}${cpf && !edita && lista.some(([k]) => k === 'cpf') ? '\n(CPF completo só para quem edita Pessoas.)' : ''}`, link: { tela: 'pessoas', colaborador: c.id } };
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
    nome: 'disponibilidade_equipamento',
    descricao: 'Se uma carreta, cavalo, caminhão, máquina ou equipamento (por placa, TAG ou nome) está livre, quando fica disponível, se está bloqueado, locado ou em manutenção.',
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
      if (['aguardando_cliente', 'aguardando_aceite', 'revisao_solicitada'].includes(b.fase)) l.push(b.visto_ultimo_em ? `👀 O cliente abriu ${b.visto_qtd || 1} vez(es) — a última em ${dhBR(b.visto_ultimo_em)}.` : '👀 O cliente ainda não abriu o link.');
      if (b.respondido_em && b.fase === 'revisao_solicitada') l.push(`Respondeu em ${dhBR(b.respondido_em)}.`);
      if (b.fase === 'aceito') l.push(`Aceito ${b.aceite_nome ? `por ${b.aceite_nome}${b.aceite_cargo ? ` (${b.aceite_cargo})` : ''} ` : ''}em ${dhBR(b.aceite_em || b.ganho_em)}.`);
      if (b.fase === 'perdido' && b.motivo_perda) l.push(`Motivo: ${b.motivo_perda}.`);
      if (b.valido_ate && !['aceito', 'perdido'].includes(b.fase)) l.push(`Validade da proposta: ${dBR(b.valido_ate)}${d10(b.valido_ate) < ctx.hoje ? ' (⚠ vencida)' : ''}.`);
      return { texto: l.join('\n'), link: { tela: 'comercial' } };
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

const permitidas = (perfis) => CONSULTAS.filter((c) => perfis.some((p) => GESTAO.includes(p) || c.perfis.includes(p)));

async function executar(sb, { tenantId, userId, perfis }, nome, args = {}) {
  const c = permitidas(perfis).find((x) => x.nome === nome);
  if (!c) return { texto: 'Essa consulta não está liberada para o seu perfil.' };
  const limpos = {}; for (const k of Object.keys(c.args)) { const v = args?.[k]; if (v != null && String(v).trim()) limpos[k] = String(v).trim().slice(0, 120); }
  const obrig = Object.entries(c.args).filter(([, d]) => !/opcional/.test(d)).map(([k]) => k).filter((k) => !limpos[k]);
  if (obrig.length) return { texto: `Me diga ${obrig.map((k) => c.args[k].split(',')[0]).join(' e ')}, por favor.` };
  return c.executar({ sb, tenantId, userId, perfis, hoje: hojeBR() }, limpos);
}

module.exports = { CONSULTAS, permitidas, executar, achar, norm };
