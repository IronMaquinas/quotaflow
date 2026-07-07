require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");

const db = require("./db");
const authRoutes = require("./routes/auth");
const cotacoesRoutes = require("./routes/cotacoes");
const fornecedoresRoutes = require("./routes/fornecedores");
const emailRoutes = require("./routes/email");
const cnpjRoutes = require("./routes/cnpj");
const usuariosRoutes = require("./routes/usuarios");
const { verificarCNPJsFornecedores } = require("./jobs/cnpjMonitor");

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
app.use("/api/cotacoes",     cotacoesRoutes);
app.use("/api/fornecedores", fornecedoresRoutes);
app.use("/api/email",        emailRoutes);
app.use("/api/cnpj",         cnpjRoutes);
app.use("/api/usuarios",     usuariosRoutes);

// Rota de saúde (Railway usa para verificar se o servidor está rodando)
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// Rota pública para fornecedor responder cotação via link
app.get("/api/cotacao/:token", (req, res) => {
  const cot = db.prepare(`
    SELECT cf.*, c.peca, c.codigo, c.equipamento, c.urgencia, e.nome as empresa_nome
    FROM cotacao_fornecedores cf
    JOIN cotacoes c ON c.id = cf.cotacao_id
    JOIN empresa e ON 1=1
    WHERE cf.token = ?
  `).get(req.params.token);
  if (!cot) return res.status(404).json({ erro: "Cotação não encontrada ou link inválido." });
  res.json(cot);
});

app.post("/api/cotacao/:token/responder", (req, res) => {
  const { valor, prazo, frete, valorFrete, obs } = req.body;
  const cot = db.prepare("SELECT * FROM cotacao_fornecedores WHERE token = ?").get(req.params.token);
  if (!cot) return res.status(404).json({ erro: "Link inválido." });
  if (cot.status === "respondido") return res.status(400).json({ erro: "Esta cotação já foi respondida." });
  db.prepare(`
    UPDATE cotacao_fornecedores
    SET status='respondido', valor=?, prazo=?, frete=?, valor_frete=?, obs=?, data_resposta=datetime('now')
    WHERE token=?
  `).run(valor, prazo, frete||"CIF", valorFrete||0, obs||"", req.params.token);
  // Notificar comprador por e-mail
  const { enviarEmailRespostaRecebida } = require("./services/emailService");
  enviarEmailRespostaRecebida(cot).catch(console.error);
  res.json({ ok: true, mensagem: "Proposta recebida! Um e-mail de confirmação foi enviado." });
});

// ── Job: monitoramento mensal de CNPJs ───────
// Roda no dia 1 de cada mês às 8h
cron.schedule("0 8 1 * *", () => {
  console.log("[CRON] Iniciando verificação mensal de CNPJs...");
  verificarCNPJsFornecedores().catch(console.error);
});

// ── Start ────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ QuotaFlow backend rodando na porta ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || "development"}`);
});
