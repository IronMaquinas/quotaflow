/**
 * CotacaoAutomaticaView.jsx
 * 
 * ABA 2 em TelaCotacoes
 * Mostra cotação automática com itens agrupados por categoria
 */

import React, { useState, useEffect } from 'react';
import apiService from '../../services/apiService';

export function CotacaoAutomaticaView({
  cotacao,
  onAdicionarItem,
  onRemoverItem,
  onConfirmar
}) {
  const [itens, setItens] = useState(cotacao?.items || []);
  const [carregando, setCarregando] = useState(false);
  const [error, setError] = useState(null);

  // Agrupar itens por categoria
  const itensPorCategoria = itens.reduce((acc, item) => {
    const cat = item.categoria || 'Sem categoria';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  async function handleRemoverItem(itemId) {
    if (!window.confirm('Remover este item da cotação?')) return;

    setCarregando(true);
    try {
      const response = await apiService.delete(
        `/cotacoes/${cotacao.id}/items/${itemId}`
      );

      if (response.ok) {
        setItens(itens.filter(i => i.id !== itemId));
        onRemoverItem?.(itemId);
      }
    } catch (err) {
      setError('Erro ao remover item: ' + err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function handleConfirmar() {
    if (itens.length === 0) {
      setError('Adicione pelo menos um item à cotação');
      return;
    }

    setCarregando(true);
    try {
      const response = await apiService.put(
        `/cotacoes/${cotacao.id}/confirmar`,
        {}
      );

      if (response.ok) {
        onConfirmar?.(response.resultado);
      }
    } catch (err) {
      setError('Erro ao confirmar: ' + err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{ padding: '16px', background: '#f9f9f9', borderRadius: '8px' }}>
      {error && (
        <div style={{
          padding: '12px',
          background: '#fee',
          color: '#c33',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '13px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {Object.entries(itensPorCategoria).map(([categoria, itensCategoria]) => (
        <div key={categoria} style={{ marginBottom: '20px' }}>
          <h3 style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#333',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {categoria}
          </h3>

          <div style={{ background: '#fff', borderRadius: '6px', overflow: 'hidden' }}>
            {itensCategoria.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid #eee',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: '14px' }}>
                    {item.nome}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    {item.fornecedores?.length || 0} fornecedor(es)
                    {item.fornecedores?.[0]?.preco && (
                      <span style={{ marginLeft: '8px' }}>
                        • A partir de R$ {item.fornecedores[0].preco.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleRemoverItem(item.id)}
                  disabled={carregando}
                  style={{
                    padding: '6px 10px',
                    background: '#fee',
                    color: '#c33',
                    border: '1px solid #fcc',
                    borderRadius: '4px',
                    cursor: carregando ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 500
                  }}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
        <button
          onClick={handleConfirmar}
          disabled={carregando}
          style={{
            flex: 1,
            padding: '10px',
            background: '#0066cc',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: carregando ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            opacity: carregando ? 0.6 : 1
          }}
        >
          {carregando ? 'Processando...' : 'Confirmar Cotação'}
        </button>
      </div>

      <div style={{
        marginTop: '12px',
        padding: '10px',
        background: '#f0f8ff',
        border: '1px solid #cce',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#006'
      }}>
        ℹ️ Status: <strong>Rascunho</strong> • {itens.length} item(ns)
      </div>
    </div>
  );
}