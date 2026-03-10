import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Archive, 
  Trash2, 
  Calendar,
  Clock,
  Loader2,
  Megaphone,
  RefreshCcw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Campaign } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConfirmationModal } from './ConfirmationModal';

import { CampaignForm } from './CampaignForm';
import { BagForm } from './BagForm';
import { CampaignDetails } from './CampaignDetails';

export function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'campaign-form' | 'bag-form' | 'campaign-details'>('list');
  const [showArchived, setShowArchived] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | undefined>();
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | undefined>();

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
    if (view === 'list') {
      fetchCampaigns();
    }
  }, [view, showArchived]);

  async function fetchCampaigns() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', showArchived ? 'archived' : 'active')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setCampaigns(data || []);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setView('campaign-form');
  };

  const handleNewCampaign = () => {
    setEditingCampaign(undefined);
    setView('campaign-form');
  };

  const handleArchive = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Arquivar Campanha',
      message: 'Deseja arquivar esta campanha?',
      variant: 'warning',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('campaigns')
            .update({ status: 'archived' })
            .eq('id', id);
          if (error) throw error;
          fetchCampaigns();
        } catch (err) {
          console.error('Error archiving campaign:', err);
          alert('Erro ao arquivar campanha');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleUnarchive = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Desarquivar Campanha',
      message: 'Deseja desarquivar esta campanha?',
      variant: 'info',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('campaigns')
            .update({ status: 'active' })
            .eq('id', id);
          if (error) throw error;
          fetchCampaigns();
        } catch (err) {
          console.error('Error unarchiving campaign:', err);
          alert('Erro ao desarquivar campanha');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleOpenCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setView('campaign-details');
  };

  const handleAddBagToCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setView('bag-form');
  };

  if (view === 'campaign-form') {
    return (
      <CampaignForm 
        onClose={() => setView('list')} 
        onSave={() => setView('list')}
        initialData={editingCampaign}
      />
    );
  }

  if (view === 'bag-form') {
    return (
      <BagForm 
        onClose={() => setView(selectedCampaign ? 'campaign-details' : 'list')} 
        onSave={() => setView(selectedCampaign ? 'campaign-details' : 'list')}
        campaignId={selectedCampaign?.id}
      />
    );
  }

  if (view === 'campaign-details' && selectedCampaign) {
    return (
      <CampaignDetails 
        campaign={selectedCampaign}
        onBack={() => setView('list')}
        onAddBag={() => setView('bag-form')}
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-800">
          {showArchived ? 'Campanhas Arquivadas' : 'Campanhas'}
        </h2>
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={() => setShowArchived(!showArchived)}
            className={cn(
              "flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm sm:font-medium transition-colors",
              showArchived 
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                : "bg-zinc-100 hover:bg-zinc-200 text-zinc-600"
            )}
          >
            <Archive className="w-4 h-4" />
            {showArchived ? 'Ver Ativas' : 'Arquivadas'}
          </button>
          <button 
            onClick={handleNewCampaign}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-3 sm:px-4 py-2 rounded-lg text-sm sm:font-medium transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Nova Campanha
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-zinc-400 flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            Carregando campanhas...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="col-span-full py-12 text-center text-zinc-400 bg-white border border-dashed border-zinc-200 rounded-2xl">
            {showArchived 
              ? 'Nenhuma campanha arquivada encontrada.' 
              : 'Nenhuma campanha ativa. Clique em "Nova Campanha" para começar.'}
          </div>
        ) : (
          campaigns.map((campaign) => (
            <div key={campaign.id}>
              <CampaignCard 
                campaign={campaign} 
                isArchived={showArchived}
                onAddBag={() => handleAddBagToCampaign(campaign)}
                onEdit={() => handleEdit(campaign)}
                onArchive={() => handleArchive(campaign.id)}
                onUnarchive={() => handleUnarchive(campaign.id)}
                onOpen={() => handleOpenCampaign(campaign)}
              />
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

interface CampaignCardProps {
  campaign: Campaign;
  isArchived?: boolean;
  onAddBag: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onOpen: () => void;
}

function CampaignCard({ campaign, isArchived, onAddBag, onEdit, onArchive, onUnarchive, onOpen }: CampaignCardProps) {
  return (
    <div className={cn(
      "bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group",
      isArchived && "opacity-75 grayscale-[0.5]"
    )}>
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <h4 className="text-xl font-bold text-zinc-800 cursor-pointer hover:text-emerald-600 transition-colors" onClick={onOpen}>
            {campaign.name}
          </h4>
          <div className="flex items-center gap-2">
            {!isArchived && (
              <button 
                onClick={onAddBag}
                className="p-1.5 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50/50 rounded-md transition-all"
                title="Nova Sacola"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={isArchived ? onUnarchive : onArchive}
              className={cn(
                "p-1.5 rounded-md transition-all",
                isArchived 
                  ? "text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50/50" 
                  : "text-zinc-400 hover:text-red-500 hover:bg-red-50/50"
              )}
              title={isArchived ? "Desarquivar" : "Arquivar"}
            >
              {isArchived ? <RefreshCcw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <span className={cn(
          "px-3 py-1 rounded-lg text-sm font-bold",
          isArchived ? "bg-zinc-100 text-zinc-500" : "bg-emerald-50 text-emerald-600"
        )}>
          {campaign.discount_pct}% Desc.
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
        <div className="flex items-center gap-1.5">
          <span>Retorno: {format(new Date(campaign.return_date || ''), "dd/MM/yyyy")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>Criada em: {format(new Date(campaign.created_at), "dd/MM/yyyy")}</span>
        </div>
      </div>
    </div>
  );
}
