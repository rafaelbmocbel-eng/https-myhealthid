import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Configure CORS handles for browser requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: any) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { phone, message } = await req.json()

        if (!phone || !message) {
            throw new Error('Phone and message are required')
        }

        // Replace with Z-API environment variables from Supabase Secrets
        // e.g., supabase secrets set ZAPI_INSTANCE_ID=... ZAPI_TOKEN=...
        const instanceId = Deno.env.get('ZAPI_INSTANCE_ID')
        const token = Deno.env.get('ZAPI_TOKEN')

        if (!instanceId || !token) {
            throw new Error('Z-API credentials are not configured')
        }

        const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-messages`

        // Clean phone number (Z-API expects 55 + DDD + number)
        const cleanlyFormattedPhone = phone.replace(/\D/g, '')

        console.log(`Sending WhatsApp to ${cleanlyFormattedPhone}...`)

        const response = await fetch(zapiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phone: cleanlyFormattedPhone,
                message: message
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            try {
                const zapiError = JSON.parse(errorText)
                throw new Error(`Z-API Error: ${zapiError.error || errorText}`)
            } catch (e) {
                throw new Error(`Z-API Error [${response.status}]: ${errorText}`)
            }
        }

        const result = await response.json()

        return new Response(
            JSON.stringify({ success: true, result }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )

    } catch (error: any) {
        console.error('Error dispatching Z-API WhatsApp:', error)
        return new Response(
            JSON.stringify({ error: error.message || 'Internal error' }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            }
        )
    }
})
