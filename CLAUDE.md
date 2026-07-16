# Claude Code — instruções para este repositório

## Branch de trabalho
**Trabalhe sempre direto na branch `main`.**

- Faça checkout em `main` antes de qualquer mudança
- Commite e faça push para `main` ao terminar cada tarefa
- Não crie branches de feature a menos que o usuário peça explicitamente
- Isso garante que o deploy automático (Vercel/Netlify) publique as mudanças imediatamente

```bash
git checkout main
git pull origin main
# ... faça as mudanças ...
git push origin main
```

## Stack
- React 18 + TypeScript + Vite 5
- shadcn/ui + Tailwind CSS
- Supabase (PostgreSQL + Auth)
- TanStack React Query
- Capacitor 8 (app híbrido iOS/Android)

## Regras importantes
- **Nunca** chame hooks React (`useState`, `useEffect`, `useQuery`, etc.) após um early return condicional
- **Nunca** use `// @ts-ignore` — use `// @ts-expect-error -- <motivo>`
- Blocos `catch {}` vazios devem ter comentário explicativo
- Expressões ternárias como statement devem ser convertidas para `if/else`
- Não adicione comentários óbvios — só comente o "porquê" quando não for evidente

## Deploy
O site `www.myhealthid.com.br` faz deploy automático a partir da branch `main`.
Push na `main` = mudanças visíveis no site em ~1-3 minutos.

## Produto — fluxo do cliente e tiers
A especificação do fluxo de entrada do cliente e das regras free vs premium
está em `docs/fluxo-cliente-e-tiers.md` — **leia antes de mexer no portal do
cliente** e não altere o fluxo sem decisão explícita do Rafael. Resumo: ordem
MyID → histórico clínico (gera achados para revisão do profissional → Avatar)
→ contar o caso (opcional); free recebe só dicas de IA; premium tem avatar
montado por profissional, questionários baseados em evidência e planos que
NÃO substituem profissional (planos elaborados pedem acompanhamento presencial).
