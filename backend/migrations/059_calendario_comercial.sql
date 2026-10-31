-- 059_calendario_comercial.sql — etapa 18a: 📅 CALENDÁRIO COMERCIAL + 🎪 eventos de mercado (feiras, safras, obras, licitações)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 058.
--   comercial_eventos → nome, tipo, cidade/UF, datas, repete todo ano, ANTECEDÊNCIA de prospecção (dias), observações,
--                       clientes ligados (quem contratou nesse evento), responsável (recebe a tarefa) e o registro dos lembretes
--                       já criados por ano (lembretes: { "2027": id_da_tarefa }) — na data de prospecção entra uma ⏰ tarefa no Comercial.
BEGIN;
DO $$
DECLARE t_tenant text; t_usuario text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant  FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass  AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id';
  IF to_regclass('public.comercial_eventos') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.comercial_eventos (
        id                bigserial PRIMARY KEY,
        tenant_id         %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        nome              text NOT NULL,
        tipo              text NOT NULL DEFAULT 'feira' CHECK (tipo IN ('feira','safra','obra','licitacao','outro')),
        cidade            text,
        uf                text,
        inicio            date NOT NULL,
        fim               date,
        repete_anual      boolean NOT NULL DEFAULT true,
        antecedencia_dias integer NOT NULL DEFAULT 60 CHECK (antecedencia_dias BETWEEN 0 AND 365),
        observacoes       text,
        clientes          jsonb NOT NULL DEFAULT '[]'::jsonb,
        responsavel_id    %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        responsavel_nome  text,
        lembretes         jsonb NOT NULL DEFAULT '{}'::jsonb,
        ativo             boolean NOT NULL DEFAULT true,
        criado_em         timestamptz NOT NULL DEFAULT now(),
        atualizado_em     timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_usuario);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS comercial_eventos_tenant_idx ON public.comercial_eventos (tenant_id, inicio);
COMMIT;
