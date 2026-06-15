import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense, forwardRef } from "react";
import ProtectedPatientRoute from "./components/paciente/ProtectedPatientRoute";
import PortalErrorBoundary from "./components/paciente/PortalErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import { lazyWithRetry } from "./lib/lazyWithRetry";
import { AuthProvider } from "./contexts/AuthContext";
import { isAuthLockTimeoutError } from "./lib/authLock";
import { Loader2 } from "lucide-react";

// Páginas públicas (links compartilhados pelo profissional que o paciente recebe)
const AvaliacaoPublica = lazy(() => import("./pages/AvaliacaoPublica"));
const AgendaPublica = lazy(() => import("./pages/AgendaPublica"));
const MyIDResponder = lazy(() => import("./pages/MyIDResponder"));
const MyIDView = lazy(() => import("./pages/MyIDView"));
const FunilPublico = lazy(() => import("./pages/FunilPublico"));
const EventoPublico = lazy(() => import("./pages/EventoPublico"));
const CadastroCliente = lazy(() => import("./pages/CadastroCliente"));
const CompletarCadastro = lazy(() => import("./pages/CompletarCadastro"));
const RecuperarSenha = lazy(() => import("./pages/RecuperarSenha"));
const NovaSenha = lazy(() => import("./pages/NovaSenha"));
const WellnessCadastro = lazy(() => import("./pages/WellnessCadastro"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Portal do paciente
const PacienteLogin = lazyWithRetry(() => import("./pages/paciente/PacienteLogin"));
const PortalGate = lazyWithRetry(() => import("./pages/paciente/PortalGate"));
const PacienteDashboard = lazyWithRetry(() => import("./pages/paciente/PacienteDashboard"));
const PacienteAgenda = lazyWithRetry(() => import("./pages/paciente/PacienteAgenda"));
const PacienteQuestionarios = lazyWithRetry(() => import("./pages/paciente/PacienteQuestionarios"));
const CompletarCadastroPortal = lazyWithRetry(() => import("./pages/paciente/CompletarCadastroPortal"));
const PacientePerfilPage = lazyWithRetry(() => import("./pages/paciente/PacientePerfil"));
const PacienteDiario = lazyWithRetry(() => import("./pages/paciente/PacienteDiario"));
const PacienteEvolucao = lazyWithRetry(() => import("./pages/paciente/PacienteEvolucao"));
const PacienteExercicios = lazyWithRetry(() => import("./pages/paciente/PacienteExercicios"));
const PacientePagamentos = lazyWithRetry(() => import("./pages/paciente/PacientePagamentos"));
const PacienteSaude = lazyWithRetry(() => import("./pages/paciente/PacienteSaude"));
const PacienteEventos = lazyWithRetry(() => import("./pages/paciente/PacienteEventos"));
const PacienteChat = lazyWithRetry(() => import("./pages/paciente/PacienteChat"));
const PacientePlano = lazyWithRetry(() => import("./pages/paciente/PacientePlano"));
const PacienteHistoria = lazyWithRetry(() => import("./pages/paciente/PacienteHistoria"));
const PacienteRecompensas = lazyWithRetry(() => import("./pages/paciente/PacienteRecompensas"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        if (isAuthLockTimeoutError(error)) return failureCount < 5;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex, error) => {
        if (isAuthLockTimeoutError(error)) return Math.min(500 * 2 ** (attemptIndex - 1), 5000);
        return Math.min(1000 * attemptIndex, 3000);
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: (failureCount, error) => isAuthLockTimeoutError(error) && failureCount < 2,
      retryDelay: (attemptIndex) => Math.min(500 * 2 ** (attemptIndex - 1), 3000),
    },
  },
});

const LazyFallback = forwardRef<HTMLDivElement>((_props, ref) => (
  <div ref={ref} className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
));
LazyFallback.displayName = "LazyFallback";

// Prefetch em idle das rotas mais usadas pelo paciente
if (typeof window !== "undefined") {
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => void };
  const idle = (cb: () => void) =>
    typeof w.requestIdleCallback === "function" ? w.requestIdleCallback(cb) : window.setTimeout(cb, 1500);
  idle(() => {
    void import("./pages/paciente/PacienteDashboard");
    void import("./pages/paciente/PacienteAgenda");
    void import("./pages/paciente/PacienteDiario");
  });
}

const AppPaciente = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <AuthProvider>
            <Suspense fallback={<LazyFallback />}>
              <Routes>
                {/* Raiz → login do paciente */}
                <Route path="/" element={<Navigate to="/paciente/login" replace />} />

                {/* Auth */}
                <Route path="/recuperar-senha" element={<RecuperarSenha />} />
                <Route path="/nova-senha" element={<NovaSenha />} />

                {/* Páginas públicas acessadas via links enviados pelo profissional */}
                <Route path="/avaliacao/:token" element={<AvaliacaoPublica />} />
                <Route path="/agenda/:token" element={<AgendaPublica />} />
                <Route path="/myid/responder/:token" element={<MyIDResponder />} />
                <Route path="/myid/ver/:token" element={<MyIDView />} />
                <Route path="/funil/:slug" element={<FunilPublico />} />
                <Route path="/evento/:eventoId" element={<EventoPublico />} />
                <Route path="/cadastro/:slug" element={<CadastroCliente />} />
                <Route path="/portal/completar/:token" element={<CompletarCadastro />} />
                <Route path="/wellness/cadastro" element={<WellnessCadastro />} />

                {/* Portal do paciente */}
                <Route path="/paciente/login" element={<PortalErrorBoundary><PacienteLogin /></PortalErrorBoundary>} />
                <Route path="/portal/:token" element={<PortalErrorBoundary><PortalGate /></PortalErrorBoundary>} />
                <Route path="/paciente/completar-cadastro" element={<PortalErrorBoundary><CompletarCadastroPortal /></PortalErrorBoundary>} />
                <Route path="/paciente/dashboard" element={<ProtectedPatientRoute><PacienteDashboard /></ProtectedPatientRoute>} />
                <Route path="/paciente/diario" element={<ProtectedPatientRoute><PacienteDiario /></ProtectedPatientRoute>} />
                <Route path="/paciente/evolucao" element={<ProtectedPatientRoute><PacienteEvolucao /></ProtectedPatientRoute>} />
                <Route path="/paciente/exercicios" element={<ProtectedPatientRoute><PacienteExercicios /></ProtectedPatientRoute>} />
                <Route path="/paciente/agenda" element={<ProtectedPatientRoute><PacienteAgenda /></ProtectedPatientRoute>} />
                <Route path="/paciente/questionarios" element={<ProtectedPatientRoute><PacienteQuestionarios /></ProtectedPatientRoute>} />
                <Route path="/paciente/pagamentos" element={<ProtectedPatientRoute><PacientePagamentos /></ProtectedPatientRoute>} />
                <Route path="/paciente/saude" element={<ProtectedPatientRoute><PacienteSaude /></ProtectedPatientRoute>} />
                <Route path="/paciente/eventos" element={<ProtectedPatientRoute><PacienteEventos /></ProtectedPatientRoute>} />
                <Route path="/paciente/chat" element={<ProtectedPatientRoute><PacienteChat /></ProtectedPatientRoute>} />
                <Route path="/paciente/perfil" element={<ProtectedPatientRoute><PacientePerfilPage /></ProtectedPatientRoute>} />
                <Route path="/paciente/plano" element={<ProtectedPatientRoute><PacientePlano /></ProtectedPatientRoute>} />
                <Route path="/paciente/historia" element={<ProtectedPatientRoute><PacienteHistoria /></ProtectedPatientRoute>} />
                <Route path="/paciente/recompensas" element={<ProtectedPatientRoute><PacienteRecompensas /></ProtectedPatientRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default AppPaciente;
