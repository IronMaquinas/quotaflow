# Entrega 14d + 14d.1 + 14d.2 — 📄 Modelos de contrato · emissão · aceite do locatário

## O que vem
- **📑 Contratos → 📄 Modelos de contrato:** 📚 importar o modelo-base da biblioteca (8 cláusulas — revise com o seu jurídico), criar, editar (lista de campos automáticos: clique para inserir), ✨ versão nova, desativar.
- **No contrato → 📄 Contrato:** modelo + **valor mensal de cada equipamento** + condições (caução, franquia, hora excedente, reajuste, multa, vencimento, pagamento, foro, condições específicas) → **👁 Prévia** → **📄 Emitir** (texto congelado com hash e versão; emitir de novo = nova versão e novo aceite).
- **Locatário:** "📄 Contrato — aguardando o seu aceite" → **Ler e aceitar** (lê o contrato inteiro e assina na tela) → depois "🖨 Ver / imprimir".
- Contrato impresso com a **logo**, tabela dos equipamentos, assinaturas (locadora, locatária com a assinatura do aceite, 2 testemunhas) e os códigos de integridade.
- Console: aba **📄 Biblioteca de contratos**.

## 14d.2 (fase e N/A)
- **Fase do contrato, calculada sozinha:** 📝 Em elaboração → ⏳ Aguardando aceite (emitido) → ✅ Em andamento (aceito) → 🏁 Encerrado. Filtros por fase na lista; a fase aparece no card e no detalhe.
- **✍ Registrar assinatura no papel** (cliente que não usa o sistema): data + observação → conta como aceite da versão emitida.
- **N/A** ao lado de cada condição (caução, franquia, hora excedente, reajuste, multa, vencimento, pagamento, foro): fica cinza, não conta como "falta" e sai "não se aplica" no contrato.

## 14d.1 (ajustes depois do seu teste)
- **👁 Ver** o modelo antes de importar (e na lista de modelos), com os campos à mostra.
- Valores com **máscara R$** (caução, hora excedente, valor mensal de cada equipamento).
- A **👁 Prévia** não "funcionava" porque dava erro escondido atrás do modal (a franquia de 2.000 h passava do limite antigo de 744 h). Agora o aviso aparece dentro do painel e a franquia aceita até 100.000 h.
- Este zip já traz a 14d e a 14d.1 (se já copiou alguma delas, copie por cima).

## Como aplicar
1. **Supabase → SQL Editor:** rode `backend/migrations/046_modelos_contrato.sql`.
2. Copie os arquivos por cima (na **raiz** do projeto).
3. Novos no git:
   ```
   git add backend/services/contratoModelos.js backend/migrations/046_modelos_contrato.sql \
     frontend/src/components/contratos/ModelosContrato.jsx frontend/src/utils/gerarContrato.js frontend/src/plataforma/BibliotecaContratos.jsx frontend/src/components/shared/CampoMoeda.jsx
   ```
4. `cd backend && node verificar-entrega.js` → **152 arquivos OK**.
5. Reinicie o backend.

## Roteiro de teste
1. 📑 Contratos → 📄 Modelos de contrato → 📚 Importar "Locação de equipamentos — modelo-base" → Editar (mude uma cláusula; clique num campo para inserir).
2. Abra um contrato com equipamentos → 📄 Contrato → escolha o modelo → valor mensal dos equipamentos → condições → **👁 Prévia** (marca d'água "PRÉVIA").
3. **📄 Emitir** → "EMITIDO v1 · AGUARDANDO ACEITE" → 🖨 Contrato emitido.
4. Entre como o **locatário** → "📄 Ler e aceitar" → assine → ✍ aceito. Volte como gestor → "✍ ACEITO v1"; o contrato impresso mostra a assinatura dele.
5. Mude um valor e emita de novo → v2, aguardando novo aceite.
6. No outro contrato: marque **N/A** na multa → 👁 Prévia mostra "não se aplica". Emita → "O cliente assinou no papel? Registrar assinatura" → a fase vira ✅ Em andamento.

## Árvore
```
backend/
  verificar-entrega.js
  routes/ contratos.js · locatario.js · plataforma.js
  services/ contratoModelos.js (novo) · contratosLocacao.js
  migrations/ 046_modelos_contrato.sql (novo)
frontend/src/
  components/contratos/ ModelosContrato.jsx (novo) · TelaContratos.jsx · TelaLocatario.jsx
  plataforma/ BibliotecaContratos.jsx (novo) · ConsolePlataforma.jsx
  utils/ gerarContrato.js (novo) · logoEmpresa.js
readme.md
```
