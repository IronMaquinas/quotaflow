-- 029_historico_funcoes_avisos.sql — etapa 12d.3: histórico de funções do colaborador + controle de avisos
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 028.
--
--   colaborador_funcoes → uma linha por período numa função: inicio, fim (NULL = atual), motivo
--                         (admissao | promocao | transferencia | readaptacao | correcao | outro).
--                         Gravada sozinha quando a função muda no cadastro. Nome copiado (não some se a função mudar).
--                         Quem já tem função ganha a 1ª linha agora (início = admissão, ou hoje se não houver).
--   avisos_enviados     → controle genérico de "esse aviso já foi mandado" para os avisos da 12d.3
--                         (troca de EPI, CA, documento faltando). chave = 'epi_troca:<id>', 'epi_ca:<id>',
--                         'doc_falta:<colaborador>:<codigo>' … · marco = '15' | '30' | 'vencido' | 'falta'.

BEGIN;

DO $$
DECLARE t_tenant text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant FROM pg_attribute a
   WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id';

  IF to_regclass('public.colaborador_funcoes') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.colaborador_funcoes (
        id              bigserial PRIMARY KEY,
        tenant_id       %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        colaborador_id  bigint NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
        funcao_id       bigint REFERENCES public.funcoes(id) ON DELETE SET NULL,
        funcao_nome     text NOT NULL,
        inicio          date NOT NULL,
        fim             date,
        motivo          text NOT NULL DEFAULT 'outro' CHECK (motivo IN ('admissao', 'promocao', 'transferencia', 'readaptacao', 'correcao', 'outro')),
        obs             text,
        criado_por      text,
        criado_em       timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT colaborador_funcoes_periodo CHECK (fim IS NULL OR fim >= inicio)
      )$f$, t_tenant);
  END IF;

  IF to_regclass('public.avisos_enviados') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.avisos_enviados (
        tenant_id      %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        chave          text NOT NULL,
        marco          text NOT NULL,
        destinatarios  integer NOT NULL DEFAULT 0,
        enviado_em     timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (tenant_id, chave, marco)
      )$f$, t_tenant);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS colaborador_funcoes_colab_idx ON public.colaborador_funcoes (tenant_id, colaborador_id, inicio);
-- no máximo um período "atual" por colaborador
CREATE UNIQUE INDEX IF NOT EXISTS colaborador_funcoes_atual_unico ON public.colaborador_funcoes (colaborador_id) WHERE fim IS NULL;

-- 1ª linha para quem já tem função (e ainda não tem histórico)
INSERT INTO public.colaborador_funcoes (tenant_id, colaborador_id, funcao_id, funcao_nome, inicio, motivo, obs)
SELECT c.tenant_id, c.id, c.funcao_id, COALESCE(f.nome, c.funcao, 'Função'), COALESCE(c.admissao, CURRENT_DATE), 'admissao',
       'Registro inicial (migration 029)'
  FROM public.colaboradores c
  LEFT JOIN public.funcoes f ON f.id = c.funcao_id
 WHERE (c.funcao_id IS NOT NULL OR COALESCE(c.funcao, '') <> '')
   AND NOT EXISTS (SELECT 1 FROM public.colaborador_funcoes h WHERE h.colaborador_id = c.id);

COMMIT;
