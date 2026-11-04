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
  'routes/configuracoes.js': '369e5ebba188ca83571f631f74dacc8a', // etapa 18g.1
  'routes/fornecedor.js': '9e06852242b8bf79c6384c46b8ee7bb5', // etapa 14e
  'routes/recomendacoes.js': '05628793a30bc9cc5905c137c90fdb9c', // etapa 18g.2d
  'services/recomendacoesEmail.js': '7bc5475ccffb4fd2fcec53be78e64123', // etapa 10c
  'services/emailService.js': '2daf0e597ff370e006585f919c63b525', // etapa 9
  'server.js': 'f62559d9867d79ffde480ee90a4b9256', // etapa 18g.2d
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
  'front:TelaConfiguracoes.jsx': '2b3cd868a39ff5c254253899b0b7b2a5', // etapa 18g.1
  'services/acessoSpot.js': '6ecce4d16d6b123c6ce93c1223b32f01', // etapa 10c (novo)
  'services/receitaCnpj.js': 'b0e2a678127403d5608723c21ec61b78', // etapa 14d.5
  'services/cadastroPublico.js': '1359e67ff1f2438a964eee7223cf2ed1', // etapa 14d.5
  'front:App.jsx': 'bb0ebee9a394b0b0f7a248ef055bf09c', // etapa 18g.1
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
  'front:TelaPlanosManutencao.jsx': '4e19850209fa1924953706a7afde7995', // etapa 18g.2c
  'front:ModalTransferirOS.jsx': '8e7c1bf0d6fc9a4f88bdd9087d22cb37', // etapa 12b.3 (novo)
  'routes/pessoas.js': 'd9227445ccfc9c085b8aa4c7f5550243', // etapa 17b
  'services/documentos.js': 'e4e3f50ffd6ade91d5c2a51a0b115900', // etapa 12e.3
  'front:TelaPessoas.jsx': '07f2dc2f969973efc6ee862ffdec9c71', // etapa 18g.2c
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
  'front:TelaNaoConformidades.jsx': 'eeaf572c39ce97d4bf77f7985c84867d', // etapa 12i.1
  'services/inspecoes.js': '3a0b0f74f10f39e6b2d2acf0831b6aca', // etapa 18c.3
  'routes/inspecoes.js': '2957a18a385cfc150fad54cdf817b4ce', // etapa 14b.2
  'migrations/040_inspecoes.sql': '0ac35a83c9621397570d1be855727cc9', // etapa 14a (novo)
  'front:TelaInspecoes.jsx': 'bc3df7760aec3354a960fd6f7e2194d0', // etapa 18c.4
  'front:ExecutarInspecao.jsx': '42aca570e936f3d535571c3c5256c2ec', // etapa 18c.3
  'front:EditorModeloInspecao.jsx': '00fc0578bd4bcba1221b7ced983727dd', // etapa 14c.1
  'front:Esquemas.jsx': 'f68e56580c3ed088c902109fcb016b9c', // etapa 14a (novo)
  'front:BibliotecaInspecoes.jsx': '104cdfc0dca69548cd4d7ab86152a5cb', // etapa 14a (novo)
  'front:filaInspecoes.js': '68d6f8212410167291b1d8c7e4b1a6e3', // etapa 18c
  'front:gerarRelatorioInspecao.js': '0b12351755d3be30a0297c48a6ea8c9f', // etapa 18c.3
  'routes/inspecaoLink.js': 'e4f98c085d4ec2f7b0fa1556b267fa45', // etapa 14b.1 (novo)
  'migrations/041_inspecoes_tipos_links.sql': 'ddfd59d129a129f0ac2c3f7aef9f62aa', // etapa 14b.1 (novo)
  'front:TelaInspecaoPublica.jsx': '41f4af3384a6db56d3d13dcb0081f6d3', // etapa 14b.1 (novo)
  'routes/equipamentos.js': '2e379d0637f0c8501cbfbad41898ef30', // etapa 14b.1.1
  'services/rotinasInspecao.js': 'b6f7fea57f7690f8d775847469b408bb', // etapa 18d
  'migrations/042_inspecoes_rotinas_locacao.sql': 'bf32500014ddf3f779f1fa29ead5feb9', // etapa 14b.2 (novo)
  'front:RotinasLocacao.jsx': '8bba6c8bb586ff7298f6e0d0b13f8b9b', // etapa 18c.4
  'front:gerarRelatorioCumprimento.js': 'd4b916c75f0a4290ccd9c96bf170ed90', // etapa 14c.1
  'services/contratosLocacao.js': 'd5f2a0b6f66e69454a3e13167d87f366', // etapa 18d.2
  'routes/contratos.js': '4a20ce8943e43d01c09f249c13c316f5', // etapa 18d.5
  'routes/locatario.js': '4f4db87228a3c597ae47ae4836d028d1', // etapa 18d.2
  'migrations/043_contratos_locatario.sql': 'f25735b281aa176b4c31c3cc2bf283ed', // etapa 14b.3 (novo)
  'front:TelaContratos.jsx': 'fda70559d43dc11cc887bf30dfc43007', // etapa 18d.5
  'front:TelaLocatario.jsx': 'd90788a7cac34c8b6660a692a3a9c9dd', // etapa 18d.2
  'services/clientes.js': '9714283f0013553dc96a48b75b6734cf', // etapa 14b.3.1 (novo)
  'migrations/044_clientes.sql': '446d1a52049aea19938d36cc2b01653d', // etapa 14b.3.1 (novo)
  'front:Clientes.jsx': '8dff871d3b22f31e8f33a65c2f1260a7', // etapa 15a
  'routes/usuarios.js': '174bcb3916f6668a8f16e5364874c4e9', // etapa 18g.1
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
  'services/pedidosVenda.js': 'd8257b6ed87d6997dd8a285b0245539f', // etapa 18g.1
  'front:FichaPedido.jsx': '798337dbd7ba34cc802f8d1bfb40a1b3', // etapa 16d
  'migrations/054_tarefa_atribuida.sql': '586bd43f09653a76e8d6a299e55905e3', // etapa 15c.1 (novo)
  'scripts/previaEmailsBid.js': '45b4dbeb2d2d8d84a24e7a31f6826049', // etapa 15c.3 (novo)
  'migrations/055_execucoes_at.sql': 'fc0a780d147f0b3d7e4c92ec71c4554f', // etapa 16a (novo)
  'services/execucoes.js': '86aea7bf597b47522f74ef9abd8a180d', // etapa 18g.2d
  'routes/programacao.js': '98c064abc94e08bd5556d578748a8235', // etapa 18g.2.7
  'front:gerarAT.js': 'd05187877f31e92708abba3c7f338ce3', // etapa 16e.1
  'front:TelaProgramacao.jsx': '4412d157e3d7d579b7c36891e4fe7353', // etapa 18g.2.1
  'front:FichaAT.jsx': '8fe62995eb39307f4f4e3c0aef5f0f2c', // etapa 18g.2d
  'front:MesaProgramacao.jsx': '3ee851df585bea973a6fa97fb1699e5d', // etapa 18g.2.2
  'migrations/056_at_rascunho_link_motorista.sql': '4e9a9185cbb0a1f9770e1fe666fc77f3', // etapa 16c (novo)
  'routes/atLink.js': 'f392ea4dff57d96bc2209bfefdb1707f', // etapa 16e
  'front:EditorAT.jsx': 'fcb77d8397281457f4e5e07774e59422', // etapa 18g.2c
  'front:VerArquivo.jsx': 'f429078383f02f0c072637250e7a1fea', // etapa 16c (novo)
  'front:TelaATPublica.jsx': 'd75104b93496b768a984da4065138955', // etapa 18c
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
  'routes/tarefas.js': '71d8b3e3e943a8d85501e81f4c06e23c', // etapa 18g.2.4
  'migrations/061_prospeccao_oportunidades.sql': '528a098239312cff4b7b389d4325b2f3', // etapa 18b.2 (novo)
  'front:TelaPlanoAcaoNova.jsx': '05c6e1d101abc2f3dbb59940eff30cf0', // etapa 18g.2
  'front:ConcluirTarefa.jsx': 'de3f60dc997a047cc1a29cd2a20ac92d', // etapa 18b.3 (novo)
  'front:DetalheExecutivo.jsx': '7fe748dd4a963a04f71d264bb189318f', // etapa 18b.9 (novo)
  'front:marcaFoto.js': '61fc663e418ff25ac21fd67a04915f5f', // etapa 18c.3
  'front:ModalNovaNC.jsx': '4e6f0f8a0f0708ea862b475bca5df49d', // etapa 18c.3
  'front:ModalDetalheNC.jsx': '1ae23a3fc072448443f4d8cf9c87a190', // etapa 18g.2c
  'front:ModalNaoConformidade.jsx': '244c331b28157bb6c2f14f4736d461e6', // etapa 18c.1
  'front:FiltroPeriodo.jsx': '06b873f17ff380024b38e507bdca6724', // etapa 18c.4 (novo)
  'migrations/062_medicao_locacao.sql': '5a4d7ea7f3180195a19e4121183a446e', // etapa 18d (novo)
  'services/medicoes.js': '6f4a66c7198e2f5ebffa7253770fa1f2', // etapa 18d.5
  'front:MedicaoModal.jsx': 'ebbe2ac8261c9c5c7a911c60d2b1ca62', // etapa 18d.3
  'front:gerarMedicao.js': '24dbe95cf8751b58aa142b487cc777ed', // etapa 18d.2
  'migrations/063_medicao_vencimento.sql': '0b27bacd7a6a0b6d77c01a8039f5192d', // etapa 18d.2 (novo)
  'front:AbaMedicoes.jsx': '368b54092f0a25f379ecdaacfebf2d41', // etapa 18d.5 (novo)
  'front:gerarRelatorioViagem.js': 'd028915abe837d37b94a4082f12d0acd', // etapa 18g.2d
  'services/frotaCalendario.js': 'fd8d5e58894fd55bae016f9cdc362e9b', // etapa 18f.1
  'migrations/064_frota_dias_operacao.sql': 'd96a047b8c22b7d52c0d4a83d1b715ae', // etapa 18f (novo)
  'front:DiasFrota.jsx': '5458e631dfecb24b534d7208fd46be23', // etapa 18f (novo)
  'services/utilizacaoFrota.js': '929b421d152c77b83260466c044776c9', // etapa 18f.1 (novo)
  'front:PainelUtilizacao.jsx': '716912b094bd87943b04d6aa0761de53', // etapa 18f.1 (novo)
  'front:gerarRelatorioUtilizacao.js': '5b0a4286653da51ac7dff27328610083', // etapa 18f.1 (novo)
  'migrations/065_tarefas_rastreabilidade.sql': '3902af0a80d08839d542bd2a65e99d87', // etapa 18g (novo)
  'services/tarefas.js': '9d43b74825db840e65054fbc7fb96fa7', // etapa 18g.2a
  'migrations/066_fiscal_transporte.sql': 'eeef7d2fb80ae6ad0ec6069a3342e0ff', // etapa 18g.1 (novo)
  'services/tarefasFiscais.js': '348da42ae52a6337ae1a0df41b2882d2', // etapa 18g.2d
  'front:ChecklistFiscal.jsx': '1634e6d08490a83f1c0c86c983eb69ae', // etapa 18g.2.4
  'front:ConfigFiscal.jsx': 'b4ceec47991a295f38f32992348ddcf8', // etapa 18g.1 (novo)
  'front:lerXmlFiscal.js': '8d657863784b4e6c468b29bd8152e53f', // etapa 18g.1.1 (novo)
  'migrations/067_tarefa_responsavel.sql': '3e718fa4290311abef8fdb5b2e68eb6b', // etapa 18g.2a (novo)
  'front:CampoPessoa.jsx': 'efa3cd5aee2eeadae0805e7d4b6e8daa', // etapa 18g.2c
  'front:gerarRelatorioTarefas.js': '483dd597e30b11635886ba51406d36cf', // etapa 18g.2b (novo)
  'front:AcaoDocFiscal.jsx': 'eed319fa1d63b104146db0b8eabcd7ed', // etapa 18g.2.7
};

// Antes de copiar a etapa 18g.2d — base: 18g.2.8
const ANTES = {
  'services/tarefasFiscais.js': 'e15081d34740b555650a25e9cd708f31',
  'services/fluxoViagem.js': '1eeeb43378e4fd6f975840ae73b71bc5',
  'services/execucoes.js': '64b94a916ceeb792473044e05a148d6f',
  'server.js': '313b010f664b6332540aaf05a86e52b2',
  'routes/recomendacoes.js': '9fc6bc46bc8de0de943a1d25e0880873',
  'front:FichaAT.jsx': '3034945b304498155014acf93fde3659',
  'front:gerarRelatorioViagem.js': '673808fdf49f6cd317a49738c088c195',
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
  : '\nConferindo arquivos entregues (etapas 1, 3, 4, 6 a 18g.2d)\n');

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
  const novos = ['services/fornecedoresVisiveis.js', 'services/atuacao.js', 'routes/atuacao.js', 'services/matchSpot.js', 'services/recomendacoesEmail.js', 'routes/recomendacoes.js', 'services/convitesFornecedor.js', 'services/acessoSpot.js', 'services/receitaCnpj.js', 'services/cadastroPublico.js', 'services/emailConfirmacao.js', 'routes/plataforma.js', 'services/plataformaConsole.js', 'middleware/plataformaMiddleware.js', 'scripts/criarAdmin.js', 'routes/manutencao.js', 'services/calendarioManutencao.js', 'services/planosManutencao.js', 'migrations/019_planos_manutencao.sql', 'migrations/020_plano_termino.sql', 'migrations/021_plano_responsavel_dia_util.sql', 'routes/pessoas.js', 'services/documentos.js', 'migrations/022_colaboradores_documentos.sql', 'services/avisosVencimento.js', 'migrations/023_documento_avisos.sql', 'services/funcoes.js', 'migrations/024_funcoes.sql', 'migrations/025_funcoes_detalhes.sql', 'services/epi.js', 'migrations/026_epi_itens.sql', 'migrations/027_epi_catalogo_tamanhos.sql', 'services/epiEntregas.js', 'services/conformidade.js', 'migrations/028_epi_entregas.sql', 'services/historicoFuncoes.js', 'services/avisosPessoas.js', 'migrations/029_historico_funcoes_avisos.sql', 'services/treinamentos.js', 'migrations/030_treinamentos.sql', 'migrations/031_treinamentos_conteudo_horas.sql', 'services/provaOnline.js', 'routes/meusTreinamentos.js', 'routes/provaPublica.js', 'migrations/032_prova_online_colaborador.sql', 'services/competencias.js', 'migrations/033_competencias.sql', 'migrations/034_competencias_nivel.sql', 'services/dossie.js', 'migrations/035_dossie.sql', 'services/multas.js', 'migrations/036_multas.sql', 'services/disciplinar.js', 'migrations/037_disciplinar.sql', 'migrations/038_disciplinar_ciencia.sql', 'services/autuacoes.js', 'routes/autuacoes.js', 'migrations/039_autuacoes.sql', 'services/inspecoes.js', 'routes/inspecoes.js', 'migrations/040_inspecoes.sql', 'routes/inspecaoLink.js', 'migrations/041_inspecoes_tipos_links.sql', 'services/rotinasInspecao.js', 'migrations/042_inspecoes_rotinas_locacao.sql', 'services/contratosLocacao.js', 'routes/contratos.js', 'routes/locatario.js', 'migrations/043_contratos_locatario.sql', 'services/clientes.js', 'migrations/044_clientes.sql', 'services/logoEmpresa.js', 'migrations/045_logo_empresa.sql', 'services/contratoModelos.js', 'migrations/046_modelos_contrato.sql', 'migrations/047_contrato_representante.sql', 'migrations/048_dados_empresa.sql', 'services/perfilEmpresa.js', 'migrations/049_perfil_empresa_cnpj.sql', 'migrations/050_monitor_cnpj.sql', 'services/monitorCnpj.js', 'routes/monitorCnpj.js', 'migrations/051_comercial_bid.sql', 'routes/comercial.js', 'services/bids.js', 'migrations/052_bid_cliente.sql', 'routes/bidLink.js', 'services/bidsCliente.js', 'migrations/053_pedidos_venda.sql', 'services/pedidosVenda.js', 'migrations/054_tarefa_atribuida.sql', 'scripts/previaEmailsBid.js', 'migrations/055_execucoes_at.sql', 'services/execucoes.js', 'routes/programacao.js', 'migrations/056_at_rascunho_link_motorista.sql', 'routes/atLink.js', 'services/fluxoViagem.js', 'migrations/057_fluxo_viagem.sql', 'migrations/058_base_frota.sql', 'routes/minhasViagens.js', 'services/calendarioComercial.js', 'migrations/059_calendario_comercial.sql', 'migrations/060_prospeccao_evento.sql', 'migrations/061_prospeccao_oportunidades.sql', 'services/medicoes.js', 'migrations/062_medicao_locacao.sql', 'migrations/063_medicao_vencimento.sql', 'services/frotaCalendario.js', 'migrations/064_frota_dias_operacao.sql', 'services/utilizacaoFrota.js', 'migrations/065_tarefas_rastreabilidade.sql', 'services/tarefas.js', 'migrations/066_fiscal_transporte.sql', 'services/tarefasFiscais.js', 'migrations/067_tarefa_responsavel.sql'];
  try {
    for (const n of novos) {
      const rastreado = execFileSync('git', ['ls-files', n], { cwd: RAIZ, stdio: 'pipe' }).toString().trim();
      if (!rastreado) console.log(`\n⚠️  ${n} ainda não está no git (git add ${n})`);
    }
    for (const nome of ['SeletorAtuacao.jsx', 'TelaAceitarConvite.jsx', 'TelaPainelFornecedor.jsx', 'AvisoPlanoTenant.jsx', 'CampoTelefone.jsx', 'TelaConfirmarEmail.jsx', 'ConsolePlataforma.jsx', 'TelaCalendarioManutencao.jsx', 'TelaPlanosManutencao.jsx', 'ModalTransferirOS.jsx', 'TelaPessoas.jsx', 'BibliotecaTreinamentos.jsx', 'EditorConteudoTreinamento.jsx', 'AreaTreinamentoColaborador.jsx', 'TelaMeusTreinamentos.jsx', 'AcessoColaborador.jsx', 'TextoAula.jsx', 'TelaProvaPublica.jsx', 'gerarCertificado.js', 'FichaCompetencias.jsx', 'EditorCompetencias.jsx', 'PainelDossie.jsx', 'gerarDossie.js', 'TelaMultas.jsx', 'gerarTermoDesconto.js', 'TelaDisciplinar.jsx', 'gerarMedidaDisciplinar.js', 'TelaAutuacoes.jsx', 'TelaInspecoes.jsx', 'ExecutarInspecao.jsx', 'EditorModeloInspecao.jsx', 'Esquemas.jsx', 'BibliotecaInspecoes.jsx', 'filaInspecoes.js', 'gerarRelatorioInspecao.js', 'TelaInspecaoPublica.jsx', 'RotinasLocacao.jsx', 'gerarRelatorioCumprimento.js', 'TelaContratos.jsx', 'TelaLocatario.jsx', 'Clientes.jsx', 'LogoEmpresa.jsx', 'logoEmpresa.js', 'comprimirImagem.js', 'ModelosContrato.jsx', 'gerarContrato.js', 'BibliotecaContratos.jsx', 'CampoMoeda.jsx', 'DadosEmpresa.jsx', 'CompletarPerfil.jsx', 'CnpjsPlataforma.jsx', 'ModalJustificativaCnpj.jsx', 'TelaMonitorCnpj.jsx', 'FichaBid.jsx', 'ModelosBid.jsx', 'TelaComercial.jsx', 'gerarBid.js', 'TelaBidPublica.jsx', 'EnviarBid.jsx', 'FichaPedido.jsx', 'gerarAT.js', 'TelaProgramacao.jsx', 'FichaAT.jsx', 'MesaProgramacao.jsx', 'EditorAT.jsx', 'VerArquivo.jsx', 'TelaATPublica.jsx', 'EditorFluxo.jsx', 'TelaMinhasViagens.jsx', 'CalendarioComercial.jsx', 'PainelProspeccao.jsx', 'ConcluirTarefa.jsx', 'DetalheExecutivo.jsx', 'marcaFoto.js', 'FiltroPeriodo.jsx', 'MedicaoModal.jsx', 'gerarMedicao.js', 'AbaMedicoes.jsx', 'gerarRelatorioViagem.js', 'DiasFrota.jsx', 'PainelUtilizacao.jsx', 'gerarRelatorioUtilizacao.js', 'ChecklistFiscal.jsx', 'ConfigFiscal.jsx', 'lerXmlFiscal.js', 'CampoPessoa.jsx', 'gerarRelatorioTarefas.js', 'AcaoDocFiscal.jsx']) {
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