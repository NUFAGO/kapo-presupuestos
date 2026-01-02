'use client';

import { DollarSign, Calendar, FileText, Building2, ChevronDown, ChevronUp, Layers, ListTree, Copy, GitCompare, ArrowDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/modal';
import type { Presupuesto } from '@/hooks/usePresupuestos';
import { useState, useMemo, useEffect } from 'react';
import DetalleVersionModal from '../../presupuestos-licitaciones/components/DetalleVersionModal';
import { useCreateVersionDesdeVersion, useCrearPresupuestoMetaDesdeContractual } from '@/hooks';
import { useConfirm } from '@/context/confirm-context';
import { usePresupuesto } from '@/hooks/usePresupuestos';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PresupuestoGrupoCardContractualProps {
  grupoId: string;
  presupuestoPadre: Presupuesto;
  versiones: Presupuesto[];
  versionesMeta?: Presupuesto[]; // Versiones META relacionadas
  nombreProyecto?: string;
}

export default function PresupuestoGrupoCardContractual({
  grupoId,
  presupuestoPadre,
  versiones,
  versionesMeta = [],
  nombreProyecto,
}: PresupuestoGrupoCardContractualProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDetalleModalOpen, setIsDetalleModalOpen] = useState(false);
  const [versionSeleccionada, setVersionSeleccionada] = useState<Presupuesto | null>(null);
  const [mostrarSelectorMeta, setMostrarSelectorMeta] = useState(false);
  const createVersion = useCreateVersionDesdeVersion();
  const crearMeta = useCrearPresupuestoMetaDesdeContractual();
  const { confirm } = useConfirm();

  // Obtener versión contractual (siempre solo hay una V1)
  const versionContractual = useMemo(() => {
    return versiones.find(v => v.fase === 'CONTRACTUAL') || versiones[0];
  }, [versiones]);

  // Obtener presupuesto meta vigente desde versionesMeta o por id
  const presupuestoMetaVigente = useMemo(() => {
    // Primero intentar desde versionesMeta buscar la vigente/aprobada
    if (presupuestoPadre.id_presupuesto_meta_vigente) {
      const metaVigente = versionesMeta.find(
        m => m.id_presupuesto === presupuestoPadre.id_presupuesto_meta_vigente
      );
      if (metaVigente) return metaVigente;
    }
    
    // Si no hay vigente, buscar versiones aprobadas o vigentes
    const metaAprobadaOVigente = versionesMeta.find(
      m => m.estado === 'aprobado' || m.estado === 'vigente'
    );
    if (metaAprobadaOVigente) return metaAprobadaOVigente;
    
    // Si no hay ninguna aprobada/vigente, buscar la V1 (primera versión) aunque esté en borrador
    // para poder comparar hasta que se apruebe
    const v1Meta = versionesMeta.find(m => m.version === 1);
    if (v1Meta) return v1Meta;
    
    return null;
  }, [versionesMeta, presupuestoPadre.id_presupuesto_meta_vigente]);

  // Si no está en versionesMeta, intentar obtenerlo con el hook
  const { data: presupuestoMetaVigenteFromHook } = usePresupuesto(
    presupuestoMetaVigente ? null : (presupuestoPadre.id_presupuesto_meta_vigente || null)
  );

  // Usar el que esté disponible
  const metaVigenteFinal = presupuestoMetaVigente || presupuestoMetaVigenteFromHook || null;

  // Estado para rastrear qué meta está seleccionada actualmente
  const [metaSeleccionada, setMetaSeleccionada] = useState<Presupuesto | null>(null);

  // Inicializar metaSeleccionada con metaVigenteFinal cuando esté disponible
  useEffect(() => {
    if (metaVigenteFinal && !metaSeleccionada) {
      setMetaSeleccionada(metaVigenteFinal);
    }
  }, [metaVigenteFinal, metaSeleccionada]);

  // Usar metaSeleccionada si existe, sino metaVigenteFinal
  const metaActual = metaSeleccionada || metaVigenteFinal;

  // Obtener otras versiones meta aprobadas (no vigentes) del mismo grupo
  const otrasVersionesMeta = useMemo(() => {
    if (!metaVigenteFinal) return versionesMeta;
    // Filtrar la versión actual y solo incluir aprobadas/vigentes (o V1 si no hay ninguna aprobada)
    const versionesFiltradas = versionesMeta.filter(m => m.id_presupuesto !== metaVigenteFinal.id_presupuesto);
    
    // Si la versión actual es V1 en borrador, no mostrar otras versiones hasta que se apruebe
    if (metaVigenteFinal.version === 1 && metaVigenteFinal.estado !== 'aprobado' && metaVigenteFinal.estado !== 'vigente') {
      return [];
    }
    
    // Mostrar solo versiones aprobadas o vigentes
    return versionesFiltradas.filter(m => m.estado === 'aprobado' || m.estado === 'vigente');
  }, [versionesMeta, metaVigenteFinal]);

  // Ordenar versiones por número de versión (más reciente primero)
  const versionesOrdenadas = useMemo(() => {
    return [...versiones].sort((a, b) => (b.version || 0) - (a.version || 0));
  }, [versiones]);

  // Calcular totales del grupo
  const totalVersiones = versiones.length;
  const montoPromedio = useMemo(() => {
    if (versiones.length === 0) return 0;
    const suma = versiones.reduce((acc, v) => acc + v.total_presupuesto, 0);
    return suma / versiones.length;
  }, [versiones]);

  const montoMaximo = useMemo(() => {
    if (versiones.length === 0) return 0;
    return Math.max(...versiones.map((v) => v.total_presupuesto));
  }, [versiones]);

  const montoMinimo = useMemo(() => {
    if (versiones.length === 0) return 0;
    return Math.min(...versiones.map((v) => v.total_presupuesto));
  }, [versiones]);

  const handleVerEstructura = (id_presupuesto: string) => {
    // Guardar los query params actuales antes de navegar
    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.toString()) {
      sessionStorage.setItem('contractuales_return_params', currentParams.toString());
    }
    // Ruta específica para contractuales
    router.push(`/presupuestos-contractuales/estructura?presupuesto=${id_presupuesto}`);
  };

  const handleVerDetalle = (version: Presupuesto) => {
    setVersionSeleccionada(version);
    setIsDetalleModalOpen(true);
  };

  const handleCrearMeta = (version: Presupuesto) => {
    confirm({
      title: 'Crear Versión Meta',
      message: `¿Desea crear la versión 1 Meta basada en esta versión contractual (V${version.version})?`,
      confirmText: 'Crear V1 Meta',
      cancelText: 'Cancelar',
      onConfirm: () => {
        crearMeta.mutate({
          id_presupuesto_contractual: version.id_presupuesto,
          motivo: undefined
        });
      }
    });
  };

  const handleComparar = () => {
    if (versionContractual && metaActual) {
      router.push(
        `/presupuestos-contractuales/comparar?contractual=${versionContractual.id_presupuesto}&meta=${metaActual.id_presupuesto}`
      );
    }
  };

  const handleCambiarMeta = (nuevaMeta: Presupuesto) => {
    setMetaSeleccionada(nuevaMeta);
  };

  return (
    <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg overflow-hidden card-shadow relative">
      {/* Header del Grupo - Siempre visible */}
      <div
        className="p-4 cursor-default hover:bg-[var(--card-bg)]/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Nombre del presupuesto padre + badge de fase */}
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                {presupuestoPadre.nombre_presupuesto}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${
                presupuestoPadre.fase === 'META'
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              }`}>
                {presupuestoPadre.fase === 'META' ? 'CONTRACTUAL-META' : 'CONTRACTUAL'}
              </span>
            </div>

            {/* Resumen */}
            <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <Layers className="h-3 w-3" />
                <span>{totalVersiones} versión{totalVersiones !== 1 ? 'es' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                <span>
                  {new Date(presupuestoPadre.fecha_creacion).toLocaleDateString('es-ES', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })} {new Date(presupuestoPadre.fecha_creacion).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {totalVersiones > 0 && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3 w-3" />
                  <span className="font-medium text-[var(--text-primary)]">
                    S/ {montoMinimo.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - {montoMaximo.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Botón expandir/colapsar */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="p-1.5 rounded-lg bg-[var(--background)]/50 hover:bg-[var(--background)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-sm hover:shadow transition-all duration-200"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Versiones - Nueva estructura con comparación */}
      {isExpanded && versionContractual && (
        <div className="border-t border-[var(--border-color)]/15 bg-[var(--card-bg)]/20">
          <div className="p-4">
            {metaActual ? (
              // CON META VIGENTE: Mostrar lado a lado en una sola línea
              <div className="space-y-1.5">
                {/* Títulos y Select para cambiar meta - Encima de las líneas */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Contractual</span>
                  </div>
                  <div className="flex-shrink-0 min-w-[100px]" />
                  <div className="flex-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400">Meta</span>
                    {(otrasVersionesMeta.length > 0 || metaVigenteFinal) && (
                      <div className="w-full max-w-[200px]">
                        <Select
                          value={metaActual.id_presupuesto}
                          onChange={(value) => {
                            if (value) {
                              const todasLasMetas = metaVigenteFinal ? [metaVigenteFinal, ...otrasVersionesMeta] : otrasVersionesMeta;
                              const metaSeleccionada = todasLasMetas.find(m => m.id_presupuesto === value);
                              if (metaSeleccionada) {
                                handleCambiarMeta(metaSeleccionada);
                              }
                            }
                          }}
                          options={[
                            ...(metaVigenteFinal ? [{
                              value: metaVigenteFinal.id_presupuesto, 
                              label: `V${metaVigenteFinal.version} Meta ${
                                metaVigenteFinal.estado === 'vigente' 
                                  ? '(Vigente)' 
                                  : metaVigenteFinal.estado === 'aprobado' 
                                    ? '(Aprobada)' 
                                    : '(Por aprobar)'
                              }`
                            }] : []),
                            ...otrasVersionesMeta.map(meta => ({
                              value: meta.id_presupuesto,
                              label: `V${meta.version} Meta ${meta.estado === 'vigente' ? '(Vigente)' : '(Aprobada)'}`
                            }))
                          ]}
                          placeholder="Cambiar Meta"
                          className="h-8 text-xs text-center"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Línea principal: Contractual | Comparar | Meta */}
                <div className="flex items-center gap-2">
                  {/* Versión Contractual - Todo en una línea */}
                  <div className="flex-1 px-2 py-1.5 rounded bg-[var(--background)] card-shadow transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 flex-shrink-0">
                          V{versionContractual.version || 1}
                        </span>
                        
                        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)] flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-[120px]">
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            <span className="whitespace-nowrap">
                              {new Date(versionContractual.fecha_creacion).toLocaleDateString('es-ES', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })} {new Date(versionContractual.fecha_creacion).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 min-w-[140px]">
                            <DollarSign className="h-3 w-3 flex-shrink-0" />
                            <span className="font-semibold text-[var(--text-primary)] whitespace-nowrap">
                              S/ {versionContractual.total_presupuesto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleVerEstructura(versionContractual.id_presupuesto)}
                          className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 shadow-sm hover:shadow transition-all duration-200"
                          title="Ver estructura del presupuesto"
                        >
                          <ListTree className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => handleVerDetalle(versionContractual)}
                          className="p-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 shadow-sm hover:shadow transition-all duration-200"
                          title="Ver detalles del presupuesto"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Botón Comparar */}
                  <Button
                    onClick={handleComparar}
                    disabled={!metaActual}
                    variant="ghost"
                    className="flex-shrink-0 h-7 px-3 gap-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 shadow-sm hover:shadow text-xs"
                    title="Comparar presupuestos"
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    <span className="font-semibold">Comparar</span>
                  </Button>

                  {/* Versión Meta Seleccionada - Todo en una línea */}
                  <div className="flex-1 px-2 py-1.5 rounded bg-[var(--background)] card-shadow transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-600 dark:text-green-400 flex-shrink-0">
                          V{metaActual.version || 1}
                        </span>
                        
                        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)] flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-[120px]">
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            <span className="whitespace-nowrap">
                              {new Date(metaActual.fecha_creacion).toLocaleDateString('es-ES', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })} {new Date(metaActual.fecha_creacion).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 min-w-[140px]">
                            <DollarSign className="h-3 w-3 flex-shrink-0" />
                            <span className="font-semibold text-[var(--text-primary)] whitespace-nowrap">
                              S/ {metaActual.total_presupuesto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleVerEstructura(metaActual.id_presupuesto)}
                          className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 shadow-sm hover:shadow transition-all duration-200"
                          title="Ver estructura del presupuesto"
                        >
                          <ListTree className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => handleVerDetalle(metaActual)}
                          className="p-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 shadow-sm hover:shadow transition-all duration-200"
                          title="Ver detalles del presupuesto"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // SIN META VIGENTE: Mostrar como antes (solo versión contractual)
              <div className="space-y-1.5">
                {versionesOrdenadas.map((version) => (
                  <div
                    key={version.id_presupuesto}
                    className="px-2 py-1.5 rounded bg-[var(--background)] card-shadow transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 flex-shrink-0">
                          V{version.version || 1}
                        </span>
                        
                        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)] flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-[120px]">
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            <span className="whitespace-nowrap">
                              {new Date(version.fecha_creacion).toLocaleDateString('es-ES', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })} {new Date(version.fecha_creacion).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 min-w-[140px]">
                            <DollarSign className="h-3 w-3 flex-shrink-0" />
                            <span className="font-semibold text-[var(--text-primary)] whitespace-nowrap">
                              S/ {version.total_presupuesto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          {version.descripcion_version && (
                            <span className="truncate text-[var(--text-secondary)]">{version.descripcion_version}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleCrearMeta(version)}
                          disabled={crearMeta.isPending}
                          className="px-2.5 py-1.5 rounded-lg text-xs bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 shadow-sm hover:shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                          title="Crear versión 1 Meta"
                        >
                          <span>{crearMeta.isPending ? 'Creando...' : 'V1 Meta'}</span>
                        </button>
                        
                        <button
                          onClick={() => handleVerEstructura(version.id_presupuesto)}
                          className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 shadow-sm hover:shadow transition-all duration-200"
                          title="Ver estructura del presupuesto"
                        >
                          <ListTree className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => handleVerDetalle(version)}
                          className="p-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 shadow-sm hover:shadow transition-all duration-200"
                          title="Ver detalles del presupuesto"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal para ver detalle */}
      <Modal
        isOpen={isDetalleModalOpen}
        onClose={() => {
          setIsDetalleModalOpen(false);
          setVersionSeleccionada(null);
        }}
        title="Detalle de Versión"
        size="lg"
      >
        {versionSeleccionada && (
          <DetalleVersionModal
            version={versionSeleccionada}
            nombreProyecto={nombreProyecto}
          />
        )}
      </Modal>
    </div>
  );
}

