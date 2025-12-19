/**
 * Queries GraphQL para Control de Costos
 */

export const GET_TRAZABILIDAD_PARTIDA_QUERY = `
  query GetTrazabilidadPartida($id_partida: String!, $id_presupuesto: String!) {
    getTrazabilidadPartida(id_partida: $id_partida, id_presupuesto: $id_presupuesto) {
      id_partida
      recursos {
        recurso_id
        codigo_recurso
        nombre_recurso
        descripcion_recurso
        unidad_medida
        total_composicion
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
  }
`;

export const GET_TRAZABILIDAD_DETALLE_PARTIDA_QUERY = `
  query GetTrazabilidadDetallePartida($id_partida: String!) {
    getTrazabilidadDetallePartida(id_partida: $id_partida) {
      id_partida
      trazabilidades {
        recurso_id
        requerimientos_recurso {
          id
          requerimiento_id
          recurso_id
          cantidad
          cantidad_aprobada
          precio
          requerimiento_data {
            id
            codigo
            estado_atencion
            fecha_solicitud
            sustento
          }
          codigo_recurso
          nombre_recurso
          descripcion_recurso
          unidad_medida_id
        }
        ordenes_compra_recurso {
          id
          orden_compra_id
          cantidad
          costo_real
          costo_aproximado
          orden_compra_data {
            id
            codigo_orden
            estado
            tipo
            descripcion
            fecha_ini
          }
        }
        transferencias_recurso {
          id
          transferencia_detalle_id
          recurso_id
          cantidad
          costo
          transferencia_detalle_data {
            id
            tipo
            estado
            fecha
            referencia_codigo
          }
        }
      }
      resumen {
        total_requerimientos
        total_ordenes_compra
        total_transferencias
      }
    }
  }
`;

