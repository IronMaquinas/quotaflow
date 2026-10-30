// components/programacao/MesaProgramacao.jsx — etapa 16c: 🧩 Mesa de programação em CARDS
// Por trecho do pedido, um card por item (um item = um conjunto = uma AT):
//   ＋ a programar (tracejado) → abre o modal · 💾 rascunho (salvo no servidor) → abre o modal · 🚛 AT → abre a ficha
// O card mostra o essencial (data, motorista, conjunto) e o KIT DO MOTORISTA: CNH, CRLV do conjunto e NF-e/CT-e/MDF-e —
// todo chip faz alguma coisa: com arquivo abre no visualizador; NF-e/CT-e/MDF-e faltando abre o seletor de arquivo; CNH/CRLV
// faltando explica onde cadastrar. 📲 copia o link do motorista (WhatsApp).
import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { valorCelula } from "../../utils/gerarBid";
import { COR_STATUS, NOME_STATUS, dataHora } from "./FichaAT";
import EditorAT, { lerArquivo, mimeDe } from "./EditorAT";
import VerArquivo, { ChipDoc, TXT_DOC } from "./VerArquivo";

const FISCAIS = [["nfe", "NF-e"], ["cte", "CT-e"], ["mdfe", "MDF-e"]];
const dBR = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");

function Card({ C, s, pv, item, at, onAbrir, onAbrirAT, onErro, onOk, onMudou, setVer }) {
  const [subindo, setSubindo] = useState(null);
  const resumo = `${item?.n ? `#${item.n} · ` : ""}${(pv.colunas || []).slice(0, 3).map((c) => valorCelula(c, item?.valores?.[c.chave])).filter(Boolean).join(" · ") || `Item ${item?.id}`}`;
  const serie = (at?.itens || []).find((i) => String(i.id) === String(item?.id))?.serie || item?.serie;
  const rasc = at?.status === "rascunho";
  const cor = !at ? C.border : rasc ? C.warn : COR_STATUS[at.status];
  const anexar = async (tipo, arq) => {
    if (!arq) return; if (arq.size > 10 * 1024 * 1024) return onErro("Arquivo maior que 10 MB");
    setSubindo(tipo);
    try { await apiService.post(`/programacao/execucoes/${at.id}/anexos`, { tipo, nome: arq.name, mime: mimeDe(arq), base64: await lerArquivo(arq) }); onOk(`${arq.name} anexado.`); onMudou(); }
    catch (e) { onErro(e.message); } finally { setSubindo(null); }
  };
  const verAnexo = async (a) => { setVer({ nome: a.nome, mime: a.mime }); try { const r = await apiService.get(`/programacao/execucoes/${at.id}/anexos/${a.id}`); setVer({ url: r.url, nome: a.nome, mime: a.mime }); } catch (e) { setVer(null); onErro(e.message); } };
  const verDoc = async (d) => {
    if (!d.documento_id || !d.tem_arquivo) return onErro(`${d.rotulo} de ${d.dono}: ${d.documento_id ? "cadastrado sem arquivo" : "não está cadastrado"} — inclua em ${d.alvo === "motorista" ? "👷 Pessoas → Documentos" : "documentos do equipamento"}.`);
    setVer({ nome: `${d.rotulo} — ${d.dono}` }); try { const r = await apiService.get(`/programacao/documentos/${d.documento_id}`); setVer({ url: r.url, nome: r.nome, mime: r.mime }); } catch (e) { setVer(null); onErro(e.message); }
  };
  const copiarLink = async () => { try { await navigator.clipboard.writeText(at.link_motorista); onOk("📲 Link do motorista copiado — cole no WhatsApp."); } catch { onErro(`Copie o link: ${at.link_motorista}`); } };
  const abrir = () => (!at || rasc ? onAbrir() : onAbrirAT(at.id));
  const conj = (at?.conjunto || []).map((c) => c.tag || c.nome).join(" + ");
  return (
    <div className="qf-clicavel" onClick={abrir} style={{ ...s.card, padding: "10px 12px", cursor: "pointer", border: `1px ${at ? "solid" : "dashed"} ${cor}`, borderLeft: `4px solid ${cor}`, background: at ? C.surface || C.bg : "transparent", display: "flex", flexDirection: "column", gap: 5, minHeight: 104 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <b style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={resumo}>{resumo}</b>
        {!at ? <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>＋ Programar</span> : rasc ? <span style={s.tag(C.warn)}>💾 rascunho</span> : <span style={s.tag(cor)}>{at.numero.replace(/^AT-\d{4}-/, "AT ")} · {NOME_STATUS[at.status]}</span>}
      </div>
      {!at ? <div style={{ fontSize: 12, color: C.muted }}>{item?.valores?.data_prevista ? `previsto ${dBR(item.valores.data_prevista)} · ` : ""}clique para escolher motorista e conjunto</div> : <>
        <div style={{ fontSize: 12, color: C.textSub }}>🗓 {at.inicio_previsto ? dataHora(at.inicio_previsto) : <span style={{ color: C.warn }}>sem data</span>} · 👤 {at.motorista_nome || <span style={{ color: C.warn }}>motorista a definir</span>}{at.liberacao ? " 🔓" : ""}</div>
        <div style={{ fontSize: 12, color: C.textSub }}>🚛 {conj || <span style={{ color: C.warn }}>conjunto a definir</span>}{serie ? <span> · 🔢 série {serie}</span> : null}</div>
        {at.fluxo_resumo && <div style={{ fontSize: 12, color: at.fluxo_resumo.travada ? C.danger : C.textSub }}>{at.fluxo_resumo.travada ? `⛔ ${at.fluxo_resumo.reprovada} reprovada — aguarda liberação` : `🧭 ${at.fluxo_resumo.feitas}/${at.fluxo_resumo.total}${at.fluxo_resumo.atual ? ` · próxima: ${at.fluxo_resumo.atual}` : " · fluxo concluído"}`}</div>}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }} onClick={(e) => e.stopPropagation()}>
          {(at.docs || []).map((d) => <ChipDoc key={d.chave} C={C} status={d.status} rotulo={d.alvo === "motorista" ? d.rotulo : `${d.rotulo} ${d.dono}`} title={`${d.rotulo} de ${d.dono}: ${TXT_DOC[d.status]}${d.vence_em ? ` · vence ${dBR(d.vence_em)}` : ""}`} onClick={() => verDoc(d)} />)}
          {FISCAIS.map(([k, r]) => { const a = (at.anexos || []).find((x) => x.tipo === k);
            return a ? <ChipDoc key={k} C={C} status="ok" rotulo={r} title={`${a.nome} — clique para ver`} onClick={() => verAnexo(a)} />
              : <label key={k} style={{ display: "inline-flex" }}><ChipDoc C={C} status="falta" rotulo={r} title={`Anexar ${r}`} carregando={subindo === k} onClick={(e) => e.currentTarget.parentElement.querySelector("input").click()} />
                <input type="file" accept=".pdf,.xml,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { anexar(k, e.target.files?.[0]); e.target.value = ""; }} /></label>; })}
          {at.link_motorista && <button type="button" title="Copiar o link do motorista (rota + documentos) para mandar no WhatsApp" onClick={copiarLink} style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 5, border: `1px solid ${C.accent}`, color: C.accent, background: "transparent", cursor: "pointer", fontWeight: 600 }}>📲 link{at.link_visto_em ? " ✓✓" : ""}</button>}
        </div>
      </>}
    </div>
  );
}

function Trecho({ C, s, pv, t, onAbrir, ...resto }) {
  const [aberto, setAberto] = useState(true);
  const atDe = (id) => t.ats.find((a) => (a.itens || []).some((i) => String(i.id) === String(id)));
  return (
    <div style={{ borderTop: `1px solid ${C.border}` }}>
      <div style={{ padding: "10px 14px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", cursor: "pointer" }} onClick={() => setAberto(!aberto)}>
        <span style={{ color: C.muted, width: 12 }}>{aberto ? "▾" : "▸"}</span>
        <b style={{ fontSize: 13.5 }}>{t.titulo}</b>
        <span style={{ fontSize: 12, color: C.muted, flex: "1 1 300px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${t.coleta} ➜ ${t.entrega}`}>{t.coleta || t.entrega ? `📍 ${t.coleta || "—"} ➜ 🏁 ${t.entrega || "—"}` : "rota a definir"}</span>
        {t.a_programar === 0 ? <span style={s.tag(C.success)}>✓ todos programados</span> : <span style={s.tag(C.warn)}>{t.a_programar} a programar</span>}
      </div>
      {aberto && <div style={{ padding: "0 14px 12px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 10 }}>
        {t.itens.map((i) => { const at = atDe(i.id); return <Card key={i.id} C={C} s={s} pv={pv} item={i} at={at} onAbrir={() => onAbrir(t, i, at)} {...resto} />; })}
      </div>}
    </div>
  );
}

export default function MesaProgramacao({ C, s, pedidos, podeLiberar, onAbrirAT, onSalvou, onErro, onOk }) {
  const [base, setBase] = useState(null);
  const [soPendentes, setSoPendentes] = useState(true);
  const [editor, setEditor] = useState(null); // { pv, t, item, at }
  const [ver, setVer] = useState(null);
  useEffect(() => { apiService.get("/programacao/base").then(setBase).catch((e) => onErro(e.message)); }, []); // eslint-disable-line
  if (!pedidos || !base) return <div style={{ color: C.muted }}>Carregando…</div>;
  const lista = pedidos.filter((p) => !soPendentes || p.trechos.some((t) => t.a_programar > 0));
  return <>
    <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, color: C.textSub, marginBottom: 10, cursor: "pointer" }}><input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} />Só pedidos com itens a programar</label>
    {!lista.length && <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.muted }}>{pedidos.length ? "Tudo programado. 🎉 Desmarque o filtro para ver os pedidos." : "Nenhum pedido aberto. Os pedidos nascem do aceite do BID no 📈 Comercial."}</div>}
    {lista.map((p) => <div key={p.id} style={{ ...s.card, padding: 0, marginBottom: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: C.bg }}>
        <b>{p.numero}</b><span style={{ color: C.textSub, fontSize: 13 }}>{p.cliente_nome}{p.titulo ? ` · ${p.titulo}` : ""}{p.referencia ? ` · ref. ${p.referencia}` : ""}</span>
      </div>
      {p.tipo_execucao !== "transporte" ? <div style={{ padding: "10px 14px", fontSize: 12.5, color: C.muted, borderTop: `1px solid ${C.border}` }}>Pedido do tipo “{p.tipo_execucao}” — ainda não programável aqui.</div>
        : p.trechos.filter((t) => t.qtd > 0).map((t) => <Trecho key={t.id} C={C} s={s} pv={p} t={t} onAbrir={(tr, item, at) => setEditor({ pv: p, t: tr, item, at })}
          onAbrirAT={onAbrirAT} onErro={onErro} onOk={onOk} onMudou={onSalvou} setVer={setVer} />)}
    </div>)}
    {editor && <EditorAT C={C} s={s} pv={{ id: editor.pv.id, numero: editor.pv.numero, colunas: editor.pv.colunas, itensTrecho: editor.t.itens }} trecho={editor.t} itemId={editor.item.id} atual={editor.at}
      base={base} podeLiberar={podeLiberar} onErro={onErro} onFechar={() => { setEditor(null); onSalvou(); }} onSalvo={(msg) => { setEditor(null); onOk(msg); onSalvou(); }} />}
    {ver && <VerArquivo C={C} s={s} arquivo={ver} onFechar={() => setVer(null)} />}
  </>;
}
