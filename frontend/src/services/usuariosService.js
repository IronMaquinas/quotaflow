// services/usuariosService.js
// API calls para gerenciar usuários do tenant

import { API_URL } from "../utils/constants";

export const usuariosService = {
  // GET /api/usuarios - Listar usuários do tenant
  async listar(accessToken) {
    try {
      const res = await fetch(`${API_URL}/usuarios`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao listar usuários");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao listar usuários:", err);
      throw err;
    }
  },

  // GET /api/usuarios/:id - Buscar usuário por ID
  async buscarPorId(accessToken, id) {
    try {
      const res = await fetch(`${API_URL}/usuarios/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Usuário não encontrado");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao buscar usuário:", err);
      throw err;
    }
  },

  // POST /api/usuarios - Criar novo usuário
  async criar(accessToken, dados) {
    try {
      const res = await fetch(`${API_URL}/usuarios`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(dados),
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao criar usuário");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao criar usuário:", err);
      throw err;
    }
  },

  // PUT /api/usuarios/:id - Atualizar usuário
  async atualizar(accessToken, id, dados) {
    try {
      const res = await fetch(`${API_URL}/usuarios/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(dados),
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao atualizar usuário");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao atualizar usuário:", err);
      throw err;
    }
  },

  // DELETE /api/usuarios/:id - Deletar usuário
  async deletar(accessToken, id) {
    try {
      const res = await fetch(`${API_URL}/usuarios/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao deletar usuário");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao deletar usuário:", err);
      throw err;
    }
  },

  // POST /api/usuarios/:id/perfil - Alterar perfil
  async alterarPerfil(accessToken, id, perfil) {
    try {
      const res = await fetch(`${API_URL}/usuarios/${id}/perfil`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ perfil }),
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao alterar perfil");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao alterar perfil:", err);
      throw err;
    }
  },

  // POST /api/usuarios/:id/desativar - Desativar usuário
  async desativar(accessToken, id) {
    try {
      const res = await fetch(`${API_URL}/usuarios/${id}/desativar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao desativar usuário");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao desativar usuário:", err);
      throw err;
    }
  },

  // POST /api/usuarios/:id/ativar - Ativar usuário
  async ativar(accessToken, id) {
    try {
      const res = await fetch(`${API_URL}/usuarios/${id}/ativar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao ativar usuário");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao ativar usuário:", err);
      throw err;
    }
  },
};
