# Entrega 18n — 🔔 Central de Notificações + situação da conversa spot

**Base:** origin/main e789a7a (18m). Copie os arquivos do zip por cima, rode a migration e confira.

## 1. Supabase
Rodar `backend/migrations/074_notificacoes.sql` (idempotente). Sem ela o sistema funciona normal, só o 🔔 fica vazio.

## 2. Conferir
`cd backend && node verificar-entrega.js` — antes do commit acusa os 3 arquivos novos fora do git (normal); depois do commit tem que dar tudo ✓.

## 3. O que testar
1. Comprador abre uma demanda spot; no portal, o fornecedor responde no 💬 → no sistema do comprador o 🔔 sobe na hora e aparece o aviso no canto ("💬 Peças Serra respondeu sobre DSP-…").
2. Clicar no aviso (ou no item do 🔔) abre o Canal Spot já na demanda e na conversa; o 🔔 dela fica lido.
3. Fornecedor manda mais 2 mensagens → continua 1 item no 🔔, com "3 mensagens".
4. Selos: comprador escreveu e o fornecedor não respondeu → ⏳ "Aguardando resposta · não leu / · leu"; após 24 h 🔴 "Sem resposta"; os dois conversando → 💬 "Conversa ativa". No card da demanda aparece o resumo.
5. O mesmo do lado do fornecedor (🔔 no portal, abre em Oportunidades).
6. Console → Módulos: novo "🔔 Notificações no celular" (em breve) em 🧠 Inteligência e IA.

## 4. Celular (ainda não ligado)
A regra contra excesso roda a cada 5 min e só **registra** o que sairia (`push_status`): 10 min na 1ª mensagem / 60 min nas demais, não sai com o sistema aberto, um por assunto, silêncio 22h–7h, máx. 5/dia. Para conferir:
`select titulo, push_status, push_motivo, push_em from notificacoes order by id desc limit 20;`
Próximo passo do canal: Telegram.
