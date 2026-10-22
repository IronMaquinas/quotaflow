-- 040_inspecoes.sql — etapa 14a: inspeções de equipamento (pré-uso e rotina) com esquema visual e pontos
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 039.
--
--   inspecao_modelos      → modelo de checklist. tenant_id NULL = BIBLIOTECA do QuotaFlow (Console), a empresa importa
--                           uma cópia (origem_id/origem_versao). vistas jsonb: [{ codigo, nome, imagem ('esquema:<codigo>'
--                           ou caminho no bucket), pontos: [{ id, rotulo, x, y (% da imagem), tipo ('ok_nok'|'numero'|
--                           'texto'), foto ('nunca'|'se_nok'|'sempre'), critico, unidade }] }]. campos jsonb: o que o
--                           registro pede (km, horímetro, local, cliente). frequencia: pre_uso | diaria | semanal | mensal | avulsa.
--   inspecoes             → cada inspeção feita: cópia do modelo, executor (colaborador/usuário/terceiro), km, horímetro,
--                           local, cliente, GPS, respostas (status ok/nok/na, valor, obs, "impede o uso", fotos), resultado
--                           (aprovado | ressalvas | reprovado), assinatura + hash, OS abertas. cliente_uid = id gerado no
--                           aparelho (envio offline não duplica).
--   equipamentos (+)      → inspecao_modelo_id (modelo padrão), bloqueado / bloqueio_* (item crítico que impede o uso).
--   equipamento_liberacoes → quem liberou um equipamento bloqueado, quando e por quê (evidência).
--   Fotos no bucket privado "documentos": tenant-{id}/insp-{uid}/…

BEGIN;
DO $$
DECLARE t_tenant text; t_usuario text; t_equip text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant  FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass  AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_equip   FROM pg_attribute a WHERE a.attrelid = 'public.equipamentos'::regclass AND a.attname = 'id';

  IF to_regclass('public.inspecao_modelos') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.inspecao_modelos (
        id             bigserial PRIMARY KEY,
        tenant_id      %1$s REFERENCES public.tenants(id) ON DELETE CASCADE,   -- NULL = biblioteca
        nome           text NOT NULL,
        categoria      text NOT NULL DEFAULT 'outro',
        frequencia     text NOT NULL DEFAULT 'pre_uso' CHECK (frequencia IN ('pre_uso', 'diaria', 'semanal', 'mensal', 'avulsa')),
        descricao      text,
        vistas         jsonb NOT NULL DEFAULT '[]'::jsonb,
        campos         jsonb NOT NULL DEFAULT '["km","local"]'::jsonb,
        origem_id      bigint REFERENCES public.inspecao_modelos(id) ON DELETE SET NULL,
        origem_versao  integer,
        versao         integer NOT NULL DEFAULT 1,
        ativo          boolean NOT NULL DEFAULT true,
        criado_em      timestamptz NOT NULL DEFAULT now(),
        atualizado_em  timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant);
  END IF;

  IF to_regclass('public.inspecoes') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.inspecoes (
        id               bigserial PRIMARY KEY,
        tenant_id        %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        cliente_uid      text NOT NULL,
        modelo_id        bigint REFERENCES public.inspecao_modelos(id) ON DELETE SET NULL,
        modelo_nome      text NOT NULL,
        modelo           jsonb NOT NULL,          -- cópia do modelo no momento (prova)
        equipamento_id   %3$s REFERENCES public.equipamentos(id) ON DELETE SET NULL,
        equipamento_nome text NOT NULL,
        executor_tipo    text NOT NULL CHECK (executor_tipo IN ('colaborador', 'usuario', 'terceiro')),
        colaborador_id   bigint REFERENCES public.colaboradores(id) ON DELETE SET NULL,
        usuario_id       %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        executor_nome    text NOT NULL,
        terceiro         jsonb,                   -- { nome, cpf, empresa, placa_cavalo }
        km               numeric,
        horimetro        numeric,
        local            text,
        cliente          text,
        gps              jsonb,
        iniciada_em      timestamptz,
        concluida_em     timestamptz NOT NULL DEFAULT now(),
        resultado        text NOT NULL CHECK (resultado IN ('aprovado', 'ressalvas', 'reprovado')),
        respostas        jsonb NOT NULL,
        assinatura_png   text,
        hash             text NOT NULL,
        os_abertas       jsonb NOT NULL DEFAULT '[]'::jsonb,
        origem           text NOT NULL DEFAULT 'app' CHECK (origem IN ('app', 'link')),
        obs              text,
        criado_em        timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_usuario, t_equip);
  END IF;

  IF to_regclass('public.equipamento_liberacoes') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.equipamento_liberacoes (
        id                bigserial PRIMARY KEY,
        tenant_id         %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        equipamento_id    %3$s NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
        inspecao_id       bigint REFERENCES public.inspecoes(id) ON DELETE SET NULL,
        motivo_bloqueio   text,
        motivo_liberacao  text NOT NULL,
        liberado_por      %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        liberado_por_nome text,
        criado_em         timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_usuario, t_equip);
  END IF;
END $$;

ALTER TABLE public.equipamentos ADD COLUMN IF NOT EXISTS inspecao_modelo_id bigint;
ALTER TABLE public.equipamentos ADD COLUMN IF NOT EXISTS bloqueado boolean NOT NULL DEFAULT false;
ALTER TABLE public.equipamentos ADD COLUMN IF NOT EXISTS bloqueio_motivo text;
ALTER TABLE public.equipamentos ADD COLUMN IF NOT EXISTS bloqueio_inspecao_id bigint;
ALTER TABLE public.equipamentos ADD COLUMN IF NOT EXISTS bloqueado_em timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS inspecoes_cliente_uid_unico ON public.inspecoes (tenant_id, cliente_uid);
CREATE INDEX IF NOT EXISTS inspecoes_equip_idx ON public.inspecoes (tenant_id, equipamento_id, concluida_em);
CREATE INDEX IF NOT EXISTS inspecao_modelos_tenant_idx ON public.inspecao_modelos (tenant_id);

-- Semente da biblioteca (esquemas genéricos do QuotaFlow — a empresa importa e ajusta)
INSERT INTO public.inspecao_modelos (tenant_id, nome, categoria, frequencia, descricao, vistas, campos, versao)
SELECT NULL, 'Cavalo mecânico — pré-uso', 'cavalo', 'pre_uso', 'Checklist antes de cada saída: luzes, pneus, freios, fluidos, cabine e documentos de segurança.', '[{"codigo": "frente", "nome": "Frente", "imagem": "esquema:cavalo_frente", "pontos": [{"id": "f_farol_e", "rotulo": "Farol esquerdo (baixo/alto)", "x": 31.5, "y": 60.8, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "f_farol_d", "rotulo": "Farol direito (baixo/alto)", "x": 68.5, "y": 60.8, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "f_seta", "rotulo": "Setas e pisca-alerta", "x": 30.0, "y": 67.7, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "f_parabrisa", "rotulo": "Para-brisa (trincas)", "x": 50.0, "y": 32.7, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "f_limpador", "rotulo": "Limpadores e esguicho", "x": 50.0, "y": 43.1, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "f_retrovisor", "rotulo": "Retrovisores", "x": 22.2, "y": 30.8, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "f_parachoque", "rotulo": "Para-choque e placa", "x": 50.0, "y": 79.2, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}]}, {"codigo": "lateral", "nome": "Lateral", "imagem": "esquema:cavalo_lateral", "pontos": [{"id": "l_acesso", "rotulo": "Degraus e corrimão de acesso", "x": 24.2, "y": 51.5, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "l_tanque", "rotulo": "Tanque de combustível (vazamento, tampa)", "x": 48.8, "y": 61.9, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "l_quinta", "rotulo": "Quinta roda / engate e trava", "x": 58.8, "y": 39.6, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}, {"id": "l_mangueiras", "rotulo": "Mangueiras de ar e cabo elétrico", "x": 75.0, "y": 49.2, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "l_avarias", "rotulo": "Avarias na lataria", "x": 22.5, "y": 29.6, "tipo": "ok_nok", "foto": "sempre", "critico": false, "unidade": null, "ajuda": "Foto da lateral, para comparar depois"}]}, {"codigo": "traseira", "nome": "Traseira", "imagem": "esquema:cavalo_traseira", "pontos": [{"id": "t_lanternas", "rotulo": "Lanternas e luz de freio", "x": 28.2, "y": 73.8, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}, {"id": "t_re", "rotulo": "Luz de ré e alarme sonoro de ré", "x": 71.8, "y": 73.8, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "t_placa", "rotulo": "Placa e iluminação da placa", "x": 50.0, "y": 80.8, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "t_paralama", "rotulo": "Para-lamas e protetores", "x": 30.0, "y": 86.5, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}]}, {"codigo": "eixos", "nome": "Pneus e rodas", "imagem": "esquema:eixos", "pontos": [{"id": "e_dianteiros", "rotulo": "Pneus dianteiros (sulco, calibragem)", "x": 24.0, "y": 17.3, "tipo": "ok_nok", "foto": "sempre", "critico": true, "unidade": null, "ajuda": null}, {"id": "e_tracao", "rotulo": "Pneus de tração (sulco, calibragem)", "x": 17.8, "y": 63.5, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "e_porcas", "rotulo": "Porcas e rodas (folga, trinca)", "x": 76.0, "y": 63.5, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}, {"id": "e_estepe", "rotulo": "Estepe", "x": 50.0, "y": 46.2, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}]}, {"codigo": "painel", "nome": "Painel e cabine", "imagem": "esquema:painel", "pontos": [{"id": "p_alertas", "rotulo": "Luzes de alerta do painel (apagadas após partida)", "x": 50.0, "y": 36.5, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}, {"id": "p_ar", "rotulo": "Pressão do ar", "x": 35.0, "y": 48.1, "tipo": "numero", "foto": "nunca", "critico": false, "unidade": "psi", "ajuda": null}, {"id": "p_tacografo", "rotulo": "Tacógrafo (funcionando, disco/fita)", "x": 50.0, "y": 67.7, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "p_buzina", "rotulo": "Buzina", "x": 20.0, "y": 30.8, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "p_cinto", "rotulo": "Cinto de segurança", "x": 80.0, "y": 30.8, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}, {"id": "p_extintor", "rotulo": "Extintor (carga e validade)", "x": 22.5, "y": 67.3, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}, {"id": "p_kit", "rotulo": "Triângulo, macaco e chave de roda", "x": 77.5, "y": 67.3, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}]}, {"codigo": "motor", "nome": "Motor e fluidos", "imagem": "esquema:motor", "pontos": [{"id": "m_oleo", "rotulo": "Nível de óleo do motor", "x": 40.0, "y": 73.1, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "m_agua", "rotulo": "Água do radiador / arrefecimento", "x": 20.5, "y": 34.6, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "m_freio", "rotulo": "Fluido de freio / reservatório de ar", "x": 78.8, "y": 53.8, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}, {"id": "m_bateria", "rotulo": "Bateria (terminais, fixação)", "x": 79.2, "y": 30.0, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "m_correias", "rotulo": "Correias", "x": 63.8, "y": 73.5, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "m_vazamentos", "rotulo": "Vazamentos (óleo, água, combustível)", "x": 50.0, "y": 48.1, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}]}]'::jsonb, '["km", "local", "cliente"]'::jsonb, 1
WHERE NOT EXISTS (SELECT 1 FROM public.inspecao_modelos WHERE tenant_id IS NULL AND nome = 'Cavalo mecânico — pré-uso');
INSERT INTO public.inspecao_modelos (tenant_id, nome, categoria, frequencia, descricao, vistas, campos, versao)
SELECT NULL, 'Empilhadeira — checklist diário (NR-11)', 'empilhadeira', 'diaria', 'Checklist diário do operador (NR-11): garfos, correntes, hidráulico, freios, alarme, cinto e extintor.', '[{"codigo": "lateral", "nome": "Empilhadeira", "imagem": "esquema:empilhadeira_lateral", "pontos": [{"id": "g_garfos", "rotulo": "Garfos (trincas, desgaste) e travas", "x": 85.0, "y": 76.2, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}, {"id": "g_correntes", "rotulo": "Correntes e mastro", "x": 79.5, "y": 23.1, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}, {"id": "g_hidraulico", "rotulo": "Cilindros e mangueiras hidráulicas (vazamento)", "x": 63.8, "y": 46.2, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "g_pneus", "rotulo": "Pneus / rodas", "x": 27.5, "y": 80.8, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "g_protecao", "rotulo": "Proteção do operador (teto)", "x": 45.0, "y": 23.1, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}, {"id": "g_cinto", "rotulo": "Cinto de segurança", "x": 50.0, "y": 40.4, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}, {"id": "g_luzes", "rotulo": "Faróis, luz de ré e giroflex", "x": 72.8, "y": 48.1, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "g_alarme", "rotulo": "Alarme sonoro de ré e buzina", "x": 37.5, "y": 67.3, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}]}, {"codigo": "painel", "nome": "Painel e comandos", "imagem": "esquema:painel", "pontos": [{"id": "gp_alertas", "rotulo": "Luzes de alerta", "x": 50.0, "y": 36.5, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}, {"id": "gp_freio", "rotulo": "Freio de serviço e de estacionamento", "x": 35.0, "y": 48.1, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}, {"id": "gp_comandos", "rotulo": "Comandos de elevação e inclinação", "x": 65.0, "y": 48.1, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "gp_carga", "rotulo": "Bateria / combustível", "x": 50.0, "y": 67.7, "tipo": "numero", "foto": "nunca", "critico": false, "unidade": "%", "ajuda": null}, {"id": "gp_extintor", "rotulo": "Extintor (carga e validade)", "x": 22.5, "y": 67.3, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}]}]'::jsonb, '["horimetro", "local"]'::jsonb, 1
WHERE NOT EXISTS (SELECT 1 FROM public.inspecao_modelos WHERE tenant_id IS NULL AND nome = 'Empilhadeira — checklist diário (NR-11)');
INSERT INTO public.inspecao_modelos (tenant_id, nome, categoria, frequencia, descricao, vistas, campos, versao)
SELECT NULL, 'Carreta — pré-uso', 'carreta', 'pre_uso', 'Carroceria/lona, pino-rei, pneus, sinalização, portas e lacre.', '[{"codigo": "lateral", "nome": "Lateral", "imagem": "esquema:carreta_lateral", "pontos": [{"id": "c_carroceria", "rotulo": "Carroceria / baú / lona (avarias)", "x": 50.0, "y": 36.5, "tipo": "ok_nok", "foto": "sempre", "critico": false, "unidade": null, "ajuda": null}, {"id": "c_pinorei", "rotulo": "Pino-rei e prato (desgaste, trava)", "x": 12.5, "y": 63.5, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}, {"id": "c_pneus", "rotulo": "Pneus e rodas", "x": 78.8, "y": 71.2, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}, {"id": "c_refletivas", "rotulo": "Faixas refletivas e lanternas laterais", "x": 93.0, "y": 51.9, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "c_suspensao", "rotulo": "Suspensão e para-lamas", "x": 72.5, "y": 61.5, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}, {"id": "c_pes", "rotulo": "Pés de apoio (macaco)", "x": 16.2, "y": 67.3, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}]}, {"codigo": "traseira", "nome": "Traseira", "imagem": "esquema:carreta_traseira", "pontos": [{"id": "ct_lanternas", "rotulo": "Lanternas e luz de freio", "x": 24.2, "y": 73.1, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}, {"id": "ct_portas", "rotulo": "Portas, dobradiças e lacre", "x": 50.0, "y": 39.6, "tipo": "ok_nok", "foto": "sempre", "critico": false, "unidade": null, "ajuda": "Foto do lacre com o número legível"}, {"id": "ct_parachoque", "rotulo": "Para-choque traseiro", "x": 50.0, "y": 73.1, "tipo": "ok_nok", "foto": "se_nok", "critico": true, "unidade": null, "ajuda": null}, {"id": "ct_placa", "rotulo": "Placa e iluminação da placa", "x": 50.0, "y": 80.0, "tipo": "ok_nok", "foto": "se_nok", "critico": false, "unidade": null, "ajuda": null}]}]'::jsonb, '["local", "cliente"]'::jsonb, 1
WHERE NOT EXISTS (SELECT 1 FROM public.inspecao_modelos WHERE tenant_id IS NULL AND nome = 'Carreta — pré-uso');

COMMIT;
