-- 069_ocorrencias_inc_config.sql — etapa 18h.4a: numeração INC-<origem>-AAAA-NNNN + quem recebe as ocorrências
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 068.
--   • número: SIN-AAAA-NNNN → INC-LC-AAAA-NNNN (locação / contrato) · INC-TR-AAAA-NNNN (transporte / AT)
--     INC = incidente (lê igual em PT/EN/ES); a origem no código, como nas tarefas TSK-<tipo>. Sequência por empresa, origem e ano.
--     As ocorrências SIN-… existentes (testes) são renumeradas na ordem em que foram criadas; títulos e vínculos das tarefas acompanham.
--   • tenants.ocorrencias_config: por origem, quem recebe o aviso e a tarefa (perfis, pessoas, funções) e o tipo da tarefa.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ocorrencias_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- sequência por origem
ALTER TABLE public.ocorrencia_sequencias ADD COLUMN IF NOT EXISTS sigla text NOT NULL DEFAULT '';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.ocorrencia_sequencias'::regclass AND contype = 'p'
             AND pg_get_constraintdef(oid) NOT ILIKE '%sigla%') THEN
    EXECUTE (SELECT format('ALTER TABLE public.ocorrencia_sequencias DROP CONSTRAINT %I', conname) FROM pg_constraint WHERE conrelid = 'public.ocorrencia_sequencias'::regclass AND contype = 'p');
    ALTER TABLE public.ocorrencia_sequencias ADD PRIMARY KEY (tenant_id, sigla, ano);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ocorrencias_numerar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a int; n int; sg text;
BEGIN
  IF TG_OP = 'UPDATE' THEN NEW.numero := OLD.numero; RETURN NEW; END IF; -- imutável
  a := EXTRACT(YEAR FROM COALESCE(NEW.criado_em, now()))::int;
  sg := CASE WHEN NEW.origem = 'at' THEN 'TR' ELSE 'LC' END;
  INSERT INTO public.ocorrencia_sequencias (tenant_id, sigla, ano, ultimo) VALUES (NEW.tenant_id, sg, a, 1)
    ON CONFLICT (tenant_id, sigla, ano) DO UPDATE SET ultimo = public.ocorrencia_sequencias.ultimo + 1 RETURNING ultimo INTO n;
  NEW.numero := 'INC-' || sg || '-' || a || '-' || lpad(n::text, 4, '0');
  RETURN NEW;
END $$;

-- renumera as SIN-… (só roda se ainda houver alguma)
DO $$
DECLARE r record; novo text; n int; sg text; a int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ocorrencias WHERE numero LIKE 'SIN-%') THEN RETURN; END IF;
  ALTER TABLE public.ocorrencias DISABLE TRIGGER ocorrencias_numerar;
  DELETE FROM public.ocorrencia_sequencias WHERE sigla = '';
  FOR r IN SELECT id, tenant_id, origem, numero, criado_em FROM public.ocorrencias WHERE numero LIKE 'SIN-%' ORDER BY tenant_id, criado_em, id LOOP
    sg := CASE WHEN r.origem = 'at' THEN 'TR' ELSE 'LC' END; a := EXTRACT(YEAR FROM r.criado_em)::int;
    INSERT INTO public.ocorrencia_sequencias (tenant_id, sigla, ano, ultimo) VALUES (r.tenant_id, sg, a, 1)
      ON CONFLICT (tenant_id, sigla, ano) DO UPDATE SET ultimo = public.ocorrencia_sequencias.ultimo + 1 RETURNING ultimo INTO n;
    novo := 'INC-' || sg || '-' || a || '-' || lpad(n::text, 4, '0');
    UPDATE public.ocorrencias SET numero = novo WHERE id = r.id;
    UPDATE public.tarefas SET titulo = replace(titulo, r.numero, novo),
      vinculos = COALESCE((SELECT jsonb_agg(CASE WHEN v->>'tipo' = 'ocorrencia' AND v->>'numero' = r.numero THEN jsonb_set(v, '{numero}', to_jsonb(novo)) ELSE v END) FROM jsonb_array_elements(vinculos) v), '[]'::jsonb)
      WHERE tenant_id = r.tenant_id AND origem = 'ocorrencia' AND origem_ref = r.id::text;
  END LOOP;
  ALTER TABLE public.ocorrencias ENABLE TRIGGER ocorrencias_numerar;
END $$;
