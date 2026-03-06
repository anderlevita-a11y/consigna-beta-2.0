export interface Profile {
  id: string;
  nome: string;
  cpf?: string;
  whatsapp?: string;
  email?: string;
  role?: string;
  plan?: string;
  access_key_id?: string;
  access_key_code?: string;
  vencimento?: string;
  status_pagamento?: string;
  is_blocked?: boolean;
  pix_key?: string;
  pix_beneficiary?: string;
}

export interface AccessKey {
  id: string;
  code: string;
  plan: string;
  status: string;
  generated_by: string;
  recipient_name?: string;
  used_by?: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  label_name?: string;
  ean?: string;
  cost_price: number;
  sale_price: number;
  current_stock: number;
  photo_url?: string;
  user_id?: string;
  has_grid?: boolean;
}

export interface Customer {
  id: string;
  nome: string;
  cpf?: string;
  birth_date?: string;
  gender?: string;
  nationality?: string;
  naturalness?: string;
  instagram?: string;
  whatsapp?: string;
  document_photo_url?: string;
  cep?: string;
  logradouro?: string;
  bairro?: string;
  address_number?: string;
  cidade?: string;
  estado?: string;
  residence_proof_url?: string;
  latitude?: number;
  longitude?: number;
  user_id: string;
  status: 'active' | 'inactive';
}

export interface Bag {
  id: string;
  bag_number: string;
  customer_id?: string;
  campaign_id?: string;
  reseller_name?: string;
  status: string;
  total_value: number;
  total_items: number;
  payment_status: string;
  received_amount?: number;
  created_at: string;
  customer?: Customer;
}

export interface BagItem {
  id: string;
  bag_id: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  returned_quantity: number;
  unit_price: number;
  color?: string;
  size?: string;
}

export interface Sweepstakes {
  id: string;
  user_id: string;
  name: string;
  draw_date: string;
  voucher_value: number;
  prizes_count: number;
  objective: string;
  prizes_list: string;
  rules: string;
  status: 'pending' | 'completed';
  created_at: string;
}

export interface SweepstakesParticipant {
  id: string;
  sweepstakes_id: string;
  name: string;
  contact: string;
  paid_amount: number;
  coupons_count: number;
  status: 'active' | 'winner';
  created_at: string;
}

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  customer_ids: string[];
  created_at: string;
  updated_at: string;
  discount_pct: number;
  return_date?: string;
  status: string;
}

export interface Route {
  id: string;
  name: string;
  campaign_id?: string;
  user_id: string;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  stops?: RouteStop[];
}

export interface RouteStop {
  id: string;
  route_id: string;
  customer_id: string;
  order_index: number;
  status: 'pending' | 'visited' | 'skipped';
  customer?: Customer;
}

export interface CommissionSimulation {
  id: string;
  user_id: string;
  description: string;
  total_value: number;
  commission_pct: number;
  commission_value: number;
  liquid_value: number;
  created_at: string;
}
