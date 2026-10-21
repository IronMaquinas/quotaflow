-- 033_competencias.sql — etapa 12e.3: competências do colaborador × exigidas pela função (pilar 🧩 do selo)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 032.
--
--   funcoes.cnh_categoria          → CNH mínima exigida (A, B, C, D, E, AB, AC, AD, AE) ou NULL
--   funcoes.competencias           → [{ codigo, nome, reavaliar_meses }] — lista "atende / não atende" da função
--   colaboradores.escolaridade     → mesma lista da função (fundamental_incompleto … pos_graduacao)
--   colaboradores.cnh_categoria    → categoria da CNH do colaborador (a VALIDADE da CNH continua em 📄 Documentos)
--   colaborador_competencias       → cada avaliação (histórico): atende sim/não, data, válida até (reavaliação),
--                                    quem avaliou, evidência opcional (bucket "documentos": tenant-{id}/comp-{colab}/…)

BEGIN;

ALTER TABLE public.funcoes ADD COLUMN IF NOT EXISTS cnh_categoria text;
ALTER TABLE public.funcoes ADD COLUMN IF NOT EXISTS competencias jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS escolaridade text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS cnh_categoria text;

DO $$
DECLARE t_tenant text; t_usuario text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant  FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass  AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id';
  IF to_regclass('public.colaborador_competencias') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.colaborador_competencias (
        id               bigserial PRIMARY KEY,
        tenant_id        %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        colaborador_id   bigint NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
        codigo           text NOT NULL,
        nome             text NOT NULL,            -- cópia (prova legal)
        atende           boolean NOT NULL,
        avaliado_em      date NOT NULL,
        valido_ate       date,                     -- avaliado_em + reavaliar_meses da função (NULL = não vence)
        avaliado_por     %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        avaliado_por_nome text,
        evidencia_path   text,
        evidencia_nome   text,
        evidencia_mime   text,
        obs              text,
        criado_em        timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_usuario);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS colaborador_competencias_idx ON public.colaborador_competencias (tenant_id, colaborador_id, codigo);

COMMIT;
