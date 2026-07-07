const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { autenticar, requerPerfil } = require("./auth");
const { enviarEmailCotacao, enviarEmailResultado } = require("../services/emailService");
const router = express.Router();

router.use(autenticar);

// Número sequencial de cotação
function gerarNumero() {
  const ano = new Date().getFullYear();
  const ultimo = db.prepare("SELECT numero FROM chamados ORDER BY id DESC LIMIT 1").get();
  let seq = 1;
  if (ultimo?.numero) {
    const match = ultimo.numero.match(/(\d+)$/);
    if (match) seq = parseInt(match[1]) + 1;
  }
  return `COT-${ano}-${String(seq).padStart(4, "0")}`;
}

// ── CHAMADOS ─────────────────────────────────

// GET /api/cotacoes/chamados
router.get("/chamados", (req, res) => {
  const chamados = db.prepare(`
    SELECT c.*, e.tag as equipamento_tag, e.nome as equipamento_nome,
           u.nome as tecnico_nome_usuario
    FROM chamados c
    LEFT JOIN equipamentos e ON e.id = c.equipamento_id
    LEFT JOIN usuarios u ON u.id = c.tecnico_id
    ORDER BY c.aberto_em DESC
  `).all();
  res.json(chamados);
});

// POST /api/cotacoes/chamados — abrir novo chamado
router.post("/chamados", (req, res) => {
  const { peca, codigo, equipamento_id, urgencia, categoria, categoria_item, tipo_disponib, descricao } = req.body;
  if (!peca) return res.status(400).json({ erro: "Peça é obrigatória." });
  const numero = gerarNumero();
  const r = db.prepare(`
    INSERT INTO chamados (numero, peca, codigo, equipamento_id, urgencia, categoria, categoria_item, tipo_disponib, tecnico_id, tecnico_nome, descricao)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(numero, peca, codigo||"", equipamento_id||null, urgencia||"media", categoria||"corretiva", categoria_item||"", tipo_disponib||"prateleira", req.usuario.id, req.usuario.nome, descricao||"");
  res.json({ id: r.lastInsertRowid, numero });
});

// ── COTAÇÕES ──────────────────────────────────

// GET /api/cotacoes — listar cotações com fornecedores
router.get("/", (req, res) => {
  const cotacoes = db.prepare("SELECT * FROM cotacoes ORDER BY enviado_em DESC").all();
  const result = cotacoes.map(c => ({
    ...c,
    fornecedores: db.prepare("SELECT * FROM cotacao_fornecedores WHERE cotacao_id = ?").all(c.id)
  }));
  res.json(result);
});

// POST /api/cotacoes — iniciar cotação com lista de fornecedores
router.post("/", requerPerfil("comprador","gestor","admin"), async (req, res) => {
  const { chamado_id, fornecedores } = req.body;
  if (!chamado_id || !fornecedores?.length) return res.status(400).json({ erro: "chamado_id e fornecedores são obrigatórios." });

  const chamado = db.prepare("SELECT * FROM chamados WHERE id = ?").get(chamado_id);
  if (!chamado) return res.status(404).json({ erro: "Chamado não encontrado." });

  // Criar cotação
  const cotRes = db.prepare("INSERT INTO cotacoes (chamado_id) VALUES (?)").run(chamado_id);
  const cotacaoId = cotRes.lastInsertRowid;

  // Criar linha por fornecedor + enviar e-mail
  const linhas = [];
  for (const f of fornecedores) {
    const token = crypto.randomBytes(16).toString("hex");
    db.prepare(`
      INSERT INTO cotacao_fornecedores (cotacao_id, fornecedor_id, fornecedor_nome, fornecedor_email, token)
      VALUES (?,?,?,?,?)
    `).run(cotacaoId, f.id||null, f.nome, f.email, token);
    linhas.push({ ...f, token });
    // Enviar e-mail com link
    await enviarEmailCotacao(chamado, f, token).catch(e => console.error(`E-mail falhou para ${f.email}:`, e.message));
  }

  // Atualizar status do chamado
  db.prepare("UPDATE chamados SET status = 'cotando' WHERE id = ?").run(chamado_id);

  res.json({ id: cotacaoId, fornecedores: linhas });
});

// PUT /api/cotacoes/:id/finalizar — aprovar cotação
router.put("/:id/finalizar", requerPerfil("comprador","gestor","admin"), async (req, res) => {
  const { fornecedor_token, valor_negociado, aprovado_por } = req.body;
  const cotacao = db.prepare("SELECT * FROM cotacoes WHERE id = ?").get(req.params.id);
  if (!cotacao) return res.status(404).json({ erro: "Cotação não encontrada." });

  const vencedor = db.prepare("SELECT * FROM cotacao_fornecedores WHERE token = ?").get(fornecedor_token);
  if (!vencedor) return res.status(404).json({ erro: "Fornecedor não encontrado." });

  const chamado = db.prepare("SELECT * FROM chamados WHERE id = ?").get(cotacao.chamado_id);
  const valorPago = valor_negociado || vencedor.valor;
  const leadTime = Math.floor((new Date() - new Date(chamado.aberto_em)) / 86400000);

  db.prepare("UPDATE cotacoes SET status = 'finalizado' WHERE id = ?").run(req.params.id);
  db.prepare(`
    UPDATE chamados SET status='finalizado', valor_aprovado=?, valor_negociado=?,
    custo_total_real=?, fornecedor_aprovado=?, aprovado_por=?, aprovado_por_id=?, lead_time=?, finalizado_em=datetime('now')
    WHERE id=?
  `).run(vencedor.valor, valorPago, valorPago + (vencedor.valor_frete||0), vencedor.fornecedor_nome, aprovado_por||req.usuario.nome, req.usuario.id, leadTime, cotacao.chamado_id);

  // Notificar todos os fornecedores
  const todos = db.prepare("SELECT * FROM cotacao_fornecedores WHERE cotacao_id = ?").all(req.params.id);
  for (const f of todos) {
    const ganhou = f.token === fornecedor_token;
    await enviarEmailResultado(chamado, f, ganhou).catch(e => console.error(`E-mail resultado falhou:`, e.message));
  }

  res.json({ ok: true, valorPago, leadTime });
});

module.exports = router;
