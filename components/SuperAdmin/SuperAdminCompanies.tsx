import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, query, where, getDocs, writeBatch, orderBy, limit } from 'firebase/firestore';
import { CompanyData, Transaction } from '../../types';
import { Loader2, Edit, X, Save, Users, CheckCircle, XCircle, Trash2, AlertTriangle, ExternalLink, DollarSign, Calendar, ChevronDown, ChevronUp, ShoppingBag, Award, FilePieChart, History, Mail, Phone, ClipboardCopy, Clock, Search, Building2, MoreVertical } from 'lucide-react';
import TechInput from '../ui/TechInput';
import { playSound } from '../../lib/sounds';

interface CompanyWithCount extends CompanyData {
  employeeCount: number;
  createdAt?: string; // Adding this as it might be present
}

interface SuperAdminCompaniesProps {
  onImpersonate: (company: CompanyData) => void;
}

const SuperAdminCompanies: React.FC<SuperAdminCompaniesProps> = ({ onImpersonate }) => {
  const [companies, setCompanies] = useState<CompanyWithCount[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCompany, setEditingCompany] = useState<CompanyData | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<CompanyData | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  useEffect(() => {
    setIsLoading(true);
    const unsubCompanies = onSnapshot(collection(db, 'companies'), async (snapshot) => {
      try {
        const allCompaniesData = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as CompanyData));
        
        const companiesWithCounts = await Promise.all(
          allCompaniesData.map(async (company) => {
            try {
              const employeesQuery = query(collection(db, 'employees'), where('companyId', '==', company.uid));
              const employeesSnapshot = await getDocs(employeesQuery);
              return {
                ...company,
                employeeCount: employeesSnapshot.size,
              };
            } catch (err) {
              console.error(`Error fetching employees for company ${company.companyName}:`, err);
              return {
                ...company,
                employeeCount: 0,
              };
            }
          })
        );

        setCompanies(companiesWithCounts as CompanyWithCount[]);
        setFilteredCompanies(companiesWithCounts as CompanyWithCount[]);
      } catch (error) {
        console.error("Error processing companies data:", error);
        showFeedback('error', 'Erro ao processar dados das empresas.');
      } finally {
        setIsLoading(false);
      }
    }, (error) => {
      console.error("Error fetching companies:", error);
      setIsLoading(false);
      if (error.code === 'permission-denied') {
        showFeedback('error', 'Permissão negada. Verifique se você é um Super Admin e se as regras do Firestore estão atualizadas.');
      } else {
        showFeedback('error', 'Erro ao carregar lista de empresas.');
      }
    });

    return () => unsubCompanies();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredCompanies(companies);
    } else {
      const lowerTerm = searchTerm.toLowerCase();
      setFilteredCompanies(companies.filter(c => 
        c.companyName.toLowerCase().includes(lowerTerm) || 
        c.email.toLowerCase().includes(lowerTerm) ||
        c.cnpj.includes(lowerTerm)
      ));
    }
  }, [searchTerm, companies]);

  const handleUpdateCompany = async (companyId: string, data: Partial<CompanyData>) => {
    try {
      await updateDoc(doc(db, 'companies', companyId), data);
      setEditingCompany(null);
      playSound.success();
      showFeedback('success', 'Empresa atualizada com sucesso!');
    } catch (error) {
      console.error('Error updating company:', error);
      showFeedback('error', 'Erro ao atualizar empresa.');
    }
  };

  const handleDeleteCompany = async (companyId: string, companyName: string) => {
    setIsDeleting(companyId);
    try {
      const batch = writeBatch(db);
      const collectionsToDelete = ['employees', 'locations', 'shifts', 'attendance'];
      
      for (const collectionName of collectionsToDelete) {
        const q = query(collection(db, collectionName), where('companyId', '==', companyId));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => batch.delete(doc.ref));
      }

      const companyRef = doc(db, 'companies', companyId);
      batch.delete(companyRef);
      await batch.commit();

      showFeedback('success', `Empresa "${companyName}" e todos os seus dados foram excluídos.`);
      playSound.success();
    } catch (error) {
      console.error('Error performing cascade delete:', error);
      showFeedback('error', 'Erro ao excluir a empresa.');
      playSound.error();
    } finally {
      setIsDeleting(null);
      setCompanyToDelete(null);
    }
  };
  
  const renderFeedback = () => feedbackMessage && (
    <div className={`mb-4 flex items-center gap-2 text-sm p-3 rounded-lg border ${
        feedbackMessage.type === 'success' ? 'text-green-300 bg-green-900/50 border-green-500/30' : 'text-red-300 bg-red-900/50 border-red-500/30'
      } animate-in fade-in`}
    >
      {feedbackMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      <span>{feedbackMessage.text}</span>
    </div>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="font-tech text-2xl md:text-3xl text-white">Gerenciamento de Empresas</h1>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Buscar empresa..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-fuchsia-500 outline-none transition-colors"
          />
        </div>
      </div>

      {renderFeedback()}

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500"/>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCompanies.length === 0 ? (
            <div className="text-center p-8 border border-dashed border-slate-800 rounded-xl text-slate-500">
              Nenhuma empresa encontrada.
            </div>
          ) : (
            filteredCompanies.map(company => {
              const isExpired = company.subscriptionExpiresAt && new Date(company.subscriptionExpiresAt) < new Date();
              const status = company.planStatus || (isExpired ? 'inactive' : 'active');
              
              const statusStyles = {
                active: 'text-green-400 bg-green-900/20 border-green-500/30',
                inactive: 'text-amber-400 bg-amber-900/20 border-amber-500/30',
                blocked: 'text-red-400 bg-red-900/20 border-red-500/30',
              };

              const isExpanded = expandedCompanyId === company.uid;

              return (
                <div key={company.uid} className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden transition-all duration-300 hover:border-slate-700">
                  <div 
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                    onClick={() => setExpandedCompanyId(isExpanded ? null : company.uid)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-800 rounded-lg">
                        <Building2 className="w-6 h-6 text-fuchsia-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg">{company.companyName}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                          <span className={`px-2 py-0.5 rounded border text-[10px] uppercase font-bold ${statusStyles[status]}`}>
                            {status}
                          </span>
                          <span>•</span>
                          <span>{company.employeeCount} / {company.maxEmployees || '∞'} Func.</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 mt-2 md:mt-0 border-t md:border-t-0 border-slate-800 pt-3 md:pt-0">
                      <div className="text-xs text-slate-500 font-mono">
                        Validade: {company.subscriptionExpiresAt ? new Date(company.subscriptionExpiresAt).toLocaleDateString('pt-BR') : 'N/A'}
                      </div>
                      <div className="flex items-center gap-2">
                        {isDeleting === company.uid ? <Loader2 className="w-5 h-5 animate-spin text-red-400" /> : (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Acessar o painel de ${company.companyName}?`)) {
                                  onImpersonate(company);
                                }
                              }}
                              className="p-2 bg-fuchsia-500/10 text-fuchsia-400 rounded-lg hover:bg-fuchsia-500/20 transition-colors"
                              title="Acessar Painel"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingCompany(company); }} 
                              className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setCompanyToDelete(company); }} 
                              className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button className="text-slate-500">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-800 bg-slate-950/30">
                      <CompanyDetails company={company} onImpersonate={onImpersonate} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {editingCompany && createPortal(<CompanyEditModal company={editingCompany} onClose={() => setEditingCompany(null)} onSave={handleUpdateCompany} />, document.body)}
      {companyToDelete && createPortal(<DeleteConfirmationModal company={companyToDelete} onClose={() => setCompanyToDelete(null)} onConfirm={handleDeleteCompany} isDeleting={!!isDeleting} />, document.body)}
    </div>
  );
};

const CompanyDetails: React.FC<{ company: CompanyWithCount, onImpersonate: (c: CompanyData) => void }> = ({ company, onImpersonate }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  useEffect(() => {
    const transactionsQuery = query(
      collection(db, `companies/${company.uid}/transactions`),
      orderBy('createdAt', 'desc'),
      limit(3)
    );

    const unsubscribe = onSnapshot(transactionsQuery, (snapshot) => {
      const trans: Transaction[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Transaction));
      setTransactions(trans);
      setLoadingTransactions(false);
    }, (error) => {
      console.error(`Error fetching transactions for ${company.companyName}:`, error);
      setLoadingTransactions(false);
    });

    return () => unsubscribe();
  }, [company.uid]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };
  
  const now = new Date();
  const isPurchasedExpired = company.purchasedExpiresAt ? new Date(company.purchasedExpiresAt) < now : false;
  const isManualExpired = company.manualExpiresAt ? new Date(company.manualExpiresAt) < now : false;

  const statusInfo = {
    pending: { text: 'Pendente', color: 'text-amber-400 bg-amber-900/30 border-amber-500/30' },
    approved: { text: 'Aprovado', color: 'text-green-400 bg-green-900/30 border-green-500/30' },
    rejected: { text: 'Rejeitado', color: 'text-red-400 bg-red-900/30 border-red-500/30' },
    cancelled: { text: 'Cancelado', color: 'text-slate-400 bg-slate-800 border-slate-600' },
  };

  return (
    <div className="p-4 md:p-6 animate-in slide-in-from-top-2 duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna 1: Auditoria de Vagas */}
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
          <h4 className="font-mono text-xs uppercase text-slate-400 mb-4 flex items-center gap-2">
            <FilePieChart className="w-4 h-4 text-cyan-400"/> Auditoria de Vagas
          </h4>
          <div className="space-y-3 text-xs font-mono">
            <div className={`p-3 rounded bg-slate-950 border ${isPurchasedExpired && (company.purchasedSlots ?? 0) > 0 ? 'border-red-500/30' : 'border-cyan-500/20'}`}>
              <div className="flex justify-between items-center text-cyan-400">
                <span className="flex items-center gap-2"><ShoppingBag className="w-3 h-3"/> Slots Comprados</span>
                <span className="font-bold text-lg text-white">{company.purchasedSlots ?? 0}</span>
              </div>
              <p className={`text-right mt-1 ${isPurchasedExpired && (company.purchasedSlots ?? 0) > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                Vence: {formatDate(company.purchasedExpiresAt)}
              </p>
            </div>
            <div className={`p-3 rounded bg-slate-950 border ${isManualExpired && (company.manualSlots ?? 0) > 0 ? 'border-red-500/30' : 'border-fuchsia-500/20'}`}>
              <div className="flex justify-between items-center text-fuchsia-400">
                <span className="flex items-center gap-2"><Award className="w-3 h-3"/> Slots Bônus</span>
                <span className="font-bold text-lg text-white">{company.manualSlots ?? 0}</span>
              </div>
               <p className={`text-right mt-1 ${isManualExpired && (company.manualSlots ?? 0) > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                 Vence: {formatDate(company.manualExpiresAt)}
               </p>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <span className="text-slate-400">Total Real Permitido:</span>
              <span className="font-bold text-white text-sm">{company.maxEmployees || 0}</span>
            </div>
          </div>
        </div>

        {/* Coluna 2: Histórico de Transações (PIX) */}
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
          <h4 className="font-mono text-xs uppercase text-slate-400 mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-green-400"/> Últimos Pagamentos
          </h4>
          <div className="space-y-2">
            {loadingTransactions ? <div className="text-center p-4"><Loader2 className="animate-spin text-slate-500 inline-block"/></div> :
              transactions.length > 0 ? transactions.map(tx => {
                const status = statusInfo[tx.status] || { text: tx.status, color: 'text-slate-400 bg-slate-700' };
                return (
                  <div key={tx.id} className="flex justify-between items-center text-xs font-mono bg-slate-950 p-2 rounded border border-slate-800">
                    <div>
                      <p className="text-slate-300">{new Date(tx.createdAt).toLocaleDateString('pt-BR')} <span className="text-slate-600">|</span> {new Date(tx.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                      <p className="text-slate-500 text-[10px] mt-0.5">{tx.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-white">{tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.color} inline-block mt-1`}>{status.text}</span>
                    </div>
                  </div>
                )
              }) : <p className="text-xs text-slate-500 text-center py-8 border border-dashed border-slate-800 rounded">Nenhuma transação encontrada.</p>
            }
          </div>
        </div>

        {/* Coluna 3: Informações Rápidas */}
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
          <h4 className="font-mono text-xs uppercase text-slate-400 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-fuchsia-400"/> Informações Rápidas
          </h4>
           <div className="space-y-4 text-xs text-slate-400 font-mono">
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded">
                <span className="flex items-center gap-2"><Clock className="w-3 h-3"/> Criado em:</span>
                <span className="text-white">{company.createdAt ? new Date(company.createdAt).toLocaleDateString('pt-BR') : 'N/A'}</span>
              </div>
              
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded">
                <span className="flex items-center gap-2"><Users className="w-3 h-3"/> Funcionários:</span>
                <span className="text-white font-bold">{company.employeeCount} cadastrados</span>
              </div>

              <div className="pt-2">
                <button 
                  onClick={() => {
                    if (window.confirm(`Acessar o painel de ${company.companyName}?`)) {
                      onImpersonate(company);
                    }
                  }}
                  className="w-full py-3 bg-fuchsia-600/20 hover:bg-fuchsia-600/30 text-fuchsia-400 hover:text-fuchsia-300 border border-fuchsia-500/30 rounded-lg flex items-center justify-center gap-2 transition-colors font-bold"
                >
                  <ExternalLink className="w-4 h-4" /> Acessar Painel (God Mode)
                </button>
              </div>
              
              <div className="text-[10px] text-slate-600 text-center pt-2">
                ID: {company.uid}
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

const CompanyEditModal: React.FC<{company: CompanyData, onClose: () => void, onSave: (id: string, data: Partial<CompanyData>) => void}> = ({ company, onClose, onSave }) => {
  // Initialize with strings for editable numeric fields to handle empty input better
  const [formData, setFormData] = useState({
    purchasedSlots: company.purchasedSlots ?? 0,
    purchasedExpiresAt: company.purchasedExpiresAt ? new Date(company.purchasedExpiresAt).toISOString().split('T')[0] : '',
    manualSlots: (company.manualSlots ?? 0).toString(),
    manualExpiresAt: company.manualExpiresAt ? new Date(company.manualExpiresAt).toISOString().split('T')[0] : '',
    planStatus: company.planStatus || 'active',
    pricePerEmployee: (company.pricePerEmployee || 19.90).toString(),
  });

  const toDate = (dateString: string) => dateString ? new Date(dateString + 'T00:00:00') : null;
  
  const now = new Date();
  const purchasedDate = toDate(formData.purchasedExpiresAt);
  const manualDate = toDate(formData.manualExpiresAt);

  // Parse strings to numbers for calculation
  const currentPurchasedSlots = Number(formData.purchasedSlots);
  const currentManualSlots = Number(formData.manualSlots) || 0;

  const validPurchasedSlots = purchasedDate && purchasedDate > now ? currentPurchasedSlots : 0;
  const validManualSlots = manualDate && manualDate > now ? currentManualSlots : 0;
  const totalValidSlots = validPurchasedSlots + validManualSlots;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let latestExpiry: Date | null = null;
    if (purchasedDate) latestExpiry = purchasedDate;
    if (manualDate && (!latestExpiry || manualDate > latestExpiry)) {
      latestExpiry = manualDate;
    }
    
    const dataToSave: Partial<CompanyData> = {
      purchasedSlots: currentPurchasedSlots,
      purchasedExpiresAt: purchasedDate ? purchasedDate.toISOString() : undefined,
      manualSlots: currentManualSlots,
      manualExpiresAt: manualDate ? manualDate.toISOString() : undefined,
      maxEmployees: totalValidSlots,
      subscriptionExpiresAt: latestExpiry ? latestExpiry.toISOString() : undefined,
      planStatus: formData.planStatus as 'active' | 'inactive' | 'blocked',
      pricePerEmployee: Number(formData.pricePerEmployee) || 0,
    };

    if (latestExpiry && latestExpiry > now && (dataToSave.planStatus === 'inactive' || dataToSave.planStatus === 'blocked')) {
      dataToSave.planStatus = 'active';
    }
    
    onSave(company.uid!, dataToSave);
  };

  return (
     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-slate-900 border border-fuchsia-500/30 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-lg max-h-[85vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Editar {company.companyName}</h2>
            <button onClick={onClose}><X className="text-slate-500 hover:text-white"/></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <fieldset className="border-2 border-cyan-500/30 p-4 rounded-lg space-y-4 bg-slate-950/30">
              <legend className="px-2 font-mono text-cyan-400 text-sm flex items-center gap-2">
                 Plano Contratado (Automático)
              </legend>
              <div className="grid grid-cols-2 gap-4">
                <TechInput 
                  label="Qtd. Comprada"
                  type="number"
                  value={formData.purchasedSlots}
                  readOnly
                  className="opacity-60 cursor-not-allowed"
                  icon={<Users className="w-4 h-4"/>}
                />
                <TechInput 
                  label="Vence em"
                  type="date"
                  value={formData.purchasedExpiresAt}
                  readOnly
                  className="opacity-60 cursor-not-allowed"
                  icon={<Calendar className="w-4 h-4"/>}
                />
              </div>
              <p className="text-[10px] text-slate-500 text-center italic">
                Gerenciado automaticamente pelo sistema de pagamentos.
              </p>
            </fieldset>

            <fieldset className="border-2 border-fuchsia-500/30 p-4 rounded-lg space-y-4">
              <legend className="px-2 font-mono text-fuchsia-400 text-sm">Bônus / Cortesia (Manual)</legend>
              <div className="grid grid-cols-2 gap-4">
                <TechInput 
                  label="Qtd. Bônus"
                  type="number"
                  value={formData.manualSlots}
                  onChange={e => setFormData({...formData, manualSlots: e.target.value})}
                  icon={<Users className="w-4 h-4"/>}
                />
                <TechInput 
                  label="Vence em"
                  type="date"
                  value={formData.manualExpiresAt}
                  onChange={e => setFormData({...formData, manualExpiresAt: e.target.value})}
                  icon={<Calendar className="w-4 h-4"/>}
                />
              </div>
            </fieldset>
            
            <p className="text-right text-sm text-slate-400 font-mono">
                Total de Vagas Válidas: <span className="font-bold text-cyan-400 text-base">{totalValidSlots}</span>
            </p>
            
            <TechInput 
              label="Preço por Funcionário (R$)"
              type="number"
              step="0.01"
              value={formData.pricePerEmployee}
              onChange={e => setFormData({...formData, pricePerEmployee: e.target.value})}
              icon={<DollarSign className="w-4 h-4"/>}
            />

            <div>
              <label className="text-xs font-mono text-cyan-400 tracking-wider uppercase ml-1">Status do Plano</label>
              <select 
                value={formData.planStatus}
                onChange={e => setFormData({...formData, planStatus: e.target.value as any})}
                className="w-full bg-slate-950/50 border border-slate-700 text-white placeholder-slate-600 text-sm rounded-lg focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 block p-3 transition-all duration-300"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="blocked">Bloqueado</option>
              </select>
            </div>
            <div className="flex justify-end gap-4 pt-4 border-t border-slate-800">
              <button type="button" onClick={onClose} className="px-6 py-3 bg-slate-700 text-white font-bold rounded-lg w-full md:w-auto">Cancelar</button>
              <button type="submit" className="px-6 py-3 bg-fuchsia-600 text-white font-bold rounded-lg w-full md:w-auto">Salvar</button>
            </div>
          </form>
        </div>
     </div>
  );
}

const DeleteConfirmationModal: React.FC<{company: CompanyData, onClose: () => void, onConfirm: (id: string, name: string) => void, isDeleting: boolean}> = ({ company, onClose, onConfirm, isDeleting }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
    <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-lg">
      <h2 className="text-xl font-bold text-white mb-2">Confirmar Exclusão</h2>
      <p className="text-slate-400 text-sm">
        Tem certeza que deseja excluir permanentemente a empresa <strong>{company.companyName}</strong> e todos os seus dados? (funcionários, locais, turnos, etc).
      </p>
      <p className="text-amber-400 text-xs mt-2 font-bold uppercase">Essa ação não pode ser desfeita.</p>
      <div className="flex justify-end gap-4 mt-8">
        <button onClick={onClose} disabled={isDeleting} className="px-6 py-3 bg-slate-700 text-white font-bold rounded-lg disabled:opacity-50 w-full md:w-auto">Cancelar</button>
        <button onClick={() => onConfirm(company.uid!, company.companyName)} disabled={isDeleting} className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 w-full md:w-auto">
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Excluir
        </button>
      </div>
    </div>
  </div>
);

export default SuperAdminCompanies;
