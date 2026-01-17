import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, query, where, getDocs, writeBatch, orderBy, limit } from 'firebase/firestore';
import { CompanyData, Transaction } from '../../types';
import { Loader2, Edit, X, Save, Users, CheckCircle, XCircle, Trash2, AlertTriangle, ExternalLink, DollarSign, Calendar, ChevronDown, ChevronUp, ShoppingBag, Award, FilePieChart, History, Mail, Phone, ClipboardCopy, Clock } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(true);
  const [editingCompany, setEditingCompany] = useState<CompanyData | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<CompanyData | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const unsubCompanies = onSnapshot(collection(db, 'companies'), async (snapshot) => {
      setIsLoading(true);
      const allCompaniesData = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as CompanyData));
      
      const companiesWithCounts = await Promise.all(
        allCompaniesData.map(async (company) => {
          const employeesQuery = query(collection(db, 'employees'), where('companyId', '==', company.uid));
          const employeesSnapshot = await getDocs(employeesQuery);
          return {
            ...company,
            employeeCount: employeesSnapshot.size,
          };
        })
      );

      setCompanies(companiesWithCounts as CompanyWithCount[]);
      setIsLoading(false);
    });

    return () => unsubCompanies();
  }, []);
  
  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

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
    <div>
      <h1 className="font-tech text-3xl text-white mb-6">Gerenciamento de Empresas</h1>
      {renderFeedback()}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-400">
          <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 font-mono">
            <tr>
              <th scope="col" className="px-2 py-3 w-12"></th>
              <th scope="col" className="px-6 py-3">Empresa</th>
              <th scope="col" className="px-6 py-3">Status</th>
              <th scope="col" className="px-6 py-3">Cota</th>
              <th scope="col" className="px-6 py-3">Validade</th>
              <th scope="col" className="px-6 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="text-center p-8"><Loader2 className="animate-spin inline-block"/></td></tr>}
            {!isLoading && companies.map(company => {
              const isExpired = company.subscriptionExpiresAt && new Date(company.subscriptionExpiresAt) < new Date();
              const status = company.planStatus || (isExpired ? 'inactive' : 'active');
              
              const statusStyles = {
                active: 'text-green-400',
                inactive: 'text-amber-400',
                blocked: 'text-red-400',
              };

              return (
                <React.Fragment key={company.uid}>
                  <tr className={`border-b border-slate-800 hover:bg-slate-800/30 ${expandedCompanyId === company.uid ? 'bg-slate-800/30' : ''}`}>
                    <td className="px-2 text-center">
                      <button 
                        onClick={() => setExpandedCompanyId(expandedCompanyId === company.uid ? null : company.uid)}
                        className="p-2 rounded-full hover:bg-slate-700 text-slate-400 transition-colors"
                        title="Ver detalhes"
                      >
                        {expandedCompanyId === company.uid ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-6 py-4 font-medium text-white whitespace-nowrap">{company.companyName}</td>
                    <td className={`px-6 py-4 font-bold capitalize ${statusStyles[status]}`}>{status}</td>
                    <td className="px-6 py-4">{company.employeeCount} / {company.maxEmployees || '∞'}</td>
                    <td className="px-6 py-4">{company.subscriptionExpiresAt ? new Date(company.subscriptionExpiresAt).toLocaleDateString('pt-BR') : 'N/A'}</td>
                    <td className="px-6 py-4 text-right">
                      {isDeleting === company.uid ? <Loader2 className="w-5 h-5 animate-spin text-red-400 ml-auto" /> : (
                        <div className="flex justify-end items-center gap-4">
                          <button
                            onClick={() => {
                              if (window.confirm(`Acessar o painel de ${company.companyName}?`)) {
                                onImpersonate(company);
                              }
                            }}
                            className="font-medium text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 text-xs"
                          >
                            <ExternalLink className="w-3 h-3" /> Acessar
                          </button>
                          <button onClick={() => setEditingCompany(company)} className="font-medium text-cyan-400 hover:underline text-xs">Editar</button>
                          <button onClick={() => setCompanyToDelete(company)} className="p-1 text-slate-500 hover:text-red-400" title="Excluir Empresa">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expandedCompanyId === company.uid && (
                    <tr>
                      <td colSpan={6} className="p-0 bg-slate-950 border-b border-slate-800">
                        <CompanyDetails company={company} onImpersonate={onImpersonate} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {editingCompany && <CompanyEditModal company={editingCompany} onClose={() => setEditingCompany(null)} onSave={handleUpdateCompany} />}
      {companyToDelete && <DeleteConfirmationModal company={companyToDelete} onClose={() => setCompanyToDelete(null)} onConfirm={handleDeleteCompany} isDeleting={!!isDeleting} />}
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
    <div className="bg-slate-900/50 p-6 animate-in slide-in-from-top-2 duration-300 shadow-inner">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna 1: Auditoria de Vagas */}
        <div className="bg-slate-950/80 p-4 rounded-lg border border-slate-800">
          <h4 className="font-mono text-xs uppercase text-slate-400 mb-4 flex items-center gap-2">
            <FilePieChart className="w-4 h-4 text-cyan-400"/> Auditoria de Vagas
          </h4>
          <div className="space-y-3 text-xs font-mono">
            <div className={`p-3 rounded bg-slate-900 border ${isPurchasedExpired && (company.purchasedSlots ?? 0) > 0 ? 'border-red-500/30' : 'border-cyan-500/20'}`}>
              <div className="flex justify-between items-center text-cyan-400">
                <span className="flex items-center gap-2"><ShoppingBag className="w-3 h-3"/> Slots Comprados</span>
                <span className="font-bold text-lg text-white">{company.purchasedSlots ?? 0}</span>
              </div>
              <p className={`text-right mt-1 ${isPurchasedExpired && (company.purchasedSlots ?? 0) > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                Vence: {formatDate(company.purchasedExpiresAt)}
              </p>
            </div>
            <div className={`p-3 rounded bg-slate-900 border ${isManualExpired && (company.manualSlots ?? 0) > 0 ? 'border-red-500/30' : 'border-fuchsia-500/20'}`}>
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
        <div className="bg-slate-950/80 p-4 rounded-lg border border-slate-800">
          <h4 className="font-mono text-xs uppercase text-slate-400 mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-green-400"/> Últimos Pagamentos
          </h4>
          <div className="space-y-2">
            {loadingTransactions ? <div className="text-center p-4"><Loader2 className="animate-spin text-slate-500 inline-block"/></div> :
              transactions.length > 0 ? transactions.map(tx => {
                const status = statusInfo[tx.status] || { text: tx.status, color: 'text-slate-400 bg-slate-700' };
                return (
                  <div key={tx.id} className="flex justify-between items-center text-xs font-mono bg-slate-900 p-2 rounded border border-slate-800">
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
        <div className="bg-slate-950/80 p-4 rounded-lg border border-slate-800">
          <h4 className="font-mono text-xs uppercase text-slate-400 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-fuchsia-400"/> Informações Rápidas
          </h4>
           <div className="space-y-4 text-xs text-slate-400 font-mono">
              <div className="flex items-center justify-between p-2 bg-slate-900 rounded">
                <span className="flex items-center gap-2"><Clock className="w-3 h-3"/> Criado em:</span>
                <span className="text-white">{company.createdAt ? new Date(company.createdAt).toLocaleDateString('pt-BR') : 'N/A'}</span>
              </div>
              
              <div className="flex items-center justify-between p-2 bg-slate-900 rounded">
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
                  className="w-full py-2 bg-fuchsia-600/20 hover:bg-fuchsia-600/30 text-fuchsia-400 hover:text-fuchsia-300 border border-fuchsia-500/30 rounded flex items-center justify-center gap-2 transition-colors font-bold"
                >
                  <ExternalLink className="w-3 h-3" /> Acessar Painel (God Mode)
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
  const [formData, setFormData] = useState({
    purchasedSlots: company.purchasedSlots ?? 0,
    purchasedExpiresAt: company.purchasedExpiresAt ? new Date(company.purchasedExpiresAt).toISOString().split('T')[0] : '',
    manualSlots: company.manualSlots ?? 0,
    manualExpiresAt: company.manualExpiresAt ? new Date(company.manualExpiresAt).toISOString().split('T')[0] : '',
    planStatus: company.planStatus || 'active',
    pricePerEmployee: company.pricePerEmployee || 19.90,
  });

  const toDate = (dateString: string) => dateString ? new Date(dateString + 'T00:00:00') : null;
  
  const now = new Date();
  const purchasedDate = toDate(formData.purchasedExpiresAt);
  const manualDate = toDate(formData.manualExpiresAt);

  const validPurchasedSlots = purchasedDate && purchasedDate > now ? Number(formData.purchasedSlots) : 0;
  const validManualSlots = manualDate && manualDate > now ? Number(formData.manualSlots) : 0;
  const totalValidSlots = validPurchasedSlots + validManualSlots;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let latestExpiry: Date | null = null;
    if (purchasedDate) latestExpiry = purchasedDate;
    if (manualDate && (!latestExpiry || manualDate > latestExpiry)) {
      latestExpiry = manualDate;
    }
    
    const dataToSave: Partial<CompanyData> = {
      purchasedSlots: Number(formData.purchasedSlots),
      purchasedExpiresAt: purchasedDate ? purchasedDate.toISOString() : undefined,
      manualSlots: Number(formData.manualSlots),
      manualExpiresAt: manualDate ? manualDate.toISOString() : undefined,
      maxEmployees: totalValidSlots,
      subscriptionExpiresAt: latestExpiry ? latestExpiry.toISOString() : undefined,
      planStatus: formData.planStatus as 'active' | 'inactive' | 'blocked',
      pricePerEmployee: Number(formData.pricePerEmployee),
    };

    if (latestExpiry && latestExpiry > now && (dataToSave.planStatus === 'inactive' || dataToSave.planStatus === 'blocked')) {
      dataToSave.planStatus = 'active';
    }
    
    onSave(company.uid!, dataToSave);
  };

  return (
     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-slate-900 border border-fuchsia-500/30 rounded-2xl p-8 max-w-lg w-full shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Editar {company.companyName}</h2>
            <button onClick={onClose}><X className="text-slate-500 hover:text-white"/></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <fieldset className="border-2 border-cyan-500/30 p-4 rounded-lg space-y-4">
              <legend className="px-2 font-mono text-cyan-400 text-sm">Plano Contratado (Automático)</legend>
              <div className="grid grid-cols-2 gap-4">
                <TechInput 
                  label="Qtd. Comprada"
                  type="number"
                  value={formData.purchasedSlots}
                  onChange={e => setFormData({...formData, purchasedSlots: parseInt(e.target.value) || 0})}
                  icon={<Users className="w-4 h-4"/>}
                />
                <TechInput 
                  label="Vence em"
                  type="date"
                  value={formData.purchasedExpiresAt}
                  onChange={e => setFormData({...formData, purchasedExpiresAt: e.target.value})}
                  icon={<Calendar className="w-4 h-4"/>}
                />
              </div>
            </fieldset>

            <fieldset className="border-2 border-fuchsia-500/30 p-4 rounded-lg space-y-4">
              <legend className="px-2 font-mono text-fuchsia-400 text-sm">Bônus / Cortesia (Manual)</legend>
              <div className="grid grid-cols-2 gap-4">
                <TechInput 
                  label="Qtd. Bônus"
                  type="number"
                  value={formData.manualSlots}
                  onChange={e => setFormData({...formData, manualSlots: parseInt(e.target.value) || 0})}
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
              onChange={e => setFormData({...formData, pricePerEmployee: parseFloat(e.target.value) || 0})}
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
              <button type="button" onClick={onClose} className="px-6 py-2 bg-slate-700 text-white font-bold rounded-lg">Cancelar</button>
              <button type="submit" className="px-6 py-2 bg-fuchsia-600 text-white font-bold rounded-lg">Salvar</button>
            </div>
          </form>
        </div>
     </div>
  );
}

const DeleteConfirmationModal: React.FC<{company: CompanyData, onClose: () => void, onConfirm: (id: string, name: string) => void, isDeleting: boolean}> = ({ company, onClose, onConfirm, isDeleting }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
    <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 max-w-lg w-full shadow-lg">
      <h2 className="text-xl font-bold text-white mb-2">Confirmar Exclusão</h2>
      <p className="text-slate-400 text-sm">
        Tem certeza que deseja excluir permanentemente a empresa <strong>{company.companyName}</strong> e todos os seus dados? (funcionários, locais, turnos, etc).
      </p>
      <p className="text-amber-400 text-xs mt-2 font-bold uppercase">Essa ação não pode ser desfeita.</p>
      <div className="flex justify-end gap-4 mt-8">
        <button onClick={onClose} disabled={isDeleting} className="px-6 py-2 bg-slate-700 text-white font-bold rounded-lg disabled:opacity-50">Cancelar</button>
        <button onClick={() => onConfirm(company.uid!, company.companyName)} disabled={isDeleting} className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg flex items-center gap-2 disabled:opacity-50">
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Excluir
        </button>
      </div>
    </div>
  </div>
);

export default SuperAdminCompanies;
