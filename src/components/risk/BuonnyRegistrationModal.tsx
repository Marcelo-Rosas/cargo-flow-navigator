import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { DatePickerString } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_OPTIONS = [
  { value: 'adequado', label: 'Adequado ao risco', evidenceStatus: 'valid' as const },
  {
    value: 'insuficiente',
    label: 'Insuficiência de dados',
    evidenceStatus: 'pending' as const,
  },
  { value: 'divergente', label: 'Perfil divergente', evidenceStatus: 'invalid' as const },
  { value: 'expirado', label: 'Perfil expirado', evidenceStatus: 'expired' as const },
] as const;

type BuonnyStatus = (typeof STATUS_OPTIONS)[number]['value'];

export interface BuonnyRegistrationData {
  codigo_liberacao: string;
  numero_conjunto: string;
  status_buonny: BuonnyStatus;
  evidenceStatus: 'valid' | 'pending' | 'invalid' | 'expired';
  validade: 'um_embarque' | 'data';
  data_validade?: string;
  driver_cpf: string;
  driver_name: string;
  vehicle_plate: string;
  vehicle_type: string;
  proprietario: string;
}

interface BuonnyRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverName?: string | null;
  driverCpf?: string | null;
  vehiclePlate?: string | null;
  vehicleTypeName?: string | null;
  onSubmit: (data: BuonnyRegistrationData) => Promise<void>;
  isLoading: boolean;
}

export function BuonnyRegistrationModal({
  open,
  onOpenChange,
  driverName,
  driverCpf,
  vehiclePlate,
  vehicleTypeName,
  onSubmit,
  isLoading,
}: BuonnyRegistrationModalProps) {
  const [codigoLiberacao, setCodigoLiberacao] = useState('');
  const [numeroConjunto, setNumeroConjunto] = useState('');
  const [statusBuonny, setStatusBuonny] = useState<BuonnyStatus | ''>('');
  const [validade, setValidade] = useState<'um_embarque' | 'data'>('um_embarque');
  const [dataValidade, setDataValidade] = useState('');
  const [proprietario, setProprietario] = useState('');

  const { data: ownerName } = useQuery({
    queryKey: ['vehicle-owner', vehiclePlate],
    enabled: open && !!vehiclePlate,
    queryFn: async () => {
      const { data } = await supabase
        .from('vehicles')
        .select('owners!vehicles_owner_id_fkey(name)')
        .eq('plate', vehiclePlate!)
        .single();
      return ((data as any)?.owners?.name as string | null) ?? null;
    },
  });

  useEffect(() => {
    if (ownerName && !proprietario) {
      setProprietario(ownerName);
    }
  }, [ownerName]);

  const statusOption = STATUS_OPTIONS.find((s) => s.value === statusBuonny);
  const canSubmit = codigoLiberacao.trim() && statusBuonny && !isLoading;

  const handleSubmit = async () => {
    if (!canSubmit || !statusOption) return;
    await onSubmit({
      codigo_liberacao: codigoLiberacao.trim(),
      numero_conjunto: numeroConjunto.trim(),
      status_buonny: statusBuonny,
      evidenceStatus: statusOption.evidenceStatus,
      validade,
      data_validade: validade === 'data' ? dataValidade : undefined,
      driver_cpf: driverCpf ?? '',
      driver_name: driverName ?? '',
      vehicle_plate: vehiclePlate ?? '',
      vehicle_type: vehicleTypeName ?? '',
      proprietario: proprietario.trim(),
    });
    setCodigoLiberacao('');
    setNumeroConjunto('');
    setStatusBuonny('');
    setValidade('um_embarque');
    setDataValidade('');
    setProprietario('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Consulta Buonny</DialogTitle>
          <DialogDescription>
            Informe os dados do Retorno de Análise recebido da Buonny.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pre-filled driver/vehicle info */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/50 p-3 text-sm">
            <div>
              <span className="text-muted-foreground">Motorista:</span>{' '}
              <span className="font-medium">{driverName ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">CPF:</span>{' '}
              <span className="font-medium">{driverCpf ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Placa:</span>{' '}
              <span className="font-medium">{vehiclePlate ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Tipo:</span>{' '}
              <span className="font-medium">{vehicleTypeName ?? '—'}</span>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status da Análise *</Label>
            <Select value={statusBuonny} onValueChange={(v) => setStatusBuonny(v as BuonnyStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Código de Liberação */}
          <div className="space-y-1.5">
            <Label>Código de Liberação *</Label>
            <Input
              placeholder="Ex: 002244634-2026"
              value={codigoLiberacao}
              onChange={(e) => setCodigoLiberacao(e.target.value)}
            />
          </div>

          {/* Nº do Conjunto */}
          <div className="space-y-1.5">
            <Label>Nº do Conjunto</Label>
            <Input
              placeholder="Ex: 1153233"
              value={numeroConjunto}
              onChange={(e) => setNumeroConjunto(e.target.value)}
            />
          </div>

          {/* Validade */}
          <div className="space-y-1.5">
            <Label>Validade</Label>
            <Select
              value={validade}
              onValueChange={(v) => setValidade(v as 'um_embarque' | 'data')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="um_embarque">Um embarque</SelectItem>
                <SelectItem value="data">Data específica</SelectItem>
              </SelectContent>
            </Select>
            {validade === 'data' && (
              <DatePickerString
                value={dataValidade}
                onChange={(val) => setDataValidade(val)}
                className="mt-1.5"
              />
            )}
          </div>

          {/* Proprietário */}
          <div className="space-y-1.5">
            <Label>Proprietário do veículo</Label>
            <Input placeholder="Buscando via placa..." value={proprietario} readOnly disabled />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Registrando...
                </>
              ) : (
                'Registrar'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
