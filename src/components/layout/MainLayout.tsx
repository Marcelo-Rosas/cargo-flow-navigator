import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LayoutProvider } from './LayoutContext';
import { useLayout } from './useLayout';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useProactiveConsolidationToast } from '@/hooks/useProactiveConsolidationToast';
import { useLocation } from 'react-router-dom';

interface MainLayoutProps {
  children: ReactNode;
}

function MainLayoutInner({ children }: MainLayoutProps) {
  const { sidebarWidth } = useLayout();
  const { pathname } = useLocation();

  // Keep proactive consolidation side effects scoped to Commercial route.
  useProactiveConsolidationToast(pathname.startsWith('/comercial'));

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        className="transition-[padding] duration-200"
        style={{
          paddingLeft: sidebarWidth,
          transitionTimingFunction: 'cubic-bezier(0.22, 0.9, 0.32, 1)',
        }}
        data-testid="main-content"
      >
        <Topbar />
        <motion.main
          className="p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 0.9, 0.32, 1] }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <LayoutProvider>
      <MainLayoutInner>{children}</MainLayoutInner>
    </LayoutProvider>
  );
}
