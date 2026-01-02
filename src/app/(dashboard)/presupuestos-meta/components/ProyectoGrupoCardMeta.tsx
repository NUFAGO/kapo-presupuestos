'use client';

import { Building2 } from 'lucide-react';
import PresupuestoGrupoCardMeta from './PresupuestoGrupoCardMeta';
import type { Presupuesto } from '@/hooks/usePresupuestos';
import type { Proyecto } from '@/services/proyecto-service';

interface GrupoPresupuesto {
  id_grupo_version: string;
  presupuestoPadre: Presupuesto;
  versiones: Presupuesto[];
}

interface ProyectoGrupoCardMetaProps {
  proyecto: Proyecto;
  gruposPresupuestos: GrupoPresupuesto[];
}

export default function ProyectoGrupoCardMeta({ proyecto, gruposPresupuestos }: ProyectoGrupoCardMetaProps) {
  // Para meta: contar versiones META activas y clasificar por estado
  const versionesMeta = gruposPresupuestos.flatMap(grupo =>
    grupo.versiones.filter(v => v.fase === 'META' && v.es_activo !== false)
  );

  const versionesAprobadas = versionesMeta.filter(v => v.estado === 'aprobado').length;
  const versionesVigentes = versionesMeta.filter(v => v.estado === 'vigente').length;
  const versionesPorAprobar = versionesMeta.filter(v =>
    v.estado === 'borrador' || v.estado === 'en_revision'
  ).length;

  const totalPresupuestos = gruposPresupuestos.length;

  // Generar un color único para cada proyecto basado en el id_proyecto
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
  
  const colorIndex = proyecto.id_proyecto ? 
    parseInt(proyecto.id_proyecto.toString().slice(-1), 10) % colorClasses.length : 
    Math.floor(Math.random() * colorClasses.length);
  
  const colorStyle = colorClasses[colorIndex];

  return (
    <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg overflow-hidden card-shadow-hover">
      {/* Header del Proyecto - No desplegable */}
      <div className="p-4 border-b border-[var(--border-color)]/20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-1 h-5 rounded-full ${colorStyle.bg} ${colorStyle.hover} transition-all`} />
              <Building2 className="h-4 w-4 text-[var(--text-secondary)] flex-shrink-0" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                {proyecto.nombre_proyecto}
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
              <span>
                <span className="font-medium text-[var(--text-primary)]">{totalPresupuestos}</span> presupuesto{totalPresupuestos !== 1 ? 's' : ''}
              </span>
              <span>•</span>
              <span>
                <span className="font-medium text-[var(--text-primary)]">{versionesMeta.length}</span> versión{versionesMeta.length !== 1 ? 'es' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Presupuestos del Proyecto - Siempre visible */}
      <div className="p-4 space-y-4 bg-[var(--card-bg)]/20">
        {gruposPresupuestos.map((grupo) => (
          <PresupuestoGrupoCardMeta
            key={grupo.id_grupo_version}
            grupoId={grupo.id_grupo_version}
            presupuestoPadre={grupo.presupuestoPadre}
            versiones={grupo.versiones}
            nombreProyecto={proyecto.nombre_proyecto}
          />
        ))}
      </div>
    </div>
  );
}

