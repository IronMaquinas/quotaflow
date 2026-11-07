# Entrega 18q — 📎 anexo no chat do Spot · ✉️ e-mail de 4 h · 📊 atenção às respostas

**Base:** origin/main 94b596e (18p).

## 1. Supabase
Rode `backend/migrations/075_spot_anexo_email_atraso.sql`. É idempotente.

## 2. Conferir
Rode `cd backend && node verificar-entrega.js`. Antes do commit aparece o aviso da 075 fora do git, que é normal.

## 3. Testar
1. **📎 Anexo:** no chat da demanda, clique no 📎 e mande uma foto da plaqueta ou um PDF.
   - Aparece na conversa dos dois lados.
   - A foto abre por cima da tela e o PDF abre no visualizador.
2. **E-mail de 4 h:**
   - O fornecedor responde e ninguém lê por 4 h → o comprador recebe um e-mail.
   - Se abrir a conversa ou clicar em ✉️ Email / 💬 WhatsApp antes disso, não sai e-mail.
   - Não sai entre 22h e 7h e não vai para o perfil admin.
   - Só roda com `CRON_INTERNO=1`.
3. **📊 Indicador:** abaixo de "Canal Spot" aparece "📊 X% das respostas ficaram +4 h sem ler (30 dias) · meta 0%". Clique para ver por pessoa.

Para conferir o que aconteceu:
`select titulo, criado_em, lida_em, email_em, email_status from notificacoes where tipo='spot_mensagem' order by id desc limit 20;`
