import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';

export type UserProfile = Database['public']['Enums']['user_profile'];

export function useUserRole() {
  const { user } = useAuth();

  const profileQuery = useQuery({
    queryKey: ['user-profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('current_user_profile');
      if (error) throw error;
      return (data ?? null) as UserProfile | null;
    },
  });

  const perfil = profileQuery.data ?? null;

  const isAdmin = perfil === 'admin';
  const isOperacional = perfil === 'operacional';
  const isFinanceiro = perfil === 'financeiro';

  const canWrite = isAdmin || isOperacional || isFinanceiro;

  return {
    perfil,
    /** @deprecated Use perfil instead */
    role: perfil,
    isAdmin,
    isOperacional,
    isFinanceiro,
    canWrite,
    isLoading: profileQuery.isLoading,
    isError: profileQuery.isError,
    error: profileQuery.error,
  };
}
