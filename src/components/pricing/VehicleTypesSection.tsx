import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useVehicleTypes } from '@/hooks/usePricingRules';
import { useCreateVehicleType, useUpdateVehicleType, useDeleteVehicleType } from '@/hooks/usePricingMutations';
import { Pencil, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { VehicleType } from '@/types/pricing';

export function VehicleTypesSection() {
  const { data: vehicles, isLoading } = useVehicleTypes(false);
  const createMutation = useCreateVehicleType();
  const updateMutation = useUpdateVehicleType();
  const deleteMutation = useDeleteVehicleType();
  
  const [editingVehicle, setEditingVehicle] = useState<VehicleType | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreate = async (data: Omit<VehicleType, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success('Tipo de veículo criado');
      setIsCreateOpen(false);
    } catch (error) {
      toast.error('Erro ao criar tipo de veículo');
    }
  };

  const handleUpdate = async (id: string, data: Partial<VehicleType>) => {
    try {
      await updateMutation.mutateAsync({ id, updates: data });
      toast.success('Tipo de veículo atualizado');
      setEditingVehicle(null);
    } catch (error) {
      toast.error('Erro ao atualizar tipo de veículo');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Tipo de veículo excluído');
    } catch (error) {
      toast.error('Erro ao excluir tipo de veículo');
    }
  };

  const handleToggleActive = async (vehicle: VehicleType) => {
    await handleUpdate(vehicle.id, { active: !vehicle.active });
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
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Tipo
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Eixos</TableHead>
            <TableHead>Capacidade (kg)</TableHead>
            <TableHead>Capacidade (m³)</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehicles?.map((vehicle) => (
            <TableRow key={vehicle.id}>
              <TableCell className="font-mono text-sm">{vehicle.code}</TableCell>
              <TableCell className="font-medium">{vehicle.name}</TableCell>
              <TableCell>{vehicle.axes_count || '-'}</TableCell>
              <TableCell>{vehicle.capacity_kg?.toLocaleString('pt-BR') || '-'}</TableCell>
              <TableCell>{vehicle.capacity_m3 || '-'}</TableCell>
              <TableCell>
                <Badge variant={vehicle.active ? 'default' : 'outline'}>
                  {vehicle.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Switch
                    checked={vehicle.active}
                    onCheckedChange={() => handleToggleActive(vehicle)}
                    disabled={updateMutation.isPending}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingVehicle(vehicle)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleDelete(vehicle.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Edit Dialog */}
      <Dialog open={!!editingVehicle} onOpenChange={(open) => !open && setEditingVehicle(null)}>
        <DialogContent>
          {editingVehicle && (
            <VehicleTypeForm
              vehicle={editingVehicle}
              onSubmit={(data) => handleUpdate(editingVehicle.id, data)}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <VehicleTypeForm
            onSubmit={handleCreate}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VehicleTypeForm({
  vehicle,
  onSubmit,
  isLoading,
}: {
  vehicle?: VehicleType;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [code, setCode] = useState(vehicle?.code || '');
  const [name, setName] = useState(vehicle?.name || '');
  const [axesCount, setAxesCount] = useState(vehicle?.axes_count?.toString() || '');
  const [capacityKg, setCapacityKg] = useState(vehicle?.capacity_kg?.toString() || '');
  const [capacityM3, setCapacityM3] = useState(vehicle?.capacity_m3?.toString() || '');
  const [active, setActive] = useState(vehicle?.active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.error('Código e nome são obrigatórios');
      return;
    }
    onSubmit({
      code,
      name,
      axes_count: axesCount ? parseInt(axesCount) : null,
      capacity_kg: capacityKg ? parseFloat(capacityKg) : null,
      capacity_m3: capacityM3 ? parseFloat(capacityM3) : null,
      active,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{vehicle ? 'Editar Tipo de Veículo' : 'Novo Tipo de Veículo'}</DialogTitle>
        <DialogDescription>
          {vehicle ? 'Atualize as informações do tipo de veículo' : 'Preencha os dados do novo tipo'}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Código</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="TRUCK"
              disabled={!!vehicle}
            />
          </div>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Truck"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Nº Eixos</Label>
            <Input
              type="number"
              min="2"
              max="12"
              value={axesCount}
              onChange={(e) => setAxesCount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Capacidade (kg)</Label>
            <Input
              type="number"
              value={capacityKg}
              onChange={(e) => setCapacityKg(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Capacidade (m³)</Label>
            <Input
              type="number"
              value={capacityM3}
              onChange={(e) => setCapacityM3(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={active} onCheckedChange={setActive} />
          <Label>Ativo</Label>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {vehicle ? 'Salvar' : 'Criar'}
        </Button>
      </DialogFooter>
    </form>
  );
}
