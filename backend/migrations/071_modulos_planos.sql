-- 071_modulos_planos.sql — etapa 18j: 🧩 módulos por empresa + planos-modelo do Console
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 070.
--   tenants.modulos    → módulos ligados (ids do catálogo em services/modulos.js). NULL = tudo ligado (empresas que já existem).
--   tenants.plano_nome → nome do plano mostrado ao cliente (⭐ Meu plano), ex.: "Transportadora completo", "Personalizado".
--   plataforma_planos  → planos-modelo que o Console aplica nas empresas (nome, descrição, módulos).
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS modulos text[];
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS plano_nome text;
CREATE TABLE IF NOT EXISTS public.plataforma_planos (
  id bigserial PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  modulos text[] NOT NULL DEFAULT '{}',
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS plataforma_planos_nome_uq ON public.plataforma_planos (lower(nome));
-- a tabela é só do Console (service role); sem acesso pelas chaves públicas
ALTER TABLE public.plataforma_planos ENABLE ROW LEVEL SECURITY;
