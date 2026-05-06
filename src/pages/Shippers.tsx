import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Ship,
  Phone,
  Mail,
  MapPin,
  User,
  Crown,
  Briefcase,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useShippers, useDeleteShipper } from '@/hooks/useShippers';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { ShipperForm } from '@/components/forms/ShipperForm';
import { formatCnpjDisplay, formatCpfDisplay, formatPhoneDisplay } from '@/lib/formatters';
import { Database } from '@/integrations/supabase/types';
import { useDebounce } from '@/hooks/useDebounce';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Shipper = Database['public']['Tables']['shippers']['Row'];

type QsaPartner = { name?: string | null; role?: string | null };

function getQsaOwner(partners: Shipper['partners']): QsaPartner | null {
  if (!partners || !Array.isArray(partners) || partners.length === 0) return null;
  const list = partners as QsaPartner[];
  const admin = list.find((p) => p?.role === 'Sócio-Administrador' && p?.name);
  if (admin) return admin;
  const first = list.find((p) => p?.name);
  return first ?? null;
}

function formatCnae(code: string | null | undefined): string | null {
  if (!code) return null;
  const d = code.replace(/\D/g, '');
  if (d.length !== 7) return code;
  return `${d.slice(0, 2)}.${d.slice(2, 4)}-${d.slice(4, 5)}-${d.slice(5)}`;
}

const COLUMN_COUNT = 7;

function ShippersTableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: COLUMN_COUNT }).map((_, i) => (
            <TableHead key={i}>
              <Skeleton className="h-4 w-24" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 8 }).map((_, rowIdx) => (
          <TableRow key={rowIdx}>
            {Array.from({ length: COLUMN_COUNT }).map((_, colIdx) => (
              <TableCell key={colIdx}>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function Shippers() {
  const { user } = useAuth();
  const { canWrite } = useUserRole();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const {
    data: shippers,
    isLoading,
    isError,
    error,
    refetch,
  } = useShippers(debouncedSearchTerm, { enabled: !!user });
  const deleteShipperMutation = useDeleteShipper();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingShipper, setEditingShipper] = useState<Shipper | null>(null);
  const [deletingShipper, setDeletingShipper] = useState<Shipper | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const canManageShippers = canWrite;

  const handleEdit = (shipper: Shipper) => {
    setEditingShipper(shipper);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!canManageShippers) return;
    if (!deletingShipper || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteShipperMutation.mutateAsync(deletingShipper.id);
      toast.success('Embarcador excluído com sucesso');
      setDeletingShipper(null);
    } catch (error) {
      toast.error('Erro ao excluir embarcador');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingShipper(null);
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">Faça login para acessar os embarcadores</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <motion.h1
            className="text-3xl font-bold text-foreground"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Embarcadores
          </motion.h1>
          <motion.p
            className="text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <span className="font-semibold text-primary">{shippers?.length || 0}</span>
            {debouncedSearchTerm ? ' resultados' : ' embarcadores cadastrados'}
          </motion.p>
        </div>

        <div className="flex items-center gap-3">
          <InputGroup className="w-80">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar por nome, CPF, CNPJ, e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
          {canManageShippers && (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus />
              Novo Embarcador
            </Button>
          )}
        </div>
      </div>

      {/* Loading / Error / Empty / Table */}
      {isLoading ? (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <ShippersTableSkeleton />
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Não foi possível carregar os embarcadores</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              {(error instanceof Error && error.message) ||
                'Erro inesperado ao buscar embarcadores.'}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="w-fit">
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : !shippers || shippers.length === 0 ? (
        <Empty className="bg-card rounded-xl border border-border shadow-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Ship />
            </EmptyMedia>
            <EmptyTitle>
              {debouncedSearchTerm
                ? 'Nenhum embarcador para essa busca'
                : 'Nenhum embarcador cadastrado'}
            </EmptyTitle>
            <EmptyDescription>
              {debouncedSearchTerm
                ? 'Ajuste a busca para ver mais resultados'
                : 'Comece adicionando seu primeiro embarcador'}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {canManageShippers && !debouncedSearchTerm && (
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus />
                Adicionar Embarcador
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card rounded-xl border border-border shadow-card overflow-hidden"
        >
          <Table className="table-fixed">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[260px]">Embarcador</TableHead>
                <TableHead className="w-[150px]">CPF / CNPJ</TableHead>
                <TableHead className="w-[220px]">Sócio-Administrador</TableHead>
                <TableHead className="w-[300px]">Atividade</TableHead>
                <TableHead className="w-[160px]">Contato</TableHead>
                <TableHead className="w-[170px]">Localização</TableHead>
                <TableHead className="w-[100px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shippers.map((shipper) => {
                const owner = getQsaOwner(shipper.partners);
                const cnaeCode = formatCnae(shipper.cnae_main_code);
                const cnaeDesc = shipper.cnae_main_description;

                return (
                  <TableRow key={shipper.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Ship className="size-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate" title={shipper.name}>
                            {shipper.name}
                          </p>
                          {shipper.contact_name && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <User className="size-3 shrink-0" />
                              <span className="truncate">{shipper.contact_name}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {shipper.cpf
                        ? formatCpfDisplay(String(shipper.cpf)) || String(shipper.cpf)
                        : shipper.cnpj
                          ? formatCnpjDisplay(shipper.cnpj)
                          : '-'}
                    </TableCell>
                    <TableCell>
                      {owner?.name ? (
                        <div className="flex items-start gap-2">
                          <Crown className="size-3.5 text-warning mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-sm font-medium text-foreground truncate"
                              title={owner.name}
                            >
                              {owner.name}
                            </p>
                            {owner.role && owner.role !== 'Sócio-Administrador' && (
                              <p className="text-xs text-muted-foreground truncate">{owner.role}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {cnaeCode || cnaeDesc ? (
                        <div className="flex items-start gap-2">
                          <Briefcase className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            {cnaeCode && (
                              <p className="text-xs font-mono text-muted-foreground">{cnaeCode}</p>
                            )}
                            {cnaeDesc && (
                              <p className="text-sm text-foreground line-clamp-2" title={cnaeDesc}>
                                {cnaeDesc}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <div className="flex flex-col gap-1 min-w-0">
                        {shipper.phone && (
                          <div className="flex items-center gap-2 min-w-0 text-foreground">
                            <Phone className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{formatPhoneDisplay(shipper.phone)}</span>
                          </div>
                        )}
                        {shipper.email && (
                          <div className="flex items-center gap-2 min-w-0 text-muted-foreground">
                            <Mail className="size-3.5 shrink-0" />
                            <span className="truncate" title={shipper.email}>
                              {shipper.email}
                            </span>
                          </div>
                        )}
                        {!shipper.phone && !shipper.email && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {shipper.city || shipper.state ? (
                        <div className="flex items-center gap-2 text-foreground">
                          <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                          <span
                            className="truncate"
                            title={[shipper.city, shipper.state].filter(Boolean).join(' - ')}
                          >
                            {[shipper.city, shipper.state].filter(Boolean).join(' - ')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {canManageShippers && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => handleEdit(shipper)}
                              aria-label="Editar embarcador"
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingShipper(shipper)}
                              aria-label="Excluir embarcador"
                            >
                              <Trash2 />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </motion.div>
      )}

      {/* Shipper Form */}
      <ShipperForm
        open={isFormOpen && canManageShippers}
        onClose={handleFormClose}
        shipper={editingShipper}
        onSelectExisting={(existing) => {
          setIsFormOpen(false);
          // small delay so the dialog unmounts before remounting in edit mode
          window.setTimeout(() => {
            setEditingShipper(existing);
            setIsFormOpen(true);
          }, 50);
          toast.info(`Editando embarcador existente: ${existing.name}`);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingShipper && canManageShippers}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeletingShipper(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir embarcador?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o embarcador "{deletingShipper?.name}"? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
