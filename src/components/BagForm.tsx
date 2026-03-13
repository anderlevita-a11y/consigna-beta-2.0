import React, { useState, useEffect } from 'react';
import { Save, X, Search, ShoppingBag, User, Package, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Product, Customer } from '../types';
import { cn } from '../lib/utils';
import { ConfirmationModal } from './ConfirmationModal';

interface BagFormProps {
  onClose: () => void;
  onSave: () => void;
  campaignId?: string;
}

interface BagItem {
  product: Product;
  quantity: number;
  color?: string;
  size?: string;
}

export function BagForm({ onClose, onSave, campaignId }: BagFormProps) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [resellerName, setResellerName] = useState('');
  const [noStock, setNoStock] = useState(false);
  const [items, setItems] = useState<BagItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isGridModalOpen, setIsGridModalOpen] = useState(false);
  const [selectedProductForGrid, setSelectedProductForGrid] = useState<Product | null>(null);
  const [gridForm, setGridForm] = useState({ color: '', size: '' });

  const [customerSearch, setCustomerSearch] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
      if (!user) return;

      // Fetch Customers in chunks
      let allCustomers: any[] = [];
      let cFrom = 0;
      let cTo = 999;
      let cHasMore = true;
      while (cHasMore) {
        const { data, error } = await supabase
          .from('customers')
          .select('id, nome, cpf')
          .eq('user_id', user.id)
          .order('nome')
          .range(cFrom, cTo);
        if (error) throw error;
        if (data && data.length > 0) {
          allCustomers = [...allCustomers, ...data];
          cFrom += 1000;
          cTo += 1000;
        } else {
          cHasMore = false;
        }
        if (allCustomers.length >= 10000) cHasMore = false;
      }
      setCustomers(allCustomers);

      // Fetch Products in chunks
      let allProducts: any[] = [];
      let pFrom = 0;
      let pTo = 999;
      let pHasMore = true;
      while (pHasMore) {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, ean, sale_price, current_stock, label_name, has_grid, grid_data')
          .eq('user_id', user.id)
          .order('name')
          .range(pFrom, pTo);
        if (error) throw error;
        if (data && data.length > 0) {
          allProducts = [...allProducts, ...data];
          pFrom += 1000;
          pTo += 1000;
        } else {
          pHasMore = false;
        }
        if (allProducts.length >= 10000) pHasMore = false;
      }
      setProducts(allProducts);
    } catch (err) {
      console.error('Error fetching initial data:', err);
    }
  }

  const addItem = (product: Product, color?: string, size?: string) => {
    if (!noStock && product.current_stock <= 0) {
      alert('Produto indisponível no estoque.');
      return;
    }

    if (product.has_grid && !color && !size) {
      setSelectedProductForGrid(product);
      setIsGridModalOpen(true);
      return;
    }

    const existing = items.find(i => 
      i.product.id === product.id && 
      i.color === color && 
      i.size === size
    );
    if (existing) {
      setItems(items.map(i => 
        (i.product.id === product.id && i.color === color && i.size === size)
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
    } else {
      setItems([{ product, quantity: 1, color, size }, ...items]);
    }
    setProductSearch('');
    setIsGridModalOpen(false);
    setSelectedProductForGrid(null);
    setGridForm({ color: '', size: '' });
  };

  const confirmRemoveItem = (productId: string) => {
    setItemToDelete(productId);
  };

  const removeItem = () => {
    if (itemToDelete) {
      setItems(items.filter(i => `${i.product.id}-${i.color}-${i.size}` !== itemToDelete));
      setItemToDelete(null);
    }
  };

  const updateQuantity = (productId: string, delta: number, color?: string, size?: string) => {
    setItems(items.map(i => {
      if (i.product.id === productId && i.color === color && i.size === size) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalValue = items.reduce((sum, i) => sum + (i.product.sale_price * i.quantity), 0);

  const handleSubmit = async () => {
    if (items.length === 0) {
      alert('Adicione pelo menos um produto');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
      if (!user) return;

      // Get next bag number
      const { data: lastBag } = await supabase
        .from('bags')
        .select('bag_number')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let nextNumber = 1;
      if (lastBag) {
        const match = lastBag.bag_number.match(/\d+/);
        if (match) {
          nextNumber = parseInt(match[0]) + 1;
        }
      }

      // 1. Create Bag
      const { data: bag, error: bagError } = await supabase
        .from('bags')
        .insert([{
          bag_number: `M${nextNumber.toString().padStart(4, '0')}`,
          customer_id: selectedCustomer || null,
          campaign_id: campaignId || null,
          reseller_name: resellerName || null,
          status: 'open',
          total_value: totalValue,
          total_items: totalItems,
          payment_status: 'pending',
          user_id: user.id
        }])
        .select()
        .single();

      if (bagError) throw bagError;

      // 2. Create Bag Items
      const bagItems = items.map(item => ({
        bag_id: bag.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        returned_quantity: 0,
        unit_price: item.product.sale_price,
        color: item.color || null,
        size: item.size || null
      }));

      const { error: itemsError } = await supabase
        .from('bag_items')
        .insert(bagItems);

      if (itemsError) throw itemsError;

      // 3. Update stock if not noStock
      if (!noStock) {
        for (const item of items) {
          const { data: product } = await supabase
            .from('products')
            .select('current_stock, has_grid, grid_data')
            .eq('id', item.product.id)
            .single();
          
          if (product) {
            let updateData: any = { 
              current_stock: Math.max(0, (product.current_stock || 0) - item.quantity) 
            };

            if (product.has_grid && product.grid_data && item.color && item.size) {
              const newGridData = product.grid_data.map((g: any) => {
                if (g.color === item.color && g.size === item.size) {
                  return { ...g, quantity: Math.max(0, (g.quantity || 0) - item.quantity) };
                }
                return g;
              });
              updateData.grid_data = newGridData;
            }

            await supabase
              .from('products')
              .update(updateData)
              .eq('id', item.product.id);
          }
        }
      }

      onSave();
    } catch (err) {
      console.error('Error saving bag:', err);
      alert('Erro ao salvar sacola');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = productSearch 
    ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || String(p.ean || '').includes(productSearch)).slice(0, 50)
    : [];

  const filteredCustomers = customerSearch
    ? customers.filter(c => c.nome.toLowerCase().includes(customerSearch.toLowerCase()) || String(c.cpf || '').includes(customerSearch)).slice(0, 50)
    : [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">Sacolas</h2>
        <button 
          onClick={handleSubmit}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-6 py-3 sm:py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 w-full sm:w-auto"
        >
          <Save className="w-4 h-4" />
          Salvar Sacola
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
                <h3 className="font-serif italic text-xl text-zinc-700">Montagem da Sacola</h3>
              </div>
              <div className="w-full sm:flex-1 sm:max-w-xs sm:ml-8 relative">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Cliente (Opcional)</label>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
                    <span className="text-sm font-bold text-emerald-800">
                      {customers.find(c => c.id === selectedCustomer)?.nome}
                    </span>
                    <button 
                      onClick={() => {
                        setSelectedCustomer('');
                        setCustomerSearch('');
                      }}
                      className="text-emerald-600 hover:text-emerald-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Digite o nome ou CPF..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm text-zinc-800 focus:border-emerald-500 outline-none transition-all"
                    />
                    {filteredCustomers.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                        {filteredCustomers.map(c => (
                          <button 
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomer(c.id);
                              setCustomerSearch('');
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-zinc-50 text-left border-b border-zinc-50 last:border-0"
                          >
                            <div>
                              <p className="text-sm font-bold text-zinc-800">{c.nome}</p>
                              <p className="text-[10px] text-zinc-400">CPF: {c.cpf || '---'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Produto (Nome ou EAN)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Digite ou bipe o código"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (!productSearch.trim()) return;
                          
                          const searchLower = productSearch.toLowerCase().trim();
                          const match = products.find(p => 
                            p.ean === searchLower || 
                            p.name.toLowerCase() === searchLower ||
                            p.label_name?.toLowerCase() === searchLower
                          );

                          if (match) {
                            addItem(match);
                          } else {
                            alert('Erro de leitura: Produto não encontrado no catálogo.');
                            setProductSearch('');
                          }
                        }
                      }}
                      className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-800 focus:border-emerald-500 outline-none transition-all"
                    />
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                  </div>
                  
                  {filteredProducts.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white border border-zinc-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                      {filteredProducts.map(p => (
                        <button 
                          key={p.id}
                          onClick={() => addItem(p)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 text-left border-b border-zinc-50 last:border-0"
                        >
                          <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center">
                            <Package className="w-4 h-4 text-zinc-400" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-800">{p.name}</p>
                            <p className="text-[10px] text-zinc-400">EAN: {p.ean || '---'} | Estoque: {p.current_stock}</p>
                          </div>
                          <p className="ml-auto text-sm font-bold text-emerald-600">R$ {p.sale_price.toFixed(2)}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Revendedora</label>
                  <input 
                    type="text" 
                    placeholder="Nome da revendedora (opcional)"
                    value={resellerName}
                    onChange={(e) => setResellerName(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-800 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="bg-zinc-50 rounded-2xl p-4 flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="noStock"
                  checked={noStock}
                  onChange={(e) => setNoStock(e.target.checked)}
                  className="w-5 h-5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="noStock" className="text-sm font-medium text-zinc-600 cursor-pointer">
                  Criar sacola sem usar o estoque
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Produto</th>
                      <th className="py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Qtd</th>
                      <th className="py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Preço</th>
                      <th className="py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Subtotal</th>
                      <th className="py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {items.map((item, index) => (
                      <tr key={`${item.product.id}-${item.color}-${item.size}-${index}`} className="group">
                        <td className="py-4">
                          <p className="text-sm font-bold text-zinc-800">{item.product.name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-zinc-400">{item.product.label_name || 'Sem marca'}</p>
                            {(item.color || item.size) && (
                              <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">
                                {item.color && `Cor: ${item.color}`}
                                {item.color && item.size && ' | '}
                                {item.size && `Tam: ${item.size}`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center justify-center gap-3">
                            <button 
                              onClick={() => updateQuantity(item.product.id, -1, item.color, item.size)}
                              className="w-6 h-6 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-400 hover:border-emerald-500 hover:text-emerald-500 transition-all"
                            >
                              -
                            </button>
                            <span className="text-sm font-bold text-zinc-800 w-4 text-center">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.product.id, 1, item.color, item.size)}
                              className="w-6 h-6 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-400 hover:border-emerald-500 hover:text-emerald-500 transition-all"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-4 text-right text-sm text-zinc-500">
                          R$ {item.product.sale_price.toFixed(2)}
                        </td>
                        <td className="py-4 text-right text-sm font-bold text-zinc-800">
                          R$ {(item.product.sale_price * item.quantity).toFixed(2)}
                        </td>
                        <td className="py-4 text-right">
                          <button 
                            onClick={() => setItemToDelete(`${item.product.id}-${item.color}-${item.size}`)}
                            className="p-2 text-zinc-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-zinc-400 text-sm italic">
                          Nenhum produto adicionado à sacola.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm space-y-8 sticky top-24">
            <h3 className="font-serif italic text-xl text-zinc-700">Resumo da Sacola</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="text-sm">Total de Itens</span>
                <span className="font-bold">{totalItems}</span>
              </div>
              <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                <span className="text-lg font-bold text-zinc-800">Valor Total</span>
                <span className="text-2xl font-bold text-[#00a86b]">R$ {totalValue.toFixed(2)}</span>
              </div>
            </div>

            <button 
              onClick={handleSubmit}
              disabled={loading || items.length === 0}
              className="w-full bg-[#87ccb0] hover:bg-[#00a86b] text-white py-5 rounded-2xl font-bold text-lg transition-all shadow-lg shadow-emerald-900/5 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Finalizar Sacola'}
            </button>
          </div>
        </div>
      </div>

      {/* Grid Selection Modal */}
      {isGridModalOpen && selectedProductForGrid && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-serif italic text-zinc-900">Selecionar Variação</h3>
              <button onClick={() => setIsGridModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-sm font-bold text-zinc-800 mb-1">{selectedProductForGrid.name}</p>
                <p className="text-xs text-zinc-400">Escolha a cor e o tamanho para adicionar à sacola.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">Cor</label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(selectedProductForGrid.grid_data?.map(g => g.color))).map(color => (
                      <button
                        key={color}
                        onClick={() => setGridForm(prev => ({ ...prev, color, size: '' }))}
                        className={cn(
                          "px-4 py-2 rounded-xl border text-xs font-bold transition-all",
                          gridForm.color === color 
                            ? "border-emerald-500 text-emerald-600 bg-emerald-50" 
                            : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                        )}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>

                {gridForm.color && (
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">Tamanho</label>
                    <div className="flex flex-wrap gap-2">
                      {selectedProductForGrid.grid_data
                        ?.filter(g => g.color === gridForm.color)
                        .map(g => (
                          <button
                            key={g.size}
                            disabled={g.quantity <= 0}
                            onClick={() => setGridForm(prev => ({ ...prev, size: g.size }))}
                            className={cn(
                              "w-10 h-10 rounded-xl border flex items-center justify-center text-xs font-bold transition-all",
                              g.quantity <= 0 
                                ? "opacity-30 cursor-not-allowed bg-zinc-50" 
                                : gridForm.size === g.size 
                                  ? "border-emerald-500 text-emerald-600 bg-emerald-50" 
                                  : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                            )}
                          >
                            {g.size}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                disabled={!gridForm.color || !gridForm.size}
                onClick={() => addItem(selectedProductForGrid, gridForm.color, gridForm.size)}
                className="w-full bg-zinc-900 text-white py-4 rounded-2xl text-sm font-bold shadow-xl hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Adicionar à Sacola
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!itemToDelete}
        title="Remover Item"
        message="Tem certeza que deseja remover este item da sacola?"
        onConfirm={removeItem}
        onCancel={() => setItemToDelete(null)}
        variant="danger"
        confirmText="Remover"
      />
    </div>
  );
}
