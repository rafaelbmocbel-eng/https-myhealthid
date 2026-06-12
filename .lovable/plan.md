# Ecossistema de Inteligência Clínica Unificado

Transformar MyID, Avaliação Presencial e Avatar Anatômico em um único fluxo conectado, onde dados subjetivos (questionário) e objetivos (exame físico + IA) convergem para um mapa visual rastreável no corpo humano.

## Arquitetura do Fluxo

```text
[Paciente em casa]              [Consultório com terapeuta]              [Banco / Histórico]
┌──────────────┐                ┌──────────────────────────┐             ┌──────────────────┐
│   MyID v2.0  │  ───drivers──▶ │ Avaliação Presencial     │ ──salvar──▶ │ eventos_clinicos │
│ (Scanner     │                │ (Voz/Texto + IA Filtro)  │             │   _anatomicos    │
│  Subjetivo)  │                │                          │             │                  │
└──────┬───────┘                │  ┌────────────────────┐  │             │ + origem:        │
       │                        │  │  Avatar Espelho    │  │             │   myid /         │
       │ scores D/AF/C/...      │  │  ┌──────────────┐  │  │             │   exame_clinico /│
       └──auto-marca regiões──▶ │  │  │ Mapeamento   │  │  │             │   voz_ia         │
                                │  │  │ visual com   │  │  │             │                  │
       relato de voz ──IA──────▶│  │  │ cores por    │  │  │             │                  │
                                │  │  │ severidade   │  │  │             │                  │
                                │  │  └──────────────┘  │  │             │                  │
                                │  └────────────────────┘  │             │                  │
                                └──────────────────────────┘             └──────────────────┘
```

## O que será construído

### 1. Motor de Inferência MyID → Avatar (`myidToAvatar`)
Um único utilitário que traduz scores do MyID em regiões pré-marcadas no avatar com **severidade derivada do score**, não mais marcação chapada de 5/10.

| Score MyID | Regra de mapeamento |
|---|---|
| **D (Dor) ≥ 5** | Marca regiões mencionadas no campo `pain_location` do MyID; se vazio, marca regiões genéricas (cervical + lombar) |
| **EFI ≥ 6** | Marca articulações de carga (joelhos, lombar, ombros) |
| **AF ≥ 6** (inativo) | Marca lombar + gluteos + coxas (sedentarismo) |
| **R ≥ 7** (regulação ruim) | Marca cabeça/cerebro (sono/estresse somatiza) |
| **C ≥ 6** (contexto adverso) | Marca trapezio + cervical (tensão muscular psicossomática) |
| **ERG ≥ 6** | Marca cervical + lombar + trapezio (postura) |
| **N (Ruído) ≥ 3** | Marca regiões de cicatrizes/cirurgias relatadas |

**Severidade calculada** = `min(10, score_dimensao * 1.2)` para garantir intensidade real do avatar (verde→amarelo→laranja→vermelho).

### 2. Motor de Inferência Voz/Texto → Avatar (já parcialmente existe)
Reforçar `mapeamentoSintomas.ts` com:
- Termos clínicos mais ricos (Spurling, Lasegue, Phalen, Tinel, ATM, etc.)
- Detecção de lateralidade ("direito/esquerdo")
- Detecção de irradiação ("irradia para...")
- Cruzamento: se IA detecta termo + MyID tem score alto naquela dimensão → marca como **achado crítico** (severidade +1)

### 3. UI Unificada na Avaliação Presencial
- Header novo: **"Inteligência Cruzada"** mostrando 3 fontes ativas (MyID ✓, Voz ✓, Manual)
- Botão **"Sincronizar MyID"** já existe — refinar para usar o novo motor de inferência por severidade
- Legenda visual no Avatar: cor = severidade, ícone pequeno = origem (📋 MyID, 🎤 Voz, ✋ Manual)
- Ao salvar, cada região vira `eventos_clinicos_anatomicos` com `origem` correto

### 4. Cards de Convergência
Quando uma região é marcada por MyID **E** Voz **E** Manual → highlight especial "🎯 Achado triangulado" no card de relatório, indicando alta confiança clínica.

### 5. Persistência e Rastreabilidade
Cada evento anatômico salvo inclui no `metadata`:
```json
{
  "fontes": ["myid", "voz_ia", "manual"],
  "myid_dimensao_origem": "D",
  "myid_score_origem": 7.5,
  "termos_voz": ["dor lombar", "irradiação"],
  "confianca": "alta|media|baixa"
}
```

## Detalhes técnicos

**Arquivos a criar/editar:**
- `src/utils/anatomia/myidToAvatar.ts` (novo) — motor de inferência por severidade
- `src/utils/anatomia/mapeamentoSintomas.ts` — adicionar termos clínicos + lateralidade
- `src/components/presencial/AvaliacaoPresencial.tsx` — usar novo motor, header "Inteligência Cruzada", merge multi-fonte
- `src/components/presencial/Body3DAvatar.tsx` — adicionar mini-ícone de origem por região
- `src/components/avatar/AvatarClinicoCard.tsx` — destacar achados triangulados
- `src/hooks/useEventosAnatomicos.ts` — adicionar campo `metadata.fontes`

**Sem mudança de schema** — `eventos_clinicos_anatomicos.metadata` já é JSONB e absorve o novo formato.

**Sem novos endpoints** — toda a inferência roda client-side a partir de dados já buscados (MyID + voz).
