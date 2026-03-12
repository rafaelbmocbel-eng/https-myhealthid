import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import MyIDResponder from "./pages/MyIDResponder";
import MetodoIdentidade from "./pages/MetodoIdentidade";
import CobZero from "./pages/CobZero";
import StudioPersonalID from "./pages/StudioPersonalID";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import PatientLogin from "./pages/paciente/PatientLogin";
import PatientRegister from "./pages/paciente/PatientRegister";
import PatientPortalAccess from "./pages/paciente/PatientPortalAccess";
import PatientDashboard from "./pages/paciente/PatientDashboard";
import PatientAgenda from "./pages/paciente/PatientAgenda";
import PatientBooking from "./pages/paciente/PatientBooking";
import PatientFinanceiro from "./pages/paciente/PatientFinanceiro";
import PatientQuestionnaires from "./pages/paciente/PatientQuestionnaires";
import PatientTests from "./pages/paciente/PatientTests";
import PatientActivities from "./pages/paciente/PatientActivities";
import PatientDiary from "./pages/paciente/PatientDiary";
import PatientWearable from "./pages/paciente/PatientWearable";
import PatientPlans from "./pages/paciente/PatientPlans";
import PatientProfileSettings from "./pages/paciente/PatientProfileSettings";
import ProfessionalHub from "./pages/ProfessionalHub";
import Agenda from "./pages/Agenda";
import Pacientes from "./pages/Pacientes";
import PacientePerfil from "./pages/PacientePerfil";
import Protocolos from "./pages/Protocolos";
import AvaliacaoPublica from "./pages/AvaliacaoPublica";
import AgendaPublica from "./pages/AgendaPublica";
import Relatorios from "./pages/Relatorios";
import GestaoVendas from "./pages/GestaoVendas";
import Configuracoes from "./pages/Configuracoes";
import FunilChat from "./pages/FunilChat";
import { AuthProvider } from "./contexts/AuthContext";

import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/paciente/login" element={<PatientLogin />} />
            <Route path="/paciente/cadastro" element={<PatientRegister />} />
            <Route path="/avaliacao/:token" element={<AvaliacaoPublica />} />
            <Route path="/agenda/:token" element={<AgendaPublica />} />
            <Route path="/myid/responder/:token" element={<MyIDResponder />} />
            <Route path="/funil/:slug" element={<FunilChat />} />
            <Route path="/portal/:token" element={<PatientPortalAccess />} />

            {/* Professional Protected Routes */}
            <Route path="/" element={<ProtectedRoute requiredRole="professional"><Index /></ProtectedRoute>} />
            <Route path="/metodo-identidade" element={<ProtectedRoute requiredRole="professional"><MetodoIdentidade /></ProtectedRoute>} />
            <Route path="/cob-zero" element={<ProtectedRoute requiredRole="professional"><CobZero /></ProtectedRoute>} />
            <Route path="/studio-personal-id" element={<ProtectedRoute requiredRole="professional"><StudioPersonalID /></ProtectedRoute>} />
            <Route path="/hub-paciente" element={<ProtectedRoute requiredRole="professional"><ProfessionalHub /></ProtectedRoute>} />
            <Route path="/agenda" element={<ProtectedRoute requiredRole="professional"><Agenda /></ProtectedRoute>} />
            <Route path="/pacientes" element={<ProtectedRoute requiredRole="professional"><Pacientes /></ProtectedRoute>} />
            <Route path="/pacientes/:id" element={<ProtectedRoute requiredRole="professional"><PacientePerfil /></ProtectedRoute>} />
            <Route path="/protocolos" element={<ProtectedRoute requiredRole="professional"><Protocolos /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute requiredRole="professional"><Relatorios /></ProtectedRoute>} />
            <Route path="/crm" element={<ProtectedRoute requiredRole="professional"><GestaoVendas /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute requiredRole="professional"><Configuracoes /></ProtectedRoute>} />

            {/* Patient Protected Routes */}
            <Route path="/paciente/dashboard" element={<ProtectedRoute requiredRole="patient"><PatientDashboard /></ProtectedRoute>} />
            <Route path="/paciente/agenda" element={<ProtectedRoute requiredRole="patient"><PatientAgenda /></ProtectedRoute>} />
            <Route path="/paciente/agendar" element={<ProtectedRoute requiredRole="patient"><PatientBooking /></ProtectedRoute>} />
            <Route path="/paciente/financeiro" element={<ProtectedRoute requiredRole="patient"><PatientFinanceiro /></ProtectedRoute>} />
            <Route path="/paciente/questionarios" element={<ProtectedRoute requiredRole="patient"><PatientQuestionnaires /></ProtectedRoute>} />
            <Route path="/paciente/avaliacoes" element={<ProtectedRoute requiredRole="patient"><PatientTests /></ProtectedRoute>} />
            <Route path="/paciente/atividades" element={<ProtectedRoute requiredRole="patient"><PatientActivities /></ProtectedRoute>} />
            <Route path="/paciente/diario" element={<ProtectedRoute requiredRole="patient"><PatientDiary /></ProtectedRoute>} />
            <Route path="/paciente/dispositivo" element={<ProtectedRoute requiredRole="patient"><PatientWearable /></ProtectedRoute>} />
            <Route path="/paciente/planos" element={<ProtectedRoute requiredRole="patient"><PatientPlans /></ProtectedRoute>} />
            <Route path="/paciente/perfil" element={<ProtectedRoute requiredRole="patient"><PatientProfileSettings /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes >
        </AuthProvider >
      </BrowserRouter >
    </TooltipProvider >
  </QueryClientProvider >
);

export default App;
