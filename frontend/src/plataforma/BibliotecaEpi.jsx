// src/plataforma/BibliotecaEpi.jsx — etapa 12d.1b
// Console da Plataforma → aba "🦺 Catálogo de EPI".
// Tipos de EPI que TODOS os tenants usam (busca com autocompletar no cadastro de EPI e nos kits das funções).
// O tenant pode criar os dele (código p_…). Desativar tira do catálogo, mas o que as empresas já cadastraram fica.
import { useState, useEffect, useCallback } from "react";

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const GRADE_L = { calcado: "Calçado", camisa: "Camisa / vestimenta", calca: "Calça", luva: "Luva" };

export default function BibliotecaEpi({ token, chamar, C, input, label, card, btn, tag, onAviso }) {
  const [dados, setDados] = useState(null);
  const [form, setForm] = useState(null);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try { setDados(await chamar(token, "GET", "/biblioteca/epi-tipos")); }
    catch (e) { onAviso({ tipo: "erro", texto: /epi_tipos/.test(e.message) ? "Rode a migration 027 (catálogo de EPI)." : e.message }); }
  }, [token, chamar, onAviso]);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    setSalvando(true);
    try {
      const corpo = { nome: form.nome, grade: form.grade || null, troca_dias_padrao: form.troca_dias_padrao === "" ? null : form.troca_dias_padrao, ordem: form.ordem };
      if (form.id) await chamar(token, "PUT", `/biblioteca/epi-tipos/${form.id}`, corpo);
      else await chamar(token, "POST", "/biblioteca/epi-tipos", { ...corpo, codigo: form.codigo });
      onAviso({ tipo: "ok", texto: form.id ? "Tipo de EPI salvo." : "Tipo de EPI criado no catálogo." });
      setForm(null); await carregar();
    } catch (e) { onAviso({ tipo: "erro", texto: e.message }); }
    finally { setSalvando(false); }
  };
  const alternar = async (t) => {
    try { await chamar(token, "PUT", `/biblioteca/epi-tipos/${t.id}`, { ativo: t.ativo === false }); await carregar(); }
    catch (e) { onAviso({ tipo: "erro", texto: e.message }); }
  };

  if (!dados) return <div style={{ color: C.muted }}>Carregando…</div>;
  const lista = dados.tipos.filter((t) => !busca.trim() || semAcento(`${t.nome} ${t.codigo}`).includes(semAcento(busca.trim())));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: C.sub, flex: 1, minWidth: 240 }}>
          Tipos de EPI que todas as transportadoras usam no cadastro de EPI e nos kits das funções. Cada empresa pode criar os dela.
        </div>
        <button type="button" onClick={() => setForm({ codigo: "", nome: "", grade: "", troca_dias_padrao: "", ordem: 500 })} style={btn(C.accent)}>＋ Novo tipo</button>
      </div>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar tipo de EPI…" style={{ ...input, maxWidth: 360, marginBottom: 12 }} />
      <div style={{ ...card, overflow: "hidden" }}>
        {lista.map((t, i) => (
          <div key={t.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: i < lista.length - 1 ? `1px solid ${C.border}` : "none", opacity: t.ativo === false ? 0.5 : 1, flexWrap: "wrap" }}>
            <div style={{ flex: "2 1 220px" }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t.nome}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{t.codigo}</div>
            </div>
            <div style={{ flex: "1 1 140px", fontSize: 12, color: C.sub }}>{t.grade ? `Tamanho: ${GRADE_L[t.grade]}` : "Sem tamanho"}{t.troca_dias_padrao ? ` · troca ${t.troca_dias_padrao} d` : ""}</div>
            {t.ativo === false && <span style={tag(C.muted)}>Fora do catálogo</span>}
            <button type="button" onClick={() => setForm({ id: t.id, codigo: t.codigo, nome: t.nome, grade: t.grade || "", troca_dias_padrao: t.troca_dias_padrao || "", ordem: t.ordem })} style={btn(C.accent, false)}>Editar</button>
            <button type="button" onClick={() => alternar(t)} style={btn(t.ativo === false ? C.success : C.danger, false)}>{t.ativo === false ? "Voltar ao catálogo" : "Tirar do catálogo"}</button>
          </div>
        ))}
        {lista.length === 0 && <div style={{ padding: 20, color: C.sub, textAlign: "center" }}>Nenhum tipo encontrado.</div>}
      </div>

      {form && (
        <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onClick={() => !salvando && setForm(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 480, padding: "20px 22px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{form.id ? "Editar tipo de EPI" : "Novo tipo de EPI"}</div>
            <label style={{ display: "block", marginBottom: 12 }}><span style={label}>NOME</span>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Luva de PVC cano longo" style={input} /></label>
            {!form.id && <label style={{ display: "block", marginBottom: 12 }}><span style={label}>CÓDIGO (OPCIONAL — GERADO PELO NOME)</span>
              <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="luva_pvc" style={input} /></label>}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <label style={{ flex: "1 1 160px" }}><span style={label}>USA TAMANHO DE</span>
                <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} style={input}>
                  <option value="">Sem tamanho</option>{Object.entries(GRADE_L).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label style={{ flex: "1 1 110px" }}><span style={label}>TROCA PADRÃO (DIAS)</span>
                <input type="number" min={1} max={3650} value={form.troca_dias_padrao} onChange={(e) => setForm({ ...form, troca_dias_padrao: e.target.value })} style={input} /></label>
              <label style={{ flex: "0 1 80px" }}><span style={label}>ORDEM</span>
                <input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} style={input} /></label>
            </div>
            {form.id && <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>O código não muda (os kits das funções usam o código).</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setForm(null)} style={btn(C.muted, false)}>Cancelar</button>
              <button type="button" onClick={salvar} disabled={salvando || !form.nome.trim()} style={{ ...btn(C.accent), opacity: salvando || !form.nome.trim() ? 0.5 : 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
