import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Check, 
  Loader2, 
  Search, 
  QrCode,
  Save,
  Megaphone,
  Copy,
  ExternalLink,
  Plus,
  MinusCircle,
  RefreshCcw,
  Package
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { generatePixPayload } from '../lib/pix';
import { supabase } from '../lib/supabase';
import { Bag, BagItem, Product, Profile } from '../types';
import { cn, printFallback, formatError } from '../lib/utils';
import { format } from 'date-fns';
import { PrintPreview } from './PrintPreview';
import { useNotifications } from './NotificationCenter';
import { ConfirmationModal } from './ConfirmationModal';

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
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<SettlementItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'pix' | 'cartao'>('pix');
  const [receivedAmount, setReceivedAmount] = useState<string>('0');
  const [searchProduct, setSearchProduct] = useState('');
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [campaignDiscount, setCampaignDiscount] = useState(30);
  const [previewType, setPreviewType] = useState<'termica' | 'a4' | 'etiqueta'>('termica');
  const [expenses, setExpenses] = useState<{ description: string; value: number }[]>([]);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseValue, setExpenseValue] = useState<string>('0');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    fetchData();
  }, [bag.id]);

  async function fetchData() {
    try {
      // Fetch campaign discount
      if (bag.campaign_id) {
        const { data: campaign } = await supabase
          .from('campaigns')
          .select('discount_pct')
          .eq('id', bag.campaign_id)
          .single();
        if (campaign) setCampaignDiscount(campaign.discount_pct);
      }

      // Fetch user profile for PIX details
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setUserProfile(profile);
      }

      const { data: bagItemsData, error: bagItemsError } = await supabase
        .from('bag_items')
        .select('*')
        .eq('bag_id', bag.id)
        .limit(30000);

      if (bagItemsError) throw bagItemsError;
      
      // Fetch products separately to avoid foreign key issues
      const productIds = (bagItemsData || []).map(item => item.product_id).filter(Boolean);
      let productsData: any[] = [];
      
      if (productIds.length > 0) {
        const { data: pData } = await supabase
          .from('products')
          .select('*')
          .in('id', productIds);
        if (pData) productsData = pData;
      }

      const settlementItems = (bagItemsData || []).map(item => {
        const product = productsData.find(p => p.id === item.product_id);
        return {
          ...item,
          returned_quantity: item.returned_quantity || 0,
          product: product || {
            id: item.product_id || '',
            name: item.product_name,
            sale_price: item.unit_price, // Use stored unit_price as fallback
            current_stock: 0
          }
        };
      });
      
      setItems(settlementItems);
      
      // Calculate initial total to pay using stored unit_price
      const totalToPay = settlementItems.reduce((acc, item) => {
        const sold = item.quantity - item.returned_quantity;
        return acc + (sold * item.unit_price);
      }, 0);
      
      setReceivedAmount(bag.received_amount?.toString() || '0');
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

  const totalGross = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  const totalSold = items.reduce((acc, item) => {
    const sold = item.quantity - item.returned_quantity;
    return acc + (sold * item.unit_price);
  }, 0);
  
  const commission = totalSold * (campaignDiscount / 100);
  const totalExpenses = expenses.reduce((acc, e) => acc + e.value, 0);
  const amountToPay = totalSold - commission - totalExpenses;
  const numericReceivedAmount = parseFloat(receivedAmount.replace(',', '.')) || 0;

  const handleAddExpense = () => {
    const numericValue = Number(expenseValue.replace(',', '.')) || 0;
    if (!expenseDesc || numericValue <= 0) return;
    setExpenses([...expenses, { description: expenseDesc, value: numericValue }]);
    setExpenseDesc('');
    setExpenseValue('0');
  };

  const handleRemoveExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  const handleReopen = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reabrir Sacola',
      message: 'Deseja reabrir esta sacola? Os itens devolvidos serão removidos do estoque novamente.',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setSaving(true);
        try {
          // 1. Revert stock and reset returned_quantity
          for (const item of items) {
            if (item.returned_quantity > 0) {
              const { data: product } = await supabase
                .from('products')
                .select('current_stock')
                .eq('id', item.product.id)
                .single();
              
              if (product) {
                await supabase
                  .from('products')
                  .update({ current_stock: Math.max(0, (product.current_stock || 0) - item.returned_quantity) })
                  .eq('id', item.product.id);
              }
              
              await supabase
                .from('bag_items')
                .update({ returned_quantity: 0 })
                .eq('id', item.id);
            }
          }

          // 2. Update bag status
          const { error: bagError } = await supabase
            .from('bags')
            .update({ 
              status: 'open',
              payment_status: 'pending',
              total_value: totalGross,
              received_amount: 0
            })
            .eq('id', bag.id);

          if (bagError) throw bagError;
          
          onSave();
        } catch (err) {
          console.error('Error reopening bag:', err);
          addNotification({
            type: 'error',
            title: 'Erro ao reabrir',
            message: 'Erro ao reabrir sacola. Verifique sua conexão.'
          });
        } finally {
          setSaving(false);
        }
      }
    });
  };

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
            .select('current_stock, has_grid, grid_data')
            .eq('id', item.product.id)
            .single();
          
          if (product) {
            let updateData: any = {
              current_stock: Number(product.current_stock || 0) + item.returned_quantity
            };

            // Update grid data if product has grid
            if (product.has_grid && product.grid_data && item.color && item.size) {
              const newGridData = product.grid_data.map((g: any) => {
                if (g.color === item.color && g.size === item.size) {
                  return { ...g, quantity: (g.quantity || 0) + item.returned_quantity };
                }
                return g;
              });
              updateData.grid_data = newGridData;
            }

            await supabase
              .from('products')
              .update(updateData)
              .eq('id', item.product.id);
          }
        }
      }

      // 2. Update bag status and payment
      let paymentStatus: 'paid' | 'partial' | 'pending' = 'partial';
      if (numericReceivedAmount >= amountToPay) {
        paymentStatus = 'paid';
      } else if (numericReceivedAmount <= 0) {
        paymentStatus = 'pending';
      }

      const { error: bagError } = await supabase
        .from('bags')
        .update({ 
          status: 'closed',
          total_value: amountToPay,
          received_amount: numericReceivedAmount,
          payment_status: paymentStatus
        })
        .eq('id', bag.id);

      if (bagError) throw bagError;
      
      // Share on WhatsApp before closing
      await handleWhatsAppShare();
      
      onSave();
    } catch (err) {
      console.error('Error finalizing settlement:', err);
      addNotification({
        type: 'error',
        title: 'Erro ao finalizar',
        message: 'Erro ao finalizar acerto. Verifique sua conexão.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBarcodeReturn = (code: string) => {
    const searchLower = code.toLowerCase().trim();
    const item = items.find(i => 
      i.product.ean === searchLower || 
      i.product.name.toLowerCase() === searchLower ||
      (i.product.label_name && i.product.label_name.toLowerCase() === searchLower)
    );
    
    if (item) {
      updateReturnedQuantity(item.id, item.returned_quantity + 1);
      setSearchProduct('');
    } else {
      addNotification({
        type: 'warning',
        title: 'Não encontrado',
        message: 'Erro de leitura: Produto não encontrado na sacola.'
      });
      setSearchProduct('');
    }
  };

  const filteredItems = searchProduct
    ? items.filter(item => {
        const search = searchProduct.toLowerCase().trim();
        return (item.product.name?.toLowerCase() || '').includes(search) ||
               (item.product.label_name?.toLowerCase() || '').includes(search) ||
               String(item.product.ean || '').toLowerCase().includes(search);
      }).slice(0, 10)
    : [];

  const handleWhatsAppShare = async () => {
    try {
      const numericReceivedAmount = parseFloat(receivedAmount.replace(',', '.')) || 0;
      const customerName = bag.customer?.nome || 'Cliente';
      let message = `*Resumo da Sacola #${bag.bag_number.replace(/\D/g, '')}*\n`;
      message += `Cliente: ${customerName}\n\n`;
      message += `*Itens:*\n`;
      
      items.forEach(item => {
        const sold = item.quantity - item.returned_quantity;
        if (sold > 0) {
          message += `- ${item.product.name}\n  ${sold} un x R$ ${item.unit_price.toFixed(2)}\n`;
        }
      });
      
      message += `\nSubtotal: R$ ${totalSold.toFixed(2)}`;
      if (campaignDiscount > 0) {
        message += `\nDesconto Campanha (${campaignDiscount}%): R$ ${commission.toFixed(2)}`;
      }
      
      if (totalExpenses > 0) {
        message += `\n*Despesas Adicionais:*\n`;
        expenses.forEach(e => {
          message += `- ${e.description}: - R$ ${e.value.toFixed(2)}\n`;
        });
        message += `Total Despesas: - R$ ${totalExpenses.toFixed(2)}`;
      }

      message += `\n*Total a Pagar: R$ ${amountToPay.toFixed(2)}*`;
      
      if (numericReceivedAmount > 0) {
        message += `\nValor Recebido: R$ ${numericReceivedAmount.toFixed(2)}`;
        const debt = amountToPay - numericReceivedAmount;
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

  const handlePrintPDF = async () => {
    setSaving(true);
    try {
      const payload = {
        tipo_documento: 'nota_servico',
        dados_cliente: {
          nome: bag.customer?.nome || 'Cliente',
          cpf: bag.customer?.cpf || '---'
        },
        itens: items.map(item => ({
          nome: item.product.name,
          qtd: item.quantity - item.returned_quantity,
          preco: item.unit_price,
          total: (item.quantity - item.returned_quantity) * item.unit_price
        })).filter(i => i.qtd > 0)
      };

      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: payload
      });

      if (error) throw error;
      
      setPdfUrl(data.url);
      setPreviewType('termica');
      setShowPreview(true);
    } catch (err: any) {
      console.warn('Edge Function (generate-pdf) not available, using fallback print:', err.message);
      
      // Fallback to simple print if Edge Function is not reachable or any error occurs
      const payload = {
        tipo_documento: 'nota_servico',
        dados_cliente: {
          nome: bag.customer?.nome || 'Cliente',
          cpf: bag.customer?.cpf || '---'
        },
        itens: items.map(item => ({
          nome: item.product.name,
          qtd: item.quantity - item.returned_quantity,
          preco: item.unit_price,
          total: (item.quantity - item.returned_quantity) * item.unit_price
        })).filter(i => i.qtd > 0)
      };
      printFallback(payload, (msg) => addNotification({ type: 'warning', title: 'Impressão', message: msg }));
    } finally {
      setSaving(false);
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
          <h2 className="text-2xl font-bold text-zinc-800 text-center sm:text-left">Sacolas</h2>
          {bag.status === 'closed' ? (
            <button 
              onClick={handleReopen}
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 sm:py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 w-full sm:w-auto"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
              Reabrir Sacola
            </button>
          ) : (
            <button 
              onClick={handleFinalize}
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-6 py-3 sm:py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 w-full sm:w-auto"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar Sacola
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-zinc-200 rounded-3xl p-4 sm:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                  <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                  <h3 className="text-lg sm:text-xl font-bold text-zinc-700 italic">Acerto da Sacola #{bag.bag_number.replace(/\D/g, '')}</h3>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Bipar Devolução</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Nome ou Código..."
                      className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 w-64 disabled:opacity-50"
                      value={searchProduct}
                      disabled={bag.status === 'closed'}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleBarcodeReturn(searchProduct);
                        }
                      }}
                    />
                    {filteredItems.length > 0 && (
                      <div className="absolute z-20 top-full right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-xl max-h-60 overflow-y-auto w-80">
                        {filteredItems.map(item => (
                          <button 
                            key={item.id}
                            onClick={() => {
                              updateReturnedQuantity(item.id, item.returned_quantity + 1);
                              setSearchProduct('');
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-zinc-50 text-left border-b border-zinc-50 last:border-0"
                          >
                            <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4 text-zinc-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-zinc-800 truncate">{item.product.name}</p>
                              <p className="text-[10px] text-zinc-400">EAN: {item.product.ean || '---'} | Enviado: {item.quantity}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
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
                              type="text" 
                              inputMode="numeric"
                              className="w-16 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-center text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:bg-zinc-100"
                              value={item.returned_quantity === 0 ? '' : item.returned_quantity}
                              disabled={bag.status === 'closed'}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                updateReturnedQuantity(item.id, val);
                              }}
                              placeholder="0"
                            />
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-emerald-600">{sold}</td>
                          <td className="px-6 py-4 text-right font-bold text-zinc-800">
                            <p className="text-[10px] text-zinc-400">R$</p>
                            {(sold * item.unit_price).toFixed(2)}
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
                    <span className="text-zinc-500">Comissão ({campaignDiscount}%)</span>
                    <span className="font-bold text-red-500">- R$ {commission.toFixed(2)}</span>
                  </div>

                  {totalExpenses > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-500">Total Despesas</span>
                      <span className="font-bold text-red-500">- R$ {totalExpenses.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                    <span className="text-lg font-bold text-zinc-800">A Pagar</span>
                    <span className="text-2xl font-black text-emerald-500">R$ {amountToPay.toFixed(2)}</span>
                  </div>

                  {numericReceivedAmount > 0 && numericReceivedAmount < amountToPay && (
                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                      <span className="text-sm font-bold text-zinc-500">Saldo Devedor</span>
                      <span className="text-lg font-black text-red-500">
                        R$ {(amountToPay - numericReceivedAmount).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Despesas Adicionais (Opcional)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Descrição"
                    value={expenseDesc}
                    disabled={bag.status === 'closed'}
                    onChange={e => setExpenseDesc(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddExpense()}
                    className="flex-[2] bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  />
                  <input 
                    type="text" 
                    inputMode="decimal"
                    placeholder="R$"
                    value={expenseValue === '0' ? '' : expenseValue}
                    disabled={bag.status === 'closed'}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || /^\d*([.,]\d*)?$/.test(val)) {
                        setExpenseValue(val);
                      }
                    }}
                    onKeyDown={e => e.key === 'Enter' && handleAddExpense()}
                    className="flex-1 bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  />
                  <button 
                    type="button"
                    onClick={handleAddExpense}
                    disabled={bag.status === 'closed'}
                    className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 p-2 rounded-xl transition-all disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                {expenses.length > 0 && (
                  <div className="space-y-1">
                    {expenses.map((exp, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-rose-50/50 border border-rose-100 rounded-lg px-3 py-1.5">
                        <span className="text-[10px] font-medium text-rose-700">{exp.description}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-rose-700">- R$ {exp.value.toFixed(2)}</span>
                          {bag.status !== 'closed' && (
                            <button 
                              type="button"
                              onClick={() => handleRemoveExpense(idx)} 
                              className="text-rose-400 hover:text-rose-600"
                            >
                              <MinusCircle className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Valor Recebido (R$)</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">R$</div>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl pl-12 pr-4 py-4 text-2xl font-black text-zinc-800 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                    value={receivedAmount}
                    disabled={bag.status === 'closed'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*([.,]\d*)?$/.test(val)) {
                        setReceivedAmount(val);
                      }
                    }}
                    onBlur={() => {
                      if (receivedAmount === '' || receivedAmount === '.') {
                        setReceivedAmount('0');
                      }
                    }}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <button 
                      onClick={() => setReceivedAmount(amountToPay.toString())}
                      disabled={bag.status === 'closed'}
                      className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors disabled:opacity-50"
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
                      disabled={bag.status === 'closed'}
                      className={cn(
                        "py-3 rounded-xl text-[10px] font-bold uppercase transition-all disabled:opacity-50",
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
                    {userProfile?.pix_key ? (
                      <QRCodeSVG 
                        value={generatePixPayload(
                          userProfile.pix_key,
                          userProfile.pix_beneficiary || 'Beneficiario',
                          'BRASIL',
                          amountToPay,
                          `SAC${bag.bag_number.replace(/\D/g, '')}`
                        )}
                        size={160}
                        level="M"
                        includeMargin={false}
                      />
                    ) : (
                      <div className="w-40 h-40 flex items-center justify-center bg-zinc-100 rounded-xl">
                        <QrCode className="w-12 h-12 text-zinc-300" />
                      </div>
                    )}
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Escaneie para Pagar</p>
                    {userProfile?.pix_key ? (
                      <div className="mt-2 flex flex-col items-center gap-3">
                        <div>
                          <p className="text-xs font-bold text-zinc-800">{userProfile.pix_key}</p>
                          {userProfile.pix_beneficiary && (
                            <p className="text-[10px] text-zinc-400 uppercase">{userProfile.pix_beneficiary}</p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            const payload = generatePixPayload(
                              userProfile.pix_key!,
                              userProfile.pix_beneficiary || 'Beneficiario',
                              'BRASIL',
                              amountToPay,
                              `SAC${bag.bag_number.replace(/\D/g, '')}`
                            );
                            navigator.clipboard.writeText(payload);
                            addNotification({
                              type: 'success',
                              title: 'Copiado',
                              message: 'Código PIX copiado!'
                            });
                          }}
                          className="flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                          Copiar Código PIX
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-red-500 mt-2">Chave PIX não configurada no perfil.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 no-print">
                <button 
                  onClick={handleWhatsAppShare}
                  className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 p-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center"
                  title="Compartilhar WhatsApp"
                >
                  <Megaphone className="w-6 h-6" />
                </button>
                <button 
                  onClick={handlePrintPDF}
                  disabled={saving}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 p-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Printer className="w-6 h-6" />}
                </button>
                {bag.status === 'closed' ? (
                  <button 
                    onClick={handleReopen}
                    disabled={saving}
                    className="flex-[2] bg-amber-500 hover:bg-amber-600 text-white p-4 rounded-2xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
                    Reabrir Sacola
                  </button>
                ) : (
                  <button 
                    onClick={handleFinalize}
                    disabled={saving}
                    className="flex-[2] bg-[#00a86b] hover:bg-[#008f5b] text-white p-4 rounded-2xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    Finalizar Acerto
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPreview && (
        <PrintPreview 
          pdfUrl={pdfUrl} 
          tipo={previewType} 
          onClose={() => setShowPreview(false)} 
        />
      )}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        variant="warning"
      />
    </div>
  );
}
