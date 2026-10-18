# Ajustes de CI do deploy do Supabase (para o Rafael aplicar à mão)

O ambiente do Claude não consegue enviar alterações em `.github/workflows` (o envio é recusado), então estes ajustes ficam aqui
para você aplicar pelo editor do GitHub (arquivo `.github/workflows/supabase-deploy.yml` → lápis → colar → Commit).

## 1. Token do Supabase inválido (acontece agora)

O deploy de 18/10/2026 (run #264) aplicou as migrações, mas o passo **Deploy edge functions** falhou com
`unexpected list functions status 401: Invalid access token`. Enquanto isso não for resolvido, nenhuma edge function nova é publicada
(a migração do módulo `aplicacoes` não depende disso).

Como resolver: Supabase → Account → Access Tokens → gerar um token novo → GitHub → Settings → Secrets and variables → Actions →
`SUPABASE_ACCESS_TOKEN` → Update secret. Nunca cole o token em conversa, issue ou commit.

## 2. Um deploy por vez (concorrência)

Logo abaixo do bloco `on:` acrescente:

```yaml
concurrency:
  group: supabase-deploy
  cancel-in-progress: false
```

Efeito: dois envios seguidos não rodam migrações ao mesmo tempo; o segundo espera o primeiro terminar (sem cancelar).

## 3. Funções publicadas uma a uma

Troque o passo "Deploy edge functions" por:

```yaml
      - name: Deploy edge functions (uma a uma)
        run: |
          falhas=0
          for dir in supabase/functions/*/; do
            nome=$(basename "$dir")
            [ -f "$dir/index.ts" ] || continue
            echo "Publicando $nome..."
            supabase functions deploy "$nome" --project-ref "zxulglbcxehqplxainmz" || { echo "FALHOU: $nome"; falhas=$((falhas+1)); }
          done
          echo "Funções com falha: $falhas"
          [ "$falhas" -eq 0 ]
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_ID: zxulglbcxehqplxainmz
```

Efeito: uma função com erro não impede as outras de serem publicadas, e o log diz qual falhou (o job ainda termina em falha se alguma
falhou, para você notar).

## 4. Observação (decisão sua)

O passo "Import data (psql)" reaplica todo `supabase/data/*.sql` a cada deploy. Hoje não altera nada (os `INSERT` retornam 0 linhas),
mas continua executando e usa o segredo `SUPABASE_DB_URL`. Se a migração do projeto antigo já foi encerrada, vale remover o passo.
