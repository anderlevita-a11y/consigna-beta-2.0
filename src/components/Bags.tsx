import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Search, 
  ShoppingBag,
  Calendar,
  User,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  X,
  Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Bag, Customer } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BagForm } from './BagForm';
import { BagSettlement } from './BagSettlement';

export function Bags() {
  const [bags, setBags] = useState<Bag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedBag, setSelectedBag] = useState<Bag | null>(null);
  const [assigningBag, setAssigningBag] = useState<Bag | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!showForm && !selectedBag && !assigningBag) {
      fetchBags();
    }
  }, [showForm, selectedBag, assigningBag]);

  useEffect(() => {
    if (assigningBag) {
      fetchCustomers();
    }
  }, [assigningBag]);

  async function fetchCustomers() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('customers')
        .select('id, nome, cpf, user_id, status')
        .eq('user_id', user.id)
        .order('nome');
      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  }

  const handleAssignCustomer = async (customerId: string) => {
    if (!assigningBag) return;
    setAssigning(true);
    try {
      const { error } = await supabase
        .from('bags')
        .update({ customer_id: customerId })
        .eq('id', assigningBag.id);
      
      if (error) throw error;
      setAssigningBag(null);
      fetchBags();
    } catch (err) {
      console.error('Error assigning customer:', err);
      alert('Erro ao atribuir cliente');
    } finally {
      setAssigning(false);
    }
  };

  async function fetchBags() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('bags')
        .select('*, customer:customers(nome)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30000);

      if (error) throw error;
      setBags(data || []);
    } catch (err) {
      console.error('Error fetching bags:', err);
    } finally {
      setLoading(false);
    }
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'sent':
        return { label: 'Enviada', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Clock };
      case 'returned':
        return { label: 'Retornada', color: 'text-purple-400', bg: 'bg-purple-500/10', icon: Calendar };
      case 'closed':
        return { label: 'Finalizada', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 };
      default:
        return { label: 'Aberta', color: 'text-zinc-400', bg: 'bg-zinc-500/10', icon: AlertCircle };
    }
  };

  if (showForm) {
    return <BagForm onClose={() => setShowForm(false)} onSave={() => setShowForm(false)} />;
  }

  if (selectedBag) {
    return <BagSettlement bag={selectedBag} onClose={() => setSelectedBag(null)} onSave={() => setSelectedBag(null)} />;
  }

  const filteredCustomers = customerSearch
    ? customers.filter(c => c.nome.toLowerCase().includes(customerSearch.toLowerCase()) || c.cpf?.includes(customerSearch)).slice(0, 10)
    : [];

  const displayedBags = bags.slice(0, 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800">Acertos (Malas)</h2>
          <p className="text-zinc-500">Controle as malas em consignação.</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Nova Mala
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-zinc-500">Carregando malas...</div>
        ) : displayedBags.length === 0 ? (
          <div className="col-span-full py-12 text-center text-zinc-500">Nenhuma mala encontrada.</div>
        ) : (
          <>
            {displayedBags.map((bag) => {
              const status = getStatusInfo(bag.status);
              const StatusIcon = status.icon;
              
              return (
                <div key={bag.id} 
                  onClick={() => setSelectedBag(bag)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-all group cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                        <ShoppingBag className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold">Mala {bag.bag_number}</h4>
                        <p className="text-xs text-zinc-500">Criada em {format(new Date(bag.created_at), "dd 'de' MMM", { locale: ptBR })}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                      status.bg,
                      status.color
                    )}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {status.label}
                    </span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <User className="w-4 h-4" />
                        <span>{bag.customer?.nome || bag.reseller_name || 'Sem Cliente'}</span>
                      </div>
                      {!bag.customer_id && bag.status === 'open' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssigningBag(bag);
                          }}
                          className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded-lg transition-colors"
                          title="Atribuir Cliente"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500">Valor Total</span>
                      <span className="text-lg font-bold text-white">R$ {bag.total_value?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-emerald-400 text-sm font-medium group-hover:text-emerald-300 transition-colors">
                    Ver Detalhes
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              );
            })}
            {bags.length > 100 && (
              <div className="col-span-full py-4 text-center text-xs text-zinc-500 bg-zinc-50 rounded-xl">
                Mostrando as primeiras 100 malas de {bags.length}.
              </div>
            )}
          </>
        )}
      </div>

      {/* Assign Customer Modal */}
      {assigningBag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 w-full max-w-md rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Atribuir Cliente à Mala {assigningBag.bag_number}</h3>
              <button onClick={() => setAssigningBag(null)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Buscar cliente..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none"
                />
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filteredCustomers.map(c => (
                  <button 
                    key={c.id}
                    onClick={() => handleAssignCustomer(c.id)}
                    disabled={assigning}
                    className="w-full flex items-center justify-between p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl border border-zinc-700/50 transition-all text-left"
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{c.nome}</p>
                      <p className="text-[10px] text-zinc-500">CPF: {c.cpf || '---'}</p>
                    </div>
                    {assigning ? <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> : <ChevronRight className="w-4 h-4 text-zinc-600" />}
                  </button>
                ))}
                {customerSearch && filteredCustomers.length === 0 && (
                  <p className="text-center py-4 text-zinc-500 text-sm">Nenhum cliente encontrado.</p>
                )}
                {!customerSearch && (
                  <p className="text-center py-4 text-zinc-500 text-sm italic">Digite para buscar clientes.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
