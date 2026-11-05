-- 068_ocorrencias.sql — etapa 18h: ⚠️ registro de ocorrência / sinistro unificado (SIN-AAAA-NNNN)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 067.
--   ocorrencias: uma por evento (avaria, pane, acidente, furto/roubo, outro), aberta pela AT (transporte) ou pelo contrato de locação
--   (o locatário escolhe um equipamento locado). contexto = retrato do momento (motorista, conjunto, carga, CT-e, última inspeção…),
--   que NÃO muda se a AT ou o contrato mudarem depois. numero SIN-AAAA-NNNN por empresa/ano (trigger), imutável.
--   "parado" só avisa — o comercial decide o que fazer (nada é descontado automaticamente).
DO $$
DECLARE t_tenant text; t_usuario text; t_exec text; t_contrato text; t_equip text; t_tarefa text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant  FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass  AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_exec    FROM pg_attribute a WHERE a.attrelid = 'public.execucoes'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_contrato FROM pg_attribute a WHERE a.attrelid = 'public.locacao_contratos'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_equip   FROM pg_attribute a WHERE a.attrelid = 'public.equipamentos'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tarefa  FROM pg_attribute a WHERE a.attrelid = 'public.tarefas'::regclass  AND a.attname = 'id' AND NOT a.attisdropped;
  IF to_regclass('public.ocorrencias') IS NULL THEN
    EXECUTE format($f$CREATE TABLE public.ocorrencias (
      id bigserial PRIMARY KEY,
      tenant_id %s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      numero text,
      origem text NOT NULL CHECK (origem IN ('at','contrato')),
      execucao_id %s REFERENCES public.execucoes(id) ON DELETE SET NULL,
      contrato_id %s REFERENCES public.locacao_contratos(id) ON DELETE SET NULL,
      equipamento_id %s REFERENCES public.equipamentos(id) ON DELETE SET NULL,
      contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
      tipo text NOT NULL CHECK (tipo IN ('avaria','pane','acidente','furto','outro')),
      parado boolean NOT NULL DEFAULT false,
      ocorrido_em timestamptz NOT NULL DEFAULT now(),
      local text, gps jsonb, descricao text,
      fotos jsonb NOT NULL DEFAULT '[]'::jsonb,
      anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
      status text NOT NULL DEFAULT 'registrada' CHECK (status IN ('registrada','em_analise','em_atendimento','encerrada')),
      responsabilidade text NOT NULL DEFAULT 'a_definir' CHECK (responsabilidade IN ('cliente','locadora','seguro','a_definir')),
      mensagens jsonb NOT NULL DEFAULT '[]'::jsonb,
      historico jsonb NOT NULL DEFAULT '[]'::jsonb,
      inspecao_id bigint,
      tarefa_id %s REFERENCES public.tarefas(id) ON DELETE SET NULL,
      registrado_por_id %s REFERENCES public.usuarios(id) ON DELETE SET NULL,
      registrado_por_nome text, registrado_por_tipo text,
      encerrado_em timestamptz,
      criado_em timestamptz NOT NULL DEFAULT now(),
      atualizado_em timestamptz NOT NULL DEFAULT now())$f$, t_tenant, t_exec, t_contrato, t_equip, t_tarefa, t_usuario);
  END IF;
  IF to_regclass('public.ocorrencia_sequencias') IS NULL THEN
    EXECUTE format('CREATE TABLE public.ocorrencia_sequencias (tenant_id %s NOT NULL, ano int NOT NULL, ultimo int NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, ano))', t_tenant);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ocorrencias_numero_uq ON public.ocorrencias (tenant_id, numero) WHERE numero IS NOT NULL;
CREATE INDEX IF NOT EXISTS ocorrencias_contrato_idx ON public.ocorrencias (tenant_id, contrato_id);
CREATE INDEX IF NOT EXISTS ocorrencias_exec_idx ON public.ocorrencias (tenant_id, execucao_id);

CREATE OR REPLACE FUNCTION public.ocorrencias_numerar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a int; n int;
BEGIN
  IF TG_OP = 'UPDATE' THEN NEW.numero := OLD.numero; RETURN NEW; END IF; -- imutável
  a := EXTRACT(YEAR FROM COALESCE(NEW.criado_em, now()))::int;
  INSERT INTO public.ocorrencia_sequencias (tenant_id, ano, ultimo) VALUES (NEW.tenant_id, a, 1)
    ON CONFLICT (tenant_id, ano) DO UPDATE SET ultimo = public.ocorrencia_sequencias.ultimo + 1 RETURNING ultimo INTO n;
  NEW.numero := 'SIN-' || a || '-' || lpad(n::text, 4, '0');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ocorrencias_numerar ON public.ocorrencias;
CREATE TRIGGER ocorrencias_numerar BEFORE INSERT OR UPDATE ON public.ocorrencias FOR EACH ROW EXECUTE FUNCTION public.ocorrencias_numerar();

-- tarefas.origem = 'ocorrencia' / origem_ref = id da ocorrência (texto livre, sem CHECK) → a TSK-MT aponta para o SIN.
