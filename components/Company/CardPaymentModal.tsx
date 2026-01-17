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
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isBrickReady, setIsBrickReady] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    // Trava de segurança para evitar re-execução em StrictMode
    if (initialized.current) return;
    initialized.current = true;
    
    let isMounted = true;
    console.log('Buscando chave...');

    // Timeout de segurança para o carregamento do Brick
    const timeoutId = setTimeout(() => {
      if (isMounted && isInitializing) {
        console.error("TIMEOUT: O Brick do Mercado Pago demorou para carregar.");
        setError("O sistema de pagamento demorou muito para responder. Verifique sua conexão ou a configuração da chave.");
        setIsInitializing(false);
        setIsLoading(false);
      }
    }, 8000);

    const initializeMP = async () => {
      try {
        const publicKey = await getPublicKey();
        if (!isMounted) return;

        if (!publicKey) {
          console.error("CHAVE NÃO ENCONTRADA NO FIRESTORE");
          setError("Erro: Chave Pública não configurada no Painel Super Admin.");
          setIsInitializing(false);
          return;
        }

        console.log("Chave encontrada:", publicKey);
        await initMercadoPago(publicKey, { locale: 'pt-BR' });
        console.log("Iniciando Brick...");
        setIsBrickReady(true);
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Erro ao inicializar o sistema de pagamento.');
          setIsInitializing(false);
        }
      }
    };

    initializeMP();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  const initialization = {
    amount: Number(amount),
    payer: {
      email: payerEmail || 'cliente@nexuswork.com.br',
      entity_type: 'individual' as const,
      first_name: 'Cliente',
      last_name: 'Nexus',
    },
  };

  const customization = {
    visual: { style: { theme: 'dark' as const } },
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
        throw new Error(`Pagamento nao aprovado. Status: ${response.status}`);
      }
    } catch (err: any) {
      console.error(err);
      setError('Nao foi possivel processar o pagamento. Verifique os dados.');
      playSound.error();
      setIsLoading(false);
      return Promise.reject();
    }
  };

  const onBrickError = (err: any) => {
    console.error('Erro no componente Brick do Mercado Pago:', err);
    setError('Ocorreu um erro no formulário de pagamento. Por favor, verifique os dados e tente novamente.');
    setIsInitializing(false);
    setIsBrickReady(false);
  };

  const onBrickReady = () => {
    console.log("Brick Carregado com Sucesso - Cancelando Timeout");
    setIsLoading(false);
    setIsInitializing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div 
        className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-8 max-w-lg w-full shadow-lg relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X />
        </button>
        
        <h2 className="text-xl font-bold text-white mb-6">Cartao de Credito</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded text-sm flex gap-2 items-center">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/90 z-20 flex flex-col items-center justify-center rounded-2xl">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-2" />
            <p className="text-white">Processando...</p>
          </div>
        )}

        <div className="min-h-[500px] flex flex-col justify-center">
          {isInitializing && (
            <div className="flex flex-col items-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p>Carregando formulário seguro...</p>
            </div>
          )}
          {isBrickReady && !error && (
            <div style={{ minHeight: '500px' }}>
              <Payment
                initialization={initialization}
                customization={customization}
                onSubmit={onSubmit}
                onError={onBrickError}
                onReady={onBrickReady}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CardPaymentModal;
