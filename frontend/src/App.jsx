import { useState, useRef, useEffect } from "react";
//import TelaCotacoesNova from "./components/cotacoes/TelaCotacoesNova";
import TelaCotacoesNovaComAbas from "./components/cotacoes/TelaCotacoesNovaComAbas";
import TelaChamadosNova from "./components/chamados/TelaChamadosNova";
import TelaFornecedoresNova from "./components/fornecedores/TelaFornecedoresNova";
import TelaEquipamentos from './components/equipamentos/TelaEquipamentos';
import TelaUsuariosNova from './components/usuarios/TelaUsuariosNova';
import TelaPlanoAcaoNova from './components/plano/TelaPlanoAcaoNova';
import TelaFinanceiroNova from './components/financeiro/TelaFinanceiroNova';
import TelaRelatorioNova from './components/relatorio/TelaRelatorioNova';
import TelaHistoricoPrecosNova from './components/historico/TelaHistoricoPrecosNova';
import TelaInteligenciaNova from './components/inteligencia/TelaInteligenciaNova';
import TelaBenchmarkNova from './components/benchmark/TelaBenchmarkNova';
import TelaLogin from './TelaLogin';
import apiService from './services/apiService';
import TelaCatalogo from "./components/catalogo/TelaCatalogo";
import { useCatalogo } from './hooks/useCatalogo';


import {
  useChamados,
  useCotacoes,
  useFornecedores,
  useEquipamentos,
  useTarefas,
  useUsuarios,
  useFinanceiro,
  useInteligencia,
  useBenchmark,
  useRelatorio,
  useEmail,
} from './hooks';

let cotacaoCounter = 9;
const gerarCOT = () => { cotacaoCounter++; return `COT-${new Date().getFullYear()}-${String(cotacaoCounter).padStart(4,"0")}`; };

// ─────────────────────────────────────────────
// HELPERS & CONSTANTS
// ─────────────────────────────────────────────
const C = {
  bg:"#0a0e14", surface:"#111722", border:"#1e2535", accent:"#3b82f6",
  success:"#22c55e", warn:"#f59e0b", danger:"#ef4444", muted:"#64748b",
  text:"#e2e8f0", textSub:"#94a3b8", saving:"#a78bfa",
};
const urgCfg = { alta:{l:"Alta",c:"#ef4444",bg:"#3f0f0f"}, media:{l:"Média",c:"#f59e0b",bg:"#3f2a0a"}, baixa:{l:"Baixa",c:"#22c55e",bg:"#0f2f1a"} };
const catCfg = { corretiva:{l:"Corretiva",c:"#f87171"}, preventiva:{l:"Preventiva",c:"#60a5fa"}, preditiva:{l:"Preditiva",c:"#a78bfa"} };
const fsCfg = { respondido:{l:"Recebido",c:"#22c55e",dot:"#22c55e"}, pendente:{l:"Aguardando",c:"#f59e0b",dot:"#f59e0b"}, sem_resposta:{l:"Sem resposta",c:"#ef4444",dot:"#ef4444"} };
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const fmtBRL = v => v!=null ? `R$ ${Number(v).toFixed(2).replace(".",",")}` : "—";
const fmtD = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const diasDesde = d => Math.floor((new Date()-new Date(d))/86400000);
const getMenor = fs => { const vs=fs.filter(f=>f.valor!=null).map(f=>f.valor); return vs.length?Math.min(...vs):null; };
const getMaior = fs => { const vs=fs.filter(f=>f.valor!=null).map(f=>f.valor); return vs.length?Math.max(...vs):null; };

// ─────────────────────────────────────────────
// UI ATOMS
// ─────────────────────────────────────────────
const s = {
  input:{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box" },
  btn:(v,color="#3b82f6")=>({ background:v?color:C.surface,border:`1px solid ${v?color:C.border}`,borderRadius:7,padding:"9px 18px",color:v?"#fff":C.muted,fontSize:13,fontWeight:600,cursor:v?"pointer":"not-allowed",fontFamily:"inherit",transition:"all .15s" }),
  tag:(c="#64748b")=>({ fontSize:10,background:`${c}22`,border:`1px solid ${c}44`,borderRadius:4,padding:"2px 8px",color:c,letterSpacing:"0.06em",fontWeight:600,whiteSpace:"nowrap" }),
  card:{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10 },
  label:{ fontSize:11,color:C.muted,letterSpacing:"0.08em",display:"block",marginBottom:5 },
};

function Input({label,...p}){ return <div style={{marginBottom:14}}>{label&&<label style={s.label}>{label.toUpperCase()}</label>}<input style={s.input} {...p}/></div>; }
function Select({label,children,...p}){ return <div style={{marginBottom:14}}>{label&&<label style={s.label}>{label.toUpperCase()}</label>}<select style={{...s.input,appearance:"none"}} {...p}>{children}</select></div>; }
function Modal({title,onClose,children,width=480}){
  return(
    <div style={{position:"fixed",inset:0,background:"#00000090",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:20}}>
      <div style={{...s.card,width,maxWidth:"100%",maxHeight:"85vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 48px #00000060"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 22px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{fontSize:15,fontWeight:700,color:C.text}}>{title}</div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        <div style={{padding:"20px 22px",overflowY:"auto",flex:1}}>{children}</div>
      </div>
    </div>
  );
}
function Badge({cfg}){ return <span style={{display:"inline-flex",alignItems:"center",gap:5,...s.tag(cfg.c)}}><span style={{width:6,height:6,borderRadius:"50%",background:cfg.dot||cfg.c}}/>{cfg.l}</span>; }

// ─────────────────────────────────────────────
// SAVING CALC HELPERS
// ─────────────────────────────────────────────
function calcSavings(chamados, cotacoes) {
  return chamados.filter(c=>c.status==="finalizado"&&c.valorAprovado).map(ch=>{
    const cot = cotacoes.find(c=>c.chamadoId===ch.id);
    const fs = cot?.fornecedores||[];
    const menor = getMenor(fs);
    const maior = getMaior(fs);
    const savingA = (maior!=null&&menor!=null&&maior!==menor) ? maior-menor : 0;
    const savingB = (ch.valorNegociado!=null&&ch.valorAprovado!=null) ? ch.valorAprovado-ch.valorNegociado : 0;
    const valorPago = ch.valorNegociado??ch.valorAprovado;
    return { ...ch, cot, menor, maior, savingA, savingB, savingTotal:savingA+savingB, valorPago };
  });
}

export default function App(){
  const [usuario, setUsuario] = useState(null);
  const chamados = useChamados();
  const cotacoes = useCotacoes();
  const fornecedores = useFornecedores();
  const token = localStorage.getItem('access_token');
  const catalogo = useCatalogo(token);
  const equipamentos = useEquipamentos();
  const tarefas = useTarefas();
  const usuarios = useUsuarios();
  const financeiro = useFinanceiro();
  const inteligencia = useInteligencia();
  const benchmark = useBenchmark();
  const relatorio = useRelatorio();
  const [tela,setTela]=useState("home");
  const [participaBench,setParticipaBench]=useState(true);
  const email = useEmail();
  const [notasPeriodo,setNotasPeriodo]=useState({
    "2026-01":"Equipe completa. Mês tranquilo de manutenção.",
    "2026-02":"Greve parcial da transportadora regional. Lead times 40% maiores que o normal.",
    "2026-03":"Retorno normal. Dois técnicos em treinamento — aumento de chamados corretivos.",
  });

  const setNota = (chave, texto) => setNotasPeriodo(prev=>({...prev,[chave]:texto}));
  const { itens, setItens, listar, importarFornecedor } = useCatalogo();
  const login = (user) => {
    setUsuario(user);
    
    // ✅ SALVAR TOKEN PRIMEIRO
    if (user.access_token) {
      localStorage.setItem('access_token', user.access_token);
      apiService.setToken(user.access_token);
    }
    
    // ✅ DEPOIS carregar dados
    if (typeof chamados.carregar === 'function') {
      chamados.carregar();
    }
    if (typeof cotacoes.listar === 'function') {
      cotacoes.listar();
    }
    if (typeof fornecedores.listar === 'function') {
      fornecedores.listar();
    }
    if (typeof equipamentos.listar === 'function') {
      equipamentos.listar();
    }
    if (typeof tarefas.listar === 'function') {
      tarefas.listar();
    }
    if (typeof usuarios.listar === 'function') {
      usuarios.listar();
    }
    if (typeof catalogo.listar === 'function') {
      catalogo.listar();
    }
    
    const perfil = user.perfil || user.papel || 'comprador';
    const telaInicial = { 
      tecnico:"tecnico", 
      comprador:"compradora", 
      gestor:"financeiro", 
      admin:"usuarios" 
    };
    setTela(telaInicial[perfil] || "home");
  };
  const logout = () => { setUsuario(null); setTela("home"); };

  // Verificar permissão
  const temAcesso = (t) => {
    const resultado = !PERMISSOES[t] || (usuario && PERMISSOES[t].includes(usuario.perfil));
    return resultado;
  };

  // Navegar com verificação
  const navegar = (t) => { 
    if (temAcesso(t)) setTela(t); 
  };

  const abrirPlanoDeAcao = (recomendacoes, periodoLabel) => {
    const novas = recomendacoes.map(r => {
      tarefaIdCounter++;
      const prazoDate = new Date();
      prazoDate.setDate(prazoDate.getDate() + r.prazo);
      return { id:tarefaIdCounter, titulo:r.txt, detalhe:r.detalhe+` — Gerado de ${periodoLabel}.`, responsavel:"", prazo:prazoDate.toISOString().split("T")[0], prioridade:r.prioridade, status:"pendente", criacao:new Date().toISOString(), comentarios:[] };
    });
    setTarefas(prev=>{
      const ex=prev.map(t=>t.titulo);
      return [...prev,...novas.filter(n=>!ex.includes(n.titulo))];
    });
    navegar("plano");
  };

  // Mostrar login se não autenticado
  if (!usuario) return <TelaLogin onLogin={login}/>;

  const perfil = PERFIS[usuario.perfil];

  // Nav items filtrados por perfil
  const navItems = [
    {id:"home",          l:"Início",                  perfis:["tecnico","comprador","gestor","admin"]},
    {id:"tecnico",       l:"🔧 Chamado",              perfis:["tecnico","comprador","gestor","admin"]},
    {id:"compradora",    l:"📋 Compras",              perfis:["comprador","gestor","admin"]},
    {id:"plano",         l:`✅ Plano${tarefas.dados.filter(t=>t.status==="em_andamento").length>0?` (${tarefas.dados.filter(t=>t.status==="em_andamento").length})`:""}`, perfis:["comprador","gestor","admin"]},
    {id:"financeiro",    l:"💰 Financeiro",           perfis:["gestor","admin"]},
    {id:"relatorio",     l:"📄 Relatório",            perfis:["gestor","admin"]},
    {id:"historico",     l:"📉 Histórico Preços",     perfis:["gestor","admin"]},
    {id:"inteligencia",  l:"🧠 Inteligência",         perfis:["gestor","admin"]},
    {id:"benchmark",     l:"📈 Benchmark",            perfis:["gestor","admin"]},
    {id:"equipamentos",  l:"⚙ Equipamentos",          perfis:["comprador","gestor","admin"]},
    {id:"fornecedores",  l:"🏭 Fornecedores",         perfis:["comprador","gestor","admin"]},
    {id:"fornecedorportal",l:"🔗 Portal fornecedor",  perfis:["comprador","gestor","admin"]},
    {id:"catalogo",      l:"📦 Catálogo",             perfis:["comprador","gestor","admin"]},
    {id:"usuarios",      l:"👥 Usuários",             perfis:["admin"]},
  ].filter(n=>n.perfis.includes(usuario.perfil));

  return(
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",background:C.bg,height:"100vh",color:C.text,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>

      {/* Navbar com info do usuário logado */}
      <div style={{display:"flex", height:"100vh", overflow:"hidden"}}>
        {/* ─── SIDEBAR ─── */}
        <div style={{
          width: 170,
          background: C.surface,
          borderRight: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          height: "100vh",
          padding: "16px 12px",
          gap: 4,
          overflowY: "auto",
        }}>
          {/* Logo */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>
            <div style={{width:4,height:22,background:"#f87171",borderRadius:2}}/>
            <span style={{fontSize:16,fontWeight:700,color:C.text,letterSpacing:"0.02em"}}>QuotaFlow</span>
          </div>

          {/* Navegação */}
          {navItems.map(t => (
            <button
              key={t.id}
              onClick={() => navegar(t.id)}
              style={{
                background: tela === t.id ? "#1e2a3f" : "transparent",
                border: "none",
                borderRadius: 6,
                padding: "10px 14px",
                color: tela === t.id ? C.accent : C.muted,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
                width: "100%",
                transition: "all .1s",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
              onMouseEnter={e => { if (tela !== t.id) e.currentTarget.style.background = "#151d2e" }}
              onMouseLeave={e => { if (tela !== t.id) e.currentTarget.style.background = "transparent" }}
            >
              <span style={{width:20, display:"inline-block"}}>{t.l.split(" ")[0]}</span>
              <span>{t.l.split(" ").slice(1).join(" ")}</span>
            </button>
          ))}

          {/* Espaçador para empurrar o logout para baixo */}
          <div style={{ flex: 1 }} />

          {/* Informações do usuário + logout */}
          <div style={{
            borderTop: `1px solid ${C.border}`,
            paddingTop: 12,
            marginTop: 8,
          }}>
            <div style={{ fontSize: 11, color: C.text, fontWeight: 500, marginBottom: 2 }}>
              {usuario.nome}
            </div>
            <div style={{ fontSize: 9, color: perfil.c, marginBottom: 8 }}>
              {perfil.icon} {perfil.l}
            </div>
            <button
              onClick={logout}
              style={{
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "6px 10px",
                color: C.muted,
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
                width: "100%",
              }}
            >
              Sair
            </button>
          </div>
        </div>

      {/* Conteúdo */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>        
        {tela==="home"&&(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:40,overflowY:"auto"}}>
            <div style={{maxWidth:600,width:"100%",textAlign:"center"}}>
              <div style={{fontSize:52,marginBottom:16}}>{perfil.icon}</div>
              <div style={{fontSize:26,fontWeight:700,color:C.text,marginBottom:8}}>Olá, {usuario.nome.split(" ")[0]}!</div>
              <div style={{fontSize:14,color:C.muted,marginBottom:32}}>Você está logado como <strong style={{color:perfil.c}}>{perfil.l}</strong></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
                {navItems.filter(n=>n.id!=="home").map(n=>(
                  <div key={n.id} onClick={()=>navegar(n.id)}
                    style={{...s.card,padding:"18px 14px",cursor:"pointer",textAlign:"center",transition:"all .15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="#151d2e";e.currentTarget.style.transform="translateY(-2px)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background=C.surface;e.currentTarget.style.transform="translateY(0)";}}>
                    <div style={{fontSize:11,color:C.text,fontWeight:500}}>{n.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}



        {/* Acesso negado */}
        {!temAcesso(tela)&&tela!=="home"&&(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
            <div style={{fontSize:48}}>🔒</div>
            <div style={{fontSize:18,fontWeight:700,color:C.text}}>Acesso restrito</div>
            <div style={{fontSize:13,color:C.muted}}>Seu perfil ({perfil.l}) não tem permissão para esta área.</div>
            <button onClick={()=>setTela("home")} style={{...s.btn(true),padding:"9px 20px"}}>← Voltar ao início</button>
          </div>
        )}
        {temAcesso(tela) && tela === "tecnico" && (
          <div style={{flex:1,overflowY:"auto"}}>
            <TelaChamadosNova 
              chamados={chamados.dados || []} 
              loading={chamados.loading} 
              erro={chamados.erro} 
              listar={chamados.carregar}   // <- aqui está o listar
              criar={chamados.criar} 
              atualizar={chamados.atualizar} 
              deletar={chamados.deletar} 
              equipamentos={equipamentos.dados || []} 
              fmtBRL={fmtBRL} 
              fmtD={fmtD} 
              C={C} 
              s={s} 
            />
          </div>
        )}
        {temAcesso(tela) && tela === "compradora" && (
          <div style={{flex:1,overflowY:"auto"}}>
            <TelaCotacoesNovaComAbas 
              C={C} 
              s={s} 
              fmtBRL={fmtBRL} 
              fmtD={fmtD} 
            />
          </div>
        )}
        {temAcesso(tela)&&tela==="financeiro"&&
          <div style={{flex:1,overflowY:"auto"}}>
            <TelaFinanceiroNova chamados={chamados.dados || []} cotacoes={cotacoes.dados || []} equipamentos={equipamentos.dados || []} />
          </div>}
        {temAcesso(tela) && tela === "inteligencia" && (
          <div style={{flex:1,overflowY:"auto"}}>
            <TelaInteligenciaNova 
              chamados={chamados.dados || []} 
              cotacoes={cotacoes.dados || []} 
              fornecedores={fornecedores.dados || []} 
              equipamentos={equipamentos.dados || []} 
              perfilUsuario={usuario.perfil}
              C={C} 
              s={s} 
              fmtBRL={fmtBRL} 
            />
          </div>
        )}
        {temAcesso(tela) && tela === "benchmark" && (
          <div style={{flex:1,overflowY:"auto"}}>
            <TelaBenchmarkNova 
              chamados={chamados.dados || []} 
              participaBench={participaBench} 
              setParticipaBench={setParticipaBench} 
              C={C} 
              s={s} 
              fmtBRL={fmtBRL} 
              fmtD={fmtD} 
            />
          </div>
        )}
        {temAcesso(tela)&&tela==="equipamentos"&&
          <div style={{flex:1,overflowY:"auto"}}>
            <TelaEquipamentos fmtBRL={fmtBRL} fmtD={fmtD} C={C} s={s}/>
          </div>}
        {temAcesso(tela) && tela === "fornecedores" && (
          <div style={{flex:1,overflowY:"auto"}}>
            <TelaFornecedoresNova C={C} s={s} fmtD={fmtD} />
          </div>
        )}
        {temAcesso(tela) && tela === "catalogo" && (
          <div style={{flex:1,overflowY:"auto"}}>
            <TelaCatalogo 
              itens={itens}
              setItens={setItens}
              fornecedores={fornecedores.dados || []}
              catalogo={catalogo}
              C={C} 
              s={s} 
              fmtBRL={fmtBRL} 
            />
          </div>
        )}
        {temAcesso(tela)&&tela==="fornecedorportal"&&
          <div style={{flex:1,overflowY:"auto"}}>
            <TelaFornecedorPortal/>
          </div>}
        {temAcesso(tela) && tela === "usuarios" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <TelaUsuariosNova useUsuarios={useUsuarios} C={C} s={s} />
          </div>)}
        {temAcesso(tela) && tela === "historico" && (
          <div style={{flex:1,overflowY:"auto"}}>
            <TelaHistoricoPrecosNova 
              chamados={chamados.dados || []} 
              cotacoes={cotacoes.dados || []} 
              C={C} 
              s={s} 
              fmtBRL={fmtBRL} 
              fmtD={fmtD} 
            />
          </div>
        )}
        {temAcesso(tela) && tela === "relatorio" && (
          <div style={{flex:1,overflowY:"auto"}}>
            <TelaRelatorioNova 
              chamados={chamados.dados || []} 
              cotacoes={cotacoes.dados || []} 
              fornecedores={fornecedores.dados || []} 
              equipamentos={equipamentos.dados || []} 
              onAbrirPlano={abrirPlanoDeAcao} 
              tarefas={tarefas.dados || []} 
              notasPeriodo={notasPeriodo} 
              setNota={setNota} 
              C={C} 
              s={s} 
              fmtBRL={fmtBRL} 
              fmtD={fmtD} 
            />
          </div>
        )}
        {temAcesso(tela) && tela === "plano" && (
          <div style={{flex:1,overflowY:"auto"}}>
            <TelaPlanoAcaoNova useTarefas={useTarefas} onVoltar={()=>navegar("relatorio")} C={C} s={s} />
          </div>
        )}        
      </div>
      </div>
      </div>
    );
    if (!usuario) return <TelaLogin onLogin={login}/>;
  }

// ─────────────────────────────────────────────
// ÁRVORE DE CATEGORIAS
// ─────────────────────────────────────────────
const CATEGORIAS_ARVORE = {
  "Transportes e Logística": [
    "Sistema de Freios","Rodagem e Pneus","Suspensão","Sistema Elétrico e Iluminação",
    "Estrutura e Chassi","Componentes de Conexão","Fluidos e Lubrificantes",
    "Carroceria e Baú","Rastreamento e Telemetria","Manutenção Preventiva",
  ],
  "Manutenção Industrial": [
    "Rolamentos e Mancais","Correias e Transmissão","Filtros e Lubrificação",
    "Hidráulico e Pneumático","Elétrica e Automação","Instrumentação e Sensores",
    "Vedações e Juntas","Ferramentas e EPI",
  ],
  "Comércio e Varejo": [
    "Embalagens","Equipamentos de Loja","Refrigeração","Mobiliário Comercial",
    "Sistemas de Pagamento","Segurança Eletrônica",
  ],
  "Tecnologia e Serviços Digitais": [
    "Hardware e Infraestrutura","Software e Licenças","Telecomunicações",
    "Segurança da Informação","Cloud e Hosting",
  ],
  "Serviços Profissionais": [
    "Consultoria","Treinamento","Limpeza e Conservação","Segurança Patrimonial",
    "Alimentação (Refeitório)","Medicina do Trabalho",
  ],
  "Construção e Predial": [
    "Materiais de Construção","Instalações Elétricas","Hidráulica e Saneamento",
    "Ar Condicionado e Climatização","Elevadores e Escadas Rolantes",
  ],
};

// Validar CNPJ (dígito verificador)
function validarCNPJ(cnpj) {
  const c = cnpj.replace(/\D/g,"");
  if (c.length!==14||/^(\d)\1+$/.test(c)) return false;
  const calc = (s,n) => {
    let sum=0, pos=n-7;
    for(let i=n;i>=1;i--){sum+=parseInt(s.charAt(n-i))*pos--;if(pos<2)pos=9;}
    const r=sum%11<2?0:11-sum%11;
    return r===parseInt(s.charAt(n));
  };
  return calc(c,12)&&calc(c,13);
}

function fmtCNPJ(v) {
  const d=v.replace(/\D/g,"").slice(0,14);
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5")
          .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})$/,"$1.$2.$3/$4")
          .replace(/^(\d{2})(\d{3})(\d{3})$/,"$1.$2.$3")
          .replace(/^(\d{2})(\d{3})$/,"$1.$2")
          .replace(/^(\d{2})$/,"$1");
}

const situacaoCfg = {
  "ATIVA":    { c:C.success, icon:"✓", risco:"Baixo"  },
  "SUSPENSA": { c:C.warn,    icon:"⚠", risco:"Médio"  },
  "INAPTA":   { c:"#ef4444", icon:"✕", risco:"Alto"   },
  "BAIXADA":  { c:"#ef4444", icon:"✕", risco:"Alto"   },
  "NULA":     { c:"#ef4444", icon:"✕", risco:"Alto"   },
};

// Contato em branco
const contatoVazio = () => ({ id:Date.now()+Math.random(), nome:"", papel:"comercial", email:"", telefone:"", whatsapp:"" });

function TelaFornecedores({ fornecedores, setFornecedores }) {
  const [aba, setAba] = useState("lista"); // lista | categorias
  const [search, setSearch] = useState("");
  const [filtroSit, setFiltroSit] = useState("todos");
  const [modal, setModal] = useState(null);
  const [catAbertas, setCatAbertas] = useState({});
  const [categoriasCustom, setCategoriasCustom] = useState({});
  const [novaCategoria, setNovaCategoria] = useState({ grupo:"", nome:"" });

  // Form completo do fornecedor
  const formVazio = () => ({
    nome:"", cnpj:"", razaoSocial:"", situacaoCNPJ:null, ultimaConsultaCNPJ:null,
    loadingCNPJ:false, erroCNPJ:null,
    endereco:"", cidade:"", estado:"", cep:"",
    contatos:[contatoVazio()],
    categoriasSel:[],
    obs:"",
  });
  const [form, setForm] = useState(formVazio());

  // Categorias combinadas
  const todasCategorias = { ...CATEGORIAS_ARVORE };
  Object.entries(categoriasCustom).forEach(([grupo, items]) => {
    if (!todasCategorias[grupo]) todasCategorias[grupo] = [];
    todasCategorias[grupo] = [...new Set([...todasCategorias[grupo], ...items])];
  });

  // Consultar CNPJ via BrasilAPI
  const consultarCNPJ = async (cnpj) => {
    const c = cnpj.replace(/\D/g,"");
    if (c.length!==14) return;
    if (!validarCNPJ(c)) { setForm(f=>({...f,erroCNPJ:"CNPJ inválido (dígito verificador).",situacaoCNPJ:null})); return; }
    setForm(f=>({...f,loadingCNPJ:true,erroCNPJ:null,situacaoCNPJ:null}));
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`);
      if (!res.ok) throw new Error("CNPJ não encontrado.");
      const data = await res.json();
      setForm(f=>({...f,
        loadingCNPJ:false,
        razaoSocial: data.razao_social||f.razaoSocial,
        cidade: data.municipio||f.cidade,
        estado: data.uf||f.estado,
        cep: data.cep||f.cep,
        endereco: [data.logradouro, data.numero, data.bairro].filter(Boolean).join(", ")||f.endereco,
        situacaoCNPJ: {
          situacao: data.descricao_situacao_cadastral||"ATIVA",
          abertura: data.data_inicio_atividade,
          porte: data.porte,
          natureza: data.natureza_juridica,
          atualizado: new Date().toLocaleDateString("pt-BR"),
        },
        ultimaConsultaCNPJ: new Date().toISOString(),
      }));
    } catch(e) {
      setForm(f=>({...f, loadingCNPJ:false, erroCNPJ:e.message||"Erro ao consultar CNPJ. Verifique a conexão."}));
    }
  };

  const salvar = () => {
    if (!form.nome) return;
    const novo = {
      id: modal==="novo"?Date.now():modal.id,
      nome:form.nome, cnpj:form.cnpj, razaoSocial:form.razaoSocial,
      situacaoCNPJ:form.situacaoCNPJ, ultimaConsultaCNPJ:form.ultimaConsultaCNPJ,
      endereco:form.endereco, cidade:form.cidade, estado:form.estado, cep:form.cep,
      contatos:form.contatos.filter(c=>c.nome||c.email),
      categorias:form.categoriasSel,
      // compat com código antigo
      email: form.contatos.find(c=>c.papel==="cotacao")?.email || form.contatos[0]?.email || "",
      telefone: form.contatos[0]?.telefone||"",
      whatsapp: form.contatos.find(c=>c.whatsapp)?.whatsapp||"",
      obs:form.obs, ativo:true,
    };
    if (modal==="novo") setFornecedores(prev=>[...prev,novo]);
    else setFornecedores(prev=>prev.map(f=>f.id===novo.id?novo:f));
    setModal(null);
  };

  const abrirEditar = (f) => {
    setForm({
      nome:f.nome||"", cnpj:f.cnpj||"", razaoSocial:f.razaoSocial||"",
      situacaoCNPJ:f.situacaoCNPJ||null, ultimaConsultaCNPJ:f.ultimaConsultaCNPJ||null,
      loadingCNPJ:false, erroCNPJ:null,
      endereco:f.endereco||"", cidade:f.cidade||"", estado:f.estado||"", cep:f.cep||"",
      contatos: f.contatos?.length ? f.contatos : [contatoVazio()],
      categoriasSel: f.categorias||[],
      obs:f.obs||"",
    });
    setModal(f);
  };

  const abrirNovo = () => { setForm(formVazio()); setModal("novo"); };
  const excluir = id => { if(confirm("Excluir fornecedor?")) setFornecedores(prev=>prev.filter(f=>f.id!==id)); };

  const toggleCat = (cat) => setForm(f=>({...f, categoriasSel: f.categoriasSel.includes(cat) ? f.categoriasSel.filter(c=>c!==cat) : [...f.categoriasSel, cat]}));
  const toggleGrupo = (grupo, items) => {
    const todos = items.every(i=>form.categoriasSel.includes(i));
    setForm(f=>({...f, categoriasSel: todos ? f.categoriasSel.filter(c=>!items.includes(c)) : [...new Set([...f.categoriasSel,...items])]}));
  };

  const addContato = () => setForm(f=>({...f,contatos:[...f.contatos,contatoVazio()]}));
  const remContato = id => setForm(f=>({...f,contatos:f.contatos.filter(c=>c.id!==id)}));
  const setContato = (id,campo,val) => setForm(f=>({...f,contatos:f.contatos.map(c=>c.id===id?{...c,[campo]:val}:c)}));

  const lista = fornecedores.filter(f=>{
    const matchS = !search || f.nome.toLowerCase().includes(search.toLowerCase()) || f.cnpj?.includes(search) || f.cidade?.toLowerCase().includes(search.toLowerCase());
    const sit = f.situacaoCNPJ?.situacao||"";
    const matchF = filtroSit==="todos" || (filtroSit==="ativa"&&sit==="ATIVA") || (filtroSit==="risco"&&["SUSPENSA","INAPTA","BAIXADA"].includes(sit)) || (filtroSit==="sem_cnpj"&&!f.cnpj);
    return f.ativo!==false && matchS && matchF;
  });

  const papelLabel = { comercial:"Comercial", cotacao:"Cotação/Compras", tecnico:"Técnico", financeiro:"Financeiro", outro:"Outro" };

  return (
    <div style={{padding:"22px 24px",overflowY:"auto",height:"100%"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",marginBottom:4}}>CADASTROS</div>
          <div style={{fontSize:20,fontWeight:700,color:C.text}}>Fornecedores</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setAba(aba==="lista"?"categorias":"lista")}
            style={{...s.btn(aba==="categorias"),padding:"8px 14px",fontSize:12}}>
            🗂 {aba==="categorias"?"← Voltar":"Gerenciar Categorias"}
          </button>
          <button onClick={abrirNovo} style={{...s.btn(true),padding:"8px 18px"}}>+ Novo fornecedor</button>
        </div>
      </div>

      {/* ── ABA CATEGORIAS ── */}
      {aba==="categorias"&&(
        <div>
          <div style={{fontSize:13,color:C.muted,marginBottom:16}}>Gerencie a árvore de categorias disponível no cadastro de fornecedores.</div>
          {/* Adicionar categoria */}
          <div style={{...s.card,padding:"16px 20px",marginBottom:16}}>
            <div style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",marginBottom:12}}>ADICIONAR CATEGORIA</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 2fr auto",gap:10,alignItems:"flex-end"}}>
              <div>
                <label style={s.label}>GRUPO</label>
                <select value={novaCategoria.grupo} onChange={e=>setNovaCategoria(n=>({...n,grupo:e.target.value}))}
                  style={{...s.input,appearance:"none"}}>
                  <option value="">Selecione ou crie...</option>
                  {Object.keys(todasCategorias).map(g=><option key={g} value={g}>{g}</option>)}
                  <option value="__novo__">+ Novo grupo</option>
                </select>
              </div>
              {novaCategoria.grupo==="__novo__"&&(
                <Input label="Nome do novo grupo" value={novaCategoria.grupoNome||""} onChange={e=>setNovaCategoria(n=>({...n,grupoNome:e.target.value}))} placeholder="Ex: Agronegócio"/>
              )}
              <div>
                <label style={s.label}>SUBCATEGORIA</label>
                <input value={novaCategoria.nome} onChange={e=>setNovaCategoria(n=>({...n,nome:e.target.value}))}
                  placeholder="Ex: Implementos Agrícolas" style={s.input}/>
              </div>
              <button onClick={()=>{
                const grupo = novaCategoria.grupo==="__novo__"?(novaCategoria.grupoNome||"").trim():novaCategoria.grupo;
                const nome = novaCategoria.nome.trim();
                if(!grupo||!nome) return;
                setCategoriasCustom(prev=>({...prev,[grupo]:[...(prev[grupo]||[]),nome]}));
                setNovaCategoria({grupo:"",nome:""});
              }} style={{...s.btn(true),padding:"9px 16px",marginBottom:0}}>+ Adicionar</button>
            </div>
          </div>
          {/* Árvore completa */}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {Object.entries(todasCategorias).map(([grupo,items])=>(
              <div key={grupo} style={{...s.card,overflow:"hidden"}}>
                <div style={{padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",background:`${C.accent}08`}}>
                  <span style={{fontSize:13,fontWeight:600,color:C.text}}>{grupo}</span>
                  <span style={{fontSize:11,color:C.muted}}>{items.length} subcategorias</span>
                </div>
                <div style={{padding:"10px 18px",display:"flex",flexWrap:"wrap",gap:6}}>
                  {items.map(it=>(
                    <span key={it} style={{...s.tag(C.accent),display:"inline-flex",alignItems:"center",gap:6}}>
                      {it}
                      {categoriasCustom[grupo]?.includes(it)&&(
                        <span onClick={()=>setCategoriasCustom(prev=>({...prev,[grupo]:prev[grupo].filter(x=>x!==it)}))}
                          style={{cursor:"pointer",color:"#ef4444",fontSize:10,lineHeight:1}}>✕</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ABA LISTA ── */}
      {aba==="lista"&&(
        <>
          {/* Filtros */}
          <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome, CNPJ ou cidade..."
              style={{...s.input,flex:1,minWidth:200,marginBottom:0}}/>
            {["todos","ativa","risco","sem_cnpj"].map(f=>(
              <button key={f} onClick={()=>setFiltroSit(f)}
                style={{background:filtroSit===f?"#1e2a3f":"transparent",border:`1px solid ${filtroSit===f?C.accent:C.border}`,borderRadius:6,padding:"6px 12px",color:filtroSit===f?C.accent:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                {{todos:"Todos",ativa:"✓ Ativos",risco:"⚠ Com risco",sem_cnpj:"Sem CNPJ"}[f]}
              </button>
            ))}
          </div>

          <div style={{...s.card,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 130px 1fr 1fr 1fr 100px 80px",padding:"10px 18px",background:C.bg,borderBottom:`1px solid ${C.border}`,fontSize:10,color:C.muted,letterSpacing:"0.08em"}}>
              <span>FORNECEDOR / RAZÃO SOCIAL</span><span>CNPJ</span><span>CIDADE/UF</span><span>CONTATO PRINCIPAL</span><span>CATEGORIAS</span><span>SITUAÇÃO</span><span></span>
            </div>
            {lista.map((f,i)=>{
              const sit = f.situacaoCNPJ?.situacao;
              const sitCfg = sit?situacaoCfg[sit]:null;
              const contatoPrincipal = f.contatos?.find(c=>c.papel==="cotacao")||f.contatos?.[0];
              return(
                <div key={f.id} style={{display:"grid",gridTemplateColumns:"2fr 130px 1fr 1fr 1fr 100px 80px",padding:"13px 18px",borderBottom:i<lista.length-1?`1px solid ${C.border}22`:"none",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:13,color:C.text,fontWeight:500}}>{f.nome}</div>
                    {f.razaoSocial&&f.razaoSocial!==f.nome&&<div style={{fontSize:10,color:C.muted}}>{f.razaoSocial}</div>}
                  </div>
                  <div style={{fontSize:11,color:C.accent,fontFamily:"'IBM Plex Mono',monospace"}}>{f.cnpj||<span style={{color:C.muted}}>—</span>}</div>
                  <div style={{fontSize:12,color:C.textSub}}>{f.cidade&&f.estado?`${f.cidade}/${f.estado}`:"—"}</div>
                  <div>
                    {contatoPrincipal?.nome&&<div style={{fontSize:12,color:C.text}}>{contatoPrincipal.nome}</div>}
                    {contatoPrincipal?.whatsapp?(
                      <a href={`https://wa.me/${contatoPrincipal.whatsapp}`} target="_blank" rel="noreferrer"
                        style={{fontSize:11,color:"#22c55e",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:3}}>
                        💬 WhatsApp
                      </a>
                    ):contatoPrincipal?.email?(
                      <div style={{fontSize:11,color:C.accent}}>{contatoPrincipal.email}</div>
                    ):<span style={{fontSize:11,color:C.muted}}>—</span>}
                  </div>
                  <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                    {(f.categorias||[]).slice(0,2).map(c=><span key={c} style={{fontSize:9,background:C.border,borderRadius:3,padding:"1px 5px",color:C.muted}}>{c}</span>)}
                    {(f.categorias||[]).length>2&&<span style={{fontSize:9,color:C.muted}}>+{(f.categorias||[]).length-2}</span>}
                  </div>
                  <div>
                    {sitCfg?(
                      <span style={{...s.tag(sitCfg.c),fontSize:10}}>{sitCfg.icon} {sit}</span>
                    ):<span style={{fontSize:10,color:C.muted}}>Não verificado</span>}
                    {f.situacaoCNPJ?.atualizado&&<div style={{fontSize:9,color:C.muted,marginTop:2}}>{f.situacaoCNPJ.atualizado}</div>}
                  </div>
                  <div style={{display:"flex",gap:5}}>
                    <button onClick={()=>abrirEditar(f)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,padding:"4px 8px",color:C.muted,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏</button>
                    <button onClick={()=>excluir(f.id)} style={{background:"transparent",border:`1px solid #ef444433`,borderRadius:5,padding:"4px 7px",color:"#ef4444",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
                  </div>
                </div>
              );
            })}
            {lista.length===0&&<div style={{padding:32,textAlign:"center",color:C.muted,fontSize:13}}>Nenhum fornecedor encontrado</div>}
          </div>
        </>
      )}

      {/* ── MODAL CADASTRO COMPLETO ── */}
      {modal&&(
        <Modal title={modal==="novo"?"Novo fornecedor":"Editar fornecedor"} onClose={()=>setModal(null)} width={620}>
          <div style={{display:"flex",flexDirection:"column",gap:0}}>

            {/* SEÇÃO 1 — Dados da empresa */}
            <div style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",marginBottom:12}}>DADOS DA EMPRESA</div>
            <Input label="Nome fantasia *" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))}/>

            {/* CNPJ com consulta */}
            <div style={{marginBottom:14}}>
              <label style={s.label}>CNPJ</label>
              <div style={{display:"flex",gap:8}}>
                <input value={form.cnpj} onChange={e=>setForm(f=>({...f,cnpj:fmtCNPJ(e.target.value),erroCNPJ:null,situacaoCNPJ:null}))}
                  placeholder="00.000.000/0000-00" style={{...s.input,flex:1,fontFamily:"'IBM Plex Mono',monospace"}}/>
                <button onClick={()=>consultarCNPJ(form.cnpj)} disabled={form.loadingCNPJ||form.cnpj.replace(/\D/g,"").length!==14}
                  style={{...s.btn(form.cnpj.replace(/\D/g,"").length===14&&!form.loadingCNPJ,"#0891b2"),padding:"0 14px",whiteSpace:"nowrap",fontSize:12}}>
                  {form.loadingCNPJ?"⟳ Consultando...":"🔍 Consultar Receita"}
                </button>
              </div>
              {/* Resultado da consulta */}
              {form.erroCNPJ&&<div style={{fontSize:11,color:"#ef4444",marginTop:5,background:"#2d1515",borderRadius:5,padding:"5px 10px"}}>{form.erroCNPJ}</div>}
              {form.situacaoCNPJ&&(()=>{
                const sit=form.situacaoCNPJ.situacao||"ATIVA";
                const cfg=situacaoCfg[sit]||{c:C.muted,icon:"?",risco:"Desconhecido"};
                return(
                  <div style={{marginTop:8,background:`${cfg.c}12`,border:`1px solid ${cfg.c}33`,borderRadius:7,padding:"10px 14px"}}>
                    <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{...s.tag(cfg.c),fontSize:11}}>{cfg.icon} {sit} — Risco {cfg.risco}</span>
                      {form.situacaoCNPJ.porte&&<span style={{fontSize:11,color:C.textSub}}>Porte: {form.situacaoCNPJ.porte}</span>}
                      {form.situacaoCNPJ.abertura&&<span style={{fontSize:11,color:C.textSub}}>Abertura: {form.situacaoCNPJ.abertura}</span>}
                    </div>
                    {form.situacaoCNPJ.natureza&&<div style={{fontSize:11,color:C.muted,marginTop:4}}>{form.situacaoCNPJ.natureza}</div>}
                    <div style={{fontSize:10,color:C.muted,marginTop:4}}>Consultado em: {form.situacaoCNPJ.atualizado}</div>
                  </div>
                );
              })()}
            </div>

            <Input label="Razão social" value={form.razaoSocial} onChange={e=>setForm(f=>({...f,razaoSocial:e.target.value}))} placeholder="Preenchida automaticamente pela consulta CNPJ"/>
            <Input label="Endereço" value={form.endereco} onChange={e=>setForm(f=>({...f,endereco:e.target.value}))} placeholder="Rua, número, bairro"/>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 60px",gap:10}}>
              <Input label="Cidade" value={form.cidade} onChange={e=>setForm(f=>({...f,cidade:e.target.value}))}/>
              <Input label="Estado (UF)" value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value.slice(0,2).toUpperCase()}))} placeholder="SP"/>
              <Input label="CEP" value={form.cep} onChange={e=>setForm(f=>({...f,cep:e.target.value}))}/>
            </div>

            {/* SEÇÃO 2 — Contatos */}
            <div style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",marginBottom:12,marginTop:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>CONTATOS</div>
            {form.contatos.map((ct,idx)=>(
              <div key={ct.id} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <select value={ct.papel} onChange={e=>setContato(ct.id,"papel",e.target.value)}
                    style={{...s.input,width:"auto",padding:"4px 8px",fontSize:11,marginBottom:0,appearance:"none"}}>
                    {Object.entries(papelLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                  {form.contatos.length>1&&(
                    <button onClick={()=>remContato(ct.id)} style={{background:"transparent",border:"none",color:"#ef4444",fontSize:14,cursor:"pointer"}}>✕</button>
                  )}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <input value={ct.nome} onChange={e=>setContato(ct.id,"nome",e.target.value)} placeholder="Nome do contato" style={{...s.input,fontSize:12}}/>
                  <input value={ct.email} onChange={e=>setContato(ct.id,"email",e.target.value)} placeholder="email@fornecedor.com" style={{...s.input,fontSize:12}}/>
                  <input value={ct.telefone} onChange={e=>setContato(ct.id,"telefone",e.target.value)} placeholder="(11) 3333-4444" style={{...s.input,fontSize:12}}/>
                  <div style={{position:"relative"}}>
                    <input value={ct.whatsapp} onChange={e=>setContato(ct.id,"whatsapp",e.target.value)} placeholder="55119..." style={{...s.input,fontSize:12}}/>
                    {ct.whatsapp&&<a href={`https://wa.me/${ct.whatsapp}`} target="_blank" rel="noreferrer" style={{fontSize:10,color:"#22c55e",position:"absolute",right:8,top:"50%",transform:"translateY(-50%)"}}>💬</a>}
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addContato} style={{background:"transparent",border:`1px dashed ${C.border}`,borderRadius:7,padding:"8px",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",marginBottom:12,width:"100%"}}>
              + Adicionar contato
            </button>

            {/* SEÇÃO 3 — Categorias */}
            <div style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",marginBottom:10,paddingTop:12,borderTop:`1px solid ${C.border}`}}>CATEGORIAS DE FORNECIMENTO</div>
            <div style={{maxHeight:220,overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:8,padding:10,marginBottom:14}}>
              {Object.entries(todasCategorias).map(([grupo,items])=>{
                const aberta=catAbertas[grupo]!==false;
                const todosGrupo=items.every(i=>form.categoriasSel.includes(i));
                const algunsGrupo=items.some(i=>form.categoriasSel.includes(i));
                return(
                  <div key={grupo} style={{marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"5px 6px",cursor:"pointer",borderRadius:5,background:algunsGrupo?`${C.accent}10`:"transparent"}}
                      onClick={()=>setCatAbertas(p=>({...p,[grupo]:!aberta}))}>
                      <span style={{fontSize:10,color:C.muted,width:12}}>{aberta?"▼":"▶"}</span>
                      <div onClick={e=>{e.stopPropagation();toggleGrupo(grupo,items);}}
                        style={{width:14,height:14,borderRadius:3,border:`2px solid ${todosGrupo?C.accent:algunsGrupo?"#818cf8":C.border}`,background:todosGrupo?C.accent:algunsGrupo?"#818cf822":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {todosGrupo&&<span style={{fontSize:9,color:"#fff"}}>✓</span>}
                        {!todosGrupo&&algunsGrupo&&<span style={{fontSize:9,color:"#818cf8"}}>-</span>}
                      </div>
                      <span style={{fontSize:12,fontWeight:600,color:C.text}}>{grupo}</span>
                      <span style={{fontSize:10,color:C.muted,marginLeft:"auto"}}>{items.filter(i=>form.categoriasSel.includes(i)).length}/{items.length}</span>
                    </div>
                    {aberta&&(
                      <div style={{paddingLeft:28,display:"flex",flexWrap:"wrap",gap:5,marginTop:4}}>
                        {items.map(it=>{
                          const sel=form.categoriasSel.includes(it);
                          return(
                            <div key={it} onClick={()=>toggleCat(it)}
                              style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 8px",borderRadius:5,border:`1px solid ${sel?C.accent:C.border}`,background:sel?`${C.accent}18`:C.bg,cursor:"pointer",fontSize:11,color:sel?C.accent:C.muted}}>
                              {sel&&<span style={{fontSize:9}}>✓</span>}
                              {it}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {form.categoriasSel.length>0&&(
              <div style={{fontSize:11,color:C.muted,marginBottom:12}}>
                Selecionadas: <strong style={{color:C.accent}}>{form.categoriasSel.length}</strong> — {form.categoriasSel.slice(0,4).join(", ")}{form.categoriasSel.length>4?` +${form.categoriasSel.length-4}`:""}
              </div>
            )}

            {/* SEÇÃO 4 — Observações */}
            <div style={{marginBottom:16,paddingTop:4,borderTop:`1px solid ${C.border}`}}>
              <label style={{...s.label,marginTop:12}}>OBSERVAÇÕES INTERNAS</label>
              <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} rows={2}
                placeholder="Condições de pagamento, prazo padrão, histórico de relacionamento..." style={{...s.input,resize:"none"}}/>
            </div>

            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setModal(null)} style={{...s.btn(false),padding:"8px 18px"}}>Cancelar</button>
              <button onClick={salvar} disabled={!form.nome} style={s.btn(!!form.nome)}>Salvar fornecedor</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// TELA: TÉCNICO
// ─────────────────────────────────────────────
function TelaTecnico({equipamentos,onChamadoAberto}){
  const [form,setForm]=useState({peca:"",codigo:"",equipamentoId:"",urgencia:"media",categoria:"corretiva",tecnico:"",descricao:""});
  const [eqSearch,setEqSearch]=useState("");
  const [showDrop,setShowDrop]=useState(false);
  const [enviado,setEnviado]=useState(null);
  const ref=useRef();
  const eqFiltrados=equipamentos.filter(e=>e.ativo!==false&&(e.nome.toLowerCase().includes(eqSearch.toLowerCase())||e.tag.toLowerCase().includes(eqSearch.toLowerCase())));
  const eqSel=equipamentos.find(e=>e.id===parseInt(form.equipamentoId));
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShowDrop(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const submit=()=>{
    const numero=gerarCOT();
    const novo={id:Date.now(),numero,...form,equipamentoId:parseInt(form.equipamentoId),abertura:new Date().toISOString().replace("T"," ").slice(0,16),status:"aguardando_cotacao"};
    onChamadoAberto(novo);setEnviado(novo);
  };
  if(enviado)return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:20,padding:40}}>
      <div style={{fontSize:52}}>✅</div>
      <div style={{fontSize:22,fontWeight:700,color:C.text}}>Chamado aberto!</div>
      <div style={{...s.card,padding:"20px 28px",textAlign:"center",minWidth:320}}>
        <div style={{fontSize:11,color:C.muted,marginBottom:4}}>NÚMERO DO CHAMADO</div>
        <div style={{fontSize:22,fontWeight:700,color:C.accent,fontFamily:"'IBM Plex Mono',monospace"}}>{enviado.numero}</div>
        <div style={{fontSize:13,color:C.textSub,marginTop:10}}>{enviado.peca}</div>
        <div style={{fontSize:12,color:C.muted,marginTop:4}}>{eqSel?.nome}</div>
      </div>
      <button onClick={()=>{setEnviado(null);setForm({peca:"",codigo:"",equipamentoId:"",urgencia:"media",categoria:"corretiva",tecnico:"",descricao:""});setEqSearch("");}} style={{...s.btn(true),marginTop:8}}>Abrir outro chamado</button>
    </div>
  );
  return(
    <div style={{maxWidth:520,margin:"0 auto",padding:"32px 24px",overflowY:"auto"}}>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",marginBottom:6}}>ABERTURA DE CHAMADO</div>
        <div style={{fontSize:22,fontWeight:700,color:C.text}}>Nova solicitação de peça</div>
      </div>
      <div style={{...s.card,padding:24}}>
        <Input label="Peça / Componente *" value={form.peca} onChange={e=>setForm(f=>({...f,peca:e.target.value}))} placeholder="Ex: Rolamento SKF 6205"/>
        <Input label="Código / Referência" value={form.codigo} onChange={e=>setForm(f=>({...f,codigo:e.target.value}))} placeholder="Ex: 6205-2RS1"/>
        <div style={{marginBottom:14,position:"relative"}} ref={ref}>
          <label style={s.label}>EQUIPAMENTO *</label>
          <input value={eqSel?`${eqSel.tag} — ${eqSel.nome}`:eqSearch}
            onChange={e=>{setEqSearch(e.target.value);setForm(f=>({...f,equipamentoId:""}));setShowDrop(true);}}
            onFocus={()=>setShowDrop(true)} placeholder="Buscar equipamento por nome ou TAG..." style={s.input}/>
          {showDrop&&eqFiltrados.length>0&&(
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#1a2233",border:`1px solid ${C.border}`,borderRadius:6,zIndex:50,marginTop:4,maxHeight:200,overflowY:"auto"}}>
              {eqFiltrados.map(eq=>(
                <div key={eq.id} onClick={()=>{setForm(f=>({...f,equipamentoId:eq.id}));setEqSearch("");setShowDrop(false);}}
                  style={{padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${C.border}22`}}
                  onMouseEnter={e=>e.currentTarget.style.background="#1e2a3f"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{fontSize:13,color:C.text}}>{eq.nome}</div>
                  <div style={{fontSize:11,color:C.accent}}>{eq.tag} · {eq.local}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Select label="Urgência" value={form.urgencia} onChange={e=>setForm(f=>({...f,urgencia:e.target.value}))}>
            <option value="baixa">🟢 Baixa — preventiva</option>
            <option value="media">🟡 Média — necessário em breve</option>
            <option value="alta">🔴 Alta — equipamento parado</option>
          </Select>
          <Select label="Categoria" value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))}>
            <option value="corretiva">Corretiva</option>
            <option value="preventiva">Preventiva</option>
            <option value="preditiva">Preditiva</option>
          </Select>
        </div>
        <Input label="Seu nome *" value={form.tecnico} onChange={e=>setForm(f=>({...f,tecnico:e.target.value}))} placeholder="Ex: Carlos Mendes"/>
        <div style={{marginBottom:14}}>
          <label style={s.label}>DESCRIÇÃO DO PROBLEMA</label>
          <textarea value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} rows={3} placeholder="Descreva o problema ou necessidade..." style={{...s.input,resize:"none"}}/>
        </div>
        <button onClick={submit} disabled={!form.peca||!form.equipamentoId||!form.tecnico}
          style={{...s.btn(form.peca&&form.equipamentoId&&form.tecnico,"#238636"),width:"100%",padding:13,fontSize:14}}>
          Abrir chamado →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TELA: COMPRADORA
// ─────────────────────────────────────────────
function TelaCompradora({chamados,setChamados,cotacoes,setCotacoes,fornecedores,equipamentos}){
  const [aba,setAba]=useState("cotacoes");
  const [search,setSearch]=useState("");
  const [filtro,setFiltro]=useState("todos");
  const [expandido,setExpandido]=useState(null);
  const [modalIniciar,setModalIniciar]=useState(null);
  const [modalEmail,setModalEmail]=useState(null);
  const [modalResposta,setModalResposta]=useState(null);
  const [modalFinalizar,setModalFinalizar]=useState(null);
  const [fornSel,setFornSel]=useState([]);
  const [respostaForm,setRespostaForm]=useState({valor:"",prazo:""});
  const [finalizarForm,setFinalizarForm]=useState({valorNegociado:"",aprovadoPor:""});

  const aguardando=chamados.filter(c=>c.status==="aguardando_cotacao");
  const semResposta=cotacoes.filter(c=>c.fornecedores.some(f=>f.status==="sem_resposta")).length;

  const enviarCotacao=()=>{
    const flist=fornecedores.filter(f=>fornSel.includes(f.id));
    const nova={id:Date.now(),chamadoId:modalIniciar.id,dataEnvio:new Date().toISOString().split("T")[0],status:"em_curso",
      fornecedores:flist.map(f=>({fornecedorId:f.id,nome:f.nome,email:f.email,status:"pendente",valor:null,prazo:null,dataResposta:null,token:`tok_${Math.random().toString(36).slice(2,9)}`}))};
    setCotacoes(prev=>[...prev,nova]);
    setChamados(prev=>prev.map(c=>c.id===modalIniciar.id?{...c,status:"cotando"}:c));
    setModalIniciar(null);
  };

  const registrarResposta=()=>{
    const {cotId,fornIdx}=modalResposta;
    const val=parseFloat(respostaForm.valor), prazo=parseInt(respostaForm.prazo);
    const frete=respostaForm.frete||"CIF";
    const valorFrete=frete==="FOB"?parseFloat(respostaForm.valorFrete||0):0;
    if(!val||!prazo)return;
    setCotacoes(prev=>prev.map(c=>{
      if(c.id!==cotId)return c;
      const fs=c.fornecedores.map((f,i)=>i!==fornIdx?f:{...f,status:"respondido",valor:val,prazo,frete,valorFrete,dataResposta:new Date().toISOString().split("T")[0]});
      return{...c,fornecedores:fs};
    }));
    setModalResposta(null);setRespostaForm({valor:"",prazo:"",frete:"CIF",valorFrete:""});
  };

  const confirmarFinalizar=()=>{
    const {cotId,melhor}=modalFinalizar;
    const cot=cotacoes.find(c=>c.id===cotId);
    if(!cot)return;
    const valNeg=finalizarForm.valorNegociado?parseFloat(finalizarForm.valorNegociado):null;
    const abertura=chamados.find(c=>c.id===cot.chamadoId)?.abertura;
    const leadTime=abertura?Math.max(1,Math.floor((new Date()-new Date(abertura))/86400000)):null;
    setCotacoes(prev=>prev.map(c=>c.id!==cotId?c:{...c,status:"finalizado"}));
    setChamados(prev=>prev.map(c=>c.id!==cot.chamadoId?c:{...c,status:"finalizado",valorAprovado:melhor.valor,valorNegociado:valNeg,fornecedorAprovado:melhor.nome,aprovadoPor:finalizarForm.aprovadoPor||"(não informado)",leadTime}));
    setModalFinalizar(null);setFinalizarForm({valorNegociado:"",aprovadoPor:""});
  };

  const cotsFiltered=cotacoes.filter(c=>{
    const ch=chamados.find(x=>x.id===c.chamadoId);
    const eq=equipamentos.find(e=>e.id===ch?.equipamentoId);
    const term=search.toLowerCase();
    const matchSearch=!term||ch?.peca.toLowerCase().includes(term)||ch?.numero?.toLowerCase().includes(term)||eq?.nome.toLowerCase().includes(term)||eq?.tag.toLowerCase().includes(term);
    const matchFiltro=filtro==="todos"||(filtro==="em_curso"&&c.status==="em_curso")||(filtro==="finalizado"&&c.status==="finalizado")||(filtro==="sem_resposta"&&c.fornecedores.some(f=>f.status==="sem_resposta"))||(filtro==="urgente"&&ch?.urgencia==="alta"&&c.status==="em_curso");
    return matchSearch&&matchFiltro;
  });

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 24px",display:"flex",gap:0,flexShrink:0}}>
        {[{id:"cotacoes",l:"Cotações"},{id:"aguardando",l:"Aguardando"}].map(t=>(
          <button key={t.id} onClick={()=>setAba(t.id)}
            style={{background:"transparent",border:"none",borderBottom:aba===t.id?`2px solid ${C.accent}`:"2px solid transparent",padding:"13px 20px",color:aba===t.id?C.text:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
            {t.l}{t.id==="aguardando"&&aguardando.length>0&&<span style={{marginLeft:6,background:"#ef4444",borderRadius:10,padding:"1px 6px",fontSize:10,color:"#fff"}}>{aguardando.length}</span>}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
        {aba==="cotacoes"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
              {[
                {l:"Em andamento",v:cotacoes.filter(c=>c.status==="em_curso").length,c:C.accent},
                {l:"Finalizados",v:cotacoes.filter(c=>c.status==="finalizado").length,c:C.success},
                {l:"Sem resposta",v:semResposta,c:"#ef4444"},
                {l:"Aguardando cotação",v:aguardando.length,c:"#f78500"},
              ].map(k=>(
                <div key={k.l} style={{...s.card,padding:"14px 18px",borderLeft:`3px solid ${k.c}`}}>
                  <div style={{fontSize:10,color:C.muted,letterSpacing:"0.07em",marginBottom:6}}>{k.l.toUpperCase()}</div>
                  <div style={{fontSize:26,fontWeight:700,color:k.c}}>{k.v}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por número, peça, equipamento..." style={{...s.input,width:300,marginBottom:0}}/>
              {["todos","em_curso","finalizado","urgente","sem_resposta"].map(f=>(
                <button key={f} onClick={()=>setFiltro(f)} style={{background:filtro===f?"#1e2a3f":"transparent",border:`1px solid ${filtro===f?C.accent:C.border}`,borderRadius:6,padding:"7px 14px",color:filtro===f?C.accent:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                  {{todos:"Todos",em_curso:"Em curso",finalizado:"Finalizados",urgente:"Urgentes",sem_resposta:"Sem resposta"}[f]}
                </button>
              ))}
            </div>
            <div style={{...s.card,overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"120px 2fr 1.2fr 60px 2fr 110px 100px 32px",padding:"10px 18px",background:C.bg,borderBottom:`1px solid ${C.border}`,fontSize:10,color:C.muted,letterSpacing:"0.08em"}}>
                <span>Nº COT.</span><span>PEÇA</span><span>EQUIPAMENTO</span><span>DIAS</span><span>STATUS</span><span>MENOR VALOR</span><span>PROCESSO</span><span></span>
              </div>
              {cotsFiltered.map(cot=>{
                const ch=chamados.find(c=>c.id===cot.chamadoId);
                const eq=equipamentos.find(e=>e.id===ch?.equipamentoId);
                if(!ch)return null;
                const menor=getMenor(cot.fornecedores);
                const melhor=cot.fornecedores.filter(f=>f.valor!=null).sort((a,b)=>a.valor-b.valor)[0];
                const dias=diasDesde(cot.dataEnvio);
                const exp=expandido===cot.id;
                return(
                  <div key={cot.id} style={{borderBottom:`1px solid ${C.border}22`}}>
                    <div onClick={()=>setExpandido(exp?null:cot.id)}
                      style={{display:"grid",gridTemplateColumns:"120px 2fr 1.2fr 60px 2fr 110px 100px 32px",padding:"12px 18px",cursor:"pointer",background:exp?"#151d2e":"transparent",alignItems:"center"}}
                      onMouseEnter={e=>!exp&&(e.currentTarget.style.background="#111927")}
                      onMouseLeave={e=>!exp&&(e.currentTarget.style.background="transparent")}>
                      <span style={{fontSize:11,color:C.accent,fontFamily:"'IBM Plex Mono',monospace"}}>{ch.numero}</span>
                      <div>
                        <div style={{display:"flex",gap:7,alignItems:"center"}}>
                          <span style={{width:6,height:6,borderRadius:"50%",background:urgCfg[ch.urgencia].c,flexShrink:0}}/>
                          <span style={{fontSize:13,color:C.text,fontWeight:500}}>{ch.peca}</span>
                        </div>
                        <div style={{fontSize:11,color:C.muted,paddingLeft:13,marginTop:2}}>{ch.tecnico}</div>
                      </div>
                      <div>
                        <div style={{fontSize:12,color:C.textSub}}>{eq?.nome||"—"}</div>
                        <div style={{fontSize:10,color:C.accent}}>{eq?.tag}</div>
                      </div>
                      <div style={{fontSize:13,fontWeight:700,color:dias>3?"#ef4444":dias>1?"#f59e0b":"#22c55e"}}>{dias}d</div>
                      <div style={{display:"flex",flexDirection:"column",gap:3}}>
                        {cot.fornecedores.map((f,i)=>(
                          <div key={i} style={{display:"flex",gap:6,alignItems:"center"}}>
                            <Badge cfg={fsCfg[f.status]}/>
                            {f.valor&&<span style={{fontSize:11,color:C.muted}}>{fmtBRL(f.valor)}</span>}
                          </div>
                        ))}
                      </div>
                      <div>{menor?<span style={{fontSize:14,fontWeight:700,color:C.success}}>{fmtBRL(menor)}</span>:<span style={{color:C.muted}}>—</span>}</div>
                      <span style={{fontSize:11,borderRadius:4,padding:"3px 8px",fontWeight:500,background:cot.status==="finalizado"?"#0f2f1a":"#0f1e35",color:cot.status==="finalizado"?C.success:C.accent,border:`1px solid ${cot.status==="finalizado"?C.success:C.accent}33`}}>
                        {cot.status==="finalizado"?"✓ Finalizado":"⏳ Em curso"}
                      </span>
                      <span style={{color:C.muted,fontSize:13,textAlign:"center"}}>{exp?"▲":"▼"}</span>
                    </div>
                    {exp&&(
                      <div style={{background:C.bg,borderTop:`1px solid ${C.border}22`,padding:"16px 18px 16px 30px"}}>
                        {melhor&&cot.status==="em_curso"&&(
                          <div style={{background:"#0f2f1a",border:`1px solid ${C.success}44`,borderRadius:8,padding:"10px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
                            <span>🏆</span>
                            <span style={{fontSize:13,color:C.success,fontWeight:600}}>{melhor.nome} — {fmtBRL(melhor.valor)} · {melhor.prazo}d úteis</span>
                            <button onClick={()=>{setModalFinalizar({cotId:cot.id,melhor});setFinalizarForm({valorNegociado:"",aprovadoPor:"Mariana Costa"});}}
                              style={{marginLeft:"auto",...s.btn(true,"#238636"),padding:"6px 16px",fontSize:12}}>
                              Aprovar e finalizar
                            </button>
                          </div>
                        )}
                        {cot.fornecedores.map((f,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",...s.card,padding:"10px 14px",marginBottom:6}}>
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              <Badge cfg={fsCfg[f.status]}/>
                              <span style={{fontSize:13,color:C.text}}>{f.nome}</span>
                              {f.dataResposta&&<span style={{fontSize:11,color:C.muted}}>Resp: {fmtD(f.dataResposta)}</span>}
                              {f.prazo&&<span style={{fontSize:11,color:C.muted}}>{f.prazo}d úteis</span>}
                            </div>
                            <div style={{display:"flex",gap:8,alignItems:"center"}}>
                              {f.valor?<span style={{fontSize:14,fontWeight:700,color:f.valor===menor?C.success:C.text}}>{fmtBRL(f.valor)}{f.valor===menor&&<span style={{fontSize:10,color:C.success}}> ◀</span>}</span>
                                :<span style={{fontSize:12,color:C.muted}}>Sem proposta</span>}
                              {f.status!=="respondido"&&(
                                <>
                                  <button onClick={()=>{setModalResposta({cotId:cot.id,fornIdx:i});setRespostaForm({valor:"",prazo:""}); }}
                                    style={{background:"#1e3a5f",border:`1px solid #3b82f644`,borderRadius:5,padding:"4px 10px",color:C.accent,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>+ Registrar</button>
                                  <button onClick={()=>setModalEmail({chamado:ch,fornecedor:f})}
                                    style={{background:"#2a1f0a",border:`1px solid #f59e0b44`,borderRadius:5,padding:"4px 10px",color:C.warn,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Ver e-mail</button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {cotsFiltered.length===0&&<div style={{padding:40,textAlign:"center",color:C.muted,fontSize:13}}>Nenhuma cotação encontrada</div>}
            </div>
            <div style={{marginTop:10,fontSize:11,color:C.muted,textAlign:"right"}}>{cotsFiltered.length} de {cotacoes.length} cotações</div>
          </>
        )}

        {aba==="aguardando"&&(
          <div>
            <div style={{fontSize:13,color:C.muted,marginBottom:16}}>Chamados sem cotação iniciada</div>
            {aguardando.length===0&&<div style={{...s.card,padding:40,textAlign:"center",color:C.muted,fontSize:13}}>✅ Nenhum chamado aguardando cotação</div>}
            {aguardando.map(c=>{
              const eq=equipamentos.find(e=>e.id===c.equipamentoId);
              return(
                <div key={c.id} style={{...s.card,padding:20,marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                        <span style={{fontSize:11,color:C.accent,fontFamily:"'IBM Plex Mono',monospace"}}>{c.numero}</span>
                        <span style={s.tag(urgCfg[c.urgencia].c)}>{urgCfg[c.urgencia].l.toUpperCase()}</span>
                        <span style={s.tag(catCfg[c.categoria]?.c)}>{catCfg[c.categoria]?.l}</span>
                      </div>
                      <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:4}}>{c.peca} {c.codigo&&<span style={{fontSize:12,color:C.muted}}>({c.codigo})</span>}</div>
                      <div style={{fontSize:13,color:C.textSub,marginBottom:4}}>{eq?.nome} · {eq?.tag}</div>
                      <div style={{fontSize:12,color:C.muted}}>Técnico: {c.tecnico} · {c.descricao}</div>
                    </div>
                    <button onClick={()=>{setFornSel(fornecedores.slice(0,2).map(f=>f.id));setModalIniciar(c);}} style={{...s.btn(true,"#238636"),marginLeft:20,whiteSpace:"nowrap",flexShrink:0}}>Iniciar cotação →</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL INICIAR */}
      {modalIniciar&&(
        <Modal title="Iniciar cotação" onClose={()=>setModalIniciar(null)} width={540}>
          <div style={{fontSize:13,color:C.muted,marginBottom:16}}>{modalIniciar.peca} · {equipamentos.find(e=>e.id===modalIniciar.equipamentoId)?.nome}</div>
          <div style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",marginBottom:10}}>SELECIONAR FORNECEDORES</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:20}}>
            {fornecedores.filter(f=>f.ativo!==false).map(f=>(
              <div key={f.id} onClick={()=>setFornSel(s=>s.includes(f.id)?s.filter(x=>x!==f.id):[...s,f.id])}
                style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:fornSel.includes(f.id)?"#1e3a5f":C.bg,border:`1px solid ${fornSel.includes(f.id)?C.accent:C.border}`,borderRadius:6,cursor:"pointer"}}>
                <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${fornSel.includes(f.id)?C.accent:C.border}`,background:fornSel.includes(f.id)?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {fornSel.includes(f.id)&&<span style={{fontSize:10,color:"#fff"}}>✓</span>}
                </div>
                <div style={{flex:1}}><div style={{fontSize:13,color:C.text}}>{f.nome}</div><div style={{fontSize:11,color:C.muted}}>{f.email}</div></div>
                {f.whatsapp&&<span style={{fontSize:10,color:"#22c55e"}}>WhatsApp</span>}
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={()=>setModalIniciar(null)} style={{...s.btn(false),padding:"8px 18px"}}>Cancelar</button>
            <button onClick={enviarCotacao} disabled={!fornSel.length} style={{...s.btn(fornSel.length>0),padding:"8px 20px"}}>Enviar para {fornSel.length} fornecedor{fornSel.length!==1?"es":""}</button>
          </div>
        </Modal>
      )}

      {/* MODAL FINALIZAR — com saving B e comprador */}
      {modalFinalizar&&(()=>{
        // Buscar histórico interno desse item
        const ch = chamados.find(c=>c.id===modalFinalizar.cotId||cotacoes.find(x=>x.id===modalFinalizar.cotId)?.chamadoId===c.id);
        const historico = chamados.filter(c=>c.status==="finalizado"&&c.valorAprovado&&c.codigo&&ch?.codigo&&c.codigo===ch.codigo&&c.id!==ch?.id).sort((a,b)=>new Date(b.abertura)-new Date(a.abertura)).slice(0,4);
        const precoAtual = parseFloat(finalizarForm.valorNegociado)||modalFinalizar.melhor?.valor||0;
        const ultimoPago = historico[0]?.custoTotalReal||historico[0]?.valorNegociado||historico[0]?.valorAprovado;
        const varVsUltimo = ultimoPago ? ((precoAtual-ultimoPago)/ultimoPago)*100 : null;
        return(
          <Modal title="Finalizar cotação" onClose={()=>setModalFinalizar(null)} width={480}>
            <div style={{background:"#0f2f1a",border:`1px solid ${C.success}44`,borderRadius:8,padding:"12px 16px",marginBottom:14}}>
              <div style={{fontSize:12,color:C.muted,marginBottom:4}}>MELHOR PROPOSTA RECEBIDA</div>
              <div style={{fontSize:20,fontWeight:700,color:C.success}}>{fmtBRL(modalFinalizar.melhor?.valor)}</div>
              <div style={{fontSize:12,color:C.textSub,marginTop:2}}>{modalFinalizar.melhor?.nome} · {modalFinalizar.melhor?.prazo}d úteis</div>
            </div>

            {/* Histórico inline */}
            {historico.length>0&&(
              <div style={{background:"#0f1e35",border:`1px solid ${C.accent}33`,borderRadius:8,padding:"12px 16px",marginBottom:14}}>
                <div style={{fontSize:11,color:C.accent,letterSpacing:"0.08em",marginBottom:8}}>📋 HISTÓRICO DESTE ITEM</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {historico.map((h,i)=>{
                    const pago=h.custoTotalReal||h.valorNegociado||h.valorAprovado;
                    const diff=((precoAtual-pago)/pago)*100;
                    return(
                      <div key={h.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{fontSize:12,color:C.textSub}}>{fmtD(h.abertura)} · {h.fornecedorAprovado}</div>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <span style={{fontSize:13,color:C.text,fontWeight:500}}>{fmtBRL(pago)}</span>
                          <span style={{fontSize:11,color:diff>10?"#ef4444":diff<-5?C.success:C.warn,fontWeight:600}}>
                            {diff>0?"+":""}{diff.toFixed(0)}% vs agora
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {varVsUltimo!==null&&(
                  <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`,fontSize:12,color:varVsUltimo>15?"#ef4444":varVsUltimo>5?C.warn:C.success,fontWeight:600}}>
                    {varVsUltimo>15 ? `⚠ Preço ${varVsUltimo.toFixed(0)}% acima da última compra — verifique se há alternativas`
                     :varVsUltimo>5 ? `↑ Leve alta de ${varVsUltimo.toFixed(0)}% vs última compra`
                     :varVsUltimo<-5 ? `↓ Preço ${Math.abs(varVsUltimo).toFixed(0)}% abaixo da última compra — boa compra!`
                     : `✓ Preço estável vs histórico (${varVsUltimo>0?"+":""}${varVsUltimo.toFixed(0)}%)`}
                  </div>
                )}
              </div>
            )}

            <div style={{marginBottom:14}}>
              <label style={s.label}>VALOR FINAL NEGOCIADO (R$)</label>
              <input type="number" value={finalizarForm.valorNegociado} onChange={e=>setFinalizarForm(f=>({...f,valorNegociado:e.target.value}))}
                placeholder={`Deixe em branco se igual a ${fmtBRL(modalFinalizar.melhor?.valor)}`} style={{...s.input,fontSize:15}}/>
              {finalizarForm.valorNegociado&&parseFloat(finalizarForm.valorNegociado)<(modalFinalizar.melhor?.valor||0)&&(
                <div style={{fontSize:12,color:C.saving,marginTop:5,background:`${C.saving}11`,borderRadius:5,padding:"5px 10px"}}>
                  💰 Saving de negociação: {fmtBRL((modalFinalizar.melhor?.valor||0)-parseFloat(finalizarForm.valorNegociado))}
                </div>
              )}
            </div>

            <div style={{marginBottom:20}}>
              <label style={s.label}>APROVADO POR (COMPRADOR)</label>
              <input value={finalizarForm.aprovadoPor} onChange={e=>setFinalizarForm(f=>({...f,aprovadoPor:e.target.value}))}
                placeholder="Nome do comprador responsável" style={s.input}/>
            </div>

            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setModalFinalizar(null)} style={{...s.btn(false),padding:"8px 18px"}}>Cancelar</button>
              <button onClick={confirmarFinalizar} style={{...s.btn(true,"#238636"),padding:"8px 20px"}}>Confirmar aprovação</button>
            </div>
          </Modal>
        );
      })()}

      {/* MODAL E-MAIL */}
      {modalEmail&&(
        <Modal title="E-mail de cotação" onClose={()=>setModalEmail(null)} width={560}>
          <div style={{fontSize:12,color:C.muted,marginBottom:10}}>Para: <span style={{color:C.accent}}>{modalEmail.fornecedor.email}</span></div>
          <pre style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:16,fontSize:12,color:C.text,whiteSpace:"pre-wrap",lineHeight:1.8,fontFamily:"'IBM Plex Mono',monospace"}}>
{`Assunto: Solicitação de Cotação - ${modalEmail.chamado.peca} [${modalEmail.chamado.numero}]

Prezado(a) ${modalEmail.fornecedor.nome},

Solicitamos cotação para o item abaixo:

  Peça / Item:  ${modalEmail.chamado.peca}
  Código:       ${modalEmail.chamado.codigo||"—"}
  Equipamento:  ${equipamentos.find(e=>e.id===modalEmail.chamado.equipamentoId)?.nome||"—"}
  Urgência:     ${urgCfg[modalEmail.chamado.urgencia]?.l}

Para enviar sua proposta, acesse:
👉 https://quotaflow.app/r/${modalEmail.fornecedor.token}

Aguardamos retorno em até 24 horas.

Atenciosamente,
Departamento de Compras`}
          </pre>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14}}>
            <button onClick={()=>setModalEmail(null)} style={{...s.btn(false),padding:"8px 18px"}}>Fechar</button>
            <button onClick={()=>{alert("E-mail reenviado!");setModalEmail(null);}} style={{background:"#2a1f0a",border:`1px solid ${C.warn}`,borderRadius:7,padding:"8px 18px",color:C.warn,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>↺ Reenviar</button>
          </div>
        </Modal>
      )}

      {/* MODAL RESPOSTA */}
      {modalResposta&&(
        <Modal title="Registrar resposta manual" onClose={()=>setModalResposta(null)} width={400}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><label style={s.label}>VALOR UNITÁRIO (R$) *</label><input type="number" value={respostaForm.valor} onChange={e=>setRespostaForm(f=>({...f,valor:e.target.value}))} placeholder="0,00" style={{...s.input,fontSize:16}}/></div>
            <div><label style={s.label}>PRAZO (DIAS ÚTEIS) *</label><input type="number" value={respostaForm.prazo} onChange={e=>setRespostaForm(f=>({...f,prazo:e.target.value}))} placeholder="Ex: 3" style={{...s.input,fontSize:16}}/></div>
          </div>
          {/* CIF / FOB */}
          <div style={{marginBottom:12}}>
            <label style={s.label}>MODALIDADE DE FRETE *</label>
            <div style={{display:"flex",gap:8}}>
              {["CIF","FOB"].map(op=>(
                <div key={op} onClick={()=>setRespostaForm(f=>({...f,frete:op,valorFrete:""}))}
                  style={{flex:1,padding:"10px",borderRadius:7,border:`1px solid ${(respostaForm.frete||"CIF")===op?C.accent:C.border}`,background:(respostaForm.frete||"CIF")===op?"#1e2a3f":C.bg,cursor:"pointer",textAlign:"center"}}>
                  <div style={{fontSize:13,fontWeight:700,color:(respostaForm.frete||"CIF")===op?C.accent:C.muted}}>{op}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:2}}>{op==="CIF"?"Frete incluso no preço":"Frete cobrado à parte"}</div>
                </div>
              ))}
            </div>
          </div>
          {(respostaForm.frete||"CIF")==="FOB"&&(
            <div style={{marginBottom:12}}>
              <label style={s.label}>VALOR DO FRETE (R$)</label>
              <input type="number" value={respostaForm.valorFrete} onChange={e=>setRespostaForm(f=>({...f,valorFrete:e.target.value}))} placeholder="0,00" style={{...s.input,fontSize:15}}/>
            </div>
          )}
          {/* Preview custo total */}
          {respostaForm.valor&&(
            <div style={{background:"#0f1e35",border:`1px solid ${C.accent}33`,borderRadius:7,padding:"10px 14px",marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:C.muted}}>Valor da peça</span>
                <span style={{color:C.text}}>{fmtBRL(parseFloat(respostaForm.valor))}</span>
              </div>
              {(respostaForm.frete||"CIF")==="FOB"&&respostaForm.valorFrete&&(
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginTop:4}}>
                  <span style={{color:C.muted}}>Frete FOB</span>
                  <span style={{color:C.warn}}>{fmtBRL(parseFloat(respostaForm.valorFrete||0))}</span>
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,marginTop:6,paddingTop:6,borderTop:`1px solid ${C.border}`}}>
                <span style={{color:C.text}}>Custo total</span>
                <span style={{color:C.success}}>{fmtBRL(parseFloat(respostaForm.valor||0)+parseFloat((respostaForm.frete||"CIF")==="FOB"?respostaForm.valorFrete||0:0))}</span>
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={()=>setModalResposta(null)} style={{...s.btn(false),padding:"8px 18px"}}>Cancelar</button>
            <button onClick={registrarResposta} disabled={!respostaForm.valor||!respostaForm.prazo} style={{...s.btn(respostaForm.valor&&respostaForm.prazo,"#238636"),padding:"8px 18px"}}>Confirmar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PORTAL FORNECEDOR — MULTI-ITEM
// ─────────────────────────────────────────────
// Mock de cotação com múltiplos itens — simula o que viria via link único
const MOCK_COTACAO_PORTAL = {
  ref: "COT-2026-0010",
  empresa: "Indústria Exemplo Ltda",
  comprador: "Mariana Costa",
  fornecedor: "Rolamentos Brasil",
  prazoResposta: "2026-03-18",
  token: "tok_portal_demo",
  itens: [
    { id:1, peca:"Rolamento SKF 6205",       codigo:"SKF-6205",    qtd:2, equipamento:"Compressor AR-03",    urgencia:"alta"  },
    { id:2, peca:"Mancal UCF205",             codigo:"UCF205",      qtd:1, equipamento:"Esteira TR-07",       urgencia:"alta"  },
    { id:3, peca:"Correia Dentada T5-600",    codigo:"T5-600-10",   qtd:3, equipamento:"Esteira TR-07",       urgencia:"baixa" },
    { id:4, peca:"Filtro Hidráulico 10µ",     codigo:"FH-10-G1",    qtd:2, equipamento:"Prensa HP-12",        urgencia:"media" },
    { id:5, peca:"Chave Fim de Curso WL",     codigo:"WL-CFC-01",   qtd:1, equipamento:"Transportador TC-04", urgencia:"media" },
  ],
};

function TelaFornecedorPortal() {
  const cot = MOCK_COTACAO_PORTAL;

  // Estado por item: valor, frete (CIF/FOB), grupo (null = individual)
  const [linhas, setLinhas] = useState(
    cot.itens.map(it => ({ id: it.id, valor:"", frete:"CIF", grupo: null, valorFreteInd:"" }))
  );
  // Grupos de frete: { id, nome, valorFrete }
  const [grupos, setGrupos] = useState([
    { id:"G1", nome:"Volume 1", valorFrete:"" },
  ]);
  const [prazoGeral, setPrazoGeral] = useState("");
  const [obs, setObs] = useState("");
  const [step, setStep] = useState("preencher"); // preencher | revisar | enviado

  const setLinha = (id, campo, val) =>
    setLinhas(prev => prev.map(l => l.id===id ? {...l, [campo]:val} : l));

  const addGrupo = () => {
    const ids = grupos.map(g=>parseInt(g.id.replace("G",""))||0);
    const next = Math.max(...ids,0)+1;
    setGrupos(prev=>[...prev,{id:`G${next}`,nome:`Volume ${next}`,valorFrete:""}]);
  };
  const removeGrupo = (gid) => {
    setGrupos(prev=>prev.filter(g=>g.id!==gid));
    setLinhas(prev=>prev.map(l=>l.grupo===gid?{...l,grupo:null}:l));
  };
  const setGrupoFrete = (gid, val) =>
    setGrupos(prev=>prev.map(g=>g.id===gid?{...g,valorFrete:val}:g));

  // Calcular frete rateado por item
  const freteRateado = (linha) => {
    if (linha.frete==="CIF") return 0;
    if (!linha.grupo) return parseFloat(linha.valorFreteInd||0); // FOB individual
    const grupo = grupos.find(g=>g.id===linha.grupo);
    if (!grupo?.valorFrete) return 0;
    const membros = linhas.filter(l=>l.grupo===linha.grupo&&l.valor);
    const totalGrupo = membros.reduce((s,l)=>s+parseFloat(l.valor||0),0);
    if (!totalGrupo) return 0;
    const proporcao = parseFloat(linha.valor||0)/totalGrupo;
    return parseFloat(grupo.valorFrete)*proporcao;
  };

  // Custo total por item
  const custoItem = (linha) => {
    const val = parseFloat(linha.valor||0);
    if (!val) return null;
    return val + freteRateado(linha);
  };

  // Validação: todos os itens com valor + prazo geral
  const linhasOK = linhas.filter(l=>l.valor);
  const podeRevisar = linhasOK.length===linhas.length && prazoGeral;

  // Totais para resumo
  const totalPecas = linhas.reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const totalFrete = grupos.reduce((s,g)=>s+parseFloat(g.valorFrete||0),0)
    + linhas.filter(l=>l.frete==="FOB"&&!l.grupo).reduce((s,l)=>s+parseFloat(l.valorFreteInd||0),0);
  const totalGeral = totalPecas + totalFrete;

  // ── TELA ENVIADO ──
  if (step==="enviado") return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100%",gap:20,padding:40}}>
      <div style={{fontSize:52}}>🎉</div>
      <div style={{fontSize:20,fontWeight:700,color:C.text}}>Proposta enviada com sucesso!</div>
      <div style={{...s.card,padding:"20px 28px",minWidth:320}}>
        <div style={{fontSize:11,color:C.muted,marginBottom:12,letterSpacing:"0.08em"}}>RESUMO — {cot.ref}</div>
        {cot.itens.map((it,i)=>{
          const l = linhas.find(l=>l.id===it.id);
          const ct = custoItem(l)||0;
          return(
            <div key={it.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}22`,fontSize:13}}>
              <span style={{color:C.textSub}}>{it.peca}</span>
              <span style={{color:C.success,fontWeight:600}}>{fmtBRL(ct)}</span>
            </div>
          );
        })}
        <div style={{display:"flex",justifyContent:"space-between",marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`,fontSize:15,fontWeight:700}}>
          <span style={{color:C.text}}>Total do pedido</span>
          <span style={{color:C.success}}>{fmtBRL(totalGeral)}</span>
        </div>
        <div style={{fontSize:12,color:C.muted,marginTop:8}}>Prazo: {prazoGeral} dias úteis</div>
      </div>
      <div style={{fontSize:13,color:C.muted,textAlign:"center",maxWidth:360}}>
        Um e-mail de confirmação foi enviado para você com todos os dados desta proposta.
      </div>
    </div>
  );

  // ── TELA REVISÃO ──
  if (step==="revisar") return (
    <div style={{maxWidth:620,margin:"0 auto",padding:"32px 20px",overflowY:"auto"}}>
      <div style={{...s.card,padding:"14px 20px",marginBottom:20,display:"flex",gap:10,alignItems:"center"}}>
        <div style={{width:4,height:28,background:C.success,borderRadius:2}}/>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:C.text}}>{cot.empresa} · {cot.ref}</div>
          <div style={{fontSize:11,color:C.muted}}>Revise sua proposta antes de enviar</div>
        </div>
      </div>

      <div style={{...s.card,overflow:"hidden",marginBottom:16}}>
        <div style={{padding:"12px 18px",borderBottom:`1px solid ${C.border}`,fontSize:11,color:C.muted,letterSpacing:"0.08em"}}>ITENS DA PROPOSTA</div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 80px 80px 80px 80px 100px",padding:"9px 18px",background:C.bg,borderBottom:`1px solid ${C.border}`,fontSize:10,color:C.muted,letterSpacing:"0.07em"}}>
          <span>ITEM</span><span>QTD</span><span>VL UNIT.</span><span>FRETE</span><span>GRUPO</span><span style={{textAlign:"right"}}>CUSTO TOTAL</span>
        </div>
        {cot.itens.map((it,i)=>{
          const l = linhas.find(l=>l.id===it.id);
          const fr = freteRateado(l);
          const ct = custoItem(l);
          const g = grupos.find(g=>g.id===l.grupo);
          return(
            <div key={it.id} style={{display:"grid",gridTemplateColumns:"2fr 80px 80px 80px 80px 100px",padding:"11px 18px",borderBottom:i<cot.itens.length-1?`1px solid ${C.border}22`:"none",alignItems:"center"}}>
              <div>
                <div style={{fontSize:13,color:C.text,fontWeight:500}}>{it.peca}</div>
                <div style={{fontSize:10,color:C.muted}}>{it.codigo}</div>
              </div>
              <span style={{fontSize:12,color:C.textSub}}>{it.qtd}x</span>
              <span style={{fontSize:13,color:C.text,fontWeight:600}}>{fmtBRL(parseFloat(l.valor))}</span>
              <span style={{...s.tag(l.frete==="CIF"?C.success:C.warn),fontSize:9}}>{l.frete}</span>
              <span style={{fontSize:11,color:C.muted}}>{g?g.nome:l.frete==="FOB"?`Individual${l.valorFreteInd?` (${fmtBRL(parseFloat(l.valorFreteInd))})`:""}`:"—"}</span>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:14,fontWeight:700,color:C.success}}>{fmtBRL(ct)}</div>
                {fr>0&&<div style={{fontSize:10,color:C.muted}}>+{fmtBRL(fr)} frete</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Totais */}
      <div style={{...s.card,padding:"16px 20px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}>
          <span style={{color:C.textSub}}>Subtotal peças</span>
          <span style={{color:C.text}}>{fmtBRL(totalPecas)}</span>
        </div>
        {grupos.filter(g=>g.valorFrete).map(g=>(
          <div key={g.id} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}>
            <span style={{color:C.textSub}}>Frete {g.nome}</span>
            <span style={{color:C.warn}}>{fmtBRL(parseFloat(g.valorFrete))}</span>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:700,paddingTop:10,marginTop:6,borderTop:`1px solid ${C.border}`}}>
          <span style={{color:C.text}}>Total do pedido</span>
          <span style={{color:C.success}}>{fmtBRL(totalGeral)}</span>
        </div>
        <div style={{fontSize:12,color:C.muted,marginTop:6}}>Prazo: {prazoGeral} dias úteis</div>
      </div>

      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>setStep("preencher")} style={{...s.btn(true),flex:1,background:C.surface,color:C.textSub}}>← Editar</button>
        <button onClick={()=>setStep("enviado")} style={{...s.btn(true,"#238636"),flex:2,padding:14,fontSize:15}}>✓ Confirmar e enviar proposta</button>
      </div>
      <div style={{fontSize:11,color:C.muted,textAlign:"center",marginTop:10}}>Sua proposta é confidencial. Outros fornecedores não têm acesso aos seus valores.</div>
    </div>
  );

  // ── TELA PRINCIPAL — PREENCHIMENTO ──
  return (
    <div style={{maxWidth:760,margin:"0 auto",padding:"28px 20px",overflowY:"auto"}}>
      {/* Header */}
      <div style={{...s.card,padding:"14px 20px",marginBottom:16,display:"flex",gap:10,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{width:4,height:28,background:C.success,borderRadius:2}}/>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.text}}>{cot.empresa}</div>
            <div style={{fontSize:11,color:C.muted}}>Cotação {cot.ref} · Responder até {fmtD(cot.prazoResposta)}</div>
          </div>
        </div>
        <span style={{...s.tag(urgCfg["alta"].c),fontSize:10}}>{cot.itens.filter(i=>i.urgencia==="alta").length} item(ns) urgente(s)</span>
      </div>

      {/* Instrução */}
      <div style={{background:"#0f1e35",border:`1px solid ${C.accent}33`,borderRadius:8,padding:"12px 16px",marginBottom:16,fontSize:12,color:C.textSub,lineHeight:1.8}}>
        <span style={{color:C.accent,fontWeight:600}}>ℹ Instruções de preenchimento: </span>
        Para cada item informe o valor unitário e a modalidade de frete.
        <strong style={{color:C.text}}> CIF</strong> = frete incluso no preço.
        <strong style={{color:C.text}}> FOB</strong> = frete cobrado à parte.
        Se múltiplos itens compartilham o mesmo volume de entrega, agrupe-os e informe o frete do grupo — o sistema rateia automaticamente pelo valor de cada item.
      </div>

      {/* Tabela de itens */}
      <div style={{...s.card,overflow:"hidden",marginBottom:14}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,fontSize:11,color:C.muted,letterSpacing:"0.08em"}}>
          ITENS SOLICITADOS — {cot.itens.length} SKU(s)
        </div>
        {/* Header */}
        <div style={{display:"grid",gridTemplateColumns:"2fr 50px 120px 130px 160px 110px",padding:"9px 16px",background:C.bg,borderBottom:`1px solid ${C.border}`,fontSize:10,color:C.muted,letterSpacing:"0.07em",gap:8}}>
          <span>ITEM / CÓDIGO</span><span>QTD</span><span>VALOR UNIT. (R$)</span><span>MODALIDADE</span><span>GRUPO DE FRETE</span><span style={{textAlign:"right"}}>CUSTO TOTAL</span>
        </div>
        {cot.itens.map((it,i)=>{
          const l = linhas.find(l=>l.id===it.id);
          const ct = custoItem(l);
          const fr = freteRateado(l);
          return(
            <div key={it.id} style={{display:"grid",gridTemplateColumns:"2fr 50px 120px 130px 160px 110px",padding:"12px 16px",borderBottom:i<cot.itens.length-1?`1px solid ${C.border}22`:"none",alignItems:"center",gap:8,background:l.valor?"transparent":"#0d111a"}}>
              {/* Item */}
              <div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{...s.tag(urgCfg[it.urgencia].c),fontSize:9}}>{urgCfg[it.urgencia].l}</span>
                  <span style={{fontSize:13,color:C.text,fontWeight:500}}>{it.peca}</span>
                </div>
                <div style={{fontSize:10,color:C.accent,marginTop:2,fontFamily:"'IBM Plex Mono',monospace"}}>{it.codigo} · {it.equipamento}</div>
              </div>
              {/* Qtd */}
              <span style={{fontSize:13,color:C.textSub,fontWeight:600}}>{it.qtd}x</span>
              {/* Valor */}
              <input type="number" value={l.valor} onChange={e=>setLinha(it.id,"valor",e.target.value)}
                placeholder="0,00"
                style={{...s.input,fontSize:14,fontWeight:600,padding:"7px 10px",
                  border:`1px solid ${l.valor?C.success:C.border}`,
                  background:l.valor?"#0f2f1a":C.bg}}/>
              {/* CIF / FOB toggle */}
              <div style={{display:"flex",gap:4}}>
                {["CIF","FOB"].map(op=>(
                  <div key={op} onClick={()=>setLinha(it.id,"frete",op)}
                    style={{flex:1,padding:"6px 4px",borderRadius:6,border:`1px solid ${l.frete===op?(op==="CIF"?C.success:C.warn):C.border}`,background:l.frete===op?(op==="CIF"?"#0f2f1a":"#3f2a0a"):C.bg,cursor:"pointer",textAlign:"center",transition:"all .1s"}}>
                    <div style={{fontSize:12,fontWeight:700,color:l.frete===op?(op==="CIF"?C.success:C.warn):C.muted}}>{op}</div>
                    <div style={{fontSize:9,color:C.muted}}>{op==="CIF"?"incluso":"à parte"}</div>
                  </div>
                ))}
              </div>
              {/* Grupo de frete */}
              <div>
                {l.frete==="FOB" ? (
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    <select value={l.grupo||""} onChange={e=>setLinha(it.id,"grupo",e.target.value||null)}
                      style={{...s.input,padding:"7px 8px",fontSize:12,appearance:"none"}}>
                      <option value="">Individual</option>
                      {grupos.map(g=><option key={g.id} value={g.id}>{g.nome}</option>)}
                    </select>
                    {/* Campo frete individual — só aparece quando FOB + Individual */}
                    {!l.grupo&&(
                      <input type="number" value={l.valorFreteInd}
                        onChange={e=>setLinha(it.id,"valorFreteInd",e.target.value)}
                        placeholder="Frete R$ 0,00"
                        style={{...s.input,padding:"6px 8px",fontSize:12,
                          border:`1px solid ${l.valorFreteInd?C.warn:C.border}`,
                          background:l.valorFreteInd?"#3f2a0a":C.bg}}/>
                    )}
                  </div>
                ) : (
                  <span style={{fontSize:11,color:C.muted}}>— (CIF incluso)</span>
                )}
              </div>
              {/* Custo total */}
              <div style={{textAlign:"right"}}>
                {ct!=null ? (
                  <>
                    <div style={{fontSize:14,fontWeight:700,color:C.success}}>{fmtBRL(ct)}</div>
                    {fr>0&&<div style={{fontSize:10,color:C.muted}}>+{fmtBRL(fr)} frete</div>}
                  </>
                ) : (
                  <span style={{fontSize:12,color:C.border}}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grupos de frete */}
      <div style={{...s.card,padding:"16px 18px",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontSize:11,color:C.muted,letterSpacing:"0.08em"}}>🚚 GRUPOS DE FRETE (FOB)</div>
          <button onClick={addGrupo} style={{background:"#1e2a3f",border:`1px solid ${C.accent}`,borderRadius:6,padding:"5px 12px",color:C.accent,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
            + Adicionar grupo
          </button>
        </div>
        {grupos.length===0&&<div style={{fontSize:12,color:C.muted}}>Nenhum grupo criado. Crie grupos para ratear o frete entre itens do mesmo volume.</div>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {grupos.map(g=>{
            const membros = linhas.filter(l=>l.grupo===g.id);
            const totalMembros = membros.reduce((s,l)=>s+parseFloat(l.valor||0),0);
            return(
              <div key={g.id} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px"}}>
                <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:C.warn,flexShrink:0}}/>
                  <span style={{fontSize:13,fontWeight:600,color:C.text,minWidth:80}}>{g.nome}</span>
                  {/* Itens do grupo */}
                  <div style={{flex:1,display:"flex",gap:4,flexWrap:"wrap"}}>
                    {membros.length===0
                      ? <span style={{fontSize:11,color:C.muted}}>Nenhum item — selecione "Grupo" na linha do item</span>
                      : membros.map(l=>{
                          const it=cot.itens.find(i=>i.id===l.id);
                          return <span key={l.id} style={{...s.tag(C.warn),fontSize:9}}>{it?.codigo}</span>;
                        })
                    }
                  </div>
                  {/* Valor do frete */}
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    <span style={{fontSize:11,color:C.muted}}>Frete total:</span>
                    <input type="number" value={g.valorFrete} onChange={e=>setGrupoFrete(g.id,e.target.value)}
                      placeholder="R$ 0,00" style={{...s.input,width:100,padding:"5px 8px",fontSize:13}}/>
                    {totalMembros>0&&g.valorFrete&&(
                      <span style={{fontSize:10,color:C.muted,whiteSpace:"nowrap"}}>
                        {((parseFloat(g.valorFrete)/totalMembros)*100).toFixed(0)}% do subtotal
                      </span>
                    )}
                  </div>
                  <button onClick={()=>removeGrupo(g.id)} style={{background:"transparent",border:"none",color:"#ef4444",fontSize:14,cursor:"pointer",flexShrink:0}}>✕</button>
                </div>
                {/* Rateio preview */}
                {membros.length>0&&g.valorFrete&&totalMembros>0&&(
                  <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}22`,display:"flex",gap:12,flexWrap:"wrap"}}>
                    {membros.map(l=>{
                      const it=cot.itens.find(i=>i.id===l.id);
                      const prop=parseFloat(l.valor||0)/totalMembros;
                      const frItem=parseFloat(g.valorFrete)*prop;
                      return(
                        <div key={l.id} style={{fontSize:11,color:C.muted}}>
                          <span style={{color:C.textSub}}>{it?.codigo}</span>: {fmtBRL(frItem)} ({(prop*100).toFixed(0)}%)
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Prazo geral + obs */}
      <div style={{...s.card,padding:"16px 18px",marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:14}}>
          <div>
            <label style={s.label}>PRAZO DE ENTREGA (DIAS ÚTEIS) *</label>
            <input type="number" value={prazoGeral} onChange={e=>setPrazoGeral(e.target.value)}
              placeholder="Ex: 3" style={{...s.input,fontSize:16,fontWeight:600}}/>
            <div style={{fontSize:11,color:C.muted,marginTop:4}}>Prazo único para todos os itens</div>
          </div>
          <div>
            <label style={s.label}>OBSERVAÇÕES GERAIS (OPCIONAL)</label>
            <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2}
              placeholder="Condições de pagamento, validade da proposta, marcas alternativas..."
              style={{...s.input,resize:"none"}}/>
          </div>
        </div>
      </div>

      {/* Totalizador e botão */}
      <div style={{...s.card,padding:"16px 20px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
          <div><div style={{fontSize:10,color:C.muted,marginBottom:2}}>SUBTOTAL PEÇAS</div><div style={{fontSize:16,fontWeight:700,color:C.text}}>{fmtBRL(totalPecas)}</div></div>
          <div><div style={{fontSize:10,color:C.muted,marginBottom:2}}>TOTAL FRETE</div><div style={{fontSize:16,fontWeight:700,color:C.warn}}>{fmtBRL(totalFrete)}</div></div>
          <div style={{borderLeft:`1px solid ${C.border}`,paddingLeft:24}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:2}}>TOTAL DO PEDIDO</div>
            <div style={{fontSize:20,fontWeight:700,color:C.success}}>{fmtBRL(totalGeral)}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{fontSize:12,color:C.muted,textAlign:"right"}}>
            {linhasOK.length}/{linhas.length} itens preenchidos
            {!prazoGeral&&" · prazo obrigatório"}
          </div>
          <button onClick={()=>podeRevisar&&setStep("revisar")} disabled={!podeRevisar}
            style={{...s.btn(podeRevisar,"#238636"),padding:"10px 24px",fontSize:14,whiteSpace:"nowrap"}}>
            Revisar proposta →
          </button>
        </div>
      </div>
      <div style={{fontSize:11,color:C.muted,textAlign:"center"}}>Sua proposta é confidencial. Outros fornecedores não têm acesso aos seus valores.</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CUSTO TOTAL (peça + frete)
// ─────────────────────────────────────────────
const custoTotal = f => (f.valor||0) + (f.valorFrete||0);
const getMenorTotal = fs => { const vs=fs.filter(f=>f.valor!=null).map(f=>custoTotal(f)); return vs.length?Math.min(...vs):null; };

// ─────────────────────────────────────────────
// TELA: BENCHMARK DE MERCADO
// ─────────────────────────────────────────────

// Dados simulados de rede (o que viria do backend quando tiver N clientes)
// Representa preços de outras empresas anonimizados — mínimo 5 por item
const BENCHMARK_REDE = [
  { codigo:"SKF-6205",     peca:"Rolamento SKF 6205",         amostras:47, mediana:71.0,  minimo:52.0,  maximo:98.0,  regiao:"SP", categoriaItem:"rolamentos",    tipoDisponib:"prateleira" },
  { codigo:"FH-10-G1",     peca:"Filtro Hidráulico 10µ",      amostras:31, mediana:89.5,  minimo:74.0,  maximo:128.0, regiao:"SP", categoriaItem:"filtros",        tipoDisponib:"prateleira" },
  { codigo:"OIL-80W90-20", peca:"Óleo Câmbio 80W90 (20L)",    amostras:62, mediana:162.0, minimo:138.0, maximo:198.0, regiao:"SP", categoriaItem:"lubrificantes",  tipoDisponib:"prateleira" },
  { codigo:"T5-600-10",    peca:"Correia Dentada T5-600",      amostras:18, mediana:36.0,  minimo:28.0,  maximo:49.0,  regiao:"SP", categoriaItem:"transmissão",   tipoDisponib:"prateleira" },
  { codigo:"UCF205",       peca:"Mancal de Rolamento UCF205",  amostras:23, mediana:118.0, minimo:95.0,  maximo:155.0, regiao:"SP", categoriaItem:"rolamentos",    tipoDisponib:"prateleira" },
  { codigo:"WL-CFC-01",    peca:"Chave Fim de Curso WL",       amostras:12, mediana:58.5,  minimo:44.0,  maximo:79.0,  regiao:"SP", categoriaItem:"elétrica",      tipoDisponib:"prateleira" },
];

const catItemCfg = {
  rolamentos:    { c:"#60a5fa", icon:"⚙" },
  filtros:       { c:"#34d399", icon:"🔵" },
  lubrificantes: { c:"#fbbf24", icon:"🟡" },
  transmissão:   { c:"#a78bfa", icon:"🔗" },
  elétrica:      { c:"#f87171", icon:"⚡" },
  pneumático:    { c:"#38bdf8", icon:"💨" },
  instrumentação:{ c:"#fb923c", icon:"📡" },
  automação:     { c:"#c084fc", icon:"🤖" },
};

function TelaBenchmark({ chamados, participaBench, setParticipaBench }) {
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  const finalizados = chamados.filter(c => c.status === "finalizado" && c.valorAprovado && c.participaBench !== false);

  // Cruzar dados internos com benchmark de rede
  const itensCruzados = finalizados.map(ch => {
    const bench = BENCHMARK_REDE.find(b => b.codigo === ch.codigo);
    const pago = ch.custoTotalReal ?? ch.valorNegociado ?? ch.valorAprovado;
    const diffPct = bench ? ((pago - bench.mediana) / bench.mediana) * 100 : null;
    return { ...ch, pago, bench, diffPct };
  }).filter(c => c.bench); // só os que têm referência de mercado

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
    <div style={{ padding:"22px 24px", overflowY:"auto", height:"100%" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:22, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", marginBottom:4 }}>BENCHMARK COLABORATIVO</div>
          <div style={{ fontSize:22, fontWeight:700, color:C.text }}>Índice de Preços de Mercado</div>
          <div style={{ fontSize:13, color:C.muted, marginTop:4 }}>Preços medianos anonimizados da rede QuotaFlow · Mínimo 5 empresas por item</div>
        </div>
        {/* Opt-in toggle */}
        <div style={{ ...s.card, padding:"14px 18px", display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:C.text }}>Participar do benchmark</div>
            <div style={{ fontSize:11, color:C.muted }}>Seus dados contribuem anonimamente</div>
          </div>
          <div onClick={() => setParticipaBench(!participaBench)}
            style={{ width:44, height:24, borderRadius:12, background: participaBench ? C.success : C.border, cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}>
            <div style={{ width:18, height:18, borderRadius:"50%", background:"#fff", position:"absolute", top:3, left: participaBench ? 23 : 3, transition:"left .2s" }}/>
          </div>
        </div>
      </div>

      {/* Como funciona */}
      <div style={{ ...s.card, padding:"16px 20px", marginBottom:20, background:"linear-gradient(135deg,#0f1e35,#111722)", border:`1px solid ${C.accent}33` }}>
        <div style={{ fontSize:11, color:C.accent, letterSpacing:"0.1em", marginBottom:10 }}>ℹ COMO FUNCIONA O BENCHMARK COLABORATIVO</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
          {[
            { icon:"🔒", title:"100% anônimo", desc:"Nenhuma empresa é identificada. O sistema exibe apenas mediana, mínimo e máximo da rede — sem revelar quem comprou o quê." },
            { icon:"📊", title:"Mínimo 5 empresas", desc:"Um item só aparece no benchmark quando ao menos 5 empresas diferentes registraram compras dele. Sem isso, não há dado suficiente para anonimato." },
            { icon:"🤝", title:"Quanto mais, melhor", desc:"Cada empresa que participa torna o índice mais preciso. Quem contribui recebe o benchmark gratuitamente. É um modelo de valor compartilhado." },
          ].map(c => (
            <div key={c.title} style={{ display:"flex", gap:10 }}>
              <span style={{ fontSize:20, flexShrink:0 }}>{c.icon}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:3 }}>{c.title}</div>
                <div style={{ fontSize:11, color:C.muted, lineHeight:1.6 }}>{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs de posicionamento */}
      {itensCruzados.length > 0 && (
        <>
          <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", marginBottom:10 }}>SUA POSIÇÃO VS MERCADO</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
            {[
              { l:"Itens com referência de mercado", v:itensCruzados.length, c:C.accent },
              { l:"Acima da mediana de mercado", v:acimaMercado.length, c:"#ef4444" },
              { l:"Dentro da faixa normal", v:naMedia.length, c:C.success },
              { l:"Potencial de economia", v:fmtBRL(potencialEconomia), c:"#a78bfa" },
            ].map(k => (
              <div key={k.l} style={{ ...s.card, padding:"14px 18px", borderLeft:`3px solid ${k.c}` }}>
                <div style={{ fontSize:10, color:C.muted, letterSpacing:"0.07em", marginBottom:6 }}>{k.l.toUpperCase()}</div>
                <div style={{ fontSize:22, fontWeight:700, color:k.c }}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Comparativo seus preços vs mercado */}
          <div style={{ ...s.card, overflow:"hidden", marginBottom:20 }}>
            <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}`, fontSize:11, color:C.muted, letterSpacing:"0.08em" }}>
              SUAS ÚLTIMAS COMPRAS × MEDIANA DE MERCADO
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"120px 2fr 90px 100px 100px 110px 100px", padding:"10px 20px", background:C.bg, borderBottom:`1px solid ${C.border}`, fontSize:10, color:C.muted, letterSpacing:"0.08em" }}>
              <span>CÓDIGO</span><span>ITEM</span><span>CATEGORIA</span><span>VOCÊ PAGOU</span><span>MEDIANA REDE</span><span>AMOSTRAS REDE</span><span>POSIÇÃO</span>
            </div>
            {itensCruzados.map((c, i) => {
              const catCfgItem = catItemCfg[c.categoriaItem] || { c: C.muted, icon: "•" };
              const pos = c.diffPct > 10 ? { l:"Acima", c:"#ef4444", bg:"#3f0f0f" }
                : c.diffPct < -5 ? { l:"Abaixo", c:C.success, bg:"#0f2f1a" }
                : { l:"Na média", c:C.warn, bg:"#3f2a0a" };
              return (
                <div key={c.id} style={{ display:"grid", gridTemplateColumns:"120px 2fr 90px 100px 100px 110px 100px", padding:"12px 20px", borderBottom: i < itensCruzados.length-1 ? `1px solid ${C.border}22` : "none", alignItems:"center" }}>
                  <span style={{ fontSize:11, color:C.accent, fontFamily:"'IBM Plex Mono',monospace" }}>{c.codigo}</span>
                  <div>
                    <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{c.peca}</div>
                    <div style={{ fontSize:10, color:C.muted }}>{c.numero}</div>
                  </div>
                  <span style={{ ...s.tag(catCfgItem.c) }}>{catCfgItem.icon} {c.categoriaItem}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{fmtBRL(c.pago)}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:C.accent }}>{fmtBRL(c.bench.mediana)}</span>
                  <div>
                    <div style={{ fontSize:11, color:C.muted }}>{c.bench.amostras} empresas</div>
                    <div style={{ fontSize:10, color:C.muted }}>{fmtBRL(c.bench.minimo)} – {fmtBRL(c.bench.maximo)}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:11, background:pos.bg, color:pos.c, border:`1px solid ${pos.c}44`, borderRadius:4, padding:"2px 8px", fontWeight:600 }}>{pos.l}</span>
                    {c.diffPct !== null && (
                      <span style={{ fontSize:11, color: c.diffPct > 0 ? "#ef4444" : C.success, fontWeight:600 }}>
                        {c.diffPct > 0 ? "+" : ""}{c.diffPct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Alerta de oportunidade */}
          {acimaMercado.length > 0 && (
            <div style={{ ...s.card, padding:"16px 20px", marginBottom:20, border:`1px solid #ef444444`, background:"#1a0808" }}>
              <div style={{ fontSize:11, color:"#ef4444", letterSpacing:"0.1em", marginBottom:10 }}>⚠ OPORTUNIDADES DE REDUÇÃO DE CUSTO</div>
              {acimaMercado.map(c => (
                <div key={c.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:`1px solid #ef444422` }}>
                  <div>
                    <span style={{ fontSize:13, color:C.text, fontWeight:500 }}>{c.peca}</span>
                    <span style={{ fontSize:11, color:C.muted, marginLeft:10 }}>Você pagou {fmtBRL(c.pago)} · Mediana {fmtBRL(c.bench.mediana)}</span>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"#ef4444" }}>+{c.diffPct?.toFixed(0)}% acima</div>
                    <div style={{ fontSize:11, color:C.muted }}>Potencial: economizar {fmtBRL(c.pago - c.bench.mediana)}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop:12, fontSize:12, color:C.muted }}>
                💡 Dica: inclua mais fornecedores nas próximas cotações desses itens para pressionar o preço.
              </div>
            </div>
          )}
        </>
      )}

      {/* Índice completo da rede */}
      <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", marginBottom:12 }}>ÍNDICE DE PREÇOS DA REDE QUOTAFLOW</div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        {["todos","prateleira","encomenda","importado"].map(t => (
          <button key={t} onClick={() => setFiltroTipo(t)}
            style={{ background: filtroTipo===t?"#1e2a3f":"transparent", border:`1px solid ${filtroTipo===t?C.accent:C.border}`, borderRadius:6, padding:"6px 14px", color: filtroTipo===t?C.accent:C.muted, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
            {{ todos:"Todos", prateleira:"🛒 Prateleira", encomenda:"📦 Encomenda", importado:"✈ Importado" }[t]}
          </button>
        ))}
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
          style={{ ...s.input, width:"auto", padding:"6px 12px", fontSize:12, marginBottom:0 }}>
          <option value="todas">Todas as categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ ...s.card, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"130px 2fr 100px 60px 110px 110px 110px 80px", padding:"10px 20px", background:C.bg, borderBottom:`1px solid ${C.border}`, fontSize:10, color:C.muted, letterSpacing:"0.08em" }}>
          <span>CÓDIGO</span><span>ITEM</span><span>CATEGORIA</span><span>TIPO</span><span>MÍNIMO</span><span>MEDIANA</span><span>MÁXIMO</span><span>AMOSTRAS</span>
        </div>
        {filtrados.map((b, i) => {
          const catCfgItem = catItemCfg[b.categoriaItem] || { c:C.muted, icon:"•" };
          const amplitude = b.maximo - b.minimo;
          const meuItem = itensCruzados.find(c => c.codigo === b.codigo);
          return (
            <div key={b.codigo} style={{ borderBottom: i < filtrados.length-1 ? `1px solid ${C.border}22` : "none" }}>
              <div style={{ display:"grid", gridTemplateColumns:"130px 2fr 100px 60px 110px 110px 110px 80px", padding:"13px 20px", alignItems:"center" }}>
                <span style={{ fontSize:11, color:C.accent, fontFamily:"'IBM Plex Mono',monospace" }}>{b.codigo}</span>
                <div>
                  <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{b.peca}</div>
                  {meuItem && (
                    <div style={{ fontSize:10, marginTop:2 }}>
                      <span style={{ color:C.muted }}>Você: </span>
                      <span style={{ color: meuItem.diffPct > 10 ? "#ef4444" : meuItem.diffPct < -5 ? C.success : C.warn, fontWeight:600 }}>
                        {fmtBRL(meuItem.pago)} ({meuItem.diffPct > 0 ? "+" : ""}{meuItem.diffPct?.toFixed(0)}%)
                      </span>
                    </div>
                  )}
                </div>
                <span style={{ ...s.tag(catCfgItem.c) }}>{catCfgItem.icon} {b.categoriaItem}</span>
                <span style={{ ...s.tag(b.tipoDisponib==="prateleira"?C.success:b.tipoDisponib==="importado"?"#f87171":C.warn), fontSize:9 }}>
                  {b.tipoDisponib}
                </span>
                <span style={{ fontSize:12, color:C.success }}>{fmtBRL(b.minimo)}</span>
                <div>
                  <span style={{ fontSize:14, fontWeight:700, color:C.accent }}>{fmtBRL(b.mediana)}</span>
                  {/* Barra de amplitude */}
                  <div style={{ marginTop:4, height:3, background:C.border, borderRadius:2, position:"relative", width:80 }}>
                    <div style={{ position:"absolute", left:`${((b.mediana-b.minimo)/amplitude)*100}%`, width:6, height:6, borderRadius:"50%", background:C.accent, top:-1.5 }}/>
                  </div>
                </div>
                <span style={{ fontSize:12, color:"#ef4444" }}>{fmtBRL(b.maximo)}</span>
                <div style={{ fontSize:11, color:C.muted }}>
                  <div>{b.amostras} empresas</div>
                  <div style={{ fontSize:9, marginTop:1 }}>anônimas</div>
                </div>
              </div>
            </div>
          );
        })}
        {filtrados.length === 0 && (
          <div style={{ padding:32, textAlign:"center", color:C.muted, fontSize:13 }}>Nenhum item encontrado com esses filtros</div>
        )}
      </div>

      {/* Itens sem benchmark ainda */}
      {(() => {
        const semBench = finalizados.filter(c => !BENCHMARK_REDE.find(b => b.codigo === c.codigo));
        if (!semBench.length) return null;
        return (
          <div style={{ ...s.card, padding:"16px 20px", marginTop:16, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em", marginBottom:10 }}>⏳ AGUARDANDO DADOS DA REDE</div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>Estes itens ainda não têm amostras suficientes de outras empresas (mínimo 5). Quanto mais clientes usarem o QuotaFlow, mais itens terão referência de mercado.</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {semBench.map(c => (
                <span key={c.id} style={{ ...s.tag(C.muted) }}>{c.codigo} · {c.peca}</span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Estrutura de dados — transparência para o desenvolvedor */}
      <div style={{ ...s.card, padding:"16px 20px", marginTop:16, border:`1px solid #7c3aed33`, background:"#0f0d1a" }}>
        <div style={{ fontSize:11, color:"#a78bfa", letterSpacing:"0.1em", marginBottom:10 }}>🏗 ESTRUTURA DE DADOS PARA BENCHMARK (REFERÊNCIA TÉCNICA)</div>
        <div style={{ fontSize:11, color:C.muted, lineHeight:1.8, fontFamily:"'IBM Plex Mono',monospace" }}>
          <div>Campos gravados em cada transação finalizada:</div>
          <div style={{ marginTop:8, paddingLeft:16, color:C.textSub }}>
            <div><span style={{ color:"#60a5fa" }}>codigo</span>          → chave de deduplicação entre empresas</div>
            <div><span style={{ color:"#60a5fa" }}>categoriaItem</span>   → agrupamento por família de produto</div>
            <div><span style={{ color:"#60a5fa" }}>tipoDisponib</span>    → prateleira | encomenda | importado</div>
            <div><span style={{ color:"#60a5fa" }}>custoTotalReal</span>  → valor pago + frete (custo verdadeiro)</div>
            <div><span style={{ color:"#60a5fa" }}>regiao</span>          → estado para benchmark geográfico</div>
            <div><span style={{ color:"#60a5fa" }}>participaBench</span>  → opt-in explícito do cliente</div>
          </div>
          <div style={{ marginTop:10, color:C.muted }}>Regras de privacidade: mínimo 5 empresas · sem identificação · apenas mediana/min/max expostos</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TELA: PLANO DE AÇÃO
// ─────────────────────────────────────────────
const statusTarefaCfg = {
  pendente:    { l:"Pendente",     c:"#64748b", bg:"#1e2535", icon:"○" },
  em_andamento:{ l:"Em andamento", c:"#3b82f6", bg:"#0f1e35", icon:"◑" },
  concluida:   { l:"Concluída",    c:"#22c55e", bg:"#0f2f1a", icon:"●" },
  cancelada:   { l:"Cancelada",    c:"#ef4444", bg:"#2d1515", icon:"✕" },
};
const prioridadeTarefaCfg = {
  alta:  { l:"Alta",  c:"#ef4444" },
  media: { l:"Média", c:"#f59e0b" },
  baixa: { l:"Baixa", c:"#22c55e" },
};

let tarefaIdCounter = 100;

function TelaPlanoAcao({ tarefas, setTarefas, onVoltar }) {
  const [modalTarefa, setModalTarefa] = useState(null); // null | "nova" | tarefa
  const [modalComent, setModalComent] = useState(null); // tarefaId | null
  const [novoComent, setNovoComent] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [search, setSearch] = useState("");
  const [formTarefa, setFormTarefa] = useState({ titulo:"", detalhe:"", responsavel:"", prazo:"", prioridade:"media", status:"pendente" });

  const abrirNova = (base=null) => {
    setFormTarefa(base || { titulo:"", detalhe:"", responsavel:"", prazo:"", prioridade:"media", status:"pendente" });
    setModalTarefa("nova");
  };

  const salvarTarefa = () => {
    if (!formTarefa.titulo) return;
    if (modalTarefa === "nova") {
      tarefaIdCounter++;
      setTarefas(prev => [...prev, { id: tarefaIdCounter, ...formTarefa, criacao: new Date().toISOString(), comentarios:[] }]);
    } else {
      setTarefas(prev => prev.map(t => t.id===modalTarefa.id ? { ...t, ...formTarefa } : t));
    }
    setModalTarefa(null);
  };

  const excluirTarefa = (id) => {
    if (confirm("Excluir esta tarefa?")) setTarefas(prev => prev.filter(t => t.id !== id));
  };

  const adicionarComentario = (tarefaId) => {
    if (!novoComent.trim()) return;
    setTarefas(prev => prev.map(t => t.id !== tarefaId ? t : {
      ...t,
      comentarios: [...(t.comentarios||[]), {
        id: Date.now(), texto: novoComent.trim(),
        autor: "Usuário", data: new Date().toISOString()
      }]
    }));
    setNovoComent("");
  };

  const setStatus = (id, status) => setTarefas(prev => prev.map(t => t.id===id ? {...t, status} : t));

  const filtradas = tarefas.dados.filter(t => {
    const matchF = filtro==="todos" || t.status===filtro || t.prioridade===filtro;
    const matchS = !search || t.titulo.toLowerCase().includes(search.toLowerCase()) || t.responsavel?.toLowerCase().includes(search.toLowerCase());
    return matchF && matchS;
  });

  // KPIs
  const total = tarefas.dados.length;
  const concluidas = tarefas.dados.filter(t=>t.status==="concluida").length;
  const emAndamento = tarefas.dados.filter(t=>t.status==="em_andamento").length;
  const atrasadas = tarefas.dados.filter(t=>t.status!=="concluida"&&t.status!=="cancelada"&&t.prazo&&new Date(t.prazo)<new Date()).length;
  const pctConclusao = total ? Math.round(concluidas/total*100) : 0;

  const fmtDataPrazo = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const diff = Math.ceil((dt-hoje)/86400000);
    const str = dt.toLocaleDateString("pt-BR");
    if (diff < 0) return { str, cor:"#ef4444", label:`${Math.abs(diff)}d atrasado` };
    if (diff === 0) return { str, cor:"#f59e0b", label:"Hoje" };
    if (diff <= 3) return { str, cor:"#f59e0b", label:`${diff}d restantes` };
    return { str, cor:C.success, label:`${diff}d restantes` };
  };

  return (
    <div style={{padding:"22px 24px", overflowY:"auto", height:"100%"}}>
      {/* Header */}
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22, flexWrap:"wrap", gap:12}}>
        <div style={{display:"flex", alignItems:"center", gap:12}}>
          <button onClick={onVoltar} style={{background:"transparent", border:`1px solid ${C.border}`, borderRadius:7, padding:"7px 14px", color:C.muted, fontSize:12, cursor:"pointer", fontFamily:"inherit"}}>← Relatório</button>
          <div>
            <div style={{fontSize:11, color:C.muted, letterSpacing:"0.1em", marginBottom:4}}>GESTÃO DE AÇÕES</div>
            <div style={{fontSize:22, fontWeight:700, color:C.text}}>Plano de Ação</div>
          </div>
        </div>
        <button onClick={()=>abrirNova()} style={{...s.btn(true), padding:"9px 18px"}}>+ Nova tarefa</button>
      </div>

      {/* KPIs */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20}}>
        {[
          {l:"Total de tarefas", v:total, c:C.accent},
          {l:"Em andamento", v:emAndamento, c:"#38bdf8"},
          {l:"Concluídas", v:`${concluidas} (${pctConclusao}%)`, c:C.success},
          {l:"Atrasadas", v:atrasadas, c:atrasadas>0?"#ef4444":C.muted},
        ].map(k=>(
          <div key={k.l} style={{...s.card, padding:"14px 18px", borderLeft:`3px solid ${k.c}`}}>
            <div style={{fontSize:10, color:C.muted, letterSpacing:"0.07em", marginBottom:6}}>{k.l.toUpperCase()}</div>
            <div style={{fontSize:24, fontWeight:700, color:k.c}}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Barra de progresso geral */}
      {total > 0 && (
        <div style={{...s.card, padding:"14px 18px", marginBottom:16, display:"flex", alignItems:"center", gap:16}}>
          <div style={{fontSize:12, color:C.muted, flexShrink:0}}>Progresso geral</div>
          <div style={{flex:1, height:8, background:C.border, borderRadius:4, overflow:"hidden"}}>
            <div style={{height:"100%", background:C.success, width:`${pctConclusao}%`, borderRadius:4, transition:"width .3s"}}/>
          </div>
          <div style={{fontSize:13, fontWeight:700, color:C.success, flexShrink:0}}>{pctConclusao}%</div>
        </div>
      )}

      {/* Filtros */}
      <div style={{display:"flex", gap:8, marginBottom:14, flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar tarefa ou responsável..."
          style={{...s.input, width:260, marginBottom:0}}/>
        {["todos","pendente","em_andamento","concluida","alta","media"].map(f=>(
          <button key={f} onClick={()=>setFiltro(f)}
            style={{background:filtro===f?"#1e2a3f":"transparent", border:`1px solid ${filtro===f?C.accent:C.border}`, borderRadius:6, padding:"6px 12px", color:filtro===f?C.accent:C.muted, fontSize:12, cursor:"pointer", fontFamily:"inherit"}}>
            {{todos:"Todos",pendente:"Pendente",em_andamento:"Em andamento",concluida:"Concluída",alta:"🔴 Alta",media:"🟡 Média"}[f]}
          </button>
        ))}
      </div>

      {/* Lista de tarefas */}
      {filtradas.length === 0 && (
        <div style={{...s.card, padding:40, textAlign:"center", color:C.muted, fontSize:13}}>
          {total === 0 ? "Nenhuma tarefa ainda — clique em \"+ Nova tarefa\" ou gere um plano pelo Relatório." : "Nenhuma tarefa encontrada com esse filtro."}
        </div>
      )}

      <div style={{display:"flex", flexDirection:"column", gap:10}}>
        {filtradas.map(t => {
          const stCfg = statusTarefaCfg[t.status];
          const prCfg = prioridadeTarefaCfg[t.prioridade];
          const prazoInfo = fmtDataPrazo(t.prazo);
          const coments = t.comentarios||[];
          const showComent = modalComent === t.id;

          return (
            <div key={t.id} style={{...s.card, overflow:"hidden", borderLeft:`3px solid ${prCfg.c}`}}>
              {/* Linha principal */}
              <div style={{padding:"14px 18px", display:"flex", gap:14, alignItems:"flex-start"}}>
                {/* Status toggle */}
                <div style={{flexShrink:0, marginTop:2}}>
                  <select value={t.status} onChange={e=>setStatus(t.id, e.target.value)}
                    style={{background:stCfg.bg, border:`1px solid ${stCfg.c}44`, borderRadius:6, padding:"4px 8px", color:stCfg.c, fontSize:11, cursor:"pointer", fontFamily:"inherit", fontWeight:600}}>
                    {Object.entries(statusTarefaCfg).map(([k,v])=><option key={k} value={k}>{v.icon} {v.l}</option>)}
                  </select>
                </div>

                {/* Conteúdo */}
                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:4}}>
                    <span style={{fontSize:14, fontWeight:600, color: t.status==="concluida"?C.muted:C.text, textDecoration:t.status==="concluida"?"line-through":"none"}}>
                      {t.titulo}
                    </span>
                    <span style={s.tag(prCfg.c)}>{prCfg.l}</span>
                    {coments.length>0&&<span style={{...s.tag(C.muted), fontSize:9}}>💬 {coments.length}</span>}
                  </div>
                  {t.detalhe && <div style={{fontSize:12, color:C.muted, marginBottom:6, lineHeight:1.5}}>{t.detalhe}</div>}
                  <div style={{display:"flex", gap:16, flexWrap:"wrap", fontSize:11}}>
                    {t.responsavel&&<span style={{color:C.textSub}}>👤 {t.responsavel}</span>}
                    {prazoInfo&&typeof prazoInfo==="object"&&(
                      <span style={{color:prazoInfo.cor}}>📅 {prazoInfo.str} · {prazoInfo.label}</span>
                    )}
                    {t.criacao&&<span style={{color:C.muted}}>Criada {fmtD(t.criacao)}</span>}
                  </div>
                </div>

                {/* Ações */}
                <div style={{display:"flex", gap:6, flexShrink:0}}>
                  <button onClick={()=>setModalComent(showComent?null:t.id)}
                    style={{background:showComent?"#1e2a3f":"transparent", border:`1px solid ${C.border}`, borderRadius:5, padding:"5px 10px", color:showComent?C.accent:C.muted, fontSize:11, cursor:"pointer", fontFamily:"inherit"}}>
                    💬 {coments.length>0?coments.length:"Log"}
                  </button>
                  <button onClick={()=>{ setFormTarefa({titulo:t.titulo,detalhe:t.detalhe,responsavel:t.responsavel||"",prazo:t.prazo||"",prioridade:t.prioridade,status:t.status}); setModalTarefa(t); }}
                    style={{background:"transparent", border:`1px solid ${C.border}`, borderRadius:5, padding:"5px 9px", color:C.muted, fontSize:11, cursor:"pointer", fontFamily:"inherit"}}>✏</button>
                  <button onClick={()=>excluirTarefa(t.id)}
                    style={{background:"transparent", border:`1px solid #ef444433`, borderRadius:5, padding:"5px 9px", color:"#ef4444", fontSize:11, cursor:"pointer", fontFamily:"inherit"}}>✕</button>
                </div>
              </div>

              {/* Painel de comentários */}
              {showComent && (
                <div style={{borderTop:`1px solid ${C.border}`, background:C.bg, padding:"14px 18px"}}>
                  <div style={{fontSize:10, color:C.muted, letterSpacing:"0.08em", marginBottom:10}}>LOG DE ACOMPANHAMENTO</div>

                  {/* Histórico */}
                  {coments.length === 0 && <div style={{fontSize:12, color:C.muted, marginBottom:10}}>Nenhum comentário ainda.</div>}
                  <div style={{display:"flex", flexDirection:"column", gap:8, marginBottom:12}}>
                    {coments.map(c=>(
                      <div key={c.id} style={{background:C.surface, border:`1px solid ${C.border}`, borderRadius:7, padding:"10px 14px"}}>
                        <div style={{display:"flex", justifyContent:"space-between", marginBottom:5}}>
                          <span style={{fontSize:11, fontWeight:600, color:C.accent}}>👤 {c.autor}</span>
                          <span style={{fontSize:10, color:C.muted}}>{new Date(c.data).toLocaleDateString("pt-BR")} {new Date(c.data).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span>
                        </div>
                        <div style={{fontSize:13, color:C.text, lineHeight:1.6}}>{c.texto}</div>
                      </div>
                    ))}
                  </div>

                  {/* Novo comentário */}
                  <div style={{display:"flex", gap:8}}>
                    <textarea value={novoComent} onChange={e=>setNovoComent(e.target.value)}
                      placeholder="Registrar atualização, progresso ou observação..."
                      rows={2} style={{...s.input, flex:1, resize:"none", fontSize:13}}
                      onKeyDown={e=>e.ctrlKey&&e.key==="Enter"&&adicionarComentario(t.id)}/>
                    <button onClick={()=>adicionarComentario(t.id)} disabled={!novoComent.trim()}
                      style={{...s.btn(novoComent.trim(),"#238636"), padding:"0 16px", alignSelf:"stretch", fontSize:12}}>
                      Registrar
                    </button>
                  </div>
                  <div style={{fontSize:10, color:C.muted, marginTop:4}}>Ctrl+Enter para enviar</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL: Nova / Editar tarefa */}
      {modalTarefa && (
        <Modal title={modalTarefa==="nova"?"Nova tarefa":"Editar tarefa"} onClose={()=>setModalTarefa(null)} width={500}>
          <Input label="Título *" value={formTarefa.titulo} onChange={e=>setFormTarefa(f=>({...f,titulo:e.target.value}))} placeholder="Ex: Prospectar fornecedores alternativos"/>
          <div style={{marginBottom:14}}>
            <label style={s.label}>DESCRIÇÃO / DETALHAMENTO</label>
            <textarea value={formTarefa.detalhe} onChange={e=>setFormTarefa(f=>({...f,detalhe:e.target.value}))} rows={3}
              placeholder="Descreva o que precisa ser feito e como medir conclusão..." style={{...s.input, resize:"none"}}/>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
            <Input label="Responsável" value={formTarefa.responsavel} onChange={e=>setFormTarefa(f=>({...f,responsavel:e.target.value}))} placeholder="Nome do responsável"/>
            <div style={{marginBottom:14}}>
              <label style={s.label}>PRAZO</label>
              <input type="date" value={formTarefa.prazo} onChange={e=>setFormTarefa(f=>({...f,prazo:e.target.value}))} style={s.input}/>
            </div>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
            <Select label="Prioridade" value={formTarefa.prioridade} onChange={e=>setFormTarefa(f=>({...f,prioridade:e.target.value}))}>
              <option value="alta">🔴 Alta</option>
              <option value="media">🟡 Média</option>
              <option value="baixa">🟢 Baixa</option>
            </Select>
            <Select label="Status" value={formTarefa.status} onChange={e=>setFormTarefa(f=>({...f,status:e.target.value}))}>
              {Object.entries(statusTarefaCfg).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}
            </Select>
          </div>
          <div style={{display:"flex", gap:10, justifyContent:"flex-end", marginTop:8}}>
            <button onClick={()=>setModalTarefa(null)} style={{...s.btn(false), padding:"8px 18px"}}>Cancelar</button>
            <button onClick={salvarTarefa} disabled={!formTarefa.titulo} style={s.btn(!!formTarefa.titulo)}>Salvar tarefa</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// AUTH — USUÁRIOS E PERFIS
// ─────────────────────────────────────────────

const PERFIS = {
  tecnico:   { l:"Técnico",       c:"#f59e0b", icon:"🔧" },
  comprador: { l:"Comprador",     c:"#3b82f6", icon:"📋" },
  gestor:    { l:"Gestor",        c:"#a78bfa", icon:"📊" },
  admin:     { l:"Administrador", c:"#ef4444", icon:"⚙"  },
};

// Permissões por tela
const PERMISSOES = {
  home:           ["tecnico","comprador","gestor","admin"],
  tecnico:        ["tecnico","comprador","gestor","admin"],
  compradora:     ["comprador","gestor","admin"],
  plano:          ["comprador","gestor","admin"],
  financeiro:     ["gestor","admin"],
  relatorio:      ["gestor","admin"],
  historico:      ["gestor","admin"],
  inteligencia:   ["gestor","admin"],   // compliance só admin vê dentro
  benchmark:      ["gestor","admin"],
  equipamentos:   ["comprador","gestor","admin"],
  fornecedores:   ["comprador","gestor","admin"],
  usuarios:       ["admin"],
  fornecedorportal: ["tecnico","comprador","gestor","admin"], // demo
};

// ─── Tela de Gestão de Usuários (Admin) ──────
function TelaUsuarios({ usuarios, setUsuarios }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ nome:"", email:"", senha:"", perfil:"comprador", ativo:true });
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  const salvar = () => {
    if (!form.nome||!form.email) return;
    if (modal==="novo") {
      setUsuarios(prev=>[...prev,{ id:Date.now(), ...form, senha:hashSenha(form.senha||"123456"), criacao:new Date().toISOString().split("T")[0] }]);
    } else {
      setUsuarios(prev=>prev.map(u=>u.id!==modal.id?u:{...u, nome:form.nome, email:form.email, perfil:form.perfil, ativo:form.ativo,
        ...(form.senha?{senha:hashSenha(form.senha)}:{}) }));
    }
    setModal(null);
  };

  const abrirEditar = u => { setForm({nome:u.nome,email:u.email,senha:"",perfil:u.perfil,ativo:u.ativo}); setModal(u); };
  const abrirNovo   = () => { setForm({nome:"",email:"",senha:"",perfil:"comprador",ativo:true}); setModal("novo"); };
  const toggleAtivo = id => setUsuarios(prev=>prev.map(u=>u.id===id?{...u,ativo:!u.ativo}:u));

  return (
    <div style={{padding:"22px 24px",overflowY:"auto",height:"100%"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
        <div>
          <div style={{fontSize:11,color:C.muted,letterSpacing:"0.1em",marginBottom:4}}>ADMINISTRAÇÃO</div>
          <div style={{fontSize:22,fontWeight:700,color:C.text}}>Gestão de Usuários</div>
        </div>
        <button onClick={abrirNovo} style={{...s.btn(true),padding:"9px 18px"}}>+ Novo usuário</button>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
        {Object.entries(PERFIS).map(([k,v])=>(
          <div key={k} style={{...s.card,padding:"12px 16px",borderLeft:`3px solid ${v.c}`}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:4}}>{v.icon} {v.l.toUpperCase()}</div>
            <div style={{fontSize:22,fontWeight:700,color:v.c}}>{usuarios.filter(u=>u.perfil===k&&u.ativo).length}</div>
            <div style={{fontSize:10,color:C.muted}}>{usuarios.filter(u=>u.perfil===k&&!u.ativo).length} inativo{usuarios.filter(u=>u.perfil===k&&!u.ativo).length!==1?"s":""}</div>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div style={{...s.card,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"2fr 2fr 120px 80px 80px 90px",padding:"10px 18px",background:C.bg,borderBottom:`1px solid ${C.border}`,fontSize:10,color:C.muted,letterSpacing:"0.08em"}}>
          <span>NOME</span><span>E-MAIL</span><span>PERFIL</span><span>CRIAÇÃO</span><span>STATUS</span><span></span>
        </div>
        {usuarios.map((u,i)=>{
          const pCfg=PERFIS[u.perfil];
          return(
            <div key={u.id} style={{display:"grid",gridTemplateColumns:"2fr 2fr 120px 80px 80px 90px",padding:"13px 18px",borderBottom:i<usuarios.length-1?`1px solid ${C.border}22`:"none",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:`${pCfg.c}22`,border:`1px solid ${pCfg.c}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{pCfg.icon}</div>
                <div>
                  <div style={{fontSize:13,color:u.ativo?C.text:C.muted,fontWeight:500}}>{u.nome}</div>
                </div>
              </div>
              <span style={{fontSize:12,color:C.accent}}>{u.email}</span>
              <span style={{...s.tag(pCfg.c)}}>{pCfg.l}</span>
              <span style={{fontSize:11,color:C.muted}}>{fmtD(u.criacao)}</span>
              <div>
                <span style={{...s.tag(u.ativo?C.success:"#ef4444"),fontSize:10}}>{u.ativo?"Ativo":"Inativo"}</span>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>abrirEditar(u)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,padding:"4px 8px",color:C.muted,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏</button>
                <button onClick={()=>toggleAtivo(u.id)} style={{background:"transparent",border:`1px solid ${u.ativo?"#ef444433":"#22c55e33"}`,borderRadius:5,padding:"4px 8px",color:u.ativo?"#ef4444":C.success,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{u.ativo?"Desativar":"Ativar"}</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modal&&(
        <Modal title={modal==="novo"?"Novo usuário":"Editar usuário"} onClose={()=>setModal(null)} width={460}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}><Input label="Nome completo *" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))}/></div>
            <div style={{gridColumn:"1/-1"}}><Input label="E-mail *" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="usuario@empresa.com"/></div>
          </div>
          <div style={{marginBottom:14}}>
            <label style={s.label}>{modal==="novo"?"SENHA *":"NOVA SENHA (deixe em branco para manter)"}</label>
            <div style={{position:"relative"}}>
              <input type={senhaVisivel?"text":"password"} value={form.senha} onChange={e=>setForm(f=>({...f,senha:e.target.value}))}
                placeholder={modal==="novo"?"Mínimo 6 caracteres":"••••••••"} style={{...s.input,paddingRight:44}}/>
              <button onClick={()=>setSenhaVisivel(v=>!v)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",color:C.muted,cursor:"pointer"}}>{senhaVisivel?"🙈":"👁"}</button>
            </div>
            {modal==="novo"&&<div style={{fontSize:10,color:C.muted,marginTop:4}}>Padrão se deixar em branco: 123456</div>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:8}}>
            <Select label="Perfil" value={form.perfil} onChange={e=>setForm(f=>({...f,perfil:e.target.value}))}>
              {Object.entries(PERFIS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.l}</option>)}
            </Select>
            <Select label="Status" value={form.ativo?"ativo":"inativo"} onChange={e=>setForm(f=>({...f,ativo:e.target.value==="ativo"}))}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </Select>
          </div>

          {/* Mapa de permissões do perfil selecionado */}
          <div style={{background:C.bg,borderRadius:8,padding:"12px 14px",marginBottom:16}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:"0.08em",marginBottom:8}}>PERMISSÕES DO PERFIL {PERFIS[form.perfil]?.l.toUpperCase()}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {Object.entries(PERMISSOES).map(([tela,perfis])=>{
                const temAcesso=perfis.includes(form.perfil);
                const labels={home:"Início",tecnico:"Chamados",compradora:"Compras",plano:"Plano de Ação",financeiro:"Financeiro",relatorio:"Relatório",historico:"Histórico",inteligencia:"Inteligência",benchmark:"Benchmark",equipamentos:"Equipamentos",fornecedores:"Fornecedores",usuarios:"Usuários",fornecedorportal:"Portal Fornecedor"};
                return(
                  <span key={tela} style={{fontSize:10,borderRadius:4,padding:"2px 7px",background:temAcesso?`${C.success}22`:C.border,color:temAcesso?C.success:C.muted,border:`1px solid ${temAcesso?`${C.success}44`:C.border}`}}>
                    {temAcesso?"✓":"✕"} {labels[tela]||tela}
                  </span>
                );
              })}
            </div>
          </div>

          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={()=>setModal(null)} style={{...s.btn(false),padding:"8px 18px"}}>Cancelar</button>
            <button onClick={salvar} disabled={!form.nome||!form.email} style={s.btn(form.nome&&form.email)}>Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}