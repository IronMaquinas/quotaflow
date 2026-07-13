// components/historico/TelaHistoricoPrecosNova.jsx
import { useState } from "react";

export default function TelaHistoricoPrecosNova({ chamados, cotacoes, C, s, fmtBRL, fmtD }) {
  const [itemSel, setItemSel] = useState(null);
  const [search, setSearch] = useState("");
  const [alertaSomente, setAlertaSomente] = useState(false);

  // Agrupar todas as compras finalizadas por código de peça
  const finalizados = (chamados || []).filter(c => c.status === "finalizado" && c.valorAprovado);
  
  const porCodigo = {};
  finalizados.forEach(c => {
    const key = c.codigo || c.peca;
    if (!porCodigo[key]) porCodigo[key] = { codigo: c.codigo, peca: c.peca, categoriaItem: c.categoriaItem, tipoDisponib: c.tipoDisponib, compras: [] };
    porCodigo[key].compras.push({
      data: c.abertura,
      valor: c.custoTotalReal ?? c.valorNegociado ?? c.valorAprovado,
      fornecedor: c.fornecedorAprovado,
      numero: c.numero,
    });
  });

  // Calcular médias móveis e tendência por item
  const now = new Date();
  const ms6m = 6 * 30 * 24 * 3600000;
  const ms12m = 12 * 30 * 24 * 3600000;

  const itens = Object.values(porCodigo).map(item => {
    const sorted = [...item.compras].sort((a,b) => new Date(a.data)-new Date(b.data));
    const ultimos6m = sorted.filter(c => now - new Date(c.data) <= ms6m);
    const ultimos12m = sorted.filter(c => now - new Date(c.data) <= ms12m);
    const media6m = ultimos6m.length ? ultimos6m.reduce((s,c)=>s+c.valor,0)/ultimos6m.length : null;
    const media12m = ultimos12m.length ? ultimos12m.reduce((s,c)=>s+c.valor,0)/ultimos12m.length : null;
    const ultimo = sorted[sorted.length-1]?.valor;
    const tendencia = (media6m && media12m && media12m > 0) ? ((media6m - media12m) / media12m) * 100 : null;
    const varVsMedia6m = (ultimo && media6m) ? ((ultimo - media6m) / media6m) * 100 : null;
    const alerta = varVsMedia6m !== null && Math.abs(varVsMedia6m) > 15;
    return { ...item, sorted, media6m, media12m, ultimo, tendencia, varVsMedia6m, alerta, qtdCompras: sorted.length };
  }).sort((a,b) => (b.alerta?1:0)-(a.alerta?1:0) || b.qtdCompras - a.qtdCompras);

  const filtrados = itens.filter(i => {
    const matchSearch = !search || i.peca.toLowerCase().includes(search.toLowerCase()) || i.codigo?.toLowerCase().includes(search.toLowerCase());
    const matchAlerta = !alertaSomente || i.alerta;
    return matchSearch && matchAlerta;
  });

  const itemAtual = itemSel ? itens.find(i => (i.codigo||i.peca) === itemSel) : null;

  // Sparkline e Gráfico (mantidos iguais)
  const Sparkline = ({ compras, width=80, height=28, color=C.accent }) => {
    if (compras.length < 2) return <span style={{fontSize:11,color:C.muted}}>—</span>;
    const vals = compras.map(c=>c.valor);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    const pts = compras.map((c,i) => {
      const x = (i/(compras.length-1))*(width-4)+2;
      const y = height-2 - ((c.valor-min)/range)*(height-4);
      return `${x},${y}`;
    }).join(" ");
    const isUp = vals[vals.length-1] > vals[0];
    const lineColor = isUp ? "#ef4444" : "#22c55e";
    return (
      <svg width={width} height={height} style={{display:"block"}}>
        <polyline points={pts} fill="none" stroke={lineColor} strokeWidth={1.5} strokeLinejoin="round"/>
        {compras.map((c,i)=>{
          const x=(i/(compras.length-1))*(width-4)+2;
          const y=height-2-((c.valor-min)/range)*(height-4);
          return i===compras.length-1?<circle key={i} cx={x} cy={y} r={3} fill={lineColor}/>:null;
        })}
      </svg>
    );
  };

  const GraficoItem = ({ item }) => {
    if (!item || item.sorted.length < 1) return null;
    const W=500, H=180, PL=50, PR=20, PT=20, PB=30;
    const vals = item.sorted.map(c=>c.valor);
    const minV = Math.min(...vals)*0.92, maxV = Math.max(...vals)*1.08;
    const rangeV = maxV - minV;
    const dates = item.sorted.map(c=>new Date(c.data));
    const minD = Math.min(...dates), maxD = Math.max(...dates);
    const rangeD = maxD - minD || 1;
    const toX = d => PL + ((new Date(d)-minD)/rangeD)*(W-PL-PR);
    const toY = v => PT + (1-(v-minV)/rangeV)*(H-PT-PB);

    const pts = item.sorted.map(c=>`${toX(c.data).toFixed(1)},${toY(c.valor).toFixed(1)}`).join(" ");

    const y6m = item.media6m ? toY(item.media6m) : null;
    const y12m = item.media12m ? toY(item.media12m) : null;

    const steps = 4;
    const gridYs = Array.from({length:steps+1},(_,i)=>minV+(rangeV/steps)*i);

    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:"block"}}>
        {gridYs.map((v,i)=>(
          <g key={i}>
            <line x1={PL} y1={toY(v)} x2={W-PR} y2={toY(v)} stroke={C.border} strokeWidth={0.5}/>
            <text x={PL-6} y={toY(v)+4} textAnchor="end" fontSize={9} fill={C.muted}>{fmtBRL(v).replace("R$ ","")}</text>
          </g>
        ))}
        {y12m&&<line x1={PL} y1={y12m} x2={W-PR} y2={y12m} stroke="#818cf8" strokeWidth={1} strokeDasharray="4,3"/>}
        {y6m&&<line x1={PL} y1={y6m} x2={W-PR} y2={y6m} stroke={C.warn} strokeWidth={1} strokeDasharray="4,3"/>}
        {y12m&&<><rect x={W-PR-90} y={PT} width={8} height={3} fill="#818cf8"/><text x={W-PR-78} y={PT+5} fontSize={8} fill="#818cf8">MM 12m {fmtBRL(item.media12m)}</text></>}
        {y6m&&<><rect x={W-PR-90} y={PT+12} width={8} height={3} fill={C.warn}/><text x={W-PR-78} y={PT+17} fontSize={8} fill={C.warn}>MM 6m {fmtBRL(item.media6m)}</text></>}
        <polyline points={`${PL},${H-PB} ${pts} ${W-PR},${H-PB}`} fill={`${C.accent}18`} stroke="none"/>
        <polyline points={pts} fill="none" stroke={C.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
        {item.sorted.map((c,i)=>(
          <g key={i}>
            <circle cx={toX(c.data)} cy={toY(c.valor)} r={4} fill={C.accent} stroke={C.bg} strokeWidth={1.5}/>
            <text x={toX(c.data)} y={toY(c.valor)-8} textAnchor="middle" fontSize={8} fill={C.textSub}>{fmtBRL(c.valor)}</text>
          </g>
        ))}
        {item.sorted.map((c,i)=>(
          <text key={i} x={toX(c.data)} y={H-6} textAnchor="middle" fontSize={8} fill={C.muted}>
            {new Date(c.data).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"})}
          </text>
        ))}
      </svg>
    );
  };

  const tendenciaCfg = t => t === null ? null
    : t > 10 ? { c:"#ef4444", icon:"↑↑", l:`Alta acelerada +${t.toFixed(0)}%` }
    : t > 3  ? { c:C.warn,    icon:"↑",  l:`Tendência de alta +${t.toFixed(0)}%` }
    : t < -10? { c:C.success, icon:"↓↓", l:`Queda acelerada ${t.toFixed(0)}%` }
    : t < -3 ? { c:C.success, icon:"↓",  l:`Tendência de queda ${t.toFixed(0)}%` }
    :          { c:C.muted,   icon:"→",  l:"Preço estável" };

  // Renderização (igual ao original)
  return (
    <div style={{padding:"22px 24px", overflowY:"auto", height:"100%"}}>
      {/* Header */}
      <div style={{marginBottom:22}}>
        <div style={{fontSize:11, color:C.muted, letterSpacing:"0.1em", marginBottom:4}}>ANÁLISE DE PREÇOS</div>
        <div style={{fontSize:22, fontWeight:700, color:C.text}}>Histórico de Preços</div>
        <div style={{fontSize:13, color:C.muted, marginTop:4}}>Médias móveis de 6 e 12 meses · Alertas de variação atípica</div>
      </div>

      {/* KPIs */}
      {(()=>{
        const comAlerta = itens.filter(i=>i.alerta).length;
        const tendAlta = itens.filter(i=>i.tendencia!==null&&i.tendencia>3).length;
        const tendQueda = itens.filter(i=>i.tendencia!==null&&i.tendencia<-3).length;
        return(
          <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20}}>
            {[
              {l:"Itens rastreados", v:itens.length, c:C.accent},
              {l:"Com alerta de variação", v:comAlerta, c:"#ef4444"},
              {l:"Tendência de alta", v:tendAlta, c:C.warn},
              {l:"Tendência de queda", v:tendQueda, c:C.success},
            ].map(k=>(
              <div key={k.l} style={{...s.card, padding:"14px 18px", borderLeft:`3px solid ${k.c}`}}>
                <div style={{fontSize:10, color:C.muted, letterSpacing:"0.07em", marginBottom:6}}>{k.l.toUpperCase()}</div>
                <div style={{fontSize:26, fontWeight:700, color:k.c}}>{k.v}</div>
              </div>
            ))}
          </div>
        );
      })()}

      <div style={{display:"grid", gridTemplateColumns: itemAtual ? "1fr 1.6fr" : "1fr", gap:16}}>
        <div>
          <div style={{display:"flex", gap:10, marginBottom:12, flexWrap:"wrap"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar item ou código..."
              style={{...s.input, flex:1, marginBottom:0, minWidth:160}}/>
            <button onClick={()=>setAlertaSomente(!alertaSomente)}
              style={{...s.btn(alertaSomente,"#ef4444"), padding:"7px 14px", fontSize:12, whiteSpace:"nowrap"}}>
              {alertaSomente ? "⚠ Só alertas" : "⚠ Todos"}
            </button>
          </div>

          <div style={{...s.card, overflow:"hidden"}}>
            <div style={{display:"grid", gridTemplateColumns:"2fr 70px 85px 85px 70px 60px", padding:"10px 14px", background:C.bg, borderBottom:`1px solid ${C.border}`, fontSize:10, color:C.muted, letterSpacing:"0.07em"}}>
              <span>ITEM</span><span>ÚLTIMO</span><span>MM 6M</span><span>MM 12M</span><span>TEND.</span><span>SPARK</span>
            </div>
            {filtrados.map((item,i)=>{
              const key = item.codigo||item.peca;
              const isActive = itemSel===key;
              const tend = tendenciaCfg(item.tendencia);
              const catI = {rolamentos: {c:"#60a5fa"}, filtros:{c:"#34d399"}, lubrificantes:{c:"#fbbf24"}, transmissão:{c:"#a78bfa"}, elétrica:{c:"#f87171"}, pneumático:{c:"#38bdf8"}, instrumentação:{c:"#fb923c"}, automação:{c:"#c084fc"}}[item.categoriaItem] || {c:C.muted};
              return(
                <div key={key} onClick={()=>setItemSel(isActive?null:key)}
                  style={{display:"grid", gridTemplateColumns:"2fr 70px 85px 85px 70px 60px", padding:"11px 14px", cursor:"pointer", background: isActive?"#151d2e":"transparent", borderBottom:i<filtrados.length-1?`1px solid ${C.border}22`:"none", alignItems:"center", borderLeft: item.alerta?`3px solid #ef4444`:"3px solid transparent"}}
                  onMouseEnter={e=>!isActive&&(e.currentTarget.style.background="#0f1520")}
                  onMouseLeave={e=>!isActive&&(e.currentTarget.style.background="transparent")}>
                  <div>
                    <div style={{fontSize:12, color:C.text, fontWeight:500}}>{item.peca}</div>
                    <div style={{display:"flex", gap:6, marginTop:2}}>
                      {item.codigo&&<span style={{fontSize:10, color:C.accent, fontFamily:"'IBM Plex Mono',monospace"}}>{item.codigo}</span>}
                      {item.categoriaItem&&<span style={{...s.tag(catI.c), fontSize:9}}>{item.categoriaItem}</span>}
                    </div>
                  </div>
                  <span style={{fontSize:12, fontWeight:600, color:C.text}}>{fmtBRL(item.ultimo)}</span>
                  <div>
                    <div style={{fontSize:12, color:C.warn}}>{item.media6m?fmtBRL(item.media6m):"—"}</div>
                    {item.varVsMedia6m!==null&&<div style={{fontSize:10, color:Math.abs(item.varVsMedia6m)>15?"#ef4444":C.muted}}>{item.varVsMedia6m>0?"+":""}{item.varVsMedia6m.toFixed(0)}%</div>}
                  </div>
                  <span style={{fontSize:12, color:"#818cf8"}}>{item.media12m?fmtBRL(item.media12m):"—"}</span>
                  {tend?<span style={{fontSize:11, color:tend.c, fontWeight:700}}>{tend.icon}</span>:<span style={{color:C.muted}}>—</span>}
                  <Sparkline compras={item.sorted}/>
                </div>
              );
            })}
            {filtrados.length===0&&<div style={{padding:28, textAlign:"center", color:C.muted, fontSize:13}}>Nenhum item encontrado</div>}
          </div>

          <div style={{marginTop:10, display:"flex", gap:16, flexWrap:"wrap"}}>
            {[
              {c:"#ef4444", l:"Alta acelerada (>10%)"},
              {c:C.warn,    l:"Tendência de alta (3-10%)"},
              {c:C.success, l:"Queda / estável"},
              {c:"#818cf8", l:"MM 12 meses"},
              {c:C.warn,    l:"MM 6 meses"},
            ].map(lg=>(
              <div key={lg.l} style={{display:"flex", alignItems:"center", gap:5}}>
                <div style={{width:10, height:3, background:lg.c, borderRadius:2}}/>
                <span style={{fontSize:10, color:C.muted}}>{lg.l}</span>
              </div>
            ))}
          </div>
        </div>

        {itemAtual&&(
          <div style={{...s.card, padding:"18px 20px", position:"sticky", top:0, alignSelf:"flex-start"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14}}>
              <div>
                <div style={{fontSize:15, fontWeight:700, color:C.text}}>{itemAtual.peca}</div>
                <div style={{fontSize:11, color:C.accent, fontFamily:"'IBM Plex Mono',monospace", marginTop:2}}>{itemAtual.codigo}</div>
              </div>
              <button onClick={()=>setItemSel(null)} style={{background:"transparent", border:"none", color:C.muted, fontSize:18, cursor:"pointer"}}>×</button>
            </div>

            <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14}}>
              {[
                {l:"Último preço", v:fmtBRL(itemAtual.ultimo), c:C.text},
                {l:"MM 6 meses", v:itemAtual.media6m?fmtBRL(itemAtual.media6m):"—", c:C.warn},
                {l:"MM 12 meses", v:itemAtual.media12m?fmtBRL(itemAtual.media12m):"—", c:"#818cf8"},
              ].map(k=>(
                <div key={k.l} style={{background:C.bg, borderRadius:6, padding:"8px 10px", textAlign:"center"}}>
                  <div style={{fontSize:9, color:C.muted, marginBottom:4}}>{k.l.toUpperCase()}</div>
                  <div style={{fontSize:14, fontWeight:700, color:k.c}}>{k.v}</div>
                </div>
              ))}
            </div>

            {(()=>{
              const tend = tendenciaCfg(itemAtual.tendencia);
              if(!tend) return null;
              return(
                <div style={{background:`${tend.c}15`, border:`1px solid ${tend.c}33`, borderRadius:7, padding:"8px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:8}}>
                  <span style={{fontSize:18}}>{tend.icon}</span>
                  <div>
                    <div style={{fontSize:12, color:tend.c, fontWeight:600}}>{tend.l}</div>
                    {itemAtual.tendencia!==null&&<div style={{fontSize:11, color:C.muted}}>MM 6m vs MM 12m</div>}
                  </div>
                </div>
              );
            })()}

            <div style={{marginBottom:14}}>
              <div style={{fontSize:10, color:C.muted, letterSpacing:"0.07em", marginBottom:8}}>EVOLUÇÃO DE PREÇO</div>
              <div style={{background:C.bg, borderRadius:6, padding:"10px 6px"}}>
                <GraficoItem item={itemAtual}/>
              </div>
            </div>

            <div style={{fontSize:10, color:C.muted, letterSpacing:"0.07em", marginBottom:8}}>COMPRAS REGISTRADAS</div>
            <div style={{display:"flex", flexDirection:"column", gap:4}}>
              {itemAtual.sorted.slice().reverse().map((c,i)=>(
                <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"7px 10px", background:C.bg, borderRadius:5, fontSize:12}}>
                  <div>
                    <span style={{color:C.textSub}}>{fmtD(c.data)}</span>
                    <span style={{color:C.muted, marginLeft:8, fontSize:11}}>{c.fornecedor}</span>
                  </div>
                  <span style={{color:C.text, fontWeight:600}}>{fmtBRL(c.valor)}</span>
                </div>
              ))}
            </div>

            {itemAtual.alerta&&(
              <div style={{marginTop:12, background:"#3f0f0f", border:"1px solid #ef444444", borderRadius:7, padding:"10px 14px", fontSize:12, color:"#ef4444"}}>
                ⚠ Variação de {itemAtual.varVsMedia6m?.toFixed(0)}% vs média móvel de 6 meses — investigar causas antes da próxima compra.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}