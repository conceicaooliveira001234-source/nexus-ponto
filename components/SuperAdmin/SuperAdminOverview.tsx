import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Users, Building2, Wallet, Activity, Loader2, TrendingUp, TrendingDown, X, ChevronRight, DollarSign, Calendar, AlertCircle } from 'lucide-react';
import { CompanyData } from '../../types';

interface SaasMetric {
  totalCompanies: number;
  activeCompanies: number;
  inactiveCompanies: number;
  totalEmployees: number;
  monthlyRevenue: number;
  churnRate: number;
}

interface CompanyReportData extends CompanyData {
  realEmployeeCount: number;
  estimatedRevenue: number;
  status: 'active' | 'inactive' | 'blocked';
}

type DetailViewType = 'MRR' | 'COMPANIES' | 'EMPLOYEES' | 'CHURN' | null;

const SuperAdminOverview: React.FC = () => {
  const [metrics, setMetrics] = useState<SaasMetric | null>(null);
  const [reportData, setReportData] = useState<CompanyReportData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDetail, setActiveDetail] = useState<DetailViewType>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Buscar todas as empresas
        const companiesQuery = query(collection(db, 'companies'));
        const companiesSnapshot = await getDocs(companiesQuery);
        
        // 2. Buscar todos os funcionários
        const employeesQuery = query(collection(db, 'employees'));
        const employeesSnapshot = await getDocs(employeesQuery);

        const employees = employeesSnapshot.docs.map(doc => doc.data());
        
        // 3. Processar dados para relatórios
        const processedData: CompanyReportData[] = companiesSnapshot.docs.map(doc => {
          const data = doc.data() as CompanyData;
          const companyId = doc.id;
          
          // Contar funcionários desta empresa
          const companyEmployees = employees.filter(e => e.companyId === companyId).length;
          
          // Calcular receita estimada (Slots Comprados * Preço)
          // Se não tiver slots comprados, assume 0 receita (apenas bônus)
          const revenue = (data.purchasedSlots || 0) * (data.pricePerEmployee || 19.90);

          // Determinar status real
          let status: 'active' | 'inactive' | 'blocked' = data.planStatus || 'active';
          if (data.subscriptionExpiresAt && new Date(data.subscriptionExpiresAt) < new Date()) {
             status = 'inactive';
          }

          return {
            ...data,
            uid: companyId,
            realEmployeeCount: companyEmployees,
            estimatedRevenue: revenue,
            status: status
          };
        });

        setReportData(processedData);

        // 4. Calcular Métricas Gerais
        const totalCompanies = processedData.length;
        const activeCompanies = processedData.filter(c => c.status === 'active').length;
        const inactiveCompanies = totalCompanies - activeCompanies;
        const totalEmployees = employeesSnapshot.size;
        const monthlyRevenue = processedData.reduce((acc, curr) => acc + curr.estimatedRevenue, 0);
        
        // Churn Rate simples: (Empresas Inativas / Total) * 100
        const churnRate = totalCompanies > 0 ? (inactiveCompanies / totalCompanies) * 100 : 0;

        setMetrics({
          totalCompanies,
          activeCompanies,
          inactiveCompanies,
          totalEmployees,
          monthlyRevenue,
          churnRate,
        });

      } catch (error) {
        console.error("Error fetching SaaS metrics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-400" />
      </div>
    );
  }

  return (
    <div className="relative">
        <h1 className="font-tech text-3xl text-white mb-6">Visão Geral do SaaS</h1>
        
        {/* Grid de Cards Interativos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard 
                icon={<Wallet className="w-6 h-6 text-green-400" />}
                title="MRR Estimado"
                value={metrics?.monthlyRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}
                subtitle="Receita Mensal Recorrente"
                onClick={() => setActiveDetail('MRR')}
                color="green"
            />
            <MetricCard 
                icon={<Building2 className="w-6 h-6 text-cyan-400" />}
                title="Total de Empresas"
                value={metrics?.totalCompanies || 0}
                subtitle={`${metrics?.activeCompanies || 0} ativas | ${metrics?.inactiveCompanies || 0} inativas`}
                onClick={() => setActiveDetail('COMPANIES')}
                color="cyan"
            />
            <MetricCard 
                icon={<Users className="w-6 h-6 text-fuchsia-400" />}
                title="Total de Funcionários"
                value={metrics?.totalEmployees || 0}
                subtitle="Licenças em uso na plataforma"
                onClick={() => setActiveDetail('EMPLOYEES')}
                color="fuchsia"
            />
            <MetricCard 
                icon={metrics && metrics.churnRate > 10 ? <TrendingDown className="w-6 h-6 text-red-400" /> : <Activity className="w-6 h-6 text-amber-400" />}
                title="Churn Rate"
                value={`${metrics?.churnRate.toFixed(1) || 0}%`}
                subtitle="Taxa de cancelamento/inatividade"
                onClick={() => setActiveDetail('CHURN')}
                color="amber"
            />
        </div>

        {/* Área de Detalhamento (Modal/Overlay) */}
        {activeDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              
              {/* Header do Modal */}
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <div>
                  <h2 className="text-2xl font-tech text-white flex items-center gap-3">
                    {activeDetail === 'MRR' && <><Wallet className="text-green-400"/> Relatório Financeiro (MRR)</>}
                    {activeDetail === 'COMPANIES' && <><Building2 className="text-cyan-400"/> Relatório de Empresas</>}
                    {activeDetail === 'EMPLOYEES' && <><Users className="text-fuchsia-400"/> Distribuição de Funcionários</>}
                    {activeDetail === 'CHURN' && <><AlertCircle className="text-amber-400"/> Análise de Churn / Inatividade</>}
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">Detalhamento completo e hierárquico dos dados.</p>
                </div>
                <button onClick={() => setActiveDetail(null)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Conteúdo do Relatório */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                
                {/* RELATÓRIO FINANCEIRO (MRR) */}
                {activeDetail === 'MRR' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-green-900/20 border border-green-500/30 p-4 rounded-xl">
                        <p className="text-green-400 text-xs font-mono uppercase">Receita Total Estimada</p>
                        <p className="text-2xl font-bold text-white">{metrics?.monthlyRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      </div>
                      <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl">
                        <p className="text-slate-400 text-xs font-mono uppercase">Ticket Médio</p>
                        <p className="text-2xl font-bold text-white">
                          {metrics?.activeCompanies ? (metrics.monthlyRevenue / metrics.activeCompanies).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}
                        </p>
                      </div>
                    </div>

                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-xs font-mono text-slate-500 border-b border-slate-800">
                          <th className="p-3">Empresa</th>
                          <th className="p-3">Plano</th>
                          <th className="p-3 text-right">Vagas Contratadas</th>
                          <th className="p-3 text-right">Valor Unit.</th>
                          <th className="p-3 text-right">Total Mensal</th>
                          <th className="p-3 text-right">Próx. Vencimento</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {reportData
                          .filter(c => c.estimatedRevenue > 0)
                          .sort((a, b) => b.estimatedRevenue - a.estimatedRevenue)
                          .map((company) => (
                          <tr key={company.uid} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                            <td className="p-3 font-bold text-white">{company.companyName}</td>
                            <td className="p-3">
                              <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-400 text-[10px] border border-green-500/20">
                                ATIVO
                              </span>
                            </td>
                            <td className="p-3 text-right text-slate-300">{company.purchasedSlots}</td>
                            <td className="p-3 text-right text-slate-400">
                              {(company.pricePerEmployee || 19.90).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="p-3 text-right font-bold text-green-400">
                              {company.estimatedRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="p-3 text-right text-slate-400 font-mono text-xs">
                              {company.purchasedExpiresAt ? new Date(company.purchasedExpiresAt).toLocaleDateString('pt-BR') : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* RELATÓRIO DE EMPRESAS */}
                {activeDetail === 'COMPANIES' && (
                  <div className="space-y-4">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-xs font-mono text-slate-500 border-b border-slate-800">
                          <th className="p-3">Empresa / CNPJ</th>
                          <th className="p-3">Contato</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Funcionários</th>
                          <th className="p-3 text-right">Validade Geral</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {reportData.sort((a, b) => a.companyName.localeCompare(b.companyName)).map((company) => (
                          <tr key={company.uid} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                            <td className="p-3">
                              <div className="font-bold text-white">{company.companyName}</div>
                              <div className="text-xs text-slate-500 font-mono">{company.cnpj}</div>
                            </td>
                            <td className="p-3 text-slate-300">
                              <div className="flex flex-col text-xs">
                                <span>{company.email}</span>
                                <span className="text-slate-500">{company.whatsapp}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <StatusBadge status={company.status} />
                            </td>
                            <td className="p-3 text-right">
                              <span className="font-bold text-white">{company.realEmployeeCount}</span>
                              <span className="text-slate-500 text-xs"> / {company.maxEmployees || '∞'}</span>
                            </td>
                            <td className="p-3 text-right text-slate-400 font-mono text-xs">
                              {company.subscriptionExpiresAt ? new Date(company.subscriptionExpiresAt).toLocaleDateString('pt-BR') : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* RELATÓRIO DE FUNCIONÁRIOS */}
                {activeDetail === 'EMPLOYEES' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                       <div className="bg-fuchsia-900/20 border border-fuchsia-500/30 p-4 rounded-xl">
                          <p className="text-fuchsia-400 text-xs font-mono uppercase">Total de Licenças em Uso</p>
                          <p className="text-3xl font-bold text-white">{metrics?.totalEmployees}</p>
                       </div>
                    </div>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-xs font-mono text-slate-500 border-b border-slate-800">
                          <th className="p-3">Empresa</th>
                          <th className="p-3 text-right">Funcionários Cadastrados</th>
                          <th className="p-3 text-right">Limite do Plano</th>
                          <th className="p-3 text-right">Utilização</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {reportData
                          .sort((a, b) => b.realEmployeeCount - a.realEmployeeCount)
                          .map((company) => {
                            const usage = company.maxEmployees ? (company.realEmployeeCount / company.maxEmployees) * 100 : 0;
                            return (
                              <tr key={company.uid} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                <td className="p-3 font-bold text-white">{company.companyName}</td>
                                <td className="p-3 text-right text-white">{company.realEmployeeCount}</td>
                                <td className="p-3 text-right text-slate-400">{company.maxEmployees || 'Ilimitado'}</td>
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <span className="text-xs text-slate-400">{usage.toFixed(0)}%</span>
                                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                      <div className={`h-full ${usage > 90 ? 'bg-red-500' : 'bg-fuchsia-500'}`} style={{ width: `${Math.min(usage, 100)}%` }}></div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* RELATÓRIO DE CHURN */}
                {activeDetail === 'CHURN' && (
                  <div className="space-y-6">
                    <div className="bg-amber-900/10 border border-amber-500/20 p-4 rounded-xl">
                      <h3 className="text-amber-400 font-bold mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Empresas Inativas ou Bloqueadas</h3>
                      <p className="text-slate-400 text-sm">Estas empresas não estão gerando receita ou estão com o acesso bloqueado.</p>
                    </div>

                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-xs font-mono text-slate-500 border-b border-slate-800">
                          <th className="p-3">Empresa</th>
                          <th className="p-3">Status Atual</th>
                          <th className="p-3">Data de Expiração</th>
                          <th className="p-3 text-right">Perda Estimada (Mensal)</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {reportData
                          .filter(c => c.status !== 'active')
                          .map((company) => {
                            const potentialLoss = (company.purchasedSlots || 0) * (company.pricePerEmployee || 19.90);
                            return (
                              <tr key={company.uid} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                <td className="p-3 font-bold text-white">{company.companyName}</td>
                                <td className="p-3">
                                  <StatusBadge status={company.status} />
                                </td>
                                <td className="p-3 text-slate-400 font-mono text-xs">
                                  {company.subscriptionExpiresAt ? new Date(company.subscriptionExpiresAt).toLocaleDateString('pt-BR') : 'N/A'}
                                </td>
                                <td className="p-3 text-right text-red-400 font-bold">
                                  {potentialLoss > 0 ? potentialLoss.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                                </td>
                              </tr>
                            );
                        })}
                        {reportData.filter(c => c.status !== 'active').length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-slate-500">
                              Nenhuma empresa inativa encontrada. Ótimo trabalho!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}
    </div>
  );
};

interface MetricCardProps {
    icon: React.ReactNode;
    title: string;
    value: string | number;
    subtitle: string;
    onClick: () => void;
    color: 'green' | 'cyan' | 'fuchsia' | 'amber';
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, title, value, subtitle, onClick, color }) => {
    const colorClasses = {
      green: 'hover:border-green-500/50 hover:shadow-[0_0_20px_rgba(34,197,94,0.15)]',
      cyan: 'hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]',
      fuchsia: 'hover:border-fuchsia-500/50 hover:shadow-[0_0_20px_rgba(217,70,239,0.15)]',
      amber: 'hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    };

    return (
        <button 
          onClick={onClick}
          className={`w-full text-left bg-slate-900/50 border border-slate-800 rounded-xl p-6 transition-all duration-300 group ${colorClasses[color]}`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-800 rounded-lg group-hover:scale-110 transition-transform duration-300">
                        {icon}
                    </div>
                    <h3 className="font-mono text-sm uppercase text-slate-400 group-hover:text-white transition-colors">{title}</h3>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
            </div>
            <p className="text-4xl font-bold text-white mb-2">{value}</p>
            <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">{subtitle}</p>
        </button>
    )
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles = {
    active: 'bg-green-500/10 text-green-400 border-green-500/20',
    inactive: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    blocked: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  
  const labels = {
    active: 'Ativo',
    inactive: 'Inativo',
    blocked: 'Bloqueado',
  };

  const style = styles[status as keyof typeof styles] || styles.inactive;
  const label = labels[status as keyof typeof labels] || status;

  return (
    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${style}`}>
      {label}
    </span>
  );
};

export default SuperAdminOverview;
