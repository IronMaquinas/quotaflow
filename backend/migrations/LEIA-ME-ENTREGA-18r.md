# Entrega 18r — 🔔 mais eventos na Central de Notificações

**Base:** origin/main 0190502 (18q.1). Sem migration.

Copie os arquivos e rode `cd backend && node verificar-entrega.js`. Tem que dar "✓ Todos".

## Testar
Use dois usuários. Quem faz a ação não recebe o próprio aviso. Cada aviso abre a tela do assunto.

1. **⚠️ Ocorrência nova:** registre uma ocorrência. As pessoas de ⚙️ → Ocorrências recebem "⚠️ Nova ocorrência INC-… — Avaria · PARADO", que abre a ocorrência.
2. **📋 Tarefa para você:** crie uma tarefa com outro responsável (ou troque o responsável). Ele recebe "📋 Tarefa para você: TSK-… · título" com "por Fulano · prazo dd/mm" e abre em ✅ Plano.
3. **✅ Aprovação pendente:** faça uma solicitação de retirada. Admin e gestor recebem o aviso, que abre ✅ Aprovações.
4. **📏 Medição contestada:** o cliente contesta uma medição. Quem enviou e os gestores recebem o aviso, que abre 📑 Contratos.
5. **📄 Documentos vencendo:** chega junto com o e-mail diário, um aviso por pessoa por dia, e abre 👷 Pessoas.
