import { useRouter } from 'next/navigation';
import { useEffect, useCallback } from 'react';

/**
 * Hook para restaurar automáticamente la posición del scroll al volver a una página
 *
 * @param key - Identificador único para esta página (ej: 'presupuestos-meta')
 * @param scrollElement - Elemento que hace scroll (por defecto busca 'main')
 */
export function useScrollRestoration(key: string, scrollElement?: HTMLElement | null) {
  const router = useRouter();

  // Función para obtener el elemento que hace scroll
  const getScrollElement = useCallback(() => {
    return scrollElement || document.querySelector('main') || window;
  }, [scrollElement]);

  // Función para guardar la posición del scroll
  const saveScrollPosition = useCallback(() => {
    const element = getScrollElement();
    let scrollTop = 0;

    if (element === window) {
      scrollTop = window.scrollY;
    } else if (element && 'scrollTop' in element) {
      scrollTop = (element as HTMLElement).scrollTop;
    }

    if (scrollTop > 0) {
      sessionStorage.setItem(`scroll-${key}`, scrollTop.toString());
    }
  }, [key, getScrollElement]);

  // Función para restaurar la posición del scroll
  const restoreScrollPosition = useCallback(() => {
    const savedScroll = sessionStorage.getItem(`scroll-${key}`);
    if (savedScroll) {
      const scrollPosition = parseInt(savedScroll, 10);

      setTimeout(() => {
        const element = getScrollElement();

        if (element === window) {
          window.scrollTo(0, scrollPosition);
        } else if (element && 'scrollTop' in element) {
          (element as HTMLElement).scrollTop = scrollPosition;
        }


        // Limpiar después de usar
        sessionStorage.removeItem(`scroll-${key}`);
      }, 100); // Delay para que el DOM esté listo
    }
  }, [key, getScrollElement]);

  // 1. Restaurar posición al montar
  useEffect(() => {
    restoreScrollPosition();
  }, [restoreScrollPosition]);

  // 2. Guardar posición cuando el usuario sale
  useEffect(() => {
    // Guardar en eventos del browser
    window.addEventListener('beforeunload', saveScrollPosition);
    window.addEventListener('pagehide', saveScrollPosition);

    // Interceptar navegación programática de Next.js
    const originalPush = router.push;
    const originalReplace = router.replace;
    const originalBack = router.back;
    const originalForward = router.forward;

    router.push = (...args) => {
      saveScrollPosition();
      return originalPush(...args);
    };

    router.replace = (...args) => {
      saveScrollPosition();
      return originalReplace(...args);
    };

    router.back = () => {
      saveScrollPosition();
      return originalBack();
    };

    router.forward = () => {
      saveScrollPosition();
      return originalForward();
    };

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', saveScrollPosition);
      window.removeEventListener('pagehide', saveScrollPosition);

      // Restaurar funciones originales
      router.push = originalPush;
      router.replace = originalReplace;
      router.back = originalBack;
      router.forward = originalForward;
    };
  }, [router, saveScrollPosition]);

  // Retornar funciones útiles (opcional)
  return {
    saveScrollPosition,
    restoreScrollPosition,
    clearScrollPosition: () => sessionStorage.removeItem(`scroll-${key}`)
  };
}
