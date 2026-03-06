import React, { useEffect, useState } from 'react';
import { 
  User, 
  Save, 
  MapPin, 
  CreditCard, 
  ShieldCheck, 
  Smartphone, 
  Instagram,
  FileText,
  Upload,
  CheckCircle2,
  Crown,
  Key,
  Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { cn } from '../lib/utils';

export function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (data) setProfile(data);
      }
      setLoading(false);
    }
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(profile)
        .eq('id', profile.id);
      
      if (error) throw error;
      alert('Cadastro salvo com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar cadastro.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-12">
      {profile?.is_blocked && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-700">
          <ShieldCheck className="w-6 h-6 shrink-0" />
          <div>
            <p className="font-bold text-sm">Acesso Restrito</p>
            <p className="text-xs opacity-80">Seu cadastro está bloqueado por inadimplência. Entre em contato com o administrador.</p>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-800">Meu Cadastro</h2>
          <p className="text-sm text-zinc-500">Mantenha seus dados atualizados para melhor experiência.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-8 py-3 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Salvar
        </button>
      </div>

      {/* Dados Pessoais */}
      <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-6 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-3">
          <User className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-zinc-800">Dados Pessoais</h3>
        </div>
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nome Completo *</label>
            <input 
              type="text" 
              value={profile?.nome || ''} 
              onChange={(e) => setProfile({...profile, nome: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-emerald-500 outline-none transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">CPF *</label>
            <input 
              type="text" 
              value={profile?.cpf || ''} 
              onChange={(e) => setProfile({...profile, cpf: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-emerald-500 outline-none transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nascimento</label>
              <input 
                type="date" 
                value={profile?.data_nascimento || ''} 
                onChange={(e) => setProfile({...profile, data_nascimento: e.target.value})}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-emerald-500 outline-none transition-colors text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Gênero</label>
              <select 
                value={profile?.genero || ''} 
                onChange={(e) => setProfile({...profile, genero: e.target.value})}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-emerald-500 outline-none transition-colors text-sm"
              >
                <option value="">Selecionar</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">WhatsApp *</label>
            <input 
              type="text" 
              value={profile?.whatsapp || ''} 
              onChange={(e) => setProfile({...profile, whatsapp: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-emerald-500 outline-none transition-colors"
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Foto do Documento (Opcional)</label>
            <div className="border-2 border-dashed border-zinc-100 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center gap-3 hover:border-emerald-500/50 transition-colors cursor-pointer group bg-zinc-50/50">
              {profile?.documento_url ? (
                <div className="flex items-center gap-2 text-emerald-600 font-bold">
                  <CheckCircle2 className="w-6 h-6" />
                  Documento Carregado
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
                  <span className="text-zinc-400 group-hover:text-zinc-600 transition-colors text-sm font-medium">Clique para anexar foto do documento</span>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Endereço */}
      <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-6 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-3">
          <MapPin className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-zinc-800">Endereço Residencial</h3>
        </div>
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">CEP</label>
            <input 
              type="text" 
              value={profile?.cep || ''} 
              onChange={(e) => setProfile({...profile, cep: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-emerald-500 outline-none transition-colors"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Bairro</label>
            <input 
              type="text" 
              value={profile?.bairro || ''} 
              onChange={(e) => setProfile({...profile, bairro: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-emerald-500 outline-none transition-colors"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Logradouro</label>
            <input 
              type="text" 
              value={profile?.logradouro || ''} 
              onChange={(e) => setProfile({...profile, logradouro: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-emerald-500 outline-none transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Número / Complemento</label>
            <input 
              type="text" 
              value={profile?.numero_complemento || ''} 
              onChange={(e) => setProfile({...profile, numero_complemento: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-emerald-500 outline-none transition-colors"
            />
          </div>
          <div className="md:col-span-3 space-y-4">
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-bold text-zinc-700">Localização GPS</span>
              </div>
              <span className="text-xs font-mono text-zinc-400 bg-white px-3 py-1 rounded-lg border border-zinc-100">
                Lat: {profile?.latitude || '-27.136047'} | Lng: {profile?.longitude || '-48.604275'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Configurações de Pagamento (PIX) */}
      <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-6 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-zinc-800">Configurações de Pagamento (PIX)</h3>
        </div>
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Chave PIX</label>
            <input 
              type="text" 
              placeholder="E-mail, CPF, Celular ou Chave Aleatória"
              value={profile?.pix_key || ''} 
              onChange={(e) => setProfile({...profile, pix_key: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-emerald-500 outline-none transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nome do Beneficiário</label>
            <input 
              type="text" 
              placeholder="Nome completo do titular da conta"
              value={profile?.pix_beneficiary || ''} 
              onChange={(e) => setProfile({...profile, pix_beneficiary: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-emerald-500 outline-none transition-colors"
            />
          </div>
          <div className="md:col-span-2">
            <p className="text-[10px] text-zinc-400 italic">
              * Estes dados serão utilizados para gerar o QR Code de pagamento durante o acerto das sacolas.
            </p>
          </div>
        </div>
      </section>

      {/* Status de Acesso */}
      <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-6 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-zinc-800">Status de Acesso</h3>
        </div>
        <div className="p-4 sm:p-6 space-y-6">
          <div className="bg-zinc-50 rounded-2xl p-4 sm:p-6 border border-zinc-100 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status do Acesso</p>
              <h4 className="text-lg font-bold text-zinc-800 flex items-center gap-2">
                {profile?.role === 'admin' ? 'Administrador' : (profile?.access_key_code ? 'Acesso PRO Liberado' : 'Aguardando Liberação')}
                {(profile?.role === 'admin' || profile?.access_key_code) && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg uppercase font-bold">Ativo</span>
                )}
              </h4>
              {profile?.vencimento && <p className="text-xs text-zinc-500">Vencimento: {new Date(profile.vencimento).toLocaleDateString()}</p>}
            </div>
            <div className="flex-1 max-w-md space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-3 h-3" /> Identificador de Acesso
              </label>
              <input 
                type="text" 
                readOnly
                value={profile?.access_key_code || 'Acesso não liberado'} 
                className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-500 font-mono outline-none shadow-sm cursor-not-allowed"
              />
              <p className="text-[10px] text-zinc-400">O seu acesso é liberado manualmente pelo administrador.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
        <button className="hover:text-zinc-600 transition-colors">Privacidade</button>
        <span>•</span>
        <button className="hover:text-zinc-600 transition-colors">Termos</button>
      </div>
    </div>
  );
}
