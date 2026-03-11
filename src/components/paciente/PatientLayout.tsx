import { useAuth } from "@/contexts/AuthContext";
import { useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Activity,
  LayoutDashboard,
  Calendar,
  ClipboardCheck,
  Award,
  BookOpen,
  Watch,
  CreditCard,
  User,
  LogOut,
  Menu,
} from "lucide-react";

export type PatientSection =
  | "dashboard"
  | "agenda"
  | "questionarios"
  | "atividades"
  | "diario"
  | "dispositivo"
  | "planos"
  | "perfil";

const menuItems: { icon: any; text: string; section: PatientSection }[] = [
  { icon: LayoutDashboard, text: "Dashboard", section: "dashboard" },
  { icon: Calendar, text: "Minha Agenda", section: "agenda" },
  { icon: ClipboardCheck, text: "Questionários", section: "questionarios" },
  { icon: Award, text: "Atividades", section: "atividades" },
  { icon: BookOpen, text: "Diário de Saúde", section: "diario" },
  { icon: Watch, text: "Meu Dispositivo", section: "dispositivo" },
  { icon: CreditCard, text: "Planos", section: "planos" },
  { icon: User, text: "Perfil", section: "perfil" },
];

interface PatientLayoutProps {
  activeSection: PatientSection;
  onSectionChange: (section: PatientSection) => void;
  children: ReactNode;
}

export default function PatientLayout({ activeSection, onSectionChange, children }: PatientLayoutProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/paciente/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col sticky top-0 h-screen z-30">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8 cursor-pointer" onClick={() => onSectionChange("dashboard")}>
            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200/50">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-black text-slate-900 tracking-tight">Central ID</span>
          </div>
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.section}
                onClick={() => onSectionChange(item.section)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                  activeSection === item.section
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.text}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all text-left"
          >
            <LogOut className="h-5 w-5" />
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSectionChange("dashboard")}>
            <div className="h-7 w-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-black text-slate-900 tracking-tight">Central ID</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-20 px-2 py-1 flex justify-around">
          {menuItems.slice(0, 5).map((item) => (
            <button
              key={item.section}
              onClick={() => onSectionChange(item.section)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg text-[10px] font-bold transition-colors min-w-0",
                activeSection === item.section ? "text-indigo-600" : "text-slate-400"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate">{item.text.split(" ").pop()}</span>
            </button>
          ))}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg text-[10px] font-bold text-slate-400"
          >
            <Menu className="h-5 w-5" />
            <span>Mais</span>
          </button>
        </nav>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 lg:hidden" onClick={() => setIsSidebarOpen(false)}>
          <div className="w-72 h-full bg-white p-6 shadow-2xl animate-in slide-in-from-left duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-10 cursor-pointer" onClick={() => { onSectionChange("dashboard"); setIsSidebarOpen(false); }}>
              <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                <Activity className="h-5 w-5" />
              </div>
              <span className="text-xl font-black text-slate-900 tracking-tight">Central ID</span>
            </div>
            <nav className="space-y-2">
              {menuItems.map((item) => (
                <button
                  key={item.section}
                  onClick={() => { onSectionChange(item.section); setIsSidebarOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all",
                    activeSection === item.section
                      ? "bg-indigo-50 text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.text}
                </button>
              ))}
            </nav>
            <div className="absolute bottom-6 left-6 right-6 pt-6 border-t border-slate-100">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all text-left"
              >
                <LogOut className="h-5 w-5" />
                Sair da conta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
