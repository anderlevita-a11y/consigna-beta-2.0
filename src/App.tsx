/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
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
import { Settings, Loader2, Megaphone, BarChart3, Ticket, Calculator, ShieldAlert, Menu } from 'lucide-react';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Profile } from './types';

import { NotificationProvider, NotificationCenter, SystemAlert, useNotifications } from './components/NotificationCenter';

export default function App() {
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
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

    return () => {
      routesSubscription.unsubscribe();
      bagsSubscription.unsubscribe();
    };
  }, [session]);

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
            type: 'system',
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
    if (session) {
      fetchProfile();
    }
  }, [session]);

  async function fetchProfile() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session?.user.id)
      .single();
    
    if (data) {
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
    const isAdmin = session?.user.email === 'anderlevita@gmail.com';
    const isBlocked = !!profile?.is_blocked;
    const hasAccess = isAdmin || (!!profile?.access_key_code && !isBlocked);
    
    if (!hasAccess && activeTab !== 'profile') {
      return <ProfileScreen />;
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
      case 'admin':
        return isAdmin ? <AdminPanel /> : <Campaigns />;
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
      />
      
      <main className="flex-1 overflow-y-auto h-screen">
        <header className="h-16 border-b border-zinc-100 flex items-center justify-between px-4 sm:px-8 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-zinc-50 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6 text-zinc-500" />
            </button>
            <span className="text-zinc-300 hidden sm:inline">/</span>
            <span className="text-sm font-medium text-zinc-400 capitalize">{activeTab}</span>
          </div>
          
          <div className="flex items-center gap-4">
            <NotificationCenter />
            <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center">
              <span className="text-xs font-bold text-emerald-600">
                {session.user.email?.substring(0, 2).toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
