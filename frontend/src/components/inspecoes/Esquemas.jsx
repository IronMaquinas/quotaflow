// components/inspecoes/Esquemas.jsx — etapa 14a
// Esquemas GENÉRICOS do QuotaFlow para as vistas da inspeção (traço simples, sem marca nem modelo de fabricante —
// desenho de fabricante não pode entrar na biblioteca). Todos em viewBox 400×260 — os pontos ficam em % (x, y).
// O cliente também pode usar a foto/desenho do próprio equipamento (imagem enviada na vista).

const T = { fill: "none", stroke: "#1f2937", strokeWidth: 2.2, strokeLinejoin: "round", strokeLinecap: "round" };
const F = { fill: "#e5e7eb", stroke: "#1f2937", strokeWidth: 2 };
const roda = (cx, cy, r = 20) => (<g key={`r${cx}-${cy}`}><circle cx={cx} cy={cy} r={r} {...F} fill="#374151" /><circle cx={cx} cy={cy} r={r * 0.45} fill="#d1d5db" stroke="#1f2937" strokeWidth={1.5} /></g>);

const DESENHOS = {
  cavalo_frente: (<>
    <path d="M110 40 Q110 25 125 25 L275 25 Q290 25 290 40 L298 200 L102 200 Z" {...T} />
    <rect x="125" y="50" width="150" height="70" rx="8" {...F} fill="#dbeafe" />
    <line x1="140" y1="118" x2="190" y2="108" {...T} /><line x1="210" y1="108" x2="260" y2="118" {...T} />
    <rect x="80" y="60" width="18" height="40" rx="4" {...T} /><rect x="302" y="60" width="18" height="40" rx="4" {...T} />
    <line x1="98" y1="70" x2="110" y2="75" {...T} /><line x1="302" y1="70" x2="290" y2="75" {...T} />
    <rect x="145" y="135" width="110" height="45" rx="4" {...T} />
    {[145, 152, 159, 166, 173].map((y) => <line key={y} x1="152" y1={y} x2="248" y2={y} {...T} strokeWidth={1.2} />)}
    <rect x="112" y="150" width="28" height="16" rx="3" {...F} fill="#fef3c7" /><rect x="260" y="150" width="28" height="16" rx="3" {...F} fill="#fef3c7" />
    <rect x="112" y="172" width="16" height="8" rx="2" {...F} fill="#fdba74" /><rect x="272" y="172" width="16" height="8" rx="2" {...F} fill="#fdba74" />
    <rect x="100" y="198" width="200" height="16" rx="3" {...T} />
    <rect x="112" y="214" width="34" height="34" rx="6" {...F} fill="#374151" /><rect x="254" y="214" width="34" height="34" rx="6" {...F} fill="#374151" />
  </>),
  cavalo_lateral: (<>
    <path d="M40 60 Q40 40 60 40 L130 40 Q150 40 152 60 L158 175 L40 175 Z" {...T} />
    <rect x="55" y="55" width="70" height="45" rx="6" {...F} fill="#dbeafe" />
    <rect x="133" y="60" width="10" height="34" rx="3" {...T} />
    <line x1="40" y1="120" x2="152" y2="120" {...T} strokeWidth={1.4} />
    <rect x="80" y="125" width="34" height="18" rx="3" {...T} />
    <rect x="160" y="110" width="210" height="40" rx="4" {...T} />
    <rect x="200" y="96" width="70" height="14" rx="3" {...F} />
    <rect x="165" y="150" width="60" height="22" rx="4" {...F} fill="#d1d5db" />
    <line x1="30" y1="175" x2="380" y2="175" {...T} />
    {roda(80, 195)}{roda(255, 195)}{roda(315, 195)}
    <rect x="30" y="150" width="14" height="10" rx="2" {...F} fill="#fef3c7" />
  </>),
  cavalo_traseira: (<>
    <rect x="90" y="40" width="220" height="90" rx="8" {...T} />
    <rect x="140" y="55" width="120" height="40" rx="4" {...F} fill="#dbeafe" />
    <rect x="110" y="130" width="180" height="50" rx="4" {...T} />
    <circle cx="200" cy="150" r="14" {...F} />
    <rect x="95" y="185" width="210" height="14" rx="3" {...T} />
    <rect x="100" y="188" width="26" height="9" rx="2" {...F} fill="#fca5a5" /><rect x="274" y="188" width="26" height="9" rx="2" {...F} fill="#fca5a5" />
    <rect x="170" y="202" width="60" height="16" rx="2" {...T} />
    <rect x="100" y="205" width="40" height="40" rx="6" {...F} fill="#374151" /><rect x="260" y="205" width="40" height="40" rx="6" {...F} fill="#374151" />
  </>),
  carreta_lateral: (<>
    <rect x="25" y="45" width="350" height="105" rx="4" {...T} />
    {[95, 165, 235, 305].map((x) => <line key={x} x1={x} y1="45" x2={x} y2="150" {...T} strokeWidth={1.2} />)}
    <line x1="25" y1="150" x2="375" y2="150" {...T} />
    <rect x="45" y="150" width="40" height="30" {...T} strokeWidth={1.6} />
    <rect x="160" y="152" width="60" height="18" rx="3" {...F} />
    {roda(270, 185)}{roda(315, 185)}{roda(360, 185)}
    <line x1="20" y1="205" x2="385" y2="205" {...T} strokeWidth={1.2} />
    <rect x="368" y="130" width="10" height="10" rx="2" {...F} fill="#fca5a5" />
  </>),
  carreta_traseira: (<>
    <rect x="80" y="30" width="240" height="150" rx="4" {...T} />
    <line x1="200" y1="30" x2="200" y2="180" {...T} />
    <line x1="140" y1="40" x2="140" y2="170" {...T} strokeWidth={1.2} /><line x1="260" y1="40" x2="260" y2="170" {...T} strokeWidth={1.2} />
    <rect x="185" y="95" width="30" height="16" rx="2" {...F} fill="#fde68a" />
    <rect x="75" y="182" width="250" height="16" rx="2" {...T} />
    <rect x="82" y="185" width="30" height="10" rx="2" {...F} fill="#fca5a5" /><rect x="288" y="185" width="30" height="10" rx="2" {...F} fill="#fca5a5" />
    <rect x="165" y="200" width="70" height="16" rx="2" {...T} />
    <rect x="90" y="200" width="44" height="44" rx="6" {...F} fill="#374151" /><rect x="266" y="200" width="44" height="44" rx="6" {...F} fill="#374151" />
  </>),
  onibus_lateral: (<>
    <path d="M25 50 Q25 35 40 35 L365 35 Q378 35 378 50 L378 175 L25 175 Z" {...T} />
    {[45, 100, 155, 210, 265, 320].map((x) => <rect key={x} x={x} y="50" width="45" height="45" rx="4" {...F} fill="#dbeafe" />)}
    <rect x="335" y="105" width="30" height="68" rx="3" {...T} /><rect x="60" y="105" width="30" height="68" rx="3" {...T} />
    <line x1="25" y1="120" x2="378" y2="120" {...T} strokeWidth={1.2} />
    <rect x="150" y="130" width="90" height="30" rx="3" {...T} />
    {roda(95, 190)}{roda(300, 190)}
    <line x1="15" y1="210" x2="390" y2="210" {...T} strokeWidth={1.2} />
  </>),
  onibus_frente: (<>
    <path d="M100 30 Q100 18 115 18 L285 18 Q300 18 300 30 L305 210 L95 210 Z" {...T} />
    <rect x="115" y="30" width="170" height="20" rx="3" {...F} fill="#fde68a" />
    <rect x="112" y="58" width="176" height="95" rx="6" {...F} fill="#dbeafe" />
    <line x1="140" y1="150" x2="195" y2="138" {...T} /><line x1="205" y1="138" x2="260" y2="150" {...T} />
    <rect x="72" y="60" width="16" height="44" rx="4" {...T} /><rect x="312" y="60" width="16" height="44" rx="4" {...T} />
    <rect x="110" y="170" width="34" height="16" rx="3" {...F} fill="#fef3c7" /><rect x="256" y="170" width="34" height="16" rx="3" {...F} fill="#fef3c7" />
    <rect x="160" y="168" width="80" height="22" rx="3" {...T} />
    <rect x="112" y="210" width="36" height="34" rx="6" {...F} fill="#374151" /><rect x="252" y="210" width="36" height="34" rx="6" {...F} fill="#374151" />
  </>),
  empilhadeira_lateral: (<>
    <rect x="300" y="20" width="12" height="190" {...F} /><rect x="318" y="30" width="10" height="180" {...F} fill="#d1d5db" />
    <path d="M300 205 L380 205 M300 190 L380 190" {...T} strokeWidth={4} />
    <path d="M110 60 L250 60 L250 80" {...T} /><line x1="120" y1="60" x2="140" y2="150" {...T} /><line x1="245" y1="60" x2="250" y2="150" {...T} />
    <rect x="170" y="110" width="40" height="40" rx="4" {...T} />
    <path d="M60 150 L295 150 L295 200 L60 200 Z" {...T} />
    <path d="M60 150 Q50 120 90 110 L120 110 L120 150" {...F} />
    <circle cx="200" cy="105" r="10" {...T} />
    {roda(110, 210, 26)}{roda(255, 210, 24)}
    <rect x="285" y="120" width="12" height="10" rx="2" {...F} fill="#fef3c7" />
  </>),
  retro_lateral: (<>
    <rect x="150" y="60" width="100" height="90" rx="6" {...T} /><rect x="160" y="70" width="80" height="50" rx="4" {...F} fill="#dbeafe" />
    <rect x="110" y="150" width="190" height="45" rx="4" {...T} />
    <path d="M300 160 L345 140 L380 175 L350 200 L320 185" {...T} />
    <path d="M110 165 L60 110 L30 150 M60 110 L95 70 M30 150 L15 190 L45 195 Z" {...T} />
    {roda(150, 205, 26)}{roda(270, 205, 30)}
    <rect x="245" y="62" width="10" height="10" rx="2" {...F} fill="#fef3c7" />
  </>),
  utilitario_lateral: (<>
    <path d="M30 150 L30 85 Q32 60 70 55 L120 52 L150 30 L330 30 Q360 30 365 60 L370 150 Z" {...T} />
    <path d="M125 55 L152 35 L215 35 L215 85 L120 85 Z" {...F} fill="#dbeafe" />
    <rect x="225" y="35" width="70" height="50" rx="3" {...F} fill="#dbeafe" />
    <line x1="215" y1="35" x2="215" y2="150" {...T} strokeWidth={1.2} /><line x1="300" y1="35" x2="300" y2="150" {...T} strokeWidth={1.2} />
    <rect x="25" y="95" width="14" height="12" rx="2" {...F} fill="#fef3c7" /><rect x="360" y="70" width="10" height="20" rx="2" {...F} fill="#fca5a5" />
    {roda(95, 160, 26)}{roda(305, 160, 26)}
    <line x1="15" y1="186" x2="390" y2="186" {...T} strokeWidth={1.2} />
  </>),
  painel: (<>
    <path d="M30 200 Q30 60 200 50 Q370 60 370 200 Z" {...T} />
    <circle cx="140" cy="125" r="45" {...T} /><circle cx="260" cy="125" r="45" {...T} />
    <line x1="140" y1="125" x2="165" y2="100" {...T} /><line x1="260" y1="125" x2="240" y2="98" {...T} />
    {[[80, 80], [320, 80], [200, 80], [200, 110], [200, 140], [90, 175], [310, 175]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8" {...F} fill={["#fca5a5", "#fde68a", "#86efac", "#fca5a5", "#93c5fd", "#fde68a", "#fca5a5"][i]} />)}
    <rect x="170" y="165" width="60" height="22" rx="3" {...F} fill="#bbf7d0" />
    <text x="200" y="181" textAnchor="middle" fontSize="12" fontFamily="sans-serif" fill="#1f2937">km · h</text>
  </>),
  motor: (<>
    <rect x="40" y="40" width="320" height="180" rx="10" {...T} />
    <rect x="120" y="80" width="160" height="90" rx="6" {...F} />
    {[140, 175, 210, 245].map((x) => <rect key={x} x={x} y="90" width="20" height="25" rx="2" {...T} strokeWidth={1.4} />)}
    <rect x="60" y="60" width="45" height="60" rx="6" {...F} fill="#bfdbfe" /><text x="82" y="95" textAnchor="middle" fontSize="11" fontFamily="sans-serif">água</text>
    <rect x="295" y="60" width="45" height="35" rx="4" {...F} fill="#fde68a" /><text x="317" y="82" textAnchor="middle" fontSize="11" fontFamily="sans-serif">bat.</text>
    <circle cx="160" cy="190" r="14" {...F} fill="#fcd34d" /><text x="160" y="194" textAnchor="middle" fontSize="10" fontFamily="sans-serif">óleo</text>
    <rect x="290" y="120" width="50" height="40" rx="6" {...F} fill="#e9d5ff" /><text x="315" y="145" textAnchor="middle" fontSize="10" fontFamily="sans-serif">freio</text>
    <path d="M60 150 Q90 140 110 160" {...T} strokeWidth={4} stroke="#6b7280" />
    <rect x="230" y="180" width="50" height="22" rx="4" {...T} /><text x="255" y="195" textAnchor="middle" fontSize="10" fontFamily="sans-serif">correia</text>
  </>),
  eixos: (<>
    <rect x="150" y="15" width="100" height="60" rx="8" {...T} />
    <line x1="200" y1="75" x2="200" y2="250" {...T} strokeWidth={4} />
    {[45, 150, 200].map((y) => <g key={y}><line x1="110" y1={y} x2="290" y2={y} {...T} strokeWidth={3} />
      <rect x="85" y={y - 16} width="22" height="32" rx="4" {...F} fill="#374151" /><rect x="293" y={y - 16} width="22" height="32" rx="4" {...F} fill="#374151" />
      {y > 100 && <><rect x="60" y={y - 16} width="22" height="32" rx="4" {...F} fill="#374151" /><rect x="318" y={y - 16} width="22" height="32" rx="4" {...F} fill="#374151" /></>}</g>)}
    <text x="200" y="12" textAnchor="middle" fontSize="11" fontFamily="sans-serif" fill="#1f2937">frente</text>
  </>),
};
export const NOMES_ESQUEMA = {
  cavalo_frente: "Cavalo / caminhão — frente", cavalo_lateral: "Cavalo / caminhão — lateral", cavalo_traseira: "Cavalo / caminhão — traseira",
  carreta_lateral: "Carreta — lateral", carreta_traseira: "Carreta — traseira", onibus_lateral: "Ônibus — lateral", onibus_frente: "Ônibus — frente",
  empilhadeira_lateral: "Empilhadeira — lateral", retro_lateral: "Retroescavadeira — lateral", utilitario_lateral: "Utilitário / van — lateral",
  painel: "Painel / luzes de alerta", motor: "Motor / fluidos", eixos: "Eixos e pneus (vista de cima)",
};

export function Esquema({ codigo }) {
  const d = DESENHOS[codigo];
  return (
    <svg viewBox="0 0 400 260" width="100%" style={{ display: "block", background: "#ffffff" }} preserveAspectRatio="xMidYMid meet" role="img" aria-label={NOMES_ESQUEMA[codigo] || codigo}>
      {d || <text x="200" y="130" textAnchor="middle" fontFamily="sans-serif" fontSize="14" fill="#6b7280">sem imagem</text>}
    </svg>
  );
}

/** Fundo de uma vista: esquema do QuotaFlow ("esquema:<codigo>") ou imagem própria (URL resolvida). Mantém 400×260 (proporção). */
export function FundoVista({ imagem, url }) {
  if (imagem && imagem.startsWith("esquema:")) return <Esquema codigo={imagem.slice(8)} />;
  if (url) return <div style={{ position: "relative", width: "100%", paddingTop: "65%", background: "#fff" }}><img src={url} alt="vista" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} /></div>;
  return <Esquema codigo="" />;
}
