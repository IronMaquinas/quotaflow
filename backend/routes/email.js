// ════════════════════════════════════════════════════════════════════════════════
// routes/email.js: ENVIO DE EMAILS E NOTIFICAÇÕES
// ════════════════════════════════════════════════════════════════════════════════
// Endpoints:
// POST   /api/email/teste           - Testar envio de email
// POST   /api/email/cotacao         - Enviar cotação para fornecedor
// POST   /api/email/resultado       - Notificar resultado para fornecedor
// GET    /api/email/logs            - Ver logs de emails enviados
// ════════════════════════════════════════════════════════════════════════════════

const express = require("express");
const router = express.Router();
const { DB } = require("../db");
const tenantMiddleware = require("../middleware/tenantMiddleware");
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// ─────────────────────────────────────────────────────────────────────────
// POST /api/email/teste - Testar envio de email
// ─────────────────────────────────────────────────────────────────────────

router.post("/teste", tenantMiddleware, async (req, res) => {
  try {
    const { email_destino } = req.body;

    if (!email_destino) {
      return res.status(400).json({ erro: "email_destino é obrigatório" });
    }

    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || "noreply@quotaflow.com.br",
      to: email_destino,
      subject: "Teste - Quotaflow",
      html: `
        <h1>Teste de Email</h1>
        <p>Este é um email de teste do Quotaflow.</p>
        <p>Se você recebeu este email, o sistema de notificações está funcionando.</p>
      `
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    res.json({
      ok: true,
      mensagem: "Email de teste enviado com sucesso",
      email_id: result.data.id
    });

  } catch (err) {
    console.error("❌ Erro ao enviar email de teste:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/email/cotacao - Enviar cotação para fornecedor
// ─────────────────────────────────────────────────────────────────────────

router.post("/cotacao", tenantMiddleware, async (req, res) => {
  try {
    const { fornecedor_email, fornecedor_nome, chamado_numero, peca, token } = req.body;

    if (!fornecedor_email || !token || !chamado_numero || !peca) {
      return res.status(400).json({
        erro: "Campos obrigatórios faltando: fornecedor_email, token, chamado_numero, peca"
      });
    }

    const linkCotacao = `${process.env.FRONTEND_URL}/cotacao/${token}`;

    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || "noreply@quotaflow.com.br",
      to: fornecedor_email,
      subject: `Solicitação de Cotação - ${chamado_numero}`,
      html: `
        <h2>Solicitação de Cotação</h2>
        <p>Olá ${fornecedor_nome || "Fornecedor"},</p>
        
        <p>Recebemos uma solicitação de cotação para o seguinte item:</p>
        
        <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
          <tr style="background-color: #f0f0f0;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Número</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${chamado_numero}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Peça/Componente</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${peca}</td>
          </tr>
        </table>
        
        <p>Por favor, clique no link abaixo para responder com sua cotação:</p>
        <p><a href="${linkCotacao}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Responder Cotação</a></p>
        
        <p>Se o link acima não funcionar, copie e cole esta URL no seu navegador:</p>
        <p><code>${linkCotacao}</code></p>
        
        <p>Obrigado por sua parceria!</p>
        
        <hr style="margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">
          Este é um email automático. Por favor, não responda este email.<br>
          Sistema Quotaflow - Gestão de Cotações
        </p>
      `
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    res.json({
      ok: true,
      mensagem: `Cotação enviada para ${fornecedor_email}`,
      email_id: result.data.id
    });

  } catch (err) {
    console.error("❌ Erro ao enviar cotação:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/email/resultado - Notificar resultado para fornecedor
// ─────────────────────────────────────────────────────────────────────────

router.post("/resultado", tenantMiddleware, async (req, res) => {
  try {
    const { fornecedor_email, fornecedor_nome, chamado_numero, ganhou, valor } = req.body;

    if (!fornecedor_email || !chamado_numero) {
      return res.status(400).json({
        erro: "Campos obrigatórios faltando: fornecedor_email, chamado_numero"
      });
    }

    const assunto = ganhou 
      ? `✅ Parabéns! Sua proposta foi aceita - ${chamado_numero}`
      : `Resultado da Cotação - ${chamado_numero}`;

    const conteudo = ganhou
      ? `
        <h2>Parabéns! 🎉</h2>
        <p>Sua proposta foi selecionada para o chamado <strong>${chamado_numero}</strong>.</p>
        ${valor ? `<p>Valor aceito: <strong>R$ ${valor.toFixed(2)}</strong></p>` : ""}
        <p>Em breve, você receberá mais informações sobre a próxima etapa.</p>
      `
      : `
        <h2>Resultado da Cotação</h2>
        <p>Obrigado por sua participação na cotação <strong>${chamado_numero}</strong>.</p>
        <p>Infelizmente, outra proposta foi selecionada desta vez.</p>
        <p>Continuaremos contando com sua parceria para futuras oportunidades!</p>
      `;

    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || "noreply@quotaflow.com.br",
      to: fornecedor_email,
      subject: assunto,
      html: `
        <p>Olá ${fornecedor_nome || "Fornecedor"},</p>
        ${conteudo}
        <hr style="margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">
          Este é um email automático. Por favor, não responda este email.<br>
          Sistema Quotaflow - Gestão de Cotações
        </p>
      `
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    res.json({
      ok: true,
      mensagem: `Email de resultado enviado para ${fornecedor_email}`,
      email_id: result.data.id
    });

  } catch (err) {
    console.error("❌ Erro ao enviar resultado:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/email/logs - Ver logs de emails (simples, sem persistência)
// ─────────────────────────────────────────────────────────────────────────

router.get("/logs", tenantMiddleware, async (req, res) => {
  try {
    res.json({
      mensagem: "Logs de email - funcionalidade em desenvolvimento",
      nota: "Para ver logs completos, integre com Resend Dashboard ou banco de dados"
    });
  } catch (err) {
    console.error("❌ Erro ao buscar logs:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;