#!/usr/bin/env node
// verificar-entrega.js — confere, em um comando, se os arquivos entregues
// (etapa 1: fornecedores globais; etapa 3: cadastro único; etapa 4: perfil
// de atuação; etapa 6: Match Score; etapa 7: edição da demanda + região;
// etapa 8: plano Pro + e-mails de recomendação; etapa 9: melhorias do e-mail;
// etapa 10: Painel do Fornecedor + convite ao fornecedor local; etapa 10b: convite
// a fornecedor novo; etapa 10c: convite com CNPJ + Canal Spot só para verificado)
// etapa 11a: "Criar conta", planos, teste grátis e aprovação; 11b: Console da
// Plataforma; 11b.1: credenciais de teste só no localhost, reconfirmação de e-mail;
// etapa 12a: calendário anual de manutenção; 12b: planos recorrentes + valor da hora; 12b.1: término do plano; 12b.2: responsável, dia útil, seleção de datas; 12b.3: transferir uma OS)
// estão no projeto exatamente como foram entregues.
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
  'routes/fornecedores.js': 'b0c0f9dc2bf58ad8158b53d8c243abcc', // etapa 10c
  'routes/auth.js': '29de6beeeb26ececa65cd5b5a158371a', // etapa 11a.3
  'services/convitesFornecedor.js': 'e3d3837cb171b57e7d5200d9971df968', // etapa 11a.3
  'routes/spot.js': 'ee346546f49efb3552b0d4048513f26b', // etapa 11a
  'services/matchSpot.js': 'fe4275090b82bd1efd52498d2176a90c', // etapa 7
  'routes/configuracoes.js': '05360fb8a4945623e1878ba336161d27', // etapa 7
  'routes/fornecedor.js': '531ae3790a252060c15f14f82af0a8ee', // etapa 11b.1
  'routes/recomendacoes.js': '3c1fe2834a30a24198923797bce4001a', // etapa 9
  'services/recomendacoesEmail.js': '7bc5475ccffb4fd2fcec53be78e64123', // etapa 10c
  'services/emailService.js': '2daf0e597ff370e006585f919c63b525', // etapa 9
  'server.js': '8f9bd3638321029d445dd18bf2275d4c', // etapa 12a
  'routes/atuacao.js': 'cc196661189e2714bcfad96e5c1e8ad9',
  'services/atuacao.js': '8509ac0206906a7f93384350e77132bf',
  'front:SeletorAtuacao.jsx': '17afaaf69d6e4cf0c105490267d188a7',
  'front:TelaMeusDadosFornecedor.jsx': 'd1495962ea063dd647bc350a9c6c8cd9', // etapa 11a.3
  'front:TelaFornecedoresNova.jsx': '28396f3bc910190ecc80873b54edc47d', // etapa 10c
  'front:TelaCanalSpot.jsx': 'd701f0a4ac0cff3a5803de6809471d08', // etapa 11a
  'front:TelaFornecedorSpot.jsx': '449dd00ab481e0596a932aaa985f4bad', // etapa 9
  'front:TelaFornecedor.jsx': '9be19756312b995ad143cc0bf315d90a', // etapa 11b
  'front:TelaPainelFornecedor.jsx': 'e9742a3e808ba27df5d5f29a393b8da6', // etapa 10c
  'front:TelaAceitarConvite.jsx': '8aefac39a8a1f4f94c17d2d26f8d53c0', // etapa 11a.3
  'front:main.jsx': 'b51aa6ff0005dd1ff6c5b49f0545006a', // etapa 11b
  'front:TelaConfiguracoes.jsx': 'cdd08de70f9fe2144022bfd3fac276a3', // etapa 7
  'services/acessoSpot.js': '6ecce4d16d6b123c6ce93c1223b32f01', // etapa 10c (novo)
  'services/receitaCnpj.js': '7c382fbd2db545838e97cb294aa12ee2', // etapa 11a.2
  'services/cadastroPublico.js': 'eae020d28c2318b0f2f96766d9e308e2', // etapa 11a.3
  'front:App.jsx': '99a749de2973a28bbee218c643077dc5', // etapa 12a
  'front:TelaLogin.jsx': 'afa800fa12d684d6099a2e006cd59f13', // etapa 11b.1
  'front:TelaSignup.jsx': '345dceefb937b38e74cfef44cfc33ef3', // etapa 11a.3
  'front:AvisoPlanoTenant.jsx': '5795f00c1bc656d0525fd29b6793a96c', // etapa 11a.3
  'services/emailConfirmacao.js': 'e36296d648d6f76f6412d7de0e10c4d8', // etapa 11a.3 (novo)
  'front:CampoTelefone.jsx': 'fd407b33d7859334a1270903cf7b227b', // etapa 11a.3 (novo)
  'front:TelaConfirmarEmail.jsx': 'dbf759fd98f257a436cfe47874c72d9f', // etapa 11a.3 (novo)
  'routes/plataforma.js': '131cb6a0b8d9619dcfd2520b87989c6d', // etapa 11b (novo)
  'services/plataformaConsole.js': '134a0e0c11ae0fb7df0173979a4550da', // etapa 11b (novo)
  'middleware/plataformaMiddleware.js': 'bf2424eab233bdf7e0cb6fca9cb953b9', // etapa 11b (novo)
  'scripts/criarAdmin.js': 'd4d85894f6381dc7b31f83466f316024', // etapa 11b (novo)
  'front:ConsolePlataforma.jsx': '8179b62e3cf4f2be89bcd7a6c07a2e6c', // etapa 11b (novo)
  'routes/manutencao.js': 'caf7551741bc211124416f42bafc990a', // etapa 12b.3
  'services/calendarioManutencao.js': 'bbcf04d1bb3b18b8776579d3180274e6', // etapa 12b.2
  'front:TelaCalendarioManutencao.jsx': '9ded9a0464cde687505558f8a717105a', // etapa 12b.3
  'front:TelaOrdemServico.jsx': '2228a53bf98e21fd9a8b9da1f0e96544', // etapa 12b.3
  'services/planosManutencao.js': '5eeef54941e8895937e7b61723b2e4e0', // etapa 12b.2
  'front:TelaPlanosManutencao.jsx': 'a2dfe0b472a573dcee85c025b9f811ae', // etapa 12b.3
  'front:ModalTransferirOS.jsx': '8e7c1bf0d6fc9a4f88bdd9087d22cb37', // etapa 12b.3 (novo)
};

// Antes de copiar a etapa 12b.3 — versão que serviu de base para as alterações
const ANTES = {
  'routes/manutencao.js': '4c9a8a5d172fe2d5540b9d34dc869d09',
  'front:TelaPlanosManutencao.jsx': '6c301238e6736052538856e82969eeec',
  'front:TelaCalendarioManutencao.jsx': '05af5234e212a8c8cf9b9aa20e06d172',
  'front:TelaOrdemServico.jsx': 'dd27f17a46c36c324c47ef0f30e1dc5e',
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
  ? '\nANTES de copiar — os arquivos atuais são a base usada na etapa 12b.3?\n'
  : '\nConferindo arquivos entregues (etapas 1, 3, 4, 6 a 12b.3)\n');

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
    const reqs = conteudo.matchAll(/require\(\s*['"]([^'"]*(?:fornecedoresVisiveis|services\/atuacao|services\/matchSpot|services\/recomendacoesEmail|routes\/recomendacoes|services\/convitesFornecedor|services\/acessoSpot|services\/receitaCnpj|services\/cadastroPublico|services\/emailConfirmacao|services\/plataformaConsole|middleware\/plataformaMiddleware|services\/calendarioManutencao|services\/planosManutencao))['"]\s*\)/g);
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
  const novos = ['services/fornecedoresVisiveis.js', 'services/atuacao.js', 'routes/atuacao.js', 'services/matchSpot.js', 'services/recomendacoesEmail.js', 'routes/recomendacoes.js', 'services/convitesFornecedor.js', 'services/acessoSpot.js', 'services/receitaCnpj.js', 'services/cadastroPublico.js', 'services/emailConfirmacao.js', 'routes/plataforma.js', 'services/plataformaConsole.js', 'middleware/plataformaMiddleware.js', 'scripts/criarAdmin.js', 'routes/manutencao.js', 'services/calendarioManutencao.js', 'services/planosManutencao.js', 'migrations/019_planos_manutencao.sql', 'migrations/020_plano_termino.sql', 'migrations/021_plano_responsavel_dia_util.sql'];
  try {
    for (const n of novos) {
      const rastreado = execFileSync('git', ['ls-files', n], { cwd: RAIZ, stdio: 'pipe' }).toString().trim();
      if (!rastreado) console.log(`\n⚠️  ${n} ainda não está no git (git add ${n})`);
    }
    for (const nome of ['SeletorAtuacao.jsx', 'TelaAceitarConvite.jsx', 'TelaPainelFornecedor.jsx', 'AvisoPlanoTenant.jsx', 'CampoTelefone.jsx', 'TelaConfirmarEmail.jsx', 'ConsolePlataforma.jsx', 'TelaCalendarioManutencao.jsx', 'TelaPlanosManutencao.jsx', 'ModalTransferirOS.jsx']) {
      const arq = acharNoFrontend(nome)[0];
      if (!arq) continue;
      const rastreado = execFileSync('git', ['ls-files', arq], { cwd: RAIZ, stdio: 'pipe' }).toString().trim();
      if (!rastreado) console.log(`⚠️  frontend/src/${path.relative(FRONT, arq)} ainda não está no git`);
    }
  } catch { /* sem git disponível: ignora */ }

  // Etapa 10c: /api/spot/publicas passou a exigir fornecedor verificado (era pública).
  // Se alguma tela ainda chama essa rota sem login, ela vai parar de funcionar.
  const usaPublicas = [];
  (function varrer(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) varrer(p);
      else if (/\.(jsx?|tsx?)$/.test(e.name) && fs.readFileSync(p, 'utf8').includes('spot/publicas')) usaPublicas.push(path.relative(FRONT, p));
    }
  })(FRONT);
  if (usaPublicas.length) console.log(`\n⚠️  Estas telas chamam /api/spot/publicas (agora exige fornecedor verificado): ${usaPublicas.join(', ')} — me mande esses arquivos.`);

  // Etapa 11b: confere o .env local (sem mostrar valores — são segredos)
  const arqEnv = path.join(RAIZ, '.env');
  if (fs.existsSync(arqEnv)) {
    const env = {};
    for (const linha of fs.readFileSync(arqEnv, 'utf8').split(/\r?\n/)) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2];
    }
    const url = env.FRONTEND_URL;
    if (url !== undefined && (/\s|#/.test(url.trim()) || /[^\x21-\x7e]/.test(url.trim()) || !/^https?:\/\/[^/]+/.test(url.trim()))) {
      console.log('\n⚠️  .env: FRONTEND_URL tem espaço, "#", acento ou outro caractere estranho — os links dos e-mails (convite, confirmação) ficam quebrados. Deixe só o endereço, ex.: FRONTEND_URL=http://localhost:5173');
    }
    if (!env.PLATAFORMA_ADMINS) {
      console.log('\n⚠️  .env: falta PLATAFORMA_ADMINS (e-mails que podem entrar no Console da Plataforma, ex.: PLATAFORMA_ADMINS=seu@email.com)');
    }
  }

  // Etapa 11b.1: todo pacote usado no backend precisa estar no package.json
  // (no Mac funciona com o que está instalado; no Render só entra o que está lá)
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
    const deps = new Set(Object.keys(pkg.dependencies || {}));
    const nativos = new Set(require('module').builtinModules);
    const faltam = new Map();
    (function varrerBack(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { varrerBack(p); continue; }
        if (!e.name.endsWith('.js')) continue;
        for (const m of fs.readFileSync(p, 'utf8').matchAll(/require\(\s*['"]([^'".$][^'"$]*)['"]\s*\)/g)) {
          const nome = m[1].startsWith('@') ? m[1].split('/').slice(0, 2).join('/') : m[1].split('/')[0];
          if (nome.startsWith('node:') || nativos.has(nome) || deps.has(nome)) continue;
          if (!faltam.has(nome)) faltam.set(nome, path.relative(RAIZ, p));
        }
      }
    })(RAIZ);
    if (faltam.size) {
      falhas++;
      console.log('\n✗ Pacotes usados no código que NÃO estão no package.json (o Render vai quebrar):');
      for (const [n, arq] of faltam) console.log(`    ${n}  (em ${arq})`);
      console.log(`  Corrija com: npm install --save ${[...faltam.keys()].join(' ')}`);
    }
  } catch (e) {
    console.log(`\n⚠️  Não consegui conferir o package.json: ${e.message}`);
  }

  // A rota nova precisa estar registrada no server.js
  const server = path.join(RAIZ, 'server.js');
  if (fs.existsSync(server) && !/routes\/manutencao/.test(fs.readFileSync(server, 'utf8'))) {
    falhas++;
    console.log("\n✗ server.js não registra a rota do calendário (etapa 12a).");
  }
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