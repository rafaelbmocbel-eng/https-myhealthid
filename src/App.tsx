import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense, forwardRef } from "react";
import PatientGuard from "./components/PatientGuard";
import ProtectedPatientRoute from "./components/paciente/ProtectedPatientRoute";
import PortalErrorBoundary from "./components/paciente/PortalErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import RouteRestorer from "./components/RouteRestorer";
import GlobalBackButton from "./components/GlobalBackButton";
import { lazyWithRetry } from "./lib/lazyWithRetry";

// ALL pages lazy-loaded for optimal code-splitting
const Index = lazy(() => import("./pages/Index"));
const LandingPublica = lazy(() => import("./pages/LandingPublica"));
const DemoMyID = lazy(() => import("./pages/DemoMyID"));
const Auth = lazy(() => import("./pages/Auth"));
const MetodoIdentidade = lazy(() => import("./pages/MetodoIdentidade"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MyIDResponder = lazy(() => import("./pages/MyIDResponder"));
const MyIDView = lazy(() => import("./pages/MyIDView"));
const CobZero = lazy(() => import("./pages/CobZero"));
const DashboardPreview = lazy(() => import("./pages/DashboardPreview"));

const Agenda = lazy(() => import("./pages/Agenda"));
const Pacientes = lazy(() => import("./pages/Pacientes"));
const PacientePerfil = lazy(() => import("./pages/PacientePerfil"));
const AvaliacaoPublica = lazy(() => import("./pages/AvaliacaoPublica"));
const AgendaPublica = lazy(() => import("./pages/AgendaPublica"));
const GestaoVendas = lazy(() => import("./pages/GestaoVendas"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const CrmHub = lazy(() => import("./pages/CrmHub"));
const CrmInbox = lazy(() => import("./pages/CrmInbox"));
const WhatsappAutomacoes = lazy(() => import("./pages/WhatsappAutomacoes"));
const CrmPipeline = lazy(() => import("./pages/CrmPipeline"));
const CrmCadencias = lazy(() => import("./pages/CrmCadencias"));
const CrmMetricas = lazy(() => import("./pages/CrmMetricas"));
const FunilPublico = lazy(() => import("./pages/FunilPublico"));
const Eventos = lazy(() => import("./pages/Eventos"));
const EventoPublico = lazy(() => import("./pages/EventoPublico"));
const CadastroCliente = lazy(() => import("./pages/CadastroCliente"));
const CompletarCadastro = lazy(() => import("./pages/CompletarCadastro"));
const Precos = lazy(() => import("./pages/Precos"));
const RecuperarSenha = lazy(() => import("./pages/RecuperarSenha"));
const NovaSenha = lazy(() => import("./pages/NovaSenha"));
const BaseCientifica = lazy(() => import("./pages/BaseCientifica"));
const Hoje = lazy(() => import("./pages/Hoje"));
const Pendencias = lazy(() => import("./pages/Pendencias"));
import { AuthProvider } from "./contexts/AuthContext";
import { isAuthLockTimeoutError } from "./lib/authLock";
import { Loader2 } from "lucide-react";

// Patient portal (lazy + retry para tolerar chunk-load errors / deploys)
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
const WellnessCadastro = lazy(() => import("./pages/WellnessCadastro"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache padrão: 30s "fresh" + 5min em memória → navegação instantânea entre páginas.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        if (isAuthLockTimeoutError(error)) return failureCount < 5;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex, error) => {
        if (isAuthLockTimeoutError(error)) {
          return Math.min(500 * 2 ** (attemptIndex - 1), 5000);
        }
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

// Prefetch de rotas mais usadas em idle, para navegação instantânea.
if (typeof window !== "undefined") {
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => void };
  const idle = (cb: () => void) =>
    typeof w.requestIdleCallback === "function" ? w.requestIdleCallback(cb) : window.setTimeout(cb, 1500);
  idle(() => {
    void import("./pages/Agenda");
    void import("./pages/Pacientes");
    void import("./pages/PacientePerfil");
    void import("./components/AppLayout");
  });
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <AuthProvider>
            <RouteRestorer />
            <GlobalBackButton />
            <Suspense fallback={<LazyFallback />}>
              <Routes>
                <Route path="/" element={<LandingPublica />} />
                <Route path="/inicio-app" element={<PatientGuard><Index /></PatientGuard>} />
                <Route path="/index" element={<Navigate to="/inicio-app" replace />} />
                <Route path="/inicio" element={<Navigate to="/inicio-app" replace />} />
                <Route path="/metodo-identidade" element={<PatientGuard><MetodoIdentidade /></PatientGuard>} />
                <Route path="/cob-zero" element={<PatientGuard><CobZero /></PatientGuard>} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/recuperar-senha" element={<RecuperarSenha />} />
                <Route path="/nova-senha" element={<NovaSenha />} />
                <Route path="/precos" element={<Precos />} />
                <Route path="/demo" element={<DemoMyID />} />
                <Route path="/avaliacoes" element={<Navigate to="/pacientes" replace />} />
                <Route path="/studio-personal-id" element={<Navigate to="/pacientes" replace />} />
                <Route path="/agenda" element={<PatientGuard><Agenda /></PatientGuard>} />
                <Route path="/hoje" element={<PatientGuard><Hoje /></PatientGuard>} />
                <Route path="/pacientes" element={<PatientGuard><Pacientes /></PatientGuard>} />
                <Route path="/pendencias" element={<PatientGuard><Pendencias /></PatientGuard>} />
                <Route path="/pacientes/:id" element={<PatientGuard><PacientePerfil /></PatientGuard>} />
                <Route path="/protocolos" element={<Navigate to="/pacientes" replace />} />

                <Route path="/avaliacao/:token" element={<AvaliacaoPublica />} />
                <Route path="/agenda/:token" element={<AgendaPublica />} />
                <Route path="/myid/responder/:token" element={<MyIDResponder />} />
                <Route path="/myid/ver/:token" element={<MyIDView />} />
                <Route path="/funil/:slug" element={<FunilPublico />} />
                <Route path="/relatorios" element={<Navigate to="/pacientes" replace />} />
                
                <Route path="/crm" element={<PatientGuard><CrmHub /></PatientGuard>} />
                <Route path="/crm/inbox" element={<Navigate to="/crm?tab=inbox" replace />} />
                <Route path="/crm/automacoes" element={<Navigate to="/crm?tab=automacoes" replace />} />
                <Route path="/crm/pipeline" element={<Navigate to="/crm?tab=pipeline" replace />} />
                <Route path="/crm/cadencias" element={<Navigate to="/crm?tab=cadencias" replace />} />
                <Route path="/crm/metricas" element={<Navigate to="/crm?tab=metricas" replace />} />
                <Route path="/crm/trafego" element={<Navigate to="/crm?tab=trafego" replace />} />
                <Route path="/eventos" element={<PatientGuard><Eventos /></PatientGuard>} />
                <Route path="/evento/:eventoId" element={<EventoPublico />} />
                <Route path="/cadastro/:slug" element={<CadastroCliente />} />
                <Route path="/portal/completar/:token" element={<CompletarCadastro />} />
                <Route path="/configuracoes" element={<PatientGuard><Configuracoes /></PatientGuard>} />
                <Route path="/financeiro" element={<Navigate to="/pacientes?tab=financeiro" replace />} />
                <Route path="/base-cientifica" element={<PatientGuard><BaseCientifica /></PatientGuard>} />

                {/* Patient Portal */}
                <Route path="/paciente/login" element={<PacienteLogin />} />
                <Route path="/portal/:token" element={<PortalGate />} />
                <Route path="/paciente/completar-cadastro" element={<CompletarCadastroPortal />} />
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

                {/* Wellness public signup (freemium) */}
                <Route path="/wellness/cadastro" element={<WellnessCadastro />} />

                {/* Preview público do dashboard (mock, sem auth) */}
                <Route path="/preview/dashboard" element={<DashboardPreview />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
