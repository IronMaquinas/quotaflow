/**
 * SearchItemComAutocomplete.jsx
 * 
 * Input com autocomplete reativo
 * Mostra sugestões de itens conforme o usuário digita
 */

import React, { useState, useEffect } from 'react';
import apiService from '../../services/apiService';

export function SearchItemComAutocomplete({
  value,
  onChange,
  onSelecionarItem,
  placeholder = 'Digite o nome do item...',
  disabled = false
}) {
  const [sugestoes, setSugestoes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [mostraSugestoes, setMostraSugestoes] = useState(false);

  // Buscar similares quando o usuário digita
  useEffect(() => {
    if (value && value.trim().length >= 2) {
      buscarSimilares(value);
    } else {
      setSugestoes([]);
    }
  }, [value]);

  async function buscarSimilares(termo) {
    setCarregando(true);
    try {
      const response = await apiService.post('/cotacoes/buscar-similares', {
        termo: termo,
        limite: 5
      });

      if (response.ok) {
        setSugestoes(response.similares || []);
        setMostraSugestoes(true);
      }
    } catch (erro) {
      console.error('Erro ao buscar similares:', erro);
      setSugestoes([]);
    } finally {
      setCarregando(false);
    }
  }

  function handleSelecionarItem(item) {
    onSelecionarItem(item);
    setSugestoes([]);
    setMostraSugestoes(false);
  }

  return (
    <div style={{ position: 'relative' }}>
      <div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => sugestoes.length > 0 && setMostraSugestoes(true)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: 'inherit'
          }}
        />
        {carregando && <span style={{ fontSize: '12px', color: '#999' }}>Buscando...</span>}
      </div>

      {mostraSugestoes && sugestoes.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid #ddd',
            borderTop: 'none',
            borderRadius: '0 0 6px 6px',
            marginTop: '-1px',
            zIndex: 1000,
            maxHeight: '300px',
            overflowY: 'auto',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
        >
          {sugestoes.map((item) => (
            <div
              key={item.id}
              onClick={() => handleSelecionarItem(item)}
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid #eee',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => (e.target.style.background = '#f5f5f5')}
              onMouseLeave={(e) => (e.target.style.background = '#fff')}
            >
              <div style={{ fontWeight: 500 }}>
                {item.nome}
                <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>
                  ({item.similaridade}%)
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                {item.categoria}
              </div>
            </div>
          ))}
        </div>
      )}

      {mostraSugestoes && sugestoes.length === 0 && !carregando && value.trim().length >= 2 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid #ddd',
            borderTop: 'none',
            borderRadius: '0 0 6px 6px',
            padding: '10px 12px',
            fontSize: '14px',
            color: '#999',
            zIndex: 1000
          }}
        >
          Nenhum item encontrado
        </div>
      )}
    </div>
  );
}