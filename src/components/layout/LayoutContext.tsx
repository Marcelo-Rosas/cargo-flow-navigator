import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

const SIDEBAR_COLLAPSED = 72;
const SIDEBAR_EXPANDED = 256;

interface LayoutContextValue {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  sidebarWidth: number;
}

// eslint-disable-next-line react-refresh/only-export-components
export const LayoutContext = createContext<LayoutContextValue | null>(null);

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
