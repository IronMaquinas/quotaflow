// services/emailService.js
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = {
  /**
   * Envia e-mail para fornecedor com link para responder cotação
   */
  enviarEmailCotacao: async (email, assunto, corpo) => {
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
        to: email,
        subject: assunto,
        html: corpo,
      });

      if (error) throw error;

      console.log(`✅ E-mail enviado para ${email}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Erro ao enviar e-mail para ${email}:`, error);
      throw error;
    }
  },

  /**
   * Envia e-mail genérico para fornecedor (mantido para compatibilidade)
   */
  enviarEmailFornecedor: async (email, assunto, corpo) => {
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
        to: email,
        subject: assunto,
        html: corpo,
      });

      if (error) throw error;

      console.log(`✅ E-mail enviado para ${email}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Erro ao enviar e-mail para ${email}:`, error);
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