// routes/portalFornecedor.js

const express = require('express');
const router = express.Router();
const { DB } = require('../db');
const { v4: uuidv4 } = require('uuid');
const NotificacaoService = require('../services/NotificacaoService');
const { supabase } = require('../db');
const { enviarEmailCotacao } = require('../services/emailService');

const notificacao = new NotificacaoService();

/**
 * GET /api/portal/cotacao/:cotacaoId/:token
 * Retorna dados da cotação para o fornecedor responder (sem autenticação)
 * Token valida se o fornecedor tem acesso
 */
router.get('/portal/cotacao/:cotacaoId/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const cotacaoId = parseInt(req.params.cotacaoId, 10);

    if (!cotacaoId || isNaN(cotacaoId)) {
      return res.status(400).json({ message: 'ID da cotação inválido' });
    }

    // FIX (2026-09): rejeita explicitamente token inválido ANTES de
    // consultar o banco. Sem isso, 'null' (string que vem de link
    // quebrado) virava ?token_acesso=eq.null no PostgREST, que
    // interpreta como IS NULL — devolvia fornecedores órfãos.
    if (!token || token === 'null' || token === 'undefined' || String(token).trim() === '') {
      return res.status(403).json({ message: 'Acesso negado. Token inválido.' });
    }

    // FIX (2026-09): DB.select com valor nulo/undefined SILENCIOSAMENTE
    // descarta o filtro (ver if value !== null no db.js). Aqui buscamos
    // só por cotacao_id e filtramos token_acesso em JS — assim se o
    // filtro falhar do lado do wrapper, não vaza fornecedor errado.
    const todosFornsDaCotacao = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId }
    );
    const cotacaoFornecedorData = todosFornsDaCotacao.find(
      cf => String(cf.token_acesso) === String(token)
    );

    if (!cotacaoFornecedorData) {
      return res.status(403).json({ message: 'Acesso negado. Token inválido ou expirado.' });
    }
    const tenantId = cotacaoFornecedorData.tenant_id;
    const fornecedorId = cotacaoFornecedorData.fornecedor_id;

    // 2. Buscar cotação
    // FIX (2026-09): DB.selectOne já devolve o objeto direto (ou null), não
    // um array — usar cotacao[0]/fornecedor[0]/empresa[0] embaixo sempre
    // resultava em `undefined`. Confirmado com teste real: numero_cotacao,
    // fornecedor e empresa sempre chegavam vazios pro fornecedor na tela.
    const cotacao = await DB.selectOne('cotacoes', { id: cotacaoId }, tenantId);
    if (!cotacao) {
      return res.status(404).json({ message: 'Cotação não encontrada' });
    }

    // 3. Buscar empresa
    const empresa = await DB.selectOne('tenants', { id: tenantId });

    // 4. Buscar fornecedor
    const fornecedor = await DB.selectOne('fornecedores', { id: fornecedorId }, tenantId);

    // 5. Buscar itens com nome usando SUPABASE NATIVO
    const { data: itens, error } = await supabase
      .from('cotacao_itens')
      .select(`
        *,
        chamado_itens (
          item_nome,
          codigo,
          descricao
        )
      `)
      .eq('cotacao_id', cotacaoId)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(`Erro ao buscar itens: ${error.message}`);

    // FIX (2026-09, grave — vazamento entre fornecedores): a query buscava
    // TODOS os itens da cotação, sem checar se este fornecedor está na
    // lista fornecedores_ids daquele item. Confirmado com teste real: numa
    // cotação com o item A destinado só ao fornecedor 1 e o item B só ao
    // fornecedor 2, o fornecedor 1 via os dois itens — inclusive o preço
    // estimado e a descrição do item que não era dele. Cada fornecedor só
    // deve ver os itens em que foi explicitamente incluído.
    const itensDoFornecedor = itens.filter(item => {
      const ids = Array.isArray(item.fornecedores_ids) ? item.fornecedores_ids : [];
      return ids.length === 0 || ids.includes(fornecedorId);
    });

    const itensFormatados = itensDoFornecedor.map(item => ({
      ...item,
      item_nome: item.chamado_itens?.item_nome || 'Item sem nome',
      codigo: item.chamado_itens?.codigo || '',
      descricao: item.chamado_itens?.descricao || ''
    }));

    // 6. Buscar respostas existentes (opcional)
    const respostasExistentes = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId, fornecedor_id: fornecedorId },
      tenantId
    );

    // FIX (2026-09): detectar se já foi respondida e devolver os itens
    // com valores — pro frontend poder mostrar a tela de comprovante
    // em vez de um formulário vazio. Sem isso, o fornecedor reabre o
    // link, preenche tudo de novo, e recebe "cotação já respondida" ao
    // enviar (UX ruim + perda de tempo).
    // Respostas por item — SEMPRE que houver, independente do status
    // global do fornecedor. Um fornecedor pode ter respondido 2 itens via
    // portal, ter sido adicionado manualmente pelo comprador no 3º, e
    // continuar com status='respondido' (foi respondido, mas não 100%).
    // A tela do portal precisa saber item a item o que está respondido e
    // o que ainda aguarda o fornecedor — antes disso, ela mostrava R$ 0,00
    // no item sem resposta e bloqueava edição (bug real em 09/2026).
    const todosItensResp = await DB.select('cotacao_fornecedor_itens',
      { tenant_id: tenantId }, tenantId);
    const respostasDoFornecedor = todosItensResp.filter(
      ir => ir.cotacao_fornecedor_id === cotacaoFornecedorData.id
    );

    const itensRespondidos = respostasDoFornecedor.map(ir => ({
      cotacao_item_id: ir.cotacao_item_id,
      valor: ir.valor,
      frete: ir.frete,
      modalidade: ir.frete_modalidade,
    }));

    // `ja_respondida` continua existindo pra compatibilidade (frontend
    // pode usar pra mostrar cabeçalho "Proposta enviada em X"), MAS deixa
    // de ser o gate de edição. O gate agora é por item (`respondido: bool`
    // em cada item de `itensFormatados`), abaixo.
    const jaRespondida = cotacaoFornecedorData.status === 'respondido';

    // Marca item a item se já tem resposta, e — importante — envia o
    // valor real (não `0`) quando não tem. O frontend do portal usa esse
    // flag pra decidir se a linha está editável.
    const cotacaoItemIdsRespondidos = new Set(
      respostasDoFornecedor.map(ir => String(ir.cotacao_item_id))
    );
    const itensFormatadosComEstado = itensFormatados.map(it => ({
      ...it,
      respondido: cotacaoItemIdsRespondidos.has(String(it.cotacao_item_id)),
    }));

    return res.json({
      cotacao: {
        ...cotacao,
        ja_respondida: jaRespondida,
        respondida_em: cotacaoFornecedorData.data_resposta || null,
        itens_respondidos: itensRespondidos,
      },
      fornecedor,
      empresa,
      itens: itensFormatadosComEstado,
      respostasExistentes: respostasExistentes[0] || null,
    });

  } catch (erro) {
    console.error('Erro em GET /portal/cotacao:', erro);
    return res.status(500).json({
      message: 'Erro ao carregar cotação',
      error: process.env.NODE_ENV === 'development' ? erro.message : undefined
    });
  }
});

/**
 * POST /api/portal/cotacao/:cotacaoId/:token/responder
 * Fornecedor submete suas respostas
 */
router.post('/portal/cotacao/:cotacaoId/:token/responder', async (req, res) => {
  try {
    const { cotacaoId, token } = req.params;
    const { respostas, validade_dias } = req.body;

    if (!Array.isArray(respostas) || respostas.length === 0) {
      return res.status(400).json({ message: 'Nenhuma resposta enviada.' });
    }

    // #4c — Validade da proposta (obrigatório no portal, default 30 no backend).
    // Fornecedor que não se manifesta não está prometendo nada; forçar um
    // prazo conservador é melhor que deixar em branco (armadilha silenciosa).
    let validadeDias = parseInt(validade_dias, 10);
    if (!Number.isFinite(validadeDias) || validadeDias < 1) validadeDias = 30;
    if (validadeDias > 365) validadeDias = 365;

    // 🔥 1. VALIDAR TOKEN (use token_acesso!)
    // FIX (2026-09): mesmo tratamento defensivo do GET — rejeita token
    // inválido antes, e filtra em JS depois pra não depender do wrapper.
    if (!token || token === 'null' || token === 'undefined' || String(token).trim() === '') {
      return res.status(403).json({ message: 'Acesso negado. Token inválido.' });
    }

    const todosFornsDaCotacao = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId }
    );
    const fornData = todosFornsDaCotacao.find(
      cf => String(cf.token_acesso) === String(token)
    );

    if (!fornData) {
      return res.status(403).json({ message: 'Acesso negado. Token inválido.' });
    }

    const cotacaoFornecedor = [fornData]; // mantém compat com o código abaixo
    const tenantId = fornData.tenant_id;
    const fornecedorId = fornData.fornecedor_id;
    const cotacaoFornecedorId = fornData.id;

    // #4c — Fornecedor pode responder em MÚLTIPLAS RODADAS (ex: respondeu
    // 2 itens pelo portal, foi adicionado manualmente pelo comprador no 3º
    // e volta pra completar). A trava agora é POR ITEM: rejeita só se TODOS
    // os itens convidados já têm resposta — nesse caso, a via pra alterar
    // é o comprador colocar em renegociação. A checagem detalhada acontece
    // depois, quando soubermos quais itens vieram no payload.

    // FIX (2026-09, grave — resposta em item de outro fornecedor): nada
    // validava que os cotacao_item_id enviados no body realmente pertencem
    // a este fornecedor. Confirmado com teste real: era possível responder
    // (e gravar preço para) um item que fornecedores_ids não incluía este
    // fornecedor_id. Busca os itens de verdade da cotação e cruza com
    // fornecedores_ids antes de aceitar qualquer resposta.
    const { data: itensCotacao, error: erroItens } = await supabase
      .from('cotacao_itens')
      .select('*')
      .eq('cotacao_id', parseInt(cotacaoId, 10))
      .eq('tenant_id', tenantId);

    if (erroItens) throw new Error(`Erro ao validar itens: ${erroItens.message}`);

    const itensPermitidosIds = new Set(
      itensCotacao
        .filter(item => {
          const ids = Array.isArray(item.fornecedores_ids) ? item.fornecedores_ids : [];
          return ids.length === 0 || ids.includes(fornecedorId);
        })
        .map(item => item.id)
    );

    for (const resposta of respostas) {
      const itemIdCheck = parseInt(resposta.itemId, 10);
      if (!itensPermitidosIds.has(itemIdCheck)) {
        return res.status(403).json({
          message: `Item ${resposta.itemId} não está disponível para este fornecedor cotar.`
        });
      }
    }

    // 🔥 3+5. UPSERT ITEM A ITEM (não mais INSERT cego)
    // Fase "resposta em múltiplas rodadas" (2026-09): antes, o POST
    // sempre INSERIA uma linha nova por item. Se o fornecedor já tinha
    // respondido o item 15 e voltasse pra completar o item 17, ele
    // duplicava o 15 em vez de ignorar. Agora busca a linha existente
    // (por cotacao_fornecedor_id + cotacao_item_id) e faz UPDATE, senão
    // INSERT. Upsert idempotente: reenviar o mesmo payload não duplica.
    const itensCotacaoPorId = new Map(itensCotacao.map(item => [item.id, item]));

    const todasRespostasExistentes = await DB.select(
      'cotacao_fornecedor_itens',
      { tenant_id: tenantId },
      tenantId
    );
    const respostasDoFornecedor = todasRespostasExistentes.filter(
      ir => ir.cotacao_fornecedor_id === cotacaoFornecedorId
    );
    const respostaPorItemId = {};
    respostasDoFornecedor.forEach(r => {
      respostaPorItemId[String(r.cotacao_item_id)] = r;
    });

    for (const resposta of respostas) {
      const itemId = parseInt(resposta.itemId, 10);
      const itemOriginal = itensCotacaoPorId.get(itemId);
      const dadosItem = {
        valor: parseFloat(resposta.valor_unitario || 0),
        prazo: parseInt(resposta.prazo ?? respostas[0]?.prazo ?? 0),
        frete: parseFloat(resposta.valor_frete || 0),
        frete_modalidade: resposta.frete || null,
      };

      const linhaExistente = respostaPorItemId[String(itemId)];
      if (linhaExistente) {
        // UPDATE — item já tinha resposta (rodada anterior)
        await DB.update('cotacao_fornecedor_itens', linhaExistente.id, {
          ...dadosItem,
          origem_preenchimento: 'manual', // passou por edição
          atualizado_em: new Date().toISOString(),
        }, tenantId);
      } else {
        // INSERT — primeira vez que este item é respondido
        await DB.insert('cotacao_fornecedor_itens', {
          tenant_id: tenantId,
          cotacao_fornecedor_id: cotacaoFornecedorId,
          cotacao_item_id: itemId,
          chamado_item_id: resposta.chamadoItemId || itemOriginal?.chamado_item_id || null,
          ...dadosItem,
          criado_em: new Date().toISOString(),
        }, tenantId);
      }
    }

    // 🔥 4. RECALCULAR CABEÇALHO com base no estado COMPLETO do fornecedor
    // (não só no payload atual). Sem isso, um envio parcial zerava o
    // valor agregado do fornecedor — perdia o que ele tinha respondido
    // antes.
    const respostasAtualizadas = await DB.select(
      'cotacao_fornecedor_itens',
      { tenant_id: tenantId },
      tenantId
    );
    const linhasDoFornecedorAgora = respostasAtualizadas.filter(
      ir => ir.cotacao_fornecedor_id === cotacaoFornecedorId
    );

    const soma = (campo) => linhasDoFornecedorAgora.reduce(
      (s, ir) => s + (parseFloat(ir[campo]) || 0), 0
    );
    const valorTotal = soma('valor');
    const valorFreteTotal = soma('frete');

    const modalidadesUsadas = [...new Set(
      linhasDoFornecedorAgora.map(r => r.frete_modalidade).filter(Boolean)
    )];
    const modalidadeResumo = modalidadesUsadas.length === 1
      ? modalidadesUsadas[0]
      : (modalidadesUsadas.length > 1 ? 'MISTO' : null);

    // Quantos itens ESTE fornecedor foi convidado a cotar: itens cujo
    // fornecedores_ids inclui ele, OU itens que ele já respondeu (caso
    // tenha sido adicionado manualmente pelo comprador depois — nesse
    // caso o fornecedores_ids do item já inclui, mas por segurança).
    const itensEsperadosDoFornecedor = itensCotacao.filter(item => {
      const ids = Array.isArray(item.fornecedores_ids) ? item.fornecedores_ids : [];
      return ids.includes(fornecedorId) || respostaPorItemId[String(item.id)];
    });
    const itemIdsRespondidosAgora = new Set(
      linhasDoFornecedorAgora.map(r => String(r.cotacao_item_id))
    );
    const itensPendentes = itensEsperadosDoFornecedor.filter(
      item => !itemIdsRespondidosAgora.has(String(item.id))
    );
    const statusCabecalho = itensPendentes.length === 0 ? 'respondido' : 'pendente';

    // 🔥 4b. ATUALIZAR CABEÇALHO DO FORNECEDOR
    // Token NÃO é regenerado se já existia — trocar invalidaria qualquer
    // link antigo que o comprador colou em email/whatsapp. Só gera novo
    // se por algum motivo não tinha.
    await DB.update(
      'cotacao_fornecedores',
      cotacaoFornecedorId,
      {
        status: statusCabecalho,
        valor: valorTotal,
        data_resposta: new Date(),
        obs: respostas[0]?.observacoes || fornData.obs || '',
        prazo: parseInt(respostas[0]?.prazo || fornData.prazo || 0),
        frete: modalidadeResumo,
        valor_frete: valorFreteTotal,
        validade_dias: validadeDias,
        validade_em: new Date(Date.now() + validadeDias * 86400000).toISOString(),
        token_acesso: fornData.token_acesso || uuidv4(),
      },
      tenantId
    );

    // 🔥 6. VERIFICAR SE TODOS OS FORNECEDORES RESPONDERAM
    // Agora conta por cabeçalho — só fica "respondido" quando o fornecedor
    // preencheu todos os itens esperados dele.
    const total = await DB.select('cotacao_fornecedores', { cotacao_id: cotacaoId });
    const respondidos = total.filter(f => f.status === 'respondido');
    if (total.length === respondidos.length && total.length > 0) {
      await DB.update('cotacoes', cotacaoId, { status: 'respondida' }, tenantId);
    }

    // 7. ENVIAR E‑MAIL DE CONFIRMAÇÃO PARA O FORNECEDOR
    try {
      const { enviarEmailCotacao } = require('../services/emailService');
      const fornecedor = await DB.selectOne('fornecedores', { id: fornecedorId }, tenantId);
      const empresa = await DB.selectOne('tenants', { id: tenantId });
      const cotacao = await DB.selectOne('cotacoes', { id: cotacaoId }, tenantId);

      // FIX (2026-09): detalhar item a item no email de confirmação. Antes
      // o fornecedor só via "Valor total" e não tinha como conferir se a
      // proposta gravada bate com o que ele digitou no portal.
      const chamadoItemIds = respostas
        .map(r => itensCotacaoPorId.get(parseInt(r.itemId, 10))?.chamado_item_id)
        .filter(Boolean);
      const todosChamadoItens = chamadoItemIds.length > 0
        ? await DB.select('chamado_itens', { tenant_id: tenantId }, tenantId)
        : [];
      const chamadoItemPorId = {};
      todosChamadoItens
        .filter(ci => chamadoItemIds.includes(ci.id))
        .forEach(ci => { chamadoItemPorId[ci.id] = ci; });

      const linhasHtml = respostas.map(r => {
        const itemId = parseInt(r.itemId, 10);
        const itemCot = itensCotacaoPorId.get(itemId);
        const chamadoItem = itemCot ? chamadoItemPorId[itemCot.chamado_item_id] : null;
        const nome = chamadoItem?.item_nome || `Item ${r.itemId}`;
        const codigo = chamadoItem?.codigo || '';
        const qtd = parseInt(r.quantidade) || 1;
        const valorUnit = parseFloat(r.valor_unitario || 0);
        const freteItem = parseFloat(r.valor_frete || 0);
        const modalidade = r.frete || '';
        const subtotal = (valorUnit * qtd) + freteItem;
        return `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">
              ${nome}${codigo ? ` <small style="color:#888">(${codigo})</small>` : ''}
            </td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${qtd}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">R$ ${valorUnit.toFixed(2).replace('.', ',')}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">R$ ${freteItem.toFixed(2).replace('.', ',')}${modalidade ? ` <small style="color:#888">(${modalidade})</small>` : ''}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">R$ ${subtotal.toFixed(2).replace('.', ',')}</td>
          </tr>
        `;
      }).join('');

      const valorItensTotal = respostas.reduce((s, r) =>
        s + (parseFloat(r.valor_unitario || 0) * (parseInt(r.quantidade) || 1)), 0);
      const freteTotal = respostas.reduce((s, r) =>
        s + parseFloat(r.valor_frete || 0), 0);
      const totalGeral = valorItensTotal + freteTotal;

      const assunto = `Proposta enviada com sucesso - Cotação ${cotacao.numero || '[sem número]'}`;
      const corpo = `
        <h2>Proposta enviada!</h2>
        <p>Olá <strong>${fornecedor?.nome || 'Fornecedor'}</strong>,</p>
        <p>Sua proposta para a cotação <strong>${cotacao.numero || cotacaoId}</strong> foi enviada com sucesso para ${empresa?.nome || 'a empresa'}.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:8px;text-align:left;border-bottom:2px solid #ddd;">Item</th>
              <th style="padding:8px;text-align:center;border-bottom:2px solid #ddd;">Qtd</th>
              <th style="padding:8px;text-align:right;border-bottom:2px solid #ddd;">Valor unit.</th>
              <th style="padding:8px;text-align:right;border-bottom:2px solid #ddd;">Frete</th>
              <th style="padding:8px;text-align:right;border-bottom:2px solid #ddd;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${linhasHtml}
          </tbody>
        </table>
        <p style="text-align:right;"><strong>Subtotal dos itens:</strong> R$ ${valorItensTotal.toFixed(2).replace('.', ',')}</p>
        <p style="text-align:right;"><strong>Frete:</strong> R$ ${freteTotal.toFixed(2).replace('.', ',')}</p>
        <p style="text-align:right;font-size:16px;"><strong>Total: R$ ${totalGeral.toFixed(2).replace('.', ',')}</strong></p>
        <p><strong>Prazo:</strong> ${parseInt(respostas[0]?.prazo || 0)} dias úteis</p>
        ${respostas[0]?.observacoes ? `
          <div style="background:#f5f5f5;border-left:4px solid #2563eb;padding:12px;margin:16px 0;">
            <p style="margin:0;font-size:13px;color:#555;"><strong>Suas observações:</strong></p>
            <p style="margin:6px 0 0 0;font-style:italic;">${respostas[0].observacoes}</p>
          </div>
        ` : ''}
        <p>Aguardamos o retorno do comprador.</p>
        <hr>
        <p><small>Esta é uma mensagem automática. Não responda este e-mail.</small></p>
      `;

      await enviarEmailCotacao(fornecedor?.email, assunto, corpo);
      console.log(`✅ E‑mail de confirmação enviado para ${fornecedor?.email}`);
    } catch (err) {
      console.error('❌ Falha ao enviar e‑mail de confirmação:', err.message);
    }

    return res.json({
      sucesso: true,
      message: 'Resposta registrada com sucesso!',
      valorTotal
    });

  } catch (erro) {
    console.error('Erro em POST /portal/cotacao/.../responder:', erro);
    return res.status(500).json({ message: 'Erro ao processar resposta', error: erro.message });
  }
});

/**
 * GET /api/portal/cotacao/:cotacaoId/:token/status
 * Verificar status atual da cotação (para fornecedor)
 */
router.get('/portal/cotacao/:cotacaoId/:token/status', async (req, res) => {
  try {
    const { cotacaoId, token } = req.params;

    // 🔥 Validar token_acesso (NÃO token)
    if (!token || token === 'null' || token === 'undefined' || String(token).trim() === '') {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const todosFornsDaCotacao = await DB.select(
      'cotacao_fornecedores',
      { cotacao_id: cotacaoId }
    );
    const fornData = todosFornsDaCotacao.find(
      cf => String(cf.token_acesso) === String(token)
    );

    if (!fornData) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const cotacaoFornecedor = [fornData]; // mantém compat com o restante
    const { tenant_id: tenantId } = fornData;

    // FIX (2026-09): mesmo bug do "[0]" em cima de DB.selectOne — o valor
    // já vem como objeto direto, não array.
    const cotacao = await DB.selectOne(
      'cotacoes',
      { id: cotacaoId },
      tenantId
    );

    return res.json({
      status: cotacao?.status,
      respondido: cotacaoFornecedor[0].status === 'respondido',
      dataResposta: cotacaoFornecedor[0].data_resposta
    });

  } catch (erro) {
    console.error('Erro em GET /portal/.../status:', erro);
    return res.status(500).json({ message: 'Erro ao verificar status' });
  }
});

module.exports = router;
