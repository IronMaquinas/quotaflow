#!/usr/bin/env node
// verificar-entrega.js — confere, em um comando, se os arquivos entregues
// (etapa 1: fornecedores globais; etapa 3: cadastro único; etapa 4: perfil
// de atuação; etapa 6: Match Score; etapa 7: edição da demanda + região;
// etapa 8: plano Pro + e-mails de recomendação; etapa 9: melhorias do e-mail;
// etapa 10: Painel do Fornecedor + convite ao fornecedor local; etapa 10b: convite
// a fornecedor novo; etapa 10c: convite com CNPJ + Canal Spot só para verificado)
// etapa 11a: "Criar conta", planos, teste grátis e aprovação; 11b: Console da
// Plataforma; 11b.1: credenciais de teste só no localhost, reconfirmação de e-mail;
// etapa 12e.2b: prova online, perfil Colaborador, link da prova, aniversariantes; etapa 12e.2a: conteúdo, prova, biblioteca de treinamentos e horas; etapa 12a: calendário anual de manutenção; 12b: planos recorrentes + valor da hora; 12b.1: término do plano; 12b.2: responsável, dia útil, seleção de datas; 12b.3: transferir uma OS; 12b.4: previstas no calendário; 12b.5: destaque roxo das previstas; 12b.6: confirmação em modal do app; 12c: colaboradores e documentos com vencimento)
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
  'routes/estoque/movimentacoes.js': '7df44d7b2bfac732846bd98fee2cada9', // etapa 12d.2
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
  'routes/recomendacoes.js': '68c234136ab14413eb2b758332ceb19d', // etapa 9
  'services/recomendacoesEmail.js': '7bc5475ccffb4fd2fcec53be78e64123', // etapa 10c
  'services/emailService.js': '2daf0e597ff370e006585f919c63b525', // etapa 9
  'server.js': '589f11806d7f9ef6387f184fa7166e88', // etapa 12e.2b
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
  'front:main.jsx': '7176c0723e3ad94f8b7226b060abe298', // etapa 12e.2b
  'front:TelaConfiguracoes.jsx': 'cdd08de70f9fe2144022bfd3fac276a3', // etapa 7
  'services/acessoSpot.js': '6ecce4d16d6b123c6ce93c1223b32f01', // etapa 10c (novo)
  'services/receitaCnpj.js': '7c382fbd2db545838e97cb294aa12ee2', // etapa 11a.2
  'services/cadastroPublico.js': 'eae020d28c2318b0f2f96766d9e308e2', // etapa 11a.3
  'front:App.jsx': 'c02771e6c9b303277c08ffcb4f52093c', // etapa 12e.2b
  'front:TelaLogin.jsx': 'afa800fa12d684d6099a2e006cd59f13', // etapa 11b.1
  'front:TelaSignup.jsx': '345dceefb937b38e74cfef44cfc33ef3', // etapa 11a.3
  'front:AvisoPlanoTenant.jsx': '5795f00c1bc656d0525fd29b6793a96c', // etapa 11a.3
  'services/emailConfirmacao.js': 'e36296d648d6f76f6412d7de0e10c4d8', // etapa 11a.3 (novo)
  'front:CampoTelefone.jsx': 'fd407b33d7859334a1270903cf7b227b', // etapa 11a.3 (novo)
  'front:TelaConfirmarEmail.jsx': 'dbf759fd98f257a436cfe47874c72d9f', // etapa 11a.3 (novo)
  'routes/plataforma.js': '2d6569fd67baf57ce4b9149006a2a23b', // etapa 12e.2b
  'services/plataformaConsole.js': '134a0e0c11ae0fb7df0173979a4550da', // etapa 11b (novo)
  'middleware/plataformaMiddleware.js': 'bf2424eab233bdf7e0cb6fca9cb953b9', // etapa 11b (novo)
  'scripts/criarAdmin.js': 'd4d85894f6381dc7b31f83466f316024', // etapa 11b (novo)
  'front:ConsolePlataforma.jsx': 'd98f4869a7767ac31f712d73589c3337', // etapa 12e.2a
  'routes/manutencao.js': '577c5a2faac8b4f0b020801978143c93', // etapa 12e.1
  'services/calendarioManutencao.js': 'bbcf04d1bb3b18b8776579d3180274e6', // etapa 12b.2
  'front:TelaCalendarioManutencao.jsx': '1692610f2b5f2c954329890acecd0886', // etapa 12e.1
  'front:TelaOrdemServico.jsx': '2228a53bf98e21fd9a8b9da1f0e96544', // etapa 12b.3
  'services/planosManutencao.js': 'e32588acaefd47c5cb93bbe0d70ab799', // etapa 12b.4
  'front:TelaPlanosManutencao.jsx': '5fd8c2a3a8c6fdfb599fb98fd9ccabff', // etapa 12b.3 + texto do botão alterado pelo Marcony (18/10)
  'front:ModalTransferirOS.jsx': '8e7c1bf0d6fc9a4f88bdd9087d22cb37', // etapa 12b.3 (novo)
  'routes/pessoas.js': '7609bca9f3034700a06994ea2110da47', // etapa 12e.2b
  'services/documentos.js': 'e43a738265140f4099737d0e48f61fe1', // etapa 12e.2a
  'front:TelaPessoas.jsx': '882b2f2003cbfd35c12fe38c71035727', // etapa 12e.2b
  // etapa 12c.1
  'services/avisosVencimento.js': 'e43d0373f61a7e12eccdcc5861cd0e6b', // etapa 12d.3
  'services/funcoes.js': '0e5d5fa3f8eb3a3bf3760eec74039854', // etapa 12e.1
  'front:BibliotecaFuncoes.jsx': '4e034707e49d56e5e490b0be73cb5468', // etapa 12d.1
  'services/epi.js': '9b0dccea86e23c7d5f3af1132159f0ee', // etapa 12d.1b
  'front:TelaEpi.jsx': 'f9a0279f2d8916f32549f4a3f7108438', // etapa 12d.3
  'front:BibliotecaEpi.jsx': 'e54d2c680ad3692518681de67bf00169', // etapa 12d.1b (novo)
  'services/epiEntregas.js': 'fec08c1dc85c386e57e5a01474871c8f', // etapa 12d.3
  'services/conformidade.js': '33c1f7f480e49d63c92ca9a9361b660b', // etapa 12e.1
  'front:GestaoEpi.jsx': '6c823820e98a6d78c736540aea8e67f8', // etapa 12d.3
  'front:AssinaturaTela.jsx': 'db713a14a03390f9072d06f1de697b90', // etapa 12d.2 (novo)
  'front:gerarFichaEpi.js': '1a5de92e2896fc8095784b082269b1a3', // etapa 12d.3
  'services/historicoFuncoes.js': 'e8460900c6f40ee55328c3aac638dffe', // etapa 12d.3 (novo)
  'services/avisosPessoas.js': 'cd207065ddcab3ea52960e0cec5ce761', // etapa 12e.1
  'services/treinamentos.js': '567e982f32ff3c8f2c2e25b1425d4cc8', // etapa 12e.2b
  'front:TelaTreinamentos.jsx': 'edf308770f97ba75fd11fdde6b375aee', // etapa 12e.2b
  'front:gerarListaPresenca.js': '3bdbb5014f26498fab0396dc6e41e21d', // etapa 12e.2b
  'migrations/031_treinamentos_conteudo_horas.sql': 'ec5ffd0cf4814b65add59c253be196fa', // etapa 12e.2a (novo)
  'front:BibliotecaTreinamentos.jsx': 'bc7bf51426be20050569f0beab486d19', // etapa 12e.2b
  'front:EditorConteudoTreinamento.jsx': 'a770330072bfc50fcf5f5e8ab5485d51', // etapa 12e.2b
  'services/provaOnline.js': 'b0b809d29b509ba95d106e6b7ca693fe', // etapa 12e.2b (novo)
  'routes/meusTreinamentos.js': '672fc343ce237cc0710eaed2e616b510', // etapa 12e.2b (novo)
  'routes/provaPublica.js': '61729810ce530a5ce528d2f85b1fc00b', // etapa 12e.2b (novo)
  'middleware/tenantMiddleware.js': 'a3bb6c2a4289dee172cde44c91b7d07a', // etapa 12e.2b
  'migrations/032_prova_online_colaborador.sql': '89db0b8f09c60f29496ee58e87b5685f', // etapa 12e.2b (novo)
  'front:AreaTreinamentoColaborador.jsx': 'a37d35c2a8af8f84296b4ba9575a207b', // etapa 12e.2b (novo)
  'front:TelaMeusTreinamentos.jsx': '22c9b949a39c4285ac1df015647d99dc', // etapa 12e.2b (novo)
  'front:AcessoColaborador.jsx': '4af6b971e9602a1f1a053f7c1cf87d93', // etapa 12e.2b (novo)
  'front:TextoAula.jsx': '9bf737cb738368965db7ef010bbe27bc', // etapa 12e.2b (novo)
  'front:TelaProvaPublica.jsx': '5be6916bcdd00932fee2e0fcdc304dfe', // etapa 12e.2b (novo)
};

// Antes de copiar a etapa 12e.2b — base: 12e.2a
const ANTES = {
  'services/treinamentos.js': '6b5ad46c5470a0cd8f6a1d434f693946',
  'routes/pessoas.js': '569bd049cb872f3e6be6cc0800e5ae55',
  'routes/plataforma.js': '2d8c227d0e261e4143e2c458c445622c',
  'middleware/tenantMiddleware.js': 'c3d9efb2637619e482e2f20250b616af',
  'server.js': '5014064f2e48cd7561e1c39cfb53c8c5',
  'front:TelaTreinamentos.jsx': '389253678f9f2914425139dcbdfbaef2',
  'front:TelaPessoas.jsx': '85189055210619acc89a050613444d6c',
  'front:EditorConteudoTreinamento.jsx': '7a821ae607023215fe65472de1d68df4',
  'front:BibliotecaTreinamentos.jsx': 'a4281a92992f3e4e8c3e6999f643bf72',
  'front:App.jsx': '19da56abf646003522a6d0aef8ed6854',
  'front:main.jsx': 'b51aa6ff0005dd1ff6c5b49f0545006a',
  'front:gerarListaPresenca.js': 'd03c15aa070beadb0c0dbe1e90d498ce',
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
  ? '\nANTES de copiar — os arquivos atuais são a base usada na etapa 12e.1?\n'
  : '\nConferindo arquivos entregues (etapas 1, 3, 4, 6 a 12e.1)\n');

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
    const reqs = conteudo.matchAll(/require\(\s*['"]([^'"]*(?:fornecedoresVisiveis|services\/atuacao|services\/matchSpot|services\/recomendacoesEmail|routes\/recomendacoes|services\/convitesFornecedor|services\/acessoSpot|services\/receitaCnpj|services\/cadastroPublico|services\/emailConfirmacao|services\/plataformaConsole|middleware\/plataformaMiddleware|services\/calendarioManutencao|services\/planosManutencao|services\/documentos))['"]\s*\)/g);
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
  const novos = ['services/fornecedoresVisiveis.js', 'services/atuacao.js', 'routes/atuacao.js', 'services/matchSpot.js', 'services/recomendacoesEmail.js', 'routes/recomendacoes.js', 'services/convitesFornecedor.js', 'services/acessoSpot.js', 'services/receitaCnpj.js', 'services/cadastroPublico.js', 'services/emailConfirmacao.js', 'routes/plataforma.js', 'services/plataformaConsole.js', 'middleware/plataformaMiddleware.js', 'scripts/criarAdmin.js', 'routes/manutencao.js', 'services/calendarioManutencao.js', 'services/planosManutencao.js', 'migrations/019_planos_manutencao.sql', 'migrations/020_plano_termino.sql', 'migrations/021_plano_responsavel_dia_util.sql', 'routes/pessoas.js', 'services/documentos.js', 'migrations/022_colaboradores_documentos.sql', 'services/avisosVencimento.js', 'migrations/023_documento_avisos.sql', 'services/funcoes.js', 'migrations/024_funcoes.sql', 'migrations/025_funcoes_detalhes.sql', 'services/epi.js', 'migrations/026_epi_itens.sql', 'migrations/027_epi_catalogo_tamanhos.sql', 'services/epiEntregas.js', 'services/conformidade.js', 'migrations/028_epi_entregas.sql', 'services/historicoFuncoes.js', 'services/avisosPessoas.js', 'migrations/029_historico_funcoes_avisos.sql', 'services/treinamentos.js', 'migrations/030_treinamentos.sql', 'migrations/031_treinamentos_conteudo_horas.sql', 'services/provaOnline.js', 'routes/meusTreinamentos.js', 'routes/provaPublica.js', 'migrations/032_prova_online_colaborador.sql'];
  try {
    for (const n of novos) {
      const rastreado = execFileSync('git', ['ls-files', n], { cwd: RAIZ, stdio: 'pipe' }).toString().trim();
      if (!rastreado) console.log(`\n⚠️  ${n} ainda não está no git (git add ${n})`);
    }
    for (const nome of ['SeletorAtuacao.jsx', 'TelaAceitarConvite.jsx', 'TelaPainelFornecedor.jsx', 'AvisoPlanoTenant.jsx', 'CampoTelefone.jsx', 'TelaConfirmarEmail.jsx', 'ConsolePlataforma.jsx', 'TelaCalendarioManutencao.jsx', 'TelaPlanosManutencao.jsx', 'ModalTransferirOS.jsx', 'TelaPessoas.jsx', 'BibliotecaTreinamentos.jsx', 'EditorConteudoTreinamento.jsx', 'AreaTreinamentoColaborador.jsx', 'TelaMeusTreinamentos.jsx', 'AcessoColaborador.jsx', 'TextoAula.jsx', 'TelaProvaPublica.jsx']) {
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