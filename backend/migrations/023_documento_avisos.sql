-- 023_documento_avisos.sql — etapa 12c.1: controle dos e-mails de aviso de vencimento
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 022.
--
-- Uma linha por (documento, marco) avisado: '30' | '15' | '5' | 'vencido'.
-- Garante que cada marco de cada documento é avisado no máximo uma vez, mesmo
-- que o agendamento rode duas vezes no dia ou que o servidor tenha ficado dias fora.
-- Renovar o documento cria outro documento → os avisos recomeçam para o novo.

BEGIN;

CREATE TABLE IF NOT EXISTS public.documento_avisos (
  documento_id   bigint NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  marco          text   NOT NULL CHECK (marco IN ('30', '15', '5', 'vencido')),
  destinatarios  integer NOT NULL DEFAULT 0,
  enviado_em     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (documento_id, marco)
);

COMMIT;
