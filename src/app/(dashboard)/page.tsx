'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirigir automáticamente a proyectos
    router.replace('/proyectos');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingSpinner size={80} showText={true} text="Redirigiendo a proyectos..." />
    </div>
  );
}

