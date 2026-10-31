# Entrega 16e.4 — botão Base sempre; sem AT só Base e Limpar

Copie por cima (inclusive o verificador). Sem SQL. Reinicie o backend. `cd backend && node verificar-entrega.js` → 203 ✓.

- Inspeção do fluxo (com AT): **📍 Base · 📍 Coleta · 🛣 Em trânsito · 🏁 Entrega · ✕ Limpar**. O botão Base aparece sempre; sem o pátio cadastrado, tocar nele avisa para preencher em ⚙ Dados da empresa → 📍 Pátio / base da frota.
- Inspeção sem AT (🔍 Inspeções pelo app ou link de terceiros): **📍 Base · ✕ Limpar**, com o campo vazio.
- Inspeção já começada: ao continuar, ganha o botão Base.
