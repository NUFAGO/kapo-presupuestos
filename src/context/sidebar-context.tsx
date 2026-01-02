'use client';

import { createContext, useContext, useState, useEffect } from 'react';

type SidebarContextType = {
  isCollapsed: boolean;
  isMd: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  currentWidth: number;
  breakpoint: number;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

// BREAKPOINT CONFIGURABLE - Cambia este valor para ajustar cuando se comprime el sidebar
// El sidebar se colapsará cuando el ancho sea menor a este valor (excepto en móvil)
const SIDEBAR_BREAKPOINT = 1536; // px

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMd, setIsMd] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const isMobileView = width < 768;
      const isMdView = width >= 768 && width < 1024;
      
      setCurrentWidth(width);
      setIsMobile(isMobileView);
      setIsMd(isMdView);
      
      if (isMobileView) {
        setIsCollapsed(true);
      } else if (width < SIDEBAR_BREAKPOINT) {
        // Se colapsa cuando el ancho es menor al breakpoint configurado
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) {
      overlay.classList.toggle('hidden', isCollapsed || !isMobile);
    }

    const handleClickOutside = (event: MouseEvent) => {
      const overlay = document.querySelector('.sidebar-overlay');
      
      if (
        !isCollapsed && 
        isMobile && 
        overlay && 
        event.target === overlay
      ) {
        setIsCollapsed(true);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isCollapsed, isMobile]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const closeSidebar = () => {
    setIsCollapsed(true);
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed, isMd, toggleSidebar, closeSidebar, currentWidth, breakpoint: SIDEBAR_BREAKPOINT }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar debe ser usado dentro de un SidebarProvider');
  }
  return context;
}

