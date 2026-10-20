// backend/services/historicoFuncoes.js — etapa 12d.3
//
// Histórico de funções do colaborador (colaborador_funcoes): um período por função, com início, fim e motivo.
// Gravado sozinho quando a função muda no cadastro ("a partir de quando?" + motivo).
// Ex.: Motorista (2022–2024) → Motorista MOPP (2024–2026) → Encarregado (2026–).
// As entregas de EPI já guardam a função NA DATA (epi_entregas.funcao_nome); o histórico conta a trajetória.
// Sem a migration 029, tudo aqui vira "não faz nada" (o cadastro continua funcionando).
//
// Regras do backend: sem DB.raw; ids com String(); filtros sem null.

const MOTIVOS = ['admissao', 'promocao', 'transferencia', 'readaptacao', 'correcao', 'outro'];
const DATA = /^\d{4}-\d{2}-\d{2}$/;

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const hojeBR = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600000).toISOString().slice(0, 10);
const diaAnterior = (iso) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
const semTabela = (e) => /colaborador_funcoes/.test(String(e?.message)) && /does not exist|não existe|relation|schema cache/.test(String(e?.message));

async function listar(supabase, tenantId, colaboradorId) {
  try {
    const l = await q(supabase.from('colaborador_funcoes').select('*').eq('tenant_id', tenantId).eq('colaborador_id', colaboradorId));
    return l.sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)) || String(a.criado_em).localeCompare(String(b.criado_em)));
  } catch (e) { if (semTabela(e)) return []; throw e; }
}

/** Valida "a partir de" e motivo vindos do cadastro */
function validarMudanca(body) {
  const desde = body?.funcao_desde ? String(body.funcao_desde) : null;
  if (desde && !DATA.test(desde)) return { erro: 'Data da mudança de função inválida' };
  const motivo = MOTIVOS.includes(body?.funcao_motivo) ? body.funcao_motivo : null;
  return { desde, motivo, obs: body?.funcao_obs ? String(body.funcao_obs).slice(0, 500) : null };
}

/**
 * Registra a mudança de função. antes = colaborador antes do update; novo = { funcao_id, funcao_nome }.
 * Fecha o período atual no dia anterior a "desde" e abre o novo. novo.funcao_id null = só fecha.
 * Devolve { ok } ou { status, erro }. Sem a 029: { ok, sem_historico: true }.
 */
async function registrarMudanca(supabase, tenantId, antes, novo, { desde, motivo, obs, por, agora } = {}) {
  const de = desde || hojeBR(agora);
  try {
    const hist = await listar(supabase, tenantId, antes.id);
    const atual = hist.find((h) => !h.fim);
    if (atual && String(atual.funcao_id || '') === String(novo.funcao_id || '') && atual.funcao_nome === novo.funcao_nome) return { ok: true, igual: true };
    // correção de cadastro: corrige o período atual (sem abrir outro)
    if (atual && motivo === 'correcao' && (novo.funcao_id || novo.funcao_nome)) {
      const r = await supabase.from('colaborador_funcoes').update({ funcao_id: novo.funcao_id || null, funcao_nome: novo.funcao_nome || atual.funcao_nome, obs: obs || atual.obs || 'Correção de cadastro' }).eq('id', atual.id).eq('tenant_id', tenantId);
      if (r.error) throw new Error(r.error.message);
      return { ok: true, corrigido: true };
    }
    if (atual && de < String(atual.inicio).slice(0, 10)) {
      return { status: 400, erro: `A nova função não pode começar antes de ${String(atual.inicio).slice(0, 10).split('-').reverse().join('/')} (início da função atual)` };
    }
    if (atual) {
      // mesma data de início: troca no mesmo dia → o período anterior vira de 1 dia só se possível; senão é correção
      const fim = de > String(atual.inicio).slice(0, 10) ? diaAnterior(de) : String(atual.inicio).slice(0, 10);
      const r = await supabase.from('colaborador_funcoes').update({ fim }).eq('id', atual.id).eq('tenant_id', tenantId);
      if (r.error) throw new Error(r.error.message);
    }
    if (novo.funcao_id || novo.funcao_nome) {
      const mot = motivo || (atual ? 'promocao' : 'admissao');
      const { error } = await supabase.from('colaborador_funcoes').insert([{
        tenant_id: tenantId, colaborador_id: antes.id, funcao_id: novo.funcao_id || null, funcao_nome: novo.funcao_nome || 'Função',
        inicio: atual ? de : (antes.admissao && !desde ? String(antes.admissao).slice(0, 10) : de), motivo: mot, obs: obs || null, criado_por: por ? String(por) : null,
      }]);
      if (error) {
        if (atual) await supabase.from('colaborador_funcoes').update({ fim: null }).eq('id', atual.id).eq('tenant_id', tenantId); // desfaz
        throw new Error(error.message);
      }
    }
    return { ok: true };
  } catch (e) {
    if (semTabela(e)) return { ok: true, sem_historico: true };
    throw e;
  }
}

module.exports = { MOTIVOS, listar, validarMudanca, registrarMudanca };
