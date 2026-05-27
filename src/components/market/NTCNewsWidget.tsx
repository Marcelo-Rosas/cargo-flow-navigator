import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useNewsItems } from '@/hooks/useNewsItems';

function getRelevanciaColor(relevanceScore: number | null) {
  const score = relevanceScore ?? 5;
  if (score >= 8) return { bg: 'bg-red-100', text: 'text-red-800', badge: 'bg-red-600' };
  if (score >= 5) return { bg: 'bg-yellow-100', text: 'text-yellow-800', badge: 'bg-yellow-600' };
  return { bg: 'bg-green-100', text: 'text-green-800', badge: 'bg-green-600' };
}

function formatarData(data: string) {
  const d = new Date(data);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function NTCNewsWidget() {
  const { data: items, isLoading, isError } = useNewsItems(10);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notícias NTC</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando notícias...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notícias NTC</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Erro ao carregar notícias.</p>
        </CardContent>
      </Card>
    );
  }

  const noticias = items ?? [];

  if (noticias.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notícias NTC</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nenhuma notícia disponível no momento.</p>
        </CardContent>
      </Card>
    );
  }

  const ultimaAtualizacao = noticias[0]?.created_at;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">📰 Notícias do Portal NTC</h2>
        <span className="text-xs text-muted-foreground">
          Atualizado: {ultimaAtualizacao ? formatarData(ultimaAtualizacao) : '—'}
        </span>
      </div>

      <div className="space-y-3">
        {noticias.map((noticia) => {
          const relevanciaColor = getRelevanciaColor(noticia.relevance_score);
          const relevanciaLabel =
            (noticia.relevance_score ?? 0) >= 8
              ? 'Alta'
              : (noticia.relevance_score ?? 0) >= 5
                ? 'Média'
                : 'Baixa';

          return (
            <Card
              key={noticia.id}
              className={`border-l-4 ${(noticia.relevance_score ?? 0) >= 8 ? 'border-l-red-500' : 'border-l-blue-500'}`}
            >
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="text-3xl">📰</div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm leading-snug hover:text-primary transition-colors">
                        {noticia.title}
                      </h3>
                      <Badge
                        className={`${relevanciaColor.badge} text-white whitespace-nowrap text-xs`}
                      >
                        {relevanciaLabel}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">{noticia.summary}</p>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-block px-2 py-1 bg-muted text-xs rounded text-muted-foreground">
                          {noticia.source_name ?? noticia.source_type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatarData(noticia.created_at)}
                        </span>
                      </div>

                      {noticia.source_url && (
                        <a
                          href={noticia.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Ler mais <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
        <span>Fonte: agente de notícias (2x ao dia)</span>
        <a
          href="https://www.portalntc.org.br/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Ver todas as notícias →
        </a>
      </div>
    </div>
  );
}
