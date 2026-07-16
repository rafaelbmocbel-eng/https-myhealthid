# Manual: como liberar domínios/rede no Claude Code (web)

> Para que serve: por padrão, as sessões do Claude Code na web rodam num
> ambiente isolado que pode **bloquear o acesso à internet** (foi por isso que
> o Claude não conseguiu testar o site www.myhealthid.com.br em produção).
> Este manual mostra como liberar.

## Onde fica a configuração

A política de rede NÃO é da conversa — é do **ambiente** (environment) em que a
sessão roda. Você configura uma vez e vale para as próximas sessões daquele
ambiente.

1. Acesse **claude.ai/code** no navegador
2. No menu lateral, abra **Environments** (Ambientes)
   - Se você nunca criou um, existe um ambiente padrão associado ao seu repositório
3. Clique no ambiente usado pelas suas sessões → **Settings** (Configurações)
4. Procure a seção **Network access** (Acesso à rede)

## As 3 opções de política de rede

| Opção | O que permite | Quando usar |
|---|---|---|
| **No network** | Nada de internet | Máxima segurança; o Claude só mexe no código |
| **Trusted network** | Lista de domínios confiáveis (npm, GitHub etc.) + os que você adicionar | **Recomendada** — é aqui que você libera seus domínios |
| **Full network** | Internet toda | Só se realmente precisar; menos seguro |

## Para liberar o site do My Health ID

1. Escolha **Trusted network**
2. No campo de domínios adicionais (allowlist), adicione:
   - `www.myhealthid.com.br`
   - `myhealthid.com.br`
   - `zxulglbcxehqplxainmz.supabase.co` (se quiser que o Claude teste o backend)
3. Salve

## Detalhes importantes

- **A mudança vale para sessões NOVAS.** Sessão que já está aberta continua com
  a política antiga — abra uma sessão nova depois de salvar.
- Cada ambiente tem a própria política: se você usa mais de um ambiente,
  configure em cada um.
- Mesmo com o domínio liberado, o Claude testa como **visitante** (sem login).
  Para testar áreas logadas, o caminho continua sendo mandar prints ou criar um
  usuário de teste.
- Documentação oficial (em inglês):
  https://code.claude.com/docs/en/claude-code-on-the-web

## Resumo de 10 segundos

**claude.ai/code → Environments → seu ambiente → Settings → Network access →
Trusted network → adicionar `www.myhealthid.com.br` → salvar → abrir sessão nova.**
