'use client';

import { Calendar, DollarSign, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Proyecto, Presupuesto } from '@/services/proyecto-service';

interface ProyectoConPresupuestosCardProps {
  proyecto: Proyecto;
}

export default function ProyectoConPresupuestosCard({ proyecto }: ProyectoConPresupuestosCardProps) {
  const router = useRouter();
  const presupuestos = proyecto.presupuestos || [];

  // Generar un color único para cada card basado en el ID del proyecto
  // Colores más notorios para diferenciar visualmente
  const colorClasses = [
    { bg: 'bg-blue-500/40 dark:bg-blue-400/40', hover: 'hover:bg-blue-500/50 dark:hover:bg-blue-400/50' },
    { bg: 'bg-green-500/40 dark:bg-green-400/40', hover: 'hover:bg-green-500/50 dark:hover:bg-green-400/50' },
    { bg: 'bg-purple-500/40 dark:bg-purple-400/40', hover: 'hover:bg-purple-500/50 dark:hover:bg-purple-400/50' },
    { bg: 'bg-orange-500/40 dark:bg-orange-400/40', hover: 'hover:bg-orange-500/50 dark:hover:bg-orange-400/50' },
    { bg: 'bg-pink-500/40 dark:bg-pink-400/40', hover: 'hover:bg-pink-500/50 dark:hover:bg-pink-400/50' },
    { bg: 'bg-cyan-500/40 dark:bg-cyan-400/40', hover: 'hover:bg-cyan-500/50 dark:hover:bg-cyan-400/50' },
    { bg: 'bg-indigo-500/40 dark:bg-indigo-400/40', hover: 'hover:bg-indigo-500/50 dark:hover:bg-indigo-400/50' },
    { bg: 'bg-emerald-500/40 dark:bg-emerald-400/40', hover: 'hover:bg-emerald-500/50 dark:hover:bg-emerald-400/50' },
  ];
  
  // Usar el ID del proyecto para seleccionar un color de forma consistente
  const colorIndex = proyecto.id_proyecto ? 
    parseInt(proyecto.id_proyecto.toString().slice(-1), 10) % colorClasses.length : 
    Math.floor(Math.random() * colorClasses.length);
  
  const colorStyle = colorClasses[colorIndex];

  const handlePresupuestoClick = (presupuesto: Presupuesto) => {
    // Usar el id_presupuesto_meta_vigente si existe, sino el id_presupuesto actual
    const idPresupuestoAVisualizar = presupuesto.id_presupuesto_meta_vigente || presupuesto.id_presupuesto;
    router.push(`/costos/control-costos/resumen?presupuesto=${idPresupuestoAVisualizar}`);
  };

  return (
    <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow-hover overflow-hidden">
      <div className="p-4">
        {/* Proyecto - Línea compacta superior */}
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[var(--border-color)]/20">
          <div className={`w-1 h-8 rounded-full ${colorStyle.bg} ${colorStyle.hover} transition-all flex-shrink-0`} />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {proyecto.nombre_proyecto}
              </h3>
              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 flex-shrink-0 whitespace-nowrap">
                META VIGENTE
              </span>
            </div>
            
            <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
              <span className="truncate">{proyecto.cliente}</span>
              <span className="text-[var(--border-color)]">•</span>
              <span className="truncate">{proyecto.empresa}</span>
              <span className="text-[var(--border-color)]">•</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Calendar className="h-2.5 w-2.5" />
                <span>
                  {new Date(proyecto.fecha_creacion).toLocaleDateString('es-ES', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              {proyecto.total_proyecto !== null && proyecto.total_proyecto !== undefined && (
                <>
                  <span className="text-[var(--border-color)]">•</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <DollarSign className="h-2.5 w-2.5" />
                    <span className="font-medium text-[var(--text-primary)]">
                      S/ {proyecto.total_proyecto.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Presupuestos META - Lista compacta */}
        {presupuestos.length > 0 ? (
          <div className="space-y-2">
            {presupuestos.map((presupuesto, index) => (
              <div
                key={presupuesto.id_presupuesto}
                onClick={() => handlePresupuestoClick(presupuesto)}
                className="group px-2.5 py-1.5 rounded bg-[var(--background)] card-shadow hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  {/* Número de enumeración */}
                  <span className="text-xs font-medium text-[var(--text-secondary)]/50 flex-shrink-0">
                    {index + 1}.
                  </span>
                  
                  {/* Nombre del presupuesto - flexible pero truncado */}
                  <span className="text-xs font-semibold text-[var(--text-primary)] truncate flex-1 min-w-0">
                    {presupuesto.nombre_presupuesto}
                  </span>
                  
                  {/* Badge META - ancho fijo */}
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 flex-shrink-0 whitespace-nowrap">
                    META
                  </span>
                  
                  {/* Fecha - ancho fijo */}
                  <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)] flex-shrink-0 whitespace-nowrap">
                    <Calendar className="h-2.5 w-2.5" />
                    <span>
                      {new Date(presupuesto.fecha_creacion).toLocaleDateString('es-ES', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  
                  {/* Monto - ancho fijo */}
                  <div className="flex items-center gap-1 text-xs font-medium text-[var(--text-primary)] flex-shrink-0 whitespace-nowrap">
                    <DollarSign className="h-2.5 w-2.5" />
                    <span>
                      S/ {presupuesto.total_presupuesto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Versión Vigente - ancho fijo */}
                  {presupuesto.id_presupuesto_meta_vigente && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-green-500/10 text-green-600 dark:text-green-400 flex-shrink-0 whitespace-nowrap">
                      V{presupuesto.version_meta_vigente || 'N/A'}
                    </span>
                  )}
                  
                  {/* Flecha indicadora */}
                  <div className="p-0.5 rounded transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                    <ArrowRight className="h-3 w-3 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-2 text-center">
            <p className="text-xs text-[var(--text-secondary)]">
              No hay presupuestos META asociados
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
