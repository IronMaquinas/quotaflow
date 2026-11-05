-- 070_roteiro_inicial.sql — etapa 18i: 👋 Bem-vindo ao sistema (roteiro das configurações mínimas por tipo de negócio)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 069.
--   tenants.tipos_negocio  → o que a empresa faz: transporte · locacao · compras (um ou mais) — define os passos do roteiro
--   tenants.roteiro_config → { dispensados: ["id_do_passo", …] } — passo marcado "não se aplica"
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tipos_negocio text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS roteiro_config jsonb NOT NULL DEFAULT '{}'::jsonb;
