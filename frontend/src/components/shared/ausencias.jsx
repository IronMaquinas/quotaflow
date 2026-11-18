// components/shared/ausencias.jsx — etapa B1.15: 🏖 quem estará ausente (férias) — avisa na AT, OS, tarefa, turma e na busca de pessoas.
//   Busca única e em cache (/api/ausencias — hoje até 12 meses; renova a cada 5 min). Avisa, não trava.
import { useEffect, useState } from "react";
import apiService from "../../services/apiService";

let cache = null; let quando = 0; let pendente = null; const ouvintes = new Set();
function carregar() {
  if (cache && Date.now() - quando < 5 * 60e3) return Promise.resolve(cache);
  if (!pendente) pendente = apiService.get("/ausencias").then((r) => { cache = r.ausencias || []; quando = Date.now(); ouvintes.forEach((f) => f(cache)); return cache; }).catch(() => (cache = cache || [])).finally(() => { pendente = null; });
  return pendente;
}
export function useAusencias() {
  const [l, setL] = useState(cache || []);
  useEffect(() => { ouvintes.add(setL); carregar().then(setL); return () => ouvintes.delete(setL); }, []);
  return l;
}
export const limparCacheAusencias = () => { cache = null; };
const d10 = (v) => (v ? String(v).slice(0, 10) : null);
export const dBR = (v) => (v ? String(v).slice(0, 10).split("-").reverse().join("/") : "");
/** ausências da pessoa (por colaborador_id, usuario_id ou nome) que batem com [de, ate] (sem datas: as próximas) */
export function ausenciasDe(lista, p, de = null, ate = null) {
  if (!p) return [];
  const nome = String(p.nome || "").trim().toLowerCase();
  const eh = (a) => (p.colaborador_id != null && p.colaborador_id !== "" && String(a.colaborador_id) === String(p.colaborador_id)) || (p.usuario_id != null && p.usuario_id !== "" && a.usuario_id != null && String(a.usuario_id) === String(p.usuario_id)) || (!p.colaborador_id && !p.usuario_id && nome && String(a.nome).toLowerCase() === nome);
  const i = d10(de), f = d10(ate) || i;
  return lista.filter((a) => eh(a) && (!i || !(f < a.inicio || i > a.fim)));
}
/** ⚠ aviso pronto para colocar embaixo do campo da pessoa */
export default function AvisoAusencia({ C, pessoa, de, ate, oque = "esta programação" }) {
  const l = useAusencias(); const xs = ausenciasDe(l, pessoa, de, ate);
  if (!xs.length) return null;
  const n = String(pessoa?.nome || xs[0].nome).split(" ")[0];
  return <div style={{ fontSize: 12.5, color: C.warn || "#f59e0b", marginTop: 6, padding: "6px 10px", border: `1px solid ${(C.warn || "#f59e0b")}66`, borderRadius: 8, background: `${C.warn || "#f59e0b"}12` }}>
    🏖 {n} estará de férias de {dBR(xs[0].inicio)} a {dBR(xs[0].fim)} — revise {oque}.</div>;
}
