import React, { useState } from 'react';
import { Save, X, Calendar, Percent, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Campaign } from '../types';

interface CampaignFormProps {
  onClose: () => void;
  onSave: () => void;
  initialData?: Campaign;
}

export function CampaignForm({ onClose, onSave, initialData }: CampaignFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    discount_pct: initialData?.discount_pct || 30,
    return_date: initialData?.return_date ? new Date(initialData.return_date).toISOString().split('T')[0] : '2026-04-15',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        ...formData,
        user_id: user.id,
        status: 'active',
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from('campaigns')
          .update(payload)
          .eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('campaigns')
          .insert([payload]);
        if (error) throw error;
      }

      onSave();
    } catch (err) {
      console.error('Error saving campaign:', err);
      alert('Erro ao salvar campanha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">Campanhas</h2>
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Salvar Campanha
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-8 border-b border-zinc-100 bg-zinc-50/30">
            <h3 className="font-serif italic text-xl text-zinc-700">
              {initialData ? 'Editar Campanha' : 'Nova Campanha'}
            </h3>
          </div>
          
          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Nome da Campanha *
              </label>
              <input 
                type="text" 
                required
                placeholder="Ex: Campanha de Outono"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-4 text-zinc-800 focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-300"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Desconto Padrão (%)
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={formData.discount_pct}
                    onChange={(e) => setFormData({ ...formData, discount_pct: Number(e.target.value) })}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-4 text-zinc-800 focus:border-emerald-500 outline-none transition-all"
                  />
                  <Percent className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Data para Retorno
                </label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={formData.return_date}
                    onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-4 text-zinc-800 focus:border-emerald-500 outline-none transition-all"
                  />
                  <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300 pointer-events-none" />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#007a53] hover:bg-[#006344] text-white py-5 rounded-2xl font-bold text-lg transition-all shadow-lg shadow-emerald-900/10 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
