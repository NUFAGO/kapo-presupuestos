'use client';

import { useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Building2, FileText, Layers } from 'lucide-react';
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
import PresupuestoGrupoCardContractual from './components/PresupuestoGrupoCardContractual';
import ProyectoGrupoCardContractual from './components/ProyectoGrupoCardContractual';
import Pagination from '../proyectos/components/Pagination';
import type { Presupuesto } from '@/hooks/usePresupuestos';
import type { Proyecto, PaginatedProyectoResponse } from '@/services/proyecto-service';

interface GrupoPresupuesto {
  id_grupo_version: string;
  presupuestoPadre: Presupuesto;
  versiones: Presupuesto[];
  versionesMeta?: Presupuesto[]; // Versiones META relacionadas (incluye la vigente)
}

interface ProyectoConPresupuestos {
  proyecto: Proyecto;
  gruposPresupuestos: GrupoPresupuesto[];
}

const ITEMS_PER_PAGE = 20;

function PresupuestosContractualesContent() {
  const router = useRouter();

  // Scroll restoration automático
  useScrollRestoration('presupuestos-contractuales');

  const {
    searchQuery,
    filtroProyecto,
    currentPage,
    setSearchQuery,
    setFiltroProyecto,
    setCurrentPage,
    clearFilters,
  } = usePageState('contractuales');

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

  // Obtener presupuestos en fase CONTRACTUAL - PAGINACIÓN POR PROYECTOS
  const id_proyecto_filtrado = filtroProyecto || null;

  // Obtener proyectos con presupuestos CONTRACTUAL y META en una sola consulta
  const { data: dataProyectos, isLoading } = useProyectosConPresupuestosPorFase(
    'CONTRACTUAL',
    id_proyecto_filtrado,
    { page: currentPage, limit: 15, sortBy: 'fecha_creacion', sortOrder: 'desc' }, // 15 proyectos por página
    searchQuery || null
  );
  const proyectosConPresupuestos = dataProyectos?.data || [];
  const pagination = dataProyectos?.pagination;
  const totals = dataProyectos?.totals;
  const error = null; // Manejar errores si es necesario

  // Los proyectos ya vienen con todos los presupuestos combinados del backend
  // Solo necesitamos convertir el formato para mantener compatibilidad con los componentes
  const proyectosConPresupuestosAgrupados = useMemo(() => {
    if (!proyectosConPresupuestos) return [];

    const result = proyectosConPresupuestos
      .filter(proyectoData => proyectoData && proyectoData.id_proyecto && proyectoData.presupuestos)
      .map(proyectoData => {
      // Obtener el proyecto completo de la lista de proyectos
      const proyectoCompleto = proyectos.find(p => p && p.id_proyecto === proyectoData.id_proyecto);

      // Crear mapa de grupos por id_grupo_version
      const gruposMap = new Map<string, GrupoPresupuesto>();

      // Agrupar presupuestos por id_grupo_version
      proyectoData.presupuestos?.forEach((presupuesto: Presupuesto) => {
        if (presupuesto && presupuesto.id_grupo_version) {
          const grupo = gruposMap.get(presupuesto.id_grupo_version);
          if (!grupo) {
            // Buscar el padre
            const padre = proyectoData.presupuestos?.find((p: Presupuesto) =>
              p && p.id_grupo_version === presupuesto.id_grupo_version &&
              p.es_padre &&
              p.version === null
            );

            if (padre) {
              gruposMap.set(presupuesto.id_grupo_version, {
                id_grupo_version: presupuesto.id_grupo_version,
                presupuestoPadre: padre,
                versiones: [],
                versionesMeta: [], // Inicializar array vacío
              });
            }
          }
        }
      });

      // Agregar versiones a sus grupos
      proyectoData.presupuestos.forEach((presupuesto: Presupuesto) => {
        if (presupuesto.id_grupo_version) {
          const grupo = gruposMap.get(presupuesto.id_grupo_version);
          if (grupo) {
            if (presupuesto.fase === 'CONTRACTUAL' && (!presupuesto.es_padre || presupuesto.version !== null)) {
              grupo.versiones.push(presupuesto);
            } else if (presupuesto.fase === 'META' && !presupuesto.es_padre && presupuesto.version !== null) {
              if (!grupo.versionesMeta) {
                grupo.versionesMeta = [];
              }
              grupo.versionesMeta.push(presupuesto);
            }
          }
        }
      });

      const gruposPresupuestos = Array.from(gruposMap.values());


      // Ordenar grupos: primero los que tienen fase CONTRACTUAL
      gruposPresupuestos.sort((a, b) => {
        const faseA = a.presupuestoPadre.fase || '';
        const faseB = b.presupuestoPadre.fase || '';

        if (faseA === 'CONTRACTUAL' && faseB !== 'CONTRACTUAL') return -1;
        if (faseA !== 'CONTRACTUAL' && faseB === 'CONTRACTUAL') return 1;
        return 0;
      });

      const result = {
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

      return result;
    });

    return result;
  }, [proyectosConPresupuestos, proyectos]);

  // Los proyectos ya vienen ordenados del backend (CONTRACTUAL primero, luego META)
  const proyectosFiltrados = proyectosConPresupuestosAgrupados;


  // Calcular estadísticas
  const estadisticas = useMemo(() => {
    const totalProyectos = proyectosFiltrados.length;
    const totalGrupos = proyectosFiltrados.reduce((acc, proyecto) =>
      acc + proyecto.gruposPresupuestos.length, 0
    );

    // Contar todas las versiones CONTRACTUAL
    const totalVersiones = proyectosFiltrados.reduce((acc, proyecto) =>
      acc + proyecto.gruposPresupuestos.reduce((accGrupo, grupo) =>
        accGrupo + (grupo.versiones || []).filter(v => v.fase === 'CONTRACTUAL').length, 0
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
            Presupuestos Contractuales
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Gestión de presupuestos agrupados por proyecto en fase contractual
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
                value={searchQuery || ''}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                }}
                className="pl-10 text-xs h-8"
                disabled={false}
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

      {/* Estadísticas - Separadas en contenedores individuales */}
      {!isLoading && !error && proyectosFiltrados.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-3">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <Building2 className="h-4 w-4" />
              <span>
                <span className="font-semibold text-[var(--text-primary)]">{estadisticas.totalProyectos}</span> proyecto{estadisticas.totalProyectos !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
            <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-3">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <Layers className="h-4 w-4" />
                <span>
                  <span className="font-semibold text-[var(--text-primary)]">{estadisticas.totalGrupos}</span> presupuesto{estadisticas.totalGrupos !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-3">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <FileText className="h-4 w-4" />
              <span>
                <span className="font-semibold text-[var(--text-primary)]">{estadisticas.totalVersiones}</span> versión{estadisticas.totalVersiones !== 1 ? 'es' : ''}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Listado de proyectos con sus presupuestos */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-12 text-center">
            <p className="text-xs text-[var(--text-secondary)]">Cargando presupuestos...</p>
          </div>
        ) : error ? (
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-12 text-center">
            <p className="text-xs text-red-500">
              Error al cargar presupuestos. Por favor, intente nuevamente.
            </p>
          </div>
        ) : proyectosFiltrados.length > 0 ? (
          <>
            {proyectosFiltrados
              .filter(item => item && item.proyecto && item.proyecto.id_proyecto && item.gruposPresupuestos && item.gruposPresupuestos.length > 0)
              .map((proyectoConPresupuestos) => (
              <ProyectoGrupoCardContractual
                key={proyectoConPresupuestos.proyecto.id_proyecto}
                proyecto={proyectoConPresupuestos.proyecto}
                gruposPresupuestos={proyectoConPresupuestos.gruposPresupuestos}
                />
            ))}
            
            {/* Paginación por proyectos */}
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
                : 'No hay presupuestos en fase contractual.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PresupuestosContractualesPage() {
  return (
    <Suspense fallback={
      <div className="space-y-3">
        <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-12 text-center">
          <LoadingSpinner size={80} showText={true} text="Cargando..." />
        </div>
      </div>
    }>
      <PresupuestosContractualesContent />
    </Suspense>
  );
}
