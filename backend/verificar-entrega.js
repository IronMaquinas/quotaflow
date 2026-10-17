#!/usr/bin/env node
// verificar-entrega.js — confere, em um comando, se os arquivos entregues
// (etapa 1: fornecedores globais; etapa 3: cadastro único; etapa 4: perfil
// de atuação; etapa 6: Match Score; etapa 7: edição da demanda + região;
// etapa 8: plano Pro + e-mails de recomendação) estão no projeto exatamente como foram entregues.
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
  'routes/fornecedores.js': 'f925b8245052e7468f7cac7da4bf7d4f',
  'routes/spot.js': '3c36748fd6d1fa6b64574004d38506d1', // etapa 8
  'services/matchSpot.js': 'fe4275090b82bd1efd52498d2176a90c', // etapa 7
  'routes/configuracoes.js': '05360fb8a4945623e1878ba336161d27', // etapa 7
  'routes/fornecedor.js': 'cb5cc262bf30583112a351a73761b8f0', // etapa 8
  'routes/recomendacoes.js': 'e814b9be4cf8b1e14358575ce7905e1a', // etapa 8
  'services/recomendacoesEmail.js': 'a640da411101c25fb1f9f1bfca66a2f3', // etapa 8
  'server.js': 'a4b331a7f77e20d83d6c6078d235cb7c', // etapa 8
  'routes/atuacao.js': 'cc196661189e2714bcfad96e5c1e8ad9',
  'services/atuacao.js': '8509ac0206906a7f93384350e77132bf',
  'front:SeletorAtuacao.jsx': '17afaaf69d6e4cf0c105490267d188a7',
  'front:TelaMeusDadosFornecedor.jsx': 'fe8288aee67562902d65d70064865196', // etapa 8
  'front:TelaFornecedoresNova.jsx': '2b65c229997c5755dda5748c383aa007',
  'front:TelaCanalSpot.jsx': 'f4afd6de0575afed02147c500125124c', // etapa 7
  'front:TelaFornecedorSpot.jsx': '7059c3f2671ed872a556f0da484f728b', // etapa 8
  'front:TelaConfiguracoes.jsx': 'cdd08de70f9fe2144022bfd3fac276a3', // etapa 7
};

// Antes de copiar a etapa 8 — versão que serviu de base para as alterações
const ANTES = {
  'routes/spot.js': '90a8a32a6f1ee5677bc2e99dd32d7606',
  'routes/fornecedor.js': '0b447f0e2735fefbe56da81b6a5a763d',
  'server.js': 'e17cd05fd022ab09438557be1539f931',
  'front:TelaMeusDadosFornecedor.jsx': '43d89224e6b9171c1dba9744c0853e29',
  'front:TelaFornecedorSpot.jsx': '9aa4b8acd5c610a2cb78eae51e074f13',
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
  ? '\nANTES de copiar — os arquivos atuais são a base usada na etapa 8?\n'
  : '\nConferindo arquivos entregues (etapas 1, 3, 4, 6, 7 e 8)\n');

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
    const reqs = conteudo.matchAll(/require\(\s*['"]([^'"]*(?:fornecedoresVisiveis|services\/atuacao|services\/matchSpot|services\/recomendacoesEmail|routes\/recomendacoes))['"]\s*\)/g);
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
  const novos = ['services/fornecedoresVisiveis.js', 'services/atuacao.js', 'routes/atuacao.js', 'services/matchSpot.js', 'services/recomendacoesEmail.js', 'routes/recomendacoes.js'];
  try {
    for (const n of novos) {
      const rastreado = execFileSync('git', ['ls-files', n], { cwd: RAIZ, stdio: 'pipe' }).toString().trim();
      if (!rastreado) console.log(`\n⚠️  ${n} ainda não está no git (git add ${n})`);
    }
    const seletor = acharNoFrontend('SeletorAtuacao.jsx')[0];
    if (seletor) {
      const rastreado = execFileSync('git', ['ls-files', seletor], { cwd: RAIZ, stdio: 'pipe' }).toString().trim();
      if (!rastreado) console.log(`⚠️  frontend/src/${path.relative(FRONT, seletor)} ainda não está no git`);
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
