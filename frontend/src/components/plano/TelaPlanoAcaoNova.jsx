// components/plano/TelaPlanoAcaoNova.jsx
import { useState, useEffect } from 'react';
import { useTarefas } from '../../hooks/useTarefas';

export default function TelaPlanoAcaoNova({ onVoltar, C, s }) {
  // Usa o hook diretamente e desestrutura, MAS sem pegar adicionarComentario para evitar conflito
  const { dados: tarefas, loading, erro, listar, criar, atualizar, deletar } = useTarefas();

  // Para comentários, vamos guardar uma referência ao hook completo para acessar adicionarComentario
  const hookTarefas = useTarefas(); // este é o mesmo hook, mas usamos para ter acesso à função adicionarComentario

  // ⚠️ NÃO DESESTRUTURE adicionarComentario daqui, use hookTarefas.adicionarComentario
  // Isso evita o problema de "undefined"

  const [filtro, setFiltro] = useState('todos');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [modalComent, setModalComent] = useState(null);
  const [novoComent, setNovoComent] = useState('');
  const [processando, setProcessando] = useState(false);
  const [form, setForm] = useState({
    titulo: '',
    detalhe: '',
    responsavel: '',
    prazo: '',
    prioridade: 'media',
    status: 'pendente',
  });

  useEffect(() => {
    listar();
  }, []);

  const tarefasFiltradas = (tarefas || [])
    .filter(t => filtro === 'todos' || t.status === filtro || t.prioridade === filtro)
    .filter(t => !search || t.titulo.toLowerCase().includes(search.toLowerCase()) || t.responsavel?.toLowerCase().includes(search.toLowerCase()));

  const total = tarefas.length;
  const concluidas = tarefas.filter(t => t.status === 'concluida').length;
  const emAndamento = tarefas.filter(t => t.status === 'em_andamento').length;
  const pctConclusao = total ? Math.round(concluidas / total * 100) : 0;

  const statusTarefaCfg = {
    pendente: { l: 'Pendente', c: '#64748b', bg: '#1e2535', icon: '○' },
    em_andamento: { l: 'Em andamento', c: '#3b82f6', bg: '#0f1e35', icon: '◑' },
    concluida: { l: 'Concluída', c: '#22c55e', bg: '#0f2f1a', icon: '●' },
    cancelada: { l: 'Cancelada', c: '#ef4444', bg: '#2d1515', icon: '✕' },
  };
  const prioridadeTarefaCfg = {
    alta: { l: 'Alta', c: '#ef4444' },
    media: { l: 'Média', c: '#f59e0b' },
    baixa: { l: 'Baixa', c: '#22c55e' },
  };

  const fmtDataPrazo = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const diff = Math.ceil((dt - hoje) / 86400000);
    const str = dt.toLocaleDateString('pt-BR');
    if (diff < 0) return { str, cor: '#ef4444', label: `${Math.abs(diff)}d atrasado` };
    if (diff === 0) return { str, cor: '#f59e0b', label: 'Hoje' };
    if (diff <= 3) return { str, cor: '#f59e0b', label: `${diff}d restantes` };
    return { str, cor: C.success, label: `${diff}d restantes` };
  };

  const handleSubmit = async () => {
  if (!form.titulo) {
    alert('Título é obrigatório');
    return;
  }
  if (!form.prazo) {
    alert('Prazo é obrigatório. Selecione uma data.');
    return;
  }
    setProcessando(true);
    try {
      if (modal === 'nova') {
        await criar(form);
      } else {
        await atualizar(modal.tarefa.id, form);
      }
      setModal(null);
      setForm({ titulo: '', detalhe: '', responsavel: '', prazo: '', prioridade: 'media', status: 'pendente' });
      alert(modal === 'nova' ? 'Tarefa criada!' : 'Tarefa atualizada!');
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setProcessando(false);
    }
  };

  // 🔥 FUNÇÃO DE COMENTÁRIO – USA hookTarefas.adicionarComentario
  const handleComentario = async (id) => {
    if (!novoComent.trim()) return;
    try {
      await hookTarefas.adicionarComentario(id, novoComent);
      setNovoComent('');
      // Recarregar a lista para mostrar o comentário
      await listar();
      alert('Comentário adicionado!');
    } catch (e) {
      alert('Erro: ' + e.message);
    }
  };

  // ─── RENDER ──────────────────────────────────────────────
  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onVoltar} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, padding: '7px 14px', color: C.muted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Voltar
          </button>
          <div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em', marginBottom: 4 }}>GESTÃO DE AÇÕES</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Plano de Ação</div>
          </div>
        </div>
        <button onClick={() => { setForm({ titulo: '', detalhe: '', responsavel: '', prazo: '', prioridade: 'media', status: 'pendente' }); setModal('nova'); }} style={{ ...s.btn(true), padding: '9px 18px' }}>+ Nova tarefa</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { l: 'Total de tarefas', v: total, c: C.accent },
          { l: 'Em andamento', v: emAndamento, c: '#38bdf8' },
          { l: 'Concluídas', v: `${concluidas} (${pctConclusao}%)`, c: C.success },
          { l: 'Progresso', v: `${pctConclusao}%`, c: C.success },
        ].map(k => (
          <div key={k.l} style={{ ...s.card, padding: '14px 18px', borderLeft: `3px solid ${k.c}` }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.07em', marginBottom: 6 }}>{k.l.toUpperCase()}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Barra de progresso */}
      {total > 0 && (
        <div style={{ ...s.card, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>Progresso geral</div>
          <div style={{ flex: 1, height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: C.success, width: `${pctConclusao}%`, borderRadius: 4, transition: 'width .3s' }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.success, flexShrink: 0 }}>{pctConclusao}%</div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tarefa ou responsável..." style={{ ...s.input, width: 260, marginBottom: 0 }} />
        {['todos', 'pendente', 'em_andamento', 'concluida', 'alta', 'media'].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{ background: filtro === f ? '#1e2a3f' : 'transparent', border: `1px solid ${filtro === f ? C.accent : C.border}`, borderRadius: 6, padding: '6px 12px', color: filtro === f ? C.accent : C.muted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            {{ todos: 'Todos', pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída', alta: '🔴 Alta', media: '🟡 Média' }[f]}
          </button>
        ))}
      </div>

      {/* Loading / Erro */}
      {loading && <div style={{ color: C.muted, padding: 20, textAlign: 'center' }}>Carregando...</div>}
      {erro && <div style={{ color: '#ef4444', padding: 20, background: '#ef444422', borderRadius: 8, marginBottom: 16 }}>{erro}</div>}

      {!loading && tarefasFiltradas.length === 0 && (
        <div style={{ ...s.card, padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>
            ⚠️ Nenhuma tarefa encontrada. (total: {total})
        </div>
        )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tarefasFiltradas.map(t => {
          const stCfg = statusTarefaCfg[t.status] || { l: t.status, c: C.muted };
          const prCfg = prioridadeTarefaCfg[t.prioridade] || { l: t.prioridade, c: C.muted };
          const prazoInfo = fmtDataPrazo(t.prazo);
          const showComent = modalComent === t.id;

          return (
            <div key={t.id} style={{ ...s.card, overflow: 'hidden', borderLeft: `3px solid ${prCfg.c}` }}>
              <div style={{ padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  <select value={t.status} onChange={e => {
                    atualizar(t.id, { status: e.target.value }).catch(alert);
                  }} style={{ background: stCfg.bg, border: `1px solid ${stCfg.c}44`, borderRadius: 6, padding: '4px 8px', color: stCfg.c, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                    {Object.entries(statusTarefaCfg).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.l}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: t.status === 'concluida' ? C.muted : C.text, textDecoration: t.status === 'concluida' ? 'line-through' : 'none' }}>{t.titulo}</span>
                    <span style={s.tag(prCfg.c)}>{prCfg.l}</span>
                    {(t.comentarios || []).length > 0 && <span style={{ ...s.tag(C.muted), fontSize: 9 }}>💬 {t.comentarios.length}</span>}
                  </div>
                  {t.detalhe && <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, lineHeight: 1.5 }}>{t.detalhe}</div>}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11 }}>
                    {t.responsavel && <span style={{ color: C.textSub }}>👤 {t.responsavel}</span>}
                    {prazoInfo && typeof prazoInfo === 'object' && <span style={{ color: prazoInfo.cor }}>📅 {prazoInfo.str} · {prazoInfo.label}</span>}
                    {t.criacao && <span style={{ color: C.muted }}>Criada {new Date(t.criacao).toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setModalComent(showComent ? null : t.id)} style={{ background: showComent ? '#1e2a3f' : 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, padding: '5px 10px', color: showComent ? C.accent : C.muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>💬 {t.comentarios?.length || 0}</button>
                  <button onClick={() => { setForm({ titulo: t.titulo, detalhe: t.detalhe || '', responsavel: t.responsavel || '', prazo: t.prazo || '', prioridade: t.prioridade, status: t.status }); setModal({ tipo: 'editar', tarefa: t }); }} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, padding: '5px 9px', color: C.muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✏</button>
                  <button onClick={() => { if (window.confirm('Excluir tarefa?')) deletar(t.id); }} style={{ background: 'transparent', border: `1px solid #ef444433`, borderRadius: 5, padding: '5px 9px', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                </div>
              </div>
              {showComent && (
                <div style={{ borderTop: `1px solid ${C.border}`, background: C.bg, padding: '14px 18px' }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em', marginBottom: 10 }}>LOG DE ACOMPANHAMENTO</div>
                  {(t.comentarios || []).length === 0 && <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Nenhum comentário ainda.</div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {(Array.isArray(t.comentarios) ? t.comentarios : (typeof t.comentarios === 'string' ? JSON.parse(t.comentarios) : [])).map(c => (
                      <div key={c.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.accent }}>👤 {c.autor || 'Usuário'}</span>
                          <span style={{ fontSize: 10, color: C.muted }}>{new Date(c.data).toLocaleString('pt-BR')}</span>
                        </div>
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{c.texto}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <textarea value={novoComent} onChange={e => setNovoComent(e.target.value)} placeholder="Registrar atualização..." rows={2} style={{ ...s.input, flex: 1, resize: 'none', fontSize: 13 }} onKeyDown={e => e.ctrlKey && e.key === 'Enter' && handleComentario(t.id)} />
                    <button onClick={() => handleComentario(t.id)} disabled={!novoComent.trim()} style={{ ...s.btn(novoComent.trim(), '#238636'), padding: '0 16px', alignSelf: 'stretch', fontSize: 12 }}>Registrar</button>
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>Ctrl+Enter para enviar</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL */}
      {(modal === 'nova' || (modal && modal.tipo === 'editar')) && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 480, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px #00000060' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{modal === 'nova' ? 'Nova Tarefa' : 'Editar Tarefa'}</div>
              <button onClick={() => setModal(null)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>TÍTULO *</label>
                <input type="text" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Prospectar novos fornecedores" style={s.input} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>DESCRIÇÃO</label>
                <textarea value={form.detalhe} onChange={e => setForm(f => ({ ...f, detalhe: e.target.value }))} rows={3} placeholder="Descreva a tarefa..." style={{ ...s.input, resize: 'none' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={s.label}>RESPONSÁVEL</label>
                  <input type="text" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Nome" style={s.input} />
                </div>
                <div>
                  <label style={s.label}>PRAZO</label>
                  <input type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} style={s.input} required/>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                <select value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))} style={{ ...s.input, appearance: 'none' }}>
                  <option value="alta">🔴 Alta</option>
                  <option value="media">🟡 Média</option>
                  <option value="baixa">🟢 Baixa</option>
                </select>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ ...s.input, appearance: 'none' }}>
                  {Object.entries(statusTarefaCfg).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
              <button onClick={() => setModal(null)} style={{ ...s.btn(false), flex: 1, padding: '8px 16px' }}>
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={processando || !form.titulo || !form.prazo}
                style={{
                  ...s.btn(!!form.titulo && !!form.prazo),
                  flex: 1,
                  padding: '8px 16px',
                  opacity: processando || !form.titulo || !form.prazo ? 0.5 : 1,
                  cursor: processando || !form.titulo || !form.prazo ? 'not-allowed' : 'pointer',
                }}
              >
                {processando ? 'Salvando...' : modal === 'nova' ? 'Criar' : 'Atualizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}