#!/usr/bin/env node
// verificar-entrega.js — confere, em um comando, se os arquivos entregues
// (etapa 1: fornecedores globais; etapa 3: cadastro único; etapa 4: perfil
// de atuação; etapa 6: Match Score; etapa 7: edição da demanda + região;
// etapa 8: plano Pro + e-mails de recomendação; etapa 9: melhorias do e-mail;
// etapa 10: Painel do Fornecedor + convite ao fornecedor local; etapa 10b: convite
// a fornecedor novo) estão no projeto exatamente como foram entregues.
//
// Só LÊ arquivos. Não altera nada.
// Uso (dentro da pasta backend):
//   node verificar-entrega.js --antes   → ANTES de copiar: os arquivos que vão ser
//                                         substituídos ainda são a versão que eu usei
//                                         de base? (se não forem, me mande antes)
//   node verificar-entrega.js           → DEPOIS de copiar: tudo igual ao entregue?
//
// Para cada arquivo verifica:
//   1. existe (arquivos do frontend são procurados pelo nome dentro de ../frontend/src)
//   2. conteúdo idêntico ao entregue (ignora só quebra de linha final e CRLF do Windows)
//   3. sintaxe válida (node --check — só arquivos .js; .jsx o Vite confere)
//   4. os require de services/fornecedoresVisiveis e services/atuacao apontam para arquivos que existem

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

// Depois de copiar — versão entregue (a mais recente de cada arquivo)
const ESPERADO = {
  // etapa 1
  'routes/buscaFornecedores.js': '39dea794495d3da0b9dc916a1ea0faf0',
  'services/CotacaoService.js': '7e16fed50eefffa689e2f6f69c0d7cfe',
  'services/fornecedoresVisiveis.js': '8c1fa18647fa44b05b4865491067a0c0',
  'routes/cotacoes.js': '5a83261606ba1146511c64c560b6e058',
  'routes/naoConformidades.js': '4f27a368d0e2d4ff921a173c98347cea',
  'routes/ordensVenda.js': 'ba32842c49096f072788b51d10248ca4',
  'routes/estoque/movimentacoes.js': '33c7e355b664b4d7cd72ef1afaba0c60',
  'routes/estoque/itensConsumo.js': '47011b41ff3d33ac8ad31954084c2321',
  'services/NCService.js': 'a9432a05c6bfb78719497119235bbe44',
  'services/PortalRespostaService.js': 'aff8546f40f10b238354651e8b17aefb',
  'services/ValidacaoXmlService.js': 'a8e0f2180da6f621272f70fb80a2b8e3',
  // etapa 4 (inclui arquivos já mexidos nas etapas 1 e 3)
  'routes/fornecedores.js': 'd97c917ccde1ca663d91875df62d05db', // etapa 10b
  'routes/auth.js': '9214ac9b751463fb8e53f576ffc93b48', // etapa 10b
  'services/convitesFornecedor.js': '0afc85e43e521fee713fe564e523ceb8', // etapa 10b
  'routes/spot.js': '3c36748fd6d1fa6b64574004d38506d1', // etapa 8
  'services/matchSpot.js': 'fe4275090b82bd1efd52498d2176a90c', // etapa 7
  'routes/configuracoes.js': '05360fb8a4945623e1878ba336161d27', // etapa 7
  'routes/fornecedor.js': 'ad6705f337fa9e078befc9f8a9571b1c', // etapa 10
  'routes/recomendacoes.js': '3c1fe2834a30a24198923797bce4001a', // etapa 9
  'services/recomendacoesEmail.js': 'ec0668979a4e7806bb64e7f5ac00ca3d', // etapa 9
  'services/emailService.js': '2daf0e597ff370e006585f919c63b525', // etapa 9
  'server.js': 'a4b331a7f77e20d83d6c6078d235cb7c', // etapa 8
  'routes/atuacao.js': 'cc196661189e2714bcfad96e5c1e8ad9',
  'services/atuacao.js': '8509ac0206906a7f93384350e77132bf',
  'front:SeletorAtuacao.jsx': '17afaaf69d6e4cf0c105490267d188a7',
  'front:TelaMeusDadosFornecedor.jsx': 'fe8288aee67562902d65d70064865196', // etapa 8
  'front:TelaFornecedoresNova.jsx': 'a2d7cf6b167255b81c88e3a3137d16f2', // etapa 10b
  'front:TelaCanalSpot.jsx': 'f4afd6de0575afed02147c500125124c', // etapa 7
  'front:TelaFornecedorSpot.jsx': '449dd00ab481e0596a932aaa985f4bad', // etapa 9
  'front:TelaFornecedor.jsx': 'e0573ad6f434811c6275175db6e89f25', // etapa 10
  'front:TelaPainelFornecedor.jsx': '6de6d3a403842cca6903c0e3498b4e08', // etapa 10
  'front:TelaAceitarConvite.jsx': '66d41dec02a1029a06ec55029652e105', // etapa 10b
  'front:main.jsx': '6b23fa3202e03b908c3a0f4339c79675', // etapa 10
  'front:TelaConfiguracoes.jsx': 'cdd08de70f9fe2144022bfd3fac276a3', // etapa 7
};

// Antes de copiar a etapa 10b — versão que serviu de base para as alterações
const ANTES = {
  'routes/fornecedores.js': '98aaa5a40a5c5d539664f0002f1a2efa',
  'routes/auth.js': '2171a273d5d8cfc401a72f6c9803e2b8',
  'services/convitesFornecedor.js': 'd97ffc6dec8ef3273a1d549ebe4324b0',
  'front:TelaFornecedoresNova.jsx': '516c7d59a8aafb2d7365553399bf4809',
  'front:TelaAceitarConvite.jsx': '7212bad90d49d542c37b698c3eb28220',
};

const RAIZ = process.cwd();
const FRONT = path.join(RAIZ, '..', 'frontend', 'src');
const modoAntes = process.argv.includes('--antes');
const normalizar = (txt) => txt.replace(/\r\n/g, '\n').replace(/\s+$/, '');
const md5 = (txt) => crypto.createHash('md5').update(normalizar(txt)).digest('hex');

if (!fs.existsSync(path.join(RAIZ, 'routes')) || !fs.existsSync(path.join(RAIZ, 'services'))) {
  console.error('✗ Rode este script dentro da pasta backend (onde ficam routes/ e services/).');
  process.exit(1);
}

function acharNoFrontend(nome, dir = FRONT, achados = []) {
  if (!fs.existsSync(dir)) return achados;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) acharNoFrontend(nome, p, achados);
    else if (e.name === nome) achados.push(p);
  }
  return achados;
}

function localizar(chave) {
  if (!chave.startsWith('front:')) return { abs: path.join(RAIZ, chave), rotulo: chave };
  const nome = chave.slice(6);
  const achados = acharNoFrontend(nome);
  if (achados.length > 1) return { erro: `mais de um arquivo ${nome}: ${achados.map((a) => path.relative(FRONT, a)).join(', ')}`, rotulo: nome };
  if (!achados.length) return { abs: null, rotulo: `frontend/src/**/${nome}` };
  return { abs: achados[0], rotulo: 'frontend/src/' + path.relative(FRONT, achados[0]) };
}

const LISTA = modoAntes ? ANTES : ESPERADO;
let falhas = 0;
console.log(modoAntes
  ? '\nANTES de copiar — os arquivos atuais são a base usada na etapa 10b?\n'
  : '\nConferindo arquivos entregues (etapas 1, 3, 4, 6 a 10b)\n');

for (const [chave, esperado] of Object.entries(LISTA)) {
  const { abs, rotulo, erro } = localizar(chave);
  const problemas = [];

  if (erro) {
    console.log(`✗ ${rotulo}\n    ${erro}`);
    falhas++;
    continue;
  }
  if (!abs || !fs.existsSync(abs)) {
    console.log(`✗ ${rotulo}\n    não encontrado`);
    falhas++;
    continue;
  }
  const conteudo = fs.readFileSync(abs, 'utf8');

  if (md5(conteudo) !== esperado) {
    problemas.push(modoAntes
      ? 'DIFERENTE da base — você alterou este arquivo depois da última entrega? Me mande antes de substituir.'
      : 'conteúdo DIFERENTE do entregue');
  }

  if (!modoAntes && abs.endsWith('.js')) {
    try {
      execFileSync(process.execPath, ['--check', abs], { stdio: 'pipe' });
    } catch (e) {
      problemas.push('erro de sintaxe: ' + String(e.stderr || e.message).split('\n').find((l) => l.trim()));
    }
    const reqs = conteudo.matchAll(/require\(\s*['"]([^'"]*(?:fornecedoresVisiveis|services\/atuacao|services\/matchSpot|services\/recomendacoesEmail|routes\/recomendacoes|services\/convitesFornecedor))['"]\s*\)/g);
    for (const r of reqs) {
      const alvo = path.resolve(path.dirname(abs), r[1]) + '.js';
      if (!fs.existsSync(alvo)) problemas.push(`require('${r[1]}') não encontra o arquivo`);
    }
  }

  if (problemas.length) {
    falhas++;
    console.log(`✗ ${rotulo}`);
    problemas.forEach((p) => console.log(`    ${p}`));
  } else {
    console.log(`✓ ${rotulo}`);
  }
}

if (!modoAntes) {
  // Arquivos novos precisam entrar no commit
  const novos = ['services/fornecedoresVisiveis.js', 'services/atuacao.js', 'routes/atuacao.js', 'services/matchSpot.js', 'services/recomendacoesEmail.js', 'routes/recomendacoes.js', 'services/convitesFornecedor.js'];
  try {
    for (const n of novos) {
      const rastreado = execFileSync('git', ['ls-files', n], { cwd: RAIZ, stdio: 'pipe' }).toString().trim();
      if (!rastreado) console.log(`\n⚠️  ${n} ainda não está no git (git add ${n})`);
    }
    for (const nome of ['SeletorAtuacao.jsx', 'TelaAceitarConvite.jsx', 'TelaPainelFornecedor.jsx']) {
      const arq = acharNoFrontend(nome)[0];
      if (!arq) continue;
      const rastreado = execFileSync('git', ['ls-files', arq], { cwd: RAIZ, stdio: 'pipe' }).toString().trim();
      if (!rastreado) console.log(`⚠️  frontend/src/${path.relative(FRONT, arq)} ainda não está no git`);
    }
  } catch { /* sem git disponível: ignora */ }

  // A rota nova precisa estar registrada no server.js
  const server = path.join(RAIZ, 'server.js');
  if (fs.existsSync(server) && !/routes\/atuacao/.test(fs.readFileSync(server, 'utf8'))) {
    falhas++;
    console.log("\n✗ server.js não registra a rota nova. Adicione: app.use('/api/atuacao', require('./routes/atuacao'));");
  }
}

const total = Object.keys(LISTA).length;
console.log(falhas
  ? `\n✗ ${falhas} problema(s) — mande esta saída para conferência.`
  : modoAntes
    ? `\n✓ Os ${total} arquivos são a base esperada. Pode copiar a entrega.`
    : `\n✓ Todos os ${total} arquivos estão exatamente como entregues.`);
process.exit(falhas ? 1 : 0);
