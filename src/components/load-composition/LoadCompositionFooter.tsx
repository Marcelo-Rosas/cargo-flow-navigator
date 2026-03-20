/**
 * Shared footer/help text for load composition feature.
 * Aligned to real business semantics: embarcador + janela operacional + aderência ao trajeto.
 */

export interface LoadCompositionFooterProps {
  /** 'panel' shows full block, 'overlay' shows compact line */
  layout?: 'panel' | 'overlay';
}

export function LoadCompositionFooter({ layout = 'panel' }: LoadCompositionFooterProps) {
  if (layout === 'overlay') {
    return (
      <p className="text-xs text-muted-foreground pt-3 border-t">
        Sugestões agrupam cotações do mesmo embarcador dentro da janela de carregamento. Viabilidade
        = aderência da parada ao trajeto principal + capacidade de peso.
      </p>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
      <p>
        A análise compara cotações do mesmo embarcador dentro da janela operacional de carregamento.
        A viabilidade é determinada pela aderência da parada intermediária ao corredor natural da
        rota principal, não por desvio genérico de km.
      </p>
      <p className="text-blue-600">
        Gatilhos: automático ao salvar cotação (Auto) • sob demanda pelo painel (Batch) • seleção
        manual de cotações (Manual).
      </p>
    </div>
  );
}
