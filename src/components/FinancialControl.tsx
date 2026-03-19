import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Plus, 
  Trash2, 
  Filter, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart3,
  Download,
  Search,
  Tag,
  Loader2,
  Save
} from 'lucide-react';
import { cn, formatError } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useNotifications } from './NotificationCenter';
import { ConfirmationModal } from './ConfirmationModal';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  due_date?: string;
  reminder_enabled?: boolean;
  status?: 'paid' | 'pending';
}

interface CategoryState {
  income: string[];
  expense: string[];
}

const DEFAULT_CATEGORIES: CategoryState = {
  income: ['Vendas', 'Serviços', 'Comissões', 'Outros'],
  expense: ['Fornecedores', 'Marketing', 'Aluguel', 'Impostos', 'Salários', 'Software', 'Outros']
};

const COLORS = ['#38a89d', '#4a1d33', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#10b981'];

export function FinancialControl() {
  const { addNotification } = useNotifications();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CategoryState>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [dueReminders, setDueReminders] = useState<Transaction[]>([]);
  const [isDueModalOpen, setIsDueModalOpen] = useState(false);

  // Form State
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
    type: 'expense',
    date: new Date().toISOString().split('T')[0],
    category: DEFAULT_CATEGORIES.expense[0],
    status: 'paid',
    reminder_enabled: false
  });

  // Load data from Supabase
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
        if (user) {
          // Load transactions
          const { data: transData, error: transError } = await supabase
            .from('financial_transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });

          if (transError) throw transError;
          if (transData) {
            setTransactions(transData);
            checkReminders(transData);
          }

          // Load categories
          const { data: catData, error: catError } = await supabase
            .from('financial_categories')
            .select('categories')
            .eq('user_id', user.id)
            .single();

          if (catData?.categories) {
            setCategories(catData.categories);
          }
        }
      } catch (err) {
        console.error('Error loading financial data:', err);
        // Fallback to localStorage if needed
        const savedTransactions = localStorage.getItem('financial_data');
        if (savedTransactions) setTransactions(JSON.parse(savedTransactions));
        
        const savedCategories = localStorage.getItem('financial_categories');
        if (savedCategories) setCategories(JSON.parse(savedCategories));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const type = newTransaction.type as keyof CategoryState;
    if (categories[type].includes(newCategoryName.trim())) return;

    setCategories({
      ...categories,
      [type]: [...categories[type], newCategoryName.trim()]
    });
    setNewTransaction({ ...newTransaction, category: newCategoryName.trim() });
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const stats = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((acc, t) => acc + t.amount, 0);
    const expenses = transactions
      .filter(t => t.type === 'expense' && t.status !== 'pending')
      .reduce((acc, t) => acc + t.amount, 0);
    const pendingExpenses = transactions
      .filter(t => t.type === 'expense' && t.status === 'pending')
      .reduce((acc, t) => acc + t.amount, 0);
    return {
      income,
      expenses,
      pendingExpenses,
      balance: income - expenses
    };
  }, [transactions]);

  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const dayTransactions = transactions.filter(t => t.date === date);
      return {
        date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        income: dayTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0),
        expense: dayTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0)
      };
    });
  }, [transactions]);

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
      });
    
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const filteredTransactions = transactions
    .filter(t => {
      const matchesType = 
        filterType === 'all' ? true : 
        filterType === 'income' ? t.type === 'income' : 
        filterType === 'expense' ? t.type === 'expense' :
        filterType === 'pending' ? t.status === 'pending' : true;
      
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           t.category.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesSearch;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const checkReminders = (data: Transaction[]) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    const dueToday: Transaction[] = [];

    data.forEach(t => {
      if (t.type === 'expense' && t.status === 'pending' && t.due_date && t.reminder_enabled) {
        // Check if due today
        if (t.due_date === todayStr) {
          dueToday.push(t);
          addNotification({
            type: 'warning',
            title: 'Vencimento Hoje',
            message: `A conta "${t.description}" vence hoje! Valor: R$ ${t.amount.toLocaleString('pt-BR')}`
          });
        }
        // Check if due tomorrow
        else if (t.due_date === tomorrowStr) {
          addNotification({
            type: 'info',
            title: 'Vencimento Amanhã',
            message: `A conta "${t.description}" vence amanhã. Valor: R$ ${t.amount.toLocaleString('pt-BR')}`
          });
        }
      }
    });

    if (dueToday.length > 0) {
      setDueReminders(dueToday);
      setIsDueModalOpen(true);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTransaction.description || !newTransaction.amount) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
      if (!user) throw new Error('Usuário não autenticado');

      const transactionData = {
        user_id: user.id,
        description: newTransaction.description as string,
        amount: Number(newTransaction.amount),
        type: newTransaction.type as 'income' | 'expense',
        category: newTransaction.category as string,
        date: newTransaction.date as string,
        due_date: newTransaction.status === 'pending' ? newTransaction.due_date : null,
        reminder_enabled: newTransaction.reminder_enabled || false,
        status: newTransaction.status || 'paid'
      };

      const { data, error } = await supabase
        .from('financial_transactions')
        .insert([transactionData])
        .select()
        .single();

      if (error) throw error;

      setTransactions([data, ...transactions]);
      
      // Check for reminders if it's a pending expense
      if (data.type === 'expense' && data.status === 'pending' && data.due_date && data.reminder_enabled) {
        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrowDate = new Date();
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

        if (data.due_date === todayStr) {
          setDueReminders(prev => [data, ...prev]);
          setIsDueModalOpen(true);
          addNotification({
            type: 'warning',
            title: 'Vencimento Hoje',
            message: `A conta "${data.description}" vence hoje! Valor: R$ ${data.amount.toLocaleString('pt-BR')}`
          });
        } else if (data.due_date === tomorrowStr) {
          addNotification({
            type: 'info',
            title: 'Vencimento Amanhã',
            message: `A conta "${data.description}" vence amanhã. Valor: R$ ${data.amount.toLocaleString('pt-BR')}`
          });
        }
      }

      setIsModalOpen(false);
      setNewTransaction({
        type: 'expense',
        date: new Date().toISOString().split('T')[0],
        category: categories.expense[0],
        status: 'paid',
        reminder_enabled: false
      });
      
      // Also save categories to Supabase if they changed (added new one)
      await supabase
        .from('financial_categories')
        .upsert({
          user_id: user.id,
          categories: categories,
          updated_at: new Date().toISOString()
        });

    } catch (err: any) {
      console.error('Error adding transaction:', err);
      addNotification({
        type: 'error',
        title: 'Erro ao salvar',
        message: formatError(err)
      });
    } finally {
      setSaving(false);
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('financial_transactions')
        .update({ status: 'paid', date: new Date().toISOString().split('T')[0] })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setTransactions(transactions.map(t => t.id === id ? data : t));
      addNotification({
        type: 'success',
        title: 'Pagamento Confirmado',
        message: 'A conta foi marcada como paga e o saldo atualizado.'
      });
    } catch (err: any) {
      console.error('Error marking as paid:', err);
      addNotification({
        type: 'error',
        title: 'Erro ao atualizar',
        message: formatError(err)
      });
    }
  };

  const removeTransaction = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Lançamento',
      message: 'Deseja realmente excluir este lançamento? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('financial_transactions')
            .delete()
            .eq('id', id);

          if (error) throw error;

          setTransactions(transactions.filter(t => t.id !== id));
          addNotification({
            type: 'success',
            title: 'Lançamento excluído',
            message: 'O lançamento foi removido com sucesso.'
          });
        } catch (err: any) {
          console.error('Error removing transaction:', err);
          addNotification({
            type: 'error',
            title: 'Erro ao excluir',
            message: formatError(err)
          });
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#38a89d] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#4a1d33]/10 rounded-2xl flex items-center justify-center">
            <Wallet className="w-7 h-7 text-[#4a1d33]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">Controle Financeiro</h2>
            <p className="text-sm text-zinc-500">Gestão profissional do seu fluxo de caixa.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[#38a89d] text-white px-6 py-3 rounded-2xl font-bold hover:bg-[#2d8a81] transition-all shadow-lg shadow-[#38a89d]/20"
          >
            <Plus className="w-5 h-5" />
            Novo Lançamento
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Saldo Geral" 
          value={stats.balance} 
          icon={Wallet} 
          color="indigo" 
          trend={stats.balance >= 0 ? 'up' : 'down'}
        />
        <StatCard 
          title="Total Receitas" 
          value={stats.income} 
          icon={ArrowUpRight} 
          color="emerald" 
          trend="up"
        />
        <StatCard 
          title="Total Despesas" 
          value={stats.expenses} 
          icon={ArrowDownRight} 
          color="rose" 
          trend="down"
        />
        <StatCard 
          title="Contas a Pagar" 
          value={stats.pendingExpenses} 
          icon={Calendar} 
          color="amber" 
          trend="none"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-[#38a89d]" />
              <h3 className="font-bold text-zinc-800 uppercase tracking-wider text-xs">Fluxo de Caixa (7 dias)</h3>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38a89d" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#38a89d" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={(value) => `R$ ${value}`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, '']}
                />
                <Area 
                  type="monotone" 
                  dataKey="income" 
                  stroke="#38a89d" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorIncome)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="expense" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorExpense)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <PieChartIcon className="w-5 h-5 text-[#4a1d33]" />
            <h3 className="font-bold text-zinc-800 uppercase tracking-wider text-xs">Despesas por Categoria</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span className="text-[10px] font-bold text-zinc-500 uppercase">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-zinc-400" />
            <h3 className="font-bold text-zinc-800 uppercase tracking-wider text-xs">Lançamentos Recentes</h3>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:ring-2 focus:ring-[#38a89d]/10 focus:border-[#38a89d] outline-none transition-all w-full md:w-64"
              />
            </div>
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
              <FilterButton active={filterType === 'all'} onClick={() => setFilterType('all')} label="Todos" />
              <FilterButton active={filterType === 'income'} onClick={() => setFilterType('income')} label="Receitas" />
              <FilterButton active={filterType === 'expense'} onClick={() => setFilterType('expense')} label="Despesas" />
              <FilterButton active={filterType === 'pending'} onClick={() => setFilterType('pending')} label="Pendentes" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Data</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Descrição</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Categoria</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Vencimento</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Valor</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-8 py-4">
                    <span className="text-xs font-bold text-zinc-400">
                      {new Date(t.date).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        t.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {t.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-zinc-700 block">{t.description}</span>
                        {t.status === 'pending' && (
                          <span className="text-[10px] font-bold text-amber-600 uppercase">Pendente</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3 h-3 text-zinc-300" />
                      <span className="text-xs font-semibold text-zinc-500">{t.category}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-right">
                    {t.due_date ? (
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-bold text-zinc-500">
                          {new Date(t.due_date).toLocaleDateString('pt-BR')}
                        </span>
                        {t.reminder_enabled && (
                          <Calendar className="w-3 h-3 text-[#38a89d]" />
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-300">-</span>
                    )}
                  </td>
                  <td className="px-8 py-4 text-right">
                    <span className={cn(
                      "text-sm font-bold",
                      t.type === 'income' ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {t.status === 'pending' && (
                        <button 
                          onClick={() => markAsPaid(t.id)}
                          className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1"
                          title="Marcar como Pago"
                        >
                          <DollarSign className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase">Pagar</span>
                        </button>
                      )}
                      <button 
                        onClick={() => removeTransaction(t.id)}
                        className="p-2 hover:bg-red-50 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-zinc-400 italic text-sm">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100">
                <h3 className="text-xl font-bold text-zinc-800">Novo Lançamento</h3>
                <p className="text-sm text-zinc-500">Registre uma nova movimentação financeira.</p>
              </div>
              
              <form onSubmit={handleAddTransaction} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    type="button"
                    onClick={() => {
                      const type = 'income';
                      setNewTransaction({ ...newTransaction, type, category: categories[type][0] });
                    }}
                    className={cn(
                      "flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all font-bold text-sm",
                      newTransaction.type === 'income' 
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700" 
                        : "bg-zinc-50 border-zinc-100 text-zinc-400 hover:border-zinc-200"
                    )}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Receita
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const type = 'expense';
                      setNewTransaction({ ...newTransaction, type, category: categories[type][0] });
                    }}
                    className={cn(
                      "flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all font-bold text-sm",
                      newTransaction.type === 'expense' 
                        ? "bg-rose-50 border-rose-500 text-rose-700" 
                        : "bg-zinc-50 border-zinc-100 text-zinc-400 hover:border-zinc-200"
                    )}
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    Despesa
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Descrição</label>
                    <input 
                      required
                      type="text"
                      value={newTransaction.description || ''}
                      onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                      placeholder="Ex: Venda de Produto X"
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-xl p-4 text-sm focus:ring-2 focus:ring-[#38a89d]/10 focus:border-[#38a89d] outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Valor (R$)</label>
                      <input 
                        required
                        type="number"
                        step="0.01"
                        value={newTransaction.amount || ''}
                        onChange={(e) => setNewTransaction({ ...newTransaction, amount: Number(e.target.value) })}
                        placeholder="0,00"
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-xl p-4 text-sm focus:ring-2 focus:ring-[#38a89d]/10 focus:border-[#38a89d] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Data do Lançamento</label>
                      <input 
                        required
                        type="date"
                        value={newTransaction.date || ''}
                        onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-xl p-4 text-sm focus:ring-2 focus:ring-[#38a89d]/10 focus:border-[#38a89d] outline-none transition-all"
                      />
                    </div>
                  </div>

                  {newTransaction.type === 'expense' && (
                    <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-zinc-700">Conta a Pagar?</label>
                        <button 
                          type="button"
                          onClick={() => setNewTransaction({ 
                            ...newTransaction, 
                            status: newTransaction.status === 'pending' ? 'paid' : 'pending',
                            due_date: newTransaction.status === 'pending' ? undefined : newTransaction.date
                          })}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative",
                            newTransaction.status === 'pending' ? "bg-[#38a89d]" : "bg-zinc-300"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                            newTransaction.status === 'pending' ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>

                      {newTransaction.status === 'pending' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-4 pt-2 border-t border-zinc-200"
                        >
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Data de Vencimento</label>
                            <input 
                              required
                              type="date"
                              value={newTransaction.due_date || ''}
                              onChange={(e) => setNewTransaction({ ...newTransaction, due_date: e.target.value })}
                              className="w-full bg-white border border-zinc-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#38a89d]/10 focus:border-[#38a89d] outline-none transition-all"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox"
                              id="reminder"
                              checked={newTransaction.reminder_enabled}
                              onChange={(e) => setNewTransaction({ ...newTransaction, reminder_enabled: e.target.checked })}
                              className="w-4 h-4 rounded border-zinc-300 text-[#38a89d] focus:ring-[#38a89d]"
                            />
                            <label htmlFor="reminder" className="text-xs font-medium text-zinc-600">Criar lembrete de vencimento</label>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Categoria</label>
                      <button 
                        type="button"
                        onClick={() => setIsAddingCategory(!isAddingCategory)}
                        className="text-[10px] font-bold text-[#38a89d] uppercase tracking-widest hover:underline"
                      >
                        {isAddingCategory ? 'Cancelar' : '+ Nova Categoria'}
                      </button>
                    </div>
                    
                    {isAddingCategory ? (
                      <div className="flex gap-2">
                        <input 
                          autoFocus
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Nome da categoria..."
                          className="flex-1 bg-zinc-50 border border-zinc-100 rounded-xl p-4 text-sm focus:ring-2 focus:ring-[#38a89d]/10 focus:border-[#38a89d] outline-none transition-all"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCategory();
                            }
                          }}
                        />
                        <button 
                          type="button"
                          onClick={handleAddCategory}
                          className="bg-[#38a89d] text-white px-4 rounded-xl font-bold hover:bg-[#2d8a81] transition-all"
                        >
                          Add
                        </button>
                      </div>
                    ) : (
                      <select 
                        value={newTransaction.category}
                        onChange={(e) => setNewTransaction({ ...newTransaction, category: e.target.value })}
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-xl p-4 text-sm focus:ring-2 focus:ring-[#38a89d]/10 focus:border-[#38a89d] outline-none transition-all"
                      >
                        {categories[newTransaction.type as keyof CategoryState].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-zinc-900 text-white px-6 py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirmar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Due Date Reminder Modal */}
      <AnimatePresence>
        {isDueModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden p-8 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                <Calendar className="w-10 h-10 text-amber-500" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-zinc-800">Contas a Vencer Hoje</h3>
                <p className="text-sm text-zinc-500">Você possui pagamentos agendados para hoje.</p>
              </div>

              <div className="bg-zinc-50 rounded-2xl p-4 space-y-3 text-left max-h-[200px] overflow-y-auto">
                {dueReminders.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-zinc-100">
                    <div>
                      <p className="text-sm font-bold text-zinc-700">{t.description}</p>
                      <p className="text-[10px] text-zinc-400 uppercase font-bold">{t.category}</p>
                    </div>
                    <p className="text-sm font-bold text-rose-600">R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setIsDueModalOpen(false)}
                className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg"
              >
                Estou Ciente
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, trend }: any) {
  const colors: any = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600"
  };

  return (
    <div className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", colors[color])}>
          <Icon className="w-6 h-6" />
        </div>
        {trend !== 'none' && (
          <div className={cn(
            "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
            trend === 'up' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          )}>
            {trend === 'up' ? '+12%' : '-5%'}
          </div>
        )}
      </div>
      <div>
        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{title}</h4>
        <p className="text-2xl font-bold text-zinc-800 mt-1">
          R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
        active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
      )}
    >
      {label}
    </button>
  );
}
