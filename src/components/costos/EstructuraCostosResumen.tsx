'use client';

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { SearchInput, type SearchItem } from '@/components/ui/search-input';
import { useEstructuraPresupuesto } from '@/hooks/usePresupuestos';
import { useApuByPartida } from '@/hooks/useAPU';
import type { PartidaEstructura, TituloEstructura } from '@/hooks/usePresupuestos';
import { executeQuery } from '@/services/graphql-client';
import { GET_TRAZABILIDAD_PARTIDA_QUERY, GET_TRAZABILIDAD_DETALLE_PARTIDA_QUERY } from '@/graphql/queries/control-costos.queries';
import { useQuery } from '@tanstack/react-query';
import ModalTrazabilidadDetalle from './ModalTrazabilidadDetalle';

interface EstructuraCostosResumenProps {
  id_presupuesto: string;
}


export default function EstructuraCostosResumen({
  id_presupuesto,
}: EstructuraCostosResumenProps) {
  const router = useRouter();
  const [partidasColapsadas, setPartidasColapsadas] = useState<Set<string>>(new Set());
  const [partidaSeleccionada, setPartidaSeleccionada] = useState<PartidaEstructura | null>(null);
  const [recursoSeleccionado, setRecursoSeleccionado] = useState<{
    recurso_id: string;
    codigo: string;
    descripcion: string;
    totalRQ: number;
    totalOCBienes: number;
    totalOCServicios: number;
    totalRecepcion: number;
    diferencia: number;
  } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const partidaRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const { data: estructuraData, isLoading, error } = useEstructuraPresupuesto(id_presupuesto);
  
  // Cargar APU de la partida seleccionada
  const { data: apuData, isLoading: isLoadingApu } = useApuByPartida(
    partidaSeleccionada?.id_partida || null,
    id_presupuesto
  );

  // Cargar trazabilidad de la partida seleccionada
  const { data: trazabilidadData, isLoading: isLoadingTrazabilidad } = useQuery({
    queryKey: ['trazabilidadPartida', partidaSeleccionada?.id_partida, id_presupuesto],
    queryFn: async () => {
      if (!partidaSeleccionada?.id_partida || !id_presupuesto) return null;
      const response = await executeQuery<{ getTrazabilidadPartida: any }>(
        GET_TRAZABILIDAD_PARTIDA_QUERY,
        { id_partida: partidaSeleccionada.id_partida, id_presupuesto }
      );
      return response.getTrazabilidadPartida;
    },
    enabled: !!partidaSeleccionada?.id_partida && !!id_presupuesto,
    staleTime: 30000, // 30 segundos
  });

  // Cargar trazabilidad detallada para el modal
  const { data: trazabilidadDetalle, isLoading: isLoadingDetalle } = useQuery({
    queryKey: ['trazabilidadDetallePartida', partidaSeleccionada?.id_partida],
    queryFn: async () => {
      if (!partidaSeleccionada?.id_partida) return null;
      const response = await executeQuery<{ getTrazabilidadDetallePartida: any }>(
        GET_TRAZABILIDAD_DETALLE_PARTIDA_QUERY,
        { id_partida: partidaSeleccionada.id_partida }
      );
      return response.getTrazabilidadDetallePartida;
    },
    enabled: !!partidaSeleccionada?.id_partida && !!recursoSeleccionado,
    staleTime: 30000, // 30 segundos
  });

  const titulos = estructuraData?.titulos || [];
  const partidas = estructuraData?.partidas || [];

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

  // Obtener hijos de un título
  const getHijosTitulo = useCallback((id_titulo: string): TituloEstructura[] => {
    return titulos.filter(t => t.id_titulo_padre === id_titulo).sort((a, b) => a.orden - b.orden);
  }, [titulos]);

  // Obtener partidas de un título
  const getPartidasDeTitulo = useCallback((id_titulo: string): PartidaEstructura[] => {
    return partidas.filter(p => p.id_titulo === id_titulo && !p.id_partida_padre).sort((a, b) => a.orden - b.orden);
  }, [partidas]);

  // Obtener subpartidas de una partida
  const getSubpartidas = useCallback((id_partida: string): PartidaEstructura[] => {
    return partidas.filter(p => p.id_partida_padre === id_partida).sort((a, b) => a.orden - b.orden);
  }, [partidas]);

  // Calcular número de item
  const calcularNumeroItem = useCallback((partida: PartidaEstructura): string => {
    return partida.numero_item || '';
  }, []);

  // Calcular nivel dinámico de un título
  const calcularNivelDinamico = useCallback((id_titulo: string): number => {
    const titulo = titulos.find(t => t.id_titulo === id_titulo);
    if (!titulo) return 1;

    // Si no tiene padre, es nivel 1
    if (!titulo.id_titulo_padre) return 1;

    // Si tiene padre, calcular recursivamente
    return calcularNivelDinamico(titulo.id_titulo_padre) + 1;
  }, [titulos]);

  // Obtener color por nivel (igual que EstructuraPresupuestoEditor)
  const getColorPorNivel = useCallback((id_titulo: string, tipo: string) => {
    // Las partidas siempre tienen el mismo color
    if (tipo === 'PARTIDA') {
      return 'text-[var(--text-primary)]';
    }

    // Calcular el nivel dinámicamente basándose en la jerarquía actual
    const nivel = calcularNivelDinamico(id_titulo);

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


  // Tipo unificado para títulos y partidas
  type ItemUnificado = 
    | { tipo: 'titulo'; titulo: TituloEstructura }
    | { tipo: 'partida'; partida: PartidaEstructura };

  // Crear lista ordenada con títulos y partidas (con jerarquía pero sin tabulaciones)
  const itemsOrdenados = useMemo(() => {
    const items: ItemUnificado[] = [];

    // Función recursiva para agregar títulos y partidas
    const agregarItemsDeTitulo = (id_titulo: string) => {
      // Buscar el título actual
      const tituloActual = titulos.find(t => t.id_titulo === id_titulo);
      if (tituloActual) {
        // Agregar el título
        items.push({ tipo: 'titulo', titulo: tituloActual });
      }

      // Agregar partidas principales del título
      const partidasDelTitulo = getPartidasDeTitulo(id_titulo);
      partidasDelTitulo.forEach(partida => {
        items.push({ tipo: 'partida', partida });
        
        // Agregar subpartidas
        const subpartidas = getSubpartidas(partida.id_partida);
        subpartidas.forEach(subpartida => {
          items.push({ tipo: 'partida', partida: subpartida });
        });
      });

      // Agregar títulos hijos recursivamente
      const titulosHijos = getHijosTitulo(id_titulo);
      titulosHijos.forEach(tituloHijo => {
        agregarItemsDeTitulo(tituloHijo.id_titulo);
      });
    };

    // Obtener títulos raíz y procesar
    const titulosRaiz = titulos.filter(t => !t.id_titulo_padre).sort((a, b) => a.orden - b.orden);
    titulosRaiz.forEach(titulo => {
      agregarItemsDeTitulo(titulo.id_titulo);
    });

    return items;
  }, [titulos, partidas, getPartidasDeTitulo, getSubpartidas, getHijosTitulo]);

  // Lista de solo partidas para compatibilidad con otras funciones
  const partidasOrdenadas = useMemo(() => {
    return itemsOrdenados
      .filter(item => item.tipo === 'partida')
      .map(item => item.partida);
  }, [itemsOrdenados]);

  // Convertir datos del APU a formato para la tabla
  const datosAPUMeta = useMemo(() => {
    if (!apuData || !apuData.recursos || apuData.recursos.length === 0) {
      return [];
    }
    return apuData.recursos.map((recurso: any) => ({
      codigo: recurso.codigo_recurso || '-',
      descripcion: recurso.descripcion || '-',
      unidad: recurso.unidad_medida || '-',
      cantidad: recurso.cantidad || 0,
      precio: recurso.precio || 0,
      parcial: recurso.parcial || 0,
    }));
  }, [apuData]);

  const totalAPU = useMemo(() => {
    return datosAPUMeta.reduce((sum, item) => sum + item.parcial, 0);
  }, [datosAPUMeta]);

  // Convertir datos de trazabilidad a formato para la tabla
  // Enriquecer con datos del APU (igual que el monolito obtiene desde Redux)
  const datosCostoReal = useMemo(() => {
    if (!trazabilidadData?.recursos || trazabilidadData.recursos.length === 0) {
      return [];
    }
    
    // Crear mapa de recursos desde el APU (igual que el monolito desde Redux)
    const recursosApuMap = new Map<string, { codigo: string; descripcion: string; unidad: string }>();
    if (apuData?.recursos) {
      apuData.recursos.forEach((recursoApu: any) => {
        if (recursoApu.recurso_id && !recursosApuMap.has(recursoApu.recurso_id)) {
          recursosApuMap.set(recursoApu.recurso_id, {
            codigo: recursoApu.codigo_recurso || '-',
            descripcion: recursoApu.descripcion || '-',
            unidad: recursoApu.unidad_medida || '-'
          });
        }
      });
    }
    
    return trazabilidadData.recursos.map((recurso: any) => {
      // Buscar información del recurso en el APU (igual que el monolito busca en Redux)
      const recursoInfo = recursosApuMap.get(recurso.recurso_id);
      
      return {
        recurso_id: recurso.recurso_id, // Agregar recurso_id para el modal
        codigo: recursoInfo?.codigo || recurso.codigo_recurso || recurso.recurso_id || '-',
        descripcion: recursoInfo?.descripcion || recurso.nombre_recurso || recurso.recurso_id || '-',
        totalRQ: recurso.total_requerimiento || 0,
        totalOCBienes: recurso.total_ordenes_compra_bienes || 0,
        totalOCServicios: recurso.total_ordenes_compra_servicios || 0,
        totalRecepcion: recurso.total_recepcion_almacen || 0,
        diferencia: recurso.diferencia_mayor_gasto || 0,
      };
    });
  }, [trazabilidadData, apuData]);

  const totalesCostoReal = useMemo(() => {
    return {
      totalRQ: datosCostoReal.reduce((sum: number, item: any) => sum + item.totalRQ, 0),
      totalOCBienes: datosCostoReal.reduce((sum: number, item: any) => sum + item.totalOCBienes, 0),
      totalOCServicios: datosCostoReal.reduce((sum: number, item: any) => sum + item.totalOCServicios, 0),
      totalRecepcion: datosCostoReal.reduce((sum: number, item: any) => sum + item.totalRecepcion, 0),
      diferencia: datosCostoReal.reduce((sum: number, item: any) => sum + item.diferencia, 0),
    };
  }, [datosCostoReal]);

  // Calcular total del presupuesto
  const totalPresupuesto = useMemo(() => {
    return partidasOrdenadas
      .filter(p => !p.id_partida_padre)
      .reduce((sum, partida) => {
        const parcial = partida.parcial_partida || 0;
        return sum + (isNaN(parcial) ? 0 : parcial);
      }, 0);
  }, [partidasOrdenadas]);

  // Función de búsqueda para SearchInput
  const buscarPartidas = useCallback(async (query: string): Promise<SearchItem[]> => {
    if (!query || query.length < 1) {
      // Si no hay query, devolver todas las partidas principales (sin subpartidas)
      return partidasOrdenadas
        .filter(p => !p.id_partida_padre)
        .map(partida => ({
          id: partida.id_partida,
          nombre: `${partida.numero_item || ''} - ${partida.descripcion || ''}`,
          codigo: partida.numero_item || '',
        }));
    }

    const queryLower = query.toLowerCase();
    return partidasOrdenadas
      .filter(partida => {
        const descripcion = (partida.descripcion || '').toLowerCase();
        const numeroItem = (partida.numero_item || '').toLowerCase();
        return descripcion.includes(queryLower) || numeroItem.includes(queryLower);
      })
      .map(partida => ({
        id: partida.id_partida,
        nombre: `${partida.numero_item || ''} - ${partida.descripcion || ''}`,
        codigo: partida.numero_item || '',
      }));
  }, [partidasOrdenadas]);

  // Función para manejar la selección de una partida desde el buscador
  const handleSeleccionarPartida = useCallback((item: SearchItem) => {
    const partida = partidasOrdenadas.find(p => p.id_partida === item.id);
    if (partida) {
      setPartidaSeleccionada(partida);
      
      // Asegurar que la partida no esté colapsada si tiene subpartidas
      if (getSubpartidas(partida.id_partida).length > 0) {
        setPartidasColapsadas(prev => {
          const nuevo = new Set(prev);
          nuevo.delete(partida.id_partida);
          return nuevo;
        });
      }

      // Hacer scroll hasta la partida seleccionada
      setTimeout(() => {
        const rowElement = partidaRefs.current.get(partida.id_partida);
        if (rowElement && tableRef.current) {
          rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [partidasOrdenadas, getSubpartidas]);

  // Efecto para hacer scroll cuando cambia la partida seleccionada
  useEffect(() => {
    if (partidaSeleccionada) {
      setTimeout(() => {
        const rowElement = partidaRefs.current.get(partidaSeleccionada.id_partida);
        if (rowElement && tableRef.current) {
          rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [partidaSeleccionada]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg shadow-lg shadow-black/4 border border-[var(--border-color)] p-12">
          <LoadingSpinner size={80} showText={true} text="Cargando estructura..." />
        </div>
      </div>
    );
  }

  if (error || !estructuraData) {
    return (
      <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg border border-[var(--border-color)] p-4 text-center">
        <p className="text-xs text-red-500">Error al cargar la estructura del presupuesto</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-60px-48px)] overflow-y-auto overflow-x-hidden p-2">
      {/* Header */}
      <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-2 flex-shrink-0 mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center p-1 rounded hover:bg-[var(--card-bg)]/60 transition-colors flex-shrink-0"
            title="Regresar"
          >
            <ArrowLeft className="h-4 w-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" />
          </button>
          <h1 className="text-xs font-semibold text-[var(--text-primary)]">
            Gestión de Costos - Detalle completo de presupuesto, APU y costos reales
          </h1>
        </div>
      </div>

      {/* Layout de dos columnas */}
      <div className="grid grid-cols-20 gap-3 flex-1 min-h-0">
        {/* Columna izquierda: Presupuesto Meta (55%) */}
        <div className="col-span-11 flex flex-col min-h-0">
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="bg-[var(--card-bg)] px-3 py-2 border-b border-[var(--border-color)] flex-shrink-0">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xs font-semibold text-[var(--text-primary)]">Presupuesto Meta</h2>
                <div className="flex-1 max-w-xs">
                  <SearchInput
                    placeholder="Buscar partida..."
                    minChars={1}
                    onSearch={buscarPartidas}
                    onSelect={handleSeleccionarPartida}
                    className="w-full"
                    inputHeight="h-7"
                    showInitialResults={true}
                    renderItem={(item) => (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[var(--text-secondary)]">{item.codigo}</span>
                        <span className="text-[11px] text-[var(--text-primary)] truncate">{item.nombre.replace(`${item.codigo} - `, '')}</span>
                      </div>
                    )}
                  />
                </div>
              </div>
            </div>
            <div ref={tableRef} className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
              <table className="w-full table-fixed divide-y divide-[var(--border-color)] text-xs">
                <thead className="sticky top-0 bg-[var(--card-bg)] z-10 table-header-shadow">
                  <tr>
                    <th className="w-[100px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)]">
                      Ítem
                    </th>
                    <th className="w-auto px-2 py-1 text-left font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)]">
                      Descripción
                    </th>
                    <th className="w-[90px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)]">
                      Und
                    </th>
                    <th className="w-[110px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)]">
                      Metrado
                    </th>
                    <th className="w-[130px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)]">
                      Precio
                    </th>
                    <th className="w-[150px] px-2 py-1 text-right font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Parcial
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--background)] divide-y divide-[var(--border-color)]">
                  {itemsOrdenados.map((item, index) => {
                    if (item.tipo === 'titulo') {
                      // Renderizar título
                      const titulo = item.titulo;
                      return (
                        <tr
                          key={`titulo-${titulo.id_titulo}`}
                          className="bg-[var(--card-bg)] hover:bg-[var(--card-bg)]/80 transition-colors cursor-default"
                        >
                          <td className={`px-2 py-1 text-right border-r border-[var(--border-color)] whitespace-nowrap ${getColorPorNivel(titulo.id_titulo, 'TITULO')}`}>
                            <span className="text-xs font-mono">
                              {titulo.numero_item || ''}
                            </span>
                          </td>
                          <td colSpan={5} className="px-2 py-1">
                            <div className="flex items-center gap-1.5">
                              <div className="w-3 h-3 flex-shrink-0" />
                              <span className={`text-xs font-medium ${getColorPorNivel(titulo.id_titulo, 'TITULO')}`}>
                                {titulo.descripcion}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    } else {
                      // Renderizar partida
                      const partida = item.partida;
                      const estaColapsado = partidasColapsadas.has(partida.id_partida);
                      const tieneSubpartidas = getSubpartidas(partida.id_partida).length > 0;
                      const esSubpartida = !!partida.id_partida_padre;

                      // Verificar si está oculto por colapso de su partida padre
                      const estaOculto = partida.id_partida_padre && partidasColapsadas.has(partida.id_partida_padre);
                      if (estaOculto) {
                        return null;
                      }

                      return (
                        <tr
                          key={partida.id_partida}
                          ref={(el) => {
                            if (el) {
                              partidaRefs.current.set(partida.id_partida, el);
                            } else {
                              partidaRefs.current.delete(partida.id_partida);
                            }
                          }}
                          onClick={() => setPartidaSeleccionada(partida)}
                          className={`${esSubpartida ? 'bg-[var(--background)]/50' : 'bg-[var(--background)]'} transition-colors cursor-pointer hover:bg-[var(--hover-bg)] ${
                            partidaSeleccionada?.id_partida === partida.id_partida ? 'bg-blue-500/20 ring-2 ring-blue-500/50' : ''
                          }`}
                        >
                          <td className="px-2 py-1 text-right border-r border-[var(--border-color)] whitespace-nowrap">
                            <span className="text-xs font-mono text-[var(--text-secondary)]">{calcularNumeroItem(partida)}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-[var(--border-color)]">
                            <div className="flex items-center gap-1.5">
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
                              <span className="text-[var(--text-primary)]">
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
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>
            {/* Footer fijo */}
            <div className="bg-[var(--card-bg)] border-t border-[var(--border-color)] flex-shrink-0">
              <table className="w-full table-fixed text-xs">
                <tfoot>
                  <tr>
                    <td className="w-[100px]"></td>
                    <td className="w-auto"></td>
                    <td className="w-[90px]"></td>
                    <td className="w-[110px]"></td>
                    <td className="w-[130px] px-2 py-2 text-right font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)]">
                      Total Presupuesto:
                    </td>
                    <td className="w-[150px] px-2 py-2 text-right font-semibold text-[var(--text-primary)]">
                      {totalPresupuesto.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Columna derecha: APU Meta y Costo Real + Proyección (45%) */}
        <div className="col-span-9 flex flex-col gap-3 min-h-0">
          {/* Contenedor APU Meta */}
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="bg-[var(--card-bg)] px-3 py-2 border-b border-[var(--border-color)] flex-shrink-0">
              {/* Fila 1: Título */}
              <h2 className="text-xs font-semibold text-[var(--text-primary)] mb-1.5">APU Meta</h2>
              
              {partidaSeleccionada ? (
                <div className="space-y-1.5">
                  {/* Fila 2: Ítem, Rendimiento, Jornada */}
                  <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[var(--text-secondary)] min-w-[50px] text-xs">Ítem:</span>
                      <Input
                        type="text"
                        value={partidaSeleccionada.numero_item || '-'}
                        disabled
                        className="h-6 text-xs px-2 font-mono"
                      />
                    </div>
                    {apuData && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[var(--text-secondary)] min-w-[70px] text-xs">Rendimiento:</span>
                          <Input
                            type="text"
                            value={apuData.rendimiento ? apuData.rendimiento.toFixed(4) : '-'}
                            disabled
                            className="h-6 text-xs px-2"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[var(--text-secondary)] min-w-[60px] text-xs">Jornada:</span>
                          <Input
                            type="text"
                            value={apuData.jornada ? `${apuData.jornada.toFixed(2)} h` : '-'}
                            disabled
                            className="h-6 text-xs px-2"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  {/* Fila 3: Und, Metrado, P. Unitario, Parcial */}
                  <div className="grid grid-cols-4 gap-x-3 gap-y-0.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[var(--text-secondary)] min-w-[35px] text-xs">Und:</span>
                      <Input
                        type="text"
                        value={partidaSeleccionada.unidad_medida || '-'}
                        disabled
                        className="h-6 text-xs px-2"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[var(--text-secondary)] min-w-[55px] text-xs">Metrado:</span>
                      <Input
                        type="text"
                        value={partidaSeleccionada.metrado !== undefined && partidaSeleccionada.metrado !== null && !isNaN(partidaSeleccionada.metrado)
                          ? partidaSeleccionada.metrado.toFixed(2)
                          : '-'}
                        disabled
                        className="h-6 text-xs px-2"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[var(--text-secondary)] min-w-[70px] text-xs">P. Unitario:</span>
                      <Input
                        type="text"
                        value={partidaSeleccionada.precio_unitario !== undefined && partidaSeleccionada.precio_unitario !== null && !isNaN(partidaSeleccionada.precio_unitario)
                          ? `S/ ${partidaSeleccionada.precio_unitario.toFixed(2)}`
                          : '-'}
                        disabled
                        className="h-6 text-xs px-2"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[var(--text-secondary)] min-w-[50px] text-xs">Parcial:</span>
                      <Input
                        type="text"
                        value={partidaSeleccionada.parcial_partida !== undefined && partidaSeleccionada.parcial_partida !== null && !isNaN(partidaSeleccionada.parcial_partida)
                          ? `S/ ${partidaSeleccionada.parcial_partida.toFixed(2)}`
                          : '-'}
                        disabled
                        className="h-6 text-xs px-2 font-semibold"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Seleccione una partida para ver su APU</p>
              )}
            </div>
            <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
              <table className="w-full table-fixed divide-y divide-[var(--border-color)] text-xs">
                <thead className="sticky top-0 bg-[var(--card-bg)] z-10 table-header-shadow">
                  <tr>
                    <th className="w-[80px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-xs">
                      Código
                    </th>
                    <th className="w-auto px-2 py-1 text-left font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-xs">
                      Descripción
                    </th>
                    <th className="w-[50px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-xs">
                      Und
                    </th>
                    <th className="w-[85px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-xs">
                      Cantidad
                    </th>
                    <th className="w-[70px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-xs">
                      Precio
                    </th>
                    <th className="w-[80px] px-2 py-1 text-right font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-xs">
                      Parcial
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--background)] divide-y divide-[var(--border-color)]">
                  {isLoadingApu ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-4 text-center text-xs text-[var(--text-secondary)]">
                        <LoadingSpinner size={20} showText={false} />
                        <span className="ml-2">Cargando APU...</span>
                      </td>
                    </tr>
                  ) : datosAPUMeta.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-4 text-center text-xs text-[var(--text-secondary)]">
                        {partidaSeleccionada 
                          ? 'Esta partida no tiene APU asociado'
                          : 'Seleccione una partida para ver su APU'}
                      </td>
                    </tr>
                  ) : (
                    datosAPUMeta.map((item, index) => (
                      <tr key={index} className="hover:bg-[var(--hover-bg)] transition-colors">
                        <td className="px-2 py-1 text-center border-r border-[var(--border-color)] text-xs">
                          {item.codigo}
                        </td>
                        <td className="px-2 py-1 border-r border-[var(--border-color)] text-xs">
                          {item.descripcion}
                        </td>
                        <td className="px-2 py-1 text-center border-r border-[var(--border-color)] text-xs">
                          {item.unidad}
                        </td>
                        <td className="px-2 py-1 text-center border-r border-[var(--border-color)] text-xs">
                          {item.cantidad.toFixed(2)}
                        </td>
                        <td className="px-2 py-1 text-center border-r border-[var(--border-color)] text-xs">
                          {item.precio.toFixed(2)}
                        </td>
                        <td className="px-2 py-1 text-right text-xs">
                          {item.parcial.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Footer fijo */}
            {datosAPUMeta.length > 0 && (
              <div className="bg-[var(--card-bg)] border-t border-[var(--border-color)] flex-shrink-0">
                <table className="w-full table-fixed text-xs">
                  <tfoot>
                    <tr>
                      <td className="w-[80px]"></td>
                      <td className="w-auto"></td>
                      <td className="w-[50px]"></td>
                      <td className="w-[85px]"></td>
                      <td className="w-[70px] px-2 py-2 text-right font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)] text-xs">
                        Total APU:
                      </td>
                      <td className="w-[80px] px-2 py-2 text-right font-semibold text-[var(--text-primary)] text-xs">
                        {totalAPU.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Contenedor Costo Real + Proyección */}
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="bg-blue-500/10 px-3 py-2 border-b border-[var(--border-color)] flex-shrink-0">
              <h2 className="text-xs font-semibold text-[var(--text-primary)]">Costo Real + Proyección</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Análisis de ejecución vs presupuestado</p>
            </div>
            <div className="overflow-y-auto overflow-x-auto flex-1 min-h-0">
              <div className="min-w-0">
                <table className="w-full table-fixed divide-y divide-[var(--border-color)] text-xs">
                  <thead className="sticky top-0 bg-[var(--card-bg)] z-10 table-header-shadow">
                    <tr>
                      <th className="w-[80px] px-1.5 py-1.5 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-[10px] whitespace-nowrap">
                        Código
                      </th>
                      <th className="w-auto px-1.5 py-1.5 text-left font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-[10px]">
                        Descripción
                      </th>
                      <th className="w-[90px] px-1.5 py-1.5 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-[10px] whitespace-nowrap">
                        RQ
                      </th>
                      <th className="w-[90px] px-1.5 py-1.5 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-[10px] whitespace-nowrap">
                        OC B
                      </th>
                      <th className="w-[90px] px-1.5 py-1.5 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-[10px] whitespace-nowrap">
                        OC S
                      </th>
                      <th className="w-[90px] px-1.5 py-1.5 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-[10px] whitespace-nowrap">
                        Recep.
                      </th>
                      <th className="w-[100px] px-1.5 py-1.5 text-right font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-[10px] whitespace-nowrap">
                        Dif.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--background)] divide-y divide-[var(--border-color)]">
                    {isLoadingTrazabilidad ? (
                      <tr>
                        <td colSpan={7} className="px-1.5 py-4 text-center text-xs text-[var(--text-secondary)]">
                          <LoadingSpinner size={20} showText={false} />
                          <span className="ml-2">Cargando datos de trazabilidad...</span>
                        </td>
                      </tr>
                    ) : datosCostoReal.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-1.5 py-4 text-center text-xs text-[var(--text-secondary)]">
                          {partidaSeleccionada 
                            ? 'Esta partida no tiene datos de trazabilidad'
                            : 'Seleccione una partida para ver los costos reales'}
                        </td>
                      </tr>
                    ) : (
                      datosCostoReal.map((item: any, index: number) => (
                      <tr 
                        key={index} 
                        className="hover:bg-[var(--hover-bg)] transition-colors cursor-pointer"
                        onClick={() => {
                          setRecursoSeleccionado({
                            recurso_id: item.recurso_id,
                            codigo: item.codigo,
                            descripcion: item.descripcion,
                            totalRQ: item.totalRQ,
                            totalOCBienes: item.totalOCBienes,
                            totalOCServicios: item.totalOCServicios,
                            totalRecepcion: item.totalRecepcion,
                            diferencia: item.diferencia,
                          });
                        }}
                      >
                        <td className="px-1.5 py-1.5 text-center border-r border-[var(--border-color)] text-xs font-medium whitespace-nowrap">
                          {item.codigo}
                        </td>
                        <td className="px-1.5 py-1.5 border-r border-[var(--border-color)] text-xs truncate max-w-[200px]" title={item.descripcion}>
                          {item.descripcion}
                        </td>
                        <td className="px-1.5 py-1.5 text-center border-r border-[var(--border-color)] text-xs whitespace-nowrap font-mono">
                          {item.totalRQ.toFixed(2)}
                        </td>
                        <td className="px-1.5 py-1.5 text-center border-r border-[var(--border-color)] text-xs whitespace-nowrap font-mono">
                          {item.totalOCBienes.toFixed(2)}
                        </td>
                        <td className="px-1.5 py-1.5 text-center border-r border-[var(--border-color)] text-xs whitespace-nowrap font-mono">
                          {item.totalOCServicios.toFixed(2)}
                        </td>
                        <td className="px-1.5 py-1.5 text-center border-r border-[var(--border-color)] text-xs whitespace-nowrap font-mono">
                          {item.totalRecepcion.toFixed(2)}
                        </td>
                        <td className={`px-1.5 py-1.5 text-right text-xs whitespace-nowrap font-mono font-semibold ${item.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.diferencia >= 0 ? '+' : ''}{item.diferencia.toFixed(2)}
                        </td>
                      </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Footer fijo */}
            <div className="bg-[var(--card-bg)] border-t border-[var(--border-color)] flex-shrink-0">
              <table className="w-full table-fixed divide-y divide-[var(--border-color)] text-xs">
                <tfoot>
                  <tr>
                    <td className="w-[80px]"></td>
                    <td className="w-auto px-1.5 py-2 text-right font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)] text-xs">
                      Totales:
                    </td>
                    <td className="w-[90px] px-1.5 py-2 text-center font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)] text-xs whitespace-nowrap font-mono">
                      {totalesCostoReal.totalRQ.toFixed(2)}
                    </td>
                    <td className="w-[90px] px-1.5 py-2 text-center font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)] text-xs whitespace-nowrap font-mono">
                      {totalesCostoReal.totalOCBienes.toFixed(2)}
                    </td>
                    <td className="w-[90px] px-1.5 py-2 text-center font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)] text-xs whitespace-nowrap font-mono">
                      {totalesCostoReal.totalOCServicios.toFixed(2)}
                    </td>
                    <td className="w-[90px] px-1.5 py-2 text-center font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)] text-xs whitespace-nowrap font-mono">
                      {totalesCostoReal.totalRecepcion.toFixed(2)}
                    </td>
                    <td className={`w-[100px] px-1.5 py-2 text-right font-semibold text-xs whitespace-nowrap font-mono ${totalesCostoReal.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalesCostoReal.diferencia >= 0 ? '+' : ''}{totalesCostoReal.diferencia.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de trazabilidad detallada */}
      <ModalTrazabilidadDetalle
        isOpen={!!recursoSeleccionado}
        onClose={() => setRecursoSeleccionado(null)}
        recurso={recursoSeleccionado}
        todosLosRecursos={datosCostoReal}
        trazabilidadDetalle={trazabilidadDetalle}
        isLoading={isLoadingDetalle}
        onSeleccionarRecurso={(nuevoRecurso) => {
          setRecursoSeleccionado(nuevoRecurso);
        }}
      />
    </div>
  );
}
