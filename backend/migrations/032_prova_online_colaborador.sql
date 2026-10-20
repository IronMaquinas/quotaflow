-- 032_prova_online_colaborador.sql — etapa 12e.2b: prova online (colaborador logado ou link), tentativas, perfil Colaborador
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 031.
--
--   treinamento_tentativas         → cada prova feita: respostas, acertos, nota, aprovado, meio ('logado' | 'link'),
--                                    cópia da prova no momento (prova legal), IP e hash.
--   treinamento_participacoes.tentativas_extra → tentativas a mais liberadas pelo instrutor (depois de esgotar)
--   treinamento_turmas.link_token / link_ativo → link externo da prova (identificação por CPF + data de nascimento)
--   perfil 'colaborador'           → só vê "🎓 Meus treinamentos"; NÃO conta na cobrança do plano.

BEGIN;

DO $$
DECLARE t_tenant text; t_usuario text; r record;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant  FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass  AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id';

  IF to_regclass('public.treinamento_tentativas') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.treinamento_tentativas (
        id                bigserial PRIMARY KEY,
        tenant_id         %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        participacao_id   bigint NOT NULL REFERENCES public.treinamento_participacoes(id) ON DELETE CASCADE,
        turma_id          bigint NOT NULL REFERENCES public.treinamento_turmas(id) ON DELETE CASCADE,
        colaborador_id    bigint NOT NULL REFERENCES public.colaboradores(id) ON DELETE RESTRICT,
        numero            integer NOT NULL,
        respostas         jsonb NOT NULL,
        prova             jsonb NOT NULL,          -- cópia da prova (com gabarito) no momento
        acertos           integer NOT NULL,
        total             integer NOT NULL,
        nota              numeric NOT NULL,
        aprovado          boolean NOT NULL,
        meio              text NOT NULL CHECK (meio IN ('logado', 'link')),
        usuario_id        %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        ip                text,
        hash              text NOT NULL,
        criado_em         timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_usuario);
  END IF;

  -- perfil Colaborador no catálogo de perfis (se a tabela existir)
  IF to_regclass('public.perfis') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.perfis WHERE codigo = 'colaborador') THEN
      BEGIN
        EXECUTE $q$INSERT INTO public.perfis (codigo, nome, descricao, ordem) VALUES ('colaborador', 'Colaborador', 'Só "Meus treinamentos" (não conta na cobrança)', 99)$q$;
      EXCEPTION WHEN undefined_column THEN
        EXECUTE $q$INSERT INTO public.perfis (codigo, nome) VALUES ('colaborador', 'Colaborador')$q$;
      END;
    END IF;
  END IF;

  -- se usuarios.perfil tiver CHECK com a lista de perfis, recria incluindo 'colaborador'
  FOR r IN SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
           WHERE conrelid = 'public.usuarios'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%perfil%' AND pg_get_constraintdef(oid) NOT ILIKE '%colaborador%'
  LOOP
    EXECUTE format('ALTER TABLE public.usuarios DROP CONSTRAINT %I', r.conname);
    EXECUTE format($q$ALTER TABLE public.usuarios ADD CONSTRAINT %I CHECK (perfil IN ('admin','gestor','comprador','operacao','qualidade','financeiro','colaborador','tecnico','fornecedor')) NOT VALID$q$, r.conname);
  END LOOP;
END $$;

ALTER TABLE public.treinamento_participacoes ADD COLUMN IF NOT EXISTS tentativas_extra integer NOT NULL DEFAULT 0;
ALTER TABLE public.treinamento_turmas ADD COLUMN IF NOT EXISTS link_token text;
ALTER TABLE public.treinamento_turmas ADD COLUMN IF NOT EXISTS link_ativo boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS treinamento_turmas_link_unico ON public.treinamento_turmas (link_token) WHERE link_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS treinamento_tentativas_part_idx ON public.treinamento_tentativas (tenant_id, participacao_id);
CREATE UNIQUE INDEX IF NOT EXISTS treinamento_tentativas_numero_unico ON public.treinamento_tentativas (participacao_id, numero);
CREATE INDEX IF NOT EXISTS colaboradores_usuario_idx ON public.colaboradores (tenant_id, usuario_id) WHERE usuario_id IS NOT NULL;

COMMIT;
