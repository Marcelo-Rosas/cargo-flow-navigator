import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

const SIDEBAR_COLLAPSED = 72;
const SIDEBAR_EXPANDED = 256;

interface LayoutContextValue {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  sidebarWidth: number;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider');
  return ctx;
}

interface LayoutProviderProps {
  children: ReactNode;
}

export function LayoutProvider({ children }: LayoutProviderProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const toggleSidebar = useCallback(() => setIsSidebarCollapsed((c) => !c), []);
  const sidebarWidth = isSidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  return (
    <LayoutContext.Provider value={{ isSidebarCollapsed, toggleSidebar, sidebarWidth }}>
      {children}
    </LayoutContext.Provider>
  );
}

export { SIDEBAR_COLLAPSED, SIDEBAR_EXPANDED };
