import { useState, useEffect, useCallback } from 'react';
import apiService from '../../services/apiService';
import { processarCSVFornecedor } from './csvFornecedorUtils';

// TelaCatalogoFornecedor.jsx
//
// Gestão da lista de preços do próprio fornecedor (fornecedor_produtos):
// upload de CSV (com preview/confirmação), cadastro avulso, edição e
// remoção. Não depende mais de "escolher item de um catálogo global" —
// cada fornecedor cadastra os próprios PN/nome/descrição/preço, e o
// upsert por PN normalizado é feito pelo backend em POST /produtos/upload.
//
// Endpoints usados (todos autenticados via fornecedorMiddleware):
//   GET    /fornecedor/produtos/meus
//   POST   /fornecedor/produtos/upload   { produtos: [...] }
//   POST   /fornecedor/produtos          (um item avulso)
//   PUT    /fornecedor/produtos/:id
//   DELETE /fornecedor/produtos/:id

const FORM_VAZIO = {
  pn: '',
  nome: '',
  descricao: '',
  categoria: '',
  marca: '',
  preco_unitario: '',
  unidade: '',
};

export default function TelaCatalogoFornecedor({ fornecedorId, C, s, fmtBRL }) {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(null); // null | 'novo' | 'editar' | 'importar'
  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Estado do fluxo de importação de CSV, em etapas: selecionar -> preview -> confirmando
  const [importacao, setImportacao] = useState({
    etapa: 'selecionar',
    csvTexto: '',
    itens: [],
    erros: [],
    resultado: null,
  });

  useEffect(() => {
    carregarItens();
  }, []);

  const carregarItens = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/fornecedor/produtos/meus');
      setItens(data || []);
    } catch (err) {
      console.error('Erro ao carregar catálogo:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Cadastro avulso / edição (mesmo modal, mesmo form) ──────────────

  const abrirModalNovo = () => {
    setForm(FORM_VAZIO);
    setEditandoId(null);
    setModal('form');
  };

  const abrirModalEditar = (item) => {
    setForm({
      pn: item.pn_raw || '',
      nome: item.nome_raw || '',
      descricao: item.descricao_raw || '',
      categoria: item.categoria || '',
      marca: item.marca || '',
      preco_unitario: item.preco_unitario ?? '',
      unidade: item.unidade || '',
    });
    setEditandoId(item.id);
    setModal('form');
  };

  const salvarForm = async () => {
    if (!form.nome || !form.preco_unitario) {
      alert('Nome e preço unitário são obrigatórios');
      return;
    }
    const preco = parseFloat(form.preco_unitario);
    if (isNaN(preco) || preco <= 0) {
      alert('Preço unitário inválido');
      return;
    }

    const payload = { ...form, preco_unitario: preco };

    setSalvando(true);
    try {
      if (editandoId) {
        await apiService.put(`/fornecedor/produtos/${editandoId}`, payload);
      } else {
        await apiService.post('/fornecedor/produtos', payload);
      }
      setModal(null);
      setForm(FORM_VAZIO);
      setEditandoId(null);
      await carregarItens();
    } catch (err) {
      alert('Erro ao salvar: ' + (err?.message || 'erro desconhecido'));
    } finally {
      setSalvando(false);
    }
  };

  const removerItem = async (id) => {
    if (!confirm('Remover este produto do seu catálogo?')) return;
    try {
      await apiService.delete(`/fornecedor/produtos/${id}`);
      await carregarItens();
    } catch (err) {
      alert('Erro ao remover: ' + (err?.message || 'erro desconhecido'));
    }
  };

  // ── Importação de CSV ────────────────────────────────────────────

  const abrirModalImportar = () => {
    setImportacao({ etapa: 'selecionar', csvTexto: '', itens: [], erros: [], resultado: null });
    setModal('importar');
  };

  const handleCarregarArquivo = useCallback((e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = (evt) => {
      setImportacao((prev) => ({ ...prev, csvTexto: evt.target.result }));
    };
    leitor.readAsText(arquivo, 'UTF-8');
  }, []);

  const handleProcessarCSV = useCallback(() => {
    const resultado = processarCSVFornecedor(importacao.csvTexto);
    if (resultado.erro) {
      alert(resultado.erro);
      return;
    }
    if (resultado.itens.length === 0) {
      alert('Nenhuma linha válida encontrada no CSV.');
      return;
    }
    setImportacao((prev) => ({
      ...prev,
      itens: resultado.itens,
      erros: resultado.erros,
      etapa: 'preview',
    }));
  }, [importacao.csvTexto]);

  const handleConfirmarImportacao = useCallback(async () => {
    setImportacao((prev) => ({ ...prev, etapa: 'confirmando' }));
    try {
      const resp = await apiService.post('/fornecedor/produtos/upload', {
        produtos: importacao.itens,
      });
      setImportacao((prev) => ({ ...prev, etapa: 'concluido', resultado: resp }));
      await carregarItens();
    } catch (err) {
      alert('Erro ao importar: ' + (err?.message || 'erro desconhecido'));
      setImportacao((prev) => ({ ...prev, etapa: 'preview' }));
    }
  }, [importacao.itens]);

  const fecharImportacao = () => {
    setModal(null);
    setImportacao({ etapa: 'selecionar', csvTexto: '', itens: [], erros: [], resultado: null });
  };

  const itensFiltrados = itens.filter((i) =>
    (i.nome_raw || '').toLowerCase().includes(busca.toLowerCase()) ||
    (i.pn_raw || '').toLowerCase().includes(busca.toLowerCase()) ||
    (i.categoria || '').toLowerCase().includes(busca.toLowerCase())
  );

  if (loading) return <div style={{ color: C.muted, padding: 20 }}>Carregando catálogo...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text }}>📦 Meu Catálogo de Produtos</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={abrirModalImportar} style={{ ...s.btn(false), padding: '8px 16px', fontSize: 12 }}>
            ⬆ Importar CSV
          </button>
          <button onClick={abrirModalNovo} style={{ ...s.btn(true), padding: '8px 16px', fontSize: 12 }}>
            + Adicionar Produto
          </button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Buscar por nome, PN ou categoria..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        style={{ ...s.input, marginBottom: 16 }}
      />

      {itensFiltrados.length === 0 && (
        <div style={{ ...s.card, padding: 40, textAlign: 'center', color: C.muted }}>
          Nenhum produto cadastrado no seu catálogo. Importe um CSV ou adicione manualmente.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {itensFiltrados.map((item) => (
          <div key={item.id} style={{ ...s.card, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 600, color: C.text }}>{item.nome_raw}</div>
              <div style={{ fontSize: 12, color: C.muted }}>
                {item.pn_raw ? `PN: ${item.pn_raw}` : 'sem PN'}
                {item.categoria ? ` · ${item.categoria}` : ''}
                {item.marca ? ` · ${item.marca}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.success }}>
                {fmtBRL(item.preco_unitario)}{item.unidade ? ` / ${item.unidade}` : ''}
              </span>
              <button onClick={() => abrirModalEditar(item)} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer' }} title="Editar">
                ✎
              </button>
              <button onClick={() => removerItem(item.id)} style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer' }} title="Remover">
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL - Adicionar/editar produto (mesmo form para os dois casos) */}
      {modal === 'form' && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 480, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                {editandoId ? 'Editar Produto' : 'Adicionar Produto'}
              </div>
            </div>
            <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
              <div style={{ marginBottom: 12 }}>
                <label style={s.label}>PART NUMBER (PN)</label>
                <input
                  type="text"
                  value={form.pn}
                  onChange={(e) => setForm((f) => ({ ...f, pn: e.target.value }))}
                  placeholder="Ex: LAMP-001"
                  style={s.input}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={s.label}>NOME DO PRODUTO *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Lâmpada farol direito"
                  style={s.input}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={s.label}>DESCRIÇÃO</label>
                <input
                  type="text"
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Lâmpada H7 12V 55W"
                  style={s.input}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>CATEGORIA</label>
                  <input
                    type="text"
                    value={form.categoria}
                    onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                    placeholder="Ex: iluminação"
                    style={s.input}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>MARCA</label>
                  <input
                    type="text"
                    value={form.marca}
                    onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
                    placeholder="Ex: Philips"
                    style={s.input}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>PREÇO UNITÁRIO (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.preco_unitario}
                    onChange={(e) => setForm((f) => ({ ...f, preco_unitario: e.target.value }))}
                    placeholder="0,00"
                    style={s.input}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>UNIDADE</label>
                  <input
                    type="text"
                    value={form.unidade}
                    onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                    placeholder="Ex: UN, PC, CX"
                    style={s.input}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setModal(null)} style={{ ...s.btn(false), flex: 1 }} disabled={salvando}>
                Cancelar
              </button>
              <button onClick={salvarForm} style={{ ...s.btn(true), flex: 1 }} disabled={salvando}>
                {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - Importar CSV (etapas: selecionar -> preview -> confirmando -> concluído) */}
      {modal === 'importar' && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 640, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Importar CSV</div>
            </div>

            <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
              {importacao.etapa === 'selecionar' && (
                <>
                  <div style={{ marginBottom: 12, fontSize: 12, color: C.muted }}>
                    Envie um arquivo .csv ou cole o conteúdo abaixo. Colunas reconhecidas: PN (ou Part Number), Nome (ou Produto), Descrição, Categoria, Marca, Preço (ou Valor), Unidade — em qualquer ordem, com o nome que seu ERP usar.
                  </div>
                  <input type="file" accept=".csv,text/csv" onChange={handleCarregarArquivo} style={{ marginBottom: 12 }} />
                  <textarea
                    value={importacao.csvTexto}
                    onChange={(e) => setImportacao((prev) => ({ ...prev, csvTexto: e.target.value }))}
                    placeholder={'pn,nome,descricao,categoria,marca,preco_unitario,unidade\nLAMP-001,Lâmpada farol direito,Lâmpada H7,iluminação,Philips,45.90,UN'}
                    style={{ ...s.input, minHeight: 180, fontFamily: 'monospace', fontSize: 12 }}
                  />
                </>
              )}

              {importacao.etapa === 'preview' && (
                <>
                  <div style={{ marginBottom: 12, fontSize: 13, color: C.text }}>
                    <strong>{importacao.itens.length}</strong> linhas válidas encontradas
                    {importacao.erros.length > 0 && (
                      <span style={{ color: C.danger }}> · {importacao.erros.length} linhas com erro (serão ignoradas)</span>
                    )}
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: C.border }}>
                          <th style={{ padding: 8, textAlign: 'left' }}>PN</th>
                          <th style={{ padding: 8, textAlign: 'left' }}>Nome</th>
                          <th style={{ padding: 8, textAlign: 'left' }}>Categoria</th>
                          <th style={{ padding: 8, textAlign: 'right' }}>Preço</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importacao.itens.slice(0, 50).map((item, i) => (
                          <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                            <td style={{ padding: 8 }}>{item.pn || '—'}</td>
                            <td style={{ padding: 8 }}>{item.nome}</td>
                            <td style={{ padding: 8 }}>{item.categoria || '—'}</td>
                            <td style={{ padding: 8, textAlign: 'right' }}>{fmtBRL(item.preco_unitario)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importacao.itens.length > 50 && (
                      <div style={{ padding: 8, textAlign: 'center', color: C.muted, fontSize: 11 }}>
                        + {importacao.itens.length - 50} linhas não exibidas na prévia (serão enviadas normalmente)
                      </div>
                    )}
                  </div>
                  {importacao.erros.length > 0 && (
                    <div style={{ marginTop: 12, fontSize: 11, color: C.danger, maxHeight: 100, overflowY: 'auto' }}>
                      {importacao.erros.slice(0, 20).map((e, i) => (
                        <div key={i}>Linha {e.linha}: {e.mensagens.join(', ')}</div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {importacao.etapa === 'confirmando' && (
                <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Enviando produtos...</div>
              )}

              {importacao.etapa === 'concluido' && importacao.resultado && (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.success, marginBottom: 8 }}>Importação concluída!</div>
                  <div style={{ fontSize: 13, color: C.text }}>
                    {importacao.resultado.criados} criados · {importacao.resultado.atualizados} atualizados
                    {importacao.resultado.erros > 0 && ` · ${importacao.resultado.erros} com erro`}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
              {importacao.etapa === 'selecionar' && (
                <>
                  <button onClick={fecharImportacao} style={{ ...s.btn(false), flex: 1 }}>Cancelar</button>
                  <button onClick={handleProcessarCSV} style={{ ...s.btn(true), flex: 1 }}>Processar</button>
                </>
              )}
              {importacao.etapa === 'preview' && (
                <>
                  <button onClick={() => setImportacao((prev) => ({ ...prev, etapa: 'selecionar' }))} style={{ ...s.btn(false), flex: 1 }}>
                    Voltar
                  </button>
                  <button onClick={handleConfirmarImportacao} style={{ ...s.btn(true), flex: 1 }} disabled={importacao.itens.length === 0}>
                    Confirmar importação
                  </button>
                </>
              )}
              {importacao.etapa === 'confirmando' && (
                <button style={{ ...s.btn(false), flex: 1 }} disabled>Aguarde...</button>
              )}
              {importacao.etapa === 'concluido' && (
                <button onClick={fecharImportacao} style={{ ...s.btn(true), flex: 1 }}>Fechar</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}