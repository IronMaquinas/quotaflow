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
  'services/CotacaoService.js': '96c32c9c13d4082dd80861780a33f9d3', // etapa 14e
  'services/fornecedoresVisiveis.js': '8c1fa18647fa44b05b4865491067a0c0',
  'routes/cotacoes.js': '51eb4fc398221c2caf21a2ac1c144ada', // etapa 14e
  'routes/naoConformidades.js': '4f27a368d0e2d4ff921a173c98347cea',
  'routes/ordensVenda.js': 'ba32842c49096f072788b51d10248ca4',
  'routes/estoque/movimentacoes.js': '636ba22ab821d3fc0565cc03ff821a64', // etapa 14e
  'routes/estoque/itensConsumo.js': '47011b41ff3d33ac8ad31954084c2321',
  'services/NCService.js': 'a9432a05c6bfb78719497119235bbe44',
  'services/PortalRespostaService.js': 'aff8546f40f10b238354651e8b17aefb',
  'services/ValidacaoXmlService.js': 'a8e0f2180da6f621272f70fb80a2b8e3',
  // etapa 4 (inclui arquivos já mexidos nas etapas 1 e 3)
  'routes/fornecedores.js': 'b0c0f9dc2bf58ad8158b53d8c243abcc', // etapa 10c
  'routes/auth.js': '7f20a132bb942547729b455eacef3123', // etapa 14d.4
  'services/convitesFornecedor.js': 'e3d3837cb171b57e7d5200d9971df968', // etapa 11a.3
  'routes/spot.js': 'ee346546f49efb3552b0d4048513f26b', // etapa 11a
  'services/matchSpot.js': 'fe4275090b82bd1efd52498d2176a90c', // etapa 7
  'routes/configuracoes.js': '15db7301efaf467ea431962fd1aa6ba2', // etapa 14d.5
  'routes/fornecedor.js': '9e06852242b8bf79c6384c46b8ee7bb5', // etapa 14e
  'routes/recomendacoes.js': '8500494a042a04d4bf97ad6b42b14fe0', // etapa 14e
  'services/recomendacoesEmail.js': '7bc5475ccffb4fd2fcec53be78e64123', // etapa 10c
  'services/emailService.js': '2daf0e597ff370e006585f919c63b525', // etapa 9
  'server.js': '46f8fb1849a7a265753405cb26c11000', // etapa 17a
  'routes/atuacao.js': 'cc196661189e2714bcfad96e5c1e8ad9',
  'services/atuacao.js': '8509ac0206906a7f93384350e77132bf',
  'front:SeletorAtuacao.jsx': '17afaaf69d6e4cf0c105490267d188a7',
  'front:TelaMeusDadosFornecedor.jsx': '1e8cc8a63de4debf1530042e511732f9', // etapa 14e
  'front:TelaFornecedoresNova.jsx': '28396f3bc910190ecc80873b54edc47d', // etapa 10c
  'front:TelaCanalSpot.jsx': 'd701f0a4ac0cff3a5803de6809471d08', // etapa 11a
  'front:TelaFornecedorSpot.jsx': '449dd00ab481e0596a932aaa985f4bad', // etapa 9
  'front:TelaFornecedor.jsx': '9be19756312b995ad143cc0bf315d90a', // etapa 11b
  'front:TelaPainelFornecedor.jsx': 'e9742a3e808ba27df5d5f29a393b8da6', // etapa 10c
  'front:TelaAceitarConvite.jsx': '8aefac39a8a1f4f94c17d2d26f8d53c0', // etapa 11a.3
  'front:main.jsx': '66a29b53c33b5e8fd81feda7b99209a4', // etapa 16c
  'front:TelaConfiguracoes.jsx': 'e50900dd8d7305f85025025fe1a006a8', // etapa 14d.5
  'services/acessoSpot.js': '6ecce4d16d6b123c6ce93c1223b32f01', // etapa 10c (novo)
  'services/receitaCnpj.js': 'b0e2a678127403d5608723c21ec61b78', // etapa 14d.5
  'services/cadastroPublico.js': '1359e67ff1f2438a964eee7223cf2ed1', // etapa 14d.5
  'front:App.jsx': '6bcc9347a28d2b437a2154a59200cda8', // etapa 17a.1
  'front:TelaLogin.jsx': 'bfa1fccbdab99820be2ac14c0e91b2fe', // etapa 14b.1
  'front:TelaSignup.jsx': '345dceefb937b38e74cfef44cfc33ef3', // etapa 11a.3
  'front:AvisoPlanoTenant.jsx': '5795f00c1bc656d0525fd29b6793a96c', // etapa 11a.3
  'services/emailConfirmacao.js': 'e36296d648d6f76f6412d7de0e10c4d8', // etapa 11a.3 (novo)
  'front:CampoTelefone.jsx': 'c0699f00b06c84098af121acd5d8682f', // etapa 14d.4
  'front:TelaConfirmarEmail.jsx': 'dbf759fd98f257a436cfe47874c72d9f', // etapa 11a.3 (novo)
  'routes/plataforma.js': '2e3387fd5be33389e5f55d0eba2d0914', // etapa 14e
  'services/plataformaConsole.js': '47e9e1ebcd51b79c0c50c9a17ba35f1a', // etapa 14b.3
  'middleware/plataformaMiddleware.js': 'bf2424eab233bdf7e0cb6fca9cb953b9', // etapa 11b (novo)
  'scripts/criarAdmin.js': 'd4d85894f6381dc7b31f83466f316024', // etapa 11b (novo)
  'front:ConsolePlataforma.jsx': '7a76f67f9377f9e2ae2b4cec9e41d4fa', // etapa 14e.1
  'routes/manutencao.js': '615fa12637ae7b454c52b99c054e617b', // etapa 14b.2
  'services/calendarioManutencao.js': 'bbcf04d1bb3b18b8776579d3180274e6', // etapa 12b.2
  'front:TelaCalendarioManutencao.jsx': '8d9921e2e15255472f0c62687c5f37b0', // etapa 14b.2
  'front:TelaOrdemServico.jsx': 'df80c9f9787e8f542e9558aa1b53da8b', // etapa 14a
  'services/planosManutencao.js': 'e32588acaefd47c5cb93bbe0d70ab799', // etapa 12b.4
  'front:TelaPlanosManutencao.jsx': '5fd8c2a3a8c6fdfb599fb98fd9ccabff', // etapa 12b.3 + texto do botão alterado pelo Marcony (18/10)
  'front:ModalTransferirOS.jsx': '8e7c1bf0d6fc9a4f88bdd9087d22cb37', // etapa 12b.3 (novo)
  'routes/pessoas.js': 'fa47c93d26c6f74a2c87161ee748bd3e', // etapa 12h.1
  'services/documentos.js': 'e4e3f50ffd6ade91d5c2a51a0b115900', // etapa 12e.3
  'front:TelaPessoas.jsx': '7380e3b38768781c2fef02c624c9e201', // etapa 14c.1
  // etapa 12c.1
  'services/avisosVencimento.js': 'fec2b28a7081f59510ef21b728a6c341', // etapa 14e
  'services/funcoes.js': '9873a5e1a74e7604ab6b624d1d7cc901', // etapa 12e.3.1
  'front:BibliotecaFuncoes.jsx': '9f5e1d8aba9b2e729cc4d546b4678712', // etapa 12e.3.1
  'services/epi.js': '9b0dccea86e23c7d5f3af1132159f0ee', // etapa 12d.1b
  'front:TelaEpi.jsx': 'f9a0279f2d8916f32549f4a3f7108438', // etapa 12d.3
  'front:BibliotecaEpi.jsx': 'e54d2c680ad3692518681de67bf00169', // etapa 12d.1b (novo)
  'services/epiEntregas.js': 'fec08c1dc85c386e57e5a01474871c8f', // etapa 12d.3
  'services/conformidade.js': '7194d1cb671096ee3fb63e2fd82364d8', // etapa 12e.3
  'front:GestaoEpi.jsx': '6c823820e98a6d78c736540aea8e67f8', // etapa 12d.3
  'front:AssinaturaTela.jsx': 'db713a14a03390f9072d06f1de697b90', // etapa 12d.2 (novo)
  'front:gerarFichaEpi.js': '1926fe16c45ad648ef986f6bbb97a824', // etapa 14c.2
  'services/historicoFuncoes.js': 'e8460900c6f40ee55328c3aac638dffe', // etapa 12d.3 (novo)
  'services/avisosPessoas.js': '0b4702081b9c1e8dfb96d8bb5140e9a1', // etapa 14b.2
  'services/treinamentos.js': '7ce6b7d886e7b2036d5820f2113ba71a', // etapa 12e.2d
  'front:TelaTreinamentos.jsx': '255c8ddca330a11ec39653b4718c6b44', // etapa 14c.2
  'front:gerarListaPresenca.js': '35770dafbe33aca8992c169d93745e9e', // etapa 14c.1
  'migrations/031_treinamentos_conteudo_horas.sql': 'ec5ffd0cf4814b65add59c253be196fa', // etapa 12e.2a (novo)
  'front:BibliotecaTreinamentos.jsx': 'bc7bf51426be20050569f0beab486d19', // etapa 12e.2b
  'front:EditorConteudoTreinamento.jsx': 'a770330072bfc50fcf5f5e8ab5485d51', // etapa 12e.2b
  'services/provaOnline.js': 'fc0ee6d8a2ffd42bb2bf143e121e25da', // etapa 12e.2d
  'routes/meusTreinamentos.js': '2325068ee6d623683677fa3aee7947ab', // etapa 12e.2c
  'routes/provaPublica.js': '88db8424e165984224d9ff2550c27e06', // etapa 12e.2c
  'middleware/tenantMiddleware.js': '95a77fe216e5baad7387b827aab7a060', // etapa 17a
  'migrations/032_prova_online_colaborador.sql': '89db0b8f09c60f29496ee58e87b5685f', // etapa 12e.2b (novo)
  'front:AreaTreinamentoColaborador.jsx': '99e0bc8564158e497d8ad57fb6f4a8a5', // etapa 12e.2d
  'front:TelaMeusTreinamentos.jsx': '4132dd9a42d3b6ab79264bdd6a1fe20c', // etapa 12e.2c
  'front:AcessoColaborador.jsx': '9c34d578c4b9a47bb5c801f69f805bf1', // etapa 12e.2b.1
  'front:TextoAula.jsx': '9bf737cb738368965db7ef010bbe27bc', // etapa 12e.2b (novo)
  'front:TelaProvaPublica.jsx': '49710bac997c6660ce0b1ce7b8da18f9', // etapa 12e.2d
  'front:gerarCertificado.js': 'afd7fd6e2453bfab32f19fc6a9a7a7aa', // etapa 14c.1
  'services/competencias.js': 'fa5dfb050d6c1db23d83d66b8ec6b864', // etapa 12e.3.1
  'migrations/033_competencias.sql': '5a84726fdb2ad6fc09b8ca12353384e4', // etapa 12e.3 (novo)
  'front:FichaCompetencias.jsx': '4b6dcf908570d5a08ad5677f0fa21449', // etapa 14c.1
  'front:EditorCompetencias.jsx': '95b4124925cbbe1828920172d2ec0c18', // etapa 12e.3.1
  'migrations/034_competencias_nivel.sql': 'f83e415aca9dfaf839c945eaf59731a1', // etapa 12e.3.1 (novo)
  'services/dossie.js': '2e55efdd528616a71e5f69ad194a61ed', // etapa 12h.2
  'migrations/035_dossie.sql': '77312ba3492730a513939e6503636372', // etapa 12f (novo)
  'front:PainelDossie.jsx': '9d22ddbe580292cbb5511850719529b6', // etapa 12h
  'front:gerarDossie.js': 'bfc589f3755b697c4e7f05525589f525', // etapa 14c.2
  'services/multas.js': '0865e57a9d15f1fb27b1c7b07365737a', // etapa 12g (novo)
  'migrations/036_multas.sql': 'b89f5e90964aa538404cccc85e2d4484', // etapa 12g (novo)
  'front:TelaMultas.jsx': 'f3e8b1c1925f2347f6a6987149485b60', // etapa 14c.1
  'front:gerarTermoDesconto.js': '5847f394eae27eef19c87b6371be1f2e', // etapa 14c.2
  'services/disciplinar.js': '07c6440a61f339446412ec7dc91c8e8b', // etapa 12h.2
  'migrations/037_disciplinar.sql': '57507e1c5a097a8dfec9a7084ad81445', // etapa 12h (novo)
  'front:TelaDisciplinar.jsx': '3baf053317820e315a81ac7fa73fa701', // etapa 14c.1
  'front:gerarMedidaDisciplinar.js': 'eeb53a7e0b81696bcbf3bda8b22242a6', // etapa 14c.2
  'migrations/038_disciplinar_ciencia.sql': '78d9a3a72385e12d2fc0a36d9b50afe8', // etapa 12h.1 (novo)
  'services/autuacoes.js': '598cb474272ff0f30755b5b57444b149', // etapa 12i (novo)
  'routes/autuacoes.js': 'bf16699ee770476707473186a882b353', // etapa 12i (novo)
  'migrations/039_autuacoes.sql': '22fd55f61f36a8e9daf3c22ea794cc6f', // etapa 12i (novo)
  'front:TelaAutuacoes.jsx': '950f7b2d5e24f583eaf04c5bf023e2f5', // etapa 14c.1
  'front:TelaNaoConformidades.jsx': 'eeaf572c39ce97d4bf77f7985c84867d', // etapa 12i.1
  'services/inspecoes.js': '3b00611497483ab193b9ebeb8308e9fe', // etapa 16e.4
  'routes/inspecoes.js': '2957a18a385cfc150fad54cdf817b4ce', // etapa 14b.2
  'migrations/040_inspecoes.sql': '0ac35a83c9621397570d1be855727cc9', // etapa 14a (novo)
  'front:TelaInspecoes.jsx': '38ce3918bb74a58317fbfcb14ad63b52', // etapa 14b.3.1
  'front:ExecutarInspecao.jsx': 'adce6696647fc3af408b3a7bd5c2baad', // etapa 16e.4
  'front:EditorModeloInspecao.jsx': '00fc0578bd4bcba1221b7ced983727dd', // etapa 14c.1
  'front:Esquemas.jsx': 'f68e56580c3ed088c902109fcb016b9c', // etapa 14a (novo)
  'front:BibliotecaInspecoes.jsx': '104cdfc0dca69548cd4d7ab86152a5cb', // etapa 14a (novo)
  'front:filaInspecoes.js': '908b1fc4fe5afa430ea0ea27fbdf28d6', // etapa 14a (novo)
  'front:gerarRelatorioInspecao.js': '53a655d7f3fe94d2efa61abfc4e35385', // etapa 14c.1
  'routes/inspecaoLink.js': 'e4f98c085d4ec2f7b0fa1556b267fa45', // etapa 14b.1 (novo)
  'migrations/041_inspecoes_tipos_links.sql': 'ddfd59d129a129f0ac2c3f7aef9f62aa', // etapa 14b.1 (novo)
  'front:TelaInspecaoPublica.jsx': '41f4af3384a6db56d3d13dcb0081f6d3', // etapa 14b.1 (novo)
  'routes/equipamentos.js': '2e379d0637f0c8501cbfbad41898ef30', // etapa 14b.1.1
  'services/rotinasInspecao.js': 'dd1eb4b6cbab339d7b41f85f831601d9', // etapa 14b.3
  'migrations/042_inspecoes_rotinas_locacao.sql': 'bf32500014ddf3f779f1fa29ead5feb9', // etapa 14b.2 (novo)
  'front:RotinasLocacao.jsx': '333c70f5e477c4d998443062f335e477', // etapa 14d.7
  'front:gerarRelatorioCumprimento.js': 'd4b916c75f0a4290ccd9c96bf170ed90', // etapa 14c.1
  'services/contratosLocacao.js': '4e1f82194974bda0d16368be17f6672f', // etapa 14d.6
  'routes/contratos.js': '2bb8bfd56d90ca8f610c8205f0cff251', // etapa 14d.6
  'routes/locatario.js': '53e5281ebe17af15c383451f452c61ca', // etapa 14d.2
  'migrations/043_contratos_locatario.sql': 'f25735b281aa176b4c31c3cc2bf283ed', // etapa 14b.3 (novo)
  'front:TelaContratos.jsx': 'e2680a91a14d7c9eb30099241cd8afc6', // etapa 14d.7
  'front:TelaLocatario.jsx': 'bb111fbd38bfaa663465b54f8ee24c42', // etapa 14d.2
  'services/clientes.js': '9714283f0013553dc96a48b75b6734cf', // etapa 14b.3.1 (novo)
  'migrations/044_clientes.sql': '446d1a52049aea19938d36cc2b01653d', // etapa 14b.3.1 (novo)
  'front:Clientes.jsx': '8dff871d3b22f31e8f33a65c2f1260a7', // etapa 15a
  'routes/usuarios.js': '428540bd51a9e43440358c7551467616', // etapa 15a
  'services/logoEmpresa.js': '48b3a98d98cf855140345b864111f6c0', // etapa 14c.1
  'migrations/045_logo_empresa.sql': '87eeade651cc3f724b7228bf57bb3670', // etapa 14c.1
  'front:LogoEmpresa.jsx': 'cab8af3905485a4d3fb77d528b24760b', // etapa 14c.1
  'front:logoEmpresa.js': 'd4a9118674d42a897c58aaea954dc6d2', // etapa 14d.2
  'front:comprimirImagem.js': 'b6d05cca4906e19250268c29f633f044', // etapa 14c.1 (novo)
  'front:gerarPdfNC.js': 'fe4db00132dc6c626027e234e1f5f366', // etapa 14c.2
  'services/contratoModelos.js': '966e8b4fd2714a10868a173ca5b84e9b', // etapa 14d.7
  'migrations/046_modelos_contrato.sql': '0b06982d731ce6038a679a7cc7e21785', // etapa 14d.2
  'front:ModelosContrato.jsx': '7420fdd0821fdc18e8743d46430726c5', // etapa 14d.6
  'front:gerarContrato.js': '61918b643427ea861a255ca249fcb68d', // etapa 14d.7
  'front:BibliotecaContratos.jsx': 'ea69d4f5771b64870eabd53c83f18a8a', // etapa 14d.2
  'front:CampoMoeda.jsx': 'e67cbfc98693ab1ea2df84d091974ca9', // etapa 14d.2
  'migrations/047_contrato_representante.sql': '4769ba9b69f785a61c1f4e940e0cf9c2', // etapa 14d.3 (novo)
  'migrations/048_dados_empresa.sql': '7ea2ae571acb59f58a60fda64901f354', // etapa 14d.4 (novo)
  'front:DadosEmpresa.jsx': 'ece10925cc152c6b1d529d86d1e14857', // etapa 16e.3
  'services/perfilEmpresa.js': 'e6456e14ecf22336dddc3d437ced0164', // etapa 16e.3
  'migrations/049_perfil_empresa_cnpj.sql': 'ccaebbe974c2ea5d1089712bccd13263', // etapa 14d.5 (novo)
  'front:CompletarPerfil.jsx': '4d8ac0f25d36ba667d6f4fddf71118f8', // etapa 14d.5 (novo)
  'migrations/050_monitor_cnpj.sql': 'f4c0e70224ff25ef87376a7782ccde8a', // etapa 14e (novo)
  'services/monitorCnpj.js': 'ab130da71f1eae5ec0959cd2fd079d59', // etapa 14e.1
  'routes/monitorCnpj.js': '44a9c0605a68a8873468496ac652cd02', // etapa 14e (novo)
  'front:cotacoesService.js': 'fd42c81ed12dbb4e7d9fa20b03c22767', // etapa 14e
  'front:TelaMonitorarRespostas.jsx': '2e29288fda23cfcb8acd4584c7dfb8dd', // etapa 14e
  'front:TelaCotacoesNovaComAbas.jsx': 'eaf917e126f9d0742b9780be21b80e9a', // etapa 15a
  'front:TelaRecebimento.jsx': 'b441323654332068311aba5ce9188d78', // etapa 14e
  'front:CnpjsPlataforma.jsx': '0663f0bd670edb45ff9ae8d2c2ef6a09', // etapa 14e.1
  'front:ModalJustificativaCnpj.jsx': '13d5e39c961c4e775fde24c77e4fb7ff', // etapa 14e (novo)
  'front:TelaMonitorCnpj.jsx': '7d9525d956277c38774adf199a1cf76e', // etapa 14e.2
  'front:TelaOrdensVenda.jsx': 'e3fadc9d3c6ae4be1a2f14c693523f13', // etapa 14e.2
  'front:TelaUsuariosNova.jsx': 'd7d98c07839cc133077532dd7022c751', // etapa 15a
  'migrations/051_comercial_bid.sql': '65c3c268119eadac6a0ecda34b72197c', // etapa 15a (novo)
  'routes/comercial.js': 'ff61e548b33259099336d900a65c12bb', // etapa 16a
  'services/bids.js': '420fd93697384f911bdb1b474874fddd', // etapa 16d
  'front:FichaBid.jsx': '7a7a62a1501ab2be296e7cb3a244c3eb', // etapa 16d
  'front:ModelosBid.jsx': 'fce825c9584b3ff4a2a1040d575de24c', // etapa 15a (novo)
  'front:TelaComercial.jsx': '34b82e458ef12c73c85b85e5da66dfa0', // etapa 15c.2
  'front:gerarBid.js': '22e048e4f81d260222995d4607127c72', // etapa 16d
  'migrations/052_bid_cliente.sql': 'a8b6f934576474b54a7246fda86d3eda', // etapa 15b (novo)
  'routes/bidLink.js': 'e566a5246b48e24430a997fda8d32e27', // etapa 15b (novo)
  'services/bidsCliente.js': 'eb8e5a254090027082f0ac520c5f92aa', // etapa 16d
  'front:TelaBidPublica.jsx': 'b4ac367ec733727d25699230beb5d64a', // etapa 16d
  'front:EnviarBid.jsx': '4d97c008534b17bcf66a71f186b4f31a', // etapa 15b.3
  'migrations/053_pedidos_venda.sql': '4036d7fd11c94032774e96372e098942', // etapa 15c (novo)
  'services/pedidosVenda.js': '879c053b0e23658cba36361d8c157a5a', // etapa 16d
  'front:FichaPedido.jsx': '798337dbd7ba34cc802f8d1bfb40a1b3', // etapa 16d
  'migrations/054_tarefa_atribuida.sql': '586bd43f09653a76e8d6a299e55905e3', // etapa 15c.1 (novo)
  'scripts/previaEmailsBid.js': '45b4dbeb2d2d8d84a24e7a31f6826049', // etapa 15c.3 (novo)
  'migrations/055_execucoes_at.sql': 'fc0a780d147f0b3d7e4c92ec71c4554f', // etapa 16a (novo)
  'services/execucoes.js': 'f68de3a794420d9d4308cd01bae84edd', // etapa 17a
  'routes/programacao.js': 'e0067d5c447eb0ee218ad0ecccf8d0b3', // etapa 16e
  'front:gerarAT.js': 'd05187877f31e92708abba3c7f338ce3', // etapa 16e.1
  'front:TelaProgramacao.jsx': '906dd121764d8cee618e2c5b15b56135', // etapa 16d
  'front:FichaAT.jsx': 'e26921c6517c9b85f0d721b7afe43566', // etapa 16e.1
  'front:MesaProgramacao.jsx': '860f46af7a17ee4148bbbcf072b23525', // etapa 16e
  'migrations/056_at_rascunho_link_motorista.sql': '4e9a9185cbb0a1f9770e1fe666fc77f3', // etapa 16c (novo)
  'routes/atLink.js': 'f392ea4dff57d96bc2209bfefdb1707f', // etapa 16e
  'front:EditorAT.jsx': '0631841e7d2d934f37b007408a85a6e1', // etapa 16e.1
  'front:VerArquivo.jsx': 'f429078383f02f0c072637250e7a1fea', // etapa 16c (novo)
  'front:TelaATPublica.jsx': '73116fc205a6f572e987ecdccc44fc93', // etapa 17a
  'services/fluxoViagem.js': '1eeeb43378e4fd6f975840ae73b71bc5', // etapa 16e.4
  'migrations/057_fluxo_viagem.sql': '42cdc0800d3c622f541639bada16b252', // etapa 16e (novo)
  'front:EditorFluxo.jsx': 'eadf4403ff94cd4dad1cf4c98d581dbe', // etapa 16e.1
  'migrations/058_base_frota.sql': '726daccca8ec58b7bc09dc7ff3a57cf6', // etapa 16e.3 (novo)
  'routes/minhasViagens.js': '2839f5aad536209ef2465538599ce957', // etapa 17a (novo)
  'front:TelaMinhasViagens.jsx': '522b50f6a1971283d451e6d23bc41f2f', // etapa 17a (novo)
};

// Antes de copiar a etapa 17a.1 — base: 17a
const ANTES = {
  'front:App.jsx': 'a6271ec30a4c53bb13bf59cb3a9117fd',
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
  ? '\nANTES de copiar — os arquivos atuais são a base usada nesta etapa?\n'
  : '\nConferindo arquivos entregues (etapas 1, 3, 4, 6 a 17a.1)\n');

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
  const novos = ['services/fornecedoresVisiveis.js', 'services/atuacao.js', 'routes/atuacao.js', 'services/matchSpot.js', 'services/recomendacoesEmail.js', 'routes/recomendacoes.js', 'services/convitesFornecedor.js', 'services/acessoSpot.js', 'services/receitaCnpj.js', 'services/cadastroPublico.js', 'services/emailConfirmacao.js', 'routes/plataforma.js', 'services/plataformaConsole.js', 'middleware/plataformaMiddleware.js', 'scripts/criarAdmin.js', 'routes/manutencao.js', 'services/calendarioManutencao.js', 'services/planosManutencao.js', 'migrations/019_planos_manutencao.sql', 'migrations/020_plano_termino.sql', 'migrations/021_plano_responsavel_dia_util.sql', 'routes/pessoas.js', 'services/documentos.js', 'migrations/022_colaboradores_documentos.sql', 'services/avisosVencimento.js', 'migrations/023_documento_avisos.sql', 'services/funcoes.js', 'migrations/024_funcoes.sql', 'migrations/025_funcoes_detalhes.sql', 'services/epi.js', 'migrations/026_epi_itens.sql', 'migrations/027_epi_catalogo_tamanhos.sql', 'services/epiEntregas.js', 'services/conformidade.js', 'migrations/028_epi_entregas.sql', 'services/historicoFuncoes.js', 'services/avisosPessoas.js', 'migrations/029_historico_funcoes_avisos.sql', 'services/treinamentos.js', 'migrations/030_treinamentos.sql', 'migrations/031_treinamentos_conteudo_horas.sql', 'services/provaOnline.js', 'routes/meusTreinamentos.js', 'routes/provaPublica.js', 'migrations/032_prova_online_colaborador.sql', 'services/competencias.js', 'migrations/033_competencias.sql', 'migrations/034_competencias_nivel.sql', 'services/dossie.js', 'migrations/035_dossie.sql', 'services/multas.js', 'migrations/036_multas.sql', 'services/disciplinar.js', 'migrations/037_disciplinar.sql', 'migrations/038_disciplinar_ciencia.sql', 'services/autuacoes.js', 'routes/autuacoes.js', 'migrations/039_autuacoes.sql', 'services/inspecoes.js', 'routes/inspecoes.js', 'migrations/040_inspecoes.sql', 'routes/inspecaoLink.js', 'migrations/041_inspecoes_tipos_links.sql', 'services/rotinasInspecao.js', 'migrations/042_inspecoes_rotinas_locacao.sql', 'services/contratosLocacao.js', 'routes/contratos.js', 'routes/locatario.js', 'migrations/043_contratos_locatario.sql', 'services/clientes.js', 'migrations/044_clientes.sql', 'services/logoEmpresa.js', 'migrations/045_logo_empresa.sql', 'services/contratoModelos.js', 'migrations/046_modelos_contrato.sql', 'migrations/047_contrato_representante.sql', 'migrations/048_dados_empresa.sql', 'services/perfilEmpresa.js', 'migrations/049_perfil_empresa_cnpj.sql', 'migrations/050_monitor_cnpj.sql', 'services/monitorCnpj.js', 'routes/monitorCnpj.js', 'migrations/051_comercial_bid.sql', 'routes/comercial.js', 'services/bids.js', 'migrations/052_bid_cliente.sql', 'routes/bidLink.js', 'services/bidsCliente.js', 'migrations/053_pedidos_venda.sql', 'services/pedidosVenda.js', 'migrations/054_tarefa_atribuida.sql', 'scripts/previaEmailsBid.js', 'migrations/055_execucoes_at.sql', 'services/execucoes.js', 'routes/programacao.js', 'migrations/056_at_rascunho_link_motorista.sql', 'routes/atLink.js', 'services/fluxoViagem.js', 'migrations/057_fluxo_viagem.sql', 'migrations/058_base_frota.sql', 'routes/minhasViagens.js'];
  try {
    for (const n of novos) {
      const rastreado = execFileSync('git', ['ls-files', n], { cwd: RAIZ, stdio: 'pipe' }).toString().trim();
      if (!rastreado) console.log(`\n⚠️  ${n} ainda não está no git (git add ${n})`);
    }
    for (const nome of ['SeletorAtuacao.jsx', 'TelaAceitarConvite.jsx', 'TelaPainelFornecedor.jsx', 'AvisoPlanoTenant.jsx', 'CampoTelefone.jsx', 'TelaConfirmarEmail.jsx', 'ConsolePlataforma.jsx', 'TelaCalendarioManutencao.jsx', 'TelaPlanosManutencao.jsx', 'ModalTransferirOS.jsx', 'TelaPessoas.jsx', 'BibliotecaTreinamentos.jsx', 'EditorConteudoTreinamento.jsx', 'AreaTreinamentoColaborador.jsx', 'TelaMeusTreinamentos.jsx', 'AcessoColaborador.jsx', 'TextoAula.jsx', 'TelaProvaPublica.jsx', 'gerarCertificado.js', 'FichaCompetencias.jsx', 'EditorCompetencias.jsx', 'PainelDossie.jsx', 'gerarDossie.js', 'TelaMultas.jsx', 'gerarTermoDesconto.js', 'TelaDisciplinar.jsx', 'gerarMedidaDisciplinar.js', 'TelaAutuacoes.jsx', 'TelaInspecoes.jsx', 'ExecutarInspecao.jsx', 'EditorModeloInspecao.jsx', 'Esquemas.jsx', 'BibliotecaInspecoes.jsx', 'filaInspecoes.js', 'gerarRelatorioInspecao.js', 'TelaInspecaoPublica.jsx', 'RotinasLocacao.jsx', 'gerarRelatorioCumprimento.js', 'TelaContratos.jsx', 'TelaLocatario.jsx', 'Clientes.jsx', 'LogoEmpresa.jsx', 'logoEmpresa.js', 'comprimirImagem.js', 'ModelosContrato.jsx', 'gerarContrato.js', 'BibliotecaContratos.jsx', 'CampoMoeda.jsx', 'DadosEmpresa.jsx', 'CompletarPerfil.jsx', 'CnpjsPlataforma.jsx', 'ModalJustificativaCnpj.jsx', 'TelaMonitorCnpj.jsx', 'FichaBid.jsx', 'ModelosBid.jsx', 'TelaComercial.jsx', 'gerarBid.js', 'TelaBidPublica.jsx', 'EnviarBid.jsx', 'FichaPedido.jsx', 'gerarAT.js', 'TelaProgramacao.jsx', 'FichaAT.jsx', 'MesaProgramacao.jsx', 'EditorAT.jsx', 'VerArquivo.jsx', 'TelaATPublica.jsx', 'EditorFluxo.jsx', 'TelaMinhasViagens.jsx']) {
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
  if (fs.existsSync(server) && !/routes\/bidLink/.test(fs.readFileSync(server, 'utf8'))) {
    falhas++;
    console.log("\n✗ server.js não registra o link do cliente do BID (etapa 15b).");
  }
  if (fs.existsSync(server) && !/routes\/minhasViagens/.test(fs.readFileSync(server, 'utf8'))) {
    falhas++;
    console.log("\n✗ server.js não registra Minhas viagens (etapa 17a).");
  }
  if (fs.existsSync(server) && !/routes\/atLink/.test(fs.readFileSync(server, 'utf8'))) {
    falhas++;
    console.log("\n✗ server.js não registra o link do motorista (etapa 16c).");
  }
  if (fs.existsSync(server) && !/routes\/programacao/.test(fs.readFileSync(server, 'utf8'))) {
    falhas++;
    console.log("\n✗ server.js não registra a rota da Programação (etapa 16a).");
  }
  if (fs.existsSync(server) && !/routes\/comercial/.test(fs.readFileSync(server, 'utf8'))) {
    falhas++;
    console.log("\n✗ server.js não registra a rota do Comercial (etapa 15a).");
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