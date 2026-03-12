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
  const [view, setView] = useState<'list' | 'create' | 'view'>('list');
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
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
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from('routes')
        .select('*, stops:route_stops(*, customer:customers(*))')
        .eq('user_id', user.id)
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
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const [campRes, custRes] = await Promise.all([
      supabase.from('campaigns').select('*').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('customers').select('*').eq('user_id', user.id)
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
    if (!currentPos) {
      alert('Localização GPS não disponível. Verifique as permissões do navegador.');
      getUserLocation();
      return;
    }
    if (selectedCustomers.length === 0) return;

    let unvisited = [...selectedCustomers];
    let optimized: Customer[] = [];
    let currentLat = currentPos.lat;
    let currentLng = currentPos.lng;

    // Separate customers with and without GPS coordinates
    let withGps = unvisited.filter(c => c.latitude && c.longitude);
    let withoutGps = unvisited.filter(c => !c.latitude || !c.longitude);

    // Nearest Neighbor Algorithm
    while (withGps.length > 0) {
      let nearestIdx = 0;
      let minDist = Infinity;

      withGps.forEach((cust, idx) => {
        const dist = calculateDistance(currentLat, currentLng, cust.latitude!, cust.longitude!);
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = idx;
        }
      });

      const nextCust = withGps.splice(nearestIdx, 1)[0];
      optimized.push(nextCust);
      currentLat = nextCust.latitude!;
      currentLng = nextCust.longitude!;
    }

    setSelectedCustomers([...optimized, ...withoutGps]);
    alert('Rota otimizada com a melhor sequência de atendimento!');
  };

  const optimizeActiveRoute = async () => {
    if (!currentPos) {
      alert('Localização GPS não disponível.');
      getUserLocation();
      return;
    }
    if (!activeRoute || !activeRoute.stops) return;
    
    setLoading(true);
    try {
      let unvisited = [...activeRoute.stops];
      let optimizedStops: RouteStop[] = [];
      let currentLat = currentPos.lat;
      let currentLng = currentPos.lng;

      // Separate stops with and without GPS coordinates
      let withGps = unvisited.filter(s => s.customer?.latitude && s.customer?.longitude);
      let withoutGps = unvisited.filter(s => !s.customer?.latitude || !s.customer?.longitude);

      // Nearest Neighbor Algorithm
      while (withGps.length > 0) {
        let nearestIdx = 0;
        let minDist = Infinity;

        withGps.forEach((stop, idx) => {
          const dist = calculateDistance(currentLat, currentLng, stop.customer!.latitude!, stop.customer!.longitude!);
          if (dist < minDist) {
            minDist = dist;
            nearestIdx = idx;
          }
        });

        const nextStop = withGps.splice(nearestIdx, 1)[0];
        optimizedStops.push(nextStop);
        currentLat = nextStop.customer!.latitude!;
        currentLng = nextStop.customer!.longitude!;
      }

      const finalStops = [...optimizedStops, ...withoutGps];

      // Update order_index in database
      await Promise.all(finalStops.map((stop, i) => 
        supabase
          .from('route_stops')
          .update({ order_index: i })
          .eq('id', stop.id)
      ));

      // Update local state
      const updatedStops = finalStops.map((s, idx) => ({ ...s, order_index: idx }));
      setActiveRoute({ ...activeRoute, stops: updatedStops });
      
      // Update routes list
      setRoutes(routes.map(r => r.id === activeRoute.id ? { ...r, stops: updatedStops } : r));
      
      alert('Rota otimizada com a melhor sequência de atendimento!');
    } catch (err: any) {
      console.error('Error optimizing active route:', err);
      alert('Erro ao otimizar rota: ' + (err.message || JSON.stringify(err)));
    } finally {
      setLoading(false);
    }
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

  const moveActiveRouteItem = async (index: number, direction: 'up' | 'down') => {
    if (!activeRoute || !activeRoute.stops) return;
    
    const newStops = [...activeRoute.stops].sort((a, b) => a.order_index - b.order_index);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newStops.length) return;
    
    // Swap order_index
    const tempOrder = newStops[index].order_index;
    newStops[index].order_index = newStops[targetIndex].order_index;
    newStops[targetIndex].order_index = tempOrder;
    
    // Re-sort array
    newStops.sort((a, b) => a.order_index - b.order_index);
    
    setActiveRoute({ ...activeRoute, stops: newStops });
    
    try {
      // Update in database
      await Promise.all([
        supabase.from('route_stops').update({ order_index: newStops[index].order_index }).eq('id', newStops[index].id),
        supabase.from('route_stops').update({ order_index: newStops[targetIndex].order_index }).eq('id', newStops[targetIndex].id)
      ]);
      
      // Update routes list
      setRoutes(routes.map(r => r.id === activeRoute.id ? { ...r, stops: newStops } : r));
    } catch (err: any) {
      console.error('Error updating order:', err);
      alert('Erro ao atualizar ordem: ' + (err.message || JSON.stringify(err)));
    }
  };

  const getNavigateToStopUrl = (stop: RouteStop, app: 'maps' | 'waze') => {
    if (!stop.customer?.latitude || !stop.customer?.longitude) return null;
    
    const lat = stop.customer.latitude;
    const lng = stop.customer.longitude;
    
    if (app === 'maps') {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    } else {
      return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    }
  };

  const getNavigateFullRouteUrl = () => {
    if (!activeRoute || !activeRoute.stops) return null;
    
    const pendingStops = activeRoute.stops
      .filter(s => s.status === 'pending' && s.customer?.latitude && s.customer?.longitude)
      .sort((a, b) => a.order_index - b.order_index);
      
    if (pendingStops.length === 0) return null;
    
    if (pendingStops.length === 1) {
      return getNavigateToStopUrl(pendingStops[0], 'maps');
    }
    
    const stopsToNavigate = pendingStops.slice(0, 10);
    const destination = stopsToNavigate[stopsToNavigate.length - 1];
    const waypoints = stopsToNavigate.slice(0, -1);
    
    const waypointsStr = waypoints.map(s => `${s.customer!.latitude},${s.customer!.longitude}`).join('|');
    const destStr = `${destination.customer!.latitude},${destination.customer!.longitude}`;
    
    let url = `https://www.google.com/maps/dir/?api=1&destination=${destStr}`;
    if (waypoints.length > 0) {
      url += `&waypoints=${waypointsStr}`;
    }
    
    return url;
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
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
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
        status: 'pending',
        user_id: user.id
      }));

      const { error: stopsError } = await supabase
        .from('route_stops')
        .insert(stops);

      if (stopsError) {
        await supabase.from('routes').delete().eq('id', route.id);
        throw stopsError;
      }

      setView('list');
      fetchRoutes();
    } catch (err: any) {
      console.error('Error saving route:', err);
      alert('Erro ao salvar rota: ' + (err.message || JSON.stringify(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleMarkVisited = async (stopId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'visited' ? 'pending' : 'visited';
    
    try {
      const { error } = await supabase
        .from('route_stops')
        .update({ status: newStatus })
        .eq('id', stopId);

      if (error) throw error;

      // Update local state
      if (activeRoute) {
        const updatedStops = activeRoute.stops?.map(stop => 
          stop.id === stopId ? { ...stop, status: newStatus as 'visited' | 'pending' } : stop
        );
        setActiveRoute({ ...activeRoute, stops: updatedStops });
      }
      
      // Update routes list
      setRoutes(routes.map(r => {
        if (r.id === activeRoute?.id) {
          return {
            ...r,
            stops: r.stops?.map(stop => 
              stop.id === stopId ? { ...stop, status: newStatus as 'visited' | 'pending' } : stop
            )
          };
        }
        return r;
      }));
    } catch (err: any) {
      console.error('Error updating stop status:', err);
      alert('Erro ao atualizar status da parada: ' + (err.message || JSON.stringify(err)));
    }
  };

  const handleFinishRoute = async (routeId: string) => {
    try {
      const { error } = await supabase
        .from('routes')
        .update({ status: 'completed' })
        .eq('id', routeId);

      if (error) throw error;

      setRoutes(routes.map(r => r.id === routeId ? { ...r, status: 'completed' } : r));
      if (activeRoute?.id === routeId) {
        setActiveRoute({ ...activeRoute, status: 'completed' });
      }
      
      alert('Rota finalizada com sucesso!');
    } catch (err) {
      console.error('Error finishing route:', err);
      alert('Erro ao finalizar rota');
    }
  };

  if (view === 'create') {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-zinc-800 tracking-tight text-center sm:text-left">Nova Rota de Atendimento</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={() => setView('list')}
              className="px-4 py-3 sm:py-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 transition-colors bg-zinc-100 sm:bg-transparent rounded-xl sm:rounded-none w-full sm:w-auto text-center"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSaveRoute}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-6 py-3 sm:py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 w-full sm:w-auto"
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
              <div className="p-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50/30">
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
                        
                        <div className="flex-1 bg-white border border-zinc-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-emerald-200 transition-all shadow-sm">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center">
                              <User className="w-5 h-5 text-zinc-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-zinc-800 text-sm">{cust.nome}</p>
                                {(!cust.latitude || !cust.longitude) && (
                                  <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-600 text-[9px] font-bold uppercase tracking-wider border border-red-100">
                                    Sem GPS
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-zinc-400 mt-0.5">
                                {[cust.logradouro, cust.address_number, cust.bairro, cust.cidade].filter(Boolean).join(', ') || 'Sem endereço cadastrado'}
                              </p>
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

  if (view === 'view' && activeRoute) {
    const totalStops = activeRoute.stops?.length || 0;
    const visitedStops = activeRoute.stops?.filter(s => s.status === 'visited').length || 0;
    const progress = totalStops > 0 ? (visitedStops / totalStops) * 100 : 0;

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setView('list');
                setActiveRoute(null);
              }}
              className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-zinc-400 rotate-180" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">{activeRoute.name}</h2>
              <p className="text-sm text-zinc-500">
                {visitedStops} de {totalStops} paradas concluídas
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {activeRoute.status !== 'completed' && (
              <a 
                href={getNavigateFullRouteUrl() || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!getNavigateFullRouteUrl()) {
                    e.preventDefault();
                    alert('Nenhuma parada pendente com GPS para navegar.');
                  }
                }}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 sm:py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-blue-500/20 w-full sm:w-auto"
              >
                <Navigation className="w-4 h-4" />
                Iniciar Navegação
              </a>
            )}
            <button 
              onClick={optimizeActiveRoute}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-3 sm:py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg w-full sm:w-auto"
            >
              <Map className="w-4 h-4" />
              Otimizar via GPS
            </button>
            {activeRoute.status !== 'completed' && (
              <button 
                onClick={() => handleFinishRoute(activeRoute.id)}
                className="flex items-center justify-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-6 py-3 sm:py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 w-full sm:w-auto"
              >
                <CheckCircle2 className="w-4 h-4" />
                Finalizar Rota
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-8">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-500 mb-2">
              <span>Progresso da Rota</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="space-y-4">
            {activeRoute.stops?.filter(s => s.status === 'pending').sort((a, b) => a.order_index - b.order_index).map((stop, idx, arr) => (
              <div 
                key={stop.id} 
                className="flex items-center gap-4 p-4 rounded-2xl border transition-all bg-white border-zinc-100 hover:border-zinc-200 group"
              >
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors bg-zinc-100 text-zinc-500">
                    {idx + 1}
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors bg-zinc-50">
                      <User className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-zinc-800">{stop.customer?.nome}</p>
                        {(!stop.customer?.latitude || !stop.customer?.longitude) && (
                          <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-600 text-[9px] font-bold uppercase tracking-wider border border-red-100">
                            Sem GPS
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] mt-0.5 text-zinc-400">
                        {[stop.customer?.logradouro, stop.customer?.address_number, stop.customer?.bairro, stop.customer?.cidade].filter(Boolean).join(', ') || 'Sem endereço cadastrado'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mr-2">
                      <button 
                        onClick={() => moveActiveRouteItem(idx, 'up')}
                        disabled={idx === 0}
                        className="p-2 hover:bg-zinc-50 text-zinc-400 rounded-lg disabled:opacity-20"
                        title="Mover para cima"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => moveActiveRouteItem(idx, 'down')}
                        disabled={idx === arr.length - 1}
                        className="p-2 hover:bg-zinc-50 text-zinc-400 rounded-lg disabled:opacity-20"
                        title="Mover para baixo"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex gap-2 w-full sm:w-auto">
                      <a
                        href={getNavigateToStopUrl(stop, 'maps') || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          if (!getNavigateToStopUrl(stop, 'maps')) {
                            e.preventDefault();
                            alert('Cliente sem coordenadas GPS cadastradas.');
                          }
                        }}
                        className="flex-1 sm:flex-none p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center"
                        title="Navegar com Google Maps"
                      >
                        <MapPin className="w-4 h-4" />
                      </a>
                      <a
                        href={getNavigateToStopUrl(stop, 'waze') || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          if (!getNavigateToStopUrl(stop, 'waze')) {
                            e.preventDefault();
                            alert('Cliente sem coordenadas GPS cadastradas.');
                          }
                        }}
                        className="flex-1 sm:flex-none p-2 bg-cyan-50 text-cyan-600 rounded-xl hover:bg-cyan-100 transition-colors flex items-center justify-center"
                        title="Navegar com Waze"
                      >
                        <Navigation className="w-4 h-4" />
                      </a>
                    </div>
                    <button 
                      onClick={() => handleMarkVisited(stop.id, stop.status)}
                      className="px-4 py-2 rounded-xl text-xs font-bold transition-all w-full sm:w-auto flex items-center justify-center gap-2 bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    >
                      Marcar como Visitado
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {activeRoute.stops?.filter(s => s.status === 'visited').length ? (
              <div className="pt-6 mt-6 border-t border-zinc-100">
                <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Atendimentos Concluídos</h4>
                <div className="space-y-4 opacity-75">
                  {activeRoute.stops?.filter(s => s.status === 'visited').sort((a, b) => a.order_index - b.order_index).map((stop) => (
                    <div 
                      key={stop.id} 
                      className="flex items-center gap-4 p-4 rounded-2xl border transition-all bg-emerald-50/50 border-emerald-100"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors bg-emerald-500 text-white">
                          <Check className="w-4 h-4" />
                        </div>
                      </div>
                      
                      <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors bg-emerald-100">
                            <User className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm text-emerald-900">{stop.customer?.nome}</p>
                            </div>
                            <p className="text-[10px] mt-0.5 text-emerald-600/70">
                              {[stop.customer?.logradouro, stop.customer?.address_number, stop.customer?.bairro, stop.customer?.cidade].filter(Boolean).join(', ') || 'Sem endereço cadastrado'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                          <button 
                            onClick={() => handleMarkVisited(stop.id, stop.status)}
                            className="px-4 py-2 rounded-xl text-xs font-bold transition-all w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Visitado
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
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

              <button 
                onClick={() => {
                  setActiveRoute(route);
                  setView('view');
                }}
                className="w-full flex items-center justify-between p-4 bg-zinc-50 rounded-2xl text-zinc-600 font-bold text-xs hover:bg-zinc-100 transition-all"
              >
                {route.status === 'completed' ? 'Ver Rota' : 'Iniciar Rota'}
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
