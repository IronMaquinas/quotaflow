# Entrega 18zv — ✍ fluxo interno e assinatura eletrônica dos documentos de gestão

## 1. Rode no Supabase
`backend/migrations/094_gestao_fluxo_assinaturas.sql` (pode rodar mais de uma vez).

## 2. O fluxo
1. **📤 Enviar para aprovação**, num rascunho novo ou numa nova revisão. Quem envia **assina como "Elaborado"** e escolhe:
   - **Verificação** (opcional): qualquer pessoa da empresa, desde que diferente de quem elaborou e de quem aprova;
   - **Aprovação**: admin, gestor ou qualidade. **Quem elaborou não aprova** o próprio documento, a não ser que seja o único aprovador da empresa.
2. Quem está na vez recebe o **aviso** (🔔 e, se não vir, e-mail). No 📘 Gestão aparece a faixa **"✍ Aguardando você"**.
3. O verificador clica **✓ Verificar e assinar**, e o documento segue para a aprovação.
4. O aprovador clica **✍ Aprovar e assinar**. O documento vira vigente; numa revisão, a anterior vai para o histórico com as assinaturas dela.
5. Na verificação ou na aprovação, também é possível **↩ Devolver**, com comentário obrigatório. O documento volta para quem elaborou ajustar.

- Enquanto está em verificação ou aprovação, o **texto fica travado**.
- **👁 Ver a Rev. NN proposta** mostra o texto em aprovação, com a tarja EM APROVAÇÃO.

## 3. Assinatura no documento
Cada assinatura guarda o login, o nome, a **função**, a data e a hora, e uma impressão digital (hash) do texto. O A4 sai assim:
> ✍ Elaborado: Ana Souza (Analista da Qualidade) — 15/11/2026 14:02
> ✍ Aprovado: Marcony (Diretor) — 15/11/2026 16:40
> Assinado eletronicamente no QuotaFlow · código de verificação **7F3A-91C2**

Se o texto for alterado depois da aprovação, o documento passa a mostrar **"assinatura INVÁLIDA"**.

- A **função** vem do cadastro do colaborador ligado ao login (👷 Pessoas → Colaborador → login). Sem esse vínculo, aparece o perfil (Gestor, Qualidade…).

## Arquivos
- backend/migrations/094_gestao_fluxo_assinaturas.sql (novo)
- backend/services/documentosGestao.js · backend/routes/pessoas.js
- frontend/src/components/pessoas/DocumentosGestao.jsx · frontend/src/utils/gerarDocumentoGestao.js · TelaPessoas.jsx · frontend/src/App.jsx
- backend/verificar-entrega.js · readme.md

⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
