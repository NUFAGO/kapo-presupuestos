'use client';

import { useMemo, useState, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEstructuraPresupuesto } from '@/hooks/usePresupuestos';
import { LoadingSpinner } from '@/components/ui';
import { Button } from '@/components/ui/button';

interface VistaEstructuraPlantillaProps {
  id_presupuesto: string | null;
  onTitulosMarcadosChange?: (titulosMarcados: Set<string>) => void;
  onPartidasMarcadasChange?: (partidasMarcadas: Set<string>) => void;
  onConfirmarIntegracion?: (titulosMarcados: Set<string>, estructuraPlantilla: { titulos: any[], partidas: any[] }) => void;
  integrandoAutomaticamente?: boolean;
  seleccionarPartidas?: boolean; // Nueva prop para indicar si seleccionar partidas en lugar de títulos
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

export interface VistaEstructuraPlantillaRef {
  getTitulosMarcados: () => Set<string>;
  getPartidasMarcadas: () => Set<string>;
  getEstructuraPlantilla: () => { titulos: Titulo[], partidas: Partida[] };
}

const VistaEstructuraPlantilla = forwardRef<VistaEstructuraPlantillaRef, VistaEstructuraPlantillaProps>(({
  id_presupuesto,
  onTitulosMarcadosChange,
  onPartidasMarcadasChange,
  onConfirmarIntegracion,
  integrandoAutomaticamente = false,
  seleccionarPartidas = false
}, ref) => {
  const { data: estructuraData, isLoading, error } = useEstructuraPresupuesto(id_presupuesto);
  const [titulosColapsados, setTitulosColapsados] = useState<Set<string>>(new Set());
  const [partidasColapsadas, setPartidasColapsadas] = useState<Set<string>>(new Set());
  const [titulosMarcados, setTitulosMarcados] = useState<Set<string>>(new Set());
  const [partidasMarcadas, setPartidasMarcadas] = useState<Set<string>>(new Set());

  // Notificar cambios en titulos marcados al componente padre
  useEffect(() => {
    if (onTitulosMarcadosChange) {
      onTitulosMarcadosChange(titulosMarcados);
    }
  }, [titulosMarcados, onTitulosMarcadosChange]);

  // Notificar cambios en partidas marcadas al componente padre
  useEffect(() => {
    if (onPartidasMarcadasChange) {
      onPartidasMarcadasChange(partidasMarcadas);
    }
  }, [partidasMarcadas, onPartidasMarcadasChange]);

  // Exponer funciones al componente padre
  useImperativeHandle(ref, () => ({
    getTitulosMarcados: () => titulosMarcados,
    getPartidasMarcadas: () => partidasMarcadas,
    getEstructuraPlantilla: () => ({
      titulos: estructuraData?.titulos || [],
      partidas: estructuraData?.partidas || []
    })
  }));

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

  // Obtener todos los IDs de títulos descendientes de un título
  const obtenerIdsTitulosDescendientes = useCallback((id_titulo: string): Set<string> => {
    const descendientes = new Set<string>();
    const procesar = (id: string) => {
      descendientes.add(id);
      // Agregar títulos hijos
      titulos.filter(t => t.id_titulo_padre === id).forEach(t => procesar(t.id_titulo));
    };
    procesar(id_titulo);
    return descendientes;
  }, [titulos]);

  // Verificar si un título es descendiente de algún título marcado
  const esDescendienteDeMarcado = useCallback((id_titulo: string): boolean => {
    // Verificar si algún título marcado es ancestro de este título
    for (const idMarcado of titulosMarcados) {
      const descendientes = obtenerIdsTitulosDescendientes(idMarcado);
      if (descendientes.has(id_titulo) && idMarcado !== id_titulo) {
        return true;
      }
    }
    return false;
  }, [titulosMarcados, obtenerIdsTitulosDescendientes]);

  // Filtrar estructura para mostrar solo títulos marcados y sus descendientes
  const estructuraFiltrada = useMemo(() => {
    if (titulosMarcados.size === 0) {
      return estructuraUnificada; // Mostrar todo si no hay selección
    }

    const idsTitulosPermitidos = new Set<string>();
    const idsPartidasPermitidas = new Set<string>();

    // Para cada título marcado, incluirlo y todos sus descendientes
    titulosMarcados.forEach(idTituloMarcado => {
      // Agregar el título marcado y todos sus descendientes
      const descendientes = obtenerIdsTitulosDescendientes(idTituloMarcado);
      descendientes.forEach(id => idsTitulosPermitidos.add(id));

      // Agregar todas las partidas que pertenecen a estos títulos
      titulos.filter(t => descendientes.has(t.id_titulo)).forEach(titulo => {
        // Partidas principales del título
        partidas.filter(p => p.id_titulo === titulo.id_titulo && p.id_partida_padre === null)
          .forEach(p => idsPartidasPermitidas.add(p.id_partida));

        // Subpartidas recursivamente
        const agregarSubpartidasRecursivas = (idPartida: string) => {
          idsPartidasPermitidas.add(idPartida);
          partidas.filter(p => p.id_partida_padre === idPartida)
            .forEach(sub => agregarSubpartidasRecursivas(sub.id_partida));
        };

        partidas.filter(p => p.id_titulo === titulo.id_titulo && p.id_partida_padre === null)
          .forEach(p => agregarSubpartidasRecursivas(p.id_partida));
      });
    });

    // Filtrar la estructuraUnificada
    return estructuraUnificada.filter(item => {
      if (item.tipo === 'TITULO') {
        return idsTitulosPermitidos.has(item.data.id_titulo);
      } else {
        return idsPartidasPermitidas.has(item.data.id_partida);
      }
    });
  }, [estructuraUnificada, titulosMarcados, obtenerIdsTitulosDescendientes, titulos, partidas]);

  // Calcular nivel dinámico para colores
  const calcularNivelDinamico = useCallback((id_titulo: string): number => {
    const titulo = titulos.find(t => t.id_titulo === id_titulo);
    if (!titulo) return 1;

    // Si no tiene padre, es nivel 1
    if (!titulo.id_titulo_padre) return 1;

    // Si tiene padre, calcular recursivamente
    return calcularNivelDinamico(titulo.id_titulo_padre) + 1;
  }, [titulos]);

  /**
   * Obtiene el color según el nivel del título (calculado dinámicamente)
   * Todos los títulos del mismo nivel tendrán el mismo color
   */
  const getColorPorNivel = useCallback((id_titulo: string, tipo: string) => {
    // Las partidas siempre tienen el mismo color
    if (tipo === 'PARTIDA') {
      return 'text-[var(--text-primary)]';
    }

    // Calcular el nivel dinámicamente basándose en la jerarquía actual
    const nivel = calcularNivelDinamico(id_titulo);

    // Los títulos se colorean según su nivel
    // Nivel 1: Azul
    // Nivel 2: Naranja
    // Nivel 3: Rojo
    // Nivel 4: Rosa
    // Nivel 5: Cyan
    switch (nivel) {
      case 1:
        return 'text-blue-600 dark:text-blue-400';
      case 2:
        return 'text-orange-500 dark:text-orange-400';
      case 3:
        return 'text-red-600 dark:text-red-400';
      case 4:
        return 'text-pink-500 dark:text-pink-400';
      case 5:
        return 'text-cyan-500 dark:text-cyan-400';
      default:
        return 'text-[var(--text-primary)]';
    }
  }, [calcularNivelDinamico]);

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

  if (estructuraFiltrada.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-[var(--text-secondary)]">Este presupuesto no tiene estructura aún</p>
      </div>
    );
  }

  return (
    <div
      className="mt-3 p-3 bg-[var(--background)]/30 rounded-lg border border-[var(--border-color)]/30 overflow-y-auto"
      style={{
        height: '320px',
        flexShrink: 0,
        contain: 'layout style paint', // Aisla completamente el layout
        isolation: 'isolate', // Crea un nuevo contexto de apilamiento
      }}
    >
      <div className="text-xs font-semibold text-[var(--text-primary)] mb-2">
        Estructura del Presupuesto
      </div>
      <div className="space-y-0.5">
        {estructuraFiltrada.map((item) => {
          if (item.tipo === 'TITULO') {
            const titulo = item.data;
            const estaColapsado = titulosColapsados.has(titulo.id_titulo);
            const puedeColapsar = tieneHijosTitulo(titulo.id_titulo);
            const colorNivel = getColorPorNivel(titulo.id_titulo, titulo.tipo);

            // Determinar si mostrar checkbox: siempre cuando hay presupuesto seleccionado,
            // pero solo para títulos que no son descendientes de títulos marcados
            // Y solo cuando NO estamos en modo seleccionarPartidas
            const mostrarCheckbox = !!id_presupuesto && !seleccionarPartidas && !esDescendienteDeMarcado(titulo.id_titulo);

            // Determinar si mostrar espacio del checkbox: cuando hay presupuesto Y
            // (para mantener alineación tanto en modo normal como en modo seleccionarPartidas)
            const mostrarEspacioCheckbox = !!id_presupuesto && (seleccionarPartidas || titulosMarcados.size === 0 || titulosMarcados.has(titulo.id_titulo) || esDescendienteDeMarcado(titulo.id_titulo));

            return (
              <div
                key={titulo.id_titulo}
                className="flex items-start gap-1.5 py-1 px-2 rounded hover:bg-[var(--background)]/50 transition-colors"
              >
                <div className="flex items-center gap-1">
                  {mostrarEspacioCheckbox && (
                    mostrarCheckbox ? (
                      <label className="flex items-center cursor-pointer flex-shrink-0 mt-0.5">
                        <input
                          type="checkbox"
                          checked={titulosMarcados.has(titulo.id_titulo)}
                          onChange={(e) => {
                            setTitulosMarcados(prev => {
                              const nuevo = new Set<string>();
                              if (e.target.checked) {
                                nuevo.add(titulo.id_titulo);
                              } else {
                              }
                              return nuevo;
                            });
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-3.5 h-3.5 rounded border transition-all flex items-center justify-center peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/20 peer-checked:bg-blue-500 peer-checked:border-blue-500 border-[var(--border-color)] bg-[var(--background)]">
                          {titulosMarcados.has(titulo.id_titulo) && (
                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </label>
                    ) : (
                      <div className="w-3.5 h-3.5" />
                    )
                  )}
                {puedeColapsar ? (
                  <button
                    type="button"
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
                  <div className="w-3.5" />
                )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--text-secondary)]">
                      {titulo.numero_item}
                    </span>
                    <span className={`text-xs font-medium ${colorNivel}`}>
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
            const esSubpartida = partida.id_partida_padre !== null;

            return (
              <div
                key={partida.id_partida}
                className={`flex items-start gap-1.5 py-1 px-2 rounded hover:bg-[var(--background)]/50 transition-colors ${
                  esSubpartida ? 'text-[var(--text-secondary)]' : ''
                }`}
              >
                <div className="flex items-center gap-1">
                  {seleccionarPartidas ? (
                    <label className="flex items-center cursor-pointer flex-shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={partidasMarcadas.has(partida.id_partida)}
                        onChange={(e) => {
                          setPartidasMarcadas(prev => {
                            const nuevo = new Set(prev);
                            if (e.target.checked) {
                              nuevo.add(partida.id_partida);
                            } else {
                              nuevo.delete(partida.id_partida);
                            }
                            return nuevo;
                          });
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-3.5 h-3.5 rounded border transition-all flex items-center justify-center peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/20 peer-checked:bg-blue-500 peer-checked:border-blue-500 border-[var(--border-color)] bg-[var(--background)]">
                        {partidasMarcadas.has(partida.id_partida) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </label>
                  ) : (
                    <div className="w-3.5" />
                  )}
                  {puedeColapsar ? (
                    <button
                      type="button"
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
                    <div className="w-3.5" />
                  )}
                </div>
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
});

VistaEstructuraPlantilla.displayName = 'VistaEstructuraPlantilla';

export default VistaEstructuraPlantilla;

