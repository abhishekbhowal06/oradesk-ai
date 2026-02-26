import { Suspense, lazy } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthProvider, RequireAuth } from '@/contexts/AuthContext';
import { ClinicProvider, useClinic } from '@/contexts/ClinicContext';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Leads = lazy(() => import('./pages/Leads'));
const Patients = lazy(() => import('./pages/Patients'));
const CallLogs = lazy(() => import('./pages/CallLogs'));
const Conversations = lazy(() => import('./pages/Conversations'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Login = lazy(() => import('./pages/Login'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const CampaignCreate = lazy(() => import('./pages/CampaignCreate'));
const Intelligence = lazy(() => import('./pages/Intelligence'));
const Agents = lazy(() => import('./pages/Intelligence')); // Mapping intelligence to agents temporarily
const Integrations = lazy(() => import('./pages/Integrations'));
const NotFound = lazy(() => import('./pages/NotFound'));
const ClinicChannels = lazy(() => import('./pages/ClinicChannels'));
const ClinicalCommandDashboard = lazy(() => import('./pages/ClinicalCommandDashboard'));

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

  // Bypass onboarding redirect completely
  // if (memberships.length === 0) {
  //   return <Navigate to="/onboarding" replace />;
  // }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        }
      />

      <Route
        path="/"
        element={
          <RequireAuth>
            <ClinicGuard>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </ClinicGuard>
          </RequireAuth>
        }
      />
      <Route
        path="/calendar"
        element={
          <RequireAuth>
            <ClinicGuard>
              <AppLayout>
                <Calendar />
              </AppLayout>
            </ClinicGuard>
          </RequireAuth>
        }
      />
      <Route
        path="/leads"
        element={
          <RequireAuth>
            <ClinicGuard>
              <AppLayout>
                <Leads />
              </AppLayout>
            </ClinicGuard>
          </RequireAuth>
        }
      />
      <Route
        path="/patients"
        element={
          <RequireAuth>
            <ClinicGuard>
              <AppLayout>
                <Patients />
              </AppLayout>
            </ClinicGuard>
          </RequireAuth>
        }
      />
      <Route
        path="/conversations"
        element={
          <RequireAuth>
            <ClinicGuard>
              <AppLayout>
                <Conversations />
              </AppLayout>
            </ClinicGuard>
          </RequireAuth>
        }
      />
      <Route
        path="/campaigns"
        element={
          <RequireAuth>
            <ClinicGuard>
              <AppLayout>
                <Campaigns />
              </AppLayout>
            </ClinicGuard>
          </RequireAuth>
        }
      />
      <Route
        path="/channels"
        element={
          <RequireAuth>
            <ClinicGuard>
              <AppLayout>
                <ClinicChannels />
              </AppLayout>
            </ClinicGuard>
          </RequireAuth>
        }
      />
      <Route
        path="/agents"
        element={
          <RequireAuth>
            <ClinicGuard>
              <AppLayout>
                <Agents />
              </AppLayout>
            </ClinicGuard>
          </RequireAuth>
        }
      />
      <Route
        path="/integrations"
        element={
          <RequireAuth>
            <ClinicGuard>
              <AppLayout>
                <Integrations />
              </AppLayout>
            </ClinicGuard>
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <ClinicGuard>
              <AppLayout>
                <Settings />
              </AppLayout>
            </ClinicGuard>
          </RequireAuth>
        }
      />
      <Route
        path="/tasks"
        element={
          <RequireAuth>
            <ClinicGuard>
              <AppLayout>
                <Tasks />
              </AppLayout>
            </ClinicGuard>
          </RequireAuth>
        }
      />
      <Route
        path="/campaigns"
        element={
          <RequireAuth>
            <ClinicGuard>
              <AppLayout>
                <Campaigns />
              </AppLayout>
            </ClinicGuard>
          </RequireAuth>
        }
      />
      <Route
        path="/campaigns/new"
        element={
          <RequireAuth>
            <ClinicGuard>
              <AppLayout>
                <CampaignCreate />
              </AppLayout>
            </ClinicGuard>
          </RequireAuth>
        }
      />
      <Route
        path="/intelligence"
        element={
          <RequireAuth>
            <ClinicGuard>
              <AppLayout>
                <ClinicalCommandDashboard />
              </AppLayout>
            </ClinicGuard>
          </RequireAuth>
        }
      />
      <Route
        path="/integrations"
        element={
          <RequireAuth>
            <ClinicGuard>
              <AppLayout>
                <Integrations />
              </AppLayout>
            </ClinicGuard>
          </RequireAuth>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <ClinicProvider>
              <Toaster />
              <Sonner />
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse flex flex-col items-center gap-2"><div className="h-4 w-4 rounded-full bg-primary mb-4" /><span>Loading OraDesk OS...</span></div></div>}>
                <AppRoutes />
              </Suspense>
            </ClinicProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
