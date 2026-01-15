import React, { useState, useEffect, useRef } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { getPublicKey, processCardPayment } from '../../lib/mercadopago';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { playSound } from '../../lib/sounds';

interface CardPaymentModalProps {
  amount: number;
  payerEmail: string;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

const CardPaymentModal: React.FC<CardPaymentModalProps> = ({ amount, payerEmail, onClose, onPaymentSuccess }) => {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false); // For payment submission
  const [isReady, setIsReady] = useState(false); // Controls when the Brick is rendered
  const initialized = useRef(false);

  useEffect(() => {
    // This guard prevents the effect from running twice in StrictMode, which would cause an error.
    if (initialized.current) {
      return;
    }
    initialized.current = true;

    let isMounted = true;
    const initializeMP = async () => {
      try {
        const publicKey = await getPublicKey();
        if (isMounted && publicKey) {
          initMercadoPago(publicKey, { locale: 'pt-BR' });
          // Safety delay to ensure the modal's container is stable in the DOM
          setTimeout(() => {
            if (isMounted) {
              setIsReady(true);
            }
          }, 1000);
        } else if (isMounted) {
          throw new Error('Chave pública do Mercado Pago não foi encontrada.');
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Erro ao carregar o gateway de pagamento.');
        }
      }
    };
    initializeMP();

    return () => { isMounted = false; };
  }, []); // Empty dependency array ensures this runs only once on mount

  const initialization = {
    amount: Number(amount),
    payer: {
      email: payerEmail || 'cliente@email.com',
      entity_type: 'individual',
      first_name: 'Cliente',
      last_name: 'Nexus',
    },
  };

  const customization = {
    visual: {
      style: {
        theme: 'dark' as const,
      }
    },
    paymentMethods: {
      creditCard: 'all' as const,
      debitCard: 'all' as const,
    }
  };

  const onSubmit = async (formData: any) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await processCardPayment(formData);
      if (response.status === 'approved') {
        playSound.success();
        onPaymentSuccess();
      } else {
        throw new Error(`Pagamento ${response.status}. Motivo: ${response.status_detail}`);
      }
    } catch (err: any) {
      console.error("Card payment error:", err);
      setError(err.message || 'Ocorreu um erro ao processar seu pagamento. Verifique os dados e tente novamente.');
      playSound.error();
      setIsLoading(false);
      return Promise.reject(); // Important to let the Brick know the submission failed
    }
  };

  const onError = (err: any) => {
    console.error('🚨 Payment Brick onError callback:', err);
    // Avoid setting state here that causes re-renders to prevent loops.
    // User-facing errors are handled in onSubmit.
  };

  const onReady = () => { /* Payment Brick is ready */ };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in" onClick={onClose}>
      <div 
        className="bg-slate-900 border border-fuchsia-500/30 rounded-2xl p-8 max-w-lg w-full shadow-lg relative animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()} // Prevent modal from closing when clicking inside
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Pagamento com Cartão de Crédito</h2>
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X /></button>
        </div>
        
        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center rounded-2xl z-10">
            <Loader2 className="w-12 h-12 text-fuchsia-400 animate-spin"/>
            <p className="mt-4 text-white">Processando pagamento...</p>
          </div>
        )}
        
        {error && (
           <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 text-red-300 rounded-lg flex items-center gap-2">
             <AlertTriangle className="w-5 h-5"/>
             <span className="text-sm">{error}</span>
           </div>
        )}
        
        <div className="min-h-[400px]"> {/* Stable container to prevent layout shift */}
          {!isReady ? (
            <div className="flex flex-col items-center justify-center h-full pt-16">
              <Loader2 className="w-8 h-8 animate-spin text-fuchsia-400" />
              <p className="mt-4 text-slate-400">A carregar formulário de pagamento...</p>
            </div>
          ) : (
            <Payment
              initialization={initialization}
              customization={customization}
              onSubmit={onSubmit}
              onError={onError}
              onReady={onReady}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CardPaymentModal;
