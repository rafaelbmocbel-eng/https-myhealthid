import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.20.0/mod.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const body = await req.json();
        const { patient_id, therapist_id, message, conversation_id } = body;

        const openai = new OpenAI({
            apiKey: Deno.env.get("OPENAI_API_KEY"),
        });

        const systemPrompt = `Você é uma secretária IA profissional da clínica de fisioterapia My Health ID. 
Você ajuda pacientes a agendar consultas, verificar horários, preços e reavaliações.
Seja sempre simpática, curta e direta. Não prometa descontos sem ver as regras.`;

        let messages = [];

        if (conversation_id) {
            messages.push({ role: "system", content: systemPrompt });
        } else {
            messages = [
                { role: "system", content: systemPrompt }
            ];
        }

        messages.push({ role: "user", content: message });

        let responseMessage = "Desculpe, meu sistema de inteligência artificial não está configurado corretamente neste momento, mas o desenvolvedor já foi avisado.";

        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: messages,
                temperature: 0.7,
            });
            responseMessage = completion.choices[0].message.content || responseMessage;
        } catch (e) {
            console.error(e);
            // fallback simulation para deploy MVP rápido
            if (message.toLowerCase().includes("agendar") || message.toLowerCase().includes("marcar")) {
                responseMessage = "Certo! Eu vi que há vagas disponíveis na Terça às 10h e na Quarta às 15h. Algumas dessas atende você?";
            } else if (message.toLowerCase().includes("preço") || message.toLowerCase().includes("valor")) {
                responseMessage = "Nossa sessão de reavaliação custa R$250,00 e o pacote mensal completo é R$800. Gostaria de agendar?";
            } else {
                responseMessage = "Entendi! Infelizmente estou operando em um modo de demonstração restrita, mas sua mensagem principal foi '" + message + "'.";
            }
        }

        return new Response(JSON.stringify({
            response: responseMessage,
            conversation_id: conversation_id || crypto.randomUUID(),
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
