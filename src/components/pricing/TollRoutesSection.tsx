import { useState } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useTollRoutes, useVehicleTypes } from '@/hooks/usePricingRules';
import {
  useCreateTollRoute,
  useUpdateTollRoute,
  useDeleteTollRoute,
} from '@/hooks/usePricingMutations';
import { Pencil, Plus, Trash2, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import type { TollRoute } from '@/types/pricing';

const BRAZILIAN_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

type TollRouteWithVehicle = TollRoute & {
  vehicle_types: { code: string; name: string } | null;
};

export function TollRoutesSection() {
  const { data: routes, isLoading } = useTollRoutes();
  const { data: vehicleTypes } = useVehicleTypes();
  const createMutation = useCreateTollRoute();
  const updateMutation = useUpdateTollRoute();
  const deleteMutation = useDeleteTollRoute();

  const [editingRoute, setEditingRoute] = useState<TollRouteWithVehicle | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [filterOrigin, setFilterOrigin] = useState<string>('all');
  const [filterDestination, setFilterDestination] = useState<string>('all');

  const filteredRoutes = (routes as TollRouteWithVehicle[] | undefined)?.filter((route) => {
    if (filterOrigin !== 'all' && route.origin_state !== filterOrigin) return false;
    if (filterDestination !== 'all' && route.destination_state !== filterDestination) return false;
    return true;
  });

  const handleCreate = async (
    data: Omit<TollRoute, 'id' | 'created_at' | 'updated_at' | 'created_by'>
  ) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success('Rota de pedágio criada');
      setIsCreateOpen(false);
    } catch (error) {
      toast.error('Erro ao criar rota');
    }
  };

  const handleUpdate = async (id: string, data: Partial<TollRoute>) => {
    try {
      await updateMutation.mutateAsync({ id, updates: data });
      toast.success('Rota atualizada');
      setEditingRoute(null);
    } catch (error) {
      toast.error('Erro ao atualizar rota');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Rota excluída');
    } catch (error) {
      toast.error('Erro ao excluir rota');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Select value={filterOrigin} onValueChange={setFilterOrigin}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {BRAZILIAN_STATES.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <Select value={filterDestination} onValueChange={setFilterDestination}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Destino" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {BRAZILIAN_STATES.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Rota
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Origem</TableHead>
            <TableHead>Destino</TableHead>
            <TableHead>Veículo</TableHead>
            <TableHead>Pedágio</TableHead>
            <TableHead>Distância</TableHead>
            <TableHead>Via</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRoutes?.map((route) => (
            <TableRow key={route.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{route.origin_state}</Badge>
                  {route.origin_city && (
                    <span className="text-sm text-muted-foreground">{route.origin_city}</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{route.destination_state}</Badge>
                  {route.destination_city && (
                    <span className="text-sm text-muted-foreground">{route.destination_city}</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {route.vehicle_types ? (
                  <Badge variant="secondary">{route.vehicle_types.code}</Badge>
                ) : (
                  <span className="text-muted-foreground">Todos</span>
                )}
              </TableCell>
              <TableCell className="font-medium">
                R${' '}
                {route.toll_value.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </TableCell>
              <TableCell>{route.distance_km ? `${route.distance_km} km` : '-'}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {route.via_description || '-'}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setEditingRoute(route)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleDelete(route.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {filteredRoutes?.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Nenhuma rota encontrada
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Edit Dialog */}
      <Dialog open={!!editingRoute} onOpenChange={(open) => !open && setEditingRoute(null)}>
        <DialogContent>
          {editingRoute && (
            <TollRouteForm
              route={editingRoute}
              vehicleTypes={vehicleTypes}
              onSubmit={(data) => handleUpdate(editingRoute.id, data)}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <TollRouteForm
            vehicleTypes={vehicleTypes}
            onSubmit={handleCreate}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TollRouteForm({
  route,
  vehicleTypes,
  onSubmit,
  isLoading,
}: {
  route?: TollRouteWithVehicle;
  vehicleTypes?: { id: string; code: string; name: string }[];
  onSubmit: (
    data: Omit<TollRoute, 'id' | 'created_at' | 'updated_at' | 'created_by'> | Partial<TollRoute>
  ) => void;
  isLoading: boolean;
}) {
  const [originState, setOriginState] = useState(route?.origin_state || '');
  const [originCity, setOriginCity] = useState(route?.origin_city || '');
  const [destinationState, setDestinationState] = useState(route?.destination_state || '');
  const [destinationCity, setDestinationCity] = useState(route?.destination_city || '');
  const [vehicleTypeId, setVehicleTypeId] = useState(route?.vehicle_type_id || '');
  const [tollValue, setTollValue] = useState(route?.toll_value?.toString() || '');
  const [distanceKm, setDistanceKm] = useState(route?.distance_km?.toString() || '');
  const [viaDescription, setViaDescription] = useState(route?.via_description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!originState || !destinationState) {
      toast.error('UF origem e destino são obrigatórios');
      return;
    }
    if (!tollValue || parseFloat(tollValue) <= 0) {
      toast.error('Valor do pedágio deve ser maior que zero');
      return;
    }
    onSubmit({
      origin_state: originState,
      origin_city: originCity || null,
      destination_state: destinationState,
      destination_city: destinationCity || null,
      vehicle_type_id: vehicleTypeId || null,
      toll_value: parseFloat(tollValue),
      distance_km: distanceKm ? parseInt(distanceKm) : null,
      via_description: viaDescription || null,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{route ? 'Editar Rota de Pedágio' : 'Nova Rota de Pedágio'}</DialogTitle>
        <DialogDescription>Configure o valor do pedágio para uma rota específica</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>UF Origem *</Label>
            <Select value={originState} onValueChange={setOriginState}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {BRAZILIAN_STATES.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cidade Origem</Label>
            <Input
              value={originCity}
              onChange={(e) => setOriginCity(e.target.value)}
              placeholder="Qualquer cidade"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>UF Destino *</Label>
            <Select value={destinationState} onValueChange={setDestinationState}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {BRAZILIAN_STATES.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cidade Destino</Label>
            <Input
              value={destinationCity}
              onChange={(e) => setDestinationCity(e.target.value)}
              placeholder="Qualquer cidade"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo de Veículo</Label>
            <Select
              value={vehicleTypeId || '__none__'}
              onValueChange={(v) => setVehicleTypeId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Todos</SelectItem>
                {vehicleTypes?.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.code} - {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor Pedágio (R$) *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={tollValue}
              onChange={(e) => setTollValue(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Distância (km)</Label>
            <Input
              type="number"
              min="0"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="space-y-2">
            <Label>Via / Descrição</Label>
            <Input
              value={viaDescription}
              onChange={(e) => setViaDescription(e.target.value)}
              placeholder="Via BR-116"
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {route ? 'Salvar' : 'Criar'}
        </Button>
      </DialogFooter>
    </form>
  );
}
