'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SelectSearch } from '@/components/ui/select-search';
import { useEspecialidades } from '@/hooks/useEspecialidades';
import { useUnidades } from '@/hooks/useCatalogos';
import { useBuscarPresupuestosPlantillas, useEstructuraPresupuestoParaPlantilla } from '@/hooks';
import { X } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui';
import VistaEstructuraPlantilla, { type VistaEstructuraPlantillaRef } from './VistaEstructuraPlantilla';
import type { Presupuesto } from '@/hooks/usePresupuestos';

interface CrearPartidasTitulosFormProps {
  nombre: string;
  onNombreChange: (nombre: string) => void;
  onSave: (nombre: string, partidaData?: PartidaData, id_especialidad?: string | null) => void;
  onCancel: () => void;
  isLoading?: boolean;
  isEdit?: boolean;
  tipo?: 'TITULO' | 'PARTIDA';
  partidaData?: PartidaData;
  id_especialidad?: string | null; // Para edición
  id_proyecto?: string; // Para buscar plantillas
  onUsarPlantillaChange?: (usar: boolean) => void; // Callback para notificar cambio de tamaño del modal
  onIntegrarEstructura?: (idTituloRaiz: string, estructuraPlantilla: { titulos: any[], partidas: any[] }, mantenerAPUs?: boolean) => void; // Callback para integrar estructura completa
  onIntegrarPartidasSeleccionadas?: (idsPartidas: string[], estructuraPlantilla: { titulos: any[], partidas: any[] }, mantenerAPUs?: boolean) => void; // Callback para integrar múltiples partidas seleccionadas
  integrandoAutomaticamente?: boolean; // Indica si se está integrando automáticamente
  mantenerAPUs?: boolean; // Estado del checkbox "Mantener APUs y detalles"
  onMantenerAPUsChange?: (mantener: boolean) => void; // Callback para cambiar el estado
  usarPlantillaModal?: boolean; // Estado del tab desde el modal padre
}

interface PartidaData {
  unidad_medida: string;
  metrado: number;
  precio_unitario: number;
  parcial_partida: number;
}

export default function CrearPartidasTitulosForm({
  nombre,
  onNombreChange,
  onSave,
  onCancel,
  isLoading = false,
  isEdit = false,
  tipo = 'TITULO',
  partidaData,
  id_especialidad: id_especialidadProp,
  id_proyecto,
  onUsarPlantillaChange,
  onIntegrarEstructura,
  onIntegrarPartidasSeleccionadas,
  integrandoAutomaticamente = false,
  mantenerAPUs = false,
  onMantenerAPUsChange,
  usarPlantillaModal = false,
}: CrearPartidasTitulosFormProps) {
  const [localNombre, setLocalNombre] = useState(nombre);
  const [localIdEspecialidad, setLocalIdEspecialidad] = useState<string | null>(id_especialidadProp || null);
  const { data: especialidades, isLoading: isLoadingEspecialidades } = useEspecialidades();
  const { data: unidades = [], isLoading: unidadesLoading } = useUnidades();
  
  // Estados para tabs y plantilla de título
  const [activeTab, setActiveTab] = useState<'nuevo' | 'plantilla'>('nuevo');
  const [userChangedTab, setUserChangedTab] = useState(false);
  const [usarPlantillaTitulo, setUsarPlantillaTitulo] = useState(false);
  const [busquedaPlantilla, setBusquedaPlantilla] = useState('');
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<Presupuesto | null>(null);
  const [filtroFasePlantilla, setFiltroFasePlantilla] = useState<'vigente' | 'todas' | 'META' | 'CONTRACTUAL' | 'LICITACION'>('vigente');
  const [titulosMarcados, setTitulosMarcados] = useState<Set<string>>(new Set());
  const [partidasMarcadas, setPartidasMarcadas] = useState<Set<string>>(new Set());
  const vistaEstructuraRef = useRef<VistaEstructuraPlantillaRef>(null);

  // Función para manejar cambio manual del tab por el usuario
  const handleTabChange = useCallback((nuevoTab: 'nuevo' | 'plantilla') => {
    setActiveTab(nuevoTab);
    setUserChangedTab(true);
  }, []);

  // Efecto para sincronizar con el estado del padre (solo si el usuario no cambió manualmente)
  useEffect(() => {
    if (!userChangedTab) {
      const nuevoTab = usarPlantillaModal ? 'plantilla' : 'nuevo';
      setActiveTab(nuevoTab);
    }

    // Sincronizar usarPlantillaTitulo con el padre sin llamar al callback
    if (usarPlantillaModal) {
      setUsarPlantillaTitulo(true);
    } else {
      setUsarPlantillaTitulo(false);
      setPlantillaSeleccionada(null);
      setBusquedaPlantilla('');
      setTitulosMarcados(new Set());
      setPartidasMarcadas(new Set());
    }
  }, [usarPlantillaModal, userChangedTab]);

  // Resetear el estado de cambio manual del usuario cuando cambia usarPlantillaModal
  useEffect(() => {
    setUserChangedTab(false);
  }, [usarPlantillaModal]);

  // Solo llamar al callback cuando el cambio viene del usuario (no del padre)
  const handleUserPlantillaChange = useCallback((nuevoEstado: boolean) => {
    if (onUsarPlantillaChange) {
      onUsarPlantillaChange(nuevoEstado);
    }
  }, [onUsarPlantillaChange]);

  // Solo buscar cuando el tab está activo Y el usuario ha interactuado
  const shouldSearch = activeTab === 'plantilla' && usarPlantillaTitulo && !plantillaSeleccionada;

  // Buscar plantillas - solo cuando el tab está activo y se necesita buscar
  const { data: resultadosBusqueda, isLoading: buscandoPlantillas } = useBuscarPresupuestosPlantillas(
    busquedaPlantilla || undefined, // searchTerm (undefined para mostrar todos cuando no hay búsqueda)
    filtroFasePlantilla, // filtroFase
    1, // page
    100, // limit
    shouldSearch // enabled: solo buscar cuando realmente se necesita
  );

  // Cargar estructura completa de la plantilla seleccionada (con APUs y precios completos)
  const { data: estructuraPlantillaCompleta, isLoading: cargandoEstructura } = useEstructuraPresupuestoParaPlantilla(
    plantillaSeleccionada?.id_presupuesto || null
  );
  
  // Extraer solo los datos del resultado
  const resultadosBusquedaLista = resultadosBusqueda?.data || [];

  // Convertir especialidades a formato SelectSearch
  const especialidadesOptions = useMemo(() => {
    if (!especialidades) return [];
    return especialidades.map(esp => ({
      value: esp.id_especialidad,
      label: esp.nombre,
    }));
  }, [especialidades]);

  const [localPartidaData, setLocalPartidaData] = useState<PartidaData>({
    unidad_medida: partidaData?.unidad_medida || 'und',
    metrado: partidaData?.metrado || 0,
    precio_unitario: partidaData?.precio_unitario || 0,
    parcial_partida: partidaData?.parcial_partida || 0,
  });

  useEffect(() => {
    setLocalNombre(nombre);
  }, [nombre]);


  useEffect(() => {
    if (id_especialidadProp !== undefined) {
      setLocalIdEspecialidad(id_especialidadProp);
    }
  }, [id_especialidadProp]);

  useEffect(() => {
    if (partidaData) {
      setLocalPartidaData({
        unidad_medida: partidaData.unidad_medida || 'und',
        metrado: partidaData.metrado || 0,
        precio_unitario: partidaData.precio_unitario || 0,
        parcial_partida: partidaData.parcial_partida || 0,
      });
    }
  }, [partidaData]);

  const handlePartidaFieldChange = (campo: keyof PartidaData, valor: string | number) => {
    setLocalPartidaData(prev => {
      const nuevo = { ...prev };
      if (campo === 'unidad_medida') {
        nuevo[campo] = valor as string;
      } else {
        const numValor = typeof valor === 'string' ? parseFloat(valor) || 0 : valor;
        nuevo[campo] = numValor;

        // Recalcular parcial_partida cuando cambia metrado o precio_unitario
        if (campo === 'metrado' || campo === 'precio_unitario') {
          nuevo.parcial_partida = nuevo.metrado * nuevo.precio_unitario;
        }
      }
      return nuevo;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (usarPlantillaTitulo) {
      if (tipo === 'TITULO') {
        // Modo plantilla para títulos: integrar toda la estructura del título seleccionado
        if (titulosMarcados.size > 0 && vistaEstructuraRef.current && onIntegrarEstructura) {
          const estructuraPlantilla = vistaEstructuraRef.current.getEstructuraPlantilla();

          // Encontrar el título raíz seleccionado
          const tituloSeleccionado = estructuraPlantilla.titulos.find(t => titulosMarcados.has(t.id_titulo));

          if (tituloSeleccionado && estructuraPlantillaCompleta) {
            // Integrar toda la estructura completa (título + descendientes + APUs + precios)
            onIntegrarEstructura(tituloSeleccionado.id_titulo, estructuraPlantillaCompleta, mantenerAPUs);
          }
        }
      } else if (tipo === 'PARTIDA') {
        // Modo plantilla para partidas: integrar directamente las partidas seleccionadas
        if (partidasMarcadas.size > 0 && vistaEstructuraRef.current && onIntegrarPartidasSeleccionadas && estructuraPlantillaCompleta) {
          // Integrar directamente las partidas seleccionadas con sus APUs
          onIntegrarPartidasSeleccionadas(
            Array.from(partidasMarcadas),
            estructuraPlantillaCompleta,
            mantenerAPUs
          );
        }
      }
    } else {
      // Modo normal: verificar que hay nombre
      if (localNombre.trim()) {
        // Actualizar el estado del padre primero
        onNombreChange(localNombre.trim());
        // Guardar pasando el nombre y los datos de partida si es tipo PARTIDA
        if (tipo === 'PARTIDA') {
          // No enviar precio_unitario ni parcial_partida (se calculan desde el APU)
          // Aplicar 'und' por defecto solo si no se seleccionó ninguna unidad
          const partidaDataToSave = {
            unidad_medida: localPartidaData.unidad_medida || 'und',
            metrado: localPartidaData.metrado,
            precio_unitario: isEdit && partidaData ? partidaData.precio_unitario : 0,
            parcial_partida: isEdit && partidaData ? partidaData.parcial_partida : 0,
          };
          onSave(localNombre.trim(), partidaDataToSave);
        } else {
          // Para TITULO, pasar también id_especialidad
          onSave(localNombre.trim(), undefined, localIdEspecialidad || null);
        }
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {integrandoAutomaticamente && (
        <div className="text-center py-4">
          <div className="text-sm text-[var(--text-secondary)] mb-2">
            {tipo === 'TITULO'
              ? 'Selecciona un título de la estructura para integrarlo automáticamente'
              : 'Selecciona las partidas de la estructura para integrarlas automáticamente'
            }
          </div>
          <div className="text-xs text-green-600 font-medium">
            Una vez seleccionado{tipo === 'PARTIDA' ? 's' : ''}, confirma la integración con el botón "Confirmar Integración"
          </div>
        </div>
      )}


      {!integrandoAutomaticamente && activeTab === 'nuevo' && (
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            {tipo === 'PARTIDA' ? 'Descripción' : 'Nombre'}
          </label>
          <Input
            type="text"
            value={localNombre}
            onChange={(e) => setLocalNombre(e.target.value)}
            placeholder={tipo === 'PARTIDA' ? 'Ingrese la descripción' : 'Ingrese el nombre'}
            autoFocus
            required
            className="text-sm"
          />
        </div>
      )}

      {tipo === 'TITULO' && activeTab === 'nuevo' && (
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Especialidad (Opcional)
          </label>
          <SelectSearch
            value={localIdEspecialidad || null}
            onChange={(value) => {
              setLocalIdEspecialidad(value);
            }}
            options={especialidadesOptions}
            placeholder="Buscar especialidad..."
            className="text-sm text-left"
            isLoading={isLoadingEspecialidades}
          />
        </div>
      )}

      {tipo === 'PARTIDA' && activeTab === 'nuevo' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Unidad de Medida
              </label>
              <SelectSearch
                value={localPartidaData.unidad_medida || null}
                onChange={(value) => {
                  // Permitir que el usuario seleccione cualquier valor, incluyendo null
                  // El valor por defecto 'und' solo se aplicará al guardar si no hay valor
                  handlePartidaFieldChange('unidad_medida', value || '');
                }}
                options={unidades.map(unidad => ({
                  value: unidad.nombre,
                  label: unidad.nombre,
                }))}
                placeholder="Seleccionar unidad..."
                className="text-sm text-left"
                isLoading={unidadesLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Metrado
              </label>
              <Input
                type="number"
                step="0.0001"
                value={localPartidaData.metrado}
                onChange={(e) => handlePartidaFieldChange('metrado', e.target.value)}
                placeholder="0"
                className="text-sm"
              />
            </div>
          </div>
        </>
      )}

      {/* Contenido adicional para plantillas - solo para crear título/partida (no edición) */}
      {(tipo === 'TITULO' || tipo === 'PARTIDA') && !isEdit && id_proyecto && activeTab === 'plantilla' && (
        <div>
          {/* Checkbox para mantener APUs */}
              {plantillaSeleccionada && estructuraPlantillaCompleta && estructuraPlantillaCompleta.apus && estructuraPlantillaCompleta.apus.length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={mantenerAPUs}
                    onChange={(e) => onMantenerAPUsChange?.(e.target.checked)}
                    disabled={isLoading}
                    className="sr-only peer"
                  />
                  <div className="w-3.5 h-3.5 rounded border transition-all flex items-center justify-center peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/20 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed peer-checked:bg-blue-500 peer-checked:border-blue-500 border-[var(--border-color)] bg-[var(--background)]">
                    {mantenerAPUs && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs text-[var(--text-secondary)] peer-disabled:opacity-50">
                    Mantener APUs y detalles
                  </span>
                </label>
              )}

              <div className="space-y-2">
              {/* Buscador de plantillas */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                  Buscar plantilla
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Buscar por nombre o ID del presupuesto..."
                    value={plantillaSeleccionada ? plantillaSeleccionada.nombre_presupuesto : busquedaPlantilla}
                    onChange={(e) => {
                      if (!plantillaSeleccionada) {
                        setBusquedaPlantilla(e.target.value);
                      }
                    }}
                    disabled={isLoading || !!plantillaSeleccionada}
                    className={plantillaSeleccionada ? 'bg-green-500/5 border-green-500/20 pr-8' : ''}
                  />
                  {plantillaSeleccionada && (
                    <button
                      type="button"
                      onClick={() => {
                        setPlantillaSeleccionada(null);
                        setBusquedaPlantilla('');
                        setLocalNombre(nombre); // Restaurar nombre original
                        setTitulosMarcados(new Set());
                        setPartidasMarcadas(new Set());
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filtro por fase */}
              <div>
                <div className="flex gap-4 flex-wrap">
                  {[
                    { value: 'vigente', label: 'Vigentes (Meta)' },
                    { value: 'todas', label: 'Todas las fases' },
                    { value: 'META', label: 'Meta' },
                    { value: 'CONTRACTUAL', label: 'Contractual' },
                    { value: 'LICITACION', label: 'Licitación' },
                  ].map((option) => (
                      <label key={option.value} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="fase-plantilla-titulo"
                          value={option.value}
                          checked={filtroFasePlantilla === option.value}
                          onChange={(e) => setFiltroFasePlantilla(e.target.value as typeof filtroFasePlantilla)}
                          disabled={isLoading}
                          className="sr-only peer"
                        />
                        <div className={`w-3.5 h-3.5 rounded-full border transition-all flex items-center justify-center 
                          peer-checked:bg-blue-500 peer-checked:border-blue-500 
                          border-[var(--border-color)] bg-[var(--background)]`}>
                          {filtroFasePlantilla === option.value && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <span className={`text-xs transition-colors ${
                          filtroFasePlantilla === option.value ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'
                        }`}>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

              {/* Lista de resultados de búsqueda */}
              {!plantillaSeleccionada && (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {buscandoPlantillas ? (
                    <div className="flex items-center justify-center py-6">
                      <LoadingSpinner size={20} />
                      <span className="ml-2 text-xs text-[var(--text-secondary)]">Buscando plantillas...</span>
                    </div>
                  ) : resultadosBusquedaLista && resultadosBusquedaLista.length > 0 ? (
                    resultadosBusquedaLista.map((plantilla: Presupuesto) => (
                      <div
                        key={plantilla.id_presupuesto}
                        onClick={() => {
                          if (!isLoading) {
                            setPlantillaSeleccionada(plantilla);
                            setBusquedaPlantilla('');
                          }
                        }}
                        className="p-2.5 rounded-lg border cursor-pointer transition-all text-xs border-[var(--border-color)] bg-[var(--background)]/50 hover:bg-[var(--background)]/70"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-[var(--text-primary)] truncate text-xs">
                              {plantilla.nombre_presupuesto}
                            </h4>
                            <p className="text-[var(--text-secondary)] mt-0.5 text-xs">
                              ID: {plantilla.id_presupuesto}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center gap-1">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  plantilla.fase === 'META'
                                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                    : plantilla.fase === 'CONTRACTUAL'
                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                    : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                                }`}>
                                  V{plantilla.version} {plantilla.fase}
                                </span>
                                {filtroFasePlantilla === 'vigente' && plantilla.fase === 'META' && plantilla.estado === 'vigente' && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                    VIGENTE
                                  </span>
                                )}
                              </div>
                              <span className="text-[var(--text-secondary)] text-xs">
                                S/ {plantilla.total_presupuesto?.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : busquedaPlantilla && busquedaPlantilla.trim() ? (
                    <div className="text-center py-6">
                      <p className="text-xs text-[var(--text-secondary)]">
                        No se encontraron plantillas que coincidan con "{busquedaPlantilla}"
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-xs text-[var(--text-secondary)]">
                        Escribe para buscar plantillas disponibles
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Vista de estructura de la plantilla */}
              {plantillaSeleccionada && (
                <VistaEstructuraPlantilla
                  ref={vistaEstructuraRef}
                  id_presupuesto={plantillaSeleccionada.id_presupuesto}
                  onTitulosMarcadosChange={tipo === 'TITULO' ? setTitulosMarcados : undefined}
                  onPartidasMarcadasChange={tipo === 'PARTIDA' ? setPartidasMarcadas : undefined}
                  integrandoAutomaticamente={integrandoAutomaticamente}
                  seleccionarPartidas={tipo === 'PARTIDA'}
                />
              )}
            </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          size="sm"
        >
          Cancelar
        </Button>
        {!integrandoAutomaticamente && (
          <Button
            type="submit"
            disabled={
              (!usarPlantillaTitulo && !localNombre.trim()) ||
              (usarPlantillaTitulo && tipo === 'TITULO' && titulosMarcados.size === 0) ||
              (usarPlantillaTitulo && tipo === 'PARTIDA' && partidasMarcadas.size === 0) ||
              isLoading
            }
            size="sm"
          >
            {isLoading ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear'}
          </Button>
        )}
        {integrandoAutomaticamente && (
          <Button
            type="button"
            onClick={() => {
              if (vistaEstructuraRef.current) {
                if (tipo === 'TITULO') {
                  const titulosMarcados = vistaEstructuraRef.current.getTitulosMarcados();
                  const estructuraPlantilla = vistaEstructuraRef.current.getEstructuraPlantilla();

                  console.log('Confirmar Integración - Títulos marcados:', titulosMarcados.size, Array.from(titulosMarcados));
                  console.log('Confirmar Integración - Estructura plantilla:', estructuraPlantilla.titulos.length, 'títulos,', estructuraPlantilla.partidas.length, 'partidas');

                  if (titulosMarcados.size > 0 && onIntegrarEstructura) {
                    // Integrar cada título marcado
                    titulosMarcados.forEach((idTitulo: string) => {
                      console.log('Integrando título:', idTitulo);
                      onIntegrarEstructura(idTitulo, estructuraPlantilla);
                    });
                  } else {
                    console.log('No hay títulos marcados para integrar');
                    onCancel(); // Solo cerrar si no hay títulos marcados
                  }
                } else if (tipo === 'PARTIDA') {
                  const partidasMarcadas = vistaEstructuraRef.current.getPartidasMarcadas();
                  const estructuraPlantilla = vistaEstructuraRef.current.getEstructuraPlantilla();

                  console.log('Confirmar Integración - Partidas marcadas:', partidasMarcadas.size, Array.from(partidasMarcadas));

                  if (partidasMarcadas.size > 0) {
                    // Para cada partida marcada, crear una nueva partida copiando sus datos
                    partidasMarcadas.forEach((idPartida: string) => {
                      const partidaSeleccionada = estructuraPlantilla.partidas.find(p => p.id_partida === idPartida);
                      if (partidaSeleccionada) {
                        // Crear una nueva partida con los datos de la plantilla
                        const partidaDataToSave = {
                          unidad_medida: partidaSeleccionada.unidad_medida,
                          metrado: partidaSeleccionada.metrado,
                          precio_unitario: 0,
                          parcial_partida: 0,
                        };
                        onSave(partidaSeleccionada.descripcion, partidaDataToSave);
                      }
                    });
                  } else {
                    console.log('No hay partidas marcadas para integrar');
                    onCancel();
                  }
                }
              } else {
                console.log('No hay referencia a VistaEstructuraPlantilla');
              }
            }}
            disabled={isLoading}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Confirmar Integración ({
              tipo === 'TITULO'
                ? (vistaEstructuraRef.current?.getTitulosMarcados().size || 0)
                : (vistaEstructuraRef.current?.getPartidasMarcadas().size || 0)
            })
          </Button>
        )}
      </div>
    </form>
  );
}

