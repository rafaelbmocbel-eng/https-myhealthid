---
description: Fluxo padrão de edição e deploy do MyHealthID
---

## Fluxo Padrão de Mudanças

Sempre que o usuário pedir uma mudança no código, seguir OBRIGATORIAMENTE estes passos:

### 1. Editar o código
- Fazer todas as alterações necessárias nos arquivos do projeto
- Garantir que não há erros de sintaxe

### 2. Confirmar no localhost
- O servidor de desenvolvimento já está rodando em http://localhost:8080
- Avisar o usuário para verificar a mudança no navegador em http://localhost:8080
- Aguardar aprovação do usuário antes de continuar

### 3. Fazer git push (após aprovação)
// turbo
- Rodar o comando abaixo para enviar as mudanças ao GitHub:
```
powershell -Command "& 'C:\Program Files\Git\cmd\git.exe' add . ; & 'C:\Program Files\Git\cmd\git.exe' commit -m 'MENSAGEM_DA_MUDANÇA' ; & 'C:\Program Files\Git\cmd\git.exe' push"
```
- Substituir MENSAGEM_DA_MUDANÇA por uma descrição curta e clara do que foi alterado

### 4. Confirmar GitHub atualizado
- Verificar se o push foi bem-sucedido
- Informar o usuário que o GitHub foi atualizado ✅

### 5. Lembrar o usuário de sincronizar no Lovable
- Avisar: "Agora abra o Lovable e clique em **Sync from GitHub** para sincronizar lá também! ✅"
