// components/benchmark/TelaBenchmarkNova.jsx
import { useState } from "react";

// Dados simulados de rede (o que viria do backend quando tiver N clientes)
const BENCHMARK_REDE = [
  { codigo: "SKF-6205", peca: "Rolamento SKF 6205", amostras: 47, mediana: 71.0, minimo: 52.0, maximo: 98.0, regiao: "SP", categoriaItem: "rolamentos", tipoDisponib: "prateleira" },
  { codigo: "FH-10-G1", peca: "Filtro Hidráulico 10µ", amostras: 31, mediana: 89.5, minimo: 74.0, maximo: 128.0, regiao: "SP", categoriaItem: "filtros", tipoDisponib: "prateleira" },
  { codigo: "OIL-80W90-20", peca: "Óleo Câmbio 80W90 (20L)", amostras: 62, mediana: 162.0, minimo: 138.0, maximo: 198.0, regiao: "SP", categoriaItem: "lubrificantes", tipoDisponib: "prateleira" },
  { codigo: "T5-600-10", peca: "Correia Dentada T5-600", amostras: 18, mediana: 36.0, minimo: 28.0, maximo: 49.0, regiao: "SP", categoriaItem: "transmissão", tipoDisponib: "prateleira" },
  { codigo: "UCF205", peca: "Mancal de Rolamento UCF205", amostras: 23, mediana: 118.0, minimo: 95.0, maximo: 155.0, regiao: "SP", categoriaItem: "rolamentos", tipoDisponib: "prateleira" },
  { codigo: "WL-CFC-01", peca: "Chave Fim de Curso WL", amostras: 12, mediana: 58.5, minimo: 44.0, maximo: 79.0, regiao: "SP", categoriaItem: "elétrica", tipoDisponib: "prateleira" },
];

const catItemCfg = {
  rolamentos: { c: "#60a5fa", icon: "⚙" },
  filtros: { c: "#34d399", icon: "🔵" },
  lubrificantes: { c: "#fbbf24", icon: "🟡" },
  transmissão: { c: "#a78bfa", icon: "🔗" },
  elétrica: { c: "#f87171", icon: "⚡" },
  pneumático: { c: "#38bdf8", icon: "💨" },
  instrumentação: { c: "#fb923c", icon: "📡" },
  automação: { c: "#c084fc", icon: "🤖" },
};

export default function TelaBenchmarkNova({ chamados, participaBench, setParticipaBench, C, s, fmtBRL, fmtD }) {
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  const finalizados = chamados.filter(c => c.status === "finalizado" && c.valorAprovado && c.participaBench !== false);

  const itensCruzados = finalizados.map(ch => {
    const bench = BENCHMARK_REDE.find(b => b.codigo === ch.codigo);
    const pago = ch.custoTotalReal ?? ch.valorNegociado ?? ch.valorAprovado;
    const diffPct = bench ? ((pago - bench.mediana) / bench.mediana) * 100 : null;
    return { ...ch, pago, bench, diffPct };
  }).filter(c => c.bench);

  const acimaMercado = itensCruzados.filter(c => c.diffPct > 10);
  const abaixoMercado = itensCruzados.filter(c => c.diffPct < -5);
  const naMedia = itensCruzados.filter(c => c.diffPct >= -5 && c.diffPct <= 10);

  const potencialEconomia = acimaMercado.reduce((s, c) => s + (c.pago - c.bench.mediana), 0);

  const filtrados = BENCHMARK_REDE.filter(b => {
    const matchTipo = filtroTipo === "todos" || b.tipoDisponib === filtroTipo;
    const matchCat = filtroCategoria === "todas" || b.categoriaItem === filtroCategoria;
    return matchTipo && matchCat;
  });

  const categorias = [...new Set(BENCHMARK_REDE.map(b => b.categoriaItem))];

  return (
    <div style={{ padding: "22px 24px", overflowY: "auto", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>BENCHMARK COLABORATIVO</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Índice de Preços de Mercado</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Preços medianos anonimizados da rede QuotaFlow · Mínimo 5 empresas por item</div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Participar do benchmark</div>
            <div style={{ fontSize: 11, color: C.muted }}>Seus dados contribuem anonimamente</div>
          </div>
          <div onClick={() => setParticipaBench(!participaBench)} style={{ width: 44, height: 24, borderRadius: 12, background: participaBench ? C.success : C.border, cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: participaBench ? 23 : 3, transition: "left .2s" }} />
          </div>
        </div>
      </div>

      {/* Como funciona */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", marginBottom: 20, backgroundImage: "linear-gradient(135deg,#0f1e35,#111722)", border: `1px solid ${C.accent}33` }}>
        <div style={{ fontSize: 11, color: C.accent, letterSpacing: "0.1em", marginBottom: 10 }}>ℹ COMO FUNCIONA O BENCHMARK COLABORATIVO</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[
            { icon: "🔒", title: "100% anônimo", desc: "Nenhuma empresa é identificada. O sistema exibe apenas mediana, mínimo e máximo da rede — sem revelar quem comprou o quê." },
            { icon: "📊", title: "Mínimo 5 empresas", desc: "Um item só aparece no benchmark quando ao menos 5 empresas diferentes registraram compras dele. Sem isso, não há dado suficiente para anonimato." },
            { icon: "🤝", title: "Quanto mais, melhor", desc: "Cada empresa que participa torna o índice mais preciso. Quem contribui recebe o benchmark gratuitamente. É um modelo de valor compartilhado." },
          ].map(c => (
            <div key={c.title} style={{ display: "flex", gap: 10 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{c.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 3 }}>{c.title}</div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs de posicionamento */}
      {itensCruzados.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 10 }}>SUA POSIÇÃO VS MERCADO</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { l: "Itens com referência de mercado", v: itensCruzados.length, c: C.accent },
              { l: "Acima da mediana de mercado", v: acimaMercado.length, c: "#ef4444" },
              { l: "Dentro da faixa normal", v: naMedia.length, c: C.success },
              { l: "Potencial de economia", v: fmtBRL(potencialEconomia), c: "#a78bfa" },
            ].map(k => (
              <div key={k.l} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 18px", borderLeft: `3px solid ${k.c}` }}>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.07em", marginBottom: 6 }}>{k.l.toUpperCase()}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.muted, letterSpacing: "0.08em" }}>
              SUAS ÚLTIMAS COMPRAS × MEDIANA DE MERCADO
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "120px 2fr 90px 100px 100px 110px 100px", padding: "10px 20px", background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>
              <span>CÓDIGO</span><span>ITEM</span><span>CATEGORIA</span><span>VOCÊ PAGOU</span><span>MEDIANA REDE</span><span>AMOSTRAS REDE</span><span>POSIÇÃO</span>
            </div>
            {itensCruzados.map((c, i) => {
              const catCfgItem = catItemCfg[c.categoriaItem] || { c: C.muted, icon: "•" };
              const pos = c.diffPct > 10 ? { l: "Acima", c: "#ef4444", bg: "#3f0f0f" }
                : c.diffPct < -5 ? { l: "Abaixo", c: C.success, bg: "#0f2f1a" }
                  : { l: "Na média", c: C.warn, bg: "#3f2a0a" };
              return (
                <div key={c.id} style={{ display: "grid", gridTemplateColumns: "120px 2fr 90px 100px 100px 110px 100px", padding: "12px 20px", borderBottom: i < itensCruzados.length - 1 ? `1px solid ${C.border}22` : "none", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>{c.codigo}</span>
                  <div>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{c.peca}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{c.numero}</div>
                  </div>
                  <span style={{ fontSize: 10, background: `${catCfgItem.c}22`, border: `1px solid ${catCfgItem.c}44`, borderRadius: 4, padding: "2px 8px", color: catCfgItem.c, letterSpacing: "0.06em", fontWeight: 600, whiteSpace: "nowrap" }}>{catCfgItem.icon} {c.categoriaItem}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmtBRL(c.pago)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{fmtBRL(c.bench.mediana)}</span>
                  <div>
                    <div style={{ fontSize: 11, color: C.muted }}>{c.bench.amostras} empresas</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{fmtBRL(c.bench.minimo)} – {fmtBRL(c.bench.maximo)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, background: pos.bg, color: pos.c, border: `1px solid ${pos.c}44`, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>{pos.l}</span>
                    {c.diffPct !== null && (
                      <span style={{ fontSize: 11, color: c.diffPct > 0 ? "#ef4444" : C.success, fontWeight: 600 }}>
                        {c.diffPct > 0 ? "+" : ""}{c.diffPct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {acimaMercado.length > 0 && (
            <div style={{ background: C.surface, border: `1px solid #ef444444`, borderRadius: 10, padding: "16px 20px", marginBottom: 20, backgroundImage: "#1a0808" }}>
              <div style={{ fontSize: 11, color: "#ef4444", letterSpacing: "0.1em", marginBottom: 10 }}>⚠ OPORTUNIDADES DE REDUÇÃO DE CUSTO</div>
              {acimaMercado.map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid #ef444422` }}>
                  <div>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{c.peca}</span>
                    <span style={{ fontSize: 11, color: C.muted, marginLeft: 10 }}>Você pagou {fmtBRL(c.pago)} · Mediana {fmtBRL(c.bench.mediana)}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#ef4444" }}>+{c.diffPct?.toFixed(0)}% acima</div>
                    <div style={{ fontSize: 11, color: C.muted }}>Potencial: economizar {fmtBRL(c.pago - c.bench.mediana)}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 12, fontSize: 12, color: C.muted }}>💡 Dica: inclua mais fornecedores nas próximas cotações desses itens para pressionar o preço.</div>
            </div>
          )}
        </>
      )}

      {/* Índice completo da rede */}
      <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 12 }}>ÍNDICE DE PREÇOS DA REDE QUOTAFLOW</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {["todos", "prateleira", "encomenda", "importado"].map(t => (
          <button key={t} onClick={() => setFiltroTipo(t)} style={{ background: filtroTipo === t ? "#1e2a3f" : "transparent", border: `1px solid ${filtroTipo === t ? C.accent : C.border}`, borderRadius: 6, padding: "6px 14px", color: filtroTipo === t ? C.accent : C.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            {{ todos: "Todos", prateleira: "🛒 Prateleira", encomenda: "📦 Encomenda", importado: "✈ Importado" }[t]}
          </button>
        ))}
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", color: C.text, fontSize: 12, fontFamily: "inherit", outline: "none", cursor: "pointer", width: "auto", marginBottom: 0 }}>
          <option value="todas">Todas as categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "130px 2fr 100px 60px 110px 110px 110px 80px", padding: "10px 20px", background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>
          <span>CÓDIGO</span><span>ITEM</span><span>CATEGORIA</span><span>TIPO</span><span>MÍNIMO</span><span>MEDIANA</span><span>MÁXIMO</span><span>AMOSTRAS</span>
        </div>
        {filtrados.map((b, i) => {
          const catCfgItem = catItemCfg[b.categoriaItem] || { c: C.muted, icon: "•" };
          const amplitude = b.maximo - b.minimo;
          const meuItem = itensCruzados.find(c => c.codigo === b.codigo);
          return (
            <div key={b.codigo} style={{ borderBottom: i < filtrados.length - 1 ? `1px solid ${C.border}22` : "none" }}>
              <div style={{ display: "grid", gridTemplateColumns: "130px 2fr 100px 60px 110px 110px 110px 80px", padding: "13px 20px", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>{b.codigo}</span>
                <div>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{b.peca}</div>
                  {meuItem && (
                    <div style={{ fontSize: 10, marginTop: 2 }}>
                      <span style={{ color: C.muted }}>Você: </span>
                      <span style={{ color: meuItem.diffPct > 10 ? "#ef4444" : meuItem.diffPct < -5 ? C.success : C.warn, fontWeight: 600 }}>
                        {fmtBRL(meuItem.pago)} ({meuItem.diffPct > 0 ? "+" : ""}{meuItem.diffPct?.toFixed(0)}%)
                      </span>
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 10, background: `${catCfgItem.c}22`, border: `1px solid ${catCfgItem.c}44`, borderRadius: 4, padding: "2px 8px", color: catCfgItem.c, letterSpacing: "0.06em", fontWeight: 600, whiteSpace: "nowrap" }}>{catCfgItem.icon} {b.categoriaItem}</span>
                <span style={{ fontSize: 10, background: `${b.tipoDisponib === "prateleira" ? C.success : b.tipoDisponib === "importado" ? "#f87171" : C.warn}22`, border: `1px solid ${b.tipoDisponib === "prateleira" ? C.success : b.tipoDisponib === "importado" ? "#f87171" : C.warn}44`, borderRadius: 4, padding: "2px 8px", color: b.tipoDisponib === "prateleira" ? C.success : b.tipoDisponib === "importado" ? "#f87171" : C.warn, letterSpacing: "0.06em", fontWeight: 600, whiteSpace: "nowrap", fontSize: 9 }}>
                  {b.tipoDisponib}
                </span>
                <span style={{ fontSize: 12, color: C.success }}>{fmtBRL(b.minimo)}</span>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>{fmtBRL(b.mediana)}</span>
                  <div style={{ marginTop: 4, height: 3, background: C.border, borderRadius: 2, position: "relative", width: 80 }}>
                    <div style={{ position: "absolute", left: `${((b.mediana - b.minimo) / amplitude) * 100}%`, width: 6, height: 6, borderRadius: "50%", background: C.accent, top: -1.5 }} />
                  </div>
                </div>
                <span style={{ fontSize: 12, color: "#ef4444" }}>{fmtBRL(b.maximo)}</span>
                <div style={{ fontSize: 11, color: C.muted }}>
                  <div>{b.amostras} empresas</div>
                  <div style={{ fontSize: 9, marginTop: 1 }}>anônimas</div>
                </div>
              </div>
            </div>
          );
        })}
        {filtrados.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Nenhum item encontrado com esses filtros</div>
        )}
      </div>

      {/* Itens sem benchmark ainda */}
      {(() => {
        const semBench = finalizados.filter(c => !BENCHMARK_REDE.find(b => b.codigo === c.codigo));
        if (!semBench.length) return null;
        return (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", marginTop: 16 }}>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", marginBottom: 10 }}>⏳ AGUARDANDO DADOS DA REDE</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Estes itens ainda não têm amostras suficientes de outras empresas (mínimo 5). Quanto mais clientes usarem o QuotaFlow, mais itens terão referência de mercado.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {semBench.map(c => (
                <span key={c.id} style={{ fontSize: 10, background: `${C.muted}22`, border: `1px solid ${C.muted}44`, borderRadius: 4, padding: "2px 8px", color: C.muted, letterSpacing: "0.06em", fontWeight: 600, whiteSpace: "nowrap" }}>{c.codigo} · {c.peca}</span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Estrutura de dados — transparência para o desenvolvedor */}
      <div style={{ background: C.surface, border: `1px solid #7c3aed33`, borderRadius: 10, padding: "16px 20px", marginTop: 16, backgroundImage: "#0f0d1a" }}>
        <div style={{ fontSize: 11, color: "#a78bfa", letterSpacing: "0.1em", marginBottom: 10 }}>🏗 ESTRUTURA DE DADOS PARA BENCHMARK (REFERÊNCIA TÉCNICA)</div>
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.8, fontFamily: "'IBM Plex Mono',monospace" }}>
          <div>Campos gravados em cada transação finalizada:</div>
          <div style={{ marginTop: 8, paddingLeft: 16, color: C.textSub }}>
            <div><span style={{ color: "#60a5fa" }}>codigo</span>          → chave de deduplicação entre empresas</div>
            <div><span style={{ color: "#60a5fa" }}>categoriaItem</span>   → agrupamento por família de produto</div>
            <div><span style={{ color: "#60a5fa" }}>tipoDisponib</span>    → prateleira | encomenda | importado</div>
            <div><span style={{ color: "#60a5fa" }}>custoTotalReal</span>  → valor pago + frete (custo verdadeiro)</div>
            <div><span style={{ color: "#60a5fa" }}>regiao</span>          → estado para benchmark geográfico</div>
            <div><span style={{ color: "#60a5fa" }}>participaBench</span>  → opt-in explícito do cliente</div>
          </div>
          <div style={{ marginTop: 10, color: C.muted }}>Regras de privacidade: mínimo 5 empresas · sem identificação · apenas mediana/min/max expostos</div>
        </div>
      </div>
    </div>
  );
}