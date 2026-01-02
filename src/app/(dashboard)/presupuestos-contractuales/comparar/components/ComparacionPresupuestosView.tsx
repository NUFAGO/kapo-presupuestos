'use client';

import { useState, useMemo, useCallback, useRef, useEffect, Fragment } from 'react';
import { ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui';
import type { Presupuesto, EstructuraPresupuesto, PartidaEstructura, TituloEstructura } from '@/hooks/usePresupuestos';

interface ComparacionPresupuestosViewProps {
  presupuestoContractual: Presupuesto;
  presupuestoMeta: Presupuesto;
  estructuraContractual?: EstructuraPresupuesto;
  estructuraMeta?: EstructuraPresupuesto;
  isLoadingEstructuraContractual?: boolean;
  isLoadingEstructuraMeta?: boolean;
}

// Tipo unificado para títulos y partidas
type ItemUnificado = 
  | { tipo: 'titulo'; titulo: TituloEstructura }
  | { tipo: 'partida'; partida: PartidaEstructura };

export default function ComparacionPresupuestosView({
  presupuestoContractual,
  presupuestoMeta,
  estructuraContractual,
  estructuraMeta,
  isLoadingEstructuraContractual = false,
  isLoadingEstructuraMeta = false,
}: ComparacionPresupuestosViewProps) {
  const router = useRouter();
  const [partidasColapsadas, setPartidasColapsadas] = useState<Set<string>>(new Set());
  const scrollContractualRef = useRef<HTMLDivElement>(null);
  const scrollMetaRef = useRef<HTMLDivElement>(null);
  const [scrollSincronizado, setScrollSincronizado] = useState(true);

  const titulosContractual = estructuraContractual?.titulos || [];
  const partidasContractual = estructuraContractual?.partidas || [];
  const titulosMeta = estructuraMeta?.titulos || [];
  const partidasMeta = estructuraMeta?.partidas || [];

  // Obtener hijos de un título
  const getHijosTitulo = useCallback((id_titulo: string, titulos: TituloEstructura[]): TituloEstructura[] => {
    return titulos.filter(t => t.id_titulo_padre === id_titulo).sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }, []);

  // Obtener partidas de un título
  const getPartidasDeTitulo = useCallback((id_titulo: string, partidas: PartidaEstructura[]): PartidaEstructura[] => {
    return partidas.filter(p => p.id_titulo === id_titulo && !p.id_partida_padre).sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }, []);

  // Obtener subpartidas de una partida
  const getSubpartidas = useCallback((id_partida: string, partidas: PartidaEstructura[]): PartidaEstructura[] => {
    return partidas.filter(p => p.id_partida_padre === id_partida).sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }, []);

  // Calcular número de item
  const calcularNumeroItem = useCallback((partida: PartidaEstructura): string => {
    return partida.numero_item || '';
  }, []);

  // Calcular nivel dinámico de un título
  const calcularNivelDinamico = useCallback((id_titulo: string, titulos: TituloEstructura[]): number => {
    const titulo = titulos.find(t => t.id_titulo === id_titulo);
    if (!titulo) return 1;

    // Si no tiene padre, es nivel 1
    if (!titulo.id_titulo_padre) return 1;

    // Si tiene padre, calcular recursivamente
    return calcularNivelDinamico(titulo.id_titulo_padre, titulos) + 1;
  }, []);

  // Obtener color por nivel (igual que EstructuraCostosResumen)
  const getColorPorNivel = useCallback((id_titulo: string, tipo: string, titulos: TituloEstructura[]) => {
    // Las partidas siempre tienen el mismo color
    if (tipo === 'PARTIDA') {
      return 'text-[var(--text-primary)]';
    }

    // Calcular el nivel dinámicamente basándose en la jerarquía actual
    const nivel = calcularNivelDinamico(id_titulo, titulos);

    // Los títulos se colorean según su nivel
    switch (nivel) {
      case 1:
        return 'text-blue-600 dark:text-blue-400';
      case 2:
        return 'text-orange-500 dark:text-orange-400';
      case 3:
        return 'text-red-500 dark:text-red-400';
      case 4:
        return 'text-pink-500 dark:text-pink-400';
      case 5:
        return 'text-cyan-500 dark:text-cyan-400';
      default:
        return 'text-[var(--text-primary)]';
    }
  }, [calcularNivelDinamico]);

  // Crear lista ordenada con títulos y partidas (con jerarquía)
  const crearItemsOrdenados = useCallback((titulos: TituloEstructura[], partidas: PartidaEstructura[]): ItemUnificado[] => {
    const items: ItemUnificado[] = [];

    // Función recursiva para agregar títulos y partidas
    const agregarItemsDeTitulo = (id_titulo: string) => {
      // Buscar el título actual
      const tituloActual = titulos.find(t => t.id_titulo === id_titulo);
      if (tituloActual) {
        // Agregar el título
        items.push({ tipo: 'titulo', titulo: tituloActual });
      }

      // Agregar partidas principales del título (sin subpartidas)
      const partidasDelTitulo = getPartidasDeTitulo(id_titulo, partidas);
      partidasDelTitulo.forEach(partida => {
        items.push({ tipo: 'partida', partida });
      });

      // Agregar títulos hijos recursivamente
      const titulosHijos = getHijosTitulo(id_titulo, titulos);
      titulosHijos.forEach(tituloHijo => {
        agregarItemsDeTitulo(tituloHijo.id_titulo);
      });
    };

    // Obtener títulos raíz y procesar
    const titulosRaiz = titulos.filter(t => !t.id_titulo_padre).sort((a, b) => (a.orden || 0) - (b.orden || 0));
    titulosRaiz.forEach(titulo => {
      agregarItemsDeTitulo(titulo.id_titulo);
    });

    return items;
  }, [getPartidasDeTitulo, getHijosTitulo]);

  const itemsOrdenadosContractual = useMemo(() => 
    crearItemsOrdenados(titulosContractual, partidasContractual),
    [titulosContractual, partidasContractual, crearItemsOrdenados]
  );

  const itemsOrdenadosMeta = useMemo(() => 
    crearItemsOrdenados(titulosMeta, partidasMeta),
    [titulosMeta, partidasMeta, crearItemsOrdenados]
  );

  // Calcular totales
  const totalContractual = useMemo(() => {
    if (estructuraContractual?.presupuesto?.total_presupuesto) {
      return estructuraContractual.presupuesto.total_presupuesto;
    }
    return partidasContractual
      .filter(p => !p.id_partida_padre)
      .reduce((sum, p) => sum + (p.parcial_partida || 0), 0) || presupuestoContractual.total_presupuesto || 0;
  }, [partidasContractual, estructuraContractual, presupuestoContractual]);

  const totalMeta = useMemo(() => {
    if (estructuraMeta?.presupuesto?.total_presupuesto) {
      return estructuraMeta.presupuesto.total_presupuesto;
    }
    return partidasMeta
      .filter(p => !p.id_partida_padre)
      .reduce((sum, p) => sum + (p.parcial_partida || 0), 0) || presupuestoMeta.total_presupuesto || 0;
  }, [partidasMeta, estructuraMeta, presupuestoMeta]);

  // Toggle colapso de partidas
  const handleToggleColapsoPartida = useCallback((id_partida: string) => {
    setPartidasColapsadas(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(id_partida)) {
        nuevo.delete(id_partida);
      } else {
        nuevo.add(id_partida);
      }
      return nuevo;
    });
  }, []);

  // Sincronizar scroll
  useEffect(() => {
    const contractualEl = scrollContractualRef.current;
    const metaEl = scrollMetaRef.current;

    if (!contractualEl || !metaEl) return;

    // Función para manejar scroll del contractual
    const handleScrollContractual = () => {
      if (scrollSincronizado && metaEl) {
        metaEl.scrollTop = contractualEl.scrollTop;
      }
    };

    // Función para manejar scroll del meta
    const handleScrollMeta = () => {
      if (scrollSincronizado && contractualEl) {
        contractualEl.scrollTop = metaEl.scrollTop;
      }
    };

    // Agregar event listeners
    contractualEl.addEventListener('scroll', handleScrollContractual);
    metaEl.addEventListener('scroll', handleScrollMeta);

    // Cleanup: remover event listeners
    return () => {
      contractualEl.removeEventListener('scroll', handleScrollContractual);
      metaEl.removeEventListener('scroll', handleScrollMeta);
    };
  }, [scrollSincronizado]);

  // Renderizar tabla para un presupuesto
  const renderTabla = (
    items: ItemUnificado[],
    titulos: TituloEstructura[],
    partidas: PartidaEstructura[],
    scrollRef: React.RefObject<HTMLDivElement | null>,
    isLoading: boolean,
    total: number
  ) => {
    if (isLoading) {
      return (
        <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="flex-1 flex items-center justify-center min-h-0">
            <LoadingSpinner size={60} showText={true} text="Cargando estructura..." />
          </div>
        </div>
      );
    }

    return (
      <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow overflow-hidden flex flex-col flex-1 min-h-0">
        <div ref={scrollRef} className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
          <table className="w-full table-fixed divide-y divide-[var(--border-color)] text-xs min-w-[600px]">
            <thead className="sticky top-0 bg-[var(--card-bg)] z-10 table-header-shadow">
              <tr>
                <th className="w-[100px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)]">
                  Ítem
                </th>
                <th className="w-auto px-2 py-1 text-left font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)]">
                  Descripción
                </th>
                <th className="w-[70px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)]">
                  Und
                </th>
                <th className="w-[100px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)]">
                  Metrado
                </th>
                <th className="w-[110px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)]">
                  Precio
                </th>
                <th className="w-[110px] px-2 py-1 text-right font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Parcial
                </th>
              </tr>
            </thead>
            <tbody className="bg-[var(--background)] divide-y divide-[var(--border-color)]">
              {items.map((item, index) => {
                if (item.tipo === 'titulo') {
                  const titulo = item.titulo;
                  return (
                    <tr
                      key={`titulo-${titulo.id_titulo}`}
                      className="bg-[var(--card-bg)] hover:bg-[var(--card-bg)]/80 transition-colors cursor-default"
                    >
                      <td className={`px-2 py-1 text-right border-r border-[var(--border-color)] whitespace-nowrap ${getColorPorNivel(titulo.id_titulo, 'TITULO', titulos)}`}>
                        <span className="text-xs font-mono">
                          {titulo.numero_item || ''}
                        </span>
                      </td>
                      <td colSpan={5} className="px-2 py-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-3 h-3 flex-shrink-0" />
                          <span className={`text-xs font-medium truncate ${getColorPorNivel(titulo.id_titulo, 'TITULO', titulos)}`} title={titulo.descripcion}>
                            {titulo.descripcion}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                } else {
                  const partida = item.partida;
                  const estaColapsado = partidasColapsadas.has(partida.id_partida);
                  const tieneSubpartidas = getSubpartidas(partida.id_partida, partidas).length > 0;

                  return (
                    <Fragment key={partida.id_partida}>
                      <tr
                        className="bg-[var(--background)] transition-colors cursor-pointer hover:bg-[var(--hover-bg)]"
                      >
                        <td className="px-2 py-1 text-right border-r border-[var(--border-color)] whitespace-nowrap">
                          <span className="text-xs font-mono text-[var(--text-secondary)]">{calcularNumeroItem(partida)}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-[var(--border-color)] max-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {tieneSubpartidas ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleColapsoPartida(partida.id_partida);
                                }}
                                className="flex-shrink-0 w-3 h-3 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                              >
                                {estaColapsado ? (
                                  <ChevronRight className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </button>
                            ) : (
                              <div className="w-3 h-3 flex-shrink-0" />
                            )}
                            <span className="text-[var(--text-primary)] truncate flex-1 min-w-0" title={partida.descripcion}>
                              {partida.descripcion}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-[var(--border-color)] whitespace-nowrap">
                          <span className="text-xs text-[var(--text-secondary)]">{partida.unidad_medida || '-'}</span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-[var(--border-color)] whitespace-nowrap">
                          <span className="text-xs text-[var(--text-secondary)]">
                            {partida.metrado !== undefined && partida.metrado !== null && !isNaN(partida.metrado)
                              ? partida.metrado.toFixed(2)
                              : '-'}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-[var(--border-color)] whitespace-nowrap">
                          <span className="text-xs text-[var(--text-secondary)]">
                            {partida.precio_unitario !== undefined && partida.precio_unitario !== null && !isNaN(partida.precio_unitario)
                              ? partida.precio_unitario.toFixed(2)
                              : '-'}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-right whitespace-nowrap">
                          <span className="text-xs text-[var(--text-secondary)]">
                            {partida.parcial_partida !== undefined && partida.parcial_partida !== null && !isNaN(partida.parcial_partida)
                              ? partida.parcial_partida.toFixed(2)
                              : '-'}
                          </span>
                        </td>
                      </tr>
                      {!estaColapsado && tieneSubpartidas && getSubpartidas(partida.id_partida, partidas).map(subpartida => (
                        <tr
                          key={subpartida.id_partida}
                          className="bg-[var(--background)]/50 transition-colors"
                        >
                          <td className="px-2 py-1 text-right border-r border-[var(--border-color)] whitespace-nowrap pl-4">
                            <span className="text-xs font-mono text-[var(--text-secondary)]">{calcularNumeroItem(subpartida)}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-[var(--border-color)] max-w-0 pl-4">
                            <span className="text-[var(--text-primary)] truncate flex-1 min-w-0 text-xs" title={subpartida.descripcion}>
                              {subpartida.descripcion}
                            </span>
                          </td>
                          <td className="px-2 py-1 text-center border-r border-[var(--border-color)] whitespace-nowrap">
                            <span className="text-xs text-[var(--text-secondary)]">{subpartida.unidad_medida || '-'}</span>
                          </td>
                          <td className="px-2 py-1 text-center border-r border-[var(--border-color)] whitespace-nowrap">
                            <span className="text-xs text-[var(--text-secondary)]">
                              {subpartida.metrado !== undefined && subpartida.metrado !== null && !isNaN(subpartida.metrado)
                                ? subpartida.metrado.toFixed(2)
                                : '-'}
                            </span>
                          </td>
                          <td className="px-2 py-1 text-center border-r border-[var(--border-color)] whitespace-nowrap">
                            <span className="text-xs text-[var(--text-secondary)]">
                              {subpartida.precio_unitario !== undefined && subpartida.precio_unitario !== null && !isNaN(subpartida.precio_unitario)
                                ? subpartida.precio_unitario.toFixed(2)
                                : '-'}
                            </span>
                          </td>
                          <td className="px-2 py-1 text-right whitespace-nowrap">
                            <span className="text-xs text-[var(--text-secondary)]">
                              {subpartida.parcial_partida !== undefined && subpartida.parcial_partida !== null && !isNaN(subpartida.parcial_partida)
                                ? subpartida.parcial_partida.toFixed(2)
                                : '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                }
              })}
            </tbody>
          </table>
        </div>
        <div className="bg-[var(--card-bg)] border-t border-[var(--border-color)] flex-shrink-0 overflow-x-auto">
          <table className="w-full table-fixed text-xs min-w-[600px]">
            <tfoot>
              <tr>
                <td className="w-[100px]"></td>
                <td className="w-auto"></td>
                <td className="w-[70px]"></td>
                <td className="w-[100px]"></td>
                <td className="w-[110px] px-2 py-2 text-right font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)]">
                  Total Presupuesto:
                </td>
                <td className="w-[110px] px-2 py-2 text-right font-semibold text-[var(--text-primary)]">
                  {total.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px-48px)]">
      {/* Contenedor de detalles generales */}
      <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-3 mb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center p-1 rounded hover:bg-[var(--card-bg)]/60 transition-colors flex-shrink-0"
            title="Regresar"
          >
            <ArrowLeft className="h-4 w-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate" title={presupuestoContractual.nombre_presupuesto}>
              {presupuestoContractual.nombre_presupuesto}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={scrollSincronizado}
                onChange={(e) => setScrollSincronizado(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border-color)] text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-[var(--text-primary)]">Sincronizar scroll</span>
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Detalles Presupuesto Contractual */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-1 h-4 rounded-full bg-blue-500" />
              <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400">Presupuesto Contractual</h3>
            </div>
            <div className="flex items-center gap-4 flex-1">
              <div>
                <span className="text-[var(--text-secondary)] text-[11px]">Versión:</span>
                <span className="text-[var(--text-primary)] ml-1 text-xs">V{presupuestoContractual.version || 1}</span>
              </div>
              <div>
                <span className="text-[var(--text-secondary)] text-[11px]">Total Presupuesto:</span>
                <span className="text-[var(--text-primary)] font-semibold ml-1 text-xs">
                  S/ {presupuestoContractual.total_presupuesto.toLocaleString('es-PE', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Detalles Presupuesto Meta */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-1 h-4 rounded-full bg-green-500" />
              <h3 className="text-xs font-semibold text-green-600 dark:text-green-400">Presupuesto Meta</h3>
            </div>
            <div className="flex items-center gap-4 flex-1">
              <div>
                <span className="text-[var(--text-secondary)] text-[11px]">Versión:</span>
                <span className="text-[var(--text-primary)] ml-1 text-xs">V{presupuestoMeta.version || 1}</span>
              </div>
              <div>
                <span className="text-[var(--text-secondary)] text-[11px]">Total Presupuesto:</span>
                <span className="text-[var(--text-primary)] font-semibold ml-1 text-xs">
                  S/ {presupuestoMeta.total_presupuesto.toLocaleString('es-PE', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Layout de dos columnas 50/50 */}
      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
        {/* Columna izquierda: Presupuesto Contractual */}
        {renderTabla(itemsOrdenadosContractual, titulosContractual, partidasContractual, scrollContractualRef, isLoadingEstructuraContractual, totalContractual)}

        {/* Columna derecha: Presupuesto Meta */}
        {renderTabla(itemsOrdenadosMeta, titulosMeta, partidasMeta, scrollMetaRef, isLoadingEstructuraMeta, totalMeta)}
      </div>
    </div>
  );
}
