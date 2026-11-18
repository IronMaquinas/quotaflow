// components/configuracoes/TiposEquipamento.jsx — etapa B2.0: 🚛 tipos de equipamento/ativo da empresa
//   A lista começa pelo segmento (transporte, locação…) e a empresa personaliza: nome, ícone, apelidos (a 👋 Beta entende), ativo.
//   "Equipamentos sem tipo": o sistema sugere pelo nome e você confirma de uma vez.
import { useEffect, useState } from "react";
import apiService from "../../services/apiService";
import { Toggle } from "../../plataforma/ModulosPlataforma";

export default function TiposEquipamento({ C, s, onErro, podeEditar = true }) {
  const [tipos, setTipos] = useState(null); const [novo, setNovo] = useState({ nome: "", icone: "", sinonimos: "" }); const [edit, setEdit] = useState(null);
  const [sug, setSug] = useState(null); const [marc, setMarc] = useState({}); const [msg, setMsg] = useState("");
  const carregar = async () => {
    try { setTipos((await apiService.get("/tipos-equipamento")).tipos || []); } catch (e) { onErro?.(e?.response?.data?.erro || e.message); setTipos([]); }
    if (podeEditar) try { const r = await apiService.get("/tipos-equipamento/sugestoes"); setSug(r.itens || []); const m = {}; (r.itens || []).forEach((x) => { if (x.tipo_id) m[x.id] = String(x.tipo_id); }); setMarc(m); } catch { setSug([]); }
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line
  const salvar = async (fn, ok) => { setMsg(""); try { await fn(); setMsg(ok); await carregar(); } catch (e) { onErro?.(e?.response?.data?.erro || e.message); } };
  const ativos = (tipos || []).filter((t) => t.ativo !== false);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ ...s.card, padding: "18px 20px" }}>
        <div style={{ fontSize: 12, color: C.textSub, fontWeight: 600, marginBottom: 4 }}>TIPOS DE EQUIPAMENTO / ATIVO</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12 }}>O que a sua empresa programa, aluga ou opera (carreta, cavalo, ônibus, contêiner, gerador…). Aparece no cadastro do equipamento e na programação, e a 👋 Beta entende o nome e os <b>apelidos</b> — ex.: "tem carreta livre dia 10?".</div>
        {tipos == null ? <div style={{ color: C.muted, fontSize: 13 }}>Carregando…</div> : (
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
            {tipos.map((t, i) => (
              <div key={t.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 12px", borderTop: i ? `1px solid ${C.border}` : "none", opacity: t.ativo === false ? 0.55 : 1 }}>
                {edit?.id === t.id ? <>
                  <input value={edit.icone || ""} onChange={(e) => setEdit({ ...edit, icone: e.target.value })} style={{ ...s.input, width: 56, textAlign: "center" }} placeholder="🚚" />
                  <input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} style={{ ...s.input, flex: "1 1 180px" }} />
                  <input value={edit.sinonimos} onChange={(e) => setEdit({ ...edit, sinonimos: e.target.value })} style={{ ...s.input, flex: "2 1 260px" }} placeholder="apelidos, separados por vírgula" />
                  <button onClick={() => salvar(() => apiService.put(`/tipos-equipamento/${t.id}`, edit), "Tipo atualizado.").then(() => setEdit(null))} style={{ ...s.btn(true), cursor: "pointer" }}>Salvar</button>
                  <button onClick={() => setEdit(null)} style={{ ...s.btn(false), cursor: "pointer" }}>Cancelar</button>
                </> : <>
                  <span style={{ fontSize: 18, width: 26, textAlign: "center" }}>{t.icone || "📦"}</span>
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.nome}</div>
                    <div style={{ fontSize: 11.5, color: C.muted, overflowWrap: "anywhere" }}>{(t.sinonimos || []).length ? `apelidos: ${(t.sinonimos || []).join(", ")}` : "sem apelidos"}</div>
                  </div>
                  {podeEditar && <>
                    <Toggle C={C} ligado={t.ativo !== false} rotulo={t.ativo !== false ? "ativo" : "inativo"} onChange={(v) => salvar(() => apiService.put(`/tipos-equipamento/${t.id}`, { ativo: v }), v ? "Tipo ativado." : "Tipo desativado.")} />
                    <button onClick={() => setEdit({ id: t.id, nome: t.nome, icone: t.icone || "", sinonimos: (t.sinonimos || []).join(", ") })} style={{ ...s.btn(false), cursor: "pointer", padding: "5px 10px", fontSize: 12, color: C.text }}>Editar</button>
                  </>}
                </>}
              </div>
            ))}
            {podeEditar && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "10px 12px", borderTop: `1px solid ${C.border}`, background: `${C.accent}08` }}>
              <input value={novo.icone} onChange={(e) => setNovo({ ...novo, icone: e.target.value })} style={{ ...s.input, width: 56, textAlign: "center" }} placeholder="🚚" />
              <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} style={{ ...s.input, flex: "1 1 180px" }} placeholder="Novo tipo — ex.: Prancha, Gerador 100 kVA" />
              <input value={novo.sinonimos} onChange={(e) => setNovo({ ...novo, sinonimos: e.target.value })} style={{ ...s.input, flex: "2 1 260px" }} placeholder="apelidos (opcional), separados por vírgula" />
              <button disabled={!novo.nome.trim()} onClick={() => salvar(() => apiService.post("/tipos-equipamento", novo), "Tipo incluído.").then(() => setNovo({ nome: "", icone: "", sinonimos: "" }))} style={{ ...s.btn(true), cursor: "pointer" }}>＋ Incluir</button>
            </div>}
          </div>)}
        {msg && <div style={{ fontSize: 12.5, color: "#22c55e", marginTop: 8 }}>✓ {msg}</div>}
      </div>

      {podeEditar && sug && sug.length > 0 && (
        <div style={{ ...s.card, padding: "18px 20px" }}>
          <div style={{ fontSize: 12, color: C.textSub, fontWeight: 600, marginBottom: 4 }}>EQUIPAMENTOS SEM TIPO ({sug.length})</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 10 }}>Sugeri o tipo pelo nome — confira e aplique de uma vez. Sem tipo, o equipamento não entra na consulta "tem carreta livre…?".</div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, maxHeight: 380, overflowY: "auto" }}>
            {sug.map((x, i) => (
              <div key={x.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 12px", borderTop: i ? `1px solid ${C.border}` : "none" }}>
                <div style={{ flex: "1 1 220px", fontSize: 13 }}><b>{x.tag}</b> <span style={{ color: C.textSub }}>{x.nome}</span></div>
                <select value={marc[x.id] || ""} onChange={(e) => setMarc({ ...marc, [x.id]: e.target.value })} style={{ ...s.input, flex: "0 1 260px" }}>
                  <option value="">— deixar sem tipo —</option>{ativos.map((t) => <option key={t.id} value={t.id}>{t.icone ? `${t.icone} ` : ""}{t.nome}</option>)}</select>
              </div>))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button disabled={!Object.values(marc).some(Boolean)} onClick={() => salvar(() => apiService.post("/tipos-equipamento/aplicar", { itens: Object.entries(marc).filter(([, v]) => v).map(([id, tipo_id]) => ({ id, tipo_id })) }), "Tipos aplicados aos equipamentos.")} style={{ ...s.btn(true), cursor: "pointer" }}>Aplicar a {Object.values(marc).filter(Boolean).length} equipamento(s)</button>
          </div>
        </div>)}
    </div>
  );
}
