# Entrega 18zc — 📏📤 Envio automático da medição

**Base:** origin/main 37e7946 (18zb.1). Suba **todos** os arquivos, inclusive o `backend/verificar-entrega.js`. Nos últimos commits ele ficou de fora, e por isso o verificador acusava o TelaContratos e o TelaPatio.

## 1. Supabase
Rode `backend/migrations/087_medicao_envio_automatico.sql`. É idempotente.

## 2. Reiniciar o backend
O envio roda no agendamento das 7h, junto com os outros avisos diários.

## 3. Testar
1. **Ligar o envio:** em 📑 Contratos, abra um contrato e use ✎ Editar → 📏 Medição. Ligue **📤 Envio automático** com 1 dia e salve.
   - a ficha passa a mostrar "📤 envio automático 1 dia(s) após o fim do ciclo";
   - se o contrato tiver aprovação pelo locatário, o texto diz que a medição vai para o cliente aprovar; sem aprovação, diz que fecha e vai por e-mail.
2. **Aviso na medição:** abra a medição em preparação do ciclo atual. Aparece o selo **"📤 Envio automático em dd/mm"**.
3. **No dia:**
   - na véspera o gestor recebe 🔔 "Amanhã a medição … vai sozinha";
   - no dia D+1, às 7h, ela é enviada ou fechada, e o gestor recebe 🔔 com o valor;
   - se houver item sem valor, ela não vai e o gestor recebe 🔔 com o motivo.

Ligar o envio **não** dispara medições de ciclos que já terminaram.
