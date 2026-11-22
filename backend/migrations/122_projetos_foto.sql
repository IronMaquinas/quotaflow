-- 122_projetos_foto.sql — etapa E2: 📁 PROJETOS da Foto com cartão (ex.: "Parque Serra Azul — campanha nov/2026")
--   Toda foto nasce dentro de um projeto → a base acompanha por projeto assim que o celular sincroniza.
--   Projeto: nome, cliente (do cadastro ou digitado), local, descrição, período, status (ativo/encerrado).
-- Idempotente; tipos de id lidos do banco.
DO $$
DECLARE tid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  IF to_regclass('public.projetos_foto') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.projetos_foto (
        id            bigserial PRIMARY KEY,
        tenant_id     %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        nome          text NOT NULL,
        cliente_id    text,
        cliente_nome  text,
        local         text,
        descricao     text,
        inicio        date,
        fim           date,
        status        text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'encerrado')),
        criado_por    text,
        criado_em     timestamptz NOT NULL DEFAULT now(),
        atualizado_em timestamptz NOT NULL DEFAULT now()
      )$f$, tid);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS projetos_foto_tenant_idx ON public.projetos_foto (tenant_id, status);
ALTER TABLE public.fotos_cartao ADD COLUMN IF NOT EXISTS projeto_id bigint REFERENCES public.projetos_foto(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS fotos_cartao_projeto_idx ON public.fotos_cartao (projeto_id, tirada_em DESC);
NOTIFY pgrst, 'reload schema';
