'use client';

import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, DollarSign, Target, BarChart3, X, Calendar, Filter, FileText, Layers, Building2, TrendingUp as TrendingUpIcon, TrendingDown as TrendingDownIcon, BarChart2, FileCheck, ArrowRight, RotateCcw, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SelectSearch } from '@/components/ui/select-search';
import { usePresupuestosPorFase, useEstadisticasDashboard } from '@/hooks/usePresupuestos';
import { useProyectosConMetaVigente } from '@/hooks/useProyectos';
import { useResumenPresupuesto, useHistoricoMensual, type FiltrosResumen } from '@/hooks/useResumenPresupuesto';

/**
 * Estructura de datos para el Dashboard
 * 
 * NOTA: Este dashboard muestra datos AGREGADOS de TODOS los presupuestos meta padre en estado vigente.
 * Los datos vendrán de la nueva tabla ResumenPresupuesto que se creará en el backend.
 * 
 * Filtros que deberá tener:
 * - Por Presupuesto (seleccionar uno o varios presupuestos meta vigentes)
 * - Por Proyecto (filtrar por proyecto asociado)
 * - Por Rango de Fechas (para ver histórico mensual)
 * - Por Estado (vigente, histórico, snapshot)
 */
interface ResumenPresupuestoData {
  // Identificación
  id_presupuesto: string | null | undefined; // Si es null, es agregado de todos los presupuestos meta vigentes
  id_proyecto?: string; // Si se filtra por proyecto
  fecha_calculo: string;
  es_historico: boolean;
  es_snapshot: boolean;
  
  // Presupuesto Meta (agregado de todas las partidas de todos los presupuestos meta vigentes)
  total_presupuesto: number; // Suma de parcial_partida de todas las partidas
  fecha_presupuesto_meta?: string; // Fecha del presupuesto específico (solo cuando id_presupuesto existe)
  
  // Métricas agregadas (solo cuando id_presupuesto es null - vista general)
  cantidad_presupuestos?: number; // Cantidad de presupuestos incluidos en el agregado
  cantidad_proyectos?: number; // Cantidad de proyectos incluidos en el agregado
  promedio_por_presupuesto?: number; // total_presupuesto / cantidad_presupuestos
  presupuesto_mas_alto?: number; // Mayor total_presupuesto individual
  presupuesto_mas_bajo?: number; // Menor total_presupuesto individual
  
  // APU Meta (agregado de todos los recursos de todos los presupuestos meta vigentes)
  // Representa: Métricas agregadas de eficiencia, varianza y costo por unidad
  total_composicion: number; // Suma de total_composicion de todos los recursos de todos los presupuestos
  total_unidades: number; // Suma de metrados de todas las partidas
  costo_por_unidad_meta: number; // total_presupuesto / total_unidades (promedio ponderado)
  costo_por_unidad_actual: number; // total_composicion / total_unidades (promedio ponderado)
  eficiencia: number; // (costo_por_unidad_meta / costo_por_unidad_actual) * 100
  varianza: number; // ((costo_por_unidad_actual - costo_por_unidad_meta) / costo_por_unidad_meta) * 100
  progreso_proyecto: number; // Porcentaje de avance basado en recepciones (promedio ponderado)
  
  // Costo Real + Proyección (agregado)
  total_requerimiento: number; // Neto: pendiente/comprometido (no recibido)
  total_requerimiento_bruto: number; // Bruto: total comprometido
  total_ordenes_compra_bienes: number;
  total_ordenes_compra_bienes_bruto: number;
  total_ordenes_compra_servicios: number;
  total_ordenes_compra_servicios_bruto: number;
  total_recepcion_almacen: number; // Real: recibido en almacén
  total_recepcion_almacen_bruto: number;
  
  // Diferencias
  diferencia_mayor_gasto: number; // total_composicion - (total_requerimiento + total_ordenes_compra)
  diferencia_real_comprometido: number; // total_composicion - total_recepcion_almacen
  
  // Histórico mensual (para gráficos)
  historico_mensual?: Array<{
    mes: string;
    anio: number;
    total_presupuesto: number;
    total_composicion: number;
    total_requerimiento: number;
    total_recepcion_almacen: number;
  }>;
}

// Interfaz para histórico mensual transformado
interface HistoricoMensualItem {
  mes: string;
  anio: number;
  total_presupuesto: number;
  total_composicion: number;
  total_requerimiento: number;
  total_recepcion_almacen: number;
}

// Datos vacíos para mostrar estructura cuando no hay datos reales
const datosVacios: ResumenPresupuestoData = {
  id_presupuesto: null,
  fecha_calculo: new Date().toISOString(),
  es_historico: false,
  es_snapshot: false,
  total_presupuesto: 0,
  cantidad_presupuestos: 0,
  cantidad_proyectos: 0,
  promedio_por_presupuesto: 0,
  presupuesto_mas_alto: 0,
  presupuesto_mas_bajo: 0,
  total_composicion: 0,
  total_unidades: 0,
  costo_por_unidad_meta: 0,
  costo_por_unidad_actual: 0,
  eficiencia: 0,
  varianza: 0,
  progreso_proyecto: 0,
  total_requerimiento: 0,
  total_requerimiento_bruto: 0,
  total_ordenes_compra_bienes: 0,
  total_ordenes_compra_bienes_bruto: 0,
  total_ordenes_compra_servicios: 0,
  total_ordenes_compra_servicios_bruto: 0,
  total_recepcion_almacen: 0,
  total_recepcion_almacen_bruto: 0,
  diferencia_mayor_gasto: 0,
  diferencia_real_comprometido: 0,
  historico_mensual: []
};

// Tipos para estadísticas del dashboard
interface EstadisticasDashboard {
  presupuestosPorFase: {
    BORRADOR: number;
    LICITACION: number;
    CONTRACTUAL: number;
    META: number;
  };
  aprobacionesPendientes: {
    LICITACION_A_CONTRACTUAL: number;
    CONTRACTUAL_A_META: number;
    NUEVA_VERSION_META: number;
    OFICIALIZAR_META: number;
    total: number;
  };
}

export default function DashboardPage() {
  // Estados para filtros UI (lo que ve el usuario)
  const [filtroProyectoUI, setFiltroProyectoUI] = useState<string>('');
  const [filtroPresupuestoUI, setFiltroPresupuestoUI] = useState<string>('');
  const [fechaDesdeUI, setFechaDesdeUI] = useState<string>('');
  const [fechaHastaUI, setFechaHastaUI] = useState<string>('');

  // Estados para filtros aplicados (lo que se envía a la API)
  const [filtroProyecto, setFiltroProyecto] = useState<string>('');
  const [filtroPresupuesto, setFiltroPresupuesto] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');

  // Obtener proyectos con meta vigente (similar a control de costos)
  const { data: proyectosData } = useProyectosConMetaVigente({
    page: 1,
    limit: 1000,
    sortBy: 'nombre_proyecto',
    sortOrder: 'asc',
  });
  const proyectos = proyectosData?.data || [];

  // Estadísticas del dashboard (carga independiente)
  const { data: estadisticasData, isLoading: isLoadingEstadisticas } = useEstadisticasDashboard();

  // Datos de fallback mientras carga
  const estadisticas: EstadisticasDashboard = (estadisticasData as EstadisticasDashboard) ?? {
    presupuestosPorFase: {
      BORRADOR: 0,
      LICITACION: 0,
      CONTRACTUAL: 0,
      META: 0
    },
    aprobacionesPendientes: {
      LICITACION_A_CONTRACTUAL: 0,
      CONTRACTUAL_A_META: 0,
      NUEVA_VERSION_META: 0,
      OFICIALIZAR_META: 0,
      total: 0
    }
  };

  // Obtener presupuestos meta vigentes para el filtro
  // Si hay un proyecto seleccionado en UI, filtrar por ese proyecto
  const { data: presupuestosMeta, isLoading: isLoadingPresupuestos } = usePresupuestosPorFase(
    'META', 
    filtroProyectoUI || null
  );
  
  const presupuestosMetaVigentes = useMemo(() => {
    // Si no hay proyecto seleccionado en UI, no mostrar presupuestos
    if (!filtroProyectoUI) return [];
    
    if (!presupuestosMeta) return [];
    
    // Filtrar solo VERSIONES meta vigentes (no padres)
    // Deben ser versiones (version !== null, es_padre === false)
    // Con fase META y estado 'vigente' o 'aprobado'
    const filtrados = presupuestosMeta.data
      .filter(p => {
        const esVersion = p.version !== null && p.es_padre === false;
        const perteneceAlProyecto = p.id_proyecto === filtroProyectoUI;
        const faseMeta = p.fase === 'META';
        const estadoValido = p.estado === 'vigente' || p.estado === 'aprobado';
        
        return esVersion && perteneceAlProyecto && faseMeta && estadoValido;
      })
      .sort((a, b) => (a.nombre_presupuesto || '').localeCompare(b.nombre_presupuesto || ''));
    
    return filtrados;
  }, [presupuestosMeta, filtroProyectoUI]);

  // Preparar opciones para SearchSelect de proyectos
  const opcionesProyectos = useMemo(() => {
    return proyectos.map(proyecto => ({
      value: proyecto.id_proyecto,
      label: proyecto.nombre_proyecto,
    }));
  }, [proyectos]);

  // Preparar opciones para SearchSelect de presupuestos
  const opcionesPresupuestos = useMemo(() => {
    return presupuestosMetaVigentes.map(presupuesto => ({
      value: presupuesto.id_presupuesto,
      label: presupuesto.nombre_presupuesto || presupuesto.id_presupuesto,
    }));
  }, [presupuestosMetaVigentes]);

  // Obtener datos reales del backend
  const filtrosResumen: FiltrosResumen = {
    id_presupuesto: filtroPresupuesto || null,
    id_proyecto: filtroProyecto || null
  };

  const { 
    resumen: datosReales, 
    isLoading: isLoadingResumen,
    sincronizar,
    isSincronizando,
    refetch: refetchResumen
  } = useResumenPresupuesto(filtrosResumen);

  const { 
    historico: historicoReal,
    isLoading: isLoadingHistorico
  } = useHistoricoMensual(filtrosResumen, 12);

  // Usar datos reales si están disponibles, sino usar datos vacíos (valores en 0)
  const datos = datosReales || datosVacios;
  
  // Transformar histórico real al formato esperado
  const historicoMensual = useMemo<HistoricoMensualItem[]>(() => {
    if (historicoReal && historicoReal.length > 0) {
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return historicoReal.map(h => ({
        mes: h.periodo_mes ? `${meses[h.periodo_mes - 1]} ${h.periodo_anio}` : `Mes ${h.periodo_anio}`,
        anio: h.periodo_anio || 0,
        total_presupuesto: h.total_presupuesto ?? 0,
        total_composicion: h.total_composicion ?? 0,
        total_requerimiento: h.total_requerimiento ?? 0,
        total_recepcion_almacen: h.total_recepcion_almacen ?? 0
      }));
    }
    // Si no hay datos históricos, crear 12 meses con valores en 0 para mostrar el gráfico vacío
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const anioActual = new Date().getFullYear();
    return meses.map(mes => ({
      mes: `${mes} ${anioActual}`,
      anio: anioActual,
      total_presupuesto: 0,
      total_composicion: 0,
      total_requerimiento: 0,
      total_recepcion_almacen: 0
    }));
  }, [historicoReal]);
  
  const handleRecalcular = () => {
    sincronizar(true); // Forzar recálculo
  };

  // Función para aplicar filtros desde UI a los filtros reales
  const applyFilters = () => {
    setFiltroProyecto(filtroProyectoUI);
    setFiltroPresupuesto(filtroPresupuestoUI);
    setFechaDesde(fechaDesdeUI);
    setFechaHasta(fechaHastaUI);
  };

  const clearFilters = () => {
    setFiltroProyectoUI('');
    setFiltroPresupuestoUI('');
    setFechaDesdeUI('');
    setFechaHastaUI('');
    // También limpiar los filtros aplicados
    setFiltroProyecto('');
    setFiltroPresupuesto('');
    setFechaDesde('');
    setFechaHasta('');
  };

  const hasActiveFilters = filtroProyectoUI || filtroPresupuestoUI || fechaDesdeUI || fechaHastaUI;


  // Calcular puntos para el gráfico (normalizados a 0-100)
  const maxValor = useMemo(() => {
    if (historicoMensual.length === 0) return 1;
    const valores = historicoMensual.flatMap((h: HistoricoMensualItem) => [
      h.total_presupuesto ?? 0,
      h.total_composicion ?? 0,
      h.total_requerimiento ?? 0,
      h.total_recepcion_almacen ?? 0
    ]);
    const max = Math.max(...valores);
    return max > 0 ? max : 1; // Evitar división por cero
  }, [historicoMensual]);
  
  const calcularY = (valor: number | undefined | null) => {
    const val = valor ?? 0;
    if (!isFinite(val) || !isFinite(maxValor) || maxValor === 0) return 0;
    return 100 - (val / maxValor) * 100;
  };

  // Calcular proyección (basado en tendencia)
  const costoProyectado = historicoMensual && historicoMensual.length > 0
    ? (historicoMensual[historicoMensual.length - 1].total_requerimiento ?? 0) * 1.15 // Proyección conservadora
    : datos.total_requerimiento * 1.15;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Dashboard</h1>

        </div>
        <div className="flex items-center gap-3">
          {datos.fecha_calculo && (
            <p className="text-[11px] text-[var(--text-secondary)]">
              Última sincronización: {new Date(datos.fecha_calculo).toLocaleDateString('es-PE', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
          <button
            onClick={handleRecalcular}
            disabled={isSincronizando || isLoadingResumen}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 disabled:bg-blue-500/5 disabled:text-blue-400/50 dark:disabled:text-blue-500/40 text-xs text-blue-600 dark:text-blue-400 shadow-sm hover:shadow transition-all duration-200 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${isSincronizando ? 'animate-spin' : ''}`} />
            {isSincronizando ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-4">
        <div className="space-y-3">
          {/* Filtros */}
          <div className="flex flex-col md:flex-row gap-3">
            {/* Filtro por proyecto */}
            <div className="flex-1">
              <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">
                Filtrar por Proyecto
              </label>
              <SelectSearch
                value={filtroProyectoUI || null}
                onChange={(value) => {
                  setFiltroProyectoUI(value || '');
                  // Limpiar el filtro de presupuesto cuando cambia el proyecto
                  setFiltroPresupuestoUI('');
                }}
                options={opcionesProyectos}
                placeholder="Todos los proyectos"
                className="h-8 text-xs"
              />
            </div>

            {/* Filtro por presupuesto */}
            <div className="flex-1">
              <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">
                Filtrar por Presupuesto Meta
              </label>
              <SelectSearch
                value={filtroPresupuestoUI || null}
                onChange={(value) => setFiltroPresupuestoUI(value || '')}
                options={opcionesPresupuestos}
                placeholder={
                  filtroProyectoUI
                    ? "Seleccione un presupuesto meta del proyecto" 
                    : "Primero seleccione un proyecto"
                }
                className="h-8 text-xs"
                disabled={!filtroProyectoUI}
              />
            </div>

            {/* Filtro por fecha desde */}
            <div className="flex-1">
              <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">
                Fecha Desde
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
                <Input
                  type="date"
                  value={fechaDesdeUI}
                  onChange={(e) => setFechaDesdeUI(e.target.value)}
                  className="pl-10 pr-3 py-2 text-xs h-8"
                />
              </div>
            </div>

            {/* Filtro por fecha hasta */}
            <div className="flex-1">
              <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">
                Fecha Hasta
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
                <Input
                  type="date"
                  value={fechaHastaUI}
                  onChange={(e) => setFechaHastaUI(e.target.value)}
                  className="pl-10 pr-3 py-1.5 text-xs h-8"
                />
              </div>
            </div>

            {/* Botones de acción de filtros */}
            <div className="flex items-end gap-2">
              <button
                onClick={applyFilters}
                disabled={!hasActiveFilters}
                className="flex items-center gap-1.5 h-8 px-3 py-1 rounded-lg text-xs bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 disabled:bg-green-500/5 disabled:text-green-400/50 dark:disabled:text-green-500/40 disabled:cursor-not-allowed shadow-sm hover:shadow transition-all duration-200"
              >
                <Filter className="h-4 w-4" />
                Filtrar
              </button>
              <button
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="flex items-center gap-1.5 h-8 px-3 py-1 rounded-lg text-xs bg-gray-500/10 hover:bg-gray-500/20 text-gray-600 dark:text-gray-400 disabled:bg-gray-500/5 disabled:text-gray-400/50 dark:disabled:text-gray-500/40 disabled:cursor-not-allowed shadow-sm hover:shadow transition-all duration-200"
              >
                <X className="h-4 w-4" />
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Columna izquierda: Presupuesto Meta + APU Meta */}
          <div className="space-y-3">
            {/* Presupuesto Meta */}
            <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow overflow-hidden">
            <div className="bg-[var(--card-bg)] px-3 py-2 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                {datos.id_presupuesto ? (
                  <>
                    <FileText className="w-4 h-4 text-blue-500" />
                    <h2 className="text-xs font-semibold text-[var(--text-primary)]">Presupuesto Meta</h2>
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <h2 className="text-xs font-semibold text-[var(--text-primary)]">Resumen Agregado</h2>
                  </>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-tight mt-1">
                {datos.fecha_presupuesto_meta 
                  ? new Date(datos.fecha_presupuesto_meta).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })
                  : `Fecha de cálculo: ${new Date(datos.fecha_calculo).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })}`
                }
              </p>
            </div>
            <div className="p-3">
              {datos.id_presupuesto ? (
                // Vista de presupuesto específico
                <div>
                  <div className="flex items-baseline gap-2">
                    <DollarSign className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="text-2xl font-bold text-[var(--text-primary)] mb-1">
                        S/ {datos.total_presupuesto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">Presupuesto Total</div>
                    </div>
                  </div>
                </div>
              ) : (
                // Vista agregada - métricas de alto nivel
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[var(--card-bg)] rounded-lg p-2 card-shadow">
                    <div className="flex items-center gap-1.5 mb-1">
                      <BarChart2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-[11px] text-[var(--text-secondary)]">Total Presupuesto Agregado</span>
                    </div>
                    <div className="text-base font-bold text-[var(--text-primary)]">
                      S/ {datos.total_presupuesto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  
                  <div className="bg-[var(--card-bg)] rounded-lg p-2 card-shadow">
                    <div className="flex items-center gap-1.5 mb-1">
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[11px] text-[var(--text-secondary)]">Presupuestos</span>
                    </div>
                    <div className="text-base font-bold text-[var(--text-primary)]">
                      {datos.cantidad_presupuestos || 0}
                    </div>
                  </div>
                  
                  <div className="bg-[var(--card-bg)] rounded-lg p-2 card-shadow">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Building2 className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-[11px] text-[var(--text-secondary)]">Proyectos</span>
                    </div>
                    <div className="text-base font-bold text-[var(--text-primary)]">
                      {datos.cantidad_proyectos || 0}
                    </div>
                  </div>
                  
                  <div className="bg-[var(--card-bg)] rounded-lg p-2 card-shadow">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Target className="w-3.5 h-3.5 text-purple-500" />
                      <span className="text-[11px] text-[var(--text-secondary)]">Promedio</span>
                    </div>
                    <div className="text-base font-bold text-[var(--text-primary)]">
                      S/ {(datos.promedio_por_presupuesto ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  
                  <div className="bg-[var(--card-bg)] rounded-lg p-2 card-shadow">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUpIcon className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[11px] text-[var(--text-secondary)]">Más Alto</span>
                    </div>
                    <div className="text-base font-bold text-[var(--text-primary)]">
                      S/ {(datos.presupuesto_mas_alto ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  
                  <div className="bg-[var(--card-bg)] rounded-lg p-2 card-shadow">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingDownIcon className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-[11px] text-[var(--text-secondary)]">Más Bajo</span>
                    </div>
                    <div className="text-base font-bold text-[var(--text-primary)]">
                      S/ {(datos.presupuesto_mas_bajo ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Estado del Sistema */}
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow overflow-hidden">
            <div className="p-4">
              {/* Sección 1: Resumen de Presupuestos */}
              <div className="mb-4">
                <h3 className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <BarChart2 className="h-3.5 w-3.5" />
                  Resumen de Presupuestos
                </h3>
                <div className="grid grid-cols-2 gap-2">
                <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-2 card-shadow">
                  <div className="flex items-center gap-1.5 mb-1">
                      <FileText className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      <span className="text-[11px] text-[var(--text-secondary)]">META</span>
                      {isLoadingEstadisticas && <div className="w-1 h-1 bg-green-600 rounded-full animate-pulse"></div>}
                    </div>
                    <div className="text-xl font-bold text-green-600 dark:text-green-400">
                      {isLoadingEstadisticas ? '...' : estadisticas.presupuestosPorFase.META}
                  </div>
                </div>
                
                  <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-2 card-shadow">
                  <div className="flex items-center gap-1.5 mb-1">
                      <Layers className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                      <span className="text-[11px] text-[var(--text-secondary)]">Licitación</span>
                      {isLoadingEstadisticas && <div className="w-1 h-1 bg-orange-600 rounded-full animate-pulse"></div>}
                  </div>
                    <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                      {isLoadingEstadisticas ? '...' : estadisticas.presupuestosPorFase.LICITACION}
                </div>
              </div>
              
                  <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2 card-shadow">
                    <div className="flex items-center gap-1.5 mb-1">
                      <FileCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-[11px] text-[var(--text-secondary)]">Contractual</span>
                      {isLoadingEstadisticas && <div className="w-1 h-1 bg-blue-600 rounded-full animate-pulse"></div>}
                    </div>
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {isLoadingEstadisticas ? '...' : estadisticas.presupuestosPorFase.CONTRACTUAL}
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-950/20 rounded-lg p-2 card-shadow">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Target className="h-3.5 w-3.5 text-gray-600" />
                      <span className="text-[11px] text-[var(--text-secondary)]">Borrador</span>
                      {isLoadingEstadisticas && <div className="w-1 h-1 bg-gray-600 rounded-full animate-pulse"></div>}
                    </div>
                    <div className="text-xl font-bold text-gray-600">
                      {isLoadingEstadisticas ? '...' : estadisticas.presupuestosPorFase.BORRADOR}
                    </div>
                </div>
                </div>
              </div>
              
              {/* Separador */}
              <div className="border-t border-[var(--border-color)] my-3"></div>

              {/* Sección 2: Aprobaciones Pendientes */}
              <div className="space-y-1.5 text-[12px]">
                <h3 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Aprobaciones Pendientes
                </h3>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 ">
                    <ArrowRight className="h-3 w-3 text-blue-500" />
                    <span className="text-[var(--text-secondary)]">Licitación → Contractual</span>
                    {isLoadingEstadisticas && <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>}
                  </div>
                  <span className="font-semibold text-[var(--text-primary)] bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded text-xs">
                    {isLoadingEstadisticas ? '...' : `${estadisticas.aprobacionesPendientes.LICITACION_A_CONTRACTUAL} pendientes`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <RotateCcw className="h-3 w-3 text-purple-500" />
                    <span className="text-[var(--text-secondary)]">Nueva Versión Meta</span>
                    {isLoadingEstadisticas && <div className="w-1 h-1 bg-purple-500 rounded-full animate-pulse"></div>}
                </div>
                  <span className="font-semibold text-[var(--text-primary)] bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded text-xs">
                    {isLoadingEstadisticas ? '...' : `${estadisticas.aprobacionesPendientes.NUEVA_VERSION_META} pendientes`}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-color)] pt-1.5 mt-1.5">
                  <span className="text-[var(--text-secondary)] font-semibold flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Total Aprobaciones Pendientes
                    {isLoadingEstadisticas && <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>}
                  </span>
                  <span className="font-bold text-base text-green-600">
                    {isLoadingEstadisticas ? '...' : estadisticas.aprobacionesPendientes.total}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Columna derecha: Costo Real + Proyección */}
        <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow overflow-hidden">
          <div className="bg-blue-500/10 px-3 py-2 border-b border-[var(--border-color)]">
            <h2 className="text-xs font-semibold text-[var(--text-primary)]">Costo Real + Proyección</h2>
            <p className="text-[11px] text-[var(--text-secondary)] leading-tight">
              Neto: Pendiente/comprometido (no recibido) | Bruto: Total comprometido | Recep.: Real (recibido en almacén)
            </p>
          </div>
          <div className="p-3">
            {/* Gráfico de líneas simple */}
            <div className="mb-6">
                <div className="h-64 relative border-b-2 border-l-2 border-[var(--border-color)] bg-[var(--card-bg)] rounded">
                  {/* Eje Y - Valores */}
                  <div className="absolute left-0 top-0 bottom-0 w-14 flex flex-col justify-between text-[11px] text-[var(--text-secondary)] pr-2 items-end">
                    <span>{(maxValor / 1000).toFixed(0)}k</span>
                    <span>{((maxValor * 0.75) / 1000).toFixed(0)}k</span>
                    <span>{((maxValor * 0.5) / 1000).toFixed(0)}k</span>
                    <span>{((maxValor * 0.25) / 1000).toFixed(0)}k</span>
                    <span className="pb-1">0</span>
                  </div>
                  
                  {/* Gráfico */}
                  <div className="ml-14 h-full relative">
                    {/* Líneas de referencia horizontales */}
                    <div className="absolute inset-0 flex flex-col justify-between">
                      {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className="border-t border-[var(--border-color)] opacity-20" />
                      ))}
                    </div>
                    
                    {/* Líneas del gráfico usando SVG */}
                    {(() => {
                      const historico = historicoMensual;
                      const divisor = historico.length > 1 ? historico.length - 1 : 1; // Evitar división por cero
                      
                      return (
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {/* Línea Presupuesto Meta (gris) */}
                          <polyline
                            points={historico.map((item: HistoricoMensualItem, idx: number) => 
                              `${(idx / divisor) * 100},${calcularY(item.total_presupuesto)}`
                            ).join(' ')}
                            fill="none"
                            stroke="#6b7280"
                            strokeWidth="0.8"
                            vectorEffect="non-scaling-stroke"
                          />
                          
                          {/* Línea Composición (verde) */}
                          <polyline
                            points={historico.map((item: HistoricoMensualItem, idx: number) => 
                              `${(idx / divisor) * 100},${calcularY(item.total_composicion)}`
                            ).join(' ')}
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth="1"
                            vectorEffect="non-scaling-stroke"
                          />
                          
                          {/* Línea Requerimiento/Proyectado (naranja punteada) */}
                          <polyline
                            points={historico.map((item: HistoricoMensualItem, idx: number) => 
                              `${(idx / divisor) * 100},${calcularY(item.total_requerimiento)}`
                            ).join(' ')}
                            fill="none"
                            stroke="#f97316"
                            strokeWidth="1"
                            strokeDasharray="3,2"
                            vectorEffect="non-scaling-stroke"
                          />
                          
                          {/* Línea Recepción Real (azul sólida) - solo hasta donde hay datos */}
                          {historico.filter((h: HistoricoMensualItem) => (h.total_recepcion_almacen ?? 0) > 0).length > 0 && (
                            <polyline
                              points={historico
                                .filter((item: HistoricoMensualItem, idx: number) => (item.total_recepcion_almacen ?? 0) > 0 || idx === 0)
                                .map((item: HistoricoMensualItem, idx: number) => {
                                  const originalIdx = historico.indexOf(item);
                                  return `${(originalIdx / divisor) * 100},${calcularY(item.total_recepcion_almacen)}`;
                                })
                                .join(' ')}
                              fill="none"
                              stroke="#3b82f6"
                              strokeWidth="1.2"
                              vectorEffect="non-scaling-stroke"
                            />
                          )}
                        </svg>
                      );
                    })()}
                    
                    {/* Eje X - Meses */}
                    <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[11px] text-[var(--text-secondary)] px-1 pb-1">
                      {historicoMensual.map((item: HistoricoMensualItem, idx: number) => (
                        <span key={idx} className={idx % 2 === 0 ? 'opacity-100' : 'opacity-0'}>
                          {item.mes}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Leyenda */}
                <div className="flex items-center justify-center gap-3 mt-2 text-[11px] flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-blue-500" />
                    <span className="text-[var(--text-secondary)]">Recepción Real</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 border-t-2 border-dashed border-orange-500" />
                    <span className="text-[var(--text-secondary)]">Requerimiento/Proyectado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-green-500" />
                    <span className="text-[var(--text-secondary)]">Composición (APU)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-gray-500" />
                    <span className="text-[var(--text-secondary)]">Presupuesto Meta</span>
                  </div>
                </div>
              </div>
            
            {/* Resumen de valores */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[var(--card-bg)] rounded-lg p-2 card-shadow">
                <div className="text-[11px] text-[var(--text-secondary)] mb-1">Recepción Real</div>
                <div className="text-base font-bold text-[var(--text-primary)]">
                  S/ {datos.total_recepcion_almacen.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                </div>
              </div>
              <div className="bg-[var(--card-bg)] rounded-lg p-2 card-shadow">
                <div className="text-[11px] text-[var(--text-secondary)] mb-1">Proyectado</div>
                <div className="text-base font-bold text-[var(--text-primary)]">
                  S/ {costoProyectado.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                </div>
              </div>
              <div className="bg-[var(--card-bg)] rounded-lg p-2 card-shadow">
                <div className="text-[11px] text-[var(--text-secondary)] mb-1">Presupuesto Meta</div>
                <div className="text-base font-bold text-[var(--text-primary)]">
                  S/ {datos.total_presupuesto.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                </div>
              </div>
            </div>
            
            {/* Detalle de costos */}
            <div className="mt-3 pt-3 border-t border-[var(--border-color)] space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Requerimiento (Neto)</span>
                <span className="font-semibold text-[var(--text-primary)]">S/ {datos.total_requerimiento.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Requerimiento (Bruto)</span>
                <span className="font-semibold text-[var(--text-primary)]">S/ {(datos.total_requerimiento_bruto ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">OC Bienes (Bruto)</span>
                <span className="font-semibold text-[var(--text-primary)]">S/ {(datos.total_ordenes_compra_bienes_bruto ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">OC Servicios (Bruto)</span>
                <span className="font-semibold text-[var(--text-primary)]">S/ {(datos.total_ordenes_compra_servicios_bruto ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)] font-semibold">Diferencia Mayor Gasto</span>
                <span className={`font-bold text-base ${(datos.diferencia_mayor_gasto ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  S/ {(datos.diferencia_mayor_gasto ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
