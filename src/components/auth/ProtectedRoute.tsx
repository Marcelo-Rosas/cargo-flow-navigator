import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole, type UserProfile } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: UserProfile[];
  fallback?: ReactNode;
}

export function ProtectedRoute({ children, requiredRoles, fallback }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { perfil, isLoading: roleLoading } = useUserRole();
  const location = useLocation();

  if (loading || (!!requiredRoles?.length && user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Save the attempted URL for redirecting after login
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requiredRoles?.length && (!perfil || !requiredRoles.includes(perfil))) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Acesso não autorizado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Seu perfil não possui permissão para acessar esta página.
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
