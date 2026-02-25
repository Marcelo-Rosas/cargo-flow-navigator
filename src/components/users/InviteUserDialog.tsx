import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInviteUser, type UserProfile } from '@/hooks/useUsers';

const inviteSchema = z.object({
  fullName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z
    .string()
    .email('E-mail inválido')
    .refine((e) => e.toLowerCase().endsWith('@vectracargo.com.br'), {
      message: 'Somente e-mails @vectracargo.com.br',
    }),
  perfil: z.enum(['admin', 'operacional', 'financeiro']),
});

const PROFILE_OPTIONS: { value: UserProfile; label: string; description: string }[] = [
  { value: 'admin', label: 'Administrador', description: 'Acesso total ao sistema' },
  { value: 'operacional', label: 'Operacional', description: 'Gestão de OS, veículos e documentos' },
  { value: 'financeiro', label: 'Financeiro', description: 'Gestão financeira e aprovações' },
];

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [perfil, setPerfil] = useState<UserProfile>('operacional');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const inviteMutation = useInviteUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = inviteSchema.safeParse({ fullName, email, perfil });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        fieldErrors[String(err.path[0])] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      await inviteMutation.mutateAsync({ email, fullName, perfil });
      toast.success(`Convite enviado para ${email}`);
      setOpen(false);
      setFullName('');
      setEmail('');
      setPerfil('operacional');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar convite';
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          Convidar Usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar Novo Usuário</DialogTitle>
          <DialogDescription>
            O usuário receberá um e-mail com link para definir sua senha.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="invite-name">Nome Completo</Label>
            <Input
              id="invite-name"
              placeholder="João Silva"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={errors.fullName ? 'border-destructive' : ''}
            />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-email">E-mail</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="usuario@vectracargo.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label>Perfil de Acesso</Label>
            <Select value={perfil} onValueChange={(v) => setPerfil(v as UserProfile)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROFILE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div>
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-muted-foreground text-xs ml-2">— {opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.perfil && <p className="text-sm text-destructive">{errors.perfil}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? 'Enviando...' : 'Enviar Convite'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
