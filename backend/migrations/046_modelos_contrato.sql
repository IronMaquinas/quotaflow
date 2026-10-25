-- 046_modelos_contrato.sql — etapa 14d: modelos de contrato de locação + condições comerciais + emissão e aceite
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 045.
--   contrato_modelos               → texto do contrato com campos automáticos ({{cliente.nome}}, {{tabela_equipamentos}}…).
--                                     tenant_id NULL = BIBLIOTECA do QuotaFlow (Console); a empresa importa e adapta.
--   locacao_contratos (+)          → modelo_id, condicoes (jsonb: caução, franquia, hora excedente, reajuste, multa,
--                                     vencimento, forma de pagamento, foro, condições específicas), emissão (texto congelado
--                                     + hash) e aceite do locatário (nome, data, assinatura na tela, hash).
--   equipamento_locacoes (+)       → valor_mensal de cada equipamento no contrato.
BEGIN;
DO $$
DECLARE t_tenant text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id';
  IF to_regclass('public.contrato_modelos') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.contrato_modelos (
        id             bigserial PRIMARY KEY,
        tenant_id      %1$s REFERENCES public.tenants(id) ON DELETE CASCADE,   -- NULL = biblioteca
        nome           text NOT NULL,
        descricao      text,
        corpo          text NOT NULL,
        origem_id      bigint REFERENCES public.contrato_modelos(id) ON DELETE SET NULL,
        origem_versao  integer,
        versao         integer NOT NULL DEFAULT 1,
        ativo          boolean NOT NULL DEFAULT true,
        criado_em      timestamptz NOT NULL DEFAULT now(),
        atualizado_em  timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS contrato_modelos_tenant_idx ON public.contrato_modelos (tenant_id);

ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS modelo_id bigint REFERENCES public.contrato_modelos(id) ON DELETE SET NULL;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS condicoes jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS emitido_texto text;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS emitido_tabela jsonb;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS emitido_em timestamptz;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS emitido_por_nome text;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS emitido_hash text;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS emitido_versao integer NOT NULL DEFAULT 0;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS aceite_nome text;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS aceite_usuario_id text;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS aceite_em timestamptz;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS aceite_png text;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS aceite_hash text;
ALTER TABLE public.equipamento_locacoes ADD COLUMN IF NOT EXISTS valor_mensal numeric;

-- Biblioteca: modelo-base (a empresa importa e adapta — revisar com o jurídico)
INSERT INTO public.contrato_modelos (tenant_id, nome, descricao, corpo, versao)
SELECT NULL, 'Locação de equipamentos — modelo-base', 'Modelo genérico de locação mensal de equipamentos (máquinas, empilhadeiras, contêineres). Ponto de partida: revise com o seu jurídico antes de usar.', 'CONTRATO DE LOCAÇÃO DE EQUIPAMENTOS Nº {{contrato.numero}}

LOCADORA: {{empresa.razao_social}}, inscrita no CNPJ sob o nº {{empresa.cnpj}}.

LOCATÁRIA: {{cliente.razao_social}}, inscrita no CNPJ/CPF sob o nº {{cliente.documento}}, com endereço em {{cliente.endereco_completo}}, neste ato representada por {{contato.nome}}.

As partes acima identificadas têm entre si justo e contratado o presente Contrato de Locação de Equipamentos, que se regerá pelas cláusulas seguintes e pelas condições descritas no presente.

CLÁUSULA 1ª — DO OBJETO
1.1. O presente contrato tem por objeto a locação, pela LOCADORA à LOCATÁRIA, dos equipamentos relacionados abaixo, para uso no local {{contrato.local}}:

{{tabela_equipamentos}}

1.2. Os equipamentos são entregues em perfeito estado de conservação e funcionamento, conforme a inspeção de entrega registrada no sistema da LOCADORA, que passa a fazer parte deste contrato.

CLÁUSULA 2ª — DO PRAZO
2.1. A locação terá início em {{contrato.inicio}} e prazo {{contrato.prazo}}.
2.2. Findo o prazo, a devolução dos equipamentos será precedida de inspeção de devolução, comparada com a inspeção de entrega.

CLÁUSULA 3ª — DO PREÇO E DO PAGAMENTO
3.1. Pela locação, a LOCATÁRIA pagará à LOCADORA o valor mensal total de {{valor_mensal_total}}, conforme a tabela da Cláusula 1ª.
3.2. O pagamento será feito por {{condicoes.forma_pagamento}}, com vencimento todo dia {{condicoes.vencimento_dia}} de cada mês.
3.3. A franquia de uso é de {{condicoes.franquia_horas}} horas por mês por equipamento; as horas excedentes serão cobradas a {{condicoes.hora_excedente}} por hora.
3.4. Os valores serão reajustados anualmente pelo índice {{condicoes.reajuste}}.
3.5. A título de caução, a LOCATÁRIA entrega à LOCADORA o valor de {{condicoes.caucao}}, a ser devolvido ao final do contrato, descontados eventuais danos apurados na inspeção de devolução.

CLÁUSULA 4ª — DAS OBRIGAÇÕES DA LOCATÁRIA
4.1. Utilizar os equipamentos somente para o fim a que se destinam, por operadores habilitados e treinados.
4.2. Realizar as inspeções de rotina definidas pela LOCADORA, pelo acesso fornecido no sistema, e comunicar imediatamente qualquer avaria ou defeito.
4.3. Não utilizar equipamento bloqueado por inspeção até a liberação da LOCADORA.
4.4. Não sublocar, emprestar ou retirar os equipamentos do local indicado sem autorização por escrito.
4.5. Responder pelos danos causados aos equipamentos por mau uso, negligência ou acidente, excetuado o desgaste natural.

CLÁUSULA 5ª — DAS OBRIGAÇÕES DA LOCADORA
5.1. Entregar os equipamentos em condições de uso, com a documentação pertinente.
5.2. Realizar a manutenção preventiva e corretiva decorrente do desgaste natural.

CLÁUSULA 6ª — DA RESCISÃO
6.1. O descumprimento de qualquer cláusula autoriza a rescisão do contrato pela parte inocente, com multa de {{condicoes.multa_rescisoria}} sobre o valor dos meses restantes do prazo contratado.

CLÁUSULA 7ª — DAS CONDIÇÕES ESPECÍFICAS
{{condicoes.observacoes}}

CLÁUSULA 8ª — DO FORO
8.1. Fica eleito o foro da comarca de {{condicoes.foro}} para dirimir quaisquer questões oriundas deste contrato.

E, por estarem justas e contratadas, as partes firmam o presente.

{{data_extenso}}.
', 1
WHERE NOT EXISTS (SELECT 1 FROM public.contrato_modelos WHERE tenant_id IS NULL AND nome = 'Locação de equipamentos — modelo-base');
COMMIT;
