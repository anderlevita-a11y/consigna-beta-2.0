import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  ShoppingBag, 
  Settings, 
  LogOut,
  ChevronRight,
  UserCircle,
  Megaphone,
  BarChart3,
  Ticket,
  Calculator,
  ShieldAlert,
  Wifi,
  ChevronLeft,
  Lock,
  Map
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  profile: Profile | null;
}

const menuItems = [
  { id: 'profile', label: 'Meu Cadastro', icon: UserCircle, public: true },
  { id: 'campaigns', label: 'Campanhas', icon: Megaphone },
  { id: 'routes', label: 'Rotas', icon: Map },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'products', label: 'Catálogo', icon: Package },
  { id: 'reports', label: 'Relatórios', icon: BarChart3 },
  { id: 'sweepstakes', label: 'Beauty Sorteios', icon: Ticket },
  { id: 'simulation', label: 'Simulação', icon: Calculator },
];

export function Sidebar({ activeTab, setActiveTab, isOpen, onClose, profile }: SidebarProps) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = profile?.email === 'anderlevita@gmail.com';
  const isBlocked = !!profile?.is_blocked;
  const hasAccess = isAdmin || (!!profile?.access_key_code && !isBlocked);

  const handleTabClick = (id: string, isPublic: boolean) => {
    if (!hasAccess && !isPublic) return;
    setActiveTab(id);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <div className={cn(
        "fixed inset-y-0 left-0 w-64 bg-white text-zinc-500 flex flex-col border-r border-zinc-100 z-50 transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-auto",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#00a86b] rounded-lg flex items-center justify-center">
                <LayoutDashboard className="text-white w-5 h-5" />
              </div>
              <h1 className="text-zinc-800 font-bold text-lg tracking-tight">Consigna Be...</h1>
            </div>
            <button 
              onClick={onClose}
              className="lg:hidden p-2 hover:bg-zinc-50 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
          
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Supabase: Online</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isLocked = !hasAccess && !item.public;
            
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id, !!item.public)}
                disabled={isLocked}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-[#00a86b] text-white shadow-lg shadow-emerald-500/20" 
                    : isLocked
                      ? "opacity-50 cursor-not-allowed grayscale"
                      : "hover:bg-zinc-50 text-zinc-500 hover:text-zinc-800"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn(
                    "w-5 h-5 transition-colors",
                    isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-600"
                  )} />
                  <span className="font-semibold text-sm">{item.label}</span>
                </div>
                {isLocked && <Lock className="w-3.5 h-3.5 text-zinc-400" />}
              </button>
            );
          })}
        </nav>

        <div className="p-4 space-y-2">
          {isAdmin && (
            <button
              onClick={() => handleTabClick('admin', false)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                activeTab === 'admin'
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-900 text-white hover:bg-zinc-800"
              )}
            >
              <Settings className="w-5 h-5" />
              <span className="font-bold text-sm">Painel Admin</span>
            </button>
          )}
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-red-50 hover:text-red-500 text-zinc-400 transition-all group"
          >
            <LogOut className="w-5 h-5 group-hover:text-red-500" />
            <span className="font-medium text-sm">Sair</span>
          </button>
        </div>
      </div>
    </>
  );
}
