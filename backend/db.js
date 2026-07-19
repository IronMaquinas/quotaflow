// ════════════════════════════════════════════════════════════════════════════════
// db.js: CLIENTE SUPABASE (REST) - SEM JOINS AMBÍGUOS
// ════════════════════════════════════════════════════════════════════════════════

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────────────────────────────────────────
// WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

class DB {
  static async select(table, where = {}, tenant_id = null) {
    let query = supabase.from(table).select("*");
    if (tenant_id) query = query.eq("tenant_id", tenant_id);
    for (const [key, value] of Object.entries(where)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }
    const { data, error } = await query;
    if (error) throw new Error(`SELECT ${table} failed: ${error.message}`);
    return data || [];
  }

  static async selectOne(table, where = {}, tenant_id = null) {
    const rows = await this.select(table, where, tenant_id);
    return rows.length > 0 ? rows[0] : null;
  }

  static async insert(table, values, tenant_id = null) {
    const data = { ...values };
    if (tenant_id && !data.tenant_id) data.tenant_id = tenant_id;
    const { data: result, error } = await supabase
      .from(table)
      .insert([data])
      .select();
    if (error) throw new Error(`INSERT ${table} failed: ${error.message}`);
    return result?.[0] || null;
  }

  static async update(table, id, values, tenant_id = null) {
    let query = supabase.from(table).update(values).eq("id", id);
    if (tenant_id) query = query.eq("tenant_id", tenant_id);
    const { data, error } = await query.select();
    if (error) throw new Error(`UPDATE ${table} failed: ${error.message}`);
    return data?.[0] || null;
  }

  static async delete(table, id, tenant_id = null) {
    let query = supabase.from(table).delete().eq("id", id);
    if (tenant_id) query = query.eq("tenant_id", tenant_id);
    const { error } = await query;
    if (error) throw new Error(`DELETE ${table} failed: ${error.message}`);
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RAW: suporte para as consultas usadas nas rotas (SEM JOINS)
  // ─────────────────────────────────────────────────────────────────────────
  static async raw(sql, params = []) {

    // 1. Listar chamados com equipamentos e usuários
    if (sql.includes("FROM chamados c") && sql.includes("LEFT JOIN equipamentos")) {
      const tenantId = params[0];

      // Buscar chamados
      const { data: chamados, error: e1 } = await supabase
        .from("chamados")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("aberto_em", { ascending: false });
      if (e1) throw new Error(`Raw chamados failed: ${e1.message}`);

      // Buscar equipamentos do tenant
      const { data: equipamentos, error: e2 } = await supabase
        .from("equipamentos")
        .select("id, tag, nome")
        .eq("tenant_id", tenantId);
      if (e2) throw new Error(`Raw chamados equipamentos failed: ${e2.message}`);

      // Buscar usuários do tenant
      const { data: usuarios, error: e3 } = await supabase
        .from("usuarios")
        .select("id, nome")
        .eq("tenant_id", tenantId);
      if (e3) throw new Error(`Raw chamados usuarios failed: ${e3.message}`);

      // Montar resultado
      const resultado = chamados.map(ch => {
        const eq = equipamentos.find(e => e.id === ch.equipamento_id);
        const usuario = usuarios.find(u => u.id === ch.tecnico_id);
        return {
          ...ch,
          equipamento_tag: eq?.tag || null,
          equipamento_nome: eq?.nome || null,
          tecnico_nome_usuario: usuario?.nome || null,
        };
      });

      return resultado;
    }

    // 2. Listar cotações com chamados
    if (sql.includes("FROM cotacoes c") && sql.includes("JOIN chamados ch")) {
      const tenantId = params[0];

      // Buscar cotações
      const { data: cotacoes, error: e1 } = await supabase
        .from("cotacoes")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("enviado_em", { ascending: false });
      if (e1) throw new Error(`Raw cotacoes failed: ${e1.message}`);

      // Buscar chamados relacionados
      const chamadoIds = [...new Set(cotacoes.map(c => c.chamado_id))];
      const { data: chamados, error: e2 } = await supabase
        .from("chamados")
        .select("id, numero, peca, categoria_item")
        .in("id", chamadoIds.length > 0 ? chamadoIds : [0]);
      if (e2) throw new Error(`Raw cotacoes chamados failed: ${e2.message}`);

      // Juntar
      const resultado = cotacoes.map(cot => {
        const ch = chamados.find(c => c.id === cot.chamado_id);
        return {
          ...cot,
          chamado_numero: ch?.numero || null,
          peca: ch?.peca || null,
          categoria_item: ch?.categoria_item || null,
        };
      });

      return resultado;
    }

    // 3. Fornecedores de uma cotação
    if (sql.includes("FROM cotacao_fornecedores")) {
      const cotacaoId = params[0];
      const tenantId = params[1];

      const { data, error } = await supabase
        .from("cotacao_fornecedores")
        .select("id, fornecedor_nome, fornecedor_email, status, valor, prazo, frete, valor_frete, obs, data_resposta")
        .eq("cotacao_id", cotacaoId)
        .eq("tenant_id", tenantId)
        .order("data_resposta", { ascending: false, nullsFirst: false });
      if (error) throw new Error(`Raw cotacao_fornecedores failed: ${error.message}`);
      return data;
    }

    // 4. Fornecedores de um item de catálogo
    if (sql.includes("FROM fornecedor_itens fi") && sql.includes("JOIN fornecedores f")) {

      const itemId = params[0];
      const { data: fornecedorItens, error: e1 } = await supabase
        .from("fornecedor_itens")
        .select("id, fornecedor_id, preco_unitario, estoque_status, tempo_entrega_dias")
        .eq("item_catalogo_id", itemId)
        .eq("ativo", true);
      if (e1) throw new Error(`Raw fornecedor_itens failed: ${e1.message}`);
      
      if (fornecedorItens.length === 0) return [];
      
      const fornecedorIds = fornecedorItens.map(f => f.fornecedor_id);
      const { data: fornecedores, error: e2 } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .in("id", fornecedorIds);
      if (e2) throw new Error(`Raw fornecedores failed: ${e2.message}`);
      
      // Juntar
      return fornecedorItens.map(fi => {
        const f = fornecedores.find(forn => forn.id === fi.fornecedor_id);
        return {
          id: fi.id,
          nome: f?.nome || null,
          preco_unitario: fi.preco_unitario,
          estoque_status: fi.estoque_status,
          tempo_entrega_dias: fi.tempo_entrega_dias
        };
      });
    }

    // 4. Listar usuários
    if (sql.includes("FROM usuarios")) {
      const tenantId = params[0];

      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nome, email, perfil, ativo, criado_em")
        .eq("tenant_id", tenantId)
        .order("criado_em", { ascending: false });
      if (error) throw new Error(`Raw usuarios failed: ${error.message}`);
      return data;
    }

    // Fallback genérico (tenta extrair tabela e tenant_id)
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (tableMatch) {
      const table = tableMatch[1];
      let query = supabase.from(table).select("*");
      const tenantMatch = sql.match(/tenant_id\s*=\s*\$(\d+)/);
      if (tenantMatch) {
        const idx = parseInt(tenantMatch[1]) - 1;
        if (params[idx] !== undefined) {
          query = query.eq("tenant_id", params[idx]);
        }
      }
      const { data, error } = await query;
      if (error) throw new Error(`Raw fallback failed: ${error.message}`);
      return data;
    }

    throw new Error(`Raw query não suportada: ${sql}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

async function initializeDB() {
  try {
    console.log("🔌 Conectando ao Supabase via REST...");
    const { data, error } = await supabase.from("tenants").select("count");
    if (error) throw error;
    console.log("✅ Conectado!");
    const tenants = await DB.select("tenants");
    console.log(`Tenants encontrados: ${tenants.length}`);
  } catch (err) {
    console.error("❌ Erro ao inicializar DB:", err.message);
    process.exit(1);
  }
}

module.exports = { supabase, DB, initializeDB };