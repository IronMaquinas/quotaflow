#!/usr/bin/env node
// verificar-entrega.js — confere, em um comando, se os arquivos da etapa 1
// (fornecedores globais) estão no projeto exatamente como foram entregues.
//
// Só LÊ arquivos. Não altera nada.
// Uso (dentro da pasta backend):  node verificar-entrega.js
//
// Para cada arquivo verifica:
//   1. existe no lugar certo
//   2. conteúdo idêntico ao entregue (ignora só quebra de linha final e CRLF do Windows)
//   3. sintaxe válida (node --check)
//   4. o require de services/fornecedoresVisiveis aponta para um arquivo que existe

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ESPERADO = {
  'routes/fornecedores.js': '9e950a1ab5835f90d11d51062cb1bcb8',
  'routes/buscaFornecedores.js': '39dea794495d3da0b9dc916a1ea0faf0',
  'routes/spot.js': '70e00afb50b0d8547bbb12ef186fc9b4',
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
};

const RAIZ = process.cwd();
const normalizar = (txt) => txt.replace(/\r\n/g, '\n').replace(/\s+$/, '');
const md5 = (txt) => crypto.createHash('md5').update(normalizar(txt)).digest('hex');

if (!fs.existsSync(path.join(RAIZ, 'routes')) || !fs.existsSync(path.join(RAIZ, 'services'))) {
  console.error('✗ Rode este script dentro da pasta backend (onde ficam routes/ e services/).');
  process.exit(1);
}

let falhas = 0;
console.log('\nConferindo arquivos da etapa 1 (fornecedores globais)\n');

for (const [rel, esperado] of Object.entries(ESPERADO)) {
  const abs = path.join(RAIZ, rel);
  const problemas = [];

  if (!fs.existsSync(abs)) {
    console.log(`✗ ${rel}\n    não encontrado`);
    falhas++;
    continue;
  }
  const conteudo = fs.readFileSync(abs, 'utf8');

  if (md5(conteudo) !== esperado) problemas.push('conteúdo DIFERENTE do entregue');

  try {
    execFileSync(process.execPath, ['--check', abs], { stdio: 'pipe' });
  } catch (e) {
    problemas.push('erro de sintaxe: ' + String(e.stderr || e.message).split('\n').find((l) => l.trim()) );
  }

  const req = conteudo.match(/require\(\s*['"]([^'"]*fornecedoresVisiveis)['"]\s*\)/);
  if (req) {
    const alvo = path.resolve(path.dirname(abs), req[1]) + '.js';
    if (!fs.existsSync(alvo)) problemas.push(`require('${req[1]}') não encontra o arquivo`);
  }

  if (problemas.length) {
    falhas++;
    console.log(`✗ ${rel}`);
    problemas.forEach((p) => console.log(`    ${p}`));
  } else {
    console.log(`✓ ${rel}`);
  }
}

// O arquivo novo precisa entrar no commit
try {
  const rastreado = execFileSync('git', ['ls-files', 'services/fornecedoresVisiveis.js'], { cwd: RAIZ, stdio: 'pipe' }).toString().trim();
  if (!rastreado) {
    console.log('\n⚠️  services/fornecedoresVisiveis.js ainda não está no git.');
    console.log('    Antes do commit: git add services/fornecedoresVisiveis.js');
  }
} catch { /* sem git disponível: ignora */ }

console.log(falhas
  ? `\n✗ ${falhas} arquivo(s) com problema — mande esta saída para conferência.`
  : `\n✓ Todos os ${Object.keys(ESPERADO).length} arquivos estão exatamente como entregues.`);
process.exit(falhas ? 1 : 0);