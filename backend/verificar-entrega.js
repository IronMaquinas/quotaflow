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
//   2. conteúdo idêntico ao entregue (ignora linhas em branco no começo/fim e CRLF do Windows)
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
  'routes/naoConformidades.js': '4a680ca138baaaf951938362185078f3', // etapa A1.1
  'routes/ordensVenda.js': 'ba32842c49096f072788b51d10248ca4',
  'routes/estoque/movimentacoes.js': '636ba22ab821d3fc0565cc03ff821a64', // etapa 14e
  'routes/estoque/itensConsumo.js': '47011b41ff3d33ac8ad31954084c2321',
  'services/NCService.js': 'a9432a05c6bfb78719497119235bbe44',
  'services/PortalRespostaService.js': 'aff8546f40f10b238354651e8b17aefb',
  'services/ValidacaoXmlService.js': 'e5160c1467aca39c3e8c67682c4a2e24', // etapa 18zd
  // etapa 4 (inclui arquivos já mexidos nas etapas 1 e 3)
  'routes/fornecedores.js': 'b0c0f9dc2bf58ad8158b53d8c243abcc', // etapa 10c
  'routes/auth.js': '7f20a132bb942547729b455eacef3123', // etapa 14d.4
  'services/convitesFornecedor.js': 'e3d3837cb171b57e7d5200d9971df968', // etapa 11a.3
  'routes/spot.js': 'f63f86d2a7ec88f7bd6a139cce046a2d', // etapa 18q
  'services/matchSpot.js': 'fe4275090b82bd1efd52498d2176a90c', // etapa 7
  'routes/configuracoes.js': '73570cdc07dea4449770588984d7fa4f', // etapa 18g.4
  'routes/fornecedor.js': '4e22d1aeeec3383e60b4805ff388dcd3', // etapa 18m
  'routes/recomendacoes.js': '05628793a30bc9cc5905c137c90fdb9c', // etapa 18g.2d
  'services/recomendacoesEmail.js': '7bc5475ccffb4fd2fcec53be78e64123', // etapa 10c
  'services/emailService.js': '2daf0e597ff370e006585f919c63b525', // etapa 9
  'server.js': '9380adbbc89bb47c8ab381b509230a6b', // etapa E1
  'routes/atuacao.js': 'cc196661189e2714bcfad96e5c1e8ad9',
  'services/atuacao.js': '8509ac0206906a7f93384350e77132bf',
  'front:SeletorAtuacao.jsx': '17afaaf69d6e4cf0c105490267d188a7',
  'front:TelaMeusDadosFornecedor.jsx': '1e8cc8a63de4debf1530042e511732f9', // etapa 14e
  'front:TelaFornecedoresNova.jsx': '28396f3bc910190ecc80873b54edc47d', // etapa 10c
  'front:TelaCanalSpot.jsx': 'fce8753af5d9878476cb9dfaf54efec9', // etapa 18ze
  'front:TelaFornecedorSpot.jsx': '30f4ceb3cac74e9f05a7b68f561a77c4', // etapa 18o
  'front:TelaFornecedor.jsx': 'aad0c16df9e56fcf0b2ee29df7058e46', // etapa 18n
  'front:TelaPainelFornecedor.jsx': 'e9742a3e808ba27df5d5f29a393b8da6', // etapa 10c
  'front:TelaAceitarConvite.jsx': '8aefac39a8a1f4f94c17d2d26f8d53c0', // etapa 11a.3
  'front:main.jsx': '2b0307ef8f0984c9aed57c7b6ecf3abe', // etapa N1
  'front:TelaConfiguracoes.jsx': '98298b07dd8cbde9f563a20921d25ae7', // etapa B2.0
  'services/acessoSpot.js': '6ecce4d16d6b123c6ce93c1223b32f01', // etapa 10c (novo)
  'services/receitaCnpj.js': 'b0e2a678127403d5608723c21ec61b78', // etapa 14d.5
  'services/cadastroPublico.js': '750c29b11811b3ae3cdddad46da4fb8a', // etapa 18v
  'front:App.jsx': 'd3ed53df93e639846f519523aedb4160', // etapa E1
  'front:TelaLogin.jsx': '742946c163f48c3a80f798f6077678c2', // etapa 18g.6
  'front:TelaSignup.jsx': '345dceefb937b38e74cfef44cfc33ef3', // etapa 11a.3
  'front:AvisoPlanoTenant.jsx': '2a75bbac9eaae456cc5d1b81d1dfbff8', // etapa 18v
  'services/emailConfirmacao.js': 'e36296d648d6f76f6412d7de0e10c4d8', // etapa 11a.3 (novo)
  'front:CampoTelefone.jsx': 'c0699f00b06c84098af121acd5d8682f', // etapa 14d.4
  'front:TelaConfirmarEmail.jsx': 'dbf759fd98f257a436cfe47874c72d9f', // etapa 11a.3 (novo)
  'routes/plataforma.js': '38693c5083496b2a6d07f7bf4bc5e94f', // etapa B5.0
  'services/plataformaConsole.js': '2052fe85951bf51702733b9c9607402d', // etapa 18j
  'middleware/plataformaMiddleware.js': 'bf2424eab233bdf7e0cb6fca9cb953b9', // etapa 11b (novo)
  'scripts/criarAdmin.js': 'd4d85894f6381dc7b31f83466f316024', // etapa 11b (novo)
  'front:ConsolePlataforma.jsx': '35b5d4d5170b5da5d24fa1c093ba2ad4', // etapa B5.0
  'routes/manutencao.js': '615fa12637ae7b454c52b99c054e617b', // etapa 14b.2
  'services/calendarioManutencao.js': 'bbcf04d1bb3b18b8776579d3180274e6', // etapa 12b.2
  'front:TelaCalendarioManutencao.jsx': 'e52bdb86b131c11195ba0c86f64fccda', // etapa 18zq
  'front:TelaOrdemServico.jsx': 'df80c9f9787e8f542e9558aa1b53da8b', // etapa 14a
  'services/planosManutencao.js': 'e32588acaefd47c5cb93bbe0d70ab799', // etapa 12b.4
  'front:TelaPlanosManutencao.jsx': '4e19850209fa1924953706a7afde7995', // etapa 18g.2c
  'front:ModalTransferirOS.jsx': '0edc0982e10f8c73b5d54b2a3ff212e9', // etapa B1.15
  'routes/pessoas.js': 'b03b176158e8877f85d50c012f13a23b', // etapa B1.15
  'services/documentos.js': '5ad2ff4eab714e6e9d67fa2dd9dac0a7', // etapa B1.14
  'front:TelaPessoas.jsx': 'db06d3e691b23efcd5deccff02a7d4b7', // etapa B1.14
  // etapa 12c.1
  'services/avisosVencimento.js': '5e44509d6b1b33205d323e2b9bbd52a5', // etapa 18zq
  'services/funcoes.js': '9873a5e1a74e7604ab6b624d1d7cc901', // etapa 12e.3.1
  'front:BibliotecaFuncoes.jsx': '9f5e1d8aba9b2e729cc4d546b4678712', // etapa 12e.3.1
  'services/epi.js': '9b0dccea86e23c7d5f3af1132159f0ee', // etapa 12d.1b
  'front:TelaEpi.jsx': 'f9a0279f2d8916f32549f4a3f7108438', // etapa 12d.3
  'front:BibliotecaEpi.jsx': 'e54d2c680ad3692518681de67bf00169', // etapa 12d.1b (novo)
  'services/epiEntregas.js': 'fec08c1dc85c386e57e5a01474871c8f', // etapa 12d.3
  'services/conformidade.js': '0f71e3975d9affeca50c8f79de3fba0e', // etapa 18zw
  'front:GestaoEpi.jsx': '6c823820e98a6d78c736540aea8e67f8', // etapa 12d.3
  'front:AssinaturaTela.jsx': 'db713a14a03390f9072d06f1de697b90', // etapa 12d.2 (novo)
  'front:gerarFichaEpi.js': '1926fe16c45ad648ef986f6bbb97a824', // etapa 14c.2
  'services/historicoFuncoes.js': 'e8460900c6f40ee55328c3aac638dffe', // etapa 12d.3 (novo)
  'services/avisosPessoas.js': '33baf9c21de6ea0ef11ba905734f25c5', // etapa B2.0
  'services/treinamentos.js': '8c8271f49f9c6ddf07241a1b216bd2bd', // etapa 18zz.5
  'front:TelaTreinamentos.jsx': 'ed7ded082f140cff32ad828d2f076f10', // etapa B1.15
  'front:gerarListaPresenca.js': '35770dafbe33aca8992c169d93745e9e', // etapa 14c.1
  'migrations/031_treinamentos_conteudo_horas.sql': 'ec5ffd0cf4814b65add59c253be196fa', // etapa 12e.2a (novo)
  'front:BibliotecaTreinamentos.jsx': 'bc7bf51426be20050569f0beab486d19', // etapa 12e.2b
  'front:EditorConteudoTreinamento.jsx': 'a770330072bfc50fcf5f5e8ab5485d51', // etapa 12e.2b
  'services/provaOnline.js': 'c69bf55c1438261660eb3cc70b4ccffc', // etapa 18zz.5
  'routes/meusTreinamentos.js': '2325068ee6d623683677fa3aee7947ab', // etapa 12e.2c
  'routes/provaPublica.js': '88db8424e165984224d9ff2550c27e06', // etapa 12e.2c
  'middleware/tenantMiddleware.js': '1a5fe32edea8c1e65b85c8eb6a381865', // etapa 18zz.2
  'migrations/032_prova_online_colaborador.sql': '89db0b8f09c60f29496ee58e87b5685f', // etapa 12e.2b (novo)
  'front:AreaTreinamentoColaborador.jsx': '17b6470004ffaf44ef64d77e05207af7', // etapa 18zz.5
  'front:TelaMeusTreinamentos.jsx': 'd4e7b799bc8009d69ea3e5d48220e811', // etapa 18zz.5
  'front:AcessoColaborador.jsx': '9c34d578c4b9a47bb5c801f69f805bf1', // etapa 12e.2b.1
  'front:TextoAula.jsx': '9bf737cb738368965db7ef010bbe27bc', // etapa 12e.2b (novo)
  'front:TelaProvaPublica.jsx': '49710bac997c6660ce0b1ce7b8da18f9', // etapa 12e.2d
  'front:gerarCertificado.js': 'afd7fd6e2453bfab32f19fc6a9a7a7aa', // etapa 14c.1
  'services/competencias.js': 'fa5dfb050d6c1db23d83d66b8ec6b864', // etapa 12e.3.1
  'migrations/033_competencias.sql': '5a84726fdb2ad6fc09b8ca12353384e4', // etapa 12e.3 (novo)
  'front:FichaCompetencias.jsx': '4b6dcf908570d5a08ad5677f0fa21449', // etapa 14c.1
  'front:EditorCompetencias.jsx': '95b4124925cbbe1828920172d2ec0c18', // etapa 12e.3.1
  'migrations/034_competencias_nivel.sql': 'f83e415aca9dfaf839c945eaf59731a1', // etapa 12e.3.1 (novo)
  'services/dossie.js': '8a5e4ad471918ee797b3017bcea4ab1c', // etapa B1.15
  'migrations/035_dossie.sql': '77312ba3492730a513939e6503636372', // etapa 12f (novo)
  'front:PainelDossie.jsx': '94bf4140f0514f53b1a96e69598d9783', // etapa B1.14
  'front:gerarDossie.js': 'ca9fc0279c634d1581d628715b86aefd', // etapa B1.15
  'services/multas.js': '93a0367bbbdc004bb59250915ceeebfd', // etapa 18g
  'migrations/036_multas.sql': 'b89f5e90964aa538404cccc85e2d4484', // etapa 12g (novo)
  'front:TelaMultas.jsx': 'b37d7d3a6f2c063445bd7a7a45150a6d', // etapa 18g.2c
  'front:gerarTermoDesconto.js': '5847f394eae27eef19c87b6371be1f2e', // etapa 14c.2
  'services/disciplinar.js': '07c6440a61f339446412ec7dc91c8e8b', // etapa 12h.2
  'migrations/037_disciplinar.sql': '57507e1c5a097a8dfec9a7084ad81445', // etapa 12h (novo)
  'front:TelaDisciplinar.jsx': '3baf053317820e315a81ac7fa73fa701', // etapa 14c.1
  'front:gerarMedidaDisciplinar.js': 'eeb53a7e0b81696bcbf3bda8b22242a6', // etapa 14c.2
  'migrations/038_disciplinar_ciencia.sql': '78d9a3a72385e12d2fc0a36d9b50afe8', // etapa 12h.1 (novo)
  'services/autuacoes.js': '75e6f2a339a906db707a238406bd571d', // etapa 18g
  'routes/autuacoes.js': 'bf16699ee770476707473186a882b353', // etapa 12i (novo)
  'migrations/039_autuacoes.sql': '22fd55f61f36a8e9daf3c22ea794cc6f', // etapa 12i (novo)
  'front:TelaAutuacoes.jsx': '0cabebaeb4efbff1a017e27f111410c5', // etapa 18g.2c
  'front:TelaNaoConformidades.jsx': '68bc7d0886cb588af9d093414b4f5897', // etapa A1.1
  'services/inspecoes.js': '3a0b0f74f10f39e6b2d2acf0831b6aca', // etapa 18c.3
  'routes/inspecoes.js': '9d9588efd35f6635ac6370692849da28', // etapa 18zp
  'migrations/040_inspecoes.sql': '0ac35a83c9621397570d1be855727cc9', // etapa 14a (novo)
  'front:TelaInspecoes.jsx': '97e971c93aa8ec090611bb6cea29d8c3', // etapa 18zk
  'front:ExecutarInspecao.jsx': 'fb94210a4f175ac1dad6e8190dc02deb', // etapa 18ze
  'front:EditorModeloInspecao.jsx': '00fc0578bd4bcba1221b7ced983727dd', // etapa 14c.1
  'front:Esquemas.jsx': 'f68e56580c3ed088c902109fcb016b9c', // etapa 14a (novo)
  'front:BibliotecaInspecoes.jsx': '104cdfc0dca69548cd4d7ab86152a5cb', // etapa 14a (novo)
  'front:filaInspecoes.js': '68d6f8212410167291b1d8c7e4b1a6e3', // etapa 18c
  'front:gerarRelatorioInspecao.js': '0b12351755d3be30a0297c48a6ea8c9f', // etapa 18c.3
  'routes/inspecaoLink.js': 'e4f98c085d4ec2f7b0fa1556b267fa45', // etapa 14b.1 (novo)
  'migrations/041_inspecoes_tipos_links.sql': 'ddfd59d129a129f0ac2c3f7aef9f62aa', // etapa 14b.1 (novo)
  'front:TelaInspecaoPublica.jsx': '41f4af3384a6db56d3d13dcb0081f6d3', // etapa 14b.1 (novo)
  'routes/equipamentos.js': '2e379d0637f0c8501cbfbad41898ef30', // etapa 14b.1.1
  'services/rotinasInspecao.js': 'dbe9cdd03fedea23d456261559056e7c', // etapa 18zj
  'migrations/042_inspecoes_rotinas_locacao.sql': 'bf32500014ddf3f779f1fa29ead5feb9', // etapa 14b.2 (novo)
  'front:RotinasLocacao.jsx': '8bba6c8bb586ff7298f6e0d0b13f8b9b', // etapa 18c.4
  'front:gerarRelatorioCumprimento.js': 'd4b916c75f0a4290ccd9c96bf170ed90', // etapa 14c.1
  'services/contratosLocacao.js': '938f1050e04982726d59981b566731d5', // etapa 18zc.6
  'routes/contratos.js': 'e246fcf655fc68e03d945af65881ad27', // etapa 18zf.4
  'routes/locatario.js': 'ef7e500d9afdf40a4d5090df88883405', // etapa 18p
  'migrations/043_contratos_locatario.sql': 'f25735b281aa176b4c31c3cc2bf283ed', // etapa 14b.3 (novo)
  'front:TelaContratos.jsx': '0e2369c6aff740e4652522c14ba26c4c', // etapa 18zf.4
  'front:TelaLocatario.jsx': 'aaef90fe093619b958fd876017ce4480', // etapa 18zc.6
  'services/clientes.js': '9714283f0013553dc96a48b75b6734cf', // etapa 14b.3.1 (novo)
  'migrations/044_clientes.sql': '446d1a52049aea19938d36cc2b01653d', // etapa 14b.3.1 (novo)
  'front:Clientes.jsx': 'e9be5c01c41ba182663873245d56ca52', // etapa 18zb
  'routes/usuarios.js': '174bcb3916f6668a8f16e5364874c4e9', // etapa 18g.1
  'services/logoEmpresa.js': '48b3a98d98cf855140345b864111f6c0', // etapa 14c.1
  'migrations/045_logo_empresa.sql': '87eeade651cc3f724b7228bf57bb3670', // etapa 14c.1
  'front:LogoEmpresa.jsx': 'cab8af3905485a4d3fb77d528b24760b', // etapa 14c.1
  'front:logoEmpresa.js': 'd4a9118674d42a897c58aaea954dc6d2', // etapa 14d.2
  'front:comprimirImagem.js': 'b6d05cca4906e19250268c29f633f044', // etapa 14c.1 (novo)
  'front:gerarPdfNC.js': 'fe4db00132dc6c626027e234e1f5f366', // etapa 14c.2
  'services/contratoModelos.js': '8f287d3d16191638e69854407dc77281', // etapa 18zf
  'migrations/046_modelos_contrato.sql': '0b06982d731ce6038a679a7cc7e21785', // etapa 14d.2
  'front:ModelosContrato.jsx': '2259720a8062d1be1d40a966fcc6ba43', // etapa 18zf.2
  'front:gerarContrato.js': 'f76ee198463184debe5ca205c71f0b6b', // etapa 18zf
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
  'front:TelaRecebimento.jsx': 'f83efb4e441f5acfa7147ba7cab089bd', // etapa 18c.1
  'front:CnpjsPlataforma.jsx': '0663f0bd670edb45ff9ae8d2c2ef6a09', // etapa 14e.1
  'front:ModalJustificativaCnpj.jsx': '13d5e39c961c4e775fde24c77e4fb7ff', // etapa 14e (novo)
  'front:TelaMonitorCnpj.jsx': '7d9525d956277c38774adf199a1cf76e', // etapa 14e.2
  'front:TelaOrdensVenda.jsx': 'e3fadc9d3c6ae4be1a2f14c693523f13', // etapa 14e.2
  'front:TelaUsuariosNova.jsx': 'e2c90087b8c7bed508de2fe05a636789', // etapa 18g.1
  'migrations/051_comercial_bid.sql': '65c3c268119eadac6a0ecda34b72197c', // etapa 15a (novo)
  'routes/comercial.js': 'a98f3431775c6bf9c88a1c8ed701fe1e', // etapa 18b.6
  'services/bids.js': 'edb8d962c560305d4b5e50b15e937802', // etapa 18b.9
  'front:FichaBid.jsx': 'ead3154d12c210f1c1657a8e6edd9746', // etapa 18g.2c
  'front:ModelosBid.jsx': 'fce825c9584b3ff4a2a1040d575de24c', // etapa 15a (novo)
  'front:TelaComercial.jsx': '7a11feb187d663f1f516fe91c81485d6', // etapa 18g.2c
  'front:gerarBid.js': '22e048e4f81d260222995d4607127c72', // etapa 16d
  'migrations/052_bid_cliente.sql': 'a8b6f934576474b54a7246fda86d3eda', // etapa 15b (novo)
  'routes/bidLink.js': 'e566a5246b48e24430a997fda8d32e27', // etapa 15b (novo)
  'services/bidsCliente.js': 'eb8e5a254090027082f0ac520c5f92aa', // etapa 16d
  'front:TelaBidPublica.jsx': 'b4ac367ec733727d25699230beb5d64a', // etapa 16d
  'front:EnviarBid.jsx': '4d97c008534b17bcf66a71f186b4f31a', // etapa 15b.3
  'migrations/053_pedidos_venda.sql': '4036d7fd11c94032774e96372e098942', // etapa 15c (novo)
  'services/pedidosVenda.js': '7f030e831162dcac2f230aac4d5882d0', // etapa N1
  'front:FichaPedido.jsx': '798337dbd7ba34cc802f8d1bfb40a1b3', // etapa 16d
  'migrations/054_tarefa_atribuida.sql': '586bd43f09653a76e8d6a299e55905e3', // etapa 15c.1 (novo)
  'scripts/previaEmailsBid.js': '45b4dbeb2d2d8d84a24e7a31f6826049', // etapa 15c.3 (novo)
  'migrations/055_execucoes_at.sql': 'fc0a780d147f0b3d7e4c92ec71c4554f', // etapa 16a (novo)
  'services/execucoes.js': 'b5640ad301623354467e8e00112a01e9', // etapa N1
  'routes/programacao.js': '98c064abc94e08bd5556d578748a8235', // etapa 18g.2.7
  'front:gerarAT.js': 'd05187877f31e92708abba3c7f338ce3', // etapa 16e.1
  'front:TelaProgramacao.jsx': '4412d157e3d7d579b7c36891e4fe7353', // etapa 18g.2.1
  'front:FichaAT.jsx': '33d73febf93c6156968abfd3f1ece2b1', // etapa 18zq
  'front:MesaProgramacao.jsx': '0fe89411ff4d5c7f4274b99d58a7de98', // etapa 18zq
  'migrations/056_at_rascunho_link_motorista.sql': '4e9a9185cbb0a1f9770e1fe666fc77f3', // etapa 16c (novo)
  'routes/atLink.js': '5a4b15c9d8a1208ebc0e704d54d4857a', // etapa 18zw
  'front:EditorAT.jsx': 'ef1747e618e17854e4c33ba2bac0682a', // etapa B2.0
  'front:VerArquivo.jsx': '5c185f4161c960689249989919522a22', // etapa 18ze
  'front:TelaATPublica.jsx': '2707c4819c9173856f7128468440a432', // etapa 18zw
  'services/fluxoViagem.js': '236b345499c70a8a68d37aab686790f0', // etapa 18g.2d
  'migrations/057_fluxo_viagem.sql': '42cdc0800d3c622f541639bada16b252', // etapa 16e (novo)
  'front:EditorFluxo.jsx': 'eadf4403ff94cd4dad1cf4c98d581dbe', // etapa 16e.1
  'migrations/058_base_frota.sql': '726daccca8ec58b7bc09dc7ff3a57cf6', // etapa 16e.3 (novo)
  'routes/minhasViagens.js': '2839f5aad536209ef2465538599ce957', // etapa 17a (novo)
  'front:TelaMinhasViagens.jsx': '522b50f6a1971283d451e6d23bc41f2f', // etapa 17a (novo)
  'services/calendarioComercial.js': 'e774e648d01c8fa01792605c8113cb4c', // etapa 18b.6
  'migrations/059_calendario_comercial.sql': '93acdb034cb90c4907b6071eb35a75e9', // etapa 18a (novo)
  'front:CalendarioComercial.jsx': 'f03618691545d994545ed6a80583944e', // etapa 18g.2c
  'migrations/060_prospeccao_evento.sql': 'f52ed7775d71d71c9ce65f0f57982098', // etapa 18b (novo)
  'front:PainelProspeccao.jsx': 'b6b4bfe7c50fc16f692cc5251bae8658', // etapa 18g.2c
  'routes/tarefas.js': '5a8402766b6244f6ecd1a78d81274354', // etapa 18g.3
  'migrations/061_prospeccao_oportunidades.sql': '528a098239312cff4b7b389d4325b2f3', // etapa 18b.2 (novo)
  'front:TelaPlanoAcaoNova.jsx': '9afe276ba34de63f07a1d6669dcf8a98', // etapa E3
  'front:ConcluirTarefa.jsx': 'de3f60dc997a047cc1a29cd2a20ac92d', // etapa 18b.3 (novo)
  'front:DetalheExecutivo.jsx': '7fe748dd4a963a04f71d264bb189318f', // etapa 18b.9 (novo)
  'front:marcaFoto.js': '61fc663e418ff25ac21fd67a04915f5f', // etapa 18c.3
  'front:ModalNovaNC.jsx': '2e7241e4929ca6a1d4eb43a44b87c997', // etapa A1.1
  'front:ModalDetalheNC.jsx': '73c97edc74a2e4bd6cac132bd6694822', // etapa 18ze
  'front:ModalNaoConformidade.jsx': '46eb86deecf378b2390b9812aa90367f', // etapa 18ze
  'front:FiltroPeriodo.jsx': '06b873f17ff380024b38e507bdca6724', // etapa 18c.4 (novo)
  'migrations/062_medicao_locacao.sql': '5a4d7ea7f3180195a19e4121183a446e', // etapa 18d (novo)
  'services/medicoes.js': '5a058d4fed3e19abd4688b7f3d97cd83', // etapa 18zf.4
  'front:MedicaoModal.jsx': '5214ed553e814abca18c1a59eaac76cd', // etapa 18zf.4
  'front:gerarMedicao.js': '119acc71ee428d0e533453cee6e00448', // etapa 18zf
  'migrations/063_medicao_vencimento.sql': '0b27bacd7a6a0b6d77c01a8039f5192d', // etapa 18d.2 (novo)
  'front:AbaMedicoes.jsx': '88bfc994bb38ab826a1452a0e6f9f732', // etapa 18y.1
  'front:gerarRelatorioViagem.js': 'd028915abe837d37b94a4082f12d0acd', // etapa 18g.2d
  'services/frotaCalendario.js': 'fd8d5e58894fd55bae016f9cdc362e9b', // etapa 18f.1
  'migrations/064_frota_dias_operacao.sql': 'd96a047b8c22b7d52c0d4a83d1b715ae', // etapa 18f (novo)
  'front:DiasFrota.jsx': '5458e631dfecb24b534d7208fd46be23', // etapa 18f (novo)
  'services/utilizacaoFrota.js': '929b421d152c77b83260466c044776c9', // etapa 18f.1 (novo)
  'front:PainelUtilizacao.jsx': '716912b094bd87943b04d6aa0761de53', // etapa 18f.1 (novo)
  'front:gerarRelatorioUtilizacao.js': '5b0a4286653da51ac7dff27328610083', // etapa 18f.1 (novo)
  'migrations/065_tarefas_rastreabilidade.sql': '3902af0a80d08839d542bd2a65e99d87', // etapa 18g (novo)
  'services/tarefas.js': '2e768f614816790e928f63643251a1a6', // etapa E3
  'migrations/066_fiscal_transporte.sql': 'eeef7d2fb80ae6ad0ec6069a3342e0ff', // etapa 18g.1 (novo)
  'services/tarefasFiscais.js': '90048e5365d5e1642991100314ab2c69', // etapa 18h.4a
  'front:ChecklistFiscal.jsx': '9e9e9863a2bc74886344400973645c82', // etapa 18g.6
  'front:ConfigFiscal.jsx': '9fd57da5d2627b93c19ca338720462fc', // etapa 18g.4
  'front:lerXmlFiscal.js': '8d657863784b4e6c468b29bd8152e53f', // etapa 18g.1.1 (novo)
  'migrations/067_tarefa_responsavel.sql': '3e718fa4290311abef8fdb5b2e68eb6b', // etapa 18g.2a (novo)
  'front:CampoPessoa.jsx': 'efa3cd5aee2eeadae0805e7d4b6e8daa', // etapa 18g.2c
  'front:gerarRelatorioTarefas.js': '9713bfcc065f60aba6bb72fd9d82f31f', // etapa E3
  'front:AcaoDocFiscal.jsx': 'eed319fa1d63b104146db0b8eabcd7ed', // etapa 18g.2.7
  'services/ocorrencias.js': 'ebb41cbc522bb93e6265257ea60a711e', // etapa 18r
  'routes/ocorrencias.js': '7a494a88eed51ce7c7965f0bd585c82e', // etapa 18p
  'migrations/068_ocorrencias.sql': '4fff8fd8dccd6dd91dbb2f145bd19a22', // etapa 18h (novo)
  'front:RegistrarOcorrencia.jsx': '2ca7c16adf79ddc522e4e62adfca4744', // etapa 18ze
  'front:PainelOcorrencias.jsx': '38edd24bbf9f307caa6198f52d546b36', // etapa 18ze
  'front:gerarDossieOcorrencia.js': '971cc44cce9e61fd856940907f7c7fce', // etapa 18h.4a
  'front:useCatalogo.js': '0cd8f09dcbe1e98d67908d2937743a8b', // etapa 18h.2
  'front:areaRestrita.js': '48e89b41e5e1c3b82d92b1bf996576e0', // etapa 18h.2 (novo)
  'migrations/069_ocorrencias_inc_config.sql': '021d999ba5637b4bb5404593c3e62259', // etapa 18h.4a (novo)
  'front:ConfigOcorrencias.jsx': 'e799bac0e58a978808d6041d9e3ed50a', // etapa 18h.4c
  'front:IndicadoresOcorrencias.jsx': '2cf48ec396f6722644bbfa4dfb9ef720', // etapa 18h.4 (novo)
  'front:gerarRelatorioOcorrencias.js': '6bf80339de4eb3c15849b55972de04fa', // etapa 18h.4 (novo)
  'services/roteiroInicial.js': '15852eb51b67124ebdb6245ed6c2f84f', // etapa R2
  'migrations/070_roteiro_inicial.sql': 'ee88701340141118fc400549de31fc3a', // etapa 18i (novo)
  'front:BemVindo.jsx': 'ffca185c2e33160374fff885c6144d91', // etapa SC3
  'services/modulos.js': '1b53ef0f8869065c8eb37388cd81ec41', // etapa E1
  'migrations/071_modulos_planos.sql': '37caa5e9e569dde2fb7ea21d442968c2', // etapa 18j
  'front:MeuPlano.jsx': '47b91b4e2b17316e86765a689a5d21a5', // etapa 18x
  'front:ModulosPlataforma.jsx': '6fb0d8533efc732bd8c142822f31c124', // etapa B1.7
  'middleware/exigirModulo.js': '4dff6b4c470b931624e8d02ffc3f79fa', // etapa 18k (novo)
  'front:modulosSessao.js': '5dc46641212cb6f069cb94c447506cbd', // etapa 18u
  'services/chatSpot.js': '94cdc91b0a960af1086abaa48a6c919c', // etapa 18q
  'migrations/072_spot_mensagens.sql': '4d73d999f88fda8d641ebe231392bb62', // etapa 18l (novo)
  'front:ChatSpot.jsx': 'cadbb98a817e634cc30a8279600646d5', // etapa 18q
  'services/prazoSpot.js': 'bfae1226bd1b3e1d35c8d2fdf3a49cbe', // etapa 18m (novo)
  'migrations/073_spot_prazo_desistencia.sql': '0d74c587787c32c46f5322740528e558', // etapa 18m (novo)
  'services/notificacoes.js': '56689ef4358170ad6764b1cc8d975328', // etapa 18s
  'routes/notificacoes.js': '23872d24531cb409c21a700f66e07bdc', // etapa 18q
  'migrations/074_notificacoes.sql': '4faa8c8e3f35621354aaf24218844adc', // etapa 18n
  'front:SinoNotificacoes.jsx': '6a4cb9e19227c570ada76c138d16d74e', // etapa 18n.3
  'migrations/075_spot_anexo_email_atraso.sql': '0336af6de14d6685c42877f241c570f3', // etapa 18q (novo)
  'routes/estoque/solicitacoes.js': '294095a54e5b95b43d3637605bd99ae4', // etapa 18s
  'front:TextoComPlano.jsx': '3dd816276451af0a948e63e03a645644', // etapa 18t.1 (novo)
  'migrations/076_tenant_segmentos.sql': '3be00b876ccc87e2b9e7aced3809983f', // etapa 18u (novo)
  'services/assinaturas.js': 'e6d9c6444f36737004b1b984e58f02b1', // etapa 18x
  'migrations/077_assinaturas.sql': 'c9e4a1598392f5bdd744e042f471553f', // etapa 18v (novo)
  'migrations/078_assinatura_modalidade_pedidos.sql': 'd7f8abfc9d014eed6b1f243c4e71bc76', // etapa 18w (novo)
  'services/mobilizacao.js': 'ef9209c83832380ed83957dea226f65a', // etapa 18zf
  'migrations/079_contrato_mobilizacao.sql': '2b89c516c0627c2f008f6b0a251459a9', // etapa 18y (novo)
  'front:MobilizacaoContrato.jsx': 'a5d960309da24e01ccc56d0a8ae894cc', // etapa 18zf
  'services/fichaCte.js': 'e013154c4b0b8e6d9eb3ef10413cdd1b', // etapa 18g.6
  'migrations/080_ficha_cte_apolices.sql': '83836a53e1f1dd89b4db3c73686c0816', // etapa 18g.3 (novo)
  'front:FichaCte.jsx': '1545e475b3f1293bea31b1d2689b9af8', // etapa 18g.4
  'front:gerarFichaCte.js': '82698d98c06a303fe9be9cd02c20cdc3', // etapa 18g.3 (novo)
  'front:ModalMeuPerfil.jsx': '3ebeaea85df76f80b004a23dffe5844b', // etapa 18g.6
  'services/patio.js': '61ece7fe277f4d2afc8537bf548eef58', // etapa 18zi
  'routes/patio.js': '6e5a265dc676b2e42b990ca463135f4d', // etapa 18zi
  'migrations/081_patio_cliente.sql': '87e9b488918410bef16457f63160a911', // etapa 18z.1
  'front:TelaPatio.jsx': 'bada379e2a27f9c9bd7a791969772f4a', // etapa 18zi
  'migrations/082_patio_pre_entrada.sql': 'c7585555fe91ee8573f9f6077540c0dc', // etapa 18z.1 (novo)
  'migrations/083_patio_area.sql': '6fba8eb9fd7f4cbc576291eca361258f', // etapa 18z.5 (novo)
  'front:gerarComprovantePatio.js': 'edfdd771ff4fded95319e93132e5b200', // etapa 18z.6
  'migrations/084_patio_areas.sql': '0e32ca4fbcfe7ccc6ccfb97c4131a01d', // etapa 18z.6 (novo)
  'migrations/085_contrato_armazenagem.sql': '934e0b8c82933e55bdb65b3bb599329a', // etapa 18za (novo)
  'front:GuardaContrato.jsx': 'd150133f27610421cbc6c6d6f7255ee9', // etapa 18zb
  'migrations/086_contrato_armazenagem_tipo.sql': 'b8d7857f165b0964d2378f90a34e23e8', // etapa 18zb (novo)
  'migrations/087_medicao_envio_automatico.sql': '8ca07e5e6d7b67718139d0cf430a70cf', // etapa 18zc (novo)
  'services/NfeXmlParser.js': 'b3fe06994341a9d8593ff6c53d7d512f', // etapa 18zd
  'front:ConfirmarExclusao.jsx': '5dc91681d6fcb9724a17f1c75170c31b', // etapa 18ze
  'front:ImagemZoom.jsx': '0a87d5d9acc85d2193cc347bf9798c8a', // etapa 18zf
  'front:ModalDetalheNCFornecedor.jsx': '55abb21fa95396222386ade553cc9b5c', // etapa 18ze
  'services/cobrancaLocacao.js': 'f9b61394bec8321dbadbaa4e8b1c5489', // etapa 18zf.4
  'front:AvisoHorimetro.jsx': '537ba74fda9abd531c9977de6f1f9284', // etapa 18zg
  'migrations/088_checklist_medicao_contratual.sql': 'ffb81733f60648c397b903b882057c1a', // etapa 18zg (novo)
  'services/analistaRotina.js': 'c0afb3121b4732e3cb22c0b81c92862b', // etapa 18zm
  'front:AnalistaRotina.jsx': '9c1a6be45ed881d85f07d0f9f733ea0d', // etapa 18zp
  'services/ia/index.js': '485cbb49ff366cad9e7fb6f45c504bef', // etapa B2.0
  'services/analistaMensal.js': '816e02e2538a5ca13a8cd75531d03bf4', // etapa SC3
  'migrations/089_ia_uso_foto_colaborador.sql': '0d683964b7f713c0b484f0e7e631c890', // etapa 18zl
  'services/leituraCnh.js': 'ff3c577c51abac6529f6855d96352184', // etapa 18zo
  'front:LerCnh.jsx': '8764531156378d03f171df0d3940536a', // etapa 18zo
  'front:lerCnh.js': 'd640b8be065f9c128f7c89bd188b550d', // etapa 18zl
  'migrations/090_colaborador_cnh.sql': '1b892363421dae299e115903808b8951', // etapa 18zn
  'front:AjustarFoto.jsx': 'bd1842aedec450e1f98c0d0bd60c910a', // etapa 18zn
  'migrations/091_ia_uso_cache.sql': '5bbf9aca8354504a3322565e3512b7c8', // etapa 18zo
  'migrations/092_documentos_gestao.sql': '48938919462a5b54635b1009c748f92a', // etapa 18zr
  'services/documentosGestao.js': '612350f6dd2e75aceab9b1277fdf3057', // etapa A1.4
  'front:DocumentosGestao.jsx': '6774d171464b6daea01753160349131d', // etapa A1.4
  'migrations/093_gestao_revisoes_leituras.sql': 'b40ed913b39122eb1dc24988a84621c6', // etapa 18zs
  'services/modelosGestao/iso9001.js': 'eb414c0f411066ca8d505223104ac0b0', // etapa 18zt
  'front:gerarDocumentoGestao.js': '3db29ead876a2957ec4e4dff7c32aaba', // etapa 18zz.13
  'migrations/094_gestao_fluxo_assinaturas.sql': '252b65e0790b8d91f7c8486afa7c1e9a', // etapa 18zv
  'migrations/095_colaborador_vinculo.sql': 'ede02d83cd18026acb0652490d16be9f', // etapa 18zw
  'services/cnhPeloLink.js': 'bd8c2956449323d9a816c139512f8dd5', // etapa 18zw
  'front:CampoCnpj.jsx': '5fb306c0e0cb0245e644e659c6042bb7', // etapa 18zx
  'migrations/096_gestao_distribuicao.sql': '021438cdc0fbfff2e12ba88a36b70929', // etapa 18zz.2
  'routes/meusProcedimentos.js': '64f7ca34d48798dfc0aa345ea1a12046', // etapa 18zz.5
  'front:MeusProcedimentos.jsx': '31b8415e2cdc85cd16c3cd90cf66e31b', // etapa 18zz.13
  'migrations/097_treinamento_procedimentos.sql': '96dad2796bee2f6a03016bd92db27c54', // etapa 18zz.5 (novo)
  'migrations/098_gestao_pessoas_rastreaveis.sql': '5dc141afff2e70180e1b9faad0d848dd', // etapa 18zz.6 (novo)
  'front:CampoFuncionario.jsx': '9c645091d62c05939519b0b9980c4c8f', // etapa B1.15
  'migrations/099_gestao_usuario_responsavel.sql': 'd50ccfb7d7c29cfd5e79744f3431b141', // etapa 18zz.7 (novo)
  'front:paginasArquivo.js': 'efb97af782a76882e86fa9b1a19a659e', // etapa 18zz.13 (novo)
  'front:DocArquivo.jsx': '7f5d9b741400d4f22486686415b35e14', // etapa 18zz.13 (novo)
  'front:CorpoDocGestao.jsx': '11744b9eb391959a686d244f1e8aa4d1', // etapa 18zz.13 (novo)
  'migrations/100_leitura_registrada.sql': '5f06269692d543b98dad64a09d0e2336', // etapa 18zz.14 (novo)
  'front:AgingDocumentos.jsx': 'c5b665e6e676fb3d3ba6ec8af695bbaf', // etapa 18zz.14.1
  'front:RegistrarLeitura.jsx': 'bae540b8403a17bb34dffeec4f64824a', // etapa 18zz.14 (novo)
  'services/valorGerado.js': '6fc00d7d8b4fe2a1bbbfe09a37a8961a', // etapa R1
  'routes/valorGerado.js': '741c909bfde3dc6734e803c82b545dca', // etapa 5a (novo)
  'front:PainelValorGerado.jsx': 'c2a982a4d57f469c86df05ee83a58b19', // etapa SC2.5
  'services/salaControle/index.js': '66fb87e4a0320c88554fe8dedf3cd2a3', // etapa B2.0
  'routes/salaControle.js': 'c3ecbec2f358445eb96364fdcda08154', // etapa SC3
  'front:SalaControle.jsx': 'ff426ff2ca8ccba12a1ee9380e0aab81', // etapa B1.7
  'services/metas.js': 'c9f7f147de4fa800c3b722cc202260d1', // etapa SC2.5
  'routes/metas.js': '2945b25b438295620aff1500158659fa', // etapa SC2.5
  'migrations/101_metas_negocio.sql': '93d87925592a0da96839a247d76f4d1e', // etapa SC2 (novo)
  'front:TelaMetas.jsx': '798601a29be90b1b68e44e01948dc189', // etapa SC2.5
  'migrations/102_metas_manuais_responsavel.sql': 'e499fe2a4d3a714ea55bdd981870fa8f', // etapa SC2.1 (novo)
  'migrations/103_metas_resultados.sql': '7291a21a0a42daa355db552065b19d2b', // etapa SC2.4 (novo)
  'front:FichaMeta.jsx': '25f58af8ebf3f1a9e44510211eb84e70', // etapa SC2.5
  'front:PainelAnualMetas.jsx': '27ff89ced3ea1af61207b46c7daccf5c', // etapa SC2.5
  'migrations/104_tarefa_tipo_kpi.sql': '127bdd44b66820b42726973f276be4a1', // etapa SC2.5 (novo)
  'front:PlanoAcaoMeta.jsx': 'f6b1b4af99c561c3b59cb66632ffe725', // etapa SC2.5 (novo)
  'services/ia/conferir.js': '9722ac7f95c6d0f1d88d52edfb19a620', // etapa B1
  'services/salaControle/analista.js': 'a6b6b2ccc047d8b42ee354100430a68e', // etapa SC3 (novo)
  'services/beta.js': 'a6260eb283e7c06d05337c055bdc390a', // etapa B5.1
  'routes/beta.js': '9e25e3f3006c14493ef436d476e50517', // etapa B5.1
  'front:Beta.jsx': '492f50a226fdfd6483c2078871bcfbb2', // etapa B5.2
  'services/betaConsultas.js': '316b5fd331f501227d97bbfe85d90802', // etapa B5.1
  'services/ferias.js': '76e0c2b2b6a32df76c98479bbf9e1c2a', // etapa B1.15
  'migrations/105_colaborador_ferias.sql': '35db94dbde383bdedd3080434704e697', // etapa B1.7
  'front:TelaFerias.jsx': '5ca20567b45bc7accc6bac86909ed57c', // etapa B1.15
  'services/feriasRegras/index.js': '8730bb457bcc3905ccf6bd07f52146c7', // etapa B1.7
  'services/feriasRegras/BR.js': '95b0ec33aa3a0a0f6fda2a21e148e464', // etapa B1.14
  'migrations/106_ferias_regras_faltas.sql': '49954de069bdc79e2e8d3a93b96327d1', // etapa B1.7
  'front:FichaFeriasFaltas.jsx': '1d7413d769d8b35089b841563571d1b2', // etapa B1.14
  'migrations/107_colaborador_emergencia_saude.sql': 'eb808bf8ad247a6bc4d1c4ec939cd9a0', // etapa B1.10 (novo)
  'front:BotoesContato.jsx': '475b7861406b0599b34d0d820cebbf4e', // etapa B1.10 (novo)
  'front:FichaContato.jsx': '112591cc8197b0378ca81062cbe8e2f9', // etapa B1.10 (novo)
  'migrations/108_colaborador_escala.sql': '1fc96efceb36bd4eafb67ab536dcf0d6', // etapa B1.14 (novo)
  'services/avisosFerias.js': '1979ed4f16c0d03b1106950a60e69fab', // etapa B1.14 (novo)
  'migrations/109_ferias_historico.sql': 'c2ad838eebdb2ea12cac5ffa03710411', // etapa B1.15 (novo)
  'routes/ausencias.js': '1e27ba19ebd4d58220cc5a9cb6fb2f3f', // etapa B1.15 (novo)
  'front:FichaFerias.jsx': '6a30da3f5cc7c554556f3d67591475cb', // etapa B1.15 (novo)
  'front:ausencias.jsx': 'ce94cf7f83df5a4cc811658da146376f', // etapa B1.15 (novo)
  'migrations/110_tipos_equipamento_beta_pendentes.sql': '399313a2cbb776323a08b8f23579db2f', // etapa B2.0 (novo)
  'services/tiposEquipamento.js': '9c4b2bbb3f566a0a22ccc0010928a4b3', // etapa B2.0 (novo)
  'routes/tiposEquipamento.js': '24442dddecc8b3cbe70ce54709b57b4a', // etapa B2.0 (novo)
  'services/betaPendentes.js': 'cb96411aeb7e9b13ecf3070ed6745a5d', // etapa B2.2
  'front:TiposEquipamento.jsx': '7d9c7a82a2eedfb2b4440bf94cf3a581', // etapa B2.0 (novo)
  'front:useTiposEquipamento.jsx': 'cb90e10e05e052c614c5454b7695264c', // etapa B2.0 (novo)
  'front:BetaPendentes.jsx': 'a3a9be9eed90e6a92ac4fc8d13396edd', // etapa B2.2
  'front:TelaEquipamentos.jsx': '9ae0de5715f8d3099c29b6979863faef', // etapa B2.0
  'services/betaAcoes.js': '30bea6195d90e4ad6efbe823ba572a7e', // etapa B5.1
  'services/betaVoz.js': '400436f1c9579c2deafa020cab0044b8', // etapa B5.3
  'front:vozBeta.js': '4589f325a39cc608216bf9cc1e26bdb2', // etapa B5.3
  'services/custoIa.js': '142925962841bd0cf3da886d76d86231', // etapa B5.3
  'migrations/111_ia_config_empresa.sql': '664d9e3281f88c676ec8c30f352dfd61', // etapa B5.0 (novo)
  'front:CustoIa.jsx': '7eb358bf3f6005dffbf9012e668b8a75', // etapa B5.3
  'front:ModoConversa.jsx': '155fb3020ff448d08044381b583dc28c', // etapa B5.3
  'services/suprimentos.js': '17606e0601985623adb973885b69f902', // etapa R1 (novo)
  'routes/suprimentos.js': '15656fb956395a976114dd0ae426e90c', // etapa R1 (novo)
  'front:TelaSuprimentos.jsx': '83ee5d158e2ae26839ca5eb9039fadf9', // etapa R1 (novo)
  'migrations/112_nps.sql': '07863015ca6c983a8c331c65bc18095e', // etapa N1 (novo)
  'services/nps.js': 'ef6249506b3fddf65fe3978c95eb13ed', // etapa N1.1
  'routes/nps.js': '7c445b06cafe6ca7dc1d57272187e18b', // etapa N1.1
  'routes/npsLink.js': 'a80748b5770cad152000f0d6099e839b', // etapa N1 (novo)
  'front:TelaNpsPublica.jsx': 'cc4c6f850504b2b3aecb15427f228567', // etapa N1.1
  'front:TelaNps.jsx': '256837cf4aecddcd3cc8b0a81153d361', // etapa N1.1
  'migrations/113_nps_modelos.sql': '4d758575db058c4785eee9e580ca9001', // etapa N1.1 (novo)
  'front:ModelosNps.jsx': '14740a23d700474ab912e32128a2fa17', // etapa N1.1 (novo)
  'migrations/114_auditorias.sql': 'e7f61b12848e2efb884b4f65c0ad13ad', // etapa A1 (novo)
  'services/auditorias.js': '3b7dbd157c75c7b1caf72dd48a3d7144', // etapa A1.3
  'routes/auditorias.js': '3f77de81def2635676b6fd60fe75452f', // etapa A1.4
  'front:TelaAuditorias.jsx': 'e9722ab3e21a12157ccc6227e4d5abba', // etapa A1.3
  'migrations/115_auditoria_execucao.sql': '39cf773aa0db53f78b6ddd350fe3a95a', // etapa A1.1 (novo)
  'front:FichaAuditoria.jsx': 'cf77ee7594ae65fc05d291f05a73c4a3', // etapa A1.4
  'migrations/116_auditoria_cancelamento.sql': 'b7bdac14498e43c226ac9a20b1196ad1', // etapa A1.1.3 (novo)
  'migrations/117_auditoria_periodo_docs_registros.sql': '2508fd7b2d5e4f404af86047b3baed76', // etapa A1.2 (novo)
  'services/auditoriaRegistros.js': '5075aa91c352e790eb892667176217c1', // etapa A1.4
  'front:BuscaAuditoria.jsx': '3f1dac53e9542fc510f603308451e6b6', // etapa A1.4
  'migrations/118_auditoria_tratamento.sql': '94320a5e916e99e2cd629334621abeda', // etapa A1.3 (novo)
  'front:PendenciasAuditoria.jsx': '6549f3e21b87d4e807af1a6c15f540f1', // etapa A1.3 (novo)
  'migrations/119_documentos_requisitos.sql': '41b1dd800e935be6b0caf17876762a55', // etapa A1.4 (novo)
  'front:isoRequisitos.jsx': 'ddede2ca992741ee16b8bdaca89aee81', // etapa A1.4 (novo)
  'front:MatrizIso.jsx': '13da66a930021067deab91f11824388d', // etapa A1.4 (novo)
  'migrations/120_analise_critica.sql': '4a43685a51379c3815bd8cb6ddbc2abe', // etapa R2 (novo)
  'services/analiseCritica.js': '95ba5dff1353652a37622920f0b523b3', // etapa R2.4
  'routes/analiseCritica.js': '0da14732ff8edf517686387f6c17866e', // etapa R2.4
  'front:TelaAnaliseCritica.jsx': 'ffa43a0be4e5de12dc372e78db8aa071', // etapa R2.5
  'front:FichaAnaliseCritica.jsx': 'e958ea6f3b5d29ca01d330efc571d1ad', // etapa R2.5
  'migrations/121_fotos_cartao.sql': '0180c64787440359d49b1d65c77b80d5', // etapa E1 (novo)
  'services/fotoCartao.js': 'aae573a48e7746b26e7b1b62d5cf8429', // etapa E5
  'routes/fotoCartao.js': 'c7933b48cec7adbbe678f4dd7ee6cd20', // etapa E5
  'front:TelaFotoCartao.jsx': 'c88b6fddf37042224ed39d91bd987b7f', // etapa E5
  'front:CameraCartao.jsx': '2817ea0fcc46fc27896352c3486e5012', // etapa E4
  'front:cartaoFoto.js': '972266f2ba42ec4877d571b4b074f2eb', // etapa E4
  'front:filaFotosCartao.js': '9f778fd0205ed8baf8bc25e42d3de814', // etapa E1.1
  'migrations/122_projetos_foto.sql': '478036859ffef209f3122d716fbe8cb4', // etapa E2 (novo)
  'migrations/123_projetos_foto_local.sql': 'f3d5b1528213730496c8e57466045266', // etapa E2.1 (novo)
  'front:MapaFotos.jsx': 'e95b6d8f0b38ceba7d8ffea588c30d3b', // etapa E5
  'migrations/124_fotos_cartao_lixeira.sql': '6136b82e2c3b4656a9036865e6df2a43', // etapa E2.2 (novo)
  'front:VisualizadorFoto.jsx': '9f7ff68d11fc6ec33e9a904c50ffba3c', // etapa E2.3
  'migrations/125_defeitos_foto.sql': '465c2534a5fc2ca2b39bf8b0ee52fb0e', // etapa E3 (novo)
  'services/defeitosFoto.js': 'bd166b7f1ee9fd228264a17732f1642b', // etapa E4
  'front:Defeitos.jsx': '4dd9a26026802685e319c96a2c3917fb', // etapa E4
  'migrations/126_reparos.sql': 'e43704459afdef47ef901105e33c2cd4', // etapa E4 (novo)
  'services/reparos.js': '85d0599874575bae31d0632e4ae06b27', // etapa E4 (novo)
  'front:Reparos.jsx': 'a0b6f91513d72f71ddce77236fe26c70', // etapa E5
  'services/relatorioInspecao.js': 'fa993205231b47ee8ac192658d078e17', // etapa E5 (novo)
  'front:BotaoRelatorio.jsx': '28fdb506b5200a0c50d11bc228a2ff81', // etapa E5 (novo)
  'front:relatorioFotoCartao.js': '9a69f67e53239d524953e06ff0e725bc', // etapa E5 (novo)
};

// Antes de copiar a etapa E5 — base: E4 (de40aa3)
const ANTES = {
  'services/fotoCartao.js': '852b9d1f7b542fb6651b163f4d63ef99',
  'routes/fotoCartao.js': 'c7ceaf0fb8c8c9a302e07cde6c89cc49',
  'front:TelaFotoCartao.jsx': '3a89f39c2b86bfda4fcb21e851e93d14',
  'front:Reparos.jsx': 'e867c991e4cf436ecaad2d8d09614785',
  'front:MapaFotos.jsx': 'c8f341dfebb31fc99b5ecd7abb6bd9b9',
};

const RAIZ = process.cwd();
const FRONT = path.join(RAIZ, '..', 'frontend', 'src');
const modoAntes = process.argv.includes('--antes');
const normalizar = (txt) => txt.replace(/\r\n/g, '\n').replace(/^(?:[ \t]*\n)+/, '').replace(/\s+$/, ''); // 18x: ignora linhas em branco no começo (editor) e no fim
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
  : '\nConferindo arquivos entregues (etapas 1, 3, 4, 6 a E5)\n');

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
  const novos = ['services/relatorioInspecao.js', 'migrations/126_reparos.sql', 'services/reparos.js', 'migrations/125_defeitos_foto.sql', 'services/defeitosFoto.js', 'migrations/124_fotos_cartao_lixeira.sql', 'migrations/123_projetos_foto_local.sql', 'migrations/122_projetos_foto.sql', 'migrations/121_fotos_cartao.sql', 'services/fotoCartao.js', 'routes/fotoCartao.js', 'migrations/120_analise_critica.sql', 'services/analiseCritica.js', 'routes/analiseCritica.js', 'migrations/119_documentos_requisitos.sql', 'migrations/118_auditoria_tratamento.sql', 'migrations/117_auditoria_periodo_docs_registros.sql', 'services/auditoriaRegistros.js', 'migrations/116_auditoria_cancelamento.sql', 'migrations/115_auditoria_execucao.sql', 'migrations/114_auditorias.sql', 'services/auditorias.js', 'routes/auditorias.js', 'migrations/113_nps_modelos.sql', 'migrations/112_nps.sql', 'services/nps.js', 'routes/nps.js', 'routes/npsLink.js', 'services/suprimentos.js', 'routes/suprimentos.js', 'migrations/111_ia_config_empresa.sql', 'services/custoIa.js', 'migrations/110_tipos_equipamento_beta_pendentes.sql', 'services/tiposEquipamento.js', 'routes/tiposEquipamento.js', 'services/betaPendentes.js', 'migrations/109_ferias_historico.sql', 'routes/ausencias.js', 'migrations/108_colaborador_escala.sql', 'services/avisosFerias.js', 'migrations/107_colaborador_emergencia_saude.sql', 'services/feriasRegras/index.js', 'services/feriasRegras/BR.js', 'migrations/106_ferias_regras_faltas.sql', 'services/betaConsultas.js', 'services/ferias.js', 'migrations/105_colaborador_ferias.sql', 'services/beta.js', 'routes/beta.js', 'services/ia/conferir.js', 'services/salaControle/analista.js', 'migrations/104_tarefa_tipo_kpi.sql', 'migrations/103_metas_resultados.sql', 'migrations/102_metas_manuais_responsavel.sql', 'migrations/101_metas_negocio.sql', 'services/metas.js', 'routes/metas.js', 'services/salaControle/index.js', 'routes/salaControle.js', 'services/valorGerado.js', 'routes/valorGerado.js', 'migrations/100_leitura_registrada.sql', 'migrations/099_gestao_usuario_responsavel.sql', 'migrations/098_gestao_pessoas_rastreaveis.sql', 'migrations/097_treinamento_procedimentos.sql', 'migrations/096_gestao_distribuicao.sql', 'routes/meusProcedimentos.js', 'migrations/095_colaborador_vinculo.sql', 'services/cnhPeloLink.js', 'migrations/094_gestao_fluxo_assinaturas.sql', 'services/modelosGestao/iso9001.js', 'migrations/093_gestao_revisoes_leituras.sql', 'migrations/092_documentos_gestao.sql', 'services/documentosGestao.js', 'migrations/091_ia_uso_cache.sql', 'migrations/090_colaborador_cnh.sql', 'migrations/089_ia_uso_foto_colaborador.sql', 'services/leituraCnh.js', 'services/ia/index.js', 'services/analistaMensal.js', 'services/analistaRotina.js', 'services/fornecedoresVisiveis.js', 'services/atuacao.js', 'routes/atuacao.js', 'services/matchSpot.js', 'services/recomendacoesEmail.js', 'routes/recomendacoes.js', 'services/convitesFornecedor.js', 'services/acessoSpot.js', 'services/receitaCnpj.js', 'services/cadastroPublico.js', 'services/emailConfirmacao.js', 'routes/plataforma.js', 'services/plataformaConsole.js', 'middleware/plataformaMiddleware.js', 'scripts/criarAdmin.js', 'routes/manutencao.js', 'services/calendarioManutencao.js', 'services/planosManutencao.js', 'migrations/019_planos_manutencao.sql', 'migrations/020_plano_termino.sql', 'migrations/021_plano_responsavel_dia_util.sql', 'routes/pessoas.js', 'services/documentos.js', 'migrations/022_colaboradores_documentos.sql', 'services/avisosVencimento.js', 'migrations/023_documento_avisos.sql', 'services/funcoes.js', 'migrations/024_funcoes.sql', 'migrations/025_funcoes_detalhes.sql', 'services/epi.js', 'migrations/026_epi_itens.sql', 'migrations/027_epi_catalogo_tamanhos.sql', 'services/epiEntregas.js', 'services/conformidade.js', 'migrations/028_epi_entregas.sql', 'services/historicoFuncoes.js', 'services/avisosPessoas.js', 'migrations/029_historico_funcoes_avisos.sql', 'services/treinamentos.js', 'migrations/030_treinamentos.sql', 'migrations/031_treinamentos_conteudo_horas.sql', 'services/provaOnline.js', 'routes/meusTreinamentos.js', 'routes/provaPublica.js', 'migrations/032_prova_online_colaborador.sql', 'services/competencias.js', 'migrations/033_competencias.sql', 'migrations/034_competencias_nivel.sql', 'services/dossie.js', 'migrations/035_dossie.sql', 'services/multas.js', 'migrations/036_multas.sql', 'services/disciplinar.js', 'migrations/037_disciplinar.sql', 'migrations/038_disciplinar_ciencia.sql', 'services/autuacoes.js', 'routes/autuacoes.js', 'migrations/039_autuacoes.sql', 'services/inspecoes.js', 'routes/inspecoes.js', 'migrations/040_inspecoes.sql', 'routes/inspecaoLink.js', 'migrations/041_inspecoes_tipos_links.sql', 'services/rotinasInspecao.js', 'migrations/042_inspecoes_rotinas_locacao.sql', 'services/contratosLocacao.js', 'routes/contratos.js', 'routes/locatario.js', 'migrations/043_contratos_locatario.sql', 'services/clientes.js', 'migrations/044_clientes.sql', 'services/logoEmpresa.js', 'migrations/045_logo_empresa.sql', 'services/contratoModelos.js', 'migrations/046_modelos_contrato.sql', 'migrations/047_contrato_representante.sql', 'migrations/048_dados_empresa.sql', 'services/perfilEmpresa.js', 'migrations/049_perfil_empresa_cnpj.sql', 'migrations/050_monitor_cnpj.sql', 'services/monitorCnpj.js', 'routes/monitorCnpj.js', 'migrations/051_comercial_bid.sql', 'routes/comercial.js', 'services/bids.js', 'migrations/052_bid_cliente.sql', 'routes/bidLink.js', 'services/bidsCliente.js', 'migrations/053_pedidos_venda.sql', 'services/pedidosVenda.js', 'migrations/054_tarefa_atribuida.sql', 'scripts/previaEmailsBid.js', 'migrations/055_execucoes_at.sql', 'services/execucoes.js', 'routes/programacao.js', 'migrations/056_at_rascunho_link_motorista.sql', 'routes/atLink.js', 'services/fluxoViagem.js', 'migrations/057_fluxo_viagem.sql', 'migrations/058_base_frota.sql', 'routes/minhasViagens.js', 'services/calendarioComercial.js', 'migrations/059_calendario_comercial.sql', 'migrations/060_prospeccao_evento.sql', 'migrations/061_prospeccao_oportunidades.sql', 'services/medicoes.js', 'migrations/062_medicao_locacao.sql', 'migrations/063_medicao_vencimento.sql', 'services/frotaCalendario.js', 'migrations/064_frota_dias_operacao.sql', 'services/utilizacaoFrota.js', 'migrations/065_tarefas_rastreabilidade.sql', 'services/tarefas.js', 'migrations/066_fiscal_transporte.sql', 'services/tarefasFiscais.js', 'migrations/067_tarefa_responsavel.sql', 'services/ocorrencias.js', 'routes/ocorrencias.js', 'migrations/068_ocorrencias.sql', 'migrations/069_ocorrencias_inc_config.sql', 'services/roteiroInicial.js', 'migrations/070_roteiro_inicial.sql', 'services/modulos.js', 'migrations/071_modulos_planos.sql', 'middleware/exigirModulo.js', 'services/chatSpot.js', 'migrations/072_spot_mensagens.sql', 'services/prazoSpot.js', 'migrations/073_spot_prazo_desistencia.sql', 'services/notificacoes.js', 'routes/notificacoes.js', 'migrations/074_notificacoes.sql', 'migrations/075_spot_anexo_email_atraso.sql', 'migrations/076_tenant_segmentos.sql', 'services/assinaturas.js', 'migrations/077_assinaturas.sql', 'migrations/078_assinatura_modalidade_pedidos.sql', 'services/mobilizacao.js', 'migrations/079_contrato_mobilizacao.sql', 'services/fichaCte.js', 'migrations/080_ficha_cte_apolices.sql', 'services/patio.js', 'routes/patio.js', 'migrations/081_patio_cliente.sql', 'migrations/082_patio_pre_entrada.sql', 'migrations/083_patio_area.sql', 'migrations/084_patio_areas.sql', 'migrations/085_contrato_armazenagem.sql', 'migrations/086_contrato_armazenagem_tipo.sql', 'migrations/087_medicao_envio_automatico.sql', 'migrations/088_checklist_medicao_contratual.sql', 'services/cobrancaLocacao.js'];
  try {
    for (const n of novos) {
      const rastreado = execFileSync('git', ['ls-files', n], { cwd: RAIZ, stdio: 'pipe' }).toString().trim();
      if (!rastreado) console.log(`\n⚠️  ${n} ainda não está no git (git add ${n})`);
    }
    for (const nome of ['SeletorAtuacao.jsx', 'BotaoRelatorio.jsx', 'relatorioFotoCartao.js', 'Reparos.jsx', 'Defeitos.jsx', 'VisualizadorFoto.jsx', 'MapaFotos.jsx', 'TelaFotoCartao.jsx', 'CameraCartao.jsx', 'cartaoFoto.js', 'filaFotosCartao.js', 'TelaAnaliseCritica.jsx', 'FichaAnaliseCritica.jsx', 'isoRequisitos.jsx', 'MatrizIso.jsx', 'PendenciasAuditoria.jsx', 'BuscaAuditoria.jsx', 'FichaAuditoria.jsx', 'TelaAuditorias.jsx', 'ModelosNps.jsx', 'TelaNpsPublica.jsx', 'TelaNps.jsx', 'TelaSuprimentos.jsx', 'ModoConversa.jsx', 'CustoIa.jsx', 'vozBeta.js', 'TiposEquipamento.jsx', 'useTiposEquipamento.jsx', 'BetaPendentes.jsx', 'FichaFerias.jsx', 'ausencias.jsx', 'BotoesContato.jsx', 'FichaContato.jsx', 'FichaFeriasFaltas.jsx', 'TelaFerias.jsx', 'Beta.jsx', 'PlanoAcaoMeta.jsx', 'FichaMeta.jsx', 'PainelAnualMetas.jsx', 'TelaMetas.jsx', 'SalaControle.jsx', 'PainelValorGerado.jsx', 'AgingDocumentos.jsx', 'RegistrarLeitura.jsx', 'DocArquivo.jsx', 'CorpoDocGestao.jsx', 'paginasArquivo.js', 'CampoFuncionario.jsx', 'TelaAceitarConvite.jsx', 'TelaPainelFornecedor.jsx', 'AvisoPlanoTenant.jsx', 'CampoTelefone.jsx', 'TelaConfirmarEmail.jsx', 'ConsolePlataforma.jsx', 'TelaCalendarioManutencao.jsx', 'TelaPlanosManutencao.jsx', 'ModalTransferirOS.jsx', 'TelaPessoas.jsx', 'BibliotecaTreinamentos.jsx', 'EditorConteudoTreinamento.jsx', 'AreaTreinamentoColaborador.jsx', 'TelaMeusTreinamentos.jsx', 'AcessoColaborador.jsx', 'TextoAula.jsx', 'TelaProvaPublica.jsx', 'gerarCertificado.js', 'FichaCompetencias.jsx', 'EditorCompetencias.jsx', 'PainelDossie.jsx', 'gerarDossie.js', 'TelaMultas.jsx', 'gerarTermoDesconto.js', 'TelaDisciplinar.jsx', 'gerarMedidaDisciplinar.js', 'TelaAutuacoes.jsx', 'TelaInspecoes.jsx', 'ExecutarInspecao.jsx', 'EditorModeloInspecao.jsx', 'Esquemas.jsx', 'BibliotecaInspecoes.jsx', 'filaInspecoes.js', 'gerarRelatorioInspecao.js', 'TelaInspecaoPublica.jsx', 'RotinasLocacao.jsx', 'gerarRelatorioCumprimento.js', 'TelaContratos.jsx', 'TelaLocatario.jsx', 'Clientes.jsx', 'LogoEmpresa.jsx', 'logoEmpresa.js', 'comprimirImagem.js', 'ModelosContrato.jsx', 'gerarContrato.js', 'BibliotecaContratos.jsx', 'CampoMoeda.jsx', 'DadosEmpresa.jsx', 'CompletarPerfil.jsx', 'CnpjsPlataforma.jsx', 'ModalJustificativaCnpj.jsx', 'TelaMonitorCnpj.jsx', 'FichaBid.jsx', 'ModelosBid.jsx', 'TelaComercial.jsx', 'gerarBid.js', 'TelaBidPublica.jsx', 'EnviarBid.jsx', 'FichaPedido.jsx', 'gerarAT.js', 'TelaProgramacao.jsx', 'FichaAT.jsx', 'MesaProgramacao.jsx', 'EditorAT.jsx', 'VerArquivo.jsx', 'TelaATPublica.jsx', 'EditorFluxo.jsx', 'TelaMinhasViagens.jsx', 'CalendarioComercial.jsx', 'PainelProspeccao.jsx', 'ConcluirTarefa.jsx', 'DetalheExecutivo.jsx', 'marcaFoto.js', 'FiltroPeriodo.jsx', 'MedicaoModal.jsx', 'gerarMedicao.js', 'AbaMedicoes.jsx', 'gerarRelatorioViagem.js', 'DiasFrota.jsx', 'PainelUtilizacao.jsx', 'gerarRelatorioUtilizacao.js', 'ChecklistFiscal.jsx', 'ConfigFiscal.jsx', 'lerXmlFiscal.js', 'CampoPessoa.jsx', 'gerarRelatorioTarefas.js', 'AcaoDocFiscal.jsx', 'RegistrarOcorrencia.jsx', 'PainelOcorrencias.jsx', 'gerarDossieOcorrencia.js', 'areaRestrita.js', 'ConfigOcorrencias.jsx', 'IndicadoresOcorrencias.jsx', 'gerarRelatorioOcorrencias.js', 'BemVindo.jsx', 'MeuPlano.jsx', 'ModulosPlataforma.jsx', 'modulosSessao.js', 'ChatSpot.jsx', 'SinoNotificacoes.jsx', 'TextoComPlano.jsx', 'MobilizacaoContrato.jsx', 'FichaCte.jsx', 'gerarFichaCte.js', 'TelaPatio.jsx', 'gerarComprovantePatio.js', 'GuardaContrato.jsx', 'AnalistaRotina.jsx', 'LerCnh.jsx', 'AjustarFoto.jsx', 'DocumentosGestao.jsx', 'CampoCnpj.jsx', 'MeusProcedimentos.jsx', 'gerarDocumentoGestao.js', 'lerCnh.js', 'AvisoHorimetro.jsx', 'ConfirmarExclusao.jsx', 'ImagemZoom.jsx']) {
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

  // E2.1.1: pacote da TELA que está no package.json mas não foi instalado na sua máquina (npm install) → o Vite local quebra
  try {
    const pkgF = JSON.parse(fs.readFileSync(path.join(RAIZ, '..', 'frontend', 'package.json'), 'utf8'));
    const faltamF = Object.keys(pkgF.dependencies || {}).filter((n) => !fs.existsSync(path.join(RAIZ, '..', 'frontend', 'node_modules', n, 'package.json')));
    if (faltamF.length) { falhas++; console.log(`\n✗ A tela usa pacotes que ainda não estão instalados na sua máquina: ${faltamF.join(', ')}\n  Corrija com: cd ../frontend && npm install   (depois reinicie o npm run dev)`); }
  } catch { /* sem frontend ao lado: ignora */ }

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