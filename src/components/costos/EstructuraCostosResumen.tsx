'use client';

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, ArrowLeft, Maximize2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { SelectSearch } from '@/components/ui/select-search';
import { IconButton } from '@/components/ui/icon-button';
import { useEstructuraPresupuesto } from '@/hooks/usePresupuestos';
import { useApuByPartida } from '@/hooks/useAPU';
import type { PartidaEstructura, TituloEstructura } from '@/hooks/usePresupuestos';
import { executeQuery } from '@/services/graphql-client';
import { GET_TRAZABILIDAD_PARTIDA_QUERY, GET_TRAZABILIDAD_DETALLE_PARTIDA_QUERY } from '@/graphql/queries/control-costos.queries';
import { useQuery } from '@tanstack/react-query';
import ModalTrazabilidadDetalle from './ModalTrazabilidadDetalle';
import { calcularParcialRecurso, calcularSumaParcialesManoObra } from '@/utils/calculoEstructura';

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
    totalComposicion: number;
    totalRQ: number;
    totalRQBruto: number;
    totalOCBienes: number;
    totalOCBienesBruto: number;
    totalOCServicios: number;
    totalOCServiciosBruto: number;
    totalRecepcion: number;
    totalRecepcionBruto: number;
    diferencia: number;
  } | null>(null);
  const [abrirVistaPartida, setAbrirVistaPartida] = useState(false);
  const [tabActivo, setTabActivo] = useState<'presupuesto' | 'apu' | 'costos'>('presupuesto');
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

      // Agregar partidas principales del título (sin subpartidas)
      const partidasDelTitulo = getPartidasDeTitulo(id_titulo);
      partidasDelTitulo.forEach(partida => {
        items.push({ tipo: 'partida', partida });
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
  }, [titulos, partidas, getPartidasDeTitulo, getHijosTitulo]);

  // Lista de solo partidas para compatibilidad con otras funciones
  const partidasOrdenadas = useMemo(() => {
    return itemsOrdenados
      .filter(item => item.tipo === 'partida')
      .map(item => item.partida);
  }, [itemsOrdenados]);

  // Crear mapa de precios compartidos
  const preciosCompartidosMap = useMemo(() => {
    const mapa = new Map<string, number>();
    if (estructuraData?.precios_compartidos && estructuraData.precios_compartidos.length > 0) {
      estructuraData.precios_compartidos.forEach((p: any) => {
        mapa.set(p.id_precio_recurso, p.precio);
      });
    }
    return mapa;
  }, [estructuraData]);

  // Función helper para calcular precio usando lógica de prioridades
  const calcularPrecioRecurso = useCallback((recurso: any, rendimiento: number, jornada: number): number => {
    // PRIORIDAD 1: Si tiene precio override, usarlo directamente
    if (recurso.tiene_precio_override && recurso.precio_override !== undefined && recurso.precio_override !== null) {
      return recurso.precio_override;
    }

    // PRIORIDAD 2: Si no tiene override, usar precio compartido
    if (recurso.id_precio_recurso && preciosCompartidosMap.has(recurso.id_precio_recurso)) {
      return preciosCompartidosMap.get(recurso.id_precio_recurso)!;
    }

    // PRIORIDAD 3: Si no hay precio compartido, intentar calcular desde parcial guardado
    if (recurso.parcial !== undefined && recurso.parcial !== null) {
      const tipoRecurso = recurso.tipo_recurso || 'MATERIAL';
      const cantidad = recurso.cantidad || 0;
      const desperdicio = recurso.desperdicio_porcentaje || 0;
      const cantidadConDesperdicio = cantidad * (1 + desperdicio / 100);

      // Para MANO_OBRA, solo usar fórmula con cuadrilla si la unidad es "hh"
      const unidadMedidaLower = recurso.unidad_medida?.toLowerCase() || '';
      if (tipoRecurso === 'MANO_OBRA' && unidadMedidaLower === 'hh' && rendimiento > 0 && jornada > 0) {
        // Despejar precio desde parcial: Precio = Parcial / ((1 / Rendimiento) × Jornada × Cuadrilla)
        const cuadrillaValue = recurso.cuadrilla || 1;
        const divisor = (1 / rendimiento) * jornada * cuadrillaValue;
        if (divisor > 0) {
          return recurso.parcial / divisor;
        }
      } else if (tipoRecurso === 'MANO_OBRA') {
        // Para MANO_OBRA con otras unidades, usar cantidad directamente (sin desperdicio)
        if (cantidad > 0) {
          return recurso.parcial / cantidad;
        }
      } else if (cantidadConDesperdicio > 0) {
        return recurso.parcial / cantidadConDesperdicio;
      }
    }

    // PRIORIDAD 4: Usar precio que viene del backend (ya normalizado)
    return recurso.precio || 0;
  }, [preciosCompartidosMap]);

  // Convertir datos del APU a formato para la tabla con cálculo correcto de precios y parciales
  const datosAPUMeta = useMemo(() => {
    if (!apuData || !apuData.recursos || apuData.recursos.length === 0) {
      return [];
    }

    const rendimiento = apuData.rendimiento || 1.0;
    const jornada = apuData.jornada || 8;

    // Convertir recursos al formato esperado (convertir null a undefined)
    const recursosFormateados: any[] = apuData.recursos.map((r: any) => ({
      ...r,
      id_precio_recurso: r.id_precio_recurso ? r.id_precio_recurso : undefined,
    }));


    return apuData.recursos.map((recurso: any) => {
      const unidadMedidaLower = recurso.unidad_medida?.toLowerCase() || '';
      
      // Primero calcular suma de MO (dinámica para %mo)
    const sumaMO = calcularSumaParcialesManoObra(
      recursosFormateados as any,
      rendimiento,
      jornada,
      preciosCompartidosMap
    );

    // Para recursos con unidad "%mo", el precio es dinámico (suma de parciales de MO)
    let precio: number;
    if (unidadMedidaLower === '%mo') {
      // El precio de %mo es la suma de parciales de recursos de MO
      precio = Math.round(sumaMO * 100) / 100; // Redondear a 2 decimales
    } else {
      // Para otros recursos, usar lógica de prioridades estándar
      precio = calcularPrecioRecurso(recurso, rendimiento, jornada);
    }

      // Calcular parcial usando las mismas reglas que DetallePartidaPanel
      const parcial = calcularParcialRecurso(
        {
          ...recurso,
          precio,
        },
        rendimiento,
        jornada,
        preciosCompartidosMap,
        sumaMO
      );

      // Determinar si debe mostrar cuadrilla
      const debeMostrarCuadrilla = (recurso.tipo_recurso === 'MANO_OBRA' && unidadMedidaLower === 'hh') ||
        (recurso.tipo_recurso === 'EQUIPO' && unidadMedidaLower === 'hm');

      return {
        recurso_id: recurso.recurso_id || undefined,
        codigo: recurso.codigo_recurso || '-',
        descripcion: recurso.descripcion || '-',
        unidad: recurso.unidad_medida || '-',
        cantidad: recurso.cantidad || 0,
        precio: precio,
        parcial: parcial,
        cuadrilla: debeMostrarCuadrilla ? (recurso.cuadrilla || 0) : undefined,
        tipo_recurso: recurso.tipo_recurso,
      };
    });
  }, [apuData, preciosCompartidosMap, calcularPrecioRecurso]);

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
        totalComposicion: recurso.total_composicion || 0, // PRESUPUESTADO
        totalRQ: recurso.total_requerimiento || 0,
        totalRQBruto: recurso.total_requerimiento_bruto || 0,
        totalOCBienes: recurso.total_ordenes_compra_bienes || 0,
        totalOCBienesBruto: recurso.total_ordenes_compra_bienes_bruto || 0,
        totalOCServicios: recurso.total_ordenes_compra_servicios || 0,
        totalOCServiciosBruto: recurso.total_ordenes_compra_servicios_bruto || 0,
        totalRecepcion: recurso.total_recepcion_almacen || 0,
        totalRecepcionBruto: recurso.total_recepcion_almacen_bruto || 0,
        diferencia: recurso.diferencia_mayor_gasto || 0,
      };
    });
  }, [trazabilidadData, apuData]);

  // Identificar recursos que están en el APU para resaltarlos
  const recursosAPUSet = useMemo(() => {
    const set = new Set<string>();
    if (apuData?.recursos) {
      apuData.recursos.forEach((recurso: any) => {
        if (recurso.recurso_id) {
          set.add(recurso.recurso_id);
        }
        // También agregar por código por si acaso
        if (recurso.codigo_recurso) {
          set.add(recurso.codigo_recurso);
        }
      });
    }
    return set;
  }, [apuData]);

  const totalesCostoReal = useMemo(() => {
    return {
      totalComposicion: datosCostoReal.reduce((sum: number, item: any) => sum + (item.totalComposicion || 0), 0),
      totalRQ: datosCostoReal.reduce((sum: number, item: any) => sum + (item.totalRQ || 0), 0),
      totalRQBruto: datosCostoReal.reduce((sum: number, item: any) => sum + (item.totalRQBruto || 0), 0),
      totalOCBienes: datosCostoReal.reduce((sum: number, item: any) => sum + (item.totalOCBienes || 0), 0),
      totalOCBienesBruto: datosCostoReal.reduce((sum: number, item: any) => sum + (item.totalOCBienesBruto || 0), 0),
      totalOCServicios: datosCostoReal.reduce((sum: number, item: any) => sum + (item.totalOCServicios || 0), 0),
      totalOCServiciosBruto: datosCostoReal.reduce((sum: number, item: any) => sum + (item.totalOCServiciosBruto || 0), 0),
      totalRecepcion: datosCostoReal.reduce((sum: number, item: any) => sum + (item.totalRecepcion || 0), 0),
      totalRecepcionBruto: datosCostoReal.reduce((sum: number, item: any) => sum + (item.totalRecepcionBruto || 0), 0),
      diferencia: datosCostoReal.reduce((sum: number, item: any) => sum + (item.diferencia || 0), 0),
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

  // Calcular recursoAPUMeta para el modal
  const recursoAPUMetaCalculado = useMemo(() => {
    if (!recursoSeleccionado) return null;
    
    // Buscar el recurso en datosAPUMeta por código o recurso_id
    const recursoEnAPU = datosAPUMeta.find(
      (item: any) => 
        item.codigo === recursoSeleccionado.codigo ||
        (recursoSeleccionado.recurso_id && item.recurso_id === recursoSeleccionado.recurso_id)
    );
    
    if (recursoEnAPU) {
      return {
        cantidad: recursoEnAPU.cantidad || 0,
        precio: recursoEnAPU.precio || 0,
        parcial: recursoEnAPU.parcial || 0,
        unidad: recursoEnAPU.unidad || '',
      };
    }
    
    return null;
  }, [recursoSeleccionado, datosAPUMeta]);

  // Opciones de partidas para SelectSearch
  const opcionesPartidas = useMemo(() => {
    return partidasOrdenadas
      .filter(p => !p.id_partida_padre) // Solo partidas principales
      .map(partida => ({
        value: partida.id_partida,
        label: `${partida.numero_item || ''} - ${partida.descripcion || ''}`,
      }));
  }, [partidasOrdenadas]);

  // Función para encontrar el contenedor visible con scroll
  const findVisibleScrollContainer = useCallback(() => {
    const allScrollContainers = document.querySelectorAll('div.overflow-y-auto');
    
    for (const container of allScrollContainers) {
      const htmlContainer = container as HTMLElement;
      const rect = htmlContainer.getBoundingClientRect();
      const styles = window.getComputedStyle(htmlContainer);
      const hasTable = htmlContainer.querySelector('table') !== null;
      const isVisible = 
        styles.display !== 'none' && 
        styles.visibility !== 'hidden' && 
        rect.width > 0 && 
        rect.height > 0 &&
        htmlContainer.scrollHeight > 0 &&
        hasTable;
      
      if (isVisible) {
        return htmlContainer;
      }
    }
    
    if (tableRef.current) {
      const rect = tableRef.current.getBoundingClientRect();
      const styles = window.getComputedStyle(tableRef.current);
      const isVisible = 
        styles.display !== 'none' && 
        styles.visibility !== 'hidden' && 
        rect.width > 0 && 
        rect.height > 0 &&
        tableRef.current.scrollHeight > 0;
      
      if (isVisible) {
        return tableRef.current;
      }
    }
    
    return null;
  }, []);

  // Función para centrar una partida en el scroll del contenedor
  const scrollToPartida = useCallback((id_partida: string, retryCount = 0) => {
    const rowElement = partidaRefs.current.get(id_partida);
    const container = findVisibleScrollContainer();
    
    if (!rowElement || !container) {
      if (retryCount < 8) {
        setTimeout(() => scrollToPartida(id_partida, retryCount + 1), 200);
      }
      return;
    }

    const containerHeight = container.clientHeight;
    const containerScrollHeight = container.scrollHeight;
    
    if (containerHeight === 0 || containerScrollHeight === 0) {
      if (retryCount < 8) {
        setTimeout(() => scrollToPartida(id_partida, retryCount + 1), 200);
      }
      return;
    }

    // Método mejorado: calcular la posición absoluta de la fila dentro del contenedor
    const tbody = rowElement.closest('tbody');
    if (!tbody) return;
    
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    const rowIndex = allRows.indexOf(rowElement);
    
    if (rowIndex === -1) return;
    
    const thead = container.querySelector('thead');
    const theadHeight = thead ? (thead as HTMLElement).offsetHeight : 0;
    const scrollableContentHeight = container.scrollHeight - theadHeight;
    const rowPositionRatio = rowIndex / allRows.length;
    const estimatedRowPosition = theadHeight + (rowPositionRatio * scrollableContentHeight);
    
    const containerViewportHeight = container.clientHeight;
    const centerOffset = containerViewportHeight / 2;
    const targetScrollTop = estimatedRowPosition - centerOffset;
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const finalScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
    
    container.scrollTo({
      top: finalScrollTop,
      behavior: 'smooth'
    });
  }, []);

  // Función para manejar la selección de una partida desde el buscador
  const handleSeleccionarPartida = useCallback((id_partida: string | null) => {
    if (!id_partida) {
      setPartidaSeleccionada(null);
      return;
    }

    const partida = partidasOrdenadas.find(p => p.id_partida === id_partida);
    if (partida) {
      setPartidaSeleccionada(partida);
      
      // Asegurar que la partida no esté colapsada si tiene subpartidas
      const tieneSubpartidas = getSubpartidas(partida.id_partida).length > 0;
      if (tieneSubpartidas) {
        setPartidasColapsadas(prev => {
          const nuevo = new Set(prev);
          nuevo.delete(partida.id_partida);
          return nuevo;
        });
      }

      // Hacer scroll con delay para que el DOM se actualice completamente
      // Usar múltiples requestAnimationFrame y un delay más largo
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              scrollToPartida(partida.id_partida);
            }, tieneSubpartidas ? 500 : 400);
          });
        });
      });
    }
  }, [partidasOrdenadas, getSubpartidas, scrollToPartida]);

  // Efecto para hacer scroll cuando cambia la partida seleccionada (click directo)
  useEffect(() => {
    if (partidaSeleccionada) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              scrollToPartida(partidaSeleccionada.id_partida);
            }, 400);
          });
        });
      });
    }
  }, [partidaSeleccionada?.id_partida, scrollToPartida]);

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
    <div className="flex flex-col h-[calc(100vh-60px-48px)]">
      {/* Header */}
      <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-2 flex-shrink-0 mb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center p-1 rounded hover:bg-[var(--card-bg)]/60 transition-colors flex-shrink-0"
            title="Regresar"
          >
            <ArrowLeft className="h-4 w-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" />
          </button>
          <h1 className="text-xs font-semibold text-[var(--text-primary)]">
            <span className="hidden sm:inline">Gestión de Costos - Detalle completo de presupuesto, APU y costos reales</span>
            <span className="sm:hidden">Gestión de Costos</span>
          </h1>
        </div>
      </div>

      {/* Tabs solo en pantallas pequeñas (móviles) */}
      <div className="md:hidden mb-3 flex-shrink-0">
        <div className="bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] p-1 flex gap-1">
          <button
            onClick={() => setTabActivo('presupuesto')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
              tabActivo === 'presupuesto'
                ? 'bg-[var(--background)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            Presupuesto
          </button>
          <button
            onClick={() => setTabActivo('apu')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
              tabActivo === 'apu'
                ? 'bg-[var(--background)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            APU Meta
          </button>
          <button
            onClick={() => setTabActivo('costos')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
              tabActivo === 'costos'
                ? 'bg-[var(--background)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            Costos
          </button>
        </div>
      </div>

      {/* Layout de dos columnas en pantallas medianas (tablets) */}
      <div className="hidden md:grid md:grid-cols-2 lg:hidden gap-3 flex-1 min-h-0">
        {/* Columna izquierda: Presupuesto Meta */}
        <div className="flex flex-col min-h-0">
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="bg-[var(--card-bg)] px-3 py-2 border-b border-[var(--border-color)] flex-shrink-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h2 className="text-xs font-semibold text-[var(--text-primary)]">Presupuesto Meta</h2>
                <div className="flex-1 w-full sm:max-w-xs">
                  <SelectSearch
                    value={partidaSeleccionada?.id_partida || null}
                    onChange={handleSeleccionarPartida}
                    options={opcionesPartidas}
                    placeholder="Buscar partida..."
                    className="w-full text-xs h-7"
                    showSearchIcon={true}
                  />
                </div>
              </div>
            </div>
            <div ref={tableRef} className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
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
                  {itemsOrdenados.map((item, index) => {
                    if (item.tipo === 'titulo') {
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
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-3 h-3 flex-shrink-0" />
                              <span className={`text-xs font-medium truncate ${getColorPorNivel(titulo.id_titulo, 'TITULO')}`} title={titulo.descripcion}>
                                {titulo.descripcion}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    } else {
                      const partida = item.partida;
                      const estaColapsado = partidasColapsadas.has(partida.id_partida);
                      const tieneSubpartidas = getSubpartidas(partida.id_partida).length > 0;
                      // No mostrar subpartidas, solo partidas principales
                      if (partida.id_partida_padre) {
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
                          className={`bg-[var(--background)] transition-colors cursor-pointer hover:bg-[var(--hover-bg)] ${
                            partidaSeleccionada?.id_partida === partida.id_partida ? 'bg-blue-500/20 border-l-4 border-l-blue-500' : ''
                          }`}
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
                      {totalPresupuesto.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Columna derecha: APU Meta y Costo Real + Proyección apilados */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* APU Meta */}
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="bg-[var(--card-bg)] px-3 py-2 border-b border-[var(--border-color)] flex-shrink-0">
              <h2 className="text-xs font-semibold text-[var(--text-primary)] mb-1.5">APU Meta</h2>
              {partidaSeleccionada ? (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-[var(--text-secondary)] min-w-[45px] text-xs">Ítem:</span>
                      <Input
                        type="text"
                        value={partidaSeleccionada.numero_item || '-'}
                        disabled
                        className="h-6 text-xs px-2 font-mono"
                      />
                    </div>
                    {apuData && (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="text-[var(--text-secondary)] min-w-[60px] text-xs">Rend:</span>
                          <Input
                            type="text"
                            value={apuData.rendimiento ? apuData.rendimiento.toFixed(4) : '-'}
                            disabled
                            className="h-6 text-xs px-2"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[var(--text-secondary)] min-w-[50px] text-xs">Jorn:</span>
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
                  <div className="grid grid-cols-4 gap-x-2 gap-y-0.5 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-[var(--text-secondary)] min-w-[30px] text-xs">Und:</span>
                      <Input
                        type="text"
                        value={partidaSeleccionada.unidad_medida || '-'}
                        disabled
                        className="h-6 text-xs px-2"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[var(--text-secondary)] min-w-[45px] text-xs">Met:</span>
                      <Input
                        type="text"
                        value={partidaSeleccionada.metrado !== undefined && partidaSeleccionada.metrado !== null && !isNaN(partidaSeleccionada.metrado)
                          ? partidaSeleccionada.metrado.toFixed(2)
                          : '-'}
                        disabled
                        className="h-6 text-xs px-2"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[var(--text-secondary)] min-w-[50px] text-xs">P.U.:</span>
                      <Input
                        type="text"
                        value={partidaSeleccionada.precio_unitario !== undefined && partidaSeleccionada.precio_unitario !== null && !isNaN(partidaSeleccionada.precio_unitario)
                          ? `S/ ${partidaSeleccionada.precio_unitario.toFixed(2)}`
                          : '-'}
                        disabled
                        className="h-6 text-xs px-2"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[var(--text-secondary)] min-w-[40px] text-xs">Par:</span>
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
              <table className="w-full divide-y divide-[var(--border-color)] text-xs min-w-[450px]">
                <thead className="sticky top-0 bg-[var(--card-bg)] z-10 table-header-shadow">
                  <tr>
                    <th className="w-[70px] px-1.5 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-[10px]">
                      Código
                    </th>
                    <th className="w-auto px-1.5 py-1 text-left font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-[10px]">
                      Descripción
                    </th>
                    <th className="w-[40px] px-1.5 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-[10px]">
                      Und
                    </th>
                    <th className="w-[60px] px-1.5 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-[10px]">
                      Cuad.
                    </th>
                    <th className="w-[70px] px-1.5 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-[10px]">
                      Cant.
                    </th>
                    <th className="w-[60px] px-1.5 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-[10px]">
                      Precio
                    </th>
                    <th className="w-[70px] px-1.5 py-1 text-right font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">
                      Parcial
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--background)] divide-y divide-[var(--border-color)]">
                  {isLoadingApu ? (
                    <tr>
                      <td colSpan={7} className="px-1.5 py-4 text-center text-xs text-[var(--text-secondary)]">
                        <LoadingSpinner size={20} showText={false} />
                        <span className="ml-2">Cargando APU...</span>
                      </td>
                    </tr>
                  ) : datosAPUMeta.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-1.5 py-4 text-center text-xs text-[var(--text-secondary)]">
                        {partidaSeleccionada 
                          ? 'Esta partida no tiene APU asociado'
                          : 'Seleccione una partida para ver su APU'}
                      </td>
                    </tr>
                  ) : (
                    datosAPUMeta.map((item, index) => (
                      <tr key={index} className="hover:bg-[var(--hover-bg)] transition-colors">
                        <td className="px-1.5 py-1 text-center border-r border-[var(--border-color)] text-xs">
                          <span className="text-xs font-mono text-[var(--text-secondary)]">{item.codigo}</span>
                        </td>
                        <td className="px-1.5 py-1 border-r border-[var(--border-color)] text-xs truncate" title={item.descripcion}>
                          <span className="text-[var(--text-primary)]">{item.descripcion}</span>
                        </td>
                        <td className="px-1.5 py-1 text-center border-r border-[var(--border-color)] text-xs">
                          <span className="text-xs text-[var(--text-secondary)]">{item.unidad}</span>
                        </td>
                        <td className="px-1.5 py-1 text-center border-r border-[var(--border-color)] text-xs">
                          <span className="text-xs text-[var(--text-secondary)]">{item.cuadrilla !== undefined ? item.cuadrilla.toFixed(4) : ''}</span>
                        </td>
                        <td className="px-1.5 py-1 text-center border-r border-[var(--border-color)] text-xs">
                          <span className="text-xs text-[var(--text-secondary)]">
                            {item.cantidad.toFixed(2)}
                            {(item.unidad === '%mo' || item.unidad?.toLowerCase() === '%mo') && (
                              <span className="text-xs text-[var(--text-secondary)] ml-0.5">%</span>
                            )}
                          </span>
                        </td>
                        <td className="px-1.5 py-1 text-center border-r border-[var(--border-color)] text-xs">
                          <span className="text-xs text-[var(--text-secondary)]">{item.precio.toFixed(2)}</span>
                        </td>
                        <td className="px-1.5 py-1 text-right text-xs">
                          <span className="text-xs text-[var(--text-secondary)]">{item.parcial.toFixed(2)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {datosAPUMeta.length > 0 && (
              <div className="bg-[var(--card-bg)] border-t border-[var(--border-color)] flex-shrink-0 overflow-x-auto">
                <table className="w-full text-xs min-w-[450px]">
                  <tfoot>
                    <tr>
                      <td className="w-[70px]"></td>
                      <td className="w-auto"></td>
                      <td className="w-[40px]"></td>
                      <td className="w-[60px]"></td>
                      <td className="w-[70px]"></td>
                      <td className="w-[60px] px-1.5 py-1.5 text-right font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)] text-xs">
                        Total:
                      </td>
                      <td className="w-[70px] px-1.5 py-1.5 text-right font-semibold text-[var(--text-primary)] text-xs">
                        {totalAPU.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Costo Real + Proyección */}
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="bg-blue-500/10 px-2 py-1 border-b border-[var(--border-color)] flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-[11px] font-semibold text-[var(--text-primary)] leading-tight">Costo Real + Proyección</h2>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-tight">Análisis de ejecución vs presupuestado</p>
                  <p className="text-[9px] text-[var(--text-secondary)] opacity-75 leading-tight mt-0.5">
                    <span className="font-medium">Neto:</span> Pendiente/comprometido (no recibido) | 
                    <span className="font-medium"> Bruto:</span> Total comprometido | 
                    <span className="font-medium"> Recep.:</span> Real (recibido en almacén)
                  </p>
                </div>
                <IconButton
                  icon={Maximize2}
                  variant="blue"
                  size="sm"
                  label="Detalle completo"
                  title="Ver análisis detallado de toda la partida"
                  onClick={() => {
                    // Abrir modal con vista de partida completa
                    if (datosCostoReal.length > 0) {
                      setRecursoSeleccionado(datosCostoReal[0]); // Seleccionar cualquier recurso para activar el modal
                      setAbrirVistaPartida(true); // Indicar que debe abrir la vista de partida
                    }
                  }}
                />
              </div>
            </div>
            <div className="overflow-y-auto overflow-x-auto flex-1 min-h-0">
              <div className="min-w-0">
                <table className="w-auto text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-[var(--card-bg)] z-10 table-header-shadow">
                    <tr>
                      <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                        Código
                      </th>
                      <th className="px-0.5 py-1 text-left font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] !max-w-[50px]">
                        Descripción
                      </th>
                      <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap" title="Presupuesto planificado desde el APU de la partida">
                        Presup.
                      </th>
                      <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap" title="Requerimientos: Neto = Pendiente (aprobado - OC - transferencias), Bruto = Total aprobado">
                        <div className="flex flex-col leading-tight">
                          <span>RQ</span>
                          <span className="text-[9px] font-normal opacity-75">Neto / Bruto</span>
                        </div>
                      </th>
                      <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap" title="OC Bienes: Neto = Pendiente de recepción, Bruto = Total en OC">
                        <div className="flex flex-col leading-tight">
                          <span>OC B</span>
                          <span className="text-[9px] font-normal opacity-75">Neto / Bruto</span>
                        </div>
                      </th>
                      <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap" title="OC Servicios: Comprometido (sin recepción física)">
                        <div className="flex flex-col leading-tight">
                          <span>OC S</span>
                          <span className="text-[9px] font-normal opacity-75">Neto / Bruto</span>
                        </div>
                      </th>
                      <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap" title="Recepción: Real recibido físicamente en almacén (Neto = Bruto)">
                        <div className="flex flex-col leading-tight">
                          <span>Recep.</span>
                          <span className="text-[9px] font-normal opacity-75">Real</span>
                        </div>
                      </th>
                      <th className="px-0.5 py-1 text-right font-semibold text-[var(--text-secondary)] text-[11px] whitespace-nowrap" title="Diferencia: Presupuesto - (RQ Neto + OC Bienes Neto + OC Servicios + Recepción). Positivo = Ahorro, Negativo = Sobrecosto">
                        Dif.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--background)]">
                    {isLoadingTrazabilidad ? (
                      <tr>
                        <td colSpan={8} className="px-0.5 py-1 text-center text-[11px] text-[var(--text-secondary)]">
                          <LoadingSpinner size={14} showText={false} />
                          <span className="ml-1">Cargando...</span>
                        </td>
                      </tr>
                    ) : datosCostoReal.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-0.5 py-1 text-center text-[11px] text-[var(--text-secondary)]">
                          {partidaSeleccionada 
                            ? 'Sin datos de trazabilidad'
                            : 'Seleccione una partida'}
                        </td>
                      </tr>
                    ) : (
                      datosCostoReal.map((item: any, index: number) => {
                        const esRecursoAPU = recursosAPUSet.has(item.recurso_id) || recursosAPUSet.has(item.codigo);
                        return (
                      <tr 
                        key={index} 
                        className={`bg-[var(--background)] cursor-pointer hover:bg-[var(--hover-bg)] ${
                          esRecursoAPU 
                            ? 'bg-blue-500/20 border-l-2 border-l-blue-500' 
                            : ''
                        }`}
                        onClick={() => {
                          setRecursoSeleccionado({
                            recurso_id: item.recurso_id,
                            codigo: item.codigo,
                            descripcion: item.descripcion,
                            totalComposicion: item.totalComposicion,
                            totalRQ: item.totalRQ,
                            totalRQBruto: item.totalRQBruto,
                            totalOCBienes: item.totalOCBienes,
                            totalOCBienesBruto: item.totalOCBienesBruto,
                            totalOCServicios: item.totalOCServicios,
                            totalOCServiciosBruto: item.totalOCServiciosBruto,
                            totalRecepcion: item.totalRecepcion,
                            totalRecepcionBruto: item.totalRecepcionBruto,
                            diferencia: item.diferencia,
                          });
                        }}
                      >
                        <td className={`px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] font-mono whitespace-nowrap ${esRecursoAPU ? 'font-semibold' : ''}`}>
                          {item.codigo}
                        </td>
                        <td className={`px-0.5 py-1 border-r border-[var(--border-color)] text-[11px] !max-w-[50px] ${esRecursoAPU ? 'font-semibold' : ''}`} title={item.descripcion}>
                          <span className="text-[var(--text-primary)] line-clamp-2 leading-tight">{item.descripcion}</span>
                        </td>
                        <td className="px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                          {(item.totalComposicion || 0).toFixed(2)}
                        </td>
                        <td className="px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                          <div className="flex flex-col leading-tight gap-0.5">
                            <span className="text-[11px] text-[var(--text-primary)] font-medium">{(item.totalRQ || 0).toFixed(2)}</span>
                            <span className="text-[10px] text-[var(--text-secondary)] opacity-75">{(item.totalRQBruto || 0).toFixed(2)}</span>
                          </div>
                        </td>
                        <td className="px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                          <div className="flex flex-col leading-tight gap-0.5">
                            <span className="text-[11px] text-[var(--text-primary)] font-medium">{(item.totalOCBienes || 0).toFixed(2)}</span>
                            <span className="text-[10px] text-[var(--text-secondary)] opacity-75">{(item.totalOCBienesBruto || 0).toFixed(2)}</span>
                          </div>
                        </td>
                        <td className="px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                          <div className="flex flex-col leading-tight gap-0.5">
                            <span className="text-[11px] text-[var(--text-primary)] font-medium">{(item.totalOCServicios || 0).toFixed(2)}</span>
                            <span className="text-[10px] text-[var(--text-secondary)] opacity-75">{(item.totalOCServiciosBruto || 0).toFixed(2)}</span>
                          </div>
                        </td>
                        <td className="px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                          <div className="flex flex-col leading-tight gap-0.5">
                            <span className="text-[11px] text-[var(--text-primary)] font-medium">{(item.totalRecepcion || 0).toFixed(2)}</span>
                            <span className="text-[10px] text-[var(--text-secondary)] opacity-75">{(item.totalRecepcionBruto || 0).toFixed(2)}</span>
                          </div>
                        </td>
                        <td className={`px-0.5 py-1 text-right text-[11px] whitespace-nowrap ${item.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.diferencia >= 0 ? '+' : ''}{item.diferencia.toFixed(2)}
                        </td>
                      </tr>
                      );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-[var(--card-bg)] border-t border-[var(--border-color)] flex-shrink-0 overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <tfoot>
                  <tr>
                    <td className="w-[80px]"></td>
                    <td className="w-auto px-0.5 py-1 text-right font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)] text-[11px]">
                      Totales:
                    </td>
                    <td className="w-[80px] px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                      {totalesCostoReal.totalComposicion.toFixed(2)}
                    </td>
                    <td className="w-[80px] px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                      <div className="flex flex-col leading-tight gap-0.5">
                        <span>{totalesCostoReal.totalRQ.toFixed(2)}</span>
                        <span className="text-[11px]">{totalesCostoReal.totalRQBruto.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="w-[80px] px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                      <div className="flex flex-col leading-tight gap-0.5">
                        <span>{totalesCostoReal.totalOCBienes.toFixed(2)}</span>
                        <span className="text-[11px]">{totalesCostoReal.totalOCBienesBruto.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="w-[80px] px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                      <div className="flex flex-col leading-tight gap-0.5">
                        <span>{totalesCostoReal.totalOCServicios.toFixed(2)}</span>
                        <span className="text-[11px]">{totalesCostoReal.totalOCServiciosBruto.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="w-[80px] px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                      <div className="flex flex-col leading-tight gap-0.5">
                        <span>{totalesCostoReal.totalRecepcion.toFixed(2)}</span>
                        <span className="text-[11px]">{totalesCostoReal.totalRecepcionBruto.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="w-[80px] px-0.5 py-1 text-right font-semibold text-[11px] whitespace-nowrap">
                      <span className={totalesCostoReal.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {totalesCostoReal.diferencia >= 0 ? '+' : ''}{totalesCostoReal.diferencia.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Layout de dos columnas en pantallas grandes (lg) */}
      <div className="hidden lg:grid lg:grid-cols-20 gap-3 flex-1 min-h-0">
        {/* Columna izquierda: Presupuesto Meta (55%) */}
        <div className="lg:col-span-11 flex flex-col min-h-0">
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="bg-[var(--card-bg)] px-3 py-2 border-b border-[var(--border-color)] flex-shrink-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h2 className="text-xs font-semibold text-[var(--text-primary)]">Presupuesto Meta</h2>
                <div className="flex-1 w-full sm:max-w-xs">
                  <SelectSearch
                    value={partidaSeleccionada?.id_partida || null}
                    onChange={handleSeleccionarPartida}
                    options={opcionesPartidas}
                    placeholder="Buscar partida..."
                    className="w-full text-xs h-7"
                    showSearchIcon={true}
                  />
                </div>
              </div>
            </div>
            <div ref={tableRef} className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
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
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-3 h-3 flex-shrink-0" />
                              <span className={`text-xs font-medium truncate ${getColorPorNivel(titulo.id_titulo, 'TITULO')}`} title={titulo.descripcion}>
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
                      // No mostrar subpartidas, solo partidas principales
                      if (partida.id_partida_padre) {
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
                          className={`bg-[var(--background)] transition-colors cursor-pointer hover:bg-[var(--hover-bg)] ${
                            partidaSeleccionada?.id_partida === partida.id_partida ? 'bg-blue-500/20 border-l-4 border-l-blue-500' : ''
                          }`}
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
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>
            {/* Footer fijo */}
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
                      {totalPresupuesto.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Columna derecha: APU Meta y Costo Real + Proyección (45%) */}
        <div className="lg:col-span-9 flex flex-col gap-3 min-h-0">
          {/* Contenedor APU Meta */}
          <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="bg-[var(--card-bg)] px-3 py-2 border-b border-[var(--border-color)] flex-shrink-0">
              {/* Fila 1: Título */}
              <h2 className="text-xs font-semibold text-[var(--text-primary)] mb-1.5">APU Meta</h2>
              
              {partidaSeleccionada ? (
                <div className="space-y-1.5">
                  {/* Fila 2: Ítem, Rendimiento, Jornada */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-0.5 text-xs">
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-0.5 text-xs">
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
              <table className="w-full divide-y divide-[var(--border-color)] text-xs min-w-[500px] lg:table-fixed">
                <thead className="sticky top-0 bg-[var(--card-bg)] z-10 table-header-shadow">
                  <tr>
                    <th className="w-[70px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-xs">
                      Código
                    </th>
                    <th className="w-auto px-2 py-1 text-left font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-xs">
                      Descripción
                    </th>
                    <th className="w-[50px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-xs">
                      Und
                    </th>
                    <th className="w-[70px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-xs">
                      Cuad.
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
                      <td colSpan={7} className="px-2 py-4 text-center text-xs text-[var(--text-secondary)]">
                        <LoadingSpinner size={20} showText={false} />
                        <span className="ml-2">Cargando APU...</span>
                      </td>
                    </tr>
                  ) : datosAPUMeta.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-2 py-4 text-center text-xs text-[var(--text-secondary)]">
                        {partidaSeleccionada 
                          ? 'Esta partida no tiene APU asociado'
                          : 'Seleccione una partida para ver su APU'}
                      </td>
                    </tr>
                  ) : (
                    datosAPUMeta.map((item, index) => (
                      <tr key={index} className="hover:bg-[var(--hover-bg)] transition-colors">
                        <td className="px-2 py-1 text-center border-r border-[var(--border-color)] text-xs">
                          <span className="text-xs font-mono text-[var(--text-secondary)]">{item.codigo}</span>
                        </td>
                        <td className="px-2 py-1 border-r border-[var(--border-color)] text-xs truncate" title={item.descripcion}>
                          <span className="text-[var(--text-primary)]">{item.descripcion}</span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-[var(--border-color)] text-xs">
                          <span className="text-xs text-[var(--text-secondary)]">{item.unidad}</span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-[var(--border-color)] text-xs">
                          <span className="text-xs text-[var(--text-secondary)]">{item.cuadrilla !== undefined ? item.cuadrilla.toFixed(4) : ''}</span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-[var(--border-color)] text-xs">
                          <span className="text-xs text-[var(--text-secondary)]">
                            {item.cantidad.toFixed(2)}
                            {(item.unidad === '%mo' || item.unidad?.toLowerCase() === '%mo') && (
                              <span className="text-xs text-[var(--text-secondary)] ml-0.5">%</span>
                            )}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-[var(--border-color)] text-xs">
                          <span className="text-xs text-[var(--text-secondary)]">{item.precio.toFixed(2)}</span>
                        </td>
                        <td className="px-2 py-1 text-right text-xs">
                          <span className="text-xs text-[var(--text-secondary)]">{item.parcial.toFixed(2)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Footer fijo */}
            {datosAPUMeta.length > 0 && (
              <div className="bg-[var(--card-bg)] border-t border-[var(--border-color)] flex-shrink-0 overflow-x-auto">
                <table className="w-full text-xs min-w-[500px] lg:table-fixed">
                  <tfoot>
                    <tr>
                      <td className="w-[80px]"></td>
                      <td className="w-auto"></td>
                      <td className="w-[50px]"></td>
                      <td className="w-[70px]"></td>
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
            <div className="bg-blue-500/10 px-2 py-1 border-b border-[var(--border-color)] flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-[11px] font-semibold text-[var(--text-primary)] leading-tight">Costo Real + Proyección</h2>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-tight">Análisis de ejecución vs presupuestado</p>
                  <p className="text-[9px] text-[var(--text-secondary)] opacity-75 leading-tight mt-0.5">
                    <span className="font-medium">Neto:</span> Pendiente/comprometido (no recibido) | 
                    <span className="font-medium"> Bruto:</span> Total comprometido | 
                    <span className="font-medium"> Recep.:</span> Real (recibido en almacén)
                  </p>
                </div>
                <IconButton
                  icon={Maximize2}
                  variant="blue"
                  size="sm"
                  label="Detalle completo"
                  title="Ver análisis detallado de toda la partida"
                  onClick={() => {
                    // Abrir modal con vista de partida completa
                    if (datosCostoReal.length > 0) {
                      setRecursoSeleccionado(datosCostoReal[0]); // Seleccionar cualquier recurso para activar el modal
                      setAbrirVistaPartida(true); // Indicar que debe abrir la vista de partida
                    }
                  }}
                />
              </div>
            </div>
            <div className="overflow-y-auto overflow-x-auto flex-1 min-h-0">
              <div className="min-w-0">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-[var(--card-bg)] z-10 table-header-shadow">
                    <tr>
                      <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                        Código
                      </th>
                      <th className="px-0.5 py-1 text-left font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] !max-w-[50px]">
                        Descripción
                      </th>
                      <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap" title="Presupuesto planificado desde el APU de la partida">
                        Presup.
                      </th>
                      <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap" title="Requerimientos: Neto = Pendiente (aprobado - OC - transferencias), Bruto = Total aprobado">
                        <div className="flex flex-col leading-tight">
                          <span>Requeremientos</span>
                          <span className="text-[9px] font-normal opacity-75">Neto / Bruto</span>
                        </div>
                      </th>
                      <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap" title="OC Bienes: Neto = Pendiente de recepción, Bruto = Total en OC">
                        <div className="flex flex-col leading-tight">
                          <span>OC Bienes</span>
                          <span className="text-[9px] font-normal opacity-75">Neto / Bruto</span>
                        </div>
                      </th>
                      <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap" title="OC Servicios: Comprometido (sin recepción física)">
                        <div className="flex flex-col leading-tight">
                          <span>OC Servicios</span>
                          <span className="text-[9px] font-normal opacity-75">Neto / Bruto</span>
                        </div>
                      </th>
                      <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap" title="Recepción: Real recibido físicamente en almacén (Neto = Bruto)">
                        <div className="flex flex-col leading-tight">
                          <span>Recep.</span>
                          <span className="text-[9px] font-normal opacity-75">Real</span>
                        </div>
                      </th>
                      <th className="px-0.5 py-1 text-right font-semibold text-[var(--text-secondary)] text-[11px] whitespace-nowrap" title="Diferencia: Presupuesto - (RQ Neto + OC Bienes Neto + OC Servicios + Recepción). Positivo = Ahorro, Negativo = Sobrecosto">
                        Dif.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--background)]">
                    {isLoadingTrazabilidad ? (
                      <tr>
                        <td colSpan={8} className="px-0.5 py-1 text-center text-[11px] text-[var(--text-secondary)]">
                          <LoadingSpinner size={14} showText={false} />
                          <span className="ml-1">Cargando...</span>
                        </td>
                      </tr>
                    ) : datosCostoReal.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-0.5 py-1 text-center text-[11px] text-[var(--text-secondary)]">
                          {partidaSeleccionada 
                            ? 'Sin datos de trazabilidad'
                            : 'Seleccione una partida'}
                        </td>
                      </tr>
                    ) : (
                      datosCostoReal.map((item: any, index: number) => {
                        const esRecursoAPU = recursosAPUSet.has(item.recurso_id) || recursosAPUSet.has(item.codigo);
                        return (
                      <tr 
                        key={index} 
                        className={`cursor-pointer ${
                          esRecursoAPU 
                            ? 'bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 border-l-2 border-l-blue-600' 
                            : 'hover:bg-[var(--hover-bg)]'
                        }`}
                        onClick={() => {
                          setRecursoSeleccionado({
                            recurso_id: item.recurso_id,
                            codigo: item.codigo,
                            descripcion: item.descripcion,
                            totalComposicion: item.totalComposicion,
                            totalRQ: item.totalRQ,
                            totalRQBruto: item.totalRQBruto,
                            totalOCBienes: item.totalOCBienes,
                            totalOCBienesBruto: item.totalOCBienesBruto,
                            totalOCServicios: item.totalOCServicios,
                            totalOCServiciosBruto: item.totalOCServiciosBruto,
                            totalRecepcion: item.totalRecepcion,
                            totalRecepcionBruto: item.totalRecepcionBruto,
                            diferencia: item.diferencia,
                          });
                        }}
                      >
                        <td className={`px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] font-mono whitespace-nowrap ${esRecursoAPU ? 'font-semibold' : ''}`}>
                          {item.codigo}
                        </td>
                        <td className={`px-0.5 py-1 border-r border-[var(--border-color)] text-[11px] !max-w-[50px] ${esRecursoAPU ? 'font-semibold' : ''}`} title={item.descripcion}>
                          <span className="text-[var(--text-primary)] line-clamp-2 leading-tight">{item.descripcion}</span>
                        </td>
                        <td className="px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                          {(item.totalComposicion || 0).toFixed(2)}
                        </td>
                        <td className="px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                          <div className="flex flex-col leading-tight gap-0.5">
                            <span className="text-[11px] text-[var(--text-primary)] font-medium">{(item.totalRQ || 0).toFixed(2)}</span>
                            <span className="text-[10px] text-[var(--text-secondary)] opacity-75">{(item.totalRQBruto || 0).toFixed(2)}</span>
                          </div>
                        </td>
                        <td className="px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                          <div className="flex flex-col leading-tight gap-0.5">
                            <span className="text-[11px] text-[var(--text-primary)] font-medium">{(item.totalOCBienes || 0).toFixed(2)}</span>
                            <span className="text-[10px] text-[var(--text-secondary)] opacity-75">{(item.totalOCBienesBruto || 0).toFixed(2)}</span>
                          </div>
                        </td>
                        <td className="px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                          <div className="flex flex-col leading-tight gap-0.5">
                            <span className="text-[11px] text-[var(--text-primary)] font-medium">{(item.totalOCServicios || 0).toFixed(2)}</span>
                            <span className="text-[10px] text-[var(--text-secondary)] opacity-75">{(item.totalOCServiciosBruto || 0).toFixed(2)}</span>
                          </div>
                        </td>
                        <td className="px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                          <div className="flex flex-col leading-tight gap-0.5">
                            <span className="text-[11px] text-[var(--text-primary)] font-medium">{(item.totalRecepcion || 0).toFixed(2)}</span>
                            <span className="text-[10px] text-[var(--text-secondary)] opacity-75">{(item.totalRecepcionBruto || 0).toFixed(2)}</span>
                          </div>
                        </td>
                        <td className={`px-0.5 py-1 text-right text-[11px] whitespace-nowrap ${(item.diferencia || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(item.diferencia || 0) >= 0 ? '+' : ''}{((item.diferencia || 0)).toFixed(2)}
                        </td>
                      </tr>
                      );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-[var(--card-bg)] border-t border-[var(--border-color)] flex-shrink-0 overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <tfoot>
                  <tr>
                    <td className="w-[80px]"></td>
                    <td className="w-auto px-0.5 py-1 text-right font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)] text-[11px]">
                      Totales:
                    </td>
                    <td className="w-[80px] px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                      {totalesCostoReal.totalComposicion.toFixed(2)}
                    </td>
                    <td className="w-[80px] px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                      <div className="flex flex-col leading-tight gap-0.5">
                        <span>{totalesCostoReal.totalRQ.toFixed(2)}</span>
                        <span className="text-[11px]">{totalesCostoReal.totalRQBruto.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="w-[80px] px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                      <div className="flex flex-col leading-tight gap-0.5">
                        <span>{totalesCostoReal.totalOCBienes.toFixed(2)}</span>
                        <span className="text-[11px]">{totalesCostoReal.totalOCBienesBruto.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="w-[80px] px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                      <div className="flex flex-col leading-tight gap-0.5">
                        <span>{totalesCostoReal.totalOCServicios.toFixed(2)}</span>
                        <span className="text-[11px]">{totalesCostoReal.totalOCServiciosBruto.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="w-[80px] px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                      <div className="flex flex-col leading-tight gap-0.5">
                        <span>{totalesCostoReal.totalRecepcion.toFixed(2)}</span>
                        <span className="text-[11px]">{totalesCostoReal.totalRecepcionBruto.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="w-[80px] px-0.5 py-1 text-right font-semibold text-[11px] whitespace-nowrap">
                      <span className={totalesCostoReal.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {totalesCostoReal.diferencia >= 0 ? '+' : ''}{totalesCostoReal.diferencia.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido por tabs en pantallas pequeñas (móviles) */}
      <div className="md:hidden flex-1 min-h-0">
        {/* Presupuesto Meta */}
        {tabActivo === 'presupuesto' && (
          <div className="h-full flex flex-col min-h-0">
            <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow overflow-hidden flex flex-col flex-1 min-h-0">
              <div className="bg-[var(--card-bg)] px-3 py-2 border-b border-[var(--border-color)] flex-shrink-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <h2 className="text-xs font-semibold text-[var(--text-primary)]">Presupuesto Meta</h2>
                  <div className="flex-1 w-full sm:max-w-xs">
                    <SelectSearch
                      value={partidaSeleccionada?.id_partida || null}
                      onChange={handleSeleccionarPartida}
                      options={opcionesPartidas}
                      placeholder="Buscar partida..."
                      className="w-full text-xs h-7"
                    />
                  </div>
                </div>
              </div>
              <div ref={tableRef} className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
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
                    {itemsOrdenados.map((item, index) => {
                      if (item.tipo === 'titulo') {
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
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-3 h-3 flex-shrink-0" />
                              <span className={`text-xs font-medium truncate ${getColorPorNivel(titulo.id_titulo, 'TITULO')}`} title={titulo.descripcion}>
                                {titulo.descripcion}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    } else {
                      const partida = item.partida;
                      const estaColapsado = partidasColapsadas.has(partida.id_partida);
                        const tieneSubpartidas = getSubpartidas(partida.id_partida).length > 0;
                        // No mostrar subpartidas, solo partidas principales
                        if (partida.id_partida_padre) {
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
                            className={`bg-[var(--background)] transition-colors cursor-pointer hover:bg-[var(--hover-bg)] ${
                              partidaSeleccionada?.id_partida === partida.id_partida ? 'bg-blue-500/20 border-l-4 border-l-blue-500' : ''
                            }`}
                          >
                            <td className="px-2 py-1 text-right border-r border-[var(--border-color)] whitespace-nowrap">
                              <span className="text-xs font-mono text-[var(--text-secondary)]">{calcularNumeroItem(partida)}</span>
                            </td>
                            <td className="px-2 py-1 border-r border-[var(--border-color)]">
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
                                <span className="text-[var(--text-primary)] truncate" title={partida.descripcion}>
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
                        {totalPresupuesto.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* APU Meta */}
        {tabActivo === 'apu' && (
          <div className="h-full flex flex-col min-h-0">
            <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow overflow-hidden flex flex-col flex-1 min-h-0">
              <div className="bg-[var(--card-bg)] px-3 py-2 border-b border-[var(--border-color)] flex-shrink-0">
                <h2 className="text-xs font-semibold text-[var(--text-primary)] mb-1.5">APU Meta</h2>
                {partidaSeleccionada ? (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-0.5 text-xs">
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-0.5 text-xs">
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
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">Seleccione una partida desde "Presupuesto" para ver su APU</p>
                )}
              </div>
              <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
                <table className="w-full divide-y divide-[var(--border-color)] text-xs min-w-[500px]">
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
                      <th className="w-[70px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)] text-xs">
                        Cuadrilla
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
                        <td colSpan={7} className="px-2 py-4 text-center text-xs text-[var(--text-secondary)]">
                          <LoadingSpinner size={20} showText={false} />
                          <span className="ml-2">Cargando APU...</span>
                        </td>
                      </tr>
                    ) : datosAPUMeta.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-2 py-4 text-center text-xs text-[var(--text-secondary)]">
                          {partidaSeleccionada 
                            ? 'Esta partida no tiene APU asociado'
                            : 'Seleccione una partida desde "Presupuesto" para ver su APU'}
                        </td>
                      </tr>
                    ) : (
                      datosAPUMeta.map((item, index) => (
                        <tr key={index} className="hover:bg-[var(--hover-bg)] transition-colors">
                          <td className="px-2 py-1 text-center border-r border-[var(--border-color)] text-xs">
                            <span className="text-xs font-mono text-[var(--text-secondary)]">{item.codigo}</span>
                          </td>
                          <td className="px-2 py-1 border-r border-[var(--border-color)] text-xs truncate" title={item.descripcion}>
                            <span className="text-[var(--text-primary)]">{item.descripcion}</span>
                          </td>
                          <td className="px-2 py-1 text-center border-r border-[var(--border-color)] text-xs">
                            <span className="text-xs text-[var(--text-secondary)]">{item.unidad}</span>
                          </td>
                          <td className="px-2 py-1 text-center border-r border-[var(--border-color)] text-xs">
                            <span className="text-xs text-[var(--text-secondary)]">{item.cuadrilla !== undefined ? item.cuadrilla.toFixed(4) : ''}</span>
                          </td>
                          <td className="px-2 py-1 text-center border-r border-[var(--border-color)] text-xs">
                            <span className="text-xs text-[var(--text-secondary)]">{item.cantidad.toFixed(2)}</span>
                          </td>
                          <td className="px-2 py-1 text-center border-r border-[var(--border-color)] text-xs">
                            <span className="text-xs text-[var(--text-secondary)]">{item.precio.toFixed(2)}</span>
                          </td>
                          <td className="px-2 py-1 text-right text-xs">
                            <span className="text-xs text-[var(--text-secondary)]">{item.parcial.toFixed(2)}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {datosAPUMeta.length > 0 && (
                <div className="bg-[var(--card-bg)] border-t border-[var(--border-color)] flex-shrink-0 overflow-x-auto">
                  <table className="w-full text-xs min-w-[500px]">
                    <tfoot>
                      <tr>
                        <td className="w-[80px]"></td>
                        <td className="w-auto"></td>
                        <td className="w-[50px]"></td>
                        <td className="w-auto"></td>
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
          </div>
        )}

        {/* Costo Real + Proyección */}
        {tabActivo === 'costos' && (
          <div className="h-full flex flex-col min-h-0">
            <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow overflow-hidden flex flex-col flex-1 min-h-0">
              <div className="bg-blue-500/10 px-2 py-1 border-b border-[var(--border-color)] flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h2 className="text-[11px] font-semibold text-[var(--text-primary)] leading-tight">Costo Real + Proyección</h2>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-tight">Análisis de ejecución vs presupuestado</p>
                  </div>
                  <IconButton
                    icon={Maximize2}
                    variant="blue"
                    size="sm"
                    label="Detalle completo"
                    title="Ver análisis detallado de toda la partida"
                    onClick={() => {
                      // Abrir modal con vista de partida completa
                      if (datosCostoReal.length > 0) {
                        setRecursoSeleccionado(datosCostoReal[0]); // Seleccionar cualquier recurso para activar el modal
                        setAbrirVistaPartida(true); // Indicar que debe abrir la vista de partida
                      }
                    }}
                  />
                </div>
              </div>
              <div className="overflow-y-auto overflow-x-auto flex-1 min-h-0">
                <div className="min-w-0">
                  <table className="w-auto text-[11px] border-collapse">
                    <thead className="sticky top-0 bg-[var(--card-bg)] z-10 table-header-shadow">
                      <tr>
                        <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                          Código
                        </th>
                        <th className="px-0.5 py-1 text-left font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] !max-w-[50px]">
                          Descripción
                        </th>
                        <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap" title="Presupuesto planificado desde el APU de la partida">
                          Presup.
                        </th>
                        <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap" title="Requerimientos: Neto = Pendiente (aprobado - OC - transferencias), Bruto = Total aprobado">
                          <div className="flex flex-col leading-tight">
                            <span>Requeremientos</span>
                            <span className="text-[9px] font-normal opacity-75">Neto / Bruto</span>
                          </div>
                        </th>
                        <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap" title="OC Bienes: Neto = Pendiente de recepción, Bruto = Total en OC">
                          <div className="flex flex-col leading-tight">
                            <span>OC Bienes</span>
                            <span className="text-[9px] font-normal opacity-75">Neto / Bruto</span>
                          </div>
                        </th>
                        <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap" title="OC Servicios: Comprometido (sin recepción física)">
                          <div className="flex flex-col leading-tight">
                            <span>OC Servicios</span>
                            <span className="text-[9px] font-normal opacity-75">Neto / Bruto</span>
                          </div>
                        </th>
                        <th className="px-0.5 py-1 text-center font-semibold text-[var(--text-secondary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap" title="Recepción: Real recibido físicamente en almacén (Neto = Bruto)">
                          <div className="flex flex-col leading-tight">
                            <span>Recep.</span>
                            <span className="text-[9px] font-normal opacity-75">Real</span>
                          </div>
                        </th>
                        <th className="px-0.5 py-1 text-right font-semibold text-[var(--text-secondary)] text-[11px] whitespace-nowrap" title="Diferencia: Presupuesto - (RQ Neto + OC Bienes Neto + OC Servicios + Recepción). Positivo = Ahorro, Negativo = Sobrecosto">
                          Dif.
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-[var(--background)]">
                      {isLoadingTrazabilidad ? (
                        <tr>
                          <td colSpan={8} className="px-0.5 py-1 text-center text-[11px] text-[var(--text-secondary)]">
                            <LoadingSpinner size={14} showText={false} />
                            <span className="ml-1">Cargando...</span>
                          </td>
                        </tr>
                      ) : datosCostoReal.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-0.5 py-1 text-center text-[11px] text-[var(--text-secondary)]">
                            {partidaSeleccionada 
                              ? 'Sin datos de trazabilidad'
                              : 'Seleccione una partida'}
                          </td>
                        </tr>
                      ) : (
                        datosCostoReal.map((item: any, index: number) => {
                          const esRecursoAPU = recursosAPUSet.has(item.recurso_id) || recursosAPUSet.has(item.codigo);
                          return (
                        <tr 
                          key={index} 
                          className={`cursor-pointer ${
                            esRecursoAPU 
                              ? 'bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 border-l-2 border-l-blue-500' 
                              : 'hover:bg-[var(--hover-bg)]'
                          }`}
                          onClick={() => {
                            setRecursoSeleccionado({
                              recurso_id: item.recurso_id,
                              codigo: item.codigo,
                              descripcion: item.descripcion,
                              totalComposicion: item.totalComposicion,
                              totalRQ: item.totalRQ,
                              totalRQBruto: item.totalRQBruto,
                              totalOCBienes: item.totalOCBienes,
                              totalOCBienesBruto: item.totalOCBienesBruto,
                              totalOCServicios: item.totalOCServicios,
                              totalOCServiciosBruto: item.totalOCServiciosBruto,
                              totalRecepcion: item.totalRecepcion,
                              totalRecepcionBruto: item.totalRecepcionBruto,
                              diferencia: item.diferencia,
                            });
                          }}
                        >
                          <td className={`px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] font-mono whitespace-nowrap ${esRecursoAPU ? 'font-semibold' : ''}`}>
                            {item.codigo}
                          </td>
                          <td className={`px-0.5 py-1 border-r border-[var(--border-color)] text-[11px] !max-w-[50px] ${esRecursoAPU ? 'font-semibold' : ''}`} title={item.descripcion}>
                            <span className="text-[var(--text-primary)] line-clamp-1 leading-tight">{item.descripcion}</span>
                          </td>
                          <td className="px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                            {(item.totalComposicion || 0).toFixed(2)}
                          </td>
                          <td className="px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                            <div className="flex flex-col leading-tight gap-0.5">
                              <span className="text-[11px] text-[var(--text-primary)] font-medium">{(item.totalRQ || 0).toFixed(2)}</span>
                              <span className="text-[10px] text-[var(--text-secondary)] opacity-75">{(item.totalRQBruto || 0).toFixed(2)}</span>
                            </div>
                          </td>
                          <td className="px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                            <div className="flex flex-col leading-tight gap-0.5">
                              <span className="text-[11px] text-[var(--text-primary)] font-medium">{(item.totalOCBienes || 0).toFixed(2)}</span>
                              <span className="text-[10px] text-[var(--text-secondary)] opacity-75">{(item.totalOCBienesBruto || 0).toFixed(2)}</span>
                            </div>
                          </td>
                          <td className="px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                            <div className="flex flex-col leading-tight gap-0.5">
                              <span className="text-[11px] text-[var(--text-primary)] font-medium">{(item.totalOCServicios || 0).toFixed(2)}</span>
                              <span className="text-[10px] text-[var(--text-secondary)] opacity-75">{(item.totalOCServiciosBruto || 0).toFixed(2)}</span>
                            </div>
                          </td>
                          <td className="px-0.5 py-1 text-center border-r border-[var(--border-color)] text-[11px] whitespace-nowrap">
                            <div className="flex flex-col leading-tight gap-0.5">
                              <span className="text-[11px] text-[var(--text-primary)] font-medium">{(item.totalRecepcion || 0).toFixed(2)}</span>
                              <span className="text-[10px] text-[var(--text-secondary)] opacity-75">{(item.totalRecepcionBruto || 0).toFixed(2)}</span>
                            </div>
                          </td>
                          <td className={`px-0.5 py-1 text-right text-[11px] whitespace-nowrap ${(item.diferencia || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(item.diferencia || 0) >= 0 ? '+' : ''}{((item.diferencia || 0)).toFixed(2)}
                          </td>
                        </tr>
                        );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-[var(--card-bg)] border-t border-[var(--border-color)] flex-shrink-0 overflow-x-auto">
                <div className="min-w-0">
                  <table className="w-auto text-[11px] border-collapse">
                    <tfoot>
                      <tr>
                        <td className="px-0.5 py-1"></td>
                        <td className="px-0.5 py-1 text-right font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)] text-[11px]">
                          Totales:
                        </td>
                        <td className="px-0.5 py-1 text-center font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap font-mono">
                          {totalesCostoReal.totalComposicion.toFixed(2)}
                        </td>
                        <td className="px-0.5 py-1 text-center font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap font-mono">
                          <div className="flex flex-col leading-tight gap-0.5">
                            <span>{totalesCostoReal.totalRQ.toFixed(2)}</span>
                            <span className="text-[11px]">{totalesCostoReal.totalRQBruto.toFixed(2)}</span>
                          </div>
                        </td>
                        <td className="px-0.5 py-1 text-center font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap font-mono">
                          <div className="flex flex-col leading-tight gap-0.5">
                            <span>{totalesCostoReal.totalOCBienes.toFixed(2)}</span>
                            <span className="text-[11px]">{totalesCostoReal.totalOCBienesBruto.toFixed(2)}</span>
                          </div>
                        </td>
                        <td className="px-0.5 py-1 text-center font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap font-mono">
                          <div className="flex flex-col leading-tight gap-0.5">
                            <span>{totalesCostoReal.totalOCServicios.toFixed(2)}</span>
                            <span className="text-[11px]">{totalesCostoReal.totalOCServiciosBruto.toFixed(2)}</span>
                          </div>
                        </td>
                        <td className="px-0.5 py-1 text-center font-semibold text-[var(--text-primary)] border-r border-[var(--border-color)] text-[11px] whitespace-nowrap font-mono">
                          <div className="flex flex-col leading-tight gap-0.5">
                            <span>{totalesCostoReal.totalRecepcion.toFixed(2)}</span>
                            <span className="text-[11px]">{totalesCostoReal.totalRecepcionBruto.toFixed(2)}</span>
                          </div>
                        </td>
                        <td className={`px-0.5 py-1 text-right font-semibold text-[11px] whitespace-nowrap font-mono ${totalesCostoReal.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {totalesCostoReal.diferencia >= 0 ? '+' : ''}{totalesCostoReal.diferencia.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de trazabilidad detallada */}
      <ModalTrazabilidadDetalle
        isOpen={!!recursoSeleccionado}
        onClose={() => {
          setRecursoSeleccionado(null);
          setAbrirVistaPartida(false); // Resetear el estado al cerrar
        }}
        recurso={recursoSeleccionado}
        todosLosRecursos={datosCostoReal}
        trazabilidadDetalle={trazabilidadDetalle}
        isLoading={isLoadingDetalle}
        onSeleccionarRecurso={(nuevoRecurso) => {
          setRecursoSeleccionado(nuevoRecurso);
          setAbrirVistaPartida(false); // Al seleccionar un recurso individual, mostrar la vista normal
        }}
        recursoAPUMeta={recursoAPUMetaCalculado}
        abrirVistaPartidaDirectamente={abrirVistaPartida}
        partidaInfo={partidaSeleccionada ? {
          item: calcularNumeroItem(partidaSeleccionada),
          descripcion: partidaSeleccionada.descripcion,
        } : null}
      />
    </div>
  );
}
