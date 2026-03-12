import React, { useState, useEffect } from 'react';
import { FileText, Copy, CheckCircle2, Search, Loader2, Send, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Profile, Customer } from '../types';
import { differenceInDays, parseISO } from 'date-fns';

interface BillingManagementProps {
  profile: Profile | null;
}

const getInitialContactInfo = (p: Profile | null) => {
  if (!p) return '';
  const contacts = [];
  if (p.whatsapp) contacts.push(`WhatsApp: ${p.whatsapp}`);
  if (p.email) contacts.push(`E-mail: ${p.email}`);
  if (p.instagram) contacts.push(`Instagram: ${p.instagram}`);
  return contacts.join(' / ');
};

const getInitialPaymentInfo = (p: Profile | null) => {
  if (!p) return '';
  const payments = [];
  if (p.pix_key) {
    payments.push(`Chave PIX: ${p.pix_key}`);
    if (p.pix_beneficiary) payments.push(`Beneficiário: ${p.pix_beneficiary}`);
  }
  return payments.join('\n');
};

export function BillingManagement({ profile }: BillingManagementProps) {
  const [creditorName, setCreditorName] = useState(profile?.nome || '');
  const [debtorName, setDebtorName] = useState('');
  const [debtorPhone, setDebtorPhone] = useState('');
  const [debtOrigin, setDebtOrigin] = useState('');
  const [originalValue, setOriginalValue] = useState('');
  const [originalDueDate, setOriginalDueDate] = useState('');
  const [dueDate, setDueDate] = useState('5 (cinco) dias úteis');
  const [contactInfo, setContactInfo] = useState(getInitialContactInfo(profile));
  const [paymentInfo, setPaymentInfo] = useState(getInitialPaymentInfo(profile));
  const [installments, setInstallments] = useState('');
  const [copied, setCopied] = useState(false);

  // Customer search
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (profile) {
      if (profile.nome && !creditorName) setCreditorName(profile.nome);
      if (!contactInfo) setContactInfo(getInitialContactInfo(profile));
      if (!paymentInfo) setPaymentInfo(getInitialPaymentInfo(profile));
    }
  }, [profile]);

  useEffect(() => {
    const searchCustomers = async () => {
      if (!searchQuery.trim()) {
        setCustomers([]);
        return;
      }
      
      setSearching(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('user_id', session.user.id)
          .ilike('nome', `%${searchQuery}%`)
          .limit(5);

        if (error) throw error;
        setCustomers(data || []);
      } catch (err) {
        console.error('Error searching customers:', err);
      } finally {
        setSearching(false);
      }
    };

    const debounce = setTimeout(searchCustomers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSelectCustomer = (customer: Customer) => {
    setDebtorName(customer.nome);
    if (customer.whatsapp) {
      setDebtorPhone(customer.whatsapp);
    }
    setSearchQuery('');
    setShowDropdown(false);
  };

  const calculateDebt = () => {
    if (!originalValue || !originalDueDate) return { updatedValue: 0, daysOfDelay: 0, fine: 0, interest: 0 };

    const valueNum = parseFloat(originalValue.replace(',', '.'));
    if (isNaN(valueNum)) return { updatedValue: 0, daysOfDelay: 0, fine: 0, interest: 0 };

    const due = new Date(originalDueDate);
    const today = new Date();
    
    // Reset times to compare just dates
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const daysOfDelay = differenceInDays(today, due);
    
    if (daysOfDelay <= 0) {
      return { updatedValue: valueNum, daysOfDelay: 0, fine: 0, interest: 0 };
    }

    const fine = valueNum * 0.02; // 2% fine
    const interestPerDay = (valueNum * 0.01) / 30; // 1% per month
    const interest = interestPerDay * daysOfDelay;

    const updatedValue = valueNum + fine + interest;

    return { updatedValue, daysOfDelay, fine, interest };
  };

  const generateTemplate = () => {
    const { updatedValue, daysOfDelay, fine, interest } = calculateDebt();
    const formattedOriginalValue = parseFloat(originalValue.replace(',', '.') || '0').toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formattedUpdatedValue = updatedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formattedFine = fine.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formattedInterest = interest.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    let debtDetails = `Consta em nossos registros um débito em aberto originário de ${debtOrigin || '[Descrição da Origem da Dívida]'}, que encontra-se em atraso há ${daysOfDelay} dias (vencimento original em ${originalDueDate ? new Date(originalDueDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '[Data de Vencimento]'}).\n\n`;
    debtDetails += `O valor original da dívida era de ${formattedOriginalValue}.\n`;
    if (daysOfDelay > 0) {
      debtDetails += `Sobre este valor, incidem multa contratual/legal de 2% (${formattedFine}) e juros de mora de 1% ao mês (${formattedInterest}), totalizando um débito atualizado de ${formattedUpdatedValue}.`;
    } else {
      debtDetails += `O valor atualizado do débito é de ${formattedUpdatedValue}.`;
    }

    let paymentSection = '';
    if (paymentInfo || installments) {
      paymentSection = `\nOpções e Dados para Pagamento:\n`;
      if (installments) paymentSection += `Parcelamento: ${installments}\n`;
      if (paymentInfo) paymentSection += `${paymentInfo}\n`;
    }

    return `NOTIFICAÇÃO EXTRAJUDICIAL DE COBRANÇA

À(o) Sr(a). ${debtorName || '[Nome da Cliente/Devedora]'}

Prezado(a) Senhor(a),

Na qualidade de credor(a), eu, ${creditorName || '[Seu Nome/Nome da Empresa]'}, venho por meio desta NOTIFICÁ-LO(A) EXTRAJUDICIALMENTE para solicitar a regularização de pendências financeiras em seu nome.

${debtDetails}

Considerando que as tentativas anteriores de contato e negociação amigável não obtiveram êxito, concedemos o prazo improrrogável de ${dueDate || '[Prazo em dias, ex: 5 (cinco) dias úteis]'} a contar do recebimento desta notificação para a quitação do débito ou para que entre em contato visando uma composição amigável.

Ressaltamos que a nossa intenção é sempre resolver a questão da melhor forma possível para ambas as partes. No entanto, o não atendimento a esta notificação no prazo estipulado demonstrará desinteresse na resolução amigável, o que nos obrigará a adotar as medidas cabíveis para a proteção de nossos direitos. 

Tais medidas podem incluir, mas não se limitam a:
1. Inclusão do seu nome e CPF/CNPJ nos órgãos de proteção ao crédito (SPC, Serasa, SCPC).
2. Encaminhamento do débito para cobrança judicial, o que poderá acarretar o acréscimo de custas processuais, juros, correção monetária e honorários advocatícios.

Para regularizar sua situação ou apresentar uma proposta de acordo, solicitamos que entre em contato imediatamente através dos seguintes canais:

${contactInfo || '[Seus Canais de Contato: Telefone, WhatsApp, E-mail, etc.]'}
${paymentSection}
Certos de sua compreensão e colaboração para a rápida solução desta pendência, subscrevemo-nos.

Atenciosamente,

${creditorName || '[Seu Nome/Nome da Empresa]'}
${new Date().toLocaleDateString('pt-BR')}`;
  };

  const handleShareWhatsApp = () => {
    const text = generateTemplate();
    const encodedText = encodeURIComponent(text);
    
    if (debtorPhone) {
      const numericPhone = debtorPhone.replace(/\D/g, '');
      const finalPhone = numericPhone.length <= 11 ? `55${numericPhone}` : numericPhone;
      window.open(`https://wa.me/${finalPhone}?text=${encodedText}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    }
  };

  const handlePrint = () => {
    const text = generateTemplate();
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Notificação Extrajudicial</title>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: "Times New Roman", Times, serif; 
              line-height: 1.6; 
              padding: 40px; 
              white-space: pre-wrap; 
              color: black; 
              font-size: 12pt;
              max-width: 800px;
              margin: 0 auto;
            }
            @media print {
              @page { margin: 2cm; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body onload="setTimeout(() => window.print(), 500)">${text}</body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    
    if (!printWindow) {
      alert("O seu navegador bloqueou a abertura da página de impressão. Por favor, permita os pop-ups para este site.");
    }
  };

  const { updatedValue, daysOfDelay } = calculateDebt();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">Gestão de Cobrança</h2>
        <p className="text-sm text-zinc-500">Modelo de Notificação Extrajudicial para recuperação de crédito.</p>
      </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div className="bg-white border border-zinc-200 rounded-[32px] p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-zinc-800">Dados da Notificação</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Seu Nome / Empresa (Credor)</label>
              <input 
                type="text" 
                value={creditorName}
                onChange={(e) => setCreditorName(e.target.value)}
                placeholder="Ex: Maria Silva / Loja da Maria"
                className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2 relative">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Nome da Cliente (Devedora)</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={debtorName}
                  onChange={(e) => {
                    setDebtorName(e.target.value);
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Buscar cliente ou digitar nome..."
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl pl-10 pr-4 py-3 text-sm focus:border-blue-500 outline-none transition-all"
                />
                <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
              </div>
              
              {showDropdown && (searchQuery || customers.length > 0) && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-2xl shadow-lg overflow-hidden">
                  {searching ? (
                    <div className="p-4 flex justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    </div>
                  ) : customers.length > 0 ? (
                    <ul className="max-h-48 overflow-y-auto">
                      {customers.map(customer => (
                        <li 
                          key={customer.id}
                          onClick={() => handleSelectCustomer(customer)}
                          className="px-4 py-3 hover:bg-zinc-50 cursor-pointer text-sm text-zinc-700 border-b border-zinc-100 last:border-0"
                        >
                          {customer.nome}
                        </li>
                      ))}
                    </ul>
                  ) : searchQuery ? (
                    <div className="p-4 text-sm text-zinc-500 text-center">Nenhum cliente encontrado</div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">WhatsApp da Cliente</label>
              <input 
                type="text" 
                value={debtorPhone}
                onChange={(e) => setDebtorPhone(e.target.value)}
                placeholder="Ex: (11) 99999-9999"
                className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Origem da Dívida</label>
              <input 
                type="text" 
                value={debtOrigin}
                onChange={(e) => setDebtOrigin(e.target.value)}
                placeholder="Ex: compra de cosméticos"
                className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Valor Original (R$)</label>
                <input 
                  type="text" 
                  value={originalValue}
                  onChange={(e) => setOriginalValue(e.target.value)}
                  placeholder="Ex: 150,00"
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Data de Vencimento</label>
                <input 
                  type="date" 
                  value={originalDueDate}
                  onChange={(e) => setOriginalDueDate(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            {originalValue && originalDueDate && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Dias de atraso:</span>
                  <span className="font-bold text-blue-900">{daysOfDelay} dias</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Valor Atualizado:</span>
                  <span className="font-bold text-blue-900">{updatedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <p className="text-[10px] text-blue-600 mt-2">Inclui 2% de multa e 1% de mora ao mês.</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Prazo para Pagamento</label>
              <input 
                type="text" 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="Ex: 5 (cinco) dias úteis"
                className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Canais de Contato</label>
              <textarea 
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="Ex: WhatsApp: (11) 99999-9999 / E-mail: contato@loja.com"
                className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Opções de Parcelamento</label>
              <input 
                type="text" 
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                placeholder="Ex: Em até 3x no cartão de crédito"
                className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Dados para Pagamento</label>
              <textarea 
                value={paymentInfo}
                onChange={(e) => setPaymentInfo(e.target.value)}
                placeholder="Ex: Chave PIX: 123.456.789-00"
                className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-all min-h-[80px]"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-[32px] p-8 shadow-inner flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-zinc-800">Pré-visualização</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-4 py-2 rounded-xl text-sm font-bold transition-all"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
              <button
                onClick={handleShareWhatsApp}
                className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-md shadow-[#25D366]/20"
              >
                <Send className="w-4 h-4" />
                WhatsApp
              </button>
            </div>
          </div>
          
          <div className="flex-1 bg-white border border-zinc-200 rounded-2xl p-6 overflow-y-auto text-sm text-zinc-700 whitespace-pre-wrap font-serif leading-relaxed shadow-sm h-[500px]">
            {generateTemplate()}
          </div>
          
          <p className="text-xs text-zinc-400 mt-4 text-center">
            Este é um modelo padrão. Recomendamos que você revise o texto antes de enviar para garantir que atende às suas necessidades específicas.
          </p>
        </div>
      </div>
    </div>
  );
}
