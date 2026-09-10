// backend/server.js
require("dotenv").config();
const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const cron = require("node-cron");

const { DB, initializeDB } = require("./db");
const tenantMiddleware = require("./middleware/tenantMiddleware");
const fornecedorMiddleware = require("./middleware/fornecedorMiddleware");
const authRoutes = require("./routes/auth");
const cotacoesRoutes = require("./routes/cotacoes");
const fornecedoresRoutes = require("./routes/fornecedores");
const emailRoutes = require("./routes/email");
const cnpjRoutes = require("./routes/cnpj");
const usuariosRoutes = require("./routes/usuarios");
const equipamentosRouter = require('./routes/equipamentos');
const tarefasRoutes = require('./routes/tarefas');
const catalogoRoutes = require("./routes/catalogo");

const app = express();
const PORT = process.env.PORT || 3001;
const ordensVendaRoutes = require('./routes/ordensVenda');
const spotRoutes = require('./routes/spot');
const fornecedorRoutes = require('./routes/fornecedor');
const itensConsumoRoutes = require('./routes/estoque/itensConsumo');
const movimentacoesRoutes = require('./routes/estoque/movimentacoes');
const recompraRoutes = require('./routes/estoque/recompra');
const configEstoqueRoutes = require('./routes/estoque/configuracoes');
const solicitacoesRoutes = require('./routes/estoque/solicitacoes');
const ordemServicoRoutes = require('./routes/estoque/ordemServico');
const reservasRoutes = require('./routes/estoque/reservas');
const fornecedorProdutosRouter = require('./routes/fornecedorProdutos');
const buscaFornecedoresRouter = require('./routes/buscaFornecedores');

// ── Middlewares ──────────────────────────────
const allowedOrigins = [
  'https://kotuno.netlify.app',
  'https://quotaflow.netlify.app',
  'http://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    // Permite requisições sem origin (ex: Postman) ou se origin estiver na lista
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '15mb' }));
app.use(fileUpload());

// ── Rotas ────────────────────────────────────
app.use("/api/auth",         authRoutes);
app.use("/api/cotacoes",     cotacoesRoutes);
app.use("/api/catalogo",     tenantMiddleware, catalogoRoutes);
app.use("/api/fornecedores", tenantMiddleware, fornecedoresRoutes); // Fornecedor do Cliente
app.use("/api/email",        tenantMiddleware, emailRoutes);
app.use("/api/cnpj",         tenantMiddleware, cnpjRoutes);
app.use("/api/usuarios",     tenantMiddleware, usuariosRoutes);
app.use('/api/equipamentos', tenantMiddleware, equipamentosRouter);
app.use('/api/tarefas',      tenantMiddleware, tarefasRoutes);
app.use('/api', require('./routes/portalFornecedor'));
app.use('/api/ordens-venda', tenantMiddleware, ordensVendaRoutes);
app.use('/api/fornecedor', fornecedorRoutes); // Fornecedor anunciante com perfil de fornecedor exclusivo
app.use('/api/fornecedor', fornecedorProdutosRouter); // Upload/listagem de produtos do fornecedor (mesmo domínio de fornecedorRoutes)
app.use('/api/busca-fornecedores', tenantMiddleware, buscaFornecedoresRouter);
app.use('/api/estoque/itens', tenantMiddleware, itensConsumoRoutes);
app.use('/api/estoque/movimentacoes', tenantMiddleware, movimentacoesRoutes);
app.use('/api/estoque/recompra', tenantMiddleware, recompraRoutes);
app.use('/api/estoque/configuracoes', tenantMiddleware, configEstoqueRoutes);
app.use('/api/estoque/solicitacoes', tenantMiddleware, solicitacoesRoutes);
app.use('/api/estoque', solicitacoesRoutes);
app.use('/api/estoque/ordem-servico', tenantMiddleware, ordemServicoRoutes);
app.use('/api/estoque', tenantMiddleware, reservasRoutes);

app.get('/api/spot/publicas', async (req, res) => {
  try {
    const demandasAbertas = await DB.select('demandas_spot', { status: 'aberta' });

    const demandas = await Promise.all(demandasAbertas.map(async (ds) => {
      const tenant = await DB.selectOne('tenants', { id: ds.tenant_id });
      return {
        id: ds.id,
        tenant_id: ds.tenant_id,
        descricao_equipamento: ds.descricao_equipamento,
        marca_modelo: ds.marca_modelo,
        componente: ds.componente,
        part_number: ds.part_number,
        quantidade: ds.quantidade,
        comentarios: ds.comentarios,
        urgencia: ds.urgencia,
        criado_em: ds.criado_em,
        empresa_nome: tenant?.nome ?? null
      };
    }));

    demandas.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));

    res.json(demandas);
  } catch (err) {
    console.error('❌ Erro ao listar demandas públicas:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// Rotas protegidas (exigem autenticação)
app.use('/api/spot', tenantMiddleware, spotRoutes);

// Rota de saúde (Railway usa para verificar se o servidor está rodando)
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.get("/api/cotacao/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const cf = await DB.selectOne('cotacao_fornecedores', { token });
    if (!cf) {
      return res.status(404).json({ erro: "Cotação não encontrada ou link inválido." });
    }

    const cotacao = await DB.selectOne('cotacoes', { id: cf.cotacao_id });
    const chamado = cotacao ? await DB.selectOne('chamados', { id: cotacao.chamado_id }) : null;
    const tenant = await DB.selectOne('tenants', { id: cf.tenant_id });

    res.json({
      id: cf.id,
      tenant_id: cf.tenant_id,
      cotacao_id: cf.cotacao_id,
      fornecedor_nome: cf.fornecedor_nome,
      fornecedor_email: cf.fornecedor_email,
      token: cf.token,
      status: cf.status,
      valor: cf.valor,
      prazo: cf.prazo,
      frete: cf.frete,
      valor_frete: cf.valor_frete,
      obs: cf.obs,
      data_resposta: cf.data_resposta,
      enviado_em: cf.enviado_em,
      chamado_id: chamado?.id ?? null,
      chamado_status: cotacao?.status ?? null,
      numero: chamado?.numero ?? null,
      peca: chamado?.peca ?? null,
      codigo: chamado?.codigo ?? null,
      urgencia: chamado?.urgencia ?? null,
      empresa_nome: tenant?.nome ?? null
    });
  } catch (err) {
    console.error("❌ Erro ao buscar cotação:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// FIX (2026-09, mesmo problema): a query original usava
// "UPDATE cotacao_fornecedores SET ... WHERE token = $6" via DB.raw() — sem
// nenhum "FROM", então nem cai no fallback genérico de SELECT, quebra com
// "Raw query não suportada". Reescrito sem raw(): busca o registro pelo
// token de verdade (DB.selectOne) e atualiza só aquela linha.
app.post("/api/cotacao/:token/responder", async (req, res) => {
  try {
    const { token } = req.params;
    const { valor, prazo, frete, valorFrete, obs } = req.body;

    const cot = await DB.selectOne('cotacao_fornecedores', { token });
    if (!cot) {
      return res.status(404).json({ erro: "Link inválido." });
    }

    if (cot.status === "respondido") {
      return res.status(400).json({ erro: "Esta cotação já foi respondida." });
    }

    const atualizado = await DB.update('cotacao_fornecedores', cot.id, {
      status: 'respondido',
      valor,
      prazo,
      frete: frete || "CIF",
      valor_frete: valorFrete || 0,
      obs: obs || "",
      data_resposta: new Date()
    });

    // Notificar comprador por e-mail
    const { enviarEmailRespostaRecebida } = require("./services/emailService");
    enviarEmailRespostaRecebida(atualizado).catch(console.error);

    res.json({ ok: true, mensagem: "Proposta recebida! Um e-mail de confirmação foi enviado.", cotacao: atualizado });
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