// hooks/useEmail.js
import { useState } from 'react';

export function useEmail(accessToken) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  const enviarCotacao = async ({ cotacaoId, fornecedorId, email }) => {
    setEnviando(true);
    setErro(null);
    try {
      const response = await fetch(`${API_URL}/email/enviar-cotacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ cotacaoId, fornecedorId, email }),
      });
      if (!response.ok) throw new Error('Falha ao enviar e-mail');
      return await response.json();
    } catch (err) {
      setErro(err.message);
      throw err;
    } finally {
      setEnviando(false);
    }
  };

  return { enviarCotacao, enviando, erro };
}