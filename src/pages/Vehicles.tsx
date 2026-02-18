import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Pencil, Trash2, Loader2, Truck, User, Building2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVehicles, useDeleteVehicle } from '@/hooks/useVehicles';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { VehicleForm } from '@/components/forms/VehicleForm';
import type { VehicleWithRelations } from '@/hooks/useVehicles';
import { useDebounce } from '@/hooks/useDebounce';
import { Badge } from '@/components/ui/badge';
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

export default function Vehicles() {
  const { user } = useAuth();
  const { canWrite } = useUserRole();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { data: vehicles, isLoading, isError, error, refetch } = useVehicles(undefined);
  const deleteVehicleMutation = useDeleteVehicle();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleWithRelations | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<VehicleWithRelations | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const canManageVehicles = canWrite;

  const filteredVehicles = debouncedSearchTerm
    ? vehicles?.filter(
        (v) =>
          v.plate.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          v.driver?.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          v.owner?.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          (v.brand && v.brand.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
          (v.model && v.model.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
      )
    : vehicles;

  const handleEdit = (vehicle: VehicleWithRelations) => {
    setEditingVehicle(vehicle);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!canManageVehicles) return;
    if (!deletingVehicle || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteVehicleMutation.mutateAsync(deletingVehicle.id);
      toast.success('Veículo excluído com sucesso');
      setDeletingVehicle(null);
    } catch {
      toast.error('Erro ao excluir veículo');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingVehicle(null);
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">Faça login para acessar os veículos</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <motion.h1
            className="text-3xl font-bold text-foreground"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Veículos
          </motion.h1>
          <motion.p
            className="text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <span className="font-semibold text-primary">{filteredVehicles?.length || 0}</span>{' '}
            veículos cadastrados
          </motion.p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por placa, motorista, proprietário..."
              className="pl-10 w-80"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {canManageVehicles && (
            <Button className="gap-2" onClick={() => setIsFormOpen(true)}>
              <Plus className="w-4 h-4" />
              Novo Veículo
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="bg-card rounded-xl border border-border shadow-card p-8">
          <p className="text-foreground font-medium">Não foi possível carregar os veículos</p>
          <p className="text-sm text-muted-foreground mt-1">
            {(error instanceof Error && error.message) || 'Erro inesperado ao buscar veículos.'}
          </p>
          <div className="mt-4">
            <Button onClick={() => refetch()}>Tentar novamente</Button>
          </div>
        </div>
      ) : filteredVehicles?.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card rounded-xl border border-border shadow-card p-12 text-center"
        >
          <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum veículo cadastrado</h3>
          <p className="text-muted-foreground mb-4">
            Cadastre veículos e associe motorista e proprietário
          </p>
          {canManageVehicles && (
            <Button onClick={() => setIsFormOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Adicionar Veículo
            </Button>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card rounded-xl border border-border shadow-card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Placa
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Motorista
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Proprietário
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Marca / Modelo
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredVehicles?.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Truck className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{vehicle.plate}</span>
                          {!vehicle.active && (
                            <Badge variant="secondary" className="text-xs">
                              Inativo
                            </Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {vehicle.driver ? (
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          {vehicle.driver.name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {vehicle.owner ? (
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                          {vehicle.owner.name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {[vehicle.brand, vehicle.model].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canManageVehicles && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(vehicle)}
                              aria-label="Editar veículo"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingVehicle(vehicle)}
                              aria-label="Excluir veículo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      <VehicleForm
        open={isFormOpen && canManageVehicles}
        onClose={handleFormClose}
        vehicle={editingVehicle}
      />

      <AlertDialog
        open={!!deletingVehicle && canManageVehicles}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeletingVehicle(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir veículo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o veículo de placa &quot;{deletingVehicle?.plate}
              &quot;? Esta ação não pode ser desfeita.
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
