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
  Megaphone
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

  useEffect(() => {
    fetchData();
  }, [period]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
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
        const subtotal = item.quantity * item.unit_price;
        message += `- ${item.product.name}\n  ${item.quantity} un x R$ ${item.unit_price.toFixed(2)} = *R$ ${subtotal.toFixed(2)}*\n`;
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
          <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-zinc-800">Lista de Inadimplência (Cobrança)</h3>
            <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
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
                            onClick={() => handleWhatsAppShare(bag)}
                            className="p-2 hover:bg-emerald-50 text-emerald-500 rounded-lg transition-colors"
                            title="Compartilhar WhatsApp"
                          >
                            <Megaphone className="w-4 h-4" />
                          </button>
                          <button className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 transition-colors">
                            <ChevronRight className="w-5 h-5" />
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
          <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-zinc-800">Vendas Finalizadas (Período)</h3>
            <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
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
                  finalizedSales.map(bag => (
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
                          <button className="p-2 hover:bg-red-50 text-red-400 rounded-lg transition-colors">
                            <RefreshCcw className="w-4 h-4" />
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
