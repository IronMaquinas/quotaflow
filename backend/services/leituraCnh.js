// backend/services/leituraCnh.js — etapa 18zl: 🪪 LEITURA DA CNH PELA IA (pedido do Marcony, 15/11)
//   A CNH digital (PDF do gov.br) não tem texto legível por código — a IA "olha" a imagem como uma pessoa (OCR + entendimento).
//   O navegador transforma o PDF em imagem; aqui a IA devolve os campos + onde está a foto (para recortar no navegador).
//   Tudo é CONFERIDO pelo sistema (CPF com dígito, datas, categoria) e o usuário revisa antes de salvar.
//   IA desligada → 409 com o motivo (o cadastro manual continua igual).
const IA = require('./ia');

const SISTEMA = `Você lê Carteiras Nacionais de Habilitação (CNH) brasileiras, física ou digital, em imagem.
Responda SOMENTE um objeto JSON, sem texto antes ou depois, neste formato:
{"eh_cnh":true,"nome":"","cpf":"","data_nascimento":"AAAA-MM-DD","rg":"","registro":"","categoria":"","validade":"AAAA-MM-DD","primeira_habilitacao":"AAAA-MM-DD","emissao":"AAAA-MM-DD","local_emissao":"","observacoes_cnh":"","foto":{"x":0,"y":0,"largura":0,"altura":0},"confianca":"alta","aviso":""}
Regras: campos que não conseguir ler = null (nunca invente). "registro" é o Nº REGISTRO (11 dígitos). "categoria" só as letras (ex.: "AE").
"observacoes_cnh" = campo OBSERVAÇÕES (ex.: EAR). "foto" = retângulo do ROSTO do titular em FRAÇÕES da imagem (0 a 1, x/y do canto superior esquerdo).
Se não for uma CNH, "eh_cnh": false e explique em "aviso". "confianca": alta | media | baixa (imagem ruim, cortada ou borrada = baixa).`;

const CATS = ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'];
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const so = (v) => String(v ?? '').replace(/\D/g, '');
function cpfOk(c) {
  c = so(c); if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}
const data = (v) => { const s = String(v ?? '').trim(); if (DATA.test(s)) return s; const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const txt = (v, n = 120) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, n));
const fr = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null; };

/** confere e normaliza a resposta da IA */
function normalizar(j) {
  const avisos = [];
  if (!j || j.eh_cnh === false) return { eh_cnh: false, aviso: txt(j?.aviso, 300) || 'A imagem não parece ser uma CNH.' };
  const cpf = so(j.cpf); const cat = String(j.categoria || '').toUpperCase().replace(/[^A-E]/g, '');
  const out = { eh_cnh: true, nome: txt(j.nome, 120)?.toUpperCase() || null, cpf: cpf.length === 11 ? cpf : null, data_nascimento: data(j.data_nascimento), rg: txt(j.rg, 40),
    registro: so(j.registro) || null, categoria: CATS.includes(cat) ? cat : null, validade: data(j.validade), primeira_habilitacao: data(j.primeira_habilitacao), emissao: data(j.emissao),
    local_emissao: txt(j.local_emissao, 80), observacoes_cnh: txt(j.observacoes_cnh, 120), confianca: ['alta', 'media', 'baixa'].includes(j.confianca) ? j.confianca : 'media' };
  if (out.cpf && !cpfOk(out.cpf)) { avisos.push('O CPF lido não confere (dígito verificador) — confira.'); }
  if (cat && !out.categoria) avisos.push(`Categoria "${j.categoria}" não reconhecida.`);
  if (out.validade && out.validade < new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10)) avisos.push('Esta CNH está VENCIDA.');
  if (out.confianca === 'baixa') avisos.push('Leitura com baixa confiança (imagem ruim ou cortada) — confira todos os campos.');
  const f = j.foto || {}; const x = fr(f.x), y = fr(f.y), w = fr(f.largura), h = fr(f.altura);
  out.foto = x != null && y != null && w > 0.03 && h > 0.03 && x + w <= 1.001 && y + h <= 1.001 ? { x, y, largura: w, altura: h } : null;
  if (txt(j.aviso, 300)) avisos.push(txt(j.aviso, 300));
  out.avisos = avisos; return out;
}

/** lê a CNH (imagem JPG/PNG/WEBP em base64) — { cnh } ou { status, erro } */
async function ler(supabase, tenant, { base64, mime } = {}) {
  if (!base64 || !['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return { status: 400, erro: 'Envie a CNH como imagem (o PDF é convertido no navegador)' };
  if (String(base64).length > 7_000_000) return { status: 400, erro: 'Imagem grande demais (máx. ~5 MB)' };
  const st = IA.status(tenant);
  if (!st.ligada) return { status: 409, erro: `A leitura automática da CNH usa a IA, que está desligada (${st.motivo}). Preencha à mão.`, ia: st };
  const r = await IA.gerarTexto({ tenant, sistema: SISTEMA, prompt: 'Leia esta CNH e responda só o JSON.', imagens: [{ mime, base64 }], max: 700, registrar: { supabase, tenantId: tenant?.id, recurso: 'leitura_cnh' } });
  if (!r.texto) return { status: 502, erro: `Não consegui ler agora: ${r.motivo}. Tente de novo ou preencha à mão.` };
  let j = null; try { const m = r.texto.match(/\{[\s\S]*\}/); j = JSON.parse(m ? m[0] : r.texto); } catch { return { status: 502, erro: 'A IA respondeu num formato inesperado — tente de novo.' }; }
  return { cnh: normalizar(j), ia: { nome: r.nome, modelo: r.modelo, tokens: r.uso } };
}

/** 📊 uso da IA da empresa no mês (para acompanhar custo e decidir cobrança) */
async function usoDoMes(supabase, tenantId, ym) {
  const de = `${ym}-01T03:00:00Z`; const [y, m] = ym.split('-').map(Number); const ate = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 3)).toISOString();
  const { data } = await supabase.from('ia_uso').select('*').eq('tenant_id', tenantId).gte('em', de).lt('em', ate);
  const por = {}; for (const u of data || []) { const k = u.recurso; por[k] = por[k] || { chamadas: 0, entrada: 0, saida: 0 }; por[k].chamadas++; por[k].entrada += u.tokens_entrada || 0; por[k].saida += u.tokens_saida || 0; }
  return por;
}

module.exports = { ler, normalizar, cpfOk, usoDoMes, SISTEMA };
