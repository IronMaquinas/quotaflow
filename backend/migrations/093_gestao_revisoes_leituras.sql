-- 093_gestao_revisoes_leituras.sql — etapa 18zs: 📘 REVISÃO, HISTÓRICO e LEITURA dos documentos de gestão (ISO 9001 7.5.2/7.5.3)
-- Idempotente; tipos de id lidos do banco.
--   documentos_gestao.rascunho  : a PRÓXIMA revisão em elaboração (a vigente continua valendo até a aprovação).
--   documentos_gestao_versoes   : cada revisão substituída (obsoleta) fica guardada — o que era, quando valeu, o que mudou.
--   documentos_gestao_leituras  : "li e entendi" por pessoa e por revisão (nova revisão = nova leitura).
ALTER TABLE public.documentos_gestao ADD COLUMN IF NOT EXISTS rascunho jsonb;
ALTER TABLE public.documentos_gestao ADD COLUMN IF NOT EXISTS motivo_revisao text;
DO $$
DECLARE tid text; uid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO uid FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS public.documentos_gestao_versoes (
      id bigserial PRIMARY KEY,
      tenant_id %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      documento_id bigint NOT NULL REFERENCES public.documentos_gestao(id) ON DELETE CASCADE,
      revisao integer NOT NULL,
      titulo text, conteudo text, arquivo_path text, arquivo_nome text, arquivo_mime text,
      motivo text, elaborado_por text, aprovado_por text, aprovado_em date,
      vigente_ate timestamptz NOT NULL DEFAULT now()
    )$f$, tid);
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS public.documentos_gestao_leituras (
      id bigserial PRIMARY KEY,
      tenant_id %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      documento_id bigint NOT NULL REFERENCES public.documentos_gestao(id) ON DELETE CASCADE,
      revisao integer NOT NULL,
      usuario_id %2$s,
      usuario_nome text,
      lido_em timestamptz NOT NULL DEFAULT now()
    )$f$, tid, uid);
END $$;
CREATE INDEX IF NOT EXISTS documentos_gestao_versoes_doc_idx ON public.documentos_gestao_versoes (documento_id, revisao);
CREATE UNIQUE INDEX IF NOT EXISTS documentos_gestao_leituras_uk ON public.documentos_gestao_leituras (documento_id, revisao, usuario_id);
ALTER TABLE public.documentos_gestao_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_gestao_leituras ENABLE ROW LEVEL SECURITY;
