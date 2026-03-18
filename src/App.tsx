import { Suspense, lazy } from 'react';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/hooks/useAuth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

// Lazy routes (code-splitting)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Commercial = lazy(() => import('./pages/Commercial'));
const Operations = lazy(() => import('./pages/Operations'));
const Documents = lazy(() => import('./pages/Documents'));
const Clients = lazy(() => import('./pages/Clients'));
const Shippers = lazy(() => import('./pages/Shippers'));
const Vehicles = lazy(() => import('./pages/Vehicles'));
const PriceTables = lazy(() => import('./pages/PriceTables'));
const Financial = lazy(() => import('./pages/Financial'));
const Reports = lazy(() => import('./pages/Reports'));
const Approvals = lazy(() => import('./pages/Approvals'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const Auth = lazy(() => import('./pages/Auth'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const InsuranceMonitoringDashboard = lazy(() =>
  import('./pages/InsuranceMonitoringDashboard').then((m) => ({
    default: m.InsuranceMonitoringDashboard,
  }))
);
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />

        <BrowserRouter>
          <Suspense fallback={<div style={{ padding: 16 }}>Carregando…</div>}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/comercial"
                element={
                  <ProtectedRoute requiredRoles={['admin', 'financeiro', 'operacional']}>
                    <Commercial />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/operacional"
                element={
                  <ProtectedRoute requiredRoles={['admin', 'financeiro', 'operacional']}>
                    <Operations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documentos"
                element={
                  <ProtectedRoute>
                    <Documents />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clientes"
                element={
                  <ProtectedRoute>
                    <Clients />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/embarcadores"
                element={
                  <ProtectedRoute>
                    <Shippers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/proprietarios"
                element={
                  <ProtectedRoute>
                    <Navigate to="/veiculos?tab=proprietarios" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/motoristas"
                element={
                  <ProtectedRoute>
                    <Navigate to="/veiculos?tab=motoristas" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/veiculos"
                element={
                  <ProtectedRoute>
                    <Vehicles />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tabelas-preco"
                element={
                  <ProtectedRoute requiredRoles={['admin', 'operacional', 'financeiro']}>
                    <PriceTables />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/financeiro"
                element={
                  <ProtectedRoute requiredRoles={['admin', 'financeiro', 'operacional']}>
                    <Financial />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/relatorios"
                element={
                  <ProtectedRoute>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/aprovacoes"
                element={
                  <ProtectedRoute requiredRoles={['admin', 'financeiro']}>
                    <Approvals />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/usuarios"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <UserManagement />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/monitoramento-seguros"
                element={
                  <ProtectedRoute requiredRoles={['admin', 'financeiro', 'operacional']}>
                    <InsuranceMonitoringDashboard />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
