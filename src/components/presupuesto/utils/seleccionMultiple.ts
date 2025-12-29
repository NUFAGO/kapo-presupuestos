/**
 * Tipos locales que coinciden con las interfaces del componente principal
 */
export interface Titulo {
  id_titulo: string;
  id_presupuesto: string;
  id_titulo_padre: string | null;
  nivel: number;
  numero_item: string;
  descripcion: string;
  tipo: 'TITULO' | 'SUBTITULO';
  orden: number;
  total_parcial: number;
  id_especialidad?: string | null;
}

export interface Partida {
  id_partida: string;
  id_presupuesto: string;
  id_proyecto: string;
  id_titulo: string;
  id_partida_padre: string | null;
  nivel_partida: number;
  numero_item: string;
  descripcion: string;
  unidad_medida: string;
  metrado: number;
  precio_unitario: number;
  parcial_partida: number;
  orden: number;
  estado: 'Activa' | 'Inactiva';
}

/**
 * Obtiene el tipo de item (TITULO o PARTIDA) por su ID
 */
export function obtenerTipoItem(
  id: string,
  titulos: Titulo[],
  partidas: Partida[]
): 'TITULO' | 'PARTIDA' | null {
  if (titulos.some(t => t.id_titulo === id)) return 'TITULO';
  if (partidas.some(p => p.id_partida === id)) return 'PARTIDA';
  return null;
}

/**
 * Obtiene el "id padre referencia" de cualquier item
 * - Para títulos: devuelve id_titulo_padre
 * - Para partidas principales: devuelve id_titulo (el título al que pertenece)
 * - Para subpartidas: devuelve id_partida_padre
 */
export function obtenerIdPadreReferencia(
  id: string,
  titulos: Titulo[],
  partidas: Partida[]
): string | null {
  const tipo = obtenerTipoItem(id, titulos, partidas);

  if (tipo === 'TITULO') {
    const titulo = titulos.find(t => t.id_titulo === id);
    return titulo?.id_titulo_padre ?? null;
  } else {
    // Es PARTIDA
    const partida = partidas.find(p => p.id_partida === id);
    if (!partida) return null;

    // Si es subpartida (tiene padre partida)
    if (partida.id_partida_padre !== null) {
      return partida.id_partida_padre;
    }

    // Si es partida principal, su "padre referencia" es el id_titulo al que pertenece
    return partida.id_titulo;
  }
}

/**
 * Obtiene todos los IDs de un bloque (título + todos sus descendientes)
 */
export function obtenerIdsBloqueTitulo(
  id_titulo: string,
  titulos: Titulo[],
  partidas: Partida[]
): string[] {
  const ids: string[] = [id_titulo];

  // Agregar títulos hijos recursivamente
  const hijosTitulos = titulos.filter(t => t.id_titulo_padre === id_titulo);
  hijosTitulos.forEach(hijo => {
    ids.push(...obtenerIdsBloqueTitulo(hijo.id_titulo, titulos, partidas));
  });

  // Agregar partidas directas del título
  const partidasDirectas = partidas.filter(
    p => p.id_titulo === id_titulo && p.id_partida_padre === null
  );
  partidasDirectas.forEach(partida => {
    ids.push(...obtenerIdsBloquePartida(partida.id_partida, partidas));
  });

  return ids;
}

/**
 * Obtiene todos los IDs de un bloque de partida (partida + todas sus subpartidas)
 */
export function obtenerIdsBloquePartida(id_partida: string, partidas: Partida[]): string[] {
  const ids: string[] = [id_partida];

  // Agregar subpartidas recursivamente
  const subpartidas = partidas.filter(p => p.id_partida_padre === id_partida);
  subpartidas.forEach(subpartida => {
    ids.push(...obtenerIdsBloquePartida(subpartida.id_partida, partidas));
  });

  return ids;
}

/**
 * Verifica si dos items tienen relación padre-hijo (uno es ancestro del otro)
 */
export function tieneRelacionPadreHijo(
  id1: string,
  id2: string,
  titulos: Titulo[],
  partidas: Partida[]
): boolean {
  // Si son el mismo, no hay relación
  if (id1 === id2) return false;

  const tipo1 = obtenerTipoItem(id1, titulos, partidas);
  const tipo2 = obtenerTipoItem(id2, titulos, partidas);

  // Si id1 es título, verificar si id2 está en su bloque
  if (tipo1 === 'TITULO') {
    const idsBloque = obtenerIdsBloqueTitulo(id1, titulos, partidas);
    if (idsBloque.includes(id2)) return true;
  }

  // Si id2 es título, verificar si id1 está en su bloque
  if (tipo2 === 'TITULO') {
    const idsBloque = obtenerIdsBloqueTitulo(id2, titulos, partidas);
    if (idsBloque.includes(id1)) return true;
  }

  // Si id1 es partida, verificar si id2 está en su bloque
  if (tipo1 === 'PARTIDA') {
    const idsBloque = obtenerIdsBloquePartida(id1, partidas);
    if (idsBloque.includes(id2)) return true;
  }

  // Si id2 es partida, verificar si id1 está en su bloque
  if (tipo2 === 'PARTIDA') {
    const idsBloque = obtenerIdsBloquePartida(id2, partidas);
    if (idsBloque.includes(id1)) return true;
  }

  return false;
}

/**
 * Verifica si todos los items seleccionados son hermanos (tienen el mismo id padre referencia)
 */
export function sonTodosHermanos(
  ids: string[],
  titulos: Titulo[],
  partidas: Partida[]
): boolean {
  if (ids.length <= 1) return true; // 0 o 1 item siempre son "hermanos"

  const primerPadre = obtenerIdPadreReferencia(ids[0], titulos, partidas);
  return ids.every(id => obtenerIdPadreReferencia(id, titulos, partidas) === primerPadre);
}

/**
 * Verifica si algún item seleccionado tiene relación padre-hijo con el nuevo item a seleccionar
 */
export function tieneRelacionConSeleccionados(
  nuevoId: string,
  idsSeleccionados: string[],
  titulos: Titulo[],
  partidas: Partida[]
): boolean {
  return idsSeleccionados.some(idSeleccionado =>
    tieneRelacionPadreHijo(nuevoId, idSeleccionado, titulos, partidas)
  );
}
