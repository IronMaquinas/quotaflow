const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports = {
  enviarEmailCotacao: async (email, assunto, corpo) => {
    try {
      const msg = {
        to: email,
        from: 'noreply@quotaflow.com.br', // Mude pra seu email
        subject: assunto,
        html: corpo,
      };

      await sgMail.send(msg);
      console.log(`✅ Email enviado para ${email}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Erro ao enviar email:`, error);
      throw error;
    }
  },

  enviarEmailFornecedor: async (email, assunto, corpo) => {
    try {
      const msg = {
        to: email,
        from: 'noreply@quotaflow.com.br',
        subject: assunto,
        html: corpo,
      };

      await sgMail.send(msg);
      console.log(`✅ Email enviado para ${email}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Erro ao enviar email:`, error);
      throw error;
    }
  },
};