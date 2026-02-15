import { useNavigate } from 'react-router-dom';
import { FileText, Truck, Users, Search, Loader2 } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useGlobalSearch, SearchResult } from '@/hooks/useGlobalSearch';

export function GlobalSearchDialog() {
  const navigate = useNavigate();
  const { query, setQuery, results, isLoading, isOpen, setIsOpen, clearSearch } = useGlobalSearch();

  const handleSelect = (result: SearchResult) => {
    navigate(result.url);
    clearSearch();
  };

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'quote':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'order':
        return <Truck className="w-4 h-4 text-green-500" />;
      case 'client':
        return <Users className="w-4 h-4 text-purple-500" />;
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'quote':
        return 'Cotações';
      case 'order':
        return 'Ordens de Serviço';
      case 'client':
        return 'Clientes';
    }
  };

  const groupedResults = results.reduce(
    (acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<SearchResult['type'], SearchResult[]>
  );

  return (
    <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
      <CommandInput
        placeholder="Buscar cotações, OS, clientes..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && query.length >= 2 && results.length === 0 && (
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-6">
              <Search className="w-10 h-10 text-muted-foreground" />
              <p>Nenhum resultado encontrado.</p>
            </div>
          </CommandEmpty>
        )}

        {!isLoading && query.length < 2 && (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <Search className="w-10 h-10" />
            <p>Digite pelo menos 2 caracteres para buscar</p>
          </div>
        )}

        {Object.entries(groupedResults).map(([type, items]) => (
          <CommandGroup key={type} heading={getTypeLabel(type as SearchResult['type'])}>
            {items.map((result) => (
              <CommandItem
                key={result.id}
                value={result.title}
                onSelect={() => handleSelect(result)}
                className="flex items-center gap-3 cursor-pointer"
              >
                {getIcon(result.type)}
                <div className="flex flex-col">
                  <span className="font-medium">{result.title}</span>
                  <span className="text-sm text-muted-foreground">{result.subtitle}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
