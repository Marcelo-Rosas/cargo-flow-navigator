import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Loader2 } from "lucide-react";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Commercial = lazy(() => import("./pages/Commercial"));
const Operations = lazy(() => import("./pages/Operations"));
const Documents = lazy(() => import("./pages/Documents"));
const Clients = lazy(() => import("./pages/Clients"));
const PriceTables = lazy(() => import("./pages/PriceTables"));
const Shippers = lazy(() => import("./pages/Shippers"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/comercial" element={<ProtectedRoute><Commercial /></ProtectedRoute>} />
              <Route path="/operacional" element={<ProtectedRoute><Operations /></ProtectedRoute>} />
              <Route path="/documentos" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
              <Route path="/clientes" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
              <Route path="/tabelas-preco" element={<ProtectedRoute><PriceTables /></ProtectedRoute>} />
              <Route path="/embarcadores" element={<ProtectedRoute><Shippers /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
