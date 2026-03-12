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
  RefreshCcw,
  Link as LinkIcon,
  Eye,
  Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Raffle, RaffleTicket } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ConfirmationModal } from './ConfirmationModal';

export function RafflesManager() {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'details'>('list');
  const [selectedRaffle, setSelectedRaffle] = useState<Raffle | null>(null);

  useEffect(() => {
    fetchRaffles();
  }, []);

  async function fetchRaffles() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from('raffles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setRaffles(data || []);
    } catch (err) {
      console.error('Error fetching raffles:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenRaffle = (raffle: Raffle) => {
    setSelectedRaffle(raffle);
    setView('details');
  };

  const shareLink = async (raffle: Raffle) => {
    const url = `${window.location.origin}/rifa/${raffle.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Rifa: ${raffle.title}`,
          text: `Participe da rifa "${raffle.title}" e concorra a prêmios!`,
          url: url,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
          // Fallback
          navigator.clipboard.writeText(url);
          alert('Link copiado para a área de transferência!');
        }
      }
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copiado para a área de transferência!');
    }
  };

  if (view === 'create') {
    return <RaffleForm onClose={() => setView('list')} onSave={() => { setView('list'); fetchRaffles(); }} />;
  }

  if (view === 'details' && selectedRaffle) {
    return <RaffleDetails raffle={selectedRaffle} onBack={() => setView('list')} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-zinc-800">Rifas Ativas</h3>
        <button 
          onClick={() => setView('create')}
          className="flex items-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-5 h-5" />
          Nova Rifa
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
          </div>
        ) : raffles.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white border border-dashed border-zinc-200 rounded-[32px] space-y-4">
            <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto">
              <Ticket className="w-8 h-8 text-zinc-200" />
            </div>
            <p className="text-zinc-400 font-medium">
              Nenhuma rifa criada. Comece agora!
            </p>
          </div>
        ) : (
          raffles.map(raffle => (
            <div key={raffle.id} className="bg-white border border-zinc-100 rounded-[32px] p-8 shadow-sm hover:shadow-md transition-all group relative">
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Ticket className="w-6 h-6 text-emerald-500" />
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                  raffle.status === 'active' ? "bg-emerald-100 text-emerald-700" :
                  raffle.status === 'finished' ? "bg-zinc-100 text-zinc-500" :
                  "bg-amber-100 text-amber-700"
                )}>
                  {raffle.status === 'active' ? 'Ativa' : raffle.status === 'finished' ? 'Finalizada' : 'Rascunho'}
                </span>
              </div>
              <div className="space-y-1 mb-6">
                <h4 className="text-xl font-bold text-zinc-800">{raffle.title}</h4>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold flex items-center gap-1.5">
                  <Trophy className="w-3 h-3" />
                  {raffle.prizes.length} Prêmios
                </p>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 uppercase font-bold tracking-widest">Valor do Número</span>
                  <span className="text-zinc-800 font-bold">R$ {raffle.ticket_price.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 uppercase font-bold tracking-widest">Total de Números</span>
                  <span className="text-zinc-800 font-bold">{raffle.total_tickets}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => handleOpenRaffle(raffle)}
                  className="flex items-center justify-center gap-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                >
                  <Eye className="w-4 h-4" />
                  Gerenciar
                </button>
                <button 
                  onClick={() => shareLink(raffle)}
                  className="flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                >
                  <LinkIcon className="w-4 h-4" />
                  Compartilhar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RaffleForm({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    rules: '1. O sorteio será realizado após a venda de todos os números.\n2. O pagamento deve ser confirmado enviando o comprovante.\n3. Números reservados sem pagamento serão liberados após 24h.',
    ticket_price: 10,
    total_tickets: 100,
    prizes: [''],
    payment_info: ''
  });

  const handleAddPrize = () => {
    setFormData({ ...formData, prizes: [...formData.prizes, ''] });
  };

  const handlePrizeChange = (index: number, value: string) => {
    const newPrizes = [...formData.prizes];
    newPrizes[index] = value;
    setFormData({ ...formData, prizes: newPrizes });
  };

  const handleRemovePrize = (index: number) => {
    const newPrizes = formData.prizes.filter((_, i) => i !== index);
    setFormData({ ...formData, prizes: newPrizes });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const validPrizes = formData.prizes.filter(p => p.trim() !== '');

      const { error } = await supabase
        .from('raffles')
        .insert([{
          user_id: user.id,
          title: formData.title,
          description: formData.description,
          rules: formData.rules,
          ticket_price: formData.ticket_price,
          total_tickets: formData.total_tickets,
          prizes: validPrizes,
          payment_info: formData.payment_info,
          status: 'active'
        }]);

      if (error) throw error;
      onSave();
    } catch (err) {
      console.error('Error saving raffle:', err);
      alert('Erro ao criar rifa');
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
        <h3 className="text-xl font-bold text-zinc-800">Nova Rifa</h3>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Título da Rifa</label>
          <input 
            required
            type="text" 
            placeholder="Ex: Rifa de um iPhone 15"
            value={formData.title}
            onChange={e => setFormData({...formData, title: e.target.value})}
            className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Valor do Número [R$]</label>
            <input 
              required
              type="text" 
              inputMode="decimal"
              value={formData.ticket_price === 0 ? '' : formData.ticket_price}
              onChange={e => {
                const val = e.target.value.replace(',', '.');
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  setFormData({...formData, ticket_price: val === '' ? 0 : Number(val)});
                }
              }}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Quantidade de Números</label>
            <input 
              required
              type="text" 
              inputMode="numeric"
              value={formData.total_tickets === 0 ? '' : formData.total_tickets}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                setFormData({...formData, total_tickets: val === '' ? 0 : Number(val)});
              }}
              className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Descrição (Opcional)</label>
          <textarea 
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
            className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all min-h-[100px]"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Prêmios</label>
            <button 
              type="button"
              onClick={handleAddPrize}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              + Adicionar Prêmio
            </button>
          </div>
          {formData.prizes.map((prize, index) => (
            <div key={index} className="flex gap-2">
              <input 
                required
                type="text" 
                placeholder={`Prêmio ${index + 1}`}
                value={prize}
                onChange={e => handlePrizeChange(index, e.target.value)}
                className="flex-1 bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
              />
              {formData.prizes.length > 1 && (
                <button 
                  type="button"
                  onClick={() => handleRemovePrize(index)}
                  className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Informações de Pagamento (Chave PIX, etc)</label>
          <textarea 
            required
            placeholder="Ex: Chave PIX Celular: (11) 99999-9999 - Nome: João Silva"
            value={formData.payment_info}
            onChange={e => setFormData({...formData, payment_info: e.target.value})}
            className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all min-h-[100px]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Regras da Rifa (Não poderão ser alteradas depois)</label>
          <textarea 
            required
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
            Criar Rifa
          </button>
        </div>
      </form>
    </div>
  );
}

function RaffleDetails({ raffle, onBack }: { raffle: Raffle; onBack: () => void }) {
  const [tickets, setTickets] = useState<RaffleTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, [raffle.id]);

  async function fetchTickets() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('raffle_tickets')
        .select('*')
        .eq('raffle_id', raffle.id)
        .order('number', { ascending: true });
      if (error) throw error;
      setTickets(data || []);
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleApprovePayment = async (ticketId: string) => {
    try {
      const { error } = await supabase
        .from('raffle_tickets')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', ticketId);
      
      if (error) throw error;
      fetchTickets();
    } catch (err) {
      console.error('Error approving payment:', err);
      alert('Erro ao aprovar pagamento');
    }
  };

  const handleRejectPayment = async (ticketId: string) => {
    if (!window.confirm('Tem certeza que deseja rejeitar este pagamento e liberar o número?')) return;
    try {
      const { error } = await supabase
        .from('raffle_tickets')
        .delete()
        .eq('id', ticketId);
      
      if (error) throw error;
      fetchTickets();
    } catch (err) {
      console.error('Error rejecting payment:', err);
      alert('Erro ao rejeitar pagamento');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 transition-colors">
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">{raffle.title}</h2>
            <p className="text-sm text-zinc-500">Gestão de Números e Pagamentos</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-[32px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Número</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Comprador</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Contato</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Comprovante</th>
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
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-zinc-400 italic">
                    Nenhum número reservado ainda.
                  </td>
                </tr>
              ) : (
                tickets.map(t => (
                  <tr key={t.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-8 py-4 text-zinc-800 font-bold text-lg">{String(t.number).padStart(3, '0')}</td>
                    <td className="px-8 py-4 font-bold text-zinc-800 text-sm">
                      {t.buyer_name}
                      <p className="text-xs text-zinc-400 font-normal">CPF: {t.buyer_cpf}</p>
                    </td>
                    <td className="px-8 py-4 text-zinc-500 text-sm">{t.buyer_phone}</td>
                    <td className="px-8 py-4">
                      {t.receipt_url ? (
                        <a href={t.receipt_url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 text-xs font-bold flex items-center gap-1">
                          <Eye className="w-4 h-4" /> Ver Comprovante
                        </a>
                      ) : (
                        <span className="text-zinc-400 text-xs italic">Aguardando envio</span>
                      )}
                    </td>
                    <td className="px-8 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                        t.status === 'paid' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      )}>
                        {t.status === 'paid' ? 'Pago' : 'Reservado'}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      {t.status === 'reserved' && (
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleApprovePayment(t.id)}
                            className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors"
                            title="Aprovar Pagamento"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleRejectPayment(t.id)}
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                            title="Rejeitar e Liberar Número"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
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
