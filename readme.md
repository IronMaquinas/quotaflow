# Etapa 10b — Convidar fornecedor novo (ainda não cadastrado)

O tenant clica em **✉ Convidar fornecedor** e informa só o e-mail (o nome é opcional). O fornecedor recebe o link, preenche CNPJ (com busca na Receita), dados da empresa, atuação (opcional) e o login, e entra direto no portal.

O cadastro nasce como fornecedor **local do tenant que convidou**, já com acesso ao portal. Na lista do tenant ele aparece com "🟢 No portal" e 🔒.

## Arquivos

| Arquivo | O que muda |
|---|---|
| `014_convite_fornecedor_novo.sql` | `fornecedor_convites.fornecedor_id` passa a aceitar vazio; nova coluna `nome_sugerido` |
| `backend/services/convitesFornecedor.js` | `convidarNovo`, `listarConvitesNovos`, `cancelarConviteNovo`; o aceite cria o cadastro |
| `backend/routes/fornecedores.js` | `POST /convidar-novo`, `GET /convites`, `DELETE /convites/:id` |
| `backend/routes/auth.js` | `/convite/validar` informa `novo`; `/convite/aceitar` recebe `empresa` |
| `frontend/src/TelaAceitarConvite.jsx` | No convite novo, vira um cadastro curto: empresa, atuação e acesso |
| `frontend/src/components/fornecedores/TelaFornecedoresNova.jsx` | Botão **✉ Convidar fornecedor**, modal e lista "Convites aguardando cadastro" |
| `backend/verificar-entrega.js` | Atualizado (34 arquivos) |

## Regras

- **CNPJ de um fornecedor global:** não duplica. O fornecedor é orientado a entrar com o login que já tem, e o tenant já o vê na lista.
- **CNPJ que o próprio tenant já cadastrou (sem login):** o login é ligado a esse cadastro, sem duplicar.
- **CNPJ que existe como local de outro tenant:** nada é revelado; nasce um cadastro novo para este tenant.
- **Consulta à Receita no servidor (BrasilAPI):**
  - CNPJ inexistente ou não ATIVO: bloqueia.
  - Receita fora do ar: o cadastro segue sem a consulta.
- **E-mail que já é login no portal:** bloqueia. A mensagem só diz de quem é o e-mail se for um global ou um fornecedor do próprio tenant.
- **Reenviar:** cancela o link anterior.
- **Validade:** o link vale 7 dias.

## Como aplicar

1. Rode `014_convite_fornecedor_novo.sql` no SQL Editor do Supabase.
2. Na pasta `backend`: `node verificar-entrega.js --antes` deve dar **5/5**.
3. Copie os arquivos (inclusive o `verificar-entrega.js`).
4. Rode `node verificar-entrega.js` de novo; deve dar **34/34**.
5. Faça commit e push.
