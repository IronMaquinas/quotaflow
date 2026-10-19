-- 024_funcoes.sql — etapa 12d.0: funções (cargos) com descritivo e documentos exigidos
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 023.
--
--   funcoes                 → tenant_id NULL = BIBLIOTECA do QuotaFlow (todos os tenants veem e importam;
--                             mantida pelo Console da Plataforma). tenant_id preenchido = função da empresa
--                             (cópia importada ou criada do zero). Importar COPIA: o tenant adapta à vontade.
--                             origem_id/origem_versao = de qual modelo veio e em qual versão (aviso "versão nova").
--   funcoes.documentos      → jsonb [{ codigo, obs }] — códigos de documento_tipos (alvo colaborador): ASO, CNH…
--   funcoes.epis / .treinamentos → jsonb, reservados para 12d (EPI) e 12e (treinamentos)
--   colaboradores.funcao_id → função do colaborador (o texto "funcao" continua, com o nome, para histórico)

BEGIN;

DO $$
DECLARE t_tenant text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant FROM pg_attribute a
   WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id';

  IF to_regclass('public.funcoes') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.funcoes (
        id             bigserial PRIMARY KEY,
        tenant_id      %1$s REFERENCES public.tenants(id) ON DELETE CASCADE,   -- NULL = biblioteca
        nome           text NOT NULL,
        descritivo     text,                 -- atividades e responsabilidades
        requisitos     text,                 -- escolaridade, experiência, habilitação, competências
        documentos     jsonb NOT NULL DEFAULT '[]'::jsonb,
        epis           jsonb NOT NULL DEFAULT '[]'::jsonb,
        treinamentos   jsonb NOT NULL DEFAULT '[]'::jsonb,
        versao         integer NOT NULL DEFAULT 1,
        origem_id      bigint REFERENCES public.funcoes(id) ON DELETE SET NULL,
        origem_versao  integer,
        ativo          boolean NOT NULL DEFAULT true,
        criado_em      timestamptz NOT NULL DEFAULT now(),
        atualizado_em  timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS funcoes_nome_unico ON public.funcoes (COALESCE(tenant_id::text, '-'), lower(nome)) WHERE ativo;
CREATE INDEX IF NOT EXISTS funcoes_tenant_idx ON public.funcoes (tenant_id);

ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS funcao_id bigint REFERENCES public.funcoes(id) ON DELETE SET NULL;

-- Biblioteca inicial (transportadora). Só insere o que ainda não existe.
INSERT INTO public.funcoes (tenant_id, nome, descritivo, requisitos, documentos)
SELECT NULL, v.nome, v.descritivo, v.requisitos, v.documentos::jsonb
FROM (VALUES
  ('Motorista carreteiro',
   'Conduzir veículo de carga (carreta/truck) nas rotas definidas pelo tráfego, cumprindo horários e a legislação de trânsito e de jornada (Lei 13.103). Fazer o checklist diário do veículo antes da saída e registrar avarias. Acompanhar carga e descarga, conferir notas fiscais e documentos da viagem. Zelar pela carga, pelo veículo e pela própria segurança. Comunicar ocorrências (acidente, roubo, pane, atraso) imediatamente ao tráfego.',
   'Ensino fundamental completo. CNH categoria E dentro da validade, com EAR (exerce atividade remunerada). Experiência mínima de 1 ano com veículo pesado. Curso de direção defensiva. Exame toxicológico em dia.',
   '[{"codigo":"cnh"},{"codigo":"toxicologico"},{"codigo":"aso"}]'),
  ('Motorista de produtos perigosos (MOPP)',
   'Conduzir veículo com produtos perigosos conforme a Resolução ANTT 5.998 e o NR-20 quando aplicável. Conferir ficha de emergência, envelope, rótulos de risco e painéis de segurança antes da saída. Fazer o checklist do veículo e do kit de emergência. Em caso de vazamento ou acidente, seguir o plano de emergência e acionar os órgãos competentes. Cumprir jornada, rotas e paradas autorizadas.',
   'Ensino fundamental completo. CNH categoria compatível (C, D ou E) com EAR. Curso MOPP válido. Experiência mínima de 2 anos com veículo pesado. Exame toxicológico em dia.',
   '[{"codigo":"cnh"},{"codigo":"mopp"},{"codigo":"toxicologico"},{"codigo":"aso"}]'),
  ('Mecânico de veículos pesados',
   'Executar manutenção preventiva e corretiva de motor, transmissão, freios, suspensão e direção de caminhões e carretas, conforme as ordens de serviço. Diagnosticar falhas, solicitar peças pela requisição de materiais e registrar horas e serviços na OS. Testar o veículo após o reparo. Manter ferramentas e oficina organizadas e seguir as normas de segurança (calçamento, bloqueio, EPI).',
   'Ensino fundamental completo; curso técnico ou profissionalizante em mecânica de veículos pesados. Experiência mínima de 2 anos. Desejável CNH categoria C para teste de rodagem.',
   '[{"codigo":"aso"}]'),
  ('Eletricista automotivo',
   'Diagnosticar e reparar sistemas elétricos e eletrônicos dos veículos (partida, carga, iluminação, chicotes, sensores, módulos, tacógrafo e rastreador). Usar scanner e multímetro, registrar o serviço na OS e solicitar peças pela requisição de materiais. Seguir as normas de segurança em eletricidade e o bloqueio de energia.',
   'Ensino médio completo; curso de eletricidade automotiva. Experiência mínima de 2 anos com veículos pesados.',
   '[{"codigo":"aso"}]'),
  ('Borracheiro',
   'Montar, desmontar, consertar e calibrar pneus de caminhões e carretas. Fazer o rodízio e a inspeção de pneus (sulco, desgaste, avarias), registrar na OS e controlar o estoque de pneus e recapagens. Usar gaiola de proteção na calibragem e seguir as normas de segurança.',
   'Ensino fundamental. Experiência mínima de 1 ano com pneus de veículos pesados.',
   '[{"codigo":"aso"}]'),
  ('Ajudante / Conferente',
   'Auxiliar na carga, descarga e arrumação das mercadorias no veículo e no armazém. Conferir quantidades e avarias com a nota fiscal e registrar divergências. Acompanhar o motorista nas entregas quando escalado. Manter a área de trabalho limpa e organizada.',
   'Ensino fundamental. Desejável experiência com logística ou armazém.',
   '[{"codigo":"aso"}]'),
  ('Lavador de veículos',
   'Lavar e higienizar cabines, carrocerias, baús e chassis, usando os produtos e equipamentos indicados. Informar à manutenção avarias, vazamentos ou desgastes percebidos durante a lavagem. Seguir as normas ambientais de descarte (caixa separadora de água e óleo).',
   'Ensino fundamental. Treinamento no uso de lavadora de alta pressão e produtos químicos.',
   '[{"codigo":"aso"}]'),
  ('Assistente de tráfego / administrativo',
   'Programar viagens e escalas de motoristas e veículos, acompanhar as entregas pelo rastreador e registrar ocorrências. Emitir e conferir documentos de transporte (CT-e, MDF-e, notas). Atender clientes e motoristas e apoiar o controle de jornada, multas e documentos da frota.',
   'Ensino médio completo. Conhecimento de informática (planilhas e sistemas). Desejável experiência em transportadora.',
   '[{"codigo":"aso"}]')
) AS v(nome, descritivo, requisitos, documentos)
WHERE NOT EXISTS (
  SELECT 1 FROM public.funcoes f WHERE f.tenant_id IS NULL AND lower(f.nome) = lower(v.nome)
);

COMMIT;
