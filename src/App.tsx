import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense, forwardRef, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import PatientGuard from "./components/PatientGuard";
import ProtectedPatientRoute from "./components/paciente/ProtectedPatientRoute";
import ScrollToTop from "./components/ScrollToTop";
import RouteRestorer from "./components/RouteRestorer";
import GlobalBackButton from "./components/GlobalBackButton";

type LazyModule<T extends ComponentType<any>> = { default: T };

const reloadAfterInvalidLazyModule = () => {
  const key = "myhealthid.lazy-module-reload";
  const last = Number(window.sessionStorage.getItem(key) || 0);
  if (Date.now() - last < 30_000) return;
  window.sessionStorage.setItem(key, String(Date.now()));
  window.location.reload();
};

function LazyLoadRecovery() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

const safeLazy = <T extends ComponentType<any>>(loader: () => Promise<LazyModule<T>>) =>
  lazy(() => loader().then((mod) => {
    if (!mod?.default) {
      reloadAfterInvalidLazyModule();
      return { default: LazyLoadRecovery as T };
    }
    return mod;
  }));

// ALL pages lazy-loaded for optimal code-splitting
const Index = safeLazy(() => import("./pages/Index"));
const Auth = safeLazy(() => import("./pages/Auth"));
const MetodoIdentidade = safeLazy(() => import("./pages/MetodoIdentidade"));
const NotFound = safeLazy(() => import("./pages/NotFound"));
const MyIDResponder = safeLazy(() => import("./pages/MyIDResponder"));
const CobZero = safeLazy(() => import("./pages/CobZero"));

const Agenda = safeLazy(() => import("./pages/Agenda"));
const Pacientes = safeLazy(() => import("./pages/Pacientes"));
const PacientePerfil = safeLazy(() => import("./pages/PacientePerfil"));
const AvaliacaoPublica = safeLazy(() => import("./pages/AvaliacaoPublica"));
const AgendaPublica = safeLazy(() => import("./pages/AgendaPublica"));
const GestaoVendas = safeLazy(() => import("./pages/GestaoVendas"));
const Configuracoes = safeLazy(() => import("./pages/Configuracoes"));
const FunilPublico = safeLazy(() => import("./pages/FunilPublico"));
const Eventos = safeLazy(() => import("./pages/Eventos"));
const EventoPublico = safeLazy(() => import("./pages/EventoPublico"));
const CadastroCliente = safeLazy(() => import("./pages/CadastroCliente"));
import { AuthProvider } from "./contexts/AuthContext";
import { isAuthLockTimeoutError } from "./lib/authLock";

// Patient portal (lazy-loaded)
const PacienteLogin = safeLazy(() => import("./pages/paciente/PacienteLogin"));
const PortalGate = safeLazy(() => import("./pages/paciente/PortalGate"));
const PacienteDashboard = safeLazy(() => import("./pages/paciente/PacienteDashboard"));
const PacienteAgenda = safeLazy(() => import("./pages/paciente/PacienteAgenda"));
const PacienteQuestionarios = safeLazy(() => import("./pages/paciente/PacienteQuestionarios"));
const PacientePerfilPage = safeLazy(() => import("./pages/paciente/PacientePerfil"));
const PacienteDiario = safeLazy(() => import("./pages/paciente/PacienteDiario"));
const PacienteEvolucao = safeLazy(() => import("./pages/paciente/PacienteEvolucao"));
const PacienteExercicios = safeLazy(() => import("./pages/paciente/PacienteExercicios"));
const PacientePagamentos = safeLazy(() => import("./pages/paciente/PacientePagamentos"));
const PacienteSaude = safeLazy(() => import("./pages/paciente/PacienteSaude"));
const PacienteEventos = safeLazy(() => import("./pages/paciente/PacienteEventos"));
const PacienteChat = safeLazy(() => import("./pages/paciente/PacienteChat"));

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
                <Route path="/" element={<PatientGuard><Index /></PatientGuard>} />
                <Route path="/metodo-identidade" element={<PatientGuard><MetodoIdentidade /></PatientGuard>} />
                <Route path="/cob-zero" element={<PatientGuard><CobZero /></PatientGuard>} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/avaliacoes" element={<Navigate to="/pacientes" replace />} />
                <Route path="/studio-personal-id" element={<Navigate to="/pacientes" replace />} />
                <Route path="/agenda" element={<PatientGuard><Agenda /></PatientGuard>} />
                <Route path="/pacientes" element={<PatientGuard><Pacientes /></PatientGuard>} />
                <Route path="/pacientes/:id" element={<PatientGuard><PacientePerfil /></PatientGuard>} />
                <Route path="/protocolos" element={<Navigate to="/pacientes" replace />} />

                <Route path="/avaliacao/:token" element={<AvaliacaoPublica />} />
                <Route path="/agenda/:token" element={<AgendaPublica />} />
                <Route path="/myid/responder/:token" element={<MyIDResponder />} />
                <Route path="/funil/:slug" element={<FunilPublico />} />
                <Route path="/relatorios" element={<Navigate to="/pacientes" replace />} />
                <Route path="/crm" element={<Navigate to="/pacientes?tab=crm" replace />} />
                <Route path="/eventos" element={<PatientGuard><Eventos /></PatientGuard>} />
                <Route path="/evento/:eventoId" element={<EventoPublico />} />
                <Route path="/cadastro/:slug" element={<CadastroCliente />} />
                <Route path="/configuracoes" element={<PatientGuard><Configuracoes /></PatientGuard>} />

                {/* Patient Portal */}
                <Route path="/paciente/login" element={<PacienteLogin />} />
                <Route path="/portal/:token" element={<PortalGate />} />
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
