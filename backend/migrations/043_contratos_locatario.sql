-- 043_contratos_locatario.sql — etapa 14b.3: contratos de locação + perfil "Locatário"
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 042.
--   locacao_contratos          → contrato de locação CL-AAAA-NNNN (cliente, obra, contato, início, fim previsto/real, status)
--   locacao_contrato_usuarios  → quais usuários LOCATÁRIOS veem o contrato (um contrato pode ter vários; um usuário vários contratos)
--   equipamento_locacoes (+)   → contrato_id (o equipamento locado dentro do contrato)
--   perfil "locatario"         → usuário do cliente do cliente: só vê 📑 Contratos (os dele). Não conta na cobrança.
BEGIN;
DO $$
DECLARE t_tenant text; t_usuario text; r record;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant  FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass  AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id';
  IF to_regclass('public.locacao_contratos') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.locacao_contratos (
        id                bigserial PRIMARY KEY,
        tenant_id         %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        numero            text NOT NULL,
        cliente           text NOT NULL,
        cliente_doc       text,
        local             text,
        contato_nome      text,
        contato_email     text,
        contato_telefone  text,
        inicio            date NOT NULL,
        fim_previsto      date,
        fim_real          date,
        status            text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','encerrado')),
        obs               text,
        criado_por_nome   text,
        encerrado_por_nome text,
        criado_em         timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant);
  END IF;
  IF to_regclass('public.locacao_contrato_usuarios') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.locacao_contrato_usuarios (
        id           bigserial PRIMARY KEY,
        tenant_id    %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        contrato_id  bigint NOT NULL REFERENCES public.locacao_contratos(id) ON DELETE CASCADE,
        usuario_id   %2$s NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
        criado_em    timestamptz NOT NULL DEFAULT now(),
        UNIQUE (contrato_id, usuario_id)
      )$f$, t_tenant, t_usuario);
  END IF;

  -- perfil Locatário no catálogo de perfis (se a tabela existir)
  IF to_regclass('public.perfis') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.perfis WHERE codigo = 'locatario') THEN
    BEGIN
      EXECUTE $q$INSERT INTO public.perfis (codigo, nome, descricao, ordem) VALUES ('locatario', 'Locatário', 'Cliente que aluga equipamento: só vê os próprios contratos (não conta na cobrança)', 98)$q$;
    EXCEPTION WHEN undefined_column THEN
      EXECUTE $q$INSERT INTO public.perfis (codigo, nome) VALUES ('locatario', 'Locatário')$q$;
    END;
  END IF;
  -- se usuarios.perfil tiver CHECK com a lista de perfis, recria incluindo 'locatario'
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.usuarios'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%perfil%' AND pg_get_constraintdef(oid) NOT ILIKE '%locatario%'
  LOOP
    EXECUTE format('ALTER TABLE public.usuarios DROP CONSTRAINT %I', r.conname);
    EXECUTE format($q$ALTER TABLE public.usuarios ADD CONSTRAINT %I CHECK (perfil IN ('admin','gestor','comprador','operacao','qualidade','financeiro','colaborador','locatario','tecnico','fornecedor')) NOT VALID$q$, r.conname);
  END LOOP;
  -- idem para usuario_perfis.perfil_codigo, se tiver CHECK
  IF to_regclass('public.usuario_perfis') IS NOT NULL THEN
    FOR r IN SELECT conname FROM pg_constraint
             WHERE conrelid = 'public.usuario_perfis'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%perfil_codigo%' AND pg_get_constraintdef(oid) NOT ILIKE '%locatario%'
    LOOP
      EXECUTE format('ALTER TABLE public.usuario_perfis DROP CONSTRAINT %I', r.conname);
      EXECUTE format($q$ALTER TABLE public.usuario_perfis ADD CONSTRAINT %I CHECK (perfil_codigo IN ('admin','gestor','comprador','operacao','qualidade','financeiro','colaborador','locatario','tecnico','fornecedor')) NOT VALID$q$, r.conname);
    END LOOP;
  END IF;
END $$;

ALTER TABLE public.equipamento_locacoes ADD COLUMN IF NOT EXISTS contrato_id bigint REFERENCES public.locacao_contratos(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS locacao_contratos_numero_unico ON public.locacao_contratos (tenant_id, numero);
CREATE INDEX IF NOT EXISTS locacao_contrato_usuarios_usuario_idx ON public.locacao_contrato_usuarios (tenant_id, usuario_id);
CREATE INDEX IF NOT EXISTS equipamento_locacoes_contrato_idx ON public.equipamento_locacoes (tenant_id, contrato_id);
COMMIT;
