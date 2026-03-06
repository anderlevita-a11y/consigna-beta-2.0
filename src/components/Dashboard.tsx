import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  Package,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Dashboard() {
  const [stats, setStats] = useState({
    totalSales: 0,
    activeBags: 0,
    totalCustomers: 0,
    totalProducts: 0
  });

  useEffect(() => {
    async function fetchStats() {
      // In a real app, these would be actual queries
      // For now, we'll try to get counts from the tables mentioned
      const { count: productsCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
      const { count: customersCount } = await supabase.from('customers').select('*', { count: 'exact', head: true });
      const { count: bagsCount } = await supabase.from('bags').select('*', { count: 'exact', head: true });

      setStats({
        totalSales: 12450.80, // Mocked for now
        activeBags: bagsCount || 0,
        totalCustomers: customersCount || 0,
        totalProducts: productsCount || 0
      });
    }

    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Visão Geral</h2>
        <p className="text-zinc-400">Bem-vindo ao painel de controle da Consigna.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Vendas Totais" 
          value={`R$ ${stats.totalSales.toLocaleString('pt-BR')}`} 
          icon={TrendingUp} 
          trend="+12.5%" 
          trendUp={true} 
        />
        <StatCard 
          title="Malas Ativas" 
          value={stats.activeBags.toString()} 
          icon={ShoppingBag} 
          trend="+3" 
          trendUp={true} 
        />
        <StatCard 
          title="Clientes" 
          value={stats.totalCustomers.toString()} 
          icon={Users} 
          trend="+2" 
          trendUp={true} 
        />
        <StatCard 
          title="Produtos" 
          value={stats.totalProducts.toString()} 
          icon={Package} 
          trend="Estável" 
          trendUp={true} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Atividade Recente</h3>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Mala #1024 entregue</p>
                    <p className="text-xs text-zinc-500">Para: Maria Oliveira</p>
                  </div>
                </div>
                <span className="text-xs text-zinc-500">Há 2 horas</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Produtos Mais Vendidos</h3>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center">
                    <Package className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Camiseta Basic Cotton</p>
                    <p className="text-xs text-zinc-500">SKU: TS-00{i}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">45 vendas</p>
                  <p className="text-xs text-emerald-400">R$ 2.450,00</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendUp }: any) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-zinc-800 rounded-lg">
          <Icon className="w-6 h-6 text-emerald-400" />
        </div>
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
          trendUp ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
        )}>
          {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <div>
        <p className="text-sm text-zinc-400 mb-1">{title}</p>
        <h4 className="text-2xl font-bold text-white">{value}</h4>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
