// backend/services/modelosGestao/iso9001.js — etapa 18zt: 📚 BIBLIOTECA DE MODELOS ISO 9001:2015 do QuotaFlow
//   Rascunhos redigidos pelo QuotaFlow para REVISÃO do Marcony (auditor líder) antes de virarem produto.
//   Cada procedimento descreve o fluxo que o PRÓPRIO QuotaFlow executa (a tela citada é onde o registro nasce) — o documento
//   e a prática batem, que é o que o auditor procura. Marcadores: {{EMPRESA}} {{CNPJ}} {{CIDADE_UF}} (preenchidos na
//   importação) e [colchetes] = a empresa completa/ajusta. O modelo entra como RASCUNHO: a empresa revisa e aprova (Rev. 00).
//   Aviso padrão: o modelo é ponto de partida — não garante certificação.

const AVISO = 'Modelo do QuotaFlow (ISO 9001:2015) — ponto de partida: revise com o responsável pela qualidade antes de aprovar. O uso do modelo não garante certificação.';

const M = [];
const add = (id, codigo, titulo, tipo, norma, area, conteudo) => M.push({ id, codigo, titulo, tipo, norma, area, conteudo: conteudo.trim() });

// ───────────────────────────────────────────── POLÍTICA
add('iso9001-politica', 'POL-01', 'Política da Qualidade', 'politica', 'ISO 9001:2015 — 5.2', 'Direção', `
POLÍTICA DA QUALIDADE — {{EMPRESA}}

A {{EMPRESA}} presta serviços de [transporte rodoviário de cargas / locação de equipamentos / armazenagem — ajustar ao escopo] e se compromete a:

1. Atender aos requisitos dos clientes, aos requisitos legais e regulamentares aplicáveis (trânsito, transporte de cargas, segurança do trabalho e meio ambiente) e aos requisitos do Sistema de Gestão da Qualidade.
2. Entregar a carga e o equipamento no prazo, no local e nas condições combinados, preservando a propriedade do cliente sob nossa guarda.
3. Manter frota e equipamentos inspecionados, com manutenção em dia, e motoristas e operadores habilitados, treinados e competentes.
4. Selecionar, avaliar e acompanhar fornecedores pela qualidade, prazo e custo.
5. Tratar toda não conformidade com análise de causa e ação corretiva, aprendendo com os erros.
6. Melhorar continuamente a eficácia do Sistema de Gestão da Qualidade, com objetivos mensuráveis acompanhados pela direção.

Esta política é comunicada a todos os colaboradores, está disponível às partes interessadas pertinentes e é analisada criticamente pela direção [anualmente].

{{CIDADE_UF}}, [data].
[Nome] — [Cargo da alta direção]
`);

// ───────────────────────────────────────────── MANUAL
add('iso9001-manual', 'MQ-01', 'Manual da Qualidade', 'manual', 'ISO 9001:2015 — 4 a 10', 'Qualidade', `
1. APRESENTAÇÃO DA EMPRESA
{{EMPRESA}} — CNPJ {{CNPJ}} — {{CIDADE_UF}}.
[Breve histórico, atividades, unidades, número de colaboradores e frota.]

2. ESCOPO DO SISTEMA DE GESTÃO DA QUALIDADE (4.3)
[Ex.: "Prestação de serviços de transporte rodoviário de cargas, incluindo cargas indivisíveis e excedentes, locação de equipamentos com e sem operador e armazenagem de bens de clientes em pátio próprio."]
Requisitos não aplicáveis e justificativa: [ex.: 8.3 — Projeto e desenvolvimento: a empresa não projeta produtos nem serviços; executa serviços conforme especificação do cliente.]

3. CONTEXTO DA ORGANIZAÇÃO E PARTES INTERESSADAS (4.1 e 4.2)
Questões internas e externas e partes interessadas (clientes, colaboradores, motoristas agregados, fornecedores, órgãos reguladores — ANTT, DETRAN, DER/DNIT, Receita, ambientais) são analisadas criticamente pela direção [anualmente], registradas em [documento/ata de análise crítica].

4. PROCESSOS DO SGQ E SUA INTERAÇÃO (4.4)
Processos principais e onde são executados e registrados no QuotaFlow:
- Comercial — propostas, BID e contratos: 📈 Comercial e 📑 Contratos.
- Programação e execução do transporte — AT (autorização de transporte), link do motorista, etapas da viagem: 🚛 Programação.
- Locação e medição — contratos de locação, medição mensal e aceite do cliente: 📑 Contratos.
- Armazenagem / propriedade do cliente — entrada, guarda e saída de bens: 📦 Propriedade do cliente.
- Manutenção e inspeção de equipamentos — rotinas, inspeções, OS: 🔍 Inspeções e 🛠️ Ordem de Serviço.
- Compras e fornecedores — requisição, cotação, ordem de compra, recebimento, avaliação: 🔧 Requisição de Compras, 📋 Compras, 📥 Recebimento, 🏭 Fornecedores.
- Pessoas — funções, competências, treinamentos, EPI, documentos: 👷 Pessoas.
- Melhoria — não conformidades e ações corretivas: ⚠️ Não Conformidades.
[Inserir o mapa de processos da empresa.]

5. LIDERANÇA (5)
A alta direção demonstra liderança e comprometimento estabelecendo a Política da Qualidade (POL-01), os objetivos da qualidade, provendo recursos e conduzindo a análise crítica. Funções e responsabilidades estão definidas nas descrições de função (👷 Pessoas → Funções).

6. PLANEJAMENTO (6)
Riscos e oportunidades são levantados por processo em [planilha/documento de riscos], com ações e verificação de eficácia. Objetivos da qualidade: [ex.: entregas no prazo ≥ 95%; cumprimento da rotina de inspeção ≥ 90%; NC de fornecedor resolvidas em até 30 dias] — acompanhados mensalmente (🧠 Analista e indicadores do sistema).

7. APOIO (7)
- Recursos e infraestrutura: frota e equipamentos com rotina de inspeção e manutenção (PQ-07).
- Recursos de monitoramento e medição: [tacógrafo, balança, instrumentos — calibração conforme PQ-07].
- Competência e conscientização: PQ-05.
- Informação documentada: PQ-01 (este manual, procedimentos e registros ficam em 📁 Documentos → 📘 Gestão).

8. OPERAÇÃO (8)
- Requisitos do cliente e análise crítica do contrato: BID/proposta e contrato no 📈 Comercial e 📑 Contratos.
- Controle de provedores externos: PQ-06.
- Prestação do serviço sob condições controladas: AT com documentos do motorista e do veículo conferidos na data da viagem; inspeção pré-uso; ordem obrigatória das etapas (🚛 Programação).
- Propriedade do cliente: PQ-04.
- Controle de saídas não conformes: PQ-03.

9. AVALIAÇÃO DE DESEMPENHO (9)
- Satisfação do cliente: [pesquisa/reclamações — método e frequência].
- Auditoria interna: [frequência, programa e qualificação dos auditores — procedimento PQ-08, se adotado].
- Análise crítica pela direção: [frequência], com as entradas do item 9.3.2 da norma.

10. MELHORIA (10)
Não conformidades e ações corretivas: PQ-02. Melhoria contínua pelos indicadores, auditorias e análises críticas.

11. LISTA DE DOCUMENTOS DO SGQ
POL-01 Política da Qualidade · PQ-01 Controle de informação documentada · PQ-02 Não conformidade e ação corretiva · PQ-03 Controle de saída não conforme · PQ-04 Propriedade do cliente · PQ-05 Competência, treinamento e conscientização · PQ-06 Aquisição e avaliação de fornecedores · PQ-07 Inspeção, manutenção e controle de equipamentos.
`);

// ───────────────────────────────────────────── PQ-01
add('iso9001-pq01', 'PQ-01', 'Controle de informação documentada', 'procedimento', 'ISO 9001:2015 — 7.5', 'Qualidade', `
1. OBJETIVO
Definir como a informação documentada do SGQ é criada, identificada, revisada, aprovada, distribuída, protegida e mantida.

2. ABRANGÊNCIA
Manual, políticas, procedimentos, instruções, formulários e registros do SGQ da {{EMPRESA}}.

3. REFERÊNCIAS
ISO 9001:2015 — 7.5. Manual da Qualidade (MQ-01).

4. RESPONSABILIDADES
- Qualidade: manter a lista de documentos, controlar revisões e aprovar documentos do SGQ.
- Gestores de área: elaborar e revisar os documentos dos seus processos.
- Todos: usar sempre a revisão vigente e confirmar a leitura quando solicitado.

5. DESCRIÇÃO
5.1 Identificação — todo documento tem código (MQ manual, POL política, PQ procedimento, IT instrução, FO formulário), título, revisão (Rev. 00, 01…), situação, elaborador, aprovador e data, registrados no QuotaFlow (📁 Documentos → 📘 Gestão).
5.2 Elaboração e aprovação — o documento novo é criado como rascunho, revisado e aprovado por [Qualidade/Direção]; ao aprovar passa a "Vigente".
5.3 Alteração — a alteração é feita por "Nova revisão": a revisão vigente continua valendo até a nova ser aprovada; é obrigatório descrever o que mudou. Aprovada a nova revisão, a anterior passa automaticamente a "Obsoleta" e fica no histórico, identificada como cópia não controlada.
5.4 Distribuição e acesso — a versão vigente fica disponível no sistema para os perfis autorizados. Cópias impressas são não controladas, salvo quando [identificadas e controladas pela Qualidade].
5.5 Conscientização — a cada revisão os envolvidos confirmam a leitura ("Li e entendi"); a Qualidade acompanha quem leu.
5.6 Análise crítica — cada documento tem data de próxima análise crítica [no máximo 2 anos]; vencida a data, o sistema sinaliza.
5.7 Documentos de origem externa — normas, legislação, manuais de fabricantes: [lista e forma de controle].
5.8 Registros — os registros gerados pelo QuotaFlow (inspeções, OS, NC, treinamentos, entregas de EPI, AT, movimentação do pátio, medições) ficam protegidos contra alteração indevida, com trilha de quem fez e quando, e são mantidos por [prazo — ex.: 5 anos], com cópia de segurança [do provedor do sistema].

6. REGISTROS
Lista de documentos e histórico de revisões (📘 Gestão) · Confirmações de leitura · Registros dos módulos do QuotaFlow.
`);

// ───────────────────────────────────────────── PQ-02
add('iso9001-pq02', 'PQ-02', 'Não conformidade e ação corretiva', 'procedimento', 'ISO 9001:2015 — 10.2', 'Qualidade', `
1. OBJETIVO
Estabelecer como as não conformidades (NC) são registradas, contidas, analisadas e corrigidas, com ação corretiva sobre a causa e verificação de eficácia.

2. ABRANGÊNCIA
NC de produto/serviço, de fornecedor, de processo interno, de auditoria e reclamações de cliente.

3. REFERÊNCIAS
ISO 9001:2015 — 10.2 e 8.7. PQ-03 (Saída não conforme). PQ-06 (Fornecedores).

4. RESPONSABILIDADES
- Qualquer colaborador: registrar a NC ao identificá-la.
- Comprador/gestor da área: tratar a NC com o fornecedor ou a área responsável.
- Qualidade: analisar a causa, aprovar a ação corretiva, verificar a eficácia e encerrar.

5. DESCRIÇÃO
5.1 Registro — a NC é aberta no QuotaFlow (⚠️ Não Conformidades), a partir da OS, do recebimento, da inspeção ou manualmente, com descrição, item, quantidade, lote/série, evidências (fotos/PDF) e origem.
5.2 Contenção / correção imediata — a NC ativa bloqueia a conclusão da ordem de serviço ligada a ela; o item é tratado conforme PQ-03 (identificação e segregação). [Descrever a contenção física, se houver.]
5.3 Tratativa com o fornecedor — quando a causa é do fornecedor, ele é notificado pelo sistema e responde no portal (resolver ou contestar). O comprador valida, devolve para nova rodada, aceita a contestação (cancela a NC) ou a rejeita. Se a triagem concluir que não é do fornecedor, a NC é marcada como interna.
5.4 Análise de causa — a Qualidade registra a causa raiz (5 porquês ou outra técnica) e avalia se NC semelhante existe ou pode ocorrer em outro lugar.
5.5 Ação corretiva — definida, com responsável e prazo, proporcional ao efeito da NC; quando aplicável, atualizam-se riscos e oportunidades e documentos do SGQ (PQ-01).
5.6 Eficácia — após [30/60/90 dias], a Qualidade verifica se a NC voltou a ocorrer (o 🧠 Analista aponta falhas recorrentes por item e equipamento) e encerra ou reabre o tratamento.
5.7 Encerramento — a NC é resolvida no sistema com a trilha de auditoria completa; o PDF da NC (versão interna ou do fornecedor) é o registro.

6. REGISTROS
NC no QuotaFlow (com evidências, tratativa, causa raiz e trilha) · PDF da NC · e-mails de notificação.

7. INDICADORES
[NC abertas no mês · tempo médio de encerramento · NC reincidentes · NC por fornecedor.]
`);

// ───────────────────────────────────────────── PQ-03
add('iso9001-pq03', 'PQ-03', 'Controle de saída não conforme', 'procedimento', 'ISO 9001:2015 — 8.7', 'Operação', `
1. OBJETIVO
Garantir que material, equipamento ou serviço não conforme seja identificado e controlado para evitar uso ou entrega não intencional.

2. ABRANGÊNCIA
Materiais recebidos, peças, equipamentos e veículos da frota, cargas sob responsabilidade da {{EMPRESA}} e serviços prestados.

3. REFERÊNCIAS
ISO 9001:2015 — 8.7. PQ-02 (NC e ação corretiva). PQ-07 (Inspeção e manutenção).

4. RESPONSABILIDADES
- Recebimento / almoxarifado: identificar e segregar material não conforme.
- Inspetor / motorista / operador: registrar a reprovação na inspeção.
- Gestor / Qualidade: decidir a disposição e liberar mediante justificativa.

5. DESCRIÇÃO
5.1 Material recebido não conforme — registrado como NC no recebimento (📥 Recebimento → NC); o item fica identificado como não conforme e [segregado na área de quarentena — descrever local e identificação física] até a disposição.
5.2 Equipamento/veículo reprovado — a inspeção com item crítico reprovado ("impede o uso") deixa o equipamento reprovado e trava a etapa da viagem no QuotaFlow; ele só volta a operar após correção (resolução registrada ou OS concluída) ou nova inspeção aprovada.
5.3 Documento vencido — CNH do motorista ou CRLV vencidos na data da viagem travam a AT; a liberação excepcional só por gestor/admin, com justificativa registrada.
5.4 Disposição — [retrabalho/reparo, devolução ao fornecedor, sucateamento, uso sob concessão com autorização do cliente quando aplicável]. A disposição e quem autorizou ficam registrados na NC ou na OS.
5.5 Serviço não conforme detectado após a entrega — registrado como NC (origem reclamação/cliente) e tratado conforme PQ-02, com comunicação ao cliente.

6. REGISTROS
NC · inspeção reprovada e sua correção · OS · liberação com justificativa na AT.
`);

// ───────────────────────────────────────────── PQ-04
add('iso9001-pq04', 'PQ-04', 'Propriedade do cliente', 'procedimento', 'ISO 9001:2015 — 8.5.3', 'Operação', `
1. OBJETIVO
Estabelecer como os bens dos clientes sob guarda ou uso da {{EMPRESA}} são identificados, verificados, protegidos e salvaguardados.

2. ABRANGÊNCIA
Equipamentos e bens de clientes armazenados no pátio, cargas em transporte e documentos/dados de clientes.

3. REFERÊNCIAS
ISO 9001:2015 — 8.5.3. Contrato de armazenagem (CA) e de locação (CL). PQ-02.

4. RESPONSABILIDADES
- Pátio / portaria: registrar entrada, guarda e saída.
- Motorista: conferir a carga na coleta e na entrega.
- Gestor: comunicar o cliente em caso de perda, dano ou uso inadequado.

5. DESCRIÇÃO
5.1 Entrada — todo bem é registrado no QuotaFlow (📦 Propriedade do cliente) com cliente, CNPJ, nota fiscal, identificação (série/chassi/placa), área ocupada e fotos na chegada; o comprovante de entrada é emitido.
5.2 Guarda — o bem fica na área cadastrada; ocupação e excesso de área contratada são acompanhados pelo sistema; [regras de segurança, acesso e conservação do pátio].
5.3 Movimentação e saída — toda saída registra quem retirou, documento, placa, nota de saída e, quando a {{EMPRESA}} faz o transporte, a AT vinculada; o comprovante de saída é emitido. A ficha de movimentação é o histórico do bem.
5.4 Carga em transporte — a AT registra a carga, nº de série e as etapas (coleta, trânsito, entrega) com inspeções de carregamento/trânsito/descarregamento quando aplicáveis.
5.5 Perda, dano ou inadequação — registrada como NC (PQ-02) com fotos, e o cliente é comunicado [prazo e meio]; o registro do comunicado é mantido.
5.6 Dados do cliente — tratados conforme LGPD; acesso por perfil no sistema.

6. REGISTROS
Comprovantes de entrada e saída · ficha de movimentação · fotos · AT · NC e comunicação ao cliente.
`);

// ───────────────────────────────────────────── PQ-05
add('iso9001-pq05', 'PQ-05', 'Competência, treinamento e conscientização', 'procedimento', 'ISO 9001:2015 — 7.2 e 7.3', 'Pessoas', `
1. OBJETIVO
Assegurar que as pessoas que realizam trabalhos que afetam a qualidade sejam competentes, treinadas e conscientes.

2. ABRANGÊNCIA
Colaboradores próprios e, no que couber, motoristas agregados e terceiros que atuem em nome da {{EMPRESA}}.

3. REFERÊNCIAS
ISO 9001:2015 — 7.2 e 7.3. Normas regulamentadoras aplicáveis [NR-11, NR-12, NR-35, MOPP etc.].

4. RESPONSABILIDADES
- RH / Pessoas: manter funções, requisitos e registros.
- Gestores: identificar necessidades de treinamento e avaliar competência.
- Qualidade: verificar a eficácia das ações.

5. DESCRIÇÃO
5.1 Requisitos por função — cada função tem descritivo, requisitos, documentos exigidos (ex.: CNH, ASO), EPI e treinamentos obrigatórios e competências com nível esperado (👷 Pessoas → Funções).
5.2 Situação de cada pessoa — a ficha do colaborador mostra o que é exigido × o que ele tem (documentos, EPI, treinamentos, competências) e o percentual de conformidade.
5.3 Treinamento — turmas presenciais ou online, com conteúdo, prova e carga horária registrados; documentos e treinamentos com vencimento geram aviso antes de vencer.
5.4 Competência e eficácia — competência é avaliada pelo nível demonstrado, não apenas pela presença no treinamento; a eficácia é verificada [na avaliação de competência / desempenho no período].
5.5 Conscientização — política da qualidade, objetivos e procedimentos aplicáveis são comunicados e a leitura é confirmada no sistema ("Li e entendi"); [integração de novos colaboradores].
5.6 Documentos pessoais — CNH (com leitura automática), ASO e demais ficam em 📁 Documentos, com alerta de vencimento.

6. REGISTROS
Ficha do colaborador · listas de presença/provas · certificados · avaliações de competência · confirmações de leitura · dossiê do colaborador.
`);

// ───────────────────────────────────────────── PQ-06
add('iso9001-pq06', 'PQ-06', 'Aquisição e avaliação de fornecedores', 'procedimento', 'ISO 9001:2015 — 8.4', 'Compras', `
1. OBJETIVO
Assegurar que produtos e serviços providos externamente atendam aos requisitos, por meio de seleção, avaliação, monitoramento e reavaliação de fornecedores.

2. ABRANGÊNCIA
Compras de peças, materiais, serviços de manutenção e serviços terceirizados que afetam a qualidade (incluindo agregados, quando aplicável).

3. REFERÊNCIAS
ISO 9001:2015 — 8.4. PQ-02.

4. RESPONSABILIDADES
- Solicitante: requisitar com a especificação correta.
- Compras: cotar, selecionar e emitir o pedido.
- Recebimento: conferir e registrar NC.
- Qualidade/Compras: avaliar e reavaliar fornecedores.

5. DESCRIÇÃO
5.1 Requisição — a necessidade nasce na OS ou na requisição de compras (🔧 Requisição de Compras), com item do catálogo e especificação.
5.2 Cotação e seleção — cotação no 📋 Compras (inclusive com fornecedores do marketplace e canal spot), com critérios de [preço, prazo, histórico de qualidade, documentação]; aprovação conforme alçada (✅ Aprovações).
5.3 Pedido — a ordem de compra/venda registra o que foi comprado, de quem, preço e prazo.
5.4 Verificação no recebimento — conferência no 📥 Recebimento; divergência vira NC ao fornecedor (PQ-02), notificada pelo sistema.
5.5 Monitoramento e reavaliação — [periodicidade] com base em entregas no prazo, NC e preço praticado; situação cadastral do CNPJ acompanhada (🛡 Monitor de CNPJs). Fornecedor reprovado: [regra de bloqueio/plano de ação].

6. REGISTROS
Requisições · cotações · aprovações · pedidos · recebimentos · NC de fornecedor · avaliação de fornecedores.
`);

// ───────────────────────────────────────────── PQ-07
add('iso9001-pq07', 'PQ-07', 'Inspeção, manutenção e controle de equipamentos', 'procedimento', 'ISO 9001:2015 — 7.1.3, 7.1.5 e 8.5.1', 'Manutenção', `
1. OBJETIVO
Manter frota e equipamentos em condições seguras e adequadas à prestação do serviço, por inspeção periódica, manutenção preventiva e corretiva e controle de documentos e instrumentos.

2. ABRANGÊNCIA
Cavalos, carretas, implementos, equipamentos de locação e instrumentos de medição.

3. REFERÊNCIAS
ISO 9001:2015 — 7.1.3, 7.1.5, 8.5.1. Manuais dos fabricantes. PQ-03.

4. RESPONSABILIDADES
- Manutenção: planejar e executar manutenção e manter o histórico.
- Motorista/operador/inspetor: realizar as inspeções da rotina e o pré-uso.
- Locatário (equipamento locado): realizar as inspeções sob sua responsabilidade, conforme contrato.
- Gestor: acompanhar o cumprimento da rotina.

5. DESCRIÇÃO
5.1 Rotina de inspeção — cada equipamento tem rotinas (pré-uso, diária, semanal, mensal) com checklist, responsável (empresa ou locatário) e janela; o QuotaFlow acompanha o cumprimento e avisa atrasos (🔍 Inspeções).
5.2 Inspeção — feita no celular, com fotos, km/horímetro quando exigidos; item crítico reprovado impede o uso (PQ-03) e pode abrir OS.
5.3 Manutenção — preventiva por calendário/km/horas e corretiva por OS (🛠️ Ordem de Serviço), com peças e serviços comprados conforme PQ-06.
5.4 Documentos do equipamento — CRLV, licenças e certificados controlados em 📁 Documentos, com alerta de vencimento; documento vencido trava a AT.
5.5 Análise — o 🧠 Analista da rotina mostra cumprimento, itens que mais falham, reincidências e tempo até a liberação; o gestor usa para priorizar preventiva e substituição.
5.6 Instrumentos de medição — [lista, frequência de calibração/verificação, rastreabilidade e o que fazer quando fora de tolerância].

6. REGISTROS
Inspeções (com fotos) · OS · histórico do equipamento · documentos · relatório mensal do analista · certificados de calibração.
`);

module.exports = { AVISO, MODELOS: M };
