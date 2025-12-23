import * as React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  variant?: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const variantClasses = {
  blue: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400',
  green: 'bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400',
  orange: 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400',
  purple: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400',
  red: 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400',
};

const sizeClasses = {
  sm: 'h-7 px-2 text-xs',
  md: 'h-7 px-2 text-xs',
  lg: 'h-8 px-2.5 text-sm',
};

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, icon: Icon, variant = 'blue', size = 'md', label, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg shadow-sm hover:shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        <Icon className={iconSizes[size]} />
        {label && <span className="font-medium">{label}</span>}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

