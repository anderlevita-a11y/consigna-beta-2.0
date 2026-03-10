import React, { useEffect, useState } from 'react';
import { 
  Ticket, 
  Plus, 
  Calendar, 
  Trophy, 
  Users, 
  ChevronRight, 
  Loader2, 
  X, 
  Save, 
  Download, 
  Trash2,
  CheckCircle2,
  AlertCircle,
  Search,
  UserPlus,
  Archive,
  RefreshCcw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Sweepstakes, SweepstakesParticipant } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConfirmationModal } from './ConfirmationModal';

export function SweepstakesManager() {
  const [sweepstakes, setSweepstakes] = useState<Sweepstakes[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'details' | 'draw'>('list');
  const [selectedSweep, setSelectedSweep] = useState<Sweepstakes | null>(null);
  const [showArchived, setShowArchived] = useState(false);

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

  useEffect(() => {
    fetchSweepstakes();
  }, [showArchived]);

  async function fetchSweepstakes() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
      if (!user) return;

      let query = supabase
        .from('sweepstakes')
        .select('*')
        .eq('user_id', user.id);
      
      if (showArchived) {
        query = query.eq('status', 'archived');
      } else {
        query = query.neq('status', 'archived');
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(30000);
      if (error) throw error;
      setSweepstakes(data || []);
    } catch (err) {
      console.error('Error fetching sweepstakes:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenSweep = (sweep: Sweepstakes) => {
    setSelectedSweep(sweep);
    setView('details');
  };

  const handleDraw = (sweep: Sweepstakes) => {
    setSelectedSweep(sweep);
    setView('draw');
  };

  const handleArchive = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Arquivar Sorteio',
      message: 'Deseja arquivar este sorteio? Ele não aparecerá mais na lista ativa.',
      variant: 'warning',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('sweepstakes')
            .update({ status: 'archived' })
            .eq('id', id);
          if (error) throw error;
          fetchSweepstakes();
        } catch (err) {
          console.error('Error archiving sweepstakes:', err);
          alert('Erro ao arquivar sorteio');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleUnarchive = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Desarquivar Sorteio',
      message: 'Deseja desarquivar este sorteio?',
      variant: 'info',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('sweepstakes')
            .update({ status: 'pending' }) // Or 'completed' if it was completed, but 'pending' is safer if we don't track original status
            .eq('id', id);
          if (error) throw error;
          fetchSweepstakes();
        } catch (err) {
          console.error('Error unarchiving sweepstakes:', err);
          alert('Erro ao desarquivar sorteio');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  if (view === 'create') {
    return <SweepstakesForm onClose={() => setView('list')} onSave={() => { setView('list'); fetchSweepstakes(); }} />;
  }

  if (view === 'details' && selectedSweep) {
    return <SweepstakesDetails sweep={selectedSweep} onBack={() => setView('list')} onDraw={() => setView('draw')} />;
  }

  if (view === 'draw' && selectedSweep) {
    return <SweepstakesDraw sweep={selectedSweep} onBack={() => setView('details')} />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">
            {showArchived ? 'Sorteios Arquivados' : 'Beauty Sorteios'}
          </h2>
          <p className="text-sm text-zinc-500">Gestão de sorteios e engajamento de clientes.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowArchived(!showArchived)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all",
              showArchived 
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                : "bg-zinc-100 hover:bg-zinc-200 text-zinc-600"
            )}
          >
            <Archive className="w-5 h-5" />
            {showArchived ? 'Ver Ativos' : 'Arquivados'}
          </button>
          <button 
            onClick={() => setView('create')}
            className="flex items-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-5 h-5" />
            Novo Sorteio
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
          </div>
        ) : sweepstakes.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white border border-dashed border-zinc-200 rounded-[32px] space-y-4">
            <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto">
              <Ticket className="w-8 h-8 text-zinc-200" />
            </div>
            <p className="text-zinc-400 font-medium">
              {showArchived ? 'Nenhum sorteio arquivado.' : 'Nenhum sorteio criado. Comece agora!'}
            </p>
          </div>
        ) : (
          sweepstakes.map(sweep => (
            <div key={sweep.id} className={cn(
              "bg-white border border-zinc-100 rounded-[32px] p-8 shadow-sm hover:shadow-md transition-all group relative",
              showArchived && "opacity-75 grayscale-[0.5]"
            )}>
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Trophy className="w-6 h-6 text-emerald-500" />
                </div>
                <button 
                  onClick={() => showArchived ? handleUnarchive(sweep.id) : handleArchive(sweep.id)}
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    showArchived 
                      ? "text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50" 
                      : "text-zinc-400 hover:text-red-500 hover:bg-red-50"
                  )}
                  title={showArchived ? "Desarquivar" : "Arquivar"}
                >
                  {showArchived ? <RefreshCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                </button>
              </div>
              <div className="space-y-1 mb-6">
                <h4 className="text-xl font-bold text-zinc-800">{sweep.name}</h4>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  {sweep.objective}
                </p>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 uppercase font-bold tracking-widest">Data do Sorteio</span>
                  <span className="text-zinc-800 font-bold">{format(new Date(sweep.draw_date), "dd/MM/yyyy")}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 uppercase font-bold tracking-widest">Voucher</span>
                  <span className="text-zinc-800 font-bold">R$ {sweep.voucher_value.toFixed(2)}</span>
                </div>
              </div>

              {!showArchived && (
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleOpenSweep(sweep)}
                    className="flex items-center justify-center gap-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                  >
                    <Users className="w-4 h-4" />
                    Participantes
                  </button>
                  <button 
                    onClick={() => handleDraw(sweep)}
                    className="flex items-center justify-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                  >
                    <Ticket className="w-4 h-4" />
                    Sortear
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

function SweepstakesForm({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    draw_date: '',
    voucher_value: 50,
    prizes_count: 1,
    objective: 'Engajamento e Arrecadação',
    prizes_list: '',
    rules: '1. O sorteio será realizado na data prevista.\n2. Cada R$ 50,00 em compras gera 1 cupom.\n3. O prêmio é pessoal e intransferível.'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
      if (!user) return;

      const { error } = await supabase
        .from('sweepstakes')
        .insert([{
          ...formData,
          user_id: user.id,
          status: 'pending'
        }]);

      if (error) throw error;
      onSave();
    } catch (err) {
      console.error('Error saving sweepstakes:', err);
      alert('Erro ao salvar sorteio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white border border-zinc-200 rounded-[32px] shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="p-8 border-b border-zinc-100 flex items-center gap-4">
        <button onClick={onClose} className="p-2 hover:bg-zinc-50 rounded-lg text-zinc-400 transition-colors">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-bold text-zinc-800">Novo Sorteio</h3>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nome da Campanha</label>
            <input 
              required
              type="text" 
              placeholder="Ex: Sorteio de Natal 2024"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Data do Sorteio</label>
            <input 
              required
              type="date" 
              value={formData.draw_date}
              onChange={e => setFormData({...formData, draw_date: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Valor do Voucher [R$]</label>
            <input 
              required
              type="text" 
              inputMode="decimal"
              value={formData.voucher_value === 0 ? '' : formData.voucher_value}
              onChange={e => {
                const val = e.target.value.replace(',', '.');
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  setFormData({...formData, voucher_value: val === '' ? 0 : Number(val)});
                }
              }}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Qtd. Prêmios a Sortear</label>
            <input 
              required
              type="text" 
              inputMode="numeric"
              value={formData.prizes_count === 0 ? '' : formData.prizes_count}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                setFormData({...formData, prizes_count: val === '' ? 0 : Number(val)});
              }}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Objetivo</label>
          <input 
            required
            type="text" 
            value={formData.objective}
            onChange={e => setFormData({...formData, objective: e.target.value})}
            className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Prêmios</label>
          <textarea 
            placeholder="Liste os prêmios aqui..."
            value={formData.prizes_list}
            onChange={e => setFormData({...formData, prizes_list: e.target.value})}
            className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all min-h-[120px]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Regulamento</label>
          <textarea 
            value={formData.rules}
            onChange={e => setFormData({...formData, rules: e.target.value})}
            className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all min-h-[160px]"
          />
        </div>

        <div className="flex items-center justify-end gap-4 pt-4">
          <button 
            type="button"
            onClick={onClose}
            className="px-8 py-4 text-sm font-bold text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            disabled={loading}
            className="bg-[#00a86b] hover:bg-[#008f5b] text-white px-12 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Salvar Sorteio
          </button>
        </div>
      </form>
    </div>
  );
}

function SweepstakesDetails({ sweep, onBack, onDraw }: { sweep: Sweepstakes; onBack: () => void; onDraw: () => void }) {
  const [participants, setParticipants] = useState<SweepstakesParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchParticipants();
  }, [sweep.id]);

  async function fetchParticipants() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sweepstakes_participants')
        .select('*')
        .eq('sweepstakes_id', sweep.id)
        .order('created_at', { ascending: false })
        .limit(30000);
      if (error) throw error;
      setParticipants(data || []);
    } catch (err) {
      console.error('Error fetching participants:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 transition-colors">
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">{sweep.name}</h2>
            <p className="text-sm text-zinc-500">Gestão de Participantes e Cupons</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <button className="flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-4 py-3 sm:py-2.5 rounded-xl text-xs font-bold transition-all w-full sm:w-auto">
            <Download className="w-4 h-4" />
            Importar das Vendas
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-4 py-3 sm:py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Adicionar Manual
          </button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-[32px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Cupom</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Participante</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Contato</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Valor</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
                  </td>
                </tr>
              ) : participants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-zinc-400 italic">
                    Nenhum participante cadastrado.
                  </td>
                </tr>
              ) : (
                participants.map(p => (
                  <tr key={p.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-8 py-4 text-zinc-500 text-sm">#{p.id.substring(0, 6).toUpperCase()}</td>
                    <td className="px-8 py-4 font-bold text-zinc-800 text-sm">{p.name}</td>
                    <td className="px-8 py-4 text-zinc-500 text-sm">{p.contact}</td>
                    <td className="px-8 py-4 font-bold text-zinc-800 text-sm">R$ {p.paid_amount.toFixed(2)}</td>
                    <td className="px-8 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                        p.status === 'winner' ? "bg-amber-50 text-amber-600" : "bg-zinc-50 text-zinc-400"
                      )}>
                        {p.status === 'winner' ? 'Ganhador' : 'Ativo'}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <button className="p-2 hover:bg-red-50 text-red-400 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdding && (
        <ParticipantModal 
          sweepstakesId={sweep.id} 
          onClose={() => setIsAdding(false)} 
          onSave={() => { setIsAdding(false); fetchParticipants(); }} 
        />
      )}
    </div>
  );
}

function ParticipantModal({ sweepstakesId, onClose, onSave }: { sweepstakesId: string; onClose: () => void; onSave: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    paid_amount: 100
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const coupons = Math.floor(formData.paid_amount / 50);
      const { error } = await supabase
        .from('sweepstakes_participants')
        .insert([{
          sweepstakes_id: sweepstakesId,
          name: formData.name,
          contact: formData.contact,
          paid_amount: formData.paid_amount,
          coupons_count: coupons,
          status: 'active'
        }]);
      if (error) throw error;
      onSave();
    } catch (err) {
      console.error('Error adding participant:', err);
      alert('Erro ao adicionar participante');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-xl font-bold text-zinc-800">Adicionar Participante</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-50 rounded-full transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nome Completo</label>
            <input 
              required
              type="text" 
              placeholder="Nome do participante"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">WhatsApp / Contato</label>
            <input 
              required
              type="text" 
              placeholder="(00) 00000-0000"
              value={formData.contact}
              onChange={e => setFormData({...formData, contact: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Valor Pago [R$]</label>
            <input 
              required
              type="text" 
              inputMode="decimal"
              value={formData.paid_amount === 0 ? '' : formData.paid_amount}
              onChange={e => {
                const val = e.target.value.replace(',', '.');
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  setFormData({...formData, paid_amount: val === '' ? 0 : Number(val)});
                }
              }}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
            />
            <p className="text-[10px] text-zinc-400 italic">Serão gerados {Math.floor(formData.paid_amount / 50)} cupons.</p>
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-8 py-4 text-sm font-bold text-zinc-500 bg-zinc-50 hover:bg-zinc-100 rounded-2xl transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#00a86b] hover:bg-[#008f5b] text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SweepstakesDraw({ sweep, onBack }: { sweep: Sweepstakes; onBack: () => void }) {
  const [participants, setParticipants] = useState<SweepstakesParticipant[]>([]);
  const [winners, setWinners] = useState<SweepstakesParticipant[]>([]);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    fetchParticipants();
  }, [sweep.id]);

  async function fetchParticipants() {
    const { data } = await supabase
      .from('sweepstakes_participants')
      .select('*')
      .eq('sweepstakes_id', sweep.id)
      .limit(30000);
    if (data) {
      setParticipants(data);
      setWinners(data.filter(p => p.status === 'winner'));
    }
  }

  const handleStartDraw = async () => {
    if (participants.length === 0) return;
    setDrawing(true);
    
    // Simulate drawing animation
    await new Promise(resolve => setTimeout(resolve, 3000));

    const eligible = participants.filter(p => p.status === 'active');
    if (eligible.length === 0) {
      setDrawing(false);
      return;
    }

    const winner = eligible[Math.floor(Math.random() * eligible.length)];
    
    try {
      const { error } = await supabase
        .from('sweepstakes_participants')
        .update({ status: 'winner' })
        .eq('id', winner.id);
      
      if (error) throw error;
      
      setWinners([...winners, { ...winner, status: 'winner' }]);
      setParticipants(participants.map(p => p.id === winner.id ? { ...p, status: 'winner' } : p));
    } catch (err) {
      console.error('Error recording winner:', err);
    } finally {
      setDrawing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 transition-colors">
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">Realizar Sorteio</h2>
          <p className="text-sm text-zinc-500">{sweep.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-zinc-200 rounded-[40px] p-10 shadow-sm space-y-8">
          <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6">
            <p className="text-xs font-bold text-amber-800 leading-relaxed">
              <span className="text-amber-600">Atenção:</span> O sorteio é aleatório e irrevogável. Certifique-se de que todos os participantes foram cadastrados antes de iniciar.
            </p>
          </div>

          <div className="space-y-6">
            <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-widest">Resumo da Campanha</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-50 rounded-3xl p-6">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Total Cupons</p>
                <p className="text-3xl font-bold text-zinc-800">{participants.reduce((acc, p) => acc + p.coupons_count, 0)}</p>
              </div>
              <div className="bg-zinc-50 rounded-3xl p-6">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Prêmios</p>
                <p className="text-3xl font-bold text-zinc-800">{sweep.prizes_count}</p>
              </div>
            </div>
          </div>

          <button 
            onClick={handleStartDraw}
            disabled={drawing || winners.length >= sweep.prizes_count}
            className={cn(
              "w-full py-6 rounded-3xl font-bold text-lg flex items-center justify-center gap-4 transition-all shadow-xl",
              drawing 
                ? "bg-emerald-100 text-emerald-600" 
                : winners.length >= sweep.prizes_count
                  ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                  : "bg-[#00a86b] hover:bg-[#008f5b] text-white shadow-emerald-500/20"
            )}
          >
            {drawing ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Sorteando...
              </>
            ) : (
              <>
                <Trophy className="w-6 h-6" />
                Iniciar Sorteio
              </>
            )}
          </button>
        </div>

        <div className="bg-white border border-zinc-200 rounded-[40px] p-10 shadow-sm space-y-8">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-emerald-500" />
            <h3 className="font-bold text-zinc-800">Ganhadores da Campanha</h3>
          </div>

          <div className="space-y-4">
            {winners.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <Ticket className="w-12 h-12 text-zinc-100 mx-auto" />
                <p className="text-zinc-400 text-sm italic">Nenhum ganhador ainda.</p>
              </div>
            ) : (
              winners.map((winner, idx) => (
                <div key={winner.id} className="flex items-center gap-4 bg-emerald-50 border border-emerald-100 rounded-3xl p-6 animate-in zoom-in-95 duration-500">
                  <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                    <Trophy className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Ganhador #{idx + 1}</p>
                    <p className="text-xl font-bold text-zinc-800">{winner.name}</p>
                    <p className="text-xs text-zinc-500">{winner.contact}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
