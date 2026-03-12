/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Products } from './components/Products';
import { Bags } from './components/Bags';
import { Customers } from './components/Customers';
import { Campaigns } from './components/Campaigns';
import { Routes } from './components/Routes';
import { Reports } from './components/Reports';
import { SweepstakesManager } from './components/Sweepstakes';
import { Simulation } from './components/Simulation';
import { ProfileScreen } from './components/Profile';
import { Login } from './components/Login';
import { AdminPanel } from './components/AdminPanel';
import { VirtualStore } from './components/VirtualStore';
import { StoreSettings } from './components/StoreSettings';
import { SmartNotepad } from './components/SmartNotepad';
import { FinancialControl } from './components/FinancialControl';
import { BillingManagement } from './components/BillingManagement';
import { LegalConfirmationModal } from './components/LegalConfirmationModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { PublicRaffle } from './components/PublicRaffle';
import { PublicMysteryBag } from './components/PublicMysteryBag';
import { PublicGoals } from './components/PublicGoals';
import { Settings, Loader2, Megaphone, BarChart3, Ticket, Calculator, ShieldAlert, Menu, StickyNote, DollarSign } from 'lucide-react';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { StoreSettings as StoreSettingsType, ProductReview, Profile, AppLegalSettings } from './types';

import { NotificationProvider, NotificationCenter, SystemAlert, useNotifications } from './components/NotificationCenter';

export default function App() {
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [raffleId, setRaffleId] = useState<string | null>(null);
  const [mysteryBagId, setMysteryBagId] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [showAllGoals, setShowAllGoals] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('s') || params.get('store');
    if (s) {
      setStoreSlug(s);
    }

    const path = window.location.pathname;
    
    // Check query parameters first (better for static hosting)
    const rifaParam = params.get('rifa');
    const sacolaParam = params.get('sacola');
    const metasParam = params.get('metas');
    const metasEBrindesParam = params.get('metas-e-brindes');

    if (rifaParam) {
      setRaffleId(rifaParam);
    } else if (path.startsWith('/rifa/')) {
      const id = path.split('/rifa/')[1];
      if (id) {
        setRaffleId(id);
      }
    } else if (sacolaParam) {
      setMysteryBagId(sacolaParam);
    } else if (path.startsWith('/sacola/')) {
      const id = path.split('/sacola/')[1];
      if (id) {
        setMysteryBagId(id);
      }
    } else if (metasParam) {
      setGoalId(metasParam);
    } else if (path.startsWith('/metas/')) {
      const id = path.split('/metas/')[1];
      if (id) {
        setGoalId(id);
      }
    } else if (metasEBrindesParam === 'true' || path === '/metas-e-brindes') {
      setShowAllGoals(true);
    }
  }, []);

  if (raffleId) {
    return (
      <NotificationProvider>
        <PublicRaffle />
      </NotificationProvider>
    );
  }

  if (mysteryBagId) {
    return (
      <NotificationProvider>
        <PublicMysteryBag />
      </NotificationProvider>
    );
  }

  if (goalId || showAllGoals) {
    return (
      <NotificationProvider>
        <PublicGoals />
      </NotificationProvider>
    );
  }

  if (storeSlug) {
    return (
      <NotificationProvider>
        <div className="min-h-screen bg-white">
          <VirtualStore slug={storeSlug} />
        </div>
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}

function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [legalSettings, setLegalSettings] = useState<AppLegalSettings | null>(null);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  useEffect(() => {
    // Check URL hash for recovery token on initial load
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setShowResetPassword(true);
    }

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Session error:', error.message);
        if (
          error.message.includes('Refresh Token Not Found') || 
          error.message.includes('Invalid Refresh Token') ||
          error.message.includes('refresh_token_not_found')
        ) {
          // Force clear session if token is invalid
          supabase.auth.signOut().then(() => {
            localStorage.removeItem('supabase.auth.token'); // Fallback for older versions
            setSession(null);
            setLoading(false);
          });
          return;
        }
      }
      setSession(session);
      if (!session) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowResetPassword(true);
      }
      
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setProfile(null);
        setLoading(false);
      } else {
        setSession(session);
        if (!session) {
          setProfile(null);
          setLoading(false);
        }
      }
    });

    // Handle global auth refresh errors
    const handleError = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message;
      if (typeof msg === 'string' && (
          msg.includes('Refresh Token Not Found') || 
          msg.includes('Invalid Refresh Token') ||
          msg.includes('refresh_token_not_found')
      )) {
        event.preventDefault(); // Prevent the error from showing in the console
        console.warn('Auth refresh failed, signing out...');
        supabase.auth.signOut().catch(() => {});
        localStorage.removeItem('supabase.auth.token');
        setSession(null);
        setLoading(false);
      }
    };

    window.addEventListener('unhandledrejection', handleError);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);

  const { addNotification } = useNotifications();

  useEffect(() => {
    if (!session) return;

    // Listen for new route assignments
    const routesSubscription = supabase
      .channel('public:routes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'routes',
        filter: `user_id=eq.${session.user.id}`
      }, (payload) => {
        addNotification({
          type: 'route',
          title: 'Nova Rota Atribuída',
          message: `Você tem uma nova rota: ${payload.new.name}`
        });
      })
      .subscribe();

    // Listen for bag status changes
    const bagsSubscription = supabase
      .channel('public:bags')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'bags',
        filter: `user_id=eq.${session.user.id}`
      }, (payload) => {
        if (payload.old.status !== payload.new.status) {
          addNotification({
            type: 'sale',
            title: 'Status de Venda Alterado',
            message: `A sacola #${payload.new.bag_number.replace(/\D/g, '')} agora está ${payload.new.status === 'closed' ? 'Acertada' : 'Aberta'}.`
          });
        }
      })
      .subscribe();

    // Listen for catalog updates
    const catalogSubscription = supabase
      .channel('public:catalog_updates')
      .on('broadcast', { event: 'catalog_updated' }, (payload) => {
        addNotification({
          type: 'price_change',
          title: 'Catálogo Atualizado',
          message: payload.payload?.message || 'O administrador adicionou novos produtos ou atualizou preços. Clique para conferir.',
          onClick: () => setActiveTab('products')
        });
      })
      .subscribe();

    return () => {
      routesSubscription.unsubscribe();
      bagsSubscription.unsubscribe();
      catalogSubscription.unsubscribe();
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    fetchLegalSettings();
  }, [session]);

  async function fetchLegalSettings() {
    try {
      const { data, error } = await supabase
        .from('app_legal_settings')
        .select('*')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      if (data) setLegalSettings(data);
    } catch (err) {
      console.error('Error fetching legal settings:', err);
    }
  }

  useEffect(() => {
    if (profile && legalSettings) {
      const userAcceptedVersion = profile.accepted_terms_version || 0;
      const currentVersion = legalSettings.version || 0;
      
      if (userAcceptedVersion < currentVersion) {
        setShowLegalModal(true);
      } else {
        setShowLegalModal(false);
      }
    }
  }, [profile, legalSettings]);

  const handleConfirmLegal = async () => {
    if (!session || !legalSettings) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ accepted_terms_version: legalSettings.version })
        .eq('id', session.user.id);
      
      if (error) throw error;
      
      // Update local profile state
      setProfile(prev => prev ? { ...prev, accepted_terms_version: legalSettings.version } : null);
      setShowLegalModal(false);
    } catch (err) {
      console.error('Error confirming legal terms:', err);
      throw err;
    }
  };

  useEffect(() => {
    if (!session) return;

    // Listen for profile updates (e.g. admin assigning a key)
    const profileSubscription = supabase
      .channel('profile-updates')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles',
        filter: `id=eq.${session.user.id}`
      }, (payload) => {
        setProfile(payload.new as Profile);
        
        // If access was just granted, notify and switch tab
        if (!payload.old.access_key_code && payload.new.access_key_code) {
          addNotification({
            type: 'success',
            title: 'Acesso Liberado!',
            message: 'Sua chave de acesso foi ativada. Agora você tem acesso total ao painel.'
          });
          setActiveTab('campaigns');
        }
      })
      .subscribe();

    return () => {
      profileSubscription.unsubscribe();
    };
  }, [session]);

  useEffect(() => {
    const handleSetTab = (e: any) => {
      if (e.detail) setActiveTab(e.detail);
    };
    window.addEventListener('setTab', handleSetTab);
    return () => window.removeEventListener('setTab', handleSetTab);
  }, []);

  useEffect(() => {
    if (session) {
      fetchProfile();
    }
  }, [session]);

  async function fetchProfile() {
    if (!session?.user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // Profile not found, create it
      const trialExpiration = new Date();
      trialExpiration.setDate(trialExpiration.getDate() + 7);

      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([{
          id: session.user.id,
          email: session.user.email,
          nome: session.user.user_metadata?.full_name || '',
          role: 'user',
          status_pagamento: 'TRIAL',
          vencimento: trialExpiration.toISOString()
        }])
        .select()
        .single();
      
      if (newProfile) {
        setProfile(newProfile);
        setActiveTab('profile');
      }
    } else if (data) {
      setProfile(data);
      // If not admin and no access key, force profile tab
      if (data.role !== 'admin' && !data.access_key_code) {
        setActiveTab('profile');
      } else if (activeTab === 'profile' && (data.role === 'admin' || data.access_key_code)) {
        // Default to campaigns if access is granted and on profile
        setActiveTab('campaigns');
      }
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  const renderContent = () => {
    // Access control check
    const isAdmin = profile?.role === 'admin' || 
      session?.user.email === 'anderlevita@gmail.com';
    const isBlocked = !!profile?.is_blocked;
    
    const isTrial = profile?.status_pagamento === 'TRIAL';
    const isStarter = profile?.status_pagamento === 'STARTER';
    const trialEnd = isTrial && profile?.vencimento ? new Date(profile.vencimento) : null;
    const isTrialExpired = isTrial && trialEnd && trialEnd.getTime() < new Date().getTime();
    
    const hasAccess = isAdmin || ((!!profile?.access_key_code || profile?.plano_tipo === 'pro') && !isBlocked && !isTrialExpired);
    
    if (!hasAccess && activeTab !== 'profile') {
      return <ProfileScreen />;
    }

    // Starter/Trial plan restrictions
    if ((isStarter || isTrial) && (activeTab === 'routes' || activeTab === 'simulation')) {
      return <Campaigns />;
    }

    switch (activeTab) {
      case 'profile':
        return <ProfileScreen />;
      case 'campaigns':
        return <Campaigns />;
      case 'routes':
        return <Routes />;
      case 'customers':
        return <Customers />;
      case 'products':
        return <Products />;
      case 'reports':
        return <Reports />;
      case 'sweepstakes':
        return <SweepstakesManager />;
      case 'simulation':
        return <Simulation />;
      case 'virtual-store':
        return <VirtualStore />;
      case 'store-settings':
        return <StoreSettings />;
      case 'notepad':
        return <SmartNotepad />;
      case 'financial':
        return <FinancialControl />;
      case 'billing':
        return <BillingManagement profile={profile} />;
      case 'admin':
        return isAdmin ? <AdminPanel currentProfile={profile} /> : <Campaigns />;
      default:
        return <Campaigns />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] text-zinc-800 font-sans selection:bg-emerald-500/30 selection:text-emerald-900">
      <SystemAlert />
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        profile={profile}
        className="no-print"
      />
      
      <main className="flex-1 overflow-y-auto h-screen">
        <header className="h-16 border-b border-zinc-100 flex items-center justify-between px-4 sm:px-8 bg-white/80 backdrop-blur-sm sticky top-0 z-10 no-print">
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-zinc-50 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6 text-zinc-500" />
            </button>
            <span className="text-zinc-300 hidden sm:inline">/</span>
            <span className="text-xs font-bold text-[#4a1d33] uppercase tracking-widest">{activeTab}</span>
          </div>
          
          <div className="flex items-center gap-4">
            <NotificationCenter />
            <div className="w-8 h-8 rounded-lg bg-[#fdf8e1] border border-[#4a1d33]/10 flex items-center justify-center">
              <span className="text-xs font-bold text-[#38a89d]">
                {session.user.email ? session.user.email.substring(0, 2).toUpperCase() : '??'}
              </span>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>

      {legalSettings && (
        <LegalConfirmationModal
          isOpen={showLegalModal}
          privacyPolicy={legalSettings.privacy_policy}
          termsOfUse={legalSettings.terms_of_use}
          onConfirm={handleConfirmLegal}
        />
      )}

      {showResetPassword && (
        <ResetPasswordModal onClose={() => setShowResetPassword(false)} />
      )}
    </div>
  );
}
