import React, { useEffect, useState } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Lock,
  Loader2,
  CheckCircle2,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  FileText,
  Save,
  Shield
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Profile, AppLegalSettings } from '../types';
import { cn } from '../lib/utils';
import { ConfirmationModal } from './ConfirmationModal';

export function AdminPanel({ currentProfile }: { currentProfile: Profile | null }) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [excelData, setExcelData] = useState('');
  const [centralProducts, setCentralProducts] = useState<any[]>([]);
  const [loadingCentral, setLoadingCentral] = useState(false);
  const [schemaErrors, setSchemaErrors] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<'users' | 'legal'>('users');
  
  // Legal Settings State
  const [legalSettings, setLegalSettings] = useState<AppLegalSettings | null>(null);
  const [savingLegal, setSavingLegal] = useState(false);

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
    fetchData();
    fetchCentralProducts();
    fetchLegalSettings();

    // Real-time subscriptions for immediate updates
    const profilesSubscription = supabase
      .channel('admin-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .subscribe();

    return () => {
      profilesSubscription.unsubscribe();
    };
  }, []);

  async function fetchData() {
    const { data, error } = await supabase.from('profiles').select('*').order('nome');
    if (data) setUsers(data);
    
    // Check for schema issues
    const errors: string[] = [];
    
    // Check customers table for status column
    const { error: custError } = await supabase.from('customers').select('status').limit(1);
    if (custError && custError.message.includes('status')) {
      errors.push("A coluna 'status' está faltando na tabela 'customers'.");
    }

    // Check profiles table for pix columns and vencimento
    const { error: profError } = await supabase.from('profiles').select('pix_key, pix_beneficiary, vencimento').limit(1);
    if (profError && (profError.message.includes('pix_key') || profError.message.includes('pix_beneficiary') || profError.message.includes('vencimento'))) {
      errors.push("As colunas 'pix_key', 'pix_beneficiary' ou 'vencimento' estão faltando na tabela 'profiles'.");
    }

    // Check products table for photo_url, has_grid, and label_name
    const { error: prodError } = await supabase.from('products').select('photo_url, has_grid, label_name').limit(1);
    if (prodError && (prodError.message.includes('photo_url') || prodError.message.includes('has_grid') || prodError.message.includes('label_name'))) {
      errors.push("As colunas 'photo_url', 'has_grid' ou 'label_name' estão faltando na tabela 'products'.");
    }

    // Check if central_products table exists
    const { error: centralError } = await supabase.from('central_products').select('id').limit(1);
    if (centralError && centralError.message.includes('does not exist')) {
      errors.push("A tabela 'central_products' não existe.");
    }

    setSchemaErrors(errors);
    setLoading(false);
  }

  async function initializeLegalSettings() {
    const defaultPrivacy = `Política de Privacidade | Consigna Beauty (Versão Beta)
Bem-vindo ao Consigna Beauty. Esta Política de Privacidade explica como coletamos, usamos e protegemos suas informações. Por se tratar de uma versão Beta, este documento reflete nosso compromisso com a transparência enquanto aprimoramos nossas funcionalidades.
1. Aviso de Versão Beta
O Consigna Beauty está atualmente em sua fase de testes (Beta). Isso significa que o aplicativo está em constante desenvolvimento. O usuário declara estar ciente de que:
•	Funcionalidades podem ser alteradas ou removidas sem aviso prévio.
•	Podem ocorrer instabilidades técnicas pontuais.
•	A coleta de dados visa, prioritariamente, a melhoria da experiência e correção de falhas.
2. Dados Coletados e Finalidade
Coletamos apenas os dados estritamente necessários para o funcionamento do serviço:
•	Dados de Cadastro: Nome completo, e-mail e telefone (para identificação e login).
•	Dados de Uso: Informações sobre como você interage com o app, logs de erros e performance (para melhoria técnica da versão Beta).
•	Finalidade: Prestação dos serviços de consignação, suporte ao usuário e comunicações sobre atualizações do sistema.
3. Direitos do Usuário (LGPD)
Em conformidade com a LGPD, você possui os seguintes direitos:
1.	Acesso: Confirmar se tratamos seus dados e acessá-los.
2.	Correção: Solicitar a alteração de dados incompletos ou inexatos.
3.	Exclusão: Solicitar a eliminação de seus dados pessoais (salvo obrigações legais de guarda).
4.	Revogação de Consentimento: Optar por não autorizar mais o uso de seus dados.
4. Segurança e Compartilhamento
Empregamos medidas técnicas de segurança para proteger seus dados contra acessos não autorizados. Não comercializamos seus dados pessoais. O compartilhamento ocorre apenas com parceiros essenciais (ex: serviços de hospedagem) ou por determinação judicial.
________________________________________
5. Responsabilidade Legal e Contato
O responsável pelo tratamento de dados e pelas decisões referentes à plataforma é:
•	Responsável Legal: Anderson Rodrigues de Morais
•	Canal de Atendimento: [Inserir E-mail de Suporte aqui]
6. Foro e Legislação Aplicável
Esta Política é regida pelas leis da República Federativa do Brasil. Para a solução de eventuais controvérsias decorrentes deste documento, fica eleito o Foro da Comarca de Itapema, com exclusão de qualquer outro, por mais privilegiado que seja.
________________________________________
Última atualização: 23 de fevereiro de 2026.`;

    const defaultTerms = `Termos de Uso | Consigna Beauty (Versão Beta)
Este documento estabelece as regras para o uso do aplicativo Consigna Beauty. Ao acessar ou utilizar nossa plataforma, você concorda integralmente com estes termos.
1. Objeto e Natureza do Serviço
O Consigna Beauty é uma plataforma destinada à gestão de produtos em regime de consignação para o setor de beleza.
AVISO DE VERSÃO BETA: O usuário compreende que o aplicativo está em estágio experimental. O objetivo desta fase é identificar falhas e coletar feedbacks. Portanto, o serviço é fornecido "como está", sem garantias de funcionamento ininterrupto ou livre de erros.
2. Elegibilidade e Cadastro
•	Para utilizar o app, o usuário deve realizar um cadastro fornecendo informações verídicas.
•	A segurança da senha é de responsabilidade exclusiva do usuário.
•	O acesso pode ser suspenso caso detectemos informações falsas ou uso indevido.
3. Responsabilidades do Usuário
Ao utilizar o Consigna Beauty, você se compromete a:
•	Não utilizar a plataforma para fins ilícitos.
•	Não realizar engenharia reversa ou tentar invadir os sistemas do app.
•	Reportar falhas ou "bugs" encontrados para a equipe de desenvolvimento, contribuindo com a evolução do produto.
4. Limitação de Responsabilidade
Considerando a natureza Beta do software:
•	O Consigna Beauty e seu responsável legal, Anderson Rodrigues de Morais, não se responsabilizam por eventuais perdas de dados, lucros cessantes ou interrupções de negócios decorrentes de falhas técnicas durante o período de testes.
•	Recomendamos que o usuário mantenha um backup externo de suas informações essenciais.
5. Propriedade Intelectual
Todo o conteúdo, design, código-fonte e marcas associadas ao Consigna Beauty são de propriedade exclusiva de seus desenvolvedores e do responsável legal, protegidos pelas leis de direitos autorais e propriedade industrial.
6. Modificações e Encerramento
Reservamo-nos o direito de:
1.	Alterar estes Termos a qualquer momento para refletir melhorias no app.
2.	Encerrar a fase Beta e migrar para uma versão comercial/estável.
3.	Descontinuar funcionalidades sem aviso prévio.
7. Foro de Eleição
Para dirimir quaisquer controvérsias oriundas deste Termo, as partes elegem o Foro da Comarca de Itapema/SC, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
________________________________________
Data da última atualização: 09 de marco. Responsável Legal: Anderson Rodrigues de Morais.`;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('app_legal_settings')
        .upsert({
          privacy_policy: defaultPrivacy,
          terms_of_use: defaultTerms,
          version: 1,
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
      alert('Configurações legais inicializadas com sucesso!');
      fetchLegalSettings();
    } catch (err: any) {
      alert('Erro ao inicializar: ' + err.message);
    } finally {
      setLoading(false);
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

  const handleSaveLegal = async () => {
    if (!legalSettings) return;
    setSavingLegal(true);
    try {
      const newVersion = (legalSettings.version || 0) + 1;
      const { error } = await supabase
        .from('app_legal_settings')
        .upsert({
          ...legalSettings,
          version: newVersion,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      alert('Configurações legais atualizadas com sucesso! Todos os usuários serão notificados para aceitar a nova versão.');
      fetchLegalSettings();
    } catch (err: any) {
      console.error('Error saving legal settings:', err);
      alert('Erro ao salvar configurações legais: ' + err.message);
    } finally {
      setSavingLegal(false);
    }
  };

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

  const toggleAdminRole = async (userId: string, currentRole: string | undefined) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    
    setConfirmModal({
      isOpen: true,
      title: 'Alterar Cargo',
      message: `Deseja alterar o cargo para ${newRole.toUpperCase()}?`,
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setLoading(true);
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);

          if (error) throw error;
          
          alert(`Cargo alterado para ${newRole.toUpperCase()} com sucesso!`);
          await fetchData();
        } catch (err) {
          console.error(err);
          alert('Erro ao alterar cargo');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const updateUserStatus = (userId: string, status: 'PRO' | 'STARTER' | 'PAGO' | 'PENDENTE' | 'TRIAL') => {
    const selectedUser = users.find(u => u.id === userId);
    if (!selectedUser) return;

    setConfirmModal({
      isOpen: true,
      title: 'Alterar Status',
      message: `Deseja alterar o status para ${status} para ${selectedUser.nome || selectedUser.email}?`,
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setLoading(true);
        try {
          const updates: any = { status_pagamento: status };
          
          if (status === 'PRO') {
            updates.access_key_code = selectedUser.access_key_code || `PRO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            updates.plan = 'Pro';
            updates.vencimento = null;
          } else if (status === 'STARTER') {
            updates.access_key_code = selectedUser.access_key_code || `START-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            updates.plan = 'Starter';
            updates.vencimento = null;
          } else if (status === 'PAGO') {
            updates.access_key_code = selectedUser.access_key_code || `KEY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            updates.plan = 'Standard';
            updates.vencimento = null;
          } else if (status === 'TRIAL') {
            updates.access_key_code = selectedUser.access_key_code || `TRIAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            updates.plan = 'Trial';
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 7);
            updates.vencimento = trialEnd.toISOString();
          } else if (status === 'PENDENTE') {
            updates.access_key_code = null;
            updates.plan = null;
            updates.vencimento = null;
          }

          const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId);

          if (error) throw error;
          
          alert(`Status alterado para ${status} com sucesso! Acesso liberado.`);
          await fetchData();
        } catch (err) {
          console.error(err);
          alert('Erro ao alterar status');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const toggleBlockUser = async (userId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_blocked: !currentStatus })
      .eq('id', userId);

    if (error) {
      alert('Erro ao alterar status do usuário');
    } else {
      fetchData();
    }
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

      // Broadcast update to all users
      await supabase.channel('public:catalog_updates').send({
        type: 'broadcast',
        event: 'catalog_updated',
        payload: { timestamp: Date.now() }
      });

      alert(`${productsToInsert.length} produtos importados com sucesso! Os usuários serão notificados.`);
      setExcelData('');
      fetchCentralProducts();
    } catch (err: any) {
      console.error('Error importing products:', err);
      alert('Erro ao importar produtos: ' + (err.message || 'Verifique o formato dos dados.'));
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#38a89d] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 max-w-full overflow-x-hidden">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#4a1d33] uppercase tracking-tight">Gestão Administrativa</h2>
          <p className="text-xs text-zinc-500">Controle de usuários e acessos PRO.</p>
        </div>
      </div>
       {/* Schema Errors Section */}
      {schemaErrors.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-red-700">
            <AlertCircle className="w-6 h-6" />
            <h3 className="font-bold">Erros de Esquema Detectados</h3>
          </div>
          <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
            {schemaErrors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
          <div className="bg-white/50 p-4 rounded-xl border border-red-100">
            <p className="text-xs font-bold text-red-800 mb-2 uppercase tracking-wider">Execute este SQL no Editor do Supabase:</p>
            <pre className="text-[10px] font-mono bg-zinc-900 text-zinc-300 p-4 rounded-lg overflow-x-auto">
{`-- Adicionar coluna status na tabela customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Adicionar colunas PIX na tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pix_key TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pix_beneficiary TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accepted_terms_version INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vencimento TIMESTAMPTZ;
ALTER TABLE profiles ALTER COLUMN status_pagamento SET DEFAULT 'TRIAL';

-- Adicionar colunas na tabela products
ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_grid BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS label_name TEXT;

-- Criar tabela app_legal_settings se não existir
CREATE TABLE IF NOT EXISTS app_legal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privacy_policy TEXT NOT NULL,
  terms_of_use TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS e criar políticas para app_legal_settings
ALTER TABLE app_legal_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura para todos" ON app_legal_settings;
CREATE POLICY "Permitir leitura para todos" ON app_legal_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Permitir tudo para admins" ON app_legal_settings;
CREATE POLICY "Permitir tudo para admins" ON app_legal_settings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR email IN ('anderlevita@gmail.com')))
);

-- Criar tabela central_products se não existir
CREATE TABLE IF NOT EXISTS central_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  label_name TEXT,
  ean TEXT,
  cost_price DECIMAL DEFAULT 0,
  sale_price DECIMAL DEFAULT 0,
  photo_url TEXT,
  has_grid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS e criar políticas
ALTER TABLE central_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura para todos" ON central_products;
CREATE POLICY "Permitir leitura para todos" ON central_products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Permitir tudo para admins" ON central_products;
CREATE POLICY "Permitir tudo para admins" ON central_products FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR email IN ('anderlevita@gmail.com')))
);

-- Garantir RLS na tabela products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários gerenciam seus próprios produtos" ON products;
CREATE POLICY "Usuários gerenciam seus próprios produtos" ON products FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Tabela para sugestões de preços
CREATE TABLE IF NOT EXISTS price_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  central_product_id UUID REFERENCES central_products(id) ON DELETE CASCADE,
  suggested_cost_price DECIMAL(10,2),
  suggested_sale_price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela para comunicados globais
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS e criar políticas para novas tabelas
ALTER TABLE price_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Qualquer um pode ler sugestões" ON price_suggestions;
CREATE POLICY "Qualquer um pode ler sugestões" ON price_suggestions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins gerenciam sugestões" ON price_suggestions;
CREATE POLICY "Admins gerenciam sugestões" ON price_suggestions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR email IN ('anderlevita@gmail.com')))
);

DROP POLICY IF EXISTS "Qualquer um pode ler comunicados" ON announcements;
CREATE POLICY "Qualquer um pode ler comunicados" ON announcements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins gerenciam comunicados" ON announcements;
CREATE POLICY "Admins gerenciam comunicados" ON announcements FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR email IN ('anderlevita@gmail.com')))
);`}
            </pre>
          </div>
        </div>
      )}

      {/* Tabs Section */}
      <div className="flex bg-white p-1 rounded-2xl border border-zinc-100 shadow-sm">
        <button
          onClick={() => setActiveSection('users')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
            activeSection === 'users' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-zinc-400 hover:text-zinc-600"
          )}
        >
          <Users className="w-4 h-4" />
          Usuários
        </button>
        <button
          onClick={() => setActiveSection('legal')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
            activeSection === 'legal' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-zinc-400 hover:text-zinc-600"
          )}
        >
          <FileText className="w-4 h-4" />
          Termos e Privacidade
        </button>
      </div>

      {activeSection === 'users' ? (
        /* Users Section */
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Users className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-zinc-800 text-sm uppercase tracking-wider">Usuários e Status</h3>
          </div>
          <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-zinc-50/50 border-b border-zinc-100">
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Usuário</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Chave</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {users.map((user) => (
                    <tr key={user.id} className={cn(
                      "hover:bg-zinc-50/30 transition-colors",
                      user.is_blocked && "bg-red-50/30"
                    )}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                            {user.nome?.substring(0, 2).toUpperCase() || '??'}
                          </div>
                          {user.role === 'admin' && (
                            <Shield className="w-3 h-3 text-amber-500 fill-amber-500" />
                          )}
                          <div>
                            <p className="font-bold text-zinc-800 text-sm">{user.nome || 'Sem Nome'}</p>
                            <p className="text-[10px] text-zinc-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {user.access_key_code ? (
                          <span className="font-mono text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                            {user.access_key_code}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-300 italic">Sem chave</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase",
                          user.is_blocked 
                            ? "bg-red-100 text-red-700" 
                            : user.status_pagamento === 'PRO'
                              ? "bg-amber-100 text-amber-700"
                              : user.status_pagamento === 'STARTER'
                                ? "bg-purple-100 text-purple-700"
                                : user.status_pagamento === 'TRIAL'
                                ? "bg-blue-100 text-blue-700"
                                : user.status_pagamento === 'PAGO' 
                                  ? "bg-emerald-100 text-emerald-700" 
                                  : "bg-zinc-100 text-zinc-500"
                        )}>
                          {user.is_blocked ? 'BLOQUEADO' : (user.status_pagamento || 'PENDENTE')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {currentProfile?.email === 'anderlevita@gmail.com' && (
                            <button 
                              onClick={() => toggleAdminRole(user.id, user.role)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                                user.role === 'admin' 
                                  ? "bg-amber-500 text-white" 
                                  : "bg-amber-50 text-amber-600 hover:bg-amber-100"
                              )}
                              title={user.role === 'admin' ? "Remover Admin" : "Tornar Admin"}
                            >
                              <Shield className="w-3 h-3" />
                              {user.role === 'admin' ? 'ADMIN' : 'USER'}
                            </button>
                          )}
                          {user.role !== 'admin' && (
                            <>
                              {user.status_pagamento !== 'PENDENTE' && (
                                <button 
                                  onClick={() => updateUserStatus(user.id, 'PENDENTE')}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 text-zinc-400 hover:bg-zinc-100 rounded-lg text-[10px] font-bold transition-all"
                                  title="Resetar para Pendente"
                                >
                                  RESET
                                </button>
                              )}
                              <button 
                                onClick={() => updateUserStatus(user.id, 'TRIAL')}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                  user.status_pagamento === 'TRIAL' 
                                    ? "bg-blue-500 text-white" 
                                    : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                )}
                              >
                                TRIAL
                              </button>
                              <button 
                                onClick={() => updateUserStatus(user.id, 'STARTER')}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                  user.status_pagamento === 'STARTER' 
                                    ? "bg-purple-500 text-white" 
                                    : "bg-purple-50 text-purple-600 hover:bg-purple-100"
                                )}
                              >
                                STARTER
                              </button>
                              <button 
                                onClick={() => updateUserStatus(user.id, 'PAGO')}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                  user.status_pagamento === 'PAGO' 
                                    ? "bg-emerald-500 text-white" 
                                    : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                )}
                              >
                                PAGO
                              </button>
                              <button 
                                onClick={() => updateUserStatus(user.id, 'PRO')}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                  user.status_pagamento === 'PRO' 
                                    ? "bg-amber-500 text-white" 
                                    : "bg-amber-50 text-amber-600 hover:bg-amber-100"
                                )}
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                PRO
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => toggleBlockUser(user.id, !!user.is_blocked)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                              user.is_blocked 
                                ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" 
                                : "bg-red-50 text-red-600 hover:bg-red-100"
                            )}
                          >
                            {user.is_blocked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                            {user.is_blocked ? 'Desbloquear' : 'Bloquear'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Legal Section */
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-zinc-800 text-sm uppercase tracking-wider">Termos e Privacidade</h3>
            </div>
            {!legalSettings && (
              <button
                onClick={initializeLegalSettings}
                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest"
              >
                Inicializar Documentos
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Privacy Policy */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2">Política de Privacidade</label>
              <textarea
                value={legalSettings?.privacy_policy || ''}
                onChange={(e) => setLegalSettings(prev => prev ? { ...prev, privacy_policy: e.target.value } : null)}
                placeholder="Cole aqui a política de privacidade..."
                className="w-full h-[400px] bg-white border border-zinc-200 rounded-2xl p-4 text-sm text-zinc-600 outline-none focus:border-emerald-500 transition-all resize-none shadow-sm"
              />
            </div>

            {/* Terms of Use */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2">Termos de Uso</label>
              <textarea
                value={legalSettings?.terms_of_use || ''}
                onChange={(e) => setLegalSettings(prev => prev ? { ...prev, terms_of_use: e.target.value } : null)}
                placeholder="Cole aqui os termos de uso..."
                className="w-full h-[400px] bg-white border border-zinc-200 rounded-2xl p-4 text-sm text-zinc-600 outline-none focus:border-emerald-500 transition-all resize-none shadow-sm"
              />
            </div>
          </div>

          <div className="flex justify-end px-2">
            <button
              onClick={handleSaveLegal}
              disabled={savingLegal || !legalSettings}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {savingLegal ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar e Notificar Usuários
            </button>
          </div>
          
          <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
            <p className="text-[10px] text-zinc-400 leading-relaxed italic">
              * Ao salvar, a versão dos documentos será incrementada. Todos os usuários serão obrigados a ler e aceitar os novos termos no próximo acesso.
            </p>
          </div>
        </div>
      )}

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
