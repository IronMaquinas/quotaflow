# Entrega 16e.3 — origem certa, pátio da frota e botões de local

## Como aplicar
1. Copie os arquivos por cima. Desta vez, inclua também o `backend/verificar-entrega.js` (o do GitHub ficou na versão da 16e.2).
2. No Supabase, rode **`backend/migrations/058_base_frota.sql`** (pode rodar 2×).
3. Reinicie o backend. `cd backend && node verificar-entrega.js` → **203 ✓**.

## O que testar
1. **⚙ Dados da empresa** → novo campo **📍 Pátio / base da frota**: o endereço onde o conjunto é liberado (pode ser diferente do endereço fiscal).
2. **📲 Link do motorista** → inspeção do fluxo:
   - a etiqueta diz de onde veio o campo: "↺ pátio / base da frota", "↺ coleta da AT", "↺ entrega da AT" ou "↺ dados da AT";
   - liberação = o pátio (sem pátio cadastrado, a coleta). O endereço fiscal da empresa não entra mais;
   - botões abaixo do Local: **📍 Base · 📍 Coleta · 🛣 Em trânsito · 🏁 Entrega** (um toque troca) e **✕ Limpar** para digitar à mão. No Cliente: ✕ Limpar e "↺ Dados da AT" para voltar.
3. Inspeção já começada antes: ao tocar em "Continuar", ganha os botões; os campos vazios são preenchidos.
