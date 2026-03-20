import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { filterSupabaseRows } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ExportType = 'quotes' | 'orders' | 'clients' | 'full';

export function ExportReports() {
  const [exporting, setExporting] = useState<ExportType | null>(null);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const exportToCSV = (
    data: Record<string, unknown>[],
    filename: string,
    headers: string[],
    keys: string[]
  ) => {
    const csvRows = [headers.join(';')];

    data.forEach((item) => {
      const values = keys.map((key) => {
        const value = item[key];
        if (value === null || value === undefined) return '';
        if (typeof value === 'number') return value.toString().replace('.', ',');
        if (typeof value === 'string' && value.includes(';')) return `"${value}"`;
        return value;
      });
      csvRows.push(values.join(';'));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleExport = async (type: ExportType) => {
    setExporting(type);

    try {
      if (type === 'quotes' || type === 'full') {
        const { data: quotes } = await supabase
          .from('quotes')
          .select('*')
          .order('created_at', { ascending: false });

        const validQuotes = filterSupabaseRows<Record<string, unknown>>(quotes);
        if (validQuotes.length > 0) {
          exportToCSV(
            validQuotes.map((q) => ({
              ...q,
              created_at: q.created_at ? formatDate(String(q.created_at)) : '',
              updated_at: q.updated_at ? formatDate(String(q.updated_at)) : '',
              value: q.value,
            })),
            'cotacoes',
            [
              'Cliente',
              'Email',
              'Origem',
              'Destino',
              'Valor',
              'Estágio',
              'Tipo Carga',
              'Peso',
              'Volume',
              'Data Criação',
            ],
            [
              'client_name',
              'client_email',
              'origin',
              'destination',
              'value',
              'stage',
              'cargo_type',
              'weight',
              'volume',
              'created_at',
            ]
          );
        }
      }

      if (type === 'orders' || type === 'full') {
        const { data: orders } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        const validOrders = filterSupabaseRows<Record<string, unknown>>(orders);
        if (validOrders.length > 0) {
          exportToCSV(
            validOrders.map((o) => ({
              ...o,
              created_at: o.created_at ? formatDate(String(o.created_at)) : '',
              updated_at: o.updated_at ? formatDate(String(o.updated_at)) : '',
              eta: o.eta ? formatDate(String(o.eta)) : '',
              has_nfe: o.has_nfe ? 'Sim' : 'Não',
              has_cte: o.has_cte ? 'Sim' : 'Não',
              has_pod: o.has_pod ? 'Sim' : 'Não',
            })),
            'ordens_servico',
            [
              'Número OS',
              'Cliente',
              'Origem',
              'Destino',
              'Valor',
              'Estágio',
              'Motorista',
              'Placa',
              'NF-e',
              'CT-e',
              'POD',
              'ETA',
              'Data Criação',
            ],
            [
              'os_number',
              'client_name',
              'origin',
              'destination',
              'value',
              'stage',
              'driver_name',
              'vehicle_plate',
              'has_nfe',
              'has_cte',
              'has_pod',
              'eta',
              'created_at',
            ]
          );
        }
      }

      if (type === 'clients' || type === 'full') {
        const { data: clients } = await supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false });

        const validClients = filterSupabaseRows<Record<string, unknown>>(clients);
        if (validClients.length > 0) {
          exportToCSV(
            validClients.map((c) => ({
              ...c,
              created_at: c.created_at ? formatDate(String(c.created_at)) : '',
            })),
            'clientes',
            ['Nome', 'CNPJ', 'Email', 'Telefone', 'Cidade', 'Estado', 'Endereço', 'Data Criação'],
            ['name', 'cnpj', 'email', 'phone', 'city', 'state', 'address', 'created_at']
          );
        }
      }

      toast.success(
        type === 'full' ? 'Relatórios exportados com sucesso!' : 'Relatório exportado com sucesso!'
      );
    } catch (error) {
      toast.error('Erro ao exportar relatório');
      console.error(error);
    } finally {
      setExporting(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Exportar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Exportar Relatórios</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleExport('quotes')} disabled={!!exporting}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Cotações (CSV)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('orders')} disabled={!!exporting}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Ordens de Serviço (CSV)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('clients')} disabled={!!exporting}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Clientes (CSV)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleExport('full')} disabled={!!exporting}>
            <FileText className="w-4 h-4 mr-2" />
            Relatório Completo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  );
}
