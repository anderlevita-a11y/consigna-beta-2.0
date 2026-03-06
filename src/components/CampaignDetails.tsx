import React, { useEffect, useState } from 'react';
import { 
  ChevronLeft, 
  Plus, 
  X, 
  Printer, 
  Megaphone, 
  Undo2, 
  Trash2, 
  FileText,
  Loader2,
  Save
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Campaign, Bag } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

import { BagSettlement } from './BagSettlement';

interface CampaignDetailsProps {
  campaign: Campaign;
  onBack: () => void;
  onAddBag: () => void;
}

export function CampaignDetails({ campaign, onBack, onAddBag }: CampaignDetailsProps) {
  const [bags, setBags] = useState<Bag[]>([]);
  const [loading, setLoading] = useState(true);
  const [settlingBag, setSettlingBag] = useState<Bag | null>(null);

  useEffect(() => {
    fetchBags();
  }, [campaign.id]);

  async function fetchBags() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bags')
        .select('*, customer:customers(nome)')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false })
        .limit(30000);

      if (error) throw error;
      setBags(data || []);
    } catch (err) {
      console.error('Error fetching bags for campaign:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSettlementSave = () => {
    setSettlingBag(null);
    fetchBags();
  };

  if (settlingBag) {
    return (
      <BagSettlement 
        bag={settlingBag} 
        onClose={() => setSettlingBag(null)} 
        onSave={handleSettlementSave}
      />
    );
  }

  const handleWhatsAppShare = async (bag: Bag) => {
    try {
      const { data: items } = await supabase
        .from('bag_items')
        .select('*, product:products(name)')
        .eq('bag_id', bag.id)
        .limit(30000);

      if (!items) return;

      const customerName = bag.customer?.nome || 'Cliente';
      let message = `*Resumo da Sacola #${bag.bag_number.replace(/\D/g, '')}*\n`;
      message += `Cliente: ${customerName}\n`;
      message += `Data: ${format(new Date(bag.created_at), "dd/MM/yyyy")}\n\n`;
      message += `*Itens:*\n`;
      
      items.forEach(item => {
        const productName = item.product?.name || item.product_name;
        const subtotal = item.quantity * item.unit_price;
        message += `- ${productName}\n  ${item.quantity} un x R$ ${item.unit_price.toFixed(2)} = *R$ ${subtotal.toFixed(2)}*\n`;
      });
      
      message += `\n*Total da Sacola: R$ ${bag.total_value.toFixed(2)}*`;
      
      if (bag.received_amount && bag.received_amount > 0) {
        message += `\nValor Pago: R$ ${bag.received_amount.toFixed(2)}`;
        const debt = bag.total_value - bag.received_amount;
        if (debt > 0) {
          message += `\n*Saldo Devedor: R$ ${debt.toFixed(2)}*`;
        }
      }
      
      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    } catch (err) {
      console.error('Error sharing on WhatsApp:', err);
    }
  };

  const handleMoveBag = async (bag: Bag) => {
    const newCampaignName = prompt('Digite o nome da nova campanha:');
    if (!newCampaignName) return;

    try {
      // Find or create campaign
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('id')
        .eq('name', newCampaignName)
        .single();

      let targetCampaignId = campaignData?.id;

      if (!targetCampaignId) {
        const { data: newCamp } = await supabase
          .from('campaigns')
          .insert({ name: newCampaignName, status: 'active', discount_pct: 0 })
          .select()
          .single();
        targetCampaignId = newCamp?.id;
      }

      if (targetCampaignId) {
        await supabase
          .from('bags')
          .update({ campaign_id: targetCampaignId })
          .eq('id', bag.id);
        
        fetchBags();
        alert('Sacola movida com sucesso!');
      }
    } catch (err) {
      console.error('Error moving bag:', err);
      alert('Erro ao mover sacola');
    }
  };

  const handleArchiveBag = async (bagId: string) => {
    if (!confirm('Deseja arquivar esta sacola?')) return;
    
    try {
      const { error } = await supabase
        .from('bags')
        .update({ status: 'archived' })
        .eq('id', bagId);

      if (error) throw error;
      fetchBags();
    } catch (err) {
      console.error('Error archiving bag:', err);
      alert('Erro ao arquivar sacola');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'closed':
        return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-[10px] font-bold uppercase">Acertada</span>;
      case 'open':
        return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-[10px] font-bold uppercase">Aberta</span>;
      case 'archived':
        return <span className="bg-zinc-100 text-zinc-500 px-3 py-1 rounded-lg text-[10px] font-bold uppercase">Arquivada</span>;
      default:
        return <span className="bg-zinc-100 text-zinc-500 px-3 py-1 rounded-lg text-[10px] font-bold uppercase">{status}</span>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 transition-colors font-medium"
        >
          <X className="w-5 h-5" />
          Voltar para Campanhas
        </button>
        <button 
          onClick={onAddBag}
          className="flex items-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-5 h-5" />
          Nova Sacola
        </button>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-zinc-50/30 border-b border-zinc-100">
                <th className="px-8 py-5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nº Sacola</th>
                <th className="px-8 py-5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Cliente / Revendedora</th>
                <th className="px-8 py-5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Itens / Valor</th>
                <th className="px-8 py-5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-5 text-[10px] font-bold text-zinc-800 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
                  </td>
                </tr>
              ) : bags.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-zinc-400 italic">
                    Nenhuma sacola cadastrada nesta campanha.
                  </td>
                </tr>
              ) : (
                bags.map((bag) => (
                  <tr key={bag.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <span className="text-emerald-600 font-bold">#{bag.bag_number.replace(/\D/g, '')}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div>
                        <p className="font-bold text-zinc-800">{bag.customer?.nome || 'Sem Cliente'}</p>
                        <p className="text-[10px] text-zinc-400">Rev: {bag.reseller_name || '-'}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div>
                        <p className="font-bold text-zinc-800">{bag.total_items} itens</p>
                        <p className="text-[10px] text-zinc-400">R$ {bag.total_value.toFixed(2)}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {getStatusBadge(bag.status)}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => setSettlingBag(bag)}
                          className="p-2 text-zinc-300 hover:text-emerald-600 transition-colors"
                          title="Acertar"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-2 text-zinc-300 hover:text-zinc-600 transition-colors"
                          title="Imprimir Nota"
                          onClick={() => window.print()}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-2 text-zinc-300 hover:text-zinc-600 transition-colors"
                          title="Compartilhar WhatsApp"
                          onClick={() => handleWhatsAppShare(bag)}
                        >
                          <Megaphone className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-2 text-zinc-300 hover:text-zinc-600 transition-colors"
                          title="Mover para outra campanha"
                          onClick={() => handleMoveBag(bag)}
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-2 text-zinc-300 hover:text-red-500 transition-colors"
                          title="Arquivar Sacola"
                          onClick={() => handleArchiveBag(bag.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
