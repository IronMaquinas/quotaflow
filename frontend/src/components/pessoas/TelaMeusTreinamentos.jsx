// components/pessoas/TelaMeusTreinamentos.jsx — etapa 12e.2b
// "🎓 Meus treinamentos" — colaborador LOGADO (perfil "colaborador" ou qualquer usuário ligado a um colaborador).
// Tudo vem de /api/meus-treinamentos (o backend acha o colaborador pelo usuário logado).
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import AulaEProva, { ListaMeusTreinamentos, CORES, card, baixarCertificado } from "./AreaTreinamentoColaborador";

const api = {
  abrir: (t) => apiService.get(`/meus-treinamentos/${t}`),
  material: (t, i) => apiService.get(`/meus-treinamentos/${t}/material/${i}`),
  prova: (t, respostas) => apiService.post(`/meus-treinamentos/${t}/prova`, { respostas }),
  concluir: (t) => apiService.post(`/meus-treinamentos/${t}/concluir`, {}),
  certificado: (t) => apiService.get(`/meus-treinamentos/${t}/certificado`), // 12e.2c
};

export default function TelaMeusTreinamentos() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aberta, setAberta] = useState(null);
  const carregar = async () => { try { setDados(await apiService.get("/meus-treinamentos")); setErro(""); } catch (e) { setErro(e.message); } };
  useEffect(() => { carregar(); }, []);
  return (
    <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%", maxWidth: 860, boxSizing: "border-box", width: "100%", margin: "0 auto" }}>
      {erro && !dados ? <div style={{ ...card, padding: 20, color: CORES.textSub }}>{erro}</div>
        : !dados ? <div style={{ color: CORES.muted }}>Carregando…</div>
        : aberta ? <AulaEProva api={api} turmaId={aberta} onVoltar={() => { setAberta(null); carregar(); }} onMudou={carregar} />
        : <ListaMeusTreinamentos dados={dados} onAbrir={setAberta} onCertificado={(t) => baixarCertificado(api, t, setErro)} />}
      {erro && dados && <div style={{ color: CORES.danger, fontSize: 13, marginTop: 10 }}>{erro}</div>}
    </div>
  );
}
