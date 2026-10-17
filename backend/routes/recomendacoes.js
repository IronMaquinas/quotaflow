// backend/routes/recomendacoes.js
//
// E-mails de recomendação do Canal Spot (plano Pro do fornecedor).
//
//   POST /api/recomendacoes/resumo-diario
//        Disparado pelo agendador (Supabase pg_cron às 7h, ou node-cron interno
//        se CRON_INTERNO=1). Protegido pelo cabeçalho  x-cron-secret: <CRON_SECRET>.
//
//   GET  /api/recomendacoes/descadastrar/:token
//        Link do rodapé do e-mail (LGPD). Desliga só as recomendações —
//        pedidos de cotação e OCs continuam chegando.
//   POST /api/recomendacoes/descadastrar/:token
//        Descadastro em 1 clique do botão nativo do Gmail/Outlook
//        (cabeçalho List-Unsubscribe-Post).
//
// Sem tenantMiddleware/fornecedorMiddleware de propósito: quem chama é o
// agendador (com segredo) ou o próprio fornecedor clicando no e-mail (com token).

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { enviarResumoDiario, descadastrarPorToken } = require('../services/recomendacoesEmail');

function segredoConfere(recebido) {
  const esperado = process.env.CRON_SECRET || '';
  if (!esperado || esperado.length < 16 || !recebido) return false;
  const a = Buffer.from(String(recebido));
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

let resumoRodando = false;

router.post('/resumo-diario', async (req, res) => {
  if (!segredoConfere(req.get('x-cron-secret'))) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }
  if (resumoRodando) return res.status(409).json({ erro: 'Resumo já está em andamento' });
  resumoRodando = true;
  try {
    res.json({ ok: true, ...(await enviarResumoDiario()) });
  } catch (err) {
    console.error('❌ POST /recomendacoes/resumo-diario:', err.message);
    res.status(500).json({ erro: err.message });
  } finally {
    resumoRodando = false;
  }
});

function pagina(titulo, texto) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;color:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;">
<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:28px;max-width:440px;text-align:center;">
<div style="font-size:12px;color:#64748b;letter-spacing:.08em;">QUOTAFLOW</div>
<h1 style="font-size:20px;margin:8px 0 10px;">${titulo}</h1>
<p style="font-size:14px;color:#475569;line-height:1.5;margin:0;">${texto}</p>
</div></body></html>`;
}

router.get('/descadastrar/:token', async (req, res) => {
  try {
    const f = await descadastrarPorToken(req.params.token);
    if (!f) {
      return res.status(404).type('html').send(pagina('Link inválido', 'Este link de descadastro não é válido ou já expirou.'));
    }
    res.type('html').send(pagina(
      'Pronto, você não receberá mais recomendações',
      'As recomendações do Canal Spot por e-mail foram desligadas. Pedidos de cotação e ordens de compra continuam chegando normalmente. Para voltar a receber, ative em <b>Meus Dados</b> no portal.'
    ));
  } catch (err) {
    console.error('❌ GET /recomendacoes/descadastrar:', err.message);
    res.status(500).type('html').send(pagina('Algo deu errado', 'Tente novamente em alguns minutos.'));
  }
});

// Botão "Cancelar inscrição" do Gmail/Outlook (RFC 8058): POST sem corpo útil
router.post('/descadastrar/:token', async (req, res) => {
  try {
    const f = await descadastrarPorToken(req.params.token);
    res.status(f ? 200 : 404).json({ ok: !!f });
  } catch (err) {
    console.error('❌ POST /recomendacoes/descadastrar:', err.message);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;
