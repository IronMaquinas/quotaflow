// components/contratos/TelaLocatario.jsx — etapa 14b.3
// Tela do LOCATÁRIO (perfil "locatario", cliente que aluga equipamento): só os contratos ATIVOS dele.
//   • equipamentos de cada contrato com a inspeção de rotina (em dia / vence hoje / atrasada) → 🔍 Inspecionar
//   • inspeções feitas nos equipamentos do contrato (dele e da empresa: entrega, rotinas) → detalhe e relatório
// A inspeção usa o mesmo app (ExecutarInspecao), inclusive sem internet (fila no aparelho).
// Todo o escopo é aplicado no servidor pelo usuário logado (/api/locatario).
import { useState, useEffect, useCallback } from "react";
import apiService from "../../services/apiService";
import ExecutarInspecao from "../inspecoes/ExecutarInspecao";
import { DetalheInspecao } from "../inspecoes/TelaInspecoes";
import { corEstado, txtEstado } from "../inspecoes/RotinasLocacao";
import * as Fila from "../../utils/filaInspecoes";
import { abrirRelatorioInspecao, prepararJanela } from "../../utils/gerarRelatorioInspecao";

const RES = { aprovado: ["✓ Aprovado", "#22c55e"], ressalvas: ["⚠ Ressalvas", "#f59e0b"], reprovado: ["⛔ Reprovado", "#ef4444"] };
const dataBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const dataHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

export default function TelaLocatario({ C, s, usuario }) {
  const tenant = `loc-${usuario?.id || "u"}`;
  const [d, setD] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [exec, setExec] = useState(null);
  const [ver, setVer] = useState(null);
  const [foto, setFoto] = useState(null);
  const [locais, setLocais] = useState([]);
  const ok = (t) => setAviso({ tipo: "ok", texto: t });
  const err = (t) => setAviso({ tipo: "erro", texto: t });
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(null), 7000); return () => clearTimeout(t); }, [aviso]);

  const enviar = (corpo) => apiService.post("/locatario/enviar", corpo);
  const carregarLocais = useCallback(async () => setLocais(await Fila.listar(tenant)), [tenant]);
  const carregar = useCallback(async () => {
    try { setD(await apiService.get("/locatario/painel")); } catch (e) { err(e.body ? e.message : "Sem internet — as inspeções feitas ficam guardadas neste aparelho."); }
    await carregarLocais();
  }, [carregarLocais]);
  const sincronizar = useCallback(async () => { const r = await Fila.sincronizar(tenant, enviar); if (r.enviadas) { ok(`${r.enviadas} inspeção(ões) guardada(s) foram enviadas.`); await carregar(); } else await carregarLocais(); }, [tenant, carregar, carregarLocais]); // eslint-disable-line
  useEffect(() => { carregar().then(sincronizar); const on = () => sincronizar(); window.addEventListener("online", on); return () => window.removeEventListener("online", on); }, []); // eslint-disable-line

  const inspecionar = (e, r) => setExec({ equipamento: { id: e.equipamento_id, tag: e.tag }, chavePrep: `${e.equipamento_id}-${r.modelo_id}`,
    carregarPrep: () => apiService.get(`/locatario/preparar/${e.equipamento_id}`, { modelo_id: r.modelo_id }) });
  const abrir = async (id) => { try { setVer(await apiService.get(`/locatario/inspecoes/${id}`)); } catch (e) { err(e.message); } };

  if (exec) return <ExecutarInspecao tenant={tenant} C={C} s={s} enviarFn={enviar} {...exec} onFechar={() => { setExec(null); carregarLocais(); }}
    onConcluida={async (r) => { setExec(null); ok(r.offline ? "Sem internet: a inspeção ficou guardada neste aparelho e será enviada quando a conexão voltar." : r.bloqueou ? "⛔ Inspeção enviada — NÃO use o equipamento até a locadora liberar." : `✓ Inspeção ${r.numero || ""} enviada.`); await carregar(); }} />;

  const card = { ...s.card, padding: 14, marginBottom: 10 };
  return (
    <div style={{ padding: "16px 14px", maxWidth: 900, margin: "0 auto" }}>
      {aviso && <div style={{ ...s.card, padding: "10px 14px", marginBottom: 12, fontSize: 13, borderColor: aviso.tipo === "erro" ? C.danger : C.success, color: aviso.tipo === "erro" ? C.danger : C.success }}>{aviso.texto}</div>}
      {locais.length > 0 && <div style={{ ...card, borderColor: C.warn }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.warn, marginBottom: 6 }}>💾 Guardadas neste aparelho</div>
        {locais.map((x) => (
          <div key={x.uid} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "4px 0", flexWrap: "wrap" }}>
            <span style={{ flex: 1 }}>{x.rotulo}</span>
            {x.situacao === "rascunho" && <button type="button" onClick={() => setExec({ rascunho: x })} style={{ ...s.btn(true, C.accent), cursor: "pointer", padding: "6px 12px" }}>Continuar</button>}
            {x.situacao === "pendente" && <span style={s.tag(C.warn)}>AGUARDANDO INTERNET</span>}
            {x.situacao === "erro" && <button type="button" title={x.erro} onClick={() => { const y = { ...x, situacao: "rascunho" }; Fila.salvar(y).then(() => setExec({ rascunho: y })); }} style={{ ...s.btn(true, C.danger), cursor: "pointer", padding: "6px 12px" }}>Corrigir</button>}
          </div>))}
      </div>}

      {!d ? <div style={{ color: C.muted }}>Carregando…</div> : d.contratos.length === 0 ? (
        <div style={{ ...card, color: C.textSub }}>Nenhum contrato de locação ativo no seu acesso. Fale com a locadora.</div>
      ) : d.contratos.map((c) => (
        <div key={c.id} style={card}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 16 }}>📑 {c.numero}</div><div style={{ fontSize: 12, color: C.textSub }}>{c.cliente}{c.local ? ` · ${c.local}` : ""} · {dataBR(c.inicio)} → {c.fim_previsto ? dataBR(c.fim_previsto) : "sem prazo"}</div></div>
            {c.atrasadas > 0 && <span style={s.tag(C.danger)}>⚠ {c.atrasadas} atrasada(s)</span>}
          </div>
          {c.equipamentos.map((e) => (
            <div key={e.equipamento_id} style={{ borderTop: `1px solid ${C.border}`, marginTop: 10, paddingTop: 10 }}>
              <div style={{ fontWeight: 600 }}>🚜 {e.tag} <span style={{ color: C.textSub, fontWeight: 400 }}>— {e.nome}</span>{e.bloqueado && <span style={{ ...s.tag(C.danger), marginLeft: 6 }}>⛔ NÃO USAR — aguardando a locadora</span>}</div>
              {e.rotinas.length === 0 && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Sem inspeção de rotina definida pela locadora.</div>}
              {e.rotinas.map((r) => (
                <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 200px", fontSize: 13 }}>⏰ {r.frequencia_nome} · {r.modelo_nome}<div style={{ fontSize: 12, color: corEstado(C, r), fontWeight: 600 }}>{txtEstado(r)}{r.ultima ? ` · última ${dataBR(r.ultima)}` : ""}</div></div>
                  <button type="button" onClick={() => inspecionar(e, r)} style={{ ...s.btn(true, r.estado === "atrasada" ? C.danger : C.accent), cursor: "pointer", padding: "10px 16px" }}>🔍 Inspecionar</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      {d && d.inspecoes.length > 0 && <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>📋 Inspeções</div>
        {d.inspecoes.map((i) => { const r = RES[i.resultado] || ["—", C.muted]; return (
          <div key={i.id} onClick={() => abrir(i.id)} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${C.border}`, cursor: "pointer", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px", fontSize: 13 }}><b>{i.equipamento_nome}</b><div style={{ fontSize: 11, color: C.muted }}>{i.numero || `nº ${i.id}`} · {i.modelo_nome} · {i.executor_nome} · {dataHora(i.concluida_em)}</div></div>
            <span style={s.tag(r[1])}>{r[0]}</span>{i.corrigida && <span style={s.tag(C.success)}>✓ Corrigido</span>}
          </div>); })}
      </div>}

      {ver && (
        <div style={{ position: "fixed", inset: 0, background: "#00000090", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, overflowY: "auto" }} onClick={() => setVer(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...s.card, width: 860, maxWidth: "100%", padding: "18px 20px", margin: "auto 0" }}>
            <DetalheInspecao d={ver} C={C} s={s} bt={(cor, cheio = true) => ({ ...s.btn(true, cor), cursor: "pointer", padding: "7px 12px", fontSize: 12, ...(cheio ? {} : { background: "transparent", color: cor }) })}
              onFoto={(url, legenda) => setFoto({ url, legenda })} onRelatorio={() => { const w = prepararJanela(); try { abrirRelatorioInspecao(ver, w); } catch (e) { err(e.message); } }} onFechar={() => setVer(null)} />
          </div>
        </div>
      )}
      {foto && (
        <div onClick={() => setFoto(null)} style={{ position: "fixed", inset: 0, background: "#000000e6", zIndex: 340, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16, cursor: "zoom-out" }}>
          <img src={foto.url} alt="" style={{ maxWidth: "100%", maxHeight: "85vh", objectFit: "contain", borderRadius: 6 }} />
          <div style={{ color: "#e2e8f0", fontSize: 13, marginTop: 10 }}>{foto.legenda}</div>
        </div>)}
    </div>
  );
}
