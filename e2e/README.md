# Testes ponta a ponta (Playwright)

Verificam no navegador (computador, Android e iPhone emulados) que as páginas públicas abrem sem erro de JavaScript, que o
login mostra o formulário e trata a recusa do servidor, que link de avaliação inválido e rota inexistente têm tela própria e
que nenhuma delas rola para o lado no celular.

**Nada sai para a internet.** O site de teste é construído com o Supabase apontando para `https://e2e-supabase.invalid`
(endereço que não existe) e as respostas do servidor são simuladas nos próprios testes. Nenhum dado real é tocado.

```bash
cd e2e
npm install            # só na primeira vez (esta pasta tem o próprio package.json, isolado do app)
npx playwright install chromium   # só se o navegador ainda não existir
npm test               # constrói o site de teste, sobe em 127.0.0.1:4173 e roda os 24 testes
```

- Para testar um endereço já publicado (por exemplo uma prévia da Vercel): `E2E_BASE_URL=https://... npm test`.
- Chromium já instalado em outro lugar: `PW_CHROMIUM_PATH=/caminho/do/chromium npm test`.
- Falhas deixam capturas de tela e trace em `e2e/resultados/` (ignorado pelo git).

Não cobrem o app nativo (Capacitor) nem fluxos logados: esses exigem contas e dados fictícios próprios.
O iPhone aqui é só o tamanho de tela e o agente de usuário rodando no Chromium; não substitui o teste no Safari do aparelho.

Versão do `@playwright/test` fixada em 1.56.1 por combinar com o Chromium do ambiente de desenvolvimento; pode ser atualizada.
