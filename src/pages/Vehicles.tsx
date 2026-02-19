import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Truck,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useVehicles, useDeleteVehicle } from '@/hooks/useVehicles';
import { useDrivers, useDeleteDriver } from '@/hooks/useDrivers';
import { useOwners, useDeleteOwner } from '@/hooks/useOwners';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { VehicleForm } from '@/components/forms/VehicleForm';
import { DriverForm } from '@/components/forms/DriverForm';
import { OwnerForm } from '@/components/forms/OwnerForm';
import type { VehicleWithRelations } from '@/hooks/useVehicles';
import type { Driver } from '@/hooks/useDrivers';
import { Database } from '@/integrations/supabase/types';
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

type Owner = Database['public']['Tables']['owners']['Row'];

const TAB_KEYS = ['veiculos', 'motoristas', 'proprietarios'] as const;
type TabKey = (typeof TAB_KEYS)[number];

function isValidTab(t: string): t is TabKey {
  return TAB_KEYS.includes(t as TabKey);
}

export default function Vehicles() {
  const { user } = useAuth();
  const { canWrite } = useUserRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || 'veiculos';
  const currentTab: TabKey = isValidTab(tabParam) ? tabParam : 'veiculos';

  const setTab = (tab: TabKey) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const [vehicleSearch, setVehicleSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const debouncedVehicleSearch = useDebounce(vehicleSearch, 300);
  const debouncedDriverSearch = useDebounce(driverSearch, 300);
  const debouncedOwnerSearch = useDebounce(ownerSearch, 300);

  const {
    data: vehicles,
    isLoading: vehiclesLoading,
    isError: vehiclesError,
    error: vehiclesErr,
    refetch: refetchVehicles,
  } = useVehicles(undefined);
  const {
    data: drivers,
    isLoading: driversLoading,
    isError: driversError,
    error: driversErr,
    refetch: refetchDrivers,
  } = useDrivers(false);
  const {
    data: owners,
    isLoading: ownersLoading,
    isError: ownersError,
    error: ownersErr,
    refetch: refetchOwners,
  } = useOwners(debouncedOwnerSearch, { enabled: !!user });

  const deleteVehicleMutation = useDeleteVehicle();
  const deleteDriverMutation = useDeleteDriver();
  const deleteOwnerMutation = useDeleteOwner();

  const filteredVehicles = debouncedVehicleSearch
    ? vehicles?.filter((v) => v.plate.toLowerCase().includes(debouncedVehicleSearch.toLowerCase()))
    : vehicles;

  const filteredDrivers = debouncedDriverSearch
    ? drivers?.filter(
        (d) =>
          d.name.toLowerCase().includes(debouncedDriverSearch.toLowerCase()) ||
          (d.phone && d.phone.includes(debouncedDriverSearch))
      )
    : drivers;

  const canManage = canWrite;

  const [isVehicleFormOpen, setIsVehicleFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleWithRelations | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<VehicleWithRelations | null>(null);
  const [isDriverFormOpen, setIsDriverFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);
  const [isOwnerFormOpen, setIsOwnerFormOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [deletingOwner, setDeletingOwner] = useState<Owner | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEditVehicle = (vehicle: VehicleWithRelations) => {
    setEditingVehicle(vehicle);
    setIsVehicleFormOpen(true);
  };

  const handleDeleteVehicle = async () => {
    if (!canManage || !deletingVehicle || isDeleting) return;
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

  const handleEditDriver = (driver: Driver) => {
    setEditingDriver(driver);
    setIsDriverFormOpen(true);
  };

  const handleDeleteDriver = async () => {
    if (!canManage || !deletingDriver || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteDriverMutation.mutateAsync(deletingDriver.id);
      toast.success('Motorista excluído com sucesso');
      setDeletingDriver(null);
    } catch {
      toast.error('Erro ao excluir motorista');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditOwner = (owner: Owner) => {
    setEditingOwner(owner);
    setIsOwnerFormOpen(true);
  };

  const handleDeleteOwner = async () => {
    if (!canManage || !deletingOwner || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteOwnerMutation.mutateAsync(deletingOwner.id);
      toast.success('Proprietário excluído com sucesso');
      setDeletingOwner(null);
    } catch {
      toast.error('Erro ao excluir proprietário');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Faça login para acessar veículos, motoristas e proprietários
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
              Cadastro de veículos, motoristas e proprietários (relacionados pelo veículo)
            </motion.p>
          </div>
        </div>

        <Tabs value={currentTab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="veiculos" className="gap-2">
              <Truck className="w-4 h-4" />
              Veículos
            </TabsTrigger>
            <TabsTrigger value="motoristas" className="gap-2">
              <User className="w-4 h-4" />
              Motoristas
            </TabsTrigger>
            <TabsTrigger value="proprietarios" className="gap-2">
              <Building2 className="w-4 h-4" />
              Proprietários
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="veiculos"
            forceMount
            className="mt-6 space-y-4 data-[state=inactive]:hidden"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por placa (motorista e proprietário do veículo)"
                  className="pl-10"
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                />
              </div>
              {canManage && (
                <Button
                  className="gap-2"
                  onClick={() => {
                    setEditingVehicle(null);
                    setIsVehicleFormOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Novo Veículo
                </Button>
              )}
            </div>
            {vehiclesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : vehiclesError ? (
              <div className="bg-card rounded-xl border border-border shadow-card p-8">
                <p className="text-foreground font-medium">Não foi possível carregar os veículos</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {(vehiclesErr instanceof Error && vehiclesErr.message) ||
                    'Erro inesperado ao buscar veículos.'}
                </p>
                <Button className="mt-4" onClick={() => refetchVehicles()}>
                  Tentar novamente
                </Button>
              </div>
            ) : filteredVehicles?.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-card rounded-xl border border-border shadow-card p-12 text-center"
              >
                <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Nenhum veículo cadastrado
                </h3>
                <p className="text-muted-foreground mb-4">
                  Cadastre veículos e associe motorista e proprietário
                </p>
                {canManage && (
                  <Button
                    onClick={() => {
                      setEditingVehicle(null);
                      setIsVehicleFormOpen(true);
                    }}
                    className="gap-2"
                  >
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
                              {canManage && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleEditVehicle(vehicle)}
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
          </TabsContent>

          <TabsContent
            value="motoristas"
            forceMount
            className="mt-6 space-y-4 data-[state=inactive]:hidden"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  className="pl-10"
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                />
              </div>
              {canManage && (
                <Button
                  className="gap-2"
                  onClick={() => {
                    setEditingDriver(null);
                    setIsDriverFormOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Novo Motorista
                </Button>
              )}
            </div>
            {driversLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : driversError ? (
              <div className="bg-card rounded-xl border border-border shadow-card p-8">
                <p className="text-foreground font-medium">
                  Não foi possível carregar os motoristas
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {(driversErr instanceof Error && driversErr.message) ||
                    'Erro inesperado ao buscar motoristas.'}
                </p>
                <Button className="mt-4" onClick={() => refetchDrivers()}>
                  Tentar novamente
                </Button>
              </div>
            ) : (filteredDrivers ?? []).length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-card rounded-xl border border-border shadow-card p-12 text-center"
              >
                <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Nenhum motorista cadastrado
                </h3>
                <p className="text-muted-foreground mb-4">
                  Cadastre motoristas para usar em veículos e OS
                </p>
                {canManage && (
                  <Button
                    onClick={() => {
                      setEditingDriver(null);
                      setIsDriverFormOpen(true);
                    }}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Motorista
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
                          Motorista
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Telefone
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredDrivers?.map((driver) => (
                        <tr key={driver.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <User className="w-5 h-5 text-primary" />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{driver.name}</span>
                                {!driver.active && (
                                  <Badge variant="secondary" className="text-xs">
                                    Inativo
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {driver.phone ? (
                              <div className="flex items-center gap-2 text-sm text-foreground">
                                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                {driver.phone}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {canManage && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleEditDriver(driver)}
                                    aria-label="Editar motorista"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => setDeletingDriver(driver)}
                                    aria-label="Excluir motorista"
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
          </TabsContent>

          <TabsContent
            value="proprietarios"
            forceMount
            className="mt-6 space-y-4 data-[state=inactive]:hidden"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF/CNPJ, e-mail..."
                  className="pl-10"
                  value={ownerSearch}
                  onChange={(e) => setOwnerSearch(e.target.value)}
                />
              </div>
              {canManage && (
                <Button
                  className="gap-2"
                  onClick={() => {
                    setEditingOwner(null);
                    setIsOwnerFormOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Novo Proprietário
                </Button>
              )}
            </div>
            {ownersLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : ownersError ? (
              <div className="bg-card rounded-xl border border-border shadow-card p-8">
                <p className="text-foreground font-medium">
                  Não foi possível carregar os proprietários
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {(ownersErr instanceof Error && ownersErr.message) ||
                    'Erro inesperado ao buscar proprietários.'}
                </p>
                <Button className="mt-4" onClick={() => refetchOwners()}>
                  Tentar novamente
                </Button>
              </div>
            ) : owners?.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-card rounded-xl border border-border shadow-card p-12 text-center"
              >
                <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Nenhum proprietário cadastrado
                </h3>
                <p className="text-muted-foreground mb-4">
                  Comece adicionando seu primeiro proprietário
                </p>
                {canManage && (
                  <Button
                    onClick={() => {
                      setEditingOwner(null);
                      setIsOwnerFormOpen(true);
                    }}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Proprietário
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
                          Proprietário
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          CPF/CNPJ
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Contato
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Localização
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {owners?.map((owner) => (
                        <tr key={owner.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-foreground">{owner.name}</p>
                                  {!owner.active && (
                                    <Badge variant="secondary" className="text-xs">
                                      Inativo
                                    </Badge>
                                  )}
                                </div>
                                {owner.notes && (
                                  <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                    {owner.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-foreground font-mono text-sm">
                            {owner.cpf_cnpj || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              {owner.phone && (
                                <div className="flex items-center gap-2 text-sm text-foreground">
                                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                  {owner.phone}
                                </div>
                              )}
                              {owner.email && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Mail className="w-3.5 h-3.5" />
                                  {owner.email}
                                </div>
                              )}
                              {!owner.phone && !owner.email && '-'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {owner.city || owner.state ? (
                              <div className="flex items-center gap-2 text-sm text-foreground">
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                {[owner.city, owner.state].filter(Boolean).join(' - ')}
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {canManage && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleEditOwner(owner)}
                                    aria-label="Editar proprietário"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => setDeletingOwner(owner)}
                                    aria-label="Excluir proprietário"
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
          </TabsContent>
        </Tabs>
      </div>

      <VehicleForm
        open={isVehicleFormOpen && canManage}
        onClose={() => {
          setIsVehicleFormOpen(false);
          setEditingVehicle(null);
        }}
        vehicle={editingVehicle}
      />
      <DriverForm
        open={isDriverFormOpen && canManage}
        onClose={() => {
          setIsDriverFormOpen(false);
          setEditingDriver(null);
        }}
        driver={editingDriver}
      />
      <OwnerForm
        open={isOwnerFormOpen && canManage}
        onClose={() => {
          setIsOwnerFormOpen(false);
          setEditingOwner(null);
        }}
        owner={editingOwner}
      />

      <AlertDialog
        open={!!deletingVehicle && canManage}
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
                handleDeleteVehicle();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  {' '}
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Excluindo...{' '}
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deletingDriver && canManage}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeletingDriver(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir motorista?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o motorista &quot;{deletingDriver?.name}&quot;? Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteDriver();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  {' '}
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Excluindo...{' '}
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deletingOwner && canManage}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeletingOwner(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proprietário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o proprietário &quot;{deletingOwner?.name}&quot;? Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteOwner();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  {' '}
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Excluindo...{' '}
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
