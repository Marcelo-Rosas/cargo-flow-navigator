import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { parsePriceTableFile, ParsedPriceRow, ParseResult } from '@/lib/priceTableParser';
import { useImportPriceTable, PriceTableImportInput } from '@/hooks/useImportPriceTable';
import { usePriceTables } from '@/hooks/usePriceTables';

interface PriceTableImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultModality?: 'lotacao' | 'fracionado';
  defaultTableId?: string;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'done';

export function PriceTableImportModal({
  open,
  onOpenChange,
  defaultModality = 'lotacao',
  defaultTableId,
}: PriceTableImportModalProps) {
  const { data: existingTables } = usePriceTables();
  const importMutation = useImportPriceTable();

  const [step, setStep] = useState<ImportStep>('upload');
  const [parseResult, setParseResult] = useState<ParseResult<ParsedPriceRow> | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Form state
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>(
    defaultTableId ? 'existing' : 'new'
  );
  const [selectedTableId, setSelectedTableId] = useState<string>(defaultTableId || '');
  const [newTableName, setNewTableName] = useState('');
  const [modality, setModality] = useState<'lotacao' | 'fracionado'>(defaultModality);
  const [importMode, setImportMode] = useState<'replace' | 'upsert'>('replace');
  const [setAsActive, setSetAsActive] = useState(false);

  const resetState = () => {
    setStep('upload');
    setParseResult(null);
    setSelectedFile(null);
    setTargetMode(defaultTableId ? 'existing' : 'new');
    setSelectedTableId(defaultTableId || '');
    setNewTableName('');
    setModality(defaultModality);
    setImportMode('replace');
    setSetAsActive(false);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setSelectedFile(file);

    try {
      const result = await parsePriceTableFile(file);
      setParseResult(result);

      if (result.rows.length === 0) {
        toast.error('Nenhuma linha válida encontrada no arquivo');
      } else {
        setStep('preview');
        if (result.invalidRows > 0) {
          toast.warning(`${result.invalidRows} linha(s) com erros serão ignoradas`);
        }
      }
    } catch (error) {
      toast.error('Erro ao processar arquivo');
      console.error(error);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
    },
    maxFiles: 1,
    maxSize: 10485760, // 10MB
  });

  const handleImport = async () => {
    if (!parseResult || parseResult.validRows === 0) {
      toast.error('Nenhuma linha válida para importar');
      return;
    }

    const priceTable: PriceTableImportInput =
      targetMode === 'new'
        ? { id: 'new', name: newTableName.trim(), modality, active: setAsActive }
        : {
            id: selectedTableId,
            name: existingTables?.find((t) => t.id === selectedTableId)?.name || '',
            modality:
              (existingTables?.find((t) => t.id === selectedTableId)?.modality as
                | 'lotacao'
                | 'fracionado') || modality,
            active: setAsActive,
          };

    if (targetMode === 'new' && !priceTable.name) {
      toast.error('Nome da tabela é obrigatório');
      return;
    }

    setStep('importing');

    try {
      const result = await importMutation.mutateAsync({
        priceTable,
        rows: parseResult.rows,
        importMode,
      });

      if (result.success) {
        setStep('done');
        const duplicateMsg =
          result.duplicatesRemoved > 0
            ? `, ${result.duplicatesRemoved} duplicata(s) removida(s)`
            : '';
        toast.success(
          `Importação concluída: ${result.rowsInserted} inserida(s), ${result.rowsUpdated} atualizada(s)${duplicateMsg}`
        );
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        setStep('preview');
        toast.error(`Erro na importação: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      setStep('preview');
      toast.error(
        `Erro ao importar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      );
    }
  };

  const filteredTables = existingTables?.filter((t) => t.modality === modality) || [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn('max-h-[90vh] overflow-hidden flex flex-col', modality === 'fracionado' ? 'max-w-6xl' : 'max-w-4xl')}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Faixas de Preço
          </DialogTitle>
          <DialogDescription>
            Importe faixas de KM de um arquivo CSV ou Excel (XLSX/XLSM)
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6 py-4">
            {/* Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Destino</Label>
                <Select
                  value={targetMode}
                  onValueChange={(v) => setTargetMode(v as 'new' | 'existing')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Criar nova tabela</SelectItem>
                    <SelectItem value="existing">Atualizar tabela existente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Modalidade</Label>
                <Select
                  value={modality}
                  onValueChange={(v) => {
                    setModality(v as 'lotacao' | 'fracionado');
                    setSelectedTableId('');
                  }}
                  disabled={targetMode === 'existing' && !!selectedTableId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lotacao">Lotação</SelectItem>
                    <SelectItem value="fracionado">Fracionado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {targetMode === 'new' ? (
              <div className="space-y-2">
                <Label>Nome da Nova Tabela</Label>
                <Input
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="Ex: Tabela Sul 2025 v2"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Tabela Existente</Label>
                <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma tabela" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        {table.name} (v{table.version}) {table.active && '• Ativa'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/30'
              )}
            >
              <input {...getInputProps()} />
              <Upload
                className={cn(
                  'w-10 h-10 mx-auto mb-3 transition-colors',
                  isDragActive ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <p className="text-foreground font-medium mb-1">
                {isDragActive
                  ? 'Solte o arquivo aqui'
                  : 'Arraste um arquivo ou clique para selecionar'}
              </p>
              <p className="text-sm text-muted-foreground">
                CSV (separador ;) ou Excel (XLSX, XLSM) • Máximo 10MB
              </p>
            </div>

            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <p className="font-medium mb-1">Colunas esperadas:</p>
              {modality === 'fracionado' ? (
                <p>
                  km_from, km_to, custo_peso, weight_rate_10, weight_rate_20, weight_rate_30,
                  weight_rate_50, weight_rate_70, weight_rate_100, weight_rate_150, weight_rate_200,
                  weight_rate_above_200, cost_value_percent, tso_percent
                </p>
              ) : (
                <p>
                  km_from, km_to (ou faixa), cost_per_ton, cost_per_kg, gris_percent, tso_percent
                  (ou ad_valorem_percent), toll_percent
                </p>
              )}
            </div>
          </div>
        )}

        {step === 'preview' && parseResult && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4 py-4">
            {/* Summary */}
            <div className="flex items-center gap-4 flex-wrap">
              <Badge variant="outline" className="gap-1">
                <FileSpreadsheet className="h-3 w-3" />
                {selectedFile?.name}
              </Badge>
              <Badge variant="default">{parseResult.totalRows} linhas</Badge>
              <Badge variant="secondary" className="text-success">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {parseResult.validRows} válidas
              </Badge>
              {parseResult.invalidRows > 0 && (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  {parseResult.invalidRows} inválidas
                </Badge>
              )}
            </div>

            {/* Import Mode */}
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1">
                <Label>Modo de Importação</Label>
                <Select
                  value={importMode}
                  onValueChange={(v) => setImportMode(v as 'replace' | 'upsert')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="replace">Substituir todas as faixas</SelectItem>
                    <SelectItem value="upsert">Atualizar/inserir por faixa KM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="setAsActive"
                  checked={setAsActive}
                  onChange={(e) => setSetAsActive(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="setAsActive" className="text-sm cursor-pointer">
                  Ativar tabela após importação
                </Label>
              </div>
            </div>

            {/* Preview Table */}
            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>KM De</TableHead>
                    <TableHead>KM Até</TableHead>
                    {modality === 'fracionado' ? (
                      <>
                        <TableHead className="text-xs">R$/Ton</TableHead>
                        <TableHead className="text-xs">≤10kg</TableHead>
                        <TableHead className="text-xs">11-20</TableHead>
                        <TableHead className="text-xs">21-30</TableHead>
                        <TableHead className="text-xs">31-50</TableHead>
                        <TableHead className="text-xs">51-70</TableHead>
                        <TableHead className="text-xs">71-100</TableHead>
                        <TableHead className="text-xs">101-150</TableHead>
                        <TableHead className="text-xs">151-200</TableHead>
                        <TableHead className="text-xs">&gt;200 R$/kg</TableHead>
                        <TableHead className="text-xs">Custo Valor%</TableHead>
                        <TableHead className="text-xs">TSO %</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>R$/Ton</TableHead>
                        <TableHead>R$/Kg</TableHead>
                        <TableHead>GRIS %</TableHead>
                        <TableHead>TSO %</TableHead>
                        <TableHead>Pedágio %</TableHead>
                      </>
                    )}
                    <TableHead className="w-20">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parseResult.rows.slice(0, 100).map((row, idx) => (
                    <TableRow key={idx} className={cn(!row.isValid && 'bg-destructive/10')}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>{row.km_from}</TableCell>
                      <TableCell>{row.km_to}</TableCell>
                      {modality === 'fracionado' ? (
                        <>
                          <TableCell className="text-xs">{row.cost_per_ton?.toFixed(2) ?? '-'}</TableCell>
                          <TableCell className="text-xs">{row.weight_rate_10?.toFixed(2) ?? '-'}</TableCell>
                          <TableCell className="text-xs">{row.weight_rate_20?.toFixed(2) ?? '-'}</TableCell>
                          <TableCell className="text-xs">{row.weight_rate_30?.toFixed(2) ?? '-'}</TableCell>
                          <TableCell className="text-xs">{row.weight_rate_50?.toFixed(2) ?? '-'}</TableCell>
                          <TableCell className="text-xs">{row.weight_rate_70?.toFixed(2) ?? '-'}</TableCell>
                          <TableCell className="text-xs">{row.weight_rate_100?.toFixed(2) ?? '-'}</TableCell>
                          <TableCell className="text-xs">{row.weight_rate_150?.toFixed(2) ?? '-'}</TableCell>
                          <TableCell className="text-xs">{row.weight_rate_200?.toFixed(2) ?? '-'}</TableCell>
                          <TableCell className="text-xs">{row.weight_rate_above_200?.toFixed(4) ?? '-'}</TableCell>
                          <TableCell className="text-xs">{row.cost_value_percent?.toFixed(2) ?? '-'}</TableCell>
                          <TableCell className="text-xs">{row.tso_percent?.toFixed(2) ?? '-'}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>{row.cost_per_ton?.toFixed(2) ?? '-'}</TableCell>
                          <TableCell>{row.cost_per_kg?.toFixed(4) ?? '-'}</TableCell>
                          <TableCell>{row.gris_percent?.toFixed(2) ?? '-'}</TableCell>
                          <TableCell>{row.tso_percent?.toFixed(2) ?? '-'}</TableCell>
                          <TableCell>{row.toll_percent?.toFixed(2) ?? '-'}</TableCell>
                        </>
                      )}
                      <TableCell>
                        {row.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <span title={row.errors.join(', ')}>
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parseResult.rows.length > 100 && (
                <div className="p-2 text-center text-sm text-muted-foreground bg-muted">
                  Mostrando 100 de {parseResult.rows.length} linhas
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Importando...</p>
            <Progress value={50} className="w-64" />
          </div>
        )}

        {step === 'done' && (
          <div className="py-12 flex flex-col items-center gap-4">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <p className="text-lg font-medium">Importação concluída!</p>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Voltar
              </Button>
              <Button
                onClick={handleImport}
                disabled={
                  !parseResult ||
                  parseResult.validRows === 0 ||
                  (targetMode === 'existing' && !selectedTableId)
                }
              >
                Importar {parseResult?.validRows || 0} linhas
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
