import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  /** Quando muda (ex: pathname), reseta o erro automaticamente */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * Error boundary do app profissional (Agenda, Pacientes, etc). Evita tela branca
 * capturando qualquer exceção de runtime/render. Detecta chunk-load errors e tenta
 * hard reload automaticamente (uma vez por janela de 30s). Para outros erros, mostra
 * fallback amigável com retry, recarregar e voltar para a agenda.
 *
 * Espelha o `PortalErrorBoundary` (mesma estratégia, já validada no portal do
 * paciente), mas com destino de "voltar para o início" apropriado ao profissional.
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[AppErrorBoundary]', error, info.componentStack);

    const msg = error.message || '';
    const isChunkError =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('ChunkLoadError') ||
      msg.includes('Loading chunk') ||
      msg.includes('Loading CSS chunk');

    if (isChunkError) {
      const flag = 'app-boundary-reload-at';
      const last = Number(sessionStorage.getItem(flag) ?? '0');
      if (Date.now() - last > 30_000) {
        sessionStorage.setItem(flag, String(Date.now()));
        window.location.reload();
      }
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  handleRetry = () => this.setState({ error: null });
  handleReload = () => window.location.reload();
  handleHome = () => { window.location.href = '/agenda'; };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 py-10">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="mx-auto h-14 w-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-foreground">Algo travou por aqui</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tivemos uma falha ao carregar essa tela. Seus dados estão seguros — é só tentar de novo.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={this.handleRetry} className="w-full gap-2">
              <RefreshCw className="h-4 w-4" /> Tentar de novo
            </Button>
            <Button variant="outline" onClick={this.handleReload} className="w-full gap-2">
              <RefreshCw className="h-4 w-4" /> Recarregar a página
            </Button>
            <Button variant="ghost" onClick={this.handleHome} className="w-full gap-2 text-muted-foreground">
              <Home className="h-4 w-4" /> Voltar para a agenda
            </Button>
          </div>
          {import.meta.env.DEV && (
            <pre className="text-[10px] text-left text-muted-foreground/70 bg-muted/30 rounded-lg p-3 mt-4 overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
