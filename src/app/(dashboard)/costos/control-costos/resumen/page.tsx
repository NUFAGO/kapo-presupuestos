'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui';
import EstructuraCostosResumen from '@/components/costos/EstructuraCostosResumen';

function ResumenContent() {
  const searchParams = useSearchParams();
  const id_presupuesto = searchParams.get('presupuesto');

  if (!id_presupuesto) {
    return (
      <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg border border-[var(--border-color)] p-4 text-center">
        <p className="text-xs text-red-500">No se especificó el presupuesto</p>
      </div>
    );
  }

  return (
    <EstructuraCostosResumen
      id_presupuesto={id_presupuesto}
    />
  );
}

export default function ResumenPage() {
  return (
    <Suspense fallback={
      <div className="space-y-3">
        <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg shadow-lg shadow-black/4 border border-[var(--border-color)] p-12">
          <LoadingSpinner size={80} showText={true} text="Cargando estructura..." />
        </div>
      </div>
    }>
      <ResumenContent />
    </Suspense>
  );
}
