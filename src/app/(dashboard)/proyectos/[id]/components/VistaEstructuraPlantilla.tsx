'use client';

import { useMemo, useState, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEstructuraPresupuesto } from '@/hooks/usePresupuestos';
import { LoadingSpinner } from '@/components/ui';

interface VistaEstructuraPlantillaProps {
  id_presupuesto: string | null;
}

interface Titulo {
  id_titulo: string;
  id_titulo_padre: string | null;
  nivel: number;
  numero_item: string;
  descripcion: string;
  tipo: 'TITULO' | 'SUBTITULO';
  orden: number;
  total_parcial: number;
}

interface Partida {
  id_partida: string;
  id_titulo: string;
  id_partida_padre: string | null;
  nivel_partida: number;
  numero_item: string;
  descripcion: string;
  unidad_medida: string;
  metrado: number;
  orden: number;
}

type ItemUnificado =
  | { tipo: 'TITULO'; data: Titulo }
  | { tipo: 'PARTIDA'; data: Partida };

export default function VistaEstructuraPlantilla({ id_presupuesto }: VistaEstructuraPlantillaProps) {
  const { data: estructuraData, isLoading, error } = useEstructuraPresupuesto(id_presupuesto);
  const [titulosColapsados, setTitulosColapsados] = useState<Set<string>>(new Set());
  const [partidasColapsadas, setPartidasColapsadas] = useState<Set<string>>(new Set());

  const titulos = estructuraData?.titulos || [];
  const partidas = estructuraData?.partidas || [];

  // Índices para acceso rápido
  const titulosPorPadre = useMemo(() => {
    const map = new Map<string | null, Titulo[]>();
    titulos.forEach(titulo => {
      const padre = titulo.id_titulo_padre;
      if (!map.has(padre)) {
        map.set(padre, []);
      }
      map.get(padre)!.push(titulo);
    });
    map.forEach((grupo) => grupo.sort((a, b) => a.orden - b.orden));
    return map;
  }, [titulos]);

  const partidasPorTituloYPadre = useMemo(() => {
    const map = new Map<string, Map<string | null, Partida[]>>();
    partidas.forEach(partida => {
      if (!map.has(partida.id_titulo)) {
        map.set(partida.id_titulo, new Map());
      }
      const partidasMap = map.get(partida.id_titulo)!;
      const padre = partida.id_partida_padre;
      if (!partidasMap.has(padre)) {
        partidasMap.set(padre, []);
      }
      partidasMap.get(padre)!.push(partida);
    });
    map.forEach((partidasMap) => {
      partidasMap.forEach((grupo) => grupo.sort((a, b) => a.orden - b.orden));
    });
    return map;
  }, [partidas]);

  // Verificar si un título tiene ancestro colapsado
  const tieneAncestroColapsado = useCallback((id_titulo: string | null): boolean => {
    if (!id_titulo) return false;
    const titulo = titulos.find(t => t.id_titulo === id_titulo);
    if (!titulo) return false;
    if (titulosColapsados.has(id_titulo)) return true;
    if (titulo.id_titulo_padre) {
      return tieneAncestroColapsado(titulo.id_titulo_padre);
    }
    return false;
  }, [titulos, titulosColapsados]);

  // Verificar si un item debe estar oculto por colapso
  const estaOcultoPorColapso = useCallback((item: Titulo | Partida): boolean => {
    if ('id_titulo_padre' in item && !item.id_titulo_padre) {
      return false; // Título raíz nunca oculto
    }
    if ('id_titulo_padre' in item && item.id_titulo_padre) {
      return tieneAncestroColapsado(item.id_titulo_padre);
    }
    if ('id_partida_padre' in item && item.id_partida_padre) {
      if (partidasColapsadas.has(item.id_partida_padre)) return true;
    }
    if ('id_titulo' in item && item.id_titulo) {
      const tituloPadre = titulos.find(t => t.id_titulo === item.id_titulo);
      if (tituloPadre) {
        if (!tituloPadre.id_titulo_padre && titulosColapsados.has(tituloPadre.id_titulo)) {
          return true;
        }
        return tieneAncestroColapsado(tituloPadre.id_titulo);
      }
    }
    return false;
  }, [titulosColapsados, partidasColapsadas, titulos, tieneAncestroColapsado]);

  // Función recursiva para agregar subpartidas
  const agregarSubpartidas = useCallback((id_partida: string, id_titulo: string, resultado: ItemUnificado[]) => {
    const partidasMap = partidasPorTituloYPadre.get(id_titulo);
    if (!partidasMap) return;

    const subpartidas = partidasMap.get(id_partida) || [];
    subpartidas.forEach(subpartida => {
      if (!estaOcultoPorColapso(subpartida) && !partidasColapsadas.has(id_partida)) {
        resultado.push({ tipo: 'PARTIDA', data: subpartida });
        // Procesar subpartidas anidadas recursivamente
        agregarSubpartidas(subpartida.id_partida, id_titulo, resultado);
      }
    });
  }, [partidasPorTituloYPadre, estaOcultoPorColapso, partidasColapsadas]);

  // Construir estructura unificada
  const estructuraUnificada = useMemo(() => {
    const resultado: ItemUnificado[] = [];
    const itemsProcesados = new Set<string>();

    const construirEstructura = (id_padre: string | null) => {
      if (id_padre && titulosColapsados.has(id_padre)) {
        return;
      }

      const items: ItemUnificado[] = [];

      // Agregar títulos hijos del padre
      const titulosHijos = titulosPorPadre.get(id_padre) || [];
      titulosHijos.forEach(titulo => {
        items.push({ tipo: 'TITULO', data: titulo });
      });

      // Agregar partidas del mismo nivel
      if (id_padre !== null) {
        const partidasMap = partidasPorTituloYPadre.get(id_padre);
        if (partidasMap) {
          const partidasPrincipales = partidasMap.get(null) || [];
          partidasPrincipales.forEach(partida => {
            items.push({ tipo: 'PARTIDA', data: partida });
          });
        }
      }

      // Ordenar por orden
      items.sort((a, b) => a.data.orden - b.data.orden);

      // Agregar items ordenados al resultado y procesar recursivamente
      items.forEach(item => {
        const clave = item.tipo === 'TITULO' ? `TIT-${item.data.id_titulo}` : `PAR-${item.data.id_partida}`;
        
        if (!itemsProcesados.has(clave) && !estaOcultoPorColapso(item.data)) {
          itemsProcesados.add(clave);
          resultado.push(item);
          
          // Procesar recursivamente
          if (item.tipo === 'TITULO') {
            construirEstructura(item.data.id_titulo);
          } else {
            // Para partidas principales, procesar subpartidas si no está colapsada
            if (!partidasColapsadas.has(item.data.id_partida)) {
              agregarSubpartidas(item.data.id_partida, item.data.id_titulo, resultado);
            }
          }
        }
      });
    };

    construirEstructura(null);
    return resultado;
  }, [titulosPorPadre, partidasPorTituloYPadre, titulosColapsados, partidasColapsadas, estaOcultoPorColapso, agregarSubpartidas]);

  // Verificar si un título tiene hijos o partidas
  const tieneHijosTitulo = useCallback((id_titulo: string): boolean => {
    const tieneTitulosHijos = titulos.some(t => t.id_titulo_padre === id_titulo);
    const tienePartidas = partidas.some(p => p.id_titulo === id_titulo && p.id_partida_padre === null);
    return tieneTitulosHijos || tienePartidas;
  }, [titulos, partidas]);

  // Verificar si una partida tiene subpartidas
  const tieneSubpartidas = useCallback((id_partida: string): boolean => {
    return partidas.some(p => p.id_partida_padre === id_partida);
  }, [partidas]);

  // Calcular nivel dinámico para indentación
  const calcularNivelDinamico = useCallback((item: Titulo | Partida): number => {
    if ('id_titulo_padre' in item) {
      const titulo = item as Titulo;
      if (!titulo.id_titulo_padre) return 1;
      const padre = titulos.find(t => t.id_titulo === titulo.id_titulo_padre);
      if (!padre) return 1;
      return calcularNivelDinamico(padre) + 1;
    } else {
      const partida = item as Partida;
      if (!partida.id_partida_padre) {
        const tituloPadre = titulos.find(t => t.id_titulo === partida.id_titulo);
        if (!tituloPadre) return 1;
        return calcularNivelDinamico(tituloPadre) + 1;
      } else {
        const partidaPadre = partidas.find(p => p.id_partida === partida.id_partida_padre);
        if (!partidaPadre) return 1;
        return calcularNivelDinamico(partidaPadre) + 1;
      }
    }
  }, [titulos, partidas]);

  const toggleColapsarTitulo = (id_titulo: string) => {
    setTitulosColapsados(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(id_titulo)) {
        nuevo.delete(id_titulo);
      } else {
        nuevo.add(id_titulo);
      }
      return nuevo;
    });
  };

  const toggleColapsarPartida = (id_partida: string) => {
    setPartidasColapsadas(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(id_partida)) {
        nuevo.delete(id_partida);
      } else {
        nuevo.add(id_partida);
      }
      return nuevo;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <LoadingSpinner size={20} />
        <span className="ml-2 text-xs text-[var(--text-secondary)]">Cargando estructura...</span>
      </div>
    );
  }

  if (error || !estructuraData) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-red-500">Error al cargar la estructura del presupuesto</p>
      </div>
    );
  }

  if (estructuraUnificada.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-[var(--text-secondary)]">Este presupuesto no tiene estructura aún</p>
      </div>
    );
  }

  return (
    <div className="mt-3 p-3 bg-[var(--background)]/30 rounded-lg border border-[var(--border-color)]/30 max-h-96 overflow-y-auto">
      <div className="text-xs font-semibold text-[var(--text-primary)] mb-2">
        Estructura del Presupuesto
      </div>
      <div className="space-y-0.5">
        {estructuraUnificada.map((item) => {
          if (item.tipo === 'TITULO') {
            const titulo = item.data;
            const estaColapsado = titulosColapsados.has(titulo.id_titulo);
            const puedeColapsar = tieneHijosTitulo(titulo.id_titulo);
            const nivel = calcularNivelDinamico(titulo);

            return (
              <div
                key={titulo.id_titulo}
                className="flex items-start gap-1.5 py-1 px-2 rounded hover:bg-[var(--background)]/50 transition-colors"
                style={{ paddingLeft: `${(nivel - 1) * 16 + 8}px` }}
              >
                {puedeColapsar ? (
                  <button
                    onClick={() => toggleColapsarTitulo(titulo.id_titulo)}
                    className="flex-shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)] mt-0.5"
                  >
                    {estaColapsado ? (
                      <ChevronRight className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                ) : (
                  <div className="w-3" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--text-secondary)]">
                      {titulo.numero_item}
                    </span>
                    <span className="text-xs font-medium text-[var(--text-primary)]">
                      {titulo.descripcion}
                    </span>
                  </div>
                </div>
              </div>
            );
          } else {
            const partida = item.data;
            const estaColapsada = partidasColapsadas.has(partida.id_partida);
            const puedeColapsar = tieneSubpartidas(partida.id_partida);
            const nivel = calcularNivelDinamico(partida);
            const esSubpartida = partida.id_partida_padre !== null;

            return (
              <div
                key={partida.id_partida}
                className={`flex items-start gap-1.5 py-1 px-2 rounded hover:bg-[var(--background)]/50 transition-colors ${
                  esSubpartida ? 'text-[var(--text-secondary)]' : ''
                }`}
                style={{ paddingLeft: `${(nivel - 1) * 16 + 8}px` }}
              >
                {puedeColapsar ? (
                  <button
                    onClick={() => toggleColapsarPartida(partida.id_partida)}
                    className="flex-shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)] mt-0.5"
                  >
                    {estaColapsada ? (
                      <ChevronRight className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                ) : (
                  <div className="w-3" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-[var(--text-secondary)]">
                      {partida.numero_item}
                    </span>
                    <span className={`text-xs ${esSubpartida ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                      {partida.descripcion}
                    </span>
                    {partida.metrado > 0 && (
                      <span className="text-xs text-[var(--text-secondary)]">
                        {partida.metrado.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {partida.unidad_medida}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}

