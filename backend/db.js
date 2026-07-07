const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "quotaflow.db");
const db = new Database(DB_PATH);

// Habilitar WAL para melhor performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Criar tabelas ─────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS empresa (
    id INTEGER PRIMARY KEY DEFAULT 1,
    nome TEXT NOT NULL DEFAULT 'Minha Empresa',
    cnpj TEXT,
    participaBenchmark INTEGER DEFAULT 1,
    regiao TEXT DEFAULT 'SP',
    criado_em DATETIME DEFAULT (datetime('now'))
  );

  -- Garantir que existe 1 registro de empresa
  INSERT OR IGNORE INTO empresa (id, nome) VALUES (1, 'Minha Empresa Ltda');

  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    perfil TEXT NOT NULL CHECK(perfil IN ('tecnico','comprador','gestor','admin')),
    ativo INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS equipamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag TEXT NOT NULL,
    nome TEXT NOT NULL,
    local TEXT,
    fabricante TEXT,
    modelo TEXT,
    serie TEXT,
    ativo INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fornecedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    razao_social TEXT,
    cnpj TEXT,
    situacao_cnpj TEXT,
    dados_cnpj TEXT,  -- JSON com dados completos da Receita
    ultima_consulta_cnpj DATETIME,
    endereco TEXT,
    cidade TEXT,
    estado TEXT,
    cep TEXT,
    contatos TEXT,    -- JSON: [{nome,papel,email,telefone,whatsapp}]
    categorias TEXT,  -- JSON: ["cat1","cat2"]
    obs TEXT,
    ativo INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chamados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT UNIQUE NOT NULL,
    peca TEXT NOT NULL,
    codigo TEXT,
    equipamento_id INTEGER REFERENCES equipamentos(id),
    urgencia TEXT DEFAULT 'media',
    categoria TEXT DEFAULT 'corretiva',
    categoria_item TEXT,
    tipo_disponib TEXT DEFAULT 'prateleira',
    tecnico_id INTEGER REFERENCES usuarios(id),
    tecnico_nome TEXT,
    descricao TEXT,
    status TEXT DEFAULT 'aguardando_cotacao',
    valor_aprovado REAL,
    valor_negociado REAL,
    custo_total_real REAL,
    fornecedor_aprovado TEXT,
    aprovado_por TEXT,
    aprovado_por_id INTEGER REFERENCES usuarios(id),
    lead_time INTEGER,
    participa_benchmark INTEGER DEFAULT 1,
    regiao TEXT DEFAULT 'SP',
    aberto_em DATETIME DEFAULT (datetime('now')),
    finalizado_em DATETIME
  );

  CREATE TABLE IF NOT EXISTS cotacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chamado_id INTEGER NOT NULL REFERENCES chamados(id),
    status TEXT DEFAULT 'em_curso',
    enviado_em DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cotacao_fornecedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cotacao_id INTEGER NOT NULL REFERENCES cotacoes(id),
    fornecedor_id INTEGER REFERENCES fornecedores(id),
    fornecedor_nome TEXT NOT NULL,
    fornecedor_email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pendente',
    valor REAL,
    prazo INTEGER,
    frete TEXT DEFAULT 'CIF',
    valor_frete REAL DEFAULT 0,
    obs TEXT,
    data_resposta DATETIME,
    enviado_em DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tarefas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    detalhe TEXT,
    responsavel TEXT,
    responsavel_id INTEGER REFERENCES usuarios(id),
    prazo DATE,
    prioridade TEXT DEFAULT 'media',
    status TEXT DEFAULT 'pendente',
    origem TEXT,  -- 'relatorio' | 'manual'
    origem_periodo TEXT,
    criado_por_id INTEGER REFERENCES usuarios(id),
    criado_em DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tarefa_comentarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tarefa_id INTEGER NOT NULL REFERENCES tarefas(id),
    autor_id INTEGER REFERENCES usuarios(id),
    autor_nome TEXT NOT NULL,
    texto TEXT NOT NULL,
    criado_em DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notas_periodo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chave TEXT UNIQUE NOT NULL,  -- ex: '2026-03'
    texto TEXT NOT NULL,
    criado_por_id INTEGER REFERENCES usuarios(id),
    atualizado_em DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cnpj_alertas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id),
    situacao_anterior TEXT,
    situacao_nova TEXT,
    detectado_em DATETIME DEFAULT (datetime('now')),
    lido INTEGER DEFAULT 0
  );
`);

// ── Seed: criar admin padrão se não existir ───
const adminExiste = db.prepare("SELECT id FROM usuarios WHERE email = ?").get("admin@empresa.com");
if (!adminExiste) {
  const hash = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)").run("Admin Sistema", "admin@empresa.com", hash, "admin");
  console.log("✅ Usuário admin criado: admin@empresa.com / admin123");
  console.log("   ⚠️  TROQUE A SENHA após o primeiro login!");
}

module.exports = db;
