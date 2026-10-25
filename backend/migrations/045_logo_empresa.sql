-- 045_logo_empresa.sql — etapa 14c: logomarca da empresa (transportadora) nos documentos
-- Idempotente. Rodar no SQL Editor do Supabase, depois da 044.
--   tenants.logo_path → caminho da logo no bucket privado "documentos" (tenant-{id}/logo/…)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_path text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_atualizada_em timestamptz;
