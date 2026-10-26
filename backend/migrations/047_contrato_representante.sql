-- 047_contrato_representante.sql — etapa 14d.3: modelo-base da biblioteca com "quem assina pelo cliente"
-- Idempotente. Rodar no SQL Editor do Supabase, depois da 046.
-- O modelo-base passa a usar {{representante.nome}}, {{representante.cargo}} e {{representante.cpf}} (preenchidos no contrato,
-- em 📄 Contrato → Quem assina pelo cliente). A versão sobe: quem importou vê "✨ Versão nova" e decide se atualiza.
UPDATE public.contrato_modelos
SET corpo = replace(corpo, 'neste ato representada por {{contato.nome}}.', 'neste ato representada por {{representante.nome}}, {{representante.cargo}}, inscrito(a) no CPF sob o nº {{representante.cpf}}.'),
    versao = versao + 1, atualizado_em = now()
WHERE tenant_id IS NULL AND nome = 'Locação de equipamentos — modelo-base' AND corpo LIKE '%neste ato representada por {{contato.nome}}.%';
