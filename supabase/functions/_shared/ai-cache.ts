// Helper de cache para respostas de IA.
// Dois modos:
//  1) getDeterministic(fn, inputsHash): bate hash exato — devolve resposta cacheada se houver.
//  2) getSemantic(fn, prompt, embedding, minSim): busca por similaridade (≥minSim).
// Em ambos os casos, salvar via save(fn, hash, payload, embedding?).

export async function getCachedDeterministic(
  admin: any,
  functionName: string,
  inputsHash: string,
): Promise<any | null> {
  try {
    const { data } = await admin
      .from("ai_response_cache")
      .select("id, response_payload, hit_count")
      .eq("function_name", functionName)
      .eq("prompt_hash", inputsHash)
      .maybeSingle();
    if (data?.response_payload) {
      // hit count + timestamp (fire-and-forget) — conta as chamadas de IA evitadas.
      admin
        .from("ai_response_cache")
        .update({ hit_count: (Number((data as any).hit_count) || 0) + 1, last_hit_at: new Date().toISOString() })
        .eq("id", data.id)
        .then(() => {})
        .catch(() => {});
      return data.response_payload;
    }
  } catch (e) {
    console.warn("[ai-cache] get error:", e);
  }
  return null;
}

export async function getCachedSemantic(
  admin: any,
  functionName: string,
  queryEmbedding: number[],
  minSim = 0.92,
): Promise<any | null> {
  try {
    const { data } = await admin.rpc("match_ai_cache", {
      p_function_name: functionName,
      p_query_embedding: queryEmbedding,
      p_min_similarity: minSim,
    });
    if (Array.isArray(data) && data.length > 0) return data[0].response_payload;
  } catch (e) {
    console.warn("[ai-cache] semantic get error:", e);
  }
  return null;
}

export async function saveCache(
  admin: any,
  functionName: string,
  inputsHash: string,
  payload: unknown,
  model?: string,
  queryEmbedding?: number[] | null,
): Promise<void> {
  try {
    await admin.from("ai_response_cache").upsert({
      function_name: functionName,
      prompt_hash: inputsHash,
      response_payload: payload,
      model_used: model ?? null,
      query_embedding: queryEmbedding ?? null,
      hit_count: 0,
      last_hit_at: new Date().toISOString(),
    }, { onConflict: "function_name,prompt_hash" });
  } catch (e) {
    console.warn("[ai-cache] save error:", e);
  }
}

// Hash determinístico (mesma string em qualquer ambiente). Não-criptográfico.
export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}
