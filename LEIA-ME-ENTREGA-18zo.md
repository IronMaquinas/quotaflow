# Entrega 18zo — 💸 a IA nunca cobra duas vezes pela mesma leitura

## 1. Rode no Supabase
`backend/migrations/091_ia_uso_cache.sql` (pode rodar mais de uma vez).

## 2. Proteções de custo na leitura da CNH
1. **Mesma CNH = custo zero.** O sistema guarda a impressão digital do arquivo e o resultado. Ler o mesmo arquivo de novo devolve o resultado guardado, sem chamar a IA, e a tela mostra "já lida antes — sem nova leitura".
2. **2 falhas na mesma imagem = bloqueio.** A IA não é mais chamada para aquele arquivo, e a tela pede "foto mais nítida ou preencha à mão". Na 1ª falha, a tela avisa que resta só mais 1 tentativa.
3. **Teto por empresa por dia:** 30 leituras, e as falhas contam. Para mudar, use a variável `IA_LIMITE_CNH_DIA` no Render.

## 3. A causa provável e o diagnóstico
- O limite de resposta era de **700 tokens** e a resposta podia ser **cortada no meio**, o que deixa o texto inválido. Subi para 1.500, e a leitura agora tolera ```json```, vírgula sobrando e texto antes ou depois.
- Se falhar de novo, o **log do Render** mostra `⚠️ [leitura_cnh] resposta fora do formato` com o texto que a IA devolveu. Me mande essa linha.
- Toda chamada registra no log `🧠 [ia] leitura_cnh · modelo · entrada X · saída Y tokens`, para conferir o custo real.

## Arquivos
- backend/migrations/091_ia_uso_cache.sql (novo)
- backend/services/ia/index.js · backend/services/leituraCnh.js
- frontend/src/components/pessoas/LerCnh.jsx
- backend/verificar-entrega.js · readme.md

⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
