---
name: Multi-profissional Clínica (Add-on)
description: Add-on opcional MY HEALTH ID Clínica. Solo é o default; clinica_id NULL = modo atual. Papéis dono/profissional/recepção com matriz de permissões.
type: feature
---

# MY HEALTH ID — Add-on Clínica

App tem 2 modos:
- **Solo** (default): tudo como sempre foi. `clinica_id IS NULL` em pacientes/agendamentos.
- **Clínica** (add-on): dono ativa em `clinicas.ativa = true`, convida até 20 profissionais.

## Tabelas
- `clinicas` (dono_user_id, ativa, limite_profissionais=20)
- `clinica_membros` (papel: dono|profissional|recepcao, status, comissao_percentual)
- `clinica_convites` (token + e-mail, expira em 14d)
- `clinica_pacientes_lixeira` (soft delete recuperável por 30d)
- Colunas nullable adicionadas: `pacientes.clinica_id`, `agendamentos.clinica_id`, `controle_sessoes.profissional_user_id`

## Funções RLS
- `has_clinica_role(user, clinica, papel?)` — Security Definer, evita recursão
- `is_clinica_dono(user, clinica)`

## Matriz de Permissões
| Ação | Dono | Profissional | Recepção |
|---|---|---|---|
| Caixa total | ✅ | ❌ | ✅ leitura |
| Financeiro próprio + comissão | ✅ | ✅ | ❌ |
| Vender/parcelar | ✅ | ✅ | ✅ |
| Editar preços | ✅ | ❌ | ❌ |
| Editar config clínica (logo, Z-API) | ✅ | ❌ | ❌ |
| Convidar/remover profissionais | ✅ | ❌ | ❌ |
| Apagar paciente (soft delete 30d) | ✅ | ❌ | ❌ |
| Restaurar paciente da lixeira | ✅ | ❌ | ❌ |

## Frontend
- `useClinicaContext()` retorna `{ contexto, isSolo, loading }`. `isSolo=true` → comportamento atual.
- `<ClinicaGuard requires="dono">` esconde UI condicional. Não usar em telas existentes até Sprint 1.

## Princípio
Nada na UI atual deve mudar enquanto `clinicas.ativa` for false para o usuário. Sprint 0 só prepara fundação.
