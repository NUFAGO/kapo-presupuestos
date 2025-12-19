'use client';

import React, { useMemo } from 'react';
import Modal from '@/components/ui/modal';
import { LoadingSpinner } from '@/components/ui';
import { AlertTriangle, CheckCircle, Clock, Package, ShoppingCart, Truck } from 'lucide-react';

interface ModalTrazabilidadDetalleProps {
  isOpen: boolean;
  onClose: () => void;
  recurso: {
    recurso_id: string;
    codigo: string;
    descripcion: string;
    totalRQ: number;
    totalOCBienes: number;
    totalOCServicios: number;
    totalRecepcion: number;
    diferencia: number;
  } | null;
  todosLosRecursos: Array<{
    recurso_id: string;
    codigo: string;
    descripcion: string;
    totalRQ: number;
    totalOCBienes: number;
    totalOCServicios: number;
    totalRecepcion: number;
    diferencia: number;
  }>; // Lista de todos los recursos de la tabla
  trazabilidadDetalle: any; // Datos detallados del monolito
  isLoading?: boolean;
  onSeleccionarRecurso: (recurso: {
    recurso_id: string;
    codigo: string;
    descripcion: string;
    totalRQ: number;
    totalOCBienes: number;
    totalOCServicios: number;
    totalRecepcion: number;
    diferencia: number;
  }) => void;
}

export default function ModalTrazabilidadDetalle({
  isOpen,
  onClose,
  recurso,
  todosLosRecursos,
  trazabilidadDetalle,
  isLoading = false,
  onSeleccionarRecurso,
}: ModalTrazabilidadDetalleProps) {
  if (!recurso) return null;

  // Obtener información del recurso desde trazabilidadDetalle (datos del monolito)
  const recursoInfo = useMemo(() => {
    if (!trazabilidadDetalle) {
      return {
        codigo: recurso.codigo,
        descripcion: recurso.descripcion,
      };
    }

    const trazabilidad = trazabilidadDetalle.trazabilidades?.find(
      (t: any) => t.recurso_id === recurso.recurso_id
    );

    if (!trazabilidad || !trazabilidad.requerimientos_recurso || trazabilidad.requerimientos_recurso.length === 0) {
      return {
        codigo: recurso.codigo,
        descripcion: recurso.descripcion,
      };
    }

    // Obtener código y nombre del primer requerimiento (todos deberían tener los mismos datos del recurso)
    const primerReq = trazabilidad.requerimientos_recurso[0];
    return {
      codigo: primerReq.codigo_recurso || recurso.codigo,
      descripcion: primerReq.nombre_recurso || recurso.descripcion,
    };
  }, [trazabilidadDetalle, recurso]);

  // Calcular estadísticas
  const estadisticas = useMemo(() => {
    if (!trazabilidadDetalle) {
      return {
        cantidadRequerida: 0,
        cantidadAprobada: 0,
        cantidadComprada: 0,
        costoEstimado: 0,
        costoReal: 0,
        porcentajeCompletado: 0,
        estado: 'PENDIENTE',
      };
    }

    const trazabilidad = trazabilidadDetalle.trazabilidades?.find(
      (t: any) => t.recurso_id === recurso.recurso_id
    );

    if (!trazabilidad) {
      return {
        cantidadRequerida: 0,
        cantidadAprobada: 0,
        cantidadComprada: 0,
        costoEstimado: 0,
        costoReal: 0,
        porcentajeCompletado: 0,
        estado: 'PENDIENTE',
      };
    }

    // Calcular cantidades desde requerimientos
    const cantidadRequerida = trazabilidad.requerimientos_recurso?.reduce(
      (sum: number, req: any) => sum + (req.cantidad || 0),
      0
    ) || 0;

    const cantidadAprobada = trazabilidad.requerimientos_recurso?.reduce(
      (sum: number, req: any) => sum + (req.cantidad_aprobada || 0),
      0
    ) || 0;

    const cantidadComprada = trazabilidad.ordenes_compra_recurso?.reduce(
      (sum: number, oc: any) => sum + (oc.cantidad || 0),
      0
    ) || 0;

    const costoEstimado = trazabilidad.requerimientos_recurso?.reduce(
      (sum: number, req: any) => sum + ((req.cantidad_aprobada || 0) * (req.precio || 0)),
      0
    ) || 0;

    const costoReal = trazabilidad.transferencias_recurso?.reduce(
      (sum: number, transf: any) => sum + ((transf.cantidad || 0) * (transf.costo || 0)),
      0
    ) || 0;

    const porcentajeCompletado = cantidadRequerida > 0
      ? Math.min(100, (cantidadComprada / cantidadRequerida) * 100)
      : 0;

    let estado = 'PENDIENTE';
    if (porcentajeCompletado >= 100) estado = 'COMPLETADO';
    else if (porcentajeCompletado > 0) estado = 'EN_PROCESO';

    return {
      cantidadRequerida,
      cantidadAprobada,
      cantidadComprada,
      costoEstimado,
      costoReal,
      porcentajeCompletado,
      estado,
    };
  }, [trazabilidadDetalle, recurso]);

  // Obtener transacciones detalladas
  const transacciones = useMemo(() => {
    if (!trazabilidadDetalle) return [];

    const trazabilidad = trazabilidadDetalle.trazabilidades?.find(
      (t: any) => t.recurso_id === recurso.recurso_id
    );

    if (!trazabilidad) return [];

    const transaccionesList: any[] = [];

    // Agregar requerimientos
    trazabilidad.requerimientos_recurso?.forEach((req: any) => {
      transaccionesList.push({
        tipo: 'Requerimiento',
        codigo: req.requerimiento_data?.codigo || '-',
        descripcion: req.requerimiento_data?.sustento || 'Sin descripción',
        cantidad: req.cantidad_aprobada || req.cantidad || 0,
        precio: req.precio || 0,
        total: (req.cantidad_aprobada || req.cantidad || 0) * (req.precio || 0),
        estado: req.requerimiento_data?.estado_atencion || req.estado || 'pendiente',
        fecha: req.requerimiento_data?.fecha_solicitud || null,
        color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      });
    });

    // Agregar órdenes de compra
    trazabilidad.ordenes_compra_recurso?.forEach((oc: any) => {
      transaccionesList.push({
        tipo: 'Orden de Compra',
        codigo: oc.orden_compra_data?.codigo_orden || '-',
        descripcion: oc.orden_compra_data?.descripcion || 'Sin descripción',
        cantidad: oc.cantidad || 0,
        precio: oc.costo_real || oc.costo_aproximado || 0,
        total: (oc.cantidad || 0) * (oc.costo_real || oc.costo_aproximado || 0),
        estado: oc.orden_compra_data?.estado || oc.estado || 'pendiente',
        fecha: oc.orden_compra_data?.fecha_ini || null,
        color: 'bg-green-500/10 text-green-600 dark:text-green-400',
      });
    });

    // Agregar transferencias
    trazabilidad.transferencias_recurso?.forEach((transf: any) => {
      transaccionesList.push({
        tipo: 'Transferencia',
        codigo: transf.transferencia_detalle_data?.referencia_codigo || '-',
        descripcion: `Transferencia - ${transf.transferencia_detalle_data?.tipo || 'N/A'}`,
        cantidad: transf.cantidad || 0,
        precio: transf.costo || 0,
        total: (transf.cantidad || 0) * (transf.costo || 0),
        estado: transf.transferencia_detalle_data?.estado || '',
        fecha: transf.transferencia_detalle_data?.fecha || null,
        color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      });
    });

    // Ordenar por fecha (más antiguo primero)
    return transaccionesList.sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
    });
  }, [trazabilidadDetalle, recurso]);

  const getEstadoColor = (estado: string) => {
    const estadoLower = estado.toLowerCase();
    if (estadoLower.includes('aprobado') || estadoLower.includes('completado')) {
      return 'bg-green-500/10 text-green-600 dark:text-green-400';
    }
    if (estadoLower.includes('pendiente')) {
      return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
    }
    if (estadoLower.includes('rechazado') || estadoLower.includes('anulado')) {
      return 'bg-red-500/10 text-red-600 dark:text-red-400';
    }
    return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className="text-purple-600 dark:text-purple-400">{recursoInfo.codigo}</span>
          <span className="text-[var(--text-primary)] truncate max-w-md">{recursoInfo.descripcion}</span>
        </div>
      }
      size="xl"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size={40} />
          <span className="ml-3 text-sm text-[var(--text-secondary)]">Cargando detalles...</span>
        </div>
      ) : (
        <div className="flex gap-4 h-full min-h-0">
          {/* Panel lateral izquierdo - Lista de recursos */}
          <div className="w-56 flex-shrink-0 border-r border-[var(--border-color)] pr-4 flex flex-col h-full min-h-0 bg-[var(--card-bg)] rounded-lg p-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 px-2 flex-shrink-0">
              Recursos ({todosLosRecursos.length})
            </h3>
            <div className="space-y-1.5 pr-1" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {todosLosRecursos.map((r) => {
                // Obtener información del recurso desde trazabilidadDetalle si está disponible
                const trazabilidadRecurso = trazabilidadDetalle?.trazabilidades?.find(
                  (t: any) => t.recurso_id === r.recurso_id
                );
                const primerReq = trazabilidadRecurso?.requerimientos_recurso?.[0];
                const codigoRecurso = primerReq?.codigo_recurso || r.codigo;
                const descripcionRecurso = primerReq?.nombre_recurso || r.descripcion;

                return (
                  <button
                    key={r.recurso_id}
                    onClick={() => onSeleccionarRecurso(r)}
                    className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                      r.recurso_id === recurso.recurso_id
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-semibold border border-purple-300 dark:border-purple-700'
                        : 'bg-[var(--background)] hover:bg-[var(--hover-bg)] text-[var(--text-primary)] border border-[var(--border-color)]'
                    }`}
                  >
                    <div className="font-semibold truncate text-[var(--text-primary)]">{codigoRecurso}</div>
                    <div className="text-xs truncate mt-0.5 text-[var(--text-secondary)]">{descripcionRecurso}</div>
                    <div className={`text-xs mt-1 font-semibold whitespace-nowrap ${r.diferencia >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {r.diferencia >= 0 ? '+' : ''}S/{r.diferencia.toFixed(2)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contenido principal - Más compacto */}
          <div className="flex-1 flex flex-col min-w-0 space-y-2 min-h-0 overflow-hidden">
            {/* Header con valores - Compacto */}
            <div className="flex items-center justify-between gap-3 text-sm border-b border-[var(--border-color)] pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-secondary)]">Recurso:</span>
                <span className="font-semibold text-[var(--text-primary)]">{recursoInfo.codigo}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs text-[var(--text-secondary)]">Total RQ</div>
                  <div className="font-semibold text-[var(--text-primary)] whitespace-nowrap">
                    S/{recurso.totalRQ.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[var(--text-secondary)]">Total OC</div>
                  <div className="font-semibold text-[var(--text-primary)] whitespace-nowrap">
                    S/{(recurso.totalOCBienes + recurso.totalOCServicios).toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[var(--text-secondary)]">Diferencia</div>
                  <div className={`font-semibold whitespace-nowrap ${recurso.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {recurso.diferencia >= 0 ? '+' : ''}S/{recurso.diferencia.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Tarjetas de resumen - Más compactas */}
            <div className="grid grid-cols-4 gap-3">
              {/* Cantidades */}
              <div className="bg-purple-100 dark:bg-purple-900/10 rounded p-3 border border-purple-200 dark:border-purple-800">
                <div className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-2">
                  Cantidades
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Req:</span>
                    <span className="font-semibold">{estadisticas.cantidadRequerida.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Aprob:</span>
                    <span className="font-semibold">{estadisticas.cantidadAprobada.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Comp:</span>
                    <span className="font-semibold">{estadisticas.cantidadComprada.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Costos */}
              <div className="bg-green-500/10 dark:bg-green-900/10 rounded p-3 border border-green-200 dark:border-green-800">
                <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2">
                  Costos
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Est:</span>
                    <span className="font-semibold">S/ {estadisticas.costoEstimado.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Real:</span>
                    <span className="font-semibold">S/ {estadisticas.costoReal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Estado */}
              <div className="bg-purple-100 dark:bg-purple-900/10 rounded p-3 border border-purple-200 dark:border-purple-800">
                <div className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-2">
                  Estado
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-secondary)]">Comp:</span>
                    <span className="font-semibold">{estadisticas.porcentajeCompletado.toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      estadisticas.estado === 'COMPLETADO' 
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : estadisticas.estado === 'EN_PROCESO'
                        ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                        : 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                    } whitespace-nowrap`}>
                      {estadisticas.estado}
                    </span>
                  </div>
                </div>
              </div>

              {/* Alertas */}
              <div className="bg-orange-100 dark:bg-orange-900/10 rounded p-3 border border-orange-200 dark:border-orange-800">
                <div className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-2">
                  Alertas
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {recurso.diferencia < 0 ? (
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                      <span className="leading-tight">Costo excede presupuesto</span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <span className="leading-tight">Dentro del presupuesto</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabla de transacciones - Más compacta */}
            <div className="border border-[var(--border-color)] rounded overflow-hidden flex flex-col flex-1 min-h-0">
              <div className="bg-[var(--card-bg)] px-4 py-2 border-b border-[var(--border-color)] flex-shrink-0">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Transacciones Detalladas
                </h3>
              </div>
              <div className="overflow-x-auto flex-1 min-h-0" style={{ overflowY: 'auto' }}>
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[var(--card-bg)] border-b border-[var(--border-color)]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)]">Tipo</th>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)]">Código</th>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)]">Descripción</th>
                      <th className="px-3 py-2 text-right font-semibold text-[var(--text-secondary)]">Cant.</th>
                      <th className="px-3 py-2 text-right font-semibold text-[var(--text-secondary)]">Precio</th>
                      <th className="px-3 py-2 text-right font-semibold text-[var(--text-secondary)]">Total</th>
                      <th className="px-3 py-2 text-center font-semibold text-[var(--text-secondary)]">Estado</th>
                      <th className="px-3 py-2 text-center font-semibold text-[var(--text-secondary)]">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {transacciones.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-[var(--text-secondary)]">
                          No hay transacciones disponibles
                        </td>
                      </tr>
                    ) : (
                      transacciones.map((trans, index) => (
                        <tr key={index} className="hover:bg-[var(--hover-bg)]">
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${trans.color} whitespace-nowrap`}>
                              {trans.tipo}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-medium text-[var(--text-primary)]">
                            {trans.codigo}
                          </td>
                          <td className="px-3 py-2 text-[var(--text-secondary)] max-w-xs truncate">
                            {trans.descripcion}
                          </td>
                          <td className="px-3 py-2 text-right text-[var(--text-primary)]">
                            {trans.cantidad.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-[var(--text-primary)] whitespace-nowrap">
                            S/{trans.precio.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-[var(--text-primary)] whitespace-nowrap">
                            S/{trans.total.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getEstadoColor(trans.estado)} whitespace-nowrap`}>
                              {trans.estado}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center text-[var(--text-secondary)]">
                            {formatDate(trans.fecha)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
