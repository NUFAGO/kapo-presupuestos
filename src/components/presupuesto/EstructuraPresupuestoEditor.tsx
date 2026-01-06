'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ChevronDown, ChevronRight, ChevronLeft, ArrowUp, ArrowDown, Scissors, Clipboard, ArrowLeft, Trash2, Save, Loader2, CheckSquare, X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui';
import Modal from '@/components/ui/modal';
import CrearPartidasTitulosForm from './components/CrearPartidasTitulosForm';
import DetallePartidaPanel, { type PartidaLocal } from './components/DetallePartidaPanel';
import ModalAgregarSubPartida from './components/ModalAgregarSubPartida';
import { useEstructuraPresupuesto } from '@/hooks/usePresupuestos';
import { useCreateTitulo, useUpdateTitulo, useDeleteTitulo } from '@/hooks/useTitulos';
import { useCreatePartida, useUpdatePartida, useDeletePartida } from '@/hooks/usePartidas';
import { useConfirm } from '@/context/confirm-context';
import { useQueryClient } from '@tanstack/react-query';
import { executeMutation, executeQuery } from '@/services/graphql-client';
import { BATCH_ESTRUCTURA_PRESUPUESTO_MUTATION } from '@/graphql/mutations/estructura-batch.mutations';
import { UPDATE_PRESUPUESTO_MUTATION } from '@/graphql/mutations/presupuesto.mutations';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/input';
import {
  obtenerIdPadreReferencia,
  sonTodosHermanos,
  tieneRelacionConSeleccionados,
  obtenerTipoItem as obtenerTipoItemUtil,
} from './utils/seleccionMultiple';

// ============================================================================
// TIPOS Y INTERFACES
// ============================================================================

type ModoEditor = 'edicion' | 'lectura' | 'licitacion' | 'meta' | 'contractual';

interface Titulo {
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

interface Partida {
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

interface EstructuraPresupuestoEditorProps {
  id_presupuesto: string;
  id_proyecto?: string;
  nombre_presupuesto?: string;
  modo?: ModoEditor;
  rutaRetorno?: string; // Ruta a la que volver cuando se hace clic en el botón de volver
  mantenerAPUs?: boolean; // Para integración de plantillas con APUs
}


// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function EstructuraPresupuestoEditor({
  id_presupuesto,
  id_proyecto,
  nombre_presupuesto = 'Presupuesto',
  modo = 'edicion',
  rutaRetorno,
  mantenerAPUs = false,
}: EstructuraPresupuestoEditorProps) {
  const router = useRouter();
  const [titulosColapsados, setTitulosColapsados] = useState<Set<string>>(new Set());
  const [partidasColapsadas, setPartidasColapsadas] = useState<Set<string>>(new Set());
  const [itemSeleccionado, setItemSeleccionado] = useState<string | null>(null);
  const [modoSeleccionMultiple, setModoSeleccionMultiple] = useState(false);
  const [itemsSeleccionadosMultiple, setItemsSeleccionadosMultiple] = useState<Set<string>>(new Set());
  const [itemCortado, setItemCortado] = useState<string | null>(null);
  const [itemsCortadosMultiple, setItemsCortadosMultiple] = useState<Set<string>>(new Set());
  
  // Helper para verificar si hay items cortados (compatibilidad con ambos modos)
  const hayItemsCortados = useMemo(() => {
    return itemCortado !== null || itemsCortadosMultiple.size > 0;
  }, [itemCortado, itemsCortadosMultiple]);
  
  // Helper para verificar si un item está seleccionado (en modo múltiple)
  const estaSeleccionado = useCallback((id: string): boolean => {
    if (modoSeleccionMultiple) {
      return itemsSeleccionadosMultiple.has(id);
    }
    return itemSeleccionado === id;
  }, [modoSeleccionMultiple, itemsSeleccionadosMultiple, itemSeleccionado]);
  
  // Verificar si hay selección múltiple activa
  const haySeleccionMultiple = modoSeleccionMultiple && itemsSeleccionadosMultiple.size > 1;

  // Estado para el panel redimensionable (porcentaje del panel inferior, inicialmente 30%)
  const [panelInferiorHeight, setPanelInferiorHeight] = useState(40);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Obtener estructura del presupuesto desde el backend
  const { data: estructuraData, isLoading, error } = useEstructuraPresupuesto(id_presupuesto);

  // Hooks para mutaciones
  const createTitulo = useCreateTitulo();
  const updateTitulo = useUpdateTitulo();
  const deleteTitulo = useDeleteTitulo();
  const createPartida = useCreatePartida();
  const updatePartida = useUpdatePartida();
  const deletePartida = useDeletePartida();

  // Hook para confirmaciones
  const { confirm } = useConfirm();

  // Query client para invalidar queries manualmente
  const queryClient = useQueryClient();

  // Estado local para manejar los datos (se actualiza cuando llegan los datos del backend)
  const [titulos, setTitulos] = useState<Titulo[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  
  // Verificar si todos los seleccionados son hermanos (solo en modo múltiple)
  const todosSonHermanos = useMemo(() => {
    if (!modoSeleccionMultiple || itemsSeleccionadosMultiple.size <= 1) return true;
    return sonTodosHermanos(Array.from(itemsSeleccionadosMultiple), titulos, partidas);
  }, [modoSeleccionMultiple, itemsSeleccionadosMultiple, titulos, partidas]);

  // Estado para datos originales (para comparar cambios)
  const [titulosOriginales, setTitulosOriginales] = useState<Titulo[]>([]);
  const [partidasOriginales, setPartidasOriginales] = useState<Partida[]>([]);

  // Estado para items eliminados (se guardan cuando se presiona "Guardar cambios")
  const [titulosEliminados, setTitulosEliminados] = useState<Set<string>>(new Set());
  const [partidasEliminadas, setPartidasEliminadas] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Estados para elementos temporales (igual que títulos/partidas)
  const [apusTemporales, setApusTemporales] = useState<any[]>([]);
  const [preciosCompartidosTemporales, setPreciosCompartidosTemporales] = useState<any[]>([]);
  const [apuPreciosMap, setApuPreciosMap] = useState<Map<string, string[]>>(new Map());

  // Estado local para controlar "Mantener APUs y detalles" en el modal
  const [modalMantenerAPUs, setModalMantenerAPUs] = useState(true);
  const [integrandoPlantilla, setIntegrandoPlantilla] = useState(false);
  const [isSavingRecursos, setIsSavingRecursos] = useState(false);

  // Estado para subpartidas que necesitan creación de APU
  const [subpartidasParaCrearApu, setSubpartidasParaCrearApu] = useState<Map<string, PartidaLocal>>(new Map());

  // Estado para subpartidas pendientes de agregar al panel
  const [subpartidasPendientes, setSubpartidasPendientes] = useState<PartidaLocal[]>([]);

  // Contador para generar IDs temporales únicos
  const contadorIdTemporal = useRef(0);
  
  // Ref para rastrear qué padres están siendo reordenados para evitar ejecuciones múltiples
  const padresReordenandoRef = useRef<Set<string | null>>(new Set());

  // Estados combinados: existentes + temporales (igual que títulos/partidas)
  const apusCombinados = useMemo(() => {
    const existentes = estructuraData?.apus || [];
    const temporales = apusTemporales || [];
    return [...existentes, ...temporales];
  }, [estructuraData?.apus, apusTemporales]);

  const preciosCompartidosCombinados = useMemo(() => {
    const existentes = estructuraData?.precios_compartidos || [];
    const temporales = preciosCompartidosTemporales || [];
    return [...existentes, ...temporales];
  }, [estructuraData?.precios_compartidos, preciosCompartidosTemporales]);

  // Obtener id_proyecto de los datos del presupuesto
  const id_proyecto_real = estructuraData?.presupuesto?.id_proyecto || id_proyecto;

  // Actualizar estado local cuando llegan los datos del backend
  useEffect(() => {
    if (estructuraData) {
      setTitulos(estructuraData.titulos);
      setPartidas(estructuraData.partidas);
      // Guardar copia de los datos originales para comparar cambios
      setTitulosOriginales(JSON.parse(JSON.stringify(estructuraData.titulos)));
      setPartidasOriginales(JSON.parse(JSON.stringify(estructuraData.partidas)));
      // Limpiar eliminados cuando se recargan los datos
      setTitulosEliminados(new Set());
      setPartidasEliminadas(new Set());
    }
  }, [estructuraData]);

  // Estados para el modal (títulos y partidas)
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tipoItemModal, setTipoItemModal] = useState<'TITULO' | 'PARTIDA'>('PARTIDA');
  const [tituloEditando, setTituloEditando] = useState<Titulo | null>(null);
  const [partidaEditando, setPartidaEditando] = useState<Partida | null>(null);
  const [nombreItem, setNombreItem] = useState('');
  const [usarPlantillaTituloModal, setUsarPlantillaTituloModal] = useState(false);
  
  // Estado para edición inline de metrado
  const [partidaEditandoMetrado, setPartidaEditandoMetrado] = useState<string | null>(null);
  const [valorMetradoTemporal, setValorMetradoTemporal] = useState<string>('');

  // Estado para el modal de agregar sub partida
  const [modalAgregarSubPartidaAbierto, setModalAgregarSubPartidaAbierto] = useState(false);
  const [subPartidaParaAgregar, setSubPartidaParaAgregar] = useState<PartidaLocal | null>(null);
  const [subPartidaParaEditar, setSubPartidaParaEditar] = useState<{ id: string; recursos: any[]; idPartidaOriginal?: string | null; rendimiento?: number; jornada?: number; descripcion?: string } | null>(null);
  const [subPartidaParaActualizar, setSubPartidaParaActualizar] = useState<PartidaLocal | null>(null);

  // ============================================================================
  // FUNCIONES DE UTILIDAD PARA BLOQUES
  // ============================================================================

  /**
   * Obtiene todos los IDs de un bloque (título + todos sus descendientes)
   */
  const obtenerIdsBloqueTitulo = useCallback((id_titulo: string): string[] => {
    const ids: string[] = [id_titulo];

    // Agregar títulos hijos recursivamente
    const hijosTitulos = titulos.filter(t => t.id_titulo_padre === id_titulo);
    hijosTitulos.forEach(hijo => {
      ids.push(...obtenerIdsBloqueTitulo(hijo.id_titulo));
    });

    // Agregar partidas directas del título
    const partidasDirectas = partidas.filter(p => p.id_titulo === id_titulo && p.id_partida_padre === null);
    partidasDirectas.forEach(partida => {
      ids.push(...obtenerIdsBloquePartida(partida.id_partida));
    });

    return ids;
  }, [titulos, partidas]);

  /**
   * Obtiene todos los IDs de un bloque de partida (partida + todas sus subpartidas)
   */
  const obtenerIdsBloquePartida = useCallback((id_partida: string): string[] => {
    const ids: string[] = [id_partida];

    // Agregar subpartidas recursivamente
    const subpartidas = partidas.filter(p => p.id_partida_padre === id_partida);
    subpartidas.forEach(subpartida => {
      ids.push(...obtenerIdsBloquePartida(subpartida.id_partida));
    });

    return ids;
  }, [partidas]);

  /**
   * Obtiene el tipo de item (TITULO o PARTIDA) por su ID
   */
  const obtenerTipoItem = useCallback((id: string): 'TITULO' | 'PARTIDA' | null => {
    if (titulos.some(t => t.id_titulo === id)) return 'TITULO';
    if (partidas.some(p => p.id_partida === id)) return 'PARTIDA';
    return null;
  }, [titulos, partidas]);

  /**
   * Calcula el nivel dinámicamente basándose en la jerarquía actual
   * El nivel se calcula contando la profundidad desde la raíz
   */
  const calcularNivelDinamico = useCallback((id_titulo: string): number => {
    const titulo = titulos.find(t => t.id_titulo === id_titulo);
    if (!titulo) return 1;

    // Si no tiene padre, es nivel 1
    if (!titulo.id_titulo_padre) return 1;

    // Si tiene padre, calcular recursivamente
    return calcularNivelDinamico(titulo.id_titulo_padre) + 1;
  }, [titulos]);

  /**
   * Actualiza el nivel de un título y todos sus descendientes
   */
  const actualizarNivelTituloYDescendientes = useCallback((id_titulo: string, nuevoNivel: number) => {
    setTitulos(prev => prev.map(t => {
      if (t.id_titulo === id_titulo) {
        return { ...t, nivel: nuevoNivel };
      }
      // Actualizar hijos
      if (t.id_titulo_padre === id_titulo) {
        return { ...t, nivel: nuevoNivel + 1 };
      }
      return t;
    }));

    // Actualizar recursivamente todos los descendientes
    const hijos = titulos.filter(t => t.id_titulo_padre === id_titulo);
    hijos.forEach(hijo => {
      actualizarNivelTituloYDescendientes(hijo.id_titulo, nuevoNivel + 1);
    });
  }, [titulos]);

  // ============================================================================
  // ORDENAMIENTO MIXTO (TÍTULOS + PARTIDAS INTERCALADOS)
  // ============================================================================

  /**
   * Crea una estructura unificada que mezcla títulos y partidas por orden
   * dentro del mismo padre, respetando la jerarquía
   */
  type ItemUnificado =
    | { tipo: 'TITULO'; data: Titulo }
    | { tipo: 'PARTIDA'; data: Partida };

  /**
   * Verifica si un título tiene algún ancestro colapsado (recursivamente)
   * Retorna true si algún ancestro (padre, abuelo, etc.) está colapsado
   */
  const tieneAncestroColapsado = useCallback((id_titulo: string | null): boolean => {
    if (!id_titulo) return false;

    const titulo = titulos.find(t => t.id_titulo === id_titulo);
    if (!titulo) return false;

    // Si este título está colapsado, retornar true
    if (titulosColapsados.has(id_titulo)) return true;

    // Si tiene padre, verificar recursivamente
    if (titulo.id_titulo_padre) {
      return tieneAncestroColapsado(titulo.id_titulo_padre);
    }

    return false;
  }, [titulos, titulosColapsados]);

  /**
   * Verifica si un item debe estar oculto por colapso de ancestros
   * Los títulos raíz (sin padre) NUNCA deben estar ocultos
   */
  const estaOcultoPorColapso = useCallback((item: Titulo | Partida): boolean => {
    // Si es un título sin padre (raíz), nunca ocultarlo
    if ('id_titulo_padre' in item && !item.id_titulo_padre) {
      return false;
    }

    if ('id_titulo_padre' in item && item.id_titulo_padre) {
      // Es un título con padre: verificar si algún ancestro está colapsado
      return tieneAncestroColapsado(item.id_titulo_padre);
    }

    if ('id_partida_padre' in item && item.id_partida_padre) {
      // Es una subpartida: verificar si la partida padre está colapsada
      if (partidasColapsadas.has(item.id_partida_padre)) return true;
    }

    // Es una partida principal: verificar si el título al que pertenece tiene ancestros colapsados
    if ('id_titulo' in item && item.id_titulo) {
      const tituloPadre = titulos.find(t => t.id_titulo === item.id_titulo);
      if (tituloPadre) {
        // Si el título padre es raíz y está colapsado, ocultar la partida
        if (!tituloPadre.id_titulo_padre && titulosColapsados.has(tituloPadre.id_titulo)) {
          return true;
        }
        // Si el título padre tiene ancestros colapsados, ocultar la partida
        return tieneAncestroColapsado(tituloPadre.id_titulo);
      }
    }

    return false;
  }, [titulosColapsados, partidasColapsadas, titulos, tieneAncestroColapsado]);

  // Crear índices para acceso rápido (optimización de rendimiento)
  const titulosPorPadre = useMemo(() => {
    const map = new Map<string | null, Titulo[]>();
    titulos.forEach(titulo => {
      const padre = titulo.id_titulo_padre;
      if (!map.has(padre)) {
        map.set(padre, []);
      }
      map.get(padre)!.push(titulo);
    });
    // Ordenar cada grupo por orden
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
    // Ordenar cada grupo por orden
    map.forEach((partidasMap) => {
      partidasMap.forEach((grupo) => grupo.sort((a, b) => a.orden - b.orden));
    });
    return map;
  }, [partidas]);

  const estructuraUnificada = useMemo(() => {
    const resultado: ItemUnificado[] = [];
    const itemsProcesados = new Set<string>(); // Para evitar duplicados

    /**
     * Función recursiva para construir la estructura unificada
     * Maneja el ordenamiento mixto dinámico de títulos y partidas
     * Respeta el estado de colapso: si un título está colapsado, no incluye sus descendientes
     * Los títulos raíz (sin padre) siempre se muestran, incluso si están colapsados
     */
    const construirEstructura = (id_padre: string | null) => {
      // Si el padre está colapsado, no procesar sus hijos (pero el padre mismo ya se mostró)
      if (id_padre && titulosColapsados.has(id_padre)) {
        return;
      }

      // Obtener todos los items del mismo padre (títulos y partidas) mezclados
      const items: ItemUnificado[] = [];

      // Agregar títulos hijos del padre (usando índice optimizado)
      const titulosHijos = titulosPorPadre.get(id_padre) || [];
      titulosHijos.forEach(titulo => {
        items.push({ tipo: 'TITULO', data: titulo });
      });

      // Agregar partidas del mismo nivel (usando índice optimizado)
      if (id_padre !== null) {
        const partidasMap = partidasPorTituloYPadre.get(id_padre);
        if (partidasMap) {
          const partidasPrincipales = partidasMap.get(null) || [];
          partidasPrincipales.forEach(partida => {
            items.push({ tipo: 'PARTIDA', data: partida });
          });
        }
      }

      // Ordenar por orden (títulos y partidas mezclados según su campo 'orden')
      items.sort((a, b) => {
        const ordenA = a.data.orden;
        const ordenB = b.data.orden;
        return ordenA - ordenB;
      });

      // Agregar items ordenados al resultado y procesar recursivamente
      items.forEach(item => {
        // Crear clave única para evitar duplicados
        const clave = item.tipo === 'TITULO' ? `TIT-${item.data.id_titulo}` : `PAR-${item.data.id_partida}`;

        // Solo agregar si no se ha procesado antes
        if (!itemsProcesados.has(clave)) {
          itemsProcesados.add(clave);
          resultado.push(item);

          // Si es un título y NO está colapsado, agregar recursivamente sus hijos
          // Esto asegura que todos los descendientes se oculten cuando un título está colapsado
          if (item.tipo === 'TITULO' && !titulosColapsados.has(item.data.id_titulo)) {
            construirEstructura(item.data.id_titulo);
          }
        }

        // NOTA: Las subpartidas NO se muestran aquí, se mostrarán junto con los recursos
        // dentro de cada partida en otra sección/componente
      });
    };

    construirEstructura(null);
    return resultado;
  }, [titulosPorPadre, partidasPorTituloYPadre, titulosColapsados]);

  /**
   * Obtiene partidas de un título (para renderizado)
   */
  const partidasPorTitulo = useMemo(() => {
    const partidasMap = new Map<string, Partida[]>();
    partidas.forEach(partida => {
      if (!partidasMap.has(partida.id_titulo)) {
        partidasMap.set(partida.id_titulo, []);
      }
      partidasMap.get(partida.id_titulo)!.push(partida);
    });
    return partidasMap;
  }, [partidas]);

  // ============================================================================
  // FUNCIONES DE UTILIDAD
  // ============================================================================

  /**
   * Calcula dinámicamente el numero_item basado en la posición jerárquica
   */
  const calcularNumeroItem = useCallback((item: Titulo | Partida, tipo: 'TITULO' | 'PARTIDA'): string => {
    if (tipo === 'TITULO') {
      const titulo = item as Titulo;

      // Si no tiene padre, es nivel raíz
      if (!titulo.id_titulo_padre) {
        // Contar cuántos títulos raíz hay antes de este (según orden)
        const titulosRaiz = titulos
          .filter(t => t.id_titulo_padre === null)
          .sort((a, b) => a.orden - b.orden);
        const indice = titulosRaiz.findIndex(t => t.id_titulo === titulo.id_titulo);
        return String(indice + 1);
      }

      // Tiene padre, calcular basado en el padre
      const padre = titulos.find(t => t.id_titulo === titulo.id_titulo_padre);
      if (!padre) return '0';

      // Obtener todos los items del mismo padre (títulos y partidas) ordenados
      const itemsMismoPadre: Array<{ id: string; tipo: 'TITULO' | 'PARTIDA'; orden: number }> = [];

      // Títulos hermanos
      titulos
        .filter(t => t.id_titulo_padre === titulo.id_titulo_padre)
        .forEach(t => itemsMismoPadre.push({ id: t.id_titulo, tipo: 'TITULO', orden: t.orden }));

      // Partidas del padre
      partidas
        .filter(p => p.id_titulo === titulo.id_titulo_padre && p.id_partida_padre === null)
        .forEach(p => itemsMismoPadre.push({ id: p.id_partida, tipo: 'PARTIDA', orden: p.orden }));

      // Ordenar por orden
      itemsMismoPadre.sort((a, b) => a.orden - b.orden);

      // Encontrar posición del título actual
      const indice = itemsMismoPadre.findIndex(item => item.id === titulo.id_titulo && item.tipo === 'TITULO');
      const numeroSecuencia = String(indice + 1);

      // Calcular numero_item del padre recursivamente
      const numeroPadre = calcularNumeroItem(padre, 'TITULO');
      return `${numeroPadre}.${numeroSecuencia}`;
    } else {
      // Es una partida
      const partida = item as Partida;

      // Obtener el título al que pertenece
      const tituloPadre = titulos.find(t => t.id_titulo === partida.id_titulo);
      if (!tituloPadre) return '0';

      // Obtener todos los items del mismo nivel (títulos hijos y partidas del título padre) ordenados
      const itemsMismoPadre: Array<{ id: string; tipo: 'TITULO' | 'PARTIDA'; orden: number }> = [];

      // Títulos hijos del título padre (hermanos de la partida)
      titulos
        .filter(t => t.id_titulo_padre === partida.id_titulo)
        .forEach(t => itemsMismoPadre.push({ id: t.id_titulo, tipo: 'TITULO', orden: t.orden }));

      // Partidas del título padre (incluyendo la actual)
      partidas
        .filter(p => p.id_titulo === partida.id_titulo && p.id_partida_padre === null)
        .forEach(p => itemsMismoPadre.push({ id: p.id_partida, tipo: 'PARTIDA', orden: p.orden }));

      // Ordenar por orden (títulos y partidas mezclados)
      itemsMismoPadre.sort((a, b) => a.orden - b.orden);

      // Encontrar posición de la partida actual
      const indice = itemsMismoPadre.findIndex(item => item.id === partida.id_partida && item.tipo === 'PARTIDA');
      const numeroSecuencia = String(indice + 1);

      // Calcular numero_item del título padre recursivamente
      const numeroPadre = calcularNumeroItem(tituloPadre, 'TITULO');
      return `${numeroPadre}.${numeroSecuencia}`;
    }
  }, [titulos, partidas]);

  const tieneHijosTitulo = useCallback((id_titulo: string): boolean => {
    return titulos.some(t => t.id_titulo_padre === id_titulo);
  }, [titulos]);

  const tienePartidas = useCallback((id_titulo: string): boolean => {
    return partidas.some(p => p.id_titulo === id_titulo && p.id_partida_padre === null);
  }, [partidas]);

  const tieneSubpartidas = useCallback((id_partida: string): boolean => {
    return partidas.some(p => p.id_partida_padre === id_partida);
  }, [partidas]);

  const getPartidasDeTitulo = useCallback((id_titulo: string): Partida[] => {
    return partidasPorTitulo.get(id_titulo) || [];
  }, [partidasPorTitulo]);

  const getSubpartidas = useCallback((id_partida: string): Partida[] => {
    return partidas.filter(p => p.id_partida_padre === id_partida);
  }, [partidas]);

  // ============================================================================
  // HANDLERS DE ACCIONES
  // ============================================================================

  const handleToggleColapsoTitulo = (id_titulo: string) => {
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

  const handleToggleColapsoPartida = (id_partida: string) => {
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

  const handleSeleccionar = (id: string, e?: React.MouseEvent) => {
    if (modoSeleccionMultiple) {
      // Modo selección múltiple activo
      const shiftPressed = e?.shiftKey || false;

      if (shiftPressed && itemsSeleccionadosMultiple.size > 0) {
        // Selección por rango (Shift+Click)
        const ultimoSeleccionado = Array.from(itemsSeleccionadosMultiple)[itemsSeleccionadosMultiple.size - 1];
        
        // Verificar relación padre-hijo
        if (tieneRelacionConSeleccionados(id, Array.from(itemsSeleccionadosMultiple), titulos, partidas)) {
          toast.error('No se puede seleccionar un padre junto con sus hijos o viceversa');
          return;
        }
        
        // Obtener todos los hermanos del último seleccionado
        const hermanos = obtenerItemsMismoPadre(ultimoSeleccionado);
        const indiceUltimo = hermanos.findIndex(h => h.id === ultimoSeleccionado);
        const indiceNuevo = hermanos.findIndex(h => h.id === id);
        
        if (indiceUltimo === -1 || indiceNuevo === -1) {
          // No son hermanos, solo seleccionar el nuevo item
          setItemsSeleccionadosMultiple(new Set([id]));
          return;
        }
        
        // Seleccionar el rango entre el último y el nuevo
        const inicio = Math.min(indiceUltimo, indiceNuevo);
        const fin = Math.max(indiceUltimo, indiceNuevo);
        const idsRango = hermanos.slice(inicio, fin + 1).map(h => h.id);
        setItemsSeleccionadosMultiple(new Set([...itemsSeleccionadosMultiple, ...idsRango]));
      } else {
        // Click normal en modo múltiple: toggle del item
        const nuevoSet = new Set(itemsSeleccionadosMultiple);
        if (nuevoSet.has(id)) {
          nuevoSet.delete(id);
        } else {
          // Verificar relación padre-hijo antes de agregar
          if (itemsSeleccionadosMultiple.size > 0) {
            if (tieneRelacionConSeleccionados(id, Array.from(itemsSeleccionadosMultiple), titulos, partidas)) {
              toast.error('No se puede seleccionar un padre junto con sus hijos o viceversa');
              return;
            }
          }
          nuevoSet.add(id);
        }
        setItemsSeleccionadosMultiple(nuevoSet);
      }
    } else {
      // Modo normal: selección simple (abre el panel)
      setItemSeleccionado(id === itemSeleccionado ? null : id);
    }
  };

  // Handler para iniciar edición de metrado con un clic
  const handleIniciarEdicionMetrado = useCallback((idPartida: string, metradoActual: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (modo !== 'edicion') return;
    setPartidaEditandoMetrado(idPartida);
    setValorMetradoTemporal(metradoActual.toString());
  }, [modo]);

  // Handler para guardar metrado editado
  const handleGuardarMetrado = useCallback((idPartida: string) => {
    const valorNumerico = parseFloat(valorMetradoTemporal.replace(/,/g, ''));
    
    if (isNaN(valorNumerico) || valorNumerico < 0) {
      // Si el valor no es válido, restaurar el valor original
      const partida = partidas.find(p => p.id_partida === idPartida);
      if (partida) {
        setValorMetradoTemporal(partida.metrado.toString());
      }
      return;
    }

    // Actualizar el metrado y recalcular el parcial
    setPartidas(prev => prev.map(p => {
      if (p.id_partida === idPartida) {
        const nuevoMetrado = valorNumerico;
        const nuevoParcial = nuevoMetrado * p.precio_unitario;
        return {
          ...p,
          metrado: nuevoMetrado,
          parcial_partida: nuevoParcial
        };
      }
      return p;
    }));

    // Cerrar edición
    setPartidaEditandoMetrado(null);
    setValorMetradoTemporal('');
  }, [valorMetradoTemporal, partidas]);

  // Handler para cancelar edición de metrado
  const handleCancelarEdicionMetrado = useCallback((idPartida: string) => {
    const partida = partidas.find(p => p.id_partida === idPartida);
    if (partida) {
      setValorMetradoTemporal(partida.metrado.toString());
    }
    setPartidaEditandoMetrado(null);
    setValorMetradoTemporal('');
  }, [partidas]);

  // Detectar si el item seleccionado es una partida
  const partidaSeleccionada = useMemo(() => {
    if (!itemSeleccionado) return null;
    const tipo = obtenerTipoItem(itemSeleccionado);
    if (tipo === 'PARTIDA') {
      return itemSeleccionado;
    }
    return null;
  }, [itemSeleccionado, obtenerTipoItem]);

  // Ajustar tamaño del panel automáticamente cuando se selecciona una partida
  useEffect(() => {
    if (partidaSeleccionada && panelInferiorHeight < 50) {
      setPanelInferiorHeight(50);
    } else if (!partidaSeleccionada && panelInferiorHeight > 30) {
      // Opcional: reducir cuando no hay partida seleccionada
      // setPanelInferiorHeight(30);
    }
  }, [partidaSeleccionada]);

  // Log de APU encontrado cuando cambia la selección de partida
  useEffect(() => {
    if (partidaSeleccionada) {
      const apuEncontrado = apusCombinados.find(apu => apu.id_partida === partidaSeleccionada);
      if (apuEncontrado) {
      }
    }
  }, [partidaSeleccionada, apusCombinados, preciosCompartidosCombinados]);

  // Lógica de redimensionamiento del panel (optimizada con requestAnimationFrame)
  useEffect(() => {
    if (!isResizing) return;

    let rafId: number | null = null;
    let lastUpdateTime = 0;
    const throttleMs = 8; // ~120fps para suavidad

    const handleMouseMove = (e: MouseEvent) => {
      const now = performance.now();

      // Throttle: solo procesar si ha pasado suficiente tiempo
      if (now - lastUpdateTime < throttleMs) {
        return;
      }

      // Cancelar cualquier RAF pendiente
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      // Usar requestAnimationFrame para sincronizar con el ciclo de renderizado
      rafId = requestAnimationFrame(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
        const containerHeight = containerRect.height;

        // Posición del mouse relativa al contenedor (desde el top)
        const mouseY = e.clientY - containerRect.top;

        // Calcular porcentaje del panel inferior basado en la posición del mouse
        // Cuando el mouse BAJA (mouseY aumenta hacia abajo), el panel inferior debe HACERSE PEQUEÑO
        // Cuando el mouse SUBE (mouseY disminuye hacia arriba), el panel inferior debe CRECER
        // Por lo tanto: porcentaje = ((containerHeight - mouseY) / containerHeight) * 100
        const newHeight = ((containerHeight - mouseY) / containerHeight) * 100;

        // Limitar entre 15% y 70%
        const clampedHeight = Math.max(15, Math.min(70, newHeight));
        setPanelInferiorHeight(clampedHeight);
        lastUpdateTime = now;
      });
    };

    const handleMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setIsResizing(false);
    };

    // Agregar listeners con passive para mejor rendimiento
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    // Cleanup
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleCortar = useCallback((id: string) => {
    if (modoSeleccionMultiple && itemsSeleccionadosMultiple.size > 0) {
      // Modo múltiple: cortar todos los seleccionados
      setItemsCortadosMultiple(new Set(itemsSeleccionadosMultiple));
      setItemsSeleccionadosMultiple(new Set());
      setItemCortado(null);
      // Desactivar modo múltiple para permitir seleccionar destino normalmente
      setModoSeleccionMultiple(false);
    } else {
      // Modo normal: cortar un solo item
      setItemCortado(id);
      setItemsCortadosMultiple(new Set());
    }
  }, [modoSeleccionMultiple, itemsSeleccionadosMultiple]);

  /**
   * Cancela el corte de items, limpiando el estado de cortado
   */
  const handleCancelarCorte = useCallback(() => {
    setItemCortado(null);
    setItemsCortadosMultiple(new Set());
  }, []);

  // Listener para cancelar corte con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && hayItemsCortados) {
        handleCancelarCorte();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hayItemsCortados, handleCancelarCorte]);

  /**
   * Reordena los items de un padre para asegurar ordenes secuenciales (1, 2, 3, ...)
   */
  const reordenarItemsPadre = useCallback((idPadre: string | null) => {
    // Usar setTimeout para asegurar que se ejecute después de que todos los cambios se hayan aplicado
    setTimeout(() => {
      // Obtener valores actualizados de ambos estados usando la forma funcional
      setTitulos(prevTitulos => {
        setPartidas(prevPartidas => {
          // Obtener todos los items del mismo padre (títulos + partidas) mezclados
          // IMPORTANTE: Todos los hermanos (títulos y partidas) se normalizan juntos
          const itemsMismoPadre: Array<{ id: string; tipo: 'TITULO' | 'PARTIDA'; orden: number }> = [];

          // Títulos del padre
          const titulosDelPadre = prevTitulos.filter(t => t.id_titulo_padre === idPadre);
          titulosDelPadre.forEach(t => itemsMismoPadre.push({ id: t.id_titulo, tipo: 'TITULO', orden: t.orden }));

          // Partidas del padre (solo principales, sin id_partida_padre)
          if (idPadre === null) {
            // Si no hay padre, las partidas pertenecen a títulos raíz
            const titulosRaiz = prevTitulos.filter(t => t.id_titulo_padre === null);
            titulosRaiz.forEach(tituloRaiz => {
              const partidasRaiz = prevPartidas.filter(p => p.id_titulo === tituloRaiz.id_titulo && p.id_partida_padre === null);
              partidasRaiz.forEach(p => itemsMismoPadre.push({ id: p.id_partida, tipo: 'PARTIDA', orden: p.orden }));
            });
          } else {
            const partidasDelPadre = prevPartidas.filter(p => p.id_titulo === idPadre && p.id_partida_padre === null);
            partidasDelPadre.forEach(p => itemsMismoPadre.push({ id: p.id_partida, tipo: 'PARTIDA', orden: p.orden }));
          }

          // Ordenar todos los items por orden actual (títulos y partidas juntos)
          itemsMismoPadre.sort((a, b) => a.orden - b.orden);
          
          // Normalizar: asignar órdenes consecutivos
          // Para ROOT: normalizar títulos raíz primero, luego partidas de cada título independientemente
          // Para otros padres: normalizar todos los items juntos (títulos + partidas)
          let titulosActualizados = prevTitulos;
          let partidasActualizadas = prevPartidas;

          if (idPadre === null) {
            // Para ROOT: normalizar títulos raíz primero
            const titulosRaiz = prevTitulos.filter(t => t.id_titulo_padre === null).sort((a, b) => a.orden - b.orden);
            
            titulosActualizados = prevTitulos.map(t => {
              if (t.id_titulo_padre === null) {
                const indice = titulosRaiz.findIndex(tr => tr.id_titulo === t.id_titulo);
                if (indice !== -1) {
                  return { ...t, orden: indice + 1 };
                }
              }
              return t;
            });

            // Luego normalizar partidas de cada título raíz independientemente
            partidasActualizadas = prevPartidas.map(p => {
              const tituloPadre = prevTitulos.find(t => t.id_titulo === p.id_titulo && t.id_titulo_padre === null);
              if (tituloPadre && p.id_partida_padre === null) {
                const partidasDelTitulo = prevPartidas
                  .filter(part => part.id_titulo === p.id_titulo && part.id_partida_padre === null)
                  .sort((a, b) => a.orden - b.orden);
                const indice = partidasDelTitulo.findIndex(part => part.id_partida === p.id_partida);
                if (indice !== -1) {
                  return { ...p, orden: indice + 1 };
                }
              }
              return p;
            });
          } else {
            // Para otros padres: normalizar todos los items juntos (títulos + partidas)
            titulosActualizados = prevTitulos.map(t => {
              if (t.id_titulo_padre === idPadre) {
                const indice = itemsMismoPadre.findIndex(item => item.id === t.id_titulo && item.tipo === 'TITULO');
                if (indice !== -1) {
                  return { ...t, orden: indice + 1 };
                }
              }
              return t;
            });
            
            partidasActualizadas = prevPartidas.map(p => {
              if (p.id_titulo === idPadre && p.id_partida_padre === null) {
                const indice = itemsMismoPadre.findIndex(item => item.id === p.id_partida && item.tipo === 'PARTIDA');
                if (indice !== -1) {
                  return { ...p, orden: indice + 1 };
                }
              }
              return p;
            });
          }
          
          // Actualizar ambos estados
          setTitulos(titulosActualizados);
          return partidasActualizadas;
        });

        return prevTitulos;
      });
    }, 0);
  }, []);

  /**
   * Obtiene todos los items del mismo padre (títulos y partidas) ordenados
   */
  const obtenerItemsMismoPadre = useCallback((id: string): Array<{ id: string; tipo: 'TITULO' | 'PARTIDA'; orden: number }> => {
    const tipo = obtenerTipoItem(id);
    if (!tipo) return [];

    let id_padre: string | null = null;

    if (tipo === 'TITULO') {
      const titulo = titulos.find(t => t.id_titulo === id);
      if (!titulo) return [];
      id_padre = titulo.id_titulo_padre;

      // Obtener títulos del mismo padre
      const titulosMismoPadre = titulos
        .filter(t => t.id_titulo_padre === id_padre)
        .map(t => ({ id: t.id_titulo, tipo: 'TITULO' as const, orden: t.orden }));

      // Obtener partidas del mismo padre (si el padre es un título)
      let partidasMismoPadre: Array<{ id: string; tipo: 'PARTIDA'; orden: number }> = [];
      if (id_padre) {
        partidasMismoPadre = partidas
          .filter(p => p.id_titulo === id_padre && p.id_partida_padre === null)
          .map(p => ({ id: p.id_partida, tipo: 'PARTIDA' as const, orden: p.orden }));
      } else {
        // Si no hay padre, las partidas pertenecen a títulos raíz
        // Por simplicidad, solo consideramos partidas de títulos raíz
        const titulosRaiz = titulos.filter(t => t.id_titulo_padre === null);
        titulosRaiz.forEach(tituloRaiz => {
          const partidasTitulo = partidas
            .filter(p => p.id_titulo === tituloRaiz.id_titulo && p.id_partida_padre === null)
            .map(p => ({ id: p.id_partida, tipo: 'PARTIDA' as const, orden: p.orden }));
          partidasMismoPadre.push(...partidasTitulo);
        });
      }

      // Combinar y ordenar
      return [...titulosMismoPadre, ...partidasMismoPadre].sort((a, b) => a.orden - b.orden);
    } else {
      // Es una partida principal (sin id_partida_padre)
      const partida = partidas.find(p => p.id_partida === id);
      if (!partida) return [];

      // Para partidas principales, el "padre" es el título al que pertenecen
      // Necesitamos obtener todos los items del mismo título (títulos hijos y partidas)
      const id_titulo = partida.id_titulo;

      const itemsMismoPadre: Array<{ id: string; tipo: 'TITULO' | 'PARTIDA'; orden: number }> = [];

      // Obtener títulos hijos del título al que pertenece la partida
      titulos
        .filter(t => t.id_titulo_padre === id_titulo)
        .forEach(t => itemsMismoPadre.push({ id: t.id_titulo, tipo: 'TITULO', orden: t.orden }));

      // Obtener partidas del mismo título (solo principales, sin id_partida_padre)
      partidas
        .filter(p => p.id_titulo === id_titulo && p.id_partida_padre === null)
        .forEach(p => itemsMismoPadre.push({ id: p.id_partida, tipo: 'PARTIDA', orden: p.orden }));

      // Ordenar por orden (títulos y partidas mezclados)
      return itemsMismoPadre.sort((a, b) => a.orden - b.orden);
    }
  }, [titulos, partidas, obtenerTipoItem]);

  /**
   * Crea un nuevo título
   * - Si no hay item seleccionado: crea al final de los títulos sin padre (raíz)
   * - Si hay un título seleccionado: crea como HIJO de ese título
   * - Si hay una partida seleccionada: crea como hijo del título al que pertenece la partida
   */
  const handleCrearTitulo = useCallback(() => {
    let nuevoIdPadre: string | null = null;
    let nuevoNivel = 1;
    let nuevoOrden = 1;

    if (itemSeleccionado) {
      const tipoSeleccionado = obtenerTipoItem(itemSeleccionado);

      if (tipoSeleccionado === 'TITULO') {
        // Si se selecciona un título, crear como HIJO de ese título
        const tituloSeleccionado = titulos.find(t => t.id_titulo === itemSeleccionado);
        if (tituloSeleccionado) {
          nuevoIdPadre = tituloSeleccionado.id_titulo; // El título seleccionado será el padre
          nuevoNivel = tituloSeleccionado.nivel + 1; // Un nivel más profundo

          // Calcular el orden: considerar todos los items del mismo padre (títulos hijos + partidas principales)
          const itemsMismoPadre: Array<{ orden: number }> = [];
          
          // Títulos hijos del título seleccionado
          const titulosHijos = titulos.filter(t => t.id_titulo_padre === tituloSeleccionado.id_titulo);
          titulosHijos.forEach(t => itemsMismoPadre.push({ orden: t.orden }));
          
          // Partidas principales del título seleccionado
          const partidasDelTitulo = partidas.filter(p => p.id_titulo === tituloSeleccionado.id_titulo && p.id_partida_padre === null);
          partidasDelTitulo.forEach(p => itemsMismoPadre.push({ orden: p.orden }));
          
          console.log(`[handleCrearTitulo] Creando título hijo de "${tituloSeleccionado.descripcion}":`, {
            id_padre: tituloSeleccionado.id_titulo,
            titulosHijos: titulosHijos.map(t => ({ id: t.id_titulo, descripcion: t.descripcion, orden: t.orden })),
            partidasDelTitulo: partidasDelTitulo.map(p => ({ id: p.id_partida, descripcion: p.descripcion, orden: p.orden })),
            itemsMismoPadre: itemsMismoPadre.map(item => item.orden),
            nuevoOrden: itemsMismoPadre.length > 0 ? Math.max(...itemsMismoPadre.map(item => item.orden)) + 1 : 1
          });
          
          nuevoOrden = itemsMismoPadre.length > 0
            ? Math.max(...itemsMismoPadre.map(item => item.orden)) + 1
            : 1;
        }
      } else {
        // Si se selecciona una partida, crear como hijo del título al que pertenece la partida
        const partidaSeleccionada = partidas.find(p => p.id_partida === itemSeleccionado);
        if (partidaSeleccionada) {
          nuevoIdPadre = partidaSeleccionada.id_titulo; // El título de la partida será el padre

          // Calcular el nivel basándose en el título padre
          const tituloPadre = titulos.find(t => t.id_titulo === partidaSeleccionada.id_titulo);
          if (tituloPadre) {
            nuevoNivel = tituloPadre.nivel + 1;
          }

          // Calcular el orden: considerar todos los items del mismo padre (títulos hijos + partidas principales)
          const itemsMismoPadre: Array<{ orden: number }> = [];
          
          // Títulos hijos del título padre
          const titulosHijos = titulos.filter(t => t.id_titulo_padre === partidaSeleccionada.id_titulo);
          titulosHijos.forEach(t => itemsMismoPadre.push({ orden: t.orden }));
          
          // Partidas principales del título padre
          const partidasDelTitulo = partidas.filter(p => p.id_titulo === partidaSeleccionada.id_titulo && p.id_partida_padre === null);
          partidasDelTitulo.forEach(p => itemsMismoPadre.push({ orden: p.orden }));
          
          nuevoOrden = itemsMismoPadre.length > 0
            ? Math.max(...itemsMismoPadre.map(item => item.orden)) + 1
            : 1;
        }
      }
    } else {
      // No hay item seleccionado: crear al final de los títulos raíz (sin padre)
      // Para títulos raíz, solo considerar otros títulos raíz (no mezclar con partidas)
      const titulosRaiz = titulos.filter(t => t.id_titulo_padre === null);

      nuevoOrden = titulosRaiz.length > 0
        ? Math.max(...titulosRaiz.map(t => t.orden)) + 1
        : 1;
    }

    // Preparar el modal para crear nuevo título
    setTituloEditando(null);
    setPartidaEditando(null);
    setNombreItem('');
    setTipoItemModal('TITULO');
    setUsarPlantillaTituloModal(false); // Siempre abrir en "Nuevo título"
    setModalAbierto(true);

    // Guardar temporalmente los datos del nuevo título
    (window as any).__nuevoTituloTemp = {
      id_padre: nuevoIdPadre,
      nivel: nuevoNivel,
      orden: nuevoOrden,
    };
  }, [itemSeleccionado, titulos, partidas, obtenerTipoItem]);

  /**
   * Crea un nuevo partida (prepara el modal)
   * - Si no hay item seleccionado: crea al final de los títulos raíz
   * - Si hay un título seleccionado: crea como partida del título
   * - Si hay una partida seleccionada: crea como hermano de la partida
   */
  const handleCrearPartida = useCallback(() => {
    let nuevoIdTitulo: string | null = null;
    let nuevoNivel = 1;
    let nuevoOrden = 1;

    if (itemSeleccionado) {
      const tipoSeleccionado = obtenerTipoItem(itemSeleccionado);

      if (tipoSeleccionado === 'TITULO') {
        // Si se selecciona un título, crear partida dentro de ese título
        nuevoIdTitulo = itemSeleccionado;
        const tituloSeleccionado = titulos.find(t => t.id_titulo === itemSeleccionado);
        if (tituloSeleccionado) {
          nuevoNivel = 1;

          // Calcular el orden: considerar todos los items del mismo título (títulos hijos + partidas principales)
          const itemsMismoTitulo: Array<{ orden: number }> = [];
          
          // Títulos hijos del título seleccionado
          const titulosHijos = titulos.filter(t => t.id_titulo_padre === nuevoIdTitulo);
          titulosHijos.forEach(t => itemsMismoTitulo.push({ orden: t.orden }));
          
          // Partidas principales del título seleccionado
          const partidasDelTitulo = partidas.filter(p => p.id_titulo === nuevoIdTitulo && p.id_partida_padre === null);
          partidasDelTitulo.forEach(p => itemsMismoTitulo.push({ orden: p.orden }));
          
          console.log(`[handleCrearPartida] Creando partida en título "${tituloSeleccionado.descripcion}":`, {
            id_titulo: nuevoIdTitulo,
            titulosHijos: titulosHijos.map(t => ({ id: t.id_titulo, descripcion: t.descripcion, orden: t.orden })),
            partidasDelTitulo: partidasDelTitulo.map(p => ({ id: p.id_partida, descripcion: p.descripcion, orden: p.orden })),
            itemsMismoTitulo: itemsMismoTitulo.map(item => item.orden),
            nuevoOrden: itemsMismoTitulo.length > 0 ? Math.max(...itemsMismoTitulo.map(item => item.orden)) + 1 : 1
          });
          
          nuevoOrden = itemsMismoTitulo.length > 0
            ? Math.max(...itemsMismoTitulo.map(item => item.orden)) + 1
            : 1;
        }
      } else {
        // Si se selecciona una partida, crear como hermano (mismo título)
        const partidaSeleccionada = partidas.find(p => p.id_partida === itemSeleccionado);
        if (partidaSeleccionada) {
          nuevoIdTitulo = partidaSeleccionada.id_titulo;
          nuevoNivel = partidaSeleccionada.nivel_partida;

          // Obtener todos los hermanos (títulos y partidas) del mismo título
          const hermanos = obtenerItemsMismoPadre(itemSeleccionado);
          nuevoOrden = hermanos.length > 0
            ? Math.max(...hermanos.map(h => h.orden)) + 1
            : 1;
        }
      }
    } else {
      // No hay item seleccionado: crear en el primer título raíz
      const titulosRaiz = titulos.filter(t => t.id_titulo_padre === null).sort((a, b) => a.orden - b.orden);
      if (titulosRaiz.length > 0) {
        nuevoIdTitulo = titulosRaiz[0].id_titulo;
        
        // Calcular el orden: considerar todos los items del mismo título (títulos hijos + partidas principales)
        const itemsMismoTitulo: Array<{ orden: number }> = [];
        
        // Títulos hijos del título raíz
        const titulosHijos = titulos.filter(t => t.id_titulo_padre === nuevoIdTitulo);
        titulosHijos.forEach(t => itemsMismoTitulo.push({ orden: t.orden }));
        
        // Partidas principales del título raíz
        const partidasDelTitulo = partidas.filter(p => p.id_titulo === nuevoIdTitulo && p.id_partida_padre === null);
        partidasDelTitulo.forEach(p => itemsMismoTitulo.push({ orden: p.orden }));
        
        nuevoOrden = itemsMismoTitulo.length > 0
          ? Math.max(...itemsMismoTitulo.map(item => item.orden)) + 1
          : 1;
      }
    }

    // Si no hay título disponible, no crear
    if (!nuevoIdTitulo) {
      return;
    }

    // Preparar el modal para crear nueva partida
    setPartidaEditando(null);
    setTituloEditando(null);
    setNombreItem('');
    setTipoItemModal('PARTIDA');
    setUsarPlantillaTituloModal(false); // Siempre abrir en "Nueva partida"
    setModalAbierto(true);

    // Guardar temporalmente los datos de la nueva partida en el estado
    // Usaremos un objeto temporal que se guardará cuando se confirme el nombre
    (window as any).__nuevaPartidaTemp = {
      id_titulo: nuevoIdTitulo,
      nivel_partida: nuevoNivel,
      orden: nuevoOrden,
    };
  }, [itemSeleccionado, titulos, partidas, obtenerTipoItem, obtenerItemsMismoPadre, modoSeleccionMultiple]);

  /**
   * Abre el modal para editar un título existente
   */
  const handleEditarTitulo = useCallback((id_titulo: string) => {
    const titulo = titulos.find(t => t.id_titulo === id_titulo);
    if (titulo) {
      setTituloEditando(titulo);
      setPartidaEditando(null);
      setNombreItem(titulo.descripcion);
      setTipoItemModal('TITULO');
      setModalAbierto(true);
    }
  }, [titulos]);

  /**
   * Abre el modal para editar una partida existente
   */
  const handleEditarPartida = useCallback((id_partida: string) => {
    const partida = partidas.find(p => p.id_partida === id_partida);
    if (partida) {
      setPartidaEditando(partida);
      setTituloEditando(null);
      setNombreItem(partida.descripcion);
      setTipoItemModal('PARTIDA');
      setModalAbierto(true);
    }
  }, [partidas]);

  /**
   * Genera un ID temporal único para nuevos items
   */
  const generarIdTemporal = useCallback((): string => {
    contadorIdTemporal.current += 1;
    return `temp_${Date.now()}_${contadorIdTemporal.current}`;
  }, []);

  /**
   * Guarda el item (título o partida) - solo en estado local, NO en la base de datos
   */
  const handleGuardarItem = useCallback((nombreGuardar: string, partidaData?: { unidad_medida: string; metrado: number; precio_unitario: number; parcial_partida: number }, id_especialidad?: string | null) => {
    // Validar que el nombre no esté vacío
    if (!nombreGuardar || !nombreGuardar.trim()) {
      // Si está editando y el nombre está vacío, no hacer nada y mantener el modal abierto
      if (tituloEditando || partidaEditando) {
        return; // No cerrar el modal, solo retornar
      }
      // Si está creando, no hacer nada
      return;
    }

    if (tipoItemModal === 'TITULO') {
      if (tituloEditando) {
        // Actualizar título existente solo en estado local
        setTitulos(prev => prev.map(t =>
          t.id_titulo === tituloEditando.id_titulo
            ? { ...t, descripcion: nombreGuardar.trim(), id_especialidad: id_especialidad !== undefined ? id_especialidad : t.id_especialidad }
            : t
        ));
      } else {
        // Crear nuevo título solo en estado local
        const tempData = (window as any).__nuevoTituloTemp;
        if (tempData && id_proyecto_real) {
          // Calcular el nivel correcto basándose en el padre
          const nivelCalculado = tempData.id_padre
            ? calcularNivelDinamico(tempData.id_padre) + 1
            : 1;

          // Generar numero_item temporal basado en el orden
          let numeroItemTemporal = tempData.orden.toString().padStart(2, '0');
          if (tempData.id_padre) {
            const tituloPadre = titulos.find(t => t.id_titulo === tempData.id_padre);
            if (tituloPadre && tituloPadre.numero_item) {
              numeroItemTemporal = `${tituloPadre.numero_item}.${numeroItemTemporal}`;
            }
          }

          const nuevoTitulo: Titulo = {
            id_titulo: generarIdTemporal(), // ID temporal
            id_presupuesto: id_presupuesto,
            id_titulo_padre: tempData.id_padre || null,
            nivel: nivelCalculado,
            numero_item: numeroItemTemporal,
            descripcion: nombreGuardar.trim(),
            tipo: nivelCalculado === 1 ? 'TITULO' : 'SUBTITULO',
            orden: tempData.orden,
            total_parcial: 0,
            id_especialidad: id_especialidad || null,
          };

          setTitulos(prev => [...prev, nuevoTitulo]);
          if (modoSeleccionMultiple) {
            setItemsSeleccionadosMultiple(new Set([nuevoTitulo.id_titulo]));
          } else {
            setItemSeleccionado(nuevoTitulo.id_titulo);
          }
          delete (window as any).__nuevoTituloTemp;
        }
      }
    } else {
      // PARTIDA
      if (partidaEditando) {
        // Actualizar partida existente solo en estado local con todos los campos
        setPartidas(prev => prev.map(p => {
          if (p.id_partida === partidaEditando.id_partida) {
            const updated = { ...p, descripcion: nombreGuardar.trim() };
            if (partidaData) {
              updated.unidad_medida = partidaData.unidad_medida || p.unidad_medida;
              updated.metrado = partidaData.metrado ?? p.metrado;
              updated.precio_unitario = partidaData.precio_unitario ?? p.precio_unitario;
              updated.parcial_partida = partidaData.parcial_partida ?? (updated.metrado * updated.precio_unitario);
            }
            return updated;
          }
          return p;
        }));
      } else {
        // Crear nueva partida solo en estado local
        const tempData = (window as any).__nuevaPartidaTemp;
        if (tempData && id_proyecto_real) {
          // Generar numero_item temporal basado en el título y orden
          const tituloPadre = titulos.find(t => t.id_titulo === tempData.id_titulo);
          let numeroItemTemporal = tempData.orden.toString().padStart(2, '0');
          if (tituloPadre && tituloPadre.numero_item) {
            numeroItemTemporal = `${tituloPadre.numero_item}.${numeroItemTemporal}`;
          }

          const nuevaPartida: Partida = {
            id_partida: generarIdTemporal(), // ID temporal
            id_presupuesto: id_presupuesto,
            id_proyecto: id_proyecto_real,
            id_titulo: tempData.id_titulo,
            id_partida_padre: null,
            nivel_partida: tempData.nivel_partida,
            numero_item: numeroItemTemporal,
            descripcion: nombreGuardar.trim(),
            unidad_medida: partidaData?.unidad_medida || 'und',
            metrado: partidaData?.metrado || 0,
            precio_unitario: partidaData?.precio_unitario || 0,
            parcial_partida: partidaData?.parcial_partida || (partidaData ? (partidaData.metrado * partidaData.precio_unitario) : 0),
            orden: tempData.orden,
            estado: 'Activa',
          };

          setPartidas(prev => [...prev, nuevaPartida]);
          if (modoSeleccionMultiple) {
            setItemsSeleccionadosMultiple(new Set([nuevaPartida.id_partida]));
          } else {
            setItemSeleccionado(nuevaPartida.id_partida);
          }
          delete (window as any).__nuevaPartidaTemp;
        }
      }
    }

    // Cerrar modal
    setModalAbierto(false);
    setTituloEditando(null);
    setPartidaEditando(null);
    setNombreItem('');
    setUsarPlantillaTituloModal(false); // Resetear estado de plantilla al guardar
    setModalMantenerAPUs(true); // Resetear checkbox de mantener APUs
  }, [tituloEditando, partidaEditando, tipoItemModal, id_presupuesto, id_proyecto_real, calcularNivelDinamico, titulos, generarIdTemporal]);

  /**
   * Integra una estructura completa de plantilla (título + descendientes) de forma limpia
   * sin mantener referencias a IDs originales de la plantilla
   */
  const handleIntegrarEstructura = useCallback(async (idTituloRaiz: string, estructuraPlantilla: { titulos: any[], partidas: any[], apus?: any[], precios_compartidos?: any[] }, mantenerAPUs: boolean = false, preciosCompartidosProyecto?: any[]) => {
    // Evitar ejecuciones duplicadas
    if (integrandoPlantilla) {
      return;
    }

    setIntegrandoPlantilla(true);
    // 1. Filtrar la estructura para obtener solo el título raíz y sus descendientes
    const tituloRaiz = estructuraPlantilla.titulos.find(t => t.id_titulo === idTituloRaiz);
    if (!tituloRaiz) return;

    // Obtener todos los títulos descendientes
    const obtenerDescendientes = (idPadre: string): any[] => {
      const hijos = estructuraPlantilla.titulos.filter(t => t.id_titulo_padre === idPadre);
      let todos = [...hijos];
      hijos.forEach(hijo => {
        todos = todos.concat(obtenerDescendientes(hijo.id_titulo));
      });
      return todos;
    };

    const titulosDescendientes = obtenerDescendientes(idTituloRaiz);
    const todosLosTitulos = [tituloRaiz, ...titulosDescendientes];

    // Obtener precios del proyecto actual para verificaciones
    const preciosProyectoActual = preciosCompartidosProyecto || [];

    // 2. Filtrar APUs y precios compartidos SOLO si mantenerAPUs está activado
    let apusRelevantes: any[] = [];
    let preciosRelevantes: any[] = [];
    let mapaPreciosExistentes = new Map<string, string>(); // id_precio_plantilla -> id_precio_proyecto

    let integrationSuccess = false;
    try {
      if (mantenerAPUs) {
        console.log('🔧 MODO "Mantener APUs y detalles" ACTIVADO');
      } else {
      }


    // 3. Crear mapas de IDs temporales
    const mapaIdsTitulos = new Map<string, string>();
    todosLosTitulos.forEach(titulo => {
      mapaIdsTitulos.set(titulo.id_titulo, generarIdTemporal());
    });

    // Obtener todas las partidas relacionadas con los títulos
    const partidasRelacionadas = estructuraPlantilla.partidas.filter(partida =>
      todosLosTitulos.some(titulo => titulo.id_titulo === partida.id_titulo)
    );

    const mapaIdsPartidas = new Map<string, string>();
    partidasRelacionadas.forEach(partida => {
      mapaIdsPartidas.set(partida.id_partida, generarIdTemporal());
    });

    // Filtrar APUs que corresponden SOLO a las partidas que se van a copiar
    if (mantenerAPUs) {
      // 2.2 Obtener IDs de TODAS las partidas relacionadas (incluyendo subpartidas)
      const idsPartidasNuevas = new Set<string>();
      partidasRelacionadas.forEach(partida => idsPartidasNuevas.add(partida.id_partida));

      // 2.3 Filtrar APUs que corresponden SOLO a las partidas que se van a copiar
      const todosLosAPUsPlantilla = (estructuraPlantilla.apus || []);
      apusRelevantes = todosLosAPUsPlantilla.filter(apu =>
        idsPartidasNuevas.has(apu.id_partida)
      );

      // Calcular APUs excluidos para el resumen
      const apusExcluidos = todosLosAPUsPlantilla.filter(apu =>
        !idsPartidasNuevas.has(apu.id_partida)
      );

      console.log('🔧 Filtrado de APUs:');
      console.log(`  └─ Plantilla: ${todosLosAPUsPlantilla.length} | Copiadas: ${idsPartidasNuevas.size} | Relevantes: ${apusRelevantes.length} | Excluidas: ${apusExcluidos.length}`);

      // 2.4 Extraer IDs únicos de precios compartidos usados por estos APUs
      const idsPreciosNecesarios = new Set<string>();
      apusRelevantes.forEach((apu: any) => {
        apu.recursos.forEach((recurso: any) => {
          if (recurso.id_precio_recurso) {
            idsPreciosNecesarios.add(recurso.id_precio_recurso);
          }
        });
      });

      // 2.5 Filtrar precios compartidos relevantes
      preciosRelevantes = (estructuraPlantilla.precios_compartidos || []).filter((precio: any) =>
        idsPreciosNecesarios.has(precio.id_precio_recurso)
      );

    }

    // Crear mapas para APUs y precios si mantenerAPUs está activado
    const mapaIdsAPUs = new Map<string, string>();
    const mapaIdsPrecios = new Map<string, string>();

    if (mantenerAPUs) {
      apusRelevantes.forEach(apu => {
        mapaIdsAPUs.set(apu.id_apu, generarIdTemporal());
      });

      // Solo crear temp IDs para precios que NO existen en el proyecto
      preciosRelevantes.forEach(precio => {
        const precioExistente = preciosProyectoActual.find(pc =>
          pc.recurso_id === precio.recurso_id
        );

        if (!precioExistente) {
          // Solo crear temp ID si NO existe precio para este recurso
          mapaIdsPrecios.set(precio.id_precio_recurso, generarIdTemporal());
        }
        // Si existe, simplemente no lo incluimos (no se crea temp ID)
      });
    }

    // 4. Preparar datos temporales para la integración
    const tempData = (window as any).__nuevoTituloTemp;
    if (!tempData || !id_proyecto_real) return;

    // Calcular el nivel correcto basándose en el padre
    const nivelCalculado = tempData.id_padre
      ? calcularNivelDinamico(tempData.id_padre) + 1
      : 1;

    // 5. Crear los nuevos títulos con IDs únicos y órdenes jerárquicos correctos
    const nuevosTitulos: Titulo[] = [];


    // Función para calcular el orden correcto para un título basado en su padre
    const calcularOrdenParaTitulo = (idPadre: string | null, indexEnGrupo: number): number => {
      if (idPadre === null) {
        // Para títulos raíz: orden máximo actual + index + 1
        const titulosRaiz = titulos.filter(t => t.id_titulo_padre === null);
        const ordenMaximoRaiz = titulosRaiz.length > 0 ? Math.max(...titulosRaiz.map(t => t.orden)) : 0;
        return ordenMaximoRaiz + indexEnGrupo + 1;
      } else {
        // Para títulos con padre: obtener todos los hermanos (títulos + partidas) y calcular orden
        const titulosHermano = titulos.filter(t => t.id_titulo_padre === idPadre);
        const partidasHermano = partidas.filter(p => p.id_titulo === idPadre && p.id_partida_padre === null);
        const ordenesHermano = [...titulosHermano.map(t => t.orden), ...partidasHermano.map(p => p.orden)];
        const ordenMaximoHermano = ordenesHermano.length > 0 ? Math.max(...ordenesHermano) : 0;
        return ordenMaximoHermano + indexEnGrupo + 1;
      }
    };

    // Agrupar títulos por padre para calcular órdenes correctamente
    const titulosPorPadre = new Map<string | null, any[]>();
    todosLosTitulos.forEach(titulo => {
      const idPadreNuevo = titulo.id_titulo_padre
        ? mapaIdsTitulos.get(titulo.id_titulo_padre) || null
        : (tempData.id_padre || null);

      if (!titulosPorPadre.has(idPadreNuevo)) {
        titulosPorPadre.set(idPadreNuevo, []);
      }
      titulosPorPadre.get(idPadreNuevo)!.push(titulo);
    });

    // Crear títulos con órdenes correctos por grupo de padre
    titulosPorPadre.forEach((titulosDelPadre, idPadre) => {
      titulosDelPadre.forEach((tituloPlantilla, index) => {
        const nuevoId = mapaIdsTitulos.get(tituloPlantilla.id_titulo)!;
        const ordenFinal = calcularOrdenParaTitulo(idPadre, index);

        const nuevoTitulo: Titulo = {
          id_titulo: nuevoId,
          id_presupuesto: id_presupuesto!,
          id_titulo_padre: idPadre,
          nivel: tituloPlantilla.id_titulo_padre ? calcularNivelDinamico(idPadre!) + 1 : nivelCalculado,
          numero_item: '', // Se calculará dinámicamente al guardar
          descripcion: tituloPlantilla.descripcion,
          tipo: tituloPlantilla.tipo,
          orden: ordenFinal,
          total_parcial: tituloPlantilla.total_parcial,
          id_especialidad: tituloPlantilla.id_especialidad
        };

        nuevosTitulos.push(nuevoTitulo);
      });
    });

    // 6. Crear las nuevas partidas con IDs únicos y órdenes jerárquicos correctos
    const nuevasPartidas: Partida[] = [];

    // Función para calcular el orden correcto para una partida dentro de su título padre
    const calcularOrdenParaPartida = (idTitulo: string, indexEnGrupo: number): number => {
      // Obtener todas las partidas principales del título (sin id_partida_padre)
      const partidasMismoTitulo = partidas.filter(p => p.id_titulo === idTitulo && p.id_partida_padre === null);
      const ordenMaximoPartidas = partidasMismoTitulo.length > 0 ? Math.max(...partidasMismoTitulo.map(p => p.orden)) : 0;
      return ordenMaximoPartidas + indexEnGrupo + 1;
    };

    // Agrupar partidas por título padre para calcular órdenes correctamente
    const partidasPorTitulo = new Map<string, any[]>();
    partidasRelacionadas.forEach(partida => {
      // Solo procesar partidas principales (sin padre), las subpartidas se manejan recursivamente
      if (partida.id_partida_padre === null) {
        const nuevoIdTitulo = mapaIdsTitulos.get(partida.id_titulo)!;
        if (!partidasPorTitulo.has(nuevoIdTitulo)) {
          partidasPorTitulo.set(nuevoIdTitulo, []);
        }
        partidasPorTitulo.get(nuevoIdTitulo)!.push(partida);
      }
    });

    // Crear partidas principales con órdenes correctos
    partidasPorTitulo.forEach((partidasDelTitulo, nuevoIdTitulo) => {
      partidasDelTitulo.forEach((partidaPlantilla, index) => {
        const nuevoIdPartida = mapaIdsPartidas.get(partidaPlantilla.id_partida)!;
        const ordenFinal = calcularOrdenParaPartida(nuevoIdTitulo, index);

        const nuevaPartida: Partida = {
          id_partida: nuevoIdPartida,
          id_presupuesto: id_presupuesto!,
          id_proyecto: id_proyecto_real,
          id_titulo: nuevoIdTitulo,
          id_partida_padre: null, // Es partida principal
          nivel_partida: 1, // Partidas principales siempre nivel 1
          numero_item: '', // Se calculará dinámicamente al guardar
          descripcion: partidaPlantilla.descripcion,
          unidad_medida: partidaPlantilla.unidad_medida,
          metrado: partidaPlantilla.metrado,
          precio_unitario: mantenerAPUs && partidaPlantilla.precio_unitario ? partidaPlantilla.precio_unitario : 0,
          parcial_partida: mantenerAPUs && partidaPlantilla.parcial_partida ? partidaPlantilla.parcial_partida : 0,
          orden: ordenFinal,
          estado: partidaPlantilla.estado
        };

        nuevasPartidas.push(nuevaPartida);

        // Procesar subpartidas recursivamente
        const procesarSubpartidas = (idPartidaPadre: string, idNuevoPartidaPadre: string, nivel: number) => {
          const subpartidas = partidasRelacionadas.filter(p => p.id_partida_padre === idPartidaPadre);
          subpartidas.forEach((subpartida, subIndex) => {
            const nuevoIdSubpartida = mapaIdsPartidas.get(subpartida.id_partida)!;

            // Para subpartidas, el orden es relativo dentro de su padre
            const ordenSubpartida = subIndex + 1;

            const nuevaSubpartida: Partida = {
              id_partida: nuevoIdSubpartida,
              id_presupuesto: id_presupuesto!,
              id_proyecto: id_proyecto_real,
              id_titulo: nuevoIdTitulo,
              id_partida_padre: idNuevoPartidaPadre,
              nivel_partida: nivel,
              numero_item: '', // Se calculará dinámicamente al guardar
              descripcion: subpartida.descripcion,
              unidad_medida: subpartida.unidad_medida,
              metrado: subpartida.metrado,
              precio_unitario: mantenerAPUs && subpartida.precio_unitario ? subpartida.precio_unitario : 0,
              parcial_partida: mantenerAPUs && subpartida.parcial_partida ? subpartida.parcial_partida : 0,
              orden: ordenSubpartida,
              estado: subpartida.estado
            };

            nuevasPartidas.push(nuevaSubpartida);

            // Procesar subpartidas recursivamente
            procesarSubpartidas(subpartida.id_partida, nuevoIdSubpartida, nivel + 1);
          });
        };

        procesarSubpartidas(partidaPlantilla.id_partida, nuevoIdPartida, 2);
      });
    });


    // 7. Crear APUs y precios compartidos nuevos si mantenerAPUs está activado
    const nuevosAPUsParaEstado: any[] = [];
    const nuevosPreciosParaEstado: import('@/hooks/usePresupuestos').PrecioCompartidoNuevo[] = [];

    if (mantenerAPUs) {
      // Crear APUs - mapear IDs de partida a los nuevos IDs temporales asignados
      apusRelevantes.forEach(apu => {
        const nuevoIdAPU = mapaIdsAPUs.get(apu.id_apu)!;
        const idPartidaOriginal = mapaIdsPartidas.get(apu.id_partida) || apu.id_partida;

        // Actualizar referencias de recursos a precios
        const recursosActualizados = apu.recursos.map((recurso: any, index: number) => {
          // Generar ID único para el recurso (requerido por MongoDB)
          const idRecursoApu = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`;

          // Mapear campos según RecursoApuInput (con id_recurso_apu requerido, precio -> precio_usuario)
          let recursoMapeado: any = {
            id_recurso_apu: idRecursoApu, // ← Campo requerido agregado
            recurso_id: recurso.recurso_id,
            id_partida_subpartida: recurso.id_partida_subpartida,
            codigo_recurso: recurso.codigo_recurso,
            descripcion: recurso.descripcion,
            unidad_medida: recurso.unidad_medida,
            tipo_recurso: recurso.tipo_recurso,
            tipo_recurso_codigo: recurso.tipo_recurso_codigo, // ← Agregado
            precio_usuario: recurso.precio, // Cambiar 'precio' a 'precio_usuario'
            precio_unitario_subpartida: recurso.precio_unitario_subpartida,
            tiene_precio_override: recurso.tiene_precio_override,
            precio_override: recurso.precio_override,
            cuadrilla: recurso.cuadrilla,
            cantidad: recurso.cantidad,
            desperdicio_porcentaje: recurso.desperdicio_porcentaje,
            cantidad_con_desperdicio: recurso.cantidad_con_desperdicio,
            parcial: recurso.parcial,
            orden: recurso.orden
          };

          // Solo agregar id_precio_recurso si existe y está disponible
          if (recurso.id_precio_recurso) {
            const precioExistente = preciosProyectoActual.find(pc =>
              pc.recurso_id === recurso.recurso_id
            );

            if (precioExistente) {
              // Usar el precio existente del proyecto
              recursoMapeado.id_precio_recurso = precioExistente.id_precio_recurso;
            } else {
              // Usar el temp ID del precio nuevo
              const tempIdPrecio = mapaIdsPrecios.get(recurso.id_precio_recurso);
              recursoMapeado.id_precio_recurso = tempIdPrecio || null;
            }
          }

          return recursoMapeado;
        });

        // Mapear el ID de partida al nuevo ID temporal asignado a la partida
        const nuevoIdPartidaMapeado = mapaIdsPartidas.get(apu.id_partida) || apu.id_partida;

        nuevosAPUsParaEstado.push({
          id_apu: nuevoIdAPU,
          id_partida: nuevoIdPartidaMapeado, // Usar el nuevo ID temporal asignado a la partida
          rendimiento: apu.rendimiento,
          jornada: apu.jornada,
          recursos: recursosActualizados
        });
      });

      console.log(`🔗 APUs asignadas a IDs temporales: ${nuevosAPUsParaEstado.length}`);

      // Crear precios compartidos nuevos (solo los que no existen)
      preciosRelevantes.forEach(precio => {
        if (mapaIdsPrecios.has(precio.id_precio_recurso)) {
          const nuevoIdPrecio = mapaIdsPrecios.get(precio.id_precio_recurso)!;
          nuevosPreciosParaEstado.push({
            id_precio_recurso: nuevoIdPrecio,
            id_presupuesto: id_presupuesto, // Requerido para creación
            recurso_id: precio.recurso_id,
            codigo_recurso: precio.codigo_recurso, // Ya disponible en la plantilla
            descripcion: precio.descripcion, // Ya disponible en la plantilla
            unidad: precio.unidad, // Ya disponible en la plantilla
            tipo_recurso: precio.tipo_recurso, // Ya disponible en la plantilla
            precio: precio.precio,
            fecha_actualizacion: new Date().toISOString(), // Timestamp actual
            usuario_actualizo: 'PLANTILLA' // Identificador de origen
          });
        }
      });
    }

    // 8. Agregar todo a la estructura local
    setTitulos(prev => {
      // Insertar los nuevos títulos manteniendo el orden
      const titulosOrdenados = [...prev, ...nuevosTitulos].sort((a, b) => a.orden - b.orden);
      return titulosOrdenados;
    });

    setPartidas(prev => {
      // Insertar las nuevas partidas manteniendo el orden
      const partidasOrdenadas = [...prev, ...nuevasPartidas].sort((a, b) => a.orden - b.orden);
      return partidasOrdenadas;
    });

    // 9. Agregar elementos temporales a estados combinados (igual que títulos/partidas)
    if (mantenerAPUs) {
      // Agregar elementos temporales a estados combinados (se mostrarán inmediatamente)

      const nuevosApus = [...apusTemporales, ...nuevosAPUsParaEstado];
      const nuevosPrecios = [...preciosCompartidosTemporales, ...nuevosPreciosParaEstado];

      setApusTemporales(nuevosApus);
      setPreciosCompartidosTemporales(nuevosPrecios);



      // Marcar como exitoso y cerrar modal
      integrationSuccess = true;
      setModalAbierto(false);
      setIntegrandoPlantilla(false);
      return;
    }


    // 8. Normalizar los órdenes después de la inserción
    setTimeout(() => {
      // Normalizar el padre donde se insertaron los títulos
      const padresAfectados = new Set<string | null>();
      nuevosTitulos.forEach(titulo => {
        padresAfectados.add(titulo.id_titulo_padre);
      });

      // Normalizar cada padre afectado
      padresAfectados.forEach(padre => {
        reordenarItemsPadre(padre);
      });

      // Si se agregaron títulos raíz, normalizar también
      if (padresAfectados.has(null)) {
        reordenarItemsPadre(null);
      }
    }, 0);

        // 9. Cerrar modal y limpiar estado
      integrationSuccess = true;
      setModalAbierto(false);
      setTituloEditando(null);
      setPartidaEditando(null);
      setNombreItem('');
      setIntegrandoPlantilla(false);
    } finally {
      // Asegurar que siempre se cierre el modal y se resete el estado, incluso si hay errores
      if (!integrationSuccess) {
        setModalAbierto(false);
        setIntegrandoPlantilla(false);
      }
    }
  }, [generarIdTemporal, calcularNivelDinamico, id_presupuesto, id_proyecto_real, setTitulos, setPartidas, setModalAbierto, setTituloEditando, setPartidaEditando, setNombreItem, integrandoPlantilla, setIntegrandoPlantilla]);

  /**
   * Integra múltiples partidas seleccionadas de plantilla con sus APUs correspondientes
   * Usa el mismo sistema unificado que handleIntegrarEstructura
   */
  const handleIntegrarPartidasSeleccionadas = useCallback(async (
    idsPartidasSeleccionadas: string[],
    estructuraPlantilla: { titulos: any[], partidas: any[], apus?: any[], precios_compartidos?: any[] },
    mantenerAPUs: boolean = false,
    preciosCompartidosProyecto?: any[]
  ) => {
    // Evitar ejecuciones duplicadas
    if (integrandoPlantilla) {
      return;
    }

    setIntegrandoPlantilla(true);
    let integrationSuccess = false;

    try {
      console.log('🔄 Iniciando integración de múltiples partidas seleccionadas:', idsPartidasSeleccionadas);

      // 1. Filtrar SOLO las partidas seleccionadas
      const partidasSeleccionadas = estructuraPlantilla.partidas.filter(p =>
        idsPartidasSeleccionadas.includes(p.id_partida)
      );

      if (partidasSeleccionadas.length === 0) {
        console.log('❌ No se encontraron partidas seleccionadas');
        return;
      }

      // Obtener precios del proyecto actual para verificaciones
      const preciosProyectoActual = preciosCompartidosProyecto || [];

      // 2. Filtrar APUs y precios compartidos SOLO si mantenerAPUs está activado
      let apusRelevantes: any[] = [];
      let preciosRelevantes: any[] = [];
      let mapaPreciosExistentes = new Map<string, string>();

      if (mantenerAPUs) {
        console.log('🔧 MODO "Mantener APUs y detalles" ACTIVADO para múltiples partidas');

        // 2.1 Filtrar APUs que corresponden SOLO a las partidas seleccionadas
        const todosLosAPUsPlantilla = (estructuraPlantilla.apus || []);
        apusRelevantes = todosLosAPUsPlantilla.filter(apu =>
          idsPartidasSeleccionadas.includes(apu.id_partida)
        );

        console.log('🔧 Filtrado de APUs para partidas seleccionadas:');
        console.log(`  └─ Plantilla: ${todosLosAPUsPlantilla.length} | Partidas seleccionadas: ${idsPartidasSeleccionadas.length} | APUs relevantes: ${apusRelevantes.length}`);

        // 2.2 Extraer IDs únicos de precios compartidos usados por estos APUs
        const idsPreciosNecesarios = new Set<string>();
        apusRelevantes.forEach((apu: any) => {
          apu.recursos.forEach((recurso: any) => {
            if (recurso.id_precio_recurso) {
              idsPreciosNecesarios.add(recurso.id_precio_recurso);
            }
          });
        });

        // 2.3 Filtrar precios compartidos relevantes
        preciosRelevantes = (estructuraPlantilla.precios_compartidos || []).filter((precio: any) =>
          idsPreciosNecesarios.has(precio.id_precio_recurso)
        );
      }

      // 3. Preparar temp data para múltiples partidas (usa el mismo sistema)
      const tempData = (window as any).__nuevaPartidaTemp;
      if (!tempData || !id_proyecto_real) return;

      // 4. Crear mapas de IDs temporales
      const mapaIdsPartidas = new Map<string, string>();
      partidasSeleccionadas.forEach(partida => {
        mapaIdsPartidas.set(partida.id_partida, generarIdTemporal());
      });

      // Crear mapas para APUs y precios si mantenerAPUs está activado
      const mapaIdsAPUs = new Map<string, string>();
      const mapaIdsPrecios = new Map<string, string>();

      if (mantenerAPUs) {
        apusRelevantes.forEach(apu => {
          mapaIdsAPUs.set(apu.id_apu, generarIdTemporal());
        });

        // Solo crear temp IDs para precios que NO existen en el proyecto
        preciosRelevantes.forEach(precio => {
          const precioExistente = preciosProyectoActual.find(pc =>
            pc.recurso_id === precio.recurso_id
          );

          if (!precioExistente) {
            // Solo crear temp ID si NO existe precio para este recurso
            mapaIdsPrecios.set(precio.id_precio_recurso, generarIdTemporal());
          }
          // Si existe, simplemente no lo incluimos (no se crea temp ID)
        });
      }

      // 5. Crear las nuevas partidas con ordenamiento CONSECUTIVO
      const nuevasPartidas: Partida[] = [];

      // Calcular orden base para las nuevas partidas consecutivas
      const ordenBase = tempData.id_titulo
        ? (() => {
            // Si hay un título específico, calcular orden después de las partidas existentes
            const partidasMismoTitulo = partidas.filter(p => p.id_titulo === tempData.id_titulo && p.id_partida_padre === null);
            const ordenMaximo = partidasMismoTitulo.length > 0 ? Math.max(...partidasMismoTitulo.map(p => p.orden)) : 0;
            return ordenMaximo;
          })()
        : (() => {
            // Para raíz, calcular el orden máximo global
            const todasLasPartidas = partidas.filter(p => p.id_partida_padre === null);
            const ordenMaximo = todasLasPartidas.length > 0 ? Math.max(...todasLasPartidas.map(p => p.orden)) : 0;
            return ordenMaximo;
          })();

      // Crear partidas con ordenamiento consecutivo
      partidasSeleccionadas.forEach((partidaPlantilla, index) => {
        const nuevoIdPartida = mapaIdsPartidas.get(partidaPlantilla.id_partida)!;
        const ordenConsecutivo = ordenBase + index + 1;

        const nuevaPartida: Partida = {
          id_partida: nuevoIdPartida,
          id_presupuesto: id_presupuesto!,
          id_proyecto: id_proyecto_real,
          id_titulo: tempData.id_titulo || null,
          id_partida_padre: null, // Partidas principales
          nivel_partida: 1,
          numero_item: '', // Se calculará dinámicamente al guardar
          descripcion: partidaPlantilla.descripcion,
          unidad_medida: partidaPlantilla.unidad_medida,
          metrado: partidaPlantilla.metrado,
          precio_unitario: mantenerAPUs && partidaPlantilla.precio_unitario ? partidaPlantilla.precio_unitario : 0,
          parcial_partida: mantenerAPUs && partidaPlantilla.parcial_partida ? partidaPlantilla.parcial_partida : 0,
          orden: ordenConsecutivo,
          estado: partidaPlantilla.estado
        };

        nuevasPartidas.push(nuevaPartida);
      });

      // 6. Crear APUs y precios compartidos nuevos si mantenerAPUs está activado
      const nuevosAPUsParaEstado: any[] = [];
      const nuevosPreciosParaEstado: import('@/hooks/usePresupuestos').PrecioCompartidoNuevo[] = [];

      if (mantenerAPUs) {
        // Crear APUs - mapear IDs de partida a los nuevos IDs temporales asignados
        apusRelevantes.forEach(apu => {
          const nuevoIdAPU = mapaIdsAPUs.get(apu.id_apu)!;
          const idPartidaOriginal = mapaIdsPartidas.get(apu.id_partida) || apu.id_partida;

          const nuevoAPU = {
            id_apu: nuevoIdAPU,
            id_partida: idPartidaOriginal,
            descripcion: apu.descripcion,
            rendimiento: apu.rendimiento,
            jornada: apu.jornada,
            recursos: apu.recursos.map((recurso: any, index: number) => {
              const idRecursoApu = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`;

              // Mapear campos según RecursoApuInput
              let recursoMapeado: any = {
                id_recurso_apu: idRecursoApu,
                recurso_id: recurso.recurso_id,
                id_partida_subpartida: recurso.id_partida_subpartida,
                codigo_recurso: recurso.codigo_recurso,
                descripcion: recurso.descripcion,
                unidad_medida: recurso.unidad_medida,
                tipo_recurso: recurso.tipo_recurso,
                tipo_recurso_codigo: recurso.tipo_recurso_codigo,
                precio_usuario: recurso.precio,
                precio_unitario_subpartida: recurso.precio_unitario_subpartida,
                tiene_precio_override: recurso.tiene_precio_override,
                precio_override: recurso.precio_override,
                cuadrilla: recurso.cuadrilla,
                cantidad: recurso.cantidad,
                rendimiento: recurso.rendimiento,
                desperdicio_porcentaje: recurso.desperdicio_porcentaje,
                cantidad_con_desperdicio: recurso.cantidad_con_desperdicio,
                parcial: recurso.parcial,
                precio_total: recurso.precio_total,
                orden: recurso.orden,
                observaciones: recurso.observaciones,
                // Solo agregar id_precio_recurso si existe y está disponible
                id_precio_recurso: (() => {
                  if (recurso.id_precio_recurso) {
                    const precioExistente = preciosProyectoActual.find(pc =>
                      pc.recurso_id === recurso.recurso_id
                    );

                    if (precioExistente) {
                      // Usar el precio existente del proyecto
                      return precioExistente.id_precio_recurso;
                    } else {
                      // Usar el temp ID del precio nuevo
                      const tempIdPrecio = mapaIdsPrecios.get(recurso.id_precio_recurso);
                      return tempIdPrecio || null;
                    }
                  }
                  return null;
                })()
              };

              return recursoMapeado;
            })
          };

          nuevosAPUsParaEstado.push(nuevoAPU);
        });

        // Crear precios compartidos nuevos
        preciosRelevantes.forEach(precio => {
          const nuevoIdPrecio = mapaIdsPrecios.get(precio.id_precio_recurso);
          if (nuevoIdPrecio) { // Solo si se creó un temp ID (precio no existe)
            const nuevoPrecio: import('@/hooks/usePresupuestos').PrecioCompartidoNuevo = {
              id_precio_recurso: nuevoIdPrecio,
              id_presupuesto: id_presupuesto!,
              recurso_id: precio.recurso_id,
              codigo_recurso: precio.codigo_recurso,
              descripcion: precio.descripcion,
              unidad: precio.unidad,
              tipo_recurso: precio.tipo_recurso,
              precio: precio.precio,
              fecha_actualizacion: new Date().toISOString(),
              usuario_actualizo: 'PLANTILLA'
            };

            nuevosPreciosParaEstado.push(nuevoPrecio);
          }
        });
      }

      // 7. Agregar todo al estado unificado (igual que títulos)
      setPartidas(prev => {
        const partidasOrdenadas = [...prev, ...nuevasPartidas].sort((a, b) => a.orden - b.orden);
        return partidasOrdenadas;
      });

      if (mantenerAPUs) {
        const nuevosApus = [...apusTemporales, ...nuevosAPUsParaEstado];
        const nuevosPrecios = [...preciosCompartidosTemporales, ...nuevosPreciosParaEstado];

        setApusTemporales(nuevosApus);
        setPreciosCompartidosTemporales(nuevosPrecios);
      }

      // 8. Normalizar órdenes después de la inserción
      setTimeout(() => {
        if (tempData.id_titulo) {
          reordenarItemsPadre(tempData.id_titulo);
        } else {
          reordenarItemsPadre(null);
        }
      }, 0);

      // 9. Cerrar modal y limpiar estado
      integrationSuccess = true;
      setModalAbierto(false);
      setTituloEditando(null);
      setPartidaEditando(null);
      setNombreItem('');
      setIntegrandoPlantilla(false);

      console.log('✅ Integración de múltiples partidas completada:', {
        partidasIntegradas: nuevasPartidas.length,
        apusIntegrados: nuevosAPUsParaEstado.length,
        preciosIntegrados: nuevosPreciosParaEstado.length
      });

    } finally {
      // Asegurar que siempre se cierre el modal y se resete el estado, incluso si hay errores
      if (!integrationSuccess) {
        setModalAbierto(false);
        setIntegrandoPlantilla(false);
      }
    }
  }, [generarIdTemporal, id_presupuesto, id_proyecto_real, setPartidas, setApusTemporales, setPreciosCompartidosTemporales, setModalAbierto, setPartidaEditando, setNombreItem, integrandoPlantilla, setIntegrandoPlantilla, apusTemporales, preciosCompartidosTemporales, partidas]);

  /**
   * Cierra el modal
   */
  const handleCerrarModal = useCallback(() => {
    setModalAbierto(false);
    setTituloEditando(null);
    setPartidaEditando(null);
    setNombreItem('');
    setUsarPlantillaTituloModal(false); // Resetear estado de plantilla al cerrar
    delete (window as any).__nuevoTituloTemp;
    delete (window as any).__nuevaPartidaTemp;
  }, []);

  /**
   * Pega un bloque cortado en una nueva posición (soporta modo simple y múltiple)
   */
  const handlePegar = useCallback((idDestino: string) => {
    // Determinar si hay items cortados (simple o múltiple)
    const itemsACortar: string[] = itemsCortadosMultiple.size > 0 
      ? Array.from(itemsCortadosMultiple) 
      : itemCortado 
        ? [itemCortado] 
        : [];
    
    if (itemsACortar.length === 0 || !idDestino) return;

    const tipoDestino = obtenerTipoItem(idDestino);
    if (!tipoDestino) return;

    // Validar que no se intente mover títulos dentro de sí mismos
    for (const idCortado of itemsACortar) {
      const tipoCortado = obtenerTipoItem(idCortado);
      if (tipoCortado === 'TITULO') {
        const idsBloque = obtenerIdsBloqueTitulo(idCortado);
        if (idsBloque.includes(idDestino)) {
          // No se puede mover un título a ser hijo de sí mismo o de sus descendientes
          return;
        }
      }
    }

    // Obtener el nuevo padre basado en el destino
    let nuevoIdPadre: string | null = null;

    if (tipoDestino === 'TITULO') {
      const tituloDestino = titulos.find(t => t.id_titulo === idDestino);
      if (tituloDestino) {
        nuevoIdPadre = tituloDestino.id_titulo;
      }
    } else {
      const partidaDestino = partidas.find(p => p.id_partida === idDestino);
      if (partidaDestino) {
        // Si es una partida, el nuevo padre será el título al que pertenece
        nuevoIdPadre = partidaDestino.id_titulo;
      }
    }

    // Obtener todos los items cortados ordenados según su orden original
    // Necesitamos obtenerlos del mismo padre para mantener el orden relativo
    const itemsCortadosOrdenados: Array<{ id: string; tipo: 'TITULO' | 'PARTIDA'; orden: number }> = [];
    
    if (itemsACortar.length > 0) {
      // Obtener el primer item cortado para obtener sus hermanos
      const primerItem = itemsACortar[0];
      const hermanos = obtenerItemsMismoPadre(primerItem);
      
      // Filtrar solo los items que están cortados
      const itemsCortadosEncontrados = hermanos.filter(h => itemsACortar.includes(h.id));
      
      if (itemsCortadosEncontrados.length > 0) {
        // Si encontramos items en los hermanos, usarlos (ya están ordenados)
        itemsCortadosOrdenados.push(...itemsCortadosEncontrados);
      } else {
        // Si no se encontraron en los hermanos (caso edge), construir manualmente
        itemsACortar.forEach(id => {
          const tipo = obtenerTipoItem(id);
          if (tipo === 'TITULO') {
            const titulo = titulos.find(t => t.id_titulo === id);
            if (titulo) {
              itemsCortadosOrdenados.push({ id, tipo: 'TITULO', orden: titulo.orden });
            }
          } else if (tipo === 'PARTIDA') {
            const partida = partidas.find(p => p.id_partida === id);
            if (partida) {
              itemsCortadosOrdenados.push({ id, tipo: 'PARTIDA', orden: partida.orden });
            }
          }
        });
        itemsCortadosOrdenados.sort((a, b) => a.orden - b.orden);
      }
    }

    // Obtener todos los items del nuevo padre (excluyendo los que se están moviendo)
    // Usar obtenerItemsMismoPadre para obtener los items correctamente ordenados
    const idsACortarSet = new Set(itemsACortar);
    
    // Necesitamos un item de referencia del nuevo padre para obtener todos sus hermanos
    let itemsNuevoPadre: Array<{ id: string; tipo: 'TITULO' | 'PARTIDA'; orden: number }> = [];
    
    if (nuevoIdPadre === null) {
      // Items del nivel raíz: solo títulos raíz (las partidas pertenecen a títulos, no al root)
      const titulosRaiz = titulos.filter(t => t.id_titulo_padre === null && !idsACortarSet.has(t.id_titulo));
      if (titulosRaiz.length > 0) {
        // Usar el primer título raíz como referencia
        itemsNuevoPadre = obtenerItemsMismoPadre(titulosRaiz[0].id_titulo);
        // Filtrar solo los que NO están siendo cortados
        itemsNuevoPadre = itemsNuevoPadre.filter(item => !idsACortarSet.has(item.id));
      }
    } else {
      // Items del nuevo padre: usar obtenerItemsMismoPadre con cualquier hijo del padre
      const titulosHijos = titulos.filter(t => t.id_titulo_padre === nuevoIdPadre && !idsACortarSet.has(t.id_titulo));
      const partidasDelPadre = partidas.filter(p => p.id_titulo === nuevoIdPadre && p.id_partida_padre === null && !idsACortarSet.has(p.id_partida));
      
      if (titulosHijos.length > 0) {
        itemsNuevoPadre = obtenerItemsMismoPadre(titulosHijos[0].id_titulo);
      } else if (partidasDelPadre.length > 0) {
        itemsNuevoPadre = obtenerItemsMismoPadre(partidasDelPadre[0].id_partida);
      }
      
      // Filtrar solo los que NO están siendo cortados
      itemsNuevoPadre = itemsNuevoPadre.filter(item => !idsACortarSet.has(item.id));
    }
    
    // El siguiente orden debe ser consecutivo: si hay N items, el siguiente es N+1
    // Esto asegura que siempre sea consecutivo, sin importar los huecos en los órdenes actuales
    const siguienteOrden = itemsNuevoPadre.length + 1;

    // Calcular el nuevo nivel basándose en el nuevo padre
    let nuevoNivel = 1;
    if (nuevoIdPadre) {
      nuevoNivel = calcularNivelDinamico(nuevoIdPadre) + 1;
    }

    // Procesar cada item cortado manteniendo el orden relativo
    // Empezar desde el siguiente orden consecutivo
    let ordenInicial = siguienteOrden;
    const padresOriginales = new Set<string | null>();
    const titulosParaActualizar: Array<{ id: string; nuevoPadre: string | null; nuevoOrden: number; nuevoNivel: number }> = [];
    const partidasParaActualizar: Array<{ id: string; nuevoTitulo: string; nuevoOrden: number }> = [];

    for (const item of itemsCortadosOrdenados) {
      if (item.tipo === 'TITULO') {
        const titulo = titulos.find(t => t.id_titulo === item.id);
        if (titulo) {
          padresOriginales.add(titulo.id_titulo_padre);
          titulosParaActualizar.push({
            id: item.id,
            nuevoPadre: nuevoIdPadre,
            nuevoOrden: ordenInicial++,
            nuevoNivel: nuevoNivel
          });
        }
      } else {
        // Es una partida
        const partida = partidas.find(p => p.id_partida === item.id);
        if (partida) {
          // Para partidas, el "padre" para normalización es el id_titulo de la partida
          // porque reordenarItemsPadre(idTitulo) normaliza las partidas con id_titulo === idTitulo
          // (aunque también normaliza títulos hijos, eso está bien porque no afecta a las partidas)
          padresOriginales.add(partida.id_titulo);
          partidasParaActualizar.push({
            id: item.id,
            nuevoTitulo: nuevoIdPadre || partida.id_titulo,
            nuevoOrden: ordenInicial++
          });
        }
      }
    }

    // Actualizar títulos
    if (titulosParaActualizar.length > 0) {
      setTitulos(prev => {
        const actualizados = prev.map(t => {
          const actualizacion = titulosParaActualizar.find(u => u.id === t.id_titulo);
          if (actualizacion) {
            return { ...t, id_titulo_padre: actualizacion.nuevoPadre, orden: actualizacion.nuevoOrden, nivel: actualizacion.nuevoNivel };
          }
          // También mover descendientes de títulos cortados
          for (const actualizacion of titulosParaActualizar) {
            const idsBloque = obtenerIdsBloqueTitulo(actualizacion.id);
            if (idsBloque.includes(t.id_titulo) && t.id_titulo !== actualizacion.id) {
              // Mantener la jerarquía relativa dentro del bloque
              return t;
            }
          }
          return t;
        });

        // Actualizar niveles de todos los descendientes de los títulos movidos
        const procesados = new Set<string>();
        const actualizarDescendientes = (id: string, nivelBase: number) => {
          if (procesados.has(id)) return;
          procesados.add(id);

          actualizados.forEach(t => {
            if (t.id_titulo_padre === id) {
              t.nivel = nivelBase + 1;
              actualizarDescendientes(t.id_titulo, nivelBase + 1);
            }
          });
        };

        for (const actualizacion of titulosParaActualizar) {
          actualizarDescendientes(actualizacion.id, actualizacion.nuevoNivel);
        }

        return actualizados;
      });
    }

    // Actualizar partidas
    if (partidasParaActualizar.length > 0) {
      setPartidas(prev => prev.map(p => {
        const actualizacion = partidasParaActualizar.find(u => u.id === p.id_partida);
        if (actualizacion) {
          return { ...p, id_titulo: actualizacion.nuevoTitulo, orden: actualizacion.nuevoOrden };
        }
        // También mover subpartidas de partidas cortadas
        for (const actualizacion of partidasParaActualizar) {
          const idsBloque = obtenerIdsBloquePartida(actualizacion.id);
          if (idsBloque.includes(p.id_partida) && p.id_partida !== actualizacion.id) {
            // Mantener la jerarquía relativa dentro del bloque
            return p;
          }
        }
        return p;
      }));
    }

    // Reordenar los padres originales primero (para normalizar órdenes del lugar de origen)
    // Luego reordenar el nuevo padre (para normalizar órdenes del lugar de destino)
    setTimeout(() => {
      // Normalizar los padres originales (donde se cortaron los items)
      // Esto reordena los items que quedaron para que tengan órdenes consecutivos
      padresOriginales.forEach(padreOriginal => {
        if (padreOriginal !== nuevoIdPadre) {
          reordenarItemsPadre(padreOriginal);
        }
      });
      // Normalizar el nuevo padre (donde se pegaron los items)
      // Esto asegura que todos los órdenes sean consecutivos (1, 2, 3, 4...)
      reordenarItemsPadre(nuevoIdPadre);
    }, 10);

    // Limpiar items cortados
    setItemCortado(null);
    setItemsCortadosMultiple(new Set());
  }, [itemCortado, itemsCortadosMultiple, obtenerTipoItem, obtenerItemsMismoPadre, obtenerIdsBloqueTitulo, obtenerIdsBloquePartida, titulos, partidas, calcularNivelDinamico, reordenarItemsPadre]);

  /**
   * Mueve un item (y su bloque completo) hacia arriba
   */
  const handleSubir = useCallback((id: string) => {
    const tipo = obtenerTipoItem(id);
    if (!tipo) return;

    const itemsMismoPadre = obtenerItemsMismoPadre(id);
    const itemActual = itemsMismoPadre.find(item => item.id === id);

    if (!itemActual || itemActual.orden === 1) return; // Ya está en la primera posición

    const ordenNuevo = itemActual.orden - 1;
    const itemAnterior = itemsMismoPadre.find(item => item.orden === ordenNuevo);

    if (!itemAnterior) return;

    // Intercambiar ordenes: el item actual y el anterior
    // Actualizar ambos items en una sola operación para evitar inconsistencias
    if (itemAnterior.tipo === 'TITULO' && tipo === 'TITULO') {
      // Ambos son títulos: intercambiar ordenes
      setTitulos(prev => prev.map(t => {
        if (t.id_titulo === id) {
          return { ...t, orden: ordenNuevo };
        }
        if (t.id_titulo === itemAnterior.id) {
          return { ...t, orden: itemActual.orden };
        }
        return t;
      }));
    } else if (itemAnterior.tipo === 'PARTIDA' && tipo === 'PARTIDA') {
      // Ambos son partidas: intercambiar ordenes
      setPartidas(prev => prev.map(p => {
        if (p.id_partida === id) {
          return { ...p, orden: ordenNuevo };
        }
        if (p.id_partida === itemAnterior.id) {
          return { ...p, orden: itemActual.orden };
        }
        return p;
      }));
    } else {
      // Tipos mixtos: intercambiar ordenes entre título y partida
      if (tipo === 'TITULO') {
        setTitulos(prev => prev.map(t => {
          if (t.id_titulo === id) {
            return { ...t, orden: ordenNuevo };
          }
          return t;
        }));
        setPartidas(prev => prev.map(p => {
          if (p.id_partida === itemAnterior.id) {
            return { ...p, orden: itemActual.orden };
          }
          return p;
        }));
      } else {
        setPartidas(prev => prev.map(p => {
          if (p.id_partida === id) {
            return { ...p, orden: ordenNuevo };
          }
          return p;
        }));
        setTitulos(prev => prev.map(t => {
          if (t.id_titulo === itemAnterior.id) {
            return { ...t, orden: itemActual.orden };
          }
          return t;
        }));
      }
    }
    // No normalizar después del intercambio - el intercambio ya está correcto
  }, [obtenerTipoItem, obtenerItemsMismoPadre]);

  /**
   * Mueve un item (y su bloque completo) hacia abajo
   */
  const handleBajar = useCallback((id: string) => {
    const tipo = obtenerTipoItem(id);
    if (!tipo) return;

    const itemsMismoPadre = obtenerItemsMismoPadre(id);
    const itemActual = itemsMismoPadre.find(item => item.id === id);

    if (!itemActual) return;

    const maxOrden = Math.max(...itemsMismoPadre.map(item => item.orden));
    if (itemActual.orden === maxOrden) return; // Ya está en la última posición

    const ordenNuevo = itemActual.orden + 1;
    const itemSiguiente = itemsMismoPadre.find(item => item.orden === ordenNuevo);

    if (!itemSiguiente) return;

    // Intercambiar ordenes: el item actual y el siguiente
    // Actualizar ambos items en una sola operación para evitar inconsistencias
    if (itemSiguiente.tipo === 'TITULO' && tipo === 'TITULO') {
      // Ambos son títulos: intercambiar ordenes
      setTitulos(prev => prev.map(t => {
        if (t.id_titulo === id) {
          return { ...t, orden: ordenNuevo };
        }
        if (t.id_titulo === itemSiguiente.id) {
          return { ...t, orden: itemActual.orden };
        }
        return t;
      }));
    } else if (itemSiguiente.tipo === 'PARTIDA' && tipo === 'PARTIDA') {
      // Ambos son partidas: intercambiar ordenes
      setPartidas(prev => prev.map(p => {
        if (p.id_partida === id) {
          return { ...p, orden: ordenNuevo };
        }
        if (p.id_partida === itemSiguiente.id) {
          return { ...p, orden: itemActual.orden };
        }
        return p;
      }));
    } else {
      // Tipos mixtos: intercambiar ordenes entre título y partida
      if (tipo === 'TITULO') {
        setTitulos(prev => prev.map(t => {
          if (t.id_titulo === id) {
            return { ...t, orden: ordenNuevo };
          }
          return t;
        }));
        setPartidas(prev => prev.map(p => {
          if (p.id_partida === itemSiguiente.id) {
            return { ...p, orden: itemActual.orden };
          }
          return p;
        }));
      } else {
        setPartidas(prev => prev.map(p => {
          if (p.id_partida === id) {
            return { ...p, orden: ordenNuevo };
          }
          return p;
        }));
        setTitulos(prev => prev.map(t => {
          if (t.id_titulo === itemSiguiente.id) {
            return { ...t, orden: itemActual.orden };
          }
          return t;
        }));
      }
    }
    // No normalizar después del intercambio - el intercambio ya está correcto
  }, [obtenerTipoItem, obtenerItemsMismoPadre]);

  /**
   * Verifica si un item puede moverse a la izquierda (subir nivel jerárquico)
   * Un item puede moverse a la izquierda si tiene un padre (no es raíz)
   */
  const puedeMoverIzquierda = useCallback((id: string): boolean => {
    const tipo = obtenerTipoItem(id);
    if (!tipo) return false;

    if (tipo === 'TITULO') {
      const titulo = titulos.find(t => t.id_titulo === id);
      return titulo ? titulo.id_titulo_padre !== null : false;
    } else {
      // Las partidas siempre pertenecen a un título, pero pueden tener id_partida_padre
      const partida = partidas.find(p => p.id_partida === id);
      if (!partida) return false;
      // Una partida puede moverse a la izquierda si tiene un padre de partida
      // o si hay un hermano anterior que pueda ser su padre
      if (partida.id_partida_padre !== null) return true;

      // Si es partida principal, verificar si hay un hermano anterior
      const itemsMismoPadre = obtenerItemsMismoPadre(id);
      const itemActual = itemsMismoPadre.find(item => item.id === id);
      if (!itemActual || itemActual.orden === 1) return false; // No hay hermano anterior

      // Verificar si el hermano anterior es un título (puede ser padre)
      const hermanoAnterior = itemsMismoPadre.find(item => item.orden === itemActual.orden - 1);
      return hermanoAnterior?.tipo === 'TITULO';
    }
  }, [titulos, partidas, obtenerTipoItem, obtenerItemsMismoPadre]);

  /**
   * Verifica si un item puede moverse a la derecha (bajar nivel jerárquico)
   * Un item puede moverse a la derecha si hay un hermano anterior que pueda ser su padre
   */
  const puedeMoverDerecha = useCallback((id: string): boolean => {
    const tipo = obtenerTipoItem(id);
    if (!tipo) return false;

    const itemsMismoPadre = obtenerItemsMismoPadre(id);
    const itemActual = itemsMismoPadre.find(item => item.id === id);

    if (!itemActual || itemActual.orden === 1) return false; // No hay hermano anterior

    // Buscar el hermano anterior
    const hermanoAnterior = itemsMismoPadre.find(item => item.orden === itemActual.orden - 1);

    if (!hermanoAnterior) return false;

    if (tipo === 'TITULO') {
      // Un título puede moverse a la derecha si el hermano anterior es un título
      // (se convierte en hijo de ese título)
      return hermanoAnterior.tipo === 'TITULO';
    } else {
      // Una partida puede moverse a la derecha si el hermano anterior es un título
      // (se convierte en partida de ese título)
      return hermanoAnterior.tipo === 'TITULO';
    }
  }, [obtenerTipoItem, obtenerItemsMismoPadre]);

  /**
   * Mueve un item a la izquierda (sube nivel jerárquico)
   * - Un hijo se convierte en hermano de su padre
   */
  const handleMoverIzquierda = useCallback((id: string) => {
    const tipo = obtenerTipoItem(id);
    if (!tipo || !puedeMoverIzquierda(id)) return;

    if (tipo === 'TITULO') {
      const titulo = titulos.find(t => t.id_titulo === id);
      if (!titulo || !titulo.id_titulo_padre) return;

      // Obtener el padre actual
      const padreActual = titulos.find(t => t.id_titulo === titulo.id_titulo_padre);
      if (!padreActual) return;

      // El nuevo padre será el abuelo (padre del padre actual)
      const nuevoIdPadre = padreActual.id_titulo_padre;

      // Calcular nuevo nivel
      const nuevoNivel = nuevoIdPadre
        ? calcularNivelDinamico(nuevoIdPadre) + 1
        : 1;

      // Calcular el nuevo orden basándose en los items del nuevo padre
      // IMPORTANTE: Siempre considerar TODOS los hermanos juntos (títulos + partidas)
      // Esto aplica tanto para root como para otros padres
      let nuevoOrden = 1;

      if (nuevoIdPadre === null) {
        // Para el root, considerar TODOS los items: títulos raíz + partidas de títulos raíz
        const itemsNuevoPadre: Array<{ orden: number }> = [];

        // Títulos raíz (excluyendo el que se está moviendo)
        const titulosRaiz = titulos.filter(t => t.id_titulo_padre === null && t.id_titulo !== id);
        titulosRaiz.forEach(t => itemsNuevoPadre.push({ orden: t.orden }));

        // Partidas de títulos raíz
        titulosRaiz.forEach(tituloRaiz => {
          const partidasRaiz = partidas.filter(p => p.id_titulo === tituloRaiz.id_titulo && p.id_partida_padre === null);
          partidasRaiz.forEach(p => itemsNuevoPadre.push({ orden: p.orden }));
        });

        // Calcular el orden máximo y asignar el siguiente
        const maxOrden = itemsNuevoPadre.length > 0
          ? Math.max(...itemsNuevoPadre.map(item => item.orden))
          : 0;
        nuevoOrden = maxOrden + 1;
      } else {
        // Items del nuevo padre (títulos hijos + partidas principales)
        // IMPORTANTE: Excluir el título que se está moviendo
        const itemsNuevoPadre: Array<{ orden: number }> = [];
        const titulosHijos = titulos.filter(t => t.id_titulo_padre === nuevoIdPadre && t.id_titulo !== id);
        titulosHijos.forEach(t => itemsNuevoPadre.push({ orden: t.orden }));

        const partidasDelPadre = partidas.filter(p => p.id_titulo === nuevoIdPadre && p.id_partida_padre === null);
        partidasDelPadre.forEach(p => itemsNuevoPadre.push({ orden: p.orden }));

        // Calcular el orden máximo y asignar el siguiente
        const maxOrden = itemsNuevoPadre.length > 0
          ? Math.max(...itemsNuevoPadre.map(item => item.orden))
          : 0;
        nuevoOrden = maxOrden + 1;
      }

      // Actualizar el título
      setTitulos(prev => {
        const actualizados = prev.map(t => {
          if (t.id_titulo === id) {
            return { ...t, id_titulo_padre: nuevoIdPadre, nivel: nuevoNivel, orden: nuevoOrden };
          }
          return t;
        });

        // Actualizar niveles de todos los descendientes recursivamente
        const procesados = new Set<string>();
        const actualizarDescendientes = (idTitulo: string, nivelBase: number) => {
          if (procesados.has(idTitulo)) return;
          procesados.add(idTitulo);

          actualizados.forEach(t => {
            if (t.id_titulo_padre === idTitulo) {
              t.nivel = nivelBase + 1;
              actualizarDescendientes(t.id_titulo, nivelBase + 1);
            }
          });
        };
        actualizarDescendientes(id, nuevoNivel);

        return actualizados;
      });

      // Reordenar items del padre original y del nuevo padre (si es raíz, normalizar también)
      // IMPORTANTE: Reordenar primero el padre original para normalizar los items que quedan,
      // luego reordenar el nuevo padre (que incluirá el item movido)
      setTimeout(() => {
        // Primero reordenar el padre original para normalizar los items que quedan
        reordenarItemsPadre(titulo.id_titulo_padre);
        // Luego reordenar el nuevo padre (esto incluirá el item movido y lo colocará en la posición correcta)
        // Usar un segundo setTimeout para asegurar que el reordenamiento del padre original se complete primero
        setTimeout(() => {
          if (nuevoIdPadre !== null) {
            reordenarItemsPadre(nuevoIdPadre);
          } else {
            // Si se movió a la raíz, normalizar los órdenes del nivel raíz
            // Esto reordenará todos los items del root, incluyendo el que se acaba de mover
            // y los ordenará correctamente basándose en sus órdenes actuales
            reordenarItemsPadre(null);
          }
        }, 100);
      }, 50);
    } else {
      // Es una partida
      const partida = partidas.find(p => p.id_partida === id);
      if (!partida) return;

      if (partida.id_partida_padre !== null) {
        // Es una subpartida: convertirla en partida principal
        // El nuevo título será el título de la partida padre
        const partidaPadre = partidas.find(p => p.id_partida === partida.id_partida_padre);
        if (!partidaPadre) return;

        // Obtener el orden máximo de los items del título (títulos hijos + partidas principales)
        // IMPORTANTE: Excluir la partida que se está moviendo
        const itemsMismoTitulo: Array<{ orden: number }> = [];
        const titulosHijos = titulos.filter(t => t.id_titulo_padre === partidaPadre.id_titulo);
        titulosHijos.forEach(t => itemsMismoTitulo.push({ orden: t.orden }));
        const partidasDelTitulo = partidas.filter(
          p => p.id_titulo === partidaPadre.id_titulo && p.id_partida_padre === null && p.id_partida !== id
        );
        partidasDelTitulo.forEach(p => itemsMismoTitulo.push({ orden: p.orden }));
        
        const maxOrden = itemsMismoTitulo.length > 0
          ? Math.max(...itemsMismoTitulo.map(item => item.orden))
          : 0;
        const nuevoOrden = maxOrden + 1;

        // Guardar el título original antes de actualizar
        const idTituloOriginal = partida.id_titulo;

        setPartidas(prev => prev.map(p => {
          if (p.id_partida === id) {
            return {
              ...p,
              id_titulo: partidaPadre.id_titulo,
              id_partida_padre: null,
              nivel_partida: 1,
              orden: nuevoOrden
            };
          }
          return p;
        }));

        // Reordenar items del título original y del nuevo título
        setTimeout(() => {
          if (idTituloOriginal && idTituloOriginal !== partidaPadre.id_titulo) {
            reordenarItemsPadre(idTituloOriginal);
          }
          reordenarItemsPadre(partidaPadre.id_titulo);
        }, 50);
      } else {
        // Es una partida principal: moverla al título padre del título actual
        const tituloActual = titulos.find(t => t.id_titulo === partida.id_titulo);
        if (!tituloActual || !tituloActual.id_titulo_padre) return;

        // El nuevo título será el abuelo (padre del título actual)
        const tituloAbuelo = titulos.find(t => t.id_titulo === tituloActual.id_titulo_padre);
        if (!tituloAbuelo) return;

        // Obtener el orden máximo de los items del título abuelo (títulos hijos + partidas principales)
        // IMPORTANTE: Excluir la partida que se está moviendo
        const itemsMismoTitulo: Array<{ orden: number }> = [];
        const titulosHijos = titulos.filter(t => t.id_titulo_padre === tituloAbuelo.id_titulo);
        titulosHijos.forEach(t => itemsMismoTitulo.push({ orden: t.orden }));
        const partidasDelTitulo = partidas.filter(
          p => p.id_titulo === tituloAbuelo.id_titulo && p.id_partida_padre === null && p.id_partida !== id
        );
        partidasDelTitulo.forEach(p => itemsMismoTitulo.push({ orden: p.orden }));
        
        const maxOrden = itemsMismoTitulo.length > 0
          ? Math.max(...itemsMismoTitulo.map(item => item.orden))
          : 0;
        const nuevoOrden = maxOrden + 1;

        // Guardar el título original antes de actualizar
        const idTituloOriginal = partida.id_titulo;

        setPartidas(prev => prev.map(p => {
          if (p.id_partida === id) {
            return { ...p, id_titulo: tituloAbuelo.id_titulo, orden: nuevoOrden };
          }
          return p;
        }));

        // Reordenar items del título original y del nuevo título
        setTimeout(() => {
          if (idTituloOriginal && idTituloOriginal !== tituloAbuelo.id_titulo) {
            reordenarItemsPadre(idTituloOriginal);
          }
          reordenarItemsPadre(tituloAbuelo.id_titulo);
        }, 50);
      }
    }
  }, [titulos, partidas, obtenerTipoItem, puedeMoverIzquierda, calcularNivelDinamico, obtenerItemsMismoPadre, reordenarItemsPadre]);

  /**
   * Mueve un item a la derecha (baja nivel jerárquico)
   * - Un hermano se convierte en hijo del hermano anterior
   */
  const handleMoverDerecha = useCallback((id: string) => {
    const tipo = obtenerTipoItem(id);
    if (!tipo || !puedeMoverDerecha(id)) return;

    const itemsMismoPadre = obtenerItemsMismoPadre(id);
    const itemActual = itemsMismoPadre.find(item => item.id === id);

    if (!itemActual || itemActual.orden === 1) return;

    const hermanoAnterior = itemsMismoPadre.find(item => item.orden === itemActual.orden - 1);
    if (!hermanoAnterior || hermanoAnterior.tipo !== 'TITULO') return;

    if (tipo === 'TITULO') {
      // El título se convierte en hijo del hermano anterior (título)
      const nuevoIdPadre = hermanoAnterior.id;
      const nuevoNivel = calcularNivelDinamico(nuevoIdPadre) + 1;

      // Obtener el orden máximo de los items del hermano anterior (títulos hijos + partidas principales)
      const itemsMismoPadre: Array<{ orden: number }> = [];
      const titulosHijos = titulos.filter(t => t.id_titulo_padre === nuevoIdPadre);
      titulosHijos.forEach(t => itemsMismoPadre.push({ orden: t.orden }));
      const partidasDelPadre = partidas.filter(p => p.id_titulo === nuevoIdPadre && p.id_partida_padre === null);
      partidasDelPadre.forEach(p => itemsMismoPadre.push({ orden: p.orden }));
      
      const maxOrden = itemsMismoPadre.length > 0
        ? Math.max(...itemsMismoPadre.map(item => item.orden))
        : 0;
      const nuevoOrden = maxOrden + 1;

      // Guardar el padre original antes de actualizar
      const tituloActual = titulos.find(t => t.id_titulo === id);
      const idPadreOriginal = tituloActual?.id_titulo_padre || null;

      setTitulos(prev => {
        const actualizados = prev.map(t => {
          if (t.id_titulo === id) {
            return { ...t, id_titulo_padre: nuevoIdPadre, nivel: nuevoNivel, orden: nuevoOrden };
          }
          return t;
        });

        // Actualizar niveles de todos los descendientes recursivamente
        const procesados = new Set<string>();
        const actualizarDescendientes = (idTitulo: string, nivelBase: number) => {
          if (procesados.has(idTitulo)) return;
          procesados.add(idTitulo);

          actualizados.forEach(t => {
            if (t.id_titulo_padre === idTitulo) {
              t.nivel = nivelBase + 1;
              actualizarDescendientes(t.id_titulo, nivelBase + 1);
            }
          });
        };
        actualizarDescendientes(id, nuevoNivel);

        return actualizados;
      });

      // Reordenar items del padre original y del nuevo padre
      setTimeout(() => {
        if (idPadreOriginal !== null && idPadreOriginal !== nuevoIdPadre) {
          reordenarItemsPadre(idPadreOriginal);
        }
        reordenarItemsPadre(nuevoIdPadre);
      }, 10);
    } else {
      // La partida se convierte en partida del título hermano anterior
      const nuevoIdTitulo = hermanoAnterior.id;

      // Guardar el título original antes de actualizar
      const partidaActual = partidas.find(p => p.id_partida === id);
      const idTituloOriginal = partidaActual?.id_titulo || null;

      // Obtener el orden máximo de los items del título hermano anterior (títulos hijos + partidas principales)
      const itemsMismoTitulo: Array<{ orden: number }> = [];
      const titulosHijos = titulos.filter(t => t.id_titulo_padre === nuevoIdTitulo);
      titulosHijos.forEach(t => itemsMismoTitulo.push({ orden: t.orden }));
      const partidasDelTitulo = partidas.filter(
        p => p.id_titulo === nuevoIdTitulo && p.id_partida_padre === null
      );
      partidasDelTitulo.forEach(p => itemsMismoTitulo.push({ orden: p.orden }));
      
      const maxOrden = itemsMismoTitulo.length > 0
        ? Math.max(...itemsMismoTitulo.map(item => item.orden))
        : 0;
      const nuevoOrden = maxOrden + 1;

      setPartidas(prev => prev.map(p => {
        if (p.id_partida === id) {
          return { ...p, id_titulo: nuevoIdTitulo, orden: nuevoOrden };
        }
        return p;
      }));

      // Reordenar items del título original
      setTimeout(() => {
        if (idTituloOriginal && idTituloOriginal !== nuevoIdTitulo) {
          reordenarItemsPadre(idTituloOriginal);
        }
        reordenarItemsPadre(nuevoIdTitulo);
      }, 10);
    }
  }, [titulos, partidas, obtenerTipoItem, puedeMoverDerecha, calcularNivelDinamico, obtenerItemsMismoPadre, reordenarItemsPadre]);

  /**
   * Elimina un título y todos sus descendientes (solo en estado local)
   */
  const handleEliminarTitulo = useCallback((id_titulo: string) => {
    const titulo = titulos.find(t => t.id_titulo === id_titulo);
    if (!titulo) return;

    // Obtener todos los IDs de títulos descendientes para el mensaje
    const idsDescendientes = obtenerIdsBloqueTitulo(id_titulo);
    const tieneHijos = idsDescendientes.length > 1; // Más de 1 porque incluye el propio título
    const cantidadItems = idsDescendientes.length;

    // Verificar si es un título nuevo (temporal) o existente
    const esNuevo = id_titulo.startsWith('temp_');

    // Confirmar eliminación con modal personalizado
    confirm({
      title: 'Eliminar título',
      message: tieneHijos
        ? `¿Está seguro de eliminar el título "${titulo.descripcion}"?\n\nEsto eliminará también ${cantidadItems - 1} ${cantidadItems - 1 === 1 ? 'título hijo y todas sus partidas asociadas' : 'títulos hijos y todas sus partidas asociadas'}.\n\n${esNuevo ? 'Los cambios se guardarán cuando presione "Guardar cambios".' : 'Esta acción se guardará cuando presione "Guardar cambios".'}`
        : `¿Está seguro de eliminar el título "${titulo.descripcion}"?\n\n${esNuevo ? 'Los cambios se guardarán cuando presione "Guardar cambios".' : 'Esta acción se guardará cuando presione "Guardar cambios".'}`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'destructive',
      onConfirm: () => {
        if (esNuevo) {
          // Si es nuevo, simplemente eliminarlo del estado local
          setTitulos(prev => prev.filter(t => !idsDescendientes.includes(t.id_titulo)));
          // También eliminar partidas asociadas
          setPartidas(prev => {
            const partidasAEliminar = new Set<string>();
            idsDescendientes.forEach(idTitulo => {
              partidas.filter(p => p.id_titulo === idTitulo).forEach(p => {
                partidasAEliminar.add(p.id_partida);
              });
            });
            return prev.filter(p => !partidasAEliminar.has(p.id_partida));
          });
        } else {
          // Si es existente, marcarlo como eliminado y removerlo del estado local
          setTitulosEliminados(prev => {
            const nuevo = new Set(prev);
            idsDescendientes.forEach(id => nuevo.add(id));
            return nuevo;
          });
          setTitulos(prev => prev.filter(t => !idsDescendientes.includes(t.id_titulo)));
          // También eliminar partidas asociadas
          setPartidas(prev => {
            const partidasAEliminar = new Set<string>();
            idsDescendientes.forEach(idTitulo => {
              partidas.filter(p => p.id_titulo === idTitulo).forEach(p => {
                partidasAEliminar.add(p.id_partida);
                if (!p.id_partida.startsWith('temp_')) {
                  setPartidasEliminadas(prevElim => new Set([...prevElim, p.id_partida]));
                }
              });
            });
            return prev.filter(p => !partidasAEliminar.has(p.id_partida));
          });
        }

        // Limpiar selección si el item eliminado estaba seleccionado
        if (modoSeleccionMultiple) {
          setItemsSeleccionadosMultiple(prev => {
            const nuevo = new Set(prev);
            nuevo.delete(id_titulo);
            idsDescendientes.forEach(id => nuevo.delete(id));
            return nuevo;
          });
        } else {
          if (itemSeleccionado === id_titulo || idsDescendientes.includes(itemSeleccionado || '')) {
            setItemSeleccionado(null);
          }
        }

        // Limpiar item cortado si estaba en el bloque eliminado
        const itemCortadoEnBloque = itemCortado && idsDescendientes.includes(itemCortado);
        const itemsCortadosEnBloque = Array.from(itemsCortadosMultiple).filter(id => idsDescendientes.includes(id));
        if (itemCortadoEnBloque) {
          setItemCortado(null);
        }
        if (itemsCortadosEnBloque.length > 0) {
          setItemsCortadosMultiple(prev => {
            const nuevo = new Set(prev);
            itemsCortadosEnBloque.forEach(id => nuevo.delete(id));
            return nuevo;
          });
        }
      },
    });
  }, [titulos, partidas, itemSeleccionado, itemCortado, obtenerIdsBloqueTitulo, confirm, modoSeleccionMultiple]);

  /**
   * Elimina múltiples items seleccionados en una sola operación con mensaje detallado
   */
  const handleEliminarMultiple = useCallback(() => {
    if (!modoSeleccionMultiple || itemsSeleccionadosMultiple.size === 0) {
      return;
    }

    const idsSeleccionados = Array.from(itemsSeleccionadosMultiple);
    
    // Agrupar items por tipo y obtener todos los descendientes
    const titulosAEliminar = new Set<string>();
    const partidasAEliminar = new Set<string>();
    
    // Estructuras para el mensaje detallado
    const titulosDetalle: Array<{ id: string; descripcion: string; tieneHijos: boolean; cantidadHijos: number }> = [];
    const partidasDetalle: Array<{ id: string; descripcion: string; tieneSubpartidas: boolean; cantidadSubpartidas: number }> = [];
    
    // Primero, identificar todos los items a eliminar (incluyendo descendientes)
    idsSeleccionados.forEach(id => {
      const tipo = obtenerTipoItem(id);
      if (tipo === 'TITULO') {
        const titulo = titulos.find(t => t.id_titulo === id);
        if (!titulo) return;
        
        const idsBloque = obtenerIdsBloqueTitulo(id);
        idsBloque.forEach(idBloque => titulosAEliminar.add(idBloque));
        
        // Obtener información detallada para el mensaje
        const tieneHijos = idsBloque.length > 1;
        const cantidadHijos = idsBloque.length - 1;
        titulosDetalle.push({
          id,
          descripcion: titulo.descripcion,
          tieneHijos,
          cantidadHijos
        });
        
        // También agregar partidas asociadas a estos títulos
        partidas.forEach(p => {
          if (idsBloque.includes(p.id_titulo)) {
            const idsBloquePartida = obtenerIdsBloquePartida(p.id_partida);
            idsBloquePartida.forEach(idPartida => partidasAEliminar.add(idPartida));
          }
        });
      } else if (tipo === 'PARTIDA') {
        const partida = partidas.find(p => p.id_partida === id);
        if (!partida) return;
        
        const idsBloque = obtenerIdsBloquePartida(id);
        idsBloque.forEach(idBloque => partidasAEliminar.add(idBloque));
        
        // Obtener información detallada para el mensaje
        const tieneSubpartidas = idsBloque.length > 1;
        const cantidadSubpartidas = idsBloque.length - 1;
        partidasDetalle.push({
          id,
          descripcion: partida.descripcion,
          tieneSubpartidas,
          cantidadSubpartidas
        });
      }
    });

    // Construir mensaje detallado con información específica de cada item (formato compacto)
    let mensaje = `¿Está seguro de eliminar los siguientes items?\n\n`;
    
    if (titulosDetalle.length > 0) {
      mensaje += `TÍTULOS (${titulosDetalle.length}):\n`;
      titulosDetalle.forEach((detalle, index) => {
        mensaje += `${index + 1}. "${detalle.descripcion}"`;
        
        // Obtener información detallada de este título específico
        const titulo = titulos.find(t => t.id_titulo === detalle.id);
        if (titulo) {
          const idsBloque = obtenerIdsBloqueTitulo(detalle.id);
          const titulosHijos = idsBloque.filter(id => id !== detalle.id && titulos.some(t => t.id_titulo === id));
          const partidasDelBloque = partidas.filter(p => idsBloque.includes(p.id_titulo));
          
          const detalles: string[] = [];
          if (titulosHijos.length > 0) {
            detalles.push(`${titulosHijos.length} ${titulosHijos.length === 1 ? 'título hijo' : 'títulos hijos'}`);
          }
          if (partidasDelBloque.length > 0) {
            detalles.push(`${partidasDelBloque.length} ${partidasDelBloque.length === 1 ? 'partida' : 'partidas'} (con subpartidas)`);
          }
          if (detalles.length > 0) {
            mensaje += ` → Se eliminarán: ${detalles.join(', ')}`;
          } else {
            mensaje += ` → Sin hijos ni partidas`;
          }
        }
        mensaje += `\n`;
      });
    }
    
    if (partidasDetalle.length > 0) {
      if (titulosDetalle.length > 0) mensaje += `\n`;
      mensaje += `PARTIDAS (${partidasDetalle.length}):\n`;
      partidasDetalle.forEach((detalle, index) => {
        mensaje += `${index + 1}. "${detalle.descripcion}"`;
        
        // Obtener información detallada de esta partida específica
        const partida = partidas.find(p => p.id_partida === detalle.id);
        if (partida) {
          const idsBloque = obtenerIdsBloquePartida(detalle.id);
          const subpartidas = idsBloque.filter(id => id !== detalle.id);
          
          if (subpartidas.length > 0) {
            mensaje += ` → Se eliminarán ${subpartidas.length} ${subpartidas.length === 1 ? 'subpartida' : 'subpartidas'}`;
          } else {
            mensaje += ` → Sin subpartidas`;
          }
        }
        mensaje += `\n`;
      });
    }
    
    const cantidadTotal = titulosAEliminar.size + partidasAEliminar.size;
    mensaje += `\n⚠️ TOTAL: ${cantidadTotal} item(s) serán eliminados permanentemente.\nEsta acción NO se puede deshacer.`;

    // Identificar padres afectados para reordenar después
    // IMPORTANTE: Cada grupo de hermanos debe reordenarse independientemente
    const padresAfectados = new Set<string | null>();
    
    // Para títulos eliminados: reordenar los hermanos del mismo padre
    titulos.forEach(t => {
      if (titulosAEliminar.has(t.id_titulo)) {
        padresAfectados.add(t.id_titulo_padre);
      }
    });
    
    // Para partidas eliminadas: reordenar los items (títulos hijos + partidas) del título al que pertenecen
    // Solo partidas principales (sin id_partida_padre) afectan el orden de hermanos
    // IMPORTANTE: NO reordenar si el título al que pertenece también se está eliminando
    partidas.forEach(p => {
      if (partidasAEliminar.has(p.id_partida) && !p.id_partida_padre) {
        // Solo reordenar si el título al que pertenece NO se está eliminando
        if (!titulosAEliminar.has(p.id_titulo)) {
          padresAfectados.add(p.id_titulo);
        }
      }
    });

    // Separar items nuevos de existentes
    const titulosNuevos = Array.from(titulosAEliminar).filter(id => id.startsWith('temp_'));
    const titulosExistentes = Array.from(titulosAEliminar).filter(id => !id.startsWith('temp_'));
    const partidasNuevas = Array.from(partidasAEliminar).filter(id => id.startsWith('temp_'));
    const partidasExistentes = Array.from(partidasAEliminar).filter(id => !id.startsWith('temp_'));

    // Confirmar eliminación con un solo modal detallado
    confirm({
      title: 'Eliminar items seleccionados',
      message: mensaje,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'destructive',
      onConfirm: () => {
        // Eliminar títulos
        if (titulosNuevos.length > 0 || titulosExistentes.length > 0) {
          if (titulosExistentes.length > 0) {
            setTitulosEliminados(prev => {
              const nuevo = new Set(prev);
              titulosExistentes.forEach(id => nuevo.add(id));
              return nuevo;
            });
          }
          setTitulos(prev => prev.filter(t => !titulosAEliminar.has(t.id_titulo)));
        }

        // Eliminar partidas
        if (partidasNuevas.length > 0 || partidasExistentes.length > 0) {
          if (partidasExistentes.length > 0) {
            setPartidasEliminadas(prev => {
              const nuevo = new Set(prev);
              partidasExistentes.forEach(id => nuevo.add(id));
              return nuevo;
            });
          }
          setPartidas(prev => prev.filter(p => !partidasAEliminar.has(p.id_partida)));
        }

        // Limpiar selección múltiple
        setItemsSeleccionadosMultiple(new Set());
        setItemSeleccionado(null);

        // Limpiar items cortados si estaban en los eliminados
        if (itemCortado && (titulosAEliminar.has(itemCortado) || partidasAEliminar.has(itemCortado))) {
          setItemCortado(null);
        }
        setItemsCortadosMultiple(prev => {
          const nuevo = new Set(prev);
          Array.from(prev).forEach(id => {
            if (titulosAEliminar.has(id) || partidasAEliminar.has(id)) {
              nuevo.delete(id);
            }
          });
          return nuevo;
        });

        // Reordenar todos los padres afectados EN UNA SOLA OPERACIÓN
        // IMPORTANTE: No llamar a reordenarItemsPadre múltiples veces porque se sobrescriben
        setTimeout(() => {
          const padresArray = Array.from(padresAfectados);
          
          // Actualizar títulos Y partidas en una sola operación atómica usando callbacks anidados
          setTitulos(prevTitulos => {
            let titulosResultado = [...prevTitulos];

            console.log('[REORDENAMIENTO] === INICIANDO REORDENAMIENTO ATÓMICO ===');
            console.log('[REORDENAMIENTO] Padres a procesar:', padresArray.map(p => p === null ? 'null (raíz)' : p));
            console.log('[REORDENAMIENTO] Títulos antes:', titulosResultado.map(t => ({ id: t.id_titulo, desc: t.descripcion, padre: t.id_titulo_padre, orden: t.orden })));

            // Para cada padre, preparar la información necesaria para el reordenamiento
            const itemsPorPadre: Map<string | null, Array<{ tipo: 'TITULO' | 'PARTIDA'; id: string; orden: number; descripcion: string }>> = new Map();

            padresArray.forEach(padre => {
              const todosLosItems: Array<{ tipo: 'TITULO' | 'PARTIDA'; id: string; orden: number; descripcion: string }> = [];

              if (padre === null) {
                // Para raíz: títulos raíz + partidas principales de títulos raíz
                const titulosRaiz = titulosResultado.filter(t => t.id_titulo_padre === null);
                titulosRaiz.forEach(t => todosLosItems.push({ tipo: 'TITULO', id: t.id_titulo, orden: t.orden, descripcion: t.descripcion }));
              } else {
                // Para otros padres: títulos hijos + partidas principales del padre
                const titulosHijos = titulosResultado.filter(t => t.id_titulo_padre === padre);
                titulosHijos.forEach(t => todosLosItems.push({ tipo: 'TITULO', id: t.id_titulo, orden: t.orden, descripcion: t.descripcion }));
              }

              itemsPorPadre.set(padre, todosLosItems);
            });

            // Ahora actualizar las partidas usando la información preparada
            setPartidas(prevPartidas => {
              let partidasResultado = [...prevPartidas];
              console.log('[REORDENAMIENTO] Partidas antes:', partidasResultado.map(p => ({ id: p.id_partida, desc: p.descripcion, titulo: p.id_titulo, orden: p.orden })));

              // Completar la información de items con las partidas
              padresArray.forEach(padre => {
                const todosLosItems = itemsPorPadre.get(padre)!;

                if (padre === null) {
                  // Agregar partidas principales de cada título raíz
                  const titulosRaiz = titulosResultado.filter(t => t.id_titulo_padre === null);
                  titulosRaiz.forEach(tituloRaiz => {
                    const partidasRaiz = partidasResultado.filter(p => p.id_titulo === tituloRaiz.id_titulo && p.id_partida_padre === null);
                    partidasRaiz.forEach(p => todosLosItems.push({ tipo: 'PARTIDA', id: p.id_partida, orden: p.orden, descripcion: p.descripcion }));
                  });
                } else {
                  // Agregar partidas principales de este padre
                  const partidasPadre = partidasResultado.filter(p => p.id_titulo === padre && p.id_partida_padre === null);
                  partidasPadre.forEach(p => todosLosItems.push({ tipo: 'PARTIDA', id: p.id_partida, orden: p.orden, descripcion: p.descripcion }));
                }

                console.log(`[REORDENAMIENTO] Procesando padre: ${padre === null ? 'null (raíz)' : padre}`);
                console.log(`[REORDENAMIENTO] Items sin ordenar (${todosLosItems.length}):`, todosLosItems.map(item => ({ tipo: item.tipo, desc: item.descripcion, orden: item.orden })));

                // Ordenar TODOS los items por orden actual
                todosLosItems.sort((a, b) => a.orden - b.orden);
                console.log(`[REORDENAMIENTO] Items ordenados (${todosLosItems.length}):`, todosLosItems.map(item => ({ tipo: item.tipo, desc: item.descripcion, ordenAntes: item.orden })));

                // Asignar órdenes consecutivos a TODOS los items
                todosLosItems.forEach((item, index) => {
                  const nuevoOrden = index + 1;
                  console.log(`[REORDENAMIENTO] ${item.tipo} "${item.descripcion}": orden ${item.orden} -> ${nuevoOrden}`);

                  if (item.tipo === 'TITULO') {
                    const indiceEnResultado = titulosResultado.findIndex(t => t.id_titulo === item.id);
                    if (indiceEnResultado !== -1) {
                      titulosResultado[indiceEnResultado] = { ...titulosResultado[indiceEnResultado], orden: nuevoOrden };
                    }
                  } else {
                    // PARTIDA
                    const indiceEnResultado = partidasResultado.findIndex(p => p.id_partida === item.id);
                    if (indiceEnResultado !== -1) {
                      partidasResultado[indiceEnResultado] = { ...partidasResultado[indiceEnResultado], orden: nuevoOrden };
                    }
                  }
                });
              });

              console.log('[REORDENAMIENTO] === FIN REORDENAMIENTO ATÓMICO ===');
              console.log('[REORDENAMIENTO] Títulos después:', titulosResultado.map(t => ({ id: t.id_titulo, desc: t.descripcion, padre: t.id_titulo_padre, orden: t.orden })));
              console.log('[REORDENAMIENTO] Partidas después:', partidasResultado.map(p => ({ id: p.id_partida, desc: p.descripcion, titulo: p.id_titulo, orden: p.orden })));

              return partidasResultado;
            });

            return titulosResultado;
          });
          
          // Actualizar partidas usando los títulos actualizados
          setPartidas(prevPartidas => {
            let partidasResultado = [...prevPartidas];
            console.log('[REORDENAMIENTO] === INICIANDO REORDENAMIENTO PARTIDAS ===');
            console.log('[REORDENAMIENTO] Partidas antes:', partidasResultado.map(p => ({ id: p.id_partida, desc: p.descripcion, titulo: p.id_titulo, orden: p.orden })));

            // Para cada padre, reordenar las partidas que pertenecen a ese padre
            padresArray.forEach(padre => {
              console.log(`[REORDENAMIENTO] Reordenando partidas para padre: ${padre === null ? 'null (raíz)' : padre}`);

              if (padre === null) {
                // Para raíz: reordenar TODAS las partidas de títulos raíz juntas
                // Pero ya se reordenaron junto con los títulos, así que solo necesitamos continuar los números
                console.log(`[REORDENAMIENTO] Partidas de raíz ya incluidas en el reordenamiento conjunto`);
              } else {
                // Para otros padres: las partidas deben continuar después de los títulos
                const titulosDelPadre = titulos.filter(t => t.id_titulo_padre === padre);
                const partidasDelPadre = partidasResultado
                  .filter(p => p.id_titulo === padre && p.id_partida_padre === null)
                  .sort((a, b) => a.orden - b.orden);

                console.log(`[REORDENAMIENTO] Para padre "${padre}": ${titulosDelPadre.length} títulos + ${partidasDelPadre.length} partidas`);

                // Las partidas deben tener órdenes que continúen después de los títulos
                const ordenBase = titulosDelPadre.length;

                partidasDelPadre.forEach((partida, index) => {
                  const nuevoOrden = ordenBase + index + 1;
                  console.log(`[REORDENAMIENTO] Partida "${partida.descripcion}": orden ${partida.orden} -> ${nuevoOrden}`);
                  const indiceEnResultado = partidasResultado.findIndex(p => p.id_partida === partida.id_partida);
                  if (indiceEnResultado !== -1) {
                    partidasResultado[indiceEnResultado] = { ...partidasResultado[indiceEnResultado], orden: nuevoOrden };
                  }
                });
              }
            });

            console.log('[REORDENAMIENTO] === FIN REORDENAMIENTO PARTIDAS ===');
            console.log('[REORDENAMIENTO] Partidas después:', partidasResultado.map(p => ({ id: p.id_partida, desc: p.descripcion, titulo: p.id_titulo, orden: p.orden })));
            return partidasResultado;
          });
        }, 10);
      },
    });
  }, [modoSeleccionMultiple, itemsSeleccionadosMultiple, obtenerTipoItem, obtenerIdsBloqueTitulo, obtenerIdsBloquePartida, titulos, partidas, itemCortado, itemsCortadosMultiple, confirm, reordenarItemsPadre]);

  /**
   * Elimina una partida (solo en estado local)
   */
  const handleEliminarPartida = useCallback((id_partida: string) => {
    const partida = partidas.find(p => p.id_partida === id_partida);
    if (!partida) return;

    // Obtener todos los IDs de partidas descendientes para el mensaje
    const idsDescendientes = obtenerIdsBloquePartida(id_partida);
    const tieneSubpartidas = idsDescendientes.length > 1; // Más de 1 porque incluye la propia partida
    const cantidadItems = idsDescendientes.length;

    // Verificar si es una partida nueva (temporal) o existente
    const esNueva = id_partida.startsWith('temp_');

    // Confirmar eliminación con modal personalizado
    confirm({
      title: 'Eliminar partida',
      message: tieneSubpartidas
        ? `¿Está seguro de eliminar la partida "${partida.descripcion}"?\n\nEsto eliminará también ${cantidadItems - 1} ${cantidadItems - 1 === 1 ? 'subpartida' : 'subpartidas'}.\n\n${esNueva ? 'Los cambios se guardarán cuando presione "Guardar cambios".' : 'Esta acción se guardará cuando presione "Guardar cambios".'}`
        : `¿Está seguro de eliminar la partida "${partida.descripcion}"?\n\n${esNueva ? 'Los cambios se guardarán cuando presione "Guardar cambios".' : 'Esta acción se guardará cuando presione "Guardar cambios".'}`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'destructive',
      onConfirm: () => {
        if (esNueva) {
          // Si es nueva, simplemente eliminarla del estado local
          setPartidas(prev => prev.filter(p => !idsDescendientes.includes(p.id_partida)));
        } else {
          // Si es existente, marcarla como eliminada y removerla del estado local
          setPartidasEliminadas(prev => {
            const nuevo = new Set(prev);
            idsDescendientes.forEach(id => nuevo.add(id));
            return nuevo;
          });
          setPartidas(prev => prev.filter(p => !idsDescendientes.includes(p.id_partida)));
        }

        // Limpiar selección si el item eliminado estaba seleccionado
        if (modoSeleccionMultiple) {
          setItemsSeleccionadosMultiple(prev => {
            const nuevo = new Set(prev);
            nuevo.delete(id_partida);
            idsDescendientes.forEach(id => nuevo.delete(id));
            return nuevo;
          });
        } else {
          if (itemSeleccionado === id_partida || idsDescendientes.includes(itemSeleccionado || '')) {
            setItemSeleccionado(null);
          }
        }

        // Limpiar item cortado si estaba en el bloque eliminado
        const itemCortadoEnBloque = itemCortado && idsDescendientes.includes(itemCortado);
        const itemsCortadosEnBloque = Array.from(itemsCortadosMultiple).filter(id => idsDescendientes.includes(id));
        if (itemCortadoEnBloque) {
          setItemCortado(null);
        }
        if (itemsCortadosEnBloque.length > 0) {
          setItemsCortadosMultiple(prev => {
            const nuevo = new Set(prev);
            itemsCortadosEnBloque.forEach(id => nuevo.delete(id));
            return nuevo;
          });
        }
      },
    });
  }, [partidas, itemSeleccionado, itemCortado, obtenerIdsBloquePartida, confirm, modoSeleccionMultiple]);

  /**
   * Detecta si hay cambios pendientes (optimizado)
   */
  const hayCambiosPendientes = useMemo(() => {
    // Verificar si hay items eliminados (más rápido primero)
    if (titulosEliminados.size > 0 || partidasEliminadas.size > 0) {
      return true;
    }

    // Crear Map para búsquedas O(1) en lugar de O(n)
    const titulosOriginalesMap = new Map(titulosOriginales.map(t => [t.id_titulo, t]));
    const partidasOriginalesMap = new Map(partidasOriginales.map(p => [p.id_partida, p]));

    // Verificar títulos en una sola pasada
    for (const titulo of titulos) {
      // Verificar si es nuevo
      if (titulo.id_titulo.startsWith('temp_')) {
        return true;
      }

      // Verificar si está modificado
      const original = titulosOriginalesMap.get(titulo.id_titulo);
      if (original && (
        titulo.descripcion !== original.descripcion ||
        titulo.id_titulo_padre !== original.id_titulo_padre ||
        titulo.orden !== original.orden ||
        titulo.nivel !== original.nivel ||
        titulo.id_especialidad !== original.id_especialidad
      )) {
        return true;
      }
    }

    // Verificar partidas en una sola pasada
    for (const partida of partidas) {
      // Verificar si es nueva
      if (partida.id_partida.startsWith('temp_')) {
        return true;
      }

      // Verificar si está modificada
      const original = partidasOriginalesMap.get(partida.id_partida);
      if (original && (
        partida.descripcion !== original.descripcion ||
        partida.id_titulo !== original.id_titulo ||
        partida.id_partida_padre !== original.id_partida_padre ||
        partida.orden !== original.orden ||
        partida.metrado !== original.metrado ||
        partida.precio_unitario !== original.precio_unitario ||
        partida.unidad_medida !== original.unidad_medida
      )) {
        return true;
      }
    }

    return false;
  }, [titulos, partidas, titulosOriginales, partidasOriginales, titulosEliminados, partidasEliminadas]);

  /**
   * Descarta todos los cambios y restaura el estado original
   */
  const handleDescartarCambios = useCallback(() => {
    if (!hayCambiosPendientes) {
      return;
    }

    confirm({
      title: 'Descartar cambios',
      message: '¿Está seguro de descartar todos los cambios? Esta acción no se puede deshacer.',
      confirmText: 'Descartar',
      cancelText: 'Cancelar',
      variant: 'destructive',
      onConfirm: () => {
        // Restaurar títulos y partidas a los valores originales
        setTitulos(JSON.parse(JSON.stringify(titulosOriginales)));
        setPartidas(JSON.parse(JSON.stringify(partidasOriginales)));

        // Limpiar estados de eliminados
        setTitulosEliminados(new Set());
        setPartidasEliminadas(new Set());

        // Limpiar otros estados
        setItemSeleccionado(null);
        setItemsSeleccionadosMultiple(new Set());
        setItemCortado(null);
        setItemsCortadosMultiple(new Set());
        setModoSeleccionMultiple(false);
        setSubpartidasParaCrearApu(new Map());
        setSubpartidasPendientes([]);

        toast.success('Cambios descartados');
      },
    });
  }, [hayCambiosPendientes, titulosOriginales, partidasOriginales, confirm]);

  /**
   * Guarda todos los cambios pendientes usando mutación batch con transacciones
   */
  const handleGuardarCambios = useCallback(async () => {
    if (!hayCambiosPendientes) {
      toast('No hay cambios para guardar', { icon: 'ℹ️' });
      return;
    }

    const tiempoInicio = performance.now();

    try {
      setIsSaving(true);
      
      // Preparar datos para la mutación batch
      const tiempoPreparacion = performance.now();
      const mapeoIdsTitulos: Map<string, string> = new Map(); // temp_id -> real_id (se llenará con la respuesta)

      // 1. Preparar títulos nuevos
      const titulosNuevos = titulos.filter(t => t.id_titulo.startsWith('temp_'));
      const titulosCrear = titulosNuevos.map(titulo => {
        // Calcular numero_item dinámicamente basado en la posición jerárquica actual
        const numeroItemCalculado = calcularNumeroItem(titulo, 'TITULO');
        return {
          id_presupuesto: titulo.id_presupuesto,
          id_proyecto: id_proyecto_real!,
          id_titulo_padre: titulo.id_titulo_padre || undefined,
          nivel: titulo.nivel,
          numero_item: numeroItemCalculado, // Se calcula dinámicamente en frontend y se envía al backend
          descripcion: titulo.descripcion,
          tipo: titulo.tipo,
          orden: titulo.orden,
          // total_parcial ya no se envía, se calcula en frontend
          id_especialidad: titulo.id_especialidad || undefined,
          temp_id: titulo.id_titulo, // ID temporal para mapeo
        };
      });

      // 2. Preparar partidas nuevas
      const partidasNuevas = partidas.filter(p => p.id_partida.startsWith('temp_'));
      const partidasCrear = partidasNuevas.map(partida => {
        // Calcular numero_item dinámicamente basado en la posición jerárquica actual
        const numeroItemCalculado = calcularNumeroItem(partida, 'PARTIDA');
        return {
          id_presupuesto: partida.id_presupuesto,
          id_proyecto: id_proyecto_real!,
          id_titulo: partida.id_titulo, // Puede ser temporal, el backend lo manejará
          id_partida_padre: partida.id_partida_padre || undefined,
          nivel_partida: partida.nivel_partida,
          numero_item: numeroItemCalculado, // Se calcula dinámicamente en frontend y se envía al backend
          descripcion: partida.descripcion,
          unidad_medida: partida.unidad_medida,
          metrado: partida.metrado,
          precio_unitario: partida.precio_unitario,
          // parcial_partida ya no se envía, se calcula en frontend
          orden: partida.orden,
          estado: partida.estado,
          temp_id: partida.id_partida, // ID temporal para mapeo
        };
      });

      // Detectar padres afectados por cambios de orden/padre
      const padresAfectados = new Set<string | null>();
      titulos.forEach(titulo => {
        const original = titulosOriginales.find(t => t.id_titulo === titulo.id_titulo);
        if (original) {
          if (titulo.orden !== original.orden || titulo.id_titulo_padre !== original.id_titulo_padre) {
            padresAfectados.add(original.id_titulo_padre);
            padresAfectados.add(titulo.id_titulo_padre);
          }
        }
      });
      partidas.forEach(partida => {
        const original = partidasOriginales.find(p => p.id_partida === partida.id_partida);
        if (original) {
          if (partida.orden !== original.orden || partida.id_titulo !== original.id_titulo || partida.id_partida_padre !== original.id_partida_padre) {
            const tituloOriginal = titulos.find(t => t.id_titulo === original.id_titulo);
            const tituloNuevo = titulos.find(t => t.id_titulo === partida.id_titulo);
            if (tituloOriginal) padresAfectados.add(tituloOriginal.id_titulo_padre);
            if (tituloNuevo) padresAfectados.add(tituloNuevo.id_titulo_padre);
            padresAfectados.add(original.id_titulo);
            padresAfectados.add(partida.id_titulo);
          }
        }
      });

      // Recalcular numero_item para todos los items de los padres afectados
      const itemsAfectados = new Set<string>();
      padresAfectados.forEach(idPadre => {
        // Títulos del padre
        titulos.filter(t => t.id_titulo_padre === idPadre).forEach(t => itemsAfectados.add(t.id_titulo));
        // Partidas del padre
        if (idPadre === null) {
          // Para root, incluir partidas de todos los títulos raíz
          titulos.filter(t => t.id_titulo_padre === null).forEach(t => {
            partidas.filter(p => p.id_titulo === t.id_titulo && p.id_partida_padre === null).forEach(p => itemsAfectados.add(p.id_partida));
          });
        } else {
          partidas.filter(p => p.id_titulo === idPadre && p.id_partida_padre === null).forEach(p => itemsAfectados.add(p.id_partida));
        }
      });

      // 3. Preparar títulos a actualizar
      const titulosActualizar = titulos
        .filter(t => !t.id_titulo.startsWith('temp_'))
        .map(titulo => {
          const original = titulosOriginales.find(t => t.id_titulo === titulo.id_titulo);
          if (!original) return null;

          // Calcular numero_item dinámicamente basado en la posición jerárquica actual
          const numeroItemCalculado = calcularNumeroItem(titulo, 'TITULO');
          const esAfectado = itemsAfectados.has(titulo.id_titulo);

          const cambios: any = { id_titulo: titulo.id_titulo };
          if (titulo.descripcion !== original.descripcion) cambios.descripcion = titulo.descripcion;
          if (titulo.id_titulo_padre !== original.id_titulo_padre) cambios.id_titulo_padre = titulo.id_titulo_padre;
          if (titulo.orden !== original.orden) cambios.orden = titulo.orden;
          if (titulo.nivel !== original.nivel) cambios.nivel = titulo.nivel;
          // Actualizar numero_item si cambió O si es afectado por cambios de jerarquía
          if (numeroItemCalculado !== original.numero_item || esAfectado) {
            cambios.numero_item = numeroItemCalculado;
            // Si es afectado, SIEMPRE incluir orden, padre y nivel para asegurar consistencia en el backend
            if (esAfectado) {
              cambios.orden = titulo.orden;
              cambios.id_titulo_padre = titulo.id_titulo_padre;
              cambios.nivel = titulo.nivel;
            }
          }
          if (titulo.tipo !== original.tipo) cambios.tipo = titulo.tipo;
          // total_parcial ya no se envía, se calcula en frontend

          // Verificar si hay cambios además del id_titulo
          const tieneCambios = Object.keys(cambios).length > 1; // Ya incluye id_titulo

          // Incluir id_especialidad SOLO si cambió (no forzar si hay otros cambios)
          if (titulo.id_especialidad !== original.id_especialidad) {
            cambios.id_especialidad = titulo.id_especialidad || null;
          }

          // Solo retornar si hay cambios reales (más allá del id_titulo)
          if (Object.keys(cambios).length > 1) {
            return cambios;
          }
          return null;
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);

      // 4. Preparar partidas a actualizar
      const partidasActualizar = partidas
        .filter(p => !p.id_partida.startsWith('temp_'))
        .map(partida => {
          const original = partidasOriginales.find(p => p.id_partida === partida.id_partida);
          if (!original) return null;

          // Calcular numero_item dinámicamente basado en la posición jerárquica actual
          const numeroItemCalculado = calcularNumeroItem(partida, 'PARTIDA');
          const esAfectado = itemsAfectados.has(partida.id_partida);

          const cambios: any = { id_partida: partida.id_partida, id_presupuesto: partida.id_presupuesto };
          if (partida.descripcion !== original.descripcion) cambios.descripcion = partida.descripcion;
          if (partida.id_titulo !== original.id_titulo) cambios.id_titulo = partida.id_titulo;
          if (partida.id_partida_padre !== original.id_partida_padre) cambios.id_partida_padre = partida.id_partida_padre;
          if (partida.orden !== original.orden) cambios.orden = partida.orden;
          if (partida.metrado !== original.metrado) cambios.metrado = partida.metrado;
          if (partida.precio_unitario !== original.precio_unitario) cambios.precio_unitario = partida.precio_unitario;
          if (partida.unidad_medida !== original.unidad_medida) cambios.unidad_medida = partida.unidad_medida;
          if (partida.nivel_partida !== original.nivel_partida) cambios.nivel_partida = partida.nivel_partida;
          // Actualizar numero_item si cambió O si es afectado por cambios de jerarquía
          // Si es afectado, también incluir orden y titulo para asegurar consistencia
          if (numeroItemCalculado !== original.numero_item || esAfectado) {
            cambios.numero_item = numeroItemCalculado;
            // Si es afectado pero los campos no cambiaron explícitamente, incluirlos de todos modos
            if (esAfectado && partida.orden === original.orden) cambios.orden = partida.orden;
            if (esAfectado && partida.id_titulo === original.id_titulo) cambios.id_titulo = partida.id_titulo;
            if (esAfectado && partida.nivel_partida === original.nivel_partida) cambios.nivel_partida = partida.nivel_partida;
          }
          if (partida.estado !== original.estado) cambios.estado = partida.estado;
          // parcial_partida ya no se envía, se calcula en frontend

          return Object.keys(cambios).length > 1 ? cambios : null; // Solo si hay cambios además del id
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      // 5. Preparar IDs a eliminar
      const titulosEliminar = Array.from(titulosEliminados);
      const partidasEliminar = Array.from(partidasEliminadas);

      const tiempoPreparacionTotal = performance.now() - tiempoPreparacion;

      // Ejecutar mutación batch con transacción
      const tiempoBatchInicio = performance.now();
      const response = await executeMutation<{
        batchEstructuraPresupuesto: {
          success: boolean;
          message?: string;
          titulosCreados: Array<{ id_titulo: string; temp_id?: string }>;
          partidasCreadas: Array<{ id_partida: string; temp_id?: string }>;
          titulosActualizados: Array<{ id_titulo: string }>;
          partidasActualizadas: Array<{ id_partida: string }>;
          titulosEliminados: string[];
          partidasEliminadas: string[];
          apusCreados: any[];
          preciosCreados: any[];
        };
      }>(BATCH_ESTRUCTURA_PRESUPUESTO_MUTATION, {
        input: {
          titulosCrear,
          partidasCrear,
          titulosActualizar,
          partidasActualizar,
          titulosEliminar,
          partidasEliminar,
          apusCrear: apusTemporales.length > 0 ? apusTemporales.map(apu => ({
            id_apu: apu.id_apu,
            id_partida: apu.id_partida, // Aún temporal, se resolverá en backend
            rendimiento: apu.rendimiento,
            jornada: apu.jornada,
            recursos: apu.recursos
          })) : undefined,
          preciosCrear: preciosCompartidosTemporales.length > 0 ? preciosCompartidosTemporales.map(precio => ({
            ...precio,
            id_presupuesto: id_presupuesto // Forzar el presupuesto actual
          })) : undefined,
        },
      });

      const tiempoBatchTotal = performance.now() - tiempoBatchInicio;

      if (!response.batchEstructuraPresupuesto.success) {
        throw new Error(response.batchEstructuraPresupuesto.message || 'Error al guardar los cambios');
      }

      // Los APUs y precios ya se crearon en la mutación batch

      // Subpartidas y sus APUs ya se manejan en la mutación batch

      // Invalidar queries para recargar datos
      const tiempoInvalidacionInicio = performance.now();
      queryClient.invalidateQueries({ queryKey: ['estructura-presupuesto', id_presupuesto] });
      const tiempoInvalidacionTotal = performance.now() - tiempoInvalidacionInicio;
      
      // NO esperar - React Query maneja el refetch automáticamente
      
      // Refetch usando fetchQuery que respeta el hook y sus cálculos
      const tiempoRefetchInicio = performance.now();

      // Forzar refetch invalidando primero
      await queryClient.invalidateQueries({ queryKey: ['estructura-presupuesto', id_presupuesto] });
      await queryClient.refetchQueries({ queryKey: ['estructura-presupuesto', id_presupuesto] });

      const estructuraCalculada = await queryClient.fetchQuery<import('@/hooks/usePresupuestos').EstructuraPresupuesto | null>({
        queryKey: ['estructura-presupuesto', id_presupuesto],
      });
      const tiempoRefetchTotal = performance.now() - tiempoRefetchInicio;
      
      // El hook ya calculó parcial_presupuesto, monto_igv, monto_utilidad y total_presupuesto
      // Solo tomamos esos valores que ya están calculados y los guardamos en backend
      if (estructuraCalculada?.presupuesto) {
        const parcialPresupuesto = estructuraCalculada.presupuesto.parcial_presupuesto || 0;
        const montoIGV = estructuraCalculada.presupuesto.monto_igv || 0;
        const montoUtilidad = estructuraCalculada.presupuesto.monto_utilidad || 0;
        const totalPresupuesto = estructuraCalculada.presupuesto.total_presupuesto || 0;

        // Guardar totales en el backend para uso en otras partes de la app
        try {
          const tiempoGuardarTotalesInicio = performance.now();
          await executeMutation<{ updatePresupuesto: any }>(
            UPDATE_PRESUPUESTO_MUTATION,
            {
              id_presupuesto: id_presupuesto,
              parcial_presupuesto: parcialPresupuesto,
              monto_igv: montoIGV,
              monto_utilidad: montoUtilidad,
              total_presupuesto: totalPresupuesto
            }
          );
          const tiempoGuardarTotalesTotal = performance.now() - tiempoGuardarTotalesInicio;
        } catch (error) {
          console.error('[FRONTEND] ❌ Error al guardar totales del presupuesto:', error);
          // No mostrar error al usuario, es una operación secundaria
        }
      }

      const tiempoTotal = performance.now() - tiempoInicio;
      console.log(`[FRONTEND] ✅ Guardado completo: ${tiempoTotal.toFixed(2)}ms`);

      // Limpiar estados de eliminados y elementos nuevos ya guardados
      setTitulosEliminados(new Set());
      setPartidasEliminadas(new Set());
      setApusTemporales([]);
      setPreciosCompartidosTemporales([]);

      // APUs y precios ya se guardaron en la mutación batch

      // Limpiar estados después del guardado exitoso
      setModoSeleccionMultiple(false);
      setItemsSeleccionadosMultiple(new Set());
      setItemSeleccionado(null);
      setItemCortado(null);
      setItemsCortadosMultiple(new Set());

      // Limpiar elementos nuevos de integración de plantilla
      setApusTemporales([]);
      setPreciosCompartidosTemporales([]);

      toast.success(response.batchEstructuraPresupuesto.message || 'Cambios guardados exitosamente');
    } catch (error: any) {
      console.error('Error al guardar cambios:', error);
      toast.error(error?.message || 'Error al guardar los cambios. Se hizo rollback de todas las operaciones.');
    } finally {
      setIsSaving(false);
    }
  }, [
    hayCambiosPendientes,
    titulos,
    partidas,
    titulosOriginales,
    partidasOriginales,
    titulosEliminados,
    partidasEliminadas,
    id_proyecto_real,
    id_presupuesto,
    queryClient,
    calcularNumeroItem,
  ]);

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


  // ============================================================================
  // RENDERIZADO
  // ============================================================================

  // Obtener nombre del presupuesto de los datos reales
  const nombrePresupuestoReal = estructuraData?.presupuesto?.nombre_presupuesto || nombre_presupuesto;

  // Mostrar loading o error
  if (isLoading) {
    return (
      <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg border border-[var(--border-color)] p-8">
        <LoadingSpinner size={80} showText={true} text="Cargando estructura del presupuesto..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg border border-[var(--border-color)] p-8">
        <div className="text-center">
          <p className="text-sm text-red-500">Error al cargar la estructura del presupuesto</p>
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg border border-[var(--border-color)] card-shadow h-full flex flex-col">
      {/* Header compacto */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-[var(--border-color)] flex items-center justify-between gap-2 table-header-shadow">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {(id_proyecto || rutaRetorno) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Limpiar los params guardados al regresar
                sessionStorage.removeItem('licitaciones_return_params');
                sessionStorage.removeItem('contractuales_return_params');
                sessionStorage.removeItem('meta_return_params');
                
                if (rutaRetorno) {
                  router.push(rutaRetorno);
                } else if (id_proyecto) {
                  router.push(`/proyectos/${id_proyecto}`);
                } else {
                  router.back();
                }
              }}
              className="h-6 w-6 p-0 flex-shrink-0"
              title="Volver"
            >
              <ArrowLeft className="h-3 w-3" />
            </Button>
          )}
          <span className="text-xs text-[var(--text-secondary)] truncate uppercase font-bold">
            {nombrePresupuestoReal}
            {estructuraData?.presupuesto?.total_presupuesto !== undefined && (
              <span className="ml-2 font-semibold text-[var(--text-primary)]">
                Total: S/ {estructuraData.presupuesto.total_presupuesto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Botón Descartar Cambios */}
          {modo === 'edicion' && hayCambiosPendientes && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDescartarCambios}
              disabled={isSaving || isSavingRecursos}
              className="flex items-center gap-1.5 h-6 px-2 text-xs border-red-300 hover:bg-red-50 hover:border-red-400 text-red-600 dark:border-red-700 dark:hover:bg-red-900/20 dark:text-red-400"
              title="Descartar todos los cambios y volver al estado original"
            >
              <RotateCcw className="h-3 w-3" />
              Descartar
            </Button>
          )}
          {/* Botón Guardar Cambios */}
          {modo === 'edicion' && (
            <Button
              size="sm"
              variant={hayCambiosPendientes ? "default" : "outline"}
              onClick={handleGuardarCambios}
              disabled={(!hayCambiosPendientes && !isSaving && !isSavingRecursos) || isSaving || isSavingRecursos || integrandoPlantilla || createTitulo.isPending || updateTitulo.isPending || createPartida.isPending || updatePartida.isPending || deleteTitulo.isPending || deletePartida.isPending}
              className={`flex items-center gap-1.5 h-6 px-2 text-xs ${hayCambiosPendientes ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''
                }`}
              title={hayCambiosPendientes ? 'Guardar cambios pendientes' : 'No hay cambios para guardar'}
            >
              {(isSaving || isSavingRecursos) ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              {(isSaving || isSavingRecursos) ? 'Guardando...' : integrandoPlantilla ? 'Integrando...' : (hayCambiosPendientes ? 'Guardar cambios' : 'Sin cambios')}
              {hayCambiosPendientes && !isSaving && !isSavingRecursos && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              )}
            </Button>
          )}
          {/* Botones de acción globales */}
          {modo === 'edicion' && (
            <div className="flex items-center gap-1 border-r border-[var(--border-color)] pr-2 mr-2">
              {/* Botón modo múltiple */}
              <Button
                size="sm"
                variant={modoSeleccionMultiple ? "default" : "ghost"}
                onClick={() => {
                  setModoSeleccionMultiple(!modoSeleccionMultiple);
                  if (!modoSeleccionMultiple) {
                    // Al activar modo múltiple, mover la selección actual si existe
                    if (itemSeleccionado) {
                      setItemsSeleccionadosMultiple(new Set([itemSeleccionado]));
                      setItemSeleccionado(null);
                    }
                  } else {
                    // Al desactivar modo múltiple, limpiar selección múltiple
                    setItemsSeleccionadosMultiple(new Set());
                  }
                }}
                className="h-6 w-6 p-0"
                title={modoSeleccionMultiple ? "Desactivar selección múltiple" : "Activar selección múltiple"}
              >
                <CheckSquare className="h-3 w-3" />
              </Button>
              {hayItemsCortados ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (itemSeleccionado && !haySeleccionMultiple) {
                        handlePegar(itemSeleccionado);
                      }
                    }}
                    disabled={!itemSeleccionado || haySeleccionMultiple}
                    className="h-6 w-6 p-0"
                    title={haySeleccionMultiple ? "Desactivo en selección múltiple" : !itemSeleccionado ? "Seleccione un destino para pegar" : "Pegar aquí"}
                  >
                    <Clipboard className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelarCorte}
                    className="h-6 w-6 p-0"
                    title="Cancelar corte"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (modoSeleccionMultiple && itemsSeleccionadosMultiple.size > 0) {
                      // En modo múltiple, cortar el primer item seleccionado
                      const primerId = Array.from(itemsSeleccionadosMultiple)[0];
                      if (primerId) handleCortar(primerId);
                    } else if (itemSeleccionado && !modoSeleccionMultiple) {
                      handleCortar(itemSeleccionado);
                    }
                  }}
                  disabled={
                    (!modoSeleccionMultiple && !itemSeleccionado) || 
                    (modoSeleccionMultiple && (itemsSeleccionadosMultiple.size === 0 || !todosSonHermanos))
                  }
                  className="h-6 w-6 p-0"
                  title={
                    modoSeleccionMultiple
                      ? itemsSeleccionadosMultiple.size === 0
                        ? "Seleccione items para cortar"
                        : !todosSonHermanos
                        ? "Los items seleccionados deben ser hermanos para cortar"
                        : "Cortar items seleccionados"
                      : "Cortar"
                  }
                >
                  <Scissors className="h-3 w-3" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (itemSeleccionado && !haySeleccionMultiple) {
                    handleSubir(itemSeleccionado);
                  }
                }}
                disabled={!itemSeleccionado || haySeleccionMultiple}
                className="h-6 w-6 p-0"
                title={haySeleccionMultiple ? "Desactivo en selección múltiple" : "Subir"}
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (itemSeleccionado && !haySeleccionMultiple) {
                    handleBajar(itemSeleccionado);
                  }
                }}
                disabled={!itemSeleccionado || haySeleccionMultiple}
                className="h-6 w-6 p-0"
                title={haySeleccionMultiple ? "Desactivo en selección múltiple" : "Bajar"}
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (itemSeleccionado && !haySeleccionMultiple) {
                    handleMoverIzquierda(itemSeleccionado);
                  }
                }}
                disabled={!itemSeleccionado || haySeleccionMultiple || (itemSeleccionado ? !puedeMoverIzquierda(itemSeleccionado) : true)}
                className="h-6 w-6 p-0"
                title={haySeleccionMultiple ? "Desactivo en selección múltiple" : "Mover a la izquierda (subir nivel)"}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (itemSeleccionado && !haySeleccionMultiple) {
                    handleMoverDerecha(itemSeleccionado);
                  }
                }}
                disabled={!itemSeleccionado || haySeleccionMultiple || (itemSeleccionado ? !puedeMoverDerecha(itemSeleccionado) : true)}
                className="h-6 w-6 p-0"
                title={haySeleccionMultiple ? "Desactivo en selección múltiple" : "Mover a la derecha (bajar nivel)"}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (modoSeleccionMultiple && itemsSeleccionadosMultiple.size > 0) {
                    // Usar la función de eliminación múltiple que agrupa todo
                    handleEliminarMultiple();
                  } else if (!modoSeleccionMultiple && itemSeleccionado) {
                    // Eliminar item seleccionado en modo normal
                    const tipo = obtenerTipoItem(itemSeleccionado);
                    if (tipo === 'TITULO') {
                      handleEliminarTitulo(itemSeleccionado);
                    } else if (tipo === 'PARTIDA') {
                      handleEliminarPartida(itemSeleccionado);
                    }
                  }
                }}
                disabled={modoSeleccionMultiple ? itemsSeleccionadosMultiple.size === 0 : !itemSeleccionado}
                className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                title={
                  modoSeleccionMultiple
                    ? itemsSeleccionadosMultiple.size > 0
                      ? `Eliminar ${itemsSeleccionadosMultiple.size} item(s)`
                      : "Eliminar"
                    : "Eliminar"
                }
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
          {modo === 'edicion' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCrearTitulo}
                className="flex items-center gap-1 h-6 px-1.5 text-xs"
                title="Crear nuevo título"
              >
                <Plus className="h-3 w-3" />
                Título
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCrearPartida}
                className="flex items-center gap-1 h-6 px-1.5 text-xs"
                title="Crear nueva partida"
              >
                <Plus className="h-3 w-3" />
                Partida
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Contenedor Principal - Layout Redimensionable */}
      <div ref={containerRef} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Panel Superior - Tabla de Estructura */}
        <div
          className="overflow-y-auto overflow-x-auto min-h-0 flex-shrink"
          style={{ height: `${100 - panelInferiorHeight}%` }}
        >
          <div className="py-1">
            <table className="w-full table-fixed divide-y divide-[var(--border-color)] text-xs">
              <thead className="sticky top-0 bg-[var(--card-bg)] z-10 table-header-shadow">
                <tr>
                  <th className="w-[100px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)]">
                    Item
                  </th>
                  <th className="w-auto px-2 py-1 text-left font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)]">
                    Descripción
                  </th>
                  <th className="w-[90px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)]">
                    Und.
                  </th>
                  <th className="w-[110px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)]">
                    Metrado
                  </th>
                  <th className="w-[130px] px-2 py-1 text-center font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-r border-[var(--border-color)]">
                    P. Unitario
                  </th>
                  <th className="w-[150px] px-2 py-1 text-right font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    <div className="flex flex-col items-end leading-none">
                      <span>Parcial</span>
                      {estructuraData?.presupuesto?.parcial_presupuesto !== undefined && (
                        <span className="text-xs text-purple-800 dark:text-purple-400 font-semibold mt-0">
                          S/{estructuraData.presupuesto.parcial_presupuesto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[var(--background)] divide-y divide-[var(--border-color)]">
                {estructuraUnificada.map((item) => {
                  if (item.tipo === 'TITULO') {
                    const titulo = item.data;
                    const estaColapsado = titulosColapsados.has(titulo.id_titulo);
                    const tieneHijos = tieneHijosTitulo(titulo.id_titulo);
                    const tienePartidasEnTitulo = tienePartidas(titulo.id_titulo);
                    const partidasDelTitulo = getPartidasDeTitulo(titulo.id_titulo);
                    const esSeleccionado = estaSeleccionado(titulo.id_titulo);
                    const esCortado = itemCortado === titulo.id_titulo || itemsCortadosMultiple.has(titulo.id_titulo);
                    // Un título puede colapsarse si tiene hijos (títulos) O partidas
                    const puedeColapsar = tieneHijos || tienePartidasEnTitulo;

                    // Si algún ancestro está colapsado, no mostrar
                    if (estaOcultoPorColapso(titulo)) {
                      return null;
                    }

                    return (
                      <React.Fragment key={titulo.id_titulo}>
                        {/* Fila de Título */}
                        <tr
                          className={`
                      ${esSeleccionado ? 'bg-blue-500/10' : 'bg-[var(--card-bg)]'}
                      ${esCortado ? 'opacity-50' : ''}
                      ${modo === 'edicion' ? (esSeleccionado ? 'hover:bg-blue-500/15 cursor-pointer' : 'hover:bg-[var(--card-bg)]/80 cursor-pointer') : 'cursor-default'}
                      transition-colors
                    `}
                          onClick={(e) => handleSeleccionar(titulo.id_titulo, e)}
                          onDoubleClick={() => modo === 'edicion' && handleEditarTitulo(titulo.id_titulo)}
                        >
                          {/* Item */}
                          <td className={`px-2 py-1 text-right border-r border-[var(--border-color)] whitespace-nowrap ${getColorPorNivel(titulo.id_titulo, titulo.tipo)}`}>
                            <span className="text-xs font-mono">{calcularNumeroItem(titulo, 'TITULO')}</span>
                          </td>

                          {/* Descripción */}
                          <td className="px-2 py-1 border-r border-[var(--border-color)]">
                            <div className="flex items-center gap-1.5">
                              {puedeColapsar && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleColapsoTitulo(titulo.id_titulo);
                                  }}
                                  className="flex-shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                >
                                  {estaColapsado ? (
                                    <ChevronRight className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )}
                                </button>
                              )}
                              {!puedeColapsar && <div className="w-3" />}
                              <span
                                className={`font-medium ${getColorPorNivel(titulo.id_titulo, titulo.tipo)}`}
                                style={{ paddingLeft: `${(calcularNivelDinamico(titulo.id_titulo) - 1) * 12}px` }}
                              >
                                {titulo.descripcion}
                                {/* <span className="ml-2 text-[8px] text-[var(--text-secondary)] opacity-60 font-normal">
                                  [{titulo.orden}]
                                </span> */}
                              </span>
                            </div>
                          </td>

                          {/* Und. */}
                          <td className="px-2 py-1 text-center border-r border-[var(--border-color)] whitespace-nowrap">
                            <span className="text-xs text-[var(--text-secondary)]">-</span>
                          </td>

                          {/* Metrado */}
                          <td className="px-2 py-1 text-center border-r border-[var(--border-color)] whitespace-nowrap">
                            <span className="text-xs text-[var(--text-secondary)]">-</span>
                          </td>

                          {/* Precio */}
                          <td className="px-2 py-1 text-center border-r border-[var(--border-color)] whitespace-nowrap">
                            <span className="text-xs text-[var(--text-secondary)]">-</span>
                          </td>

                          {/* Parcial */}
                          <td className={`px-2 py-1 text-right whitespace-nowrap ${getColorPorNivel(titulo.id_titulo, titulo.tipo)}`}>
                            <span className="text-xs">S/ {titulo.total_parcial.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  } else {
                    // Es una partida principal (solo partidas principales, sin subpartidas)
                    const partida = item.data;

                    // Solo mostrar partidas principales (sin id_partida_padre)
                    if (partida.id_partida_padre !== null) {
                      return null; // No mostrar subpartidas aquí
                    }

                    const esSeleccionadaPartida = estaSeleccionado(partida.id_partida);
                    const esCortadaPartida = itemCortado === partida.id_partida || itemsCortadosMultiple.has(partida.id_partida);

                    // Si su título padre está colapsado, no mostrar
                    const tituloPadre = titulos.find(t => t.id_titulo === partida.id_titulo);
                    // Si algún ancestro del título padre está colapsado, no mostrar
                    if (estaOcultoPorColapso(partida)) {
                      return null;
                    }

                    return (
                      <tr
                        key={partida.id_partida}
                        className={`
                    ${esSeleccionadaPartida ? 'bg-green-500/10' : 'bg-[var(--background)]'}
                    ${esCortadaPartida ? 'opacity-50' : ''}
                    ${modo === 'edicion' ? (esSeleccionadaPartida ? 'hover:bg-green-500/15 cursor-pointer' : 'hover:bg-[var(--background)]/80 cursor-pointer') : 'cursor-default'}
                    transition-colors
                  `}
                        onClick={(e) => handleSeleccionar(partida.id_partida, e)}
                        onDoubleClick={() => modo === 'edicion' && handleEditarPartida(partida.id_partida)}
                      >
                        {/* Item */}
                        <td className="px-2 py-1 text-right border-r border-[var(--border-color)] whitespace-nowrap">
                          <span className="text-xs font-mono text-[var(--text-secondary)]">{calcularNumeroItem(partida, 'PARTIDA')}</span>
                        </td>

                        {/* Descripción */}
                        <td className="px-2 py-1 border-r border-[var(--border-color)]">
                          <div className="flex items-center gap-1.5">
                            <div className="w-3" />
                            <span
                              className="text-[var(--text-primary)]"
                              style={{
                                paddingLeft: `${(calcularNivelDinamico(partida.id_titulo) + (partida.nivel_partida - 1)) * 12}px`
                              }}
                            >
                              {partida.descripcion}
                              {/* <span className="ml-2 text-[8px] text-[var(--text-secondary)] opacity-60 font-normal">
                                [{partida.orden}]
                              </span> */}
                            </span>
                          </div>
                        </td>

                        {/* Und. */}
                        <td className="px-2 py-1 text-center border-r border-[var(--border-color)] whitespace-nowrap">
                          <span className="text-xs text-[var(--text-secondary)]">{partida.unidad_medida}</span>
                        </td>

                        {/* Metrado */}
                        <td 
                          className="px-2 py-1 text-center border-r border-[var(--border-color)] whitespace-nowrap"
                          onClick={(e) => handleIniciarEdicionMetrado(partida.id_partida, partida.metrado, e)}
                        >
                          {partidaEditandoMetrado === partida.id_partida ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={valorMetradoTemporal}
                              onChange={(e) => setValorMetradoTemporal(e.target.value)}
                              onBlur={() => handleGuardarMetrado(partida.id_partida)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleGuardarMetrado(partida.id_partida);
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  handleCancelarEdicionMetrado(partida.id_partida);
                                }
                              }}
                              className="w-full text-xs text-center h-6 px-1"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span 
                              className={`text-xs ${modo === 'edicion' ? 'text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}
                              title={modo === 'edicion' ? 'Clic para editar' : ''}
                            >
                              {partida.metrado.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                            </span>
                          )}
                        </td>

                        {/* Precio */}
                        <td className="px-2 py-1 text-center border-r border-[var(--border-color)] whitespace-nowrap">
                          <span className="text-xs text-[var(--text-secondary)]">S/ {(partida.precio_unitario || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                        </td>

                        {/* Parcial */}
                        <td className="px-2 py-1 text-right whitespace-nowrap">
                          <span className="text-xs text-[var(--text-primary)]">S/ {(partida.parcial_partida || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                        </td>
                      </tr>
                    );
                  }
                })}
              </tbody>
            </table>
            {/* Estado vacío */}
            {estructuraUnificada.length === 0 && (
              <div className="text-center py-8">
                <p className="text-xs text-[var(--text-secondary)]">
                  No hay títulos o partidas aún. Agrega el primero usando el botón "Título".
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Divisor Redimensionable */}
        <div
          className="flex-shrink-0 h-1 bg-[var(--border-color)] hover:bg-blue-500 cursor-row-resize transition-colors relative group table-header-shadow"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-0.5 bg-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity rounded" />
          </div>
        </div>

        {/* Panel Inferior - Detalle de Partida */}
        <div
          className="flex-shrink-0 min-h-0 overflow-hidden"
          style={{ height: `${panelInferiorHeight}%` }}
        >
          <DetallePartidaPanel
            id_partida={partidaSeleccionada}
            id_presupuesto={id_presupuesto}
            id_proyecto={id_proyecto_real}
            partida={partidaSeleccionada ? partidas.find(p => p.id_partida === partidaSeleccionada) || null : null}
            apuCalculado={partidaSeleccionada ? apusCombinados.find(apu => apu.id_partida === partidaSeleccionada) || null : null}
            apusCalculados={apusCombinados}
            onCerrarPanel={() => {
              setPanelInferiorHeight(0);
              if (modoSeleccionMultiple) {
                setItemsSeleccionadosMultiple(new Set());
              } else {
                setItemSeleccionado(null);
              }
            }}
            onAgregarSubPartida={() => {
              setSubPartidaParaEditar(null);
              setModalAgregarSubPartidaAbierto(true);
            }}
            onEditarSubPartida={(idPartidaSubpartida, recursos, idPartidaOriginal, rendimiento, jornada, descripcion) => {
              // Guardar TODOS los datos de la subpartida para cargarlos en el modal
              setSubPartidaParaEditar({
                id: idPartidaSubpartida,
                recursos,
                idPartidaOriginal,
                rendimiento,
                jornada,
                descripcion
              });
              setModalAgregarSubPartidaAbierto(true);
            }}
            subpartidasPendientes={subpartidasPendientes}
            onLimpiarSubpartidasPendientes={() => {
              setSubpartidasPendientes([]);
            }}
            subPartidaParaActualizar={subPartidaParaActualizar}
            onLimpiarSubPartidaParaActualizar={() => {
              setSubPartidaParaActualizar(null);
            }}
            onEliminarSubPartida={(idPartidaSubpartida) => {
              // Eliminar la subpartida del estado de partidas
              setPartidas(prev => prev.filter(p => p.id_partida !== idPartidaSubpartida));

              // También eliminarla de las subpartidas para crear APU si existe
              setSubpartidasParaCrearApu(prev => {
                const newMap = new Map(prev);
                newMap.delete(idPartidaSubpartida);
                return newMap;
              });
            }}
            onGuardandoCambios={(isGuardando) => {
              setIsSavingRecursos(isGuardando);
            }}
            modo={modo as 'edicion' | 'lectura' | 'meta' | 'licitacion' | 'contractual'}
          />
        </div>
      </div>

      {/* Modal para crear/editar título o partida */}
      <Modal
        isOpen={modalAbierto}
        onClose={handleCerrarModal}
        title={
          (tipoItemModal === 'TITULO' || tipoItemModal === 'PARTIDA') && !tituloEditando && !partidaEditando ? (
            <div className="flex justify-center items-center w-full h-full">
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setUsarPlantillaTituloModal(false)}
                  className={`px-4 py-2 text-xs font-medium rounded-md transition-all duration-200 ${
                    !usarPlantillaTituloModal
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background)]/40'
                  }`}
                >
                  {tipoItemModal === 'TITULO' ? 'Nuevo título' : 'Nueva partida'}
                </button>
                <button
                  type="button"
                  onClick={() => setUsarPlantillaTituloModal(true)}
                  className={`px-4 py-2 text-xs font-medium rounded-md transition-all duration-200 ${
                    usarPlantillaTituloModal
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400 shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background)]/40'
                  }`}
                >
                  {tipoItemModal === 'TITULO' ? 'Título existente' : 'Partidas existente'}
                </button>
              </div>
            </div>
          ) : (
            tipoItemModal === 'TITULO'
              ? 'Editar Título'
              : (partidaEditando ? 'Editar Partida' : 'Crear Partida')
          )
        }
        size={(tipoItemModal === 'TITULO' || tipoItemModal === 'PARTIDA') && !tituloEditando && !partidaEditando && usarPlantillaTituloModal ? 'lg' : 'sm'}
      >
        <CrearPartidasTitulosForm
          nombre={nombreItem}
          onNombreChange={setNombreItem}
          onSave={handleGuardarItem}
          onCancel={handleCerrarModal}
          isEdit={!!(tituloEditando || partidaEditando)}
          tipo={tipoItemModal}
          partidaData={partidaEditando ? {
            unidad_medida: partidaEditando.unidad_medida,
            metrado: partidaEditando.metrado,
            precio_unitario: partidaEditando.precio_unitario,
            parcial_partida: partidaEditando.parcial_partida,
          } : undefined}
          id_especialidad={tituloEditando?.id_especialidad}
          id_proyecto={id_proyecto}
          onUsarPlantillaChange={setUsarPlantillaTituloModal}
          mantenerAPUs={modalMantenerAPUs}
          onMantenerAPUsChange={setModalMantenerAPUs}
          onIntegrarEstructura={(idTituloRaiz, estructuraPlantilla, mantenerAPUsParam) =>
            handleIntegrarEstructura(
              idTituloRaiz,
              estructuraPlantilla,
              mantenerAPUsParam ?? modalMantenerAPUs,
              estructuraData?.precios_compartidos
            )
          }
          onIntegrarPartidasSeleccionadas={(idsPartidas, estructuraPlantilla, mantenerAPUsParam) =>
            handleIntegrarPartidasSeleccionadas(
              idsPartidas,
              estructuraPlantilla,
              mantenerAPUsParam ?? modalMantenerAPUs,
              estructuraData?.precios_compartidos
            )
          }
          usarPlantillaModal={usarPlantillaTituloModal}
        />
      </Modal>

      {/* Modal para agregar subpartida */}
      <ModalAgregarSubPartida
        isOpen={modalAgregarSubPartidaAbierto}
        onClose={() => {
          setModalAgregarSubPartidaAbierto(false);
          setSubPartidaParaEditar(null);
        }}
        partidas={partidas}
        id_presupuesto={id_presupuesto}
        id_proyecto={id_proyecto_real}
        id_partida_padre={itemSeleccionado}
        apusCalculados={apusCombinados}
        onAgregarSubPartida={(subPartida) => {
          // Agregar la subpartida como una nueva partida al estado
          setPartidas(prev => {
            const nuevasPartidas = [...prev, {
              ...subPartida,
              // Asegurar que tenga todos los campos necesarios de Partida
              id_presupuesto: subPartida.id_presupuesto,
              id_proyecto: subPartida.id_proyecto,
              id_titulo: subPartida.id_titulo,
              id_partida_padre: subPartida.id_partida_padre,
              nivel_partida: subPartida.nivel_partida,
              numero_item: subPartida.numero_item,
              descripcion: subPartida.descripcion,
              unidad_medida: subPartida.unidad_medida,
              metrado: subPartida.metrado,
              precio_unitario: subPartida.precio_unitario,
              parcial_partida: subPartida.parcial_partida,
              orden: subPartida.orden,
              estado: subPartida.estado,
            }];

            // NO actualizar el precio_unitario aquí - el backend lo calculará basándose en el APU
            return nuevasPartidas;
          });

          // Guardar la subpartida para crear su APU después
          setSubpartidasParaCrearApu(prev => new Map(prev).set(subPartida.id_partida, subPartida));

          // Agregar la subpartida a la lista de pendientes para que el panel la procese
          setSubpartidasPendientes(prev => [...prev, subPartida]);

          setModalAgregarSubPartidaAbierto(false);
          setSubPartidaParaEditar(null);
        }}
        subPartidaParaEditar={subPartidaParaEditar}
        onActualizarSubPartida={(idSubPartida, subPartida) => {
          // Calcular el precio_unitario basado en los parciales de los recursos
          const costoDirectoSubpartida = (subPartida.recursos || []).reduce((suma, recurso) => suma + (recurso.parcial || 0), 0);
          const nuevoPrecioUnitario = Math.round(costoDirectoSubpartida * 100) / 100;

          // Actualizar la subpartida existente en el estado del padre
          setPartidas(prev => prev.map(p =>
            p.id_partida === idSubPartida
              ? {
                ...p,
                descripcion: subPartida.descripcion,
                unidad_medida: subPartida.unidad_medida,
                precio_unitario: nuevoPrecioUnitario, // Usar el recalculado
                parcial_partida: subPartida.parcial_partida,
              }
              : p
          ));

          // Establecer la subpartida para actualizar en el panel de detalle
          setSubPartidaParaActualizar(subPartida);

          setModalAgregarSubPartidaAbierto(false);
          setSubPartidaParaEditar(null);
        }}
        modo={modo as 'edicion' | 'lectura' | 'meta' | 'licitacion' | 'contractual'}
      />
    </div>
  );
}


