import {
  ClipboardCheck,
  MapPinned,
  Package,
  Receipt,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

export interface QuoteWizardStepConfig {
  id: string;
  label: string;
  shortLabel: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const QUOTE_WIZARD_STEPS: QuoteWizardStepConfig[] = [
  {
    id: 'identification',
    label: 'Identificação',
    shortLabel: 'Quem e rota',
    title: 'Quem participa e qual o trajeto',
    description: 'Cliente, embarcador, CEPs e distância. Base para precificar e seguro.',
    icon: MapPinned,
  },
  {
    id: 'cargo',
    label: 'Carga e logística',
    shortLabel: 'Carga',
    title: 'Carga, tabela e prazos',
    description: 'Peso, modalidade, tabela de preço e condição de pagamento do cliente.',
    icon: Package,
  },
  {
    id: 'pricing',
    label: 'Composição financeira',
    shortLabel: 'Valores',
    title: 'Composição financeira',
    description: 'Custos, piso ANTT, taxas e memória do frete ALL-IN.',
    icon: Receipt,
  },
  {
    id: 'insurance',
    label: 'Seguro',
    shortLabel: 'Seguro',
    title: 'Seguro e gerenciamento de risco',
    description: 'Cobertura Buonny conforme políticas da rota e valor da carga.',
    icon: ShieldCheck,
  },
  {
    id: 'review',
    label: 'Revisão',
    shortLabel: 'Revisão',
    title: 'Revisão antes de salvar',
    description: 'Confira resumo comercial e valores antes de criar ou atualizar a cotação.',
    icon: ClipboardCheck,
  },
];
