'use client';

import { Calendar, DollarSign, Settings } from 'lucide-react';
import type { Proyecto } from '@/services/proyecto-service';

interface ProyectoCardProps {
  proyecto: Proyecto;
  onClick: () => void;
  onEdit?: () => void;
}

export default function ProyectoCard({ proyecto, onClick, onEdit }: ProyectoCardProps) {
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

  return (
    <div
      onClick={onClick}
      className="bg-[var(--background)] backdrop-blur-sm rounded-lg p-4 cursor-default card-shadow-hover transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-1 h-5 rounded-full ${colorStyle.bg} ${colorStyle.hover} transition-all`} />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {proyecto.nombre_proyecto}
            </h3>
          </div>
          
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className="font-medium">Cliente:</span>
              <span>{proyecto.cliente}</span>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className="font-medium">Empresa:</span>
              <span>{proyecto.empresa}</span>
            </div>

            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <Calendar className="h-3 w-3" />
                <span>
                  {new Date(proyecto.fecha_creacion).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>

              {proyecto.total_proyecto !== null && proyecto.total_proyecto !== undefined && (
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)]">
                  <DollarSign className="h-3 w-3" />
                  <span>S/ {proyecto.total_proyecto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ml-4 flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              proyecto.estado === 'BORRADOR'
                ? 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                : proyecto.estado === 'EN_REVISION'
                ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                : proyecto.estado === 'APROBADO'
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : proyecto.estado === 'EN_PROGRESO'
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : proyecto.estado === 'SUSPENDIDO'
                ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                : proyecto.estado === 'COMPLETADO'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : proyecto.estado === 'CANCELADO'
                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                : 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
            }`}
          >
            {proyecto.estado === 'EN_REVISION' ? 'EN REVISIÓN' : 
             proyecto.estado === 'EN_PROGRESO' ? 'EN PROGRESO' : 
             proyecto.estado}
          </span>
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="h-5 w-5 p-0 flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              title="Editar proyecto"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

