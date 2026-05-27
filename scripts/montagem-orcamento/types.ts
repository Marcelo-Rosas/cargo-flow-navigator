export type MontagemRow = {
  code: string;
  description: string;
  qty: number;
  unit: number;
};

export type MontagemSection = {
  title: string;
  rows: MontagemRow[];
};

export type MontagemSummaryLine = {
  label: string;
  qty: number;
  total: number;
};

export type MontagemExcludedItem = {
  code: string;
  description: string;
  reason: string;
};

export type MontagemOrcamento = {
  clientName: string;
  sections: MontagemSection[];
  summary: MontagemSummaryLine[];
  excluded?: MontagemExcludedItem[];
  /** Slug para nome de arquivo (ex.: corpus-quality) */
  outputSlug?: string;
};
