// routes/estoque/enderecos.js
//
// M4.4-etapa-6c: catálogo de endereços por tenant. Substitui o texto livre
// (A01/a01/A 01 virariam 4 endereços diferentes). Codigo é imutável;
// descrição pode mudar; desativar em vez de renomear.
const express = require('express');
const router = express.Router();
const { DB } = require('../../db');
const tenantMiddleware = require('../../middleware/tenantMiddleware');

// ─── LISTAR ENDEREÇOS ────────────────────────────────────────
// Query: ?incluir_inativos=true pra incluir os desativados
router.get('/', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const incluirInativos = req.query.incluir_inativos === 'true';

    const todos = await DB.select('enderecos', { tenant_id: tenantId }, tenantId);
    const filtrados = incluirInativos ? todos : todos.filter(e => e.ativo);

    // Ordena por tipo (recebimento primeiro, depois armazem, etc), depois por código
    const ordemTipo = { recebimento: 1, armazem: 2, expedicao: 3, nc: 4, transito: 5 };
    filtrados.sort((a, b) => {
      const ot = (ordemTipo[a.tipo] || 99) - (ordemTipo[b.tipo] || 99);
      if (ot !== 0) return ot;
      return (a.codigo || '').localeCompare(b.codigo || '');
    });

    res.json(filtrados);
  } catch (err) {
    console.error('❌ Erro ao listar endereços:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── CRIAR ENDEREÇO ──────────────────────────────────────────
router.post('/', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { codigo, descricao, tipo } = req.body;

    if (!codigo || !String(codigo).trim()) {
      return res.status(400).json({ erro: 'codigo é obrigatório' });
    }

    const codigoNorm = String(codigo).trim().toUpperCase();
    if (!/^[A-Z0-9_-]{1,30}$/.test(codigoNorm)) {
      return res.status(400).json({
        erro: 'codigo deve ter até 30 caracteres: letras maiúsculas, números, _ ou -',
      });
    }

    const tiposValidos = ['recebimento', 'armazem', 'expedicao', 'nc', 'transito'];
    const tipoFinal = tipo || 'armazem';
    if (!tiposValidos.includes(tipoFinal)) {
      return res.status(400).json({ erro: `tipo inválido — use: ${tiposValidos.join(', ')}` });
    }

    // Já existe?
    const todos = await DB.select('enderecos', { tenant_id: tenantId }, tenantId);
    const existente = todos.find(e => e.codigo === codigoNorm);
    if (existente) {
      return res.status(409).json({
        erro: `Endereço "${codigoNorm}" já existe (${existente.ativo ? 'ativo' : 'inativo'}).`,
        endereco_existente: existente,
      });
    }

    const novo = await DB.insert('enderecos', {
      tenant_id: tenantId,
      codigo: codigoNorm,
      descricao: descricao ? String(descricao).trim() : '',
      tipo: tipoFinal,
      ativo: true,
    }, tenantId);

    res.status(201).json(novo);
  } catch (err) {
    console.error('❌ Erro ao criar endereço:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ─── EDITAR ENDEREÇO ─────────────────────────────────────────
// Editável: descricao, tipo, ativo. NUNCA o codigo.
router.put('/:id', tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { descricao, tipo, ativo } = req.body;

    const endereco = await DB.selectOne('enderecos', { id, tenant_id: tenantId }, tenantId);
    if (!endereco) {
      return res.status(404).json({ erro: 'Endereço não encontrado' });
    }

    const updateData = {};
    if (descricao !== undefined) updateData.descricao = String(descricao || '').trim();
    if (tipo !== undefined) {
      const tiposValidos = ['recebimento', 'armazem', 'expedicao', 'nc', 'transito'];
      if (!tiposValidos.includes(tipo)) {
        return res.status(400).json({ erro: `tipo inválido — use: ${tiposValidos.join(', ')}` });
      }
      updateData.tipo = tipo;
    }
    if (ativo !== undefined) updateData.ativo = !!ativo;

    // Bloqueia desativar RECEBIMENTO (é o destino padrão das entradas)
    if (endereco.codigo === 'RECEBIMENTO' && updateData.ativo === false) {
      return res.status(400).json({
        erro: 'RECEBIMENTO é o endereço padrão do sistema e não pode ser desativado.',
      });
    }

    // Bloqueia desativar endereço que tem saldo > 0
    if (updateData.ativo === false) {
      const linhasEnd = await DB.select(
        'itens_consumo_enderecos',
        { tenant_id: tenantId, endereco_id: endereco.id },
        tenantId
      ).catch(() => []);
      const comSaldo = linhasEnd.filter(l => Number(l.saldo) > 0);
      if (comSaldo.length > 0) {
        return res.status(400).json({
          erro: `Endereço "${endereco.codigo}" tem saldo em ${comSaldo.length} item(ns). Transfira o saldo antes de desativar.`,
        });
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ erro: 'Nada pra atualizar' });
    }

    await DB.update('enderecos', id, updateData, tenantId);
    const atualizado = await DB.selectOne('enderecos', { id, tenant_id: tenantId }, tenantId);
    res.json(atualizado);
  } catch (err) {
    console.error('❌ Erro ao editar endereço:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;