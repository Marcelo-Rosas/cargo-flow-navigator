import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-[72px] md:pl-64 transition-all duration-200">
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
