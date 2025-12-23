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

  // DATOS DE PRUEBA - Simulando la estructura que tendríamos cuando agreguemos los campos
  const datosPrueba: GrupoTrazabilidad[] = useMemo(() => {
    return gruposTrazabilidad.length > 0 ? gruposTrazabilidad : [
      {
        requerimiento_recurso_id: 'req_001',
        requerimiento: {
          codigo: '004515',
          descripcion: 'PEAJE RUTAS DE LIMA - PARTIDA: ASIA / DESTINO: HUACHO',
          cantidad: 1.0,
          cantidad_aprobada: 1.0,
          precio: 6.36,
          fecha: '2025-09-23',
          estado: 'Completado',
        },
        ordenes_compra: [
          {
            codigo: '459003794',
            descripcion: 'Orden de compra relacionada',
            cantidad: 1.0,
            precio: 6.36,
            fecha: '2025-09-27',
            estado: 'pendiente',
            parcial: 6.36,
          },
        ],
        recepciones: [],
        total_rq_neto: 0, // Ya cubierto por OC
        total_rq_bruto: 6.36,
        total_oc_neto: 6.36, // Pendiente de recepción
        total_oc_bruto: 6.36,
        total_real: 0,
      },
      {
        requerimiento_recurso_id: 'req_002',
        requerimiento: {
          codigo: '004517',
          descripcion: 'PEAJE LIMA EXPRESA - PARTIDA: ASIA / DESTINO: HUACHO',
          cantidad: 1.0,
          cantidad_aprobada: 1.0,
          precio: 5.59,
          fecha: '2025-09-23',
          estado: 'Completado',
        },
        ordenes_compra: [
          {
            codigo: '459003795',
            descripcion: 'Orden de compra relacionada',
            cantidad: 1.0,
            precio: 5.59,
            fecha: '2025-09-27',
            estado: 'pendiente',
            parcial: 5.59,
          },
        ],
        recepciones: [],
        total_rq_neto: 0,
        total_rq_bruto: 5.59,
        total_oc_neto: 5.59,
        total_oc_bruto: 5.59,
        total_real: 0,
      },
      {
        requerimiento_recurso_id: 'req_003',
        requerimiento: {
          codigo: '005836',
          descripcion: 'EMBARQUE DE PASAJE INTERPROVINCIAL DE LIMA A HUACHO',
          cantidad: 1.0,
          cantidad_aprobada: 1.0,
          precio: 1.27,
          fecha: '2025-10-27',
          estado: 'Completado',
        },
        ordenes_compra: [
          {
            codigo: '459004856',
            descripcion: 'Orden de compra relacionada',
            cantidad: 1.0,
            precio: 1.27,
            fecha: '2025-10-28',
            estado: 'pendiente',
            parcial: 1.27,
          },
        ],
        recepciones: [
          {
            codigo: 'REC_001',
            tipo: 'RECEPCION_COMPRA',
            cantidad: 1.0,
            precio: 1.27,
            fecha: '2025-11-01',
            parcial: 1.27,
            relacionado_con_oc: '459004856',
          },
        ],
        total_rq_neto: 0,
        total_rq_bruto: 1.27,
        total_oc_neto: 0, // Ya recibido
        total_oc_bruto: 1.27,
        total_real: 1.27,
      },
    ];
  }, [gruposTrazabilidad]);

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
                <td className="px-2 py-2 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-blue-500/10 dark:bg-blue-900/10">
                  {pptoMeta.metrado.toFixed(2)}
                </td>
                <td className="px-2 py-2 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-blue-500/10 dark:bg-blue-900/10">
                  {pptoMeta.precioUnitario.toFixed(2)}
                </td>
                <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-blue-500/10 dark:bg-blue-900/10">
                  {formatCurrency(pptoMeta.parcial)}
                </td>
                {/* RQ TOTALES: metrado neto, precio promedio, parcial neto (con bruto debajo) */}
                <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-orange-500/10 dark:bg-orange-900/10">
                  {totalesRQ.metradoNeto.toFixed(2)}
                </td>
                <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-orange-500/10 dark:bg-orange-900/10">
                  {(totalesRQ.metradoBruto > 0 ? recurso.totalRQBruto / totalesRQ.metradoBruto : 0).toFixed(2)}
                </td>
                <td className="px-2 py-2 border border-[var(--border-color)] text-right text-xs font-semibold text-[var(--text-primary)] bg-orange-500/10 dark:bg-orange-900/10">
                  {formatCurrency(recurso.totalRQ)}
                  <br />
                  <span className="text-[10px] font-normal">Bruto: {formatCurrency(recurso.totalRQBruto)}</span>
                </td>
                {/* OC TOTALES: metrado neto, precio promedio, parcial neto (con bruto debajo) */}
                <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-red-500/10 dark:bg-red-900/10">
                  {totalesOC.metradoNeto.toFixed(2)}
                </td>
                <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-red-500/10 dark:bg-red-900/10">
                  {(totalesOC.metradoBruto > 0 ? (recurso.totalOCBienesBruto + recurso.totalOCServiciosBruto) / totalesOC.metradoBruto : 0).toFixed(2)}
                </td>
                <td className="px-2 py-2 border border-[var(--border-color)] text-right text-xs font-semibold text-[var(--text-primary)] bg-red-500/10 dark:bg-red-900/10">
                  {formatCurrency(recurso.totalOCBienes + recurso.totalOCServicios)}
                  <br />
                  <span className="text-[10px] font-normal">Bruto: {formatCurrency(recurso.totalOCBienesBruto + recurso.totalOCServiciosBruto)}</span>
                </td>
                {/* REAL TOTALES: metrado, precio promedio, parcial */}
                <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-green-500/10 dark:bg-green-900/10">
                  {totalesReal.metrado.toFixed(2)}
                </td>
                <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-green-500/10 dark:bg-green-900/10">
                  {(totalesReal.metrado > 0 ? recurso.totalRecepcion / totalesReal.metrado : 0).toFixed(2)}
                </td>
                <td className="px-2 py-2 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-green-500/10 dark:bg-green-900/10">
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
                  <tr className="bg-gray-50 dark:bg-gray-800/30">
                    <td colSpan={12} className="px-2 py-1 border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)]">
                      Requerimiento {grupo.requerimiento?.codigo || 'N/A'} - {grupo.requerimiento?.descripcion?.substring(0, 60) || 'Sin requerimiento'}...
                    </td>
                  </tr>

                  {/* RQ - Solo mostrar si hay requerimiento */}
                  {grupo.requerimiento && (
                    <tr className="bg-orange-500/10 dark:bg-orange-900/10">
                      <td colSpan={3} className="px-2 py-1 border border-[var(--border-color)]"></td>
                      {/* RQ Neto: cantidad pendiente */}
                      <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-orange-500/10 dark:bg-orange-900/10">
                        {(grupo.total_rq_neto / (grupo.requerimiento.precio || 1)).toFixed(2)}
                      </td>
                      <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-orange-500/10 dark:bg-orange-900/10">
                        {grupo.requerimiento.precio.toFixed(2)}
                      </td>
                      <td className="px-2 py-1 border border-[var(--border-color)] text-right text-xs text-[var(--text-primary)] bg-orange-500/10 dark:bg-orange-900/10">
                        <span className="text-xs">Neto: {formatCurrency(grupo.total_rq_neto)}</span>
                        <br />
                        <span className="text-[10px] font-normal">Bruto: {formatCurrency(grupo.total_rq_bruto)}</span>
                      </td>
                      <td colSpan={6} className="px-2 py-1 border border-[var(--border-color)]"></td>
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
                      <tr key={oc.codigo} className="bg-red-500/10 dark:bg-red-900/10">
                        <td colSpan={3} className="px-2 py-1 border border-[var(--border-color)]"></td>
                        <td colSpan={3} className="px-2 py-1 border border-[var(--border-color)]"></td>
                        {/* OC Neto: cantidad pendiente de recepción */}
                        <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-red-500/10 dark:bg-red-900/10">
                          {pendiente.toFixed(2)}
                        </td>
                        <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-red-500/10 dark:bg-red-900/10">
                          {oc.precio.toFixed(2)}
                        </td>
                        <td className="px-2 py-1 border border-[var(--border-color)] text-right text-xs text-[var(--text-primary)] bg-red-500/10 dark:bg-red-900/10">
                          <span className="text-xs">Neto: {formatCurrency(parcialNeto)}</span>
                          <br />
                          <span className="text-[10px] font-normal">Bruto: {formatCurrency(oc.parcial)}</span>
                        </td>
                        <td colSpan={3} className="px-2 py-1 border border-[var(--border-color)]"></td>
                      </tr>
                    );
                  })}

                  {/* Recepciones para este requerimiento */}
                  {grupo.recepciones.map((rec, recIndex) => (
                    <tr key={`rec_${recIndex}`} className="bg-green-500/10 dark:bg-green-900/10">
                      <td colSpan={3} className="px-2 py-1 border border-[var(--border-color)]"></td>
                      <td colSpan={6} className="px-2 py-1 border border-[var(--border-color)]"></td>
                      <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-green-500/10 dark:bg-green-900/10">
                        {rec.cantidad.toFixed(2)}
                      </td>
                      <td className="px-2 py-1 border border-[var(--border-color)] text-right text-[var(--text-primary)] bg-green-500/10 dark:bg-green-900/10">
                        {rec.precio.toFixed(2)}
                      </td>
                      <td className="px-2 py-1 border border-[var(--border-color)] text-right font-semibold text-[var(--text-primary)] bg-green-500/10 dark:bg-green-900/10">
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

