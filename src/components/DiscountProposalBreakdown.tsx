/**
 * Component: DiscountProposalBreakdown
 * Displays discount proposals per shipper respecting margin rules
 * Shows: original price, max discount, offered discount, final price & margin
 */

import React, { useMemo } from 'react';
import { DiscountProposal } from '@/hooks/useLoadCompositionSuggestions';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, TrendingDown, DollarSign } from 'lucide-react';

export interface DiscountProposalBreakdownProps {
  discounts: DiscountProposal[];
  minimumMarginPercent: number;
}

export function DiscountProposalBreakdown({
  discounts,
  minimumMarginPercent,
}: DiscountProposalBreakdownProps) {
  const summary = useMemo(() => {
    const totalOriginal = discounts.reduce((sum, d) => sum + d.original_quote_price_brl, 0);
    const totalDiscount = discounts.reduce((sum, d) => sum + d.discount_offered_brl, 0);
    const totalFinal = discounts.reduce((sum, d) => sum + d.final_quote_price_brl, 0);
    const avgMargin =
      discounts.reduce((sum, d) => sum + d.final_margin_percent, 0) / discounts.length;
    const minMargin = Math.min(...discounts.map((d) => d.final_margin_percent));
    const violatingMargin = discounts.filter((d) => d.final_margin_percent < minimumMarginPercent);

    return {
      totalOriginal,
      totalDiscount,
      totalFinal,
      avgMargin,
      minMargin,
      violatingMarginCount: violatingMargin.length,
    };
  }, [discounts, minimumMarginPercent]);

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
          <div className="text-xs font-medium text-blue-600 mb-1">Preço Original Total</div>
          <div className="text-lg font-bold text-blue-700">
            R$ {(summary.totalOriginal / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-green-50 p-3 rounded-lg border border-green-100">
          <div className="text-xs font-medium text-green-600 mb-1">Total de Desconto</div>
          <div className="text-lg font-bold text-green-700">
            R$ {(summary.totalDiscount / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 col-span-2">
          <div className="text-xs font-medium text-purple-600 mb-1">Preço Final</div>
          <div className="text-lg font-bold text-purple-700">
            R$ {(summary.totalFinal / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Margin Analysis */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
        <div className="flex items-start gap-2">
          <TrendingDown className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-orange-900">Análise de Margem</p>
            <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
              <div>
                <span className="text-orange-700">Mínimo Requerido:</span>
                <p className="font-semibold text-orange-900">{minimumMarginPercent.toFixed(1)}%</p>
              </div>
              <div>
                <span className="text-orange-700">Margem Média Final:</span>
                <p className="font-semibold text-orange-900">{summary.avgMargin.toFixed(1)}%</p>
              </div>
              <div>
                <span className="text-orange-700">Margem Mínima:</span>
                <p className="font-semibold text-orange-900">{summary.minMargin.toFixed(1)}%</p>
              </div>
            </div>

            {summary.violatingMarginCount > 0 && (
              <div className="mt-2 p-2 bg-red-100 rounded text-red-800 text-xs">
                ⚠️ {summary.violatingMarginCount} proposta(s) violariam margem mínima - desconto
                ajustado
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-gray-700">Proposta de Desconto por Embarcador</h4>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-2 text-left font-semibold text-gray-700">#</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Preço Original</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Margem Atual</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700">Desconto</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Preço Final</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Margem Final</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {discounts
                .sort((a, b) => b.original_quote_price_brl - a.original_quote_price_brl)
                .map((discount, idx) => (
                  <tr
                    key={discount.id}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50 hover:bg-gray-100'}
                  >
                    {/* Index */}
                    <td className="px-3 py-2 font-medium text-gray-700">{idx + 1}</td>

                    {/* Original Price */}
                    <td className="px-3 py-2 font-medium text-gray-900">
                      R${' '}
                      {(discount.original_quote_price_brl / 100).toLocaleString('pt-BR', {
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    {/* Original Margin */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-gray-900">
                          {discount.original_margin_percent.toFixed(1)}%
                        </span>
                        <span className="text-xs text-gray-600">
                          (R$
                          {(discount.original_margin_brl / 100).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          )
                        </span>
                      </div>
                    </td>

                    {/* Discount Offered */}
                    <td className="px-3 py-2 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-green-700">
                          -R${' '}
                          {(discount.discount_offered_brl / 100).toLocaleString('pt-BR', {
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-xs text-gray-600">
                          ({discount.discount_percent.toFixed(2)}%)
                        </span>
                      </div>
                    </td>

                    {/* Final Price */}
                    <td className="px-3 py-2 font-bold text-blue-700">
                      R${' '}
                      {(discount.final_quote_price_brl / 100).toLocaleString('pt-BR', {
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    {/* Final Margin */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <span
                            className={`font-semibold text-sm ${
                              discount.final_margin_percent >= minimumMarginPercent
                                ? 'text-green-700'
                                : 'text-red-700'
                            }`}
                          >
                            {discount.final_margin_percent.toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-600">
                            R$
                            {(discount.final_margin_brl / 100).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2 text-center">
                      {discount.is_feasible ? (
                        <div className="flex justify-center">
                          <Badge className="bg-green-100 text-green-800 gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Viável
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <Badge className="bg-red-100 text-red-800 gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Crítica
                          </Badge>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warnings */}
      <div className="space-y-2">
        {discounts.flatMap((d, idx) =>
          d.validation_warnings.map((warning, wIdx) => (
            <div
              key={`${idx}-${wIdx}`}
              className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-yellow-800">
                  Quote {discounts[idx].quote_id.slice(0, 8)}...
                </p>
                <p className="text-xs text-yellow-700 mt-1">{warning}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info Footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
        <p>
          <strong>💡 Regra de Margem:</strong> Todos os descontos respeitam a margem mínima de{' '}
          {minimumMarginPercent}%. Se o desconto ideal violaria a margem, o desconto é reduzido
          automaticamente.
        </p>
        <p>
          <strong>📊 Estratégia:</strong> Desconto distribuído proporcionalmente ao preço original
          (clientes com cargas maiores recebem desconto maior).
        </p>
      </div>
    </div>
  );
}
