/**
 * Mutations GraphQL para PrecioRecursoPresupuesto
 */

export const CREATE_PRECIO_RECURSO_MUTATION = `
  mutation CreatePrecioRecursoPresupuesto(
    $id_presupuesto: String!
    $recurso_id: String!
    $codigo_recurso: String!
    $descripcion: String!
    $unidad: String!
    $tipo_recurso: TipoRecursoPresupuesto!
    $precio: Float!
    $usuario_actualizo: String!
  ) {
    createPrecioRecursoPresupuesto(
      id_presupuesto: $id_presupuesto
      recurso_id: $recurso_id
      codigo_recurso: $codigo_recurso
      descripcion: $descripcion
      unidad: $unidad
      tipo_recurso: $tipo_recurso
      precio: $precio
      usuario_actualizo: $usuario_actualizo
    ) {
      id_precio_recurso
      id_presupuesto
      recurso_id
      codigo_recurso
      descripcion
      unidad
      tipo_recurso
      precio
      fecha_actualizacion
      usuario_actualizo
    }
  }
`;



