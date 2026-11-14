-- 086_contrato_armazenagem_tipo.sql — etapa 18zb: 📦 CONTRATO DE ARMAZENAGEM (CA-AAAA-NNNN) separado do de locação (CL-)
-- Idempotente. Decidido com o Marcony (14/11): locação de área é outro objeto — documento, número e medição próprios,
-- com o mesmo fluxo (modelo, prévia, emissão, aceite, acessos, medição).
--   tipo: locacao (CL-, equipamentos) | armazenagem (CA-, área no pátio: preço do m², área mínima e máxima)
--   A "guarda" ligada dentro do contrato de locação (18za) deixa de existir — os campos arm_* passam a ser do contrato CA.
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'locacao';
ALTER TABLE public.locacao_contratos DROP CONSTRAINT IF EXISTS locacao_contratos_tipo_ck;
ALTER TABLE public.locacao_contratos ADD CONSTRAINT locacao_contratos_tipo_ck CHECK (tipo IN ('locacao','armazenagem'));
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS arm_area_max_m2 numeric(12,2);
UPDATE public.locacao_contratos SET arm_ativo = false WHERE tipo = 'locacao' AND arm_ativo;

-- Biblioteca: modelo-base de armazenagem (a empresa importa e adapta — revisar com o jurídico)
INSERT INTO public.contrato_modelos (tenant_id, nome, descricao, corpo, versao)
SELECT NULL, 'Armazenagem de área — modelo-base', 'Modelo genérico de cessão de área no pátio para guarda de equipamentos do cliente, cobrada por m². Ponto de partida: revise com o seu jurídico antes de usar.', 'CONTRATO DE ARMAZENAGEM Nº {{contrato.numero}}

CONTRATADA: {{empresa.razao_social}}, inscrita no CNPJ sob o nº {{empresa.cnpj}}.

CONTRATANTE: {{cliente.razao_social}}, inscrita no CNPJ/CPF sob o nº {{cliente.documento}}, com endereço em {{cliente.endereco_completo}}, neste ato representada por {{contato.nome}}.

As partes acima identificadas têm entre si justo e contratado o presente Contrato de Armazenagem, que se regerá pelas cláusulas seguintes.

CLÁUSULA 1ª — DO OBJETO
1.1. O presente contrato tem por objeto a cessão, pela CONTRATADA à CONTRATANTE, de área no pátio localizado em {{contrato.local}}, para a guarda de equipamentos de propriedade da CONTRATANTE.
1.2. A área reservada à CONTRATANTE é de até {{armazenagem.maximo}}, com área mínima contratada de {{armazenagem.minimo}}.
1.3. Os equipamentos guardados permanecem de propriedade da CONTRATANTE e não integram o estoque da CONTRATADA.

CLÁUSULA 2ª — DA ENTRADA E DA SAÍDA
2.1. Cada equipamento será recebido mediante conferência do número de série da plaqueta, registro fotográfico e comprovante de entrada emitido pelo sistema da CONTRATADA.
2.2. A retirada será feita por pessoa autorizada pela CONTRATANTE, identificada por documento, com registro fotográfico e comprovante de saída.
2.3. A entrada que ultrapassar a área máxima contratada será comunicada à CONTRATANTE e a área excedente será cobrada pelo mesmo preço do m².

CLÁUSULA 3ª — DO PRAZO
3.1. O contrato terá início em {{contrato.inicio}} e prazo {{contrato.prazo}}.

CLÁUSULA 4ª — DO PREÇO E DO PAGAMENTO
4.1. Pela armazenagem, a CONTRATANTE pagará à CONTRATADA {{armazenagem.preco}}, calculado pela área ocupada por cada equipamento e pelos dias de permanência no pátio, conforme medição mensal.
4.2. Conta-se o dia da entrada e não se conta o dia da saída; entrada e saída no mesmo dia contam um dia.
4.3. Quando a área ocupada no mês for inferior à área mínima contratada, será cobrada a área mínima.
4.4. O pagamento será feito por {{condicoes.forma_pagamento}}, com vencimento todo dia {{condicoes.vencimento_dia}} de cada mês.
4.5. Os valores serão reajustados anualmente pelo índice {{condicoes.reajuste}}.

CLÁUSULA 5ª — DAS OBRIGAÇÕES DA CONTRATADA
5.1. Manter a área em condições adequadas de acesso e segurança, e zelar pela guarda dos equipamentos durante a permanência.
5.2. Registrar a movimentação dos equipamentos e disponibilizar à CONTRATANTE os comprovantes e a ficha de movimentação.

CLÁUSULA 6ª — DAS OBRIGAÇÕES DA CONTRATANTE
6.1. Informar previamente a chegada dos equipamentos e a documentação fiscal correspondente.
6.2. Manter a CONTRATADA informada sobre as pessoas autorizadas a retirar os equipamentos.
6.3. Responder pelos riscos inerentes aos próprios equipamentos, inclusive seguro, salvo dano causado por culpa da CONTRATADA.

CLÁUSULA 7ª — DA RESCISÃO
7.1. O descumprimento de qualquer cláusula autoriza a rescisão do contrato pela parte inocente, com multa de {{condicoes.multa_rescisoria}}.
7.2. Na rescisão, a CONTRATANTE retirará os equipamentos em até 30 (trinta) dias, permanecendo devida a armazenagem até a retirada.

CLÁUSULA 8ª — DAS CONDIÇÕES ESPECÍFICAS
{{condicoes.observacoes}}

CLÁUSULA 9ª — DO FORO
9.1. Fica eleito o foro da comarca de {{condicoes.foro}} para dirimir quaisquer questões oriundas deste contrato.

E, por estarem justas e contratadas, as partes firmam o presente.

{{data_extenso}}.
', 1
WHERE NOT EXISTS (SELECT 1 FROM public.contrato_modelos WHERE tenant_id IS NULL AND nome = 'Armazenagem de área — modelo-base');
