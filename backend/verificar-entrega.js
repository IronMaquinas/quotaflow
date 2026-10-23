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
  'routes/cotacoes.js': '31d65d927fd99e4595d5072ff6715ed8', // etapa 14b.1.2
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
  'server.js': 'aa0f1d15ee167299abe0081f70ad8922', // etapa 14b.3
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
  'front:main.jsx': '11cc108a974a0d7984c042dcf087907a', // etapa 14b.1
  'front:TelaConfiguracoes.jsx': 'cdd08de70f9fe2144022bfd3fac276a3', // etapa 7
  'services/acessoSpot.js': '6ecce4d16d6b123c6ce93c1223b32f01', // etapa 10c (novo)
  'services/receitaCnpj.js': '7c382fbd2db545838e97cb294aa12ee2', // etapa 11a.2
  'services/cadastroPublico.js': 'eae020d28c2318b0f2f96766d9e308e2', // etapa 11a.3
  'front:App.jsx': '028f5637824fa1f5c4acb4d193230abd', // etapa 14b.3
  'front:TelaLogin.jsx': 'bfa1fccbdab99820be2ac14c0e91b2fe', // etapa 14b.1
  'front:TelaSignup.jsx': '345dceefb937b38e74cfef44cfc33ef3', // etapa 11a.3
  'front:AvisoPlanoTenant.jsx': '5795f00c1bc656d0525fd29b6793a96c', // etapa 11a.3
  'services/emailConfirmacao.js': 'e36296d648d6f76f6412d7de0e10c4d8', // etapa 11a.3 (novo)
  'front:CampoTelefone.jsx': 'fd407b33d7859334a1270903cf7b227b', // etapa 11a.3 (novo)
  'front:TelaConfirmarEmail.jsx': 'dbf759fd98f257a436cfe47874c72d9f', // etapa 11a.3 (novo)
  'routes/plataforma.js': '1487ce2ba8a2c8c5e0f1e46bede8df8e', // etapa 14a
  'services/plataformaConsole.js': '47e9e1ebcd51b79c0c50c9a17ba35f1a', // etapa 14b.3
  'middleware/plataformaMiddleware.js': 'bf2424eab233bdf7e0cb6fca9cb953b9', // etapa 11b (novo)
  'scripts/criarAdmin.js': 'd4d85894f6381dc7b31f83466f316024', // etapa 11b (novo)
  'front:ConsolePlataforma.jsx': 'c793773c873e827c0625d6abd28ea47e', // etapa 14a
  'routes/manutencao.js': '615fa12637ae7b454c52b99c054e617b', // etapa 14b.2
  'services/calendarioManutencao.js': 'bbcf04d1bb3b18b8776579d3180274e6', // etapa 12b.2
  'front:TelaCalendarioManutencao.jsx': '8d9921e2e15255472f0c62687c5f37b0', // etapa 14b.2
  'front:TelaOrdemServico.jsx': 'df80c9f9787e8f542e9558aa1b53da8b', // etapa 14a
  'services/planosManutencao.js': 'e32588acaefd47c5cb93bbe0d70ab799', // etapa 12b.4
  'front:TelaPlanosManutencao.jsx': '5fd8c2a3a8c6fdfb599fb98fd9ccabff', // etapa 12b.3 + texto do botão alterado pelo Marcony (18/10)
  'front:ModalTransferirOS.jsx': '8e7c1bf0d6fc9a4f88bdd9087d22cb37', // etapa 12b.3 (novo)
  'routes/pessoas.js': 'fa47c93d26c6f74a2c87161ee748bd3e', // etapa 12h.1
  'services/documentos.js': 'e4e3f50ffd6ade91d5c2a51a0b115900', // etapa 12e.3
  'front:TelaPessoas.jsx': 'a1de0d4bd2e027eb278add820bcfe546', // etapa 12h.1
  // etapa 12c.1
  'services/avisosVencimento.js': 'e43d0373f61a7e12eccdcc5861cd0e6b', // etapa 12d.3
  'services/funcoes.js': '9873a5e1a74e7604ab6b624d1d7cc901', // etapa 12e.3.1
  'front:BibliotecaFuncoes.jsx': '9f5e1d8aba9b2e729cc4d546b4678712', // etapa 12e.3.1
  'services/epi.js': '9b0dccea86e23c7d5f3af1132159f0ee', // etapa 12d.1b
  'front:TelaEpi.jsx': 'f9a0279f2d8916f32549f4a3f7108438', // etapa 12d.3
  'front:BibliotecaEpi.jsx': 'e54d2c680ad3692518681de67bf00169', // etapa 12d.1b (novo)
  'services/epiEntregas.js': 'fec08c1dc85c386e57e5a01474871c8f', // etapa 12d.3
  'services/conformidade.js': '7194d1cb671096ee3fb63e2fd82364d8', // etapa 12e.3
  'front:GestaoEpi.jsx': '6c823820e98a6d78c736540aea8e67f8', // etapa 12d.3
  'front:AssinaturaTela.jsx': 'db713a14a03390f9072d06f1de697b90', // etapa 12d.2 (novo)
  'front:gerarFichaEpi.js': '1a5de92e2896fc8095784b082269b1a3', // etapa 12d.3
  'services/historicoFuncoes.js': 'e8460900c6f40ee55328c3aac638dffe', // etapa 12d.3 (novo)
  'services/avisosPessoas.js': '0b4702081b9c1e8dfb96d8bb5140e9a1', // etapa 14b.2
  'services/treinamentos.js': '7ce6b7d886e7b2036d5820f2113ba71a', // etapa 12e.2d
  'front:TelaTreinamentos.jsx': 'dbea7b15f5a26ae9083082344158e948', // etapa 12e.2d
  'front:gerarListaPresenca.js': 'db8967998f2a9b73299bde5dfb858e60', // etapa 12e.2b.3
  'migrations/031_treinamentos_conteudo_horas.sql': 'ec5ffd0cf4814b65add59c253be196fa', // etapa 12e.2a (novo)
  'front:BibliotecaTreinamentos.jsx': 'bc7bf51426be20050569f0beab486d19', // etapa 12e.2b
  'front:EditorConteudoTreinamento.jsx': 'a770330072bfc50fcf5f5e8ab5485d51', // etapa 12e.2b
  'services/provaOnline.js': 'fc0ee6d8a2ffd42bb2bf143e121e25da', // etapa 12e.2d
  'routes/meusTreinamentos.js': '2325068ee6d623683677fa3aee7947ab', // etapa 12e.2c
  'routes/provaPublica.js': '88db8424e165984224d9ff2550c27e06', // etapa 12e.2c
  'middleware/tenantMiddleware.js': '1915134215b1443b8a3e9c1f0f926886', // etapa 14b.3
  'migrations/032_prova_online_colaborador.sql': '89db0b8f09c60f29496ee58e87b5685f', // etapa 12e.2b (novo)
  'front:AreaTreinamentoColaborador.jsx': '99e0bc8564158e497d8ad57fb6f4a8a5', // etapa 12e.2d
  'front:TelaMeusTreinamentos.jsx': '4132dd9a42d3b6ab79264bdd6a1fe20c', // etapa 12e.2c
  'front:AcessoColaborador.jsx': '9c34d578c4b9a47bb5c801f69f805bf1', // etapa 12e.2b.1
  'front:TextoAula.jsx': '9bf737cb738368965db7ef010bbe27bc', // etapa 12e.2b (novo)
  'front:TelaProvaPublica.jsx': '49710bac997c6660ce0b1ce7b8da18f9', // etapa 12e.2d
  'front:gerarCertificado.js': '29860358a88203517163c34ffe2fdd6f', // etapa 12e.2c (novo)
  'services/competencias.js': 'fa5dfb050d6c1db23d83d66b8ec6b864', // etapa 12e.3.1
  'migrations/033_competencias.sql': '5a84726fdb2ad6fc09b8ca12353384e4', // etapa 12e.3 (novo)
  'front:FichaCompetencias.jsx': '0171395176a61ef358d7e72f9c193218', // etapa 12f
  'front:EditorCompetencias.jsx': '95b4124925cbbe1828920172d2ec0c18', // etapa 12e.3.1
  'migrations/034_competencias_nivel.sql': 'f83e415aca9dfaf839c945eaf59731a1', // etapa 12e.3.1 (novo)
  'services/dossie.js': '2e55efdd528616a71e5f69ad194a61ed', // etapa 12h.2
  'migrations/035_dossie.sql': '77312ba3492730a513939e6503636372', // etapa 12f (novo)
  'front:PainelDossie.jsx': '9d22ddbe580292cbb5511850719529b6', // etapa 12h
  'front:gerarDossie.js': '13459335332ae1f900c86c83447521fb', // etapa 12h.1
  'services/multas.js': '0865e57a9d15f1fb27b1c7b07365737a', // etapa 12g (novo)
  'migrations/036_multas.sql': 'b89f5e90964aa538404cccc85e2d4484', // etapa 12g (novo)
  'front:TelaMultas.jsx': '38927f697c5842df491c034a5c7dca0c', // etapa 12g (novo)
  'front:gerarTermoDesconto.js': '556e0547c4195aae0132ab55706fa88d', // etapa 12g (novo)
  'services/disciplinar.js': '07c6440a61f339446412ec7dc91c8e8b', // etapa 12h.2
  'migrations/037_disciplinar.sql': '57507e1c5a097a8dfec9a7084ad81445', // etapa 12h (novo)
  'front:TelaDisciplinar.jsx': '1ff10c2cfe0f76dcf58f69d3a0608c86', // etapa 12h.3
  'front:gerarMedidaDisciplinar.js': '7051c3dd01e88542e6fa9a034b581a50', // etapa 12h.2
  'migrations/038_disciplinar_ciencia.sql': '78d9a3a72385e12d2fc0a36d9b50afe8', // etapa 12h.1 (novo)
  'services/autuacoes.js': '598cb474272ff0f30755b5b57444b149', // etapa 12i (novo)
  'routes/autuacoes.js': 'bf16699ee770476707473186a882b353', // etapa 12i (novo)
  'migrations/039_autuacoes.sql': '22fd55f61f36a8e9daf3c22ea794cc6f', // etapa 12i (novo)
  'front:TelaAutuacoes.jsx': '877a3049d076cad5c1b82a727e18e36e', // etapa 12i.1
  'front:TelaNaoConformidades.jsx': 'eeaf572c39ce97d4bf77f7985c84867d', // etapa 12i.1
  'services/inspecoes.js': '077fdf45349ec6c627a2834a998b14e9', // etapa 14b.3
  'routes/inspecoes.js': '2957a18a385cfc150fad54cdf817b4ce', // etapa 14b.2
  'migrations/040_inspecoes.sql': '0ac35a83c9621397570d1be855727cc9', // etapa 14a (novo)
  'front:TelaInspecoes.jsx': '38ce3918bb74a58317fbfcb14ad63b52', // etapa 14b.3.1
  'front:ExecutarInspecao.jsx': 'a9febeec704e5acb0740ee4c086de395', // etapa 14b.1
  'front:EditorModeloInspecao.jsx': 'e6c58003b457832fb8343ea773ab4c9b', // etapa 14b.1
  'front:Esquemas.jsx': 'f68e56580c3ed088c902109fcb016b9c', // etapa 14a (novo)
  'front:BibliotecaInspecoes.jsx': '104cdfc0dca69548cd4d7ab86152a5cb', // etapa 14a (novo)
  'front:filaInspecoes.js': '908b1fc4fe5afa430ea0ea27fbdf28d6', // etapa 14a (novo)
  'front:gerarRelatorioInspecao.js': '120a698b9b663fc3605145065986306f', // etapa 14b.2
  'routes/inspecaoLink.js': 'e4f98c085d4ec2f7b0fa1556b267fa45', // etapa 14b.1 (novo)
  'migrations/041_inspecoes_tipos_links.sql': 'ddfd59d129a129f0ac2c3f7aef9f62aa', // etapa 14b.1 (novo)
  'front:TelaInspecaoPublica.jsx': '41f4af3384a6db56d3d13dcb0081f6d3', // etapa 14b.1 (novo)
  'routes/equipamentos.js': '2e379d0637f0c8501cbfbad41898ef30', // etapa 14b.1.1
  'services/rotinasInspecao.js': 'dd1eb4b6cbab339d7b41f85f831601d9', // etapa 14b.3
  'migrations/042_inspecoes_rotinas_locacao.sql': 'bf32500014ddf3f779f1fa29ead5feb9', // etapa 14b.2 (novo)
  'front:RotinasLocacao.jsx': '6373bfbf99adfa8d7f681f0a0875f8da', // etapa 14b.3
  'front:gerarRelatorioCumprimento.js': '53ec175b09fc20b29e755a4e4e2a9859', // etapa 14b.2 (novo)
  'services/contratosLocacao.js': '1e58bbc15f58bb42c2f4a0bc49cf5467', // etapa 14b.3.1
  'routes/contratos.js': '7f54ac577b2224e561fe424a62cd5e6d', // etapa 14b.3.1
  'routes/locatario.js': 'adf4f1c1a84ce07df00b1fea7390c721', // etapa 14b.3 (novo)
  'migrations/043_contratos_locatario.sql': 'f25735b281aa176b4c31c3cc2bf283ed', // etapa 14b.3 (novo)
  'front:TelaContratos.jsx': '3305eca4217bdc8472107a4dac79984d', // etapa 14b.3.1
  'front:TelaLocatario.jsx': '19c84709c870a48e6368fa93f8532592', // etapa 14b.3 (novo)
  'services/clientes.js': '9714283f0013553dc96a48b75b6734cf', // etapa 14b.3.1 (novo)
  'migrations/044_clientes.sql': '446d1a52049aea19938d36cc2b01653d', // etapa 14b.3.1 (novo)
  'front:Clientes.jsx': '862a066ffbc0d6b695df82c3a43f69c6', // etapa 14b.3.1 (novo)
};

// Antes de copiar a etapa 14b.3.1 — base: 14b.3
const ANTES = {
  'services/contratosLocacao.js': '96b70333f1aa7fc6c2a43a57ca191d3f',
  'routes/contratos.js': '27586a794b10a1eccc6ace5c488fceb6',
  'front:TelaContratos.jsx': '0c950a90e72bbaf74984ef4e32d52df4',
  'front:TelaInspecoes.jsx': '4e5ef96eb9dcec8bc102a7f335321efc',
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
  : '\nConferindo arquivos entregues (etapas 1, 3, 4, 6 a 14b.3.1)\n');

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
  const novos = ['services/fornecedoresVisiveis.js', 'services/atuacao.js', 'routes/atuacao.js', 'services/matchSpot.js', 'services/recomendacoesEmail.js', 'routes/recomendacoes.js', 'services/convitesFornecedor.js', 'services/acessoSpot.js', 'services/receitaCnpj.js', 'services/cadastroPublico.js', 'services/emailConfirmacao.js', 'routes/plataforma.js', 'services/plataformaConsole.js', 'middleware/plataformaMiddleware.js', 'scripts/criarAdmin.js', 'routes/manutencao.js', 'services/calendarioManutencao.js', 'services/planosManutencao.js', 'migrations/019_planos_manutencao.sql', 'migrations/020_plano_termino.sql', 'migrations/021_plano_responsavel_dia_util.sql', 'routes/pessoas.js', 'services/documentos.js', 'migrations/022_colaboradores_documentos.sql', 'services/avisosVencimento.js', 'migrations/023_documento_avisos.sql', 'services/funcoes.js', 'migrations/024_funcoes.sql', 'migrations/025_funcoes_detalhes.sql', 'services/epi.js', 'migrations/026_epi_itens.sql', 'migrations/027_epi_catalogo_tamanhos.sql', 'services/epiEntregas.js', 'services/conformidade.js', 'migrations/028_epi_entregas.sql', 'services/historicoFuncoes.js', 'services/avisosPessoas.js', 'migrations/029_historico_funcoes_avisos.sql', 'services/treinamentos.js', 'migrations/030_treinamentos.sql', 'migrations/031_treinamentos_conteudo_horas.sql', 'services/provaOnline.js', 'routes/meusTreinamentos.js', 'routes/provaPublica.js', 'migrations/032_prova_online_colaborador.sql', 'services/competencias.js', 'migrations/033_competencias.sql', 'migrations/034_competencias_nivel.sql', 'services/dossie.js', 'migrations/035_dossie.sql', 'services/multas.js', 'migrations/036_multas.sql', 'services/disciplinar.js', 'migrations/037_disciplinar.sql', 'migrations/038_disciplinar_ciencia.sql', 'services/autuacoes.js', 'routes/autuacoes.js', 'migrations/039_autuacoes.sql', 'services/inspecoes.js', 'routes/inspecoes.js', 'migrations/040_inspecoes.sql', 'routes/inspecaoLink.js', 'migrations/041_inspecoes_tipos_links.sql', 'services/rotinasInspecao.js', 'migrations/042_inspecoes_rotinas_locacao.sql', 'services/contratosLocacao.js', 'routes/contratos.js', 'routes/locatario.js', 'migrations/043_contratos_locatario.sql', 'services/clientes.js', 'migrations/044_clientes.sql'];
  try {
    for (const n of novos) {
      const rastreado = execFileSync('git', ['ls-files', n], { cwd: RAIZ, stdio: 'pipe' }).toString().trim();
      if (!rastreado) console.log(`\n⚠️  ${n} ainda não está no git (git add ${n})`);
    }
    for (const nome of ['SeletorAtuacao.jsx', 'TelaAceitarConvite.jsx', 'TelaPainelFornecedor.jsx', 'AvisoPlanoTenant.jsx', 'CampoTelefone.jsx', 'TelaConfirmarEmail.jsx', 'ConsolePlataforma.jsx', 'TelaCalendarioManutencao.jsx', 'TelaPlanosManutencao.jsx', 'ModalTransferirOS.jsx', 'TelaPessoas.jsx', 'BibliotecaTreinamentos.jsx', 'EditorConteudoTreinamento.jsx', 'AreaTreinamentoColaborador.jsx', 'TelaMeusTreinamentos.jsx', 'AcessoColaborador.jsx', 'TextoAula.jsx', 'TelaProvaPublica.jsx', 'gerarCertificado.js', 'FichaCompetencias.jsx', 'EditorCompetencias.jsx', 'PainelDossie.jsx', 'gerarDossie.js', 'TelaMultas.jsx', 'gerarTermoDesconto.js', 'TelaDisciplinar.jsx', 'gerarMedidaDisciplinar.js', 'TelaAutuacoes.jsx', 'TelaInspecoes.jsx', 'ExecutarInspecao.jsx', 'EditorModeloInspecao.jsx', 'Esquemas.jsx', 'BibliotecaInspecoes.jsx', 'filaInspecoes.js', 'gerarRelatorioInspecao.js', 'TelaInspecaoPublica.jsx', 'RotinasLocacao.jsx', 'gerarRelatorioCumprimento.js', 'TelaContratos.jsx', 'TelaLocatario.jsx', 'Clientes.jsx']) {
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