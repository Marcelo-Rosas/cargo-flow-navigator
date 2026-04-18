import { BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function LiquidityPanel() {
  return (
    <Card className="w-full">
      <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <BarChart3 className="w-12 h-12 text-muted-foreground opacity-40" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">Indicadores de Liquidez</p>
          <p className="text-sm text-muted-foreground">Em desenvolvimento</p>
        </div>
      </CardContent>
    </Card>
  );
}
