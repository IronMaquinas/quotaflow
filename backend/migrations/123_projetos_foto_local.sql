-- 123_projetos_foto_local.sql — etapa E2.1: 🗺 localização real do projeto (pino no mapa). Idempotente.
ALTER TABLE public.projetos_foto ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.projetos_foto ADD COLUMN IF NOT EXISTS lng double precision;
NOTIFY pgrst, 'reload schema';
