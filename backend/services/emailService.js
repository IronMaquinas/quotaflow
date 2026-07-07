const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "cotacoes@suaempresa.com.br";
const EMPRESA = process.env.EMPRESA_NOME || "Minha Empresa";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// ── E-mail: solicitação de cotação para fornecedor ──
async function enviarEmailCotacao(chamado, fornecedor, token) {
  const link = `${FRONTEND_URL}/cotacao/${token}`;
  const urgenciaLabel = { alta: "🔴 URGENTE — equipamento parado", media: "🟡 Necessário em breve", baixa: "🟢 Preventiva" };

  await resend.emails.send({
    from: FROM,
    to: fornecedor.email,
    subject: `Solicitação de Cotação — ${chamado.peca} [${chamado.numero}]`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px">
        <div style="background:#111827;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="color:#f0f6fc;margin:0;font-size:18px">QuotaFlow · ${EMPRESA}</h2>
          <p style="color:#8b949e;margin:4px 0 0;font-size:12px">Portal de Cotações</p>
        </div>
        <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <p>Prezado(a) <strong>${fornecedor.nome}</strong>,</p>
          <p>Solicitamos sua cotação para o item abaixo:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr style="background:#f9fafb"><td style="padding:8px 12px;font-size:12px;color:#6b7280;border:1px solid #e5e7eb">Peça / Item</td><td style="padding:8px 12px;font-weight:bold;border:1px solid #e5e7eb">${chamado.peca}</td></tr>
            ${chamado.codigo ? `<tr><td style="padding:8px 12px;font-size:12px;color:#6b7280;border:1px solid #e5e7eb">Código</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${chamado.codigo}</td></tr>` : ""}
            <tr style="background:#f9fafb"><td style="padding:8px 12px;font-size:12px;color:#6b7280;border:1px solid #e5e7eb">Equipamento</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${chamado.equipamento_nome || chamado.equipamento || "—"}</td></tr>
            <tr><td style="padding:8px 12px;font-size:12px;color:#6b7280;border:1px solid #e5e7eb">Urgência</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${urgenciaLabel[chamado.urgencia] || chamado.urgencia}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px 12px;font-size:12px;color:#6b7280;border:1px solid #e5e7eb">Referência</td><td style="padding:8px 12px;font-family:monospace;border:1px solid #e5e7eb">${chamado.numero}</td></tr>
          </table>
          <p>Para enviar sua proposta de forma rápida, acesse o link abaixo:</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${link}" style="background:#238636;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px">
              Enviar minha proposta →
            </a>
          </div>
          <p style="font-size:12px;color:#6b7280">Ou copie o link: <a href="${link}" style="color:#3b82f6">${link}</a></p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
          <p style="font-size:12px;color:#6b7280">Aguardamos seu retorno em até <strong>24 horas</strong>.<br>Sua proposta é confidencial — outros fornecedores não têm acesso aos seus valores.</p>
        </div>
      </div>
    `,
  });
}

// ── E-mail: confirmação para o fornecedor após envio ──
async function enviarEmailConfirmacaoFornecedor(chamado, fornecedor, resposta) {
  await resend.emails.send({
    from: FROM,
    to: fornecedor.fornecedor_email,
    subject: `✅ Proposta recebida — ${chamado.peca} [${chamado.numero}]`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px">
        <div style="background:#0f2f1a;padding:20px 24px;border-radius:8px 8px 0 0;border-left:4px solid #22c55e">
          <h2 style="color:#22c55e;margin:0">✅ Proposta recebida com sucesso</h2>
        </div>
        <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <p>Sua proposta para <strong>${chamado.peca}</strong> foi registrada.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr style="background:#f9fafb"><td style="padding:8px 12px;font-size:12px;color:#6b7280;border:1px solid #e5e7eb">Referência</td><td style="padding:8px 12px;font-family:monospace;border:1px solid #e5e7eb">${chamado.numero}</td></tr>
            <tr><td style="padding:8px 12px;font-size:12px;color:#6b7280;border:1px solid #e5e7eb">Valor informado</td><td style="padding:8px 12px;font-weight:bold;color:#22c55e;border:1px solid #e5e7eb">R$ ${Number(resposta.valor).toFixed(2).replace(".",",")}</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px 12px;font-size:12px;color:#6b7280;border:1px solid #e5e7eb">Frete</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${resposta.frete || "CIF"}${resposta.valor_frete > 0 ? ` — R$ ${Number(resposta.valor_frete).toFixed(2).replace(".",",")}` : " (incluso)"}</td></tr>
            <tr><td style="padding:8px 12px;font-size:12px;color:#6b7280;border:1px solid #e5e7eb">Prazo informado</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${resposta.prazo} dias úteis</td></tr>
            <tr style="background:#f9fafb"><td style="padding:8px 12px;font-size:12px;color:#6b7280;border:1px solid #e5e7eb">Data/hora</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${new Date().toLocaleString("pt-BR")}</td></tr>
          </table>
          <p style="font-size:12px;color:#6b7280">O comprador entrará em contato. Guarde este e-mail como comprovante da sua proposta.</p>
        </div>
      </div>
    `,
  });
}

// ── E-mail: resultado da cotação para fornecedor ──
async function enviarEmailResultado(chamado, fornecedor, ganhou) {
  const assunto = ganhou
    ? `🏆 Parabéns! Sua proposta foi selecionada — ${chamado.numero}`
    : `Resultado da cotação — ${chamado.numero}`;
  const corpo = ganhou
    ? `<p>Sua proposta para <strong>${chamado.peca}</strong> foi <strong style="color:#22c55e">selecionada</strong>! O comprador entrará em contato para confirmar o pedido.</p>`
    : `<p>Agradecemos sua participação na cotação de <strong>${chamado.peca}</strong>. Desta vez selecionamos outra proposta, mas continuaremos contando com você nas próximas cotações.</p>`;

  await resend.emails.send({
    from: FROM,
    to: fornecedor.fornecedor_email,
    subject: assunto,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px">
        <div style="background:${ganhou?"#0f2f1a":"#1c1c1e"};padding:20px 24px;border-radius:8px 8px 0 0;border-left:4px solid ${ganhou?"#22c55e":"#6b7280"}">
          <h2 style="color:${ganhou?"#22c55e":"#9ca3af"};margin:0">${ganhou?"🏆 Proposta selecionada":"Obrigado pela participação"}</h2>
        </div>
        <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          ${corpo}
          <p style="font-size:12px;color:#6b7280">Referência: ${chamado.numero}<br>Empresa: ${EMPRESA}</p>
        </div>
      </div>
    `,
  });
}

// ── E-mail: notificação de resposta recebida (para o comprador) ──
async function enviarEmailRespostaRecebida(cotacaoFornecedor) {
  // Buscar e-mail do comprador responsável
  const chamado = require("../db").prepare(`
    SELECT c.*, u.email as comprador_email
    FROM chamados c
    JOIN cotacoes co ON co.chamado_id = c.id
    LEFT JOIN usuarios u ON u.perfil IN ('comprador','gestor')
    WHERE co.id = ?
    LIMIT 1
  `).get(cotacaoFornecedor.cotacao_id);

  if (!chamado?.comprador_email) return;

  await resend.emails.send({
    from: FROM,
    to: chamado.comprador_email,
    subject: `📬 Cotação respondida — ${chamado.peca} [${chamado.numero}]`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px">
        <p><strong>${cotacaoFornecedor.fornecedor_nome}</strong> respondeu a cotação de <strong>${chamado.peca}</strong>.</p>
        <p>Valor: <strong style="color:#22c55e">R$ ${Number(cotacaoFornecedor.valor).toFixed(2).replace(".",",")}</strong> · Prazo: ${cotacaoFornecedor.prazo} dias</p>
        <a href="${FRONTEND_URL}" style="background:#3b82f6;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:12px">Ver no QuotaFlow →</a>
      </div>
    `,
  });
}

module.exports = { enviarEmailCotacao, enviarEmailConfirmacaoFornecedor, enviarEmailResultado, enviarEmailRespostaRecebida };
