-- 092_documentos_gestao.sql — etapa 18zr: 📘 DOCUMENTOS DE GESTÃO (sistema da qualidade — ISO 9001 7.5)
-- Idempotente; o tipo de tenants.id é lido do banco.
--   Diferente do documento com VENCIMENTO (CNH, CRLV, alvará): manual, procedimento, política, instrução, formulário têm
--   CÓDIGO e REVISÃO (Rev. 00, 01…), quem elaborou/aprovou, situação (rascunho · vigente · obsoleto) e próxima análise crítica.
--   Conteúdo em texto (editável no sistema) e/ou arquivo anexo (bucket privado "documentos").
DO $$
DECLARE tid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a
   WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS public.documentos_gestao (
      id bigserial PRIMARY KEY,
      tenant_id %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      codigo text NOT NULL,
      titulo text NOT NULL,
      tipo text NOT NULL DEFAULT 'procedimento' CHECK (tipo IN ('manual','politica','procedimento','instrucao','formulario','registro','outro')),
      area text,
      revisao integer NOT NULL DEFAULT 0 CHECK (revisao >= 0),
      status text NOT NULL DEFAULT 'vigente' CHECK (status IN ('rascunho','vigente','obsoleto')),
      conteudo text,
      arquivo_path text, arquivo_nome text, arquivo_mime text,
      elaborado_por text, aprovado_por text, aprovado_em date, proxima_revisao date,
      norma text,
      modelo_origem text,
      criado_em timestamptz NOT NULL DEFAULT now(),
      atualizado_em timestamptz NOT NULL DEFAULT now()
    )$f$, tid);
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS documentos_gestao_codigo_uk ON public.documentos_gestao (tenant_id, lower(codigo));
ALTER TABLE public.documentos_gestao ENABLE ROW LEVEL SECURITY;
