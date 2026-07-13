// components/usuarios/TelaUsuariosNova.jsx
import { useState, useEffect } from 'react';

export default function TelaUsuariosNova({ useUsuarios, C, s }) {
  const token = localStorage.getItem('access_token');
  const { dados: usuarios, loading, erro, listar, criar, atualizar, deletar, desativar, ativar } = useUsuarios(token);

  const [search, setSearch] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modal, setModal] = useState(null); // 'novo' | {tipo:'editar', usuario: ...}
  const [processando, setProcessando] = useState(false);
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    perfil: 'comprador',
    ativo: true,
  });

  // Carregar ao montar
  useEffect(() => {
    listar();
  }, []);

  // Filtrar
  const usuariosFiltrados = (usuarios || [])
    .filter(u => filtroPerfil === 'todos' || u.perfil === filtroPerfil)
    .filter(u => filtroStatus === 'todos' || (filtroStatus === 'ativo' ? u.ativo : !u.ativo))
    .filter(u => !search || u.nome.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  // Handlers
  const handleSubmit = async () => {
    if (!form.nome || !form.email) {
      alert('Nome e e-mail são obrigatórios');
      return;
    }
    if (modal === 'novo' && !form.senha) {
      alert('Senha é obrigatória para novo usuário');
      return;
    }

    setProcessando(true);
    try {
      const dadosEnvio = { ...form };
      if (!form.senha) delete dadosEnvio.senha; // não enviar senha vazia
      if (modal === 'novo') {
        await criar(dadosEnvio);
      } else {
        await atualizar(modal.usuario.id, dadosEnvio);
      }
      setModal(null);
      setForm({ nome: '', email: '', senha: '', perfil: 'comprador', ativo: true });
      alert(modal === 'novo' ? 'Usuário criado!' : 'Usuário atualizado!');
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setProcessando(false);
    }
  };

  const handleToggleAtivo = async (usuario) => {
    if (usuario.id === JSON.parse(localStorage.getItem('usuario'))?.id) {
      alert('Você não pode desativar sua própria conta');
      return;
    }
    try {
      if (usuario.ativo) {
        await desativar(usuario.id);
      } else {
        await ativar(usuario.id);
      }
    } catch (e) {
      alert('Erro: ' + e.message);
    }
  };

  const handleDeletar = async (id) => {
    if (!window.confirm('Tem certeza? Esta ação não pode ser desfeita.')) return;
    try {
      await deletar(id);
    } catch (e) {
      alert('Erro: ' + e.message);
    }
  };

  const perfis = ['tecnico', 'comprador', 'gestor', 'admin'];
  const perfilLabels = { tecnico: 'Técnico', comprador: 'Comprador', gestor: 'Gestor', admin: 'Administrador' };

  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em', marginBottom: 4 }}>ADMINISTRAÇÃO</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Usuários</div>
        </div>
        <button
          onClick={() => {
            setForm({ nome: '', email: '', senha: '', perfil: 'comprador', ativo: true });
            setModal('novo');
          }}
          style={{ ...s.btn(true), padding: '9px 20px', fontSize: 12 }}
        >
          ➕ Novo Usuário
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...s.input, flex: 1, minWidth: 200, padding: '8px 12px', fontSize: 12 }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {['todos', 'tecnico', 'comprador', 'gestor', 'admin'].map(p => (
            <button
              key={p}
              onClick={() => setFiltroPerfil(p)}
              style={{
                background: filtroPerfil === p ? C.accent : 'transparent',
                border: `1px solid ${filtroPerfil === p ? C.accent : C.border}`,
                borderRadius: 6,
                padding: '6px 14px',
                color: filtroPerfil === p ? 'white' : C.muted,
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {p === 'todos' ? 'Todos' : perfilLabels[p]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['todos', 'ativo', 'inativo'].map(st => (
            <button
              key={st}
              onClick={() => setFiltroStatus(st)}
              style={{
                background: filtroStatus === st ? C.accent : 'transparent',
                border: `1px solid ${filtroStatus === st ? C.accent : C.border}`,
                borderRadius: 6,
                padding: '6px 14px',
                color: filtroStatus === st ? 'white' : C.muted,
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {st === 'todos' ? 'Status' : st === 'ativo' ? '✅ Ativo' : '⛔ Inativo'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading / Erro */}
      {loading && <div style={{ color: C.muted, padding: 20, textAlign: 'center' }}>Carregando...</div>}
      {erro && <div style={{ color: '#ef4444', padding: 20, background: '#ef444422', borderRadius: 8, marginBottom: 16 }}>{erro}</div>}

      {/* Tabela */}
      {!loading && usuariosFiltrados.length === 0 ? (
        <div style={{ ...s.card, padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
          <div style={{ fontSize: 14, color: C.text, fontWeight: 500, marginBottom: 4 }}>Nenhum usuário encontrado</div>
          <div style={{ fontSize: 12, color: C.muted }}>Cadastre um novo usuário para começar</div>
        </div>
      ) : (
        <div style={{ ...s.card, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 120px 100px 100px 100px', padding: '10px 18px', background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: '0.08em' }}>
            <span>NOME</span>
            <span>E-MAIL</span>
            <span>PERFIL</span>
            <span>STATUS</span>
            <span>CRIADO EM</span>
            <span></span>
          </div>
          {usuariosFiltrados.map((u, i) => (
            <div
              key={u.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 2fr 120px 100px 100px 100px',
                padding: '13px 18px',
                borderBottom: i < usuariosFiltrados.length - 1 ? `1px solid ${C.border}22` : 'none',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{u.nome}</div>
              <div style={{ fontSize: 12, color: C.accent }}>{u.email}</div>
              <div>
                <span style={{ ...s.tag(C.accent), fontSize: 10 }}>{perfilLabels[u.perfil]}</span>
              </div>
              <div>
                <span style={{ ...s.tag(u.ativo ? C.success : '#ef4444'), fontSize: 10 }}>
                  {u.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>{new Date(u.criado_em).toLocaleDateString('pt-BR')}</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setForm({
                      nome: u.nome,
                      email: u.email,
                      senha: '',
                      perfil: u.perfil,
                      ativo: u.ativo,
                    });
                    setModal({ tipo: 'editar', usuario: u });
                  }}
                  style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, padding: '4px 8px', color: C.muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  ✏
                </button>
                <button
                  onClick={() => handleToggleAtivo(u)}
                  style={{ background: 'transparent', border: `1px solid ${u.ativo ? '#ef444433' : '#22c55e33'}`, borderRadius: 5, padding: '4px 8px', color: u.ativo ? '#ef4444' : C.success, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {u.ativo ? '⛔' : '✅'}
                </button>
                <button
                  onClick={() => handleDeletar(u.id)}
                  style={{ background: 'transparent', border: `1px solid #ef444433`, borderRadius: 5, padding: '4px 8px', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL - Criar / Editar */}
      {(modal === 'novo' || (modal && modal.tipo === 'editar')) && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 480, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px #00000060' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                {modal === 'novo' ? 'Novo Usuário' : 'Editar Usuário'}
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>NOME COMPLETO *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: João Silva"
                  style={s.input}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>E-MAIL *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="joao@empresa.com"
                  style={s.input}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>
                  {modal === 'novo' ? 'SENHA *' : 'NOVA SENHA (deixe em branco para manter)'}
                </label>
                <input
                  type="password"
                  value={form.senha}
                  onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                  placeholder={modal === 'novo' ? 'Mínimo 6 caracteres' : 'Digite para alterar'}
                  style={s.input}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>PERFIL</label>
                <select
                  value={form.perfil}
                  onChange={e => setForm(f => ({ ...f, perfil: e.target.value }))}
                  style={{ ...s.input, appearance: 'none' }}
                >
                  {perfis.map(p => (
                    <option key={p} value={p}>{perfilLabels[p]}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>STATUS</label>
                <select
                  value={form.ativo ? 'ativo' : 'inativo'}
                  onChange={e => setForm(f => ({ ...f, ativo: e.target.value === 'ativo' }))}
                  style={{ ...s.input, appearance: 'none' }}
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
              <button onClick={() => setModal(null)} style={{ ...s.btn(false), flex: 1, padding: '8px 16px' }}>Cancelar</button>
              <button
                onClick={handleSubmit}
                disabled={processando || !form.nome || !form.email || (modal === 'novo' && !form.senha)}
                style={{
                  ...s.btn(true),
                  flex: 1,
                  padding: '8px 16px',
                  opacity: processando || !form.nome || !form.email || (modal === 'novo' && !form.senha) ? 0.5 : 1,
                  cursor: processando || !form.nome || !form.email || (modal === 'novo' && !form.senha) ? 'not-allowed' : 'pointer',
                }}
              >
                {processando ? 'Processando...' : modal === 'novo' ? 'Criar Usuário' : 'Atualizar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}