import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Users, Building2, Wallet, Activity, Loader2, TrendingUp } from 'lucide-react';

interface SaasMetric {
  totalCompanies: number;
  activeCompanies: number;
  totalEmployees: number;
  monthlyRevenue: number;
  churnRate: number;
}

const SuperAdminOverview: React.FC = () => {
  const [metrics, setMetrics] = useState<SaasMetric | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const companiesQuery = query(collection(db, 'companies'));
        const employeesQuery = query(collection(db, 'employees'));

        const [companiesSnapshot, employeesSnapshot] = await Promise.all([
          getDocs(companiesQuery),
          getDocs(employeesQuery),
        ]);

        const allCompanies = companiesSnapshot.docs.map(doc => doc.data());
        
        const totalCompanies = companiesSnapshot.size;
        const activeCompanies = allCompanies.filter(c => c.planStatus === 'active').length;
        const totalEmployees = employeesSnapshot.size;
        const monthlyRevenue = activeCompanies * 99;
        const churnRate = 0; // Placeholder

        setMetrics({
          totalCompanies,
          activeCompanies,
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

    fetchMetrics();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-400" />
      </div>
    );
  }

  return (
    <div>
        <h1 className="font-tech text-3xl text-white mb-6">Visão Geral do SaaS</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard 
                icon={<Wallet className="w-6 h-6 text-green-400" />}
                title="MRR Estimado"
                value={metrics?.monthlyRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}
                subtitle="Receita Mensal Recorrente"
            />
            <MetricCard 
                icon={<Building2 className="w-6 h-6 text-cyan-400" />}
                title="Total de Empresas"
                value={metrics?.totalCompanies || 0}
                subtitle={`${metrics?.activeCompanies || 0} ativas`}
            />
            <MetricCard 
                icon={<Users className="w-6 h-6 text-fuchsia-400" />}
                title="Total de Funcionários"
                value={metrics?.totalEmployees || 0}
                subtitle="Licenças em uso"
            />
            <MetricCard 
                icon={<TrendingUp className="w-6 h-6 text-amber-400" />}
                title="Churn Rate"
                value={`${metrics?.churnRate || 0}%`}
                subtitle="Recurso em desenvolvimento"
            />
        </div>
    </div>
  );
};

interface MetricCardProps {
    icon: React.ReactNode;
    title: string;
    value: string | number;
    subtitle: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, title, value, subtitle }) => {
    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:bg-slate-800/40 hover:border-cyan-500/30 transition-all duration-300">
            <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-slate-800 rounded-lg">
                    {icon}
                </div>
                <h3 className="font-mono text-sm uppercase text-slate-400">{title}</h3>
            </div>
            <p className="text-4xl font-bold text-white">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        </div>
    )
}

export default SuperAdminOverview;
