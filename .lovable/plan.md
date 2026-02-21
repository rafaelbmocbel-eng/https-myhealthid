

## Plano de Melhorias: Agenda e Configuracoes

### 1. Botao "Ir para Agenda" nas Configuracoes
Adicionar um botao no topo da pagina de Configuracoes que navega diretamente para `/agenda`.

### 2. Capacidade por Horario (vagas simultaneas)
Adicionar um novo campo `vagas_por_horario` na tabela `config_agenda` (default: 1). Isso permite que o terapeuta defina quantos pacientes podem agendar no mesmo horario. A logica de exibicao de slots na agenda publica usara esse valor para verificar se ainda ha vagas disponiveis.

### 3. Horarios 06:00 - 20:00
O codigo ja usa `startHour = 6` e `endHour = 20` (linhas 184-185 de Agenda.tsx). O default da tabela `config_agenda` sera atualizado de `08:00/18:00` para `06:00/20:00` para novos usuarios.

### 4. Data de Nascimento Digitavel
Trocar o `<Input type="date">` por um campo de texto com mascara `dd/mm/aaaa` que permite digitar livremente a data. Ao perder foco, converte para formato ISO para salvar no banco.

### 5. Drag-and-Drop na Agenda (mover agendamentos)
Implementar arrastar e soltar nos blocos de agendamento na visualizacao dia/semana:
- Ao iniciar o arrasto (mousedown/touchstart), capturar o agendamento.
- Ao mover, calcular o novo horario baseado na posicao do mouse relativa ao grid.
- Ao soltar, atualizar `data_inicio` e `data_fim` mantendo a duracao original.
- Feedback visual com sombra e opacidade durante o arrasto.

---

### Detalhes Tecnicos

**Migracao SQL:**
```sql
ALTER TABLE config_agenda 
  ADD COLUMN IF NOT EXISTS vagas_por_horario integer NOT NULL DEFAULT 1;

ALTER TABLE config_agenda 
  ALTER COLUMN horario_inicio SET DEFAULT '06:00:00',
  ALTER COLUMN horario_fim SET DEFAULT '20:00:00';
```

**Arquivos a modificar:**

1. **`src/pages/Configuracoes.tsx`**
   - Adicionar botao "Abrir Agenda" no topo (Link para `/agenda`)
   - Adicionar campo "Vagas por horario" (input numerico, min 1, max 10)

2. **`src/hooks/useAgenda.ts`**
   - Adicionar `vagas_por_horario` ao tipo `ConfigAgenda`

3. **`src/pages/Agenda.tsx`**
   - Implementar drag-and-drop nos blocos de agendamento (mousedown -> mousemove -> mouseup)
   - Usar estado para rastrear o agendamento sendo arrastado e sua posicao
   - Ao soltar, chamar `updateAgendamento` com os novos horarios
   - Considerar `vagas_por_horario` ao exibir agendamentos lado a lado no mesmo slot

4. **`src/pages/Pacientes.tsx`**
   - Substituir `<Input type="date">` do campo data_nascimento por um campo texto com placeholder `dd/mm/aaaa` e conversao automatica

5. **`src/pages/AgendaPublica.tsx`**
   - Usar `vagas_por_horario` para permitir multiplas reservas no mesmo slot (slot so fica indisponivel quando atingir o limite)

