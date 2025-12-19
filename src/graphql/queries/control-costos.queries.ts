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

