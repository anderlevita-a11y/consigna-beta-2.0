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
  ChevronLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Product } from '../types';

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    label_name: '',
    ean: '',
    cost_price: 0,
    sale_price: 0,
    current_stock: 0,
    photo_url: '',
    has_grid: false
  });

  useEffect(() => {
    if (view === 'list') {
      fetchProducts();
    }
  }, [view]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
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
      let allProducts: Product[] = [];
      let from = 0;
      let to = 999;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
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
      cost_price: 0,
      sale_price: 0,
      current_stock: 0,
      photo_url: '',
      has_grid: false
    });
    setView('form');
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      label_name: product.label_name || '',
      ean: product.ean || '',
      cost_price: product.cost_price || 0,
      sale_price: product.sale_price || 0,
      current_stock: product.current_stock || 0,
      photo_url: product.photo_url || '',
      has_grid: false // Assuming false for now as it's a new field
    });
    setView('form');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
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
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update({ ...formData })
          .eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert([{ ...formData, user_id: user.id }]);
        if (error) throw error;
      }
      setView('list');
    } catch (err) {
      console.error('Error saving product:', err);
      alert('Erro ao salvar produto');
    } finally {
      setSaving(false);
    }
  };

  if (view === 'form') {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">Catálogo de Produtos</h2>
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {products.length} itens
            </span>
          </div>
          <button 
            onClick={() => setView('list')}
            className="text-sm font-bold text-zinc-500 hover:text-zinc-800 transition-colors flex items-center gap-2"
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
                  type="number" 
                  step="0.01"
                  value={formData.cost_price}
                  onChange={e => setFormData({...formData, cost_price: Number(e.target.value)})}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Venda [R$]</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={formData.sale_price}
                  onChange={e => setFormData({...formData, sale_price: Number(e.target.value)})}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Estoque Atual</label>
                <input 
                  type="number" 
                  value={formData.current_stock}
                  onChange={e => setFormData({...formData, current_stock: Number(e.target.value)})}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="bg-zinc-50/50 border border-zinc-100 rounded-2xl p-6 flex items-center justify-between">
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

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.ean?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-800">Catálogo de Produtos</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-zinc-500">Gerencie seu estoque e catálogo.</p>
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {products.length} Itens Cadastrados
            </span>
          </div>
        </div>
        <button 
          onClick={handleNewProduct}
          className="flex items-center justify-center gap-2 bg-[#00a86b] hover:bg-[#008f5b] text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Novo Produto
        </button>
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
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-400">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                      Carregando produtos...
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">Nenhum produto encontrado.</td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
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
                          <p className="text-xs text-zinc-400">{product.label_name || 'Sem etiqueta'}</p>
                        </div>
                      </div>
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
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                        product.current_stock > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      )}>
                        {product.current_stock > 0 ? 'Em estoque' : 'Esgotado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
