
# MY HEALTH ID + Add-on Clínica — Sprint 0 (Dark-Launch)

Objetivo: preparar a fundação para multi-profissional **sem mudar absolutamente nada** no que você e a Aleteia veem hoje. Tudo fica "dormindo" até o dono ativar o add-on.

---

## Princípio de segurança

- Nenhuma tela atual muda de lugar, cor ou comportamento.
- Toda a lógica nova só "acorda" se `clinicas.ativa = true` para aquele dono.
- Quem não tem clínica ativada continua sendo tratado como **solo** (modo atual, idêntico).
- Reversível: desativar o add-on devolve tudo ao estado solo.

---

## O que será criado no banco (4 tabelas novas, todas vazias no início)

```text
clinicas
 ├── id, dono_user_id (FK auth), nome, ativa (bool, default false)
 ├── limite_profissionais (default 20)
 └── timestamps

clinica_membros          → quem trabalha na clínica
 ├── clinica_id, user_id, papel ('dono' | 'profissional' | 'recepcao')
 ├── status ('convidado' | 'ativo' | 'removido')
 ├── comissao_percentual (numeric, opcional)
 └── convidado_em, aceito_em

clinica_convites         → convites pendentes (por e-mail OU usuário existente)
 ├── clinica_id, email, papel, token, expira_em, status

clinica_pacientes_lixeira → pacientes "apagados" recuperáveis (soft delete)
 ├── paciente_id, clinica_id, apagado_por, apagado_em, expira_em (30d)
```

E **2 colunas opcionais** (nullable, default NULL) em tabelas existentes:

- `pacientes.clinica_id` → NULL = paciente solo (igual hoje)
- `agendamentos.clinica_id` → NULL = solo
- `controle_sessoes.profissional_user_id` → quem realizou (já vai usar `terapeuta_id` como fallback)

> NULL em todas essas colunas = comportamento atual 100% preservado.

---

## Matriz de permissões (quando o add-on for ativado)

| Ação | Dono | Profissional convidado | Recepção |
|---|---|---|---|
| Ver caixa total da clínica | ✅ | ❌ | ✅ (só leitura) |
| Ver financeiro próprio + comissão | ✅ | ✅ | ❌ |
| Vender, parcelar, registrar pagamento | ✅ | ✅ | ✅ |
| Editar **preços de serviços** | ✅ | ❌ | ❌ |
| Editar **configurações da clínica** (logo, Z-API, dados, integrações) | ✅ | ❌ | ❌ |
| **Convidar/remover** profissionais | ✅ | ❌ | ❌ |
| **Apagar paciente** | ✅ (soft delete + lixeira 30d) | ❌ | ❌ |
| **Restaurar** paciente da lixeira | ✅ | ❌ | ❌ |
| Editar prontuário, MyID, agenda dos próprios pacientes | ✅ | ✅ | ❌ |
| Acessar pacientes de outros profissionais | ✅ | ❌ (só os atribuídos) | ✅ (só agendar) |

Tudo isso é validado por **RLS no banco** (usando uma função `has_clinica_role(user_id, clinica_id, papel)`), então nem por API direta dá pra burlar.

---

## O que NÃO entra na Sprint 0 (fica para Sprint 1+)

- Telas de "Equipe da Clínica", convites, painel do dono
- Caixa unificado, repasse, comissões automáticas
- Split de pagamento Asaas
- White-label por clínica

A Sprint 0 só prepara o terreno. **Você não verá nada novo na UI.**

---

## Detalhes técnicos

- **Soft delete de pacientes:** vira `pacientes.ativo = false` + linha em `clinica_pacientes_lixeira` com `expira_em = now() + 30 days`. Só some de verdade após 30 dias (job de limpeza).
- **Comissão:** `clinica_membros.comissao_percentual` define o % que vai aparecer no extrato pessoal do profissional (campo informativo na Sprint 0, cálculo real na Sprint 1).
- **RLS nova função:**
  ```sql
  has_clinica_role(_user uuid, _clinica uuid, _papel text) → boolean
  ```
  Usada em todas as policies novas, segue o padrão Security Definer já adotado no projeto.
- **Migração de dados:** zero. Nenhuma linha existente é tocada. `clinica_id` fica NULL em tudo.
- **Flag de feature:** `clinicas.ativa = false` por padrão. Front lê isso uma vez no login e só renderiza UI extra se `true`.

---

## Entregáveis da Sprint 0

1. Migration criando as 4 tabelas + 3 colunas nullable + função `has_clinica_role` + RLS.
2. Hook `useClinicaContext()` que retorna `{ clinica, papel, permissoes }` ou `null` (modo solo).
3. Componente `<ClinicaGuard requires="dono">` (só renderiza filhos se permissão bater) — fica criado mas **não é usado em nenhuma tela ainda**.
4. Memória `mem://arquitetura/multi-profissional-clinica` com a matriz de permissões.

Depois disso aprovado, partimos pra **Sprint 1: tela de ativação do add-on + convites + painel do dono**, sem mexer em mais nada do app atual.

---

Confirma esse escopo da Sprint 0 que eu já abro a migration?
