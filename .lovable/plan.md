## Objetivo

Criar uma **camada freemium "Wellness"** para não-pacientes: pessoa se cadastra por link público, responde o MyID, recebe acesso limitado ao app (1/3 da gamificação) e pode assinar um plano mensal para desbloquear o resto (exercícios, protocolos de ansiedade, gamificação completa e 1 avaliação/mês com profissional).

---

## Arquitetura geral

Reaproveitar o portal do paciente já existente, mas introduzir o conceito de **tipo de conta** (`free` / `premium`) e **gating por feature**. Um "wellness user" é um `paciente` com `tipo_conta='wellness_free'` e sem `terapeuta_id` vinculado a um cadastro pago — quando assina, vira `wellness_premium` e ganha um terapeuta atribuído (rotativo ou da clínica padrão).

```text
[Link público /wellness/cadastro]
        |
        v
[Cadastro: nome, email, senha] ----> cria auth.user + paciente(tipo='wellness_free')
        |
        v
[Responde MyID público]  --------> myid_avaliacoes vinculado ao paciente
        |
        v
[Dashboard Wellness]
   - 1/3 missões liberadas (badge "Free")
   - 2/3 missões com cadeado + CTA "Assinar"
   - exercícios: prévia (3 livres)
   - protocolo ansiedade: bloqueado
   - chat/avaliação: bloqueado
        |
        v
[Botão "Assinar Plano Wellness"]
        |
        v
[Paddle/Stripe checkout mensal]
        |
        v
[Webhook] -> assinaturas + atualiza paciente.tipo_conta='wellness_premium'
        |
        v
[Tudo desbloqueado + 1 sessão/mês com profissional]
```

---

## Etapa 1 — Banco de dados

### 1.1 Coluna `tipo_conta` em `pacientes`
```sql
ALTER TABLE pacientes ADD COLUMN tipo_conta text 
  DEFAULT 'clinico' 
  CHECK (tipo_conta IN ('clinico','wellness_free','wellness_premium'));
```
- `clinico`: pacientes atuais (default, mantém compatibilidade)
- `wellness_free`: cadastrou-se sozinho, fez MyID, acesso limitado
- `wellness_premium`: assinante mensal, acesso total

### 1.2 Tabela `wellness_assinaturas`
```sql
CREATE TABLE wellness_assinaturas (
  id uuid PK,
  paciente_id uuid FK -> pacientes,
  status text ('ativa','cancelada','inadimplente'),
  provider text ('paddle'|'stripe'),
  provider_subscription_id text,
  valor_mensal numeric,
  data_inicio, data_fim, proxima_cobranca,
  ultima_sessao_mensal_em timestamptz, -- controla a sessão grátis/mês
  created_at, updated_at
);
```
- RLS: paciente vê a própria; terapeutas/admin veem todas.

### 1.3 RPC `criar_paciente_wellness(nome, email, senha)`
Security Definer — cria paciente sem precisar de terapeuta vinculado (atribui terapeuta padrão da clínica). Retorna `paciente_id` + `portal_token`.

### 1.4 Função `has_wellness_access(paciente_id, feature)`
Retorna boolean. Regras:
- `myid` → todos
- `missoes_basicas` (1/3) → free + premium
- `missoes_avancadas`, `exercicios_full`, `protocolo_ansiedade`, `chat`, `consulta_mensal` → só premium

---

## Etapa 2 — Cadastro público

**Nova rota:** `/wellness/cadastro`
- Página simples: logo MH, headline "Descubra seu MyID grátis", form (nome, email, senha)
- Submit → chama RPC `criar_paciente_wellness` → loga o usuário → redireciona para `/wellness/myid` (responder MyID)
- LGPD: checkbox de consentimento (reaproveitar `termos_consentimento`)

**Nova rota:** `/wellness/myid` — variante do `MyIDResponder` que após concluir vai para `/paciente` (dashboard normal já funciona).

---

## Etapa 3 — Gating no portal do paciente

Criar hook `useWellnessAccess()`:
```ts
const { tipoConta, isPremium, isFree, hasFeature } = useWellnessAccess();
```

**Aplicar em:**
- `PacienteDashboard` — banner "Plano Wellness" se `isFree`
- `PacienteMetasDesafios` — exibir todas as missões; bloquear (overlay com cadeado + "Assinar") as que não estão na lista de missões básicas
- `PacienteExercicios` — mostrar só 3 exercícios se free; resto com overlay
- `PacienteChat`, página de "consulta mensal" — bloqueio total se free
- Adicionar componente `<LockedOverlay onClick={openCheckout} />` reutilizável

**Definição de "1/3 da gamificação"**: das missões geradas pelo MyID, liberar apenas as de prioridade `baixa` (ou as 1/3 com menor XP). Critério configurável em `src/utils/myid/buildAutoMissoes.ts`.

---

## Etapa 4 — Pagamento mensal

Recomendação: **Stripe** (assinatura recorrente, suporta cartão BR, mais simples que Paddle para SaaS B2C com poucas restrições).

1. Rodar `recommend_payment_provider` para confirmar
2. Habilitar Stripe via `enable_stripe_payments`
3. Criar produto "Plano Wellness MH" — recorrência mensal (preço a definir com o usuário, ex: R$ 49/mês)
4. Edge function `wellness-checkout` cria checkout session
5. Edge function `wellness-webhook` recebe `checkout.session.completed` e `invoice.paid` → upserta `wellness_assinaturas` + atualiza `paciente.tipo_conta='wellness_premium'`
6. `customer.subscription.deleted` → volta para `wellness_free`

---

## Etapa 5 — Consulta mensal (1×/mês)

- Botão "Agendar minha consulta do mês" só visível se `isPremium` E `ultima_sessao_mensal_em` é null OU > 30 dias atrás
- Reaproveita o fluxo de agendamento existente; ao confirmar, gravar `ultima_sessao_mensal_em = now()` na `wellness_assinaturas`
- Atribuir um terapeuta da clínica (config_clinica.terapeuta_wellness_default ou rotativo)

---

## Etapa 6 — Espelho do lado profissional

Seguindo a regra de espelhamento:
- Em `Pacientes.tsx`, badge "Wellness Free" / "Wellness Premium" no card do paciente
- Filtro novo: "Tipo de conta"
- Dashboard: KPI "Wellness ativos" + "MRR Wellness"

---

## Detalhes técnicos

- **Auth**: cadastro wellness usa `supabase.auth.signUp` com `raw_user_meta_data.is_patient=true` (já tratado no `handle_new_user`)
- **Atribuição de terapeuta**: nova config em `config_clinica` chamada `terapeuta_wellness_default uuid`. Sem isso, o cadastro falha com mensagem amigável "Wellness ainda não configurado por uma clínica"
- **RLS**: `pacientes` já tem RLS por `terapeuta_id`; o terapeuta padrão verá os wellness na sua lista
- **Reuso**: `MyIDResponder`, `PacienteLayout`, `PacienteDashboard`, fluxo de agendamento, missões — tudo reaproveitado, só com gating

---

## Decisões que preciso de você

1. **Preço do plano Wellness mensal?** (sugestão: R$ 49/mês)
2. **A consulta mensal premium é vídeo (link Meet/Zoom) ou presencial?** Influencia o fluxo de agendamento.
3. **Quem é o "terapeuta padrão" para wellness users?** O dono da conta atual, ou você quer adicionar um seletor em Configurações?
4. **Implementar tudo de uma vez ou em fatias?** Sugestão de faseamento:
   - **Fase A** (essencial, ~1 ciclo): coluna tipo_conta, cadastro público `/wellness/cadastro`, MyID público, dashboard com gating visual (cadeados sem checkout ainda)
   - **Fase B**: Stripe + assinatura + desbloqueio real
   - **Fase C**: consulta mensal + espelho profissional + KPIs

Confirma os 4 itens (ou só me diz "começa pela Fase A com defaults") que eu sigo.