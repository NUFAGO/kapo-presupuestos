'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui';
import Modal from '@/components/ui/modal';
import { useEstructuraPresupuesto } from '@/hooks/usePresupuestos';
import type { PartidaEstructura, TituloEstructura } from '@/hooks/usePresupuestos';

interface EstructuraCostosResumenProps {
  id_presupuesto: string;
}


export default function EstructuraCostosResumen({
  id_presupuesto,
}: EstructuraCostosResumenProps) {
  const router = useRouter();
  const [partidasColapsadas, setPartidasColapsadas] = useState<Set<string>>(new Set());
  const [partidaSeleccionada, setPartidaSeleccionada] = useState<PartidaEstructura | null>(null);

  const { data: estructuraData, isLoading, error } = useEstructuraPresupuesto(id_presupuesto);

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


  // Crear lista de partidas ordenadas (solo partidas, sin títulos)
  const partidasOrdenadas = useMemo(() => {
    const todasLasPartidas: PartidaEstructura[] = [];

    // Función recursiva para agregar partidas de un título y sus hijos
    const agregarPartidasDeTitulo = (id_titulo: string) => {
      // Agregar partidas principales del título
      const partidasDelTitulo = getPartidasDeTitulo(id_titulo);
      partidasDelTitulo.forEach(partida => {
        todasLasPartidas.push(partida);
        
        // Agregar subpartidas
        const subpartidas = getSubpartidas(partida.id_partida);
        subpartidas.forEach(subpartida => {
          todasLasPartidas.push(subpartida);
        });
      });

      // Agregar partidas de títulos hijos recursivamente
      const titulosHijos = getHijosTitulo(id_titulo);
      titulosHijos.forEach(tituloHijo => {
        agregarPartidasDeTitulo(tituloHijo.id_titulo);
      });
    };

    // Obtener títulos raíz y procesar sus partidas
    const titulosRaiz = titulos.filter(t => !t.id_titulo_padre).sort((a, b) => a.orden - b.orden);
    titulosRaiz.forEach(titulo => {
      agregarPartidasDeTitulo(titulo.id_titulo);
    });

    return todasLasPartidas;
  }, [titulos, partidas, getPartidasDeTitulo, getSubpartidas, getHijosTitulo]);

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
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center p-1 rounded hover:bg-[var(--card-bg)]/60 transition-colors flex-shrink-0"
            title="Regresar"
          >
            <ArrowLeft className="h-4 w-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" />
          </button>
          <h1 className="text-xs font-semibold text-[var(--text-primary)]">
            Resumen de Costos - {estructuraData.presupuesto.nombre_presupuesto}
          </h1>
        </div>
      </div>

      {/* Estructura */}
      <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow overflow-hidden">
        <div className="overflow-x-auto">
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
                  Parcial
                </th>
              </tr>
            </thead>
            <tbody className="bg-[var(--background)] divide-y divide-[var(--border-color)]">
              {partidasOrdenadas.map((partida) => {
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
                    onClick={() => setPartidaSeleccionada(partida)}
                    className={`${esSubpartida ? 'bg-[var(--background)]/50' : 'bg-[var(--background)]'} transition-colors cursor-pointer hover:bg-[var(--hover-bg)]`}
                  >
                    <td className="px-2 py-1 text-right border-r border-[var(--border-color)] whitespace-nowrap text-[var(--text-primary)]">
                      <span className="text-xs font-mono">{calcularNumeroItem(partida)}</span>
                    </td>
                    <td className="px-2 py-1 border-r border-[var(--border-color)]">
                      <div className="flex items-center gap-1.5">
                        {tieneSubpartidas && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleColapsoPartida(partida.id_partida);
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
                        {!tieneSubpartidas && <div className="w-3" />}
                        <span className={esSubpartida ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}>
                          {partida.descripcion}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-1 text-center border-r border-[var(--border-color)]">
                      {partida.unidad_medida || '-'}
                    </td>
                    <td className="px-2 py-1 text-center border-r border-[var(--border-color)]">
                      {partida.metrado !== undefined && partida.metrado !== null && !isNaN(partida.metrado)
                        ? partida.metrado.toFixed(4)
                        : '-'}
                    </td>
                    <td className="px-2 py-1 text-center border-r border-[var(--border-color)]">
                      {partida.precio_unitario !== undefined && partida.precio_unitario !== null && !isNaN(partida.precio_unitario)
                        ? `S/ ${partida.precio_unitario.toFixed(2)}`
                        : '-'}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {partida.parcial_partida !== undefined && partida.parcial_partida !== null && !isNaN(partida.parcial_partida)
                        ? `S/ ${partida.parcial_partida.toFixed(2)}`
                        : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalle de Partida */}
      <Modal
        isOpen={!!partidaSeleccionada}
        onClose={() => setPartidaSeleccionada(null)}
        title={partidaSeleccionada ? `Detalle de Partida - ${partidaSeleccionada.numero_item}` : ''}
        size="full"
      >
        {partidaSeleccionada && (
          <div className="space-y-4">
            {/* Información Principal */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">Número de Item</label>
                <p className="text-xs text-[var(--text-primary)] mt-1 font-mono">{partidaSeleccionada.numero_item || '-'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">Unidad de Medida</label>
                <p className="text-xs text-[var(--text-primary)] mt-1">{partidaSeleccionada.unidad_medida || '-'}</p>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Descripción</label>
                <p className="text-xs text-[var(--text-primary)] mt-1">{partidaSeleccionada.descripcion || '-'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">Metrado</label>
                <p className="text-xs text-[var(--text-primary)] mt-1">
                  {partidaSeleccionada.metrado !== undefined && partidaSeleccionada.metrado !== null && !isNaN(partidaSeleccionada.metrado)
                    ? partidaSeleccionada.metrado.toFixed(4)
                    : '-'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">Precio Unitario</label>
                <p className="text-xs text-[var(--text-primary)] mt-1">
                  {partidaSeleccionada.precio_unitario !== undefined && partidaSeleccionada.precio_unitario !== null && !isNaN(partidaSeleccionada.precio_unitario)
                    ? `S/ ${partidaSeleccionada.precio_unitario.toFixed(2)}`
                    : '-'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">Parcial</label>
                <p className="text-xs text-[var(--text-primary)] mt-1 font-semibold">
                  {partidaSeleccionada.parcial_partida !== undefined && partidaSeleccionada.parcial_partida !== null && !isNaN(partidaSeleccionada.parcial_partida)
                    ? `S/ ${partidaSeleccionada.parcial_partida.toFixed(2)}`
                    : '-'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">Estado</label>
                <p className="text-xs text-[var(--text-primary)] mt-1">{partidaSeleccionada.estado || '-'}</p>
              </div>
            </div>

            {/* Subpartidas si existen */}
            {getSubpartidas(partidaSeleccionada.id_partida).length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-3">Subpartidas</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[var(--card-bg)]">
                        <th className="px-3 py-2 text-left border border-[var(--border-color)]">Item</th>
                        <th className="px-3 py-2 text-left border border-[var(--border-color)]">Descripción</th>
                        <th className="px-3 py-2 text-center border border-[var(--border-color)]">Und.</th>
                        <th className="px-3 py-2 text-center border border-[var(--border-color)]">Metrado</th>
                        <th className="px-3 py-2 text-center border border-[var(--border-color)]">P. Unitario</th>
                        <th className="px-3 py-2 text-right border border-[var(--border-color)]">Parcial</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSubpartidas(partidaSeleccionada.id_partida).map((subpartida) => (
                        <tr key={subpartida.id_partida} className="bg-[var(--background)]/50">
                          <td className="px-3 py-2 border border-[var(--border-color)] font-mono">{subpartida.numero_item || '-'}</td>
                          <td className="px-3 py-2 border border-[var(--border-color)]">{subpartida.descripcion || '-'}</td>
                          <td className="px-3 py-2 border border-[var(--border-color)] text-center">{subpartida.unidad_medida || '-'}</td>
                          <td className="px-3 py-2 border border-[var(--border-color)] text-center">
                            {subpartida.metrado !== undefined && subpartida.metrado !== null && !isNaN(subpartida.metrado)
                              ? subpartida.metrado.toFixed(4)
                              : '-'}
                          </td>
                          <td className="px-3 py-2 border border-[var(--border-color)] text-center">
                            {subpartida.precio_unitario !== undefined && subpartida.precio_unitario !== null && !isNaN(subpartida.precio_unitario)
                              ? `S/ ${subpartida.precio_unitario.toFixed(2)}`
                              : '-'}
                          </td>
                          <td className="px-3 py-2 border border-[var(--border-color)] text-right">
                            {subpartida.parcial_partida !== undefined && subpartida.parcial_partida !== null && !isNaN(subpartida.parcial_partida)
                              ? `S/ ${subpartida.parcial_partida.toFixed(2)}`
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
