// components/portal/FormularioRespostaCotacao.jsx
//
// Formulário de resposta à cotação — componente "burro" sobre a origem
// da autenticação. Recebe `cotacao`, `enviarResposta` e `respondendo`
// como props e não sabe se veio do link tokenizado (público) ou do hub
// autenticado (JWT). Essa separação permite reaproveitar exatamente o
// mesmo formulário nos dois modos (ver TelaPortalFornecedor para o modo
// público e ModalResponderCotacao para o modo autenticado, a implementar).
//
// Estados internos: preencher → revisar → enviado (comprovante).

import { useState, useEffect } from 'react';
import { fmtBRL, fmtD } from '../../utils/formatters';

// Configuração de urgência (para tags)
const URG_CONFIG = {
  alta: { c: '#ef4444', l: '🔥 Alta' },
  media: { c: '#f59e0b', l: '⚡ Média' },
  baixa: { c: '#3b82f6', l: '✓ Baixa' },
};

// Estilos auxiliares
const inputStyle = {
  background: '#0f172a',
  border: '1px solid #2d3748',
  borderRadius: 6,
  color: '#f3f4f6',
  padding: '8px 12px',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border .2s',
};

export default function FormularioRespostaCotacao({
  cotacao,
  enviarResposta,
  respondendo,
  modoModal = false,     // true quando renderizado dentro de modal (hub do fornecedor logado)
  onSucesso,             // chamado após envio bem-sucedido (opcional)
  onFechar,              // renderiza botão "Fechar" no comprovante (opcional)
}) {
  // Estado para os valores preenchidos pelo fornecedor
  const [linhas, setLinhas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [prazoGeral, setPrazoGeral] = useState('');
  // #4c — Validade da proposta (dias). Obrigatório, default 30.
  const [validadeDias, setValidadeDias] = useState('30');
  const [obs, setObs] = useState('');
  const [step, setStep] = useState('preencher'); // preencher | revisar | enviado

  // Inicializar linhas quando cotacao carregar
  useEffect(() => {
    if (cotacao && cotacao.itens) {
      const jaResp = cotacao.ja_respondida === true;
      const porItem = {};
      if (jaResp && Array.isArray(cotacao.itens_respondidos)) {
        cotacao.itens_respondidos.forEach(ir => {
          porItem[ir.cotacao_item_id] = ir;
        });
      }

      const initialLinhas = cotacao.itens.map((item) => {
        const resp = porItem[item.id];
        // M6: código do fornecedor. Ordem de prioridade:
        //   1. O que ele já respondeu nesta cotação (reenvio)
        //   2. O vínculo aprendido anteriormente (fornecedor_codigo_item)
        //   3. O código da RC (chamado_itens.codigo = PN do fabricante)
        // Se veio só do RC ou do aprendizado, o campo começa como
        // "confirmado" (readonly). Se o fornecedor quiser mudar, clica
        // em ✏️ Editar.
        const codigoResp = resp?.codigo_fornecedor || null;
        const codigoAprendido = item.codigo_fornecedor_aprendido || null;
        const codigoRc = item.codigo_rc || null;
        const codigoFinal = codigoResp || codigoAprendido || codigoRc || '';
        // Edição explícita = só quando o fornecedor digitou algo diferente
        // do aprendido/RC nesta resposta.
        const foiEditado = codigoResp
          && codigoResp !== codigoAprendido
          && codigoResp !== codigoRc;
        return {
          id: item.id,
          codigoFornecedor: codigoFinal,
          codigoRc,
          codigoFornecedorAprendido: codigoAprendido,
          editandoCodigo: foiEditado,
          valor: resp?.valor != null ? String(resp.valor) : '',
          frete: resp?.modalidade || 'CIF',
          grupo: null,
          valorFreteInd: resp?.frete != null ? String(resp.frete) : '',
        };
      });
      setLinhas(initialLinhas);

      // Fase "resposta em múltiplas rodadas" (2026-09): só cai no
      // comprovante se TODOS os itens já têm resposta. Se o fornecedor
      // respondeu 2 de 3 (ex: comprador adicionou ele manualmente no 3º
      // depois), mantém o form aberto pra ele completar o que falta.
      const itensComRespostaIds = new Set(
        (cotacao.itens_respondidos || []).map(ir => String(ir.cotacao_item_id))
      );
      const itensPendentes = cotacao.itens.filter(
        it => !itensComRespostaIds.has(String(it.id))
      );
      const tudoRespondido = jaResp && itensPendentes.length === 0;

      if (tudoRespondido) {
        setStep('enviado');
      }

      // Aproveita prazo/obs/validade que já foram preenchidos antes
      // (em qualquer modo — puro ou misto).
      if (cotacao.respostasExistentes) {
        setPrazoGeral(String(cotacao.respostasExistentes.prazo || ''));
        setObs(cotacao.respostasExistentes.obs || '');
        if (cotacao.respostasExistentes.validade_dias) {
          setValidadeDias(String(cotacao.respostasExistentes.validade_dias));
        }
      }
    }
  }, [cotacao]);

  // Funções auxiliares
  const setLinha = (id, campo, val) =>
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: val } : l)));

  const addGrupo = () => {
    const ids = grupos.map((g) => parseInt(g.id.replace('G', '')) || 0);
    const next = Math.max(...ids, 0) + 1;
    setGrupos((prev) => [...prev, { id: `G${next}`, nome: `Volume ${next}`, valorFrete: '' }]);
  };

  const removeGrupo = (gid) => {
    setGrupos((prev) => prev.filter((g) => g.id !== gid));
    setLinhas((prev) => prev.map((l) => (l.grupo === gid ? { ...l, grupo: null } : l)));
  };

  const setGrupoFrete = (gid, val) =>
    setGrupos((prev) => prev.map((g) => (g.id === gid ? { ...g, valorFrete: val } : g)));

  // Função para calcular frete rateado
  const freteRateado = (linha) => {
    if (!linha) return 0;
    if (linha.frete === 'CIF') return 0;
    if (!linha.grupo) return parseFloat(linha.valorFreteInd || 0);
    const grupo = grupos.find((g) => g.id === linha.grupo);
    if (!grupo?.valorFrete) return 0;
    const membros = linhas.filter((l) => l.grupo === linha.grupo && l.valor);
    const totalGrupo = membros.reduce((s, l) => s + parseFloat(l.valor || 0), 0);
    if (!totalGrupo) return 0;
    const proporcao = parseFloat(linha.valor || 0) / totalGrupo;
    return parseFloat(grupo.valorFrete) * proporcao;
  };

  // Função para calcular custo total
  const custoItem = (linha) => {
    if (!linha) return null;
    const val = parseFloat(linha.valor || 0);
    if (!val) return null;
    return val + freteRateado(linha);
  };

  // Validação
  const linhasOK = linhas.filter((l) => l.valor);
  const validadeOk = parseInt(validadeDias, 10) > 0 && parseInt(validadeDias, 10) <= 365;
  const podeRevisar = linhasOK.length === linhas.length
    && prazoGeral && prazoGeral > 0
    && validadeOk;

  // Totais
  const totalPecas = linhas.reduce((s, l) => s + parseFloat(l.valor || 0), 0);
  const totalFrete =
    grupos.reduce((s, g) => s + parseFloat(g.valorFrete || 0), 0) +
    linhas
      .filter((l) => l.frete === 'FOB' && !l.grupo)
      .reduce((s, l) => s + parseFloat(l.valorFreteInd || 0), 0);
  const totalGeral = totalPecas + totalFrete;

  // Handler para enviar resposta
  const handleEnviar = async () => {
    const itensComRespostaIds = new Set(
      (cotacao.itens_respondidos || []).map(ir => String(ir.cotacao_item_id))
    );
    const linhasPendentes = linhas.filter(
      l => !itensComRespostaIds.has(String(l.id))
    );

    if (linhasPendentes.length === 0) {
      alert('Todos os itens desta cotação já foram respondidos.');
      return;
    }

    const linhasPendentesSemValor = linhasPendentes.filter(l => !l.valor);
    if (linhasPendentesSemValor.length > 0) {
      alert(`Preencha o valor unitário dos ${linhasPendentesSemValor.length} item(ns) pendente(s) antes de enviar.`);
      return;
    }

    const payload = {
      itens: linhasPendentes.map((l) => {
        const itemOriginal = cotacao.itens.find((i) => i.id === l.id);
        return {
          item_id: l.id,
          nome: itemOriginal?.peca || itemOriginal?.nome || '',
          quantidade: itemOriginal?.quantidade || 1,
          valor_unitario: parseFloat(l.valor || 0),
          frete: l.frete,
          valor_frete: l.frete === 'FOB'
            ? parseFloat(freteRateado(l) || 0)
            : 0,
          grupo_frete: l.grupo || null,
          // M6: envia sempre que houver valor. O backend decide se é
          // 'manual' (diferente do RC) ou 'auto' (mesmo do RC).
          codigo_fornecedor: l.codigoFornecedor
            ? String(l.codigoFornecedor).trim()
            : null,
        };
      }),
      prazo_entrega: parseInt(prazoGeral),
      validade_dias: parseInt(validadeDias, 10),
      observacoes: obs,
      grupos_frete: grupos.map((g) => ({
        id: g.id,
        nome: g.nome,
        valor_frete: parseFloat(g.valorFrete || 0),
      })),
    };

    try {
      await enviarResposta(payload);
      setStep('enviado');
      onSucesso?.();
    } catch (err) {
      alert('Erro ao enviar proposta: ' + err.message);
    }
  };

  // --- COMPROVANTE ---
  if (step === 'enviado') {
    const veioDoBackend = cotacao?.ja_respondida === true;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: modoModal ? 'auto' : '100vh', gap: 20, padding: 40 }}>
        <div style={{ fontSize: 52 }}>{veioDoBackend ? '✅' : '🎉'}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1f2937' }}>
          {veioDoBackend ? 'Você já respondeu esta cotação' : 'Proposta enviada com sucesso!'}
        </div>
        {veioDoBackend && cotacao.respondida_em && (
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: -12 }}>
            Respondida em {fmtD(cotacao.respondida_em)}
          </div>
        )}
        <div style={{ background: '#1e293b', padding: '20px 28px', borderRadius: 12, minWidth: 320 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12, letterSpacing: '0.08em' }}>
            {veioDoBackend ? 'SUA PROPOSTA' : 'RESUMO'} — {cotacao.numero_cotacao || cotacao.id}
          </div>
          {cotacao.itens.map((it, i) => {
            const l = linhas.find((l) => l.id === it.id);
            const ct = custoItem(l) || 0;
            return (
              <div
                key={it.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: '1px solid #2d3748',
                  fontSize: 13,
                }}
              >
                <span style={{ color: '#d1d5db' }}>{it.peca || it.nome}</span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>{fmtBRL(ct)}</span>
              </div>
            );
          })}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 10,
              paddingTop: 10,
              borderTop: '1px solid #2d3748',
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            <span style={{ color: '#f3f4f6' }}>Total do pedido</span>
            <span style={{ color: '#10b981' }}>{fmtBRL(totalGeral)}</span>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
            Prazo: {prazoGeral} dias úteis
            {validadeDias && ` · Validade: ${validadeDias} dias`}
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', maxWidth: 360 }}>
          {veioDoBackend
            ? 'Para alterar sua proposta, entre em contato com o comprador. Esta página é apenas o comprovante do que foi enviado.'
            : 'Um e-mail de confirmação foi enviado para você com todos os dados desta proposta.'}
        </div>
        {onFechar && (
          <button
            onClick={onFechar}
            style={{
              padding: '10px 28px', borderRadius: 8,
              background: '#10b981', color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Fechar
          </button>
        )}
      </div>
    );
  }

  // --- TELA DE REVISÃO ---
  if (step === 'revisar') {
    return (
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '32px 20px', overflowY: 'auto' }}>
        <div
          style={{
            background: '#1e293b',
            borderRadius: 12,
            padding: '14px 20px',
            marginBottom: 20,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <div style={{ width: 4, height: 28, background: '#10b981', borderRadius: 2 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f3f4f6' }}>
              {cotacao.empresa || 'Fornecedor'} · {cotacao.numero_cotacao || cotacao.id}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Revise sua proposta antes de enviar</div>
          </div>
        </div>

        <div style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #2d3748', fontSize: 11, color: '#6b7280', letterSpacing: '0.08em' }}>
            ITENS DA PROPOSTA
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 90px 80px 80px 80px 80px 100px',
              padding: '9px 18px',
              background: '#0f172a',
              borderBottom: '1px solid #2d3748',
              fontSize: 10,
              color: '#6b7280',
              letterSpacing: '0.07em',
            }}
          >
            <span>ITEM</span>
            <span>SEU CÓD.</span>
            <span>QTD</span>
            <span>VL UNIT.</span>
            <span>FRETE</span>
            <span>GRUPO</span>
            <span style={{ textAlign: 'right' }}>CUSTO TOTAL</span>
          </div>
          {cotacao.itens.map((it, i) => {
            const l = linhas.find((l) => l.id === it.id);
            const fr = freteRateado(l);
            const ct = custoItem(l);
            const g = grupos.find((g) => g.id === l.grupo);
            return (
              <div
                key={it.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 90px 80px 80px 80px 80px 100px',
                  padding: '11px 18px',
                  borderBottom: i < cotacao.itens.length - 1 ? '1px solid #2d3748' : 'none',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, color: '#f3f4f6', fontWeight: 500 }}>{it.peca || it.nome}</div>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>{it.codigo}</div>
                </div>
                <span style={{ fontSize: 11, color: '#3b82f6', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {l?.codigoFornecedor || '—'}
                </span>
                <span style={{ fontSize: 12, color: '#d1d5db' }}>{it.quantidade}x</span>
                <span style={{ fontSize: 13, color: '#f3f4f6', fontWeight: 600 }}>{fmtBRL(parseFloat(l.valor))}</span>
                <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: l.frete === 'CIF' ? '#0f2f1a' : '#3f2a0a', color: l.frete === 'CIF' ? '#10b981' : '#f59e0b' }}>
                  {l.frete}
                </span>
                <span style={{ fontSize: 11, color: '#6b7280' }}>
                  {g ? g.nome : l.frete === 'FOB' ? `Individual${l.valorFreteInd ? ` (${fmtBRL(parseFloat(l.valorFreteInd))})` : ''}` : '—'}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>{fmtBRL(ct)}</div>
                  {fr > 0 && <div style={{ fontSize: 10, color: '#6b7280' }}>+{fmtBRL(fr)} frete</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Totais */}
        <div style={{ background: '#1e293b', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: '#d1d5db' }}>Subtotal peças</span>
            <span style={{ color: '#f3f4f6' }}>{fmtBRL(totalPecas)}</span>
          </div>
          {grupos
            .filter((g) => g.valorFrete)
            .map((g) => (
              <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#d1d5db' }}>Frete {g.nome}</span>
                <span style={{ color: '#f59e0b' }}>{fmtBRL(parseFloat(g.valorFrete))}</span>
              </div>
            ))}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 16,
              fontWeight: 700,
              paddingTop: 10,
              marginTop: 6,
              borderTop: '1px solid #2d3748',
            }}
          >
            <span style={{ color: '#f3f4f6' }}>Total do pedido</span>
            <span style={{ color: '#10b981' }}>{fmtBRL(totalGeral)}</span>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
            Prazo: {prazoGeral} dias úteis · Validade: {validadeDias} dias
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setStep('preencher')}
            style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#2d3748', color: '#d1d5db', border: 'none', fontSize: 14, cursor: 'pointer' }}
          >
            ← Editar
          </button>
          <button
            onClick={handleEnviar}
            disabled={respondendo}
            style={{ flex: 2, padding: 10, borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', fontSize: 15, cursor: 'pointer', fontWeight: 600 }}
          >
            {respondendo ? 'Enviando...' : '✓ Confirmar e enviar proposta'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 10 }}>
          Sua proposta é confidencial. Outros fornecedores não têm acesso aos seus valores.
        </div>
      </div>
    );
  }

  // --- TELA PRINCIPAL DE PREENCHIMENTO ---
  return (
    <div style={{ maxWidth: modoModal ? '100%' : 900, margin: '0 auto', padding: modoModal ? '16px 20px' : '28px 20px', overflowY: 'auto' }}>
      {/* Header */}
      <div
        style={{
          background: '#1e293b',
          borderRadius: 12,
          padding: '14px 20px',
          marginBottom: 16,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 4, height: 28, background: '#10b981', borderRadius: 2 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f3f4f6' }}>
              {cotacao.empresa || 'Fornecedor'}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              Cotação {cotacao.numero_cotacao || cotacao.id} · Responder até {fmtD(cotacao.prazo_resposta || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))}
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: 10,
            padding: '4px 10px',
            borderRadius: 4,
            background: '#3f2a0a',
            color: '#f59e0b',
          }}
        >
          {cotacao.itens?.filter((i) => i.urgencia === 'alta').length || 0} item(ns) urgente(s)
        </span>
      </div>

      {/* Instrução */}
      <div
        style={{
          background: '#0f1e35',
          border: '1px solid #3b82f633',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          fontSize: 12,
          color: '#d1d5db',
          lineHeight: 1.8,
        }}
      >
        <span style={{ color: '#3b82f6', fontWeight: 600 }}>ℹ Instruções de preenchimento: </span>
        Para cada item informe o valor unitário e a modalidade de frete.
        <strong style={{ color: '#f3f4f6' }}> CIF</strong> = frete incluso no preço.
        <strong style={{ color: '#f3f4f6' }}> FOB</strong> = frete cobrado à parte.
        Se múltiplos itens compartilham o mesmo volume de entrega, agrupe-os e informe o frete do grupo — o sistema rateia automaticamente pelo valor de cada item.
      </div>

      {/* Aviso quando o fornecedor já respondeu parcialmente — modo misto */}
      {(() => {
        const respondidosCount = (cotacao.itens_respondidos || []).length;
        const pendentesCount = cotacao.itens.length - respondidosCount;
        if (respondidosCount === 0 || pendentesCount === 0) return null;
        return (
          <div
            style={{
              background: '#3f2a0a',
              border: '1px solid #f59e0b55',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 16,
              fontSize: 12,
              color: '#f59e0b',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <span style={{ fontSize: 16 }}>⚠️</span>
            <div>
              <strong>Você já respondeu {respondidosCount} de {cotacao.itens.length} itens.</strong>
              <div style={{ color: '#d1d5db', marginTop: 4 }}>
                Preencha os <strong>{pendentesCount} item(ns) pendente(s)</strong> abaixo.
                Os já respondidos estão bloqueados — pra alterar algum valor já enviado,
                entre em contato com o comprador e solicite uma renegociação.
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tabela de itens */}
      <div style={{ background: '#1e293b', borderRadius: 12, overflowX: 'auto', overflowY: 'hidden', marginBottom: 14 }}>
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #2d3748',
            fontSize: 11,
            color: '#6b7280',
            letterSpacing: '0.08em',
          }}
        >
          ITENS SOLICITADOS — {cotacao.itens.length} SKU(s)
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(180px, 1.8fr) 120px 32px 100px 90px 130px 110px',
            minWidth: 820,
            padding: '9px 14px',
            background: '#0f172a',
            borderBottom: '1px solid #2d3748',
            fontSize: 10,
            color: '#6b7280',
            letterSpacing: '0.07em',
            gap: 6,
          }}
        >
          <span>ITEM / CÓDIGO</span>
          <span title="Código que vai no campo cProd da sua NFe. Já vem preenchido com o código do fabricante usado no pedido — corrija se você usa um diferente.">
            SEU CÓDIGO NA NFe <span style={{ color: '#3b82f6', fontSize: 12 }}>ⓘ</span>
          </span>
          <span>QTD</span>
          <span>VALOR UNIT. (R$)</span>
          <span>MODALIDADE</span>
          <span>GRUPO DE FRETE</span>
          <span style={{ textAlign: 'right' }}>CUSTO TOTAL</span>
        </div>
        {cotacao.itens.map((it, i) => {
          const l = linhas.find((l) => l.id === it.id);
          const ct = custoItem(l);
          const fr = freteRateado(l);
          const jaRespondido = (cotacao.itens_respondidos || []).some(
            ir => String(ir.cotacao_item_id) === String(it.id)
          );
          return (
            <div
              key={it.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 1.8fr) 120px 32px 100px 90px 130px 110px',
                padding: '12px 14px',
                borderBottom: i < cotacao.itens.length - 1 ? '1px solid #2d3748' : 'none',
                alignItems: 'center',
                gap: 8,
                background: l?.valor ? 'transparent' : '#0d111a',
                opacity: jaRespondido ? 0.92 : 1,
                pointerEvents: jaRespondido ? 'none' : 'auto',
                borderLeft: jaRespondido ? '3px solid #10b981' : 'none',
              }}
            >
              <div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: 9,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: URG_CONFIG[it.urgencia]?.c + '22',
                      color: URG_CONFIG[it.urgencia]?.c || '#6b7280',
                    }}
                  >
                    {URG_CONFIG[it.urgencia]?.l || it.urgencia}
                  </span>
                  <span
                    title={it.peca || it.nome}
                    style={{
                      fontSize: 13,
                      color: '#f3f4f6',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      minWidth: 0,
                    }}
                  >
                    {it.peca || it.nome}
                  </span>
                  {jaRespondido && (
                    <span
                      title="Este item já foi respondido. Para alterar, contate o comprador."
                      style={{
                        fontSize: 9,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: '#0f2f1a',
                        color: '#10b981',
                        border: '1px solid #10b98155',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                      }}
                    >
                      ✓ JÁ RESPONDIDO
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: '#3b82f6', marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {it.codigo} · {it.equipamento || ''}
                </div>
              </div>
              {/* M6: código do fornecedor (cProd da NFe).
                  Modo 1 (default): readonly, pré-preenchido com o código do
                  fabricante que o comprador cadastrou. O fornecedor só vê
                  e (opcionalmente) clica em ✏️ pra corrigir.
                  Modo 2 (editando): input normal — ele digita o código dele. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                {l?.editandoCodigo ? (
                  <>
                    <input
                      type="text"
                      value={l?.codigoFornecedor || ''}
                      onChange={(e) => setLinha(it.id, 'codigoFornecedor', e.target.value)}
                      placeholder="Ex: LP-ATH-DIR"
                      autoFocus
                      style={{
                        ...inputStyle,
                        flex: 1, minWidth: 0,
                        padding: '6px 8px',
                        fontSize: 12,
                        fontFamily: "'IBM Plex Mono', monospace",
                        borderColor: '#f59e0b88',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setLinha(it.id, 'editandoCodigo', false)}
                      title="Confirmar código"
                      style={{
                        background: 'transparent', border: 'none',
                        color: '#10b981', cursor: 'pointer',
                        fontSize: 14, padding: 2,
                      }}
                    >
                      ✓
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{
                      flex: 1, minWidth: 0,
                      fontSize: 12,
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: l?.codigoFornecedor ? '#d1d5db' : '#6b7280',
                      padding: '6px 8px',
                      background: '#0f172a',
                      border: `1px solid ${l?.codigoFornecedorAprendido ? '#10b98155' : '#2d3748'}`,
                      borderRadius: 6,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                      title={
                        l?.codigoFornecedorAprendido
                          ? 'Código já registrado por você em uma compra anterior'
                          : 'Código do fabricante cadastrado pelo comprador — confirme se você usa esse mesmo na NFe'
                      }
                    >
                      {l?.codigoFornecedor || <span style={{ color: '#6b7280' }}>—</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setLinha(it.id, 'editandoCodigo', true)}
                      title="Usar um código diferente deste"
                      style={{
                        background: 'transparent', border: 'none',
                        color: '#6b7280', cursor: 'pointer',
                        fontSize: 12, padding: 2,
                      }}
                    >
                      ✏️
                    </button>
                  </>
                )}
              </div>
              <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, textAlign: 'center' }}>
                {it.quantidade}x
              </span>
              <input
                type="number"
                value={l?.valor || ''}
                onChange={(e) => setLinha(it.id, 'valor', e.target.value)}
                placeholder="0,00"
                style={{
                  ...inputStyle,
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '7px 10px',
                  border: `1px solid ${l?.valor ? '#10b981' : '#2d3748'}`,
                  background: l?.valor ? '#0f2f1a' : '#0f172a',
                }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                {['CIF', 'FOB'].map((op) => (
                  <div
                    key={op}
                    onClick={() => setLinha(it.id, 'frete', op)}
                    style={{
                      flex: 1,
                      padding: '6px 4px',
                      borderRadius: 6,
                      border: `1px solid ${l?.frete === op ? (op === 'CIF' ? '#10b981' : '#f59e0b') : '#2d3748'}`,
                      background: l?.frete === op ? (op === 'CIF' ? '#0f2f1a' : '#3f2a0a') : '#0f172a',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all .1s',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: l?.frete === op ? (op === 'CIF' ? '#10b981' : '#f59e0b') : '#6b7280',
                      }}
                    >
                      {op}
                    </div>
                    <div style={{ fontSize: 9, color: '#6b7280' }}>{op === 'CIF' ? 'incluso' : 'à parte'}</div>
                  </div>
                ))}
              </div>
              <div>
                {l?.frete === 'FOB' ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <select
                      value={l?.grupo || ''}
                      onChange={(e) => setLinha(it.id, 'grupo', e.target.value || null)}
                      style={{
                        ...inputStyle,
                        flex: 1,
                        minWidth: 0,
                        padding: '7px 8px',
                        fontSize: 12,
                        appearance: 'none',
                      }}
                    >
                      <option value="">Individual</option>
                      {grupos.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nome}
                        </option>
                      ))}
                    </select>
                    {!l?.grupo && (
                      <>
                        <span style={{ fontSize: 10, color: '#6b7280' }}>R$</span>
                        <input
                          type="number"
                          value={l?.valorFreteInd || ''}
                          onChange={(e) => setLinha(it.id, 'valorFreteInd', e.target.value)}
                          placeholder="0,00"
                          style={{
                            ...inputStyle,
                            width: 72,
                            padding: '6px 8px',
                            fontSize: 12,
                            border: `1px solid ${l?.valorFreteInd ? '#f59e0b' : '#2d3748'}`,
                            background: l?.valorFreteInd ? '#3f2a0a' : '#0f172a',
                          }}
                        />
                      </>
                    )}
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: '#6b7280' }}>— (CIF incluso)</span>
                )}
              </div>
              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {ct != null ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>{fmtBRL(ct)}</div>
                    {fr > 0 && <div style={{ fontSize: 10, color: '#6b7280' }}>+{fmtBRL(fr)} frete</div>}
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: '#2d3748' }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grupos de frete */}
      <div style={{ background: '#1e293b', borderRadius: 12, padding: '16px 18px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.08em' }}>🚚 GRUPOS DE FRETE (FOB)</div>
          <button
            onClick={addGrupo}
            style={{
              background: '#1e2a3f',
              border: '1px solid #3b82f6',
              borderRadius: 6,
              padding: '5px 12px',
              color: '#3b82f6',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + Adicionar grupo
          </button>
        </div>
        {grupos.length === 0 && (
          <div style={{ fontSize: 12, color: '#6b7280' }}>Nenhum grupo criado. Crie grupos para ratear o frete entre itens do mesmo volume.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {grupos.map((g) => {
            const membros = linhas.filter((l) => l.grupo === g.id);
            const totalMembros = membros.reduce((s, l) => s + parseFloat(l.valor || 0), 0);
            return (
              <div key={g.id} style={{ background: '#0f172a', border: '1px solid #2d3748', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', minWidth: 80 }}>{g.nome}</span>
                  <div style={{ flex: 1, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {membros.length === 0 ? (
                      <span style={{ fontSize: 11, color: '#6b7280' }}>Nenhum item — selecione "Grupo" na linha do item</span>
                    ) : (
                      membros.map((l) => {
                        const it = cotacao.itens.find((i) => i.id === l.id);
                        return (
                          <span key={l.id} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: '#3f2a0a', color: '#f59e0b' }}>
                            {it?.codigo}
                          </span>
                        );
                      })
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>Frete total:</span>
                    <input
                      type="number"
                      value={g.valorFrete}
                      onChange={(e) => setGrupoFrete(g.id, e.target.value)}
                      placeholder="R$ 0,00"
                      style={{ ...inputStyle, width: 100, padding: '5px 8px', fontSize: 13 }}
                    />
                    {totalMembros > 0 && g.valorFrete && (
                      <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {((parseFloat(g.valorFrete) / totalMembros) * 100).toFixed(0)}% do subtotal
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeGrupo(g.id)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: 14, cursor: 'pointer', flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
                {membros.length > 0 && g.valorFrete && totalMembros > 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: '1px solid #2d3748',
                      display: 'flex',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    {membros.map((l) => {
                      const it = cotacao.itens.find((i) => i.id === l.id);
                      const prop = parseFloat(l.valor || 0) / totalMembros;
                      const frItem = parseFloat(g.valorFrete) * prop;
                      return (
                        <div key={l.id} style={{ fontSize: 11, color: '#6b7280' }}>
                          <span style={{ color: '#d1d5db' }}>{it?.codigo}</span>: {fmtBRL(frItem)} ({Math.round(prop * 100)}%)
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Prazo geral + validade + obs */}
      <div style={{ background: '#1e293b', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
          <div>
            <label style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.08em', marginBottom: 4, display: 'block' }}>
              PRAZO DE ENTREGA (DIAS ÚTEIS) *
            </label>
            <input
              type="number"
              value={prazoGeral}
              onChange={(e) => setPrazoGeral(e.target.value)}
              placeholder="Ex: 3"
              style={{ ...inputStyle, fontSize: 16, fontWeight: 600 }}
            />
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Prazo único para todos os itens</div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.08em', marginBottom: 4, display: 'block' }}>
              VALIDADE DA PROPOSTA (DIAS) *
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={validadeDias}
              onChange={(e) => setValidadeDias(e.target.value)}
              placeholder="Ex: 30"
              style={{
                ...inputStyle,
                fontSize: 16,
                fontWeight: 600,
                borderColor: validadeOk ? '#2d3748' : '#ef4444',
              }}
            />
            <div style={{ fontSize: 11, color: validadeOk ? '#6b7280' : '#ef4444', marginTop: 4 }}>
              {validadeOk
                ? 'Por quantos dias estes preços se mantêm'
                : 'Informe entre 1 e 365 dias'}
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <label style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.08em', marginBottom: 4, display: 'block' }}>
              OBSERVAÇÕES GERAIS (OPCIONAL)
            </label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              placeholder="Condições de pagamento, marcas alternativas..."
              style={{ ...inputStyle, resize: 'none', boxSizing: 'border-box', width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Totalizador e botão */}
      <div
        style={{
          background: '#1e293b',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>SUBTOTAL PEÇAS</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f3f4f6' }}>{fmtBRL(totalPecas)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>TOTAL FRETE</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>{fmtBRL(totalFrete)}</div>
          </div>
          <div style={{ borderLeft: '1px solid #2d3748', paddingLeft: 24 }}>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>TOTAL DO PEDIDO</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{fmtBRL(totalGeral)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'right' }}>
            {linhasOK.length}/{linhas.length} itens preenchidos
            {!prazoGeral && ' · prazo obrigatório'}
            {prazoGeral && !validadeOk && ' · validade obrigatória'}
          </div>
          <button
            onClick={() => podeRevisar && setStep('revisar')}
            disabled={!podeRevisar}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              background: podeRevisar ? '#10b981' : '#2d3748',
              color: podeRevisar ? '#fff' : '#6b7280',
              border: 'none',
              fontSize: 14,
              cursor: podeRevisar ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
            }}
          >
            Revisar proposta →
          </button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center' }}>
        Sua proposta é confidencial. Outros fornecedores não têm acesso aos seus valores.
      </div>
    </div>
  );
}