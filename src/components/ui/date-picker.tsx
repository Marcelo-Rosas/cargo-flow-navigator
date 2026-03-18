import * as React from 'react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface DatePickerProps {
  /** Date value (Date object) */
  value?: Date;
  /** Callback with Date or undefined when cleared */
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Wrapper that accepts string values (YYYY-MM-DD) and converts to/from Date.
 * Drop-in replacement for `<Input type="date" value={str} onChange={e => set(e.target.value)} />`
 */
export interface DatePickerStringProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function toDate(str: string | undefined): Date | undefined {
  if (!str) return undefined;
  const d = parse(str, 'yyyy-MM-dd', new Date());
  return isNaN(d.getTime()) ? undefined : d;
}

function toStr(date: Date | undefined): string {
  if (!date) return '';
  return format(date, 'yyyy-MM-dd');
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Selecione a data',
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal h-10',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, 'dd/MM/yyyy', { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(day) => {
            onChange(day);
            setOpen(false);
          }}
          locale={ptBR}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * String-based DatePicker — accepts/emits YYYY-MM-DD strings.
 * Direct replacement for <Input type="date" />.
 */
export function DatePickerString({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: DatePickerStringProps) {
  return (
    <DatePicker
      value={toDate(value)}
      onChange={(d) => onChange(toStr(d))}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
}
