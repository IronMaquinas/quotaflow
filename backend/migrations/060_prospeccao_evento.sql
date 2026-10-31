-- 060_prospeccao_evento.sql — etapa 18b: 📣 PROSPECÇÃO POR EVENTO (contatos e BIDs ligados ao evento de mercado)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 059.
--   bid_atividades (+) evento_id  → o contato (WhatsApp, ligação, e-mail) feito na campanha do evento
--   bid_atividades.tipo (+) 'whatsapp'
--   bids (+) evento_id            → o BID que nasceu da campanha (situação: a contatar → contatado → BID criado)
BEGIN;
ALTER TABLE public.bid_atividades ADD COLUMN IF NOT EXISTS evento_id bigint;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS evento_id bigint;
ALTER TABLE public.bid_atividades DROP CONSTRAINT IF EXISTS bid_atividades_tipo_check;
ALTER TABLE public.bid_atividades ADD CONSTRAINT bid_atividades_tipo_check CHECK (tipo IN ('ligacao','email','whatsapp','reuniao','nota','tarefa','evento'));
CREATE INDEX IF NOT EXISTS bid_atividades_evento_idx ON public.bid_atividades (tenant_id, evento_id) WHERE evento_id IS NOT NULL;
COMMIT;
