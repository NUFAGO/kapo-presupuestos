'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/ui';
import { Presupuesto, useBuscarPresupuestosPlantillas } from '@/hooks';
import { Copy, X } from 'lucide-react';
import VistaEstructuraPlantilla from './VistaEstructuraPlantilla';

interface PresupuestoFormProps {
  presupuesto?: Presupuesto;
  id_proyecto: string;
  editMode?: boolean;
  onSubmit?: (data: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
  cantidadPresupuestos?: number;
  modoCrearPadre?: boolean; // Si es true, solo muestra el campo nombre
  // Props para funcionalidad de plantillas
  usarPlantilla?: boolean;
  setUsarPlantilla?: (value: boolean) => void;
  plantillaSeleccionada?: Presupuesto | null;
  setPlantillaSeleccionada?: (plantilla: Presupuesto | null) => void;
  createPresupuestoPadrePending?: boolean;
  filtroFasePlantilla?: 'vigente' | 'todas' | 'META' | 'CONTRACTUAL' | 'LICITACION';
  setFiltroFasePlantilla?: (fase: 'vigente' | 'todas' | 'META' | 'CONTRACTUAL' | 'LICITACION') => void;
}

export default function PresupuestoForm({
  presupuesto,
  id_proyecto,
  editMode = false,
  onSubmit,
  onCancel,
  isLoading: externalLoading = false,
  cantidadPresupuestos = 0,
  modoCrearPadre = false,
  // Props para plantillas
  usarPlantilla = false,
  setUsarPlantilla,
  plantillaSeleccionada,
  setPlantillaSeleccionada,
  createPresupuestoPadrePending = false,
  filtroFasePlantilla = 'vigente',
  setFiltroFasePlantilla,
}: PresupuestoFormProps) {
  const [formData, setFormData] = useState({
    nombre_presupuesto: '',
    costo_directo: '0',
    ppto_base: '0',
    ppto_oferta: '0',
    observaciones: '',
    monto_igv: '0',
    monto_utilidad: '0',
    parcial_presupuesto: '0',
    plazo: '0',
    porcentaje_igv: '18',
    porcentaje_utilidad: '0',
    total_presupuesto: '0',
    gastos_generales: '0',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado local para búsqueda de plantillas
  const [busquedaPlantilla, setBusquedaPlantilla] = useState('');
  
  // Estado para mantener APUs y detalles de la plantilla
  const [mantenerAPUs, setMantenerAPUs] = useState(true);

  // Memoizar parámetros de búsqueda para evitar queries innecesarias
  const searchParams = useMemo(() => ({
    searchTerm: usarPlantilla ? busquedaPlantilla : undefined,
    filtroFase: usarPlantilla ? filtroFasePlantilla : undefined
  }), [usarPlantilla, busquedaPlantilla, filtroFasePlantilla]);

  // Hook para buscar plantillas con memoización
  const { data: plantillasResult, isLoading: isLoadingPlantillas } = useBuscarPresupuestosPlantillas(
    searchParams.searchTerm,
    searchParams.filtroFase,
    1, // page
    100 // limit
  );

  const presupuestosPlantillas = plantillasResult?.data || [];

  // Inicializar formulario con datos del presupuesto si está en modo edición
  useEffect(() => {
    if (editMode && presupuesto) {
      setFormData({
        nombre_presupuesto: presupuesto.nombre_presupuesto || '',
        costo_directo: presupuesto.costo_directo?.toString() || '0',
        ppto_base: presupuesto.ppto_base?.toString() || '0',
        ppto_oferta: presupuesto.ppto_oferta?.toString() || '0',
        observaciones: presupuesto.observaciones || '',
        monto_igv: presupuesto.monto_igv?.toString() || '0',
        monto_utilidad: presupuesto.monto_utilidad?.toString() || '0',
        parcial_presupuesto: presupuesto.parcial_presupuesto?.toString() || '0',
        plazo: presupuesto.plazo?.toString() || '0',
        porcentaje_igv: presupuesto.porcentaje_igv?.toString() || '18',
        porcentaje_utilidad: presupuesto.porcentaje_utilidad?.toString() || '0',
        total_presupuesto: presupuesto.total_presupuesto?.toString() || '0',
        gastos_generales: presupuesto.gastos_generales?.toString() || '0',
      });
    }
  }, [editMode, presupuesto, cantidadPresupuestos]);

  // Calcular valores derivados cuando cambian los campos base
  useEffect(() => {
    const costoDirecto = parseFloat(formData.costo_directo) || 0;
    const porcentajeIGV = parseFloat(formData.porcentaje_igv) || 0;
    const porcentajeUtilidad = parseFloat(formData.porcentaje_utilidad) || 0;

    // Calcular parcial (costo directo + utilidad)
    const parcial = costoDirecto * (1 + porcentajeUtilidad / 100);
    
    // Calcular IGV sobre el parcial
    const montoIGV = parcial * (porcentajeIGV / 100);
    
    // Calcular utilidad
    const montoUtilidad = costoDirecto * (porcentajeUtilidad / 100);
    
    // Calcular total
    const total = parcial + montoIGV;

    setFormData(prev => ({
      ...prev,
      parcial_presupuesto: parcial.toFixed(2),
      monto_igv: montoIGV.toFixed(2),
      monto_utilidad: montoUtilidad.toFixed(2),
      total_presupuesto: total.toFixed(2),
    }));
  }, [formData.costo_directo, formData.porcentaje_igv, formData.porcentaje_utilidad]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const isNumericField = name.includes('costo') ||
                          name.includes('ppto') ||
                          name.includes('plazo') ||
                          name.includes('porcentaje') ||
                          name.includes('monto') ||
                          name.includes('parcial') ||
                          name.includes('total') ||
                          name.includes('gastos_generales');

    if (isNumericField) {
      // Permitir solo números y un punto decimal
      const numericValue = value.replace(/[^0-9.]/g, '');
      if (numericValue.split('.').length <= 2) {
        setFormData(prev => ({ ...prev, [name]: numericValue }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (modoCrearPadre) {
        // Validar: si el switch está activado, debe haber una plantilla seleccionada
        if (usarPlantilla && !plantillaSeleccionada) {
          // El botón ya está deshabilitado, pero por si acaso se intenta enviar de otra forma
          setIsSubmitting(false);
          return;
        }

        // Modo crear padre: envía nombre, IGV, utilidad, gastos generales y parámetros de plantilla solo si el switch está activado Y hay plantilla seleccionada
        if (onSubmit) {
          await onSubmit({
            nombre_presupuesto: formData.nombre_presupuesto,
            porcentaje_igv: parseFloat(formData.porcentaje_igv) || 18,
            porcentaje_utilidad: parseFloat(formData.porcentaje_utilidad) || 0,
            gastos_generales: parseFloat(formData.gastos_generales) || 0,
            // Solo enviar parámetros de plantilla si el switch está activado Y hay plantilla seleccionada
            ...(usarPlantilla && plantillaSeleccionada && {
              id_presupuesto_plantilla: plantillaSeleccionada.id_presupuesto,
              mantenerAPUs: mantenerAPUs
            })
          });
        }
      } else {
        // Modo normal: envía todos los campos
        const numericData = {
          id_proyecto,
          nombre_presupuesto: formData.nombre_presupuesto,
          costo_directo: parseFloat(formData.costo_directo) || 0,
          ppto_base: parseFloat(formData.ppto_base) || 0,
          ppto_oferta: parseFloat(formData.ppto_oferta) || 0,
          monto_igv: parseFloat(formData.monto_igv) || 0,
          monto_utilidad: parseFloat(formData.monto_utilidad) || 0,
          parcial_presupuesto: parseFloat(formData.parcial_presupuesto) || 0,
          plazo: parseInt(formData.plazo) || 0,
          porcentaje_igv: parseFloat(formData.porcentaje_igv) || 18,
          porcentaje_utilidad: parseFloat(formData.porcentaje_utilidad) || 0,
          total_presupuesto: parseFloat(formData.total_presupuesto) || 0,
          gastos_generales: parseFloat(formData.gastos_generales) || 0,
          observaciones: formData.observaciones,
        };

        if (onSubmit) {
          await onSubmit(numericData);
        }
      }
    } catch (error) {
      console.error('Error al guardar presupuesto:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmittingForm = isSubmitting || externalLoading;

  return (
    <form id="presupuesto-form" onSubmit={handleSubmit} className="space-y-4">
      {/* Nombre del Presupuesto */}
      <div>
        <label htmlFor="nombre_presupuesto" className="block text-xs font-medium text-(--text-primary) mb-1">
          Nombre del Presupuesto *
        </label>
        <Input
          id="nombre_presupuesto"
          name="nombre_presupuesto"
          value={formData.nombre_presupuesto}
          onChange={handleChange}
          required
          disabled={isSubmittingForm}
          placeholder="Ingrese el nombre del presupuesto"
        />
        {modoCrearPadre && (
          <>
            

            {/* IGV, Utilidad y Gastos Generales para el padre */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label htmlFor="porcentaje_igv" className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                  IGV (%)
                </label>
                <Input
                  id="porcentaje_igv"
                  name="porcentaje_igv"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.porcentaje_igv}
                  onChange={handleChange}
                  disabled={isSubmittingForm}
                  placeholder="18"
                />
              </div>
              <div>
                <label htmlFor="porcentaje_utilidad" className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                  Utilidad (%)
                </label>
                <Input
                  id="porcentaje_utilidad"
                  name="porcentaje_utilidad"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.porcentaje_utilidad}
                  onChange={handleChange}
                  disabled={isSubmittingForm}
                  placeholder="0"
                />
              </div>
              <div>
                <label htmlFor="gastos_generales" className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                  Gastos Generales (S/.)
                </label>
                <Input
                  id="gastos_generales"
                  name="gastos_generales"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.gastos_generales}
                  onChange={handleChange}
                  disabled={isSubmittingForm}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Checkbox para usar plantilla - Solo en modo creación */}
            {!editMode && setUsarPlantilla && (
              <div className="pt-4">
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={usarPlantilla}
                    onChange={(e) => {
                      if (setUsarPlantilla) {
                        setUsarPlantilla(e.target.checked);
                        if (!e.target.checked && setPlantillaSeleccionada) {
                          setPlantillaSeleccionada(null);
                          setMantenerAPUs(false);
                        }
                        if (!e.target.checked && setBusquedaPlantilla) {
                          setBusquedaPlantilla('');
                        }
                      }
                    }}
                    disabled={createPresupuestoPadrePending}
                    className="sr-only peer"
                  />
                  <div className="w-3.5 h-3.5 rounded border transition-all flex items-center justify-center peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/20 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed peer-checked:bg-blue-500 peer-checked:border-blue-500 border-[var(--border-color)] bg-[var(--background)]">
                    {usarPlantilla && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs text-[var(--text-secondary)] peer-disabled:opacity-50">
                    Usar plantilla de presupuesto existente
                  </span>
                </label>

                {/* Sección de búsqueda de plantillas */}
                {usarPlantilla && (
                  <div className="mt-2 space-y-3">
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
                              setBusquedaPlantilla && setBusquedaPlantilla(e.target.value);
                            }
                          }}
                          disabled={createPresupuestoPadrePending || !!plantillaSeleccionada}
                          className={plantillaSeleccionada ? 'bg-green-500/5 border-green-500/20 pr-8' : ''}
                        />
                        {plantillaSeleccionada && (
                          <button
                            type="button"
                            onClick={() => {
                              setPlantillaSeleccionada && setPlantillaSeleccionada(null);
                              setBusquedaPlantilla && setBusquedaPlantilla('');
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                            disabled={createPresupuestoPadrePending}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {plantillaSeleccionada && (
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                          <span className="text-[var(--text-secondary)]">
                            ID: {plantillaSeleccionada.id_presupuesto}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            plantillaSeleccionada.fase === 'META'
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : plantillaSeleccionada.fase === 'CONTRACTUAL'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                          }`}>
                            V{plantillaSeleccionada.version} {plantillaSeleccionada.fase}
                          </span>
                          <span className="text-[var(--text-secondary)]">
                            S/ {plantillaSeleccionada.total_presupuesto?.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
                            <input
                              type="checkbox"
                              checked={mantenerAPUs}
                              onChange={(e) => setMantenerAPUs(e.target.checked)}
                              disabled={createPresupuestoPadrePending}
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
                              Conservar APUs y detalles
                            </span>
                          </label>
                        </div>
                      )}

                    {/* Solo mostrar filtros y lista si NO hay plantilla seleccionada */}
                    {!plantillaSeleccionada && (
                      <>
                        {/* Filtro por fase */}
                        <div>
                          <div className="flex gap-4 flex-wrap">
                            {[
                              { value: 'vigente', label: 'Vigentes (Meta)' },
                              { value: 'todas', label: 'Todas las fases' },
                              { value: 'META', label: 'Meta' },
                              { value: 'CONTRACTUAL', label: 'Contractual' },
                              { value: 'LICITACION', label: 'Licitación' }
                            ].map((option) => {
                              const isChecked = filtroFasePlantilla === option.value;
                              return (
                                <label 
                                  key={option.value} 
                                  className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${
                                    createPresupuestoPadrePending ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="fase-plantilla"
                                    value={option.value}
                                    checked={isChecked}
                                    onChange={(e) => setFiltroFasePlantilla && setFiltroFasePlantilla(e.target.value as 'vigente' | 'todas' | 'META' | 'CONTRACTUAL' | 'LICITACION')}
                                    disabled={createPresupuestoPadrePending}
                                    className="sr-only"
                                  />
                                  <div className={`w-3 h-3 rounded-full border transition-all flex items-center justify-center ${
                                    isChecked
                                      ? 'border-blue-500 bg-blue-500'
                                      : 'border-[var(--border-color)] bg-[var(--background)]'
                                  }`}>
                                    {isChecked && (
                                      <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                    )}
                                  </div>
                                  <span className={`text-xs transition-colors ${
                                    isChecked
                                      ? 'text-[var(--text-primary)]'
                                      : 'text-[var(--text-secondary)]'
                                  }`}>{option.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Lista de resultados */}
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {isLoadingPlantillas ? (
                            <div className="flex items-center justify-center py-6">
                              <LoadingSpinner size={20} />
                              <span className="ml-2 text-xs text-[var(--text-secondary)]">Buscando plantillas...</span>
                            </div>
                          ) : presupuestosPlantillas && presupuestosPlantillas.length > 0 ? (
                            presupuestosPlantillas.map((plantilla: Presupuesto) => (
                              <div
                                key={plantilla.id_presupuesto}
                                onClick={() => setPlantillaSeleccionada && setPlantillaSeleccionada(plantilla)}
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
                      </>
                    )}

                    {/* Vista de estructura de la plantilla */}
                    {plantillaSeleccionada && (
                      <VistaEstructuraPlantilla id_presupuesto={plantillaSeleccionada.id_presupuesto} />
                    )}
                  </div>
                )}
              </div>
            )}

          </>
        )}
      </div>

      {/* Solo mostrar campos financieros si NO es modo crear padre */}
      {!modoCrearPadre && (
        <>
          {/* Primera fila: Costo Directo, Presupuesto Base, Plazo */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="costo_directo" className="block text-xs font-medium text-(--text-primary) mb-1">
            Costo Directo (S/.) *
          </label>
          <Input
            id="costo_directo"
            name="costo_directo"
            type="number"
            step="0.01"
            min="0"
            value={formData.costo_directo}
            onChange={handleChange}
            required
            disabled={isSubmittingForm}
            placeholder="0.00"
          />
        </div>
        <div>
          <label htmlFor="ppto_base" className="block text-xs font-medium text-[var(--text-primary)] mb-1">
            Presupuesto Base (S/.) *
          </label>
          <Input
            id="ppto_base"
            name="ppto_base"
            type="number"
            step="0.01"
            min="0"
            value={formData.ppto_base}
            onChange={handleChange}
            required
            disabled={isSubmittingForm}
            placeholder="0.00"
          />
        </div>
        <div>
          <label htmlFor="plazo" className="block text-xs font-medium text-[var(--text-primary)] mb-1">
            Plazo (días)
          </label>
          <Input
            id="plazo"
            name="plazo"
            type="number"
            min="0"
            value={formData.plazo}
            onChange={handleChange}
            disabled={isSubmittingForm}
            placeholder="0 (opcional)"
          />
        </div>
      </div>

      {/* Segunda fila: Presupuesto Oferta, Porcentaje IGV, Porcentaje Utilidad */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="ppto_oferta" className="block text-xs font-medium text-[var(--text-primary)] mb-1">
            Presupuesto Oferta (S/.) *
          </label>
          <Input
            id="ppto_oferta"
            name="ppto_oferta"
            type="number"
            step="0.01"
            min="0"
            value={formData.ppto_oferta}
            onChange={handleChange}
            required
            disabled={isSubmittingForm}
            placeholder="0.00"
          />
        </div>
        <div>
          <label htmlFor="porcentaje_igv" className="block text-xs font-medium text-[var(--text-primary)] mb-1">
            Porcentaje IGV (%) *
          </label>
          <Input
            id="porcentaje_igv"
            name="porcentaje_igv"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.porcentaje_igv}
            onChange={handleChange}
            required
            disabled={isSubmittingForm}
            placeholder="18"
          />
        </div>
        <div>
          <label htmlFor="porcentaje_utilidad" className="block text-xs font-medium text-[var(--text-primary)] mb-1">
            Porcentaje Utilidad (%) *
          </label>
          <Input
            id="porcentaje_utilidad"
            name="porcentaje_utilidad"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.porcentaje_utilidad}
            onChange={handleChange}
            required
            disabled={isSubmittingForm}
            placeholder="0"
          />
        </div>
      </div>

      {/* Tercera fila: Gastos Generales */}
      <div className="grid grid-cols-3 gap-4">
        <div></div>
        <div></div>
        <div>
          <label htmlFor="gastos_generales" className="block text-xs font-medium text-[var(--text-primary)] mb-1">
            Gastos Generales (S/.)
          </label>
          <Input
            id="gastos_generales"
            name="gastos_generales"
            type="number"
            step="0.01"
            min="0"
            value={formData.gastos_generales}
            onChange={handleChange}
            disabled={isSubmittingForm}
            placeholder="0.00"
          />
        </div>
      </div>

          {/* Observaciones */}
          <div>
            <label htmlFor="observaciones" className="block text-xs font-medium text-[var(--text-primary)] mb-1">
              Observaciones
            </label>
            <Textarea
              id="observaciones"
              name="observaciones"
              value={formData.observaciones}
              onChange={handleChange}
              disabled={isSubmittingForm}
              rows={3}
              placeholder="Ingrese las observaciones del presupuesto (opcional)"
            />
          </div>
        </>
      )}
    </form>
  );
}

