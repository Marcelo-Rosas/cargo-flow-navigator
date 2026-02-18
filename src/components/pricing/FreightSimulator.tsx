import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Calculator,
  Loader2,
  AlertTriangle,
  Package,
  Scale,
  Truck,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCalculateFreight, type CalculateFreightResponse } from '@/hooks/useCalculateFreight';
import { usePriceTables } from '@/hooks/usePriceTables';
import { useVehicleTypes, usePaymentTerms, useConditionalFees } from '@/hooks/usePricingRules';

export function FreightSimulator() {
  const calculateFreight = useCalculateFreight();
  const { data: priceTables } = usePriceTables();
  const { data: vehicleTypes } = useVehicleTypes();
  const { data: paymentTerms } = usePaymentTerms();
  const { data: conditionalFees } = useConditionalFees();

  // Form state
  const [origin, setOrigin] = useState('São Paulo - SP');
  const [destination, setDestination] = useState('Curitiba - PR');
  const [weightValue, setWeightValue] = useState('10');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'ton'>('ton');
  const [volumeM3, setVolumeM3] = useState('8');
  const [cargoValue, setCargoValue] = useState('50000');
  const [kmDistance, setKmDistance] = useState('450');
  const [tollValue, setTollValue] = useState('0');
  const [priceTableId, setPriceTableId] = useState('');
  const [vehicleTypeCode, setVehicleTypeCode] = useState('');
  const [paymentTermCode, setPaymentTermCode] = useState('');
  const [selectedFees, setSelectedFees] = useState<string[]>([]);
  const [waitingHours, setWaitingHours] = useState('0');
  const [tdeEnabled, setTdeEnabled] = useState(false);
  const [tearEnabled, setTearEnabled] = useState(false);

  // Result
  const [result, setResult] = useState<CalculateFreightResponse | null>(null);

  const activeTables = priceTables?.filter((t) => t.active) || [];

  const handleCalculate = async () => {
    try {
      const rawWeight = parseFloat(weightValue) || 0;
      const weightKgValue = weightUnit === 'ton' ? rawWeight * 1000 : rawWeight;
      const response = await calculateFreight.mutateAsync({
        origin,
        destination,
        weight_kg: weightKgValue,
        volume_m3: parseFloat(volumeM3) || 0,
        cargo_value: parseFloat(cargoValue) || 0,
        km_distance: kmDistance ? parseFloat(kmDistance) : 0,
        toll_value: parseFloat(tollValue) || 0,
        price_table_id: priceTableId || undefined,
        vehicle_type_code: vehicleTypeCode || undefined,
        payment_term_code: paymentTermCode || undefined,
        tde_enabled: tdeEnabled,
        tear_enabled: tearEnabled,
        conditional_fees: selectedFees.length > 0 ? selectedFees : undefined,
        waiting_hours: waitingHours ? parseFloat(waitingHours) : undefined,
      });
      setResult(response);
    } catch (error) {
      toast.error('Erro ao calcular frete');
    }
  };

  const toggleFee = (code: string) => {
    setSelectedFees((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getMarginBadgeVariant = (status: string) => {
    switch (status) {
      case 'ABOVE_TARGET':
        return 'default';
      case 'BELOW_TARGET':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Entrada
          </CardTitle>
          <CardDescription>Preencha os dados da simulação</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Location */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Localização
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Origem</Label>
                <Input
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="Cidade - UF"
                />
              </div>
              <div className="space-y-2">
                <Label>Destino</Label>
                <Input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Cidade - UF"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Cargo */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Package className="h-4 w-4" />
              Carga
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Peso ({weightUnit})</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={weightValue}
                    onChange={(e) => setWeightValue(e.target.value)}
                  />
                  <ToggleGroup
                    type="single"
                    value={weightUnit}
                    onValueChange={(v) => v && setWeightUnit(v as 'kg' | 'ton')}
                    size="sm"
                    className="shrink-0"
                  >
                    <ToggleGroupItem value="kg" className="text-xs px-2">
                      kg
                    </ToggleGroupItem>
                    <ToggleGroupItem value="ton" className="text-xs px-2">
                      ton
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Volume (m³)</Label>
                <Input
                  type="number"
                  value={volumeM3}
                  onChange={(e) => setVolumeM3(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  value={cargoValue}
                  onChange={(e) => setCargoValue(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Configuration */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Truck className="h-4 w-4" />
              Configuração
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Distância (km)</Label>
                <Input
                  type="number"
                  value={kmDistance}
                  onChange={(e) => setKmDistance(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Pedágio (R$)</Label>
                <Input
                  type="number"
                  value={tollValue}
                  onChange={(e) => setTollValue(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tabela de Preço</Label>
                <Select value={priceTableId} onValueChange={setPriceTableId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma</SelectItem>
                    {activeTables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        {table.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Veículo</Label>
                <Select value={vehicleTypeCode} onValueChange={setVehicleTypeCode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Padrão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Padrão</SelectItem>
                    {vehicleTypes?.map((v) => (
                      <SelectItem key={v.id} value={v.code}>
                        {v.code} - {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prazo de Pagamento</Label>
              <Select value={paymentTermCode} onValueChange={setPaymentTermCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Padrão (D30)</SelectItem>
                  {paymentTerms?.map((t) => (
                    <SelectItem key={t.id} value={t.code}>
                      {t.name} ({t.adjustment_percent > 0 ? '+' : ''}
                      {t.adjustment_percent}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* NTC Fees */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Scale className="h-4 w-4" />
              Taxas NTC (20% sobre frete base)
            </div>
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tde"
                  checked={tdeEnabled}
                  onCheckedChange={(c) => setTdeEnabled(!!c)}
                />
                <label htmlFor="tde" className="text-sm font-medium">
                  TDE
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tear"
                  checked={tearEnabled}
                  onCheckedChange={(c) => setTearEnabled(!!c)}
                />
                <label htmlFor="tear" className="text-sm font-medium">
                  TEAR
                </label>
              </div>
            </div>
          </div>

          {/* Conditional Fees */}
          {conditionalFees && conditionalFees.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">Taxas Condicionais</div>
                <div className="grid grid-cols-2 gap-3">
                  {conditionalFees.map((fee) => (
                    <div key={fee.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={fee.code}
                        checked={selectedFees.includes(fee.code)}
                        onCheckedChange={() => toggleFee(fee.code)}
                      />
                      <label
                        htmlFor={fee.code}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {fee.code} - {fee.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Waiting Time */}
          <div className="space-y-2">
            <Label>Horas de Estadia</Label>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={waitingHours}
              onChange={(e) => setWaitingHours(e.target.value)}
            />
          </div>

          <Button
            onClick={handleCalculate}
            className="w-full"
            disabled={calculateFreight.isPending}
          >
            {calculateFreight.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Calcular Frete
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Resultado</CardTitle>
          <CardDescription>Breakdown detalhado do cálculo</CardDescription>
        </CardHeader>
        <CardContent>
          {!result ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Calculator className="h-12 w-12 mb-4 opacity-50" />
              <p>Preencha os dados e clique em Calcular</p>
            </div>
          ) : !result.success ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {result.errors?.join(', ') || result.error || 'Erro no cálculo'}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              {/* Meta Badges */}
              {result.meta && (
                <div className="flex flex-wrap gap-2">
                  {result.meta.route_uf_label && (
                    <Badge variant="outline">{result.meta.route_uf_label}</Badge>
                  )}
                  {result.meta.km_band_label && (
                    <Badge variant="outline">{result.meta.km_band_label} km</Badge>
                  )}
                  <Badge variant={getMarginBadgeVariant(result.meta.margin_status)}>
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Margem: {result.meta.margin_percent.toFixed(1)}%
                  </Badge>
                </div>
              )}

              {/* Weight */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">PESO</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Real</p>
                    <p className="font-medium">
                      {(
                        (weightUnit === 'ton'
                          ? parseFloat(weightValue) * 1000
                          : parseFloat(weightValue)) || 0
                      ).toLocaleString('pt-BR')}{' '}
                      kg
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cubado</p>
                    <p className="font-medium">
                      {result.meta.cubage_weight_kg.toLocaleString('pt-BR')} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Taxável</p>
                    <p className="font-semibold text-primary">
                      {result.meta.billable_weight_kg.toLocaleString('pt-BR')} kg
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Components */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">COMPONENTES</h4>
                <div className="space-y-2">
                  <BreakdownRow label="Custo Base" value={result.components.base_cost} />
                  <BreakdownRow
                    label={`Frete Base (+${result.rates.markup_percent}%)`}
                    value={result.components.base_freight}
                  />
                  <BreakdownRow label="Pedágio" value={result.components.toll} />
                  <BreakdownRow
                    label={`GRIS (${result.rates.gris_percent}%)`}
                    value={result.components.gris}
                  />
                  <BreakdownRow
                    label={`TSO (${result.rates.tso_percent}%)`}
                    value={result.components.tso}
                  />
                  <BreakdownRow
                    label={`RCTR-C (${result.rates.cost_value_percent}%)`}
                    value={result.components.rctrc}
                  />
                  <BreakdownRow label="TDE (20%)" value={result.components.tde} />
                  <BreakdownRow label="TEAR (20%)" value={result.components.tear} />
                  <BreakdownRow
                    label="Taxas Condicionais"
                    value={result.components.conditional_fees_total}
                  />
                  <BreakdownRow label="Estadia" value={result.components.waiting_time_cost} />
                </div>
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">TOTAIS</h4>
                <div className="space-y-2">
                  <BreakdownRow label="Receita Bruta" value={result.totals.receita_bruta} />
                  {result.totals.tac_adjustment > 0 && (
                    <BreakdownRow
                      label={`TAC (${result.rates.tac_percent}%)`}
                      value={result.totals.tac_adjustment}
                    />
                  )}
                  {result.totals.payment_adjustment > 0 && (
                    <BreakdownRow
                      label={`Prazo (${result.rates.payment_adjustment_percent}%)`}
                      value={result.totals.payment_adjustment}
                    />
                  )}
                  <BreakdownRow
                    label={`Provisionamento DAS (${result.rates.das_percent}%)`}
                    value={result.totals.das}
                  />
                  <BreakdownRow
                    label={`ICMS (${result.rates.icms_percent}%)`}
                    value={result.totals.icms}
                  />
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">TOTAL CLIENTE</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(result.totals.total_cliente)}
                  </span>
                </div>
              </div>

              {/* Profitability */}
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">RENTABILIDADE</h4>
                <div className="space-y-2">
                  <BreakdownRow
                    label="Custos Diretos"
                    value={result.profitability.custos_diretos}
                    negative
                  />
                  <BreakdownRow label="Margem Bruta" value={result.profitability.margem_bruta} />
                  <BreakdownRow
                    label={`Overhead (${result.rates.overhead_percent}%)`}
                    value={result.profitability.overhead}
                    negative
                  />
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="font-medium">Resultado Líquido</span>
                    <span
                      className={`font-bold ${result.profitability.resultado_liquido >= 0 ? 'text-green-600' : 'text-destructive'}`}
                    >
                      {formatCurrency(result.profitability.resultado_liquido)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fallbacks */}
              {result.fallbacks_applied && result.fallbacks_applied.length > 0 && (
                <>
                  <Separator />
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium mb-2">Fallbacks aplicados:</p>
                      <ul className="text-sm space-y-1">
                        {result.fallbacks_applied.map((fallback, i) => (
                          <li key={i}>• {fallback}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                </>
              )}

              {/* Parameters Used */}
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">Parâmetros utilizados:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Cubagem: {result.meta.cubage_factor} kg/m³</Badge>
                  <Badge variant="outline">DAS: {result.rates.das_percent}%</Badge>
                  <Badge variant="outline">Markup: {result.rates.markup_percent}%</Badge>
                  <Badge variant="outline">ICMS: {result.rates.icms_percent}%</Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  negative,
}: {
  label: string;
  value: number;
  negative?: boolean;
}) {
  if (value === 0) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={negative ? 'text-destructive' : ''}>
        {negative ? '-' : ''}
        {formatCurrency(value)}
      </span>
    </div>
  );
}
