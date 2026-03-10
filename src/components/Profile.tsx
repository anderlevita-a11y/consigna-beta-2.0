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
  Loader2,
  Eye,
  Trash2,
  X,
  ShieldAlert
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { cn } from '../lib/utils';
import { loadStripe } from '@stripe/stripe-js';

export function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [legalSettings, setLegalSettings] = useState<any>(null);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms'>('privacy');

  useEffect(() => {
    async function fetchProfile() {
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (data) setProfile(data);

        // Fetch legal settings for the footer links
        const { data: legalData } = await supabase
          .from('app_legal_settings')
          .select('*')
          .single();
        if (legalData) setLegalSettings(legalData);
      }
      setLoading(false);
    }
    fetchProfile();
  }, []);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Usuário não autenticado');

      // Use the direct Stripe Payment Link provided by the user
      const paymentLink = 'https://buy.stripe.com/00w9AL9hc7yb5cvcta1sQ00';
      
      // Append user ID and email to the payment link so the webhook can identify the user
      const url = new URL(paymentLink);
      url.searchParams.append('client_reference_id', user.id);
      if (user.email) {
        url.searchParams.append('prefilled_email', user.email);
      }

      window.location.href = url.toString();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao iniciar checkout: ' + (err.message || 'Tente novamente.'));
    } finally {
      setUpgrading(false);
    }
  };

  const handleCheckout = async () => {
    setUpgrading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Usuário não autenticado');

      // Use the direct Stripe Payment Link provided by the user
      const paymentLink = 'https://buy.stripe.com/00w9AL9hc7yb5cvcta1sQ00';
      
      // Append user ID and email to the payment link so the webhook can identify the user
      const url = new URL(paymentLink);
      url.searchParams.append('client_reference_id', user.id);
      if (user.email) {
        url.searchParams.append('prefilled_email', user.email);
      }

      window.location.href = url.toString();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao iniciar checkout: ' + (err.message || 'Tente novamente.'));
    } finally {
      setUpgrading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Remove immutable fields from profile
      const { id, email, role, created_at, ...updateData } = profile;

      // Ensure empty strings are sent as null to avoid Supabase errors
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === '') {
          updateData[key] = null;
        }
      });

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id);
      
      if (error) throw error;
      alert('Cadastro salvo com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar cadastro: ' + (err.message || 'Verifique os dados e tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
      if (!user) throw new Error('Usuário não autenticado');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Math.random()}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      setProfile({ ...profile, documento_url: publicUrl });
      alert('Documento carregado com sucesso! Não esqueça de salvar o cadastro.');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao carregar documento: ' + (err.message || 'Tente novamente.'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!profile?.documento_url) return;
    
    if (!confirm('Deseja realmente excluir a foto do documento?')) return;

    try {
      // Extract path from public URL
      // Example URL: https://.../storage/v1/object/public/documents/documents/user_id/random.jpg
      const urlParts = profile.documento_url.split('/object/public/documents/');
      if (urlParts.length < 2) throw new Error('URL de documento inválida');
      const filePath = urlParts[1];

      const { error } = await supabase.storage
        .from('documents')
        .remove([filePath]);

      if (error) throw error;

      setProfile({ ...profile, documento_url: null });
      alert('Documento removido. Salve o cadastro para confirmar.');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao remover documento: ' + (err.message || 'Tente novamente.'));
    }
  };

  const isTrial = profile?.status_pagamento === 'TRIAL';
  const trialEnd = isTrial && profile?.vencimento ? new Date(profile.vencimento) : null;
  const now = new Date();
  const diffTime = trialEnd ? trialEnd.getTime() - now.getTime() : 0;
  const diffDays = trialEnd ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;
  const isTrialExpiringSoon = isTrial && diffDays === 1;
  const isTrialExpired = isTrial && diffDays <= 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#38a89d] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-12">
      {isTrialExpiringSoon && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-800">Seu período de teste grátis termina amanhã!</h4>
            <p className="text-xs text-amber-700 mt-1">Prepare-se para fazer o upgrade e continuar aproveitando todos os recursos do sistema sem interrupções.</p>
          </div>
        </div>
      )}

      {isTrialExpired && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-red-800">Seu período de teste grátis expirou.</h4>
            <p className="text-xs text-red-700 mt-1">Faça o upgrade agora para continuar usando o sistema.</p>
          </div>
        </div>
      )}

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
          <h2 className="text-xl sm:text-2xl font-bold text-[#4a1d33]">Meu Cadastro</h2>
          <p className="text-sm text-zinc-500">Mantenha seus dados atualizados para melhor experiência.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 bg-[#38a89d] hover:bg-[#2d8a81] text-white px-8 py-3 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50"
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
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">E-mail (Login)</label>
            <input 
              type="email" 
              readOnly
              value={profile?.email || ''} 
              className="w-full bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-500 cursor-not-allowed outline-none"
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
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Instagram</label>
            <div className="relative">
              <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder="@seu.perfil"
                value={profile?.instagram || ''} 
                onChange={(e) => setProfile({...profile, instagram: e.target.value})}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-10 pr-4 py-3 text-zinc-800 focus:border-emerald-500 outline-none transition-colors"
              />
            </div>
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Foto do Documento (Opcional)</label>
            <div className="relative">
              <input 
                type="file" 
                id="doc-upload"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              
              {profile?.documento_url ? (
                <div className="border-2 border-dashed border-emerald-500/30 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center gap-4 bg-emerald-50/30">
                  <div className="flex items-center gap-2 text-emerald-600 font-bold">
                    <CheckCircle2 className="w-6 h-6" />
                    Documento Carregado
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setShowViewer(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-emerald-200 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-all"
                    >
                      <Eye className="w-4 h-4" />
                      Visualizar
                    </button>
                    <button 
                      onClick={handleDeleteDocument}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                  </div>
                </div>
              ) : (
                <label 
                  htmlFor="doc-upload"
                  className={cn(
                    "border-2 border-dashed border-zinc-100 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center gap-3 hover:border-emerald-500/50 transition-colors cursor-pointer group bg-zinc-50/50",
                    uploading && "opacity-50 cursor-wait"
                  )}
                >
                  {uploading ? (
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                  ) : (
                    <Upload className="w-8 h-8 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
                  )}
                  <span className="text-zinc-400 group-hover:text-zinc-600 transition-colors text-sm font-medium">
                    {uploading ? 'Carregando...' : 'Clique para anexar foto do documento'}
                  </span>
                </label>
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
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Cidade</label>
            <input 
              type="text" 
              value={profile?.cidade || ''} 
              onChange={(e) => setProfile({...profile, cidade: e.target.value})}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 focus:border-emerald-500 outline-none transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Estado</label>
            <input 
              type="text" 
              value={profile?.estado || ''} 
              onChange={(e) => setProfile({...profile, estado: e.target.value})}
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
                {profile?.role === 'admin' ? 'Administrador' : (profile?.plano_tipo === 'pro' ? 'Assinante PRO' : (isTrial ? 'Período de Teste' : (profile?.access_key_code ? 'Acesso PRO Liberado' : 'Aguardando Liberação')))}
                {(profile?.role === 'admin' || profile?.access_key_code || profile?.plano_tipo === 'pro') && (
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-lg uppercase font-bold", isTrial ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700")}>
                    {isTrial ? 'Trial' : 'Ativo'}
                  </span>
                )}
              </h4>
              {profile?.vencimento && <p className="text-xs text-zinc-500">Vencimento: {new Date(profile.vencimento).toLocaleDateString()}</p>}
              {isTrial && (
                <p className={cn("text-xs font-bold mt-1", diffDays > 1 ? "text-blue-600" : (diffDays === 1 ? "text-amber-600" : "text-red-600"))}>
                  {diffDays > 1 ? `Faltam ${diffDays} dias para o fim do teste` : (diffDays === 1 ? 'Termina amanhã' : 'Teste expirado')}
                </p>
              )}
              {profile?.plano_tipo === 'pro' && <p className="text-xs text-emerald-600 font-bold">Plano PRO Ativo via Stripe</p>}
            </div>
            <div className="flex-1 max-w-md space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-3 h-3" /> Identificador de Acesso
              </label>
              <input 
                type="text" 
                readOnly
                value={profile?.access_key_code || (profile?.plano_tipo === 'pro' ? 'ASSINATURA_PRO' : 'Acesso não liberado')} 
                className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-500 font-mono outline-none shadow-sm cursor-not-allowed"
              />
              <p className="text-[10px] text-zinc-400">O seu acesso é liberado manualmente pelo administrador ou via assinatura PRO.</p>
              
              {false && profile?.role !== 'admin' && profile?.plano_tipo !== 'pro' && (
                <button 
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20"
                >
                  {upgrading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crown className="w-5 h-5" />}
                  Assinar Promo Lançamento (R$ 30,00)
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Promo Lançamento Card */}
      {false && (!profile?.plano_tipo || profile?.plano_tipo !== 'pro') && profile?.role !== 'admin' && (
        <section className="bg-gradient-to-br from-[#38a89d] to-[#2d8a81] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Crown className="w-32 h-32" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-sm font-bold uppercase tracking-widest">
                <Crown className="w-4 h-4" />
                Promo Lançamento
              </div>
              <h3 className="text-3xl md:text-4xl font-bold">Consigna Beauty PRO</h3>
              <p className="text-emerald-50 max-w-md text-sm md:text-base opacity-90">
                Tenha acesso ilimitado a todas as ferramentas de gestão, rotas otimizadas e controle financeiro avançado.
              </p>
              <div className="flex items-baseline gap-2 justify-center md:justify-start">
                <span className="text-5xl font-black">R$ 30,00</span>
                <span className="text-emerald-100 font-medium">/mês</span>
              </div>
            </div>
            <div className="w-full md:w-auto">
              <button 
                onClick={handleCheckout}
                disabled={upgrading}
                className="w-full md:w-auto px-8 py-4 bg-white text-[#38a89d] hover:bg-zinc-50 rounded-2xl font-black text-lg transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center justify-center gap-3 disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {upgrading ? <Loader2 className="w-6 h-6 animate-spin" /> : <CreditCard className="w-6 h-6" />}
                Assinar Agora
              </button>
              <p className="text-center text-xs text-emerald-100 mt-3 font-medium">
                Pagamento seguro via Stripe
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
        <button 
          onClick={() => { setLegalTab('privacy'); setShowLegalModal(true); }}
          className="hover:text-zinc-600 transition-colors"
        >
          Privacidade
        </button>
        <span>•</span>
        <button 
          onClick={() => { setLegalTab('terms'); setShowLegalModal(true); }}
          className="hover:text-zinc-600 transition-colors"
        >
          Termos
        </button>
      </div>

      {/* Legal Modal for re-reading */}
      {showLegalModal && legalSettings && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">
                    {legalTab === 'privacy' ? 'Política de Privacidade' : 'Termos de Uso'}
                  </h3>
                  <p className="text-[10px] text-zinc-500">Versão {legalSettings.version} • Atualizado em {new Date(legalSettings.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowLegalModal(false)}
                className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/30">
              <div className="prose prose-sm max-w-none text-zinc-600">
                {/* We use a simple pre-wrap for now or could import ReactMarkdown if needed, 
                    but since it's already used in LegalConfirmationModal, we'll just show it simply here 
                    to avoid adding more dependencies if not needed, but wait, we already have react-markdown */}
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {legalTab === 'privacy' ? legalSettings.privacy_policy : legalSettings.terms_of_use}
                </pre>
              </div>
            </div>
            <div className="p-4 border-t border-zinc-100 bg-white flex justify-end">
              <button 
                onClick={() => setShowLegalModal(false)}
                className="px-6 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl text-xs font-bold transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {showViewer && profile?.documento_url && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative max-w-4xl w-full h-full flex flex-col items-center justify-center gap-4">
            <button 
              onClick={() => setShowViewer(false)}
              className="absolute top-0 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={profile.documento_url} 
              alt="Documento" 
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
              referrerPolicy="no-referrer"
            />
            <p className="text-white font-bold text-sm tracking-widest uppercase">Visualização do Documento</p>
          </div>
        </div>
      )}
    </div>
  );
}
