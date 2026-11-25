// services/relatorioInspecao.js — etapa E5: 📄 dados do RELATÓRIO AUTOMÁTICO (inspeção e reparos) de um projeto da Foto com cartão
//   Junta: projeto · defeitos com classificação/justificativa/histórico e fotos · reparos com etapas (valores, materiais, ambiente,
//   comentário, conclusão, liberação) e fotos de cada etapa. A tela monta o PDF A4 (impressão do navegador) com o logo da empresa.
//   Filtro opcional: um aerogerador (referencia) ou um reparo só (reparo_id).
async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const norm = (v) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, ' ');

async function montar(sb, tenantId, f = {}) {
  const DF = require('./defeitosFoto'); const RP = require('./reparos'); const D = require('./documentos');
  let projetoId = f.projeto_id; let soReparo = null;
  if (f.reparo_id) { const r = (await q(sb.from('reparos').select('*').eq('tenant_id', tenantId).eq('id', f.reparo_id)))[0]; if (!r) return { status: 404, erro: 'Reparo não encontrado.' }; soReparo = r; projetoId = r.projeto_id; }
  const projeto = (await q(sb.from('projetos_foto').select('*').eq('tenant_id', tenantId).eq('id', projetoId)))[0]; if (!projeto) return { status: 404, erro: 'Projeto não encontrado.' };
  // E5.1: por padrão TODAS as fotos que o inspetor coletou (cada defeito tem a sua história); "resumido" = 1 foto por defeito
  const lim = f.fotos === 'resumo' ? 1 : f.fotos === 'nenhuma' ? 0 : Infinity;
  let defeitos = (await DF.listar(sb, tenantId, { projeto_id: projeto.id })).defeitos;
  if (f.referencia) defeitos = defeitos.filter((d) => norm(d.referencia) === norm(f.referencia));
  if (soReparo) defeitos = defeitos.filter((d) => String(d.id) === String(soReparo.defeito_id));
  if (f.sem_reparo === '0') defeitos = defeitos.filter((d) => d.classificacao !== 'sem_reparo');
  const fotos = (await q(sb.from('fotos_cartao').select('*').eq('tenant_id', tenantId))).filter((x) => !x.excluida_em && String(x.projeto_id) === String(projeto.id));
  const link = async (x) => { try { return await D.linkArquivo(sb, x.arquivo); } catch { return null; } };
  const enxuta = async (x) => ({ id: x.id, url: await link(x), tirada_em: x.tirada_em, tecnico: x.tecnico, gps: x.gps, hash: x.hash, etapa_id: x.etapa_id || null });
  for (const d of defeitos) { const fd = fotos.filter((x) => String(x.defeito_id) === String(d.id) && !x.reparo_id).sort((a, b) => String(a.tirada_em).localeCompare(String(b.tirada_em))); d.fotos_total = fd.length; d.fotos_lista = []; for (const x of fd.slice(0, lim)) d.fotos_lista.push(await enxuta(x)); delete d.capa_url; }
  const ids = new Set(defeitos.map((d) => String(d.id)));
  const rs = (await q(sb.from('reparos').select('*').eq('tenant_id', tenantId))).filter((r) => r.status !== 'cancelado' && ids.has(String(r.defeito_id)) && (!soReparo || String(r.id) === String(soReparo.id)));
  const reparos = [];
  for (const r of rs.sort((a, b) => String(a.numero).localeCompare(String(b.numero)))) {
    const det = await RP.detalhe(sb, tenantId, r.id); if (det.erro) continue;
    reparos.push({ id: r.id, numero: r.numero, status: r.status, modelo_nome: r.modelo_nome, responsavel: r.responsavel, prazo: r.prazo, criado_em: r.criado_em, concluido_em: r.concluido_em, concluido_por: r.concluido_por, defeito_id: r.defeito_id, etapas: r.etapas, execucao: r.execucao || {},
      fotos: det.fotos.map((x) => ({ id: x.id, url: x.url, tirada_em: x.tirada_em, tecnico: x.tecnico, gps: x.gps, hash: x.hash, etapa_id: x.etapa_id })) });
  }
  const cont = { total: defeitos.length, pendente: 0, sem_reparo: 0, reparar: 0, investigar: 0 }; for (const d of defeitos) cont[d.classificacao || 'pendente']++;
  const aeros = [...new Set(defeitos.map((d) => d.referencia).filter(Boolean))];
  const tecnicos = [...new Set([...fotos.map((x) => x.tecnico), ...reparos.flatMap((r) => Object.values(r.execucao).map((e) => e.concluida_por))].filter(Boolean))];
  const datas = fotos.map((x) => String(x.tirada_em)).sort();
  return { projeto, filtro: { referencia: f.referencia || null, reparo: soReparo?.numero || null }, resumo: { ...cont, aerogeradores: aeros, fotos: fotos.length, tecnicos, de: datas[0] || null, ate: datas[datas.length - 1] || null, reparos: reparos.length, reparos_concluidos: reparos.filter((r) => r.status === 'concluido').length },
    defeitos, reparos, CLASSES: DF.CLASSES, gerado_em: new Date().toISOString(), vocabulario: (await require('./inspecaoConfig').ler(sb, tenantId)).vocabulario };
}
module.exports = { montar };
