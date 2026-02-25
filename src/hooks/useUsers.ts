import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
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

  return useMutation({
    mutationFn: async (payload: { email: string; fullName: string; perfil: UserProfile }) => {
      // Conflict resolution: keep centralized edge invocation (JWT + refresh retry)
      // and enforce a strict success contract for invite-user.
      const data = await invokeEdgeFunction<{
        success: boolean;
        userId?: string | null;
        message: string;
        error?: string;
        alreadyExists?: boolean;
      }>('invite-user', {
        body: payload,
      });

      if (data?.error) throw new Error(data.error);
      if (!data?.success) {
        throw new Error('Falha ao convidar usuário. Tente novamente.');
      }

      return {
        success: data.success,
        userId: data.userId ?? null,
        message: data.message,
        alreadyExists: data.alreadyExists ?? false,
      };
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
