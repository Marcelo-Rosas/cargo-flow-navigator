import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { AppRole, useUserRole } from '@/hooks/useUserRole';

interface RoleGuardProps {
  allowedRoles: AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
  showLoadingState?: boolean;
}

export function RoleGuard({
  allowedRoles,
  children,
  fallback = null,
  showLoadingState = false,
}: RoleGuardProps) {
  const { role, isLoading } = useUserRole();

  if (isLoading) {
    if (!showLoadingState) return null;
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Carregando permissões...
      </div>
    );
  }

  if (!role || !allowedRoles.includes(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
