import { ReactNode } from 'react';
import { useUserRole, AppRole } from '@/hooks/useUserRole';

interface RoleGuardProps {
  allowedRoles: AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGuard({ allowedRoles, children, fallback = null }: RoleGuardProps) {
  const { hasRole, isLoading } = useUserRole();

  if (isLoading) return null;

  if (!hasRole(allowedRoles)) return <>{fallback}</>;

  return <>{children}</>;
}
