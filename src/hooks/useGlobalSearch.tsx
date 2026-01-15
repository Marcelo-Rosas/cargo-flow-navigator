import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';

export interface SearchResult {
  id: string;
  type: 'quote' | 'order' | 'client';
  title: string;
  subtitle: string;
  url: string;
}

export function useGlobalSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return [];

      const searchTerm = `%${debouncedQuery}%`;
      const allResults: SearchResult[] = [];

      // Search quotes
      const { data: quotes } = await supabase
        .from('quotes')
        .select('id, client_name, origin, destination, stage')
        .or(`client_name.ilike.${searchTerm},origin.ilike.${searchTerm},destination.ilike.${searchTerm}`)
        .limit(5);

      if (quotes) {
        quotes.forEach((q) => {
          allResults.push({
            id: q.id,
            type: 'quote',
            title: `Cotação - ${q.client_name}`,
            subtitle: `${q.origin} → ${q.destination}`,
            url: '/comercial',
          });
        });
      }

      // Search orders
      const { data: orders } = await supabase
        .from('orders')
        .select('id, os_number, client_name, origin, destination')
        .or(`client_name.ilike.${searchTerm},os_number.ilike.${searchTerm},origin.ilike.${searchTerm},destination.ilike.${searchTerm}`)
        .limit(5);

      if (orders) {
        orders.forEach((o) => {
          allResults.push({
            id: o.id,
            type: 'order',
            title: `${o.os_number} - ${o.client_name}`,
            subtitle: `${o.origin} → ${o.destination}`,
            url: '/operacional',
          });
        });
      }

      // Search clients
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, cnpj, city, state')
        .or(`name.ilike.${searchTerm},cnpj.ilike.${searchTerm},city.ilike.${searchTerm}`)
        .limit(5);

      if (clients) {
        clients.forEach((c) => {
          allResults.push({
            id: c.id,
            type: 'client',
            title: c.name,
            subtitle: c.cnpj ? `${c.cnpj} - ${c.city || ''}/${c.state || ''}` : `${c.city || ''}/${c.state || ''}`,
            url: '/clientes',
          });
        });
      }

      return allResults;
    },
    enabled: debouncedQuery.length >= 2,
  });

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setIsOpen(false);
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    isOpen,
    setIsOpen,
    clearSearch,
  };
}
