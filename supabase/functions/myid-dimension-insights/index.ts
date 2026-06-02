import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const DIMENSION_LABELS: Record<string, { nome: string; descricao: string; foco: string }> = {
  D:   { nome: 'Dor (D)', descricao: 'Intensidade e características da dor relatada.', foco: 'Modulação da dor, educação em dor, neuromodulação, controle de gatilhos.' },
  EFI: { nome: 'Atividades do dia (EFI)', descricao: 'Impacto funcional em trabalho, casa, exercício, independência, vida social.', foco: 'Reabilitação ativa, progressão de carga, retorno funcional, exposição gradual.' },
  P:   { nome: 'Cabeça e emoções (P)', descricao: 'Crenças, medo de movimento, catastrofização, autoeficácia.', foco: 'Psicoeducação, exposição gradual, técnicas cognitivas, autoeficácia.' },
  I:   { nome: 'Mudanças recentes (I)', descricao: 'Gatilhos e mudanças que antecederam o quadro.', foco: 'Identificação e correção de gatilhos, ajuste de cargas e equipamentos.' },
  R:   { nome: 'Sono e energia (R)', descricao: 'Qualidade do sono, fadiga, estresse, ansiedade.', foco: 'Higiene do sono, regulação autonômica, respiração e relaxamento.' },
  C:   { nome: 'Vida pessoal (C)', descricao: 'Contexto social, familiar, financeiro.', foco: 'Manejo de estresse, rede de apoio, encaminhamento psicossocial.' },
  AF:  { nome: 'Movimento (AF)', descricao: 'Nível de atividade física e sedentarismo.', foco: 'Prescrição de atividade, pausas ativas, progressão gradual.' },
  HID: { nome: 'Hidratação (HID)', descricao: 'Ingestão hídrica e sinais de desidratação.', foco: 'Estratégias para aumentar e manter hidratação.' },
  NUT: { nome: 'Alimentação (NUT)', descricao: 'Qualidade nutricional, proteína, alimentos inflamatórios.', foco: 'Alimentação anti-inflamatória e suporte nutricional.' },
  ERG: { nome: 'Postura no dia (ERG)', descricao: 'Workspace, posição de dormir, hábitos posturais.', foco: 'Ajustes ergonômicos no trabalho, sono e atividades diárias.' },
  N:   { nome: 'Sinais do corpo (N)', descricao: 'Ruído sistêmico: viscerais, autonômicos, hormonais.', foco: 'Investigação adicional, encaminhamento, integração com saúde geral.' },
  MED: { nome: 'Medicação (MED)', descricao: 'Uso de medicações relevantes.', foco: 'Revisão de uso crônico, interação com tratamento.' },
};

const BLOCO_PREFIX_BY_DIM: Record<string, string[]> = {
  D:   ['bloco_2_'], EFI: ['bloco_3_'], P:   ['bloco_4_'], I:   ['bloco_1_'],
  R:   ['bloco_5a_', 'bloco_5b_', 'bloco_5c_'], C:   ['bloco_5c_'],
  AF:  ['bloco_5e_'], HID: ['bloco_5f_'], NUT: ['bloco_5g_'], ERG: ['bloco_5h_'],
  N:   ['bloco_6_'], MED: ['bloco_6_'],
};

// Áreas científicas (da evidence_library) relevantes por dimensão
const AREAS_BY_DIM: Record<string, string[]> = {
  D:   ['fisioterapia', 'medicina', 'psicologia', 'neurociencia'],
  EFI: ['fisioterapia', 'terapia_ocupacional', 'educacao_fisica'],
  P:   ['psicologia', 'neurociencia'],
  I:   ['fisioterapia', 'psicologia'],
  R:   ['medicina', 'psicologia', 'neurociencia'],
  C:   ['psicologia'],
  AF:  ['educacao_fisica', 'fisioterapia'],
  HID: ['nutricao', 'medicina'],
  NUT: ['nutricao'],
  ERG: ['fisioterapia', 'terapia_ocupacional'],
  N:   ['medicina'],
  MED: ['medicina'],
};

// Consultas científicas por dimensão (cobrindo técnicas baseadas em evidência típicas)
const QUERIES_BY_DIM: Record<string, string[]> = {
  D: [
    'chronic pain mindfulness based stress reduction MBSR',
    'pain neuroscience education chronic pain',
    'autonomic regulation diaphragmatic breathing chronic pain',
    'manual therapy and exercise for chronic musculoskeletal pain',
  ],
  EFI: [
    'graded exposure functional rehabilitation chronic pain',
    'return to work program musculoskeletal disability',
    'activity pacing chronic pain function',
  ],
  P: [
    'cognitive behavioral therapy chronic pain catastrophizing',
    'fear avoidance beliefs graded exposure',
    'self-efficacy intervention chronic pain',
  ],
  I: [
    'load management progressive overload injury risk',
    'ergonomic intervention musculoskeletal pain',
  ],
  R: [
    'sleep hygiene cognitive behavioral therapy insomnia',
    'mindfulness for sleep quality and anxiety',
    'autonomic regulation slow breathing heart rate variability',
  ],
  C: [
    'stress management psychosocial intervention chronic pain',
    'social support chronic illness outcomes',
  ],
  AF: [
    'physical activity prescription chronic pain meta-analysis',
    'aerobic exercise sedentary behavior health outcomes',
    'core stability exercise low back pain',
  ],
  HID: [
    'hydration musculoskeletal performance recovery',
    'fluid intake recommendations adults health',
  ],
  NUT: [
    'anti-inflammatory diet chronic pain',
    'protein intake recovery older adults',
    'mediterranean diet inflammation chronic disease',
  ],
  ERG: [
    'workstation ergonomic intervention neck back pain',
    'sleep posture mattress and musculoskeletal pain',
    'active microbreaks office workers musculoskeletal',
  ],
  N: [
    'autonomic dysfunction chronic pain assessment',
    'visceral referred pain musculoskeletal',
  ],
  MED: [
    'NSAID long term use chronic pain risks',
    'opioid sparing strategies chronic pain',
  ],
};

function filterRespostas(respostas: Record<string, any>, dimensao: string): Record<string, any> {
  const prefixes = BLOCO_PREFIX_BY_DIM[dimensao] || [];
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(respostas || {})) {
    if (prefixes.some(p => k.startsWith(p))) out[k] = v;
  }
  return out;
}

async function embed(text: string): Promise<number[] | null> {
  try {
    const r = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-embedding-001',
        input: text.slice(0, 8000),
        dimensions: 1536,
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.data?.[0]?.embedding ?? null;
  } catch { return null; }
}

type Evidence = {
  id: string; title: string; authors: string[] | null; journal: string | null;
  year: number | null; doi: string | null; url: string | null;
  evidence_level: string | null; similarity: number;
};

async function searchEvidence(supabase: any, dimensao: string): Promise<Evidence[]> {
  const queries = QUERIES_BY_DIM[dimensao] || [];
  const areas = AREAS_BY_DIM[dimensao] || null;
  const all: Record<string, Evidence> = {};
  for (const q of queries) {
    const emb = await embed(q);
    if (!emb) continue;
    const { data, error } = await supabase.rpc('match_evidence', {
      query_embedding: emb,
      match_count: 4,
      filter_areas: areas,
      min_year: 2010,
    });
    if (error || !data) continue;
    for (const row of data as Evidence[]) {
      if (!all[row.id] || all[row.id].similarity < row.similarity) all[row.id] = row;
    }
  }
  return Object.values(all)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 8);
}

function formatRefsForPrompt(refs: Evidence[]): string {
  return refs.map((r, i) => {
    const authors = (r.authors || []).slice(0, 2).join(', ') + ((r.authors?.length || 0) > 2 ? ' et al.' : '');
    return `[${i + 1}] ${r.title} — ${authors} (${r.journal || 's/journal'}, ${r.year || 's/d'})${r.evidence_level ? ` • Nível ${r.evidence_level}` : ''}${r.doi ? ` • DOI:${r.doi}` : ''}`;
  }).join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    const body = await req.json();
    const { dimensao, scoreValor, respostasBrutas, pacienteNome, queixaPrincipal } = body;

    if (!dimensao || !DIMENSION_LABELS[dimensao]) {
      return new Response(JSON.stringify({ error: 'dimensao inválida' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dimInfo = DIMENSION_LABELS[dimensao];
    const respostasFiltradas = filterRespostas(respostasBrutas || {}, dimensao);

    // 1) Buscar evidências reais no banco científico interno
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const evidencias = await searchEvidence(supabase, dimensao);
    const refsBlock = evidencias.length
      ? formatRefsForPrompt(evidencias)
      : '(nenhuma evidência indexada encontrada para esta dimensão — peça ao usuário para ampliar a base científica)';

    const prompt = `Você é um(a) clínico(a) experiente analisando uma dimensão do MyID v2.0 de uma paciente. Suas propostas DEVEM ser baseadas em evidência, ancoradas nas referências fornecidas. Não invente referências.

PACIENTE: ${pacienteNome || 'não informado'}
QUEIXA PRINCIPAL: ${queixaPrincipal || 'não informada'}

DIMENSÃO ANALISADA: ${dimInfo.nome}
Descrição: ${dimInfo.descricao}
Foco terapêutico típico: ${dimInfo.foco}
Score nesta dimensão: ${scoreValor != null ? Number(scoreValor).toFixed(1) : 'não informado'} / 10

RESPOSTAS DA PACIENTE NESTA DIMENSÃO:
${JSON.stringify(respostasFiltradas, null, 2)}

EVIDÊNCIAS CIENTÍFICAS DISPONÍVEIS NO BANCO INTERNO (use APENAS estas como base — cite pelo número):
${refsBlock}

Sua tarefa:
1. Interprete em linguagem clínica concisa o que estas respostas revelam.
2. Liste 3 a 5 INSIGHTS DE POSSIBILIDADES — técnicas e intervenções CONCRETAS baseadas em evidência (ex.: mindfulness MBSR para dor crônica, respiração diafragmática lenta para regulação autonômica, educação em neurociência da dor, TCC para catastrofização, exposição gradual, exercício aeróbio, dieta mediterrânea, higiene do sono, etc.).
3. Cada insight DEVE citar 1+ referências usando [n] dos números acima. Se nenhuma evidência se aplica, sinalize "evidencia: sem suporte indexado".
4. Sugira como integrar à diretriz de tratamento ativa.

Retorne JSON estrito (sem markdown, sem \`\`\`):
{
  "interpretacao": "string (2-4 frases clínicas)",
  "achados": ["string", "string"],
  "insights": [
    {
      "titulo": "string curto e técnico (ex: 'Mindfulness MBSR para dor crônica')",
      "acao": "ação concreta para o terapeuta propor (dose, frequência, duração)",
      "evidencia": "resumo do racional + citações [n][n]",
      "refs": [1, 3],
      "prazo": "imediato | curto prazo | médio prazo",
      "profissional": "fisio | medico | psi | nutri | edf | to"
    }
  ],
  "integracao_diretriz": "string (1-2 frases)"
}`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um(a) clínico(a) baseado em evidência. SEMPRE responda JSON válido, sem markdown. NUNCA invente referências — use apenas as fornecidas, citando por [n].' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`AI Gateway error ${aiRes.status}: ${txt}`);
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content || '{}';
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    let parsed: any = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = { interpretacao: cleaned, insights: [] }; }

    // Anexar as referências completas para a UI exibir
    const referencias = evidencias.map((r, i) => ({
      n: i + 1,
      id: r.id,
      title: r.title,
      authors: r.authors,
      journal: r.journal,
      year: r.year,
      doi: r.doi,
      url: r.url || (r.doi ? `https://doi.org/${r.doi}` : null),
      evidence_level: r.evidence_level,
    }));

    return new Response(JSON.stringify({
      ok: true,
      dimensao,
      respostas: respostasFiltradas,
      referencias,
      ...parsed,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
