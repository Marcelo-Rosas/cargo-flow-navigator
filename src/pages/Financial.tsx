import { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { useFinancialBoardData } from '@/hooks/useFinancialBoardData';
import { FinancialKanban } from '@/components/financial/FinancialKanban';
import { TabButton } from '@/components/financial/TabButton';

type TabKey = 'receber' | 'pagar';

export default function Financial() {
  const { isOperacional } = useUserRole();
  const [tab, setTab] = useState<TabKey>('receber');

  useEffect(() => {
    if (isOperacional) setTab('pagar');
  }, [isOperacional]);

  const receber = useFinancialBoardData('FAT', { enabled: !isOperacional });
  const pagar = useFinancialBoardData('PAG');

  const totalReceber = receber.rows.length;
  const totalPagar = pagar.rows.length;

  const activeType = useMemo(() => (tab === 'receber' ? 'FAT' : 'PAG'), [tab]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground">Contas a receber e a pagar</p>
        </div>

        <div className="flex gap-2">
          {!isOperacional && (
            <TabButton
              active={tab === 'receber'}
              onClick={() => setTab('receber')}
              label="Receber"
              count={totalReceber}
              overdueCount={receber.overdueCount}
            />
          )}
          <TabButton
            active={tab === 'pagar'}
            onClick={() => setTab('pagar')}
            label="Pagar"
            count={totalPagar}
            overdueCount={pagar.overdueCount}
          />
        </div>

        {activeType === 'FAT' ? <FinancialKanban type="FAT" /> : <FinancialKanban type="PAG" />}
      </div>
    </MainLayout>
  );
}
