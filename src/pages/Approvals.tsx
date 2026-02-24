import { MainLayout } from '@/components/layout/MainLayout';
import { ApprovalList } from '@/components/approvals/ApprovalList';
import { usePendingApprovalsCount } from '@/hooks/useApprovalRequests';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Approvals() {
  const { data: pendingCount = 0 } = usePendingApprovalsCount();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <ShieldCheck className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Aprovações</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie aprovações de documentos financeiros e cotações
              </p>
            </div>
          </div>
          {pendingCount > 0 && (
            <Badge className="bg-amber-500 text-white text-sm px-3 py-1">
              {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Approval List */}
        <ApprovalList />
      </div>
    </MainLayout>
  );
}
