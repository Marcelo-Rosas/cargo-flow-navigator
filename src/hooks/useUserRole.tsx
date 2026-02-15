import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';

export type AppRole = Database['public']['Enums']['app_role'];

export function useUserRole() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['user-role', user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AppRole | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase.rpc('get_user_role', { _user_id: user.id });
      if (!error && data) {
        return data as AppRole;
      }

      const { data: roleRow, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (roleError) throw roleError;
      return (roleRow?.role as AppRole | undefined) ?? null;
    },
  });

  const role = query.data ?? null;

  const capabilities = useMemo(() => {
    const isReadOnly = role === 'leitura';
    const canWrite = !!role && !isReadOnly;

    return {
      isReadOnly,
      canWrite,
      hasRole: (allowedRole: AppRole) => role === allowedRole,
      hasAnyRole: (allowedRoles: AppRole[]) => !!role && allowedRoles.includes(role),
    };
  }, [role]);

  return {
    role,
    ...capabilities,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
