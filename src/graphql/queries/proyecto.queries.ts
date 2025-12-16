/**
 * Queries GraphQL para Proyectos
 */

export const LIST_PROYECTOS_PAGINATED_QUERY = `
  query ListProyectosPaginated($input: PaginationFilterInput) {
    listProyectosPaginated(input: $input) {
      data {
        _id
        id_proyecto
        id_usuario
        id_infraestructura
        nombre_proyecto
        id_departamento
        id_provincia
        id_distrito
        id_localidad
        total_proyecto
        estado
        fecha_creacion
        fecha_ultimo_calculo
        cliente
        empresa
        plazo
        ppto_base
        ppto_oferta
        jornada
      }
      pagination {
        page
        limit
        total
        totalPages
        hasNext
        hasPrev
      }
    }
  }
`;

export const GET_PROYECTO_QUERY = `
  query GetProyecto($id_proyecto: String!) {
    getProyecto(id_proyecto: $id_proyecto) {
      _id
      id_proyecto
      id_usuario
      id_infraestructura
      nombre_proyecto
      id_departamento
      id_provincia
      id_distrito
      id_localidad
      total_proyecto
      estado
      fecha_creacion
      fecha_ultimo_calculo
      cliente
      empresa
      plazo
      ppto_base
      ppto_oferta
      jornada
    }
  }
`;

export const LIST_PROYECTOS_CON_META_VIGENTE_QUERY = `
  query ListProyectosConMetaVigente($input: PaginationInput) {
    listProyectosConMetaVigente(input: $input) {
      data {
        _id
        id_proyecto
        id_usuario
        id_infraestructura
        nombre_proyecto
        id_departamento
        id_provincia
        id_distrito
        id_localidad
        total_proyecto
        estado
        fecha_creacion
        fecha_ultimo_calculo
        cliente
        empresa
        plazo
        ppto_base
        ppto_oferta
        jornada
        presupuestos {
          _id
          id_presupuesto
          nombre_presupuesto
          fase
          version
          es_padre
          id_grupo_version
          total_presupuesto
          fecha_creacion
          id_presupuesto_meta_vigente
          version_meta_vigente
          estado
        }
      }
      pagination {
        page
        limit
        total
        totalPages
        hasNext
        hasPrev
      }
    }
  }
`;

