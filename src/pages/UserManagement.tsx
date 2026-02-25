import { useState } from 'react';
import { Users, Shield, Briefcase, Calculator, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { InviteUserDialog } from '@/components/users/InviteUserDialog';
import { useProfiles, useUpdateUserProfile, type UserProfile } from '@/hooks/useUsers';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

const PROFILE_CONFIG: Record<UserProfile, { label: string; color: string; icon: React.ElementType }> = {
  admin: { label: 'Administrador', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: Shield },
  operacional: { label: 'Operacional', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Briefcase },
  financeiro: { label: 'Financeiro', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: Calculator },
};

export default function UserManagement() {
  const { data: profiles, isLoading } = useProfiles();
  const updateProfileMutation = useUpdateUserProfile();
  const { user } = useAuth();

  const handleProfileChange = async (userId: string, newProfile: UserProfile) => {
    try {
      await updateProfileMutation.mutateAsync({ userId, newProfile });
      toast.success('Perfil atualizado com sucesso');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar perfil';
      toast.error(msg);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-6 h-6" />
              Gestão de Usuários
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os usuários e seus perfis de acesso ao sistema
            </p>
          </div>
          <InviteUserDialog />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['admin', 'operacional', 'financeiro'] as UserProfile[]).map((p) => {
            const config = PROFILE_CONFIG[p];
            const count = profiles?.filter((u) => u.perfil === p).length ?? 0;
            const Icon = config.icon;
            return (
              <Card key={p}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{count}</div>
                  <p className="text-xs text-muted-foreground">
                    {count === 1 ? 'usuário' : 'usuários'}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Usuários Cadastrados</CardTitle>
            <CardDescription>
              {profiles?.length ?? 0} usuário{(profiles?.length ?? 0) !== 1 ? 's' : ''} no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Cadastrado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles?.map((profile) => {
                    const isCurrentUser = profile.id === user?.id || profile.user_id === user?.id;
                    const config = PROFILE_CONFIG[profile.perfil ?? 'operacional'];
                    return (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">
                          {profile.full_name || '—'}
                          {isCurrentUser && (
                            <Badge variant="outline" className="ml-2 text-xs">Você</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {profile.email || '—'}
                        </TableCell>
                        <TableCell>
                          {isCurrentUser ? (
                            <Badge className={config.color}>{config.label}</Badge>
                          ) : (
                            <Select
                              value={profile.perfil ?? 'operacional'}
                              onValueChange={(v) => handleProfileChange(profile.id, v as UserProfile)}
                              disabled={updateProfileMutation.isPending}
                            >
                              <SelectTrigger className="w-[160px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="operacional">Operacional</SelectItem>
                                <SelectItem value="financeiro">Financeiro</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(profile.created_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!profiles || profiles.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
