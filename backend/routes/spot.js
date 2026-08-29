const express = require('express');
const router = express.Router();
const { DB } = require('../db');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const { enviarEmailCotacao } = require('../services/emailService');

// ────────────────────────────────────────────────
// 1. CRIAR UMA DEMANDA SPOT
// ────────────────────────────────────────────────
router.post('/demandas', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const compradorId = req.userId;
    const {
      descricao_equipamento,
      marca_modelo,
      componente,
      part_number,
      quantidade,
      comentarios,
      urgencia = 'media'
    } = req.body;

    // Validação básica
    if (!descricao_equipamento || !componente || !quantidade) {
      return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
    }

    const demanda = await DB.insert('demandas_spot', {
      tenant_id: tenantId,
      comprador_id: compradorId,
      descricao_equipamento,
      marca_modelo,
      componente,
      part_number,
      quantidade,
      comentarios,
      urgencia,
      status: 'aberta'
    }, tenantId);

    res.status(201).json({ ok: true, demanda });
  } catch (err) {
    console.error('❌ Erro ao criar demanda spot:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ────────────────────────────────────────────────
// 2. LISTAR DEMANDAS DO TENANT (COMPRADOR)
// ────────────────────────────────────────────────
router.get('/demandas', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { status } = req.query;

    let query = `
      SELECT 
        ds.*,
        COUNT(i.id) as total_interesses,
        COUNT(CASE WHEN i.status = 'pendente' THEN 1 END) as interesses_pendentes,
        COUNT(CASE WHEN m.lida = false THEN 1 END) as msg_nao_lidas
      FROM demandas_spot ds
      LEFT JOIN interesses_spot i ON i.demanda_id = ds.id
      LEFT JOIN mensagens_chat m ON m.interesse_id = i.id AND m.remetente_id != ds.comprador_id
      WHERE ds.tenant_id = $1
    `;

    const params = [tenantId];

    if (status && status !== 'todos') {
      query += ` AND ds.status = $${params.length + 1}`;
      params.push(status);
    }

    query += `
      GROUP BY ds.id
      ORDER BY ds.criado_em DESC
    `;

    const demandas = await DB.raw(query, params);
    res.json(demandas);
  } catch (err) {
    console.error('❌ Erro ao listar demandas:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ────────────────────────────────────────────────
// 3. BUSCAR DEMANDA POR ID (DETALHES)
// ────────────────────────────────────────────────
router.get('/demandas/:id', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    // Buscar demanda
    const demanda = await DB.selectOne('demandas_spot', { id, tenant_id: tenantId }, tenantId);
    if (!demanda) {
      return res.status(404).json({ erro: 'Demanda não encontrada' });
    }

    // Buscar interesses com dados do fornecedor e últimas mensagens
    const interesses = await DB.raw(`
      SELECT 
        i.*,
        f.nome as fornecedor_nome,
        f.email as fornecedor_email,
        f.telefone as fornecedor_telefone,
        f.whatsapp as fornecedor_whatsapp,
        (
          SELECT texto 
          FROM mensagens_chat 
          WHERE interesse_id = i.id 
          ORDER BY criado_em DESC 
          LIMIT 1
        ) as ultima_mensagem
      FROM interesses_spot i
      JOIN fornecedores f ON f.id = i.fornecedor_id AND f.tenant_id = i.tenant_id
      WHERE i.demanda_id = $1 AND i.tenant_id = $2
      ORDER BY i.criado_em DESC
    `, [id, tenantId]);

    res.json({ ...demanda, interesses });
  } catch (err) {
    console.error('❌ Erro ao buscar demanda:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ────────────────────────────────────────────────
// 4. FORNECEDOR SE INTERESSA POR UMA DEMANDA
// ────────────────────────────────────────────────
router.post('/interesse', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const fornecedorId = req.userId; // ou req.fornecedorId, dependendo do seu auth
    const { demanda_id, mensagem } = req.body;

    // Verificar se já existe interesse
    const existente = await DB.selectOne('interesses_spot', {
      demanda_id,
      fornecedor_id: fornecedorId
    }, tenantId);

    if (existente) {
      return res.status(409).json({ erro: 'Você já manifestou interesse nesta demanda' });
    }

    const interesse = await DB.insert('interesses_spot', {
      tenant_id: tenantId,
      demanda_id,
      fornecedor_id: fornecedorId,
      mensagem: mensagem || '',
      status: 'pendente'
    }, tenantId);

    // Notificar o comprador (e-mail)
    const demanda = await DB.selectOne('demandas_spot', { id: demanda_id }, tenantId);
    const fornecedor = await DB.selectOne('fornecedores', { id: fornecedorId }, tenantId);
    const comprador = await DB.selectOne('usuarios', { id: demanda.comprador_id }, tenantId);

    if (comprador?.email) {
      const assunto = `Novo interesse na demanda spot: ${demanda.componente}`;
      const corpo = `
        <h2>Novo interesse recebido!</h2>
        <p>O fornecedor <strong>${fornecedor?.nome}</strong> se interessou pela sua demanda:</p>
        <p><strong>Componente:</strong> ${demanda.componente}</p>
        <p><strong>Equipamento:</strong> ${demanda.equipamento}</p>
        <p><strong>Quantidade:</strong> ${demanda.quantidade}</p>
        <p>Mensagem do fornecedor: <em>${mensagem || 'Sem mensagem adicional'}</em></p>
        <p><a href="${process.env.FRONTEND_URL}/#/spot/demanda/${demanda_id}">Ver demanda</a></p>
        <hr>
        <p><small>Esta é uma mensagem automática. Não responda este e-mail.</small></p>
      `;
      await enviarEmailCotacao(comprador.email, assunto, corpo);
    }

    res.status(201).json({ ok: true, interesse });
  } catch (err) {
    console.error('❌ Erro ao registrar interesse:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ────────────────────────────────────────────────
// 5. ENVIAR MENSAGEM NO CHAT
// ────────────────────────────────────────────────
router.post('/chat', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const remetenteId = req.userId;
    const { interesse_id, texto } = req.body;

    if (!interesse_id || !texto) {
      return res.status(400).json({ erro: 'interesse_id e texto são obrigatórios' });
    }

    const mensagem = await DB.insert('mensagens_chat', {
      interesse_id,
      remetente_id: remetenteId,
      texto,
      lida: false,
      criado_em: new Date()
    }, tenantId);

    res.status(201).json({ ok: true, mensagem });
  } catch (err) {
    console.error('❌ Erro ao enviar mensagem:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ────────────────────────────────────────────────
// 6. ATUALIZAR STATUS DA DEMANDA
// ────────────────────────────────────────────────
router.patch('/demandas/:id/status', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { status } = req.body;

    if (!['aberta', 'em_negociacao', 'encerrada'].includes(status)) {
      return res.status(400).json({ erro: 'Status inválido' });
    }

    await DB.update('demandas_spot', id, {
      status,
      atualizado_em: new Date()
    }, tenantId);

    res.json({ ok: true, status });
  } catch (err) {
    console.error('❌ Erro ao atualizar status:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/*
// ────────────────────────────────────────────────
// 7. LISTAR DEMANDAS PARA O FORNECEDOR (PORTAL)
// ────────────────────────────────────────────────
router.get('/publicas', async (req, res) => {
  try {
    // Rota pública (sem autenticação) para fornecedores verem demandas abertas
    const demandas = await DB.raw(`
      SELECT 
        ds.id, ds.tenant_id, ds.descricao_equipamento,
        ds.marca_modelo, ds.componente, ds.part_number, ds.quantidade,
        ds.comentarios, ds.urgencia, ds.criado_em,
        t.nome as empresa_nome,
        (
          SELECT COUNT(*) 
          FROM interesses_spot i 
          WHERE i.demanda_id = ds.id
        ) as total_interesses
      FROM demandas_spot ds
      JOIN tenants t ON t.id = ds.tenant_id
      WHERE ds.status = 'aberta'
      ORDER BY ds.criado_em DESC
    `);

    res.json(demandas);
  } catch (err) {
    console.error('❌ Erro ao listar demandas públicas:', err.message);
    res.status(500).json({ erro: err.message });
  }
});
*/

module.exports = router;