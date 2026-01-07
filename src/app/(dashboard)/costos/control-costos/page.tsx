'use client';

import { useMemo, Suspense } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui';
import ProyectoConPresupuestosCard from './components/ProyectoConPresupuestosCard';
import Pagination from '../../proyectos/components/Pagination';
import { useProyectosConMetaVigenteConSearch } from '@/hooks/usePresupuestos';
import { usePageState } from '@/hooks/usePageState';
import { PaginationInput } from '@/services/proyecto-service';
import type { Proyecto } from '@/services/proyecto-service';

const ITEMS_PER_PAGE = 20;

function ControlCostosContent() {
  const {
    searchQuery,
    currentPage,
    setSearchQuery,
    setCurrentPage,
    clearFilters,
  } = usePageState('control-costos');

  // Preparar input para la query
  const paginationInput = useMemo(() => {
    return {
      page: currentPage,
      limit: ITEMS_PER_PAGE,
      sortBy: 'fecha_creacion',
      sortOrder: 'desc' as const,
    };
  }, [currentPage]);

  // Obtener proyectos con meta vigente (server-side search)
  const { data, isLoading, error } = useProyectosConMetaVigenteConSearch(paginationInput, searchQuery);

  const proyectosFiltrados = data?.data || [];
  const pagination = data?.pagination;



  const hasActiveFilters = !!searchQuery;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    // setCurrentPage ya se resetea automáticamente en el hook
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">
            Control Costos
          </h1>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Búsqueda */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
            <Input
              type="text"
              placeholder="Buscar por nombre, cliente, empresa o ID..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10 text-xs"
            />
          </div>

          {/* Botón limpiar filtros */}
          {hasActiveFilters && (
            <div className="flex items-center">
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 h-10 px-3 py-1.5 rounded-lg text-xs bg-[var(--background)]/50 hover:bg-[var(--background)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-sm hover:shadow transition-all duration-200"
              >
                <X className="h-4 w-4" />
                Limpiar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Listado de proyectos */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--text-secondary)]" />
              <p className="text-xs text-[var(--text-secondary)]">Cargando proyectos...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-12 text-center">
            <p className="text-xs text-red-500">Error al cargar los proyectos</p>
          </div>
        ) : proyectosFiltrados.length > 0 ? (
          <>
            {proyectosFiltrados.map((proyecto) => (
              <ProyectoConPresupuestosCard
                key={proyecto.id_proyecto}
                proyecto={proyecto}
              />
            ))}

            {/* Paginación */}
            {pagination && pagination.totalPages > 1 && (
              <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        ) : (
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-12 text-center">
            <p className="text-xs text-[var(--text-secondary)]">
              {hasActiveFilters
                ? 'No se encontraron proyectos con los filtros aplicados'
                : 'No hay proyectos con presupuesto meta vigente'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ControlCostosPage() {
  return (
    <Suspense fallback={
      <div className="space-y-3">
        <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-12 text-center">
          <LoadingSpinner size={80} showText={true} text="Cargando..." />
        </div>
      </div>
    }>
      <ControlCostosContent />
    </Suspense>
  );
}
