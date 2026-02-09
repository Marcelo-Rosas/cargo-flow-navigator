import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Clock, Receipt } from 'lucide-react';
import { useConditionalFees, useWaitingTimeRules } from '@/hooks/usePricingRules';
import type { ConditionalFee, WaitingTimeRule } from '@/types/pricing';

export interface AdditionalFeesSelection {
  conditionalFees: string[]; // Array of fee IDs
  waitingTimeEnabled: boolean;
  waitingTimeHours: number;
  waitingTimeCost: number;
}

interface AdditionalFeesSectionProps {
  selection: AdditionalFeesSelection;
  onChange: (selection: AdditionalFeesSelection) => void;
  baseFreight?: number; // For calculating fee values
  cargoValue?: number;  // For calculating fee values
  vehicleTypeId?: string; // For filtering waiting time rules
  readOnly?: boolean;
}

export function AdditionalFeesSection({
  selection,
  onChange,
  baseFreight = 0,
  cargoValue = 0,
  vehicleTypeId,
  readOnly = false,
}: AdditionalFeesSectionProps) {
  const { data: conditionalFees } = useConditionalFees(true);
  const { data: waitingTimeRules } = useWaitingTimeRules();

  // Get applicable waiting time rule
  const applicableWaitingRule = waitingTimeRules?.find(
    rule => rule.vehicle_type_id === vehicleTypeId || rule.vehicle_type_id === null
  );

  // Calculate fee value based on type
  const calculateFeeValue = (fee: ConditionalFee): number => {
    switch (fee.fee_type) {
      case 'percentage':
        if (fee.applies_to === 'freight') return baseFreight * (fee.fee_value / 100);
        if (fee.applies_to === 'cargo_value') return cargoValue * (fee.fee_value / 100);
        return (baseFreight + cargoValue) * (fee.fee_value / 100);
      case 'fixed':
        return fee.fee_value;
      case 'per_kg':
        return fee.fee_value; // Would need weight to calculate
      default:
        return fee.fee_value;
    }
  };

  // Calculate waiting time cost
  const calculateWaitingCost = (hours: number): number => {
    if (!applicableWaitingRule || hours <= applicableWaitingRule.free_hours) return 0;
    
    const billableHours = hours - applicableWaitingRule.free_hours;
    const hourlyRate = applicableWaitingRule.rate_per_hour || 0;
    const dailyRate = applicableWaitingRule.rate_per_day || 0;
    const minCharge = applicableWaitingRule.min_charge || 0;
    
    let cost = 0;
    if (hourlyRate > 0) {
      cost = billableHours * hourlyRate;
    } else if (dailyRate > 0) {
      const days = Math.ceil(billableHours / 24);
      cost = days * dailyRate;
    }
    
    return Math.max(cost, minCharge);
  };

  const handleFeeToggle = (feeId: string, checked: boolean) => {
    const newFees = checked
      ? [...selection.conditionalFees, feeId]
      : selection.conditionalFees.filter(id => id !== feeId);
    
    onChange({ ...selection, conditionalFees: newFees });
  };

  const handleWaitingTimeToggle = (checked: boolean) => {
    const cost = checked ? calculateWaitingCost(selection.waitingTimeHours) : 0;
    onChange({
      ...selection,
      waitingTimeEnabled: checked,
      waitingTimeCost: cost,
    });
  };

  const handleWaitingHoursChange = (hours: number) => {
    const cost = selection.waitingTimeEnabled ? calculateWaitingCost(hours) : 0;
    onChange({
      ...selection,
      waitingTimeHours: hours,
      waitingTimeCost: cost,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Conditional Fees */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="w-4 h-4 text-muted-foreground" />
          <h5 className="font-medium text-foreground">Taxas Condicionais</h5>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {conditionalFees?.map((fee) => {
            const isSelected = selection.conditionalFees.includes(fee.id);
            const feeValue = calculateFeeValue(fee);
            
            return (
              <div
                key={fee.id}
                className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30 border border-border"
              >
                <Checkbox
                  id={`fee-${fee.id}`}
                  checked={isSelected}
                  onCheckedChange={(checked) => handleFeeToggle(fee.id, !!checked)}
                  disabled={readOnly}
                />
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={`fee-${fee.id}`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {fee.name}
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {fee.code}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {fee.fee_type === 'percentage' 
                        ? `${fee.fee_value}%` 
                        : formatCurrency(fee.fee_value)}
                    </span>
                  </div>
                  {isSelected && feeValue > 0 && (
                    <p className="text-xs text-primary font-medium mt-1">
                      {formatCurrency(feeValue)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {(!conditionalFees || conditionalFees.length === 0) && (
          <p className="text-sm text-muted-foreground">
            Nenhuma taxa condicional cadastrada
          </p>
        )}
      </div>

      {/* Waiting Time */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h5 className="font-medium text-foreground">Estadia / Hora Parada</h5>
        </div>
        
        <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-4">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="waiting-time"
              checked={selection.waitingTimeEnabled}
              onCheckedChange={(checked) => handleWaitingTimeToggle(!!checked)}
              disabled={readOnly}
            />
            <div className="flex-1">
              <Label
                htmlFor="waiting-time"
                className="text-sm font-medium cursor-pointer"
              >
                Aplicar cobrança de estadia
              </Label>
              {applicableWaitingRule && (
                <p className="text-xs text-muted-foreground mt-1">
                  Franquia: {applicableWaitingRule.free_hours}h | 
                  Taxa: {applicableWaitingRule.rate_per_hour 
                    ? `${formatCurrency(applicableWaitingRule.rate_per_hour)}/h`
                    : `${formatCurrency(applicableWaitingRule.rate_per_day || 0)}/dia`
                  }
                </p>
              )}
            </div>
          </div>
          
          {selection.waitingTimeEnabled && (
            <div className="ml-6 space-y-3">
              <div className="flex items-center gap-3">
                <Label htmlFor="waiting-hours" className="text-sm whitespace-nowrap">
                  Horas de espera:
                </Label>
                <Input
                  id="waiting-hours"
                  type="number"
                  min={0}
                  step={0.5}
                  value={selection.waitingTimeHours}
                  onChange={(e) => handleWaitingHoursChange(parseFloat(e.target.value) || 0)}
                  className="w-24"
                  disabled={readOnly}
                />
              </div>
              
              {selection.waitingTimeCost > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Custo de estadia:</span>
                  <span className="font-medium text-primary">
                    {formatCurrency(selection.waitingTimeCost)}
                  </span>
                </div>
              )}
              
              {selection.waitingTimeHours > 0 && applicableWaitingRule && 
               selection.waitingTimeHours <= applicableWaitingRule.free_hours && (
                <p className="text-xs text-muted-foreground">
                  Dentro da franquia de {applicableWaitingRule.free_hours}h (sem custo)
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Total Additional Fees Summary */}
      {(selection.conditionalFees.length > 0 || selection.waitingTimeCost > 0) && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Total Taxas Adicionais:</span>
            <span className="font-semibold text-primary">
              {formatCurrency(
                selection.conditionalFees.reduce((sum, feeId) => {
                  const fee = conditionalFees?.find(f => f.id === feeId);
                  return sum + (fee ? calculateFeeValue(fee) : 0);
                }, 0) + selection.waitingTimeCost
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Default selection
export const defaultAdditionalFeesSelection: AdditionalFeesSelection = {
  conditionalFees: [],
  waitingTimeEnabled: false,
  waitingTimeHours: 0,
  waitingTimeCost: 0,
};
