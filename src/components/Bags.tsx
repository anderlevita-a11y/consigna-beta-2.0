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
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Bag } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { BagForm } from './BagForm';

export function Bags() {
  const [bags, setBags] = useState<Bag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!showForm) {
      fetchBags();
    }
  }, [showForm]);

  async function fetchBags() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bags')
        .select('*, customer:customers(nome)')
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
        ) : bags.length === 0 ? (
          <div className="col-span-full py-12 text-center text-zinc-500">Nenhuma mala encontrada.</div>
        ) : (
          bags.map((bag) => {
            const status = getStatusInfo(bag.status);
            const StatusIcon = status.icon;
            
            return (
              <div key={bag.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-all group cursor-pointer">
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
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <User className="w-4 h-4" />
                    <span>{bag.customer?.nome || bag.reseller_name || 'Cliente não identificado'}</span>
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
          })
        )}
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
