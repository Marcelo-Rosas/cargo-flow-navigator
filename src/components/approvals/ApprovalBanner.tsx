import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePendingApprovalsCount } from '@/hooks/useApprovalRequests';
import { useNavigate } from 'react-router-dom';

export function ApprovalBanner() {
  const { data: count = 0 } = usePendingApprovalsCount();
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="flex items-center gap-3">
              <div className="shrink-0 p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  {count} {count === 1 ? 'aprovação pendente' : 'aprovações pendentes'}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Documentos financeiros aguardando sua decisão
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
              onClick={() => navigate('/aprovacoes')}
            >
              Ver aprovações
              <ArrowRight className="ml-1 w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
