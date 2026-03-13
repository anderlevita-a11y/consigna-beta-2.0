import React, { useEffect, useState } from 'react';
import { 
  ChevronLeft, 
  Plus, 
  X, 
  Printer, 
  Megaphone, 
  Undo2, 
  FileText,
  Loader2,
  Save,
  UserPlus,
  Search,
  RefreshCcw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Campaign, Bag, Customer } from '../types';
import { cn, printFallback } from '../lib/utils';
import { format } from 'date-fns';
import { ConfirmationModal } from './ConfirmationModal';
import { PromptModal } from './PromptModal';
import { PrintPreview } from './PrintPreview';

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
  const [assigningBag, setAssigningBag] = useState<Bag | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [movingBag, setMovingBag] = useState<Bag | null>(null);
  const [availableCampaigns, setAvailableCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [printing, setPrinting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [previewType, setPreviewType] = useState<'termica' | 'a4' | 'etiqueta'>('termica');

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'info'
  });

  // Prompt Modal State
  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (value: string) => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    fetchBags();
  }, [campaign.id]);

  useEffect(() => {
    if (assigningBag) {
      fetchCustomers();
    }
  }, [assigningBag]);

  async function fetchCustomers() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
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
        .select('*')
        .eq('bag_id', bag.id)
        .limit(30000);

      if (!items) return;

      const customerName = bag.customer?.nome || 'Cliente';
      let message = `*Resumo da Sacola #${bag.bag_number.replace(/\D/g, '')}*\n`;
      message += `Cliente: ${customerName}\n`;
      message += `Data: ${format(new Date(bag.created_at), "dd/MM/yyyy")}\n\n`;
      message += `*Itens:*\n`;
      
      let totalValue = 0;
      items.forEach(item => {
        const productName = item.product?.name || item.product_name;
        const sold = item.quantity - (item.returned_quantity || 0);
        if (sold > 0) {
          const subtotal = sold * item.unit_price;
          totalValue += subtotal;
          message += `- ${productName}\n  ${sold} un x R$ ${item.unit_price.toFixed(2)}\n`;
        }
      });
      
      const discountPct = campaign.discount_pct || 0;
      const discountAmount = totalValue * (discountPct / 100);
      const finalAmount = totalValue - discountAmount;

      message += `\nSubtotal: R$ ${totalValue.toFixed(2)}`;
      message += `\nDesconto Campanha (${discountPct}%): R$ ${discountAmount.toFixed(2)}`;
      message += `\n*Total a Pagar: R$ ${finalAmount.toFixed(2)}*`;
      
      if (bag.received_amount && bag.received_amount > 0) {
        message += `\nValor Pago: R$ ${bag.received_amount.toFixed(2)}`;
        const debt = finalAmount - bag.received_amount;
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

  const handlePrintBag = async (bag: Bag) => {
    setPrinting(true);
    try {
      const { data: bagItemsData, error: bagItemsError } = await supabase
        .from('bag_items')
        .select('*')
        .eq('bag_id', bag.id);

      if (bagItemsError) throw bagItemsError;

      const payload = {
        tipo_documento: 'nota_servico',
        dados_cliente: {
          nome: bag.customer?.nome || 'Cliente',
          cpf: '---'
        },
        itens: (bagItemsData || []).map(item => ({
          nome: item.product_name || 'Produto',
          qtd: item.quantity - (item.returned_quantity || 0),
          preco: item.unit_price,
          total: (item.quantity - (item.returned_quantity || 0)) * item.unit_price
        })).filter(i => i.qtd > 0)
      };

      const { data, error: functionError } = await supabase.functions.invoke('generate-pdf', {
        body: payload
      });

      if (functionError) throw functionError;
      
      setPdfUrl(data.url);
      setPreviewType('termica');
      setShowPreview(true);
    } catch (err: any) {
      console.warn('Edge Function (generate-pdf) not available, using fallback print:', err.message);
      
      // Fallback to simple print if Edge Function is not reachable or any error occurs
      try {
        const { data: bagItemsData } = await supabase.from('bag_items').select('*').eq('bag_id', bag.id);
        const payload = {
          tipo_documento: 'nota_servico',
          dados_cliente: { nome: bag.customer?.nome || 'Cliente', cpf: '---' },
          itens: (bagItemsData || []).map(item => ({
            nome: item.product_name || 'Produto',
            qtd: item.quantity - (item.returned_quantity || 0),
            preco: item.unit_price,
            total: (item.quantity - (item.returned_quantity || 0)) * item.unit_price
          })).filter(i => i.qtd > 0)
        };
        printFallback(payload);
      } catch (fallbackErr) {
        console.error('Fallback print failed:', fallbackErr);
      }
    } finally {
      setPrinting(false);
    }
  };

  const handleMoveBag = async (bag: Bag) => {
    setMovingBag(bag);
    setLoadingCampaigns(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .neq('id', campaign.id)
        .order('name');

      if (error) throw error;
      setAvailableCampaigns(data || []);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const executeMoveBag = async (targetCampaignId: string) => {
    if (!movingBag) return;
    setAssigning(true);
    try {
      const { error } = await supabase
        .from('bags')
        .update({ campaign_id: targetCampaignId })
        .eq('id', movingBag.id);
      
      if (error) throw error;
      setMovingBag(null);
      fetchBags();
      alert('Sacola movida com sucesso!');
    } catch (err) {
      console.error('Error moving bag:', err);
      alert('Erro ao mover sacola');
    } finally {
      setAssigning(false);
    }
  };

  const handleReopenBag = (bag: Bag) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reabrir Sacola',
      message: 'Deseja reabrir esta sacola? Os itens devolvidos serão removidos do estoque novamente.',
      variant: 'warning',
      onConfirm: async () => {
        try {
          // 1. Fetch bag items
          const { data: items, error: itemsError } = await supabase
            .from('bag_items')
            .select('*')
            .eq('bag_id', bag.id);
            
          if (itemsError) throw itemsError;

          // 2. Revert stock and reset returned_quantity
          let totalGross = 0;
          for (const item of items || []) {
            totalGross += item.quantity * item.unit_price;
            
            if (item.returned_quantity > 0) {
              // Get current stock
              const { data: product } = await supabase
                .from('products')
                .select('current_stock')
                .eq('id', item.product_id)
                .single();
                
              if (product) {
                // Decrement stock by returned_quantity
                await supabase
                  .from('products')
                  .update({ current_stock: Math.max(0, (product.current_stock || 0) - item.returned_quantity) })
                  .eq('id', item.product_id);
              }
              
              // Reset returned_quantity
              await supabase
                .from('bag_items')
                .update({ returned_quantity: 0 })
                .eq('id', item.id);
            }
          }

          // 3. Update bag status
          const { error: bagError } = await supabase
            .from('bags')
            .update({ 
              status: 'open',
              payment_status: 'pending',
              total_value: totalGross
            })
            .eq('id', bag.id);

          if (bagError) throw bagError;
          
          fetchBags();
        } catch (err) {
          console.error('Error reopening bag:', err);
          alert('Erro ao reabrir sacola');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
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

  const filteredCustomers = customerSearch
    ? customers.filter(c => c.nome.toLowerCase().includes(customerSearch.toLowerCase()) || String(c.cpf || '').includes(customerSearch)).slice(0, 10)
    : [];

  const filteredCampaigns = campaignSearch
    ? availableCampaigns.filter(c => c.name.toLowerCase().includes(campaignSearch.toLowerCase()))
    : availableCampaigns;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <button 
          onClick={onBack}
          className="flex items-center justify-center gap-2 text-zinc-500 hover:text-zinc-800 transition-all active:scale-95 font-medium bg-zinc-100 sm:bg-transparent py-3 sm:py-0 rounded-xl sm:rounded-none w-full sm:w-auto"
        >
          <X className="w-5 h-5" />
          Voltar para Campanhas
        </button>
        <button 
          onClick={onAddBag}
          className="flex items-center justify-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-6 py-3 sm:py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-emerald-500/20 w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          Nova Sacola
        </button>
      </div>

      {/* Legenda de Ações */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-4 flex flex-wrap gap-6 items-center shadow-sm">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Legenda de Ações:</span>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <div className="p-1.5 bg-zinc-50 rounded-lg text-emerald-600">
            <UserPlus className="w-3.5 h-3.5" />
          </div>
          <span>Atribuir Cliente</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <div className="p-1.5 bg-zinc-50 rounded-lg text-emerald-600">
            <Save className="w-3.5 h-3.5" />
          </div>
          <span>Acertar Sacola</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <div className="p-1.5 bg-zinc-50 rounded-lg text-amber-500">
            <RefreshCcw className="w-3.5 h-3.5" />
          </div>
          <span>Reabrir Sacola</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <div className="p-1.5 bg-zinc-50 rounded-lg text-zinc-600">
            <Printer className="w-3.5 h-3.5" />
          </div>
          <span>Imprimir Nota</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <div className="p-1.5 bg-zinc-50 rounded-lg text-zinc-600">
            <Megaphone className="w-3.5 h-3.5" />
          </div>
          <span>Compartilhar WhatsApp</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <div className="p-1.5 bg-zinc-50 rounded-lg text-zinc-600">
            <Undo2 className="w-3.5 h-3.5" />
          </div>
          <span>Mover Campanha</span>
        </div>
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
                <>
                  {bags.slice(0, 100).map((bag) => (
                    <tr key={bag.id} className="hover:bg-zinc-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <span className="text-emerald-600 font-bold">#{bag.bag_number.replace(/\D/g, '')}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-zinc-800">{bag.customer?.nome || 'Sem Cliente'}</p>
                            <p className="text-[10px] text-zinc-400">Rev: {bag.reseller_name || '-'}</p>
                          </div>
                          {!bag.customer_id && bag.status === 'open' && (
                            <button 
                              onClick={() => setAssigningBag(bag)}
                              className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-emerald-600 rounded-lg transition-colors"
                              title="Atribuir Cliente"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          )}
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
                        <div className="flex items-center justify-end gap-2">
                          {bag.status === 'open' && (
                            <button 
                              onClick={() => setSettlingBag(bag)}
                              className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-95"
                              title="Acertar"
                            >
                              <Save className="w-4.5 h-4.5" />
                            </button>
                          )}
                          {bag.status === 'closed' && (
                            <button 
                              onClick={() => handleReopenBag(bag)}
                              className="p-2.5 text-amber-500 hover:bg-amber-50 rounded-xl transition-all active:scale-95"
                              title="Reabrir Sacola"
                            >
                              <RefreshCcw className="w-4.5 h-4.5" />
                            </button>
                          )}
                          <button 
                            className="p-2.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                            title="Imprimir Nota"
                            onClick={() => handlePrintBag(bag)}
                            disabled={printing}
                          >
                            {printing ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Printer className="w-4.5 h-4.5" />}
                          </button>
                          <button 
                            className="p-2.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 rounded-xl transition-all active:scale-95"
                            title="Compartilhar WhatsApp"
                            onClick={() => handleWhatsAppShare(bag)}
                          >
                            <Megaphone className="w-4.5 h-4.5" />
                          </button>
                          <button 
                            className="p-2.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 rounded-xl transition-all active:scale-95"
                            title="Mover para outra campanha"
                            onClick={() => handleMoveBag(bag)}
                          >
                            <Undo2 className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {bags.length > 100 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-4 text-center text-xs text-zinc-500 bg-zinc-50">
                        Mostrando as primeiras 100 sacolas de {bags.length}.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

      <PromptModal
        isOpen={promptModal.isOpen}
        title={promptModal.title}
        message={promptModal.message}
        onConfirm={promptModal.onConfirm}
        onCancel={() => setPromptModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Assign Customer Modal */}
      {assigningBag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-800">Atribuir Cliente à Mala {assigningBag.bag_number}</h3>
              <button onClick={() => setAssigningBag(null)} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400">
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
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-800 focus:border-emerald-500 outline-none"
                />
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filteredCustomers.map(c => (
                  <button 
                    key={c.id}
                    onClick={() => handleAssignCustomer(c.id)}
                    disabled={assigning}
                    className="w-full flex items-center justify-between p-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl border border-zinc-100 transition-all text-left"
                  >
                    <div>
                      <p className="text-sm font-bold text-zinc-800">{c.nome}</p>
                      <p className="text-[10px] text-zinc-400">CPF: {c.cpf || '---'}</p>
                    </div>
                    {assigning ? <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> : <ChevronLeft className="w-4 h-4 text-zinc-300 rotate-180" />}
                  </button>
                ))}
                {customerSearch && filteredCustomers.length === 0 && (
                  <p className="text-center py-4 text-zinc-400 text-sm">Nenhum cliente encontrado.</p>
                )}
                {!customerSearch && (
                  <p className="text-center py-4 text-zinc-400 text-sm italic">Digite para buscar clientes.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move Bag Modal */}
      {movingBag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-800">Mover Sacola {movingBag.bag_number}</h3>
              <button onClick={() => setMovingBag(null)} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-zinc-500">Selecione a campanha de destino para esta sacola:</p>
              
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Buscar campanha..."
                  value={campaignSearch}
                  onChange={(e) => setCampaignSearch(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-800 focus:border-emerald-500 outline-none"
                />
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {loadingCampaigns ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  </div>
                ) : filteredCampaigns.length > 0 ? (
                  filteredCampaigns.map(c => (
                    <button 
                      key={c.id}
                      onClick={() => executeMoveBag(c.id)}
                      disabled={assigning}
                      className="w-full flex items-center justify-between p-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl border border-zinc-100 transition-all text-left"
                    >
                      <div>
                        <p className="text-sm font-bold text-zinc-800">{c.name}</p>
                        <p className="text-[10px] text-zinc-400">Criada em: {format(new Date(c.created_at), "dd/MM/yyyy")}</p>
                      </div>
                      {assigning ? <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> : <ChevronLeft className="w-4 h-4 text-zinc-300 rotate-180" />}
                    </button>
                  ))
                ) : (
                  <p className="text-center py-4 text-zinc-400 text-sm">Nenhuma campanha encontrada.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <PrintPreview 
          pdfUrl={pdfUrl} 
          tipo={previewType} 
          onClose={() => setShowPreview(false)} 
        />
      )}
    </div>
  );
}
