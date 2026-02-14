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
}

export function CommercialTab({ chartConversionData, chartRevenueData }: CommercialTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesFunnel />
        <StageDistributionChart />
      </div>

      <ConversionChart title="Evolução da Taxa de Conversão" data={chartConversionData} delay={0.2} height={300} />

      <RevenueByClientChart
        title="Top Clientes por Faturamento"
        data={chartRevenueData}
        delay={0.25}
        height={300}
        yAxisWidth={120}
      />
    </div>
  );
}
