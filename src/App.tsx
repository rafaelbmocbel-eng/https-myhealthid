import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import MetodoIdentidade from "./pages/MetodoIdentidade";
import CobZero from "./pages/CobZero";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Agenda from "./pages/Agenda";
import Pacientes from "./pages/Pacientes";
import Protocolos from "./pages/Protocolos";
import AvaliacaoPublica from "./pages/AvaliacaoPublica";
import Relatorios from "./pages/Relatorios";
import { AuthProvider } from "./contexts/AuthContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/metodo-identidade" element={<MetodoIdentidade />} />
            <Route path="/cob-zero" element={<CobZero />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/pacientes" element={<Pacientes />} />
            <Route path="/protocolos" element={<Protocolos />} />
            <Route path="/avaliacao/:token" element={<AvaliacaoPublica />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
