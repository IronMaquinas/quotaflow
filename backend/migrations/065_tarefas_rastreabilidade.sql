-- 065_tarefas_rastreabilidade.sql — etapa 18g: 🔗 rastreabilidade das tarefas do ✅ Plano (auditoria ISO)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 064.
--
--   tarefas.tipo      → TR transporte · NC não conformidade · AU auditoria · MT manutenção · CM comercial · HR pessoas · GN geral
--   tarefas.numero    → TSK-<tipo>-<ano>-<nnnn> (ex.: TSK-TR-2026-0001) — sequência por empresa, tipo e ano.
--                       Dado pelo banco (trigger) ao criar e IMUTÁVEL: reclassificar muda só o tipo (fica no histórico).
--   tarefas.anexos    → evidências [{ id, nome, path, mime, tamanho, em, por }] (bucket "documentos")
--   tarefas.historico → quem fez o quê e quando [{ em, por, acao, de, para, texto }]
--   tarefas.vinculos  → cadeia BID → PV → TSK → AT… [{ tipo: 'bid'|'pv'|'trecho'|'at'|'nc'|'prospeccao'|…, id, numero }]
--   tarefa_sequencias → último número por (empresa, tipo, ano)
-- Tarefas que já existem ganham número pela data de criação; o tipo vem da origem
-- (prospecção → CM, multa → HR, autuação → NC; o resto → GN).
BEGIN;

ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS tipo text;
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS anexos jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS historico jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS vinculos jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_tipo_check') THEN
    ALTER TABLE public.tarefas ADD CONSTRAINT tarefas_tipo_check CHECK (tipo IS NULL OR tipo IN ('TR','NC','AU','MT','CM','HR','GN'));
  END IF;
END $$;

-- sequência por empresa/tipo/ano (tenant_id com o mesmo tipo de tenants.id)
DO $$
DECLARE t_tipo text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tipo FROM pg_attribute a
   WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  IF to_regclass('public.tarefa_sequencias') IS NULL THEN
    EXECUTE format('CREATE TABLE public.tarefa_sequencias (
        tenant_id %s NOT NULL,
        tipo      text NOT NULL,
        ano       integer NOT NULL,
        ultimo    integer NOT NULL DEFAULT 0,
        PRIMARY KEY (tenant_id, tipo, ano))', t_tipo);
  END IF;
END $$;
ALTER TABLE public.tarefa_sequencias ENABLE ROW LEVEL SECURITY;

-- tipo pela origem (tarefas criadas por outras telas)
CREATE OR REPLACE FUNCTION public.qf_tarefa_tipo_da_origem(origem text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT CASE origem WHEN 'prospeccao' THEN 'CM' WHEN 'multa' THEN 'HR' WHEN 'autuacao' THEN 'NC' WHEN 'fiscal' THEN 'TR' WHEN 'nc' THEN 'NC' ELSE 'GN' END
$f$;

-- dá o número ao criar; número não muda depois
CREATE OR REPLACE FUNCTION public.qf_tarefa_numerar() RETURNS trigger LANGUAGE plpgsql AS $f$
DECLARE v_ano integer; v_n integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.numero IS NOT NULL THEN NEW.numero := OLD.numero; END IF;
    IF NEW.tipo IS NULL THEN NEW.tipo := COALESCE(OLD.tipo, 'GN'); END IF;
    RETURN NEW;
  END IF;
  IF NEW.tipo IS NULL THEN NEW.tipo := public.qf_tarefa_tipo_da_origem(NEW.origem); END IF;
  IF NEW.numero IS NULL THEN
    v_ano := EXTRACT(YEAR FROM (COALESCE(NEW.criado_em::timestamptz, now()) AT TIME ZONE 'America/Sao_Paulo'))::integer;
    INSERT INTO public.tarefa_sequencias AS s (tenant_id, tipo, ano, ultimo) VALUES (NEW.tenant_id, NEW.tipo, v_ano, 1)
      ON CONFLICT (tenant_id, tipo, ano) DO UPDATE SET ultimo = s.ultimo + 1
      RETURNING ultimo INTO v_n;
    NEW.numero := format('TSK-%s-%s-%s', NEW.tipo, v_ano, lpad(v_n::text, 4, '0'));
  END IF;
  RETURN NEW;
END $f$;

DROP TRIGGER IF EXISTS tarefas_numerar ON public.tarefas;
CREATE TRIGGER tarefas_numerar BEFORE INSERT OR UPDATE ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.qf_tarefa_numerar();

-- tarefas que já existem: tipo pela origem / multas / autuações
UPDATE public.tarefas SET tipo = public.qf_tarefa_tipo_da_origem(origem) WHERE tipo IS NULL AND origem IS NOT NULL;
DO $$ BEGIN
  IF to_regclass('public.multas') IS NOT NULL THEN
    UPDATE public.tarefas t SET tipo = 'HR' WHERE t.tipo IS NULL AND EXISTS (SELECT 1 FROM public.multas m WHERE m.tarefa_id = t.id::text AND m.tenant_id = t.tenant_id);
  END IF;
  IF to_regclass('public.autuacoes') IS NOT NULL THEN
    UPDATE public.tarefas t SET tipo = 'NC' WHERE t.tipo IS NULL AND EXISTS (SELECT 1 FROM public.autuacoes a WHERE a.tarefa_id = t.id::text AND a.tenant_id = t.tenant_id);
  END IF;
END $$;
UPDATE public.tarefas SET tipo = 'GN' WHERE tipo IS NULL;

-- numera as que ainda não têm número (pela data de criação), continuando a sequência
WITH base AS (
  SELECT id, tenant_id, tipo, EXTRACT(YEAR FROM (COALESCE(criado_em::timestamptz, now()) AT TIME ZONE 'America/Sao_Paulo'))::integer AS ano, criado_em
    FROM public.tarefas WHERE numero IS NULL
), seq AS (
  SELECT b.*, COALESCE((SELECT s.ultimo FROM public.tarefa_sequencias s WHERE s.tenant_id = b.tenant_id AND s.tipo = b.tipo AND s.ano = b.ano), 0)
              + row_number() OVER (PARTITION BY b.tenant_id, b.tipo, b.ano ORDER BY b.criado_em NULLS FIRST, b.id) AS n
    FROM base b
)
UPDATE public.tarefas t SET numero = format('TSK-%s-%s-%s', seq.tipo, seq.ano, lpad(seq.n::text, 4, '0'))
  FROM seq WHERE t.id = seq.id;

INSERT INTO public.tarefa_sequencias (tenant_id, tipo, ano, ultimo)
  SELECT tenant_id, split_part(numero, '-', 2), split_part(numero, '-', 3)::integer, max(split_part(numero, '-', 4)::integer)
    FROM public.tarefas WHERE numero ~ '^TSK-[A-Z]{2}-[0-9]{4}-[0-9]+$'
   GROUP BY 1, 2, 3
  ON CONFLICT (tenant_id, tipo, ano) DO UPDATE SET ultimo = GREATEST(public.tarefa_sequencias.ultimo, EXCLUDED.ultimo);

-- histórico inicial das antigas
UPDATE public.tarefas SET historico = jsonb_build_array(jsonb_build_object('em', COALESCE(criado_em::text, now()::text), 'acao', 'criada', 'texto', 'Numerada na migration 065'))
 WHERE historico = '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS tarefas_tenant_numero_uk ON public.tarefas (tenant_id, numero) WHERE numero IS NOT NULL;
CREATE INDEX IF NOT EXISTS tarefas_tenant_tipo_idx ON public.tarefas (tenant_id, tipo);

COMMIT;
