import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ClipboardCopy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  /** Quando muda (ex: pathname), reseta o erro automaticamente */
  resetKey?: string;
}

interface State {
  error: Error | null;
  componentStack: string;
  copiado: boolean;
}

/**
 * Error boundary do portal do paciente. Evita tela branca capturando qualquer
 * exceção de runtime/render. Detecta chunk-load errors e tenta hard reload
 * automaticamente (uma vez por janela de 30s). Para outros erros, mostra
 * fallback amigável com retry, recarregar e voltar para o login.
 */
export default class PortalErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: '', copiado: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, componentStack: '', copiado: false };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[PortalErrorBoundary]', error, info.componentStack);
    this.setState({ componentStack: info.componentStack || '' });

    const msg = error.message || '';
    const isChunkError =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('ChunkLoadError') ||
      msg.includes('Loading chunk') ||
      msg.includes('Loading CSS chunk');

    if (isChunkError) {
      const flag = 'portal-boundary-reload-at';
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
  handleHome = () => { window.location.href = '/paciente/dashboard'; };

  handleCopiarErro = () => {
    const { error, componentStack } = this.state;
    if (!error) return;
    const detalhes = [
      `URL: ${window.location.href}`,
      `Quando: ${new Date().toLocaleString('pt-BR')}`,
      `Erro: ${error.message}`,
      error.stack ? `Stack: ${error.stack}` : '',
      componentStack ? `Componente: ${componentStack.trim()}` : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(detalhes).then(() => {
      this.setState({ copiado: true });
      setTimeout(() => this.setState({ copiado: false }), 2500);
    });
  };

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
              Tivemos uma falha ao carregar essa tela. Sua conta e seus dados estão seguros — é só tentar de novo.
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
              <Home className="h-4 w-4" /> Voltar para o início
            </Button>
          </div>

          {/* Detalhes técnicos sempre disponíveis (não só em DEV) — permite ao usuário
              copiar e nos enviar o erro exato em vez de só relatar "travou", o que
              torna o bug rastreável de fato na próxima vez que acontecer. */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={this.handleCopiarErro}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
            >
              {this.state.copiado ? (
                <><Check className="h-3.5 w-3.5" /> Copiado! Envie para o suporte.</>
              ) : (
                <><ClipboardCopy className="h-3.5 w-3.5" /> Copiar detalhes do erro</>
              )}
            </button>
            <pre className="text-[10px] text-left text-muted-foreground/70 bg-muted/30 rounded-lg p-3 overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
          </div>
        </div>
      </div>
    );
  }
}
