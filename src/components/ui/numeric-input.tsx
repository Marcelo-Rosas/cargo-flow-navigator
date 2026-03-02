import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  suffix?: string;
  prefix?: string;
  onValueChange?: (val: number | null) => void;
}

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ suffix, prefix, onValueChange, value, onChange, onBlur, className, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(',', '.');
      const num = parseFloat(raw);
      onValueChange?.(raw === '' || raw === '-' ? null : Number.isNaN(num) ? null : num);
    };

    return (
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
            {prefix}
          </span>
        )}
        <Input
          ref={ref}
          type="number"
          step="any"
          inputMode="decimal"
          value={value ?? ''}
          onChange={handleChange}
          onBlur={onBlur}
          className={cn(prefix && 'pl-8', suffix && 'pr-10', className)}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);

NumericInput.displayName = 'NumericInput';
