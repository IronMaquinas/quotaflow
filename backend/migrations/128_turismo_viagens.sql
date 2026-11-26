-- 128_turismo_viagens.sql — etapa T1: 🚌 VIAGENS E EMBARQUE (agências e locadoras de ônibus)
--   mapas_poltronas  → layout do ônibus (pisos × linhas × células: poltrona nº, corredor, porta, escada, banheiro, geladeira, motorista, mesa)
--   viagens          → evento (destino, saída, retorno, paradas)
--   viagem_onibus    → ônibus do evento (da frota ou digitado), motorista, empresa de ônibus, cópia do mapa
--   viagem_reservas  → individual ou grupo/família: responsável, contato, origem da venda e "pago?" (só informativo)
--   viagem_passageiros → passageiro = poltrona: nome, documento, nascimento, contatos, emergência, observações, menor ligado ao responsável
-- Idempotente; tipos de id lidos do banco.
DO $$
DECLARE tid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  IF to_regclass('public.mapas_poltronas') IS NULL THEN
    EXECUTE format($f$ CREATE TABLE public.mapas_poltronas (
      id bigserial PRIMARY KEY, tenant_id %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      nome text NOT NULL, tipo text, layout jsonb NOT NULL DEFAULT '{}'::jsonb, lugares integer NOT NULL DEFAULT 0, ativo boolean NOT NULL DEFAULT true,
      criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now()) $f$, tid);
  END IF;
  IF to_regclass('public.viagens') IS NULL THEN
    EXECUTE format($f$ CREATE TABLE public.viagens (
      id bigserial PRIMARY KEY, tenant_id %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      numero text, nome text NOT NULL, destino text, saida_em timestamptz, retorno_em timestamptz, local_saida text,
      paradas jsonb NOT NULL DEFAULT '[]'::jsonb, obs text, status text NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada', 'em_andamento', 'concluida', 'cancelada')),
      criado_por text, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now()) $f$, tid);
  END IF;
  IF to_regclass('public.viagem_onibus') IS NULL THEN
    EXECUTE format($f$ CREATE TABLE public.viagem_onibus (
      id bigserial PRIMARY KEY, tenant_id %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      viagem_id bigint NOT NULL REFERENCES public.viagens(id) ON DELETE CASCADE, ordem integer NOT NULL DEFAULT 1,
      nome text NOT NULL, equipamento_id text, placa text, empresa text, motorista_nome text, motorista_colaborador_id text, motorista_telefone text,
      mapa_id bigint, layout jsonb NOT NULL DEFAULT '{}'::jsonb, bloqueadas jsonb NOT NULL DEFAULT '[]'::jsonb,
      criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now()) $f$, tid);
  END IF;
  IF to_regclass('public.viagem_reservas') IS NULL THEN
    EXECUTE format($f$ CREATE TABLE public.viagem_reservas (
      id bigserial PRIMARY KEY, tenant_id %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      viagem_id bigint NOT NULL REFERENCES public.viagens(id) ON DELETE CASCADE, codigo text,
      tipo text NOT NULL DEFAULT 'individual' CHECK (tipo IN ('individual', 'grupo')), responsavel text NOT NULL, telefone text, email text,
      origem_venda text, pago boolean NOT NULL DEFAULT false, obs text, criado_por text, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now()) $f$, tid);
  END IF;
  IF to_regclass('public.viagem_passageiros') IS NULL THEN
    EXECUTE format($f$ CREATE TABLE public.viagem_passageiros (
      id bigserial PRIMARY KEY, tenant_id %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      viagem_id bigint NOT NULL REFERENCES public.viagens(id) ON DELETE CASCADE, reserva_id bigint NOT NULL REFERENCES public.viagem_reservas(id) ON DELETE CASCADE,
      onibus_id bigint REFERENCES public.viagem_onibus(id) ON DELETE SET NULL, poltrona text,
      nome text NOT NULL, documento text, nascimento date, telefone text, emergencia_nome text, emergencia_telefone text, obs text, assistencia boolean NOT NULL DEFAULT false,
      responsavel_passageiro_id bigint, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now()) $f$, tid);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS viagens_tenant_idx ON public.viagens (tenant_id, saida_em);
CREATE INDEX IF NOT EXISTS viagem_onibus_viagem_idx ON public.viagem_onibus (viagem_id);
CREATE INDEX IF NOT EXISTS viagem_reservas_viagem_idx ON public.viagem_reservas (viagem_id);
CREATE INDEX IF NOT EXISTS viagem_passageiros_viagem_idx ON public.viagem_passageiros (viagem_id, onibus_id);
CREATE UNIQUE INDEX IF NOT EXISTS viagem_passageiros_poltrona_idx ON public.viagem_passageiros (onibus_id, poltrona) WHERE onibus_id IS NOT NULL AND poltrona IS NOT NULL;
NOTIFY pgrst, 'reload schema';
