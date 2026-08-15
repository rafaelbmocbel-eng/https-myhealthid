import { Component, ReactNode } from "react";

interface State { error: Error | null }

const CHUNK_PATTERNS = [
  /Cannot read properties of undefined \(reading 'default'\)/i,
  /undefined is not an object \(evaluating '.*\.default'\)/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk \d+ failed/i,
  /Loading CSS chunk/i,
  /ChunkLoadError/i,
];

const RELOAD_KEY = "myhealthid.root-boundary-reload";

/**
 * Recarrega limpando o service worker e os caches ANTES — senão o SW continua
 * servindo a versão velha do cache e o reload cai no mesmo erro (loop infinito
 * na tela "Recarregando…"). Limpar SW+caches garante que a versão nova carregue.
 */
async function limparCacheEReload() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
    }
  } catch { /* ignore */ }
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
    }
  } catch { /* ignore */ }
  // querystring anti-cache pra furar qualquer cache de HTTP também
  try {
    const u = new URL(window.location.href);
    u.searchParams.set("_v", String(Date.now()));
    window.location.replace(u.toString());
    return;
  } catch { /* ignore */ }
  window.location.reload();
}

/**
 * Captura erros de render (incluindo React.lazy resolvendo chunk stale após
 * deploy) e força UM reload limpando o cache, por janela de 30s. Sem a limpeza
 * do SW, a tela fica presa em "Recarregando…".
 */
export default class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    const msg = error?.message || "";
    const isChunk = CHUNK_PATTERNS.some((re) => re.test(msg));
    if (!isChunk) return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - last > 30_000) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        limparCacheEReload();
      }
    } catch { /* ignore */ }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Recarregando…</h1>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
            Detectamos uma versão desatualizada. Se a tela não atualizar sozinha, clique abaixo.
          </p>
          <button
            onClick={() => limparCacheEReload()}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
