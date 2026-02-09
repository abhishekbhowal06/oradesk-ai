import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider, RequireAuth } from "@/contexts/AuthContext";
import { ClinicProvider, useClinic } from "@/contexts/ClinicContext";
import Dashboard from "./pages/Dashboard";
import Calendar from "./pages/Calendar";
import Patients from "./pages/Patients";
import CallLogs from "./pages/CallLogs";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Tasks from "./pages/Tasks";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function ClinicGuard({ children }: { children: React.ReactNode }) {
  const { memberships, isLoading } = useClinic();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (memberships.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/onboarding" element={
        <RequireAuth>
          <Onboarding />
        </RequireAuth>
      } />
      
      <Route path="/" element={
        <RequireAuth>
          <ClinicGuard>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ClinicGuard>
        </RequireAuth>
      } />
      <Route path="/calendar" element={
        <RequireAuth>
          <ClinicGuard>
            <AppLayout>
              <Calendar />
            </AppLayout>
          </ClinicGuard>
        </RequireAuth>
      } />
      <Route path="/patients" element={
        <RequireAuth>
          <ClinicGuard>
            <AppLayout>
              <Patients />
            </AppLayout>
          </ClinicGuard>
        </RequireAuth>
      } />
      <Route path="/calls" element={
        <RequireAuth>
          <ClinicGuard>
            <AppLayout>
              <CallLogs />
            </AppLayout>
          </ClinicGuard>
        </RequireAuth>
      } />
      <Route path="/analytics" element={
        <RequireAuth>
          <ClinicGuard>
            <AppLayout>
              <Analytics />
            </AppLayout>
          </ClinicGuard>
        </RequireAuth>
      } />
      <Route path="/settings" element={
        <RequireAuth>
          <ClinicGuard>
            <AppLayout>
              <Settings />
            </AppLayout>
          </ClinicGuard>
        </RequireAuth>
      } />
      <Route path="/tasks" element={
        <RequireAuth>
          <ClinicGuard>
            <AppLayout>
              <Tasks />
            </AppLayout>
          </ClinicGuard>
        </RequireAuth>
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <ClinicProvider>
            <Toaster />
            <Sonner />
            <AppRoutes />
          </ClinicProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
