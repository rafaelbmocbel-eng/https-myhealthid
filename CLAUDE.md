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
