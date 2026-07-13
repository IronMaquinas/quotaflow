// ════════════════════════════════════════════════════════════════════════════════
// frontend/src/services/apiService.js
// CLIENTE HTTP CENTRALIZADO - Reutilizável para todas as requisições
// ════════════════════════════════════════════════════════════════════════════════

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

/**
 * Classe ApiService - Centraliza todas as requisições HTTP
 * Lida com autenticação, erro handling e logging
 */
class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = this.getToken();
  }

  // ─────────────────────────────────────────────────────────────────────
  // AUTENTICAÇÃO
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Retorna o JWT do localStorage
   */
  getToken() {
    try {
      const token = localStorage.getItem("token");
      return token;
    } catch {
      return null;
    }
  }

  /**
   * Define novo token
   */
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }

  /**
   * Limpa autenticação
   */
  logout() {
    this.token = null;
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
  }

  // ─────────────────────────────────────────────────────────────────────
  // REQUISIÇÕES HTTP
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Faz requisição HTTP genérica
   * @param {string} method - GET, POST, PATCH, DELETE, PUT
   * @param {string} endpoint - /chamados, /cotacoes, etc
   * @param {object} body - dados para POST/PATCH/PUT
   * @param {object} params - query parameters
   */
  async request(method, endpoint, body = null, params = {}) {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('Autenticação necessária - faça login primeiro');
      }

      const url = new URL(`${this.baseURL}${endpoint}`);

      // Adicionar query params
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          url.searchParams.append(key, value);
        }
      });

      const headers = {
        "Content-Type": "application/json",
      };

      // Adicionar token de autenticação se existir
      if (this.token) {
        headers["Authorization"] = `Bearer ${this.token}`;
      }

      const config = {
        method,
        headers,
      };

      if (body && ["POST", "PATCH", "PUT"].includes(method)) {
        config.body = JSON.stringify(body);
      }

      const response = await fetch(url.toString(), config);

      // Trata resposta vazia (204 No Content)
      const contentType = response.headers.get("content-type");
      let data = null;

      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      }

      // Trata erros HTTP
      if (!response.ok) {
        // Se 401/403, limpa sessão
        if (response.status === 401 || response.status === 403) {
          this.logout();
          window.location.href = "/";
        }

        throw new Error(
          data?.erro || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return data || {};

    } catch (error) {
      console.error(`[API Error] ${method} ${endpoint}:`, error.message);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // MÉTODOS SIMPLIFICADOS
  // ─────────────────────────────────────────────────────────────────────

  async get(endpoint, params = {}) {
    return this.request("GET", endpoint, null, params);
  }

  async post(endpoint, body, params = {}) {
    return this.request("POST", endpoint, body, params);
  }

  async patch(endpoint, body, params = {}) {
    return this.request("PATCH", endpoint, body, params);
  }

  async put(endpoint, body, params = {}) {
    return this.request("PUT", endpoint, body, params);
  }

  async delete(endpoint, params = {}) {
    return this.request("DELETE", endpoint, null, params);
  }

  // ─────────────────────────────────────────────────────────────────────
  // ENDPOINTS ESPECÍFICOS (ATALHOS CONVENIENTES)
  // ─────────────────────────────────────────────────────────────────────

  // AUTENTICAÇÃO
  async login(email, senha) {
    return this.post("/auth/login", { email, senha });
  }

  async logout_api() {
    this.logout();
  }

  // CHAMADOS
  async listarChamados() {
    return this.get("/cotacoes/chamados");
  }

  async criarChamado(chamado) {
    return this.post("/cotacoes/chamados", chamado);
  }

  async atualizarChamado(id, dados) {
    return this.patch(`/chamados/${id}`, dados);
  }

  async deletarChamado(id) {
    return this.delete(`/chamados/${id}`);
  }

  // COTAÇÕES
  async listarCotacoes() {
    return this.get("/cotacoes");
  }

  async criarCotacao(cotacao) {
    return this.post("/cotacoes", cotacao);
  }

  async finalizarCotacao(id, dados) {
    return this.put(`/cotacoes/${id}/finalizar`, dados);
  }

  async atualizarCotacao(id, dados) {
    return this.patch(`/cotacoes/${id}`, dados);
  }

  async deletarCotacao(id) {
    return this.delete(`/cotacoes/${id}`);
  }

  // FORNECEDORES
  async listarFornecedores() {
    return this.get("/fornecedores");
  }

  async criarFornecedor(fornecedor) {
    return this.post("/fornecedores", fornecedor);
  }

  async atualizarFornecedor(id, dados) {
    return this.patch(`/fornecedores/${id}`, dados);
  }

  async deletarFornecedor(id) {
    return this.delete(`/fornecedores/${id}`);
  }

  // EQUIPAMENTOS
  async listarEquipamentos() {
    return this.get("/equipamentos");
  }

  async criarEquipamento(equipamento) {
    return this.post("/equipamentos", equipamento);
  }

  async atualizarEquipamento(id, dados) {
    return this.patch(`/equipamentos/${id}`, dados);
  }

  async deletarEquipamento(id) {
    return this.delete(`/equipamentos/${id}`);
  }

  // TAREFAS
  async listarTarefas() {
    return this.get("/tarefas");
  }

  async criarTarefa(tarefa) {
    return this.post("/tarefas", tarefa);
  }

  async atualizarTarefa(id, dados) {
    return this.patch(`/tarefas/${id}`, dados);
  }

  async deletarTarefa(id) {
    return this.delete(`/tarefas/${id}`);
  }

  // USUÁRIOS
  async listarUsuarios() {
    return this.get("/usuarios");
  }

  async criarUsuario(usuario) {
    return this.post("/usuarios", usuario);
  }

  async atualizarUsuario(id, dados) {
    return this.patch(`/usuarios/${id}`, dados);
  }

  async deletarUsuario(id) {
    return this.delete(`/usuarios/${id}`);
  }
}

// Exportar instância singleton
export default new ApiService();
