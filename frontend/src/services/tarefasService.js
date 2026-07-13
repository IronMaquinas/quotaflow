// services/tarefasService.js
// API calls para gerenciar tarefas do plano de ação

import { API_URL } from "../utils/constants";

export const tarefasService = {
  // GET /api/tarefas - Listar tarefas do tenant
  async listar(accessToken) {
    try {
      const res = await fetch(`${API_URL}/tarefas`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const erro = await res.json();
        console.error('❌ Erro na resposta:', erro);
        throw new Error(erro.erro || "Erro ao listar tarefas");
      }
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('❌ Erro no service:', err);
      throw err;
    }
  },

  // POST /api/tarefas - Criar nova tarefa
  async criar(accessToken, dados) {
    try {
      const res = await fetch(`${API_URL}/tarefas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(dados),
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao criar tarefa");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao criar tarefa:", err);
      throw err;
    }
  },

  // PUT /api/tarefas/:id - Atualizar tarefa
  async atualizar(accessToken, id, dados) {
    try {
      const res = await fetch(`${API_URL}/tarefas/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(dados),
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao atualizar tarefa");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao atualizar tarefa:", err);
      throw err;
    }
  },

  // DELETE /api/tarefas/:id - Deletar tarefa
  async deletar(accessToken, id) {
    try {
      const res = await fetch(`${API_URL}/tarefas/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao deletar tarefa");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao deletar tarefa:", err);
      throw err;
    }
  },

  // POST /api/tarefas/:id/comentario - Adicionar comentário
  async adicionarComentario(accessToken, id, texto) {
    try {
      const res = await fetch(`${API_URL}/tarefas/${id}/comentario`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ texto }),
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.erro || "Erro ao adicionar comentário");
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Erro ao adicionar comentário:", err);
      throw err;
    }
  },
};