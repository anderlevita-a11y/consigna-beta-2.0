import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Check, 
  Loader2, 
  Search, 
  QrCode,
  Save,
  Megaphone
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Bag, BagItem, Product, Profile } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface BagSettlementProps {
  bag: Bag;
  onClose: () => void;
  onSave: () => void;
}

interface SettlementItem extends BagItem {
  returned_quantity: number;
  product: Product;
}

export function BagSettlement({ bag, onClose, onSave }: BagSettlementProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<SettlementItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'pix' | 'cartao'>('pix');
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [searchProduct, setSearchProduct] = useState('');
  const [userProfile, setUserProfile] = useState<Profile | null>(null);

  useEffect(() => {
    fetchData();
  }, [bag.id]);

  async function fetchData() {
    try {
      // Fetch user profile for PIX details
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setUserProfile(profile);
      }

      const { data, error } = await supabase
        .from('bag_items')
        .select('*, product:products(*)')
        .eq('bag_id', bag.id)
        .limit(30000);

      if (error) throw error;
      
      const settlementItems = (data || []).map(item => ({
        ...item,
        returned_quantity: item.returned_quantity || 0,
        product: item.product || {
          id: item.product_id || '',
          name: item.product_name,
          sale_price: item.unit_price,
          current_stock: 0
        }
      }));
      
      setItems(settlementItems);
      
      // Calculate initial total to pay
      const totalToPay = settlementItems.reduce((acc, item) => {
        const sold = item.quantity - item.returned_quantity;
        return acc + (sold * item.product.sale_price);
      }, 0);
      
      setReceivedAmount(totalToPay);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }

  const updateReturnedQuantity = (itemId: string, qty: number) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const newReturned = Math.min(item.quantity, Math.max(0, qty));
        return { ...item, returned_quantity: newReturned };
      }
      return item;
    }));
  };

  const totalGross = items.reduce((acc, item) => acc + (item.quantity * item.product.sale_price), 0);
  const totalSold = items.reduce((acc, item) => {
    const sold = item.quantity - item.returned_quantity;
    return acc + (sold * item.product.sale_price);
  }, 0);
  
  const commissionRate = 0.3; // 30% as shown in image
  const commission = totalSold * commissionRate;
  const amountToPay = totalSold - commission;

  const handleFinalize = async () => {
    setSaving(true);
    try {
      // 1. Update bag items and return stock
      for (const item of items) {
        // Update bag item
        const { error: itemError } = await supabase
          .from('bag_items')
          .update({ returned_quantity: item.returned_quantity })
          .eq('id', item.id);
        
        if (itemError) throw itemError;

        // Return to stock if there are returned items
        if (item.returned_quantity > 0) {
          const { data: product } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', item.product.id)
            .single();
          
          if (product) {
            await supabase
              .from('products')
              .update({ current_stock: (product.current_stock || 0) + item.returned_quantity })
              .eq('id', item.product.id);
          }
        }
      }

      // 2. Update bag status and payment
      const { error: bagError } = await supabase
        .from('bags')
        .update({ 
          status: 'closed',
          total_value: totalSold,
          received_amount: receivedAmount,
          payment_status: receivedAmount >= amountToPay ? 'paid' : 'partial'
        })
        .eq('id', bag.id);

      if (bagError) throw bagError;
      
      onSave();
    } catch (err) {
      console.error('Error finalizing settlement:', err);
      alert('Erro ao finalizar acerto. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
  };

  const handleBarcodeReturn = (code: string) => {
    const item = items.find(i => i.product.ean === code || i.product.name.toLowerCase().includes(code.toLowerCase()));
    if (item) {
      updateReturnedQuantity(item.id, item.returned_quantity + 1);
      setSearchProduct('');
    }
  };

  const handleWhatsAppShare = async () => {
    try {
      const customerName = bag.customer?.nome || 'Cliente';
      let message = `*Resumo da Sacola #${bag.bag_number.replace(/\D/g, '')}*\n`;
      message += `Cliente: ${customerName}\n\n`;
      message += `*Itens:*\n`;
      
      items.forEach(item => {
        const sold = item.quantity - item.returned_quantity;
        if (sold > 0) {
          const subtotal = sold * item.product.sale_price;
          message += `- ${item.product.name}\n  ${sold} un x R$ ${item.product.sale_price.toFixed(2)} = *R$ ${subtotal.toFixed(2)}*\n`;
        }
      });
      
      message += `\n*Total a Pagar: R$ ${amountToPay.toFixed(2)}*`;
      
      if (receivedAmount > 0) {
        message += `\nValor Recebido: R$ ${receivedAmount.toFixed(2)}`;
        const debt = amountToPay - receivedAmount;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="bg-zinc-50/50 min-h-screen p-4 sm:p-8 animate-in fade-in duration-300">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-zinc-800">Sacolas</h2>
          <button 
            onClick={handleFinalize}
            disabled={saving}
            className="flex items-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Salvar Sacola
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                  <h3 className="text-xl font-bold text-zinc-700 italic">Acerto da Sacola #{bag.bag_number.replace(/\D/g, '')}</h3>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Bipar Devolução</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Nome ou Código..."
                      className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 w-64"
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleBarcodeReturn(searchProduct);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="border border-zinc-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/50 border-b border-zinc-100">
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Produto</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Enviado</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Devolvido</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Vendido</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {items.map((item) => {
                      const sold = item.quantity - item.returned_quantity;
                      return (
                        <tr key={item.id} className="hover:bg-zinc-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-xs font-bold text-zinc-700 uppercase">{item.product.name}</p>
                              <p className="text-[10px] text-zinc-400">{item.product.label_name || 'Sem etiqueta'}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-zinc-800">{item.quantity}</td>
                          <td className="px-6 py-4 text-center">
                            <input 
                              type="number" 
                              className="w-16 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-center text-sm focus:outline-none focus:border-emerald-500"
                              value={item.returned_quantity}
                              onChange={(e) => updateReturnedQuantity(item.id, parseInt(e.target.value) || 0)}
                            />
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-emerald-600">{sold}</td>
                          <td className="px-6 py-4 text-right font-bold text-zinc-800">
                            <p className="text-[10px] text-zinc-400">R$</p>
                            {(sold * item.product.sale_price).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar Summary */}
          <div className="space-y-6">
            <div className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm space-y-8">
              <div>
                <h4 className="text-lg font-bold text-zinc-700 italic mb-6">Resumo do Acerto</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500">Valor Bruto</span>
                    <span className="font-bold text-zinc-800">R$ {totalSold.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500">Comissão (30%)</span>
                    <span className="font-bold text-red-500">- R$ {commission.toFixed(2)}</span>
                  </div>
                  <div className="pt-4 border-t border-zinc-100 flex justify-between items-center">
                    <span className="text-lg font-bold text-zinc-800">A Pagar</span>
                    <span className="text-2xl font-black text-emerald-500">R$ {amountToPay.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Valor Recebido (R$)</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">R$</div>
                  <input 
                    type="number" 
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl pl-12 pr-4 py-4 text-2xl font-black text-zinc-800 focus:outline-none focus:border-emerald-500"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || 0)}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <button 
                      onClick={() => setReceivedAmount(amountToPay)}
                      className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors"
                    >
                      Pago Integral
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Forma de Pagamento</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['dinheiro', 'pix', 'cartao'] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={cn(
                        "py-3 rounded-xl text-[10px] font-bold uppercase transition-all",
                        paymentMethod === method 
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      )}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'pix' && (
                <div className="bg-zinc-50 rounded-3xl p-6 flex flex-col items-center gap-4">
                  <div className="bg-white p-4 rounded-2xl shadow-sm">
                    <QrCode className="w-32 h-32 text-zinc-800" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Escaneie para Pagar</p>
                    {userProfile?.pix_key && (
                      <div className="mt-2">
                        <p className="text-xs font-bold text-zinc-800">{userProfile.pix_key}</p>
                        {userProfile.pix_beneficiary && (
                          <p className="text-[10px] text-zinc-400 uppercase">{userProfile.pix_beneficiary}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button 
                  onClick={handleWhatsAppShare}
                  className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 p-4 rounded-2xl transition-all flex items-center justify-center"
                  title="Compartilhar WhatsApp"
                >
                  <Megaphone className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => window.print()}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 p-4 rounded-2xl transition-all flex items-center justify-center"
                >
                  <Printer className="w-6 h-6" />
                </button>
                <button 
                  onClick={handleFinalize}
                  disabled={saving}
                  className="flex-[2] bg-[#00a86b] hover:bg-[#008f5b] text-white p-4 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  Finalizar Acerto
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
