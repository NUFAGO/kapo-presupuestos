'use client';

import React, { useMemo } from 'react';

interface AnalisisEjecucionPresupuestadoProps {
  recurso: {
    recurso_id: string;
    codigo: string;
    descripcion: string;
    totalComposicion: number;
    totalRQ: number;
    totalRQBruto: number;
    totalOCBienes: number;
    totalOCBienesBruto: number;
    totalOCServicios: number;
    totalOCServiciosBruto: number;
    totalRecepcion: number;
    totalRecepcionBruto: number;
  };
  trazabilidadDetalle: any;
  // Datos del recurso del APU meta (si existe)
  recursoAPUMeta?: {
    cantidad: number;        // metrado/cantidad del recurso en el APU
    precio: number;          // precio unitario del recurso
    parcial: number;         // parcial del recurso
    unidad: string;          // unidad de medida
  } | null;
}

interface GrupoTrazabilidad {
  requerimiento_recurso_id: string;
  requerimiento: {
    codigo: string;
    descripcion: string;
    cantidad: number;
    cantidad_aprobada: number;
    precio: number;
    fecha: string;
    estado: string;
  };
  ordenes_compra: Array<{
    codigo: string;
    descripcion: string;
    cantidad: number;
    precio: number;
    fecha: string;
    estado: string;
    parcial: number;
  }>;
  recepciones: Array<{
    codigo: string;
    tipo: string;
    cantidad: number;
    precio: number;
    fecha: string;
    parcial: number;
    relacionado_con_oc: string | null;
  }>;
  // Totales del grupo
  total_rq_neto: number;
  total_rq_bruto: number;
  total_oc_neto: number;
  total_oc_bruto: number;
  total_real: number;
}

// Componente para mostrar análisis de ejecución vs presupuesto de TODOS los recursos de la partida
export function AnalisisEjecucionPresupuestadoPartida({
  todosLosRecursos,
  trazabilidadDetalle,
  todosRecursosAPUMeta,
}: {
  todosLosRecursos: Array<{
    recurso_id: string;
    codigo: string;
    descripcion: string;
    totalComposicion: number;
    totalRQ: number;
    totalRQBruto: number;
    totalOCBienes: number;
    totalOCBienesBruto: number;
    totalOCServicios: number;
    totalOCServiciosBruto: number;
    totalRecepcion: number;
    totalRecepcionBruto: number;
    diferencia: number;
  }>;
  trazabilidadDetalle: any;
  todosRecursosAPUMeta?: any; // Recursos del APU meta
}) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Procesar datos de TODOS los recursos con sus detalles de trazabilidad
  const datosRecursosConDetalle = useMemo(() => {
    if (!todosLosRecursos || !trazabilidadDetalle) return [];

    return todosLosRecursos.map(recurso => {
      // Filtrar trazabilidades del recurso actual
      const trazabilidades = trazabilidadDetalle.trazabilidades?.filter(
        (t: any) => t.recurso_id === recurso.recurso_id
      ) || [];

      if (trazabilidades.length === 0) {
        return {
          recurso,
          gruposTrazabilidad: [],
          pptoMeta: { metrado: 0, precioUnitario: 0, parcial: 0 },
        };
      }

      // Procesar grupos de trazabilidad (igual que en el componente individual)
      const grupos = new Map<string, any>();

      // Procesar requerimientos
      trazabilidades.forEach((trazabilidad: any) => {
        (trazabilidad.requerimientos_recurso || []).forEach((req: any) => {
          const estadoValido = req.requerimiento_data?.estado_atencion &&
            ESTADOS_REQUERIMIENTO_VALIDOS.includes(req.requerimiento_data.estado_atencion);

          if (!estadoValido) return;

          const requerimiento_recurso_id = req.requerimiento_recurso_id || req.id;
          if (!grupos.has(requerimiento_recurso_id)) {
            grupos.set(requerimiento_recurso_id, {
              requerimiento_recurso_id,
              requerimiento: {
                codigo: req.requerimiento_data?.codigo || '-',
                descripcion: req.requerimiento_data?.sustento || 'Sin descripción',
                cantidad: req.cantidad || 0,
                cantidad_aprobada: req.cantidad_aprobada || 0,
                precio: req.precio || 0,
                fecha: req.requerimiento_data?.fecha_solicitud || null,
                estado: req.requerimiento_data?.estado_atencion || 'pendiente',
              },
              ordenes_compra: [],
              recepciones: [],
              total_rq_neto: 0,
              total_rq_bruto: 0,
              total_oc_neto: 0,
              total_oc_bruto: 0,
              total_real: 0,
            });
          }

          const grupo = grupos.get(requerimiento_recurso_id)!;
          grupo.total_rq_bruto += (req.cantidad_aprobada || 0) * (req.precio || 0);
        });
      });

      // Procesar órdenes de compra
      trazabilidades.forEach((trazabilidad: any) => {
        (trazabilidad.ordenes_compra_recurso || []).forEach((oc: any) => {
          if (ESTADOS_OC_RECHAZADOS.includes(oc.orden_compra_data?.estado)) return;

          const requerimiento_recurso_id = oc.requerimiento_recurso_id;
          const cantidad = oc.cantidad || 0;
          const precio = oc.costo_real || oc.costo_aproximado || 0;

          if (requerimiento_recurso_id && grupos.has(requerimiento_recurso_id)) {
            const grupo = grupos.get(requerimiento_recurso_id)!;
            grupo.ordenes_compra.push({
              codigo: oc.orden_compra_data?.codigo_orden || '-',
              descripcion: oc.orden_compra_data?.descripcion || 'Sin descripción',
              cantidad,
              precio,
              fecha: oc.orden_compra_data?.fecha_ini || null,
              estado: oc.orden_compra_data?.estado || 'pendiente',
              parcial: cantidad * precio,
            });
            grupo.total_oc_bruto += cantidad * precio;
          }
        });
      });

      // Procesar transferencias/recepciones
      trazabilidades.forEach((trazabilidad: any) => {
        (trazabilidad.transferencias_recurso || []).forEach((transf: any) => {
          const tipo = transf.transferencia_detalle_data?.tipo;
          if (tipo !== 'RECEPCION_COMPRA' && tipo !== 'RECEPCION_TRANSFERENCIA') return;

          const cantidad = transf.cantidad || 0;
          const costo = transf.costo || 0;
          const requerimiento_recurso_id = transf.requerimiento_recurso_id;
          const referencia_id = transf.transferencia_detalle_data?.referencia_id;

          // Buscar OC relacionada
          let ocRelacionada: any = null;
          trazabilidades.forEach((t: any) => {
            const oc = (t.ordenes_compra_recurso || []).find((ocItem: any) =>
              ocItem.orden_compra_data?.id === referencia_id
            );
            if (oc) ocRelacionada = oc;
          });

          const rrId = ocRelacionada?.requerimiento_recurso_id || requerimiento_recurso_id;

          if (rrId && grupos.has(rrId)) {
            const grupo = grupos.get(rrId)!;
            grupo.recepciones.push({
              codigo: transf.transferencia_detalle_data?.referencia_codigo || '-',
              tipo: tipo || 'RECEPCION_COMPRA',
              cantidad,
              precio: costo,
              fecha: transf.transferencia_detalle_data?.fecha || null,
              parcial: cantidad * costo,
              relacionado_con_oc: referencia_id,
            });
            grupo.total_real += cantidad * costo;
          }
        });
      });

      // Calcular totales neto/bruto por grupo
      grupos.forEach((grupo) => {
        const cantidadOC = grupo.ordenes_compra.reduce((sum: number, oc: any) => sum + oc.cantidad, 0);
        const cantidadTransfDirecta = grupo.recepciones
          .filter((r: any) => r.tipo === 'RECEPCION_TRANSFERENCIA')
          .reduce((sum: number, rec: any) => sum + rec.cantidad, 0);
        
        if (grupo.requerimiento) {
          const cantidadPendiente = Math.max(0, grupo.requerimiento.cantidad_aprobada - cantidadOC - cantidadTransfDirecta);
          grupo.total_rq_neto = cantidadPendiente * grupo.requerimiento.precio;
        }

        const cantidadRecibida = grupo.recepciones
          .filter((r: any) => r.tipo === 'RECEPCION_COMPRA')
          .reduce((sum: number, rec: any) => sum + rec.cantidad, 0);
        
        grupo.ordenes_compra.forEach((oc: any) => {
          const recibidoDeEstaOC = grupo.recepciones
            .filter((r: any) => r.relacionado_con_oc === oc.codigo || r.codigo === oc.codigo)
            .reduce((sum: number, rec: any) => sum + rec.cantidad, 0);
          const pendiente = Math.max(0, oc.cantidad - recibidoDeEstaOC);
          grupo.total_oc_neto += pendiente * oc.precio;
        });
      });

      const gruposTrazabilidad = Array.from(grupos.values());

      // Calcular ppto meta para este recurso
      const pptoMeta = {
        metrado: 0,
        precioUnitario: 0,
        parcial: recurso.totalComposicion || 0,
      };

      return {
        recurso,
        gruposTrazabilidad,
        pptoMeta,
        totalesRQ: {
          metradoNeto: gruposTrazabilidad.reduce((sum, g) => {
            if (g.requerimiento && g.requerimiento.precio > 0) {
              return sum + (g.total_rq_neto / g.requerimiento.precio);
            }
            return sum;
          }, 0),
          metradoBruto: gruposTrazabilidad.reduce((sum, g) => {
            return sum + (g.requerimiento?.cantidad_aprobada || 0);
          }, 0),
          parcialNeto: recurso.totalRQ,
          parcialBruto: recurso.totalRQBruto,
        },
        totalesOC: {
          metradoNeto: gruposTrazabilidad.reduce((sum, g) => {
            return sum + g.ordenes_compra.reduce((s: number, oc: any) => {
              const recibido = g.recepciones
                .filter((r: any) => r.relacionado_con_oc === oc.codigo || (r.tipo === 'RECEPCION_COMPRA' && r.codigo === oc.codigo))
                .reduce((sr: number, rec: any) => sr + rec.cantidad, 0);
              return s + Math.max(0, oc.cantidad - recibido);
            }, 0);
          }, 0),
          metradoBruto: gruposTrazabilidad.reduce((sum, g) => {
            return sum + g.ordenes_compra.reduce((s: number, oc: any) => s + oc.cantidad, 0);
          }, 0),
          parcialNeto: recurso.totalOCBienes + recurso.totalOCServicios,
          parcialBruto: recurso.totalOCBienesBruto + recurso.totalOCServiciosBruto,
        },
        totalesReal: {
          metrado: gruposTrazabilidad.reduce((sum, g) => {
            return sum + g.recepciones.reduce((s: number, rec: any) => s + rec.cantidad, 0);
          }, 0),
          parcial: recurso.totalRecepcion,
        },
      };
    });
  }, [todosLosRecursos, trazabilidadDetalle]);

  // Calcular totales generales de TODA LA PARTIDA
  const totalesGeneralesPartida = useMemo(() => {
    if (datosRecursosConDetalle.length === 0) {
      return {
        metradoPresupuesto: 0,
        apuPresupuesto: 0,
        totalPresupuesto: 0,
        totalRQNeto: 0,
        totalRQBruto: 0,
        totalOCNeto: 0,
        totalOCBruto: 0,
        totalReal: 0,
        metradoRQNeto: 0,
        metradoRQBruto: 0,
        metradoOCNeto: 0,
        metradoOCBruto: 0,
        metradoReal: 0,
      };
    }

    const metradoPresupuesto = datosRecursosConDetalle.reduce((sum, d) => sum + d.pptoMeta.metrado, 0);
    const totalPresupuesto = datosRecursosConDetalle.reduce((sum, d) => sum + d.pptoMeta.parcial, 0);
    const apuPresupuesto = metradoPresupuesto > 0 ? totalPresupuesto / metradoPresupuesto : 0;

    return {
      metradoPresupuesto,
      apuPresupuesto,
      totalPresupuesto,
      totalRQNeto: datosRecursosConDetalle.reduce((sum, d) => sum + d.recurso.totalRQ, 0),
      totalRQBruto: datosRecursosConDetalle.reduce((sum, d) => sum + d.recurso.totalRQBruto, 0),
      totalOCNeto: datosRecursosConDetalle.reduce((sum, d) => sum + (d.recurso.totalOCBienes + d.recurso.totalOCServicios), 0),
      totalOCBruto: datosRecursosConDetalle.reduce((sum, d) => sum + (d.recurso.totalOCBienesBruto + d.recurso.totalOCServiciosBruto), 0),
      totalReal: datosRecursosConDetalle.reduce((sum, d) => sum + d.recurso.totalRecepcion, 0),
      metradoRQNeto: datosRecursosConDetalle.reduce((sum, d) => sum + (d.totalesRQ?.metradoNeto || 0), 0),
      metradoRQBruto: datosRecursosConDetalle.reduce((sum, d) => sum + (d.totalesRQ?.metradoBruto || 0), 0),
      metradoOCNeto: datosRecursosConDetalle.reduce((sum, d) => sum + (d.totalesOC?.metradoNeto || 0), 0),
      metradoOCBruto: datosRecursosConDetalle.reduce((sum, d) => sum + (d.totalesOC?.metradoBruto || 0), 0),
      metradoReal: datosRecursosConDetalle.reduce((sum, d) => sum + (d.totalesReal?.metrado || 0), 0),
    };
  }, [datosRecursosConDetalle]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="overflow-x-auto flex-1 min-h-0" style={{ overflowY: 'auto' }}>
        <div className="min-w-full">
          {/* Tabla principal - igual que el componente individual pero para todos los recursos */}
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th colSpan={3} className="px-2 py-2 text-center font-semibold text-[var(--text-secondary)] border border-[var(--border-color)] bg-[var(--card-bg)] border-r-1 border-r-[var(--border-color)]">
                  Pre
                </th>
                <th colSpan={9} className="px-2 py-2 text-center font-semibold text-[var(--text-secondary)] border border-[var(--border-color)] bg-[var(--card-bg)]">
                  Ejecución
                </th>
              </tr>
              <tr>
                <th colSpan={3} className="px-2 py-1 text-center uppercase font-semibold text-blue-700 dark:text-blue-400 border border-[var(--border-color)] bg-blue-500/10 dark:bg-blue-900/10">
                  Presupuesto
                </th>
                <th colSpan={3} className="px-2 py-1 text-center font-semibold text-orange-600 dark:text-orange-400 border border-[var(--border-color)] bg-orange-500/10 dark:bg-orange-900/10">
                  RQ (PROYECTADO)
                </th>
                <th colSpan={3} className="px-2 py-1 text-center font-semibold text-red-600 dark:text-red-400 border border-[var(--border-color)] bg-red-500/10 dark:bg-red-900/10">
                  OC (PROYECTADO)
                </th>
                <th colSpan={3} className="px-2 py-1 text-center font-semibold text-green-600 dark:text-green-400 border border-[var(--border-color)] bg-green-500/10 dark:bg-green-900/10">
                  INGRESOS/ALMACEN (REAL)
                </th>
              </tr>
              <tr>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-blue-500/10 dark:bg-blue-900/10">
                  metrado
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-blue-500/10 dark:bg-blue-900/10">
                  apu
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-blue-500/10 dark:bg-blue-900/10">
                  parcial
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-orange-500/10 dark:bg-orange-900/10">
                  metrado
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-orange-500/10 dark:bg-orange-900/10">
                  precio
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-orange-500/10 dark:bg-orange-900/10">
                  parcial
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-red-500/10 dark:bg-red-900/10">
                  metrado
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-red-500/10 dark:bg-red-900/10">
                  precio
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-red-500/10 dark:bg-red-900/10">
                  parcial
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-green-500/10 dark:bg-green-900/10">
                  metrado
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-green-500/10 dark:bg-green-900/10">
                  precio
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-green-500/10 dark:bg-green-900/10">
                  parcial
                </th>
              </tr>
            </thead>
            <tbody>
              {datosRecursosConDetalle.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-2 py-8 text-center text-[var(--text-secondary)]">
                    No hay datos de trazabilidad disponibles
                  </td>
                </tr>
              )}
              
              {/* FILA DE TOTALES GENERALES DE TODA LA PARTIDA */}
              {datosRecursosConDetalle.length > 0 && (
                <>

                  <tr className="bg-[var(--background)] font-bold">
                    {/* Ppto Meta Total */}
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-blue-500/8 dark:bg-blue-900/8">
                      {totalesGeneralesPartida.metradoPresupuesto.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-blue-500/8 dark:bg-blue-900/8">
                      {totalesGeneralesPartida.apuPresupuesto.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right font-bold text-[var(--text-primary)] bg-blue-500/8 dark:bg-blue-900/8">
                      {formatCurrency(totalesGeneralesPartida.totalPresupuesto)}
                    </td>
                    {/* RQ TOTALES GENERALES */}
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right font-bold text-[var(--text-primary)] bg-orange-500/8 dark:bg-orange-900/8">
                      {totalesGeneralesPartida.metradoRQNeto.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right font-bold text-[var(--text-primary)] bg-orange-500/8 dark:bg-orange-900/8">
                      {(totalesGeneralesPartida.metradoRQBruto > 0 ? totalesGeneralesPartida.totalRQBruto / totalesGeneralesPartida.metradoRQBruto : 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right text-xs font-bold text-[var(--text-primary)] bg-orange-500/8 dark:bg-orange-900/8">
                      {formatCurrency(totalesGeneralesPartida.totalRQNeto)}
                      <br />
                      <span className="text-[10px] font-normal">Bruto: {formatCurrency(totalesGeneralesPartida.totalRQBruto)}</span>
                    </td>
                    {/* OC TOTALES GENERALES */}
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right font-bold text-[var(--text-primary)] bg-red-500/8 dark:bg-red-900/8">
                      {totalesGeneralesPartida.metradoOCNeto.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right font-bold text-[var(--text-primary)] bg-red-500/8 dark:bg-red-900/8">
                      {(totalesGeneralesPartida.metradoOCBruto > 0 ? totalesGeneralesPartida.totalOCBruto / totalesGeneralesPartida.metradoOCBruto : 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right text-xs font-bold text-[var(--text-primary)] bg-red-500/8 dark:bg-red-900/8">
                      {formatCurrency(totalesGeneralesPartida.totalOCNeto)}
                      <br />
                      <span className="text-[10px] font-normal">Bruto: {formatCurrency(totalesGeneralesPartida.totalOCBruto)}</span>
                    </td>
                    {/* REAL TOTALES GENERALES */}
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right font-bold text-[var(--text-primary)] bg-green-500/8 dark:bg-green-900/8">
                      {totalesGeneralesPartida.metradoReal.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right font-bold text-[var(--text-primary)] bg-green-500/8 dark:bg-green-900/8">
                      {(totalesGeneralesPartida.metradoReal > 0 ? totalesGeneralesPartida.totalReal / totalesGeneralesPartida.metradoReal : 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right font-bold text-[var(--text-primary)] bg-green-500/8 dark:bg-green-900/8">
                      {formatCurrency(totalesGeneralesPartida.totalReal)}
                    </td>
                  </tr>
                </>
              )}

              {datosRecursosConDetalle.map((datoRecurso, recursoIndex) => (
                <React.Fragment key={datoRecurso.recurso.recurso_id}>
                  {/* Fila principal del RECURSO con totales agregados */}
                  <tr className="bg-gray-100 dark:bg-gray-800/40">
                    <td colSpan={12} className="px-2 py-2 border border-[var(--border-color)] text-[13px] font-bold text-gray-900 dark:text-gray-100">
                      Recurso: {datoRecurso.recurso.codigo} - {datoRecurso.recurso.descripcion}
                    </td>
                  </tr>
                  <tr className="bg-[var(--background)] font-semibold">
                    {/* Ppto Meta */}
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-blue-500/5 dark:bg-blue-900/5">
                      {datoRecurso.pptoMeta.metrado.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-blue-500/5 dark:bg-blue-900/5">
                      {datoRecurso.pptoMeta.precioUnitario.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-blue-500/5 dark:bg-blue-900/5">
                      {formatCurrency(datoRecurso.pptoMeta.parcial)}
                    </td>
                    {/* RQ TOTALES */}
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-orange-500/5 dark:bg-orange-900/5">
                      {(datoRecurso.totalesRQ?.metradoNeto || 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-orange-500/5 dark:bg-orange-900/5">
                      {((datoRecurso.totalesRQ?.metradoBruto || 0) > 0 ? datoRecurso.recurso.totalRQBruto / (datoRecurso.totalesRQ?.metradoBruto || 1) : 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right text-xs font-semibold text-[var(--text-primary)] bg-orange-500/5 dark:bg-orange-900/5">
                      {formatCurrency(datoRecurso.recurso.totalRQ)}
                      <br />
                      <span className="text-[10px] font-normal">Bruto: {formatCurrency(datoRecurso.recurso.totalRQBruto)}</span>
                    </td>
                    {/* OC TOTALES */}
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-red-500/5 dark:bg-red-900/5">
                      {(datoRecurso.totalesOC?.metradoNeto || 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-red-500/5 dark:bg-red-900/5">
                      {((datoRecurso.totalesOC?.metradoBruto || 0) > 0 ? (datoRecurso.recurso.totalOCBienesBruto + datoRecurso.recurso.totalOCServiciosBruto) / (datoRecurso.totalesOC?.metradoBruto || 1) : 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right text-xs font-semibold text-[var(--text-primary)] bg-red-500/5 dark:bg-red-900/5">
                      {formatCurrency(datoRecurso.recurso.totalOCBienes + datoRecurso.recurso.totalOCServicios)}
                      <br />
                      <span className="text-[10px] font-normal">Bruto: {formatCurrency(datoRecurso.recurso.totalOCBienesBruto + datoRecurso.recurso.totalOCServiciosBruto)}</span>
                    </td>
                    {/* REAL TOTALES */}
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-green-500/5 dark:bg-green-900/5">
                      {(datoRecurso.totalesReal?.metrado || 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-green-500/5 dark:bg-green-900/5">
                      {((datoRecurso.totalesReal?.metrado || 0) > 0 ? datoRecurso.recurso.totalRecepcion / (datoRecurso.totalesReal?.metrado || 1) : 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-green-500/5 dark:bg-green-900/5">
                      {formatCurrency(datoRecurso.recurso.totalRecepcion)}
                    </td>
                  </tr>

                  {/* Grupos de trazabilidad de este recurso */}
                  {datoRecurso.gruposTrazabilidad.map((grupo, grupoIndex) => (
                    <React.Fragment key={grupo.requerimiento_recurso_id}>
                      {/* Separador visual para cada grupo */}
                      <tr className="bg-gray-50/70 dark:bg-gray-800/20">
                        <td colSpan={12} className="px-2 py-1 border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)]">
                          Requerimiento {grupo.requerimiento?.codigo || 'N/A'} - {grupo.requerimiento?.descripcion?.substring(0, 60) || 'Sin requerimiento'}...
                        </td>
                      </tr>

                      {/* RQ - Solo mostrar si hay requerimiento */}
                      {grupo.requerimiento && (
                        <tr>
                          <td colSpan={3} className="px-2 py-1"></td>
                          <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-orange-500/5 dark:bg-orange-900/5">
                            {(grupo.total_rq_neto / (grupo.requerimiento.precio || 1)).toFixed(2)}
                          </td>
                          <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-orange-500/5 dark:bg-orange-900/5">
                            {grupo.requerimiento.precio.toFixed(2)}
                          </td>
                          <td className="px-2 py-1 border border-[var(--border-color)] text-right text-xs text-[var(--text-primary)] bg-orange-500/5 dark:bg-orange-900/5">
                            <span className="text-xs">Neto: {formatCurrency(grupo.total_rq_neto)}</span>
                            <br />
                            <span className="text-[10px] font-normal">Bruto: {formatCurrency(grupo.total_rq_bruto)}</span>
                          </td>
                          <td colSpan={6} className="px-2 py-1"></td>
                        </tr>
                      )}

                      {/* OC para este requerimiento */}
                      {grupo.ordenes_compra.map((oc: any, ocIndex: number) => {
                        const recibido = grupo.recepciones
                          .filter((r: any) => r.relacionado_con_oc === oc.codigo)
                          .reduce((sum: number, rec: any) => sum + rec.cantidad, 0);
                        const pendiente = Math.max(0, oc.cantidad - recibido);
                        const parcialNeto = pendiente * oc.precio;

                        return (
                          <tr key={oc.codigo}>
                            <td colSpan={3} className="px-2 py-1"></td>
                            <td colSpan={3} className="px-2 py-1"></td>
                            <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-red-500/5 dark:bg-red-900/5">
                              {pendiente.toFixed(2)}
                            </td>
                            <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-red-500/5 dark:bg-red-900/5">
                              {oc.precio.toFixed(2)}
                            </td>
                            <td className="px-2 py-1 border border-[var(--border-color)] text-right text-xs text-[var(--text-primary)] bg-red-500/5 dark:bg-red-900/5">
                              <span className="text-xs">Neto: {formatCurrency(parcialNeto)}</span>
                              <br />
                              <span className="text-[10px] font-normal">Bruto: {formatCurrency(oc.parcial)}</span>
                            </td>
                            <td colSpan={3} className="px-2 py-1"></td>
                          </tr>
                        );
                      })}

                      {/* Recepciones para este requerimiento */}
                      {grupo.recepciones.map((rec: any, recIndex: number) => (
                        <tr key={`rec_${recIndex}`}>
                          <td colSpan={3} className="px-2 py-1"></td>
                          <td colSpan={6} className="px-2 py-1"></td>
                          <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-green-500/5 dark:bg-green-900/5">
                            {rec.cantidad.toFixed(2)}
                          </td>
                          <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-green-500/5 dark:bg-green-900/5">
                            {rec.precio.toFixed(2)}
                          </td>
                          <td className="px-2 py-1 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-green-500/5 dark:bg-green-900/5">
                            {formatCurrency(rec.parcial)}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {/* Leyenda */}
          <div className="mt-4 p-3 bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)]">
            <div className="text-xs font-semibold text-[var(--text-primary)] mb-2">Leyenda:</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-[var(--text-secondary)]">
              <div>
                <span className="font-semibold">Neto:</span> Pendiente/comprometido (no recibido)
              </div>
              <div>
                <span className="font-semibold">Bruto:</span> Total comprometido
              </div>
              <div>
                <span className="font-semibold">Real:</span> Recibido en almacén
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Estados válidos para requerimientos (excluye "Pendiente de envio" y rechazados)
const ESTADOS_REQUERIMIENTO_VALIDOS = ['pendiente', 'aprobado supervisor', 'aprobado_gerencia', 'aprobado_logistica', 'aprobado_almacen', 'Completado'];
const ESTADOS_OC_RECHAZADOS = ['ANULACION', 'rechazado', 'anulado'];

export default function AnalisisEjecucionPresupuestado({
  recurso,
  trazabilidadDetalle,
  recursoAPUMeta,
}: AnalisisEjecucionPresupuestadoProps) {
  // Procesar datos reales y agrupar por requerimiento_recurso_id
  const gruposTrazabilidad: GrupoTrazabilidad[] = useMemo(() => {
    if (!trazabilidadDetalle || !recurso) return [];

    // Filtrar trazabilidades del recurso actual
    const trazabilidades = trazabilidadDetalle.trazabilidades?.filter(
      (t: any) => t.recurso_id === recurso.recurso_id
    ) || [];

    if (trazabilidades.length === 0) return [];

    const grupos = new Map<string, GrupoTrazabilidad>();

    // Procesar requerimientos
    trazabilidades.forEach((trazabilidad: any) => {
      (trazabilidad.requerimientos_recurso || []).forEach((req: any) => {
        const estadoValido = req.requerimiento_data?.estado_atencion &&
          ESTADOS_REQUERIMIENTO_VALIDOS.includes(req.requerimiento_data.estado_atencion);

        if (!estadoValido) return; // Saltar requerimientos con estado inválido

        const requerimiento_recurso_id = req.requerimiento_recurso_id || req.id;
        if (!grupos.has(requerimiento_recurso_id)) {
          grupos.set(requerimiento_recurso_id, {
            requerimiento_recurso_id,
            requerimiento: {
              codigo: req.requerimiento_data?.codigo || '-',
              descripcion: req.requerimiento_data?.sustento || 'Sin descripción',
              cantidad: req.cantidad || 0,
              cantidad_aprobada: req.cantidad_aprobada || 0,
              precio: req.precio || 0,
              fecha: req.requerimiento_data?.fecha_solicitud || null,
              estado: req.requerimiento_data?.estado_atencion || 'pendiente',
            },
            ordenes_compra: [],
            recepciones: [],
            total_rq_neto: 0,
            total_rq_bruto: 0,
            total_oc_neto: 0,
            total_oc_bruto: 0,
            total_real: 0,
          });
        }

        const grupo = grupos.get(requerimiento_recurso_id)!;
        grupo.total_rq_bruto += (req.cantidad_aprobada || 0) * (req.precio || 0);
      });
    });

    // Procesar órdenes de compra
    trazabilidades.forEach((trazabilidad: any) => {
      (trazabilidad.ordenes_compra_recurso || []).forEach((oc: any) => {
        if (ESTADOS_OC_RECHAZADOS.includes(oc.orden_compra_data?.estado)) return;

        const requerimiento_recurso_id = oc.requerimiento_recurso_id;
        const cantidad = oc.cantidad || 0;
        const precio = oc.costo_real || oc.costo_aproximado || 0;

        if (requerimiento_recurso_id && grupos.has(requerimiento_recurso_id)) {
          const grupo = grupos.get(requerimiento_recurso_id)!;
          grupo.ordenes_compra.push({
            codigo: oc.orden_compra_data?.codigo_orden || '-',
            descripcion: oc.orden_compra_data?.descripcion || 'Sin descripción',
            cantidad,
            precio,
            fecha: oc.orden_compra_data?.fecha_ini || null,
            estado: oc.orden_compra_data?.estado || 'pendiente',
            parcial: cantidad * precio,
          });
          grupo.total_oc_bruto += cantidad * precio;
        } else {
          // OC sin requerimiento asociado
          const ocId = `oc_${oc.id}`;
          if (!grupos.has(ocId)) {
            grupos.set(ocId, {
              requerimiento_recurso_id: ocId,
              requerimiento: null as any,
              ordenes_compra: [],
              recepciones: [],
              total_rq_neto: 0,
              total_rq_bruto: 0,
              total_oc_neto: 0,
              total_oc_bruto: 0,
              total_real: 0,
            });
          }
          const grupo = grupos.get(ocId)!;
          grupo.ordenes_compra.push({
            codigo: oc.orden_compra_data?.codigo_orden || '-',
            descripcion: oc.orden_compra_data?.descripcion || 'Sin descripción',
            cantidad,
            precio,
            fecha: oc.orden_compra_data?.fecha_ini || null,
            estado: oc.orden_compra_data?.estado || 'pendiente',
            parcial: cantidad * precio,
          });
          grupo.total_oc_bruto += cantidad * precio;
        }
      });
    });

    // Procesar transferencias/recepciones
    trazabilidades.forEach((trazabilidad: any) => {
      (trazabilidad.transferencias_recurso || []).forEach((transf: any) => {
        const tipo = transf.transferencia_detalle_data?.tipo;
        if (tipo !== 'RECEPCION_COMPRA' && tipo !== 'RECEPCION_TRANSFERENCIA') return;

        const cantidad = transf.cantidad || 0;
        const costo = transf.costo || 0;
        const requerimiento_recurso_id = transf.requerimiento_recurso_id;
        const referencia_id = transf.transferencia_detalle_data?.referencia_id;

        // Buscar OC relacionada
        let ocRelacionada: any = null;
        trazabilidades.forEach((t: any) => {
          const oc = (t.ordenes_compra_recurso || []).find((ocItem: any) =>
            ocItem.orden_compra_data?.id === referencia_id
          );
          if (oc) ocRelacionada = oc;
        });

        const rrId = ocRelacionada?.requerimiento_recurso_id || requerimiento_recurso_id;

        if (rrId && grupos.has(rrId)) {
          const grupo = grupos.get(rrId)!;
          grupo.recepciones.push({
            codigo: transf.transferencia_detalle_data?.referencia_codigo || '-',
            tipo: tipo || 'RECEPCION_COMPRA',
            cantidad,
            precio: costo,
            fecha: transf.transferencia_detalle_data?.fecha || null,
            parcial: cantidad * costo,
            relacionado_con_oc: referencia_id,
          });
          grupo.total_real += cantidad * costo;
        } else {
          // Recepción sin requerimiento/OC asociada
          const recId = `rec_${transf.id}`;
          if (!grupos.has(recId)) {
            grupos.set(recId, {
              requerimiento_recurso_id: recId,
              requerimiento: null as any,
              ordenes_compra: [],
              recepciones: [],
              total_rq_neto: 0,
              total_rq_bruto: 0,
              total_oc_neto: 0,
              total_oc_bruto: 0,
              total_real: 0,
            });
          }
          const grupo = grupos.get(recId)!;
          grupo.recepciones.push({
            codigo: transf.transferencia_detalle_data?.referencia_codigo || '-',
            tipo: tipo || 'RECEPCION_COMPRA',
            cantidad,
            precio: costo,
            fecha: transf.transferencia_detalle_data?.fecha || null,
            parcial: cantidad * costo,
            relacionado_con_oc: referencia_id,
          });
          grupo.total_real += cantidad * costo;
        }
      });
    });

    // Calcular totales neto/bruto por grupo
    grupos.forEach((grupo) => {
      // Calcular RQ neto: cantidad_aprobada - cantidad en OC - cantidad en transferencias directas
      const cantidadOC = grupo.ordenes_compra.reduce((sum, oc) => sum + oc.cantidad, 0);
      const cantidadTransfDirecta = grupo.recepciones
        .filter(r => r.tipo === 'RECEPCION_TRANSFERENCIA')
        .reduce((sum, rec) => sum + rec.cantidad, 0);
      
      if (grupo.requerimiento) {
        const cantidadPendiente = Math.max(0, grupo.requerimiento.cantidad_aprobada - cantidadOC - cantidadTransfDirecta);
        grupo.total_rq_neto = cantidadPendiente * grupo.requerimiento.precio;
      }

      // Calcular OC neto: cantidad pendiente de recepción
      const cantidadRecibida = grupo.recepciones
        .filter(r => r.tipo === 'RECEPCION_COMPRA')
        .reduce((sum, rec) => sum + rec.cantidad, 0);
      
      grupo.ordenes_compra.forEach(oc => {
        const recibidoDeEstaOC = grupo.recepciones
          .filter(r => r.relacionado_con_oc === oc.codigo || r.codigo === oc.codigo)
          .reduce((sum, rec) => sum + rec.cantidad, 0);
        const pendiente = Math.max(0, oc.cantidad - recibidoDeEstaOC);
        grupo.total_oc_neto += pendiente * oc.precio;
      });
    });

    return Array.from(grupos.values());
  }, [trazabilidadDetalle, recurso]);

 


  // Calcular Ppto Meta del RECURSO específico del APU
  const pptoMeta = useMemo(() => {
    // Si tenemos datos del recurso del APU meta, usarlos
    if (recursoAPUMeta) {
      return {
        metrado: recursoAPUMeta.cantidad || 0,
        precioUnitario: recursoAPUMeta.precio || 0,
        parcial: recursoAPUMeta.parcial || 0,
      };
    }
    
    // Si no existe el recurso en el APU meta, mostrar 0
    return {
      metrado: 0,
      precioUnitario: 0,
      parcial: 0,
    };
  }, [recursoAPUMeta]);

  // Totales generales de RQ
  const totalesRQ = useMemo(() => {
    const metradoNeto = gruposTrazabilidad.reduce((sum, g) => {
      if (g.requerimiento && g.requerimiento.precio > 0) {
        return sum + (g.total_rq_neto / g.requerimiento.precio);
      }
      return sum;
    }, 0);
    const metradoBruto = gruposTrazabilidad.reduce((sum, g) => {
      return sum + (g.requerimiento?.cantidad_aprobada || 0);
    }, 0);

    return {
      metradoNeto,
      metradoBruto,
      parcialNeto: recurso.totalRQ,
      parcialBruto: recurso.totalRQBruto,
    };
  }, [gruposTrazabilidad, recurso]);

  // Totales generales de OC
  const totalesOC = useMemo(() => {
    const metradoNeto = gruposTrazabilidad.reduce((sum, g) => {
      return sum + g.ordenes_compra.reduce((s, oc) => {
        const recibido = g.recepciones
          .filter(r => r.relacionado_con_oc === oc.codigo || (r.tipo === 'RECEPCION_COMPRA' && r.codigo === oc.codigo))
          .reduce((sr, rec) => sr + rec.cantidad, 0);
        return s + Math.max(0, oc.cantidad - recibido);
      }, 0);
    }, 0);
    const metradoBruto = gruposTrazabilidad.reduce((sum, g) => {
      return sum + g.ordenes_compra.reduce((s, oc) => s + oc.cantidad, 0);
    }, 0);

    return {
      metradoNeto,
      metradoBruto,
      parcialNeto: recurso.totalOCBienes + recurso.totalOCServicios,
      parcialBruto: recurso.totalOCBienesBruto + recurso.totalOCServiciosBruto,
    };
  }, [gruposTrazabilidad, recurso]);

  // Totales generales de Recepciones
  const totalesReal = useMemo(() => {
    const metrado = gruposTrazabilidad.reduce((sum, g) => {
      return sum + g.recepciones.reduce((s, rec) => s + rec.cantidad, 0);
    }, 0);

    return {
      metrado,
      parcial: recurso.totalRecepcion,
    };
  }, [gruposTrazabilidad, recurso]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="overflow-x-auto flex-1 min-h-0" style={{ overflowY: 'auto' }}>
        <div className="min-w-full">
          {/* Tabla principal - Estructura simplificada */}
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th colSpan={3} className="px-2 py-2 text-center font-semibold text-[var(--text-secondary)] border border-[var(--border-color)] bg-[var(--card-bg)] border-r-1 border-r-[var(--border-color)]">
                  Pre
                </th>
                <th colSpan={9} className="px-2 py-2 text-center font-semibold text-[var(--text-secondary)] border border-[var(--border-color)] bg-[var(--card-bg)]">
                  Ejecución
                </th>
              </tr>
              <tr>
                <th colSpan={3} className="px-2 py-1 text-center uppercase font-semibold text-blue-700 dark:text-blue-400 border border-[var(--border-color)] bg-blue-500/10 dark:bg-blue-900/10">
                  Presupuesto
                </th>
                <th colSpan={3} className="px-2 py-1 text-center font-semibold text-orange-600 dark:text-orange-400 border border-[var(--border-color)] bg-orange-500/10 dark:bg-orange-900/10">
                  RQ (PROYECTADO)
                </th>
                <th colSpan={3} className="px-2 py-1 text-center font-semibold text-red-600 dark:text-red-400 border border-[var(--border-color)] bg-red-500/10 dark:bg-red-900/10">
                  OC (PROYECTADO)
                </th>
                <th colSpan={3} className="px-2 py-1 text-center font-semibold text-green-600 dark:text-green-400 border border-[var(--border-color)] bg-green-500/10 dark:bg-green-900/10">
                  INGRESOS/ALMACEN (REAL)
                </th>
              </tr>
              <tr>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-blue-500/10 dark:bg-blue-900/10">
                  metrado
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-blue-500/10 dark:bg-blue-900/10">
                  apu
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-blue-500/10 dark:bg-blue-900/10">
                  parcial
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-orange-500/10 dark:bg-orange-900/10">
                  metrado
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-orange-500/10 dark:bg-orange-900/10">
                  precio
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-orange-500/10 dark:bg-orange-900/10">
                  parcial
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-red-500/10 dark:bg-red-900/10">
                  metrado
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-red-500/10 dark:bg-red-900/10">
                  precio
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-red-500/10 dark:bg-red-900/10">
                  parcial
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-green-500/10 dark:bg-green-900/10">
                  metrado
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-green-500/10 dark:bg-green-900/10">
                  precio
                </th>
                <th className="px-2 py-1 text-center uppercase text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] bg-green-500/10 dark:bg-green-900/10">
                  parcial
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Fila principal del RECURSO con totales agregados */}
              <tr className="bg-[var(--background)] font-semibold">
                {/* Ppto Meta */}
                <td className="px-2 py-2 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-blue-500/5 dark:bg-blue-900/5">
                  {pptoMeta.metrado.toFixed(2)}
                </td>
                <td className="px-2 py-2 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-blue-500/5 dark:bg-blue-900/5">
                  {pptoMeta.precioUnitario.toFixed(2)}
                </td>
                <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-blue-500/5 dark:bg-blue-900/5">
                  {formatCurrency(pptoMeta.parcial)}
                </td>
                {/* RQ TOTALES: metrado neto, precio promedio, parcial neto (con bruto debajo) */}
                <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-orange-500/5 dark:bg-orange-900/5">
                  {totalesRQ.metradoNeto.toFixed(2)}
                </td>
                <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-orange-500/5 dark:bg-orange-900/5">
                  {(totalesRQ.metradoBruto > 0 ? recurso.totalRQBruto / totalesRQ.metradoBruto : 0).toFixed(2)}
                </td>
                <td className="px-2 py-2 border border-[var(--border-color)] text-right text-xs font-semibold text-[var(--text-primary)] bg-orange-500/5 dark:bg-orange-900/5">
                  {formatCurrency(recurso.totalRQ)}
                  <br />
                  <span className="text-[10px] font-normal">Bruto: {formatCurrency(recurso.totalRQBruto)}</span>
                </td>
                {/* OC TOTALES: metrado neto, precio promedio, parcial neto (con bruto debajo) */}
                <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-red-500/5 dark:bg-red-900/5">
                  {totalesOC.metradoNeto.toFixed(2)}
                </td>
                <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-red-500/5 dark:bg-red-900/5">
                  {(totalesOC.metradoBruto > 0 ? (recurso.totalOCBienesBruto + recurso.totalOCServiciosBruto) / totalesOC.metradoBruto : 0).toFixed(2)}
                </td>
                <td className="px-2 py-2 border border-[var(--border-color)] text-right text-xs font-semibold text-[var(--text-primary)] bg-red-500/5 dark:bg-red-900/5">
                  {formatCurrency(recurso.totalOCBienes + recurso.totalOCServicios)}
                  <br />
                  <span className="text-[10px] font-normal">Bruto: {formatCurrency(recurso.totalOCBienesBruto + recurso.totalOCServiciosBruto)}</span>
                </td>
                {/* REAL TOTALES: metrado, precio promedio, parcial */}
                <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-green-500/5 dark:bg-green-900/5">
                  {totalesReal.metrado.toFixed(2)}
                </td>
                <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-green-500/5 dark:bg-green-900/5">
                  {(totalesReal.metrado > 0 ? recurso.totalRecepcion / totalesReal.metrado : 0).toFixed(2)}
                </td>
                <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-green-500/5 dark:bg-green-900/5">
                  {formatCurrency(recurso.totalRecepcion)}
                </td>
              </tr>

              {/* Grupos de trazabilidad agrupados */}
              {gruposTrazabilidad.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-2 py-8 text-center text-[var(--text-secondary)]">
                    No hay datos de trazabilidad disponibles
                  </td>
                </tr>
              )}
              {gruposTrazabilidad.map((grupo, grupoIndex) => (
                <React.Fragment key={grupo.requerimiento_recurso_id}>
                  {/* Separador visual para cada grupo */}
                  <tr className="bg-gray-50/70 dark:bg-gray-800/20">
                    <td colSpan={12} className="px-2 py-1 border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)]">
                      Requerimiento {grupo.requerimiento?.codigo || 'N/A'} - {grupo.requerimiento?.descripcion?.substring(0, 60) || 'Sin requerimiento'}...
                    </td>
                  </tr>

                  {/* RQ - Solo mostrar si hay requerimiento */}
                  {grupo.requerimiento && (
                    <tr>
                      <td colSpan={3} className="px-2 py-1"></td>
                      {/* RQ Neto: cantidad pendiente */}
                      <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-orange-500/5 dark:bg-orange-900/5">
                        {(grupo.total_rq_neto / (grupo.requerimiento.precio || 1)).toFixed(2)}
                      </td>
                      <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-orange-500/5 dark:bg-orange-900/5">
                        {grupo.requerimiento.precio.toFixed(2)}
                      </td>
                      <td className="px-2 py-1 border border-[var(--border-color)] text-right text-xs text-[var(--text-primary)] bg-orange-500/5 dark:bg-orange-900/5">
                        <span className="text-xs">Neto: {formatCurrency(grupo.total_rq_neto)}</span>
                        <br />
                        <span className="text-[10px] font-normal">Bruto: {formatCurrency(grupo.total_rq_bruto)}</span>
                      </td>
                      <td colSpan={6} className="px-2 py-1"></td>
                    </tr>
                  )}

                  {/* OC para este requerimiento */}
                  {grupo.ordenes_compra.map((oc, ocIndex) => {
                    const recibido = grupo.recepciones
                      .filter(r => r.relacionado_con_oc === oc.codigo)
                      .reduce((sum, rec) => sum + rec.cantidad, 0);
                    const pendiente = Math.max(0, oc.cantidad - recibido);
                    const parcialNeto = pendiente * oc.precio;

                    return (
                      <tr key={oc.codigo}>
                        <td colSpan={3} className="px-2 py-1"></td>
                        <td colSpan={3} className="px-2 py-1"></td>
                        {/* OC Neto: cantidad pendiente de recepción */}
                        <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-red-500/5 dark:bg-red-900/5">
                          {pendiente.toFixed(2)}
                        </td>
                        <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-red-500/5 dark:bg-red-900/5">
                          {oc.precio.toFixed(2)}
                        </td>
                        <td className="px-2 py-1 border border-[var(--border-color)] text-right text-xs text-[var(--text-primary)] bg-red-500/5 dark:bg-red-900/5">
                          <span className="text-xs">Neto: {formatCurrency(parcialNeto)}</span>
                          <br />
                          <span className="text-[10px] font-normal">Bruto: {formatCurrency(oc.parcial)}</span>
                        </td>
                        <td colSpan={3} className="px-2 py-1"></td>
                      </tr>
                    );
                  })}

                  {/* Recepciones para este requerimiento */}
                  {grupo.recepciones.map((rec, recIndex) => (
                    <tr key={`rec_${recIndex}`}>
                      <td colSpan={3} className="px-2 py-1"></td>
                      <td colSpan={6} className="px-2 py-1"></td>
                      <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-green-500/5 dark:bg-green-900/5">
                        {rec.cantidad.toFixed(2)}
                      </td>
                      <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-green-500/5 dark:bg-green-900/5">
                        {rec.precio.toFixed(2)}
                      </td>
                      <td className="px-2 py-1 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-green-500/5 dark:bg-green-900/5">
                        {formatCurrency(rec.parcial)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {/* Leyenda */}
          <div className="mt-4 p-3 bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)]">
            <div className="text-xs font-semibold text-[var(--text-primary)] mb-2">Leyenda:</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-[var(--text-secondary)]">
              <div>
                <span className="font-semibold">Neto:</span> Pendiente/comprometido (no recibido)
              </div>
              <div>
                <span className="font-semibold">Bruto:</span> Total comprometido
              </div>
              <div>
                <span className="font-semibold">Real:</span> Recibido en almacén
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

