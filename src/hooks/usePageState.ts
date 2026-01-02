'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export function usePageState(pageKey: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Leer valores de la URL - usar useMemo para evitar re-renders innecesarios
  const searchQuery = useMemo(() => searchParams.get('q') || '', [searchParams]);
  const filtroProyecto = useMemo(() => searchParams.get('proyecto') || '', [searchParams]);
  const filtroPresupuesto = useMemo(() => searchParams.get('presupuesto') || '', [searchParams]);
  const estadoFilter = useMemo(() => searchParams.get('estado') || '', [searchParams]);
  const currentPage = useMemo(() => parseInt(searchParams.get('page') || '1', 10), [searchParams]);

  // Función para actualizar la URL sin agregar al historial
  const updateURL = useCallback((updates: Record<string, string | number | null>) => {
    // Crear nuevos params desde los actuales para preservar los que no se están actualizando
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || (key === 'page' && value === 1)) {
        // Eliminar parámetros vacíos o con valores por defecto
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    const newURL = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;

    router.replace(newURL, { scroll: false }); // scroll: false evita que se mueva el scroll
  }, [router, searchParams, pathname]);

  // Funciones para actualizar cada filtro
  const setSearchQuery = useCallback((value: string) => {
    updateURL({ q: value, page: 1 }); // Resetear página al buscar
  }, [updateURL]);

  const setFiltroProyecto = useCallback((value: string) => {
    updateURL({ proyecto: value, page: 1 });
  }, [updateURL]);

  const setFiltroPresupuesto = useCallback((value: string) => {
    updateURL({ presupuesto: value, page: 1 });
  }, [updateURL]);

  const setEstadoFilter = useCallback((value: string) => {
    updateURL({ estado: value, page: 1 });
  }, [updateURL]);

  const setCurrentPage = useCallback((value: number) => {
    updateURL({ page: value });
  }, [updateURL]);

  const clearFilters = useCallback(() => {
    router.replace(window.location.pathname, { scroll: false });
  }, [router]);

  return {
    searchQuery,
    filtroProyecto,
    filtroPresupuesto,
    estadoFilter,
    currentPage,
    setSearchQuery,
    setFiltroProyecto,
    setFiltroPresupuesto,
    setEstadoFilter,
    setCurrentPage,
    clearFilters,
  };
}

