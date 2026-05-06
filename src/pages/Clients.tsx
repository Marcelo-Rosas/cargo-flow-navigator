import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Building2,
  Phone,
  Mail,
  MapPin,
  User,
  Crown,
  Briefcase,
  AlertCircle,
  X,
  Network as NetworkIcon,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button, buttonVariants } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatCnpjDisplay, formatCpfDisplay, formatPhoneDisplay } from '@/lib/formatters';
import { detectNetworks, DEFAULT_MIN_UNITS } from '@/lib/network-detector';
import { detectDuplicates, suggestPrimary, type DuplicateGroup } from '@/lib/dedup-detector';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useClients, useDeleteClient } from '@/hooks/useClients';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { ClientForm } from '@/components/forms/ClientForm';
import { Database } from '@/integrations/supabase/types';
import { useDebounce } from '@/hooks/useDebounce';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Client = Database['public']['Tables']['clients']['Row'];
type PersonType = 'all' | 'PF' | 'PJ';

type QsaPartner = { name?: string | null; role?: string | null };

function getQsaOwner(partners: Client['partners']): QsaPartner | null {
  if (!partners || !Array.isArray(partners) || partners.length === 0) return null;
  const list = partners as QsaPartner[];
  const admin = list.find((p) => p?.role === 'Sócio-Administrador' && p?.name);
  if (admin) return admin;
  const first = list.find((p) => p?.name);
  return first ?? null;
}

function formatCnae(code: string | null | undefined): string | null {
  if (!code) return null;
  const digits = code.replace(/\D/g, '');
  if (digits.length !== 7) return code;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}-${digits.slice(4, 5)}-${digits.slice(5)}`;
}

const COLUMN_COUNT = 7;

function ClientsTableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: COLUMN_COUNT }).map((_, i) => (
            <TableHead key={i}>
              <Skeleton className="h-4 w-24" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 8 }).map((_, rowIdx) => (
          <TableRow key={rowIdx}>
            {Array.from({ length: COLUMN_COUNT }).map((_, colIdx) => (
              <TableCell key={colIdx}>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function Clients() {
  const { user } = useAuth();
  const { canWrite } = useUserRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Sync URL param `?q=` with the search input (so global ⌘K navigates correctly)
  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (current !== searchTerm) {
      const next = new URLSearchParams(searchParams);
      if (searchTerm) {
        next.set('q', searchTerm);
      } else {
        next.delete('q');
      }
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Listen for external URL changes (e.g., another ⌘K navigation while already on /clientes)
  useEffect(() => {
    const urlQuery = searchParams.get('q') ?? '';
    if (urlQuery !== searchTerm) {
      setSearchTerm(urlQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Filters
  const [typeFilter, setTypeFilter] = useState<PersonType>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [networkFilter, setNetworkFilter] = useState<string | null>(null);

  // Network detection settings
  const [minUnits, setMinUnits] = useState<number>(DEFAULT_MIN_UNITS);
  const [conservativeMode, setConservativeMode] = useState<boolean>(false);
  const [showAllNetworks, setShowAllNetworks] = useState<boolean>(false);

  // Duplicate review state
  const [ignoredDupes, setIgnoredDupes] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('clients:dedup:ignored');
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });
  const [dupeReviewGroup, setDupeReviewGroup] = useState<DuplicateGroup | null>(null);
  const [primaryToKeep, setPrimaryToKeep] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  // Persist ignored set
  useEffect(() => {
    localStorage.setItem('clients:dedup:ignored', JSON.stringify(Array.from(ignoredDupes)));
  }, [ignoredDupes]);

  // Only fetch when user is authenticated
  const {
    data: clients,
    isLoading,
    isError,
    error,
    refetch,
  } = useClients(debouncedSearchTerm, { enabled: !!user });
  const deleteClientMutation = useDeleteClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const canManageClients = canWrite;

  // Available states (derived from current dataset)
  const availableStates = useMemo(() => {
    if (!clients) return [] as string[];
    const set = new Set<string>();
    clients.forEach((c) => {
      if (c.state) set.add(c.state);
    });
    return Array.from(set).sort();
  }, [clients]);

  // Available cities (filtered by selected state when applicable)
  const availableCities = useMemo(() => {
    if (!clients) return [] as string[];
    const set = new Set<string>();
    clients.forEach((c) => {
      if (!c.city) return;
      if (stateFilter !== 'all' && c.state !== stateFilter) return;
      set.add(c.city);
    });
    return Array.from(set).sort();
  }, [clients, stateFilter]);

  // Reset city when state changes if city no longer belongs to the new state
  useEffect(() => {
    if (cityFilter !== 'all' && !availableCities.includes(cityFilter)) {
      setCityFilter('all');
    }
  }, [cityFilter, availableCities]);

  // Detect duplicates on the full dataset
  const duplicateGroups = useMemo(
    () => detectDuplicates(clients, ignoredDupes),
    [clients, ignoredDupes]
  );
  const totalDuplicateRecords = duplicateGroups.reduce((sum, g) => sum + g.clients.length, 0);

  // Detect networks on the full server-fetched dataset (independent of filters
  // so that the network panel reflects the universe, not the filtered subset).
  const networkResult = useMemo(
    () => detectNetworks(clients, { minUnits, enableNamePrefixPass: !conservativeMode }),
    [clients, minUnits, conservativeMode]
  );

  // Reset network filter if the selected rede no longer exists after a settings change
  useEffect(() => {
    if (networkFilter && !networkResult.networks.some((n) => n.id === networkFilter)) {
      setNetworkFilter(null);
    }
  }, [networkFilter, networkResult]);

  // Map clientId -> networkId for fast lookup when applying networkFilter
  const clientToNetworkId = useMemo(() => {
    const map = new Map<string, string>();
    networkResult.networks.forEach((net) => {
      net.units.forEach((u) => map.set(u.id, net.id));
    });
    return map;
  }, [networkResult]);

  // Apply filters client-side on top of the server-side text search
  const filteredClients = useMemo(() => {
    if (!clients) return [] as Client[];
    return clients.filter((c) => {
      if (typeFilter === 'PF' && !c.cpf) return false;
      if (typeFilter === 'PJ' && !c.cnpj) return false;
      if (stateFilter !== 'all' && c.state !== stateFilter) return false;
      if (cityFilter !== 'all' && c.city !== cityFilter) return false;
      if (networkFilter && clientToNetworkId.get(c.id) !== networkFilter) return false;
      return true;
    });
  }, [clients, typeFilter, stateFilter, cityFilter, networkFilter, clientToNetworkId]);

  const hasActiveFilters =
    typeFilter !== 'all' || stateFilter !== 'all' || cityFilter !== 'all' || networkFilter !== null;

  const clearFilters = () => {
    setTypeFilter('all');
    setStateFilter('all');
    setCityFilter('all');
    setNetworkFilter(null);
  };

  const openDupeReview = (group: DuplicateGroup) => {
    setDupeReviewGroup(group);
    setPrimaryToKeep(suggestPrimary(group).id);
  };

  const closeDupeReview = () => {
    if (isMerging) return;
    setDupeReviewGroup(null);
    setPrimaryToKeep(null);
  };

  const ignoreCurrentDupeGroup = () => {
    if (!dupeReviewGroup) return;
    setIgnoredDupes((prev) => {
      const next = new Set(prev);
      next.add(dupeReviewGroup.id);
      return next;
    });
    toast.success('Grupo marcado como "não é duplicata"');
    closeDupeReview();
  };

  const confirmDupeMerge = async () => {
    if (!dupeReviewGroup || !primaryToKeep || isMerging) return;
    const toDelete = dupeReviewGroup.clients.filter((c) => c.id !== primaryToKeep);
    if (toDelete.length === 0) {
      closeDupeReview();
      return;
    }
    setIsMerging(true);
    try {
      for (const c of toDelete) {
        await deleteClientMutation.mutateAsync(c.id);
      }
      toast.success(
        `${toDelete.length} ${toDelete.length === 1 ? 'duplicata removida' : 'duplicatas removidas'}`
      );
      setDupeReviewGroup(null);
      setPrimaryToKeep(null);
    } catch {
      toast.error('Erro ao remover duplicatas. Tente novamente.');
    } finally {
      setIsMerging(false);
    }
  };

  const restoreIgnoredDupes = () => {
    setIgnoredDupes(new Set());
    toast.success('Lista de "não é duplicata" foi resetada');
  };

  const totalClients = clients?.length ?? 0;

  // When the user has Estado/Cidade selected, narrow the networks panel to
  // redes that have at least one unit matching the active region. Type filter
  // (PF/PJ) doesn't apply because every network is, by construction, a group
  // of PJ entities.
  const regionFilteredNetworks = useMemo(() => {
    if (stateFilter === 'all' && cityFilter === 'all') return networkResult.networks;
    return networkResult.networks.filter((net) =>
      net.units.some((u) => {
        if (stateFilter !== 'all' && u.state !== stateFilter) return false;
        if (cityFilter !== 'all' && u.city !== cityFilter) return false;
        return true;
      })
    );
  }, [networkResult, stateFilter, cityFilter]);

  const totalUnitsInNetworks = regionFilteredNetworks.reduce((sum, n) => sum + n.unitCount, 0);
  const networkSharePct =
    totalClients > 0 ? Math.round((totalUnitsInNetworks / totalClients) * 100) : 0;
  const NETWORK_PREVIEW_COUNT = 5;
  const visibleNetworks = showAllNetworks
    ? regionFilteredNetworks
    : regionFilteredNetworks.slice(0, NETWORK_PREVIEW_COUNT);
  const hiddenNetworkCount = Math.max(regionFilteredNetworks.length - NETWORK_PREVIEW_COUNT, 0);
  const activeNetwork = networkFilter
    ? networkResult.networks.find((n) => n.id === networkFilter)
    : null;
  const regionLabel =
    stateFilter !== 'all' && cityFilter !== 'all'
      ? `${cityFilter}/${stateFilter}`
      : stateFilter !== 'all'
        ? stateFilter
        : cityFilter !== 'all'
          ? cityFilter
          : null;

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!canManageClients) return;
    if (!deletingClient || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteClientMutation.mutateAsync(deletingClient.id);
      toast.success('Cliente excluído com sucesso');
      setDeletingClient(null);
    } catch (error) {
      toast.error('Erro ao excluir cliente');
      // Keep dialog open on error so user can retry
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingClient(null);
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">Faça login para acessar os clientes</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <motion.h1
            className="text-3xl font-bold text-foreground"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Clientes
          </motion.h1>
          <motion.p
            className="text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <span className="font-semibold text-primary">{filteredClients.length}</span>
            {hasActiveFilters || debouncedSearchTerm
              ? ` de ${clients?.length ?? 0} clientes`
              : ' clientes cadastrados'}
          </motion.p>
        </div>

        <div className="flex items-center gap-3">
          <InputGroup className="w-80">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar por nome, CPF, CNPJ, e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
          {canManageClients && (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus />
              Novo Cliente
            </Button>
          )}
        </div>
      </div>

      {/* Possíveis Duplicatas */}
      {!isLoading && !isError && duplicateGroups.length > 0 && (
        <Card className="mb-4 border-warning/40">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-lg bg-warning/15 flex items-center justify-center shrink-0">
                  <AlertTriangle className="size-5 text-warning" />
                </div>
                <div>
                  <CardTitle className="text-lg">Possíveis duplicatas</CardTitle>
                  <CardDescription>
                    <span className="font-semibold text-foreground">{duplicateGroups.length}</span>{' '}
                    {duplicateGroups.length === 1 ? 'grupo' : 'grupos'} ·{' '}
                    <span className="font-semibold text-foreground">{totalDuplicateRecords}</span>{' '}
                    registros suspeitos
                  </CardDescription>
                </div>
              </div>
              {ignoredDupes.size > 0 && (
                <Button variant="ghost" size="sm" onClick={restoreIgnoredDupes}>
                  Restaurar {ignoredDupes.size} ignorado{ignoredDupes.size > 1 ? 's' : ''}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {duplicateGroups.slice(0, 6).map((group) => {
                const sample = group.clients[0];
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => openDupeReview(group)}
                    className="group flex items-center gap-2 rounded-md border border-border px-3 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <p
                        className="text-sm font-medium text-foreground truncate"
                        title={sample.name ?? ''}
                      >
                        {sample.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {group.clients.length}
                        </span>{' '}
                        registros · {group.reasonLabel}
                      </p>
                    </div>
                    <Badge
                      variant={group.reasonConfidence === 'high' ? 'destructive' : 'outline'}
                      className="text-[10px] uppercase shrink-0"
                    >
                      {group.reasonConfidence === 'high' ? 'Certo' : 'Provável'}
                    </Badge>
                  </button>
                );
              })}
              {duplicateGroups.length > 6 && (
                <span className="flex items-center text-xs text-muted-foreground px-2">
                  + {duplicateGroups.length - 6} grupos
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Networks Summary Card */}
      {!isLoading && !isError && totalClients > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <NetworkIcon className="size-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Redes detectadas</CardTitle>
                  <CardDescription>
                    {networkResult.networks.length === 0 ? (
                      <>Nenhuma rede com mín. {minUnits} unidades nesse modo</>
                    ) : regionFilteredNetworks.length === 0 ? (
                      <>Nenhuma rede com unidade em {regionLabel}</>
                    ) : (
                      <>
                        <span className="font-semibold text-foreground">
                          {regionFilteredNetworks.length}
                        </span>{' '}
                        {regionFilteredNetworks.length === 1 ? 'rede' : 'redes'}
                        {regionLabel ? ` em ${regionLabel}` : ''} ·{' '}
                        <span className="font-semibold text-foreground">
                          {totalUnitsInNetworks}
                        </span>{' '}
                        {totalUnitsInNetworks === 1 ? 'unidade' : 'unidades'}
                        {regionLabel ? '' : ` agrupadas (${networkSharePct}% da base)`}
                      </>
                    )}
                  </CardDescription>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="min-units" className="text-sm whitespace-nowrap">
                    Mín. unidades
                  </Label>
                  <Select value={String(minUnits)} onValueChange={(v) => setMinUnits(Number(v))}>
                    <SelectTrigger id="min-units" className="w-[80px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="conservative-mode"
                    checked={conservativeMode}
                    onCheckedChange={setConservativeMode}
                  />
                  <Label htmlFor="conservative-mode" className="text-sm whitespace-nowrap">
                    Modo conservador
                  </Label>
                </div>
              </div>
            </div>
          </CardHeader>

          {visibleNetworks.length > 0 && (
            <CardContent>
              <div className={cn('grid gap-2', 'grid-cols-[repeat(auto-fill,minmax(220px,1fr))]')}>
                {visibleNetworks.map((net) => {
                  const isActive = networkFilter === net.id;
                  // When a region filter is active, count units of this rede
                  // that match the region (so the displayed count reflects the
                  // user's view of the world, not the global rede size).
                  const unitsInRegion =
                    regionLabel === null
                      ? net.unitCount
                      : net.units.filter((u) => {
                          if (stateFilter !== 'all' && u.state !== stateFilter) return false;
                          if (cityFilter !== 'all' && u.city !== cityFilter) return false;
                          return true;
                        }).length;
                  const statesLabel =
                    net.states.length <= 3
                      ? net.states.join(', ')
                      : `${net.states.slice(0, 3).join(', ')} +${net.states.length - 3}`;
                  return (
                    <button
                      key={net.id}
                      type="button"
                      onClick={() => setNetworkFilter(isActive ? null : net.id)}
                      className={cn(
                        'group flex items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors',
                        isActive ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-medium text-foreground truncate"
                          title={net.label}
                        >
                          {net.label}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          <span className="font-semibold text-foreground">{unitsInRegion}</span>
                          {regionLabel && unitsInRegion !== net.unitCount
                            ? ` de ${net.unitCount}`
                            : ''}{' '}
                          unid · {statesLabel}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase shrink-0"
                        title={
                          net.detectionMethod === 'cnpj-root'
                            ? 'Mesma raiz de CNPJ (filiais)'
                            : net.detectionMethod === 'trade-name'
                              ? 'Mesmo nome fantasia'
                              : 'Heurística por nome'
                        }
                      >
                        {net.detectionMethod === 'cnpj-root'
                          ? 'CNPJ'
                          : net.detectionMethod === 'trade-name'
                            ? 'Marca'
                            : 'Nome'}
                      </Badge>
                    </button>
                  );
                })}
              </div>

              {hiddenNetworkCount > 0 && (
                <div className="mt-3 flex items-center justify-center">
                  <Button variant="ghost" size="sm" onClick={() => setShowAllNetworks((v) => !v)}>
                    {showAllNetworks ? 'Mostrar menos' : `Ver todas (+${hiddenNetworkCount})`}
                  </Button>
                </div>
              )}

              {activeNetwork && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Filtrando por{' '}
                    <span className="font-medium text-foreground">{activeNetwork.label}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNetworkFilter(null)}
                    className="h-7"
                  >
                    <X />
                    Remover filtro
                  </Button>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <ToggleGroup
          type="single"
          value={typeFilter}
          onValueChange={(v) => setTypeFilter((v || 'all') as PersonType)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="all" aria-label="Todos">
            Todos
          </ToggleGroupItem>
          <ToggleGroupItem value="PF" aria-label="Pessoa Física">
            PF
          </ToggleGroupItem>
          <ToggleGroupItem value="PJ" aria-label="Pessoa Jurídica">
            PJ
          </ToggleGroupItem>
        </ToggleGroup>

        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            {availableStates.map((uf) => (
              <SelectItem key={uf} value={uf}>
                {uf}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as cidades</SelectItem>
            {availableCities.map((city) => (
              <SelectItem key={city} value={city}>
                {city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
            <X />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <ClientsTableSkeleton />
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Não foi possível carregar os clientes</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              {(error instanceof Error && error.message) || 'Erro inesperado ao buscar clientes.'}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="w-fit">
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : filteredClients.length === 0 ? (
        <Empty className="bg-card rounded-xl border border-border shadow-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>
              {hasActiveFilters || debouncedSearchTerm
                ? 'Nenhum cliente para esses filtros'
                : 'Nenhum cliente cadastrado'}
            </EmptyTitle>
            <EmptyDescription>
              {hasActiveFilters || debouncedSearchTerm
                ? 'Ajuste a busca ou os filtros para ver mais resultados'
                : 'Comece adicionando seu primeiro cliente'}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                <X />
                Limpar filtros
              </Button>
            )}
            {canManageClients && !hasActiveFilters && !debouncedSearchTerm && (
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus />
                Adicionar Cliente
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card rounded-xl border border-border shadow-card overflow-hidden"
        >
          <Table className="table-fixed">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[260px]">Cliente</TableHead>
                <TableHead className="w-[150px]">CPF / CNPJ</TableHead>
                <TableHead className="w-[220px]">Sócio-Administrador</TableHead>
                <TableHead className="w-[300px]">Atividade</TableHead>
                <TableHead className="w-[160px]">Contato</TableHead>
                <TableHead className="w-[170px]">Localização</TableHead>
                <TableHead className="w-[100px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => {
                const owner = getQsaOwner(client.partners);
                const cnaeCode = formatCnae(client.cnae_main_code);
                const cnaeDesc = client.cnae_main_description;

                return (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="size-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate" title={client.name}>
                            {client.name}
                          </p>
                          {client.contact_name && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <User className="size-3 shrink-0" />
                              <span className="truncate">{client.contact_name}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {client.cpf
                        ? formatCpfDisplay(String(client.cpf)) || String(client.cpf)
                        : client.cnpj
                          ? client.cnpj_mask || formatCnpjDisplay(client.cnpj)
                          : '-'}
                    </TableCell>
                    <TableCell>
                      {owner?.name ? (
                        <div className="flex items-start gap-2">
                          <Crown className="size-3.5 text-warning mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-sm font-medium text-foreground truncate"
                              title={owner.name}
                            >
                              {owner.name}
                            </p>
                            {owner.role && owner.role !== 'Sócio-Administrador' && (
                              <p className="text-xs text-muted-foreground truncate">{owner.role}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {cnaeCode || cnaeDesc ? (
                        <div className="flex items-start gap-2">
                          <Briefcase className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            {cnaeCode && (
                              <p className="text-xs font-mono text-muted-foreground">{cnaeCode}</p>
                            )}
                            {cnaeDesc && (
                              <p className="text-sm text-foreground line-clamp-2" title={cnaeDesc}>
                                {cnaeDesc}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <div className="flex flex-col gap-1 min-w-0">
                        {client.phone && (
                          <div className="flex items-center gap-2 min-w-0 text-foreground">
                            <Phone className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{formatPhoneDisplay(client.phone)}</span>
                          </div>
                        )}
                        {client.email && (
                          <div className="flex items-center gap-2 min-w-0 text-muted-foreground">
                            <Mail className="size-3.5 shrink-0" />
                            <span className="truncate" title={client.email}>
                              {client.email}
                            </span>
                          </div>
                        )}
                        {!client.phone && !client.email && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.city || client.state ? (
                        <div className="flex items-center gap-2 text-foreground">
                          <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                          <span
                            className="truncate"
                            title={[client.city, client.state].filter(Boolean).join(' - ')}
                          >
                            {[client.city, client.state].filter(Boolean).join(' - ')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {canManageClients && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => handleEdit(client)}
                              aria-label="Editar cliente"
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingClient(client)}
                              aria-label="Excluir cliente"
                            >
                              <Trash2 />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </motion.div>
      )}

      {/* Duplicate Review Dialog */}
      <Dialog
        open={!!dupeReviewGroup}
        onOpenChange={(open) => {
          if (!open) closeDupeReview();
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisar possível duplicata</DialogTitle>
            <DialogDescription>
              {dupeReviewGroup ? (
                <>
                  Razão: <span className="font-medium">{dupeReviewGroup.reasonLabel}</span>
                  {' · '}
                  <span
                    className={cn(
                      dupeReviewGroup.reasonConfidence === 'high'
                        ? 'text-destructive font-medium'
                        : 'text-muted-foreground'
                    )}
                  >
                    {dupeReviewGroup.reasonConfidence === 'high'
                      ? 'alta confiança'
                      : 'confiança média'}
                  </span>
                  . Selecione o registro a manter; os demais serão excluídos.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {dupeReviewGroup && (
            <RadioGroup
              value={primaryToKeep ?? ''}
              onValueChange={setPrimaryToKeep}
              className="grid gap-3"
            >
              {dupeReviewGroup.clients.map((c) => {
                const isPrimary = primaryToKeep === c.id;
                return (
                  <Label
                    key={c.id}
                    htmlFor={`dupe-${c.id}`}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors',
                      isPrimary ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
                    )}
                  >
                    <RadioGroupItem id={`dupe-${c.id}`} value={c.id} className="mt-1 shrink-0" />
                    <div className="grid gap-1 min-w-0 flex-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{c.name}</span>
                        {isPrimary && (
                          <Badge variant="secondary" className="text-[10px]">
                            <CheckCircle2 />
                            Manter este
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                        <div>
                          <span className="text-xs">CNPJ/CPF: </span>
                          <span className="font-mono">
                            {c.cpf
                              ? formatCpfDisplay(String(c.cpf))
                              : c.cnpj
                                ? c.cnpj_mask || formatCnpjDisplay(c.cnpj)
                                : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs">Cidade: </span>
                          {[c.city, c.state].filter(Boolean).join(' - ') || '—'}
                        </div>
                        <div>
                          <span className="text-xs">Telefone: </span>
                          {c.phone ? formatPhoneDisplay(c.phone) : '—'}
                        </div>
                        <div className="truncate">
                          <span className="text-xs">E-mail: </span>
                          {c.email || '—'}
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs">Contato: </span>
                          {c.contact_name || '—'}
                        </div>
                        <div>
                          <span className="text-xs">Cadastrado: </span>
                          {c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '—'}
                        </div>
                        <div>
                          <span className="text-xs">Atualizado: </span>
                          {c.updated_at ? new Date(c.updated_at).toLocaleDateString('pt-BR') : '—'}
                        </div>
                      </div>
                    </div>
                  </Label>
                );
              })}
            </RadioGroup>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
            <Button variant="ghost" onClick={ignoreCurrentDupeGroup} disabled={isMerging}>
              Não é duplicata
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeDupeReview} disabled={isMerging}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDupeMerge}
                disabled={isMerging || !primaryToKeep}
              >
                {isMerging ? (
                  <>
                    <Spinner />
                    Removendo...
                  </>
                ) : dupeReviewGroup ? (
                  `Excluir ${dupeReviewGroup.clients.length - 1} ${
                    dupeReviewGroup.clients.length - 1 === 1 ? 'registro' : 'registros'
                  }`
                ) : (
                  'Confirmar'
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client Form */}
      <ClientForm
        open={isFormOpen}
        onClose={handleFormClose}
        client={editingClient}
        onSelectExisting={(existing) => {
          setIsFormOpen(false);
          // small delay so the dialog unmounts before remounting in edit mode
          window.setTimeout(() => {
            setEditingClient(existing);
            setIsFormOpen(true);
          }, 50);
          toast.info(`Editando cliente existente: ${existing.name}`);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingClient && canManageClients}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeletingClient(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente "{deletingClient?.name}"? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className={cn(buttonVariants({ variant: 'destructive' }))}
            >
              {isDeleting ? (
                <>
                  <Spinner />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
