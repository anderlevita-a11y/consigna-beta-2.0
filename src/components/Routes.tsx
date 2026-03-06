import React, { useState, useEffect } from 'react';
import { 
  Map, 
  Navigation, 
  MapPin, 
  ArrowUp, 
  ArrowDown, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Search,
  Loader2,
  Trash2,
  Play,
  Check,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Route, RouteStop, Customer, Campaign } from '../types';
import { cn } from '../lib/utils';

export function Routes() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  
  // Create Form State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([]);
  const [routeName, setRouteName] = useState('');

  useEffect(() => {
    fetchRoutes();
    fetchInitialData();
    getUserLocation();
  }, []);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentPos({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.error('Error getting location:', error)
      );
    }
  };

  async function fetchRoutes() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('routes')
        .select('*, stops:route_stops(*, customer:customers(*))')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRoutes(data || []);
    } catch (err) {
      console.error('Error fetching routes:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchInitialData() {
    const [campRes, custRes] = await Promise.all([
      supabase.from('campaigns').select('*').eq('status', 'active'),
      supabase.from('customers').select('*')
    ]);
    if (campRes.data) setCampaigns(campRes.data);
    if (custRes.data) setCustomers(custRes.data);
  }

  const handleCampaignSelect = async (campaignId: string) => {
    setSelectedCampaign(campaignId);
    // Fetch customers with bags in this campaign
    const { data: bags } = await supabase
      .from('bags')
      .select('customer_id')
      .eq('campaign_id', campaignId);
    
    if (bags) {
      const customerIds = Array.from(new Set(bags.map(b => b.customer_id).filter(Boolean)));
      const campaignCustomers = customers.filter(c => customerIds.includes(c.id));
      setSelectedCustomers(campaignCustomers);
    }
  };

  const toggleCustomer = (customer: Customer) => {
    if (selectedCustomers.find(c => c.id === customer.id)) {
      setSelectedCustomers(selectedCustomers.filter(c => c.id !== customer.id));
    } else {
      setSelectedCustomers([...selectedCustomers, customer]);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const optimizeRoute = () => {
    if (!currentPos || selectedCustomers.length === 0) return;

    let unvisited = [...selectedCustomers];
    let optimized: Customer[] = [];
    let currentLat = currentPos.lat;
    let currentLng = currentPos.lng;

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDist = Infinity;

      unvisited.forEach((cust, idx) => {
        if (cust.latitude && cust.longitude) {
          const dist = calculateDistance(currentLat, currentLng, cust.latitude, cust.longitude);
          if (dist < minDist) {
            minDist = dist;
            nearestIdx = idx;
          }
        }
      });

      const nextCust = unvisited.splice(nearestIdx, 1)[0];
      optimized.push(nextCust);
      if (nextCust.latitude && nextCust.longitude) {
        currentLat = nextCust.latitude;
        currentLng = nextCust.longitude;
      }
    }

    setSelectedCustomers(optimized);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...selectedCustomers];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    setSelectedCustomers(newItems);
  };

  const handleSaveRoute = async () => {
    if (!routeName) {
      alert('Dê um nome para a rota');
      return;
    }
    if (selectedCustomers.length === 0) {
      alert('Selecione pelo menos um cliente');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: route, error: routeError } = await supabase
        .from('routes')
        .insert([{
          name: routeName,
          campaign_id: selectedCampaign || null,
          user_id: user.id,
          status: 'pending'
        }])
        .select()
        .single();

      if (routeError) throw routeError;

      const stops = selectedCustomers.map((cust, idx) => ({
        route_id: route.id,
        customer_id: cust.id,
        order_index: idx,
        status: 'pending'
      }));

      const { error: stopsError } = await supabase
        .from('route_stops')
        .insert(stops);

      if (stopsError) throw stopsError;

      setView('list');
      fetchRoutes();
    } catch (err) {
      console.error('Error saving route:', err);
      alert('Erro ao salvar rota');
    } finally {
      setLoading(false);
    }
  };

  if (view === 'create') {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">Nova Rota de Atendimento</h2>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setView('list')}
              className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSaveRoute}
              disabled={loading}
              className="flex items-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              Finalizar Rota
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-6">
              <h3 className="font-bold text-zinc-800 uppercase text-xs tracking-widest">Configuração</h3>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nome da Rota</label>
                <input 
                  type="text" 
                  placeholder="Ex: Rota Centro - Terça"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-800 focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Basear em Campanha (Opcional)</label>
                <select 
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-800 focus:border-emerald-500 outline-none transition-all"
                  value={selectedCampaign}
                  onChange={(e) => handleCampaignSelect(e.target.value)}
                >
                  <option value="">Nenhuma campanha selecionada</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-zinc-100">
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4">Adicionar Clientes Manualmente</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {customers.map(cust => (
                    <button 
                      key={cust.id}
                      onClick={() => toggleCustomer(cust)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                        selectedCustomers.find(c => c.id === cust.id)
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-white border-zinc-100 text-zinc-600 hover:border-zinc-200"
                      )}
                    >
                      <span className="text-xs font-bold truncate">{cust.nome}</span>
                      {selectedCustomers.find(c => c.id === cust.id) ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Navigation className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-800">Sequência da Rota</h3>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest">Organize a ordem de visita</p>
                  </div>
                </div>
                <button 
                  onClick={optimizeRoute}
                  className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-zinc-800 transition-all"
                >
                  <Map className="w-3.5 h-3.5" />
                  Otimizar via GPS
                </button>
              </div>

              <div className="p-6">
                {selectedCustomers.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto">
                      <MapPin className="w-8 h-8 text-zinc-200" />
                    </div>
                    <p className="text-zinc-400 text-sm italic">Nenhum cliente selecionado para a rota.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedCustomers.map((cust, idx) => (
                      <div key={cust.id} className="flex items-center gap-4 group">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-500">
                            {idx + 1}
                          </div>
                          {idx < selectedCustomers.length - 1 && <div className="w-0.5 h-8 bg-zinc-100" />}
                        </div>
                        
                        <div className="flex-1 bg-white border border-zinc-100 rounded-2xl p-4 flex items-center justify-between hover:border-emerald-200 transition-all shadow-sm">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center">
                              <User className="w-5 h-5 text-zinc-400" />
                            </div>
                            <div>
                              <p className="font-bold text-zinc-800 text-sm">{cust.nome}</p>
                              <p className="text-[10px] text-zinc-400">{cust.cidade} - {cust.bairro}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => moveItem(idx, 'up')}
                              disabled={idx === 0}
                              className="p-2 hover:bg-zinc-50 text-zinc-400 rounded-lg disabled:opacity-20"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => moveItem(idx, 'down')}
                              disabled={idx === selectedCustomers.length - 1}
                              className="p-2 hover:bg-zinc-50 text-zinc-400 rounded-lg disabled:opacity-20"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => toggleCustomer(cust)}
                              className="p-2 hover:bg-red-50 text-red-400 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">Rotas de Atendimento</h2>
          <p className="text-sm text-zinc-500">Organize suas visitas para economizar tempo e combustível.</p>
        </div>
        <button 
          onClick={() => setView('create')}
          className="flex items-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-5 h-5" />
          Nova Rota
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
          </div>
        ) : routes.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white border border-dashed border-zinc-200 rounded-3xl space-y-4">
            <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto">
              <Map className="w-8 h-8 text-zinc-200" />
            </div>
            <p className="text-zinc-400 font-medium">Nenhuma rota planejada. Comece criando uma nova!</p>
          </div>
        ) : (
          routes.map(route => (
            <div key={route.id} className="bg-white border border-zinc-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-50 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                    <Navigation className="w-5 h-5 text-zinc-400 group-hover:text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-800">{route.name}</h4>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest">
                      {route.stops?.length || 0} Paradas
                    </p>
                  </div>
                </div>
                <span className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                  route.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                )}>
                  {route.status === 'completed' ? 'Finalizada' : 'Pendente'}
                </span>
              </div>

              <div className="space-y-3 mb-6">
                {route.stops?.slice(0, 3).map((stop, idx) => (
                  <div key={stop.id} className="flex items-center gap-3 text-sm text-zinc-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
                    <span className="truncate">{stop.customer?.nome}</span>
                  </div>
                ))}
                {(route.stops?.length || 0) > 3 && (
                  <p className="text-xs text-zinc-400 italic pl-4">... e mais {route.stops!.length - 3} paradas</p>
                )}
              </div>

              <button className="w-full flex items-center justify-between p-4 bg-zinc-50 rounded-2xl text-zinc-600 font-bold text-xs hover:bg-zinc-100 transition-all">
                Iniciar Rota
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function User({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
