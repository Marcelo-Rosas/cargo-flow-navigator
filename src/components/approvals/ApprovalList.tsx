import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ShieldX,
  Clock,
  Brain,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Filter,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import { useApprovalRequests, type ApprovalRequest } from '@/hooks/useApprovalRequests';
import { ApprovalModal } from './ApprovalModal';

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: {
    label: 'Pendente',
    icon: Clock,
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  approved: {
    label: 'Aprovado',
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  rejected: {
    label: 'Rejeitado',
    icon: XCircle,
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
};

export function ApprovalList() {
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);

  const { data: approvals = [], isLoading } = useApprovalRequests(
    statusFilter === 'all' ? undefined : statusFilter
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="approved">Aprovadas</TabsTrigger>
            <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* List */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Clock className="w-5 h-5 animate-spin mr-2" />
          Carregando aprovações...
        </div>
      )}

      {!isLoading && approvals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ShieldCheck className="w-10 h-10 mb-3 opacity-50" />
          <p className="text-sm font-medium">Nenhuma aprovação encontrada</p>
          <p className="text-xs">
            {statusFilter === 'pending'
              ? 'Todas as aprovações foram processadas'
              : 'Sem registros para este filtro'}
          </p>
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {approvals.map((approval, index) => {
          const status = statusConfig[approval.status] || statusConfig.pending;
          const StatusIcon = status.icon;
          const aiRisk = (approval.ai_analysis?.risk as string) || null;

          return (
            <motion.div
              key={approval.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedApproval(approval)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold truncate">{approval.title}</h3>
                    <Badge className={`text-[10px] ${status.className}`}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>

                  {approval.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {approval.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {new Date(approval.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {approval.approval_type}
                    </Badge>
                    {approval.assigned_to_role && (
                      <Badge variant="outline" className="text-[10px]">
                        {approval.assigned_to_role}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* AI Risk indicator */}
                <div className="shrink-0 flex flex-col items-center gap-1">
                  {aiRisk && (
                    <div
                      className={`p-2 rounded-lg ${
                        aiRisk === 'baixo'
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : aiRisk === 'alto'
                            ? 'bg-red-100 dark:bg-red-900/30'
                            : 'bg-amber-100 dark:bg-amber-900/30'
                      }`}
                    >
                      {aiRisk === 'baixo' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                      {aiRisk === 'medio' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                      {aiRisk === 'alto' && <XCircle className="w-5 h-5 text-red-600" />}
                    </div>
                  )}
                  {aiRisk && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Brain className="w-3 h-3" /> AI
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Modal */}
      <ApprovalModal
        approval={selectedApproval}
        open={!!selectedApproval}
        onOpenChange={(open) => !open && setSelectedApproval(null)}
      />
    </div>
  );
}
