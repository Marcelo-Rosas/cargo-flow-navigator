import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

export type UserProfile = Database['public']['Enums']['user_profile'];

export interface ProfileRow {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  perfil: UserProfile | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * List all profiles (admin sees all via RLS, non-admin sees own only)
 */
export function useProfiles() {
  return useQuery({
    queryKey: ['profiles-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name');
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });
}

/**
 * Invite a new user via Edge Function
 */
export function useInviteUser() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (payload: { email: string; fullName: string; perfil: UserProfile }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      let token = sessionData?.session?.access_token ?? session?.access_token;
      if (!token) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        token = refreshData?.session?.access_token ?? undefined;
      }
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: payload,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; userId: string; message: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles-list'] });
    },
  });
}

/**
 * Update a user's profile role (calls RPC set_user_profile)
 */
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, newProfile }: { userId: string; newProfile: UserProfile }) => {
      const { error } = await supabase.rpc('set_user_profile', {
        target_user_id: userId,
        new_profile: newProfile,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles-list'] });
    },
  });
}
