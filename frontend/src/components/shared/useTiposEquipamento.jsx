// components/shared/tiposEquipamento.jsx — etapa B2.0: lista de tipos de equipamento da empresa (em cache) para telas de programação
import { useEffect, useState } from "react";
import apiService from "../../services/apiService";
let cache = null; let pendente = null;
export function useTiposEquipamento() {
  const [l, setL] = useState(cache || []);
  useEffect(() => { if (cache) return; if (!pendente) pendente = apiService.get("/tipos-equipamento").then((r) => (cache = (r.tipos || []).filter((t) => t.ativo !== false))).catch(() => (cache = [])).finally(() => { pendente = null; }); pendente?.then((x) => setL(x || [])); }, []);
  return l;
}
