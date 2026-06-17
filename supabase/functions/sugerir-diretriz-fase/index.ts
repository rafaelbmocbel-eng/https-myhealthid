import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireUser } from '../_shared/auth.ts';

interface Body {
  tipo: 'exercicios' | 'tecnicas';
  faseNumero: number;
  faseTitulo: string;
  objetivo: string;
  queixa?: string;
  jaSelecionados?: string[];
  driverMyID?: { label: string; key: string; score: number };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try { await requireUser(req); } catch (r) { return r as Response; }

  try {
    const body = (await req.json()) as Body;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const alvo = body.tipo === 'exercicios' ? 'exercícios terapêuticos' : 'técnicas/condutas manuais e educativas';
    const driver = body.driverMyID;
    const sys = `Você é um fisioterapeuta sênior. Sugira 5 ${alvo} BASEADOS EM EVIDÊNCIA para a fase clínica descrita. Use vocabulário clínico brasileiro. Cada item deve ter nível de evidência (A, B ou C) e uma justificativa curta (motivo) que cite explicitamente a EVIDÊNCIA CLÍNICA do paciente que motivou a escolha — não uma justificativa genérica de manual.${driver ? ` O paciente tem o domínio MyID "${driver.label}" (${driver.key}) como driver primário de sobrecarga (score ${driver.score}/10); priorize itens que atuem diretamente sobre esse domínio e mencione isso no motivo (ex.: "Indicado por: MyID ${driver.key}=${driver.score} (${driver.label}) — driver primário").` : ''}`;

    const user = `Fase ${body.faseNumero} — ${body.faseTitulo}
Objetivo: ${body.objetivo || 'não informado'}
Queixa principal: ${body.queixa || 'não informada'}
Já selecionados (não repetir): ${(body.jaSelecionados || []).join(', ') || 'nenhum'}
${driver ? `Driver MyID do paciente: ${driver.label} (${driver.key}) — score ${driver.score}/10, principal fator de sobrecarga identificado na última avaliação.` : ''}

Retorne ${body.tipo === 'exercicios' ? '5 exercícios' : '5 técnicas'} adequados a esta fase.`;

    const toolName = body.tipo === 'exercicios' ? 'sugerir_exercicios' : 'sugerir_tecnicas';
    const itemSchema = body.tipo === 'exercicios'
      ? {
          type: 'object',
          properties: {
            nome: { type: 'string' },
            categoria: { type: 'string', description: 'mobilidade, fortalecimento, controle motor, propriocepção, cardio, etc.' },
            series: { type: 'string' },
            repeticoes: { type: 'string' },
            duracao: { type: 'string' },
            nivel_evidencia: { type: 'string', enum: ['A', 'B', 'C'] },
            motivo: { type: 'string', description: 'Justificativa rastreável (1-2 frases). Se houver driver MyID, citar a dimensão e o score, ex.: "Indicado por: MyID D=4 (Dor) — driver primário".' },
          },
          required: ['nome', 'categoria', 'series', 'repeticoes', 'nivel_evidencia', 'motivo'],
        }
      : {
          type: 'object',
          properties: {
            nome: { type: 'string' },
            categoria: { type: 'string' },
            duracao: { type: 'string' },
            frequencia: { type: 'string' },
            nivel_evidencia: { type: 'string', enum: ['A', 'B', 'C'] },
            motivo: { type: 'string', description: 'Justificativa rastreável (1-2 frases). Se houver driver MyID, citar a dimensão e o score, ex.: "Indicado por: MyID R=8 (Regulação) — driver primário".' },
          },
          required: ['nome', 'categoria', 'nivel_evidencia', 'motivo'],
        };

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: toolName,
              description: `Retorna sugestões de ${alvo}`,
              parameters: {
                type: 'object',
                properties: { sugestoes: { type: 'array', items: itemSchema } },
                required: ['sugestoes'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: toolName } },
      }),
    });

    if (resp.status === 429) return new Response(JSON.stringify({ error: 'Limite de requisições atingido, tente novamente em instantes.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (resp.status === 402) return new Response(JSON.stringify({ error: 'Créditos da IA esgotados. Adicione créditos em Configurações.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!resp.ok) {
      const t = await resp.text();
      console.error('gateway error', resp.status, t);
      return new Response(JSON.stringify({ error: 'Erro na IA' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const json = await resp.json();
    const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : { sugestoes: [] };

    return new Response(JSON.stringify({ sugestoes: args.sugestoes || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'erro' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
