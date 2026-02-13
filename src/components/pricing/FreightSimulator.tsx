import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';

import { useCalculateFreight } from '@/hooks/useCalculateFreight';
import { usePriceTables } from '@/hooks/usePriceTables';
import { useVehicleTypes, usePaymentTerms, useConditionalFees } from '@/hooks/usePricingRules';
import type { CalculateFreightResponse, FreightBreakdown } from '@/types/pricing';

export function FreightSimulator() {
  const calculateFreight = useCalculateFreight();
  const { data: priceTables } = usePriceTables();
  const { data: vehicleTypes } = useVehicleTypes();
  const { data: paymentTerms } = usePaymentTerms();
  const { data: conditionalFees } = useConditionalFees();

  // Form state
  const [origin, setOrigin] = useState('São Paulo - SP');
  const [destination, setDestination] = useState('Curitiba - PR');
  const [weightKg, setWeightKg] = useState('1500');
  const [volumeM3, setVolumeM3] = useState('8');
  const [cargoValue, setCargoValue] = useState('50000');
  const [kmDistance, setKmDistance] = useState('450');
  const [priceTableId, setPriceTableId] = useState('');
  const [vehicleTypeCode, setVehicleTypeCode] = useState('');
  const [paymentTermCode, setPaymentTermCode] = useState('');
  const [selectedFees, setSelectedFees] = useState<string[]>([]);
  const [waitingHours, setWaitingHours] = useState('0');

  // Result
  const [result, setResult] = useState<CalculateFreightResponse | null>(null);

  const activeTables = priceTables?.filter(t => t.active) || [];

  const handleCalculate = async () => {
    try {
      const response = await calculateFreight.mutateAsync({
        origin,
        destination,
        weight_kg: parseFloat(weightKg) || 0,
        volume_m3: parseFloat(volumeM3) || 0,
        cargo_value: parseFloat(cargoValue) || 0,
        km_distance: kmDistance ? parseFloat(kmDistance) : undefined,
        price_table_id: priceTableId || undefined,
        vehicle_type_code: vehicleTypeCode || undefined,
        payment_term_code: paymentTermCode || undefined,
        conditional_fees: selectedFees.length > 0 ? selectedFees : undefined,
        waiting_hours: waitingHours ? parseFloat(waitingHours) : undefined,
      });
      setResult(response);
    } catch (error) {
      toast.error('Erro ao calcular frete');
    }
  };

  const toggleFee = (code: string) => {
    setSelectedFees(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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
          <CardDescription>
            Preencha os dados da simulação
          </CardDescription>
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
                <Label>Peso (kg)</Label>
                <Input
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
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
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                        {t.name} ({t.adjustment_percent > 0 ? '+' : ''}{t.adjustment_percent}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Conditional Fees */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Scale className="h-4 w-4" />
              Taxas Condicionais
            </div>
            <div className="grid grid-cols-2 gap-3">
              {conditionalFees?.map((fee) => (
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
          <CardDescription>
            Breakdown detalhado do cálculo
          </CardDescription>
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
                {result.errors?.join(', ') || 'Erro no cálculo'}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              {/* Weight */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">PESO</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Real</p>
                    <p className="font-medium">{result.breakdown.weight_real.toLocaleString('pt-BR')} kg</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cubado</p>
                    <p className="font-medium">{result.breakdown.weight_cubed.toLocaleString('pt-BR')} kg</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Taxável</p>
                    <p className="font-semibold text-primary">{result.breakdown.weight_billable.toLocaleString('pt-BR')} kg</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Components */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">COMPONENTES</h4>
                <div className="space-y-2">
                  <BreakdownRow label="Frete Base" value={result.breakdown.base_freight} />
                  {result.breakdown.correction_factor !== 1 && (
                    <BreakdownRow
                      label={`Fator INCTF (×${result.breakdown.correction_factor})`}
                      value={result.breakdown.base_freight_adjusted}
                    />
                  )}
                  <BreakdownRow
                    label={`TAC (${result.parameters_used.tac_percent}% — ${result.parameters_used.tac_steps} degrau${result.parameters_used.tac_steps !== 1 ? 's' : ''}, diesel ${result.parameters_used.diesel_variation_percent.toFixed(1)}%)`}
                    value={result.breakdown.tac_adjustment}
                  />
                  <BreakdownRow label="GRIS" value={result.breakdown.gris} />
                  <BreakdownRow label="Ad Valorem" value={result.breakdown.ad_valorem} />
                  <BreakdownRow label="Pedágio" value={result.breakdown.toll} />
                  <BreakdownRow label="Estadia" value={result.breakdown.waiting_time} />

                  {/* Conditional Fees */}
                  {Object.entries(result.breakdown.conditional_fees).map(([code, value]) => (
                    <BreakdownRow key={code} label={code} value={value as number} />
                  ))}
                </div>
              </div>

              <Separator />

              {/* Subtotal, Payment, ICMS & Total */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(result.breakdown.subtotal)}</span>
                </div>
                <BreakdownRow
                  label={`Prazo ${result.parameters_used.payment_term}`}
                  value={result.breakdown.payment_adjustment}
                />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Base ICMS (excl. pedágio)</span>
                  <span>{formatCurrency(result.breakdown.icms_base)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">ICMS ({result.parameters_used.icms_rate}%)</span>
                  <span className="font-medium">{formatCurrency(result.breakdown.icms)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">TOTAL</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(result.breakdown.total)}
                  </span>
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
                  <Badge variant="outline">Cubagem: {result.parameters_used.cubage_factor} kg/m³</Badge>
                  <Badge variant="outline">INCTF: {result.parameters_used.correction_factor_inctf}</Badge>
                  <Badge variant="outline">ICMS: {result.parameters_used.icms_rate}%</Badge>
                  <Badge variant="outline">TAC: {result.parameters_used.tac_percent}% ({result.parameters_used.tac_steps}×1,75%)</Badge>
                  <Badge variant="outline">Diesel: {result.parameters_used.diesel_variation_percent.toFixed(1)}%</Badge>
                  <Badge variant="outline">Prazo: {result.parameters_used.payment_term}</Badge>
                  <Badge variant="outline">Franquia: {result.parameters_used.waiting_free_hours}h</Badge>
                  {result.parameters_used.vehicle_type && (
                    <Badge variant="outline">Veículo: {result.parameters_used.vehicle_type}</Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
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
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
