-- 041_inspecoes_tipos_links.sql — etapa 14b.1
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 040.
--   inspecao_modelos.tipo → equipamento (pré-uso/rotina) | carregamento | transito | descarregamento (gatilhos da futura AT)
--   inspecoes.tipo / numero → INSP-AAAA-NNNN por empresa (as já feitas ganham número aqui)
--   inspecao_links → link de "inspeção de terceiros" (sem login): modelo, equipamento (ou veículo do próprio terceiro), validade
BEGIN;
ALTER TABLE public.inspecao_modelos ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'equipamento';
ALTER TABLE public.inspecoes ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'equipamento';
ALTER TABLE public.inspecoes ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.inspecoes ADD COLUMN IF NOT EXISTS link_id bigint;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inspecao_modelos_tipo_chk') THEN
    ALTER TABLE public.inspecao_modelos ADD CONSTRAINT inspecao_modelos_tipo_chk CHECK (tipo IN ('equipamento','carregamento','transito','descarregamento'));
  END IF;
END $$;

-- numera as inspeções que já existem (por empresa e ano, na ordem em que foram feitas)
WITH n AS (
  SELECT id, 'INSP-' || to_char(concluida_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY') || '-' ||
         lpad(row_number() OVER (PARTITION BY tenant_id, to_char(concluida_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY') ORDER BY concluida_em, id)::text, 4, '0') AS num
  FROM public.inspecoes WHERE numero IS NULL)
UPDATE public.inspecoes i SET numero = n.num FROM n WHERE i.id = n.id;
CREATE UNIQUE INDEX IF NOT EXISTS inspecoes_numero_unico ON public.inspecoes (tenant_id, numero);

DO $$
DECLARE t_tenant text; t_usuario text; t_equip text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant  FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass  AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_equip   FROM pg_attribute a WHERE a.attrelid = 'public.equipamentos'::regclass AND a.attname = 'id';
  IF to_regclass('public.inspecao_links') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.inspecao_links (
        id               bigserial PRIMARY KEY,
        tenant_id        %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        token            text NOT NULL UNIQUE,
        titulo           text,
        modelo_id        bigint NOT NULL REFERENCES public.inspecao_modelos(id) ON DELETE CASCADE,
        equipamento_id   %3$s REFERENCES public.equipamentos(id) ON DELETE CASCADE,  -- NULL = veículo do próprio terceiro
        valido_ate       timestamptz NOT NULL,
        ativo            boolean NOT NULL DEFAULT true,
        usos             integer NOT NULL DEFAULT 0,
        ultimo_uso       timestamptz,
        criado_por       %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        criado_por_nome  text,
        criado_em        timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_usuario, t_equip);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS inspecao_links_tenant_idx ON public.inspecao_links (tenant_id);

-- Biblioteca: inspeções da carga (carregamento, em trânsito, descarregamento)
INSERT INTO public.inspecao_modelos (tenant_id, nome, tipo, categoria, frequencia, descricao, vistas, campos, versao)
SELECT NULL, 'Carga — inspeção de carregamento', 'carregamento', 'carreta', 'avulsa', 'Acomodação, amarração, bloqueio e sinalização antes de sair do embarque.', '[{"codigo": "lateral", "nome": "Carga — lateral", "imagem": "esquema:carreta_lateral", "pontos": [{"id": "cg_acomod", "rotulo": "Carga acomodada e centralizada (peso distribuído nos eixos)", "x": 50.0, "y": 36.5, "tipo": "ok_nok", "foto": "sempre", "foto_obrigatoria": true, "critico": true, "unidade": null, "ajuda": null}, {"id": "cg_amarr", "rotulo": "Amarração: cintas/correntes em quantidade e tensão corretas", "x": 37.5, "y": 46.2, "tipo": "ok_nok", "foto": "sempre", "foto_obrigatoria": true, "critico": true, "unidade": null, "ajuda": "Confira catracas travadas e cintas sem cortes"}, {"id": "cg_qtd_amarr", "rotulo": "Quantidade de pontos de amarração", "x": 62.5, "y": 46.2, "tipo": "numero", "foto": "nunca", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}, {"id": "cg_bloqueio", "rotulo": "Calços / bloqueio contra deslocamento", "x": 75.0, "y": 57.7, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": true, "unidade": null, "ajuda": null}, {"id": "cg_protecao", "rotulo": "Cantoneiras / proteção das cintas nas quinas", "x": 27.5, "y": 36.5, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}, {"id": "cg_dimensao", "rotulo": "Dimensões dentro do permitido (ou da AET)", "x": 87.5, "y": 26.9, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": true, "unidade": null, "ajuda": "Altura, largura e comprimento conferidos"}, {"id": "cg_lona", "rotulo": "Lona / cobertura presa", "x": 50.0, "y": 23.1, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}]}, {"codigo": "traseira", "nome": "Sinalização e documentos", "imagem": "esquema:carreta_traseira", "pontos": [{"id": "cg_sinal", "rotulo": "Sinalização de carga (placas, faixas, bandeiras, luzes)", "x": 50.0, "y": 23.1, "tipo": "ok_nok", "foto": "sempre", "foto_obrigatoria": true, "critico": true, "unidade": null, "ajuda": null}, {"id": "cg_lacre", "rotulo": "Lacre (número)", "x": 50.0, "y": 39.6, "tipo": "texto", "foto": "sempre", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": "Digite o número e fotografe o lacre"}, {"id": "cg_docs", "rotulo": "Documentos da carga a bordo (NF-e, DAMDFE, AET)", "x": 30.0, "y": 57.7, "tipo": "ok_nok", "foto": "nunca", "foto_obrigatoria": true, "critico": true, "unidade": null, "ajuda": null}, {"id": "cg_peso", "rotulo": "Peso da carga (t)", "x": 70.0, "y": 57.7, "tipo": "numero", "foto": "nunca", "foto_obrigatoria": true, "critico": false, "unidade": "t", "ajuda": null}]}]'::jsonb, '["local", "cliente"]'::jsonb, 1
WHERE NOT EXISTS (SELECT 1 FROM public.inspecao_modelos WHERE tenant_id IS NULL AND nome = 'Carga — inspeção de carregamento');
INSERT INTO public.inspecao_modelos (tenant_id, nome, tipo, categoria, frequencia, descricao, vistas, campos, versao)
SELECT NULL, 'Carga — verificação em trânsito', 'transito', 'carreta', 'avulsa', 'Parada de verificação durante a viagem: amarração, carga, pneus e sinalização.', '[{"codigo": "parada", "nome": "Parada de verificação", "imagem": "esquema:carreta_lateral", "pontos": [{"id": "tr_amarr", "rotulo": "Reaperto / tensão das amarrações", "x": 37.5, "y": 46.2, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": true, "unidade": null, "ajuda": null}, {"id": "tr_carga", "rotulo": "Carga sem deslocamento", "x": 50.0, "y": 36.5, "tipo": "ok_nok", "foto": "sempre", "foto_obrigatoria": true, "critico": true, "unidade": null, "ajuda": null}, {"id": "tr_pneus", "rotulo": "Pneus e cubos (aquecimento, vazamento)", "x": 78.8, "y": 71.2, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": true, "unidade": null, "ajuda": null}, {"id": "tr_lona", "rotulo": "Lona / cobertura", "x": 50.0, "y": 23.1, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}, {"id": "tr_sinal", "rotulo": "Sinalização e luzes funcionando", "x": 93.0, "y": 51.9, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}]}]'::jsonb, '["km", "local"]'::jsonb, 1
WHERE NOT EXISTS (SELECT 1 FROM public.inspecao_modelos WHERE tenant_id IS NULL AND nome = 'Carga — verificação em trânsito');
INSERT INTO public.inspecao_modelos (tenant_id, nome, tipo, categoria, frequencia, descricao, vistas, campos, versao)
SELECT NULL, 'Carga — inspeção de descarregamento', 'descarregamento', 'carreta', 'avulsa', 'Chegada ao destino: carga sem avarias, lacre, comprovante de entrega.', '[{"codigo": "entrega", "nome": "Descarregamento", "imagem": "esquema:carreta_lateral", "pontos": [{"id": "de_carga", "rotulo": "Carga entregue sem avarias", "x": 50.0, "y": 36.5, "tipo": "ok_nok", "foto": "sempre", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}, {"id": "de_lacre", "rotulo": "Lacre íntegro na chegada", "x": 93.0, "y": 51.9, "tipo": "ok_nok", "foto": "sempre", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}, {"id": "de_canhoto", "rotulo": "Canhoto / comprovante assinado pelo recebedor", "x": 30.0, "y": 57.7, "tipo": "ok_nok", "foto": "sempre", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": "Foto do canhoto da NF-e ou do comprovante"}, {"id": "de_recebedor", "rotulo": "Nome de quem recebeu", "x": 62.5, "y": 57.7, "tipo": "texto", "foto": "nunca", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}, {"id": "de_amarr", "rotulo": "Cintas, correntes e calços recolhidos", "x": 75.0, "y": 63.5, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}, {"id": "de_limpa", "rotulo": "Carroceria limpa e livre", "x": 50.0, "y": 23.1, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}]}]'::jsonb, '["local", "cliente"]'::jsonb, 1
WHERE NOT EXISTS (SELECT 1 FROM public.inspecao_modelos WHERE tenant_id IS NULL AND nome = 'Carga — inspeção de descarregamento');

COMMIT;
