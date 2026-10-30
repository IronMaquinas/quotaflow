-- 056_at_rascunho_link_motorista.sql — etapa 16c: rascunho da AT no servidor + 📲 link do motorista + liberação de documento vencido
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 055.
--   execucoes.status (+) 'rascunho'   → AT começada na mesa e salva para terminar depois (não mexe no pedido)
--   execucoes.token / link_visto_em   → link público (sem login, sem valores) para o motorista: rota, dados da viagem e o kit de
--                                        documentos (CNH, CRLV do conjunto, NF-e/CT-e/MDF-e) para abrir/baixar no celular
--   execucoes.liberacao_docs          → { por, em, justificativa, docs: [...] } — CNH/CRLV vencido na data da viagem liberado pelo gestor
BEGIN;
ALTER TABLE public.execucoes DROP CONSTRAINT IF EXISTS execucoes_status_check;
ALTER TABLE public.execucoes ADD CONSTRAINT execucoes_status_check CHECK (status IN ('rascunho','programada','em_execucao','concluida','cancelada'));
ALTER TABLE public.execucoes ALTER COLUMN cavalo_id DROP NOT NULL;
ALTER TABLE public.execucoes ADD COLUMN IF NOT EXISTS token text;
ALTER TABLE public.execucoes ADD COLUMN IF NOT EXISTS link_visto_em timestamptz;
ALTER TABLE public.execucoes ADD COLUMN IF NOT EXISTS liberacao_docs jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS execucoes_token_unico ON public.execucoes (token) WHERE token IS NOT NULL;
COMMIT;
