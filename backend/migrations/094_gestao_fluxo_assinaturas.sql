-- 094_gestao_fluxo_assinaturas.sql — etapa 18zv: ✍ FLUXO INTERNO e ASSINATURA ELETRÔNICA dos documentos de gestão
-- Idempotente.
--   documentos_gestao.fluxo        : o rascunho em andamento — etapa (elaboração · verificação · aprovação), quem elaborou,
--                                    verificador (opcional) e aprovador escolhidos, histórico de envios/devoluções.
--   documentos_gestao.assinaturas  : assinaturas da revisão VIGENTE — [{ etapa, usuario_id, nome, funcao, em, hash }] +
--                                    código de verificação (hash do texto aprovado).
--   documentos_gestao_versoes.assinaturas : as assinaturas de cada revisão que virou histórico.
ALTER TABLE public.documentos_gestao ADD COLUMN IF NOT EXISTS fluxo jsonb;
ALTER TABLE public.documentos_gestao ADD COLUMN IF NOT EXISTS assinaturas jsonb;
ALTER TABLE public.documentos_gestao ADD COLUMN IF NOT EXISTS codigo_verificacao text;
ALTER TABLE public.documentos_gestao_versoes ADD COLUMN IF NOT EXISTS assinaturas jsonb;
ALTER TABLE public.documentos_gestao_versoes ADD COLUMN IF NOT EXISTS codigo_verificacao text;
