-- 129_turismo_planejamento.sql — etapa T1.1: viagem planejada de uma vez (origem/destino no mapa, pessoas previstas, veículos "a definir",
--   itinerário com paradas, vários motoristas), toggles "Acompanhar pagamentos" e "Acompanhar diferentes embarques",
--   e saúde/seguro do passageiro. Só acrescenta colunas (idempotente).
ALTER TABLE public.viagens ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE public.viagens ADD COLUMN IF NOT EXISTS origem_lat double precision;
ALTER TABLE public.viagens ADD COLUMN IF NOT EXISTS origem_lng double precision;
ALTER TABLE public.viagens ADD COLUMN IF NOT EXISTS destino_lat double precision;
ALTER TABLE public.viagens ADD COLUMN IF NOT EXISTS destino_lng double precision;
ALTER TABLE public.viagens ADD COLUMN IF NOT EXISTS pessoas_previstas integer;
ALTER TABLE public.viagens ADD COLUMN IF NOT EXISTS acompanhar_pagamentos boolean NOT NULL DEFAULT false;
ALTER TABLE public.viagens ADD COLUMN IF NOT EXISTS valor_pessoa numeric(12,2);
ALTER TABLE public.viagens ADD COLUMN IF NOT EXISTS embarques_diferentes boolean NOT NULL DEFAULT false;
-- paradas (jsonb, já existe): [{ id, nome, lat, lng, chegada (data/hora), minutos, conferir, embarque }]
ALTER TABLE public.viagem_onibus ADD COLUMN IF NOT EXISTS motoristas jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.viagem_onibus ADD COLUMN IF NOT EXISTS tipo_nome text;
UPDATE public.viagem_onibus SET motoristas = jsonb_build_array(jsonb_build_object('nome', motorista_nome, 'colaborador_id', motorista_colaborador_id, 'telefone', motorista_telefone))
  WHERE motoristas = '[]'::jsonb AND motorista_nome IS NOT NULL;
ALTER TABLE public.viagem_reservas ADD COLUMN IF NOT EXISTS valor numeric(12,2);
ALTER TABLE public.viagem_reservas ADD COLUMN IF NOT EXISTS valor_pago numeric(12,2);
ALTER TABLE public.viagem_reservas ADD COLUMN IF NOT EXISTS situacao_pagamento text;
UPDATE public.viagem_reservas SET situacao_pagamento = CASE WHEN pago THEN 'pago' ELSE 'pendente' END WHERE situacao_pagamento IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'viagem_reservas_situacao_pag_chk') THEN
    ALTER TABLE public.viagem_reservas ADD CONSTRAINT viagem_reservas_situacao_pag_chk CHECK (situacao_pagamento IS NULL OR situacao_pagamento IN ('pago','parcial','embarque','pendente'));
  END IF;
END $$;
ALTER TABLE public.viagem_passageiros ADD COLUMN IF NOT EXISTS embarque_parada_id text;
ALTER TABLE public.viagem_passageiros ADD COLUMN IF NOT EXISTS plano_saude boolean NOT NULL DEFAULT false;
ALTER TABLE public.viagem_passageiros ADD COLUMN IF NOT EXISTS plano_saude_nome text;
ALTER TABLE public.viagem_passageiros ADD COLUMN IF NOT EXISTS plano_saude_numero text;
ALTER TABLE public.viagem_passageiros ADD COLUMN IF NOT EXISTS seguro_viagem boolean NOT NULL DEFAULT false;
ALTER TABLE public.viagem_passageiros ADD COLUMN IF NOT EXISTS seguro_nome text;
ALTER TABLE public.viagem_passageiros ADD COLUMN IF NOT EXISTS seguro_apolice text;
ALTER TABLE public.viagem_passageiros ADD COLUMN IF NOT EXISTS tipo_sanguineo text;
