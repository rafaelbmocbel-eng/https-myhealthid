import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
    children: ReactNode;
    requiredRole?: "admin" | "professional" | "patient";
}

const getMetadataRole = (role: unknown): "admin" | "professional" | "patient" | null => {
    if (role === "admin" || role === "professional" || role === "patient") return role;
    return null;
};

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
    const { user, profile, loading } = useAuth();
    const location = useLocation();

    // Use metadata role as a fallback while profile is potentially still loading or missing
    const resolvedRole = profile?.role ?? getMetadataRole(user?.user_metadata?.role);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!user) {
        const isPatientPath = location.pathname.startsWith("/paciente");
        return <Navigate to={isPatientPath ? "/paciente/login" : "/auth"} state={{ from: location }} replace />;
    }

    if (requiredRole && resolvedRole !== requiredRole) {
        // If we still don't have a resolved role but one is required, show the identity sync screen
        if (!resolvedRole) {
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-4" />
                    <p className="text-slate-600 font-black uppercase text-xs tracking-widest">Sincronizando Identidade...</p>
                    <p className="text-slate-400 text-[10px] mt-2 max-w-xs">Se este processo demorar mais de 10 segundos, tente atualizar a página.</p>
                </div>
            );
        }

        // Cross-redirection: if a patient tries to see professional content, go to their dashboard
        if (resolvedRole === "patient") {
            return <Navigate to="/paciente/dashboard" replace />;
        }

        // Professional can see patient content (for testing/admin purposes if needed) or neutral redirect
        if (resolvedRole === "professional" && requiredRole === "patient") {
            return <>{children}</>;
        }

        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};
