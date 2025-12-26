'use client';
//select personalizado con el mismo diseño que SelectSearch pero sin búsqueda
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  className,
  disabled = false,
  isLoading = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, isDropup: false, bottom: undefined as number | undefined });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Encontrar la opción seleccionada para mostrar su label
  // Si el valor es null o vacío, buscar la opción con value === '' como valor por defecto
  const selectedOption = React.useMemo(() => {
    if (!value && value !== '') {
      // Si es null o undefined, buscar opción por defecto (value === '')
      const defaultOption = options.find(opt => opt.value === '');
      return defaultOption || null;
    }
    return options.find(opt => opt.value === value);
  }, [value, options]);

  // Función para calcular posición del dropdown
  const updateDropdownPosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownMaxHeight = 240; // max-h-60 = 240px
      const gap = 4; // gap entre input y dropdown
      
      // Si no hay suficiente espacio abajo pero sí arriba, mostrar arriba
      const shouldShowAbove = spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow;
      
      if (shouldShowAbove) {
        // Posicionar arriba del input, justo encima sin separación
        setDropdownPosition({
          top: 0,
          left: rect.left + window.scrollX,
          width: rect.width,
          isDropup: true,
          bottom: window.innerHeight - rect.top + window.scrollY + gap,
        });
      } else {
        // Posicionar abajo del input (comportamiento por defecto)
        setDropdownPosition({
          top: rect.bottom + window.scrollY + gap,
          left: rect.left + window.scrollX,
          width: rect.width,
          isDropup: false,
          bottom: undefined,
        });
      }
    }
  };

  // Enfocar el botón cuando se abre y calcular posición del dropdown
  useEffect(() => {
    if (isOpen && containerRef.current) {
      updateDropdownPosition();
    }
  }, [isOpen]);

  // Actualizar posición cuando se hace scroll o se redimensiona la ventana
  useEffect(() => {
    if (isOpen) {
      const handleScroll = () => updateDropdownPosition();
      const handleResize = () => updateDropdownPosition();
      
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside, true);
      }, 0);
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside, true);
      };
    }
  }, [isOpen]);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelectOption = (option: SelectOption) => {
    // Si el valor es '', mantenerlo como '' en lugar de null
    onChange(option.value === '' ? '' : option.value);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    // Abrir el dropdown después de limpiar para que el usuario pueda seleccionar otra opción
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      buttonRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
    } else if (e.key === 'Enter' && isOpen && options.length > 0) {
      e.preventDefault();
      handleSelectOption(options[0]);
    }
  };

  // Estilos base iguales al Input (valores por defecto)
  const baseClasses = 'w-full bg-transparent border border-gray-200 text-[var(--text-primary)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 px-2 py-2 text-xs';

  // Extraer clases de ancho del className para aplicarlas al contenedor
  const widthClass = className?.match(/w-\w+/)?.[0] || 'w-full';
  // Extraer todas las demás clases del className (altura, texto, padding, etc.)
  const otherInputClasses = className?.replace(/w-\w+/, '').trim() || '';
  
  // Si hay className personalizado, aplicar esas clases, sino usar las por defecto
  const finalClasses = otherInputClasses 
    ? `${baseClasses} ${otherInputClasses}`.trim()
    : baseClasses;

  const displayValue = selectedOption ? selectedOption.label : placeholder;
  const showPlaceholder = !selectedOption;

  return (
    <div ref={containerRef} className={cn('relative', widthClass)}>
      {/* Botón que muestra el valor seleccionado */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(
          finalClasses,
          'text-left cursor-pointer relative',
          disabled && 'opacity-50 cursor-not-allowed',
          isOpen && 'ring-2 ring-blue-500',
          showPlaceholder && 'text-[var(--text-secondary)]'
        )}
      >
        <span className="truncate pr-6">{displayValue}</span>
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-0.5 flex-shrink-0 pointer-events-none">
          {selectedOption && !disabled && value && value !== '' && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleClear(e);
              }}
              className="text-gray-400 hover:text-gray-600 p-0.5 pointer-events-auto cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClear(e as any);
                }
              }}
            >
              <X className="h-2.5 w-2.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              'h-2.5 w-2.5 text-gray-400 transition-transform flex-shrink-0',
              isOpen && 'transform rotate-180'
            )}
          />
        </div>
      </button>

      {/* Dropdown con opciones - renderizado con portal */}
      {isOpen && !disabled && options.length > 0 && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md shadow-lg max-h-60 overflow-hidden"
          style={{ 
            ...(dropdownPosition.isDropup && dropdownPosition.bottom !== undefined
              ? { bottom: `${dropdownPosition.bottom}px`, top: 'auto' }
              : { top: `${dropdownPosition.top}px`, bottom: 'auto' }
            ),
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--border-color)',
          }}
        >
          {/* Lista de opciones */}
          <div className="max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="px-3 py-2 text-xs text-[var(--text-secondary)] text-center">
                Cargando...
              </div>
            ) : (
              // Invertir el array cuando es dropup para que el primer elemento aparezca al final
              (dropdownPosition.isDropup ? [...options].reverse() : options).map((option) => {
                const isSelected = value === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelectOption(option)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-xs text-[var(--text-primary)] transition-colors',
                      isSelected 
                        ? 'bg-[var(--active-bg)] font-medium' 
                        : 'hover:bg-[var(--hover-bg)]'
                    )}
                    style={{
                      color: 'var(--text-primary)',
                      backgroundColor: isSelected ? 'var(--active-bg)' : 'transparent',
                    }}
                  >
                    {option.label}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
