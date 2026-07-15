require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");

const { DB, initializeDB } = require("./db");
const tenantMiddleware = require("./middleware/tenantMiddleware");
const authRoutes = require("./routes/auth");
const cotacoesRoutes = require("./routes/cotacoes");
const fornecedoresRoutes = require("./routes/fornecedores");
const emailRoutes = require("./routes/email");
const cnpjRoutes = require("./routes/cnpj");
const usuariosRoutes = require("./routes/usuarios");
// const { verificarCNPJsFornecedores } = require("./jobs/cnpjMonitor");
const equipamentosRouter = require('./routes/equipamentos');
const tarefasRoutes = require('./routes/tarefas');
const catalogoRoutes = require("./routes/catalogo");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares ──────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());

// ── Rotas ────────────────────────────────────
app.use("/api/auth",         authRoutes);
app.use("/api/cotacoes",     tenantMiddleware, cotacoesRoutes);
app.use("/api/catalogo",     tenantMiddleware, catalogoRoutes);
app.use("/api/fornecedores", tenantMiddleware, fornecedoresRoutes);
app.use("/api/email",        tenantMiddleware, emailRoutes);
app.use("/api/cnpj",         tenantMiddleware, cnpjRoutes);
app.use("/api/usuarios",     tenantMiddleware, usuariosRoutes);
app.use('/api/equipamentos', tenantMiddleware, equipamentosRouter);
app.use('/api/tarefas',      tenantMiddleware, tarefasRoutes);

// Rota de saúde (Railway usa para verificar se o servidor está rodando)
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// ── Rota pública para fornecedor responder cotação via link (SEM autenticação) ───────
app.get("/api/cotacao/:token", async (req, res) => {
  try {
    const { token } = req.params;
    
    // Buscar cotação sem autenticação (usar service_role para bypass RLS)
    const cotacoes = await DB.raw(`
      SELECT 
        cf.id, cf.tenant_id, cf.cotacao_id, cf.fornecedor_nome, cf.fornecedor_email,
        cf.token, cf.status, cf.valor, cf.prazo, cf.frete, cf.valor_frete, cf.obs,
        cf.data_resposta, cf.enviado_em,
        c.id as chamado_id, c.status as chamado_status,
        ch.numero, ch.peca, ch.codigo, ch.urgencia,
        t.nome as empresa_nome
      FROM cotacao_fornecedores cf
      JOIN cotacoes c ON c.id = cf.cotacao_id
      JOIN chamados ch ON ch.id = c.chamado_id
      JOIN tenants t ON t.id = cf.tenant_id
      WHERE cf.token = $1
    `, [token]);
    
    if (!cotacoes || cotacoes.length === 0) {
      return res.status(404).json({ erro: "Cotação não encontrada ou link inválido." });
    }
    
    res.json(cotacoes[0]);
  } catch (err) {
    console.error("❌ Erro ao buscar cotação:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

app.post("/api/cotacao/:token/responder", async (req, res) => {
  try {
    const { token } = req.params;
    const { valor, prazo, frete, valorFrete, obs } = req.body;

    // Buscar cotação por token (sem autenticação)
    const cotacoes = await DB.raw(`
      SELECT * FROM cotacao_fornecedores WHERE token = $1
    `, [token]);

    if (!cotacoes || cotacoes.length === 0) {
      return res.status(404).json({ erro: "Link inválido." });
    }

    const cot = cotacoes[0];

    if (cot.status === "respondido") {
      return res.status(400).json({ erro: "Esta cotação já foi respondida." });
    }

    // Atualizar cotação
    await DB.raw(`
      UPDATE cotacao_fornecedores
      SET status = 'respondido', valor = $1, prazo = $2, frete = $3, 
          valor_frete = $4, obs = $5, data_resposta = NOW()
      WHERE token = $6
    `, [valor, prazo, frete || "CIF", valorFrete || 0, obs || "", token]);

    // Notificar comprador por e-mail
    const { enviarEmailRespostaRecebida } = require("./services/emailService");
    enviarEmailRespostaRecebida(cot).catch(console.error);

    res.json({ ok: true, mensagem: "Proposta recebida! Um e-mail de confirmação foi enviado." });
  } catch (err) {
    console.error("❌ Erro ao responder cotação:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ── Job: monitoramento mensal de CNPJs ───────
// Roda no dia 1 de cada mês às 8h
// cron.schedule("0 8 1 * *", () => {
//   console.log("[CRON] Iniciando verificação mensal de CNPJs...");
//   verificarCNPJsFornecedores().catch(console.error);
// }); // COMENTAR POR ENQUANTO

// ── Start ────────────────────────────────────
// Inicializar banco de dados e depois iniciar servidor
initializeDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ QuotaFlow backend rodando na porta ${PORT}`);
    console.log(`   Ambiente: ${process.env.NODE_ENV || "development"}`);
  });
}).catch(err => {
  console.error("❌ Falha ao inicializar banco de dados:", err.message);
  process.exit(1);
});