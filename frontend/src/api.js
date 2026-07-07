// Camada de comunicação com o backend
// Todos os componentes usam estas funções — nunca chamam fetch diretamente

const BASE = "/api"; // O vite.config.js redireciona para http://localhost:3001

function getToken() {
  return localStorage.getItem("qf_token");
}

async function req(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  const token = getToken();
  if (token) opts.headers["Authorization"] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);

  if (res.status === 401) {
    // Token expirado — forçar novo login
    localStorage.removeItem("qf_token");
    window.location.reload();
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
  return data;
}

export const api = {
  // Auth
  login: (email, senha) => req("POST", "/auth/login", { email, senha }),
  me: () => req("GET", "/auth/me"),

  // Usuários
  listarUsuarios: () => req("GET", "/usuarios"),
  criarUsuario: (dados) => req("POST", "/usuarios", dados),
  atualizarUsuario: (id, dados) => req("PUT", `/usuarios/${id}`, dados),

  // Fornecedores
  listarFornecedores: () => req("GET", "/fornecedores"),
  criarFornecedor: (dados) => req("POST", "/fornecedores", dados),
  atualizarFornecedor: (id, dados) => req("PUT", `/fornecedores/${id}`, dados),
  excluirFornecedor: (id) => req("DELETE", `/fornecedores/${id}`),
  alertasCNPJ: () => req("GET", "/fornecedores/alertas-cnpj"),

  // CNPJ
  consultarCNPJ: (cnpj) => req("GET", `/cnpj/${cnpj.replace(/\D/g,"")}`),
  atualizarTodosCNPJs: () => req("POST", "/cnpj/atualizar-todos"),

  // Chamados e cotações
  listarChamados: () => req("GET", "/cotacoes/chamados"),
  abrirChamado: (dados) => req("POST", "/cotacoes/chamados", dados),
  listarCotacoes: () => req("GET", "/cotacoes"),
  iniciarCotacao: (dados) => req("POST", "/cotacoes", dados),
  finalizarCotacao: (id, dados) => req("PUT", `/cotacoes/${id}/finalizar`, dados),

  // E-mail
  reenviarEmail: (token) => req("POST", "/email/reenviar", { token }),

  // Portal fornecedor (público — sem token)
  buscarCotacaoPortal: (token) => fetch(`${BASE}/cotacao/${token}`).then(r => r.json()),
  responderCotacaoPortal: (token, dados) =>
    fetch(`${BASE}/cotacao/${token}/responder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    }).then(r => r.json()),
};
