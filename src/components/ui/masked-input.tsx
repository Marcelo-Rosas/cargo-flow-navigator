import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type MaskType = 'cep' | 'cnpj' | 'cpf' | 'phone';

interface MaskedInputProps extends Omit<React.ComponentProps<"input">, 'onChange'> {
  mask: MaskType;
  onValueChange?: (rawValue: string, maskedValue: string) => void;
}

const maskConfig: Record<MaskType, { maxDigits: number; format: (value: string) => string }> = {
  cep: {
    maxDigits: 8,
    format: (value: string) => {
      if (value.length <= 5) return value;
      return `${value.slice(0, 5)}-${value.slice(5, 8)}`;
    },
  },
  cnpj: {
    maxDigits: 14,
    format: (value: string) => {
      let result = value;
      if (value.length > 2) result = `${value.slice(0, 2)}.${value.slice(2)}`;
      if (value.length > 5) result = `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5)}`;
      if (value.length > 8) result = `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8)}`;
      if (value.length > 12) result = `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8, 12)}-${value.slice(12, 14)}`;
      return result;
    },
  },
  cpf: {
    maxDigits: 11,
    format: (value: string) => {
      let result = value;
      if (value.length > 3) result = `${value.slice(0, 3)}.${value.slice(3)}`;
      if (value.length > 6) result = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
      if (value.length > 9) result = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9, 11)}`;
      return result;
    },
  },
  phone: {
    maxDigits: 11,
    format: (value: string) => {
      if (value.length <= 2) return value.length > 0 ? `(${value}` : '';
      if (value.length <= 7) return `(${value.slice(0, 2)}) ${value.slice(2)}`;
      return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7, 11)}`;
    },
  },
};

const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ className, mask, value, onValueChange, onBlur, ...props }, ref) => {
    const config = maskConfig[mask];

    const formatValue = (raw: string): string => {
      const digits = raw.replace(/\D/g, '').slice(0, config.maxDigits);
      return config.format(digits);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const digits = inputValue.replace(/\D/g, '').slice(0, config.maxDigits);
      const masked = config.format(digits);
      
      onValueChange?.(digits, masked);
    };

    const displayValue = value ? formatValue(String(value)) : '';

    return (
      <Input
        ref={ref}
        className={cn(className)}
        value={displayValue}
        onChange={handleChange}
        onBlur={onBlur}
        {...props}
      />
    );
  }
);

MaskedInput.displayName = "MaskedInput";

export { MaskedInput };
export type { MaskedInputProps, MaskType };
