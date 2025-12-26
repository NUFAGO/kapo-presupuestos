'use client';
//select adaptable
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectSearchOption {
  value: string;
  label: string;
}

export interface SelectSearchProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  options: SelectSearchOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
  showSearchIcon?: boolean; // Si true, muestra el ícono de lupa
  onSearch?: (searchTerm: string) => Promise<SelectSearchOption[]>; // Búsqueda en servidor opcional
  minCharsForSearch?: number; // Mínimo de caracteres para activar búsqueda en servidor (default: 2)
}

export function SelectSearch({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  className,
  disabled = false,
  isLoading = false,
  showSearchIcon = false,
  onSearch,
  minCharsForSearch = 2,
}: SelectSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, isDropup: false, bottom: undefined as number | undefined });
  const [serverOptions, setServerOptions] = useState<SelectSearchOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  // Sincronizar inputValue con value cuando cambia externamente
  // Si hay una opción seleccionada, mostrar su label, sino el value
  useEffect(() => {
    if (selectedOption) {
      setInputValue(selectedOption.label);
    } else {
      setInputValue(value || '');
    }
  }, [value, selectedOption]);

  // Búsqueda en servidor cuando hay onSearch
  useEffect(() => {
    if (!onSearch) return;

    const searchTerm = inputValue.trim();
    
    // Si hay menos caracteres que el mínimo, limpiar resultados de servidor
    if (searchTerm.length < minCharsForSearch) {
      setServerOptions([]);
      setIsSearching(false);
      return;
    }

    // Limpiar timeout anterior
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce de búsqueda en servidor
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await onSearch(searchTerm);
        setServerOptions(results);
      } catch (error) {
        console.error('Error en búsqueda en servidor:', error);
        setServerOptions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [inputValue, onSearch, minCharsForSearch]);

  // Filtrar opciones según el texto del input
  // Si hay búsqueda en servidor activa, usar esas opciones, sino filtrar localmente
  const filteredOptions = React.useMemo(() => {
    const searchTerm = inputValue.trim();
    
    // Si hay búsqueda en servidor y el término tiene suficientes caracteres, usar resultados del servidor
    if (onSearch && searchTerm.length >= minCharsForSearch) {
      return serverOptions;
    }
    
    // Si no hay término de búsqueda, mostrar todas las opciones
    if (!searchTerm) {
      return options;
    }
    
    // Filtrar localmente
    const term = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        opt.value.toLowerCase().includes(term)
    );
  }, [options, inputValue, onSearch, serverOptions, minCharsForSearch]);

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
        // Si el valor no coincide con ninguna opción, mantenerlo como está
        const matchingOption = options.find(opt => opt.value === inputValue || opt.label === inputValue);
        if (!matchingOption && inputValue) {
          onChange(inputValue);
        }
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
  }, [isOpen, inputValue, options, onChange]);

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
        // Usar bottom en lugar de top para que quede pegado al input
        setDropdownPosition({
          top: 0, // Se calculará con bottom
          left: rect.left + window.scrollX,
          width: rect.width,
          isDropup: true,
          bottom: window.innerHeight - rect.top + window.scrollY + gap, // Distancia desde el bottom del viewport
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

  // Enfocar el input cuando se abre y calcular posición del dropdown
  useEffect(() => {
    if (isOpen && inputRef.current && containerRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    // Si coincide exactamente con una opción, actualizar el valor
    const exactMatch = options.find(opt => opt.value === newValue || opt.label === newValue);
    if (exactMatch) {
      onChange(exactMatch.value);
    } else {
      // Permitir escribir valores personalizados
      onChange(newValue || null);
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleSelectOption = (option: SelectSearchOption) => {
    // Establecer el label para mostrar el nombre, no el ID
    setInputValue(option.label);
    // Si el valor es '', mantenerlo como '' en lugar de null
    onChange(option.value === '' ? '' : option.value);
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInputValue('');
    onChange(null);
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown' && filteredOptions.length > 0) {
      e.preventDefault();
      setIsOpen(true);
    } else if (e.key === 'Enter' && filteredOptions.length === 1) {
      e.preventDefault();
      handleSelectOption(filteredOptions[0]);
    }
  };

  // Estilos base iguales al Input (valores por defecto)
  const baseClasses = 'bg-transparent border border-gray-200 text-[var(--text-primary)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
  const defaultClasses = 'w-full px-2 py-2 text-xs';

  // Extraer clases de ancho del className para aplicarlas al contenedor
  const widthClass = className?.match(/w-\w+/)?.[0] || 'w-full';
  // Extraer todas las demás clases del className (altura, texto, padding, etc.)
  const otherInputClasses = className?.replace(/w-\w+/, '').trim() || '';
  
  // Si hay className personalizado, asegurar que tenga padding si no viene especificado
  const hasPaddingX = otherInputClasses.match(/px-\w+/);
  const hasPaddingY = otherInputClasses.match(/py-\w+/);
  const paddingClasses = hasPaddingX || hasPaddingY ? '' : 'px-2 py-2';
  
  // Determinar si debe tener text-center
  // Solo aplicar text-center si viene explícitamente en el className
  // O si es el estilo del panel (text-xs h-6) y NO tiene text-left/text-right
  // PERO si hay icono de búsqueda, el texto debe estar alineado a la izquierda
  const hasTextCenter = otherInputClasses.includes('text-center');
  const hasTextLeft = otherInputClasses.includes('text-left');
  const hasTextRight = otherInputClasses.includes('text-right');
  const isPanelStyle = otherInputClasses.includes('text-xs') && otherInputClasses.includes('h-6');
  const shouldCenter = hasTextCenter || (isPanelStyle && !hasTextLeft && !hasTextRight && !showSearchIcon);

  // Determinar padding izquierdo según si hay ícono de búsqueda
  const leftPadding = showSearchIcon 
    ? (otherInputClasses.includes('text-xs') ? 'pl-6' : 'pl-7')
    : '';

  return (
    <div ref={containerRef} className={cn('relative', widthClass)}>
      {/* Input editable - mismo estilo que el Input original */}
      <div className="relative flex items-center w-full">
        {showSearchIcon && (
          <Search className="absolute left-1.5 top-1/2 transform -translate-y-1/2 h-2.5 w-2.5 text-[var(--text-secondary)] pointer-events-none z-10" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            baseClasses,
            'w-full', // El input siempre ocupa el 100% del contenedor
            // Si hay className personalizado, usar esas clases + padding por defecto si no viene
            // Si no hay className, usar valores por defecto completos
            otherInputClasses 
              ? `${otherInputClasses} ${paddingClasses}`.trim()
              : defaultClasses,
            // Solo aplicar text-center si no hay text-left/text-right explícito
            shouldCenter && !hasTextLeft && !hasTextRight ? 'text-center' : '',
            // Ajustar padding izquierdo si hay ícono de búsqueda
            showSearchIcon && leftPadding,
            // Ajustar padding derecho según el tamaño del texto (solo si no viene px-* personalizado)
            !hasPaddingX && (otherInputClasses.includes('text-xs') ? 'pr-7' : 'pr-8'),
            disabled && 'opacity-50 cursor-not-allowed',
            isOpen && 'ring-2 ring-blue-500'
          )}
        />
        <div className="absolute right-1 flex items-center gap-0.5 flex-shrink-0 pointer-events-none">
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear(e);
              }}
              className="text-gray-400 hover:text-gray-600 p-0.5 pointer-events-auto"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              'h-2.5 w-2.5 text-gray-400 transition-transform flex-shrink-0',
              isOpen && 'transform rotate-180'
            )}
          />
        </div>
      </div>

      {/* Dropdown con opciones filtradas - renderizado con portal */}
      {isOpen && !disabled && filteredOptions.length > 0 && createPortal(
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
            {(isLoading || isSearching) ? (
              <div className="px-3 py-2 text-xs text-[var(--text-secondary)] text-center">
                Cargando...
              </div>
            ) : filteredOptions.length === 0 && inputValue.trim().length >= minCharsForSearch ? (
              <div className="px-3 py-2 text-xs text-[var(--text-secondary)] text-center">
                No se encontraron resultados
              </div>
            ) : (
              // Invertir el array cuando es dropup para que el primer elemento aparezca al final
              (dropdownPosition.isDropup ? [...filteredOptions].reverse() : filteredOptions).map((option) => {
                const isSelected = value === option.value || inputValue === option.value || inputValue === option.label;
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

