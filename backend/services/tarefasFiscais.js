// services/tarefasFiscais.js — etapa 18g.1: 🧾 tarefa fiscal automática por trecho do pedido (TSK-TR-…)
//
//   BID aprovado → PV → uma tarefa TR por trecho (origem 'fiscal', origem_ref '<pv>:<trecho>'), para o time fiscal + gestor.
//   Prazo: N dias úteis (seg a sex, sem feriados) antes da data prevista do trecho — tenants.fiscal_antecedencia_dias (padrão 2 = D-2).
//   Checklist na ordem do mundo real: NF-e → CT-e → averbação → MDF-e. Cada documento: nº/chave + PDF (dá o ✓) + XML (opcional,
//   preenche os campos e confere as chaves NF-e ↔ CT-e ↔ MDF-e). Averbação: nº (comprovante opcional).
//   A tarefa conclui sozinha com os 4 ✓; "Dispensar" (com justificativa) cancela — carga própria, transporte interno…
//   Espelho com a AT: o PDF anexado na tarefa aparece na AT do trecho (NF-e e CT-e em todas; MDF-e na AT da placa, ou na única AT);
//   o que for anexado direto na AT marca a tarefa. Sincronização preguiçosa (ao abrir o ✅ Plano e a Mesa) + após o aceite do BID.
//   18g.1.1: { entrada, pdf } completa com o PDF um documento salvo só com o XML.
//   18g.2: a AT espelha o MDF-e — "🚚 Programar AT deste MDF-e" cria a AT em rascunho (placa → equipamento, CPF/nome → motorista,
//          início da viagem do XML); cada MDF-e fica ligado à sua AT (at_id); divergência AT × MDF-e (placas/condutor) na ficha e na Mesa;
//          AT concluída com MDF-e → passo "Encerrar MDF-e" (a tarefa volta a "em andamento" até registrar o encerramento).
//   Sem a migration 066 (tarefas.checklist) nada é criado.
const crypto = require('crypto');

const ITENS = { nfe: 'NF-e', cte: 'CT-e', averbacao: 'Averbação', mdfe: 'MDF-e' };
const ORDEM = ['nfe', 'cte', 'averbacao', 'mdfe'];
const ANEXO_AT = { nfe: 'nfe', cte: 'cte', mdfe: 'mdfe' };
const BUCKET = 'documentos';
const LIMITE = 10 * 1024 * 1024;
const PDF = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

const q = async (p) => { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; };
const texto = (v, n) => String(v ?? '').trim().slice(0, n);
const jsonArr = (v) => (Array.isArray(v) ? v : []);
const dBR = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
const somaDia = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const hojeBR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const entrada = (quem, acao, x = {}) => ({ em: new Date().toISOString(), por: quem?.nome || null, acao, ...x });
const so44 = (v) => { const d = String(v || '').replace(/\D/g, ''); return d.length === 44 ? d : null; };

/** N dias úteis (seg a sex, sem feriados) antes de data */
function diasUteisAntes(data, n, feriados = new Set()) {
  let d = data; let k = 0;
  while (k < n) { d = somaDia(d, -1); const dow = new Date(`${d}T12:00:00Z`).getUTCDay(); if (dow !== 0 && dow !== 6 && !feriados.has(d)) k++; }
  return d;
}

// ─── leitura dos XMLs (sem dependência: tags simples) ───────────────────────
const tag = (x, t) => { const m = String(x).match(new RegExp(`<(?:\\w+:)?${t}(?:\\s[^>]*)?>([^<]*)</(?:\\w+:)?${t}>`)); return m ? m[1].trim() : null; };
const tags = (x, t) => [...String(x).matchAll(new RegExp(`<(?:\\w+:)?${t}(?:\\s[^>]*)?>([^<]*)</(?:\\w+:)?${t}>`, 'g'))].map((m) => m[1].trim());
const bloco = (x, t) => { const m = String(x).match(new RegExp(`<(?:\\w+:)?${t}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${t}>`)); return m ? m[1] : ''; };
const blocos = (x, t) => [...String(x).matchAll(new RegExp(`<(?:\\w+:)?${t}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${t}>`, 'g'))].map((m) => m[1]);
const idChave = (x, t) => { const m = String(x).match(new RegExp(`<(?:\\w+:)?${t}[^>]*\\sId="[A-Za-z]*(\\d{44})"`)); return m ? m[1] : null; };
const num = (v) => (v == null || v === '' ? null : Number(v));
const parte = (b) => (b ? { cnpj: tag(b, 'CNPJ') || tag(b, 'CPF'), nome: tag(b, 'xNome'), ie: tag(b, 'IE'), municipio: tag(b, 'xMun'), uf: tag(b, 'UF') } : null);

function lerXml(item, xml) {
  const x = String(xml || '');
  if (item === 'nfe') {
    const chave = idChave(x, 'infNFe'); if (!chave) return { erro: 'Não é o XML de uma NF-e (sem <infNFe Id="NFe…">)' };
    return { chave, numero: tag(bloco(x, 'ide'), 'nNF'), serie: tag(bloco(x, 'ide'), 'serie'), emissao: tag(x, 'dhEmi'), emitente: parte(bloco(x, 'emit')), destinatario: parte(bloco(x, 'dest')),
      valor: num(tag(bloco(x, 'ICMSTot'), 'vNF')), peso: num(tag(bloco(x, 'vol'), 'pesoB')), volumes: num(tag(bloco(x, 'vol'), 'qVol')) };
  }
  if (item === 'cte') {
    const chave = idChave(x, 'infCte'); if (!chave) return { erro: 'Não é o XML de um CT-e (sem <infCte Id="CTe…">)' };
    const nfes = blocos(x, 'infNFe').map((b) => tag(b, 'chave')).filter(Boolean);
    return { chave, numero: tag(bloco(x, 'ide'), 'nCT'), serie: tag(bloco(x, 'ide'), 'serie'), emissao: tag(x, 'dhEmi'), cfop: tag(bloco(x, 'ide'), 'CFOP'),
      origem: [tag(bloco(x, 'ide'), 'xMunIni'), tag(bloco(x, 'ide'), 'UFIni')].filter(Boolean).join('/'), destino: [tag(bloco(x, 'ide'), 'xMunFim'), tag(bloco(x, 'ide'), 'UFFim')].filter(Boolean).join('/'),
      remetente: parte(bloco(x, 'rem')), destinatario: parte(bloco(x, 'dest')), valor_frete: num(tag(bloco(x, 'vPrest'), 'vTPrest')), valor_carga: num(tag(bloco(x, 'infCarga'), 'vCarga')), nfes };
  }
  if (item === 'mdfe') {
    const chave = idChave(x, 'infMDFe'); if (!chave) return { erro: 'Não é o XML de um MDF-e (sem <infMDFe Id="MDFe…">)' };
    const tr = bloco(x, 'veicTracao');
    const seg = blocos(x, 'seg');
    return { chave, numero: tag(bloco(x, 'ide'), 'nMDF'), serie: tag(bloco(x, 'ide'), 'serie'), emissao: tag(x, 'dhEmi'), inicio_viagem: tag(x, 'dhIniViagem'),
      uf_inicio: tag(bloco(x, 'ide'), 'UFIni'), uf_fim: tag(bloco(x, 'ide'), 'UFFim'),
      carregamento: blocos(x, 'infMunCarrega').map((b) => tag(b, 'xMunCarrega')).filter(Boolean), descarga: blocos(x, 'infMunDescarga').map((b) => tag(b, 'xMunDescarga')).filter(Boolean),
      placa: tag(tr, 'placa'), reboques: blocos(x, 'veicReboque').map((b) => tag(b, 'placa')).filter(Boolean),
      condutores: blocos(tr, 'condutor').map((b) => ({ nome: tag(b, 'xNome'), cpf: tag(b, 'CPF') })),
      ctes: tags(x, 'chCTe'), seguradora: seg.map((b) => tag(b, 'xSeg')).filter(Boolean)[0] || null, apolice: seg.map((b) => tag(b, 'nApol')).filter(Boolean)[0] || null,
      averbacoes: seg.flatMap((b) => tags(b, 'nAver')), peso: num(tag(bloco(x, 'tot'), 'qCarga')), valor_carga: num(tag(bloco(x, 'tot'), 'vCarga')) };
  }
  return { erro: 'Tipo sem leitura de XML' };
}

// ─── checklist ───────────────────────────────────────────────────────────────
const novoChecklist = (extra = {}) => ({ versao: 1, nfe: { entradas: [] }, cte: { entradas: [] }, averbacao: { entradas: [] }, mdfe: { entradas: [] }, ...extra });
const okItem = (k, it) => jsonArr(it?.entradas).some((e) => (k === 'averbacao' ? !!e.numero : !!(e.pdf_anexo || e.at_anexo)));
function resumo(ck) {
  if (!ck) return null;
  const itens = Object.fromEntries(ORDEM.map((k) => [k, okItem(k, ck[k])]));
  const alertas = conferir(ck);
  const enc = ck.encerramento || {}; const pend = jsonArr(enc.pendentes).filter((a) => !jsonArr(enc.entradas).some((e) => String(e.at_id) === String(a.at_id))); // 18g.2
  return { feitos: ORDEM.filter((k) => itens[k]).length, total: ORDEM.length, itens, alertas, proximo: ORDEM.find((k) => !itens[k]) || (pend.length ? 'encerramento' : null), dispensa: ck.dispensa || null, data_trecho: ck.data_trecho || null,
    encerramento: { pendentes: pend, feitos: jsonArr(enc.entradas).length } };
}
/** confere as chaves entre os documentos (só quando há XML) */
function conferir(ck) {
  const al = []; const ds = (k) => jsonArr(ck?.[k]?.entradas).map((e) => e.dados).filter(Boolean);
  const chNfe = jsonArr(ck?.nfe?.entradas).map((e) => e.chave).filter(Boolean); const chCte = jsonArr(ck?.cte?.entradas).map((e) => e.chave).filter(Boolean);
  const nAver = jsonArr(ck?.averbacao?.entradas).map((e) => String(e.numero || '').trim()).filter(Boolean);
  for (const c of ds('cte')) if (chNfe.length && c.nfes?.length && !c.nfes.some((k) => chNfe.includes(k))) al.push(`CT-e ${c.numero || ''} não cita a NF-e anexada (chaves diferentes)`);
  for (const m of ds('mdfe')) {
    if (chCte.length && m.ctes?.length && !m.ctes.some((k) => chCte.includes(k))) al.push(`MDF-e ${m.numero || ''} não cita o CT-e anexado (chaves diferentes)`);
    if (nAver.length && m.averbacoes?.length && !m.averbacoes.some((a) => nAver.includes(String(a)))) al.push(`MDF-e ${m.numero || ''} traz a averbação ${m.averbacoes.join(', ')} — diferente da anotada (${nAver.join(', ')})`);
    if (m.ctes?.length === 0) al.push(`MDF-e ${m.numero || ''} sem CT-e vinculado no XML`);
  }
  return al;
}
const statusPelo = (t, ck) => {
  if (t.status === 'cancelada') return 'cancelada';
  const r = resumo(ck);
  if (r.feitos === r.total) return r.encerramento.pendentes.length ? 'em_andamento' : 'concluida'; // 18g.2: falta encerrar o MDF-e
  if (r.feitos > 0 || ORDEM.some((k) => jsonArr(ck[k]?.entradas).length)) return 'em_andamento';
  return t.status === 'concluida' ? 'em_andamento' : t.status || 'pendente';
};

async function config(supabase, tenantId) {
  const t = (await q(supabase.from('tenants').select('*').eq('id', tenantId)).catch(() => []))[0] || {};
  const fer = await q(supabase.from('tenant_feriados').select('*').eq('tenant_id', tenantId)).catch(() => []);
  const n = Number.isInteger(t.fiscal_antecedencia_dias) ? t.fiscal_antecedencia_dias : 2;
  return { antecedencia: n, migrou: Object.prototype.hasOwnProperty.call(t, 'fiscal_antecedencia_dias'), feriados: new Set(fer.map((f) => String(f.data || '').slice(0, 10)).filter(Boolean)) };
}
async function salvarConfig(supabase, tenantId, { antecedencia_dias } = {}) {
  const n = Number(antecedencia_dias);
  if (!Number.isInteger(n) || n < 0 || n > 30) return { status: 409, erro: 'Antecedência: de 0 a 30 dias úteis' };
  const { error } = await supabase.from('tenants').update({ fiscal_antecedencia_dias: n }).eq('id', tenantId);
  if (error) { if (/fiscal_antecedencia/.test(error.message)) return { status: 409, erro: 'Rode a migration 066 antes (documentos fiscais)' }; throw new Error(error.message); }
  const c = await config(supabase, tenantId);
  return { antecedencia_dias: c.antecedencia, migrou: c.migrou };
}

// ─── sincronização PV/trecho ↔ tarefa ↔ AT ───────────────────────────────────
const dataDoTrecho = (g, ats) => {
  const ds = (g.itens || []).filter((i) => i.status !== 'cancelado').map((i) => i.valores?.data_prevista).filter((d) => /^\d{4}-\d{2}-\d{2}/.test(String(d || ''))).map((d) => String(d).slice(0, 10)).sort();
  if (ds.length) return ds[0];
  const a = ats.map((e) => e.inicio_previsto).filter(Boolean).sort()[0];
  return a ? new Date(new Date(a).getTime() - 3 * 3600000).toISOString().slice(0, 10) : null;
};

async function sincronizar(supabase, tenantId, { pvId = null, quem = { nome: 'QuotaFlow' } } = {}) {
  const tarefas = await q(supabase.from('tarefas').select('*').eq('tenant_id', tenantId).eq('origem', 'fiscal')).catch(() => null);
  if (tarefas == null) return { ok: false };
  // migration 066? (sem a coluna checklist não cria nada)
  const t0 = (await q(supabase.from('tarefas').select('*').eq('tenant_id', tenantId)).catch(() => [])).find(Boolean);
  if (tarefas.length === 0 && t0 && !('checklist' in t0)) return { ok: false, sem_migration: true };
  let pvs = await q(supabase.from('pedidos_venda').select('*').eq('tenant_id', tenantId)).catch(() => []);
  if (pvId != null) pvs = pvs.filter((p) => String(p.id) === String(pvId));
  pvs = pvs.filter((p) => (p.tipo_execucao || 'transporte') === 'transporte');
  if (!pvs.length) return { ok: true, criadas: 0 };
  const cfg = await config(supabase, tenantId);
  const ex = (await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId)).catch(() => [])).filter((e) => !['cancelada', 'rascunho'].includes(e.status));
  const porRef = new Map(tarefas.map((t) => [String(t.origem_ref), t]));
  let criadas = 0; let alteradas = 0;
  for (const pv of pvs) {
    for (const g of pv.grupos || []) {
      const ref = `${pv.id}:${g.id}`; let t = porRef.get(ref);
      const ats = ex.filter((e) => String(e.pv_id) === String(pv.id) && String(e.grupo_id) === String(g.id));
      const ativos = (g.itens || []).filter((i) => i.status !== 'cancelado');
      const pendente = ativos.some((i) => i.status !== 'concluido');
      const data = dataDoTrecho(g, ats);
      const prazo = data ? diasUteisAntes(data, cfg.antecedencia, cfg.feriados) : null;
      const vinculos = [...(pv.bid_id ? [{ tipo: 'bid', id: String(pv.bid_id), numero: pv.bid_numero || null }] : []), { tipo: 'pv', id: String(pv.id), numero: pv.numero },
        { tipo: 'trecho', id: String(g.id), numero: `${pv.numero} · ${g.titulo || 'trecho'}` }, ...ats.map((e) => ({ tipo: 'at', id: String(e.id), numero: e.numero }))];
      if (!t) {
        if (pv.status === 'cancelado' || !ativos.length || !pendente || !['aberto', 'em_execucao'].includes(pv.status)) continue;
        const agora = new Date().toISOString();
        const linha = { tenant_id: tenantId, tipo: 'TR', origem: 'fiscal', origem_ref: ref, prioridade: 'alta', status: 'pendente', responsavel: 'Time fiscal', prazo, criado_em: agora,
          titulo: `🧾 Documentos fiscais — ${pv.numero} · ${g.titulo || 'trecho'}`.slice(0, 200),
          detalhe: [`Cliente: ${pv.cliente_nome || '—'}.`, (g.coleta || g.entrega) ? `Rota: ${g.coleta || '—'} → ${g.entrega || '—'}.` : null, data ? `Transporte previsto para ${dBR(data)}.` : 'Data do transporte a definir.',
            `Pegue a NF-e com o cliente e providencie CT-e, averbação e MDF-e até ${prazo ? dBR(prazo) : 'a data do transporte'} (D-${cfg.antecedencia} úteis).`].filter(Boolean).join(' '),
          anexos: [], vinculos, checklist: novoChecklist({ data_trecho: data }),
          historico: [entrada(quem, 'criada', { texto: `Gerada pelo pedido ${pv.numero}${pv.bid_numero ? ` (${pv.bid_numero})` : ''} — prazo D-${cfg.antecedencia} úteis` })] };
        const { data: d, error } = await supabase.from('tarefas').insert([linha]).select();
        if (error) { if (/checklist|tipo|vinculos|historico/.test(error.message)) return { ok: false, sem_migration: true }; throw new Error(error.message); }
        t = d[0]; porRef.set(ref, t); criadas++;
      } else if (!['concluida', 'cancelada'].includes(t.status) || t.status === 'concluida') {
        const upd = {}; const hist = []; const ck = t.checklist || novoChecklist();
        if (t.status !== 'cancelada' && (pv.status === 'cancelado' || !ativos.length)) {
          if (t.status !== 'concluida') { upd.status = 'cancelada'; hist.push(entrada(quem, 'status', { campo: 'situação', de: t.status, para: 'Cancelada', texto: pv.status === 'cancelado' ? `Pedido ${pv.numero} cancelado` : 'Trecho cancelado' })); }
        } else if (data && data !== ck.data_trecho && t.status !== 'concluida') {
          upd.prazo = prazo; upd.checklist = { ...ck, data_trecho: data };
          hist.push(entrada(quem, 'editada', { campo: 'prazo', de: dBR(t.prazo) || '—', para: dBR(prazo), texto: `A data do trecho mudou para ${dBR(data)}` }));
        }
        const vAntes = JSON.stringify(jsonArr(t.vinculos).map((v) => `${v.tipo}:${v.id}`).sort()); const vDepois = JSON.stringify(vinculos.map((v) => `${v.tipo}:${v.id}`).sort());
        if (vAntes !== vDepois) upd.vinculos = vinculos;
        if (Object.keys(upd).length) {
          if (hist.length) upd.historico = [...jsonArr(t.historico), ...hist];
          const { data: d } = await supabase.from('tarefas').update(upd).eq('id', t.id).eq('tenant_id', tenantId).select(); if (d?.[0]) t = d[0]; alteradas++;
        }
      }
      if (t && t.status !== 'cancelada' && ats.length) await espelhar(supabase, tenantId, t, ats, quem).catch((e) => console.error('❌ [fiscal] espelho', e.message));
    }
  }
  return { ok: true, criadas, alteradas };
}

/** tarefa ↔ ATs do trecho: PDFs da tarefa vão para a AT; anexos NF-e/CT-e/MDF-e feitos direto na AT marcam a tarefa */
async function espelhar(supabase, tenantId, t, ats, quem) {
  let ck = t.checklist || novoChecklist(); let mudouT = false; const anexosT = jsonArr(t.anexos);
  // 18g.2: cada MDF-e fica ligado a uma AT (pela placa, ou a única AT do trecho) — depois disso vale o vínculo, não a placa
  const norm = (p) => String(p || '').replace(/\W/g, '').toUpperCase();
  const mdfes = jsonArr(ck.mdfe?.entradas).map((e) => {
    if (e.at_id) { const a0 = ats.find((x) => String(x.id) === String(e.at_id)); if (a0 && a0.numero !== e.at_numero) { mudouT = true; return { ...e, at_numero: a0.numero }; } return e; } // rascunho virou AT-…
    if (e.origem === 'at') return e;
    const placas = e.dados ? [e.dados.placa, ...(e.dados.reboques || [])].filter(Boolean).map(norm) : [];
    const alvo = ats.find((at) => placas.length && (at.conjunto || []).some((c) => placas.includes(norm(c.tag || c.placa)))) || (ats.length === 1 ? ats[0] : null);
    if (!alvo) return e; mudouT = true; return { ...e, at_id: String(alvo.id), at_numero: alvo.numero };
  });
  if (mudouT) ck = { ...ck, mdfe: { entradas: mdfes } };
  // 18g.2: AT concluída que tem MDF-e → pendência de encerramento
  const comMdfe = new Set(mdfes.filter((e) => e.at_id).map((e) => String(e.at_id)));
  for (const at of ats) for (const a of jsonArr(at.anexos)) if (a.tipo === 'mdfe') comMdfe.add(String(at.id));
  const pend = ats.filter((at) => at.status === 'concluida' && comMdfe.has(String(at.id))).map((at) => ({ at_id: String(at.id), at_numero: at.numero, concluida_em: at.concluida_em || null }));
  const pendAntes = JSON.stringify(jsonArr(ck.encerramento?.pendentes).map((x) => x.at_id).sort());
  if (JSON.stringify(pend.map((x) => x.at_id).sort()) !== pendAntes) { ck = { ...ck, encerramento: { entradas: jsonArr(ck.encerramento?.entradas), pendentes: pend } }; mudouT = true; }
  // AT → tarefa
  for (const at of ats) for (const a of jsonArr(at.anexos)) {
    const k = Object.keys(ANEXO_AT).find((x) => ANEXO_AT[x] === a.tipo); if (!k || a.tarefa_anexo) continue;
    const ref = `${at.id}:${a.id}`; if (jsonArr(ck[k]?.entradas).some((e) => e.at_anexo === ref)) continue;
    ck = { ...ck, [k]: { entradas: [...jsonArr(ck[k]?.entradas), { id: crypto.randomBytes(5).toString('hex'), at_anexo: ref, at_id: String(at.id), at_numero: at.numero, nome: a.nome, por: a.por || null, em: a.em || new Date().toISOString(), origem: 'at' }] } };
    mudouT = true;
  }
  // tarefa → AT
  for (const at of ats) {
    if (at.status === 'concluida') continue;
    const alvo = (k, e) => k !== 'mdfe' || (e.at_id ? String(e.at_id) === String(at.id) : ats.length === 1);
    const quer = []; for (const k of Object.keys(ANEXO_AT)) for (const e of jsonArr(ck[k]?.entradas)) if (e.pdf_anexo && alvo(k, e)) { const an = anexosT.find((x) => x.id === e.pdf_anexo); if (an) quer.push({ k, e, an }); }
    const atuais = jsonArr(at.anexos);
    const daTarefa = atuais.filter((a) => a.tarefa_id && String(a.tarefa_id) === String(t.id));
    const manter = atuais.filter((a) => !(a.tarefa_id && String(a.tarefa_id) === String(t.id)) || quer.some((x) => x.an.id === a.tarefa_anexo));
    const novos = quer.filter((x) => !daTarefa.some((a) => a.tarefa_anexo === x.an.id)).map(({ k, e, an }) => ({ id: crypto.randomBytes(6).toString('hex'), tipo: ANEXO_AT[k], nome: an.nome, path: an.path, mime: an.mime, tamanho: an.tamanho,
      em: an.em, por: an.por, tarefa_id: String(t.id), tarefa_anexo: an.id, tarefa_numero: t.numero || null, numero_doc: e.numero || null }));
    if (novos.length || manter.length !== atuais.length) {
      await supabase.from('execucoes').update({ anexos: [...manter, ...novos], atualizado_em: new Date().toISOString() }).eq('id', at.id).eq('tenant_id', tenantId);
    }
  }
  if (mudouT) {
    const st = statusPelo(t, ck); const upd = { checklist: ck };
    const hist = [];
    if (JSON.stringify(t.checklist?.nfe) !== JSON.stringify(ck.nfe) || JSON.stringify(t.checklist?.cte) !== JSON.stringify(ck.cte)) hist.push(entrada(quem, 'anexo', { texto: '📎 documento anexado na AT entrou no checklist' }));
    const novasPend = pend.filter((x) => !jsonArr(t.checklist?.encerramento?.pendentes).some((y) => y.at_id === x.at_id));
    for (const x of novasPend) hist.push(entrada(quem, 'editada', { texto: `🏁 ${x.at_numero} concluída — falta encerrar o MDF-e` }));
    if (st !== t.status) { upd.status = st; hist.push(entrada(quem, 'status', { campo: 'situação', de: t.status === 'concluida' ? 'Concluída' : t.status === 'em_andamento' ? 'Em andamento' : 'Pendente', para: st === 'concluida' ? 'Concluída' : 'Em andamento', texto: st === 'concluida' ? 'Concluída sozinha: NF-e, CT-e, averbação e MDF-e ✓' : null })); }
    if (hist.length) upd.historico = [...jsonArr(t.historico), ...hist];
    await supabase.from('tarefas').update(upd).eq('id', t.id).eq('tenant_id', tenantId);
  }
}

// ─── documentos na tarefa ────────────────────────────────────────────────────
async function tarefaFiscal(supabase, tenantId, id) {
  if (!/^\d+$/.test(String(id))) return null;
  const t = (await q(supabase.from('tarefas').select('*').eq('tenant_id', tenantId).eq('id', id)))[0];
  return t && t.origem === 'fiscal' ? t : null;
}
async function subir(supabase, tenantId, t, arq, mimeOk) {
  if (!arq?.base64) return null;
  const ext = mimeOk[arq.mime]; if (!ext) return { erro: true };
  const buf = Buffer.from(String(arq.base64), 'base64'); if (!buf.length) return { erro: 'Arquivo vazio' }; if (buf.length > LIMITE) return { erro: 'Arquivo maior que 10 MB' };
  const aid = crypto.randomBytes(6).toString('hex'); const path = `tenant-${tenantId}/tarefas/${t.id}/${Date.now()}-${aid}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: arq.mime, upsert: false });
  if (error) throw new Error(`Falha ao subir o arquivo: ${error.message}`);
  return { id: aid, nome: texto(arq.nome, 160) || `documento.${ext}`, path, mime: arq.mime, tamanho: buf.length, em: new Date().toISOString(), _buf: buf };
}

async function registrarEncerramento(supabase, tenantId, quem, t, body) { // 18g.2: 🏁 encerramento do MDF-e da AT concluída
  const ck0 = t.checklist || novoChecklist(); const r0 = resumo(ck0);
  const p = r0.encerramento.pendentes.find((x) => String(x.at_id) === String(body.at_id)) || (r0.encerramento.pendentes.length === 1 && !body.at_id ? r0.encerramento.pendentes[0] : null);
  if (!p) return { status: 409, erro: 'Nenhuma AT concluída aguardando o encerramento do MDF-e' };
  const pdf = await subir(supabase, tenantId, t, body.pdf, PDF); if (pdf?.erro) return { status: 400, erro: pdf.erro === true ? 'Comprovante em PDF ou imagem' : pdf.erro };
  const ent = { id: crypto.randomBytes(5).toString('hex'), at_id: p.at_id, at_numero: p.at_numero, numero: texto(body.numero, 60) || null, pdf_anexo: pdf?.id || null, por: quem?.nome || null, em: new Date().toISOString() };
  const ck = { ...ck0, encerramento: { pendentes: jsonArr(ck0.encerramento?.pendentes), entradas: [...jsonArr(ck0.encerramento?.entradas), ent] } };
  const st = statusPelo(t, ck);
  const hist = [entrada(quem, 'anexo', { texto: `🏁 MDF-e da ${p.at_numero} encerrado${ent.numero ? ` (protocolo ${ent.numero})` : ''}` })];
  if (st !== t.status) hist.push(entrada(quem, 'status', { campo: 'situação', de: 'Em andamento', para: st === 'concluida' ? 'Concluída' : 'Em andamento', texto: st === 'concluida' ? 'Concluída: documentos ✓ e MDF-e encerrado' : null }));
  const an = pdf ? (({ _buf, ...x }) => ({ ...x, por: quem?.nome || null, fiscal: 'encerramento' }))(pdf) : null;
  const { error } = await supabase.from('tarefas').update({ checklist: ck, status: st, anexos: an ? [...jsonArr(t.anexos), an] : jsonArr(t.anexos), historico: [...jsonArr(t.historico), ...hist] }).eq('id', t.id).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  const fim = (await q(supabase.from('tarefas').select('*').eq('tenant_id', tenantId).eq('id', t.id)))[0];
  return { tarefa: fim, resumo: resumo(fim.checklist) };
}

async function registrarDoc(supabase, tenantId, quem, id, item, body = {}) {
  if (item === 'encerramento') { const t0 = await tarefaFiscal(supabase, tenantId, id); if (!t0) return { status: 404, erro: 'Tarefa fiscal não encontrada' }; return registrarEncerramento(supabase, tenantId, quem, t0, body); }
  if (!ITENS[item]) return { status: 400, erro: 'Documento inválido (nfe, cte, averbacao, mdfe)' };
  const t = await tarefaFiscal(supabase, tenantId, id); if (!t) return { status: 404, erro: 'Tarefa fiscal não encontrada' };
  if (!('checklist' in t)) return { status: 409, erro: 'Rode a migration 066 antes (documentos fiscais)' };
  if (['cancelada'].includes(t.status)) return { status: 409, erro: 'Tarefa dispensada/cancelada' };
  if (body.entrada) { // 18g.1.1: completar com o PDF uma entrada que foi salva só com o XML
    const ck0 = t.checklist || novoChecklist(); const e0 = jsonArr(ck0[item]?.entradas).find((x) => x.id === body.entrada);
    if (!e0) return { status: 404, erro: 'Documento não encontrado' };
    if (e0.pdf_anexo) return { status: 409, erro: 'Este documento já tem o PDF' };
    if (!body.pdf?.base64) return { status: 400, erro: 'Anexe o PDF' };
    const pdf0 = await subir(supabase, tenantId, t, body.pdf, PDF); if (pdf0?.erro) return { status: 400, erro: pdf0.erro === true ? 'PDF (ou imagem JPG/PNG do documento)' : pdf0.erro };
    const ck = { ...ck0, [item]: { entradas: jsonArr(ck0[item]?.entradas).map((x) => (x.id === e0.id ? { ...x, pdf_anexo: pdf0.id } : x)) } };
    const { _buf, ...an } = pdf0; const st = statusPelo(t, ck);
    const hist = [entrada(quem, 'anexo', { texto: `📄 PDF do ${ITENS[item]}${e0.numero ? ` nº ${e0.numero}` : ''}` })];
    if (st !== t.status) hist.push(entrada(quem, 'status', { campo: 'situação', de: t.status, para: st === 'concluida' ? 'Concluída' : 'Em andamento', texto: st === 'concluida' ? 'Concluída sozinha: NF-e, CT-e, averbação e MDF-e ✓' : null }));
    const { error } = await supabase.from('tarefas').update({ checklist: ck, anexos: [...jsonArr(t.anexos), { ...an, por: quem?.nome || null, fiscal: item }], status: st, historico: [...jsonArr(t.historico), ...hist] }).eq('id', t.id).eq('tenant_id', tenantId);
    if (error) throw new Error(error.message);
    const pvId0 = String(t.origem_ref || '').split(':')[0]; if (pvId0) await sincronizar(supabase, tenantId, { pvId: pvId0, quem }).catch(() => null);
    const fim = (await q(supabase.from('tarefas').select('*').eq('tenant_id', tenantId).eq('id', t.id)))[0];
    return { tarefa: fim, resumo: resumo(fim.checklist) };
  }
  let dados = null;
  if (body.xml?.base64) {
    if (item === 'averbacao') return { status: 400, erro: 'A averbação não tem leitura de XML — informe o número' };
    const xmlTxt = Buffer.from(String(body.xml.base64), 'base64').toString('utf8');
    dados = lerXml(item, xmlTxt); if (dados.erro) return { status: 400, erro: dados.erro };
  }
  const numero = texto(body.numero, 60) || dados?.numero || null;
  const chave = so44(body.chave) || dados?.chave || null;
  if (body.chave && !so44(body.chave)) return { status: 400, erro: 'Chave de acesso tem 44 dígitos' };
  if (item === 'averbacao' && !numero) return { status: 400, erro: 'Informe o número da averbação' };
  if (item !== 'averbacao' && !body.pdf?.base64 && !body.xml?.base64) return { status: 400, erro: `Anexe o PDF do ${ITENS[item]} (é o que conta para o ✓) — o XML é opcional` };
  const pdf = await subir(supabase, tenantId, t, body.pdf, PDF); if (pdf?.erro) return { status: 400, erro: pdf.erro === true ? 'PDF (ou imagem JPG/PNG do documento)' : pdf.erro };
  const xml = body.xml?.base64 ? await subir(supabase, tenantId, t, { ...body.xml, mime: 'application/xml' }, { 'application/xml': 'xml' }) : null; if (xml?.erro) return { status: 400, erro: xml.erro };
  const ck0 = t.checklist || novoChecklist();
  const dup = chave && jsonArr(ck0[item]?.entradas).some((e) => e.chave === chave);
  if (dup) return { status: 409, erro: `Esse ${ITENS[item]} (chave ${chave.slice(-8)}) já está na tarefa${jsonArr(ck0[item]?.entradas).find((e) => e.chave === chave && !e.pdf_anexo) ? ' — use "＋ anexar PDF" na linha dele' : ''}` };
  const ent = { id: crypto.randomBytes(5).toString('hex'), numero, chave, pdf_anexo: pdf?.id || null, xml_anexo: xml?.id || null, dados, por: quem?.nome || null, em: new Date().toISOString(), origem: 'tarefa' };
  const ck = { ...ck0, [item]: { entradas: [...jsonArr(ck0[item]?.entradas), ent] } };
  const novosAnexos = [pdf, xml].filter(Boolean).map(({ _buf, ...a }) => ({ ...a, por: quem?.nome || null, fiscal: item }));
  const st = statusPelo(t, ck);
  const hist = [entrada(quem, 'anexo', { texto: `🧾 ${ITENS[item]}${numero ? ` nº ${numero}` : ''}${pdf ? ' · PDF' : ''}${xml ? ' · XML lido' : ''}` })];
  if (st !== t.status) hist.push(entrada(quem, 'status', { campo: 'situação', de: t.status, para: st === 'concluida' ? 'Concluída' : 'Em andamento', texto: st === 'concluida' ? 'Concluída sozinha: NF-e, CT-e, averbação e MDF-e ✓' : null }));
  const { data, error } = await supabase.from('tarefas').update({ checklist: ck, anexos: [...jsonArr(t.anexos), ...novosAnexos], status: st, historico: [...jsonArr(t.historico), ...hist] }).eq('id', t.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  const pvId = String(t.origem_ref || '').split(':')[0]; if (pvId) await sincronizar(supabase, tenantId, { pvId, quem }).catch(() => null);
  const final = (await q(supabase.from('tarefas').select('*').eq('tenant_id', tenantId).eq('id', t.id)))[0] || data[0];
  return { tarefa: final, entrada: ent, resumo: resumo(final.checklist) };
}

async function removerDoc(supabase, tenantId, quem, id, item, entradaId) {
  if (!ITENS[item]) return { status: 400, erro: 'Documento inválido' };
  const t = await tarefaFiscal(supabase, tenantId, id); if (!t) return { status: 404, erro: 'Tarefa fiscal não encontrada' };
  const ck0 = t.checklist || novoChecklist(); const e = jsonArr(ck0[item]?.entradas).find((x) => x.id === entradaId);
  if (!e) return { status: 404, erro: 'Documento não encontrado' };
  if (e.origem === 'at') return { status: 409, erro: `Este documento foi anexado na ${e.at_numero} — remova por lá` };
  if (t.status === 'cancelada') return { status: 409, erro: 'Tarefa dispensada/cancelada' };
  const ck = { ...ck0, [item]: { entradas: jsonArr(ck0[item]?.entradas).filter((x) => x.id !== entradaId) } };
  const tira = [e.pdf_anexo, e.xml_anexo].filter(Boolean);
  for (const a of jsonArr(t.anexos).filter((x) => tira.includes(x.id))) { try { await supabase.storage.from(BUCKET).remove([a.path]); } catch { /* segue */ } }
  const st = statusPelo({ ...t, status: t.status === 'concluida' ? 'em_andamento' : t.status }, ck);
  const hist = [entrada(quem, 'anexo_removido', { texto: `🗑 ${ITENS[item]}${e.numero ? ` nº ${e.numero}` : ''}` })];
  if (st !== t.status) hist.push(entrada(quem, 'status', { campo: 'situação', de: t.status, para: st === 'concluida' ? 'Concluída' : st === 'em_andamento' ? 'Em andamento' : 'Pendente', texto: 'Documento removido' }));
  const { error } = await supabase.from('tarefas').update({ checklist: ck, anexos: jsonArr(t.anexos).filter((x) => !tira.includes(x.id)), status: st, historico: [...jsonArr(t.historico), ...hist] }).eq('id', t.id).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  const pvId = String(t.origem_ref || '').split(':')[0]; if (pvId) await sincronizar(supabase, tenantId, { pvId, quem }).catch(() => null);
  const final = (await q(supabase.from('tarefas').select('*').eq('tenant_id', tenantId).eq('id', t.id)))[0];
  return { tarefa: final, resumo: resumo(final.checklist) };
}

async function dispensar(supabase, tenantId, quem, id, { motivo } = {}) {
  const t = await tarefaFiscal(supabase, tenantId, id); if (!t) return { status: 404, erro: 'Tarefa fiscal não encontrada' };
  const m = texto(motivo, 400); if (m.length < 10) return { status: 400, erro: 'Explique a dispensa (mínimo 10 caracteres) — ex.: carga própria, transporte interno' };
  if (t.status === 'cancelada') return { status: 409, erro: 'Já está dispensada/cancelada' };
  const ck = { ...(t.checklist || novoChecklist()), dispensa: { motivo: m, por: quem?.nome || null, em: new Date().toISOString() } };
  const { data, error } = await supabase.from('tarefas').update({ status: 'cancelada', checklist: ck, historico: [...jsonArr(t.historico), entrada(quem, 'status', { campo: 'situação', de: t.status, para: 'Cancelada', texto: `Dispensa de documentos fiscais: ${m}` })] }).eq('id', t.id).eq('tenant_id', tenantId).select();
  if (error) throw new Error(error.message);
  return { tarefa: data[0] };
}

// ─── 18g.2: a AT espelha o MDF-e ────────────────────────────────────────────
const soAlnum = (v) => String(v || '').replace(/\W/g, '').toUpperCase();
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
/** casa o que está no MDF-e com o cadastro: placa → equipamento, CPF (ou nome) → colaborador */
async function casarMdfe(supabase, tenantId, dados) {
  const [eqs, cols] = await Promise.all([q(supabase.from('equipamentos').select('*').eq('tenant_id', tenantId)).catch(() => []), q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId)).catch(() => [])]);
  const achaEq = (pl) => eqs.find((e) => e.ativo !== false && pl && [e.tag, e.placa, e.nome].some((x) => soAlnum(x) === soAlnum(pl)));
  const cond = (dados?.condutores || [])[0] || null; const cpf = String(cond?.cpf || '').replace(/\D/g, '');
  const mot = cond ? cols.find((c) => c.situacao !== 'desligado' && ((cpf && String(c.cpf || '').replace(/\D/g, '') === cpf) || (cond.nome && semAcento(c.nome) === semAcento(cond.nome)))) : null;
  const cav = achaEq(dados?.placa); const impl = (dados?.reboques || []).map(achaEq);
  const avisos = [];
  if (dados?.placa && !cav) avisos.push(`Placa ${dados.placa} (cavalo) não está cadastrada em ⚙ Equipamentos`);
  (dados?.reboques || []).forEach((pl, i) => { if (!impl[i]) avisos.push(`Placa ${pl} (reboque) não está cadastrada em ⚙ Equipamentos`); });
  if (cond && !mot) avisos.push(`Condutor ${cond.nome || ''}${cpf ? ` (CPF ${cpf})` : ''} não está em 👷 Pessoas`);
  return { cavalo: cav || null, implementos: impl.filter(Boolean), motorista: mot || null, avisos };
}

async function programarDoMdfe(supabase, tenantId, quem, id, entradaId) {
  const t = await tarefaFiscal(supabase, tenantId, id); if (!t) return { status: 404, erro: 'Tarefa fiscal não encontrada' };
  const ck = t.checklist || novoChecklist(); const e = jsonArr(ck.mdfe?.entradas).find((x) => x.id === entradaId);
  if (!e) return { status: 404, erro: 'MDF-e não encontrado na tarefa' };
  if (!e.dados) return { status: 409, erro: 'Este MDF-e não tem o XML — anexe o XML para programar a AT a partir dele' };
  if (e.at_id) { const ja = (await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId).eq('id', e.at_id)).catch(() => []))[0];
    if (ja && ja.status !== 'cancelada') return { status: 409, erro: `Este MDF-e já está na ${ja.numero}`, existente: ja.id }; } // rascunho descartado / AT cancelada → pode programar de novo
  const [pvId, grupoId] = String(t.origem_ref || '').split(':');
  const m = await casarMdfe(supabase, tenantId, e.dados);
  const ini = e.dados.inicio_viagem ? new Date(e.dados.inicio_viagem).toISOString() : (ck.data_trecho ? `${ck.data_trecho}T11:00:00.000Z` : null);
  const E = require('./execucoes');
  const r = await E.criar(supabase, tenantId, { usuarioId: quem?.id || null, usuarioNome: quem?.nome || null, perfis: quem?.perfis || [] }, pvId, {
    grupo_id: grupoId, rascunho: true, motorista_id: m.motorista?.id ?? '', cavalo_id: m.cavalo?.id ?? '', implementos: m.implementos.map((x) => x.id), inicio: ini,
    observacoes: `Programada a partir do MDF-e nº ${e.numero || '—'} (${t.numero || 'tarefa fiscal'}).${m.avisos.length ? ` Conferir: ${m.avisos.join('; ')}.` : ''}` });
  if (r?.erro) return r;
  const at = r.execucao || r;
  const ck2 = { ...ck, mdfe: { entradas: jsonArr(ck.mdfe?.entradas).map((x) => (x.id === e.id ? { ...x, at_id: String(at.id), at_numero: at.numero } : x)) } };
  await supabase.from('tarefas').update({ checklist: ck2, historico: [...jsonArr(t.historico), entrada(quem, 'editada', { texto: `🚚 AT em rascunho criada a partir do MDF-e nº ${e.numero || '—'}${m.avisos.length ? ` — conferir: ${m.avisos.join('; ')}` : ''}` })] }).eq('id', t.id).eq('tenant_id', tenantId);
  return { execucao: at, avisos: m.avisos, casou: { motorista: m.motorista?.nome || null, cavalo: m.cavalo?.tag || null, implementos: m.implementos.map((x) => x.tag) } };
}

/** divergência AT × MDF-e ligado a ela: placas e condutor (a AT deve espelhar o MDF-e) → { at_id: [mensagens] } */
async function divergencias(supabase, tenantId, ats = null) {
  const ts = await q(supabase.from('tarefas').select('*').eq('tenant_id', tenantId).eq('origem', 'fiscal')).catch(() => []);
  const ligados = ts.filter((t) => t.status !== 'cancelada').flatMap((t) => jsonArr(t.checklist?.mdfe?.entradas).filter((e) => e.at_id && e.dados).map((e) => ({ ...e, tarefa: t.numero })));
  if (!ligados.length) return {};
  const lista = ats || await q(supabase.from('execucoes').select('*').eq('tenant_id', tenantId)).catch(() => []);
  const cols = await q(supabase.from('colaboradores').select('*').eq('tenant_id', tenantId)).catch(() => []);
  const out = {};
  for (const e of ligados) {
    const at = lista.find((x) => String(x.id) === String(e.at_id)); if (!at || ['cancelada'].includes(at.status)) continue;
    const msgs = [];
    const doMdfe = [e.dados.placa, ...(e.dados.reboques || [])].filter(Boolean).map(soAlnum).sort();
    const daAT = (at.conjunto || []).map((c) => soAlnum(c.tag || c.placa)).filter(Boolean).sort();
    if (doMdfe.length && JSON.stringify(doMdfe) !== JSON.stringify(daAT)) msgs.push(`Conjunto da AT (${daAT.join(' + ') || '—'}) ≠ MDF-e nº ${e.numero || ''} (${doMdfe.join(' + ')}) — emita um novo MDF-e ou ajuste a AT`);
    const cond = (e.dados.condutores || [])[0];
    if (cond) {
      const col = cols.find((c) => String(c.id) === String(at.motorista_id)); const cpfAT = String(col?.cpf || '').replace(/\D/g, ''); const cpfM = String(cond.cpf || '').replace(/\D/g, '');
      const igual = at.motorista_id && ((cpfAT && cpfM && cpfAT === cpfM) || (!cpfAT && semAcento(at.motorista_nome) === semAcento(cond.nome)));
      if (!igual) msgs.push(`Motorista da AT (${at.motorista_nome || 'a definir'}) ≠ condutor do MDF-e (${cond.nome || cpfM}) — registre a inclusão de condutor no MDF-e`);
    }
    if (msgs.length) out[String(at.id)] = [...(out[String(at.id)] || []), ...msgs];
  }
  return out;
}

/** selo da Mesa: resumo por trecho (pvId:grupoId → { numero, feitos, total, status, prazo, atrasada }) */
async function selos(supabase, tenantId) {
  const ts = await q(supabase.from('tarefas').select('*').eq('tenant_id', tenantId).eq('origem', 'fiscal')).catch(() => []);
  const hoje = hojeBR(); const m = {};
  for (const t of ts) { const r = resumo(t.checklist); if (!r) continue; m[String(t.origem_ref)] = { id: t.id, numero: t.numero || null, feitos: r.feitos, total: r.total, status: t.status, prazo: t.prazo ? String(t.prazo).slice(0, 10) : null, atrasada: !['concluida', 'cancelada'].includes(t.status) && !!t.prazo && String(t.prazo).slice(0, 10) < hoje, alertas: r.alertas.length, proximo: r.proximo ? (ITENS[r.proximo] || 'encerrar MDF-e') : null, encerrar: r.encerramento.pendentes.length }; }
  return m;
}

module.exports = { programarDoMdfe, divergencias, casarMdfe, ITENS, ORDEM, sincronizar, registrarDoc, removerDoc, dispensar, selos, resumo, conferir, lerXml, config, salvarConfig, diasUteisAntes, novoChecklist };
