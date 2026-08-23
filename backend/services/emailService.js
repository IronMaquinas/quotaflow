// services/emailService.js
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = {
  /**
   * Envia e-mail para fornecedor com link para responder cotação
   */
  enviarEmailCotacao: async (email, assunto, corpo) => {
    // 🔍 LOGS DE DEPURAÇÃO
    console.log(`📧 [enviarEmailCotacao] Para: ${email}`);
    console.log(`📧 [enviarEmailCotacao] Assunto: ${assunto}`);
    console.log(`📧 [enviarEmailCotacao] Tamanho do corpo: ${corpo ? corpo.length : 0} caracteres`);
    console.log(`📧 [enviarEmailCotacao] Início do corpo: ${corpo ? corpo.substring(0, 200) : 'VAZIO'}...`);

    if (!corpo || corpo.trim().length === 0) {
      console.warn(`⚠️ [enviarEmailCotacao] CORPO VAZIO para ${email}!`);
    }

    try {
      const { data, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
        to: email,
        subject: assunto,
        html: corpo,
        // 🔧 Opcional: adicione versão em texto plano para melhor entregabilidade
        // text: corpo.replace(/<[^>]*>/g, ''), // remove tags HTML para versão texto
      });

      if (error) throw error;

      console.log(`✅ E-mail enviado com sucesso para ${email}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Falha ao enviar e-mail para ${email}:`, error);
      throw error;
    }
  },

  /**
   * Envia e-mail genérico para fornecedor (mantido para compatibilidade)
   */
  enviarEmailFornecedor: async (email, assunto, corpo) => {
    console.log(`📧 [enviarEmailFornecedor] Para: ${email}`);
    console.log(`📧 [enviarEmailFornecedor] Assunto: ${assunto}`);
    console.log(`📧 [enviarEmailFornecedor] Tamanho do corpo: ${corpo ? corpo.length : 0} caracteres`);

    try {
      const { data, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
        to: email,
        subject: assunto,
        html: corpo,
      });

      if (error) throw error;

      console.log(`✅ E-mail genérico enviado para ${email}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Falha ao enviar e-mail genérico para ${email}:`, error);
      throw error;
    }
  },

  /**
   * Notifica comprador quando fornecedor responde
   */
  enviarEmailRespostaRecebida: async (cotacaoForn) => {
    console.log(`📧 [Resend] Notificação de resposta para comprador:`, cotacaoForn);
    return { success: true };
  },

  /**
   * Envia resultado da cotação (ganhou/perdeu)
   */
  enviarEmailResultado: async (chamado, fornecedor, ganhou) => {
    console.log(`📧 [Resend] Resultado para fornecedor ${fornecedor.fornecedor_nome}: ${ganhou ? 'GANHOU' : 'PERDEU'}`);
    return { success: true };
  }
};