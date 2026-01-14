'use client';

import { useMemo, Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Building2, FileText, Layers, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectSearch } from '@/components/ui/select-search';
import { LoadingSpinner } from '@/components/ui';
import { useProyectosConPresupuestosPorFase } from '@/hooks/usePresupuestos';
import { useProyectos } from '@/hooks';
import { usePageState } from '@/hooks/usePageState';
import { useScrollRestoration } from '@/hooks';
import { executeQuery } from '@/services/graphql-client';
import { LIST_PROYECTOS_PAGINATED_QUERY } from '@/graphql/queries/proyecto.queries';
import { SelectSearchOption } from '@/components/ui/select-search';
import PresupuestoGrupoCardMeta from './components/PresupuestoGrupoCardMeta';
import ProyectoGrupoCardMeta from './components/ProyectoGrupoCardMeta';
import Pagination from '../proyectos/components/Pagination';
import type { Presupuesto } from '@/hooks/usePresupuestos';
import type { Proyecto, PaginatedProyectoResponse } from '@/services/proyecto-service';

interface GrupoPresupuesto {
  id_grupo_version: string;
  presupuestoPadre: Presupuesto;
  versiones: Presupuesto[];
}

interface ProyectoConPresupuestos {
  proyecto: Proyecto;
  gruposPresupuestos: GrupoPresupuesto[];
}

const ITEMS_PER_PAGE = 15;

function PresupuestosMetaContent() {
  const router = useRouter();
  const {
    searchQuery,
    filtroProyecto,
    currentPage,
    setSearchQuery,
    setFiltroProyecto,
    setCurrentPage,
    clearFilters,
  } = usePageState('meta');

  // SCROLL RESTORATION - Hook reutilizable
  useScrollRestoration('presupuestos-meta');

  // Obtener proyectos para el filtro (ahora optimizado con paginación escalable)
  const { data: proyectosData } = useProyectos({
    pagination: {
      page: 1,
      limit: 100, // Suficiente para dropdown de filtros
      sortBy: 'nombre_proyecto',
      sortOrder: 'asc',
    },
  });
  const proyectos = proyectosData?.data || [];

  // Función de búsqueda de proyectos para SelectSearch
  const buscarProyectos = async (searchTerm: string): Promise<SelectSearchOption[]> => {
    try {
      const response = await executeQuery<{ listProyectosPaginated: PaginatedProyectoResponse }>(
        LIST_PROYECTOS_PAGINATED_QUERY,
        {
          input: {
            pagination: { page: 1, limit: 50, sortBy: 'nombre_proyecto', sortOrder: 'asc' },
            search: {
              query: searchTerm,
              fields: ['nombre_proyecto', 'cliente', 'empresa', 'id_proyecto']
            }
          }
        }
      );

      return response.listProyectosPaginated.data.map(proyecto => ({
        value: proyecto.id_proyecto,
        label: proyecto.nombre_proyecto || 'Proyecto sin nombre'
      }));
    } catch (error) {
      console.error('Error buscando proyectos:', error);
      return [];
    }
  };

  // Preparar opciones para SelectSearch de proyectos (primeros 100)
  const opcionesProyectos = useMemo(() => {
    return proyectos.map(proyecto => ({
      value: proyecto.id_proyecto,
      label: proyecto.nombre_proyecto || 'Proyecto sin nombre',
    }));
  }, [proyectos]);

  // Obtener proyectos con presupuestos en fase META - CON búsqueda en backend
  const id_proyecto_filtrado = filtroProyecto || null;
  const { data: dataProyectos, isLoading, error } = useProyectosConPresupuestosPorFase(
    'META',
    id_proyecto_filtrado,
    { page: currentPage, limit: ITEMS_PER_PAGE, sortBy: 'fecha_creacion', sortOrder: 'desc' },
    searchQuery || null
  );
  const proyectosConPresupuestos = dataProyectos?.data || [];
  const pagination = dataProyectos?.pagination;
  const totals = dataProyectos?.totals;

  // Los proyectos ya vienen con sus presupuestos agrupados del backend
  // Solo necesitamos convertir el formato para mantener compatibilidad con los componentes
  const proyectosConPresupuestosAgrupados = useMemo(() => {
    if (!proyectosConPresupuestos) return [];

    return proyectosConPresupuestos.map(proyectoData => {
      // Obtener el proyecto completo de la lista de proyectos
      const proyectoCompleto = proyectos.find(p => p.id_proyecto === proyectoData.id_proyecto);

      // Crear mapa de grupos por id_grupo_version
      const gruposMap = new Map<string, GrupoPresupuesto>();

      // Agrupar presupuestos por id_grupo_version
      proyectoData.presupuestos.forEach((presupuesto) => {
        if (presupuesto.id_grupo_version) {
          const grupo = gruposMap.get(presupuesto.id_grupo_version);
          if (!grupo) {
            // Buscar el padre (puede estar en cualquier fase)
            const padre = proyectoData.presupuestos.find(p =>
              p.id_grupo_version === presupuesto.id_grupo_version &&
              p.es_padre &&
              p.version === null
            );

            if (padre) {
              gruposMap.set(presupuesto.id_grupo_version, {
                id_grupo_version: presupuesto.id_grupo_version,
                presupuestoPadre: padre,
                versiones: [],
              });
            }
          }
        }
      });

      // Agregar versiones META a sus grupos
      proyectoData.presupuestos.forEach((presupuesto) => {
        if (presupuesto.id_grupo_version && presupuesto.fase === 'META' && !presupuesto.es_padre && presupuesto.version !== null) {
          const grupo = gruposMap.get(presupuesto.id_grupo_version);
          if (grupo) {
            grupo.versiones.push(presupuesto);
          }
        }
      });

      const gruposPresupuestos = Array.from(gruposMap.values());

      return {
        proyecto: proyectoCompleto || {
          _id: '',
          id_proyecto: proyectoData.id_proyecto,
          nombre_proyecto: proyectoData.nombre_proyecto || 'Proyecto sin nombre',
          // Agregar campos requeridos mínimos para evitar errores
          id_usuario: '',
          id_infraestructura: '',
          id_departamento: '',
          id_provincia: '',
          id_distrito: '',
          cliente: '',
          empresa: '',
          estado: 'BORRADOR' as const,
          plazo: 0,
          ppto_base: 0,
          ppto_oferta: 0,
          jornada: 0,
          total_proyecto: 0,
          fecha_creacion: new Date().toISOString(),
          observaciones: ''
        },
        gruposPresupuestos,
      };
    });
  }, [proyectosConPresupuestos, proyectos]);

  // Calcular totales generales para el resumen
  const resumenGeneral = useMemo(() => {
    const totalProyectos = proyectosConPresupuestosAgrupados.length;
    const totalGrupos = proyectosConPresupuestosAgrupados.reduce((acc, proyecto) =>
      acc + proyecto.gruposPresupuestos.length, 0
    );

    // Contar versiones META por estado
    let totalVersiones = 0;
    let versionesAprobadas = 0;
    let versionesVigentes = 0;
    let versionesPorAprobar = 0;

    proyectosConPresupuestosAgrupados.forEach(proyecto => {
      proyecto.gruposPresupuestos.forEach(grupo => {
        const versionesMeta = grupo.versiones.filter(v => v.fase === 'META');
        totalVersiones += versionesMeta.length;

        versionesAprobadas += versionesMeta.filter(v => v.estado === 'aprobado').length;
        versionesVigentes += versionesMeta.filter(v => v.estado === 'vigente').length;
        versionesPorAprobar += versionesMeta.filter(v =>
          v.estado === 'borrador' || v.estado === 'en_revision'
        ).length;
      });
    });

    return {
      totalProyectos,
      totalGrupos,
      totalVersiones,
      versionesAprobadas,
      versionesVigentes,
      versionesPorAprobar
    };
  }, [proyectosConPresupuestosAgrupados]);

  // Los datos ya vienen filtrados del backend por búsqueda
  // Solo agrupamos por proyecto (sin filtrado adicional en frontend)
  const proyectosFiltrados = proyectosConPresupuestosAgrupados;

  // Calcular estadísticas
  const estadisticas = useMemo(() => {
    const totalProyectos = proyectosFiltrados.length;
    const totalGrupos = proyectosFiltrados.reduce((acc, proyecto) =>
      acc + proyecto.gruposPresupuestos.length, 0
    );

    // Para META: contar todas las versiones META
    const totalVersiones = proyectosFiltrados.reduce((acc, proyecto) =>
      acc + proyecto.gruposPresupuestos.reduce((accGrupo, grupo) =>
        accGrupo + grupo.versiones.filter(v => v.fase === 'META').length, 0
      ), 0
    );

    return {
      totalProyectos,
      totalGrupos,
      totalVersiones
    };
  }, [proyectosFiltrados]);

  const hasActiveFilters = searchQuery || filtroProyecto;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">
            Presupuestos Meta
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Gestión de presupuestos agrupados por proyecto en fase meta
          </p>
        </div>
      </div>


      {/* Barra de búsqueda y filtros */}
      <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-4">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          {/* Búsqueda general */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
              <Input
                type="text"
                placeholder="Buscar por nombre de presupuesto, proyecto o ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  // setCurrentPage(1) ya se hace dentro de setSearchQuery
                }}
                className="pl-10 text-xs h-8"
              />
            </div>
          </div>

          {/* Filtro por proyecto */}
          <div className="flex-1">
            <SelectSearch
              value={filtroProyecto || null}
              onChange={(value) => setFiltroProyecto(value || '')}
              options={opcionesProyectos}
              placeholder="Buscar por proyecto..."
              className="h-8 text-xs"
              onSearch={buscarProyectos}
              minCharsForSearch={2}
            />
          </div>

          {/* Botón limpiar filtros */}
          {hasActiveFilters && (
            <div>
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 h-8 px-3 py-1 rounded-lg text-xs bg-[var(--background)]/50 hover:bg-[var(--background)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-sm hover:shadow transition-all duration-200"
              >
                <X className="h-4 w-4" />
                Limpiar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Estadísticas */}
      {!isLoading && !error && proyectosFiltrados.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-3 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <Building2 className="h-4 w-4" />
            <span>
              <span className="font-semibold text-[var(--text-primary)]">{estadisticas.totalProyectos}</span> proyecto{estadisticas.totalProyectos !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-3 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <Layers className="h-4 w-4" />
            <span>
              <span className="font-semibold text-[var(--text-primary)]">{estadisticas.totalGrupos}</span> presupuesto{estadisticas.totalGrupos !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-3 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span>
              <span className="font-semibold text-green-600 dark:text-green-400">{resumenGeneral.versionesAprobadas}</span> aprobada{resumenGeneral.versionesAprobadas !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-3 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">{resumenGeneral.versionesVigentes}</span> vigente{resumenGeneral.versionesVigentes !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-3 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">{resumenGeneral.versionesPorAprobar}</span> por aprobar
            </span>
          </div>
        </div>
      )}

      {/* Listado de proyectos con sus presupuestos */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--text-secondary)]" />
              <p className="text-xs text-[var(--text-secondary)]">Cargando presupuestos...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-12 text-center">
            <p className="text-xs text-red-500">Error al cargar los presupuestos</p>
          </div>
        ) : proyectosFiltrados.length > 0 ? (
          <>
            {proyectosFiltrados.map((proyectoConPresupuestos) => (
              <ProyectoGrupoCardMeta
                key={proyectoConPresupuestos.proyecto.id_proyecto}
                proyecto={proyectoConPresupuestos.proyecto}
                gruposPresupuestos={proyectoConPresupuestos.gruposPresupuestos}
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
                ? 'No se encontraron presupuestos que coincidan con los filtros aplicados.'
                : 'No hay presupuestos en fase meta.'}
        </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PresupuestosMetaPage() {
  return (
    <Suspense fallback={
      <div className="space-y-3">
        <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-12 text-center">
          <LoadingSpinner size={80} showText={true} text="Cargando..." />
        </div>
      </div>
    }>
      <PresupuestosMetaContent />
    </Suspense>
  );
}
