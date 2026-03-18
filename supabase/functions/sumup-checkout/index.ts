import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUMUP_API_KEY = Deno.env.get('SUMUP_API_KEY');
    if (!SUMUP_API_KEY) {
      throw new Error('SUMUP_API_KEY is not configured');
    }

    const { amount, description, customer_email, customer_name, redirect_url, reference } = await req.json();

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Amount is required and must be positive' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create SumUp checkout
    const checkoutRes = await fetch('https://api.sumup.com/v0.1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUMUP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        checkout_reference: reference || crypto.randomUUID(),
        amount,
        currency: 'BRL',
        description: description || 'Pagamento',
        redirect_url: redirect_url || 'https://myhealthid.lovable.app',
        ...(customer_email && { customer_email }),
        ...(customer_name && { customer_name }),
      }),
    });

    const checkoutData = await checkoutRes.json();

    if (!checkoutRes.ok) {
      console.error('SumUp API error:', JSON.stringify(checkoutData));
      throw new Error(`SumUp API error [${checkoutRes.status}]: ${JSON.stringify(checkoutData)}`);
    }

    // Build the hosted checkout URL
    const checkoutUrl = `https://pay.sumup.com/b2c/Q${checkoutData.id}`;

    return new Response(JSON.stringify({
      checkout_id: checkoutData.id,
      checkout_url: checkoutUrl,
      amount: checkoutData.amount,
      status: checkoutData.status,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error creating SumUp checkout:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
