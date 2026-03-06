import React, { useEffect, useState } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Lock,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { cn } from '../lib/utils';

export function AdminPanel() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    // Real-time subscriptions for immediate updates
    const profilesSubscription = supabase
      .channel('admin-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .subscribe();

    return () => {
      profilesSubscription.unsubscribe();
    };
  }, []);

  async function fetchData() {
    const { data } = await supabase.from('profiles').select('*').order('nome');
    if (data) setUsers(data);
    setLoading(false);
  }

  const updateUserStatus = async (userId: string, status: 'PRO' | 'PAGO' | 'PENDENTE') => {
    const selectedUser = users.find(u => u.id === userId);
    if (!selectedUser) return;

    if (!confirm(`Deseja alterar o status para ${status} para ${selectedUser.nome || selectedUser.email}?`)) return;

    setLoading(true);
    try {
      const updates: any = { status_pagamento: status };
      if (status === 'PRO') {
        updates.access_key_code = 'PRO-ACCESS';
        updates.plan = 'Pro';
      } else if (status === 'PENDENTE') {
        updates.access_key_code = null;
        updates.plan = null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (error) throw error;
      
      alert(`Status alterado para ${status} com sucesso!`);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Erro ao alterar status');
    } finally {
      setLoading(false);
    }
  };

  const toggleBlockUser = async (userId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_blocked: !currentStatus })
      .eq('id', userId);

    if (error) {
      alert('Erro ao alterar status do usuário');
    } else {
      fetchData();
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta chave?')) return;
    await supabase.from('access_key').delete().eq('id', id);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 max-w-full overflow-x-hidden">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-zinc-800 uppercase tracking-tight">Gestão Administrativa</h2>
          <p className="text-xs text-zinc-500">Controle de usuários e acessos PRO.</p>
        </div>
      </div>

      {/* Users Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-2">
          <Users className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-zinc-800 text-sm uppercase tracking-wider">Usuários e Status</h3>
        </div>
        <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-zinc-50/50 border-b border-zinc-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Usuário</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Chave</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {users.map((user) => (
                  <tr key={user.id} className={cn(
                    "hover:bg-zinc-50/30 transition-colors",
                    user.is_blocked && "bg-red-50/30"
                  )}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                          {user.nome?.substring(0, 2).toUpperCase() || '??'}
                        </div>
                        <div>
                          <p className="font-bold text-zinc-800 text-sm">{user.nome || 'Sem Nome'}</p>
                          <p className="text-[10px] text-zinc-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {user.access_key_code ? (
                        <span className="font-mono text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                          {user.access_key_code}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-300 italic">Sem chave</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase",
                        user.is_blocked 
                          ? "bg-red-100 text-red-700" 
                          : user.status_pagamento === 'PRO'
                            ? "bg-amber-100 text-amber-700"
                            : user.status_pagamento === 'PAGO' 
                              ? "bg-emerald-100 text-emerald-700" 
                              : "bg-zinc-100 text-zinc-500"
                      )}>
                        {user.is_blocked ? 'BLOQUEADO' : (user.status_pagamento || 'PENDENTE')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {user.role !== 'admin' && (
                          <>
                            {user.status_pagamento !== 'PENDENTE' && (
                              <button 
                                onClick={() => updateUserStatus(user.id, 'PENDENTE')}
                                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 text-zinc-400 hover:bg-zinc-100 rounded-lg text-[10px] font-bold transition-all"
                                title="Resetar para Pendente"
                              >
                                RESET
                              </button>
                            )}
                            <button 
                              onClick={() => updateUserStatus(user.id, 'PAGO')}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                user.status_pagamento === 'PAGO' 
                                  ? "bg-emerald-500 text-white" 
                                  : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                              )}
                            >
                              PAGO
                            </button>
                            <button 
                              onClick={() => updateUserStatus(user.id, 'PRO')}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                user.status_pagamento === 'PRO' 
                                  ? "bg-amber-500 text-white" 
                                  : "bg-amber-50 text-amber-600 hover:bg-amber-100"
                              )}
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              PRO
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => toggleBlockUser(user.id, !!user.is_blocked)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                            user.is_blocked 
                              ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" 
                              : "bg-red-50 text-red-600 hover:bg-red-100"
                          )}
                        >
                          {user.is_blocked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          {user.is_blocked ? 'Desbloquear' : 'Bloquear'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
