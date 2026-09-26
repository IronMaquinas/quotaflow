// components/estoque/TelaRecebimento.jsx
import { useState, useEffect, useRef } from 'react';
import apiService from '../../services/apiService';
import { LeitorCodigoBarras } from "../../components/LeitorCodigoBarras";

// Função para formatar valores em Reais
const fmtBRL = (v) => {
  return v != null ? `R$ ${Number(v).toFixed(2).replace('.', ',')}` : '—';
};

export default function TelaRecebimento({ C, s, fmtD }) {
  // ─── ESTADOS PARA FLUXO PRINCIPAL (OVs) ────────────────────
  const [ordensVendaAbertas, setOrdensVendaAbertas] = useState([]);
  const [ordemVendaSel, setOrdemVendaSel] = useState(null);
  const [itensOV, setItensOV] = useState([]);
  const [buscaOV, setBuscaOV] = useState('');
  const [loading, setLoading] = useState(true);
  const [abrirLeitor, setAbrirLeitor] = useState(false);

  const [modalAvulso, setModalAvulso] = useState(false);
  const [itens, setItens] = useState([]);
  const [busca, setBusca] = useState('');
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [quantidade, setQuantidade] = useState('');
  const [fornecedor_id, setFornecedorId] = useState('');
  const [lote, setLote] = useState('');
  const [validade, setValidade] = useState('');
  const [numero_nota_fiscal, setNumeroNotaFiscal] = useState('');
  const [observacao, setObservacao] = useState('');
  const [mensagem, setMensagem] = useState(null);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const inputRef = useRef(null);
  const [fornecedores, setFornecedores] = useState([]);
  const [mostrarMotivo, setMostrarMotivo] = useState(false);
  const [matchingItem, setMatchingItem] = useState(null);
  const [validacaoXML, setValidacaoXML] = useState(null);

  // Contagem Cega
  const [contagemCega, setContagemCega] = useState(null);
  const [itensPendentesContagem, setItensPendentesContagem] = useState([]);
  const [modalContagemCega, setModalContagemCega] = useState(false);
  const [contagemTentativa, setContagemTentativa] = useState(1);
  const [itensParaContar, setItensParaContar] = useState([]);
  const [contagens, setContagens] = useState({}); // { itemId: { quantidade, lote, validade, numero_serie } }
  // ─── STATUS PARA MIGO / MIRO ──────────────────────────────────────────────
  const [ordensEmProcesso, setOrdensEmProcesso] = useState([]);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('pendentes');

  // ─── ESTADOS PARA MIRO / MIGO ─────────────────────────────
  const [itemConferenciaFiscal, setItemConferenciaFiscal] = useState(null);
  const [itemConferenciaFisica, setItemConferenciaFisica] = useState(null);
  // M3: aba ativa no modal fiscal. Só usada em modo auto (item com NF-e
  // já validada pelo fornecedor). 'conferencia' = tabela OC × NF-e;
  // 'danfe' = DANFE visual completa.
  const [abaModalFiscal, setAbaModalFiscal] = useState('conferencia');

  const [itemTratativaQuarentena, setItemTratativaQuarentena] = useState(null);
  const [justificativaTratativa, setJustificativaTratativa] = useState('');
  const [modalSucessoNC, setModalSucessoNC] = useState(null);

  // ─── FUNÇÕES PARA OVs (INVESTIGAÇÃO DE STATUS PAI) ────────────────────
  const carregarOVs = async () => {
    try {
      console.log('🔍 [frontend] carregarOVs chamada');
      const data = await apiService.get('/ordens-venda');
      
      console.log('━━━━━━━━━━ 🕵️ RAIO-X DE STATUS DA ORDEM PAI ━━━━━━━━━━');
      if (data && data.length > 0) {
        // Encontra a nossa OV com problema no array
        const ovProblema = data.find(o => o.numero === 'OV-202609-0001') || data[0];
        
        console.log(`Análise da Ordem: ${ovProblema.numero}`);
        console.log("Todas as chaves de status disponíveis na ordem pai:", Object.keys(ovProblema));
        console.log("Valores reais que chegaram do banco/backend:");
        console.log(`-> status: "${ovProblema.status}"`);
        console.log(`-> status_recebimento: "${ovProblema.status_recebimento}"`);
        console.log(`-> statusRecebimento: "${ovProblema.statusRecebimento}"`);
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      setOrdensVendaAbertas(data || []);
    } catch (err) {
      console.error('❌ [frontend] Erro ao carregar OVs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Função para associar manualmente
  const associarItem = async (itemOV, itemNFe) => {
    try {
      // Pega o nome do produto que veio da nota fiscal
      const nomeProdutoNFe = (itemNFe?.descricao || itemNFe?.item_nfe || '').trim();

      if (!window.confirm(`Deseja associar "${nomeProdutoNFe}" ao item da OC "${itemOV?.item_nome}"?`)) {
        return;
      }
   
      setItemConferenciaFiscal(prev => {
        if (!prev?.validacao_xml?.itens) return prev;

        // 1. Mapeia diretamente pelo nome do item que está na NFe (que é o único dado presente no objeto)
        const itensAtualizados = prev.validacao_xml.itens.map(itemXML => {
          const nomeNoObjeto = (itemXML.item_nfe || '').trim();

          // Se for o mesmo texto do item da NFe que o usuário clicou para resolver
          if (nomeNoObjeto === nomeProdutoNFe) {
            return {
              ...itemXML,
              status: 'ok', // Limpa a pendência visualmente
              mensagem: 'Associado para ' + (itemOV?.item_nome || 'Item'),
              item_nfe: nomeProdutoNFe
            };
          }
          return itemXML;
        });

        // 2. Recalcula as divergências de forma limpa sobre o novo array
        const errosItens = itensAtualizados.filter(i => i.status !== 'ok' && i.status !== 'aprovado_manual').length;
        const erroCnpjEmitente = prev.validacao_xml.cnpj_status !== 'ok' ? 1 : 0;
        const erroCnpjDestinatario = (prev.validacao_xml.cnpj_destinatario?.includes('❌') || prev.validacao_xml.cnpj_destinatario_status === 'divergente') ? 1 : 0;

        const novoTotal = errosItens + erroCnpjEmitente + erroCnpjDestinatario;

        return {
          ...prev,
          validacao_xml: {
            ...prev.validacao_xml,
            itens: itensAtualizados,
            totalDivergencias: novoTotal
          }
        };
      });
      
      setMatchingItem(null);
      alert(`✅ Item associado com sucesso!`);
    } catch (err) {
      console.error('❌ Erro:', err);
      alert('Erro ao associar item: ' + err.message);
    }
  };

  // função para processar o resultado da MIRO e preparar a MIGO
  const processarResultadoMIRO = (itensProcessados) => {
    // Separa itens aprovados e reprovados
    const aprovados = itensProcessados.filter(i => i.status_quarentena === 'aprovado');
    const reprovados = itensProcessados.filter(i => i.status_quarentena === 'rejeitado');

    // Se todos foram aprovados, vai direto para MIGO
    if (reprovados.length === 0) {
      setItensPendentesContagem(aprovados);
      abrirContagemCega(aprovados, 1);
      return;
    }

    // Se há reprovados, perguntar
    const msg = `🔴 Detectada divergência em ${reprovados.length} item(ns):\n\n${reprovados.map(i => `• ${i.item_nome}`).join('\n')}\n\nDeseja abrir a SEGUNDA CONTAGEM CEGA para estes itens?`;
    
    if (window.confirm(msg)) {
      // Usuário quer tentar novamente
      setItensPendentesContagem(reprovados);
      abrirContagemCega(reprovados, 2);
    } else {
      // Usuário não quer tentar novamente -> quarentena
      reprovados.forEach(async (item) => {
        await apiService.put(`/estoque/movimentacoes/item/${item.id}/fisica`, {
          status_quarentena: 'rejeitado',
          motivo_divergencia: 'Item em quarentena após divergência na conferência fiscal'
        });
      });
      alert('🚫 Itens enviados para quarentena!');
      carregarItensOV(ordemVendaSel.id);
    }
  };

  // ─── FUNÇÃO PARA ABRIR CONTAGEM CEGA ────────────────────────
  const abrirContagemCega = (itens, tentativa) => {
    // Verificar se já ultrapassou 3 tentativas
    if (tentativa > 3) {
      alert('🚫 Número máximo de contagens (3) excedido! O item será enviado para quarentena.');
      
      // Enviar para quarentena
      itens.forEach(async (item) => {
        await apiService.post('/estoque/movimentacoes/contagem-cega', {
          item_id: item.id,
          quantidade: 0,
          tentativa: tentativa,
          status: 'rejeitado',
          observacao: 'Máximo de contagens excedido'
        });
      });
      
      carregarItensOV(ordemVendaSel.id);
      return;
    }

    // Limpar contagens anteriores
    setContagens({});
    setItensParaContar(itens);
    setContagemTentativa(tentativa);
    setModalContagemCega(true);
  };

  // ─── FUNÇÃO PARA ATUALIZAR CAMPOS DE CONTAGEM ──────────────
  const atualizarContagem = (itemId, campo, valor) => {
    setContagens(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [campo]: valor
      }
    }));
  };

  // ─── FUNÇÃO PARA SALVAR CONTAGEM CEGA (CORRIGIDA) ──────────
  const salvarContagemCega = async (itemId) => {
    try {
      const dados = contagens[itemId];
      const item = itensParaContar.find(i => i.id === itemId);

      if (!dados || !dados.quantidade || parseFloat(String(dados.quantidade).replace(',', '.')) <= 0) {
        alert('⚠️ Informe a quantidade contada!');
        return;
      }

      if (!item) {
        alert('❌ Item não encontrado!');
        return;
      }

      // 🔥 Valida se unidade foi selecionada
      const unidadeContada = dados.unidade_medida || '';
      if (!unidadeContada) {
        alert('⚠️ Selecione a unidade de medida usada na contagem!');
        return;
      }

      const qtdContada = parseFloat(String(dados.quantidade).replace(',', '.'));

      // 🔥 Envia a contagem para o backend (sem status)
      const response = await apiService.post('/estoque/movimentacoes/contagem-cega', {
        item_id: itemId,
        quantidade: qtdContada,
        tentativa: contagemTentativa,
        lote: dados.lote || null,
        validade: dados.validade || null,
        numero_serie: dados.numero_serie || null,
        unidade_medida: unidadeContada,
        observacao: `Contagem ${contagemTentativa}ª tentativa`
      });

      // 🔥 O backend retorna o status calculado
      const statusBackend = response.status; // 'aprovado', 'pendente' ou 'rejeitado'

      // Remove o item da lista de pendentes do modal
      const novosItens = itensParaContar.filter(i => i.id !== itemId);
      setItensParaContar(novosItens);
      setContagens(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });

      // Se terminou de contar todos os itens do modal
      if (novosItens.length === 0) {
        setModalContagemCega(false);

        // Recarrega a lista de itens da OV para pegar os status atualizados
        await carregarItensOV(ordemVendaSel.id);

        // Busca novamente os itens da OV para verificar divergências pendentes
        const itemAtualizado = await apiService.get(`/estoque/movimentacoes/ordem-venda/${ordemVendaSel.id}`);
        
        // 🔥 Filtra itens que ficaram com status 'pendente' (divergência) e têm menos de 3 tentativas
        const itensDivergentes = itemAtualizado.itens.filter(i => 
          i.status_quarentena === 'pendente' && 
          i.tentativa_atual < 3
        );

        if (itensDivergentes.length > 0 && contagemTentativa < 3) {
          const msg = `🔴 Divergência detectada em ${itensDivergentes.length} item(ns) na ${contagemTentativa}ª contagem!\n\nDeseja abrir a ${contagemTentativa + 1}ª CONTAGEM CEGA?`;
          
          if (window.confirm(msg)) {
            // 🔥 Reabre o modal com os itens divergentes e aumenta a tentativa
            abrirContagemCega(itensDivergentes, contagemTentativa + 1);
            return; // Não exibe o alert de sucesso agora
          } else {
            // Usuário optou por não continuar: mantém os itens como pendentes
            alert('⏸️ Contagens interrompidas. Os itens divergentes permanecem pendentes para recontagem posterior.');
            await carregarOVs(); // Atualiza a lista de OVs
            return;
          }
        }

        // Se não há divergentes, verifica se todos foram aprovados ou se houve quarentena
        const itensRejeitados = itemAtualizado.itens.filter(i => i.status_quarentena === 'rejeitado');
        if (itensRejeitados.length > 0) {
          alert(`🚫 ${itensRejeitados.length} item(ns) enviado(s) para quarentena.`);
        } else {
          alert('✅ Todos os itens foram aprovados na contagem!');
        }
        
        await carregarOVs(); // Atualiza a lista de OVs
        return;
      }

      // Se ainda há itens para contar no modal, apenas informa o status do item contado
      let mensagemStatus = '';
      if (statusBackend === 'aprovado') {
        mensagemStatus = '✅ Aprovado!';
      } else if (statusBackend === 'pendente') {
        mensagemStatus = '⏸️ Pendente - Aguardando nova tentativa';
      } else if (statusBackend === 'rejeitado') {
        mensagemStatus = '🚫 Em quarentena';
      }
      alert(`📦 Contagem registrada! Status: ${mensagemStatus}`);

    } catch (err) {
      console.error('❌ Erro ao salvar contagem:', err);
      alert('❌ Erro ao salvar contagem: ' + err.message);
    }
  };

  // ─── BUSCAR CONTAGENS PENDENTES ─────────────────────────────
  const carregarContagensPendentes = async () => {
    try {
      setLoadingPendentes(true);
      const response = await apiService.get('/estoque/movimentacoes/contagens-pendentes');
      setContagensPendentes(response.itens || []);
    } catch (err) {
      console.error('❌ Erro ao buscar contagens pendentes:', err);
    } finally {
      setLoadingPendentes(false);
    }
  };

  // Calcular se há divergência
  const temDivergencia = itemConferenciaFiscal ? (
    // Se o XML foi validado, a divergência passa a ser controlada pelo totalDivergencias do XML
    itemConferenciaFiscal.validacao_xml ? (
      parseInt(itemConferenciaFiscal.validacao_xml.totalDivergencias || 0) > 0
    ) : (
      // Fallback para caso o usuário preencha manualmente sem XML
      (itemConferenciaFiscal.valor_nf && parseFloat(itemConferenciaFiscal.valor_nf) !== parseFloat(itemConferenciaFiscal.valor_total_ov || 0)) ||
      (itemConferenciaFiscal.quantidade_nf && parseInt(itemConferenciaFiscal.quantidade_nf) !== parseInt(itemConferenciaFiscal.quantidade))
    )
  ) : false;


  // Função para abrir o pop-up quando não encontrar match
  const abrirMatchingManual = (itemOV, itemNFe) => {
    // 🔥 Verificar se existe a lista de itens do XML
    const itensXML = itemConferenciaFiscal?.xmlData?.itens_xml || [];
    
    // 🔥 Buscar o item da NFe real que está pendente
    const itemNFeEncontrado = itensXML.find(item => {
      // Verificar se as variáveis existem
      const codigoItem = item?.codigo || '';
      const descricaoItem = item?.descricao || '';
      const nomeOV = itemOV?.item_nome || '';
      
      return codigoItem === itemOV.item_catalogo_id || 
            descricaoItem.toLowerCase().includes(nomeOV.toLowerCase());
    }) || itemNFe;
    
    setMatchingItem({ itemOV, itemNFe: itemNFeEncontrado });
  };

  useEffect(() => {
    carregarOVs();
  }, []);

  // ─── CARREGAR ITENS DA OV ──────────────────────────────────
  const carregarItensOV = async (ovId) => {
    try {
      const response = await apiService.get(`/estoque/movimentacoes/ordem-venda/${ovId}`);
      setOrdemVendaSel(response.ordem_venda);
      setItensOV(response.itens || []);
    } catch (err) {
      alert('❌ Erro ao carregar itens: ' + err.message);
    }
  };

  // ─── FUNÇÕES PARA MIRO (FISCAL) ────────────────────────────
  // Normaliza pra match de nome (mesma regra do backend).
  const _normNome = (s) => String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();

  // M3: quando o item já foi auto-aprovado pela validação da NF-e do
  // fornecedor, o modal abre PRÉ-PREENCHIDO com os dados da NF. Sem
  // upload, sem digitação — o comprador só confere e confirma.
  const acharItemNaNfe = (item) => {
    const nfe = ordemVendaSel?.nfe_atual;
    if (!nfe?.resumo?.itens) return null;
    const alvo = _normNome(item.item_nome);
    return nfe.resumo.itens.find(x => _normNome(x.descricao) === alvo) || null;
  };

  const abrirConferenciaFiscal = (item) => {
    const nfe = ordemVendaSel?.nfe_atual;
    const itemNfe = (nfe && nfe.status === 'ok') ? acharItemNaNfe(item) : null;

    // 🔥 Se já foi salvo em quarentena, carregar os dados salvos
    if (item.status_quarentena === 'rejeitado') {
      setItemConferenciaFiscal({
        ...item,
        valor_total_ov: item.valor_total || (item.valor_unitario * item.quantidade) || 0,
        numero_nota_fiscal: item.numero_nota_fiscal || '',
        quantidade_nf: item.quantidade_nf || '',
        valor_nf: item.valor_nf || '',
        impostos: item.impostos || '',
        data_vencimento_pagamento: item.data_vencimento_pagamento || '',
        unidade_medida: item.unidade_medida || 'UN',
        motivo_divergencia: item.motivo_divergencia || '',
        numero_recebimento_ov: item.numero_recebimento_ov || ''
      });
      return;
    }

    // M3: item bateu na validação + NF-e do fornecedor presente = abre
    // com os dados já prontos (número NF, valores, quantidade). O
    // comprador só confirma.
    if (itemNfe && nfe.status === 'ok') {
      setAbaModalFiscal('conferencia'); // reseta a aba ao abrir
      setItemConferenciaFiscal({
        ...item,
        valor_total_ov: item.valor_total || (item.valor_unitario * item.quantidade) || 0,
        numero_nota_fiscal: nfe.numero_nf || '',
        quantidade_nf: itemNfe.quantidade || item.quantidade,
        valor_nf: itemNfe.valor_total || (itemNfe.valor_unitario * itemNfe.quantidade),
        impostos: '',
        data_vencimento_pagamento: '',
        unidade_medida: item.unidade_medida || 'UN',
        motivo_divergencia: '',
        // Marca que o modal abriu em modo auto — o JSX usa pra esconder
        // o upload e mostrar o banner verde.
        _fiscal_auto: true,
        _nfe_origem: {
          numero_nf: nfe.numero_nf,
          chave_acesso: nfe.chave_acesso,
          enviado_em: nfe.enviado_em,
        },
      });
      return;
    }

    // Fallback: sem NF-e, ou XML com divergência — abre vazio, fluxo
    // manual normal.
    setItemConferenciaFiscal({
      ...item,
      valor_total_ov: item.valor_total || (item.valor_unitario * item.quantidade) || 0,
      numero_nota_fiscal: '',
      quantidade_nf: '',
      valor_nf: '',
      impostos: '',
      data_vencimento_pagamento: '',
      unidade_medida: item.unidade_medida || 'UN',
      motivo_divergencia: '',
    });
  };

  // Função para aprovar item manualmente
  const aprovarItemManual = (itemNome) => {
    if (!window.confirm(`Deseja aprovar manualmente a divergência do item "${itemNome}"?`)) {
      return;
    }
    
    setItemConferenciaFiscal(prev => ({
      ...prev,
      validacao_xml: {
        ...prev.validacao_xml,
        itens: prev.validacao_xml.itens.map(item => 
          item.item === itemNome ? { ...item, status: 'ok', mensagem: 'Aprovado manualmente' } : item
        ),
        totalDivergencias: (
          prev.validacao_xml.itens.filter(i => i.status !== 'ok' && i.status !== 'aprovado_manual').length
        ) + (
          prev.validacao_xml.cnpj_status !== 'ok' ? 1 : 0
        ) + (
          prev.validacao_xml.cnpj_destinatario.includes('❌') ? 1 : 0
        )
      }
    }));
    
    // 🔥 Registrar quem aprovou (enviar para o backend)
    apiService.post('/estoque/movimentacoes/aprovar-item-manual', {
      ordem_venda_id: ordemVendaSel.id,
      item_nome: itemNome,
      aprovado_por: localStorage.getItem('usuario')?.id
    });
  };

  const handleSalvarConferenciaFiscal = async (status = 'aprovado', motivo = '') => {
    try {
      await apiService.put(`/estoque/movimentacoes/item/${itemConferenciaFiscal.id}/fiscal`, {
        numero_nota_fiscal: itemConferenciaFiscal.numero_nota_fiscal,
        valor_nf: itemConferenciaFiscal.valor_nf,
        quantidade_nf: itemConferenciaFiscal.quantidade_nf || null,
        impostos: itemConferenciaFiscal.impostos,
        data_vencimento_pagamento: itemConferenciaFiscal.data_vencimento_pagamento || null,
        unidade_medida: itemConferenciaFiscal.unidade_medida || 'UN',
        status_quarentena: status,
        motivo_divergencia: motivo || itemConferenciaFiscal.motivo_divergencia || null // 🔥 Adicionar motivo
      });
      alert(status === 'aprovado' ? '✅ Conferência fiscal salva!' : '🚫 Item em quarentena!');
      setItemConferenciaFiscal(null);
      await carregarItensOV(ordemVendaSel.id);
    } catch (err) {
      alert('Erro ao salvar conferência fiscal: ' + err.message);
    }
  };

  // ─── FUNÇÕES PARA MIGO (FÍSICA) ────────────────────────────
  const abrirConferenciaFisica = (item) => {
    setItemConferenciaFisica({
      ...item,
      quantidade_fisica: '',
      lote: '',
      validade: '',
      numero_serie: '',
      unidade_medida: item.unidade_medida || 'UN'
    });
  };

  // --- FUNÇÃO DE LEITURA DE CÓDIGO DE BARRAS ---
  const handleCodigoDetectado = (codigo) => {
    setItemConferenciaFiscal({
      ...itemConferenciaFiscal,
      numero_nota_fiscal: codigo,
    });
  };

  // --- FUNÇÃO DE IMPORTAÇÃO DO XML ---
  const handleUploadXML = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      // 1. Ler o arquivo
      const reader = new FileReader();
      reader.onload = async (event) => {
        const xmlText = event.target.result;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        // 2. Extrair dados de forma genérica para evitar problemas de escopo/namespace
        const nfe = xmlDoc.getElementsByTagName('NFe')[0] || xmlDoc;
        const infNFe = xmlDoc.getElementsByTagName('infNFe')[0];
        const ide = xmlDoc.getElementsByTagName('ide')[0];
        const emit = xmlDoc.getElementsByTagName('emit')[0];
        const dest = xmlDoc.getElementsByTagName('dest')[0];
        const total = xmlDoc.getElementsByTagName('ICMSTot')[0];
        const transp = xmlDoc.getElementsByTagName('transp')[0];
        
        // 🔥 BUSCA ROBUSTA DOS ITENS <det>
        const det = xmlDoc.getElementsByTagName('det');
        const detList = det && det.length > 0 ? Array.from(det) : Array.from(xmlDoc.querySelectorAll('det'));
        
        // 3. Extrair dados específicos
        const chaveAcesso = infNFe?.getAttribute('Id')?.replace('NFe', '') || '';
        const cnpjEmitente = emit?.getElementsByTagName('CNPJ')[0]?.textContent || '';
        const cnpjDestinatario = dest?.getElementsByTagName('CNPJ')[0]?.textContent || '';
        const numeroNota = ide?.getElementsByTagName('nNF')[0]?.textContent || '';
        const valorTotal = total?.getElementsByTagName('vNF')[0]?.textContent || '';
        const pesoBruto = transp?.getElementsByTagName('pesoB')[0]?.textContent || '';
        const qtdVolumes = transp?.getElementsByTagName('qVol')[0]?.textContent || '';
        
        // 4. Extrair itens corrigido (Adicionado o Return explícito)
        const itensXML = detList.map(item => {
          const prod = item.getElementsByTagName('prod')[0];
          return {
            codigo: prod?.getElementsByTagName('cProd')[0]?.textContent || '',
            descricao: prod?.getElementsByTagName('xProd')[0]?.textContent || '',
            quantidade: prod?.getElementsByTagName('qCom')[0]?.textContent || '',
            valorUnitario: prod?.getElementsByTagName('vUnCom')[0]?.textContent || '',
            valorTotal: prod?.getElementsByTagName('vProd')[0]?.textContent || ''
          };
        });
        
        // 5. Armazenar no estado para validação
        setItemConferenciaFiscal(prev => ({
          ...prev,
          xmlData: {
            chave_acesso: chaveAcesso,
            cnpj_emitente: cnpjEmitente,
            cnpj_destinatario: cnpjDestinatario,
            numero_nota: numeroNota,
            valor_total: valorTotal,
            peso_bruto: pesoBruto,
            qtd_volumes: qtdVolumes,
            itens_xml: itensXML
          }
        }));
        
        alert('✅ XML carregado! Clique em "Validar XML" para verificar.');
      };
      reader.readAsText(file);
    } catch (err) {
      alert('Erro ao analisar XML: ' + err.message);
    }
  };

  // --- FUNÇÃO DE VALIDAÇÃO DO XML IMPORTADO ---
const handleValidarXML = async () => {
  if (!itemConferenciaFiscal.xmlData) {
    alert('Faça o upload do XML primeiro!');
    return;
  }
  
  try {
    const response = await apiService.post('/estoque/movimentacoes/validar-xml', {
      ordem_venda_id: ordemVendaSel.id,
      xml: itemConferenciaFiscal.xmlData
    });
    
    // 🔥 ATUALIZAR O ESTADO DIRETAMENTE
    setItemConferenciaFiscal(prev => ({
      ...prev,
      validacao_xml: response.validacao
    }));
  } catch (err) {
    alert('Erro ao validar XML: ' + err.message);
  }
};

  // --- SALVAR CONFERÊNCIA FÍSICA ---
  const handleSalvarConferenciaFisica = async (status = 'aprovado') => {
    try {
      await apiService.put(`/estoque/movimentacoes/item/${itemConferenciaFisica.id}/fisica`, {
        quantidade_fisica: itemConferenciaFisica.quantidade_fisica,
        lote: itemConferenciaFisica.lote,
        validade: itemConferenciaFisica.validade,
        numero_serie: itemConferenciaFisica.numero_serie,
        unidade_medida: itemConferenciaFisica.unidade_medida || 'UN',
        status_quarentena: status
      });
      alert(status === 'aprovado' ? '✅ Conferência física salva!' : '🚫 Item em quarentena!');
      setItemConferenciaFisica(null);
      await carregarItensOV(ordemVendaSel.id);
    } catch (err) {
      alert('Erro ao salvar conferência física: ' + err.message);
    }
  };

  const entrarItemEstoque = async (item) => {
    try {
      await apiService.post(`/estoque/movimentacoes/entrada`, {
        ordem_venda_id: ordemVendaSel.id,
        item_consumo_id: item.item_consumo_id,
        quantidade: item.quantidade_pendente,
        numero_nota_fiscal: item.numero_nota_fiscal,
        observacao: `Recebimento da OV ${ordemVendaSel.numero}`
      });
      alert('✅ Item recebido e entrada no estoque realizada!');
      await carregarItensOV(ordemVendaSel.id);
    } catch (err) {
      alert('Erro ao entrar no estoque: ' + err.message);
    }
  };

  // ─── FUNÇÃO PARA VER HISTÓRICO DE CONTAGENS ────────────────
  const verHistoricoContagens = async (itemId) => {
    try {
      const response = await apiService.get(`/estoque/movimentacoes/item/${itemId}/historico-contagens`);
      
      if (!response.ok) {
        alert('Erro ao buscar histórico: ' + (response.erro || 'Erro desconhecido'));
        return;
      }

      if (!response.historico || response.historico.length === 0) {
        alert(`📭 Nenhuma contagem registrada para o item "${response.item?.nome || 'Item'}" ainda.`);
        return;
      }

      // Formatar mensagem para exibição
      let msg = `📊 HISTÓRICO DE CONTAGENS\n`;
      msg += `\n📦 Item: ${response.item?.nome || '—'}`;
      msg += `\n🔹 SKU: ${response.item?.sku || '—'}`;
      msg += `\n📋 OV: ${response.ordem_venda?.numero || '—'}`;
      msg += `\n✅ Quantidade Esperada: ${response.item?.quantidade_esperada || 0} ${response.item?.unidade_medida || 'UN'}`;
      msg += `\n📌 Status: ${response.item?.status_contagem === 'concluido' ? '✅ Concluído' : '⏳ Pendente'}`;
      msg += `\n🔢 Tentativas: ${response.total_contagens || 0}/3\n\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      // Adicionar cada contagem
      response.historico.forEach((h, idx) => {
        const status = h.status_quarentena === 'aprovado' ? '✅ Aprovado' : '🚫 Quarentena';
        msg += `🔹 ${h.tentativa}ª TENTATIVA\n`;
        msg += `   📅 Data: ${h.contado_em_formatado || '—'}\n`;
        msg += `   📦 Qtd contada: ${h.quantidade_contada} ${h.unidade_medida || 'UN'}\n`;
        msg += `   📌 Status: ${status}\n`;
        msg += `   👤 Contado por: ${h.contado_por_nome || '—'}\n`;
        if (h.lote) msg += `   🏷️ Lote: ${h.lote}\n`;
        if (h.validade) msg += `   📆 Validade: ${h.validade}\n`;
        if (h.numero_serie) msg += `   🔢 Série: ${h.numero_serie}\n`;
        if (h.observacao) msg += `   📝 Obs: ${h.observacao}\n`;
        if (h.is_atual) msg += `   ⭐ ATUAL (última contagem)\n`;
        msg += `\n---\n\n`;
      });

      // Adicionar resumo no final
      const aprovados = response.historico.filter(h => h.status_quarentena === 'aprovado').length;
      const rejeitados = response.historico.filter(h => h.status_quarentena === 'rejeitado').length;
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `📊 RESUMO: ${aprovados} aprovados | ${rejeitados} em quarentena\n`;

      // Exibir em um alert
      alert(msg);

    } catch (err) {
      console.error('❌ Erro ao buscar histórico:', err);
      alert('Erro ao buscar histórico: ' + err.message);
    }
  };

  // --- FUNÇÃO PARA COMUNICAR MOTIVO DE QUARENTENA ---
    const handleQuarentena = async () => {
    // 1. Perguntar o motivo
    const motivo = window.prompt('Digite o motivo da divergência (ex: NF com quantidade diferente):');
    
    if (!motivo) {
      alert('Motivo é obrigatório para colocar em quarentena!');
      return;
    }
    
    // 2. Salvar com o motivo
    await handleSalvarConferenciaFiscal('rejeitado', motivo);
  };

  // ─── FUNÇÕES PARA RECEBIMENTO AVULSO ───────────────────────
  const carregarItens = async () => {
    try {
      const data = await apiService.get('/estoque/itens');
      setItens(data || []);
    } catch (err) {
      console.error('Erro ao carregar itens:', err);
    }
  };

  const carregarFornecedores = async () => {
    try {
      const data = await apiService.get('/fornecedores');
      setFornecedores(data || []);
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err);
    }
  };

  useEffect(() => {
    if (modalAvulso) {
      carregarItens();
      carregarFornecedores();
    }
  }, [modalAvulso]);

  const sugestoes = itens.filter(i => 
    i.nome.toLowerCase().includes(busca.toLowerCase()) ||
    i.sku?.toLowerCase().includes(busca.toLowerCase()) ||
    i.codigo_barras?.toLowerCase().includes(busca.toLowerCase())
  ).slice(0, 5);

  const selecionarItem = (item) => {
    setItemSelecionado(item);
    setBusca('');
    setShowSugestoes(false);
  };

  const receberAvulso = async () => {
    if (!itemSelecionado || !quantidade) {
      setMensagem({ tipo: 'erro', texto: 'Selecione um item e informe a quantidade' });
      return;
    }

    try {
      const response = await apiService.post('/estoque/movimentacoes/recebimento', {
        item_consumo_id: itemSelecionado.id,
        quantidade: parseFloat(quantidade),
        fornecedor_id: fornecedor_id || null,
        numero_nota_fiscal: numero_nota_fiscal || null,
        lote: lote || null,
        validade: validade || null,
        observacao: observacao || null
      });

      setMensagem({ tipo: 'sucesso', texto: `✅ Recebimento ${response.numero_recebimento} registrado!` });
      setModalAvulso(false);
      setBusca('');
      setItemSelecionado(null);
      setQuantidade('');
      setFornecedorId('');
      setLote('');
      setValidade('');
      setNumeroNotaFiscal('');
      setObservacao('');
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: '❌ Erro ao receber: ' + err.message });
    }
  };

  // M3: constantes derivadas do modal fiscal — calculadas sempre que o
  // componente renderiza. Só usadas quando o modal está aberto.
  const modoAutoFiscal = itemConferenciaFiscal?._fiscal_auto === true;
  const nfeModalFiscal = ordemVendaSel?.nfe_atual;
  const itemNfeModalFiscal = modoAutoFiscal && nfeModalFiscal
    ? acharItemNaNfe(itemConferenciaFiscal)
    : null;

  if (loading) return <div style={{ padding: 20, color: C.muted }}>Carregando...</div>;

return (
  <div style={{ padding: '22px 24px', overflowY: 'auto', height: '100%' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
      <div>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>ESTOQUE</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Recebimento de Material</div>
      </div>
      <button onClick={() => setModalAvulso(true)} style={{ ...s.btn(false), padding: '9px 18px', fontSize: 12 }}>
        📥 Receber Item Avulso
      </button>
    </div>

    {mensagem && (
      <div style={{
        padding: '12px 16px',
        borderRadius: 8,
        marginBottom: 16,
        background: mensagem.tipo === 'sucesso' ? '#0f2f1a' : '#3f0f0f',
        border: `1px solid ${mensagem.tipo === 'sucesso' ? C.success : C.danger}`,
        color: mensagem.tipo === 'sucesso' ? C.success : C.danger,
        fontSize: 13
      }}>
        {mensagem.texto}
      </div>
    )}

    {/* ─── SEÇÃO: EM PROCESSO ───────────────────────────────── */}
    {(() => {
      // 1. Filtra a lista antes de renderizar
      const ordensEmAndamentoReal = ordensVendaAbertas.filter(ov => 
        ov.status_recebimento !== 'concluido_recusado' && 
        ov.status !== 'contagem_concluida'
      );

      return (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: C.text,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            📋 EM PROCESSO
            <span style={{
              fontSize: 11,
              color: C.muted,
              fontWeight: 400,
              background: C.bg,
              padding: '2px 10px',
              borderRadius: 12
            }}>
              {/* ✅ O CONTADOR AGORA CAI PARA 0 QUANDO A OV FOR CONCLUÍDA */}
              {ordensEmAndamentoReal.length}
            </span>
          </div>

          <input
            type="text"
            placeholder="🔍 Buscar por item, SKU ou número da OV..."
            value={buscaOV}
            onChange={(e) => setBuscaOV(e.target.value)}
            style={{ ...s.input, marginBottom: 12 }}
          />

          {loading ? (
            <div style={{ color: C.muted, fontSize: 13, padding: 20, textAlign: 'center' }}>Carregando...</div>
          ) : ordensEmAndamentoReal.length === 0 ? (
            <div style={{
              padding: '32px',
              textAlign: 'center',
              color: C.muted,
              background: C.bg,
              borderRadius: 8
            }}>
              🎉 Nenhuma ordem em processo no momento.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ordensEmAndamentoReal.map(ov => {
                const matchBusca = !buscaOV ||
                  ov.numero.toLowerCase().includes(buscaOV.toLowerCase()) ||
                  ov.itens?.some(i => (i.item_nome || '').toLowerCase().includes(buscaOV.toLowerCase()));
                  
                if (!matchBusca) return null;

                // ✅ O FRONTEND CALCULA AS DIVERGÊNCIAS DIRETO DO ARRAY DE ITENS REAIS QUE CHEGOU!
                const totalDivergentesReal = ov.itens?.filter(i =>
                  i.status_quarentena === 'rejeitado' ||
                  i.status_contagem === 'pendente' ||
                  i.status_contagem === 'em_andamento'
                ).length || 0;

                let statusConfig = { color: C.muted, icone: '⚪', label: 'Status Desconhecido' };

                if (ov.status_recebimento === 'quarentena') {
                  statusConfig = { cor: C.danger, icone: '🔴', label: '🚫 Em Tratamento de Quarentena' };
                } else if (ov.status_recebimento === 'contagem_pendente') {
                  statusConfig = { cor: C.warn, icone: '🟡', label: `⚠️ Aguardando Recontagem (${totalDivergentesReal} item divergente)` };
                } else if (ov.status_recebimento === 'aguardando_contagem') {
                  statusConfig = { cor: '#f59e0b', icone: '🟠', label: '📦 Aguardando Contagem' };
                } else if (ov.status_recebimento === 'parcial') {
                  statusConfig = { cor: C.accent, icone: '🔵', label: '⏳ Aguardando Entrada' };
                } else if (ov.status_recebimento === 'pendente') {
                  statusConfig = { cor: C.success, icone: '🟢', label: 'Aguardando Recebimento' };
                } else if (ov.status_recebimento === 'concluido_recusado') {
                  statusConfig = { cor: C.muted, icone: '⚫', label: '🚫 Recebimento Encerrado (Recusado)' };
                }

                return (
                  <div
                    key={ov.id}
                    onClick={() => carregarItensOV(ov.id)}
                    style={{
                      ...s.card,
                      padding: '14px 18px',
                      cursor: 'pointer',
                      border: `1px solid ${ordemVendaSel?.id === ov.id ? C.accent : statusConfig.cor + '44'}`,
                      background: ordemVendaSel?.id === ov.id ? C.bg : C.surface
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 16 }}>{statusConfig.icone}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, fontFamily: "'IBM Plex Mono',monospace" }}>
                              {ov.numero}
                            </div>
                            <div style={{ fontSize: 12, color: C.muted }}>
                              {ov.fornecedor_nome} · {ov.itens?.length || 0} itens
                            </div>
                            {/* M3: linha de status da NF-e do fornecedor.
                                Fica discreta, embaixo do fornecedor, sem
                                competir com o status principal à direita. */}
                            {ov.nfe_status === 'validada' && (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: 10, color: C.success, marginTop: 4,
                                fontWeight: 600,
                              }}>
                                ✅ NF-e {ov.nfe_numero} validada
                              </div>
                            )}
                            {ov.nfe_status === 'divergencia' && (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: 10, color: '#f59e0b', marginTop: 4,
                                fontWeight: 600,
                              }}>
                                ⚠️ NF-e {ov.nfe_numero} · {ov.nfe_divergencias} divergência(s)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{
                          ...s.tag(statusConfig.cor),
                          fontSize: 10,
                          background: statusConfig.cor + '22',
                          color: statusConfig.cor
                        }}>
                          {statusConfig.label}
                        </span>
                        <span style={{ fontSize: 16, color: C.muted }}>→</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    })()}

    {/* ───────────────────────────────────────────────────────────────────── */}
    {/* 📋 HISTÓRICO DE RECEBIMENTOS CONCLUÍDOS (CORRIGIDO SEM TEXTO DUPLICADO) */}
    {/* ───────────────────────────────────────────────────────────────────── */}
    <div style={{ marginTop: 32 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>
        📁 Histórico de Recebimentos Concluídos
      </div>

      {(() => {
        const ordensConcluidas = ordensVendaAbertas.filter(ov => 
          ov.status_recebimento === 'concluido_recusado' || 
          ov.status === 'contagem_concluida'
        );

        // Se realmente não tiver nada, mostra o aviso e encerra o retorno
        if (ordensConcluidas.length === 0) {
          return (
            <div style={{ padding: '20px', textAlign: 'center', color: C.muted, background: C.bg, borderRadius: 8, fontSize: 12 }}>
              📭 Nenhum recebimento concluído ainda.
            </div>
          );
        }

        // Se houver itens, renderiza APENAS os cards
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ordensConcluidas.map(ov => {
              let statusConfig = { 
                cor: C.muted, 
                icone: '⚫', 
                label: ov.status_recebimento === 'concluido_recusado' 
                  ? '🚫 Recebimento Encerrado (Recusado)' 
                  : '✅ Entrada Concluída' 
              };

              return (
                <div
                  key={ov.id}
                  onClick={() => carregarItensOV(ov.id)}
                  style={{
                    ...s.card,
                    padding: '14px 18px',
                    cursor: 'pointer',
                    border: `1px solid ${C.border}44`,
                    background: C.bg,
                    opacity: 0.8
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16 }}>{statusConfig.icone}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "'IBM Plex Mono',monospace" }}>
                          {ov.numero}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted }}>
                          {ov.fornecedor_nome} · {ov.itens?.length || 0} itens
                        </div>
                      </div>
                    </div>
                    <span style={{ ...s.tag(statusConfig.cor), fontSize: 10, background: statusConfig.cor + '11', color: statusConfig.cor }}>
                      {statusConfig.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>

    {/* ─── ITENS DA OV SELECIONADA ───────────────────────────── */}
    {ordemVendaSel && (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.1em' }}>
            📋 ITENS DA OV {ordemVendaSel.numero}
          </div>
          <button onClick={() => { setOrdemVendaSel(null); setItensOV([]); }} style={{ ...s.btn(false), padding: '6px 12px', fontSize: 11 }}>
            ← Voltar
          </button>
        </div>

        {/* ─── M3: banner da NF-e do fornecedor ─────────────────────
            Quando o fornecedor anexa o XML no hub, ele já foi validado
            contra essa OC. O comprador não precisa reenviar — só conferir
            o físico. Isso reduz de ~15 min de digitação pra ~30s de
            confirmação, principalmente em mobile. */}
        {ordemVendaSel.nfe_atual && ordemVendaSel.nfe_atual.status === 'ok' && (
          <div style={{
            background: '#0f2f1a',
            border: `1px solid ${C.success}55`,
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.success }}>
                NF-e {ordemVendaSel.nfe_atual.numero_nf} validada digitalmente
              </div>
              <div style={{ fontSize: 11, color: C.textSub, marginTop: 3 }}>
                Chave <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}>
                  {ordemVendaSel.nfe_atual.chave_acesso}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                Validada em {new Date(ordemVendaSel.nfe_atual.enviado_em).toLocaleString('pt-BR')}
              </div>
              <div style={{ fontSize: 12, color: C.text, marginTop: 6, fontStyle: 'italic' }}>
                Favor conferir o conteúdo físico no recebimento.
              </div>
            </div>
          </div>
        )}

        {ordemVendaSel.nfe_atual && ordemVendaSel.nfe_atual.status === 'divergencia' && (
          <div style={{
            background: '#2e1c0c',
            border: '1px solid #f59e0b55',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>
                NF-e {ordemVendaSel.nfe_atual.numero_nf} com {ordemVendaSel.nfe_atual.divergencias_count} divergência(s)
              </div>
              <div style={{ fontSize: 11, color: C.textSub, marginTop: 3 }}>
                O fornecedor anexou uma NF-e que não bateu 100% com a OC.
                Revise os itens ao conferir o físico.
              </div>
            </div>
          </div>
        )}

        {!ordemVendaSel.nfe_atual && (
          <div style={{
            background: '#1e2535',
            border: `1px dashed ${C.border}`,
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 12,
            fontSize: 11,
            color: C.muted,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: 14 }}>⏳</span>
            Fornecedor ainda não anexou a NF-e. Você pode seguir com a
            conferência fiscal manual (upload de XML pelo botão "1. Fiscal").
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {itensOV.map(item => (
            <div key={item.id} style={{ ...s.card, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.item_nome}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    Qtd: {item.quantidade} · {item.sku || 'Sem SKU'}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    Recebido: {item.quantidade_recebida || 0} / {item.quantidade}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                    Contagem: {item.tentativa_atual || 0}/3 · 
                    Status: {item.status_contagem === 'concluido' ? '✅ Concluído' : '⏳ Pendente'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => verHistoricoContagens(item.id)}
                    style={{
                      ...s.btn(false),
                      padding: '4px 10px',
                      fontSize: 10,
                      borderColor: C.border
                    }}
                    title="Ver histórico de contagens"
                  >
                    📜 Histórico
                  </button>

                  {/* M3: quando o fornecedor anexou NF-e e o item bateu na
                      validação automática, o botão vira "✅ Fiscal OK" (verde).
                      Um clique confirma o fiscal — sem upload, sem digitação.
                      O modal abre em modo "revisão" (com os dados da NF-e
                      pré-carregados) pra quem quiser conferir de novo. */}
                  <button
                    onClick={() => abrirConferenciaFiscal(item)}
                    title={
                      item.miro_por ? 'Conferência fiscal já registrada'
                      : item.fiscal_auto_aprovado ? 'NF-e validada digitalmente — clique para revisar e confirmar'
                      : 'Registrar conferência fiscal (upload de XML ou manual)'
                    }
                    style={{
                      ...s.btn(
                        true,
                        item.status_quarentena === 'rejeitado' ? C.danger
                          : item.fiscal_auto_aprovado ? C.success
                          : C.accent
                      ),
                      padding: '8px 14px',
                      fontSize: 11,
                      opacity: item.miro_por ? 0.6 : 1,
                      cursor: item.miro_por ? 'default' : 'pointer'
                    }}
                  >
                    {item.numero_recebimento_ov
                      ? `✅ ${item.numero_recebimento_ov}`
                      : item.miro_por
                        ? `✅ ${item.numero_recebimento_miro || 'Fiscal'}`
                        : item.fiscal_auto_aprovado
                          ? '✅ Fiscal OK'
                          : '📄 1. Fiscal'}
                  </button>

                  <button
                    onClick={() => {
                      if (!item.miro_por) {
                        alert('⚠️ Conclua a conferência fiscal primeiro!');
                        return;
                      }
                      // Se já atingiu 3 tentativas, não permite mais
                      if (item.tentativa_atual >= 3) {
                        alert('⚠️ Número máximo de contagens (3) atingido!');
                        return;
                      }
                      // Se já foi aprovado, não permite recontar
                      if (item.status_contagem === 'concluido' && item.status_quarentena === 'aprovado') {
                        alert('⚠️ Este item já foi aprovado na contagem!');
                        return;
                      }
                      // Permite reabrir mesmo se status_contagem = 'concluido' mas status_quarentena != 'aprovado'
                      const proximaTentativa = (item.tentativa_atual || 0) + 1;
                      abrirContagemCega([item], proximaTentativa);
                    }}
                    style={{
                      ...s.btn(true, C.warn),
                      padding: '8px 14px',
                      fontSize: 11,
                      opacity: item.miro_por ? 1 : 0.5,
                      cursor: item.miro_por ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {item.migo_por && item.status_quarentena === 'aprovado' ? '✅ Física' : 
                    item.tentativa_atual >= 3 ? '🔒 Máximo' :
                    `📦 ${(item.tentativa_atual || 0) + 1}ª Contagem`}
                  </button>

                  <button
                    onClick={() => {
                      if (item.miro_por && item.migo_por && item.status_quarentena === 'aprovado') {
                        entrarItemEstoque(item);
                      } else {
                        alert('⚠️ Conclua as conferências e aprovação primeiro!');
                      }
                    }}
                    style={{
                      ...s.btn(true, C.success),
                      padding: '8px 14px',
                      fontSize: 11,
                      opacity: (item.miro_por && item.migo_por && item.status_quarentena === 'aprovado') ? 1 : 0.5,
                      cursor: (item.miro_por && item.migo_por && item.status_quarentena === 'aprovado') ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {item.entrada_por ? '✅ Entrada' : '✅ 3. Entrada'}
                  </button>

                  {/* 🔥 BOTÃO QUE ABRE O MODAL DE TRATATIVA */}
                  {item.status_quarentena === 'rejeitado' && (
                    <button
                      onClick={() => {
                        setJustificativaTratativa('');
                        setItemTratativaQuarentena(item);
                      }}
                      style={{
                        ...s.btn(true, C.success),
                        padding: '8px 14px',
                        fontSize: 11,
                      }}
                    >
                      ⚖️ Tratar Quarentena
                    </button>
                  )}

                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

      {/* MODAL: CONFERÊNCIA FISCAL (MIRO) — 2 modos:
          • auto:   item já auto-aprovado pela NF-e do fornecedor.
                    Mostra tabela OC × NF-e + aba "Ver NFe" completa.
                    Sem upload, sem digitação.
          • manual: fluxo legado — upload XML + validação.
      */}
      {itemConferenciaFiscal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: modoAutoFiscal ? 720 : 560, maxWidth: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                📄 Conferência Fiscal — {itemConferenciaFiscal.item_nome}
              </div>
              <button onClick={() => setItemConferenciaFiscal(null)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            {modoAutoFiscal && nfeModalFiscal && (
              <div style={{
                padding: '10px 22px', background: '#0f2f1a',
                borderBottom: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', gap: 10, fontSize: 12,
              }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: C.success }}>
                    NF-e {nfeModalFiscal.numero_nf} validada digitalmente
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                    Anexada em {new Date(nfeModalFiscal.enviado_em).toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>
            )}

            {modoAutoFiscal && (
              <div style={{
                display: 'flex', gap: 4, padding: '8px 22px 0',
                borderBottom: `1px solid ${C.border}`, background: C.bg,
              }}>
                <button
                  onClick={() => setAbaModalFiscal('conferencia')}
                  style={{
                    background: 'transparent', border: 'none',
                    borderBottom: abaModalFiscal === 'conferencia' ? `2px solid ${C.accent}` : '2px solid transparent',
                    color: abaModalFiscal === 'conferencia' ? C.text : C.muted,
                    fontSize: 12, fontWeight: abaModalFiscal === 'conferencia' ? 600 : 400,
                    cursor: 'pointer', padding: '8px 14px 10px', fontFamily: 'inherit',
                  }}
                >
                  📊 Conferência OC × NF-e
                </button>
                <button
                  onClick={() => setAbaModalFiscal('danfe')}
                  style={{
                    background: 'transparent', border: 'none',
                    borderBottom: abaModalFiscal === 'danfe' ? `2px solid ${C.accent}` : '2px solid transparent',
                    color: abaModalFiscal === 'danfe' ? C.text : C.muted,
                    fontSize: 12, fontWeight: abaModalFiscal === 'danfe' ? 600 : 400,
                    cursor: 'pointer', padding: '8px 14px 10px', fontFamily: 'inherit',
                  }}
                >
                  📄 Ver NFe completa
                </button>
              </div>
            )}

            <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
              {/* Banner do número do recebimento (só no fluxo manual) */}
              {!modoAutoFiscal && itemConferenciaFiscal.numero_recebimento_ov && (
                <div style={{ marginBottom: 16, background: '#0f2f1a', border: '1px solid #22c55e44', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>NÚMERO DO DOCUMENTO DE RECEBIMENTO</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>{itemConferenciaFiscal.numero_recebimento_ov}</div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════
                  MODO AUTO — Camada 1 (Conferência) ou Camada 2 (DANFE)
                  ═══════════════════════════════════════════════════ */}
                            {modoAutoFiscal && abaModalFiscal === 'conferencia' && itemNfeModalFiscal && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{
                    background: '#0f1e35',
                    border: '1px solid #3b82f633',
                    borderRadius: 8,
                    padding: '10px 14px',
                    fontSize: 11,
                    color: '#d1d5db',
                  }}>
                    <strong style={{ color: '#3b82f6' }}>Conferência lado a lado</strong> — OC vs NF-e.
                    O item bateu 100% na validação automática. Confira o físico e clique Confirmar.
                  </div>

                  {/* Tabela comparativa */}
                  <div style={{
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1.5fr 1fr 1fr 1fr 50px',
                      gap: 8,
                      padding: '10px 14px',
                      background: C.bg,
                      borderBottom: `1px solid ${C.border}`,
                      fontSize: 10,
                      color: C.muted,
                      letterSpacing: '0.05em',
                      fontWeight: 600,
                    }}>
                      <span>ITEM</span>
                      <span style={{ textAlign: 'right' }}>OC</span>
                      <span style={{ textAlign: 'right' }}>NF-e</span>
                      <span style={{ textAlign: 'right' }}>DIFERENÇA</span>
                      <span style={{ textAlign: 'center' }}>OK</span>
                    </div>

                    {[
                      { label: 'Descrição', oc: itemConferenciaFiscal.item_nome, nfe: itemNfeModalFiscal.descricao, tipo: 'texto' },
                      { label: 'Quantidade', oc: itemConferenciaFiscal.quantidade, nfe: itemNfeModalFiscal.quantidade, tipo: 'num' },
                      { label: 'Valor unitário', oc: itemConferenciaFiscal.valor_unitario, nfe: itemNfeModalFiscal.valor_unitario, tipo: 'moeda' },
                      { label: 'Valor total', oc: itemConferenciaFiscal.valor_total, nfe: itemNfeModalFiscal.valor_total, tipo: 'moeda' },
                    ].map((row, i) => {
                      const igual = row.tipo === 'texto'
                        ? _normNome(row.oc) === _normNome(row.nfe)
                        : Number(row.oc || 0) === Number(row.nfe || 0);
                      const fmt = (v) => {
                        if (row.tipo === 'moeda') return fmtBRL(v);
                        if (row.tipo === 'num') return String(v ?? '—');
                        return v ?? '—';
                      };
                      const dif = row.tipo === 'moeda'
                        ? Number(row.oc || 0) - Number(row.nfe || 0)
                        : (igual ? 0 : null);
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1.5fr 1fr 1fr 1fr 50px',
                            gap: 8,
                            padding: '10px 14px',
                            alignItems: 'center',
                            background: !igual ? '#2e1c0c' : 'transparent',
                            borderBottom: `1px solid ${C.border}22`,
                            fontSize: 12,
                          }}
                        >
                          <span style={{ color: C.textSub, fontSize: 11 }}>{row.label}</span>
                          <span style={{ textAlign: 'right', color: C.text, fontWeight: 500 }}>{fmt(row.oc)}</span>
                          <span style={{ textAlign: 'right', color: C.text, fontWeight: 500 }}>{fmt(row.nfe)}</span>
                          <span style={{
                            textAlign: 'right',
                            color: dif === 0 || igual ? C.muted : '#f59e0b',
                            fontWeight: 600,
                            fontSize: 11,
                          }}>
                            {dif != null && dif !== 0 ? fmtBRL(Math.abs(dif)) : (igual ? '—' : '≠')}
                          </span>
                          <span style={{ textAlign: 'center', fontSize: 14 }}>
                            {igual ? '✅' : '⚠️'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{
                    background: '#0f2f1a',
                    border: '1px solid #22c55e44',
                    borderRadius: 8,
                    padding: '10px 14px',
                    fontSize: 11,
                    color: C.success,
                    textAlign: 'center',
                  }}>
                    ✅ Item 100% conferido digitalmente. Falta só a conferência física.
                  </div>
                </div>
              )}

              {/* MODO AUTO — aba DANFE (Camada 2) */}
              {modoAutoFiscal && abaModalFiscal === 'danfe' && nfeModalFiscal?.resumo && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Identificação */}
                  <div style={{
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: '14px 16px',
                    background: C.bg,
                  }}>
                    <div style={{
                      fontSize: 10, color: C.muted,
                      letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600,
                    }}>
                      NOTA FISCAL ELETRÔNICA
                    </div>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr',
                      gap: 14, fontSize: 12,
                    }}>
                      <div>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Número / Série</div>
                        <div style={{ color: C.text, fontWeight: 600 }}>
                          {nfeModalFiscal.resumo.numero_nf || nfeModalFiscal.numero_nf} · Série {nfeModalFiscal.resumo.serie || '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Emissão</div>
                        <div style={{ color: C.text, fontWeight: 600 }}>
                          {nfeModalFiscal.resumo.data_emissao
                            ? new Date(nfeModalFiscal.resumo.data_emissao).toLocaleString('pt-BR')
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Natureza</div>
                        <div style={{ color: C.text }}>{nfeModalFiscal.resumo.natureza_operacao || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Chave de acesso</div>
                        <div style={{
                          color: C.text, fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: 10, wordBreak: 'break-all',
                        }}>
                          {nfeModalFiscal.chave_acesso}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Emitente / Destinatário */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
                  }}>
                    <div style={{
                      border: `1px solid ${C.border}`, borderRadius: 8,
                      padding: '12px 14px', background: C.bg,
                    }}>
                      <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em', marginBottom: 6, fontWeight: 600 }}>
                        EMITENTE
                      </div>
                      <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>
                        {nfeModalFiscal.resumo.emitente || '—'}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 3, fontFamily: "'IBM Plex Mono', monospace" }}>
                        CNPJ {nfeModalFiscal.resumo.cnpj_emitente || '—'}
                      </div>
                      {nfeModalFiscal.resumo.ie_emitente && (
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                          IE {nfeModalFiscal.resumo.ie_emitente}
                        </div>
                      )}
                    </div>
                    <div style={{
                      border: `1px solid ${C.border}`, borderRadius: 8,
                      padding: '12px 14px', background: C.bg,
                    }}>
                      <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em', marginBottom: 6, fontWeight: 600 }}>
                        DESTINATÁRIO
                      </div>
                      <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>
                        {nfeModalFiscal.resumo.destinatario || '—'}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 3, fontFamily: "'IBM Plex Mono', monospace" }}>
                        CNPJ {nfeModalFiscal.resumo.cnpj_destinatario || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Itens com detalhe fiscal */}
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{
                      padding: '10px 14px', background: C.bg,
                      borderBottom: `1px solid ${C.border}`,
                      fontSize: 10, color: C.muted,
                      letterSpacing: '0.08em', fontWeight: 600,
                    }}>
                      ITENS DA NOTA
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr 70px 40px 90px 90px',
                      gap: 8, padding: '8px 14px',
                      background: C.bg, borderBottom: `1px solid ${C.border}22`,
                      fontSize: 9, color: C.muted, fontWeight: 600,
                      letterSpacing: '0.05em',
                    }}>
                      <span>#</span>
                      <span>DESCRIÇÃO</span>
                      <span>NCM</span>
                      <span>CFOP</span>
                      <span style={{ textAlign: 'right' }}>QTD × UNIT.</span>
                      <span style={{ textAlign: 'right' }}>TOTAL</span>
                    </div>
                    {(nfeModalFiscal.resumo.itens || []).map((it, i) => (
                      <div key={i} style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1fr 70px 40px 90px 90px',
                        gap: 8, padding: '10px 14px',
                        borderBottom: `1px solid ${C.border}22`,
                        fontSize: 11, alignItems: 'center',
                      }}>
                        <span style={{
                          color: C.accent, fontWeight: 700,
                          fontFamily: "'IBM Plex Mono', monospace",
                        }}>{it.numero}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: C.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {it.descricao}
                          </div>
                          {it.codigo && (
                            <div style={{ fontSize: 9, color: C.muted, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                              {it.codigo}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 10, color: C.textSub, fontFamily: "'IBM Plex Mono', monospace" }}>
                          {it.ncm || '—'}
                        </span>
                        <span style={{ fontSize: 10, color: C.textSub, fontFamily: "'IBM Plex Mono', monospace" }}>
                          {it.cfop || '—'}
                        </span>
                        <span style={{ textAlign: 'right', color: C.textSub, fontSize: 10 }}>
                          {it.quantidade} × {fmtBRL(it.valor_unitario)}
                        </span>
                        <span style={{ textAlign: 'right', color: C.text, fontWeight: 600 }}>
                          {fmtBRL(it.valor_total)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Totais fiscais */}
                  <div style={{
                    border: `1px solid ${C.border}`, borderRadius: 8,
                    padding: '14px 16px', background: C.bg,
                  }}>
                    <div style={{
                      fontSize: 10, color: C.muted, letterSpacing: '0.08em',
                      marginBottom: 10, fontWeight: 600,
                    }}>
                      TOTAIS
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: C.muted }}>Produtos</span>
                        <span style={{ color: C.text }}>{fmtBRL(nfeModalFiscal.resumo.valor_produtos)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: C.muted }}>Frete</span>
                        <span style={{ color: C.text }}>{fmtBRL(nfeModalFiscal.resumo.valor_frete)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: C.muted }}>ICMS</span>
                        <span style={{ color: C.text }}>{fmtBRL(nfeModalFiscal.resumo.valor_icms)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: C.muted }}>IPI</span>
                        <span style={{ color: C.text }}>{fmtBRL(nfeModalFiscal.resumo.valor_ipi || 0)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: C.muted }}>Desconto</span>
                        <span style={{ color: C.text }}>{fmtBRL(nfeModalFiscal.resumo.valor_desconto || 0)}</span>
                      </div>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        gridColumn: 'span 2', paddingTop: 8, marginTop: 4,
                        borderTop: `1px solid ${C.border}44`,
                        fontSize: 14, fontWeight: 700,
                      }}>
                        <span style={{ color: C.text }}>Total da Nota</span>
                        <span style={{ color: C.success }}>{fmtBRL(nfeModalFiscal.resumo.valor_total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Transporte */}
                  {(nfeModalFiscal.resumo.qtd_volumes || nfeModalFiscal.resumo.peso_bruto) && (
                    <div style={{
                      border: `1px solid ${C.border}`, borderRadius: 8,
                      padding: '12px 14px', background: C.bg,
                    }}>
                      <div style={{
                        fontSize: 10, color: C.muted, letterSpacing: '0.08em',
                        marginBottom: 8, fontWeight: 600,
                      }}>
                        TRANSPORTE
                      </div>
                      <div style={{ display: 'flex', gap: 24, fontSize: 12, color: C.textSub }}>
                        <div>
                          <span style={{ color: C.muted }}>Volumes: </span>
                          <strong style={{ color: C.text }}>{nfeModalFiscal.resumo.qtd_volumes || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ color: C.muted }}>Peso líquido: </span>
                          <strong style={{ color: C.text }}>{nfeModalFiscal.resumo.peso_liquido || '—'} kg</strong>
                        </div>
                        <div>
                          <span style={{ color: C.muted }}>Peso bruto: </span>
                          <strong style={{ color: C.text }}>{nfeModalFiscal.resumo.peso_bruto || '—'} kg</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{
                    fontSize: 10, color: C.muted, textAlign: 'center',
                    fontStyle: 'italic',
                  }}>
                    Dados extraídos do XML assinado digitalmente pelo emissor.
                    Para auditoria fiscal, baixe o XML original.
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════
                  MODO MANUAL — fluxo legado (upload + validação)
                  ═══════════════════════════════════════════════════ */}
              {!modoAutoFiscal && (
                <>
              {/* UPLOAD DE XML */}
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>UPLOAD DE XML (NF-E)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="file"
                    accept=".xml"
                    onChange={handleUploadXML}
                    style={{ ...s.input, padding: '8px 12px', background: C.bg }}
                  />
                  <button onClick={() => handleValidarXML()} style={{ ...s.btn(true, C.accent), padding: '9px 16px', fontSize: 12 }}>
                    ✅ Validar XML
                  </button>
                </div>
              </div>

              {/* RESULTADO DA VALIDAÇÃO */}
              {itemConferenciaFiscal.validacao_xml && (
                <div style={{ 
                  marginBottom: 16, 
                  background: itemConferenciaFiscal.validacao_xml.totalDivergencias > 0 ? '#2e1c0c' : '#0f2f1a', 
                  border: itemConferenciaFiscal.validacao_xml.totalDivergencias > 0 ? '1px solid #f59e0b44' : '1px solid #22c55e44', 
                  borderRadius: 8, 
                  padding: '12px 14px' 
                }}>
                  
                  {/* CABEÇALHO */}
                  <div style={{ 
                    fontSize: 12, 
                    fontWeight: 700, 
                    color: itemConferenciaFiscal.validacao_xml.totalDivergencias > 0 ? '#f59e0b' : '#22c55e', 
                    marginBottom: 12,
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>🔍 CONFERÊNCIA FISCAL AUTOMÁTICA</span>
                    <span>
                      {itemConferenciaFiscal.validacao_xml.totalDivergencias > 0 
                        ? `⚠️ ${itemConferenciaFiscal.validacao_xml.totalDivergencias} PENDÊNCIA(S)` 
                        : '🟢 100% CORRETO'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* SEÇÃO 1: DADOS CADASTRAIS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 10, borderBottom: '1px solid #ffffff11' }}>
                      <div style={{ fontSize: 11, color: '#d1d5db', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span>{itemConferenciaFiscal.validacao_xml.cnpj_status === 'ok' ? '✅' : '❌'}</span>
                        <div>
                          <span style={{ fontWeight: 600 }}>Fornecedor Emitente:</span>
                          <div style={{ color: '#9ca3af', fontSize: 10 }}>{itemConferenciaFiscal.validacao_xml.cnpj}</div>
                        </div>
                      </div>

                      <div style={{ fontSize: 11, color: '#d1d5db', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span>{itemConferenciaFiscal.validacao_xml.cnpj_destinatario.includes('✅') ? '✅' : '❌'}</span>
                        <div>
                          <span style={{ fontWeight: 600 }}>Empresa Destinatária:</span>
                          <div style={{ color: '#9ca3af', fontSize: 10 }}>{itemConferenciaFiscal.validacao_xml.cnpj_destinatario}</div>
                        </div>
                      </div>
                    </div>

                    {/* SEÇÃO 2: VALIDAÇÃO DOS ITENS */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 6 }}>
                        CONFERÊNCIA DE ITENS:
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {itemConferenciaFiscal.validacao_xml.itens.map((validacao, idx) => (
                          <div key={idx} style={{ fontSize: 11, color: '#d1d5db', display: 'flex', gap: 8, background: '#ffffff05', padding: '6px 8px', borderRadius: 4 }}>
                            <span style={{ fontSize: 12 }}>
                              {validacao.status === 'ok' ? '✅' : '⚠️'}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, color: '#f3f4f6' }}>{validacao.item}</div>
                              <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 2 }}>
                                NFe: {validacao.item_nfe || 'Não encontrado'}
                              </div>
                              <div style={{ color: validacao.status === 'ok' ? '#4ade80' : '#fbbf24', fontSize: 10, marginTop: 2 }}>
                                {validacao.mensagem}
                              </div>
                            </div>
                            
                            {/* BOTÃO ASSOCIAR (Aceita tanto 'match_fallback' quanto 'nao_encontrado') */}
                            {(validacao.status === 'match_fallback' || validacao.status === 'nao_encontrado') && validacao.status !== 'ok' && (
                              <button
                                onClick={() => {
                                  const itemOV = {
                                    item_nome: itemConferenciaFiscal.item_nome,
                                    quantidade: itemConferenciaFiscal.quantidade,
                                    valor_unitario: itemConferenciaFiscal.valor_unitario,
                                    item_catalogo_id: itemConferenciaFiscal.item_catalogo_id
                                  };
                                  
                                  const itemNFe = {
                                    descricao: validacao.item_nfe || 'Não encontrado',
                                    item_nfe: validacao.item_nfe,
                                    codigo: '—',
                                    quantidade: itemConferenciaFiscal.quantidade
                                  };
                                  
                                  abrirMatchingManual(itemOV, itemNFe);
                                }}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  background: '#3b82f6',
                                  color: '#fff',
                                  fontSize: 10,
                                  cursor: 'pointer',
                                  border: 'none',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                🤝 Associar
                              </button>
                            )}
                            {/* 🔥 BOTÃO APROVAR (descrição) */}
                            {validacao.status === 'divergencia_descricao' && (
                              <button
                                onClick={() => aprovarItemManual(validacao.item)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  background: '#22c55e',
                                  color: '#fff',
                                  fontSize: 10,
                                  cursor: 'pointer',
                                  border: 'none',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                ✅ Aprovar
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{itemConferenciaFiscal.item_nome}</div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  SKU: {itemConferenciaFiscal.sku || '—'} · Qtd: {itemConferenciaFiscal.quantidade} {itemConferenciaFiscal.unidade_medida || 'UN'}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>FORNECEDOR (AUTOMÁTICO)</label>
                <input type="text" value={ordemVendaSel?.fornecedor_nome || '—'} readOnly style={{ ...s.input, background: C.bg, color: C.muted }} />
              </div>

              {/* 🔥 CAMPOS SEMPRE VISÍVEIS (sem if/else) */}
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>NÚMERO DA NOTA FISCAL</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={itemConferenciaFiscal.numero_nota_fiscal || ""}
                    onChange={(e) => setItemConferenciaFiscal({ ...itemConferenciaFiscal, numero_nota_fiscal: e.target.value })}
                    placeholder="Ex: 12345"
                    style={{ ...s.input, flex: 1 }}
                  />
                  <button onClick={() => setAbrirLeitor(true)} style={{ ...s.btn(true, C.accent), padding: "9px 18px", fontSize: 12, whiteSpace: "nowrap" }}>
                    📱 Escanear
                  </button>
                </div>
              </div>

              {abrirLeitor && (
                <LeitorCodigoBarras onDetectado={handleCodigoDetectado} onFechar={() => setAbrirLeitor(false)} C={C} s={s} />
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>VALOR DA NF (R$)</label>
                <input type="number" step="0.01" value={itemConferenciaFiscal.valor_nf || ''} onChange={(e) => setItemConferenciaFiscal({ ...itemConferenciaFiscal, valor_nf: e.target.value })} onWheel={(e) => e.target.blur()} placeholder="Ex: 85.00" style={s.input} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={s.label}>QUANTIDADE NA NF</label>
                  <input type="number" value={itemConferenciaFiscal.quantidade_nf || ''} onChange={(e) => setItemConferenciaFiscal({ ...itemConferenciaFiscal, quantidade_nf: e.target.value })} onWheel={(e) => e.target.blur()} placeholder="Ex: 2" style={s.input} />
                </div>
                <div>
                  <label style={s.label}>IMPOSTOS (R$)</label>
                  <input type="number" step="0.01" value={itemConferenciaFiscal.impostos || ''} onChange={(e) => setItemConferenciaFiscal({ ...itemConferenciaFiscal, impostos: e.target.value })} onWheel={(e) => e.target.blur()} placeholder="Ex: 15.00" style={s.input} />
                </div>
                <div>
                  <label style={s.label}>UNIDADE DE MEDIDA</label>
                  <select value={itemConferenciaFiscal.unidade_medida || 'UN'} onChange={(e) => setItemConferenciaFiscal({ ...itemConferenciaFiscal, unidade_medida: e.target.value })} style={{ ...s.input, appearance: 'none' }}>
                    <option value="UN">UN (Unidade)</option>
                    <option value="L">L (Litro)</option>
                    <option value="KG">KG (Quilograma)</option>
                    <option value="M">M (Metro)</option>
                    <option value="CX">CX (Caixa)</option>
                    <option value="RL">RL (Rolo)</option>
                    <option value="GL">GL (Galão)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>DATA DE VENCIMENTO DO PAGAMENTO</label>
                <input type="date" value={itemConferenciaFiscal.data_vencimento_pagamento || ''} onChange={(e) => setItemConferenciaFiscal({ ...itemConferenciaFiscal, data_vencimento_pagamento: e.target.value })} style={s.input} />
              </div>

              {/* 🔥 3-WAY MATCH (Validação automática) */}
              <div style={{ marginBottom: 16, background: '#0f2f1a', border: '1px solid #22c55e44', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', marginBottom: 8 }}>
                  ✅ 3-WAY MATCH
                </div>
                
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#d1d5db' }}>
                  <div>
                    <div style={{ color: '#6b7280' }}>OV</div>
                    <div style={{ fontWeight: 600 }}>{fmtBRL(itemConferenciaFiscal.valor_total_ov || 0)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#6b7280' }}>NF</div>
                    <div style={{ fontWeight: 600, color: itemConferenciaFiscal.valor_nf && parseFloat(itemConferenciaFiscal.valor_nf) !== parseFloat(itemConferenciaFiscal.valor_total_ov || 0) ? '#f59e0b' : '#22c55e' }}>
                      {itemConferenciaFiscal.valor_nf ? fmtBRL(parseFloat(itemConferenciaFiscal.valor_nf)) : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#6b7280' }}>QUANTIDADE</div>
                    <div style={{ fontWeight: 600, color: itemConferenciaFiscal.quantidade_nf && parseInt(itemConferenciaFiscal.quantidade_nf) !== parseInt(itemConferenciaFiscal.quantidade) ? '#f59e0b' : '#22c55e' }}>
                      {itemConferenciaFiscal.quantidade_nf || '—'} / {itemConferenciaFiscal.quantidade}
                    </div>
                  </div>
                </div>
              </div>

              {/* 🔥 MOTIVO DA DIVERGÊNCIA - SEMPRE VISÍVEL quando está em quarentena */}
              {itemConferenciaFiscal.status_quarentena === 'rejeitado' && (
                <div style={{ marginBottom: 16, background: '#3f0f0f', border: '1px solid #ef4444', borderRadius: 8, padding: 12 }}>
                  <label style={{ ...s.label, color: '#ef4444' }}>MOTIVO DA DIVERGÊNCIA</label>
                  <textarea
                    value={itemConferenciaFiscal.motivo_divergencia || ''}
                    readOnly
                    rows={3}
                    style={{ ...s.input, resize: 'vertical', background: 'transparent', color: '#ef4444', border: 'none' }}
                  />
                </div>
              )}
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
              
              {/* MODO AUTO: botões reduzidos — sem quarentena/salvar manual.
                  O item já foi validado; aqui o comprador só confirma fiscal. */}
              {modoAutoFiscal ? (
                <>
                  <button
                    onClick={async () => {
                      try {
                        const url = await apiService.get(
                          `/estoque/movimentacoes/nfe/${nfeModalFiscal.id}/download`
                        );
                        window.open(url.url, '_blank', 'noopener,noreferrer');
                      } catch (e) {
                        alert('Erro ao baixar XML: ' + e.message);
                      }
                    }}
                    style={{
                      ...s.btn(false, C.muted),
                      flex: 1, padding: '10px 16px', fontSize: 12,
                    }}
                  >
                    ⬇ Baixar XML
                  </button>
                  <button
                    onClick={() => setItemConferenciaFiscal(null)}
                    style={{ ...s.btn(false), flex: 1, padding: '10px 16px', fontSize: 12 }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleSalvarConferenciaFiscal('aprovado')}
                    style={{
                      ...s.btn(true, C.success),
                      flex: 2, padding: '10px 16px', fontSize: 13, fontWeight: 700,
                    }}
                  >
                    ✅ Confirmar Fiscal
                  </button>
                </>
              ) : (
                <>
              {/* 🔥 BOTÃO QUARENTENA - ATIVO QUANDO HÁ DIVERGÊNCIA */}
              <button
                onClick={() => handleQuarentena()}
                disabled={!temDivergencia}
                style={{
                  ...s.btn(true, C.danger),
                  flex: 1,
                  opacity: temDivergencia ? 1 : 0.5,
                  cursor: temDivergencia ? 'pointer' : 'not-allowed'
                }}
              >
                🚫 Quarentena
              </button>

              {/* BOTÃO CANCELAR */}
              <button onClick={() => setItemConferenciaFiscal(null)} style={{ ...s.btn(false), flex: 1 }}>
                Cancelar
              </button>

              {/* 🔥 BOTÃO SALVAR - ATIVO SOMENTE SEM DIVERGÊNCIA */}
              <button
                onClick={() => handleSalvarConferenciaFiscal('aprovado')}
                disabled={temDivergencia}
                style={{
                  ...s.btn(true, C.success),
                  flex: 1,
                  opacity: temDivergencia ? 0.5 : 1,
                  cursor: temDivergencia ? 'not-allowed' : 'pointer'
                }}
              >
                ✅ Salvar
              </button>
                </>
              )}
            </div>

            {/* 🔥 MENSAGEM DE ORIENTAÇÃO QUANDO HÁ DIVERGÊNCIA */}
            {temDivergencia && (
              <div style={{ 
                padding: '10px 16px', 
                background: '#2e1c0c', 
                border: '1px solid #f59e0b44', 
                borderRadius: 8, 
                marginBottom: 16,
                fontSize: 11,
                color: '#fbbf24'
              }}>
                ⚠️ <strong>Divergência detectada!</strong> Para continuar, você deve colocar o item em <strong>Quarentena</strong> e acionar o fornecedor para correção.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CONFERÊNCIA FÍSICA (MIGO - CEGA) */}
      {itemConferenciaFisica && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 520, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                📦 Conferência Física — {itemConferenciaFisica.item_nome}
              </div>
              <button onClick={() => setItemConferenciaFisica(null)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{itemConferenciaFisica.item_nome}</div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  SKU: {itemConferenciaFisica.sku || '—'}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>QUANTIDADE FÍSICA (CEGA)</label>
                <input type="number" value={itemConferenciaFisica.quantidade_fisica || ''} onChange={(e) => setItemConferenciaFisica({ ...itemConferenciaFisica, quantidade_fisica: e.target.value })} onWheel={(e) => e.target.blur()} placeholder="Digite o que chegou..." style={s.input} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>UNIDADE DE MEDIDA</label>
                <select value={itemConferenciaFisica.unidade_medida || 'UN'} onChange={(e) => setItemConferenciaFisica({ ...itemConferenciaFisica, unidade_medida: e.target.value })} style={{ ...s.input, appearance: 'none' }}>
                  <option value="UN">UN (Unidade)</option>
                  <option value="L">L (Litro)</option>
                  <option value="KG">KG (Quilograma)</option>
                  <option value="M">M (Metro)</option>
                  <option value="CX">CX (Caixa)</option>
                  <option value="RL">RL (Rolo)</option>
                  <option value="GL">GL (Galão)</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>LOTE</label>
                <input type="text" value={itemConferenciaFisica.lote || ''} onChange={(e) => setItemConferenciaFisica({ ...itemConferenciaFisica, lote: e.target.value })} placeholder="Ex: L2024-08" style={s.input} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>VALIDADE</label>
                <input type="date" value={itemConferenciaFisica.validade || ''} onChange={(e) => setItemConferenciaFisica({ ...itemConferenciaFisica, validade: e.target.value })} style={s.input} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>NÚMERO DE SÉRIE (OPCIONAL)</label>
                <input type="text" value={itemConferenciaFisica.numero_serie || ''} onChange={(e) => setItemConferenciaFisica({ ...itemConferenciaFisica, numero_serie: e.target.value })} placeholder="Ex: SN-12345" style={s.input} />
              </div>

              <div style={{ marginBottom: 16, background: '#0f2f1a', border: '1px solid #22c55e44', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', marginBottom: 8 }}>
                  🕵️ VALIDAÇÃO CEGA
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>
                  <span style={{ color: '#d1d5db', fontWeight: 600 }}>Você digitou:</span> {itemConferenciaFisica.quantidade_fisica || '—'} unidades
                  <br />
                  <span style={{ color: '#6b7280' }}>O sistema vai validar quando você salvar.</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
              <button
                onClick={() => {
                  if (window.confirm('Deseja colocar este item em QUARENTENA?')) {
                    handleSalvarConferenciaFisica('rejeitado');
                  }
                }}
                style={{ ...s.btn(true, C.danger), flex: 1, opacity: itemConferenciaFisica.numero_recebimento_migo ? 0.5 : 1, cursor: itemConferenciaFisica.numero_recebimento_migo ? 'default' : 'pointer' }}
              >
                🚫 Quarentena
              </button>
              <button onClick={() => setItemConferenciaFisica(null)} style={{ ...s.btn(false), flex: 1 }}>Cancelar</button>
              <button onClick={() => handleSalvarConferenciaFisica('aprovado')} style={{ ...s.btn(true, C.warn), flex: 1, opacity: itemConferenciaFisica.numero_recebimento_migo ? 0.5 : 1 }}>
                ✅ Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP: MATCHING MANUAL */}
      {matchingItem && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 20 }}>
          <div style={{ ...s.card, width: 600, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                🤝 Associar Item Manualmente
              </div>
              <button onClick={() => setMatchingItem(null)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
              {/* 🔥 ITEM DA NFe */}
              <div style={{ marginBottom: 16, padding: '10px 14px', background: '#0f2f1a', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>📄 ITEM DA NFe</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#22c55e' }}>
                  {matchingItem.itemNFe.descricao || 'Não encontrado'}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                  Código: {matchingItem.itemNFe.codigo || '—'} · Qtd: {matchingItem.itemNFe.quantidade || '—'}
                </div>
              </div>

              {/* 🔥 PERGUNTA */}
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f3f4f6', marginBottom: 12 }}>
                ❓ A qual item da Ordem de Compra este item corresponde?
              </div>

              {/* Lista de itens da OC */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {itensOV.map(item => (
                  <div key={item.id} style={{ padding: '10px 14px', background: '#ffffff05', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6' }}>{item.item_nome}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        Código: {item.sku || '—'} · Qtd: {item.quantidade}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => associarItem(item, matchingItem.itemNFe)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        background: '#22c55e',
                        color: '#fff',
                        fontSize: 11,
                        cursor: 'pointer',
                        border: 'none'
                      }}
                    >
                      🤝 Associar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 MODAL DE TRATATIVA DE QUARENTENA (PADRÃO SAP WM) */}
      {itemTratativaQuarentena && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}>
          <div style={{ ...s.card, width: 500, maxWidth: '100%', padding: '20px 22px' }}>
            
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚖️ Tratativa de Quarentena — {itemTratativaQuarentena.item_nome}
            </div>

            {/* Painel Matemático da Divergência */}
            <div style={{ background: C.bg, padding: '12px 14px', borderRadius: 8, marginBottom: 16, border: `1px solid ${C.border}44`, fontSize: 12, color: C.text }}>
              <strong>📋 Dados do Desvio:</strong>
              <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div><span style={{ color: C.muted }}>Esperado:</span> <br /><strong>{parseFloat(itemTratativaQuarentena.quantidade || 0)} {itemTratativaQuarentena.unidade_medida || 'UN'}</strong></div>
                <div><span style={{ color: C.muted }}>Contado:</span> <br /><strong>{parseFloat(itemTratativaQuarentena.quantidade_recebida_fisica || itemTratativaQuarentena.quantidade_nf || 0)} {itemTratativaQuarentena.unidade_medida || 'UN'}</strong></div>
                <div><span style={{ color: C.muted }}>Diferença:</span> <br /><strong style={{ color: C.danger }}>{(parseFloat(itemTratativaQuarentena.quantidade_recebida_fisica || 0)) - parseFloat(itemTratativaQuarentena.quantidade || 0)}</strong></div>
              </div>
            </div>

            {/* Campo de Justificativa OBRIGATÓRIA */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...s.label, color: C.text }}>JUSTIFICATIVA DA DECISÃO *</label>
              <textarea
                value={justificativaTratativa}
                onChange={(e) => setJustificativaTratativa(e.target.value)}
                placeholder="Digite o motivo da aprovação ou recusa do material..."
                rows={3}
                style={{ ...s.input, resize: 'vertical', marginTop: 6 }}
              />
            </div>

            {/* 🔥 AÇÕES OBJETIVAS: Os 3 botões alinhados lado a lado na mesma linha */}
            <div style={{ 
              display: 'flex', 
              gap: 10, 
              marginTop: 18,
              justifyContent: 'space-between'
            }}>

              {/* 🔥 BOTÃO REFORMULADO COM POP-UP DE VALIDAÇÃO DE NC */}
              <button
                onClick={async () => {
                  if (!justificativaTratativa.trim()) return alert('⚠️ A justificativa é obrigatória!');
                  try {
                    // Captura a resposta do backend que trará os dados da NC gerada
                    const response = await apiService.put(`/estoque/movimentacoes/item/${itemTratativaQuarentena.id}/aprovar-saldo`, {
                      justificativa: justificativaTratativa,
                      destino_tratativa: 'nao_conformidade'
                    });

                    // Fecha o modal de decisão
                    setItemTratativaQuarentena(null);
                    
                    // 🔥 Abre o modal de validação de sucesso injetando os dados retornados
                    setModalSucessoNC({
                      numero_nc: response.numero_nc || `NC-${new Date().getFullYear()}-0001`,
                      pedido: ordemVendaSel?.numero || '—',
                      fornecedor: ordemVendaSel?.fornecedor_nome || '—',
                      nota_fiscal: itemTratativaQuarentena?.numero_nota_fiscal || '—',
                      motivo: justificativaTratativa,
                      quantidade: `${parseFloat(itemTratativaQuarentena?.quantidade_recebida_fisica || 0)} ${itemTratativaQuarentena?.unidade_medida || 'UN'}`,
                      lote: itemTratativaQuarentena?.lote || '—',
                      serie: itemTratativaQuarentena?.numero_serie || '—',
                      validade: itemTratativaQuarentena?.validade 
                        ? new Date(itemTratativaQuarentena.validade).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) 
                        : '—'                    });

                    // Atualiza a tela por trás
                    await carregarItensOV(ordemVendaSel.id);
                    await carregarOVs();
                  } catch (err) { 
                    alert('❌ Erro ao registrar Não Conformidade: ' + err.message); 
                  }
                }}
                style={{ 
                  ...s.btn(true, C.danger), 
                  flex: 1, 
                  padding: '10px 8px', 
                  fontSize: 11,
                  whiteSpace: 'nowrap' 
                }}
              >
                🔴 Recusar Material
              </button>

              <button
                onClick={() => setItemTratativaQuarentena(null)}
                style={{ 
                  ...s.btn(false), 
                  flex: 1, 
                  padding: '10px 8px', 
                  fontSize: 11,
                  borderColor: C.border,
                  whiteSpace: 'nowrap'
                }}
              >
                ⚪ Cancelar e Sair
              </button>

              <button
                onClick={async () => {
                  if (!justificativaTratativa.trim()) return alert('⚠️ A justificativa é obrigatória!');
                  try {
                    await apiService.put(`/estoque/movimentacoes/item/${itemTratativaQuarentena.id}/aprovar-saldo`, {
                      justificativa: justificativaTratativa,
                      destino_tratativa: 'aprovado'
                    });
                    alert('✅ Saldo aprovado! Material enviado para a área de RECEBIMENTO.');
                    setItemTratativaQuarentena(null);
                    await carregarItensOV(ordemVendaSel.id);
                    await carregarOVs();
                  } catch (err) { alert(err.message); }
                }}
                style={{ 
                  ...s.btn(true, C.success), 
                  flex: 1, 
                  padding: '10px 8px', 
                  fontSize: 11,
                  whiteSpace: 'nowrap' 
                }}
              >
                🟢 Aprovar Saldo
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: CONTAGEM CEGA (MIGO) - CORRIGIDO */}
      {modalContagemCega && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 560, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                📦 {contagemTentativa}ª CONTAGEM CEGA
                <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>
                  ({itensParaContar.length} item(ns) pendentes)
                </span>
              </div>
              <button 
                onClick={() => {
                  // 🔥 APENAS FECHA O MODAL - NÃO FAZ NADA COM OS ITENS
                  setModalContagemCega(false);
                }} 
                style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
              {/* Status da contagem */}
              <div style={{ 
                marginBottom: 16, 
                background: contagemTentativa === 1 ? '#0f2f1a' : contagemTentativa === 2 ? '#2e1c0c' : '#3f0f0f',
                border: `1px solid ${contagemTentativa === 1 ? '#22c55e44' : contagemTentativa === 2 ? '#f59e0b44' : '#ef444444'}`,
                borderRadius: 8, 
                padding: '10px 14px' 
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>
                  {contagemTentativa === 1 ? '🟢 PRIMEIRA CONTAGEM' : 
                  contagemTentativa === 2 ? '🟡 SEGUNDA CONTAGEM' : 
                  '🔴 TERCEIRA E ÚLTIMA CONTAGEM'}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  {itensParaContar.map(i => `• ${i.item_nome}`).join(' | ')}
                </div>
              </div>

              {/* Lista de itens para contar - SEM useState dentro do map */}
              {itensParaContar.map((item, idx) => {
                // Pegar os dados da contagem do estado global
                const dadosContagem = contagens[item.id] || {};
                
                return (
                  <div key={item.id} style={{ 
                    marginBottom: 16, 
                    padding: '12px 14px', 
                    background: C.bg, 
                    borderRadius: 8,
                    border: `1px solid ${C.border}44`
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                      {idx + 1}. {item.item_nome}
                      <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginLeft: 8 }}>
                        Esperado: {item.quantidade} {item.unidade_medida || 'UN'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={s.label}>QUANTIDADE CONTADA *</label>
                        <input 
                          type="number" 
                          value={dadosContagem.quantidade || ''} 
                          onChange={(e) => atualizarContagem(item.id, 'quantidade', e.target.value)}
                          placeholder="Digite a quantidade..."
                          style={s.input}
                          min="0"
                          step="0.01"
                          onWheel={(e) => e.target.blur()}
                        />
                      </div>

                      <div>
                        <label style={s.label}>UNIDADE DE MEDIDA</label>
                          <select 
                            value={dadosContagem.unidade_medida || ''} 
                            onChange={(e) => atualizarContagem(item.id, 'unidade_medida', e.target.value)}
                            style={{ ...s.input, appearance: 'none' }}
                          >
                            <option value="">Selecione a unidade</option>
                            <option value="UN">UN (Unidade)</option>
                            <option value="L">L (Litro)</option>
                            <option value="KG">KG (Quilograma)</option>
                            <option value="M">M (Metro)</option>
                            <option value="CX">CX (Caixa)</option>
                            <option value="RL">RL (Rolo)</option>
                            <option value="GL">GL (Galão)</option>
                          </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                      <div>
                        <label style={s.label}>LOTE</label>
                        <input 
                          type="text" 
                          value={dadosContagem.lote || ''} 
                          onChange={(e) => atualizarContagem(item.id, 'lote', e.target.value)}
                          placeholder="Ex: L2024-08"
                          style={s.input}
                        />
                      </div>

                      <div>
                        <label style={s.label}>VALIDADE</label>
                        <input 
                          type="date" 
                          value={dadosContagem.validade || ''} 
                          onChange={(e) => atualizarContagem(item.id, 'validade', e.target.value)}
                          style={s.input}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <label style={s.label}>NÚMERO DE SÉRIE (OPCIONAL)</label>
                      <input 
                        type="text" 
                        value={dadosContagem.numero_serie || ''} 
                        onChange={(e) => atualizarContagem(item.id, 'numero_serie', e.target.value)}
                        placeholder="Ex: SN-12345"
                        style={s.input}
                      />
                    </div>

                    <button
                      onClick={() => salvarContagemCega(item.id)}
                      style={{
                        ...s.btn(true, C.accent),
                        width: '100%',
                        marginTop: 10,
                        padding: '8px 14px',
                        fontSize: 12
                      }}
                    >
                      {contagemTentativa === 3 ? '📦 Última Tentativa' : `📦 Registrar ${contagemTentativa}ª Contagem`}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Rodapé do modal */}
            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🔹 Tentativa {contagemTentativa} de 3</span>
                <span style={{ width: 4, height: 4, background: C.muted, borderRadius: '50%' }}></span>
                <span>{itensParaContar.length} item(ns) pendentes</span>
              </div>
              <div style={{ flex: 1 }}></div>
              
              {/* 🔥 BOTÃO CANCELAR - só fecha */}
              <button 
                onClick={() => {
                  setModalContagemCega(false);
                  // Não faz nada com os itens
                }} 
                style={{ ...s.btn(false), padding: '8px 16px', fontSize: 12 }}
              >
                Cancelar
              </button>

              {/* 🔥 BOTÃO ABRIR NÃO CONFORMIDADE */}
              <button
                onClick={() => {
                  const justificativa = window.prompt('Descreva a não conformidade (ex: produto com avaria, conteúdo incorreto, etc.):');
                  if (!justificativa) {
                    alert('Justificativa é obrigatória!');
                    return;
                  }
                  // Envia todos os itens pendentes para "bloqueado"
                  itensParaContar.forEach(async (item) => {
                    await apiService.post('/estoque/movimentacoes/contagem-cega', {
                      item_id: item.id,
                      quantidade: 0,
                      tentativa: contagemTentativa,
                      status: 'bloqueado',
                      observacao: `Não conformidade: ${justificativa}`
                    });
                  });
                  setModalContagemCega(false);
                  alert('🚫 Item(s) movido(s) para Estoque Bloqueado!');
                  carregarItensOV(ordemVendaSel.id);
                  carregarOVs();
                }}
                style={{ ...s.btn(true, C.danger), padding: '8px 16px', fontSize: 12 }}
              >
                🚫 Não Conformidade
              </button>

              {/* 🔥 BOTÃO COLOCAR EM QUARENTENA */}
              <button
                onClick={() => {
                  const motivo = window.prompt('Digite o motivo da quarentena:');
                  if (!motivo) {
                    alert('Motivo é obrigatório!');
                    return;
                  }
                  itensParaContar.forEach(async (item) => {
                    await apiService.post('/estoque/movimentacoes/contagem-cega', {
                      item_id: item.id,
                      quantidade: 0,
                      tentativa: contagemTentativa,
                      status: 'rejeitado',
                      observacao: `Quarentena: ${motivo}`
                    });
                  });
                  setModalContagemCega(false);
                  alert('🚫 Item(s) enviado(s) para Quarentena!');
                  carregarItensOV(ordemVendaSel.id);
                  carregarOVs();
                }}
                style={{ ...s.btn(true, C.warn), padding: '8px 16px', fontSize: 12 }}
              >
                ⚠️ Quarentena
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📋 POP-UP DE VALIDAÇÃO: NÃO CONFORMIDADE GERADA COM SUCESSO (PADRÃO SAP) */}
      {modalSucessoNC && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000bb', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 20 }}>
          <div style={{ ...s.card, width: 480, maxWidth: '100%', padding: '22px', border: `1px solid ${C.danger}` }}>
            
            {/* Cabeçalho de Sucesso */}
            <div style={{ fontSize: 16, fontWeight: 700, color: C.danger, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚠️ Não Conformidade {modalSucessoNC.numero_nc} Criada com Sucesso!
            </div>

            <div style={{ fontSize: 13, color: C.text, marginBottom: 16, lineHeight: '1.5' }}>
              O material foi formalmente recusado pelo controle de qualidade e o saldo foi bloqueado para devolução.
            </div>

            {/* Ficha Espelho de Auditoria */}
            <div style={{ 
              background: C.bg, 
              padding: '14px', 
              borderRadius: 8, 
              border: `1px solid ${C.border}44`,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: 12,
              fontFamily: "'IBM Plex Mono', monospace"
            }}>
              <div><span style={{ color: C.muted }}>📦 Pedido/OV:</span> <span style={{ color: C.accent }}>{modalSucessoNC.pedido}</span></div>
              <div><span style={{ color: C.muted }}>🏢 Fornecedor:</span> <span style={{ color: C.text }}>{modalSucessoNC.fornecedor}</span></div>
              <div><span style={{ color: C.muted }}>📄 Nota Fiscal:</span> <span style={{ color: C.text }}>{modalSucessoNC.nota_fiscal}</span></div>
              <div><span style={{ color: C.muted }}>🔢 Qtd Recusada:</span> <span style={{ color: C.danger, fontWeight: 600 }}>{modalSucessoNC.quantidade}</span></div>
              <div><span style={{ color: C.muted }}>🏷️ Lote / Série:</span> <span style={{ color: C.text }}>{modalSucessoNC.lote} / {modalSucessoNC.serie}</span></div>
              <div><span style={{ color: C.muted }}>📆 Validade:</span> <span style={{ color: C.text }}>{modalSucessoNC.validade}</span></div>
              <div style={{ 
                marginTop: 6, 
                paddingTop: 8, 
                borderTop: `1px solid ${C.border}22`,
                color: C.danger 
              }}>
                <span style={{ color: C.muted }}>📝 Motivo da Recusa:</span><br />
                <span style={{ fontStyle: 'italic' }}>{modalSucessoNC.motivo}</span>
              </div>
            </div>

            {/* Botão de Saída Confortável */}
            <button
              onClick={() => setModalSucessoNC(null)}
              style={{ 
                ...s.btn(true, C.danger), 
                width: '100%', 
                padding: '11px', 
                marginTop: 18, 
                fontWeight: 600 
              }}
            >
              🔒 Fechar e Concluir Processo
            </button>

          </div>
        </div>
      )}

      {/* MODAL: RECEBER ITEM AVULSO */}
      {modalAvulso && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ ...s.card, width: 520, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Receber Item Avulso</div>
              <button onClick={() => setModalAvulso(false)} style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
              <div style={{ marginBottom: 16, position: 'relative' }} ref={inputRef}>
                <label style={s.label}>ITEM *</label>
                <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} onFocus={() => { if (sugestoes.length > 0) setShowSugestoes(true); }} placeholder="Digite o nome, SKU ou EAN do item..." style={s.input} autoComplete="off" />
                {showSugestoes && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                    {sugestoes.map(item => (
                      <div key={item.id} onClick={() => selecionarItem(item)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.border}22`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, color: C.text }}>{item.nome}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>SKU: {item.sku || '—'} · EAN: {item.codigo_barras || '—'} · Local: {item.localizacao || '—'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{item.saldo_atual || 0} {item.unidade_medida || 'UN'}</div>
                          <div style={{ fontSize: 9, color: C.muted }}>disponível</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {itemSelecionado && (
                <div style={{ background: C.bg, borderRadius: 6, padding: '12px 16px', marginBottom: 16, border: `1px solid ${C.accent}44` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{itemSelecionado.nome}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>SKU: {itemSelecionado.sku || '—'} · EAN: {itemSelecionado.codigo_barras || '—'} · Local: {itemSelecionado.localizacao || '—'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{itemSelecionado.saldo_atual || 0}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{itemSelecionado.unidade_medida || 'UN'} disponível</div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>QUANTIDADE *</label>
                <input type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="Ex: 10" style={s.input} min="0.01" step="0.01" disabled={!itemSelecionado} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={s.label}>FORNECEDOR</label>
                  <select value={fornecedor_id} onChange={(e) => setFornecedorId(e.target.value)} style={{...s.input, appearance: 'none'}} disabled={!itemSelecionado}>
                    <option value="">— Sem fornecedor —</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>LOTE</label>
                  <input value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Ex: L2024-08" style={s.input} disabled={!itemSelecionado}/>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={s.label}>VALIDADE</label>
                  <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} style={s.input} disabled={!itemSelecionado}/>
                </div>
                <div>
                  <label style={s.label}>NÚMERO DA NOTA FISCAL</label>
                  <input value={numero_nota_fiscal} onChange={(e) => setNumeroNotaFiscal(e.target.value)} placeholder="Ex: 12345" style={s.input} disabled={!itemSelecionado}/>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>OBSERVAÇÃO</label>
                <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: Compra efetuada via cotação RC-2026-0001" style={s.input} disabled={!itemSelecionado}/>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setModalAvulso(false)} style={{ ...s.btn(false), flex: 1 }}>Cancelar</button>
              <button onClick={receberAvulso} disabled={!itemSelecionado || !quantidade} style={{ ...s.btn(true), flex: 1 }}>
                📥 Receber
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}