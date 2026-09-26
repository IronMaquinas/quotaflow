// routes/fornecedorNC.js
//
// M4 — Não Conformidades expostas ao fornecedor logado. Só o que diz
// respeito a ele: NCs com `fornecedor_id === req.fornecedorId`. Sem
// vazar dados internos (5 porquês, custos, plano de ação da qualidade).
//
// O fornecedor pode:
//   • Listar NCs dele
//   • Ver detalhe (com eventos visíveis)
//   • Responder (mensagem na thread)
//   • Anexar evidência
//   • Marcar tratativa: aceitar / contestar / resolver

const express = require('express');
const router = express.Router();
const { DB, supabase } = require('../db');
const fornecedorMiddleware = require('../middleware/fornecedorMiddleware');

const BUCKET_NC_EVIDENCIAS = 'nfe-xmls'; // reusa o mesmo bucket (ou cria 'nc-evidencias')

// ─────────────────────────────────────────────────────────────────────────
// GET /api/fornecedor/nao-conformidades
// ─────────────────────────────────────────────────────────────────────────
router.get('/', fornecedorMiddleware, async (req, res) => {
  try {
    const todas = await DB.select('nao_conformidades', {}, null);
    const minhas = todas.filter(nc =>
      String(nc.fornecedor_id) === String(req.fornecedorId)
    );

    if (minhas.length === 0) return res.json({ ncs: [] });

    // Enriquece com número da OC
    const ovIds = [...new Set(minhas.map(nc => nc.ordem_venda_id).filter(Boolean))];
    const todasOv = await DB.select('ordens_venda', {}, null);
    const ovPorId = {};
    todasOv.filter(ov => ovIds.includes(ov.id)).forEach(ov => { ovPorId[ov.id] = ov; });

    const ncs = minhas.map(nc => ({
      id: nc.id,
      numero_nc: nc.numero_nc,
      origem: nc.origem,
      descricao_problema: nc.descricao_problema,
      motivo_recusa: nc.motivo_recusa,
      quantidade: nc.quantidade,
      unidade_medida: nc.unidade_medida,
      numero_nota_fiscal: nc.numero_nota_fiscal,
      numero_pedido: nc.numero_pedido,
      ordem_venda_id: nc.ordem_venda_id,
      status: nc.status,
      disposicao: nc.disposicao,
      fornecedor_tratativa_status: nc.fornecedor_tratativa_status,
      fornecedor_ciente_em: nc.fornecedor_ciente_em,
      criado_em: nc.criado_em,
    })).sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0));

    res.json({ ncs });
  } catch (err) {
    console.error('❌ Erro em /fornecedor/nao-conformidades:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/fornecedor/nao-conformidades/:ncId
// ─────────────────────────────────────────────────────────────────────────
router.get('/:ncId', fornecedorMiddleware, async (req, res) => {
  try {
    const ncId = parseInt(req.params.ncId, 10);
    if (!ncId) return res.status(400).json({ erro: 'ID inválido' });

    const nc = await DB.selectOne('nao_conformidades', { id: ncId }, null);
    if (!nc) return res.status(404).json({ erro: 'NC não encontrada' });
    if (String(nc.fornecedor_id) !== String(req.fornecedorId)) {
      return res.status(403).json({ erro: 'Acesso negado a esta NC' });
    }

    // Marca "ciente" na primeira leitura
    if (!nc.fornecedor_ciente_em) {
      await DB.update('nao_conformidades', ncId, {
        fornecedor_ciente_em: new Date().toISOString(),
      }, nc.tenant_id);
    }

    // Eventos visíveis pro fornecedor
    const todosEventos = await DB.select('nao_conformidade_eventos', { nc_id: ncId, tenant_id: nc.tenant_id }, nc.tenant_id);
    const eventosVisiveis = todosEventos
      .filter(ev => ev.visivel_fornecedor === true)
      .sort((a, b) => new Date(a.criado_em || 0) - new Date(b.criado_em || 0));

    // Anexos que o comprador deixou visíveis (por enquanto, todos os da NC)
    const anexos = await DB.select('nao_conformidade_anexos', { nc_id: ncId, tenant_id: nc.tenant_id }, nc.tenant_id);

    // Número da OC
    const ov = nc.ordem_venda_id
      ? await DB.selectOne('ordens_venda', { id: nc.ordem_venda_id }, nc.tenant_id)
      : null;

    res.json({
      cabecalho: {
        id: nc.id,
        numero_nc: nc.numero_nc,
        origem: nc.origem,
        status: nc.status,
        disposicao: nc.disposicao,
        fornecedor_tratativa_status: nc.fornecedor_tratativa_status,
        fornecedor_ciente_em: nc.fornecedor_ciente_em,
        criado_em: nc.criado_em,
        numero_nota_fiscal: nc.numero_nota_fiscal,
        numero_pedido: nc.numero_pedido,
        ordem_venda_numero: ov?.numero || null,
        quantidade: nc.quantidade,
        unidade_medida: nc.unidade_medida,
        lote: nc.lote,
        numero_serie: nc.numero_serie,
        validade: nc.validade,
      },
      descricao_problema: nc.descricao_problema,
      motivo_recusa: nc.motivo_recusa,
      eventos: eventosVisiveis,
      anexos,
    });
  } catch (err) {
    console.error('❌ Erro em /fornecedor/nao-conformidades/:id:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/fornecedor/nao-conformidades/:ncId/mensagem
// Body: { descricao }
// ─────────────────────────────────────────────────────────────────────────
router.post('/:ncId/mensagem', fornecedorMiddleware, async (req, res) => {
  try {
    const ncId = parseInt(req.params.ncId, 10);
    const { descricao } = req.body;
    if (!descricao || !descricao.trim()) {
      return res.status(400).json({ erro: 'descricao é obrigatória' });
    }

    const nc = await DB.selectOne('nao_conformidades', { id: ncId }, null);
    if (!nc) return res.status(404).json({ erro: 'NC não encontrada' });
    if (String(nc.fornecedor_id) !== String(req.fornecedorId)) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const forn = await DB.selectOne('fornecedores', { id: req.fornecedorId }, null);
    const fornUser = req.userId
      ? await DB.selectOne('fornecedor_usuarios', { id: req.userId }, null)
      : null;

    const evento = await DB.insert('nao_conformidade_eventos', {
      tenant_id: nc.tenant_id,
      nc_id: ncId,
      tipo: 'comentario',
      descricao: descricao.trim(),
      dados: null,
      criado_por: req.userId || null,
      criado_por_nome: fornUser?.nome || forn?.nome || 'Fornecedor',
      visivel_fornecedor: true,
      autor_tipo: 'fornecedor',
    }, nc.tenant_id);

    // Notifica o comprador (best-effort)
    try {
      const comprador = nc.inspetor_id
        ? await DB.selectOne('usuarios', { id: nc.inspetor_id }, nc.tenant_id)
        : null;
      if (comprador?.email) {
        const { enviarEmailCotacao } = require('../services/emailService');
        const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
        const corpo = `
          <h2>Resposta do fornecedor na NC ${nc.numero_nc}</h2>
          <p><strong>${forn?.nome || 'Fornecedor'}</strong> respondeu:</p>
          <blockquote style="border-left:3px solid #3b82f6;padding-left:12px;color:#555;">
            ${descricao.trim()}
          </blockquote>
          <p>Abra o QuotaFlow → Não Conformidades para ver a thread completa:</p>
          <p><a href="${baseUrl}/#dashboard">Abrir QuotaFlow</a></p>
          <hr/>
          <p><small>Mensagem automática do QuotaFlow.</small></p>
        `;
        await enviarEmailCotacao(comprador.email, `NC ${nc.numero_nc} — resposta do fornecedor`, corpo);
      }
    } catch (mailErr) {
      console.warn('⚠ Falha ao notificar comprador:', mailErr.message);
    }

    res.status(201).json({ ok: true, evento });
  } catch (err) {
    console.error('❌ Erro em /mensagem:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/fornecedor/nao-conformidades/:ncId/anexo
// Body: multipart — campo "arquivo"
// ─────────────────────────────────────────────────────────────────────────
router.post('/:ncId/anexo', fornecedorMiddleware, async (req, res) => {
  try {
    const ncId = parseInt(req.params.ncId, 10);
    const arquivo = req.files?.arquivo;
    if (!arquivo) return res.status(400).json({ erro: 'Arquivo é obrigatório' });
    if (arquivo.size > 5 * 1024 * 1024) {
      return res.status(400).json({ erro: 'Arquivo maior que 5MB.' });
    }

    const nc = await DB.selectOne('nao_conformidades', { id: ncId }, null);
    if (!nc) return res.status(404).json({ erro: 'NC não encontrada' });
    if (String(nc.fornecedor_id) !== String(req.fornecedorId)) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    // Upload pro Supabase Storage
    const path = `tenant-${nc.tenant_id}/nc-${ncId}/${Date.now()}-${arquivo.name}`;
    const { data: up, error: upErr } = await supabase.storage
      .from(BUCKET_NC_EVIDENCIAS)
      .upload(path, arquivo.data, { contentType: arquivo.mimetype, upsert: false });

    if (upErr) return res.status(500).json({ erro: `Falha upload: ${upErr.message}` });

    const { data: signed } = await supabase.storage
      .from(BUCKET_NC_EVIDENCIAS)
      .createSignedUrl(up.path, 60 * 60 * 24 * 365); // 1 ano

    const forn = await DB.selectOne('fornecedores', { id: req.fornecedorId }, null);
    const fornUser = req.userId
      ? await DB.selectOne('fornecedor_usuarios', { id: req.userId }, null)
      : null;

    const anexo = await DB.insert('nao_conformidade_anexos', {
      tenant_id: nc.tenant_id,
      nc_id: ncId,
      url: signed?.signedUrl || up.path,
      nome_arquivo: arquivo.name,
      mime_type: arquivo.mimetype,
      tamanho_bytes: arquivo.size,
      criado_por: req.userId || null,
      criado_por_nome: fornUser?.nome || forn?.nome || 'Fornecedor',
    }, nc.tenant_id);

    await DB.insert('nao_conformidade_eventos', {
      tenant_id: nc.tenant_id,
      nc_id: ncId,
      tipo: 'anexo_fornecedor',
      descricao: `Fornecedor anexou: ${arquivo.name}`,
      dados: { anexo_id: anexo.id },
      criado_por: req.userId || null,
      criado_por_nome: fornUser?.nome || forn?.nome || 'Fornecedor',
      visivel_fornecedor: true,
      autor_tipo: 'fornecedor',
    }, nc.tenant_id);

    res.status(201).json({ ok: true, anexo });
  } catch (err) {
    console.error('❌ Erro em /anexo:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUT /api/fornecedor/nao-conformidades/:ncId/responder
// Body: { resposta: 'aceita' | 'contestada' | 'resolvida_fornecedor', observacao? }
// ─────────────────────────────────────────────────────────────────────────
router.put('/:ncId/responder', fornecedorMiddleware, async (req, res) => {
  try {
    const ncId = parseInt(req.params.ncId, 10);
    const { resposta, observacao } = req.body;
    const validas = ['aceita', 'contestada', 'resolvida_fornecedor'];
    if (!validas.includes(resposta)) {
      return res.status(400).json({ erro: `resposta deve ser: ${validas.join(', ')}` });
    }

    const nc = await DB.selectOne('nao_conformidades', { id: ncId }, null);
    if (!nc) return res.status(404).json({ erro: 'NC não encontrada' });
    if (String(nc.fornecedor_id) !== String(req.fornecedorId)) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }
    if (['resolvida', 'cancelada'].includes(nc.status)) {
      return res.status(400).json({ erro: 'NC já encerrada — não aceita mais respostas' });
    }

    const forn = await DB.selectOne('fornecedores', { id: req.fornecedorId }, null);
    const fornUser = req.userId
      ? await DB.selectOne('fornecedor_usuarios', { id: req.userId }, null)
      : null;

    await DB.update('nao_conformidades', ncId, {
      fornecedor_tratativa_status: resposta,
      atualizado_em: new Date().toISOString(),
    }, nc.tenant_id);

    const descricoes = {
      aceita: 'Fornecedor ACEITOU a não conformidade',
      contestada: 'Fornecedor CONTESTOU a não conformidade',
      resolvida_fornecedor: 'Fornecedor marcou como RESOLVIDA',
    };

    await DB.insert('nao_conformidade_eventos', {
      tenant_id: nc.tenant_id,
      nc_id: ncId,
      tipo: 'resposta_fornecedor',
      descricao: `${descricoes[resposta]}${observacao ? ` — ${observacao}` : ''}`,
      dados: { resposta, observacao: observacao || null },
      criado_por: req.userId || null,
      criado_por_nome: fornUser?.nome || forn?.nome || 'Fornecedor',
      visivel_fornecedor: true,
      autor_tipo: 'fornecedor',
    }, nc.tenant_id);

    // Notifica comprador (best-effort)
    try {
      const comprador = nc.inspetor_id
        ? await DB.selectOne('usuarios', { id: nc.inspetor_id }, nc.tenant_id)
        : null;
      if (comprador?.email) {
        const { enviarEmailCotacao } = require('../services/emailService');
        const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
        const corpo = `
          <h2>Fornecedor respondeu a NC ${nc.numero_nc}</h2>
          <p><strong>${forn?.nome || 'Fornecedor'}</strong> ${descricoes[resposta]}.</p>
          ${observacao ? `<blockquote>${observacao}</blockquote>` : ''}
          <p><a href="${baseUrl}/#dashboard">Abrir QuotaFlow</a></p>
        `;
        await enviarEmailCotacao(comprador.email, `NC ${nc.numero_nc} — ${descricoes[resposta]}`, corpo);
      }
    } catch (mailErr) {
      console.warn('⚠ Falha ao notificar comprador:', mailErr.message);
    }

    res.json({ ok: true, fornecedor_tratativa_status: resposta });
  } catch (err) {
    console.error('❌ Erro em /responder:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;