import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { executeQuery, executeMutation } from '@/services/graphql-client';
import {
  GET_RESUMEN_PRESUPUESTO_QUERY,
  GET_HISTORICO_MENSUAL_QUERY,
  GET_RESUMENES_INDIVIDUALES_QUERY,
  SINCRONIZAR_RESUMEN_MUTATION
} from '@/graphql/queries/resumen-presupuesto.queries';
import toast from 'react-hot-toast';

export interface FiltrosResumen {
  id_presupuesto?: string | null;
  id_proyecto?: string | null;
}

export interface ResumenPresupuesto {
  id_resumen: string;
  id_presupuesto: string | null;
  id_proyecto: string | null;
  fecha_calculo: string;
  es_historico: boolean;
  periodo_mes?: number;
  periodo_anio?: number;
  total_presupuesto: number;
  fecha_presupuesto_meta?: string;
  cantidad_presupuestos?: number;
  cantidad_proyectos?: number;
  promedio_por_presupuesto?: number;
  presupuesto_mas_alto?: number;
  presupuesto_mas_bajo?: number;
  total_composicion: number;
  total_unidades?: number;
  costo_por_unidad_meta?: number;
  costo_por_unidad_actual?: number;
  eficiencia?: number;
  varianza?: number;
  progreso_proyecto?: number;
  total_requerimiento: number;
  total_requerimiento_bruto?: number;
  total_ordenes_compra_bienes?: number;
  total_ordenes_compra_bienes_bruto?: number;
  total_ordenes_compra_servicios?: number;
  total_ordenes_compra_servicios_bruto?: number;
  total_recepcion_almacen: number;
  total_recepcion_almacen_bruto?: number;
  diferencia_mayor_gasto?: number;
  diferencia_real_comprometido?: number;
}

// El histórico usa el mismo tipo ResumenPresupuesto pero con es_historico = true
// Solo incluye los campos necesarios para el gráfico
export type ResumenPresupuestoHistorico = Pick<ResumenPresupuesto, 
  'id_resumen' | 
  'id_presupuesto' | 
  'id_proyecto' | 
  'periodo_mes' | 
  'periodo_anio' | 
  'fecha_calculo' | 
  'total_presupuesto' | 
  'total_composicion' | 
  'total_requerimiento' | 
  'total_recepcion_almacen'
>;

/**
 * Hook para obtener resumen de presupuestos
 */
export function useResumenPresupuesto(filtros: FiltrosResumen) {
  const queryClient = useQueryClient();

  const {
    data: resumen,
    isLoading,
    error,
    refetch
  } = useQuery<ResumenPresupuesto | null>({
    queryKey: ['resumenPresupuesto', filtros],
    queryFn: async () => {
      const result = await executeQuery<{ obtenerResumenPresupuesto: ResumenPresupuesto | null }>(
        GET_RESUMEN_PRESUPUESTO_QUERY,
        { filtros }
      );
      return result.obtenerResumenPresupuesto;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false
  });

  const sincronizarMutation = useMutation({
    mutationFn: async (forzar: boolean = false) => {
      const result = await executeMutation<{ sincronizarResumen: ResumenPresupuesto }>(
        SINCRONIZAR_RESUMEN_MUTATION,
        { filtros, forzar }
      );
      return result.sincronizarResumen;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumenPresupuesto', filtros] });
      queryClient.invalidateQueries({ queryKey: ['historicoMensual', filtros] });
      toast.success('Resumen sincronizado exitosamente');
    },
    onError: (error: Error) => {
      toast.error(`Error al sincronizar: ${error.message}`);
    }
  });

  return {
    resumen,
    isLoading,
    error,
    refetch,
    sincronizar: (forzar: boolean = false) => sincronizarMutation.mutate(forzar),
    isSincronizando: sincronizarMutation.isPending
  };
}

/**
 * Hook para obtener histórico mensual
 */
export function useHistoricoMensual(filtros: FiltrosResumen, meses: number = 12) {
  const {
    data: historico,
    isLoading,
    error
  } = useQuery<ResumenPresupuesto[]>({
    queryKey: ['historicoMensual', filtros, meses],
    queryFn: async () => {
      const result = await executeQuery<{ obtenerHistoricoMensual: ResumenPresupuesto[] }>(
        GET_HISTORICO_MENSUAL_QUERY,
        { filtros, meses }
      );
      return result.obtenerHistoricoMensual;
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
    refetchOnWindowFocus: false
  });

  return {
    historico: historico || [],
    isLoading,
    error
  };
}

/**
 * Hook para obtener lista de resúmenes individuales (sin agregación)
 */
export function useResumenesIndividuales(filtros: FiltrosResumen) {
  const {
    data: resumenes,
    isLoading,
    error,
    refetch
  } = useQuery<ResumenPresupuesto[]>({
    queryKey: ['resumenesIndividuales', filtros],
    queryFn: async () => {
      const result = await executeQuery<{ obtenerResumenesIndividuales: ResumenPresupuesto[] }>(
        GET_RESUMENES_INDIVIDUALES_QUERY,
        { filtros }
      );
      return result.obtenerResumenesIndividuales;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false
  });

  return {
    resumenes: resumenes || [],
    isLoading,
    error,
    refetch
  };
}


