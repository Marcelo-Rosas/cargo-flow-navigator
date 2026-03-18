import type { RsPerKmRow } from '@/hooks/useRsPerKmByRoute';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface RsPerKmTableProps {
  rows: RsPerKmRow[];
  isLoading: boolean;
}

export function RsPerKmTable({ rows, isLoading }: RsPerKmTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma OS elegível para o período selecionado.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>OS</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Destino</TableHead>
            <TableHead className="text-right">KM</TableHead>
            <TableHead className="text-right">Carreteiro (R$)</TableHead>
            <TableHead className="text-right">R$/KM</TableHead>
            <TableHead>Veículo</TableHead>
            <TableHead>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.order_id}>
              <TableCell>{row.os_number ?? '—'}</TableCell>
              <TableCell>{row.client_name ?? '—'}</TableCell>
              <TableCell>{row.origin}</TableCell>
              <TableCell>{row.destination}</TableCell>
              <TableCell className="text-right">
                {row.km_distance.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </TableCell>
              <TableCell className="text-right">
                {row.carreteiro_real.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </TableCell>
              <TableCell className="text-right">
                {row.rs_per_km.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 2,
                })}
              </TableCell>
              <TableCell>{row.vehicle_type_name ?? '—'}</TableCell>
              <TableCell>
                {new Date(row.order_date).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
