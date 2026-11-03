-- 066_fiscal_transporte.sql — etapa 18g.1: 🧾 perfil Fiscal + tarefa fiscal automática por trecho do pedido
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 065.
--   perfil 'fiscal' (catálogo de perfis + CHECK de usuarios.perfil / usuario_perfis.perfil_codigo)
--   tenants.fiscal_antecedencia_dias → prazo da tarefa fiscal: N dias úteis antes da data do trecho (padrão 2 = D-2)
--   tarefas.checklist                → documentos da tarefa fiscal { nfe, cte, averbacao, mdfe: { entradas: [...] }, dispensa }
BEGIN;

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS fiscal_antecedencia_dias integer NOT NULL DEFAULT 2;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_fiscal_antecedencia_check') THEN
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_fiscal_antecedencia_check CHECK (fiscal_antecedencia_dias BETWEEN 0 AND 30);
  END IF;
END $$;

ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS checklist jsonb;
CREATE INDEX IF NOT EXISTS tarefas_tenant_origem_idx ON public.tarefas (tenant_id, origem, origem_ref);

DO $$
DECLARE r record;
BEGIN
  -- perfil Fiscal no catálogo de perfis
  IF to_regclass('public.perfis') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.perfis WHERE codigo = 'fiscal') THEN
    BEGIN
      EXECUTE $q$INSERT INTO public.perfis (codigo, nome, descricao, ordem) VALUES ('fiscal', 'Fiscal', 'Documentos fiscais do transporte: NF-e, CT-e, averbação, MDF-e (tarefas 🚚 TR do ✅ Plano)', 8)$q$;
    EXCEPTION WHEN undefined_column THEN
      EXECUTE $q$INSERT INTO public.perfis (codigo, nome) VALUES ('fiscal', 'Fiscal')$q$;
    END;
  END IF;
  -- CHECK de usuarios.perfil / usuario_perfis.perfil_codigo passa a aceitar 'fiscal'
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.usuarios'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%perfil%' AND pg_get_constraintdef(oid) NOT ILIKE '%fiscal%'
  LOOP
    EXECUTE format('ALTER TABLE public.usuarios DROP CONSTRAINT %I', r.conname);
    EXECUTE format($q$ALTER TABLE public.usuarios ADD CONSTRAINT %I CHECK (perfil IN ('admin','gestor','comprador','operacao','qualidade','financeiro','comercial','fiscal','colaborador','locatario','tecnico','fornecedor')) NOT VALID$q$, r.conname);
  END LOOP;
  IF to_regclass('public.usuario_perfis') IS NOT NULL THEN
    FOR r IN SELECT conname FROM pg_constraint
             WHERE conrelid = 'public.usuario_perfis'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%perfil_codigo%' AND pg_get_constraintdef(oid) NOT ILIKE '%fiscal%'
    LOOP
      EXECUTE format('ALTER TABLE public.usuario_perfis DROP CONSTRAINT %I', r.conname);
      EXECUTE format($q$ALTER TABLE public.usuario_perfis ADD CONSTRAINT %I CHECK (perfil_codigo IN ('admin','gestor','comprador','operacao','qualidade','financeiro','comercial','fiscal','colaborador','locatario','tecnico','fornecedor')) NOT VALID$q$, r.conname);
    END LOOP;
  END IF;
END $$;

COMMIT;
