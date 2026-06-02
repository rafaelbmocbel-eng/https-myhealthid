import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const DIMENSION_LABELS: Record<string, { nome: string; descricao: string; foco: string }> = {
  D:   { nome: 'Dor (D)', descricao: 'Intensidade e características da dor relatada.', foco: 'Estratégias de modulação da dor, educação em dor, neuromodulação, controle de gatilhos.' },
  EFI: { nome: 'Atividades do dia (EFI)', descricao: 'Impacto funcional em trabalho, casa, exercício, independência, vida social.', foco: 'Reabilitação ativa, progressão de carga, retorno funcional, exposição gradual.' },
  P:   { nome: 'Cabeça e emoções (P)', descricao: 'Crenças, medo de movimento, catastrofização, autoeficácia.', foco: 'Psicoeducação, exposição gradual, técnicas cognitivas, fortalecimento da autoeficácia.' },
  I:   { nome: 'Mudanças recentes (I)', descricao: 'Gatilhos e mudanças que antecederam o quadro.', foco: 'Identificação e correção de gatilhos, ajuste de cargas e equipamentos.' },
  R:   { nome: 'Sono e energia (R)', descricao: 'Qualidade do sono, fadiga, estresse, ansiedade.', foco: 'Higiene do sono, regulação autonômica, técnicas de respiração e relaxamento.' },
  C:   { nome: 'Vida pessoal (C)', descricao: 'Contexto social, familiar, financeiro.', foco: 'Manejo de estresse, rede de apoio, encaminhamento psicossocial quando necessário.' },
  AF:  { nome: 'Movimento (AF)', descricao: 'Nível de atividade física e sedentarismo.', foco: 'Prescrição de atividade, pausas ativas, progressão gradual de volume.' },
  HID: { nome: 'Hidratação (HID)', descricao: 'Ingestão hídrica e sinais de desidratação.', foco: 'Estratégias práticas para aumentar e manter hidratação ao longo do dia.' },
  NUT: { nome: 'Alimentação (NUT)', descricao: 'Qualidade nutricional, proteína, alimentos inflamatórios.', foco: 'Recomendações alimentares anti-inflamatórias e suporte nutricional.' },
  ERG: { nome: 'Postura no dia (ERG)', descricao: 'Workspace, posição de dormir, hábitos posturais.', foco: 'Ajustes ergonômicos no trabalho, sono e atividades diárias.' },
  N:   { nome: 'Sinais do corpo (N)', descricao: 'Ruído sistêmico: viscerais, autonômicos, hormonais.', foco: 'Investigação adicional, encaminhamento, integração com saúde geral.' },
  MED: { nome: 'Medicação (MED)', descricao: 'Uso de medicações relevantes.', foco: 'Revisão de uso crônico, interação com tratamento, encaminhamento médico.' },
};

const BLOCO_PREFIX_BY_DIM: Record<string, string[]> = {
  D:   ['bloco_2_'],
  EFI: ['bloco_3_'],
  P:   ['bloco_4_'],
  I:   ['bloco_1_'],
  R:   ['bloco_5a_', 'bloco_5b_', 'bloco_5c_'],
  C:   ['bloco_5c_'],
  AF:  ['bloco_5e_'],
  HID: ['bloco_5f_'],
  NUT: ['bloco_5g_'],
  ERG: ['bloco_5h_'],
  N:   ['bloco_6_'],
  MED: ['bloco_6_'],
};

function filterRespostas(respostas: Record<string, any>, dimensao: string): Record<string, any> {
  const prefixes = BLOCO_PREFIX_BY_DIM[dimensao] || [];
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(respostas || {})) {
    if (prefixes.some(p => k.startsWith(p))) out[k] = v;
  }
  return out;
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

    const prompt = `Você é um(a) fisioterapeuta clínico(a) experiente analisando uma dimensão específica do questionário MyID v2.0 de uma paciente.

PACIENTE: ${pacienteNome || 'não informado'}
QUEIXA PRINCIPAL: ${queixaPrincipal || 'não informada'}

DIMENSÃO ANALISADA: ${dimInfo.nome}
Descrição: ${dimInfo.descricao}
Foco terapêutico típico: ${dimInfo.foco}
Score nesta dimensão: ${scoreValor != null ? Number(scoreValor).toFixed(1) : 'não informado'} / 10

RESPOSTAS DA PACIENTE NESTA DIMENSÃO:
${JSON.stringify(respostasFiltradas, null, 2)}

Sua tarefa:
1. Interprete em linguagem clínica concisa o que estas respostas revelam.
2. Liste de 3 a 5 INSIGHTS DE POSSIBILIDADES — propostas concretas e acionáveis de melhora para esta dimensão, baseadas em evidência.
3. Sugira como integrar essas propostas à diretriz de tratamento ativa.

Retorne JSON estrito no formato:
{
  "interpretacao": "string (2-4 frases clínicas)",
  "achados": ["string", "string"],
  "insights": [
    { "titulo": "string curto", "acao": "ação concreta para o terapeuta propor", "evidencia": "racional/evidência breve", "prazo": "imediato | curto prazo | médio prazo" }
  ],
  "integracao_diretriz": "string (1-2 frases) sobre como incorporar ao protocolo"
}`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um(a) fisioterapeuta experiente. Responda SEMPRE com JSON válido, sem markdown, sem ```.' },
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

    return new Response(JSON.stringify({ ok: true, dimensao, respostas: respostasFiltradas, ...parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
