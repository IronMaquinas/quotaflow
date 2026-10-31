// components/programacao/EditorFluxo.jsx — etapa 16e: 🧭 FLUXO DA VIAGEM (2º passo do "Programar")
// A sequência sugerida já vem marcada; o programador tira (✕), acrescenta (＋) e reordena (↑ ↓).
// Cada inspeção: modelo de 🔍 Inspeções + equipamento do conjunto. A ORDEM vale para o motorista (só abre a próxima com a anterior feita).
// Etapas já feitas (AT em andamento) aparecem travadas no topo.

const INSP = { equipamento: "🔍 Inspeção de liberação", carregamento: "🔍 Inspeção de carregamento", transito: "🔍 Inspeção em trânsito", descarregamento: "🔍 Inspeção de descarregamento" };
const TIPO_NOME = { equipamento: "Liberação do equipamento", carregamento: "Carregamento", transito: "Trânsito", descarregamento: "Descarregamento" };
const MARCOS_PADRAO = { saida_base: "🏭 Saída da base", chegada_cliente: "📍 Chegada no cliente (coleta)", saida_viagem: "🛣 Saída para a viagem (carregado)", chegada_destino: "🏁 Chegada ao destino" };
const nid = () => Math.random().toString(16).slice(2, 10);

/** mesma sugestão do servidor (fluxoViagem.fluxoPadrao) */
export function fluxoPadrao({ conjunto = [], modelos = [], equipamentos = [], marcos = {} }) {
  const doTipo = (t) => modelos.filter((m) => m.tipo === t);
  const cavalo = conjunto.find((c) => c.papel === "cavalo") || conjunto[0]; const ultimo = conjunto[conjunto.length - 1] || cavalo;
  const insp = (tipo, m, e) => ({ id: nid(), tipo: "inspecao", modelo_tipo: tipo, modelo_id: m.id, modelo_nome: m.nome, equipamento_id: e?.id ?? null, equipamento_tag: e?.tag || e?.nome || null, rotulo: `${INSP[tipo]}${tipo === "equipamento" && e ? ` — ${e.tag || e.nome}` : ""}`, status: "pendente" });
  const marco = (k) => ({ id: nid(), tipo: "marco", marco: k, rotulo: marcos[k] || MARCOS_PADRAO[k] || k, status: "pendente" });
  const out = [];
  for (const c of conjunto) { const eq = equipamentos.find((e) => String(e.id) === String(c.id)); const m = doTipo("equipamento").find((x) => String(x.id) === String(eq?.inspecao_modelo_id)) || doTipo("equipamento")[0]; if (m) out.push(insp("equipamento", m, c)); }
  out.push(marco("saida_base"), marco("chegada_cliente"));
  if (doTipo("carregamento")[0]) out.push(insp("carregamento", doTipo("carregamento")[0], ultimo));
  out.push(marco("saida_viagem"));
  if (doTipo("transito")[0]) out.push(insp("transito", doTipo("transito")[0], ultimo));
  out.push(marco("chegada_destino"));
  if (doTipo("descarregamento")[0]) out.push(insp("descarregamento", doTipo("descarregamento")[0], ultimo));
  return out;
}
/** o fluxo guardado ainda serve para este conjunto? (equipamento trocado → refaz as pendentes) */
export const fluxoServe = (fluxo, conjunto) => Array.isArray(fluxo) && fluxo.length > 0 && fluxo.every((x) => x.tipo !== "inspecao" || x.status !== "pendente" || conjunto.some((c) => String(c.id) === String(x.equipamento_id)));

export default function EditorFluxo({ C, s, fluxo, setFluxo, base, conjunto }) {
  const modelos = base.modelos_inspecao || []; const marcos = base.marcos || MARCOS_PADRAO;
  const feitas = fluxo.filter((x) => x.status && x.status !== "pendente");
  const pend = fluxo.filter((x) => !x.status || x.status === "pendente");
  const setPend = (l) => setFluxo([...feitas, ...l]);
  const mover = (i, d) => { const l = [...pend]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; setPend(l); };
  const mudar = (i, x) => setPend(pend.map((y, k) => (k === i ? x : y)));
  const faltaTipo = ["equipamento", "carregamento", "transito", "descarregamento"].filter((t) => !modelos.some((m) => m.tipo === t));
  const addInsp = (tipo) => { const m = modelos.find((x) => x.tipo === tipo) || modelos[0]; if (!m) return; const e = tipo === "equipamento" ? conjunto[0] : conjunto[conjunto.length - 1];
    setPend([...pend, { id: nid(), tipo: "inspecao", modelo_tipo: m.tipo, modelo_id: m.id, modelo_nome: m.nome, equipamento_id: e?.id ?? null, equipamento_tag: e?.tag || e?.nome, rotulo: `${INSP[m.tipo] || "🔍 Inspeção"}`, status: "pendente" }]); };
  const addMarco = (k) => setPend([...pend, { id: nid(), tipo: "marco", marco: k, rotulo: marcos[k], status: "pendente" }]);
  const mini = (cor = C.textSub) => ({ background: "transparent", border: `1px solid ${C.border}`, color: cor, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 });
  return (
    <div>
      <div style={{ fontSize: 12.5, color: C.textSub, marginBottom: 8 }}>O motorista recebe estas etapas <b style={{ color: C.text }}>nesta ordem</b> (pelo 📲 link): a próxima só abre com a anterior feita. Inspeção reprovada trava a seguinte até um gestor liberar. A viagem começa sozinha na 1ª etapa e termina na última.</div>
      {feitas.map((x, i) => <div key={x.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 8px", borderRadius: 6, background: `${C.success}12`, marginBottom: 4, fontSize: 12.5 }}>
        <span style={{ width: 22, color: C.muted }}>{i + 1}</span><span style={{ flex: 1 }}>{x.rotulo}</span><span style={{ color: x.status === "reprovada" ? C.danger : C.success, fontSize: 11.5 }}>{x.status === "reprovada" ? "⛔ reprovada" : "✓ feita"}</span></div>)}
      {pend.map((x, i) => (
        <div key={x.id} style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 8px", borderRadius: 6, border: `1px solid ${C.border}`, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ width: 22, color: C.muted, fontSize: 12 }}>{feitas.length + i + 1}</span>
          {x.tipo === "marco" ? <span style={{ flex: "1 1 260px", fontSize: 13 }}>{x.rotulo}</span> : <>
            <span style={{ fontSize: 13, flex: "0 0 auto" }}>🔍</span>
            <select value={x.modelo_id ?? ""} onChange={(e) => { const m = modelos.find((y) => String(y.id) === e.target.value); mudar(i, { ...x, modelo_id: m.id, modelo_nome: m.nome, modelo_tipo: m.tipo, rotulo: `${INSP[m.tipo] || "🔍 Inspeção"}${m.tipo === "equipamento" && x.equipamento_tag ? ` — ${x.equipamento_tag}` : ""}` }); }}
              style={{ ...s.input, padding: "5px 6px", fontSize: 12.5, flex: "1 1 220px", width: "auto" }}>
              {["equipamento", "carregamento", "transito", "descarregamento"].map((t) => modelos.some((m) => m.tipo === t) && <optgroup key={t} label={TIPO_NOME[t]}>{modelos.filter((m) => m.tipo === t).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</optgroup>)}
            </select>
            <select value={x.equipamento_id ?? ""} onChange={(e) => { const c = conjunto.find((y) => String(y.id) === e.target.value); mudar(i, { ...x, equipamento_id: c?.id ?? null, equipamento_tag: c?.tag || c?.nome, rotulo: x.modelo_tipo === "equipamento" ? `${INSP.equipamento} — ${c?.tag || c?.nome}` : x.rotulo }); }}
              style={{ ...s.input, padding: "5px 6px", fontSize: 12.5, width: 120, borderColor: conjunto.some((c) => String(c.id) === String(x.equipamento_id)) ? undefined : C.danger }}>
              <option value="">equipamento…</option>{conjunto.map((c) => <option key={c.id} value={c.id}>{c.tag || c.nome}</option>)}
            </select></>}
          <button type="button" title="Subir" disabled={i === 0} onClick={() => mover(i, -1)} style={mini()}>↑</button>
          <button type="button" title="Descer" disabled={i === pend.length - 1} onClick={() => mover(i, 1)} style={mini()}>↓</button>
          <button type="button" title="Tirar esta etapa" onClick={() => setPend(pend.filter((_, k) => k !== i))} style={mini(C.danger)}>✕</button>
        </div>))}
      {!pend.length && <div style={{ fontSize: 12.5, color: C.muted, padding: 8 }}>Sem etapas — a AT fica manual (▶ Iniciar e ✓ Concluir na ficha).</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11.5, color: C.muted }}>Acrescentar:</span>
        {["equipamento", "carregamento", "transito", "descarregamento"].filter((t) => modelos.some((m) => m.tipo === t)).map((t) => <button key={t} type="button" onClick={() => addInsp(t)} style={mini(C.accent)}>＋ 🔍 {TIPO_NOME[t]}</button>)}
        {Object.entries(marcos).map(([k, r]) => <button key={k} type="button" onClick={() => addMarco(k)} style={mini()}>＋ {r}</button>)}
      </div>
      {faltaTipo.length > 0 && <div style={{ fontSize: 11.5, color: C.warn, marginTop: 6 }}>Sem modelo de inspeção de {faltaTipo.map((t) => TIPO_NOME[t].toLowerCase()).join(", ")} — crie ou importe em 🔍 Inspeções → Modelos para incluir essa etapa.</div>}
    </div>
  );
}
