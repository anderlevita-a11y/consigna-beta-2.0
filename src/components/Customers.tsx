import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Search, 
  User,
  Mail,
  Phone,
  MapPin,
  MoreHorizontal,
  Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Customer } from '../types';
import { CustomerForm } from './CustomerForm';
import { cn } from '../lib/utils';

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>();

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .limit(30000);

      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSave = () => {
    setIsAdding(false);
    setEditingCustomer(undefined);
    fetchCustomers();
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsAdding(true);
  };

  if (isAdding) {
    return <CustomerForm customer={editingCustomer} onClose={() => { setIsAdding(false); setEditingCustomer(undefined); }} onSave={handleSave} />;
  }

  const filteredCustomers = customers.filter(c => 
    c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.whatsapp?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-800">Clientes</h2>
          <p className="text-sm text-zinc-500">Gerencie sua rede de vendedores e clientes.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center justify-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Novo Cliente
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
        <input 
          type="text" 
          placeholder="Buscar por nome ou whatsapp..." 
          className="w-full bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-3 text-zinc-800 focus:outline-none focus:border-emerald-500 transition-colors shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-zinc-400 flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            Carregando clientes...
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-zinc-500">Nenhum cliente encontrado.</div>
        ) : (
          filteredCustomers.map((customer) => (
            <div key={customer.id} className="bg-white border border-zinc-200 rounded-2xl p-6 hover:border-emerald-500/30 transition-all group shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                    <User className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-zinc-800 font-bold">{customer.nome}</h4>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">CPF: {customer.cpf || 'Não informado'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleEdit(customer)}
                    className="p-2 hover:bg-zinc-50 rounded-lg transition-colors text-zinc-400 hover:text-emerald-600"
                    title="Editar Cliente"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Phone className="w-4 h-4 text-zinc-400" />
                  <span>{customer.whatsapp || 'Sem whatsapp'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <MapPin className="w-4 h-4 text-zinc-400" />
                  <span className="truncate">{customer.logradouro ? `${customer.logradouro}, ${customer.bairro || ''}` : 'Sem endereço'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <MapPin className="w-4 h-4 opacity-0" />
                  <span className="truncate">{customer.cidade || ''} - {customer.estado || ''}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 uppercase">Status</span>
                <span className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                  customer.status === 'active' ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-400"
                )}>
                  {customer.status === 'active' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
