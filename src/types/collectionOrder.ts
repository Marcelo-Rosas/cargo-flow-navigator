import type { Database } from '@/integrations/supabase/types.generated';

export type CollectionOrderRow = Database['public']['Tables']['collection_orders']['Row'];
export type CollectionOrderStatus = Database['public']['Enums']['collection_order_status'];

export interface CollectionOrderPartyData {
  name: string;
  cnpj: string | null;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;
}

export interface CollectionOrderDriverData {
  name: string;
  cpf: string | null;
  cnh: string | null;
  antt: string | null;
  phone: string | null;
}

export interface CollectionOrderVehicleData {
  plate: string | null;
  trailer_plate: string | null;
  vehicle_type: string | null;
  brand: string | null;
  model: string | null;
}

export interface CollectionOrderCargoData {
  weight_kg: number | null;
  volume_m3: number | null;
  cargo_value: number | null;
  cargo_type: string | null;
}

/** Snapshot do resultado da consulta ANTT (RNTRC) no momento da emissao da OC */
export interface CollectionOrderAnttData {
  /** regular | irregular | indeterminado */
  situacao: string | null;
  /** ATIVO | VENCIDO | CANCELADO */
  situacao_raw: string | null;
  /** TAC | ETC */
  rntrc_registry_type: 'TAC' | 'ETC' | null;
  /** numero RNTRC */
  rntrc: string | null;
  /** nome do transportador conforme cadastro ANTT */
  transportador: string | null;
  /** CPF/CNPJ mascarado */
  cpf_cnpj_mask: string | null;
  cadastrado_desde: string | null;
  municipio_uf: string | null;
  /** apto a realizar transporte conforme portal ANTT */
  apto: boolean | null;
  /** veiculo esta na frota do transportador (operation='veiculo') */
  veiculo_na_frota: boolean | null;
  /** URL do comprovante/certidao gerado pelo portal */
  comprovante_url: string | null;
  /** timestamp da consulta */
  checked_at: string | null;
}

/** Snapshot tipado retornado em CollectionOrderRow.{sender,recipient,...}_data */
export type CollectionOrder = Omit<
  CollectionOrderRow,
  'sender_data' | 'recipient_data' | 'driver_data' | 'vehicle_data' | 'cargo_data'
> & {
  sender_data: CollectionOrderPartyData;
  recipient_data: CollectionOrderPartyData;
  driver_data: CollectionOrderDriverData;
  vehicle_data: CollectionOrderVehicleData;
  cargo_data: CollectionOrderCargoData;
  /** ANTT snapshot — coluna nullable adicionada na migration de dados ANTT */
  antt_data: CollectionOrderAnttData | null;
};
