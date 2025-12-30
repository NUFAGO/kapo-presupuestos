'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui';
import toast from 'react-hot-toast';

function LoginForm() {
  const [usuario, setUsuario] = useState('');
  const [contrasenna, setContrasenna] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Si ya está autenticado, redirigir
  useEffect(() => {
    if (isAuthenticated) {
      const redirect = searchParams.get('redirect') || '/proyectos';
      router.push(redirect);
    }
  }, [isAuthenticated, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(usuario, contrasenna);
      toast.success('Inicio de sesión exitoso');

      // Redirigir a la ruta original o a proyectos
      const redirect = searchParams.get('redirect') || '/proyectos';
      router.push(redirect);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--content-bg)] via-[var(--content-bg)] to-[var(--content-bg)] px-4 py-12 transition-colors duration-300 overflow-hidden">
      {/* Fondo con gradiente sutil */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2563eb]/[0.02] via-transparent to-[#0d9488]/[0.02] dark:from-[#2563eb]/[0.04] dark:to-[#0d9488]/[0.04]"></div>
      
      {/* Manchas decorativas suaves y orgánicas - sutiles */}
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-[60%_40%_30%_70%_/_60%_30%_70%_40%] bg-[#2563eb] opacity-[0.06] blur-3xl dark:opacity-[0.08]"></div>
      <div className="absolute -left-32 -bottom-32 h-96 w-96 rounded-[30%_60%_70%_40%_/_50%_60%_30%_60%] bg-[#0d9488] opacity-[0.06] blur-3xl dark:opacity-[0.08]"></div>
      <div className="absolute right-1/3 top-1/4 h-72 w-72 rounded-[40%_60%_60%_40%_/_60%_30%_70%_40%] bg-[#1e40af] opacity-[0.05] blur-2xl dark:opacity-[0.07]"></div>
      <div className="absolute left-1/3 bottom-1/4 h-80 w-80 rounded-[50%_50%_50%_50%_/_60%_40%_60%_40%] bg-[#14b8a6] opacity-[0.05] blur-2xl dark:opacity-[0.07]"></div>
      
      {/* Contenedor principal con mejor espaciado */}
      <div className="relative z-10 w-full max-w-md mx-auto">
        {/* Card principal con mejor elevación */}
        <div className="rounded-2xl bg-[var(--card-bg)] card-shadow transition-all duration-300 overflow-hidden backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95 shadow-xl">
          {/* Header con logo */}
          <div className="bg-gradient-to-br from-[#2563eb]/5 to-[#0d9488]/5 px-8 pt-10 pb-8">
            <div className="flex items-center justify-center gap-6">
              <div className="relative flex-shrink-0">
                <Image
                  src="/logoprecos.png"
                  alt="Kapo Presupuestos y Costos"
                  width={80}
                  height={32}
                  className="h-auto w-auto max-w-[80px]"
                  priority
                />
              </div>
              <div className="text-center">
                <h1 className="text-3xl font-bold tracking-tight uppercase bg-gradient-to-r from-[#1e40af] to-[#0f766e] bg-clip-text text-transparent">
                  Kapo
                </h1>
                <p className="text-xs font-bold mt-1 uppercase bg-gradient-to-r from-[#1e3a8a] to-[#0d9488] bg-clip-text text-transparent">
                  Presupuestos y Costos
                </p>
              </div>
            </div>

          </div>

          {/* Formulario */}
          <form className="p-8 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label 
                  htmlFor="usuario" 
                  className="block text-xs font-medium text-[var(--text-primary)] mb-1"
                >
                  Usuario
                </label>
                <Input
                  id="usuario"
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  required
                  placeholder="Ingresa tu usuario"
                />
              </div>
              <div>
                <label 
                  htmlFor="contrasenna" 
                  className="block text-xs font-medium text-[var(--text-primary)] mb-1"
                >
                  Contraseña
                </label>
                <Input
                  id="contrasenna"
                  type="password"
                  value={contrasenna}
                  onChange={(e) => setContrasenna(e.target.value)}
                  required
                  placeholder="Ingresa tu contraseña"
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-[#2563eb] to-[#0d9488] hover:from-[#1d4ed8] hover:to-[#0f766e] text-white font-medium shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Iniciando sesión...
                </span>
              ) : (
                'Iniciar Sesión'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--content-bg)] via-[var(--content-bg)] to-[var(--content-bg)] px-4 py-12 transition-colors duration-300 overflow-hidden">
        {/* Fondo con gradiente sutil */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#2563eb]/[0.02] via-transparent to-[#0d9488]/[0.02] dark:from-[#2563eb]/[0.04] dark:to-[#0d9488]/[0.04]"></div>
        
        {/* Manchas decorativas suaves y orgánicas - sutiles */}
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-[60%_40%_30%_70%_/_60%_30%_70%_40%] bg-[#2563eb] opacity-[0.06] blur-3xl dark:opacity-[0.08]"></div>
        <div className="absolute -left-32 -bottom-32 h-96 w-96 rounded-[30%_60%_70%_40%_/_50%_60%_30%_60%] bg-[#0d9488] opacity-[0.06] blur-3xl dark:opacity-[0.08]"></div>
        
        <div className="relative z-10 w-full max-w-md mx-auto">
          <div className="rounded-2xl bg-[var(--card-bg)] card-shadow transition-all duration-300 overflow-hidden backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95 shadow-xl">
            <div className="bg-gradient-to-br from-[#2563eb]/5 to-[#0d9488]/5 px-8 pt-10 pb-8">
              <div className="flex items-center justify-center gap-6">
                <div className="relative flex-shrink-0">
                  <Image
                    src="/logoprecos.png"
                    alt="Kapo Presupuestos y Costos"
                    width={80}
                    height={32}
                    className="h-auto w-auto max-w-[80px]"
                    priority
                  />
                </div>
              <div className="text-center">
                <h1 className="text-3xl font-bold tracking-tight uppercase bg-gradient-to-r from-[#1e40af] to-[#0f766e] bg-clip-text text-transparent">
                  Kapo
                </h1>
                <p className="text-xs font-bold mt-1 uppercase bg-gradient-to-r from-[#1e3a8a] to-[#0d9488] bg-clip-text text-transparent">
                  Presupuestos y Costos
                </p>
              </div>
              </div>
            </div>
            <div className="p-8 flex justify-center">
              <LoadingSpinner size={80} showText={true} text="Cargando..." />
            </div>
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}



