// frontend/src/utils/gerarPdfNC.js
//
// M4.5: gera o HTML "printável" do relatório de Não Conformidade.
// Chamado pelo ModalGerarPdfNC — abre uma nova aba com esse HTML e dispara
// window.print().
//
// Sem dependência nova. CSS embutido como string (não depende de arquivo
// externo, funciona em dev E em produção com build do Vite).
//
// Decisão de produto: PDFs NUNCA têm links clicáveis pros anexos. Fotos
// entram como miniatura. PDFs anexados aparecem SÓ por nome.

import { logoHtml } from "./logoEmpresa"; // 14c (etapa 2): logo da empresa no cabeçalho
const CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0; background: #f5f5f5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #111; font-size: 12px; line-height: 1.5;
  }
  .pagina {
    max-width: 210mm; min-height: 297mm;
    margin: 12mm auto; padding: 14mm;
    background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  .cabecalho {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding-bottom: 10px; border-bottom: 2px solid #111; margin-bottom: 8px;
  }
  .tenant-nome { font-size: 15px; font-weight: 700; color: #111; }
  .tenant-cnpj { font-size: 10px; color: #666; margin-top: 2px; }
  .cabecalho-direita { text-align: right; }
  .nc-numero {
    font-family: "IBM Plex Mono", "Courier New", monospace;
    font-size: 14px; font-weight: 700; color: #111;
  }
  .nc-status {
    font-size: 10px; color: #666; text-transform: uppercase;
    letter-spacing: 0.05em; margin-top: 2px;
  }
  .titulo-relatorio {
    font-size: 16px; font-weight: 600; text-align: center;
    margin: 18px 0 22px; letter-spacing: 0.02em;
    text-transform: uppercase; color: #222;
  }
  .bloco {
    margin-bottom: 14px; border: 1px solid #ddd;
    border-radius: 4px; overflow: hidden;
    page-break-inside: avoid;
  }
  .bloco h2 {
    font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: #333;
    background: #f3f4f6; margin: 0; padding: 6px 10px;
    border-bottom: 1px solid #ddd;
  }
  .bloco-conteudo { padding: 10px; }
  .linha {
    display: grid; grid-template-columns: 130px 1fr;
    gap: 10px; padding: 4px 0; border-bottom: 1px dashed #eee;
  }
  .linha:last-child { border-bottom: none; }
  .linha .label {
    font-size: 10px; color: #666; text-transform: uppercase;
    letter-spacing: 0.04em; font-weight: 600;
  }
  .linha .valor { font-size: 11px; color: #111; }
  .texto-bloco {
    margin: 0; font-size: 11.5px; line-height: 1.6;
    color: #111; white-space: pre-wrap; word-wrap: break-word;
  }
  .lista-porques { list-style: none; margin: 0 0 12px; padding: 0; }
  .lista-porques li {
    padding: 4px 0; border-bottom: 1px dashed #eee; font-size: 11.5px;
  }
  .lista-porques li:last-child { border-bottom: none; }
  .porque-num { font-weight: 700; color: #555; margin-right: 6px; }
  .causa-raiz {
    background: #fafafa; border-left: 3px solid #111;
    padding: 8px 12px; margin-top: 6px;
  }
  .causa-raiz-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
    color: #444; font-weight: 700; margin-bottom: 4px;
  }
  .encerramento {
    margin-top: 10px; font-size: 10.5px; color: #666; font-style: italic;
  }
  .grid-fotos {
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 10px; margin-bottom: 10px;
  }
  .foto-thumb { display: flex; flex-direction: column; align-items: center; }
  .foto-thumb img {
    width: 100%; height: 60mm; object-fit: cover;
    border-radius: 3px; border: 1px solid #ddd;
  }
  .foto-nome {
    font-size: 8.5px; color: #666; margin-top: 4px;
    text-align: center; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; max-width: 100%;
  }
  .anexos-pdf { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #eee; }
  .anexos-pdf-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
    color: #666; font-weight: 700; margin-bottom: 4px;
  }
  .anexos-pdf ul { margin: 0; padding-left: 16px; font-size: 11px; }
  .anexos-pdf li { padding: 1px 0; }
  .lista-eventos { list-style: none; margin: 0; padding: 0; }
  .lista-eventos li {
    display: grid; grid-template-columns: 120px 140px 1fr;
    gap: 10px; padding: 5px 0; border-bottom: 1px dashed #eee;
    font-size: 10.5px; align-items: baseline;
  }
  .lista-eventos li:last-child { border-bottom: none; }
  .ev-data {
    font-family: "IBM Plex Mono", "Courier New", monospace;
    color: #666; font-size: 9.5px;
  }
  .ev-autor { font-weight: 600; color: #333; }
  .ev-desc { color: #111; }
  .rodape {
    margin-top: 24px; padding-top: 10px; border-top: 1px solid #ccc;
    font-size: 9.5px; color: #666; text-align: center;
  }
  .aviso-anexos { margin-top: 4px; font-style: italic; color: #888; }
  .contato-bloco { font-size: 11px; line-height: 1.7; color: #111; }
  .contato-nome { font-weight: 600; margin-bottom: 2px; }
  .contato-linha { color: #444; margin-left: 16px; }
  @media print {
    body { background: #fff; }
    .pagina {
      margin: 0; padding: 12mm; box-shadow: none;
      max-width: none; min-height: auto;
    }
    .bloco { page-break-inside: avoid; }
    .bloco h2 {
      background: #f3f4f6 !important; color: #333 !important;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .foto-thumb img {
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
  }
`;

const fmtData = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

const fmtDataHora = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const ROTULOS_STATUS = {
  aberta: 'Aberta',
  em_analise: 'Em análise',
  em_execucao: 'Em execução',
  aguardando_validacao: 'Aguardando validação',
  resolvida: 'Resolvida',
  cancelada: 'Cancelada',
};

const ROTULOS_DISPOSICAO = {
  pendente: 'Pendente de decisão',
  devolucao: 'Devolução ao fornecedor',
  retrabalho: 'Retrabalho',
  descarte: 'Descarte (refugo)',
  uso_como_esta: 'Uso como está (concessão)',
};

const ROTULOS_ORIGEM = {
  recebimento: 'Recebimento',
  os_material: 'Material na OS',
  os_servico: 'Serviço na OS',
  inspecao: 'Inspeção',
  pos_venda: 'Pós-venda',
};

function bloco(titulo, conteudoHtml) {
  if (!conteudoHtml) return '';
  return `
    <section class="bloco">
      <h2>${esc(titulo)}</h2>
      <div class="bloco-conteudo">${conteudoHtml}</div>
    </section>
  `;
}

function linhaDupla(label, valor) {
  return `
    <div class="linha">
      <div class="label">${esc(label)}</div>
      <div class="valor">${valor != null && valor !== '' ? esc(valor) : '—'}</div>
    </div>
  `;
}

export function gerarHtmlRelatorioNC({
  nc,
  tenant,
  usuario,
  versao = 'interno',          // 'interno' | 'fornecedor'
  incluirCausaRaiz = false,    // só interno
  incluirTrilha = false,       // só interno
  incluirDevolucoes = false,   // só fornecedor
}) {
  const ehFornecedor = versao === 'fornecedor';
  const stLabel = ROTULOS_STATUS[nc.status] || nc.status;
  const origemLabel = ROTULOS_ORIGEM[nc.origem] || nc.origem || '—';
  const dispLabel = ROTULOS_DISPOSICAO[nc.disposicao] || nc.disposicao || '—';

  // ── Cabeçalho ──
  const cabecalho = `
    <header class="cabecalho">
      <div class="cabecalho-esquerda">
        ${logoHtml()}
        <div class="tenant-nome">${esc(tenant?.nome || '—')}</div>
        ${tenant?.cnpj ? `<div class="tenant-cnpj">CNPJ: ${esc(tenant.cnpj)}</div>` : ''}
      </div>
      <div class="cabecalho-direita">
        <div class="nc-numero">${esc(nc.numero_nc)}</div>
        <div class="nc-status">${esc(stLabel)}</div>
      </div>
    </header>
    <h1 class="titulo-relatorio">Relatório de Não Conformidade</h1>
  `;

  // ── Identificação ──
  // M4.5: "aberta por" faz sentido no interno (mostra quem da Qualidade
  // abriu). No fornecedor, não — é ruído (ele não conhece os usuários
  // internos do cliente). "Fornecedor" também não (é ele mesmo).
  const idLinhas = [
    linhaDupla('Origem', origemLabel),
    nc.chamado_numero ? linhaDupla('Ordem de Serviço', nc.chamado_numero) : '',
    linhaDupla('Aberta em', fmtDataHora(nc.criado_em)),
    !ehFornecedor && nc.criado_por_nome ? linhaDupla('Aberta por', nc.criado_por_nome) : '',
    nc.data_ocorrencia ? linhaDupla('Data da ocorrência', fmtDataHora(nc.data_ocorrencia)) : '',
    !ehFornecedor && nc.fornecedor_nome ? linhaDupla('Fornecedor', nc.fornecedor_nome) : '',
    nc.equipamento_nome ? linhaDupla('Equipamento', `${nc.equipamento_nome}${nc.equipamento_tag ? ` · ${nc.equipamento_tag}` : ''}`) : '',
  ].filter(Boolean).join('');
  const identificacao = bloco('Identificação', idLinhas);

  // ── Item + Rastreabilidade ──
  const nomeItem = nc.item_nome || nc.item_nome_avulso;
  const skuItem = nc.item_sku || nc.item_sku_avulso;
  const itemLinhas = [
    nomeItem ? linhaDupla('Item', nomeItem) : '',
    skuItem ? linhaDupla('Part Number', skuItem) : '',
    nc.quantidade != null ? linhaDupla('Quantidade', `${nc.quantidade} ${nc.unidade_medida || 'UN'}`) : '',
    nc.numero_nota_fiscal ? linhaDupla('Nota Fiscal', nc.numero_nota_fiscal) : '',
    nc.numero_pedido ? linhaDupla('Pedido (OC)', nc.numero_pedido) : '',
    nc.lote ? linhaDupla('Lote', nc.lote) : '',
    nc.numero_serie ? linhaDupla('Número de série', nc.numero_serie) : '',
    nc.validade ? linhaDupla('Validade', fmtData(nc.validade)) : '',
  ].filter(Boolean).join('');
  const rastreabilidade = itemLinhas ? bloco('Item e Rastreabilidade', itemLinhas) : '';

  // ── Descrição do problema ──
  const descricao = bloco(
    'Descrição do problema',
    `<p class="texto-bloco">${esc(nc.descricao_problema || nc.motivo_recusa || '—')}</p>`
  );

  // ── Ação imediata ──
  const acaoImediata = nc.acao_imediata
    ? bloco('Ação imediata', `<p class="texto-bloco">${esc(nc.acao_imediata)}</p>`)
    : '';

  // ── Disposição (fix: sem duplicar o título) ──
  const dispLinhas = [
    nc.executante_nome ? linhaDupla('Executante', nc.executante_nome) : '',
    nc.acao_corretiva ? linhaDupla('Ação corretiva', nc.acao_corretiva) : '',
  ].filter(Boolean).join('');
  // Bloco de disposição é interno (contém análise da Qualidade).
  const disposicao = (!ehFornecedor && (dispLabel !== 'Pendente de decisão' || nc.acao_corretiva))
    ? bloco(`Disposição — ${dispLabel}`, dispLinhas || '<p class="texto-bloco">—</p>')
    : '';

  // ── Análise e causa raiz (opcional) ──
  let causaRaizBloco = '';
  if (!ehFornecedor && incluirCausaRaiz) {
    const porques = Array.isArray(nc.cinco_porques) ? nc.cinco_porques.filter(Boolean) : [];
    const linhasCausa = [];

    if (porques.length > 0) {
      const lista = porques
        .map((p, i) => `<li><span class="porque-num">${i + 1}º porquê:</span> ${esc(p)}</li>`)
        .join('');
      linhasCausa.push(`<ol class="lista-porques">${lista}</ol>`);
    }
    if (nc.causa_raiz) {
      linhasCausa.push(`
        <div class="causa-raiz">
          <div class="causa-raiz-label">Causa raiz</div>
          <p class="texto-bloco">${esc(nc.causa_raiz)}</p>
        </div>
      `);
    }
    if (nc.encerrada_por_nome || nc.encerrada_em) {
      const partes = [];
      if (nc.encerrada_por_nome) partes.push(`por ${esc(nc.encerrada_por_nome)}`);
      if (nc.encerrada_em) partes.push(`em ${fmtDataHora(nc.encerrada_em)}`);
      linhasCausa.push(`<div class="encerramento">Encerrada ${partes.join(' ')}</div>`);
    }

    if (linhasCausa.length > 0) {
      causaRaizBloco = bloco('Análise e causa raiz', linhasCausa.join(''));
    }
  }

  // ── Tratativa do fornecedor (só versão fornecedor) ──
  // Mostra o que o próprio fornecedor respondeu (contestar/resolver) e,
  // quando houver, o motivo da última devolução. É informação do fornecedor
  // — ele precisa ver o que ficou registrado em nome dele.
  let tratativaBloco = '';
  if (ehFornecedor) {
    const ROTULOS_RESOLUCAO = {
      substituicao: 'Substituição do item',
      ressarcimento: 'Ressarcimento financeiro',
      credito: 'Crédito futuro',
      reparo: 'Reparo / retrabalho',
      devolucao_estorno: 'Devolução com estorno',
      aceite_com_ressalva: 'Aceite com ressalva',
      outro: 'Outro',
    };
    const ROTULOS_RESPOSTA = {
      contestada: 'Contestada',
      resolvida_fornecedor: 'Resolvida',
    };

    const eventos = Array.isArray(nc.eventos) ? nc.eventos : [];
    const respostas = eventos
      .filter(ev => ev.tipo === 'resposta_fornecedor')
      .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
    const ultimaResposta = respostas[0];

    // Devoluções do comprador (só as visíveis ao fornecedor — as que têm
    // `tipo === 'devolucao_fornecedor'`).
    const devolucoes = eventos
      .filter(ev => ev.tipo === 'devolucao_fornecedor')
      .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));

    const linhas = [];
    if (ultimaResposta) {
      const dados = ultimaResposta.dados || {};
      const resposta = dados.resposta || null;
      const tipo = dados.tipo_resolucao || null;
      linhas.push(linhaDupla('Resposta', ROTULOS_RESPOSTA[resposta] || resposta || '—'));
      if (tipo) linhas.push(linhaDupla('Tipo de resolução', ROTULOS_RESOLUCAO[tipo] || tipo));
      linhas.push(linhaDupla('Data da resposta', fmtDataHora(ultimaResposta.criado_em)));
      if (dados.observacao) {
        linhas.push(`
          <div class="linha">
            <div class="label">Observação</div>
            <div class="valor"><p class="texto-bloco">${esc(dados.observacao)}</p></div>
          </div>
        `);
      }
    } else {
      linhas.push(`<p class="texto-bloco">Ainda não há resposta registrada para esta NC.</p>`);
    }

    tratativaBloco = bloco('Tratativa do fornecedor', linhas.join(''));
    // (a variável `devolucoes` é usada no bloco de devoluções, logo abaixo)
    nc.__devolucoes = devolucoes;  // gambiarra leve pra não mudar assinatura
  }

  // ── Histórico de devoluções (só fornecedor, opcional) ──
  let devolucoesBloco = '';
  if (ehFornecedor && incluirDevolucoes && Array.isArray(nc.__devolucoes) && nc.__devolucoes.length > 0) {
    const itens = nc.__devolucoes.map(ev => {
      const dados = ev.dados || {};
      const rodada = dados.rodada != null ? `Rodada ${dados.rodada}` : 'Devolução';
      const motivo = dados.motivo || ev.descricao || '—';
      return `
        <li>
          <div class="ev-data">${fmtDataHora(ev.criado_em)} · ${esc(rodada)}</div>
          <div class="ev-desc">${esc(motivo)}</div>
        </li>
      `;
    }).join('');
    devolucoesBloco = bloco('Histórico de devoluções',
      `<ul class="lista-eventos lista-eventos-simples">${itens}</ul>`);
  }

  // ── Evidências ──
  const fotos = (nc.anexos || []).filter(a => a.mime_type?.startsWith('image/'));
  const pdfs = (nc.anexos || []).filter(a => a.mime_type === 'application/pdf');

  let evidenciasBloco = '';
  if (fotos.length > 0 || pdfs.length > 0) {
    const partes = [];

    if (fotos.length > 0) {
      const thumbs = fotos.map(f => {
        const src = f.signed_url || f.url || '';
        return `
          <div class="foto-thumb">
            <img src="${esc(src)}" alt="${esc(f.nome_arquivo || '')}" />
            <div class="foto-nome">${esc(f.nome_arquivo || '')}</div>
          </div>
        `;
      }).join('');
      partes.push(`<div class="grid-fotos">${thumbs}</div>`);
    }

    if (pdfs.length > 0) {
      const lista = pdfs.map(p => `<li>${esc(p.nome_arquivo || 'documento.pdf')}</li>`).join('');
      partes.push(`
        <div class="anexos-pdf">
          <div class="anexos-pdf-label">Documentos anexados</div>
          <ul>${lista}</ul>
        </div>
      `);
    }

    evidenciasBloco = bloco('Evidências', partes.join(''));
  }

  // ── Trilha de auditoria (opcional) ──
  let trilhaBloco = '';
  if (!ehFornecedor && incluirTrilha && Array.isArray(nc.eventos) && nc.eventos.length > 0) {
    const itens = nc.eventos
      .slice()
      .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
      .map(ev => `
        <li>
          <span class="ev-data">${fmtDataHora(ev.criado_em)}</span>
          <span class="ev-autor">${esc(ev.criado_por_nome || '—')}</span>
          <span class="ev-desc">${esc(ev.descricao || '')}</span>
        </li>
      `)
      .join('');
    trilhaBloco = bloco('Trilha de auditoria', `<ul class="lista-eventos">${itens}</ul>`);
  }

  // ── Contato (só versão fornecedor) ──
  // Mostra os dados do cliente + comprador pra o fornecedor saber com
  // quem falar. SEM links clicáveis (PDF pode ser distribuído).
  let contatoBloco = '';
  if (ehFornecedor && nc.contato) {
    const { empresa, comprador, principal } = nc.contato;
    const linhas = [];

    if (empresa?.nome) {
      linhas.push(`<div class="contato-nome">🏢 ${esc(empresa.nome)}</div>`);
      if (empresa.cnpj) linhas.push(`<div class="contato-linha">CNPJ: ${esc(empresa.cnpj)}</div>`);
    }
    if (comprador?.nome && comprador.nome !== empresa?.nome) {
      linhas.push(`<div class="contato-nome">👤 ${esc(comprador.nome)} (comprador)</div>`);
      if (comprador.email) linhas.push(`<div class="contato-linha">✉ ${esc(comprador.email)}</div>`);
      if (comprador.telefone) linhas.push(`<div class="contato-linha">📞 ${esc(comprador.telefone)}</div>`);
    } else if (principal?.telefone || principal?.email) {
      if (principal.telefone) linhas.push(`<div class="contato-linha">📞 ${esc(principal.telefone)}</div>`);
      if (principal.email) linhas.push(`<div class="contato-linha">✉ ${esc(principal.email)}</div>`);
    }

    if (linhas.length > 0) {
      contatoBloco = bloco('Dúvidas sobre esta NC?',
        `<div class="contato-bloco">${linhas.join('')}</div>`);
    }
  }

  // ── Rodapé ──
  const rodape = `
    <footer class="rodape">
      <div>Gerado por ${esc(usuario?.nome || '—')} · ${fmtDataHora(new Date().toISOString())}</div>
      <div class="aviso-anexos">
        Documentos anexados (PDFs) disponíveis apenas no QuotaFlow, com autenticação.
      </div>
    </footer>
  `;

  // M4.5: nome do arquivo no diálogo "Salvar como PDF".
  // Comprador: {numero}_{fornecedor}_Relatório de não conformidade
  // Fornecedor: {numero}_{cliente}_Relatório de não conformidade
  const contraparte = ehFornecedor
    ? (tenant?.nome || 'Cliente')
    : (nc.fornecedor_nome || 'Fornecedor');
  const tituloArquivo = `${nc.numero_nc}_${contraparte}_Relatório de não conformidade`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${esc(tituloArquivo)}</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="pagina">
    ${cabecalho}
    ${identificacao}
    ${rastreabilidade}
    ${descricao}
    ${acaoImediata}
    ${tratativaBloco}
    ${devolucoesBloco}
    ${disposicao}
    ${causaRaizBloco}
    ${evidenciasBloco}
    ${trilhaBloco}
    ${contatoBloco}
    ${rodape}
  </div>
  <script>
    window.addEventListener('load', function () {
      const imgs = Array.from(document.images);
      const pendentes = imgs.filter(img => !img.complete);
      Promise.all(pendentes.map(img => new Promise(res => {
        img.onload = res;
        img.onerror = res;
      }))).then(() => {
        setTimeout(() => window.print(), 200);
      });
    });
  </script>
</body>
</html>`;
}