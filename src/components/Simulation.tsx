import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  ShoppingBag,
  RefreshCcw,
  Save,
  Trash2,
  Loader2,
  Calendar,
  FileText,
  Trophy
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CommissionSimulation } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export function Simulation() {
  const [description, setDescription] = useState('');
  const [value, setValue] = useState<number>(0);
  const [simulations, setSimulations] = useState<CommissionSimulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch manual simulations
      const { data: simData, error: simError } = await supabase
        .from('commission_simulations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (simError) throw simError;
      setSimulations(simData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }

  const getCommissionPct = (val: number) => {
    if (val >= 11000) return 20;
    if (val >= 10000) return 19.75;
    if (val >= 8500) return 19.5;
    if (val >= 7000) return 19.25;
    if (val >= 6000) return 19;
    if (val >= 5000) return 18.75;
    if (val >= 4500) return 18.5;
    if (val >= 4000) return 18.25;
    return 18;
  };

  const commissionPct = getCommissionPct(value);
  const commissionValue = (value * commissionPct) / 100;
  const liquidValue = value - commissionValue;

  const handleSave = async () => {
    if (!description || value <= 0) {
      alert('Preencha a descrição e o valor bruto.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('commission_simulations')
        .insert([{
          user_id: user.id,
          description,
          total_value: value,
          commission_pct: commissionPct,
          commission_value: commissionValue,
          liquid_value: liquidValue
        }]);

      if (error) throw error;
      
      setDescription('');
      setValue(0);
      fetchData();
    } catch (err) {
      console.error('Error saving simulation:', err);
      alert('Erro ao salvar simulação');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir esta simulação?')) return;
    try {
      const { error } = await supabase
        .from('commission_simulations')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Error deleting simulation:', err);
      alert('Erro ao excluir simulação');
    }
  };

  const allSimulations = [...simulations].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="bg-white border border-zinc-200 rounded-[40px] p-10 shadow-sm">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <Calculator className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">Simulador de Comissão</h2>
            <p className="text-sm text-zinc-500">Cálculo automático baseado em faixas de valor.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Descrição da Simulação</label>
              <input 
                type="text" 
                placeholder="Ex: Sacola da Maria - Março"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Valor Total Bruto (R$)</label>
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">R$</span>
                <input 
                  type="number" 
                  placeholder="0,00"
                  value={value || ''}
                  onChange={e => setValue(Number(e.target.value))}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl pl-14 pr-6 py-4 text-2xl font-bold text-zinc-700 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <button 
              onClick={handleSave}
              disabled={saving || !description || value <= 0}
              className="w-full bg-indigo-400 hover:bg-indigo-500 text-white py-5 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar Simulação
            </button>
          </div>

          <div className="bg-zinc-50/50 border border-zinc-100 rounded-[32px] p-10 space-y-8">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Percentual de Comissão</span>
              <span className="text-2xl font-bold text-indigo-600">{commissionPct}%</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Valor do Desconto</span>
              <span className="text-2xl font-bold text-rose-500">- R$ {commissionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="pt-8 border-t border-zinc-100 flex justify-between items-center">
              <span className="text-[10px] font-bold text-zinc-800 uppercase tracking-widest">Valor Líquido a Pagar</span>
              <div className="flex items-center gap-4">
                <span className="text-4xl font-black text-emerald-600">R$ {liquidValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                <button 
                  onClick={() => { setDescription(''); setValue(0); }}
                  className="p-2 hover:bg-rose-50 text-rose-400 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-4">Simulações Salvas</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
            </div>
          ) : allSimulations.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white border border-dashed border-zinc-200 rounded-[40px]">
              <p className="text-zinc-400 italic">Nenhuma simulação encontrada.</p>
            </div>
          ) : (
            allSimulations.map(sim => (
              <div key={sim.id} className="bg-white border border-zinc-100 rounded-[32px] p-8 shadow-sm hover:shadow-md transition-all space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-zinc-800">{sim.description}</h4>
                    </div>
                    <p className="text-[10px] text-zinc-400">{format(new Date(sim.created_at), "dd/MM/yyyy")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleDelete(sim.id)}
                      className="p-2 hover:bg-rose-50 text-rose-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Total Bruto:</span>
                    <span className="font-bold text-zinc-800">R$ {sim.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Comissão ({sim.commission_pct}%):</span>
                    <span className="font-bold text-rose-500">- R$ {sim.commission_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-50 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Líquido:</span>
                  <span className="text-xl font-bold text-emerald-600">R$ {sim.liquid_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
