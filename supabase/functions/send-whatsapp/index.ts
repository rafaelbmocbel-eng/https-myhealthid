import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeZapiCreds(instanceId: string, token: string, clientToken?: string) {
  const rawInstance = String(instanceId || '').trim()
  const rawToken = String(token || '').trim()
  const rawClientToken = String(clientToken || '').trim()
  const combined = `${rawInstance} ${rawToken}`
  const match = combined.match(/instances\/([^/\s]+)\/token\/([^/\s]+)/i)

  return {
    instanceId: match?.[1] || rawInstance,
    token: match?.[2] || rawToken,
    clientToken: rawClientToken,
  }
}

async function getZapiCreds(req: Request, body: any) {
  // Always require an authenticated therapist
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) throw new Error('unauthorized')
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthorized')

  // Allow the "test connection" panel to send explicit credentials, but only
  // if the caller is an authenticated therapist.
  if (body.instanceId && body.token) {
    return normalizeZapiCreds(body.instanceId, body.token, body.clientToken)
  }

  const { data } = await supabase
    .from('config_clinica')
    .select('zapi_instance_id, zapi_token, zapi_client_token, zapi_ativo')
    .eq('terapeuta_id', user.id)
    .maybeSingle()
  if (data?.zapi_ativo && data.zapi_instance_id && data.zapi_token) {
    return normalizeZapiCreds(data.zapi_instance_id, data.zapi_token, data.zapi_client_token || '')
  }
  throw new Error('Credenciais Z-API do terapeuta não configuradas')
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { instanceId, token, clientToken } = await getZapiCreds(req, body)

    const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (clientToken) headers['Client-Token'] = clientToken

    // Modo TEST: só verifica status da conexão
    if (body.test) {
      const r = await fetch(`${baseUrl}/status`, { headers })
      const txt = await r.text()
      let parsed: any = {}
      try { parsed = JSON.parse(txt) } catch {}
      const connected = r.ok && (parsed.connected === true || parsed.smartphoneConnected === true)
      return new Response(
        JSON.stringify({ connected, status: parsed, raw: connected ? undefined : txt }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    // Modo SEND: envia mensagem (texto, imagem ou documento)
    const { phone, message, mediaUrl, mediaType, caption, fileName } = body
    if (!phone) throw new Error('Phone is required')
    const cleanPhone = String(phone).replace(/\D/g, '')

    let endpoint = 'send-text'
    let payload: any = { phone: cleanPhone, message }

    if (mediaUrl && mediaType === 'image') {
      endpoint = 'send-image'
      payload = { phone: cleanPhone, image: mediaUrl, caption: caption || '' }
    } else if (mediaUrl && mediaType === 'document') {
      endpoint = 'send-document/pdf'
      payload = { phone: cleanPhone, document: mediaUrl, fileName: fileName || 'documento.pdf', caption: caption || '' }
    } else if (!message) {
      throw new Error('Message or media is required')
    }

    const response = await fetch(`${baseUrl}/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Z-API Error [${response.status}]: ${errorText}`)
    }

    const result = await response.json()
    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error: any) {
    console.error('Erro Z-API:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error', connected: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
