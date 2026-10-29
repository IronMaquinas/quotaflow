#!/usr/bin/env node
// backend/scripts/previaEmailsBid.js — etapa 15c.3
//
// Remonta os e-mails que o cliente recebeu de um BID (com os dados reais) para tutorial/print — NÃO altera nada no banco.
//   • envio de cada versão enviada (v1, v2…) — mesmo assunto/texto/link/assinatura do envio original
//   • confirmação do aceite (se o BID foi aceito pelo link)
// Salva cada um como .html em backend/previa-emails/<BID>/ (abra no navegador e tire o print).
// Com --enviar <email>, também envia cada um para esse endereço (assunto com "[PRÉVIA]").
//
// Uso (dentro da pasta backend, com o .env apontando para o Supabase):
//   node scripts/previaEmailsBid.js BID-2026-0001
//   node scripts/previaEmailsBid.js BID-2026-0001 --enviar voce@empresa.com
//   (vários tenants com o mesmo número? acrescente --tenant <id>)

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabase } = require('../db');
const B = require('../services/bids');
const BC = require('../services/bidsCliente');

const args = process.argv.slice(2);
const numero = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--enviar' && args[args.indexOf(a) - 1] !== '--tenant');
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const para = opt('--enviar'); const tenant = opt('--tenant');

(async () => {
  if (!numero) { console.log('Uso: node scripts/previaEmailsBid.js BID-2026-0001 [--enviar voce@empresa.com] [--tenant <id>]'); process.exit(1); }
  let qb = supabase.from('bids').select('*').eq('numero', numero); if (tenant) qb = qb.eq('tenant_id', tenant);
  const { data: bs, error } = await qb; if (error) throw new Error(error.message);
  if (!bs?.length) { console.log(`✗ ${numero} não encontrado`); process.exit(1); }
  if (bs.length > 1) { console.log(`✗ ${numero} existe em ${bs.length} empresas — use --tenant <id> (${bs.map((b) => b.tenant_id).join(', ')})`); process.exit(1); }
  const b = bs[0];
  const emp = await BC.empresaDe(supabase, b.tenant_id);
  const contatos = await BC.contatosEmissor(supabase, b.tenant_id, b, emp);
  const vers = await BC.versoesDe(supabase, b.tenant_id, b.id);
  const url = b.token ? B.linkCliente(b.token) : `${String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '')}/#bid?t=(link)`;
  const pasta = path.join(__dirname, '..', 'previa-emails', numero); fs.mkdirSync(pasta, { recursive: true });
  const saidas = [];
  let anterior = null;
  for (const v of vers.filter((x) => x.enviada_em)) {
    const nova = !!anterior;
    const mud = anterior ? B.diferencas(anterior.snapshot, v.snapshot) : [];
    const bv = { ...b, ...(v.snapshot || {}), conteudo: v.snapshot?.conteudo || b.conteudo, versao_enviada: anterior ? anterior.versao : 0 };
    const e = BC.emailEnvio(emp, bv, v.versao, url, { texto: v.mensagem || null, mudancas: mud, nota: v.nota, nova, contatos });
    saidas.push({ arquivo: `${String(saidas.length + 1).padStart(2, '0')}-envio-v${v.versao}.html`, ...e, para: v.enviada_para });
    anterior = v;
  }
  if (b.fase === 'aceito' && b.aceite_canal === 'link') {
    const v = vers.find((x) => x.versao === b.aceite_versao);
    const pv = b.pv_id ? (await supabase.from('pedidos_venda').select('*').eq('id', b.pv_id)).data?.[0] : null;
    const e = BC.emailAceite(emp, b, v, { nome: b.aceite_nome, cargo: b.aceite_cargo, em: b.aceite_em, hash: b.aceite_hash, url, pv, contatos });
    saidas.push({ arquivo: `${String(saidas.length + 1).padStart(2, '0')}-aceite-confirmado.html`, ...e, para: b.aceite_email });
  }
  if (!saidas.length) { console.log(`${numero}: nenhum e-mail enviado ainda (sem versão enviada).`); process.exit(0); }
  for (const s of saidas) {
    fs.writeFileSync(path.join(pasta, s.arquivo), `<!doctype html><meta charset="utf-8"><title>${s.assunto.replace(/</g, '&lt;')}</title><div style="font-family:Arial;font-size:13px;color:#555;max-width:600px;margin:12px auto">Assunto: <b style="color:#111">${s.assunto.replace(/</g, '&lt;')}</b><br/>Para: ${s.para || '—'}</div><hr style="max-width:600px"/>${s.html}`);
    console.log(`✓ ${s.arquivo} — ${s.assunto}`);
    if (para) { await require('../services/emailService').enviarEmailFornecedor(para, `[PRÉVIA] ${s.assunto}`, s.html); console.log(`  ↳ enviado para ${para}`); }
  }
  console.log(`\nArquivos em: ${pasta}`);
  process.exit(0);
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
