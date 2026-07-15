import { API_URL } from '../utils/constants';

export const catalogoService = {
  // GET /api/catalogo/admin - Listar itens
  async listar(accessToken, filtros = {}) {
    try {
      const params = new URLSearchParams();
      if (filtros.termo) params.append('termo', filtros.termo);
      if (filtros.categoria) params.append('categoria', filtros.categoria);
      if (filtros.marca) params.append('marca', filtros.marca);
      if (filtros.modelo) params.append('modelo', filtros.modelo);
      if (filtros.ano) params.append('ano', filtros.ano);

      const res = await fetch(`${API_URL}/catalogo/admin?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || 'Erro ao listar itens');
      }

      return await res.json();
    } catch (err) {
      console.error('❌ Erro ao listar itens:', err);
      throw err;
    }
  },

  // POST /api/catalogo/admin - Criar item
  async criar(accessToken, dados) {
    try {
      const res = await fetch(`${API_URL}/catalogo/admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(dados)
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || 'Erro ao criar item');
      }

      return await res.json();
    } catch (err) {
      console.error('❌ Erro ao criar item:', err);
      throw err;
    }
  },

  // GET /api/catalogo/categorias
  async obterCategorias(accessToken) {
    try {
      const res = await fetch(`${API_URL}/catalogo/categorias`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) throw new Error('Erro ao obter categorias');

      return await res.json();
    } catch (err) {
      console.error('❌ Erro:', err);
      throw err;
    }
  },

  // GET /api/catalogo/marcas
  async obterMarcas(accessToken) {
    try {
      const res = await fetch(`${API_URL}/catalogo/marcas`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) throw new Error('Erro ao obter marcas');

      return await res.json();
    } catch (err) {
      console.error('❌ Erro:', err);
      throw err;
    }
  }
};