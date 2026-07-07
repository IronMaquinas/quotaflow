const axios = require("axios");
const db = require("../db");

async function verificarCNPJsFornecedores() {
  const fornecedores = db.prepare("SELECT * FROM fornecedores WHERE ativo = 1 AND cnpj != ''").all();
  console.log(`[CNPJ Monitor] Verificando ${fornecedores.length} fornecedores...`);

  let atualizados = 0, alertas = 0;

  for (const f of fornecedores) {
    const cnpj = f.cnpj.replace(/\D/g, "");
    if (cnpj.length !== 14) continue;

    // Respeitar rate limit da BrasilAPI
    await new Promise(r => setTimeout(r, 1200));

    try {
      const { data } = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { timeout: 10000 });
      const situacaoNova = data.descricao_situacao_cadastral || "ATIVA";
      const situacaoAnterior = f.situacao_cnpj;

      // Detectar mudança de situação
      if (situacaoAnterior && situacaoAnterior !== situacaoNova) {
        db.prepare(`
          INSERT INTO cnpj_alertas (fornecedor_id, situacao_anterior, situacao_nova)
          VALUES (?, ?, ?)
        `).run(f.id, situacaoAnterior, situacaoNova);
        alertas++;
        console.log(`⚠️  ALERTA: ${f.nome} — ${situacaoAnterior} → ${situacaoNova}`);
      }

      // Atualizar dados
      db.prepare(`
        UPDATE fornecedores
        SET situacao_cnpj = ?, dados_cnpj = ?, ultima_consulta_cnpj = datetime('now')
        WHERE id = ?
      `).run(situacaoNova, JSON.stringify(data), f.id);

      atualizados++;
    } catch (e) {
      console.error(`[CNPJ Monitor] Erro em ${f.nome} (${cnpj}): ${e.message}`);
    }
  }

  console.log(`[CNPJ Monitor] Concluído: ${atualizados} atualizados, ${alertas} alertas gerados.`);
  return { atualizados, alertas };
}

module.exports = { verificarCNPJsFornecedores };
