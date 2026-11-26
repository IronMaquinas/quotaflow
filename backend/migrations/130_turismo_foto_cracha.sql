-- 130_turismo_foto_cracha.sql — etapa T1.2: opção da viagem "foto obrigatória para o crachá" (o crachá/QR e o link por reserva chegam na T2)
ALTER TABLE public.viagens ADD COLUMN IF NOT EXISTS foto_obrigatoria boolean NOT NULL DEFAULT false;
