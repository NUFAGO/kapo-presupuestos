'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui';
import { usePresupuesto, useEstructuraPresupuesto } from '@/hooks/usePresupuestos';
import ComparacionPresupuestosView from './components/ComparacionPresupuestosView';

export default function CompararPresupuestosPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const idContractual = searchParams.get('contractual');
  const idMeta = searchParams.get('meta');

  const { data: presupuestoContractual, isLoading: loadingContractual } = usePresupuesto(idContractual);
  const { data: presupuestoMeta, isLoading: loadingMeta } = usePresupuesto(idMeta);
  
  const { data: estructuraContractual, isLoading: loadingEstructuraContractual } = useEstructuraPresupuesto(idContractual);
  const { data: estructuraMeta, isLoading: loadingEstructuraMeta } = useEstructuraPresupuesto(idMeta);

  if (!idContractual || !idMeta) {
    return (
      <div className="space-y-3">
        <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-12 text-center">
          <p className="text-sm text-red-500">Faltan parámetros para la comparación</p>
          <Button
            onClick={() => router.push('/presupuestos-contractuales')}
            className="mt-4"
          >
            Volver
          </Button>
        </div>
      </div>
    );
  }

  if (!presupuestoContractual || !presupuestoMeta) {
    return (
      <div className="space-y-3">
        <div className="bg-[var(--background)] backdrop-blur-sm rounded-lg card-shadow p-12 text-center">
          <LoadingSpinner size={80} showText={true} text="Cargando presupuestos..." />
        </div>
      </div>
    );
  }

  return (
    <ComparacionPresupuestosView
      presupuestoContractual={presupuestoContractual}
      presupuestoMeta={presupuestoMeta}
      estructuraContractual={estructuraContractual || undefined}
      estructuraMeta={estructuraMeta || undefined}
      isLoadingEstructuraContractual={loadingEstructuraContractual}
      isLoadingEstructuraMeta={loadingEstructuraMeta}
    />
  );
}

