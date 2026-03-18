import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import newsData from '@/data/ntc_news_latest.json';

interface Noticia {
  id: string;
  titulo: string;
  data: string;
  categoria: string;
  resumo: string;
  url: string;
  relevancia: 'alta' | 'media' | 'baixa';
  emoji: string;
  cor: string;
}

function getRelevanciaColor(relevancia: string) {
  switch (relevancia) {
    case 'alta':
      return { bg: 'bg-red-100', text: 'text-red-800', badge: 'bg-red-600' };
    case 'media':
      return { bg: 'bg-yellow-100', text: 'text-yellow-800', badge: 'bg-yellow-600' };
    case 'baixa':
      return { bg: 'bg-green-100', text: 'text-green-800', badge: 'bg-green-600' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800', badge: 'bg-gray-600' };
  }
}

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function NTCNewsWidget() {
  const noticias: Noticia[] = newsData.noticias;

  if (!noticias || noticias.length === 0) {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">📰 Notícias do Portal NTC</h2>
        <span className="text-xs text-muted-foreground">
          Atualizado: {formatarData(newsData.atualizado_em.split('T')[0])}
        </span>
      </div>

      <div className="space-y-3">
        {noticias.map((noticia) => {
          const relevanciaColor = getRelevanciaColor(noticia.relevancia);

          return (
            <Card key={noticia.id} className={`border-l-4 ${noticia.cor === 'red' ? 'border-l-red-500' : 'border-l-blue-500'}`}>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  {/* Emoji */}
                  <div className="text-3xl">{noticia.emoji}</div>

                  {/* Conteúdo */}
                  <div className="flex-1 space-y-2">
                    {/* Título e Categoria */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm leading-snug hover:text-primary transition-colors">
                        {noticia.titulo}
                      </h3>
                      <Badge className={`${relevanciaColor.badge} text-white whitespace-nowrap text-xs`}>
                        {noticia.relevancia === 'alta'
                          ? '🔴 Alta'
                          : noticia.relevancia === 'media'
                            ? '🟡 Média'
                            : '🟢 Baixa'}
                      </Badge>
                    </div>

                    {/* Resumo */}
                    <p className="text-xs text-muted-foreground line-clamp-2">{noticia.resumo}</p>

                    {/* Footer: Categoria, Data e Link */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-block px-2 py-1 bg-muted text-xs rounded text-muted-foreground">
                          {noticia.categoria}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatarData(noticia.data)}</span>
                      </div>

                      <a
                        href={noticia.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Ler mais <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
        <span>Próxima atualização: {formatarData(newsData.proxima_atualizacao.split('T')[0])} às 08:00</span>
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
