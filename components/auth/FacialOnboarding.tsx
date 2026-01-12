import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Employee } from '../../types';
import * as faceapi from 'face-api.js';
import { Loader2, Camera, CheckCircle, X, ScanFace, User } from 'lucide-react';
import TechBackground from '../TechBackground';
import { playSound } from '../../lib/sounds';

interface FacialOnboardingProps {
  employeeId: string;
  onComplete: () => void;
}

const FacialOnboarding: React.FC<FacialOnboardingProps> = ({ employeeId, onComplete }) => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        setModelsLoaded(true);
      } catch (err) {
        setError('Erro ao carregar modelos de IA. Tente recarregar a página.');
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    const fetchEmployee = async () => {
      setIsLoading(true);
      try {
        const docRef = doc(db, 'employees', employeeId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const empData = docSnap.data() as Employee;
          if (empData.photoBase64) {
            setError('Este funcionário já possui um cadastro facial.');
          } else {
            setEmployee(empData);
          }
        } else {
          setError('Link de cadastro inválido ou expirado.');
        }
      } catch (err) {
        setError('Erro ao buscar dados. Verifique o link e tente novamente.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchEmployee();
  }, [employeeId]);
  
  const startCamera = async () => {
    setCameraActive(true);
    playSound.cameraOpen();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Não foi possível acessar a câmera. Verifique as permissões do seu navegador.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  const detectFace = useCallback(async () => {
    if (videoRef.current && modelsLoaded) {
      const detection = await faceapi.detectSingleFace(videoRef.current);
      setFaceDetected(!!detection);
    }
  }, [modelsLoaded]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (cameraActive && modelsLoaded) {
      interval = setInterval(detectFace, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cameraActive, modelsLoaded, detectFace]);

  const captureAndSave = async () => {
    if (!videoRef.current || !canvasRef.current || !faceDetected) return;

    setIsProcessing(true);
    playSound.click();

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      
      const detection = await faceapi.detectSingleFace(canvas);
      if(!detection) {
        setError("Nenhum rosto detectado na captura. Tente novamente.");
        setIsProcessing(false);
        return;
      }

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      const docRef = doc(db, 'employees', employeeId);
      await updateDoc(docRef, { photoBase64: dataUrl });

      playSound.success();
      stopCamera();
      onComplete();

    } catch (err) {
      setError('Erro ao salvar o cadastro facial. Tente novamente.');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <TechBackground />
      <div className="relative z-30 w-full max-w-md">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 p-8 rounded-2xl shadow-[0_0_50px_-10px_rgba(217,70,239,0.2)]">
          {error ? (
            <div className="text-center text-red-400">
              <h2 className="font-tech text-2xl font-bold mb-4">Erro no Cadastro</h2>
              <p>{error}</p>
            </div>
          ) : employee && !cameraActive ? (
            <div className="text-center">
              <div className="w-24 h-24 bg-slate-950 rounded-full mx-auto mb-6 flex items-center justify-center border border-slate-800">
                <User className="w-12 h-12 text-fuchsia-500" />
              </div>
              <h2 className="font-tech text-2xl font-bold text-white">Olá, {employee.name.split(' ')[0]}!</h2>
              <p className="text-slate-400 text-sm mb-8">Vamos realizar seu cadastro facial para o sistema de ponto.</p>
              <button
                onClick={startCamera}
                disabled={!modelsLoaded}
                className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold py-4 px-4 rounded-lg shadow-[0_0_20px_rgba(217,70,239,0.4)] flex items-center justify-center gap-2"
              >
                {modelsLoaded ? <><Camera className="w-5 h-5" /> Iniciar Cadastro Facial</> : <><Loader2 className="w-5 h-5 animate-spin"/> Carregando IA...</>}
              </button>
            </div>
          ) : employee && cameraActive && (
            <div className="text-center">
              <h2 className="font-tech text-2xl font-bold text-white mb-4">Posicione seu Rosto</h2>
              <div className="relative aspect-square bg-black rounded-lg overflow-hidden border-2 border-fuchsia-500 shadow-2xl mb-4">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                <canvas ref={canvasRef} className="hidden" />
                <div className={`absolute inset-0 border-8 transition-colors ${faceDetected ? 'border-green-500' : 'border-red-500'}`}></div>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm mb-4">
                {faceDetected ? <CheckCircle className="w-5 h-5 text-green-400"/> : <X className="w-5 h-5 text-red-400"/>}
                <span className={faceDetected ? 'text-green-400' : 'text-red-400'}>
                  {faceDetected ? 'Rosto detectado!' : 'Posicione seu rosto no centro'}
                </span>
              </div>
              <button
                onClick={captureAndSave}
                disabled={!faceDetected || isProcessing}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5" /> Concluir Cadastro</>}
              </button>
              <button onClick={stopCamera} className="text-xs text-slate-500 hover:text-white mt-4">Cancelar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacialOnboarding;
