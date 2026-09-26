// services/PortalRespostaService.js
//
// Lógica compartilhada entre as duas portas de resposta de cotação:
//   1. Pública  → /api/portal/cotacao/:cot/:token/... (link tokenizado)
//   2. Autenticada → /api/fornecedor/cotacoes/:cf/... (JWT)
//
// As duas resolvem o `fornData` (linha de cotacao_fornecedores) de
// formas diferentes, mas daí pra frente fazem exatamente a mesma coisa:
// carregam os dados pro form, validam os itens permitidos, fazem upsert
// por item, recalculam o cabeçalho, atualizam status, mandam email.
//
// Refatorado em 2026-09 pra evitar duplicação (o hub autenticado precisa
// responder exatamente como o link público — mesma regra, mesma auditoria).

const { DB, supabase } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { enviarEmailCotacao } = require('./emailService');

// ─────────────────────────────────────────────────────────────────────────
// carregarParaResposta
//
// Recebe `fornData` (linha de cotacao_fornecedores já resolvida pelo
// caller) e devolve o payload que o formulário consome. Mantém o shape
// atual do GET /portal/cotacao/:cot/:token — nenhuma mudança pro frontend.
// ─────────────────────────────────────────────────────────────────────────
async function carregarParaResposta(fornData) {
  const tenantId = fornData.tenant_id;
  const fornecedorId = fornData.fornecedor_id;
  const cotacaoId = fornData.cotacao_id;

  // 1. Cotação
  const cotacao = await DB.selectOne('cotacoes', { id: cotacaoId }, tenantId);
  if (!cotacao) throw new Error('Cotação não encontrada');

  // 2. Empresa e fornecedor
  const empresa = await DB.selectOne('tenants', { id: tenantId });
  const fornecedor = await DB.selectOne('fornecedores', { id: fornecedorId }, tenantId);

  // 2b. Contato do comprador — resolvido pelas policies do tenant
  // (comunicacao_*_policy). Default é 'empresa' (combinado 2026-09).
  // O fornecedor só vê esse contato quando a cotação ainda está viva
  // (pendente / em análise) — se foi cancelada/finalizada, o campo vem
  // null (não expõe contato de processo morto).
  const comprador = cotacao.criado_por
    ? await DB.selectOne('usuarios', { id: cotacao.criado_por }, tenantId)
    : null;

  const usarEmpresaNome = (empresa?.comunicacao_nome_policy || 'empresa') === 'empresa';
  const usarEmpresaTel  = (empresa?.comunicacao_telefone_policy || 'empresa') === 'empresa';
  const usarEmpresaMail = (empresa?.comunicacao_email_policy || 'empresa') === 'empresa';

  const contato = {
    nome: usarEmpresaNome ? (empresa?.nome || null) : (comprador?.nome || empresa?.nome || null),
    // Fallback: se queria usuário mas ele não tem telefone, cai pro
    // telefone da empresa — evita expor contato vazio pro fornecedor.
    telefone: usarEmpresaTel
      ? (empresa?.telefone || null)
      : (comprador?.telefone || empresa?.telefone || null),
    email: usarEmpresaMail
      ? (empresa?.email_contato || empresa?.email_admin || null)
      : (comprador?.email || empresa?.email_contato || empresa?.email_admin || null),
  };

  // Regra de visibilidade: só mostra se a cotação está viva. Cancelada
  // ou finalizada => contato null (não expõe o comprador depois que o
  // processo morreu).
  const cotacaoViva = !['cancelada', 'finalizada'].includes(cotacao.status)
    && fornData.status !== 'finalizado';
  const contatoExposto = cotacaoViva ? contato : null;

  // 3. Itens com join de chamado_itens (supabase nativo pro join)
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

  // 4. Filtro defensivo: só itens em que este fornecedor foi incluído
  const itensDoFornecedor = (itens || []).filter(item => {
    const ids = Array.isArray(item.fornecedores_ids) ? item.fornecedores_ids : [];
    return ids.length === 0 || ids.includes(fornecedorId);
  });

  const itensFormatados = itensDoFornecedor.map(item => ({
    ...item,
    item_nome: item.chamado_itens?.item_nome || 'Item sem nome',
    codigo: item.chamado_itens?.codigo || '',
    descricao: item.chamado_itens?.descricao || '',
  }));

  // 5. Respostas por item (estado item-a-item)
  const todosItensResp = await DB.select('cotacao_fornecedor_itens',
    { tenant_id: tenantId }, tenantId);
  const respostasDoFornecedor = todosItensResp.filter(
    ir => ir.cotacao_fornecedor_id === fornData.id
  );

  const itensRespondidos = respostasDoFornecedor.map(ir => ({
    cotacao_item_id: ir.cotacao_item_id,
    valor: ir.valor,
    frete: ir.frete,
    modalidade: ir.frete_modalidade,
    // M6: o formulário pré-preenche esse campo quando o fornecedor
    // reabre a cotação — economiza digitação.
    codigo_fornecedor: ir.codigo_fornecedor || null,
  }));

  const jaRespondida = fornData.status === 'respondido';

  const cotacaoItemIdsRespondidos = new Set(
    respostasDoFornecedor.map(ir => String(ir.cotacao_item_id))
  );
  // M6: buscar vínculos aprendidos (fornecedor_id + chamado_item_id).
  // Pré-preenche o form automaticamente sem o fornecedor digitar nada.
  const todosVinculos = await DB.select('fornecedor_codigo_item', {
    tenant_id: tenantId,
    fornecedor_id: fornecedorId,
  }, tenantId);
  const vinculoPorChamadoItem = {};
  todosVinculos.forEach(v => { vinculoPorChamadoItem[v.chamado_item_id] = v; });

  const itensFormatadosComEstado = itensFormatados.map(it => {
    const chamadoItemId = it.chamado_item_id;
    const vinculo = vinculoPorChamadoItem[chamadoItemId];
    const codigoRc = it.chamado_itens?.codigo || it.codigo || null;
    return {
      ...it,
      respondido: cotacaoItemIdsRespondidos.has(String(it.cotacao_item_id)),
      // PN do fabricante cadastrado na RC (default quando ninguém mexeu).
      codigo_rc: codigoRc,
      // Vínculo aprendido — se existe, veio de uma resposta anterior dele.
      codigo_fornecedor_aprendido: vinculo?.codigo_fornecedor || null,
      confianca_aprendizado: vinculo?.confianca || null,
      // Sugestão de valor pro input: prioriza o vínculo, cai pro da RC.
      codigo_fornecedor_sugerido: vinculo?.codigo_fornecedor || codigoRc || null,
    };
  });

  // 6. Respostas existentes (cabeçalho — pra preencher prazo/obs)
  const respostasExistentes = await DB.select(
    'cotacao_fornecedores',
    { cotacao_id: cotacaoId, fornecedor_id: fornecedorId },
    tenantId
  );

  return {
    cotacao: {
      ...cotacao,
      ja_respondida: jaRespondida,
      respondida_em: fornData.data_resposta || null,
      itens_respondidos: itensRespondidos,
    },
    fornecedor,
    empresa,
    itens: itensFormatadosComEstado,
    respostasExistentes: respostasExistentes[0] || null,
    contato: contatoExposto,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// responderPortal
//
// Recebe `fornData` já resolvido e o body do cliente. Faz:
//   1. Valida itens permitidos ao fornecedor
//   2. Upsert por item em cotacao_fornecedor_itens
//   3. Recalcula o cabeçalho (valor, frete, modalidade, status)
//   4. Marca a cotação como 'respondida' se todos responderam
//   5. Envia email de confirmação (best-effort — falha não bloqueia)
//
// Retorna { valorTotal }.
// ─────────────────────────────────────────────────────────────────────────
async function responderPortal(fornData, respostas, validadeDias) {
  const tenantId = fornData.tenant_id;
  const fornecedorId = fornData.fornecedor_id;
  const cotacaoFornecedorId = fornData.id;
  const cotacaoId = fornData.cotacao_id;

  // 1. Validar itens permitidos
  const { data: itensCotacao, error: erroItens } = await supabase
    .from('cotacao_itens')
    .select('*')
    .eq('cotacao_id', parseInt(cotacaoId, 10))
    .eq('tenant_id', tenantId);

  if (erroItens) throw new Error(`Erro ao validar itens: ${erroItens.message}`);

  const itensPermitidosIds = new Set(
    (itensCotacao || [])
      .filter(item => {
        const ids = Array.isArray(item.fornecedores_ids) ? item.fornecedores_ids : [];
        return ids.length === 0 || ids.includes(fornecedorId);
      })
      .map(item => item.id)
  );

  for (const resposta of respostas) {
    const itemIdCheck = parseInt(resposta.itemId, 10);
    if (!itensPermitidosIds.has(itemIdCheck)) {
      throw new Error(`Item ${resposta.itemId} não está disponível para este fornecedor cotar.`);
    }
  }

  // 2. Upsert item a item
  const itensCotacaoPorId = new Map((itensCotacao || []).map(item => [item.id, item]));

  // M6: buscar chamado_itens pra pegar o `codigo` (PN do fabricante) como
  // default do código do fornecedor quando ele não informar nada.
  const chamadoItemIdsParaCodigo = (itensCotacao || [])
    .map(ci => ci.chamado_item_id)
    .filter(Boolean);
  const todosChamadoItensParaCodigo = await DB.select('chamado_itens',
    { tenant_id: tenantId }, tenantId);
  const chamadoItemPorIdParaCodigo = {};
  todosChamadoItensParaCodigo
    .filter(ci => chamadoItemIdsParaCodigo.includes(ci.id))
    .forEach(ci => { chamadoItemPorIdParaCodigo[ci.id] = ci; });

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
    const chamadoItemId = resposta.chamadoItemId || itemOriginal?.chamado_item_id || null;
    const chamadoItem = chamadoItemId ? chamadoItemPorIdParaCodigo[chamadoItemId] : null;
    const codigoRc = chamadoItem?.codigo || null;

    // M6: lógica do código do fornecedor.
    //   • Se ele enviou um codigo_fornecedor explícito → usa (confianca='manual')
    //   • Se NÃO enviou mas o item tem `chamado_itens.codigo` → assume o código
    //     da RC (confianca='auto', comportamento default — ninguém digita)
    //   • Se não tem nada → null (fica sem cProd, cai no match fuzzy)
    const codigoFornecedorEnviado = resposta.codigo_fornecedor
      ? String(resposta.codigo_fornecedor).trim()
      : null;
    const fornecedorEditou = codigoFornecedorEnviado != null;
    const codigoFornecedorFinal = codigoFornecedorEnviado || codigoRc || null;

    const dadosItem = {
      valor: parseFloat(resposta.valor_unitario || 0),
      prazo: parseInt(resposta.prazo ?? respostas[0]?.prazo ?? 0),
      frete: parseFloat(resposta.valor_frete || 0),
      frete_modalidade: resposta.frete || null,
      codigo_fornecedor: codigoFornecedorFinal,
    };

    const linhaExistente = respostaPorItemId[String(itemId)];
    if (linhaExistente) {
      await DB.update('cotacao_fornecedor_itens', linhaExistente.id, {
        ...dadosItem,
        origem_preenchimento: 'manual',
        atualizado_em: new Date().toISOString(),
      }, tenantId);
    } else {
      await DB.insert('cotacao_fornecedor_itens', {
        tenant_id: tenantId,
        cotacao_fornecedor_id: cotacaoFornecedorId,
        cotacao_item_id: itemId,
        chamado_item_id: chamadoItemId,
        ...dadosItem,
        criado_em: new Date().toISOString(),
      }, tenantId);
    }

    // M6: grava/atualiza o vínculo aprendido. Cada par
    // (fornecedor_id, chamado_item_id) tem no máximo 1 cProd.
    // Se o fornecedor editar, sobrescreve com confianca='manual'.
    if (codigoFornecedorFinal && chamadoItemId) {
      const vinculosExistentes = await DB.select('fornecedor_codigo_item', {
        tenant_id: tenantId,
        fornecedor_id: fornecedorId,
        chamado_item_id: chamadoItemId,
      }, tenantId);

      const dadosVinculo = {
        tenant_id: tenantId,
        fornecedor_id: fornecedorId,
        chamado_item_id: chamadoItemId,
        codigo_rc: codigoRc,
        codigo_fornecedor: codigoFornecedorFinal,
        confianca: fornecedorEditou ? 'manual' : 'auto',
        atualizado_em: new Date().toISOString(),
      };

      if (vinculosExistentes.length > 0) {
        // Só sobrescreve 'auto' com 'manual'. Um vínculo 'manual'
        // anterior NÃO é sobrescrito por um envio posterior 'auto'
        // (senão o fornecedor perderia o código dele quando reenviasse
        // a mesma cotação sem tocar no campo).
        const anterior = vinculosExistentes[0];
        const podeSobrescrever =
          anterior.confianca !== 'manual' || fornecedorEditou;
        if (podeSobrescrever) {
          await DB.update('fornecedor_codigo_item', anterior.id, dadosVinculo, tenantId);
        }
      } else {
        await DB.insert('fornecedor_codigo_item', {
          ...dadosVinculo,
          criado_em: new Date().toISOString(),
        }, tenantId);
      }
    }
  }

  // 3. Recalcular cabeçalho com estado completo
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

  const itensEsperadosDoFornecedor = (itensCotacao || []).filter(item => {
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

  // 4. Todos responderam?
  const total = await DB.select('cotacao_fornecedores', { cotacao_id: cotacaoId });
  const respondidos = total.filter(f => f.status === 'respondido');
  if (total.length === respondidos.length && total.length > 0) {
    await DB.update('cotacoes', cotacaoId, { status: 'respondida' }, tenantId);
  }

  // 5. Email de confirmação (best-effort)
  try {
    const fornecedor = await DB.selectOne('fornecedores', { id: fornecedorId }, tenantId);
    const empresa = await DB.selectOne('tenants', { id: tenantId });
    const cotacao = await DB.selectOne('cotacoes', { id: cotacaoId }, tenantId);

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
    const freteTotalEmail = respostas.reduce((s, r) =>
      s + parseFloat(r.valor_frete || 0), 0);
    const totalGeral = valorItensTotal + freteTotalEmail;

    const assunto = `Proposta enviada com sucesso - Cotação ${cotacao?.numero || '[sem número]'}`;
    const corpo = `
      <h2>Proposta enviada!</h2>
      <p>Olá <strong>${fornecedor?.nome || 'Fornecedor'}</strong>,</p>
      <p>Sua proposta para a cotação <strong>${cotacao?.numero || cotacaoId}</strong> foi enviada com sucesso para ${empresa?.nome || 'a empresa'}.</p>
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
      <p style="text-align:right;"><strong>Frete:</strong> R$ ${freteTotalEmail.toFixed(2).replace('.', ',')}</p>
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
  } catch (err) {
    console.error('❌ Falha ao enviar e-mail de confirmação:', err.message);
  }

  return { valorTotal };
}

module.exports = { carregarParaResposta, responderPortal };