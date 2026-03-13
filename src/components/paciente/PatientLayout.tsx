import { useState, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import PatientSidebar from "./PatientSidebar";
import {
  Menu,
  X,
  Bell,
  Search,
  User,
  LifeBuoy,
  ShieldCheck,
  ArrowLeft,
  ChevronRight,
  LogOut,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate, useLocation } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export type PatientSection = "dashboard" | "agenda" | "questionarios" | "atividades" | "diario" | "dispositivo" | "planos" | "perfil";

interface PatientLayoutProps {
  children: ReactNode;
  activeSection?: PatientSection;
  onSectionChange?: (section: PatientSection) => void;
  showBackButton?: boolean;
}

const PatientLayout = ({ children, activeSection, onSectionChange, showBackButton = false }: PatientLayoutProps) => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Mapeamento de títulos baseado na rota
  const pageTitles: Record<string, string> = {
    "/paciente/dashboard": "Meu Painel",
    "/paciente/agenda": "Meus Agendamentos",
    "/paciente/financeiro": "Meu Financeiro",
    "/paciente/questionarios": "Meus Questionários",
    "/paciente/atividades": "Minhas Métricas",
    "/paciente/diario": "Diário Clínico",
    "/paciente/dispositivo": "Metricas de Dispositivos",
    "/paciente/planos": "Meus Planos de Cuidado",
    "/paciente/perfil": "Meus Dados",
  };

  const currentTitle = pageTitles[location.pathname] || "Minha Saúde";

  return (
    <div className="min-h-screen bg-slate-50/50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-72 sticky top-0 h-screen shrink-0">
        <PatientSidebar />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent side="left" className="p-0 w-72 border-none">
          <PatientSidebar onClose={() => setIsSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b px-4 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-5 w-5 text-slate-500" />
            </Button>

            {showBackButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="hidden sm:flex text-slate-500"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-slate-900 tracking-tight">{currentTitle}</h1>
                <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">Paciente</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Quick Actions Search */}
            <div className="hidden md:flex relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type="text"
                placeholder="Buscar no hub..."
                className="bg-slate-50 border-none rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:bg-white w-48 transition-all"
              />
            </div>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative group">
              <Bell className="h-5 w-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-indigo-600 rounded-full border-2 border-white animate-pulse" />
            </Button>

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1.5 rounded-full hover:bg-slate-50 transition-colors active:scale-95">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100 p-[1px]">
                    <div className="h-full w-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                      {profile?.nome ? (
                        <span className="text-xs font-black text-indigo-900">{profile.nome[0]}{profile.sobrenome?.[0] || ''}</span>
                      ) : (
                        <User className="h-4 w-4 text-indigo-600" />
                      )}
                    </div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-slate-100 shadow-2xl">
                <DropdownMenuLabel className="p-4">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Logado como</p>
                  <p className="font-bold text-slate-900">{profile?.nome} {profile?.sobrenome}</p>
                  <p className="text-[10px] text-slate-500 font-medium truncate">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/paciente/perfil")} className="rounded-xl p-3 font-bold text-slate-600 hover:text-indigo-600 focus:text-indigo-600 gap-3">
                  <Settings className="h-4 w-4" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl p-3 font-bold text-slate-600 hover:text-indigo-600 focus:text-indigo-600 gap-3">
                  <LifeBuoy className="h-4 w-4" /> Central de Ajuda
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="rounded-xl p-3 font-bold text-red-600 hover:text-red-700 focus:text-red-700 gap-3">
                  <LogOut className="h-4 w-4" /> Sair do Portal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content Wrap */}
        <div className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default PatientLayout;
