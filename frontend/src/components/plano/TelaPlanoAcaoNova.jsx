// components/plano/TelaPlanoAcaoNova.jsx — ✅ Plano de ação
//   18g: 🔗 rastreabilidade — número TSK-<tipo>-<ano>-<nnnn> (imutável), "ambientes" por tipo (TR · NC · AU · MT · CM · HR · GN),
//        📎 evidências, 📜 histórico (quem fez o quê e quando), 🔗 vínculos (BID → PV → TSK → AT…).
//   18g.1: 🧾 tarefa fiscal (origem 'fiscal'): checklist NF-e → CT-e → averbação → MDF-e; conclui sozinha; "Dispensar" cancela.
//          props ambienteInicial (perfil Fiscal abre em TR) e abrirTarefa ({ numero }) — vem do selo da Mesa.
//   18g.2a: 👤 responsável escolhido do cadastro (digita e o sistema encontra usuários e colaboradores) + filtro "👤 Minhas".
//   18g.2b: 📅 período (abertura · prazo · conclusão) + responsável; resumo do filtro; 📑 relatório, 🔎 modo auditoria (histórico, evidências, vínculos) e ⬇ CSV.
//        Tarefa numerada não se exclui: cancela (fica no histórico). Confirmações no modal do app (sem window.confirm/alert).
import { useState, useEffect } from 'react';
import { useTarefas } from '../../hooks/useTarefas';
import apiService from '../../services/apiService';
import ChecklistFiscal from './ChecklistFiscal'; // 18g.1
import CampoPessoa from '../shared/CampoPessoa'; // 18g.2a
import FiltroPeriodo, { faixaPeriodo } from '../shared/FiltroPeriodo'; // 18g.2b
import { resumoTarefas, dataBase, abrirRelatorioTarefas, csvTarefas, TIPOS_REL } from '../../utils/gerarRelatorioTarefas'; // 18g.2b

export const TIPOS_TAREFA = {
  TR: { nome: 'Transporte', icone: '🚚' }, NC: { nome: 'Não conformidade', icone: '⚠️' }, AU: { nome: 'Auditoria', icone: '🔎' },
  MT: { nome: 'Manutenção', icone: '🔧' }, CM: { nome: 'Comercial', icone: '📈' }, HR: { nome: 'Pessoas', icone: '👥' }, GN: { nome: 'Geral', icone: '📌' },
};
const VINC = { bid: 'BID', pv: 'Pedido', trecho: 'Trecho', at: 'AT', nc: 'NC', prospeccao: 'Prospecção', contrato: 'Contrato', inspecao: 'Inspeção', multa: 'Multa', autuacao: 'Autuação', tarefa: 'Tarefa' };
const EVENTO = { at: 'qf-abrir-at', prospeccao: 'qf-abrir-prospeccao', contrato: 'qf-abrir-contrato', ocorrencia: 'qf-abrir-ocorrencia' }; // 18h.3.2: ⚠️ SIN abre a ocorrência
const ACAO = { criada: '✨ criada', status: '🔄 situação', editada: '✏️ editada', reclassificada: '🏷 reclassificada', anexo: '📎 evidência', anexo_removido: '🗑 evidência removida' };
const FORM0 = { titulo: '', detalhe: '', responsavel: '', responsavel_ref: null, prazo: '', prioridade: 'media', status: 'pendente', tipo: 'GN' };
const refDe = (t) => (t.responsavel_colaborador_id != null ? `c:${t.responsavel_colaborador_id}` : t.responsavel_usuario_id != null ? `u:${t.responsavel_usuario_id}` : null);
const lerBase64 = (f) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => erro(new Error('Não consegui ler o arquivo')); r.readAsDataURL(f); });
const tipoDe = (t) => t.tipo || ({ prospeccao: 'CM', multa: 'HR', autuacao: 'NC', fiscal: 'TR' }[t.origem]) || 'GN';

export default function TelaPlanoAcaoNova({ onVoltar, C, s, ambienteInicial = 'todos', abrirTarefa = null }) {
  const { dados: tarefas, loading, erro, listar, criar, atualizar, deletar, adicionarComentario } = useTarefas();
  const [filtro, setFiltro] = useState('abertas');
  const [ambiente, setAmbiente] = useState(ambienteInicial);
  const [search, setSearch] = useState('');
  const [per, setPer] = useState(faixaPeriodo('tudo')); // 18g.2b
  const [base, setBase] = useState('abertura'); // 18g.2b: abertura · prazo · conclusao
  const [fResp, setFResp] = useState(''); // 18g.2b
  const [modal, setModal] = useState(null);
  const [aberta, setAberta] = useState(null); // { id, aba }
  const [novoComent, setNovoComent] = useState('');
  const [processando, setProcessando] = useState(false);
  const [form, setForm] = useState(FORM0);
  const [aviso, setAviso] = useState(null);
  const [confirmar, setConfirmar] = useState(null); // { texto, acao }
  const [enviando, setEnviando] = useState(false);
  const [gente, setGente] = useState({ eu: null, pessoas: [] }); // 18g.2a

  useEffect(() => { listar(); apiService.get('/tarefas/pessoas').then((r) => setGente({ eu: r?.eu ?? null, pessoas: r?.pessoas || [] })).catch(() => {}); }, []); // eslint-disable-line
  useEffect(() => { if (!abrirTarefa?.numero) return; setAmbiente('todos'); setFiltro('todos'); setSearch(abrirTarefa.numero); }, [abrirTarefa]); // 18g.1: veio do selo da Mesa
  useEffect(() => { if (!abrirTarefa?.numero) return; const t = (tarefas || []).find((x) => x.numero === abrirTarefa.numero); if (t && aberta?.id !== t.id) setAberta({ id: t.id, aba: t.origem === 'fiscal' ? 'fiscal' : 'hist' }); }, [abrirTarefa, tarefas]); // eslint-disable-line
  useEffect(() => { if (!aviso) return; const x = setTimeout(() => setAviso(null), aviso.erro ? 7000 : 3500); return () => clearTimeout(x); }, [aviso]);
  const ok = (t) => setAviso({ t }); const falha = (e) => setAviso({ t: e?.message || String(e), erro: true });

  const lista = tarefas || [];
  const noPer = (t) => { if (!per.de) return true; const d = dataBase(t, base); return !!d && d >= per.de && d <= per.ate; }; // 18g.2b
  const responsaveis = [...new Set(lista.map((t) => t.responsavel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const doAmbiente = lista.filter((t) => (ambiente === 'todos' || tipoDe(t) === ambiente) && noPer(t) && (!fResp || t.responsavel === fResp));
  const q = search.trim().toLowerCase();
  const tarefasFiltradas = doAmbiente
    .filter((t) => filtro === 'todos' || (filtro === 'abertas' ? !['concluida', 'cancelada'].includes(t.status) : filtro === 'minhas' ? (gente.eu != null && String(t.responsavel_usuario_id ?? '') === String(gente.eu) && !['concluida', 'cancelada'].includes(t.status)) : t.status === filtro || t.prioridade === filtro))
    .filter((t) => !q || [t.numero, t.titulo, t.responsavel, t.detalhe, ...(t.vinculos || []).map((v) => v.numero)].some((x) => String(x || '').toLowerCase().includes(q)))
    .sort((a, b) => String(a.prazo || '9999').localeCompare(String(b.prazo || '9999')) || String(a.numero || '').localeCompare(String(b.numero || '')));

  const total = doAmbiente.length;
  const concluidas = doAmbiente.filter((t) => t.status === 'concluida').length;
  const emAndamento = doAmbiente.filter((t) => t.status === 'em_andamento').length;
  const hojeIso = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  const atrasadas = doAmbiente.filter((t) => !['concluida', 'cancelada'].includes(t.status) && t.prazo && String(t.prazo).slice(0, 10) < hojeIso).length;
  const pctConclusao = total ? Math.round(concluidas / total * 100) : 0;
  const contaTipo = (k) => lista.filter((t) => tipoDe(t) === k && !['concluida', 'cancelada'].includes(t.status)).length;

  const statusTarefaCfg = {
    pendente: { l: 'Pendente', c: '#64748b', bg: '#1e2535', icon: '○' },
    em_andamento: { l: 'Em andamento', c: '#3b82f6', bg: '#0f1e35', icon: '◑' },
    concluida: { l: 'Concluída', c: '#22c55e', bg: '#0f2f1a', icon: '●' },
    cancelada: { l: 'Cancelada', c: '#ef4444', bg: '#2d1515', icon: '✕' },
  };
  const prioridadeTarefaCfg = { alta: { l: 'Alta', c: '#ef4444' }, media: { l: 'Média', c: '#f59e0b' }, baixa: { l: 'Baixa', c: '#22c55e' } };

  const fmtDataPrazo = (d) => {
    if (!d) return null;
    const str = String(d).slice(0, 10).split('-').reverse().join('/');
    const diff = Math.round((new Date(`${String(d).slice(0, 10)}T12:00:00Z`) - new Date(`${hojeIso}T12:00:00Z`)) / 86400000);
    if (diff < 0) return { str, cor: '#ef4444', label: `${Math.abs(diff)}d atrasado` };
    if (diff === 0) return { str, cor: '#f59e0b', label: 'Hoje' };
    if (diff <= 3) return { str, cor: '#f59e0b', label: `${diff}d restantes` };
    return { str, cor: C.success, label: `${diff}d restantes` };
  };

  const handleSubmit = async () => {
    if (!form.titulo.trim()) return falha('Título é obrigatório');
    if (!form.prazo) return falha('Prazo é obrigatório. Selecione uma data.');
    setProcessando(true);
    try {
      if (modal === 'nova') { const n = await criar(form); ok(n?.numero ? `✓ ${n.numero} criada` : 'Tarefa criada'); }
      else { await atualizar(modal.tarefa.id, form); ok(`✓ ${modal.tarefa.numero || 'Tarefa'} atualizada`); }
      setModal(null); setForm(FORM0);
    } catch (e) { falha(e); } finally { setProcessando(false); }
  };
  const mudarStatus = (t, st) => {
    if (st === 'cancelada') return setConfirmar({ texto: `Cancelar ${t.numero || 'esta tarefa'}? Ela continua no histórico (rastreabilidade).`, acao: () => atualizar(t.id, { status: st }).then(() => ok(`${t.numero || 'Tarefa'} cancelada`)) });
    atualizar(t.id, { status: st }).catch(falha);
  };
  const handleComentario = async (id) => {
    if (!novoComent.trim()) return;
    try { await adicionarComentario(id, novoComent); setNovoComent(''); await listar(); ok('Comentário registrado'); } catch (e) { falha(e); }
  };
  const enviarEvidencia = async (t, arquivo) => {
    if (!arquivo) return;
    setEnviando(true);
    try { await apiService.post(`/tarefas/${t.id}/anexos`, { nome: arquivo.name, mime: arquivo.type || (/\.xml$/i.test(arquivo.name) ? 'application/xml' : ''), base64: await lerBase64(arquivo) }); await listar(); ok(`📎 ${arquivo.name} anexado`); }
    catch (e) { falha(e); } finally { setEnviando(false); }
  };
  const abrirEvidencia = async (t, a) => { try { const r = await apiService.get(`/tarefas/${t.id}/anexos/${a.id}`); if (r?.url) window.open(r.url, '_blank'); } catch (e) { falha(e); } };
  const removerEvidencia = (t, a) => setConfirmar({ texto: `Remover a evidência "${a.nome}"? A remoção fica no histórico.`, acao: async () => { await apiService.delete(`/tarefas/${t.id}/anexos/${a.id}`); await listar(); ok('Evidência removida'); } });
  const abrirVinculo = (v) => { const ev = EVENTO[v.tipo]; if (ev) window.dispatchEvent(new CustomEvent(ev, { detail: v.tipo === 'at' ? v.id : (v.id ?? v.numero) })); };

  const descFiltros = () => [ambiente !== 'todos' ? `Tipo: ${TIPOS_REL[ambiente]}` : 'Todos os tipos',
    per.de ? `${{ abertura: 'Abertas', prazo: 'Prazo', conclusao: 'Concluídas' }[base]} de ${per.de.split('-').reverse().join('/')} a ${per.ate.split('-').reverse().join('/')}` : 'Todo o período',
    { abertas: 'Situação: abertas', minhas: 'Minhas tarefas', todos: 'Todas as situações', pendente: 'Pendentes', em_andamento: 'Em andamento', concluida: 'Concluídas', cancelada: 'Canceladas', alta: 'Prioridade alta' }[filtro],
    fResp ? `Responsável: ${fResp}` : null, q ? `Busca: "${search.trim()}"` : null].filter(Boolean).join(' · ');
  const relatorio = (auditoria) => { try { abrirRelatorioTarefas(tarefasFiltradas, { titulo: 'Relatório do Plano de ação', filtros: descFiltros(), auditoria }); } catch (e) { falha(e); } };
  const baixarCsv = () => { const url = URL.createObjectURL(new Blob([csvTarefas(tarefasFiltradas)], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `tarefas-${hojeIso}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); };
  const chipNum = (t) => t.numero ? <span title="Número de rastreabilidade (não muda)" style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5, fontWeight: 700, color: C.accent, background: `${C.accent}18`, border: `1px solid ${C.accent}44`, borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap' }}>{t.numero}</span> : null;
  const abaBt = (t, k, rot) => { const on = aberta?.id === t.id && aberta.aba === k; return <button key={k} type="button" onClick={() => setAberta(on ? null : { id: t.id, aba: k })} style={{ background: on ? '#1e2a3f' : 'transparent', border: `1px solid ${on ? C.accent : C.border}`, borderRadius: 5, padding: '5px 9px', color: on ? C.accent : C.muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{rot}</button>; };

  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em', marginBottom: 4 }}>GESTÃO DE AÇÕES</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Plano de Ação</div>
          </div>
        </div>
        <button onClick={() => { setForm({ ...FORM0, tipo: ambiente !== 'todos' ? ambiente : 'GN' }); setModal('nova'); }} style={{ ...s.btn(true), padding: '9px 18px' }}>+ Nova tarefa</button>
      </div>

      {/* 18g: ambientes por tipo */}
      <div role="tablist" aria-label="Tipo de tarefa" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {[['todos', '🗂 Todas', lista.filter((t) => !['concluida', 'cancelada'].includes(t.status)).length], ...Object.entries(TIPOS_TAREFA).map(([k, v]) => [k, `${v.icone} ${v.nome}`, contaTipo(k)])].map(([k, rot, n]) => (
          <button key={k} role="tab" aria-selected={ambiente === k} type="button" onClick={() => setAmbiente(k)} title={k !== 'todos' ? `TSK-${k}-…` : undefined}
            style={{ background: ambiente === k ? C.accent : 'transparent', color: ambiente === k ? '#fff' : C.textSub, border: `1px solid ${ambiente === k ? C.accent : C.border}`, borderRadius: 18, padding: '6px 13px', fontSize: 12.5, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
            {rot}{k !== 'todos' ? <span style={{ opacity: 0.7, marginLeft: 5, fontFamily: 'ui-monospace, monospace', fontSize: 10.5 }}>{k}</span> : null}{n ? <span style={{ marginLeft: 6, background: ambiente === k ? '#ffffff30' : `${C.accent}22`, borderRadius: 10, padding: '0 6px', fontSize: 11 }}>{n}</span> : null}
          </button>))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[{ l: 'Total de tarefas', v: total, c: C.accent }, { l: 'Em andamento', v: emAndamento, c: '#38bdf8' }, { l: 'Atrasadas', v: atrasadas, c: atrasadas ? '#ef4444' : C.muted }, { l: 'Concluídas', v: `${concluidas} (${pctConclusao}%)`, c: C.success }].map((k) => (
          <div key={k.l} style={{ ...s.card, padding: '14px 18px', borderLeft: `3px solid ${k.c}` }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.07em', marginBottom: 6 }}>{k.l.toUpperCase()}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.c }}>{k.v}</div>
          </div>))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nº (TSK-…), tarefa, responsável, BID, AT…" style={{ ...s.input, width: 300, marginBottom: 0 }} />
        {['abertas', 'minhas', 'todos', 'pendente', 'em_andamento', 'concluida', 'cancelada', 'alta'].map((f) => (
          <button key={f} type="button" onClick={() => setFiltro(f)} style={{ background: filtro === f ? '#1e2a3f' : 'transparent', border: `1px solid ${filtro === f ? C.accent : C.border}`, borderRadius: 6, padding: '6px 12px', color: filtro === f ? C.accent : C.muted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            {{ abertas: 'Abertas', minhas: '👤 Minhas', todos: 'Todas', pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada', alta: '🔴 Alta' }[f]}
          </button>))}
      </div>
      {/* 18g.2b: período + responsável + relatório */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <FiltroPeriodo C={C} s={s} valor={per} comTudo onChange={(v) => { setPer(v); if (v.de && filtro === 'abertas') setFiltro('todos'); }} />
        <select aria-label="Data do período" value={base} onChange={(e) => setBase(e.target.value)} style={{ ...s.input, width: 200, marginBottom: 0 }}>
          <option value="abertura">pela data de abertura</option><option value="prazo">pelo prazo</option><option value="conclusao">pela data de conclusão</option>
        </select>
        <select aria-label="Responsável" value={fResp} onChange={(e) => setFResp(e.target.value)} style={{ ...s.input, width: 230, marginBottom: 0 }}>
          <option value="">👤 Todos os responsáveis</option>{responsaveis.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <button type="button" disabled={!tarefasFiltradas.length} onClick={() => relatorio(false)} style={{ ...s.btn(false), color: C.text, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>📑 Relatório</button>
        <button type="button" disabled={!tarefasFiltradas.length} onClick={() => relatorio(true)} title="Relatório + ficha de cada tarefa com histórico, evidências e vínculos" style={{ ...s.btn(false), color: C.text, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>🔎 Modo auditoria</button>
        <button type="button" disabled={!tarefasFiltradas.length} onClick={baixarCsv} style={{ ...s.btn(false), color: C.text, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>⬇ CSV</button>
      </div>
      {(per.de || fResp || filtro !== 'abertas' || ambiente !== 'todos' || q) && tarefasFiltradas.length > 0 && (() => { const r = resumoTarefas(tarefasFiltradas); return (
        <div style={{ ...s.card, padding: '10px 16px', marginBottom: 14, display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5, color: C.textSub }}>
          <span><b style={{ color: C.text }}>{r.total}</b> no filtro</span><span><b style={{ color: C.text }}>{r.abertas}</b> abertas</span><span><b style={{ color: C.success }}>{r.concluidas}</b> concluídas</span>
          <span>no prazo: <b style={{ color: C.text }}>{r.no_prazo_pct == null ? '—' : `${r.no_prazo_pct}%`}</b></span><span><b style={{ color: r.atrasadas ? C.danger : C.text }}>{r.atrasadas}</b> atrasadas</span>
          <span><b style={{ color: C.text }}>{r.canceladas}</b> canceladas</span><span>tempo médio: <b style={{ color: C.text }}>{r.dias_medios == null ? '—' : `${String(r.dias_medios).replace('.', ',')} dias`}</b></span>
        </div>); })()}

      {loading && !lista.length && <div style={{ color: C.muted, padding: 20, textAlign: 'center' }}>Carregando...</div>}
      {erro && <div style={{ color: '#ef4444', padding: 20, background: '#ef444422', borderRadius: 8, marginBottom: 16 }}>{erro}</div>}
      {!loading && tarefasFiltradas.length === 0 && <div style={{ ...s.card, padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>Nenhuma tarefa neste filtro.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tarefasFiltradas.map((t) => {
          const stCfg = statusTarefaCfg[t.status] || { l: t.status, c: C.muted };
          const prCfg = prioridadeTarefaCfg[t.prioridade] || { l: t.prioridade, c: C.muted };
          const prazoInfo = fmtDataPrazo(t.prazo);
          const daOrigem = ['prospeccao', 'fiscal'].includes(t.origem); // 18b.2: encerra sozinha no 📈 Comercial · 18g.1: fiscal conclui com os 4 documentos
          const encerrada = ['concluida', 'cancelada'].includes(t.status);
          const tp = TIPOS_TAREFA[tipoDe(t)];
          const aba = aberta?.id === t.id ? aberta.aba : null;
          return (
            <div key={t.id} style={{ ...s.card, overflow: 'hidden', borderLeft: `3px solid ${prCfg.c}` }}>
              <div style={{ padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  {daOrigem && encerrada ? <span title={t.origem === 'fiscal' ? 'Encerrada pelos documentos fiscais' : 'Encerrada pelo Comercial'} style={{ background: stCfg.bg, border: `1px solid ${stCfg.c}44`, borderRadius: 6, padding: '4px 8px', color: stCfg.c, fontSize: 11, fontWeight: 600, display: 'inline-block' }}>{stCfg.icon} {stCfg.l}</span> :
                    <select aria-label="Situação" value={t.status} onChange={(e) => mudarStatus(t, e.target.value)} style={{ background: stCfg.bg, border: `1px solid ${stCfg.c}44`, borderRadius: 6, padding: '4px 8px', color: stCfg.c, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                      {Object.entries(statusTarefaCfg).filter(([k]) => !daOrigem || !['concluida', 'cancelada'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.l}</option>)}
                    </select>}
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    {chipNum(t)}
                    <span style={{ fontSize: 14, fontWeight: 600, color: t.status === 'concluida' ? C.muted : C.text, textDecoration: t.status === 'concluida' ? 'line-through' : 'none' }}>{t.titulo}</span>
                    <span title={tp?.nome} style={s.tag(C.textSub)}>{tp?.icone} {tp?.nome}</span>
                    {prioridadeTarefaCfg[t.prioridade] && <span style={s.tag(prCfg.c)}>{prCfg.l}</span>}
                  </div>
                  {t.detalhe && <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, lineHeight: 1.5 }}>{t.detalhe}</div>}
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, alignItems: 'center' }}>
                    {t.responsavel && <span title={refDe(t) ? 'Ligado ao cadastro' : 'Texto livre'} style={{ color: C.textSub }}>👤 {t.responsavel}{refDe(t) ? ' ✓' : ''}</span>}
                    {t.fiscal && <span onClick={() => setAberta(aba === 'fiscal' ? null : { id: t.id, aba: 'fiscal' })} style={{ color: t.fiscal.feitos === t.fiscal.total ? C.success : C.accent, cursor: 'pointer', fontWeight: 600 }}>🧾 {t.fiscal.feitos}/{t.fiscal.total}{t.fiscal.proximo && !encerrada ? ` · próximo: ${{ nfe: 'NF-e', cte: 'CT-e', averbacao: 'averbação', mdfe: 'MDF-e', encerramento: '🏁 encerrar MDF-e' }[t.fiscal.proximo]}` : ''}{t.fiscal.alertas?.length ? ` · ⚠️ ${t.fiscal.alertas.length}` : ''}</span>}
                    {t.origem === 'prospeccao' && <span style={{ color: C.accent, cursor: 'pointer', fontWeight: 600 }} onClick={() => window.dispatchEvent(new CustomEvent('qf-abrir-prospeccao', { detail: t.origem_ref }))}>📣 Abrir no Comercial{encerrada ? '' : ' — encerra com o BID ou o cancelamento'}</span>}
                    {prazoInfo && <span style={{ color: encerrada ? C.muted : prazoInfo.cor }}>📅 {prazoInfo.str}{encerrada ? '' : ` · ${prazoInfo.label}`}</span>}
                    {(t.vinculos || []).map((v, i) => <span key={i} onClick={() => abrirVinculo(v)} title={EVENTO[v.tipo] ? 'Abrir' : undefined}
                      style={{ color: EVENTO[v.tipo] ? C.accent : C.textSub, cursor: EVENTO[v.tipo] ? 'pointer' : 'default', fontFamily: 'ui-monospace, monospace' }}>🔗 {v.numero || `${VINC[v.tipo] || v.tipo} ${v.id}`}</span>)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                  {t.fiscal && abaBt(t, 'fiscal', `🧾 ${t.fiscal.feitos}/${t.fiscal.total}`)}
                  {abaBt(t, 'coment', `💬 ${t.comentarios?.length || 0}`)}
                  {abaBt(t, 'evid', `📎 ${t.anexos?.length || 0}`)}
                  {t.numero && abaBt(t, 'hist', '📜')}
                  <button type="button" aria-label="Editar" onClick={() => { setForm({ titulo: t.titulo, detalhe: t.detalhe || '', responsavel: t.responsavel || '', responsavel_ref: refDe(t), prazo: t.prazo ? String(t.prazo).slice(0, 10) : '', prioridade: t.prioridade || 'media', status: t.status, tipo: tipoDe(t) }); setModal({ tipo: 'editar', tarefa: t }); }} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, padding: '5px 9px', color: C.muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✏</button>
                  {!daOrigem && !t.numero && <button type="button" aria-label="Excluir" onClick={() => setConfirmar({ texto: 'Excluir esta tarefa?', acao: () => deletar(t.id).then(() => ok('Tarefa excluída')) })} style={{ background: 'transparent', border: `1px solid #ef444433`, borderRadius: 5, padding: '5px 9px', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>}
                </div>
              </div>

              {aba === 'fiscal' && t.fiscal && (
                <div style={{ borderTop: `1px solid ${C.border}`, background: C.bg, padding: '14px 18px' }}>
                  <ChecklistFiscal C={C} s={s} tarefa={t} onAtualizou={listar} onErro={falha} onOk={ok} />
                </div>)}

              {aba === 'coment' && (
                <div style={{ borderTop: `1px solid ${C.border}`, background: C.bg, padding: '14px 18px' }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em', marginBottom: 10 }}>LOG DE ACOMPANHAMENTO</div>
                  {!(t.comentarios || []).length && <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Nenhum comentário ainda.</div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {(t.comentarios || []).map((c) => (
                      <div key={c.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}><span style={{ fontSize: 11, fontWeight: 600, color: C.accent }}>👤 {c.autor || 'Usuário'}</span><span style={{ fontSize: 10, color: C.muted }}>{new Date(c.data).toLocaleString('pt-BR')}</span></div>
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{c.texto}</div>
                      </div>))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <textarea value={novoComent} onChange={(e) => setNovoComent(e.target.value)} placeholder="Registrar atualização..." rows={2} style={{ ...s.input, flex: 1, resize: 'none', fontSize: 13 }} onKeyDown={(e) => e.ctrlKey && e.key === 'Enter' && handleComentario(t.id)} />
                    <button type="button" onClick={() => handleComentario(t.id)} disabled={!novoComent.trim()} style={{ ...s.btn(novoComent.trim(), '#238636'), padding: '0 16px', alignSelf: 'stretch', fontSize: 12 }}>Registrar</button>
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>Ctrl+Enter para enviar</div>
                </div>)}

              {aba === 'evid' && (
                <div style={{ borderTop: `1px solid ${C.border}`, background: C.bg, padding: '14px 18px' }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em', marginBottom: 10 }}>EVIDÊNCIAS{t.numero ? ` · ${t.numero}` : ''}</div>
                  {!(t.anexos || []).length && <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Nenhuma evidência anexada.</div>}
                  {(t.anexos || []).map((a) => <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5, padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ flex: 1, color: C.accent, cursor: 'pointer' }} onClick={() => abrirEvidencia(t, a)}>📎 {a.nome}</span>
                    <span style={{ color: C.muted, fontSize: 11 }}>{a.por || '—'} · {new Date(a.em).toLocaleString('pt-BR')}</span>
                    {!encerrada && <button type="button" aria-label={`Remover ${a.nome}`} onClick={() => removerEvidencia(t, a)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>🗑</button>}
                  </div>)}
                  {!encerrada && (t.numero ? <label style={{ ...s.btn(!enviando), display: 'inline-block', marginTop: 10, padding: '7px 14px', fontSize: 12, cursor: enviando ? 'wait' : 'pointer' }}>{enviando ? 'Enviando…' : '＋ Anexar evidência (PDF, XML, JPG, PNG)'}
                    <input type="file" accept=".pdf,.xml,.jpg,.jpeg,.png,application/pdf,text/xml,application/xml,image/jpeg,image/png" style={{ display: 'none' }} disabled={enviando} onChange={(e) => { enviarEvidencia(t, e.target.files?.[0]); e.target.value = ''; }} /></label>
                    : <div style={{ fontSize: 12, color: C.warn, marginTop: 8 }}>Rode a migration 065 para anexar evidências.</div>)}
                </div>)}

              {aba === 'hist' && (
                <div style={{ borderTop: `1px solid ${C.border}`, background: C.bg, padding: '14px 18px' }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em', marginBottom: 10 }}>HISTÓRICO · {t.numero}</div>
                  {[...(t.historico || [])].reverse().map((h, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 150px 1fr', gap: 10, fontSize: 12, padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ color: C.muted }}>{h.em ? new Date(h.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
                    <span style={{ color: C.textSub }}>{ACAO[h.acao] || h.acao}{h.por ? ` · ${h.por}` : ''}</span>
                    <span style={{ color: C.text }}>{h.campo ? <><b>{h.campo}</b>: {h.de} → {h.para}</> : h.texto || ''}</span>
                  </div>)}
                </div>)}
            </div>
          );
        })}
      </div>

      {(modal === 'nova' || (modal && modal.tipo === 'editar')) && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 500, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px #00000060' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{modal === 'nova' ? 'Nova tarefa' : <>Editar {modal.tarefa.numero ? chipNum(modal.tarefa) : 'tarefa'}</>}</div>
              <button type="button" aria-label="Fechar" onClick={() => setModal(null)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>TIPO</label>
                <select aria-label="Tipo" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} style={{ ...s.input, appearance: 'none' }}>
                  {Object.entries(TIPOS_TAREFA).map(([k, v]) => <option key={k} value={k}>{v.icone} {v.nome} ({k})</option>)}
                </select>
                {modal !== 'nova' && modal.tarefa.numero && form.tipo !== tipoDe(modal.tarefa) && <div style={{ fontSize: 11.5, color: C.warn, marginTop: 4 }}>O número {modal.tarefa.numero} não muda — a reclassificação fica no histórico.</div>}
                {modal === 'nova' && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>Número: TSK-{form.tipo}-{hojeIso.slice(0, 4)}-… (dado ao salvar)</div>}
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>TÍTULO *</label>
                <input type="text" aria-label="Título" value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Prospectar novos fornecedores" style={s.input} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>DESCRIÇÃO</label>
                <textarea value={form.detalhe} onChange={(e) => setForm((f) => ({ ...f, detalhe: e.target.value }))} rows={3} placeholder="Descreva a tarefa..." style={{ ...s.input, resize: 'none' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={s.label}>RESPONSÁVEL</label><CampoPessoa C={C} s={s} pessoas={gente.pessoas} valor={{ nome: form.responsavel, ref: form.responsavel_ref }} onChange={(v) => setForm((f) => ({ ...f, responsavel: v.nome, responsavel_ref: v.ref }))} placeholder="Digite o nome…" /></div>
                <div><label style={s.label}>PRAZO *</label><input type="date" aria-label="Prazo" value={form.prazo} onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))} style={s.input} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                <select value={form.prioridade} onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))} style={{ ...s.input, appearance: 'none' }}>
                  <option value="alta">🔴 Alta</option><option value="media">🟡 Média</option><option value="baixa">🟢 Baixa</option>
                </select>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} style={{ ...s.input, appearance: 'none' }}>
                  {Object.entries(statusTarefaCfg).filter(([k]) => !(modal !== 'nova' && ['prospeccao', 'fiscal'].includes(modal.tarefa.origem) && ['concluida', 'cancelada'].includes(k) && k !== modal.tarefa.status)).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
              <button type="button" onClick={() => setModal(null)} style={{ ...s.btn(false), flex: 1, padding: '8px 16px' }}>Cancelar</button>
              <button type="button" onClick={handleSubmit} disabled={processando || !form.titulo || !form.prazo}
                style={{ ...s.btn(!!form.titulo && !!form.prazo), flex: 1, padding: '8px 16px', opacity: processando || !form.titulo || !form.prazo ? 0.5 : 1, cursor: processando || !form.titulo || !form.prazo ? 'not-allowed' : 'pointer' }}>
                {processando ? 'Salvando...' : modal === 'nova' ? 'Criar' : 'Atualizar'}
              </button>
            </div>
          </div>
        </div>)}

      {confirmar && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 310, padding: 20 }}>
          <div role="dialog" aria-modal="true" style={{ ...s.card, width: 420, maxWidth: '100%', padding: 22 }}>
            <div style={{ fontSize: 14, color: C.text, marginBottom: 18, lineHeight: 1.5 }}>{confirmar.texto}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setConfirmar(null)} style={{ ...s.btn(false), padding: '8px 16px' }}>Voltar</button>
              <button type="button" onClick={async () => { const c = confirmar; setConfirmar(null); try { await c.acao(); } catch (e) { falha(e); } }} style={{ ...s.btn(true, '#ef4444'), padding: '8px 16px' }}>Confirmar</button>
            </div>
          </div>
        </div>)}

      {aviso && <div role="status" style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 320, background: aviso.erro ? '#7f1d1d' : '#14532d', color: '#fff', borderRadius: 8, padding: '10px 16px', fontSize: 13, boxShadow: '0 8px 24px #00000060', maxWidth: 420 }}>{aviso.t}</div>}
    </div>
  );
}
