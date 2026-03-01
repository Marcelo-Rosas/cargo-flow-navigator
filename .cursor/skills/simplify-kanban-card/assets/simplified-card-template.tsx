// Estrutura simplificada para QuoteCard.tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ... dentro do return do componente
<TooltipProvider>
  <div className="bg-card p-4 rounded-lg">
    {/* Header com ID, Nome do Cliente e Menu de Ações */}
    <div className="flex justify-between items-start">
      <div>
        <h4 className="font-semibold">{quote.quote_code}</h4>
        <p className="text-sm text-muted-foreground">{quote.client_name}</p>
      </div>
      {/* DropdownMenu com ações */}
    </div>

    {/* Tooltip para informações secundárias */}
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="mt-2 text-sm text-muted-foreground cursor-pointer">
          {/* Rota visível */}
          <span>
            {quote.origin} → {quote.destination}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {/* Detalhes completos no hover */}
        <p>Embarcador: {quote.shipper_name}</p>
        <p>Tipo: {quote.freight_type}</p>
      </TooltipContent>
    </Tooltip>

    {/* Footer com Valor e Data */}
    <div className="flex justify-between items-end mt-4 pt-2 border-t">
      <span className="font-bold text-lg">{formatCurrency(quote.value)}</span>
      <span className="text-xs text-muted-foreground">{formatDate(quote.created_at)}</span>
    </div>
  </div>
</TooltipProvider>;
