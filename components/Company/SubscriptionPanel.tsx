import React, { useState, useEffect, useCallback } from 'react';
import { CompanyData } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc, getDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { processPixPayment, checkPaymentStatus } from '../../lib/mercadopago';
import TechInput from '../ui/TechInput';
import { Loader2, QrCode, Copy, CheckCircle } from 'lucide-react';
import QRCode from 'qrcode.react';
import { playSound } from '../../lib/sounds';

interface SubscriptionPanelProps {
  company: CompanyData | null;
  companyId: string;
}

const SubscriptionPanel: React.FC<SubscriptionPanelProps> = ({ company, companyId }) => {
  const PRICE_PER_EMPLOYEE = company?.pricePerEmployee || 19.90;
  
  const [numEmployees, setNumEmployees] = useState(company?.maxEmployees || 5);
  const [payerCpf, setPayerCpf] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [pixData, setPixData] = useState<{ paymentId: number; qrCode: string; qrCodeBase64: string; transactionId: string; } | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'cancelled' | null>(null);

  const handlePaymentSuccess = useCallback(async (newPurchasedSlots: number, transactionId: string) => {
    const newPurchasedExpiryDate = new Date();
    newPurchasedExpiryDate.setDate(newPurchasedExpiryDate.getDate() + 30);

    try {
      // 1. Get current company data to read manual slots info
      const companyRef = doc(db, 'companies', companyId);
      const companySnap = await getDoc(companyRef);
      if (!companySnap.exists()) {
        throw new Error("Empresa não encontrada.");
      }
      const currentData = companySnap.data() as CompanyData;
      const existingManualSlots = currentData.manualSlots || 0;
      const manualExpiresAt = currentData.manualExpiresAt ? new Date(currentData.manualExpiresAt) : null;

      // 2. Recalculate totals
      const now = new Date();
      const validManualSlots = (manualExpiresAt && manualExpiresAt > now) ? existingManualSlots : 0;
      const newTotalEmployees = newPurchasedSlots + validManualSlots;

      let latestExpiryDate = newPurchasedExpiryDate;
      if (manualExpiresAt && manualExpiresAt > newPurchasedExpiryDate) {
        latestExpiryDate = manualExpiresAt;
      }
      
      // 3. Update company and transaction doc in Firestore
      const transactionRef = doc(db, `companies/${companyId}/transactions`, transactionId);
      
      await updateDoc(companyRef, {
        purchasedSlots: newPurchasedSlots,
        purchasedExpiresAt: newPurchasedExpiryDate.toISOString(),
        planStatus: 'active',
        maxEmployees: newTotalEmployees,
        subscriptionExpiresAt: latestExpiryDate.toISOString(),
      });

      await updateDoc(transactionRef, {
        status: 'approved',
        approvedAt: now.toISOString(),
      });

      setPaymentStatus('approved');
      playSound.success();
    } catch (err) {
      console.error("Error updating company plan:", err);
      setError("Pagamento aprovado, mas houve um erro ao atualizar seu plano. Contate o suporte.");
    }
  }, [companyId]);

  // Polling para verificar o status do pagamento PIX
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (pixData && paymentStatus === 'pending') {
      interval = setInterval(async () => {
        try {
          const status = await checkPaymentStatus(pixData.paymentId);
          if (status === 'approved') {
            await handlePaymentSuccess(numEmployees, pixData.transactionId);
            if (interval) clearInterval(interval);
          } else if (status === 'cancelled' || status === 'expired') {
            setPaymentStatus('cancelled');
            setError('Pagamento PIX expirado ou cancelado.');
            if (interval) clearInterval(interval);
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 5000); // Verifica a cada 5 segundos
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pixData, paymentStatus, numEmployees, handlePaymentSuccess]);

  const handleGeneratePix = async () => {
    if (!payerCpf) {
      setError('Por favor, informe o CPF do pagador.');
      return;
    }
    setIsLoading(true);
    setError('');
    setPixData(null);
    setPaymentStatus(null);
    playSound.click();

    try {
      const totalAmount = numEmployees * PRICE_PER_EMPLOYEE;
      const response = await processPixPayment(
        totalAmount,
        company!.email,
        payerCpf,
        `Compra de ${numEmployees} Slots`
      );

      // Create transaction log
      const transactionData = {
        amount: totalAmount,
        status: 'pending',
        paymentMethod: 'pix',
        createdAt: new Date().toISOString(),
        externalReference: String(response.paymentId),
        description: `Compra de ${numEmployees} Slots`,
        companyId: companyId,
      };
      const transactionRef = await addDoc(collection(db, `companies/${companyId}/transactions`), transactionData);

      setPixData({ ...response, transactionId: transactionRef.id });
      setPaymentStatus('pending');
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar cobrança PIX.');
      playSound.error();
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Código PIX copiado!');
      playSound.click();
    });
  };

  if (paymentStatus === 'approved') {
    return (
      <div className="text-center p-8 bg-green-900/20 border border-green-500/30 rounded-xl animate-in fade-in zoom-in-95">
        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white">Pagamento Aprovado!</h2>
        <p className="text-slate-300 mt-2">Seu plano foi atualizado para {numEmployees} funcionários e renovado por 30 dias.</p>
        <button onClick={() => window.location.reload()} className="mt-6 bg-green-600 text-white font-bold py-2 px-6 rounded-lg">
          Atualizar Página
        </button>
      </div>
    );
  }
  
  if (pixData) {
    return (
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-8 animate-in fade-in">
        <h2 className="text-xl font-bold text-white mb-4">Pague com PIX</h2>
        <div className="flex flex-col md:flex-row gap-8 items-center">
          <div className="text-center">
            <div className="bg-white p-4 rounded-lg inline-block border-4 border-cyan-500 shadow-lg">
              <QRCode value={pixData.qrCode} size={200} />
            </div>
            <p className="text-slate-400 text-sm mt-4">Leia o QR Code com o app do seu banco</p>
          </div>
          <div className="flex-1 w-full">
            <p className="text-slate-400 text-sm mb-2">Ou use o PIX Copia e Cola:</p>
            <div className="relative">
              <textarea
                readOnly
                value={pixData.qrCode}
                className="w-full bg-slate-950 border border-slate-600 rounded-lg p-3 text-xs text-slate-300 font-mono h-32 resize-none"
              />
              <button onClick={() => copyToClipboard(pixData.qrCode)} className="absolute top-2 right-2 p-2 bg-slate-700 rounded-lg hover:bg-slate-600">
                <Copy className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="mt-6 text-center bg-cyan-900/30 border border-cyan-500/30 p-4 rounded-lg">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
              <p className="text-white font-semibold">Aguardando confirmação do pagamento...</p>
              <p className="text-slate-400 text-xs mt-1">Pode levar alguns segundos. Mantenha esta tela aberta.</p>
            </div>
          </div>
        </div>
         <button onClick={() => setPixData(null)} className="text-slate-400 text-sm mt-6 hover:text-white">Voltar</button>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-700 rounded-lg p-8">
        <h2 className="text-2xl font-bold text-white mb-2">Gerenciar Assinatura</h2>
        <p className="text-slate-400 mb-6">Selecione o número de licenças para gerar a cobrança via PIX.</p>
        
        <div className="space-y-6">
          <div>
            <label className="text-sm font-bold text-white">Total de Licenças (Funcionários)</label>
            <input
              type="range"
              min="1"
              max="200"
              value={numEmployees}
              onChange={(e) => setNumEmployees(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer mt-2"
            />
            <div className="flex justify-between text-xs font-mono text-slate-400 mt-1">
              <span>1</span>
              <span>100</span>
              <span>200</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-white">CPF do Pagador (para o PIX)</label>
             <TechInput 
                label=""
                placeholder="000.000.000-00"
                value={payerCpf}
                onChange={(e) => setPayerCpf(e.target.value)}
                required
              />
          </div>
          
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-6 h-fit">
        <h3 className="text-lg font-bold text-white border-b border-slate-600 pb-3 mb-4">Resumo do Pedido</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Licenças</span>
            <span className="font-bold text-white">{numEmployees}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Preço / licença</span>
            <span className="font-bold text-white">{PRICE_PER_EMPLOYEE.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
          <div className="flex justify-between text-lg pt-3 border-t border-slate-600">
            <span className="text-slate-300 font-bold">Total Mensal</span>
            <span className="font-bold text-cyan-400">{(numEmployees * PRICE_PER_EMPLOYEE).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </div>
        <button 
          onClick={handleGeneratePix} 
          disabled={isLoading}
          className="w-full mt-6 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
        >
          {isLoading ? <Loader2 className="animate-spin" /> : <QrCode />}
          Pagar com PIX
        </button>
        {error && <p className="text-red-400 text-xs mt-2 text-center">{error}</p>}
      </div>
    </div>
    </>
  );
};

export default SubscriptionPanel;
