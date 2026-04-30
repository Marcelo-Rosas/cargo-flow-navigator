import { motion } from 'framer-motion';
import { Search, Bell, Plus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { GlobalSearchDialog } from '@/components/layout/GlobalSearchDialog';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

interface TopbarProps {
  onNewQuote?: () => void;
  onNewOrder?: () => void;
}

export function Topbar({ onNewQuote, onNewOrder }: TopbarProps) {
  const { setIsOpen } = useGlobalSearch();
  const { user, signOut } = useAuth();
  const { canWrite } = useUserRole();

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
      {/* Global Search Dialog */}
      <GlobalSearchDialog />

      {/* Search Trigger */}
      <motion.button
        className="relative flex-1 max-w-md"
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex items-center w-full h-10 px-3 text-sm bg-background border border-input rounded-md text-muted-foreground hover:bg-accent transition-colors">
          <Search className="w-4 h-4 mr-2" />
          <span>Buscar cotações, OS, clientes...</span>
          <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
        </div>
      </motion.button>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Quick Add */}
        {canWrite && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Novo</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Criar Novo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onNewQuote}>Nova Cotação</DropdownMenuItem>
              <DropdownMenuItem onClick={onNewOrder}>Nova Ordem de Serviço</DropdownMenuItem>
              <DropdownMenuItem>Novo Cliente</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
              <Bell className="w-5 h-5" />
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs"
              >
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notificações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">Ocorrência Crítica</span>
              <span className="text-sm text-muted-foreground">
                OS-2024-0003: Atraso na coleta registrado
              </span>
              <span className="text-xs text-muted-foreground">Há 2 horas</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">Documento Pendente</span>
              <span className="text-sm text-muted-foreground">
                CT-e não anexado na OS-2024-0002
              </span>
              <span className="text-xs text-muted-foreground">Há 5 horas</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">Cotação Ganha</span>
              <span className="text-sm text-muted-foreground">
                Loja Virtual Express confirmou proposta
              </span>
              <span className="text-xs text-muted-foreground">Há 1 dia</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Menu do usuário"
            >
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <User className="w-4 h-4 text-primary-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user?.email?.split('@')[0] || 'Usuário'}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {user?.email || ''}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Meu Perfil</DropdownMenuItem>
            <DropdownMenuItem>Configurações</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => signOut()}>
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
