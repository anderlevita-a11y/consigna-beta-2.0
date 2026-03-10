import React, { useEffect, useState } from 'react';
import { 
  Package, 
  TrendingUp, 
  ShoppingBag, 
  DollarSign,
  Calendar,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  RefreshCcw,
  Loader2,
  Megaphone,
  Receipt,
  Share2,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function Reports() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');
  const [stats, setStats] = useState({
    totalStock: 0,
    stockValue: 0,
    soldValue: 0,
    consignedValue: 0,
    receivedValue: 0
  });
  const [delinquents, setDelinquents] = useState<any[]>([]);
  const [finalizedSales, setFinalizedSales] = useState<any[]>([]);
  const [selectedBagForPayment, setSelectedBagForPayment] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    fetchData();
  }, [period]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
      if (!user) return;

      // 1. Stock Stats
      const { data: products } = await supabase
        .from('products')
        .select('current_stock, cost_price')
        .eq('user_id', user.id)
        .limit(30000);
      
      const totalStock = products?.reduce((acc, p) => acc + (p.current_stock || 0), 0) || 0;
      const stockValue = products?.reduce((acc, p) => acc + ((p.current_stock || 0) * (p.cost_price || 0)), 0) || 0;

      // 2. Consigned Value (Open Bags)
      const { data: openBags } = await supabase
        .from('bags')
        .select('total_value')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .limit(30000);
      
      const consignedValue = openBags?.reduce((acc, b) => acc + (b.total_value || 0), 0) || 0;

      // 3. Sold and Received Value (Closed Bags)
      // In a real app, we'd filter by period here
      const { data: closedBags } = await supabase
        .from('bags')
        .select('*, customer:customers(nome)')
        .eq('user_id', user.id)
        .eq('status', 'closed')
        .order('created_at', { ascending: false })
        .limit(30000);

      const soldValue = closedBags?.reduce((acc, b) => acc + (b.total_value || 0), 0) || 0;
      const receivedValue = closedBags?.reduce((acc, b) => acc + (b.received_amount || 0), 0) || 0;

      // 4. Delinquents (Closed Bags with pending or partial payment status)
      const { data: pendingBags } = await supabase
        .from('bags')
        .select('*, customer:customers(nome)')
        .eq('user_id', user.id)
        .eq('status', 'closed')
        .in('payment_status', ['pending', 'partial'])
        .limit(10);

      setStats({
        totalStock,
        stockValue,
        soldValue,
        consignedValue,
        receivedValue
      });
      setDelinquents(pendingBags || []);
      setFinalizedSales(closedBags || []);

    } catch (err) {
      console.error('Error fetching report data:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleWhatsAppShare = async (bag: any) => {
    try {
      const { data: items } = await supabase
        .from('bag_items')
        .select('*')
        .eq('bag_id', bag.id)
        .limit(30000);

      if (!items) return;

      // Fetch campaign to get discount
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('discount_pct')
        .eq('id', bag.campaign_id)
        .single();

      const discountPct = campaign?.discount_pct || 0;
      const totalGross = bag.total_value || 0;
      const discountAmount = totalGross * (discountPct / 100);
      const finalAmount = totalGross - discountAmount;

      const customerName = bag.customer?.nome || 'Cliente';
      let message = `*Resumo da Sacola #${bag.bag_number.replace(/\D/g, '')}*\n`;
      message += `Cliente: ${customerName}\n`;
      message += `Data: ${format(new Date(bag.created_at), "dd/MM/yyyy")}\n\n`;
      message += `*Itens:*\n`;
      
      items.forEach(item => {
        const productName = item.product_name || 'Produto';
        const sold = item.quantity - (item.returned_quantity || 0);
        if (sold > 0) {
          message += `- ${productName}\n  ${sold} un x R$ ${item.unit_price.toFixed(2)}\n`;
        }
      });
      
      message += `\nSubtotal: R$ ${totalGross.toFixed(2)}`;
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

  const handleReceivePayment = async () => {
    if (!selectedBagForPayment || !paymentAmount) return;
    
    setIsProcessingPayment(true);
    try {
      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount <= 0) {
        alert('Por favor, insira um valor válido.');
        return;
      }

      const newReceivedAmount = (selectedBagForPayment.received_amount || 0) + amount;
      const totalToPay = selectedBagForPayment.total_value; // Assuming total_value is already discounted if applicable
      
      // We need to check if there was a campaign discount applied during settlement
      // But for simplicity in this report view, we use the total_value stored in the bag
      
      const { error } = await supabase
        .from('bags')
        .update({
          received_amount: newReceivedAmount,
          payment_status: newReceivedAmount >= totalToPay ? 'paid' : 'partial'
        })
        .eq('id', selectedBagForPayment.id);

      if (error) throw error;

      // Share receipt
      const customerName = selectedBagForPayment.customer?.nome || 'Cliente';
      let message = `*Comprovante de Pagamento*\n`;
      message += `Cliente: ${customerName}\n`;
      message += `Sacola: #${selectedBagForPayment.bag_number}\n`;
      message += `Data: ${format(new Date(), "dd/MM/yyyy HH:mm")}\n\n`;
      message += `Valor Recebido: *R$ ${amount.toFixed(2)}*\n`;
      message += `Total Pago: R$ ${newReceivedAmount.toFixed(2)}\n`;
      
      const debt = totalToPay - newReceivedAmount;
      if (debt > 0) {
        message += `Saldo Devedor: R$ ${debt.toFixed(2)}\n`;
      } else {
        message += `*Dívida Quitada!* 🎉\n`;
      }
      
      message += `\nObrigado pela preferência!`;

      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');

      setSelectedBagForPayment(null);
      setPaymentAmount('');
      fetchData();
    } catch (err) {
      console.error('Error processing payment:', err);
      alert('Erro ao processar pagamento.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleShareReceipt = (bag: any) => {
    const customerName = bag.customer?.nome || 'Cliente';
    let message = `*Comprovante de Pagamento*\n`;
    message += `Cliente: ${customerName}\n`;
    message += `Sacola: #${bag.bag_number}\n\n`;
    message += `Valor Total: R$ ${bag.total_value.toFixed(2)}\n`;
    message += `Valor Pago: *R$ ${(bag.received_amount || 0).toFixed(2)}*\n`;
    
    const debt = bag.total_value - (bag.received_amount || 0);
    if (debt > 0) {
      message += `Saldo Devedor: R$ ${debt.toFixed(2)}\n`;
    } else {
      message += `*Dívida Totalmente Quitada!* 🎉\n`;
    }
    
    message += `\nObrigado pela preferência!`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const handleReverseSale = async (bag: any) => {
    const confirm = window.confirm(`Deseja realmente extornar a venda da sacola #${bag.bag_number}? A sacola voltará para o status "Aberta" e o pagamento será zerado.`);
    
    if (!confirm) return;

    try {
      const { error } = await supabase
        .from('bags')
        .update({
          status: 'open',
          payment_status: 'pending',
          received_amount: 0,
          closed_at: null
        })
        .eq('id', bag.id);

      if (error) throw error;

      fetchData();
    } catch (err) {
      console.error('Error reversing sale:', err);
      alert('Erro ao extornar venda.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">Relatórios Estratégicos</h2>
          <p className="text-sm text-zinc-500">Visão geral do seu negócio e gestão de cobrança.</p>
        </div>
        <div className="flex bg-white border border-zinc-200 p-1 rounded-xl shadow-sm self-start sm:self-auto">
          <button 
            onClick={() => setPeriod('week')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
              period === 'week' ? "bg-zinc-900 text-white" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            Semana
          </button>
          <button 
            onClick={() => setPeriod('month')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
              period === 'month' ? "bg-zinc-900 text-white" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            Mês
          </button>
          <button 
            onClick={() => setPeriod('all')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
              period === 'all' ? "bg-zinc-900 text-white" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            Tudo
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ReportCard 
          title="Estoque Total"
          value={`${stats.totalStock} un.`}
          subtitle={`Valor: R$ ${stats.stockValue.toFixed(2)}`}
          icon={Package}
          color="blue"
        />
        <ReportCard 
          title="Valor Vendido"
          value={`R$ ${stats.soldValue.toFixed(2)}`}
          subtitle="No período selecionado"
          icon={TrendingUp}
          color="emerald"
        />
        <ReportCard 
          title="Em Consignado"
          value={`R$ ${stats.consignedValue.toFixed(2)}`}
          subtitle="Valor em sacolas abertas"
          icon={ShoppingBag}
          color="amber"
        />
        <ReportCard 
          title="Caixa Recebido"
          value={`R$ ${stats.receivedValue.toFixed(2)}`}
          subtitle="Total pago no período →"
          icon={DollarSign}
          color="indigo"
        />
      </div>

      {/* Tables Section */}
      <div className="space-y-8">
        {/* Delinquency Table */}
        <div className="bg-white border border-zinc-200 rounded-[32px] overflow-hidden shadow-sm">
          <div className="p-4 sm:p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-zinc-800 text-center sm:text-left">Lista de Inadimplência (Cobrança)</h3>
            <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest w-fit mx-auto sm:mx-0">
              {delinquents.length} Pendentes
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50">
                  <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Sacola</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Pago</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Dívida</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {delinquents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-zinc-400 italic">
                      Nenhuma inadimplência registrada.
                    </td>
                  </tr>
                ) : (
                  delinquents.map(bag => (
                    <tr key={bag.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-8 py-4 font-bold text-zinc-800 text-sm">{bag.customer?.nome}</td>
                      <td className="px-8 py-4 text-zinc-500 text-sm">#{bag.bag_number}</td>
                      <td className="px-8 py-4 font-bold text-zinc-800 text-sm">R$ {bag.total_value.toFixed(2)}</td>
                      <td className="px-8 py-4 text-emerald-600 text-sm font-bold">R$ {(bag.received_amount || 0).toFixed(2)}</td>
                      <td className="px-8 py-4 text-red-600 text-sm font-bold">R$ {Math.max(0, bag.total_value - (bag.received_amount || 0)).toFixed(2)}</td>
                      <td className="px-8 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setSelectedBagForPayment(bag)}
                            className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                            title="Receber Pagamento"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleShareReceipt(bag)}
                            className="p-2 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors"
                            title="Compartilhar Comprovante"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleWhatsAppShare(bag)}
                            className="p-2 hover:bg-emerald-50 text-emerald-500 rounded-lg transition-colors"
                            title="Compartilhar Resumo WhatsApp"
                          >
                            <Megaphone className="w-4 h-4" />
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

        {/* Finalized Sales Table */}
        <div className="bg-white border border-zinc-200 rounded-[32px] overflow-hidden shadow-sm">
          <div className="p-4 sm:p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-zinc-800 text-center sm:text-left">Vendas Finalizadas (Período)</h3>
            <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest w-fit mx-auto sm:mx-0">
              {finalizedSales.length} Sacolas
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50">
                  <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Data</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {finalizedSales.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-zinc-400 italic">
                      Nenhuma venda finalizada no período.
                    </td>
                  </tr>
                ) : (
                  <>
                    {finalizedSales.slice(0, 100).map(bag => (
                      <tr key={bag.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-8 py-4 text-zinc-500 text-sm">
                          {format(new Date(bag.created_at), "dd/MM/yyyy")}
                        </td>
                        <td className="px-8 py-4 font-bold text-zinc-800 text-sm">{bag.customer?.nome}</td>
                        <td className="px-8 py-4 font-bold text-zinc-800 text-sm">R$ {bag.total_value.toFixed(2)}</td>
                        <td className="px-8 py-4">
                          <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                            Pago
                          </span>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleWhatsAppShare(bag)}
                              className="p-2 hover:bg-emerald-50 text-emerald-500 rounded-lg transition-colors"
                              title="Compartilhar WhatsApp"
                            >
                              <Megaphone className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleReverseSale(bag)}
                              className="p-2 hover:bg-red-50 text-red-400 rounded-lg transition-colors"
                              title="Extornar Venda"
                            >
                              <RefreshCcw className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {finalizedSales.length > 100 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-4 text-center text-xs text-zinc-500 bg-zinc-50">
                          Mostrando as primeiras 100 vendas de {finalizedSales.length}.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {selectedBagForPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-800">Receber Pagamento</h3>
                    <p className="text-xs text-zinc-500">Sacola #{selectedBagForPayment.bag_number}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedBagForPayment(null)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="bg-zinc-50 rounded-2xl p-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Total da Sacola</span>
                  <span className="font-bold text-zinc-800">R$ {selectedBagForPayment.total_value.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Já Recebido</span>
                  <span className="font-bold text-emerald-600">R$ {(selectedBagForPayment.received_amount || 0).toFixed(2)}</span>
                </div>
                <div className="pt-3 border-t border-zinc-200 flex justify-between items-center">
                  <span className="text-sm font-bold text-zinc-800">Saldo Devedor</span>
                  <span className="text-xl font-black text-red-600">
                    R$ {Math.max(0, selectedBagForPayment.total_value - (selectedBagForPayment.received_amount || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Valor a Receber (R$)</label>
                <input 
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={paymentAmount}
                  onChange={(e) => {
                    const val = e.target.value.replace(',', '.');
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setPaymentAmount(val);
                    }
                  }}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-2xl font-black text-zinc-800 focus:outline-none focus:border-emerald-500 transition-all"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button 
                    onClick={() => setPaymentAmount(Math.max(0, selectedBagForPayment.total_value - (selectedBagForPayment.received_amount || 0)).toString())}
                    className="text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    Receber Valor Total
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setSelectedBagForPayment(null)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleReceivePayment}
                  disabled={isProcessingPayment || !paymentAmount}
                  className="flex-[2] bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessingPayment ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
                  Confirmar e Compartilhar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportCard({ title, value, subtitle, icon: Icon, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    indigo: "bg-indigo-50 text-indigo-600"
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-[32px] p-8 shadow-sm hover:shadow-md transition-all group">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110", colors[color])}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{title}</p>
        <h4 className={cn("text-3xl font-bold tracking-tight", color === 'emerald' ? "text-emerald-600" : color === 'amber' ? "text-amber-600" : color === 'indigo' ? "text-indigo-600" : "text-zinc-800")}>
          {value}
        </h4>
        <p className="text-xs text-zinc-400 font-medium">{subtitle}</p>
      </div>
    </div>
  );
}
