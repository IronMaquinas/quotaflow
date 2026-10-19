// src/plataforma/BibliotecaFuncoes.jsx — etapa 12d.0
// Console da Plataforma → aba "Biblioteca de funções".
// Modelos de função (descritivo do cargo + documentos exigidos) que TODOS os tenants veem e importam.
// Editar descritivo/requisitos/documentos sobe a versão → as empresas que importaram veem "versão nova".
// Tirar da biblioteca só desativa: as cópias das empresas continuam intactas.
import { useState, useEffect, useCallback } from "react";

export default function BibliotecaFuncoes({ token, chamar, C, input, label, card, btn, tag, onAviso }) {
  const [dados, setDados] = useState(null);
  const [form, setForm] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try { setDados(await chamar(token, "GET", "/biblioteca/funcoes")); }
    catch (e) { onAviso({ tipo: "erro", texto: e.message }); }
  }, [token, chamar, onAviso]);
  useEffect(() => { carregar(); }, [carregar]);

  const tipos = dados?.tipos_documento || [];
  const nomeTipo = (c) => tipos.find((t) => t.codigo === c)?.nome || c;

  const salvar = async () => {
    setSalvando(true);
    try {
      const corpo = { nome: form.nome, descritivo: form.descritivo, requisitos: form.requisitos, documentos: form.documentos.map((codigo) => ({ codigo })) };
      const r = form.id ? await chamar(token, "PUT", `/biblioteca/funcoes/${form.id}`, corpo) : await chamar(token, "POST", "/biblioteca/funcoes", corpo);
      onAviso({ tipo: "ok", texto: form.id ? (r?.versao_subiu ? `Modelo salvo — versão ${r.modelo?.versao}. Quem importou verá "versão nova".` : "Modelo salvo.") : "Modelo criado na biblioteca." });
      setForm(null); await carregar();
    } catch (e) { onAviso({ tipo: "erro", texto: e.message }); }
    finally { setSalvando(false); }
  };

  const desativar = async () => {
    const m = confirmar; setConfirmar(null);
    try { await chamar(token, "DELETE", `/biblioteca/funcoes/${m.id}`); onAviso({ tipo: "ok", texto: `${m.nome} saiu da biblioteca.` }); await carregar(); }
    catch (e) { onAviso({ tipo: "erro", texto: e.message }); }
  };

  if (!dados) return <div style={{ color: C.muted }}>Carregando…</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: C.sub, flex: 1, minWidth: 240 }}>
          Modelos de função que todas as transportadoras veem em <b style={{ color: C.text }}>👷 Pessoas → Funções → Importar da biblioteca</b>. Importar faz uma cópia que a empresa adapta.
        </div>
        <button type="button" onClick={() => setForm({ nome: "", descritivo: "", requisitos: "", documentos: [] })} style={btn(C.accent)}>＋ Novo modelo</button>
      </div>

      {dados.modelos.length === 0 && <div style={{ ...card, padding: 24, color: C.sub, textAlign: "center" }}>Nenhum modelo. Rode a migration 024 ou crie o primeiro.</div>}
      <div style={{ display: "grid", gap: 10 }}>
        {dados.modelos.map((m) => (
          <div key={m.id} style={{ ...card, padding: "14px 16px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 200 }}>{m.nome}</div>
              <span style={tag(C.violet)}>v{m.versao || 1}</span>
              <span style={tag(C.muted)}>{m.importacoes} empresa(s) importaram</span>
              <button type="button" onClick={() => setForm({ id: m.id, nome: m.nome, descritivo: m.descritivo || "", requisitos: m.requisitos || "", documentos: (m.documentos || []).map((d) => d.codigo) })} style={btn(C.accent, false)}>Editar</button>
              <button type="button" onClick={() => setConfirmar(m)} style={btn(C.danger, false)}>Tirar da biblioteca</button>
            </div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>{(m.descritivo || "").slice(0, 220)}{(m.descritivo || "").length > 220 ? "…" : ""}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {(m.documentos || []).map((d) => <span key={d.codigo} style={tag(C.accent)}>📄 {nomeTipo(d.codigo)}</span>)}
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 50, padding: "40px 16px", overflowY: "auto" }} onClick={() => !salvando && setForm(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 640, padding: "20px 22px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{form.id ? "Editar modelo" : "Novo modelo de função"}</div>
            <label style={{ display: "block", marginBottom: 12 }}><span style={label}>NOME</span>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={input} /></label>
            <label style={{ display: "block", marginBottom: 12 }}><span style={label}>DESCRITIVO (ATIVIDADES E RESPONSABILIDADES)</span>
              <textarea rows={6} value={form.descritivo} onChange={(e) => setForm({ ...form, descritivo: e.target.value })} style={{ ...input, resize: "vertical" }} /></label>
            <label style={{ display: "block", marginBottom: 12 }}><span style={label}>REQUISITOS (ESCOLARIDADE, EXPERIÊNCIA, HABILITAÇÃO)</span>
              <textarea rows={3} value={form.requisitos} onChange={(e) => setForm({ ...form, requisitos: e.target.value })} style={{ ...input, resize: "vertical" }} /></label>
            <span style={label}>DOCUMENTOS EXIGIDOS</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              {tipos.map((t) => {
                const on = form.documentos.includes(t.codigo);
                return (
                  <label key={t.codigo} style={{ ...tag(on ? C.accent : C.muted), cursor: "pointer", padding: "5px 10px", fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="checkbox" checked={on} onChange={() => setForm({ ...form, documentos: on ? form.documentos.filter((c) => c !== t.codigo) : [...form.documentos, t.codigo] })} />
                    {t.nome}
                  </label>
                );
              })}
            </div>
            {form.id && <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Mudou descritivo, requisitos ou documentos → sobe a versão e as empresas que importaram veem "versão nova" (elas decidem se atualizam).</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setForm(null)} style={btn(C.muted, false)}>Cancelar</button>
              <button type="button" onClick={salvar} disabled={salvando || !form.nome.trim()} style={{ ...btn(C.accent), opacity: salvando || !form.nome.trim() ? 0.5 : 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}

      {confirmar && (
        <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onClick={() => setConfirmar(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 460, padding: "20px 22px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: C.danger }}>Tirar da biblioteca</div>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, marginBottom: 14 }}>
              <b style={{ color: C.text }}>{confirmar.nome}</b> deixa de aparecer para importar. As {confirmar.importacoes} empresa(s) que já importaram continuam com a cópia delas.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setConfirmar(null)} style={btn(C.muted, false)}>Cancelar</button>
              <button type="button" onClick={desativar} style={btn(C.danger)}>Tirar da biblioteca</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
