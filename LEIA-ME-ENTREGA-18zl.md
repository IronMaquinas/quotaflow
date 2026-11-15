# Entrega 18zl — 🪪 leitura da CNH pela IA no cadastro do colaborador

## 1. Antes de subir
- **Supabase:** rode `backend/migrations/089_ia_uso_foto_colaborador.sql`. Ela cria a foto do colaborador e a tabela de uso da IA, e pode rodar mais de uma vez.
- **Frontend:** há uma dependência nova, `pdfjs-dist`, que lê o PDF da CNH no navegador. Ela já está no `package.json` e no `package-lock.json`; o Render instala sozinho no build.

## 2. Como funciona
No **＋ Novo colaborador** (ou Editar) há a caixa **🪪 Tem a CNH? → 📎 Anexar CNH**:
1. Aceita o **PDF da CNH digital** (gov.br) ou uma **foto** da CNH física. O PDF vira imagem no próprio navegador.
2. A IA lê a CNH e o sistema **confere**: CPF com dígito verificador, datas, categoria, CNH vencida e confiança da leitura.
3. **Preenche** nome, CPF, nascimento e categoria, e mostra o que mudou para você conferir.
4. **Recorta a foto** do titular: toque para ver com zoom; o ✕ pede confirmação antes de tirar.
5. Ao **salvar**:
   - a foto vira a **foto do colaborador** (aparece na lista);
   - nasce o **documento CNH** com o arquivo original, nº de registro, emissão e **validade**, e o sistema já avisa o vencimento. Se essa CNH já existir, não duplica.

Com a **IA desligada** (sem chave), a caixa avisa e o cadastro manual segue igual.

## 3. Custo e cobrança
- Uma leitura gasta cerca de 1.600 tokens de entrada e 200 de saída, o que dá **≈ US$ 0,01 (≈ R$ 0,05)** com o Claude Sonnet. Com um modelo menor (Haiku), fica em ≈ US$ 0,003.
- Toda chamada à IA fica registrada em **`ia_uso`**, por empresa, com o recurso, o modelo e os tokens. Com 1 mês de uso real dá para decidir a cobrança: franquia de leituras por plano + excedente, ou o módulo 🧠 Agente de IA como pago.

## Pendente
🔑 Cadastrar `ANTHROPIC_API_KEY` no Render quando houver crédito (registrado no readme).

## Arquivos
- backend/migrations/089_ia_uso_foto_colaborador.sql (novo) · backend/services/leituraCnh.js (novo)
- backend/services/ia/index.js · backend/services/analistaMensal.js · backend/routes/pessoas.js
- frontend/src/components/pessoas/LerCnh.jsx (novo) · frontend/src/utils/lerCnh.js (novo) · TelaPessoas.jsx
- frontend/package.json · frontend/package-lock.json
- backend/verificar-entrega.js · readme.md

⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
