// backend/services/NotificacaoService.js

const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');
const db = require('../db');

class NotificacaoService {
  constructor() {
    // Configurar SendGrid
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }

    // Configurar Twilio
    this.twilioClient = null;
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }

    this.sendgridFromEmail = process.env.SENDGRID_FROM_EMAIL || 'contato@quotaflow.com';
    this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || '+55119999999';
  }

  /**
   * Enviar cotação ao fornecedor via Email + WhatsApp
   * @param {string} cotacaoId - ID da cotação
   * @param {string} fornecedorId - ID do fornecedor
   * @param {string} token - Token de acesso público
   * @param {string} metodoPreferido - 'email' | 'whatsapp' | 'ambos'
   */
  async enviarCotacaoFornecedor(cotacaoId, fornecedorId, token, metodoPreferido = 'email') {
    try {
      // 1. Buscar dados da cotação
      const cotacao = await db.query(
        `SELECT c.id, c.numero, c.tenant_id, 
                COUNT(DISTINCT ci.id) as total_itens,
                SUM(ci.quantidade) as total_quantidade
         FROM cotacoes c
         LEFT JOIN cotacao_itens ci ON ci.cotacao_id = c.id
         WHERE c.id = $1
         GROUP BY c.id`,
        [cotacaoId]
      );

      if (cotacao.rows.length === 0) {
        throw new Error(`Cotação ${cotacaoId} não encontrada`);
      }

      const cotacaoData = cotacao.rows[0];

      // 2. Buscar dados do fornecedor
      const fornecedor = await db.query(
        `SELECT id, nome, email, telefone_whatsapp, razao_social
         FROM fornecedores
         WHERE id = $1 AND tenant_id = $2`,
        [fornecedorId, cotacaoData.tenant_id]
      );

      if (fornecedor.rows.length === 0) {
        throw new Error(`Fornecedor ${fornecedorId} não encontrado`);
      }

      const fornecedorData = fornecedor.rows[0];

      // 3. Buscar informações da empresa (tenant)
      const empresa = await db.query(
        `SELECT id, nome FROM tenants WHERE id = $1`,
        [cotacaoData.tenant_id]
      );

      const empresaData = empresa.rows[0];

      // 4. Construir URLs
      const portalUrl = `${process.env.QUOTAFLOW_PORTAL_URL}/cotacao/${cotacaoId}/${token}`;
      const linkResposta = `[Responder Cotação](${portalUrl})`;

      // 5. Preparar conteúdo
      const assunto = `Cotação #${cotacaoData.numero} - ${empresaData.nome}`;
      const mensagemEmail = this.gerarEmailCotacao(
        fornecedorData.nome,
        empresaData.nome,
        cotacaoData.numero,
        cotacaoData.total_itens,
        portalUrl
      );

      const mensagemWhatsApp = this.gerarMensagemWhatsApp(
        fornecedorData.nome,
        empresaData.nome,
        cotacaoData.numero,
        portalUrl
      );

      // 6. Enviar notificações
      const resultados = {
        email: false,
        whatsapp: false,
        erros: []
      };

      // Email
      if (metodoPreferido === 'email' || metodoPreferido === 'ambos') {
        try {
          await this.enviarEmail(
            fornecedorData.email,
            assunto,
            mensagemEmail,
            this.sendgridFromEmail
          );
          resultados.email = true;
          console.log(`✅ Email enviado para ${fornecedorData.email}`);
        } catch (erro) {
          resultados.erros.push(`Email: ${erro.message}`);
          console.error(`❌ Erro ao enviar email: ${erro.message}`);
        }
      }

      // WhatsApp
      if ((metodoPreferido === 'whatsapp' || metodoPreferido === 'ambos') && 
          fornecedorData.telefone_whatsapp && this.twilioClient) {
        try {
          await this.enviarWhatsApp(
            fornecedorData.telefone_whatsapp,
            mensagemWhatsApp
          );
          resultados.whatsapp = true;
          console.log(`✅ WhatsApp enviado para ${fornecedorData.telefone_whatsapp}`);
        } catch (erro) {
          resultados.erros.push(`WhatsApp: ${erro.message}`);
          console.error(`❌ Erro ao enviar WhatsApp: ${erro.message}`);
        }
      }

      // 7. Registrar no histórico
      await this.registrarNotificacao(
        cotacaoData.tenant_id,
        fornecedorId,
        cotacaoId,
        'cotacao_enviada',
        metodoPreferido,
        resultados.email || resultados.whatsapp
      );

      return {
        sucesso: resultados.email || resultados.whatsapp,
        resultados,
        portalUrl
      };

    } catch (erro) {
      console.error('Erro em enviarCotacaoFornecedor:', erro);
      throw erro;
    }
  }

  /**
   * Enviar lembrete de cotação pendente (após 24h sem resposta)
   */
  async enviarLembreteCotacao(cotacaoId, fornecedorId, token) {
    try {
      const cotacao = await db.query(
        `SELECT c.id, c.numero, c.tenant_id, c.criado_em
         FROM cotacoes c
         WHERE c.id = $1`,
        [cotacaoId]
      );

      const fornecedor = await db.query(
        `SELECT id, nome, email, telefone_whatsapp
         FROM fornecedores
         WHERE id = $1`,
        [fornecedorId]
      );

      if (cotacao.rows.length === 0 || fornecedor.rows.length === 0) {
        throw new Error('Cotação ou fornecedor não encontrado');
      }

      const empresaNome = 'Sua Empresa'; // TODO: buscar do tenant
      const portalUrl = `${process.env.QUOTAFLOW_PORTAL_URL}/cotacao/${cotacaoId}/${token}`;

      // Enviar lembrete
      const assunto = `⏰ Lembrete: Cotação #${cotacao.rows[0].numero} pendente de resposta`;
      const mensagem = `
Olá ${fornecedor.rows[0].nome},

Esta é uma mensagem de lembrete sobre a cotação #${cotacao.rows[0].numero} de ${empresaNome}.

Você ainda não respondeu esta solicitação. Por favor, clique no link abaixo para fornecer sua proposta:

${portalUrl}

Obrigado,
QuotaFlow
      `;

      await this.enviarEmail(
        fornecedor.rows[0].email,
        assunto,
        mensagem,
        this.sendgridFromEmail
      );

      await this.registrarNotificacao(
        cotacao.rows[0].tenant_id,
        fornecedorId,
        cotacaoId,
        'lembrete_cotacao',
        'email',
        true
      );

      return { sucesso: true };

    } catch (erro) {
      console.error('Erro em enviarLembreteCotacao:', erro);
      throw erro;
    }
  }

  /**
   * Notificar comprador que fornecedor respondeu cotação
   */
  async notificarRespostaCotacao(cotacaoId, fornecedorId, tenantId) {
    try {
      const cotacao = await db.query(
        `SELECT numero FROM cotacoes WHERE id = $1`,
        [cotacaoId]
      );

      const fornecedor = await db.query(
        `SELECT nome FROM fornecedores WHERE id = $1`,
        [fornecedorId]
      );

      // Buscar emails dos compradores
      const usuarios = await db.query(
        `SELECT email FROM usuarios 
         WHERE tenant_id = $1 AND perfil = 'comprador' AND ativo = true`,
        [tenantId]
      );

      const assunto = `✅ Cotação #${cotacao.rows[0].numero} - Resposta de ${fornecedor.rows[0].nome}`;
      const mensagem = `
Olá,

O fornecedor ${fornecedor.rows[0].nome} respondeu a cotação #${cotacao.rows[0].numero}.

Acesse o dashboard para ver os detalhes e comparar propostas.
      `;

      // Enviar para todos os compradores
      for (const usuario of usuarios.rows) {
        try {
          await this.enviarEmail(
            usuario.email,
            assunto,
            mensagem,
            this.sendgridFromEmail
          );
        } catch (erro) {
          console.error(`Erro ao notificar ${usuario.email}:`, erro.message);
        }
      }

      return { sucesso: true };

    } catch (erro) {
      console.error('Erro em notificarRespostaCotacao:', erro);
      throw erro;
    }
  }

  /**
   * Notificar fornecedor sobre Ordem de Venda emitida
   */
  async notificarOrdenVendaEmitida(ordemVendaId, fornecedorId, tenantId) {
    try {
      const ov = await db.query(
        `SELECT numero, valor_total FROM ordens_venda WHERE id = $1`,
        [ordemVendaId]
      );

      const fornecedor = await db.query(
        `SELECT nome, email, telefone_whatsapp FROM fornecedores WHERE id = $1`,
        [fornecedorId]
      );

      if (ov.rows.length === 0 || fornecedor.rows.length === 0) {
        throw new Error('OV ou fornecedor não encontrado');
      }

      const assunto = `📋 Ordem de Venda #${ov.rows[0].numero}`;
      const mensagem = `
Olá ${fornecedor.rows[0].nome},

Uma ordem de venda foi emitida baseada em sua cotação.

Detalhes:
- OV: #${ov.rows[0].numero}
- Valor Total: R$ ${(ov.rows[0].valor_total).toFixed(2)}

Por favor, confirme o recebimento e processe conforme habitual.

Obrigado,
QuotaFlow
      `;

      await this.enviarEmail(
        fornecedor.rows[0].email,
        assunto,
        mensagem,
        this.sendgridFromEmail
      );

      await this.registrarNotificacao(
        tenantId,
        fornecedorId,
        null,
        'ordem_venda_emitida',
        'email',
        true
      );

      return { sucesso: true };

    } catch (erro) {
      console.error('Erro em notificarOrdenVendaEmitida:', erro);
      throw erro;
    }
  }

  // ============ MÉTODOS PRIVADOS ============

  /**
   * Enviar email via SendGrid
   */
  async enviarEmail(para, assunto, mensagem, de = this.sendgridFromEmail) {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SendGrid não configurado. Email não será enviado.');
      return;
    }

    const msg = {
      to: para,
      from: de,
      subject: assunto,
      html: this.formatarEmailHTML(mensagem),
      text: mensagem
    };

    await sgMail.send(msg);
  }

  /**
   * Enviar WhatsApp via Twilio
   */
  async enviarWhatsApp(numeroTelefone, mensagem) {
    if (!this.twilioClient) {
      console.warn('Twilio não configurado. WhatsApp não será enviado.');
      return;
    }

    // Garantir que o número está no formato internacional
    let numero = numeroTelefone.replace(/\D/g, '');
    if (!numero.startsWith('55')) {
      numero = '55' + numero;
    }

    await this.twilioClient.messages.create({
      body: mensagem,
      from: `whatsapp:${this.twilioPhoneNumber}`,
      to: `whatsapp:+${numero}`
    });
  }

  /**
   * Gerar template de email de cotação
   */
  gerarEmailCotacao(nomeFornecedor, nomeEmpresa, numeroCotacao, totalItens, portalUrl) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2563eb; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
    .content { background-color: #f9fafb; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
    .button { background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none; display: inline-block; }
    .footer { color: #666; font-size: 12px; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Solicitação de Cotação</h1>
    </div>
    
    <div class="content">
      <p>Olá <strong>${nomeFornecedor}</strong>,</p>
      
      <p><strong>${nomeEmpresa}</strong> solicitou uma cotação com os seguintes detalhes:</p>
      
      <ul>
        <li><strong>Número da Cotação:</strong> #${numeroCotacao}</li>
        <li><strong>Total de Itens:</strong> ${totalItens}</li>
        <li><strong>Status:</strong> Aguardando sua resposta</li>
      </ul>
      
      <p>Por favor, clique no botão abaixo para acessar o portal e fornecer sua proposta:</p>
      
      <p style="text-align: center; margin: 20px 0;">
        <a href="${portalUrl}" class="button">Responder Cotação</a>
      </p>
      
      <p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
      <p style="word-break: break-all; background-color: #fff; padding: 10px; border-radius: 3px;">
        ${portalUrl}
      </p>
      
      <p><strong>Este link é válido por 30 dias.</strong></p>
    </div>
    
    <div class="footer">
      <p>QuotaFlow - Gestão de Cotações para Frotistas</p>
      <p>Não responda este email. Use o portal para responder.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Gerar mensagem WhatsApp
   */
  gerarMensagemWhatsApp(nomeFornecedor, nomeEmpresa, numeroCotacao, portalUrl) {
    return `
Olá ${nomeFornecedor}! 👋

${nomeEmpresa} enviou uma cotação para você através do QuotaFlow.

📋 *Cotação #${numeroCotacao}*

Por favor, acesse o link abaixo para fornecer sua proposta:

${portalUrl}

Obrigado! 🙏

QuotaFlow
    `;
  }

  /**
   * Formatar mensagem em HTML
   */
  formatarEmailHTML(mensagem) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <pre>${mensagem.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </div>
</body>
</html>
    `;
  }

  /**
   * Registrar notificação no histórico
   */
  async registrarNotificacao(tenantId, fornecedorId, cotacaoId, tipo, metodo, sucesso) {
    try {
      await db.query(
        `INSERT INTO notificacoes (tenant_id, fornecedor_id, cotacao_id, tipo, metodo, sucesso, criado_em)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [tenantId, fornecedorId, cotacaoId, tipo, metodo, sucesso]
      );
    } catch (erro) {
      console.error('Erro ao registrar notificação:', erro);
      // Não lancar erro, apenas logar
    }
  }

  /**
   * Obter histórico de notificações
   */
  async obterHistoricoNotificacoes(fornecedorId, limite = 50) {
    try {
      const resultado = await db.query(
        `SELECT id, tipo, metodo, sucesso, criado_em
         FROM notificacoes
         WHERE fornecedor_id = $1
         ORDER BY criado_em DESC
         LIMIT $2`,
        [fornecedorId, limite]
      );

      return resultado.rows;
    } catch (erro) {
      console.error('Erro ao obter histórico:', erro);
      return [];
    }
  }
}

module.exports = NotificacaoService;
