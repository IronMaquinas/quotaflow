# Entrega 18z.6 — 📦 Pátio: áreas de armazenagem, ocupação e CNPJ

**Base:** origin/main 802f6c4 (18z.5). Suba **todos** os arquivos, inclusive o `backend/verificar-entrega.js`.

## 1. Supabase
Rode `backend/migrations/084_patio_areas.sql`. É idempotente.

## 2. Testar (📦 Propriedade do cliente)
1. **Sem áreas:** aparece o alerta discreto, com borda tracejada, avisando que o espaço não está sendo medido.
2. **Cadastrar áreas e conferir a ocupação:**
   - use Cadastrar áreas (ou ⚙ Áreas) e crie, por exemplo, "Galpão 1" com 800 m² coberta e "Pátio externo" com 2.500 m²;
   - o painel passa a mostrar o % de ocupação, os m² livres e uma barra por área.
3. **Usar as áreas nos equipamentos:**
   - abra um equipamento, use ✎ alterar, escolha a área e informe os m² que ele ocupa;
   - a ocupação da área sobe.
4. **Cabe?:** digite 3 equipamentos de 20 m². A tela diz onde cabe e quanto sobra.
5. **Desativar área:** tente desativar uma área com equipamento. O sistema bloqueia e explica o motivo.
6. **CNPJ:**
   - a ficha mostra o CNPJ/CPF do cliente;
   - em ＋ Entrada no pátio, com cliente não cadastrado, há um campo para o CNPJ/CPF;
   - o 🖨 Comprovante traz o CNPJ do cliente e o do emitente da NF.
