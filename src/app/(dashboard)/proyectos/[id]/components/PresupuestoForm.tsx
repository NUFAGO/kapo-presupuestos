'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/ui';
import { Presupuesto, useBuscarPresupuestosPlantillas } from '@/hooks';
import { Copy } from 'lucide-react';

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
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado local para búsqueda de plantillas
  const [busquedaPlantilla, setBusquedaPlantilla] = useState('');

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
                          name.includes('total');

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
        // Modo crear padre: envía nombre, IGV y utilidad
        if (onSubmit) {
          await onSubmit({
            nombre_presupuesto: formData.nombre_presupuesto,
            porcentaje_igv: parseFloat(formData.porcentaje_igv) || 18,
            porcentaje_utilidad: parseFloat(formData.porcentaje_utilidad) || 0,
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
            

            {/* IGV y Utilidad para el padre */}
            <div className="grid grid-cols-2 gap-4 mt-4">
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
            </div>

            {/* Switch para usar plantilla - Solo en modo creación */}
            {!editMode && setUsarPlantilla && (
              <div className="mt-4 p-3 bg-[var(--background)]/30 rounded-lg border border-[var(--border-color)]/30">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Copy className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                      <label className="text-xs font-medium text-[var(--text-primary)]">
                        Usar plantilla de presupuesto existente (opcional)
                      </label>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={usarPlantilla}
                      onChange={(e) => {
                        if (setUsarPlantilla) {
                          setUsarPlantilla(e.target.checked);
                          if (!e.target.checked && setPlantillaSeleccionada) {
                            setPlantillaSeleccionada(null);
                          }
                          if (!e.target.checked && setBusquedaPlantilla) {
                            setBusquedaPlantilla('');
                          }
                        }
                      }}
                      disabled={createPresupuestoPadrePending}
                    />
                    <div className="w-9 h-5 bg-[var(--background)] border border-[var(--border-color)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-secondary)] after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500 peer-checked:border-blue-500 peer-checked:after:bg-white"></div>
                  </label>
                </div>

                {/* Sección de búsqueda de plantillas */}
                {usarPlantilla && (
                  <div className="mt-2 space-y-3">
                    {/* Filtro por fase */}
                    <div>
                      <div className="flex gap-4">
                        {[
                          { value: 'vigente', label: 'Vigentes (Meta)', color: 'text-blue-700 font-medium' },
                          { value: 'todas', label: 'Todas las fases', color: 'text-gray-600' },
                          { value: 'META', label: 'Meta', color: 'text-green-600' },
                          { value: 'CONTRACTUAL', label: 'Contractual', color: 'text-blue-600' },
                          { value: 'LICITACION', label: 'Licitación', color: 'text-orange-600' }
                        ].map((option) => (
                          <label key={option.value} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="fase-plantilla"
                              value={option.value}
                              checked={filtroFasePlantilla === option.value}
                              onChange={(e) => setFiltroFasePlantilla && setFiltroFasePlantilla(e.target.value as 'vigente' | 'todas' | 'META' | 'CONTRACTUAL' | 'LICITACION')}
                              disabled={createPresupuestoPadrePending}
                              className={`w-3 h-3 border-[var(--border-color)] focus:ring-blue-500 ${option.color?.replace('text-', 'text-') || 'text-blue-600'}`}
                            />
                            <span className={`text-xs ${option.color || 'text-[var(--text-primary)]'}`}>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Buscar plantilla
                      </label>
                      <Input
                        type="text"
                        placeholder="Buscar por nombre o ID del presupuesto..."
                        value={busquedaPlantilla}
                        onChange={(e) => setBusquedaPlantilla && setBusquedaPlantilla(e.target.value)}
                        disabled={createPresupuestoPadrePending}
                      />
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
                            className={`p-2.5 rounded-lg border cursor-pointer transition-all text-xs ${
                              plantillaSeleccionada?.id_presupuesto === plantilla.id_presupuesto
                                ? 'border-blue-500 bg-blue-500/5'
                                : 'border-[var(--border-color)] bg-[var(--background)]/50 hover:bg-[var(--background)]/70'
                            }`}
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
                              {plantillaSeleccionada?.id_presupuesto === plantilla.id_presupuesto && (
                                <div className="text-blue-600 dark:text-blue-400 ml-2">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
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

                    {/* Plantilla seleccionada */}
                    {plantillaSeleccionada && (
                      <div className="p-2.5 bg-green-500/5 border border-green-500/20 rounded-lg">
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs font-medium text-green-600 dark:text-green-400">
                            Plantilla seleccionada: {plantillaSeleccionada.nombre_presupuesto}
                          </span>
                        </div>
                      </div>
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

