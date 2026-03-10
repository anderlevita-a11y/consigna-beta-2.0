import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2,
  Trash2,
  Package as PackageIcon,
  AlertCircle,
  Loader2,
  Upload,
  CheckCircle2,
  X,
  ChevronLeft,
  TrendingUp,
  History,
  Bell,
  Tag,
  Printer,
  Eye,
  Lock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Product, PriceSuggestion } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { PrintPreview } from './PrintPreview';
import { cn, printFallback } from '../lib/utils';
import { useNotifications } from './NotificationCenter';

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'list' | 'form' | 'import'>('list');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  // Import State
  const [importing, setImporting] = useState(false);
  const [excelData, setExcelData] = useState('');
  const [centralProducts, setCentralProducts] = useState<any[]>([]);
  const [loadingCentral, setLoadingCentral] = useState(false);
  const [priceSuggestions, setPriceSuggestions] = useState<PriceSuggestion[]>([]);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [previewType, setPreviewType] = useState<'termica' | 'a4' | 'etiqueta'>('etiqueta');
  const [selectedCentralProduct, setSelectedCentralProduct] = useState<any>(null);
  const [suggestionForm, setSuggestionForm] = useState({
    cost_price: 0,
    sale_price: 0
  });
  const [priceHistory, setPriceHistory] = useState<PriceSuggestion[]>([]);

  const { addNotification } = useNotifications();

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    label_name: string;
    ean: string;
    cost_price: string | number;
    sale_price: string | number;
    current_stock: string | number;
    photo_url: string;
    has_grid: boolean;
    category: string;
    is_visible_in_store: boolean;
  }>({
    name: '',
    label_name: '',
    ean: '',
    cost_price: '',
    sale_price: '',
    current_stock: '',
    photo_url: '',
    has_grid: false,
    category: '',
    is_visible_in_store: true
  });
  const [storeSettings, setStoreSettings] = useState<any>(null);

  useEffect(() => {
    fetchProfile();
    fetchStoreSettings();
    if (view === 'list' || view === 'import') {
      fetchProducts();
    }
    if (view === 'import') {
      fetchCentralProducts();
      fetchPriceSuggestions();
    }

    const handleSyncEvent = () => {
      fetchProducts();
      if (view === 'import') {
        fetchCentralProducts();
      }
    };

    window.addEventListener('catalog_synced', handleSyncEvent);
    return () => window.removeEventListener('catalog_synced', handleSyncEvent);
  }, [view]);

  async function fetchStoreSettings() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
      if (!user) return;
      const { data } = await supabase
        .from('store_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (data) setStoreSettings(data);
    } catch (err) {
      console.error('Error fetching store settings:', err);
    }
  }

  async function fetchPriceSuggestions() {
    try {
      const { data, error } = await supabase
        .from('price_suggestions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPriceSuggestions(data || []);
    } catch (err) {
      console.error('Error fetching price suggestions:', err);
    }
  }

  async function fetchProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (data) setProfile(data);
    }
  }

  async function fetchCentralProducts() {
    setLoadingCentral(true);
    try {
      const { data, error } = await supabase
        .from('central_products')
        .select('*')
        .order('name');
      if (error) throw error;
      setCentralProducts(data || []);
    } catch (err) {
      console.error('Error fetching central products:', err);
    } finally {
      setLoadingCentral(false);
    }
  }

  const handleDeleteCentralProduct = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Produto',
      message: 'Deseja excluir este produto da central?',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('central_products')
            .delete()
            .eq('id', id);
          if (error) throw error;
          fetchCentralProducts();
        } catch (err) {
          console.error('Error deleting central product:', err);
          alert('Erro ao excluir produto');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleClearCentral = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Limpar Central',
      message: 'ATENÇÃO: Deseja excluir TODOS os produtos da central? Esta ação não pode ser desfeita.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          // Supabase requires a filter for delete. Using .not('id', 'is', null) is a safe way to target all rows.
          const { error } = await supabase
            .from('central_products')
            .delete()
            .not('id', 'is', null);
            
          if (error) throw error;
          
          await fetchCentralProducts();
          alert('Central de produtos limpa com sucesso!');
        } catch (err: any) {
          console.error('Error clearing central:', err);
          alert('Erro ao limpar central: ' + (err.message || 'Erro desconhecido'));
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleImportProducts = async () => {
    if (!excelData.trim()) {
      alert('Cole os dados do Excel primeiro.');
      return;
    }

    setImporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
      if (!user) throw new Error('Usuário não autenticado');

      const rows = excelData.split('\n').filter(row => row.trim());
      const productsToInsert = rows.map(row => {
        const cols = row.split('\t');
        // Sequence: nome produto, nome etiqueta, código EAN, custo, valor
        const name = cols[0]?.trim() || 'Produto Sem Nome';
        const label_name = cols[1]?.trim() || '';
        const ean = cols[2]?.trim() || '';
        const cost_price = parseFloat(cols[3]?.replace(',', '.') || '0');
        const sale_price = parseFloat(cols[4]?.replace(',', '.') || '0');

        return {
          user_id: user.id,
          name,
          label_name,
          ean,
          cost_price: isNaN(cost_price) ? 0 : cost_price,
          sale_price: isNaN(sale_price) ? 0 : sale_price,
          has_grid: false
        };
      });

      if (productsToInsert.length === 0) {
        alert('Nenhum dado válido encontrado.');
        setImporting(false);
        return;
      }

      // Insert products into central_products
      const { error } = await supabase
        .from('central_products')
        .insert(productsToInsert);

      if (error) throw error;

      alert(`${productsToInsert.length} produtos importados com sucesso para a Central!`);
      setExcelData('');
      fetchCentralProducts();
    } catch (err: any) {
      console.error('Error importing products:', err);
      alert('Erro ao importar produtos: ' + (err.message || 'Verifique o formato dos dados.'));
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Ensure session is fresh to avoid "exp" claim errors
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Por favor, faça login novamente.');

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `product-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, photo_url: publicUrl }));
    } catch (err) {
      console.error('Error uploading image:', err);
      alert('Erro ao carregar imagem');
    } finally {
      setUploading(false);
    }
  };

  async function fetchProducts() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
      if (!user) return;

      let allProducts: Product[] = [];
      let from = 0;
      let to = 999;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', user.id)
          .order('name', { ascending: true })
          .range(from, to);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allProducts = [...allProducts, ...data];
          from += 1000;
          to += 1000;
        } else {
          hasMore = false;
        }
        if (allProducts.length >= 50000) hasMore = false;
      }
      setProducts(allProducts);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleNewProduct = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      label_name: '',
      ean: '',
      cost_price: '',
      sale_price: '',
      current_stock: '',
      photo_url: '',
      has_grid: false,
      category: '',
      is_visible_in_store: true
    });
    setView('form');
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      label_name: product.label_name || '',
      ean: product.ean || '',
      cost_price: product.cost_price?.toString() || '',
      sale_price: product.sale_price?.toString() || '',
      current_stock: product.current_stock?.toString() || '',
      photo_url: product.photo_url || '',
      has_grid: product.has_grid || false,
      category: product.category || '',
      is_visible_in_store: product.is_visible_in_store !== false
    });
    setView('form');
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Produto',
      message: 'Tem certeza que deseja excluir este produto?',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);
          if (error) throw error;
          fetchProducts();
        } catch (err) {
          console.error('Error deleting product:', err);
          alert('Erro ao excluir produto');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
      if (!user) return;

      // Convert empty EAN or '0' to null to avoid unique constraint violations on placeholders
      const trimmedEan = formData.ean?.trim();
      const finalEan = (trimmedEan === '' || trimmedEan === '0') ? null : trimmedEan;

      const dataToSave = {
        ...formData,
        ean: finalEan,
        cost_price: Number(formData.cost_price.toString().replace(',', '.')) || 0,
        sale_price: Number(formData.sale_price.toString().replace(',', '.')) || 0,
        current_stock: parseInt(formData.current_stock.toString()) || 0
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(dataToSave)
          .eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert([{ ...dataToSave, user_id: user.id, is_visible_in_store: true }]);
        if (error) throw error;
      }
      setView('list');
      fetchProducts(); // Refresh the list
    } catch (err: any) {
      console.error('Error saving product:', err);
      if (err.code === '23505') {
        const conflictingProduct = products.find(p => 
          p.ean === formData.ean.trim() && 
          p.id !== editingProduct?.id
        );
        
        if (conflictingProduct) {
          alert(`Erro: O código EAN "${formData.ean}" já está cadastrado no produto "${conflictingProduct.name}". Cada produto deve ter um EAN exclusivo.`);
        } else {
          alert('Erro: Já existe um produto com este código EAN no seu catálogo.');
        }
      } else {
        alert('Erro ao salvar produto: ' + (err.message || 'Erro desconhecido'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddSingleFromCentral = async (centralProduct: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
      if (!user) return;

      const isValidEan = centralProduct.ean && centralProduct.ean !== '0' && centralProduct.ean !== '';

      const exists = products.some(p => {
        if (isValidEan && p.ean === centralProduct.ean) return true;
        return p.name.toLowerCase().trim() === centralProduct.name.toLowerCase().trim();
      });

      if (exists) {
        alert('Este produto já está no seu catálogo.');
        return;
      }

      const { error } = await supabase.from('products').insert([{
        user_id: user.id,
        name: centralProduct.name,
        label_name: centralProduct.label_name,
        ean: isValidEan ? centralProduct.ean : null,
        cost_price: centralProduct.cost_price,
        sale_price: centralProduct.sale_price,
        current_stock: 0,
        photo_url: centralProduct.photo_url,
        has_grid: centralProduct.has_grid,
        is_visible_in_store: true
      }]);

      if (error) throw error;
      
      alert('Produto adicionado com sucesso!');
      fetchProducts();
    } catch (err: any) {
      console.error('Error adding product from central:', err);
      alert('Erro ao adicionar produto: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const handleOpenPriceModal = async (product: any) => {
    setSelectedCentralProduct(product);
    setSuggestionForm({
      cost_price: product.cost_price,
      sale_price: product.sale_price
    });
    
    // Fetch history for this product
    try {
      const { data, error } = await supabase
        .from('price_suggestions')
        .select('*')
        .eq('central_product_id', product.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPriceHistory(data || []);
    } catch (err) {
      console.error('Error fetching price history:', err);
    }
    
    setIsPriceModalOpen(true);
  };

  const handleSavePriceSuggestion = async () => {
    if (!selectedCentralProduct) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
      if (!user) return;

      const { error } = await supabase
        .from('price_suggestions')
        .insert([{
          central_product_id: selectedCentralProduct.id,
          suggested_cost_price: suggestionForm.cost_price,
          suggested_sale_price: suggestionForm.sale_price,
          created_by: user.id
        }]);

      if (error) throw error;

      // Also update the central product's current prices
      const { error: updateError } = await supabase
        .from('central_products')
        .update({
          cost_price: suggestionForm.cost_price,
          sale_price: suggestionForm.sale_price
        })
        .eq('id', selectedCentralProduct.id);

      if (updateError) throw updateError;

      // Broadcast notification
      await supabase.channel('catalog_updates').send({
        type: 'broadcast',
        event: 'catalog_updated',
        payload: { 
          message: `Preço atualizado: ${selectedCentralProduct.name}`,
          product_id: selectedCentralProduct.id
        }
      });

      // Create a persistent announcement
      await supabase.from('announcements').insert([{
        title: 'Atualização de Preço',
        message: `O administrador sugeriu novos preços para o produto: ${selectedCentralProduct.name}`,
        type: 'price_change',
        created_by: user.id
      }]);

      alert('Sugestão de preço salva e usuários notificados!');
      setIsPriceModalOpen(false);
      fetchCentralProducts();
      fetchPriceSuggestions();
    } catch (err: any) {
      console.error('Error saving price suggestion:', err);
      alert('Erro ao salvar sugestão: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const handlePrintLabel = async (product: any) => {
    setLoading(true);
    try {
      const payload = {
        tipo_documento: 'etiqueta',
        dados_cliente: { nome: 'Consigna Beauty', cpf: '---' },
        itens: [{
          nome: product.name,
          preco: product.sale_price,
          qtd: 1,
          total: product.sale_price
        }]
      };

      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: payload
      });

      if (error) throw error;
      
      setPdfUrl(data.url);
      setPreviewType('etiqueta');
      setShowPreview(true);
    } catch (err: any) {
      console.warn('Edge Function (generate-pdf) not available, using fallback print:', err.message);
      
      // Fallback to simple print if Edge Function is not reachable or any error occurs
      const payload = {
        tipo_documento: 'etiqueta',
        dados_cliente: { nome: 'Consigna Beauty', cpf: '---' },
        itens: [{
          nome: product.name,
          preco: product.sale_price,
          qtd: 1,
          total: product.sale_price
        }]
      };
      printFallback(payload);
    } finally {
      setLoading(false);
    }
  };


  const handleApplyPriceSuggestion = (product: any, suggestion: PriceSuggestion) => {
    setConfirmModal({
      isOpen: true,
      title: 'Atualizar Preço',
      message: `Deseja atualizar o preço deste produto para os valores sugeridos?\n\nCusto: R$ ${suggestion.suggested_cost_price.toFixed(2)}\nVenda: R$ ${suggestion.suggested_sale_price.toFixed(2)}`,
      variant: 'info',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('products')
            .update({
              cost_price: suggestion.suggested_cost_price,
              sale_price: suggestion.suggested_sale_price
            })
            .eq('id', product.id);
          
          if (error) throw error;
          
          alert('Preço atualizado com sucesso!');
          fetchProducts();
        } catch (err: any) {
          console.error('Error applying price suggestion:', err);
          alert('Erro ao atualizar preço: ' + (err.message || 'Erro desconhecido'));
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const isAdmin = profile?.role === 'admin' || 
    profile?.email === 'anderlevita@gmail.com';

  const isRestrictedPlan = profile?.status_pagamento === 'STARTER' || profile?.status_pagamento === 'TRIAL';

  if (view === 'form') {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">Catálogo de Produtos</h2>
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {products.length} itens
            </span>
          </div>
          <button 
            onClick={() => setView('list')}
            className="text-sm font-bold text-zinc-500 hover:text-zinc-800 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto bg-zinc-100 sm:bg-transparent py-3 sm:py-0 rounded-xl sm:rounded-none"
          >
            Voltar para Lista
          </button>
        </div>

        <div className="max-w-4xl mx-auto bg-white border border-zinc-200 rounded-[32px] shadow-xl overflow-hidden">
          <div className="p-8 border-b border-zinc-100">
            <h3 className="text-xl font-bold text-zinc-700 italic">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
          </div>

          <form onSubmit={handleSave} className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nome do Produto *</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nome na Etiqueta</label>
                <input 
                  type="text" 
                  value={formData.label_name}
                  onChange={e => setFormData({...formData, label_name: e.target.value})}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Código EAN</label>
              <input 
                type="text" 
                value={formData.ean}
                onChange={e => setFormData({...formData, ean: e.target.value})}
                className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Custo [R$]</label>
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={formData.cost_price}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9.,]/g, '');
                    setFormData({...formData, cost_price: val});
                  }}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Venda [R$]</label>
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={formData.sale_price}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9.,]/g, '');
                    setFormData({...formData, sale_price: val});
                  }}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Estoque Atual</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={formData.current_stock}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setFormData({...formData, current_stock: val});
                  }}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Categoria</label>
                <select 
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all appearance-none"
                >
                  <option value="">Sem Categoria</option>
                  {storeSettings?.categories?.map((cat: string) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="bg-zinc-50/50 border border-zinc-100 rounded-2xl p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white border border-zinc-100 flex items-center justify-center">
                    <Eye className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <p className="font-bold text-zinc-700 text-sm">Visível na Loja</p>
                    <p className="text-[10px] text-zinc-400">Mostrar este produto na vitrine virtual</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, is_visible_in_store: !formData.is_visible_in_store})}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    formData.is_visible_in_store ? "bg-emerald-500" : "bg-zinc-200"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                    formData.is_visible_in_store ? "left-7" : "left-1"
                  )} />
                </button>
              </div>
            </div>

            <div className="bg-zinc-50/50 border border-zinc-100 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white border border-zinc-100 flex items-center justify-center">
                  <PackageIcon className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <p className="font-bold text-zinc-700 text-sm">Configuração de Grade</p>
                  <p className="text-[10px] text-zinc-400">Solicitar cor e tamanho na montagem da sacola</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setFormData({...formData, has_grid: !formData.has_grid})}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  formData.has_grid ? "bg-emerald-500" : "bg-zinc-200"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  formData.has_grid ? "left-7" : "left-1"
                )} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Foto do Produto</label>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-100 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 hover:border-emerald-500/50 transition-all cursor-pointer group bg-zinc-50/30"
              >
                {uploading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                ) : formData.photo_url ? (
                  <div className="flex flex-col items-center gap-2">
                    <img src={formData.photo_url} alt="Preview" className="w-20 h-20 object-cover rounded-lg" referrerPolicy="no-referrer" />
                    <p className="text-[10px] text-emerald-600 font-bold uppercase">Foto Carregada</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-zinc-300 group-hover:text-emerald-500 transition-all" />
                    <p className="text-xs text-zinc-400 font-medium">Clique para carregar foto</p>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Variações de EAN</label>
              <input 
                type="text" 
                placeholder="Adicionar EAN..."
                className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
              />
            </div>

            <button 
              type="submit"
              disabled={saving}
              className="w-full bg-[#00a86b] hover:bg-[#008f5b] text-white py-5 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'import') {
    if (isRestrictedPlan) {
      setView('list');
      return null;
    }
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">Central de Produtos</h2>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                {centralProducts.length} disponíveis
              </span>
              {isAdmin && (
                <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  Modo Admin
                </span>
              )}
            </div>
          </div>
          <button 
            onClick={() => setView('list')}
            className="text-sm font-bold text-zinc-500 hover:text-zinc-800 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto bg-zinc-100 sm:bg-transparent py-3 sm:py-0 rounded-xl sm:rounded-none"
          >
            Voltar para Lista
          </button>
        </div>

        <div className="bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm space-y-6">
          {!isAdmin && priceSuggestions.length > 0 && (
            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="w-12 h-12 rounded-2xl bg-white border border-purple-100 flex items-center justify-center text-purple-500 shadow-sm">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-purple-900">Novas Sugestões de Preço</p>
                  <p className="text-xs text-purple-600">Existem atualizações de preços sugeridas pelo administrador.</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setConfirmModal({
                    isOpen: true,
                    title: 'Sincronizar Todos os Preços',
                    message: 'Deseja atualizar os preços de TODOS os seus produtos que possuem sugestões da Central?',
                    variant: 'info',
                    onConfirm: async () => {
                      try {
                        setSyncing(true);
                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                        
                        let updatedCount = 0;
                        for (const suggestion of priceSuggestions) {
                          const product = products.find(p => {
                            const pKey = (p.ean && p.ean !== '0' && p.ean !== '') ? p.ean : p.name.toLowerCase().trim();
                            const cProduct = centralProducts.find(cp => cp.id === suggestion.central_product_id);
                            if (!cProduct) return false;
                            const cKey = (cProduct.ean && cProduct.ean !== '0' && cProduct.ean !== '') ? cProduct.ean : cProduct.name.toLowerCase().trim();
                            return pKey === cKey;
                          });

                          if (product) {
                            const { error } = await supabase
                              .from('products')
                              .update({
                                cost_price: suggestion.suggested_cost_price,
                                sale_price: suggestion.suggested_sale_price
                              })
                              .eq('id', product.id);
                            if (!error) updatedCount++;
                          }
                        }
                        
                        alert(`${updatedCount} produtos atualizados com sucesso!`);
                        fetchProducts();
                      } catch (err) {
                        console.error('Error syncing all prices:', err);
                        alert('Erro ao sincronizar preços.');
                      } finally {
                        setSyncing(false);
                      }
                    }
                  });
                }}
                disabled={syncing}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
              >
                {syncing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sincronizar Tudo Agora'}
              </button>
            </div>
          )}

          {isAdmin && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">
                Cole os dados copiados do Excel. A sequência das colunas deve ser exatamente: <br/>
                <strong className="text-zinc-800">Nome do Produto | Nome na Etiqueta | Código EAN | Custo | Valor de Venda</strong>
              </p>
              <textarea
                value={excelData}
                onChange={(e) => setExcelData(e.target.value)}
                placeholder="Cole os dados aqui..."
                className="w-full h-32 bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-sm font-mono focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleImportProducts}
                  disabled={importing || !excelData.trim()}
                  className="flex items-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  {importing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  Importar Lote
                </button>
              </div>
            </div>
          )}

          <div className="border border-zinc-100 rounded-xl overflow-hidden">
            <div className="p-4 bg-zinc-50 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <h4 className="text-xs font-bold text-zinc-600 uppercase tracking-wider text-center sm:text-left">Produtos Disponíveis na Central</h4>
                {isAdmin && centralProducts.length > 0 && (
                  <button 
                    onClick={handleClearCentral}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold uppercase transition-all w-full sm:w-auto"
                  >
                    <Trash2 className="w-3 h-3" />
                    Limpar Tudo
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-100 z-10">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Produto</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nome Etiqueta</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">EAN</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Custo</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Venda</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {loadingCentral ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" />
                      </td>
                    </tr>
                  ) : centralProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-sm">
                        Nenhum produto na central.
                      </td>
                    </tr>
                  ) : (
                    centralProducts.map((product) => {
                      const key = (product.ean && product.ean !== '0' && product.ean !== '') 
                        ? product.ean 
                        : product.name.toLowerCase().trim();
                      
                      const isAdded = products.some(p => {
                        const pKey = (p.ean && p.ean !== '0' && p.ean !== '') ? p.ean : p.name.toLowerCase().trim();
                        return pKey === key;
                      });

                      return (
                        <tr key={product.id} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-sm font-bold text-zinc-800">{product.name}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-zinc-500">{product.label_name || '-'}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-500 font-mono">{product.ean || '-'}</td>
                          <td className="px-4 py-3 text-sm text-zinc-500 text-right">R$ {product.cost_price?.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-emerald-600 text-right">R$ {product.sale_price?.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {isAdmin ? (
                                <>
                                  <button 
                                    onClick={() => handleOpenPriceModal(product)}
                                    className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg text-[10px] font-bold uppercase transition-all"
                                    title="Atualizar Preço / Sugerir Alteração"
                                  >
                                    <TrendingUp className="w-3 h-3" />
                                    Preço
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteCentralProduct(product.id)}
                                    className="flex items-center gap-1.5 px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold uppercase transition-all"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Excluir
                                  </button>
                                </>
                              ) : (
                                <>
                                  {(() => {
                                    const userProduct = products.find(p => {
                                      const pKey = (p.ean && p.ean !== '0' && p.ean !== '') ? p.ean : p.name.toLowerCase().trim();
                                      const cKey = (product.ean && product.ean !== '0' && product.ean !== '') ? product.ean : product.name.toLowerCase().trim();
                                      return pKey === cKey;
                                    });
                                    
                                    const latestSuggestion = priceSuggestions.find(s => s.central_product_id === product.id);
                                    const hasSuggestion = latestSuggestion && userProduct && (
                                      userProduct.cost_price !== latestSuggestion.suggested_cost_price ||
                                      userProduct.sale_price !== latestSuggestion.suggested_sale_price
                                    );

                                    if (userProduct) {
                                      return (
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-lg">
                                            Adicionado
                                          </span>
                                          {hasSuggestion && (
                                            <button 
                                              onClick={() => handleApplyPriceSuggestion(userProduct, latestSuggestion)}
                                              className="flex items-center gap-1.5 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm animate-pulse"
                                            >
                                              <TrendingUp className="w-3 h-3" />
                                              Atualizar Preço
                                            </button>
                                          )}
                                        </div>
                                      );
                                    }

                                    return (
                                      <button 
                                        onClick={() => handleAddSingleFromCentral(product)}
                                        className="text-emerald-500 hover:text-emerald-700 transition-colors text-xs font-bold uppercase"
                                      >
                                        Adicionar
                                      </button>
                                    );
                                  })()}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          variant={confirmModal.variant}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        />

        {/* Price Suggestion Modal */}
        {isPriceModalOpen && selectedCentralProduct && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-500">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-800 tracking-tight">Sugerir Alteração de Preço</h3>
                    <p className="text-xs text-zinc-400">{selectedCentralProduct.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPriceModalOpen(false)}
                  className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Novo Custo [R$]</label>
                    <input 
                      type="text" 
                      inputMode="decimal"
                      value={suggestionForm.cost_price === 0 ? '' : suggestionForm.cost_price}
                      onChange={e => {
                        const val = e.target.value.replace(',', '.');
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setSuggestionForm({...suggestionForm, cost_price: val === '' ? 0 : Number(val)});
                        }
                      }}
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-purple-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Novo Preço de Venda [R$]</label>
                    <input 
                      type="text" 
                      inputMode="decimal"
                      value={suggestionForm.sale_price === 0 ? '' : suggestionForm.sale_price}
                      onChange={e => {
                        const val = e.target.value.replace(',', '.');
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setSuggestionForm({...suggestionForm, sale_price: val === '' ? 0 : Number(val)});
                        }
                      }}
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-purple-500 outline-none transition-all"
                    />
                  </div>
                  <button
                    onClick={handleSavePriceSuggestion}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
                  >
                    Salvar Sugestão e Notificar
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <History className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Histórico de Alterações</span>
                  </div>
                  <div className="bg-zinc-50 rounded-2xl p-4 h-[240px] overflow-y-auto space-y-3 border border-zinc-100">
                    {priceHistory.length === 0 ? (
                      <p className="text-xs text-zinc-400 text-center py-8 italic">Nenhuma alteração anterior registrada.</p>
                    ) : (
                      priceHistory.map((history) => (
                        <div key={history.id} className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[9px] text-zinc-400">{new Date(history.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[8px] text-zinc-400 uppercase font-bold">Custo</p>
                              <p className="text-xs font-bold text-zinc-700">R$ {history.suggested_cost_price.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-[8px] text-zinc-400 uppercase font-bold">Venda</p>
                              <p className="text-xs font-bold text-zinc-700">R$ {history.suggested_sale_price.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.ean?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayedProducts = filteredProducts.slice(0, 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-800">Catálogo de Produtos</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
            <p className="text-sm text-zinc-500">Gerencie seu estoque e catálogo.</p>
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit">
              {products.length} Itens Cadastrados
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setView('import')}
            disabled={isRestrictedPlan}
            className={cn(
              "flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-4 py-3 sm:py-2.5 rounded-xl font-bold transition-all shadow-sm w-full sm:w-auto",
              isRestrictedPlan && "opacity-50 cursor-not-allowed grayscale"
            )}
          >
            <Upload className="w-5 h-5" />
            Central de Produtos
            {isRestrictedPlan && <Lock className="w-3.5 h-3.5 text-zinc-400" />}
          </button>
          <button 
            onClick={handleNewProduct}
            className="flex items-center justify-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-4 py-3 sm:py-2.5 rounded-xl font-bold transition-all shadow-sm w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Novo Produto
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou EAN..." 
            className="w-full bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-3 text-zinc-800 focus:outline-none focus:border-emerald-500 transition-colors shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Produto</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nome Etiqueta</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">EAN</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Preço</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Estoque</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-400">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                      Carregando produtos...
                    </div>
                  </td>
                </tr>
              ) : displayedProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">Nenhum produto encontrado.</td>
                </tr>
              ) : (
                <>
                  {displayedProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-zinc-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center overflow-hidden">
                            {product.photo_url ? (
                              <img src={product.photo_url} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <PackageIcon className="w-6 h-6 text-zinc-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-800">{product.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-zinc-500">{product.label_name || '-'}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-500 font-mono">{product.ean || '-'}</td>
                      <td className="px-6 py-4 text-sm font-bold text-zinc-800">R$ {product.sale_price?.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-sm font-bold",
                            product.current_stock <= 5 ? "text-red-500" : "text-zinc-700"
                          )}>
                            {product.current_stock} un
                          </span>
                          {product.current_stock <= 5 && <AlertCircle className="w-4 h-4 text-red-500" />}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                            product.current_stock > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                          )}>
                            {product.current_stock > 0 ? 'Em estoque' : 'Esgotado'}
                          </span>
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                            product.is_visible_in_store !== false ? "bg-purple-50 text-purple-600" : "bg-zinc-100 text-zinc-400"
                          )}>
                            {product.is_visible_in_store !== false ? 'Visível na Loja' : 'Oculto na Loja'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handlePrintLabel(product)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-[10px] font-bold uppercase transition-all"
                            title="Imprimir Etiqueta"
                          >
                            <Tag className="w-3 h-3" />
                            Etiqueta
                          </button>
                          <button 
                            onClick={() => handleEdit(product)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-[10px] font-bold uppercase transition-all"
                          >
                            <Edit2 className="w-3 h-3" />
                            Editar
                          </button>
                          <button 
                            onClick={() => handleDelete(product.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold uppercase transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length > 100 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-xs text-zinc-500 bg-zinc-50">
                        Mostrando os primeiros 100 resultados de {filteredProducts.length}. Use a busca para encontrar mais produtos.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Price Suggestion Modal */}
      {isPriceModalOpen && selectedCentralProduct && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-500">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-800 tracking-tight">Sugerir Alteração de Preço</h3>
                  <p className="text-xs text-zinc-400">{selectedCentralProduct.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsPriceModalOpen(false)}
                className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Novo Custo [R$]</label>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    value={suggestionForm.cost_price === 0 ? '' : suggestionForm.cost_price}
                    onChange={e => {
                      const val = e.target.value.replace(',', '.');
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setSuggestionForm({...suggestionForm, cost_price: val === '' ? 0 : Number(val)});
                      }
                    }}
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-purple-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Novo Preço de Venda [R$]</label>
                  <input 
                    type="text" 
                    inputMode="decimal"
                    value={suggestionForm.sale_price === 0 ? '' : suggestionForm.sale_price}
                    onChange={e => {
                      const val = e.target.value.replace(',', '.');
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setSuggestionForm({...suggestionForm, sale_price: val === '' ? 0 : Number(val)});
                      }
                    }}
                    className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-purple-500 outline-none transition-all"
                  />
                </div>
                <button
                  onClick={handleSavePriceSuggestion}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
                >
                  Salvar Sugestão e Notificar
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-zinc-400">
                  <History className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Histórico de Alterações</span>
                </div>
                <div className="bg-zinc-50 rounded-2xl p-4 h-[240px] overflow-y-auto space-y-3 border border-zinc-100">
                  {priceHistory.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-8 italic">Nenhuma alteração anterior registrada.</p>
                  ) : (
                    priceHistory.map((history) => (
                      <div key={history.id} className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[9px] text-zinc-400">{new Date(history.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[8px] text-zinc-400 uppercase font-bold">Custo</p>
                            <p className="text-xs font-bold text-zinc-700">R$ {history.suggested_cost_price.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-[8px] text-zinc-400 uppercase font-bold">Venda</p>
                            <p className="text-xs font-bold text-zinc-700">R$ {history.suggested_sale_price.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <PrintPreview 
          pdfUrl={pdfUrl} 
          tipo={previewType} 
          onClose={() => setShowPreview(false)} 
        />
      )}
    </div>
  );
}
