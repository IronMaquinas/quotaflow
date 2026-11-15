-- 089_ia_uso_foto_colaborador.sql — etapa 18zl: 🪪 leitura da CNH pela IA + 📊 uso da IA por empresa
-- Idempotente. O tipo de tenants.id é lido do banco.
--   colaboradores.foto_path: foto do colaborador (recortada da CNH ou enviada), no bucket privado "documentos".
--   ia_uso: cada chamada à IA (recurso, provedor, modelo, tokens) — base para saber o custo por empresa e decidir a cobrança.
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS foto_path text;
DO $$
DECLARE tid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a
   WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS public.ia_uso (
      id bigserial PRIMARY KEY,
      tenant_id %1$s REFERENCES public.tenants(id) ON DELETE CASCADE,
      recurso text NOT NULL,
      provedor text,
      modelo text,
      tokens_entrada integer NOT NULL DEFAULT 0,
      tokens_saida integer NOT NULL DEFAULT 0,
      ok boolean NOT NULL DEFAULT true,
      em timestamptz NOT NULL DEFAULT now()
    )$f$, tid);
END $$;
CREATE INDEX IF NOT EXISTS ia_uso_tenant_em_idx ON public.ia_uso (tenant_id, em);
ALTER TABLE public.ia_uso ENABLE ROW LEVEL SECURITY;
