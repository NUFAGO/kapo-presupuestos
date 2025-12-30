import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => {
    const baseClasses = 'w-full bg-transparent border border-gray-200 text-[var(--text-primary)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 px-2 py-2 text-xs autofill:bg-transparent autofill:shadow-[inset_0_0_0px_1000px_transparent]';
    
    return (
      <input
        ref={ref}
        className={cn(baseClasses, className)}
        style={{
          WebkitBoxShadow: 'inset 0 0 0px 1000px transparent',
          boxShadow: 'inset 0 0 0px 1000px transparent',
        }}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };




