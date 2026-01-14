/**
 * Queries GraphQL para Resumen de Presupuestos (Dashboard)
 */

export const GET_RESUMEN_PRESUPUESTO_QUERY = `
  query ObtenerResumenPresupuesto($filtros: FiltrosResumenInput!) {
    obtenerResumenPresupuesto(filtros: $filtros) {
      id_resumen
      id_presupuesto
      id_proyecto
      fecha_calculo
      es_historico
      total_presupuesto
      fecha_presupuesto_meta
      cantidad_presupuestos
      cantidad_proyectos
      promedio_por_presupuesto
      presupuesto_mas_alto
      presupuesto_mas_bajo
      total_composicion
      total_unidades
      costo_por_unidad_meta
      costo_por_unidad_actual
      eficiencia
      varianza
      progreso_proyecto
      total_requerimiento
      total_requerimiento_bruto
      total_ordenes_compra_bienes
      total_ordenes_compra_bienes_bruto
      total_ordenes_compra_servicios
      total_ordenes_compra_servicios_bruto
      total_recepcion_almacen
      total_recepcion_almacen_bruto
      diferencia_mayor_gasto
      diferencia_real_comprometido
    }
  }
`;

export const GET_HISTORICO_MENSUAL_QUERY = `
  query ObtenerHistoricoMensual($filtros: FiltrosResumenInput!, $meses: Int) {
    obtenerHistoricoMensual(filtros: $filtros, meses: $meses) {
      id_resumen
      id_presupuesto
      id_proyecto
      es_historico
      periodo_mes
      periodo_anio
      fecha_calculo
      total_presupuesto
      total_composicion
      total_requerimiento
      total_recepcion_almacen
    }
  }
`;

export const GET_RESUMENES_INDIVIDUALES_QUERY = `
  query ObtenerResumenesIndividuales($filtros: FiltrosResumenInput!) {
    obtenerResumenesIndividuales(filtros: $filtros) {
      id_resumen
      id_presupuesto
      id_proyecto
      fecha_calculo
      es_historico
      total_presupuesto
      fecha_presupuesto_meta
      cantidad_presupuestos
      cantidad_proyectos
      promedio_por_presupuesto
      presupuesto_mas_alto
      presupuesto_mas_bajo
      total_composicion
      total_unidades
      costo_por_unidad_meta
      costo_por_unidad_actual
      eficiencia
      varianza
      progreso_proyecto
      total_requerimiento
      total_requerimiento_bruto
      total_ordenes_compra_bienes
      total_ordenes_compra_bienes_bruto
      total_ordenes_compra_servicios
      total_ordenes_compra_servicios_bruto
      total_recepcion_almacen
      total_recepcion_almacen_bruto
      diferencia_mayor_gasto
      diferencia_real_comprometido
    }
  }
`;

export const SINCRONIZAR_RESUMEN_MUTATION = `
  mutation SincronizarResumen($filtros: FiltrosResumenInput!, $forzar: Boolean) {
    sincronizarResumen(filtros: $filtros, forzar: $forzar) {
      ...ResumenPresupuestoFragment
    }

    # Nueva mutación para sincronizar TODOS los resúmenes
    mutation SincronizarTodosLosResumenes {
      sincronizarTodosLosResumenes
    }

    sincronizarResumen(filtros: $filtros, forzar: $forzar) {
      id_resumen
      fecha_calculo
      total_presupuesto
    }
  }
`;


