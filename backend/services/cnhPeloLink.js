// backend/services/cnhPeloLink.js — etapa 18zw: 🪪 o MOTORISTA envia a própria CNH pelo 📲 link da viagem (sem login)
//   Pensado para o AGREGADO: a IA lê a CNH (mesmas travas de custo da 18zo — cache por imagem, 2 falhas por imagem, teto
//   diário da empresa) e o cadastro dele nasce ou se atualiza: dados da CNH, foto e o documento CNH com o arquivo.
//   Regras de segurança (link público):
//     • AT com motorista definido → a CNH tem de ser DESSE motorista (CPF igual, quando o cadastro já tem CPF) — senão 409;
//     • AT sem motorista → procura pelo CPF; não achou → cria o colaborador como AGREGADO e liga na AT;
//     • o que já está preenchido no cadastro NÃO é sobrescrito (só completa); os dados da CNH (registro/validade…) atualizam;
//     • o gestor recebe 🔔 "motorista enviou a CNH" para conferir.
const D = require('./documentos');
const L = require('./leituraCnh');

async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data || []; }
const so = (v) => String(v ?? '').replace(/\D/g, '');

async function enviarCnh(supabase, ex, body = {}) {
  const tenant = (await q(supabase.from('tenants').select('*').eq('id', ex.tenant_id)))[0] || { id: ex.tenant_id };
  if (ex.status === 'cancelada' || ex.status === 'concluida') return { status: 409, erro: 'Esta viagem já foi encerrada — envie a CNH pelo link de uma viagem ativa.' };
  const r = await L.ler(supabase, tenant, { base64: body.base64, mime: body.mime });
  if (r.erro) return { status: r.status || 400, erro: r.erro };
  const c = r.cnh; if (!c?.eh_cnh) return { status: 400, erro: c?.aviso || 'A imagem não parece ser uma CNH.' };
  if (!c.cpf || !c.nome) return { status: 422, erro: 'Não consegui ler o nome e o CPF com segurança. Tente uma foto mais nítida (ou o PDF da CNH digital).' };

  const colabs = await q(supabase.from('colaboradores').select('*').eq('tenant_id', ex.tenant_id));
  let colab = ex.motorista_id ? colabs.find((x) => String(x.id) === String(ex.motorista_id)) : null;
  if (colab && colab.cpf && so(colab.cpf) !== c.cpf) return { status: 409, erro: `Esta CNH é de outra pessoa (CPF diferente do motorista desta viagem, ${colab.nome}). Se o motorista mudou, avise a programação.` };
  if (!colab) colab = colabs.find((x) => so(x.cpf) === c.cpf) || null;
  let criado = false;
  const dadosCnh = { cnh_categoria: c.categoria, cnh_registro: c.registro, cnh_validade: c.validade, cnh_emissao: c.emissao, cnh_primeira_habilitacao: c.primeira_habilitacao, cnh_observacoes: c.observacoes_cnh, cnh_local_emissao: c.local_emissao };
  const limpa = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ''));
  if (!colab) {
    const novo = limpa({ tenant_id: ex.tenant_id, nome: c.nome, cpf: c.cpf, data_nascimento: c.data_nascimento, rg: c.rg, situacao: 'ativo', vinculo: 'agregado', funcao: 'Motorista', ...dadosCnh });
    let ins = await supabase.from('colaboradores').insert([novo]).select();
    if (ins.error && /column/.test(ins.error.message)) ins = await supabase.from('colaboradores').insert([limpa({ tenant_id: ex.tenant_id, nome: c.nome, cpf: c.cpf, situacao: 'ativo', funcao: 'Motorista', cnh_categoria: c.categoria })]).select();
    if (ins.error) throw new Error(ins.error.message);
    colab = ins.data[0]; criado = true;
  } else {
    const completa = limpa({ nome: colab.nome ? undefined : c.nome, cpf: colab.cpf ? undefined : c.cpf, data_nascimento: colab.data_nascimento ? undefined : c.data_nascimento, rg: colab.rg ? undefined : c.rg, ...dadosCnh });
    if (Object.keys(completa).length) { const u = await supabase.from('colaboradores').update(completa).eq('id', colab.id).eq('tenant_id', ex.tenant_id); if (u.error && !/column/.test(u.error.message)) throw new Error(u.error.message); }
  }
  if (!ex.motorista_id) await supabase.from('execucoes').update({ motorista_id: colab.id, motorista_nome: colab.nome || c.nome }).eq('id', ex.id).eq('tenant_id', ex.tenant_id);

  // 📷 foto (recortada no celular) — só se o cadastro ainda não tem
  if (body.foto?.base64 && !colab.foto_path && ['image/jpeg', 'image/png', 'image/webp'].includes(body.foto.mime) && String(body.foto.base64).length < 2_000_000) {
    try { const path = `tenant-${ex.tenant_id}/colab-${colab.id}/foto-${Date.now()}.jpg`;
      const up = await supabase.storage.from(D.BUCKET).upload(path, Buffer.from(String(body.foto.base64), 'base64'), { contentType: body.foto.mime, upsert: false });
      if (!up.error) await supabase.from('colaboradores').update({ foto_path: path }).eq('id', colab.id).eq('tenant_id', ex.tenant_id); } catch { /* sem foto: segue */ }
  }
  // 📄 documento CNH (não duplica o mesmo nº + validade)
  let docCriado = false;
  try {
    const tipo = (await D.tiposDoTenant(supabase, ex.tenant_id)).find((t) => t.alvo === 'colaborador' && t.codigo === 'cnh');
    const ja = (await q(supabase.from('documentos').select('*').eq('tenant_id', ex.tenant_id).eq('colaborador_id', colab.id)))
      .find((d) => !d.substituido_por && (tipo ? String(d.tipo_id) === String(tipo.id) : /cnh/i.test(d.tipo_nome || '')) && String(d.numero || '') === String(c.registro || '') && String(d.vence_em || '').slice(0, 10) === String(c.validade || ''));
    if (!ja && c.validade) {
      const [doc] = await q(supabase.from('documentos').insert([{ tenant_id: ex.tenant_id, alvo_tipo: 'colaborador', colaborador_id: colab.id, tipo_id: tipo?.id || null, tipo_nome: tipo?.nome || 'CNH',
        numero: c.registro || null, emitido_em: c.emissao || null, vence_em: c.validade, obs: `Enviada pelo motorista no 📲 link da viagem ${ex.numero || ''} (leitura automática) — conferir.` }]).select());
      const a = body.arquivo; if (a?.base64 && !D.validarArquivo({ base64: a.base64, mime: a.mime, nome: a.nome })) {
        const path = await D.subirArquivo(supabase, { tenantId: ex.tenant_id, documentoId: doc.id, base64: a.base64, mime: a.mime });
        await supabase.from('documentos').update({ arquivo_path: path, arquivo_nome: String(a.nome || 'CNH').slice(0, 200), arquivo_mime: a.mime }).eq('id', doc.id).eq('tenant_id', ex.tenant_id);
      }
      docCriado = true;
    }
  } catch (e) { console.error('⚠️ [cnh link] documento:', e.message); }
  // 🔔 gestor confere
  try { await require('./notificacoes').avisarPerfis(supabase, ex.tenant_id, ['gestor', 'operacao'], { tipo: 'cnh_link', titulo: `🪪 ${c.nome} enviou a CNH pelo link (${ex.numero || 'AT'})`,
    texto: `${criado ? 'Cadastro criado como 🚚 agregado. ' : ''}Validade ${String(c.validade || '—').split('-').reverse().join('/')} · categoria ${c.categoria || '—'}${(c.avisos || []).length ? ` · ⚠ ${c.avisos.join(' ')}` : ''} — confira em 👷 Pessoas.`, link: { tela: 'pessoas' } }); } catch { /* segue */ }
  return { ok: true, criado, documento: docCriado, reaproveitada: !!r.reaproveitada, foto_box: !colab.foto_path && c.foto ? c.foto : null,
    resumo: { nome: c.nome, categoria: c.categoria, validade: c.validade, vencida: (c.avisos || []).some((a) => /VENCIDA/.test(a)), confianca: c.confianca } };
}

/** 📷 2º passo: o celular recorta o rosto (com o retângulo devolvido pela leitura) e manda — só se o motorista desta AT ainda não tem foto */
async function enviarFoto(supabase, ex, body = {}) {
  if (!ex.motorista_id) return { status: 409, erro: 'Envie a CNH primeiro.' };
  const colab = (await q(supabase.from('colaboradores').select('*').eq('tenant_id', ex.tenant_id).eq('id', ex.motorista_id)))[0];
  if (!colab) return { status: 404, erro: 'Motorista não encontrado' };
  if (colab.foto_path) return { ok: true, ja_tinha: true };
  if (!body.base64 || !['image/jpeg', 'image/png', 'image/webp'].includes(body.mime) || String(body.base64).length > 2_000_000) return { status: 400, erro: 'Foto inválida' };
  const path = `tenant-${ex.tenant_id}/colab-${colab.id}/foto-${Date.now()}.jpg`;
  const up = await supabase.storage.from(D.BUCKET).upload(path, Buffer.from(String(body.base64), 'base64'), { contentType: body.mime, upsert: false });
  if (up.error) throw new Error(up.error.message);
  await supabase.from('colaboradores').update({ foto_path: path }).eq('id', colab.id).eq('tenant_id', ex.tenant_id);
  return { ok: true };
}

module.exports = { enviarCnh, enviarFoto };
