import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Database } from '@/integrations/supabase/types';

export type AppRole = Database['public']['Enums']['app_role'];

export function useUserRole() {
  const { user } = useAuth();

  const { data: role, isLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase.rpc('get_user_role', {
        _user_id: user.id,
      });

      if (error) throw error;
      return data as AppRole | null;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10, // 10 minutes — roles don't change often
  });

  const hasRole = (allowedRoles: AppRole[]) => {
    if (!role) return false;
    return allowedRoles.includes(role);
  };

  const isAdmin = role === 'admin';

  return { role, isLoading, hasRole, isAdmin };
}
