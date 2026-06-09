import { Loader2 } from 'lucide-react';
import { SalesFunnel } from '@/components/dashboard/SalesFunnel';
import { StageDistributionChart } from '@/components/dashboard/StageDistributionChart';
import { ConversionChart } from '@/components/dashboard/charts/ConversionChart';
import { RevenueByClientChart } from '@/components/dashboard/charts/RevenueByClientChart';

interface ChartPoint {
  name: string;
  value: number;
}

interface CommercialTabProps {
  chartConversionData: ChartPoint[];
  chartRevenueData: ChartPoint[];
  chartsLoading?: boolean;
}

export function CommercialTab({
  chartConversionData,
  chartRevenueData,
  chartsLoading,
}: CommercialTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesFunnel />
        <StageDistributionChart />
      </div>

      {chartsLoading ? (
        <div className="bg-card rounded-xl border border-border shadow-card p-6 flex items-center justify-center h-[300px]">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <ConversionChart
          title="Evolução da Taxa de Conversão"
          data={chartConversionData}
          delay={0.2}
          height={300}
        />
      )}

      {chartsLoading ? (
        <div className="bg-card rounded-xl border border-border shadow-card p-6 flex items-center justify-center h-[300px]">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <RevenueByClientChart
          title="Top Clientes por Faturamento"
          data={chartRevenueData}
          delay={0.25}
          height={300}
          yAxisWidth={120}
        />
      )}
    </div>
  );
}
