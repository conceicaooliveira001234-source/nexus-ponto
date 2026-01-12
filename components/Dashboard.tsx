import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  ArrowLeft, LayoutDashboard, Activity, Lock, MapPin, 
  Users, Settings, Plus, Save, Trash2, FileText, User,
  Crosshair, Globe, ExternalLink, Loader2, List, UserPlus, CheckCircle, Edit3, Camera, ScanFace, KeyRound, Clock, X, LogIn, Coffee, Play, LogOut,
  AlertCircle, Info, Calendar, History, Building2, Briefcase, Trophy, Share2, Copy
} from 'lucide-react';
import TechBackground from './TechBackground';
import TechInput from './ui/TechInput';
import { UserRole, ServiceLocation, Employee, CompanyData, EmployeeContext, AttendanceType, AttendanceRecord, Shift } from '../types';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, getDoc, getDocs, orderBy, limit, Timestamp, writeBatch } from 'firebase/firestore';
import * as faceapi from 'face-api.js';
import { getCurrentPosition, isWithinRadius, calculateDistance } from '../lib/geolocation';
import { playSound } from '../lib/sounds';

interface DashboardProps {
  role: UserRole;
  onBack: () => void;
  currentCompanyId?: string;
  employeeContext?: EmployeeContext | null;
}

type Tab = 'OVERVIEW' | 'LOCATIONS' | 'EMPLOYEES' | 'SETTINGS';
type EmployeeSubTab = 'REGISTER' | 'LIST';
type EmployeeViewTab = 'DASHBOARD' | 'HISTORY';

const Dashboard: React.FC<DashboardProps> = ({ role, onBack, currentCompanyId, employeeContext }) => {
  const isCompany = role === UserRole.COMPANY;
  const [activeTab, setActiveTab] = useState<Tab>('OVERVIEW');
  
  // -- State for Company Management --
  const [companyName, setCompanyName] = useState('NEXUS ADMIN'); // Default placeholder
  const [locations, setLocations] = useState<ServiceLocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // -- Settings State --
  const [tenantCode, setTenantCode] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isEditingSettings, setIsEditingSettings] = useState(true); // Default to true (create mode)

  // -- Employee View States --
  const [employeeSubTab, setEmployeeSubTab] = useState<EmployeeSubTab>('REGISTER');
  const [activeLocationTab, setActiveLocationTab] = useState<string>('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false); // New state to lock submit
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null); // Track if editing

  // Form States
  const [newLocation, setNewLocation] = useState<{
    name: string;
    address: string;
    latitude: string;
    longitude: string;
    radius: string;
  }>({ name: '', address: '', latitude: '', longitude: '', radius: '100' });
  
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const initialEmployeeState = {
    name: '', cpf: '', role: '', whatsapp: '', 
    shifts: [] as Shift[], 
    locationIds: [] as string[], 
    photoBase64: '', pin: ''
  };

  const [newEmployee, setNewEmployee] = useState(initialEmployeeState);

  // -- Biometric / Employee Dashboard State --
  const [isBiometricVerified, setIsBiometricVerified] = useState(false);
  const [identifiedEmployee, setIdentifiedEmployee] = useState<Employee | null>(null);
  const [cpfForLogin, setCpfForLogin] = useState(''); // Used ONLY for PIN fallback now
  const [pinForLogin, setPinForLogin] = useState('');
  const [showPinLogin, setShowPinLogin] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // -- Camera Capture States (for Employee Registration) --
  const [showCameraCapture, setShowCameraCapture] = useState(false);
  const [isCaptureReady, setIsCaptureReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState<boolean | null>(null);
  const [isValidatingFace, setIsValidatingFace] = useState(false);
  const captureVideoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);

  // -- Attendance (Registro de Ponto) States --
  const [showAttendanceFlow, setShowAttendanceFlow] = useState(false);
  const [attendanceType, setAttendanceType] = useState<AttendanceType | null>(null);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [locationVerified, setLocationVerified] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isRegisteringAttendance, setIsRegisteringAttendance] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<ServiceLocation | null>(null);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null); // Turno selecionado
  const [isIdentityConfirmed, setIsIdentityConfirmed] = useState(false);
  
  // -- Attendance History States --
  const [activeEmployeeTab, setActiveEmployeeTab] = useState<EmployeeViewTab>('DASHBOARD');
  const [historyStartDate, setHistoryStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [historyEndDate, setHistoryEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedHistoryLocation, setSelectedHistoryLocation] = useState<string>('');

  // -- Notification State (Toast) --
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; visible: boolean }>({
    message: '',
    type: 'info',
    visible: false
  });

  const [generatedLink, setGeneratedLink] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, visible: true });
    // Auto hide after 5 seconds
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 5000);
  }, []);

  // -- Persistência de Login do Funcionário --
  useEffect(() => {
    if (role === UserRole.EMPLOYEE) {
      const storedEmployee = localStorage.getItem('nexus_employee');
      const storedVerified = localStorage.getItem('nexus_verified');
      
      if (storedEmployee && storedVerified === 'true') {
        try {
          const emp = JSON.parse(storedEmployee);
          // Validar se pertence à empresa atual se necessário
          if (emp.companyId === currentCompanyId) {
             setIdentifiedEmployee(emp);
             setIsBiometricVerified(true);
          }
        } catch (e) {
          console.error("Erro ao restaurar sessão", e);
        }
      }
    }
  }, [role, currentCompanyId]);

  useEffect(() => {
    if (isBiometricVerified && identifiedEmployee) {
      localStorage.setItem('nexus_employee', JSON.stringify(identifiedEmployee));
      localStorage.setItem('nexus_verified', 'true');
    }
  }, [isBiometricVerified, identifiedEmployee]);

  const handleDashboardLogout = () => {
    localStorage.removeItem('nexus_employee');
    localStorage.removeItem('nexus_verified');
    stopCamera(); // Garantir que a câmera pare ao sair
    onBack();
  };

  // -- Load Face API Models (for both Company and Employee) --
  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      console.log('🔄 Iniciando carregamento dos modelos face-api.js...');
      console.log('📁 Caminho dos modelos:', MODEL_URL);
      
      try {
        console.log('⏳ Carregando SSD MobileNet v1 (detecção de rostos)...');
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        console.log('✅ SSD MobileNet v1 carregado');
        
        console.log('⏳ Carregando Face Landmark 68 (pontos faciais)...');
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        console.log('✅ Face Landmark 68 carregado');
        
        console.log('⏳ Carregando Face Recognition (reconhecimento)...');
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        console.log('✅ Face Recognition carregado');
        
        setModelsLoaded(true);
        console.log('🎉 Todos os modelos carregados com sucesso!');
      } catch (err) {
        console.error('❌ Erro ao carregar modelos face-api.js:', err);
        console.error('💡 Verifique se os arquivos estão em /public/models/');
        setScanMessage("Erro ao carregar modelos de IA. Verifique os arquivos.");
        showToast("Erro ao carregar modelos de IA. Verifique os arquivos.", "error");
      }
    };
    // Load models for both Company (registration) and Employee (login)
    if (employeeContext || isCompany) {
       loadModels();
    }
  }, [employeeContext, isCompany]);

  // -- Data Listeners & Fetchers --
  useEffect(() => {
    if (!currentCompanyId) return;
    
    setIsLoadingData(true);

    // 0. Fetch Company Settings
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "companies", currentCompanyId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as CompanyData;
          if (data.companyName) setCompanyName(data.companyName);
          if (data.tenantCode) {
            setTenantCode(data.tenantCode);
            setIsEditingSettings(false);
          } else {
            setIsEditingSettings(true);
          }
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();

    // 1. Listen for Locations
    const locationsRef = collection(db, "locations");
    const qLocations = query(locationsRef, where("companyId", "==", currentCompanyId));
    
    const unsubLocations = onSnapshot(qLocations, (snapshot) => {
      const locs: ServiceLocation[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ServiceLocation));
      setLocations(locs);
      // Determine active tab for company view
      if (isCompany && locs.length > 0 && !activeLocationTab) {
        setActiveLocationTab(locs[0].id);
      }
    });

    // 2. Listen for Employees (Fetch for BOTH roles now, so Employee Login has reference photos)
    const employeesRef = collection(db, "employees");
    const qEmployees = query(employeesRef, where("companyId", "==", currentCompanyId));

    const unsubEmployees = onSnapshot(qEmployees, (snapshot) => {
      const emps: Employee[] = snapshot.docs.map(doc => {
        const data = doc.data();
        // Handle legacy locationId by converting to array
        const locIds = data.locationIds || (data.locationId ? [data.locationId] : []);
        // Handle legacy shift fields by converting to shifts array if needed
        let shifts = data.shifts || [];
        if (shifts.length === 0 && data.entryTime && data.exitTime) {
           shifts.push({
             id: 'legacy',
             name: 'Turno Padrão',
             entryTime: data.entryTime,
             breakTime: data.breakTime,
             exitTime: data.exitTime
           });
        }
        return {
          id: doc.id,
          ...data,
          locationIds: locIds,
          shifts: shifts
        } as Employee;
      });
      setEmployees(emps);
      setIsLoadingData(false);
    });

    return () => {
      unsubLocations();
      unsubEmployees();
    };
  }, [isCompany, currentCompanyId]);

  // Sync identified employee data when the main employee list is updated from Firestore
  useEffect(() => {
    // This effect should only run when the global employee list is updated.
    if (employees.length === 0) return;

    setIdentifiedEmployee(currentEmployee => {
      // If no employee is logged in, do nothing.
      if (!currentEmployee?.id) {
        return currentEmployee;
      }

      // Find the latest data for the logged-in employee from the updated list.
      const updatedData = employees.find(e => e.id === currentEmployee.id);
      
      // If the employee was deleted from the list, don't change state.
      if (!updatedData) {
        return currentEmployee;
      }

      // Compare shifts to see if an update is needed. Stringify is not perfect but good enough here.
      const shiftsChanged = JSON.stringify(updatedData.shifts || []) !== JSON.stringify(currentEmployee.shifts || []);

      if (shiftsChanged) {
        console.log(`🔄 Sincronizando dados para ${currentEmployee.name}. Os turnos foram alterados.`);
        showToast('Seus turnos de trabalho foram atualizados!', 'info');
        playSound.alert();
        // Return the new data to update the state.
        return updatedData;
      }

      // If no changes, return the existing state to prevent a re-render.
      return currentEmployee;
    });
  }, [employees, showToast]);

  const handleGenerateLink = (employeeId: string) => {
    const link = `${window.location.origin}/register-face/${employeeId}`;
    setGeneratedLink(link);
    setShowLinkModal(true);
    playSound.success();
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Link copiado para a área de transferência!', 'success');
      playSound.click();
    }, (err) => {
      console.error('Could not copy text: ', err);
      showToast('Erro ao copiar o link.', 'error');
      playSound.error();
    });
  };

  // -- Camera Lifecycle Effect --
  useEffect(() => {
    let isActive = true;
    let stream: MediaStream | null = null;

    const initCamera = async () => {
      if (cameraActive) {
        setScanMessage(modelsLoaded ? 'Aguardando câmera...' : 'Carregando modelos...');
        console.log('📷 Iniciando câmera para login facial...');
        playSound.cameraOpen(); // 🔊 SOM DE CÂMERA
        
        try {
          // Try user facing mode first
          let mediaStream: MediaStream;
          try {
            console.log('🔍 Tentando acessar câmera frontal...');
            mediaStream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: "user" } 
            });
            console.log('✅ Câmera frontal acessada');
          } catch (err) {
            console.warn("⚠️ Câmera frontal não encontrada, tentando câmera padrão...", err);
            // Fallback to any video device
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            console.log('✅ Câmera padrão acessada');
          }
          
          if (!isActive) {
            mediaStream.getTracks().forEach(track => track.stop());
            return;
          }

          stream = mediaStream;
          
          // Função para tentar atribuir o stream ao vídeo com retries
          const assignStreamToVideo = (attempts = 0) => {
            if (videoRef.current) {
              videoRef.current.srcObject = mediaStream;
              setScanMessage('Posicione o rosto no centro...');
              console.log('✅ Câmera pronta para identificação');
            } else if (attempts < 20 && isActive) {
              // Tenta novamente em 100ms se o elemento de vídeo ainda não estiver montado
              // Isso corrige o problema de "tela com borda mas sem câmera"
              console.log(`⏳ Aguardando elemento de vídeo... (tentativa ${attempts + 1})`);
              setTimeout(() => assignStreamToVideo(attempts + 1), 100);
            } else {
              console.warn('⚠️ Não foi possível encontrar o elemento de vídeo após várias tentativas.');
            }
          };
          
          assignStreamToVideo();

        } catch (err: any) {
          console.error("❌ Erro ao acessar câmera:", err);
          console.error("Tipo de erro:", err.name);
          
          if (isActive) {
             let message = "Erro ao acessar câmera. Verifique se você permitiu o acesso.";
             if (err.name === 'NotAllowedError') {
               message = "⛔ Permissão de câmera negada. Clique no ícone de cadeado/câmera na barra de endereço e permita o acesso.";
             } else if (err.name === 'NotFoundError') {
               message = "📷 Nenhuma câmera encontrada no dispositivo.";
             } else if (err.name === 'NotReadableError') {
               message = "🔒 Câmera em uso por outro aplicativo. Feche outros apps que usam a câmera.";
             }
             showToast(message, "error");
             playSound.error(); // 🔊 SOM DE ERRO
             setCameraActive(false);
          }
        }
      }
    };

    if (cameraActive) {
      initCamera();
    }

    return () => {
      isActive = false;
      if (stream) {
        console.log('🔌 Desligando câmera...');
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraActive, modelsLoaded]);

  // -- Auto-Recognition for Login (Employee Identification) --
  useEffect(() => {
    let loginRecognitionInterval: NodeJS.Timeout | null = null;

    // 🔥 Reconhecimento automático para LOGIN
    if (cameraActive && modelsLoaded && !isBiometricVerified && !showAttendanceFlow && videoRef.current) {
      console.log('🤖 Iniciando reconhecimento automático para LOGIN...');
      setScanMessage('🔍 Reconhecendo automaticamente...');
      
      // Aguardar 0.5 segundo para câmera estabilizar (era 1s)
      const startDelay = setTimeout(() => {
        loginRecognitionInterval = setInterval(() => {
          if (!isScanning && !isBiometricVerified) {
            console.log('🔄 Tentando identificar funcionário automaticamente...');
            identifyEmployee();
          }
        }, 1000); // A cada 1 segundo (era 2.5s)
      }, 500);

      return () => {
        clearTimeout(startDelay);
        if (loginRecognitionInterval) {
          console.log('🛑 Parando reconhecimento automático de login...');
          clearInterval(loginRecognitionInterval);
        }
      };
    }
  }, [cameraActive, modelsLoaded, isBiometricVerified, isScanning, showAttendanceFlow]);

  // -- Continuous Validation for Attendance Flow --
  useEffect(() => {
    let attendanceValidationInterval: NodeJS.Timeout | null = null;

    // 🔥 Validação contínua durante registro de ponto para habilitar botão
    if (showAttendanceFlow && locationVerified && cameraActive && modelsLoaded && !isRegisteringAttendance && identifiedEmployee) {
      console.log('🤖 Iniciando validação contínua para registro de ponto...');
      
      // Aguardar 0.5 segundo para câmera estabilizar (era 1s)
      const startDelay = setTimeout(() => {
        attendanceValidationInterval = setInterval(() => {
          if (!isRegisteringAttendance && !isScanning) {
            autoRecognizeAndRegister();
          }
        }, 1000); // A cada 1 segundo (era 2.5s)
      }, 500);

      return () => {
        clearTimeout(startDelay);
        if (attendanceValidationInterval) {
          console.log('🛑 Parando validação contínua de ponto...');
          clearInterval(attendanceValidationInterval);
        }
      };
    }
  }, [showAttendanceFlow, locationVerified, cameraActive, modelsLoaded, isRegisteringAttendance, identifiedEmployee, isScanning]);

  // -- Load Current Location and Attendance Records (Employee View) --
  useEffect(() => {
    if (!employeeContext) return;

    // If locationId is present in context (legacy or persisted), load it
    if (employeeContext.locationId) {
        const loadLocation = async () => {
        try {
            const locationDoc = await getDoc(doc(db, "locations", employeeContext.locationId!));
            if (locationDoc.exists()) {
            setCurrentLocation({ id: locationDoc.id, ...locationDoc.data() } as ServiceLocation);
            console.log('📍 Local de trabalho carregado:', locationDoc.data());
            }
        } catch (error) {
            console.error('❌ Erro ao carregar local:', error);
        }
        };
        loadLocation();
    }

    // Listen for attendance records
    if (identifiedEmployee) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('🎧 CONFIGURANDO LISTENER DE REGISTROS DE PONTO');
      console.log('═══════════════════════════════════════════════════════');
      console.log('👤 Funcionário ID:', identifiedEmployee.id);
      console.log('👤 Funcionário Nome:', identifiedEmployee.name);
      console.log('📍 Company ID:', employeeContext?.companyId);
      console.log('📍 Location ID:', employeeContext?.locationId);
      
      const attendanceRef = collection(db, "attendance");
      const qAttendance = query(
        attendanceRef,
        where("employeeId", "==", identifiedEmployee.id),
        orderBy("timestamp", "desc"),
        limit(10)
      );

      console.log('🔍 Query configurada:');
      console.log('   - Collection: attendance');
      console.log('   - Where: employeeId ==', identifiedEmployee.id);
      console.log('   - OrderBy: timestamp DESC');
      console.log('   - Limit: 10');
      console.log('⏳ Aguardando eventos do Firestore...');
      console.log('═══════════════════════════════════════════════════════');

      const unsubAttendance = onSnapshot(
        qAttendance, 
        (snapshot) => {
          console.log('═══════════════════════════════════════════════════════');
          console.log('🔔 LISTENER ACIONADO! Snapshot recebido do Firestore');
          console.log('═══════════════════════════════════════════════════════');
          console.log('📊 Número de documentos no snapshot:', snapshot.docs.length);
          console.log('📊 Snapshot vazio?', snapshot.empty);
          console.log('📊 Metadados:', {
            hasPendingWrites: snapshot.metadata.hasPendingWrites,
            fromCache: snapshot.metadata.fromCache
          });
          
          if (snapshot.docs.length > 0) {
            console.log('📄 Documentos recebidos:');
            snapshot.docs.forEach((doc, index) => {
              const data = doc.data();
              console.log(`   ${index + 1}. ID: ${doc.id}`);
              console.log(`      - employeeId: ${data.employeeId}`);
              console.log(`      - employeeName: ${data.employeeName}`);
              console.log(`      - type: ${data.type}`);
              console.log(`      - timestamp: ${data.timestamp?.toDate?.()?.toLocaleString('pt-BR') || 'N/A'}`);
            });
          } else {
            console.warn('⚠️ Nenhum documento encontrado no snapshot!');
            console.log('💡 Possíveis causas:');
            console.log('   1. Nenhum registro foi salvo ainda');
            console.log('   2. O employeeId não corresponde');
            console.log('   3. Falta índice composto no Firestore');
            console.log('   4. As regras do Firestore estão bloqueando a leitura');
          }
          
          const records: AttendanceRecord[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate() || new Date()
            } as AttendanceRecord;
          });
          
          setAttendanceRecords(records);
          console.log(`✅ Estado atualizado: ${records.length} registros de ponto carregados`);
          console.log('═══════════════════════════════════════════════════════');
        },
        (error) => {
          console.log('═══════════════════════════════════════════════════════');
          console.error('❌❌❌ ERRO NO LISTENER DE ATTENDANCE ❌❌❌');
          console.log('═══════════════════════════════════════════════════════');
          console.error('🔴 Tipo do erro:', error?.name || 'Desconhecido');
          console.error('🔴 Mensagem:', error?.message || 'Sem mensagem');
          console.error('🔴 Código:', error?.code || 'Sem código');
          console.error('🔴 Objeto completo:', error);
          
          if (error?.code === 'failed-precondition') {
            console.error('💡 SOLUÇÃO: Crie um índice composto no Firestore!');
            console.error('   1. Acesse: https://console.firebase.google.com/');
            console.error('   2. Vá em Firestore Database > Indexes');
            console.error('   3. Crie um índice composto:');
            console.error('      - Collection: attendance');
            console.error('      - Fields: employeeId (Ascending), timestamp (Descending)');
          } else if (error?.code === 'permission-denied') {
            console.error('💡 SOLUÇÃO: Verifique as regras do Firestore!');
            console.error('   - A collection "attendance" precisa permitir leitura');
          }
          console.log('═══════════════════════════════════════════════════════');
        }
      );

      return () => {
        console.log('🔌 Desconectando listener de attendance records');
        unsubAttendance();
      };
    }
  }, [employeeContext, identifiedEmployee]);

  // -- Fetch History Effect --
  useEffect(() => {
    if (activeEmployeeTab === 'HISTORY' && identifiedEmployee) {
      const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
          // Create date range for the selected date (local time)
          const [startYear, startMonth, startDay] = historyStartDate.split('-').map(Number);
          const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);

          const [endYear, endMonth, endDay] = historyEndDate.split('-').map(Number);
          const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

          const q = query(
            collection(db, "attendance"),
            where("employeeId", "==", identifiedEmployee.id),
            where("timestamp", ">=", Timestamp.fromDate(start)),
            where("timestamp", "<=", Timestamp.fromDate(end)),
            orderBy("timestamp", "desc")
          );

          const snapshot = await getDocs(q);
          const records = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate() || new Date()
            } as AttendanceRecord;
          });

          setHistoryRecords(records);
          
          // Extract unique locations for tabs
          const uniqueLocations = Array.from(new Set(records.map(r => r.locationName)));
          
          // Update selected location if needed
          if (uniqueLocations.length > 0) {
            if (!selectedHistoryLocation || !uniqueLocations.includes(selectedHistoryLocation)) {
              setSelectedHistoryLocation(uniqueLocations[0]);
            }
          } else {
            setSelectedHistoryLocation('');
          }

        } catch (error) {
          console.error("Error fetching history:", error);
          showToast("Erro ao carregar histórico.", "error");
        } finally {
          setIsLoadingHistory(false);
        }
      };

      fetchHistory();
    }
  }, [activeEmployeeTab, historyStartDate, historyEndDate, identifiedEmployee]);

  const dailySummaries = useMemo(() => {
    if (!historyRecords.length || !identifiedEmployee?.shifts || identifiedEmployee.shifts.length === 0) {
      return [];
    }

    const timeToMinutes = (timeStr: string | undefined): number => {
      if (!timeStr) return 0;
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const formatMinutes = (mins: number) => {
        const sign = mins < 0 ? '-' : '';
        const absMins = Math.abs(mins);
        const h = Math.floor(absMins / 60);
        const m = Math.round(absMins % 60);
        return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // 1. Group records by date string
    const recordsByDay = historyRecords.reduce((acc, record) => {
      const day = record.timestamp.toISOString().split('T')[0];
      if (!acc[day]) {
        acc[day] = [];
      }
      acc[day].push(record);
      return acc;
    }, {} as Record<string, AttendanceRecord[]>);

    // 2. Process each day
    return Object.keys(recordsByDay).sort().reverse().map(day => {
      const records = recordsByDay[day];
      const sortedRecords = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const entryRecord = sortedRecords.find(r => r.type === 'ENTRY');
      const exitRecord = sortedRecords.find(r => r.type === 'EXIT');

      // Find associated shift (best guess based on entry time)
      let associatedShift: Shift | null = null;
      if (entryRecord && identifiedEmployee.shifts.length > 0) {
        const entryTimeInMinutes = entryRecord.timestamp.getHours() * 60 + entryRecord.timestamp.getMinutes();
        let closestShift: Shift | null = null;
        let minDiff = Infinity;

        for (const shift of identifiedEmployee.shifts) {
          const shiftEntryMinutes = timeToMinutes(shift.entryTime);
          if (shiftEntryMinutes === 0) continue;
          
          let diff = Math.abs(entryTimeInMinutes - shiftEntryMinutes);
          if (diff > 12 * 60) {
            diff = 24 * 60 - diff;
          }

          if (diff < minDiff) {
            minDiff = diff;
            closestShift = shift;
          }
        }
        associatedShift = closestShift;
      } else {
        // Fallback to first shift if no entry record or other logic fails
        associatedShift = identifiedEmployee.shifts[0];
      }
      
      // Calculate total expected work minutes from shift
      let totalWorkMinutes = 0;
      if (associatedShift) {
        const entry = timeToMinutes(associatedShift.entryTime);
        const exit = timeToMinutes(associatedShift.exitTime);
        const breakStart = timeToMinutes(associatedShift.breakTime);
        const breakEnd = timeToMinutes(associatedShift.breakEndTime);

        let shiftDuration = exit - entry;
        if (shiftDuration < 0) shiftDuration += 24 * 60;
        
        let breakDuration = breakEnd - breakStart;
        if (breakDuration < 0) breakDuration += 24 * 60;
        
        totalWorkMinutes = shiftDuration - (breakDuration > 0 ? breakDuration : 0);
      }

      // Calculate actual worked minutes from records
      let workedMinutes = 0;
      let totalBreakMinutes = 0;
      
      if (entryRecord && exitRecord) {
        workedMinutes = (exitRecord.timestamp.getTime() - entryRecord.timestamp.getTime()) / (1000 * 60);

        const breakStarts = sortedRecords.filter(r => r.type === 'BREAK_START');
        const breakEnds = sortedRecords.filter(r => r.type === 'BREAK_END');
        
        for (let i = 0; i < Math.min(breakStarts.length, breakEnds.length); i++) {
          const breakDuration = (breakEnds[i].timestamp.getTime() - breakStarts[i].timestamp.getTime()) / (1000 * 60);
          if (breakDuration > 0) {
            totalBreakMinutes += breakDuration;
          }
        }
        
        workedMinutes -= totalBreakMinutes;
      }

      const difference = workedMinutes - totalWorkMinutes;
      
      return {
        day,
        records,
        summary: {
          totalToWork: formatMinutes(totalWorkMinutes),
          totalWorked: formatMinutes(workedMinutes),
          hoursOwed: difference < 0 ? formatMinutes(difference) : '00:00',
          overtime: difference > 0 ? formatMinutes(difference) : '00:00',
        }
      };
    });
  }, [historyRecords, identifiedEmployee?.shifts]);

  // 🔥 Auto-start camera when component mounts (Employee Login)
  useEffect(() => {
    if (!isBiometricVerified && !showPinLogin && employeeContext && modelsLoaded) {
      console.log('🚀 Auto-iniciando câmera para login automático...');
      const timer = setTimeout(() => {
        startCamera();
      }, 500); // Small delay to ensure UI is ready
      
      return () => clearTimeout(timer);
    }
  }, [isBiometricVerified, showPinLogin, employeeContext, modelsLoaded]);

  // Auto-select shift if only one is available, or if location changes
  useEffect(() => {
    if (identifiedEmployee && identifiedEmployee.shifts) {
      const availableShifts = identifiedEmployee.shifts || [];
      if (availableShifts.length === 1) {
        setCurrentShift(availableShifts[0]);
      } else if (availableShifts.length === 0) {
        setCurrentShift(null);
      }
      // If the current shift is no longer in the employee's shift list, clear it.
      if (currentShift && !availableShifts.some(s => s.id === currentShift.id)) {
        setCurrentShift(null);
      }
    }
  }, [identifiedEmployee, currentLocation]); // Re-evaluate when employee loads or location changes conceptually

  // Auto-filter shifts based on current time
  const availableShifts = useMemo(() => {
    if (!identifiedEmployee?.shifts) return [];

    const now = new Date();
    const nowInMinutes = now.getHours() * 60 + now.getMinutes();
    const GRACE_PERIOD_BEFORE = 120; // 2 hours
    const GRACE_PERIOD_AFTER = 60; // 1 hour

    const timeToMinutes = (timeStr: string | undefined): number | null => {
      if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return null;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    return identifiedEmployee.shifts.filter(shift => {
      const entryInMinutes = timeToMinutes(shift.entryTime);
      const exitInMinutes = timeToMinutes(shift.exitTime);

      if (entryInMinutes === null || exitInMinutes === null) {
        return true; // Se o turno não tem horário, sempre mostra
      }

      const windowStart = (entryInMinutes - GRACE_PERIOD_BEFORE + 1440) % 1440;
      const windowEnd = (exitInMinutes + GRACE_PERIOD_AFTER + 1440) % 1440;
      
      const isWindowOvernight = windowStart > windowEnd;

      if (isWindowOvernight) {
        // Ex: Janela 20:00 - 07:00. `now` é válido se >= 20:00 OU <= 07:00
        return nowInMinutes >= windowStart || nowInMinutes <= windowEnd;
      } else {
        // Ex: Janela 06:00 - 18:00. `now` deve estar entre os dois.
        return nowInMinutes >= windowStart && nowInMinutes <= windowEnd;
      }
    });
  }, [identifiedEmployee?.shifts]);

  // -- Logic for Sequential Attendance Buttons --
  const todayAttendance = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // attendanceRecords is already sorted desc by timestamp
    return attendanceRecords.filter(record => record.timestamp >= todayStart);
  }, [attendanceRecords]);

  const nextAction = useMemo(() => {
    const lastRecord = todayAttendance[0]; // Newest record of the day

    if (!lastRecord || lastRecord.type === 'EXIT') {
      return { type: 'ENTRY' as AttendanceType, label: 'ENTRADA', icon: <LogIn className="w-5 h-5 md:w-6 md:h-6" />, color: 'from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]' };
    }

    switch (lastRecord.type) {
      case 'ENTRY':
        return { type: 'BREAK_START' as AttendanceType, label: 'INÍCIO PAUSA', icon: <Coffee className="w-5 h-5 md:w-6 md:h-6" />, color: 'from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 shadow-[0_0_20px_rgba(234,179,8,0.4)]' };
      case 'BREAK_START':
        return { type: 'BREAK_END' as AttendanceType, label: 'FIM PAUSA', icon: <Play className="w-5 h-5 md:w-6 md:h-6" />, color: 'from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]' };
      case 'BREAK_END':
        return { type: 'EXIT' as AttendanceType, label: 'SAÍDA', icon: <LogOut className="w-5 h-5 md:w-6 md:h-6" />, color: 'from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' };
      default:
        // Fallback case, same as no records
        return { type: 'ENTRY' as AttendanceType, label: 'ENTRADA', icon: <LogIn className="w-5 h-5 md:w-6 md:h-6" />, color: 'from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]' };
    }
  }, [todayAttendance]);

  // -- Handlers --

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingSettings) {
      setIsEditingSettings(true);
      return;
    }
    if (!currentCompanyId) return;
    if (!tenantCode.trim()) {
      showToast("Por favor, crie um código para sua empresa.", "error");
      playSound.error(); // 🔊 SOM DE ERRO
      return;
    }
    setIsSavingSettings(true);
    try {
      const docRef = doc(db, "companies", currentCompanyId);
      await updateDoc(docRef, {
        tenantCode: tenantCode.trim().toUpperCase()
      });
      setTenantCode(prev => prev.trim().toUpperCase());
      showToast("Código da empresa salvo com sucesso!", "success");
      playSound.success(); // 🔊 SOM DE SUCESSO
      setIsEditingSettings(false); 
    } catch (error) {
      console.error("Error updating settings:", error);
      showToast("Erro ao salvar configurações.", "error");
      playSound.error(); // 🔊 SOM DE ERRO
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      showToast("Geolocalização não é suportada pelo seu navegador.", "error");
      playSound.error(); // 🔊 SOM DE ERRO
      return;
    }
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setNewLocation(prev => ({
          ...prev,
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6)
        }));
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
          const data = await response.json();
          if (data && data.address) {
            const addr = data.address;
            const fullAddress = [
              (addr.road || addr.street || ''),
              (addr.house_number || ''),
              (addr.suburb || addr.neighbourhood || ''),
              (addr.city || addr.town || ''),
              (addr.state || '')
            ].filter(Boolean).join(', ');
            setNewLocation(prev => ({ ...prev, address: fullAddress || data.display_name }));
          }
          playSound.success(); // 🔊 SOM DE SUCESSO
        } catch (error) {
          console.error("Erro ao buscar endereço:", error);
        } finally {
          setIsGettingLocation(false);
        }
      },
      (error) => {
        console.error(error);
        showToast("Erro ao obter localização. Verifique as permissões.", "error");
        playSound.error(); // 🔊 SOM DE ERRO
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocation.name || !newLocation.latitude || !newLocation.longitude) {
      showToast("Nome e Coordenadas são obrigatórios.", "error");
      playSound.error(); // 🔊 SOM DE ERRO
      return;
    }
    try {
      await addDoc(collection(db, "locations"), {
        companyId: currentCompanyId,
        name: newLocation.name,
        address: newLocation.address,
        latitude: parseFloat(newLocation.latitude),
        longitude: parseFloat(newLocation.longitude),
        radius: parseInt(newLocation.radius) || 100
      });
      setNewLocation({ name: '', address: '', latitude: '', longitude: '', radius: '100' });
      playSound.success(); // 🔊 SOM DE SUCESSO
    } catch (error) {
      console.error("Error adding location: ", error);
      showToast("Erro ao salvar local.", "error");
      playSound.error(); // 🔊 SOM DE ERRO
    }
  };

  const handleDeleteLocation = async (id: string) => {
    try {
      await deleteDoc(doc(db, "locations", id));
      playSound.click(); // 🔊 SOM DE CLIQUE
    } catch (error) {
      console.error("Error deleting location:", error);
    }
  };

  // ADD or UPDATE Employee
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee.name || newEmployee.locationIds.length === 0) {
      showToast("Preencha o nome e selecione pelo menos um local.", "error");
      playSound.error(); // 🔊 SOM DE ERRO
      return;
    }
    if (isProcessingPhoto) {
      showToast("Aguarde o processamento da foto.", "info");
      return;
    }
    if (!newEmployee.photoBase64) {
      showToast("É obrigatório enviar uma foto para o reconhecimento facial.", "error");
      playSound.error(); // 🔊 SOM DE ERRO
      return;
    }
    if (!newEmployee.pin || newEmployee.pin.length < 4) {
      showToast("Defina um PIN de pelo menos 4 dígitos.", "error");
      playSound.error(); // 🔊 SOM DE ERRO
      return;
    }
    
    try {
      // Create a summary of shifts for display
      const shiftDescription = newEmployee.shifts.length > 0 
        ? newEmployee.shifts.map(s => `${s.name}: ${s.entryTime}-${s.exitTime} (Pausa: ${s.breakTime || 'N/A'}-${s.breakEndTime || 'N/A'})`).join(', ')
        : 'Sem turno definido';

      const employeeData = {
        ...newEmployee,
        shift: shiftDescription, // Legacy field for backward compatibility
        companyId: currentCompanyId
      };

      if (editingEmployeeId) {
        // UPDATE
        await updateDoc(doc(db, "employees", editingEmployeeId), employeeData);
        showToast("Funcionário atualizado com sucesso!", "success");
        setEditingEmployeeId(null);
      } else {
        // CREATE
        await addDoc(collection(db, "employees"), employeeData);
        showToast("Funcionário cadastrado com sucesso!", "success");
      }

      setNewEmployee(initialEmployeeState);
      playSound.success(); // 🔊 SOM DE SUCESSO
      // Optional: switch back to list if editing
      if (editingEmployeeId) setEmployeeSubTab('LIST');
      
    } catch (error) {
       console.error("Error saving employee: ", error);
       showToast("Erro ao salvar funcionário.", "error");
       playSound.error(); // 🔊 SOM DE ERRO
    }
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployeeId(emp.id);
    setNewEmployee({
      name: emp.name,
      cpf: emp.cpf,
      role: emp.role,
      whatsapp: emp.whatsapp,
      shifts: emp.shifts || [],
      locationIds: emp.locationIds || [],
      photoBase64: emp.photoBase64 || '',
      pin: emp.pin || ''
    });
    setEmployeeSubTab('REGISTER');
    playSound.click(); // 🔊 SOM DE CLIQUE
  };

  const handleCancelEdit = () => {
    setEditingEmployeeId(null);
    setNewEmployee(initialEmployeeState);
    playSound.click(); // 🔊 SOM DE CLIQUE
  };

  const handleDeleteEmployee = async (id: string) => {
    if (window.confirm("Tem certeza que deseja DELETAR este funcionário e TODOS os seus registros de ponto? Essa ação não pode ser desfeita.")) {
      try {
        // 1. Find all attendance records for this employee
        const attendanceRef = collection(db, "attendance");
        const q = query(attendanceRef, where("employeeId", "==", id));
        const snapshot = await getDocs(q);

        // 2. Delete all found attendance records in a batch
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          console.log(`✅ ${snapshot.size} registros de ponto excluídos para o funcionário ${id}.`);
        }

        // 3. Delete the employee document itself
        await deleteDoc(doc(db, "employees", id));
        
        showToast("Funcionário e todos os seus dados foram removidos.", "success");
        playSound.click(); // 🔊 SOM DE CLIQUE
      } catch (error) {
        console.error("Error deleting employee and their records:", error);
        showToast("Erro ao remover funcionário e seus dados.", "error");
        playSound.error(); // 🔊 SOM DE ERRO
      }
    }
  };

  const handleAddShift = () => {
    setNewEmployee(prev => ({
      ...prev,
      shifts: [
        ...prev.shifts,
        {
          id: Date.now().toString(),
          name: '',
          entryTime: '',
          breakTime: '',
          breakEndTime: '',
          exitTime: ''
        }
      ]
    }));
  };

  const handleRemoveShift = (index: number) => {
    setNewEmployee(prev => ({
      ...prev,
      shifts: prev.shifts.filter((_, i) => i !== index)
    }));
  };

  const handleShiftChange = (index: number, field: keyof Shift, value: string) => {
    setNewEmployee(prev => {
      const updatedShifts = [...prev.shifts];
      updatedShifts[index] = { ...updatedShifts[index], [field]: value };
      return { ...prev, shifts: updatedShifts };
    });
  };

  const maskCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  // -- CAMERA CAPTURE FUNCTIONS (for Employee Registration) --
  const FACE_DETECTION_INTERVAL_MS = 1000;

  const startCaptureCamera = async () => {
    setShowCameraCapture(true);
    setFaceDetected(null);
    setIsCaptureReady(false);
    setIsValidatingFace(false);
    
    console.log('📷 Iniciando câmera para cadastro facial...');
    playSound.cameraOpen(); // 🔊 SOM DE CÂMERA
    
    try {
      let mediaStream: MediaStream;
      try {
        console.log('🔍 Tentando acessar câmera frontal...');
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } 
        });
        console.log('✅ Câmera frontal acessada com sucesso');
      } catch (err) {
        console.warn("⚠️ Câmera frontal não encontrada, tentando câmera padrão...", err);
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        console.log('✅ Câmera padrão acessada com sucesso');
      }
      
      captureStreamRef.current = mediaStream;
      
      if (captureVideoRef.current) {
        captureVideoRef.current.srcObject = mediaStream;
        captureVideoRef.current.onloadedmetadata = () => {
          console.log('✅ Vídeo carregado e pronto para captura');
          setIsCaptureReady(true);
        };
      }
    } catch (err: any) {
      console.error("❌ Erro ao acessar câmera:", err);
      console.error("Tipo de erro:", err.name);
      
      let message = "Erro ao acessar câmera.";
      if (err.name === 'NotAllowedError') {
        message = "⛔ Permissão de câmera negada. Por favor, permita o acesso nas configurações do navegador.";
        console.error("💡 Dica: Clique no ícone de cadeado/câmera na barra de endereço e permita o acesso");
      } else if (err.name === 'NotFoundError') {
        message = "📷 Nenhuma câmera encontrada no dispositivo.";
        console.error("💡 Dica: Verifique se há uma câmera conectada ao dispositivo");
      } else if (err.name === 'NotReadableError') {
        message = "🔒 Câmera em uso por outro aplicativo.";
        console.error("💡 Dica: Feche outros aplicativos que possam estar usando a câmera");
      }
      
      showToast(message, "error");
      playSound.error(); // 🔊 SOM DE ERRO
      setShowCameraCapture(false);
      setIsCaptureReady(false);
    }
  };

  const stopCaptureCamera = () => {
    if (captureStreamRef.current) {
      captureStreamRef.current.getTracks().forEach(track => track.stop());
      captureStreamRef.current = null;
    }
    setShowCameraCapture(false);
    setIsCaptureReady(false);
    setFaceDetected(null);
    setIsValidatingFace(false);
  };

  const detectFaceInVideo = useCallback(async () => {
    if (!captureVideoRef.current || !modelsLoaded) return;
    
    setIsValidatingFace(true);
    try {
      const detection = await faceapi.detectSingleFace(captureVideoRef.current).withFaceLandmarks();
      const faceFound = !!detection;
      setFaceDetected(faceFound);
      
      if (faceFound && detection) {
        console.log('✅ Rosto detectado no preview (confiança:', detection.detection.score.toFixed(3), ')');
      }
    } catch (err) {
      console.error("❌ Erro na detecção de face:", err);
      setFaceDetected(false);
    } finally {
      setIsValidatingFace(false);
    }
  }, [modelsLoaded]);

  // Auto-detect face while camera is active
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (showCameraCapture && isCaptureReady && modelsLoaded) {
      interval = setInterval(detectFaceInVideo, FACE_DETECTION_INTERVAL_MS);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showCameraCapture, isCaptureReady, modelsLoaded, detectFaceInVideo]);

  // Cleanup camera when switching tabs
  useEffect(() => {
    if (activeTab !== 'EMPLOYEES' || employeeSubTab !== 'REGISTER') {
      if (captureStreamRef.current) {
        captureStreamRef.current.getTracks().forEach(track => track.stop());
        captureStreamRef.current = null;
      }
      setShowCameraCapture(false);
      setIsCaptureReady(false);
      setFaceDetected(null);
      setIsValidatingFace(false);
    }
  }, [activeTab, employeeSubTab]);

  const capturePhotoFromCamera = async () => {
    if (!captureVideoRef.current || !captureCanvasRef.current) return;
    
    setIsProcessingPhoto(true);
    console.log('📸 Iniciando captura de foto...');
    
    try {
      const video = captureVideoRef.current;
      const canvas = captureCanvasRef.current;
      
      // Set canvas size to match video
      const MAX_SIZE = 300;
      let width = video.videoWidth;
      let height = video.videoHeight;
      
      console.log(`📐 Dimensões originais do vídeo: ${width}x${height}`);
      
      if (width > height) {
        if (width > MAX_SIZE) {
          height = Math.round(height * MAX_SIZE / width);
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width = Math.round(width * MAX_SIZE / height);
          height = MAX_SIZE;
        }
      }
      
      console.log(`📐 Dimensões redimensionadas: ${width}x${height}`);
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw image without flipping (natural orientation)
        ctx.drawImage(video, 0, 0, width, height);
      }
      
      console.log('🔍 Validando rosto na imagem capturada...');
      
      // Validate face in captured image
      const detection = await faceapi.detectSingleFace(canvas).withFaceLandmarks().withFaceDescriptor();
      
      if (!detection) {
        console.warn('⚠️ Nenhum rosto detectado na foto capturada');
        showToast("Nenhum rosto detectado na foto. Posicione seu rosto corretamente e tente novamente.", "error");
        playSound.error(); // 🔊 SOM DE ERRO
        setIsProcessingPhoto(false);
        return;
      }
      
      console.log('✅ Rosto detectado com sucesso!');
      console.log('📊 Confiança da detecção:', detection.detection.score);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setNewEmployee(prev => ({ ...prev, photoBase64: dataUrl }));
      
      console.log('💾 Foto salva no estado do funcionário');
      playSound.success(); // 🔊 SOM DE SUCESSO
      
      // Stop camera after successful capture
      stopCaptureCamera();
      
    } catch (error) {
      console.error('❌ Erro ao capturar foto:', error);
      showToast('Erro ao capturar a foto. Tente novamente.', "error");
      playSound.error(); // 🔊 SOM DE ERRO
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  // Cleanup camera on unmount or when leaving employee tab
  useEffect(() => {
    return () => {
      if (captureStreamRef.current) {
        captureStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // -- BIOMETRIC LOGIC --

  const startCamera = () => {
    setCameraActive(true);
  };

  const stopCamera = () => {
    setCameraActive(false);
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpfForLogin || !pinForLogin) {
      showToast("CPF e PIN são obrigatórios.", "error");
      playSound.error(); // 🔊 SOM DE ERRO
      return;
    }
    
    setIsScanning(true);
    try {
      // Find employee by CPF
      const found = employees.find(e => e.cpf === cpfForLogin);

      if (!found) throw new Error("CPF não encontrado.");

      if (found.pin === pinForLogin) {
         setIdentifiedEmployee(found);
         setIsBiometricVerified(true);
         playSound.success(); // 🔊 SOM DE SUCESSO
         stopCamera(); // Parar câmera ao logar com PIN
      } else {
         showToast("PIN incorreto.", "error");
         playSound.error(); // 🔊 SOM DE ERRO
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Erro ao validar PIN.", "error");
      playSound.error(); // 🔊 SOM DE ERRO
    } finally {
      setIsScanning(false);
    }
  };

  // Helper to load image for Face API
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = reject;
    });
  };

  const identifyEmployee = async () => {
    if (!videoRef.current || !canvasRef.current || !employeeContext) return;
    
    if (!modelsLoaded) {
      showToast("Aguarde os modelos de reconhecimento carregarem.", "info");
      return;
    }

    setIsScanning(true);
    setScanMessage('Processando imagem...');
    console.log('🔐 Iniciando identificação facial...');

    try {
      // 1. Detect face in video
      const videoEl = videoRef.current;
      console.log('🔍 Detectando rosto no vídeo...');
      const detection = await faceapi.detectSingleFace(videoEl).withFaceLandmarks().withFaceDescriptor();

      if (!detection) {
        console.warn('⚠️ Nenhum rosto detectado no vídeo');
        setScanMessage('Nenhum rosto detectado. Ajuste a posição.');
        setIsScanning(false);
        return;
      }

      console.log('✅ Rosto detectado no vídeo');
      console.log('📊 Confiança da detecção:', detection.detection.score);

      // 2. Get Candidates for THIS company (all employees with photo)
      const candidates = employees.filter(e => e.photoBase64);

      console.log(`👥 Encontrados ${candidates.length} funcionários cadastrados`);

      if (candidates.length === 0) {
        throw new Error("Nenhum funcionário com foto cadastrado.");
      }

      // 3. Match against candidates
      setScanMessage('Comparando biométrias...');
      console.log('🔄 Comparando com funcionários cadastrados...');
      
      // Threshold ajustado: 0.55 para melhor precisão (quanto menor, mais restritivo)
      const RECOGNITION_THRESHOLD = 0.55;
      let bestMatch: { distance: number; employee: Employee | null } = { distance: RECOGNITION_THRESHOLD, employee: null };

      for (const candidate of candidates) {
        if (!candidate.photoBase64) continue;
        
        try {
          console.log(`🔍 Comparando com: ${candidate.name}`);
          const img = await loadImage(candidate.photoBase64);
          const candidateDetection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
          
          if (candidateDetection) {
            const distance = faceapi.euclideanDistance(detection.descriptor, candidateDetection.descriptor);
            console.log(`📏 Distância euclidiana para ${candidate.name}: ${distance.toFixed(4)}`);
            
            if (distance < bestMatch.distance) {
              console.log(`✨ Novo melhor match encontrado: ${candidate.name} (distância: ${distance.toFixed(4)})`);
              bestMatch = { distance, employee: candidate };
            }
          } else {
            console.warn(`⚠️ Não foi possível detectar rosto na foto de ${candidate.name}`);
          }
        } catch (e) {
          console.warn(`⚠️ Erro ao processar candidato ${candidate.name}:`, e);
        }
      }

      if (bestMatch.employee) {
        console.log(`🎉 Funcionário identificado: ${bestMatch.employee.name}`);
        console.log(`📊 Distância final: ${bestMatch.distance.toFixed(4)} (threshold: ${RECOGNITION_THRESHOLD})`);
        setIdentifiedEmployee(bestMatch.employee);
        setIsBiometricVerified(true);
        setScanMessage('Identificação bem-sucedida!');
        playSound.success(); // 🔊 SOM DE SUCESSO
        stopCamera(); // Parar câmera ao identificar com sucesso
        
        // NÃO registrar automaticamente - deixar o usuário confirmar no modal
        console.log('✅ Identificação concluída. Aguardando confirmação do usuário para registrar ponto.');
      } else {
        console.warn('❌ Nenhum funcionário reconhecido (distância acima do threshold)');
        setScanMessage('Rosto não reconhecido. Tente novamente.');
      }

    } catch (err: any) {
      console.error('❌ Erro na identificação:', err);
      showToast(err.message || "Erro na identificação.", "error");
      setScanMessage('Erro. Tente novamente.');
    } finally {
      setIsScanning(false);
    }
  };

  // -- Attendance (Registro de Ponto) Functions --

  // Helper to calculate punctuality score
  const calculatePunctualityScore = (type: AttendanceType, timestamp: Date, shift: Shift | null): { score: number, status: 'PERFECT' | 'GOOD' | 'LATE' | 'NEUTRAL', message: string, color: string } => {
    // Default values
    let score = 0;
    let status: 'PERFECT' | 'GOOD' | 'LATE' | 'NEUTRAL' = 'NEUTRAL';
    let message = '';
    let color = 'text-slate-400';

    if (!shift) return { score, status, message, color };

    const timeToMinutes = (timeStr: string | undefined): number | null => {
      if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return null;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const nowInMinutes = timestamp.getHours() * 60 + timestamp.getMinutes();
    const entryInMinutes = timeToMinutes(shift.entryTime);
    const exitInMinutes = timeToMinutes(shift.exitTime);

    if (entryInMinutes === null || exitInMinutes === null) return { score, status, message, color };
    
    const isOvernight = entryInMinutes > exitInMinutes;
    let targetTimeInMinutes: number | null = null;
    let isEntry = false;

    // Determine target time based on attendance type
    if (type === 'ENTRY') {
      targetTimeInMinutes = entryInMinutes;
      isEntry = true;
    } else if (type === 'EXIT') {
      targetTimeInMinutes = exitInMinutes;
      isEntry = false;
    } else if (type === 'BREAK_START') {
      targetTimeInMinutes = timeToMinutes(shift.breakTime);
      isEntry = true; // Logic is same as entry (lateness)
    } else if (type === 'BREAK_END') {
      targetTimeInMinutes = timeToMinutes(shift.breakEndTime);
      isEntry = true; // Logic is same as entry (lateness for return)
    }

    if (targetTimeInMinutes === null) {
      return { score, status, message, color };
    }

    let effectiveNow = nowInMinutes;
    let effectiveTarget = targetTimeInMinutes;

    // Adjust for overnight shifts by moving times to a linear 48-hour scale
    if (isOvernight) {
      // If target time is on the next day (e.g., exit at 06:00), add 24h
      if (effectiveTarget < entryInMinutes) {
        effectiveTarget += 1440; // 24 * 60
      }
      // If current time is on the next day, add 24h
      if (effectiveNow < entryInMinutes) {
        effectiveNow += 1440;
      }
    }

    const diff = effectiveNow - effectiveTarget;
    
    if (isEntry) {
      if (diff <= 0) { // On Time or Early
        score = 100;
        status = 'PERFECT';
        message = diff < -5 ? `Adiantado ${Math.abs(diff)}min` : 'Pontual';
        color = 'text-green-400';
      } else if (diff <= 10) { // Grace period for being late
        score = 80;
        status = 'GOOD';
        message = `Atraso ${diff}min (Tolerância)`;
        color = 'text-yellow-400';
      } else { // Late
        score = 10;
        status = 'LATE';
        message = `Atrasado ${diff}min`;
        color = 'text-red-400';
      }
    } else { // Exit
      if (diff >= 0) { // On Time or Overtime
        score = 100;
        status = 'PERFECT';
        message = diff > 0 ? `Hora Extra +${diff}min` : 'Pontual';
        color = 'text-green-400';
      } else if (diff >= -10) { // Grace period for leaving early
        score = 80;
        status = 'GOOD';
        message = `Saída ${Math.abs(diff)}min antes`;
        color = 'text-yellow-400';
      } else { // Left too early
        score = 10;
        status = 'LATE';
        message = `Saída Antecipada ${Math.abs(diff)}min`;
        color = 'text-red-400';
      }
    }

    return { score, status, message, color };
  };

  const startAttendanceFlow = async (type: AttendanceType) => {
    if (!employeeContext || !identifiedEmployee) return;

    if (!currentLocation) {
        showToast("Por favor, selecione seu local de trabalho antes de registrar o ponto.", "error");
        return;
    }

    if (!currentShift) {
        showToast("Por favor, selecione seu turno de trabalho.", "error");
        return;
    }

    console.log(`⏰ Iniciando registro de ponto: ${type}`);
    setAttendanceType(type);
    setShowAttendanceFlow(true);
    setLocationVerified(false);
    setIsCheckingLocation(true);
    setIsIdentityConfirmed(false); // Reset identity confirmation

    try {
      // Step 1: Verificar localização
      console.log('📍 Verificando localização do funcionário...');
      const position = await getCurrentPosition();
      setCurrentPosition(position);

      const withinRadius = isWithinRadius(
        position.latitude,
        position.longitude,
        currentLocation.latitude,
        currentLocation.longitude,
        currentLocation.radius
      );

      if (!withinRadius) {
        console.warn('⚠️ Funcionário fora do raio permitido');
        showToast(`❌ Você não está no local de trabalho.\n\nVocê precisa estar dentro de um raio de ${currentLocation.radius}m do local para registrar o ponto.`, "error");
        playSound.error(); // 🔊 SOM DE ERRO
        setShowAttendanceFlow(false);
        setIsCheckingLocation(false);
        return;
      }

      console.log('✅ Funcionário dentro do raio permitido');
      setLocationVerified(true);
      setIsCheckingLocation(false);

      // Step 2: Abrir câmera para reconhecimento facial
      console.log('📷 Abrindo câmera para reconhecimento facial...');
      
      // Forçar reinício da câmera se já estiver ativa (para garantir que o vídeo apareça no modal)
      if (cameraActive) {
          console.log('🔄 Reiniciando câmera para garantir visualização...');
          setCameraActive(false);
          setTimeout(() => setCameraActive(true), 200);
      } else {
          setCameraActive(true);
      }

    } catch (error: any) {
      console.error('❌ Erro ao verificar localização:', error);
      showToast(error.message || 'Erro ao verificar localização. Tente novamente.', "error");
      playSound.error(); // 🔊 SOM DE ERRO
      setShowAttendanceFlow(false);
      setIsCheckingLocation(false);
    }
  };

  const registerAttendance = async () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 INICIANDO PROCESSO DE REGISTRO DE PONTO');
    console.log('═══════════════════════════════════════════════════════');
    
    // ETAPA 1: VALIDAÇÃO DE DADOS OBRIGATÓRIOS
    console.log('📋 ETAPA 1: Validando dados obrigatórios...');
    console.log('📊 Estado atual completo:', {
      attendanceType,
      identifiedEmployee: identifiedEmployee ? {
        id: identifiedEmployee.id,
        name: identifiedEmployee.name,
        role: identifiedEmployee.role
      } : null,
      employeeContext: employeeContext ? {
        companyId: employeeContext.companyId,
        companyName: employeeContext.companyName,
        locationId: employeeContext.locationId,
        locationName: employeeContext.locationName
      } : null,
      currentPosition,
      currentLocation: currentLocation ? {
        id: currentLocation.id,
        name: currentLocation.name,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        radius: currentLocation.radius
      } : null,
      timestamp: new Date().toISOString()
    });

    // Validações individuais com logs específicos
    if (!attendanceType) {
      console.error('❌ ERRO DE VALIDAÇÃO: Tipo de ponto não definido');
      showToast('❌ Erro: Tipo de ponto não definido. Tente novamente.', "error");
      playSound.error(); // 🔊 SOM DE ERRO
      return;
    }
    console.log('✅ Tipo de ponto validado:', attendanceType);

    if (!identifiedEmployee) {
      console.error('❌ ERRO DE VALIDAÇÃO: Funcionário não identificado');
      showToast('❌ Erro: Funcionário não identificado. Faça a identificação facial primeiro.', "error");
      playSound.error(); // 🔊 SOM DE ERRO
      return;
    }
    console.log('✅ Funcionário validado:', identifiedEmployee.name, '(ID:', identifiedEmployee.id, ')');

    if (!employeeContext) {
      console.error('❌ ERRO DE VALIDAÇÃO: Contexto do funcionário não encontrado');
      showToast('❌ Erro: Contexto do funcionário não encontrado.', "error");
      playSound.error(); // 🔊 SOM DE ERRO
      return;
    }
    console.log('✅ Contexto validado - Empresa:', employeeContext.companyName, '| Local:', employeeContext.locationName);

    if (!currentPosition) {
      console.error('❌ ERRO DE VALIDAÇÃO: Posição atual não obtida');
      showToast('❌ Erro: Não foi possível obter sua localização.', "error");
      playSound.error(); // 🔊 SOM DE ERRO
      return;
    }
    console.log('✅ Posição validada - Lat:', currentPosition.latitude, '| Lng:', currentPosition.longitude);

    if (!currentLocation) {
      console.error('❌ ERRO DE VALIDAÇÃO: Local de trabalho não carregado');
      showToast('❌ Erro: Local de trabalho não carregado.', "error");
      playSound.error(); // 🔊 SOM DE ERRO
      return;
    }
    console.log('✅ Local de trabalho validado:', currentLocation.name);

    console.log('✅ TODAS AS VALIDAÇÕES PASSARAM!');
    console.log('───────────────────────────────────────────────────────');

    setIsRegisteringAttendance(true);
    console.log(`💾 ETAPA 2: Iniciando registro de ponto do tipo: ${attendanceType}`);

    try {
      // ETAPA 3: CAPTURA DE FOTO DO VÍDEO
      console.log('📸 ETAPA 3: Capturando foto do vídeo...');
      let photoBase64 = '';
      
      if (videoRef.current && canvasRef.current) {
        console.log('📹 Referências de vídeo e canvas encontradas');
        const canvas = canvasRef.current;
        const video = videoRef.current;
        
        console.log('📐 Dimensões do vídeo:', {
          width: video.videoWidth,
          height: video.videoHeight,
          readyState: video.readyState
        });
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          photoBase64 = canvas.toDataURL('image/jpeg', 0.7);
          console.log('✅ Foto capturada com sucesso (tamanho:', photoBase64.length, 'caracteres)');
        } else {
          console.warn('⚠️ Não foi possível obter contexto 2D do canvas');
        }
      } else {
        console.warn('⚠️ Referências de vídeo ou canvas não disponíveis');
        console.log('   videoRef.current:', !!videoRef.current);
        console.log('   canvasRef.current:', !!canvasRef.current);
      }

      // ETAPA 4: CÁLCULO DE DISTÂNCIA
      console.log('📏 ETAPA 4: Calculando distância até o local de trabalho...');
      const distanceToLocation = calculateDistance(
        currentPosition.latitude,
        currentPosition.longitude,
        currentLocation.latitude,
        currentLocation.longitude
      );
      console.log(`✅ Distância calculada: ${distanceToLocation.toFixed(2)}m do local de trabalho`);

      // ETAPA 5: PREPARAÇÃO DOS DADOS
      console.log('📦 ETAPA 5: Preparando dados para salvamento...');
      const now = new Date();
      
      // Calculate Gamification Score
      const { score, status, message: scoreMessage } = calculatePunctualityScore(attendanceType, now, currentShift);
      console.log(`🎮 Gamification: Score=${score}, Status=${status}, Msg=${scoreMessage}`);

      const attendanceData: Omit<AttendanceRecord, 'id'> = {
        employeeId: identifiedEmployee.id,
        employeeName: identifiedEmployee.name,
        companyId: employeeContext.companyId,
        locationId: currentLocation.id,
        locationName: currentLocation.name,
        timestamp: now,
        type: attendanceType,
        latitude: currentPosition.latitude,
        longitude: currentPosition.longitude,
        photoBase64: photoBase64,
        verified: true,
        distance: distanceToLocation,
        score: score,
        punctualityStatus: status,
        punctualityMessage: scoreMessage
      };

      console.log('📋 Estrutura do documento a ser salvo:');
      console.log('   - employeeId:', attendanceData.employeeId);
      console.log('   - employeeName:', attendanceData.employeeName);
      console.log('   - companyId:', attendanceData.companyId);
      console.log('   - locationId:', attendanceData.locationId);
      console.log('   - locationName:', attendanceData.locationName);
      console.log('   - timestamp:', attendanceData.timestamp.toISOString());
      console.log('   - type:', attendanceData.type);
      console.log('   - latitude:', attendanceData.latitude);
      console.log('   - longitude:', attendanceData.longitude);
      console.log('   - photoBase64: [', photoBase64.length, 'caracteres ]');
      console.log('   - verified:', attendanceData.verified);
      console.log('   - distance:', attendanceData.distance);
      console.log('   - score:', attendanceData.score);
      console.log('   - punctualityStatus:', attendanceData.punctualityStatus);
      console.log('   - punctualityMessage:', attendanceData.punctualityMessage);

      // ETAPA 6: SALVAMENTO NO FIRESTORE
      console.log('───────────────────────────────────────────────────────');
      console.log('💾 ETAPA 6: SALVANDO NO FIRESTORE...');
      console.log('🔗 Collection: "attendance"');
      console.log('🗄️ Database:', db ? 'Conectado' : 'NÃO CONECTADO');
      
      if (!db) {
        throw new Error('Firebase Database não está inicializado!');
      }

      const firestoreData = {
        ...attendanceData,
        timestamp: Timestamp.fromDate(attendanceData.timestamp)
      };

      console.log('📤 Enviando dados para o Firestore...');
      console.log('⏰ Timestamp convertido:', firestoreData.timestamp);
      
      const docRef = await addDoc(collection(db, "attendance"), firestoreData);

      console.log('═══════════════════════════════════════════════════════');
      console.log('✅✅✅ PONTO REGISTRADO COM SUCESSO! ✅✅✅');
      console.log('═══════════════════════════════════════════════════════');
      console.log('🆔 ID do documento criado:', docRef.id);
      console.log('📍 Path completo: attendance/' + docRef.id);
      console.log('⏰ Horário do registro:', now.toLocaleString('pt-BR'));
      console.log('👤 Funcionário:', attendanceData.employeeName);
      console.log('📌 Tipo:', attendanceData.type);
      console.log('═══════════════════════════════════════════════════════');
      
      // ETAPA 7: VERIFICAÇÃO MANUAL - Confirmar que o documento foi salvo
      console.log('───────────────────────────────────────────────────────');
      console.log('🔍 ETAPA 7: VERIFICAÇÃO MANUAL DO DOCUMENTO SALVO...');
      try {
        const savedDoc = await getDoc(doc(db, "attendance", docRef.id));
        if (savedDoc.exists()) {
          console.log('✅ CONFIRMADO: Documento existe no Firestore!');
          console.log('📄 Dados salvos:', savedDoc.data());
        } else {
          console.error('❌ ERRO CRÍTICO: Documento NÃO foi encontrado após salvamento!');
          throw new Error('Documento não encontrado após salvamento');
        }
      } catch (verifyError) {
        console.error('❌ Erro ao verificar documento:', verifyError);
      }
      console.log('───────────────────────────────────────────────────────');
      
      // ETAPA 8: REFRESH MANUAL FORÇADO - Atualizar o histórico imediatamente
      console.log('🔄 ETAPA 8: REFRESH MANUAL DO HISTÓRICO...');
      try {
        const attendanceRef = collection(db, "attendance");
        const qRefresh = query(
          attendanceRef,
          where("employeeId", "==", identifiedEmployee.id),
          orderBy("timestamp", "desc"),
          limit(10)
        );
        
        console.log('📥 Buscando registros atualizados do Firestore...');
        const refreshSnapshot = await getDocs(qRefresh);
        
        console.log('📊 Registros encontrados na busca manual:', refreshSnapshot.docs.length);
        
        const refreshedRecords: AttendanceRecord[] = refreshSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date()
          } as AttendanceRecord;
        });
        
        setAttendanceRecords(refreshedRecords);
        console.log('✅ Histórico atualizado manualmente com', refreshedRecords.length, 'registros');
        
        // Log dos registros atualizados
        refreshedRecords.forEach((record, index) => {
          console.log(`   ${index + 1}. ${record.type} - ${record.timestamp.toLocaleString('pt-BR')}`);
        });
        
      } catch (refreshError) {
        console.error('❌ Erro ao fazer refresh manual:', refreshError);
      }
      console.log('───────────────────────────────────────────────────────');
      
      // Feedback visual detalhado (agora via Toast)
      const typeLabels = {
        ENTRY: 'Entrada',
        BREAK_START: 'Início da Pausa',
        BREAK_END: 'Fim da Pausa',
        EXIT: 'Saída'
      };

      let toastMsg = `Ponto registrado: ${typeLabels[attendanceType]} - ${now.toLocaleTimeString('pt-BR')}`;
      if (scoreMessage) {
        toastMsg += `\n${scoreMessage}`;
      }

      showToast(toastMsg, 'success');
      playSound.attendance(); // 🔊 SOM DE PONTO REGISTRADO

      // Limpar estados do fluxo de registro
      console.log('🧹 Limpando estados do fluxo de registro...');
      setShowAttendanceFlow(false);
      setAttendanceType(null);
      setLocationVerified(false);
      setCurrentPosition(null);
      setScanMessage('');
      stopCamera();
      console.log('✅ Estados limpos com sucesso');
      
      // NÃO resetar isBiometricVerified nem identifiedEmployee - o usuário continua logado
      console.log('👤 Usuário permanece autenticado');

    } catch (error: any) {
      console.log('═══════════════════════════════════════════════════════');
      console.error('❌❌❌ ERRO AO REGISTRAR PONTO ❌❌❌');
      console.log('═══════════════════════════════════════════════════════');
      console.error('🔴 Tipo do erro:', error?.name || 'Desconhecido');
      console.error('🔴 Mensagem:', error?.message || 'Sem mensagem');
      console.error('🔴 Código:', error?.code || 'Sem código');
      console.error('🔴 Stack trace:', error?.stack || 'Sem stack');
      console.error('🔴 Objeto completo do erro:', error);
      console.log('═══════════════════════════════════════════════════════');
      
      // Mensagem de erro específica baseada no tipo
      let errorMessage = '❌ Erro ao registrar ponto.\n\n';
      
      if (error?.code === 'permission-denied') {
        errorMessage += '🔒 ERRO DE PERMISSÃO:\n' +
                       'O Firestore está bloqueando a escrita.\n\n' +
                       'Verifique as regras de segurança no Firebase Console.\n\n' +
                       'Detalhes técnicos:\n' + error.message;
        console.error('💡 SOLUÇÃO: Configure as regras do Firestore para permitir escrita na collection "attendance"');
      } else if (error?.code === 'unavailable') {
        errorMessage += '🌐 ERRO DE CONEXÃO:\n' +
                       'Não foi possível conectar ao Firestore.\n\n' +
                       'Verifique sua conexão com a internet.\n\n' +
                       'Detalhes: ' + error.message;
      } else if (error?.message?.includes('Firebase')) {
        errorMessage += '🔥 ERRO DO FIREBASE:\n' + error.message;
      } else {
        errorMessage += 'Detalhes: ' + (error?.message || 'Erro desconhecido');
      }
      
      showToast(errorMessage, "error");
      playSound.error(); // 🔊 SOM DE ERRO
      
      console.log('📊 Estado do sistema no momento do erro:');
      console.log('   - Firebase DB conectado:', !!db);
      console.log('   - Funcionário ID:', identifiedEmployee?.id);
      console.log('   - Company ID:', employeeContext?.companyId);
      console.log('   - Location ID:', employeeContext?.locationId);
      console.log('   - Attendance Type:', attendanceType);
      
    } finally {
      console.log('🏁 Finalizando processo de registro...');
      setIsRegisteringAttendance(false);
      console.log('✅ Flag isRegisteringAttendance resetada');
      console.log('═══════════════════════════════════════════════════════');
    }
  };

  const cancelAttendanceFlow = () => {
    console.log('❌ Fluxo de registro de ponto cancelado');
    setShowAttendanceFlow(false);
    setAttendanceType(null);
    setLocationVerified(false);
    setCurrentPosition(null);
    setIsCheckingLocation(false);
    setScanMessage('');
    stopCamera();
    playSound.click(); // 🔊 SOM DE CLIQUE
    // NÃO resetar isBiometricVerified nem identifiedEmployee - o usuário continua logado
  };

  // 🔥 NOVO: Função de validação contínua para habilitar botão
  const verifyIdentityForAttendance = async () => {
    if (!videoRef.current || !canvasRef.current || !identifiedEmployee || !modelsLoaded) return;
    
    // Não setar isScanning aqui para não piscar UI, usar apenas para feedback de mensagem se necessário
    
    try {
      const videoEl = videoRef.current;
      
      const detection = await faceapi.detectSingleFace(videoEl).withFaceLandmarks().withFaceDescriptor();

      if (!detection) {
        setScanMessage('👤 Posicione seu rosto...');
        setIsIdentityConfirmed(false);
        return;
      }

      if (!identifiedEmployee.photoBase64) {
         setScanMessage('❌ Erro: Foto de referência ausente');
         return;
      }

      const img = await loadImage(identifiedEmployee.photoBase64);
      const referenceDetection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

      if (!referenceDetection) {
         // Se não conseguir ler a foto de referência, não dá pra validar
         return;
      }

      const distance = faceapi.euclideanDistance(detection.descriptor, referenceDetection.descriptor);
      const SECURITY_THRESHOLD = 0.55;

      if (distance > SECURITY_THRESHOLD) {
        setScanMessage('⚠️ Rosto não corresponde');
        setIsIdentityConfirmed(false);
      } else {
        setScanMessage('✅ Identidade Confirmada');
        setIsIdentityConfirmed(true);
      }

    } catch (err) {
      console.error(err);
      setIsIdentityConfirmed(false);
    }
  };

  // 🔥 NOVO: Função de reconhecimento e registro automático
  const autoRecognizeAndRegister = async () => {
    if (!videoRef.current || !canvasRef.current || !identifiedEmployee || !modelsLoaded) return;
    
    setIsScanning(true);
    setScanMessage('🔍 Verificando identidade...');

    try {
      // 1. Detectar rosto no vídeo
      const videoEl = videoRef.current;
      const detection = await faceapi.detectSingleFace(videoEl)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setScanMessage('👤 Posicione seu rosto...');
        setIsScanning(false);
        return;
      }

      // 2. Comparar com foto do funcionário logado (SEGURANÇA)
      const img = await loadImage(identifiedEmployee.photoBase64 || '');
      const referenceDetection = await faceapi.detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!referenceDetection) {
         console.error('Erro ao processar foto de referência');
         setIsScanning(false);
         return;
      }

      // 3. Calcular similaridade
      const distance = faceapi.euclideanDistance(
        detection.descriptor, 
        referenceDetection.descriptor
      );
      const SECURITY_THRESHOLD = 0.55;

      console.log(`📊 Distância euclidiana: ${distance.toFixed(4)} (threshold: ${SECURITY_THRESHOLD})`);

      if (distance > SECURITY_THRESHOLD) {
        // ❌ NÃO é a mesma pessoa
        setScanMessage('⚠️ Rosto não corresponde');
        // Opcional: alertar usuário
        showToast('❌ ERRO DE SEGURANÇA: O rosto detectado não corresponde ao funcionário logado.', "error");
        playSound.error(); // 🔊 SOM DE ERRO
        setIsScanning(false);
        return;
      }

      // ✅ É a mesma pessoa - Registrar ponto
      setScanMessage('✅ Identidade confirmada! Registrando...');
      setIsIdentityConfirmed(true);
      
      // Pequeno delay para feedback visual antes de registrar
      setTimeout(async () => {
        await registerAttendance();
        setIsScanning(false);
      }, 500);

    } catch (err) {
      console.error('❌ Erro no reconhecimento automático:', err);
      setIsScanning(false);
    }
  };


  // -- Render Helpers --

  const renderSidebarItem = (tab: Tab, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => { setActiveTab(tab); playSound.click(); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 font-mono text-sm uppercase tracking-wider ${
        activeTab === tab 
          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]' 
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  // -- RENDER: ADMIN DASHBOARD --
  if (isCompany) {
    return (
      <div className="relative min-h-screen flex">
        <TechBackground />
        
        <aside className="relative z-30 w-64 hidden md:flex flex-col border-r border-slate-800 bg-slate-950/80 backdrop-blur-md">
          <div className="p-6 border-b border-slate-800">
            <h2 className="font-tech text-xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-white font-bold truncate">
              {companyName.toUpperCase()}
            </h2>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 font-mono">
              <Lock className="w-3 h-3" /> TENANT ACCESS
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {renderSidebarItem('OVERVIEW', 'Visão Geral', <LayoutDashboard className="w-4 h-4" />)}
            {renderSidebarItem('LOCATIONS', 'Geolocalização', <Globe className="w-4 h-4" />)}
            {renderSidebarItem('EMPLOYEES', 'Funcionários', <Users className="w-4 h-4" />)}
            {renderSidebarItem('SETTINGS', 'Configurações', <Settings className="w-4 h-4" />)}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <button onClick={onBack} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-mono uppercase">
              <ArrowLeft className="w-4 h-4" /> Desconectar
            </button>
          </div>
        </aside>

        <main className="relative z-30 flex-1 h-screen overflow-y-auto overflow-x-hidden">
          {/* Mobile Header */}
          <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
             <h2 className="font-tech text-lg text-white truncate">{companyName.toUpperCase()}</h2>
             <button onClick={onBack} className="text-slate-400"><ArrowLeft /></button>
          </div>

          {/* Mobile Nav */}
          <div className="md:hidden flex overflow-x-auto p-2 gap-2 bg-slate-900 border-b border-slate-800">
            {/* ... tabs ... */}
            <button onClick={() => setActiveTab('OVERVIEW')} className={`px-4 py-2 rounded text-xs ${activeTab === 'OVERVIEW' ? 'bg-cyan-600' : 'text-slate-400'}`}>Visão</button>
            <button onClick={() => setActiveTab('LOCATIONS')} className={`px-4 py-2 rounded text-xs ${activeTab === 'LOCATIONS' ? 'bg-cyan-600' : 'text-slate-400'}`}>Locais</button>
            <button onClick={() => setActiveTab('EMPLOYEES')} className={`px-4 py-2 rounded text-xs ${activeTab === 'EMPLOYEES' ? 'bg-cyan-600' : 'text-slate-400'}`}>Func.</button>
            <button onClick={() => setActiveTab('SETTINGS')} className={`px-4 py-2 rounded text-xs ${activeTab === 'SETTINGS' ? 'bg-cyan-600' : 'text-slate-400'}`}>Config</button>
          </div>

          <div className="p-6 md:p-12 max-w-6xl mx-auto">
            {/* RENDER CONTENT BASED ON TAB */}
            {activeTab === 'OVERVIEW' && (
              <div className="space-y-8">
                 <div className="flex items-center justify-between">
                    <h3 className="font-tech text-2xl text-white">Detalhamento Geral</h3>
                    <div className="px-4 py-1 rounded-full bg-cyan-900/30 border border-cyan-500/30 text-cyan-400 text-xs font-mono">TOTAL: {employees.length}</div>
                 </div>
                 {/* Existing Roster Logic ... */}
                 {locations.map(loc => {
                    const locEmployees = employees.filter(e => e.locationIds?.includes(loc.id));
                    if (locEmployees.length === 0) return null;
                    return (
                      <div key={loc.id} className="border border-slate-700/50 rounded-xl overflow-hidden bg-slate-900/50">
                        <div className="p-4 border-b border-slate-700 flex justify-between">
                          <h4 className="font-bold text-white">{loc.name}</h4>
                          <span className="text-xs text-slate-400">{locEmployees.length} Colaboradores</span>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                           {locEmployees.map(emp => (
                            <div key={emp.id} className="flex flex-col gap-3 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden border border-slate-600 shrink-0">
                                  {emp.photoBase64 ? (
                                    <img src={emp.photoBase64} alt={emp.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-6 h-6 m-2 text-slate-500" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-sm text-white truncate">{emp.name}</div>
                                  <div className="text-xs text-cyan-500 truncate">{emp.role}</div>
                                </div>
                              </div>
                              {!emp.photoBase64 && (
                                <div className="border-t border-slate-700/50 pt-2 mt-2">
                                  <button
                                    onClick={() => handleGenerateLink(emp.id)}
                                    className="w-full bg-amber-600/20 border border-amber-500/30 text-amber-300 text-xs font-bold py-2 px-2 rounded-lg hover:bg-amber-600/40 transition-colors flex items-center justify-center gap-2"
                                  >
                                    <Share2 className="w-3 h-3" />
                                    Gerar Link Facial
                                  </button>
                                </div>
                              )}
                            </div>
                           ))}
                        </div>
                      </div>
                    );
                 })}
              </div>
            )}

            {activeTab === 'LOCATIONS' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-slate-900/40 border border-slate-700 rounded-xl p-6 h-fit">
                  <h3 className="font-tech text-lg text-white mb-4 flex items-center gap-2"><Globe className="text-cyan-400 w-5 h-5" /> Novo Ponto</h3>
                  <form onSubmit={handleAddLocation} className="space-y-4">
                    <TechInput label="Nome" value={newLocation.name} onChange={e => setNewLocation({...newLocation, name: e.target.value})} required />
                    <textarea value={newLocation.address} onChange={e => setNewLocation({...newLocation, address: e.target.value})} className="w-full bg-slate-950/50 border border-slate-700 text-white text-sm rounded-lg p-3 min-h-[80px]" placeholder={isGettingLocation ? "Buscando..." : "Endereço"} readOnly={isGettingLocation} />
                    <button type="button" onClick={handleGetLocation} className="text-xs flex items-center gap-1 bg-cyan-900/50 text-cyan-200 px-2 py-1 rounded border border-cyan-700">{isGettingLocation ? <Loader2 className="w-3 h-3 animate-spin"/> : "Pegar Local"}</button>
                    <div className="grid grid-cols-2 gap-2">
                       <TechInput label="Lat" value={newLocation.latitude} onChange={e => setNewLocation({...newLocation, latitude: e.target.value})} />
                       <TechInput label="Lng" value={newLocation.longitude} onChange={e => setNewLocation({...newLocation, longitude: e.target.value})} />
                    </div>
                    <TechInput label="Raio (m)" value={newLocation.radius} onChange={e => setNewLocation({...newLocation, radius: e.target.value})} />
                    <button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded-lg font-bold text-sm">SALVAR</button>
                  </form>
                </div>
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="font-tech text-white">Locais Ativos</h3>
                  {locations.map(loc => (
                    <div key={loc.id} className="bg-slate-950/40 border border-slate-800 p-4 rounded-lg flex justify-between items-center group relative overflow-hidden">
                       <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500"></div>
                       <div className="pl-3">
                         <div className="font-bold text-white">{loc.name}</div>
                         <div className="text-xs text-slate-500">{loc.address}</div>
                       </div>
                       <button onClick={() => handleDeleteLocation(loc.id)} className="p-2 text-slate-600 hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'EMPLOYEES' && (
              <div className="space-y-6">
                 {/* Sub-menu styled as distinct screens */}
                 <div className="flex bg-slate-950 p-1.5 rounded-lg border border-slate-800 w-fit gap-1">
                    <button onClick={() => setEmployeeSubTab('REGISTER')} className={`flex items-center gap-2 px-6 py-3 rounded-md text-sm font-bold uppercase tracking-wide transition-all ${employeeSubTab === 'REGISTER' ? 'bg-slate-800 text-white border border-slate-700 shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}>
                       <UserPlus className="w-4 h-4" /> {editingEmployeeId ? 'Editar Funcionário' : 'Cadastro de Funcionário'}
                    </button>
                    <button onClick={() => setEmployeeSubTab('LIST')} className={`flex items-center gap-2 px-6 py-3 rounded-md text-sm font-bold uppercase tracking-wide transition-all ${employeeSubTab === 'LIST' ? 'bg-cyan-600 text-white shadow-[0_0_20px_rgba(8,145,178,0.4)]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}>
                       <List className="w-4 h-4" /> Funcionários Cadastrados
                    </button>
                 </div>
                 
                 {employeeSubTab === 'REGISTER' ? (
                    <div className="bg-slate-900/40 border border-slate-700 rounded-xl p-8 animate-in fade-in zoom-in-95 duration-300">
                      <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
                        <h3 className="font-tech text-xl text-white flex items-center gap-2">
                          {editingEmployeeId ? <Edit3 className="text-cyan-400" /> : <UserPlus className="text-cyan-400" />} 
                          {editingEmployeeId ? 'Editar Funcionário' : 'Novo Cadastro'}
                        </h3>
                        {editingEmployeeId && (
                           <button onClick={handleCancelEdit} className="text-xs flex items-center gap-1 text-red-400 hover:text-red-300 border border-red-500/30 px-3 py-1.5 rounded hover:bg-red-500/10 transition-all">
                             <X className="w-3 h-3" /> Cancelar Edição
                           </button>
                        )}
                      </div>
                      
                      <form onSubmit={handleSaveEmployee} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         {/* Facial Recognition Registration - Camera Only */}
                         <div className="md:col-span-2 flex flex-col items-center justify-center mb-2">
                            <label className="text-xs font-mono text-cyan-400 uppercase mb-3 flex items-center gap-2">
                              <ScanFace className="w-4 h-4" /> Cadastro Facial do Funcionário
                              {!modelsLoaded && <span className="text-yellow-500 animate-pulse">(Carregando IA...)</span>}
                            </label>
                            
                            {!showCameraCapture ? (
                              <>
                                {/* Photo Preview or Start Camera */}
                                <div className="relative">
                                  <div className={`w-44 h-44 rounded-full border-4 ${newEmployee.photoBase64 ? 'border-green-500' : 'border-dashed border-slate-600'} flex items-center justify-center overflow-hidden bg-slate-950 shadow-2xl transition-all`}>
                                    {newEmployee.photoBase64 ? (
                                      <img src={newEmployee.photoBase64} alt="Rosto cadastrado" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="text-center text-slate-500 p-4">
                                        <ScanFace className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <span className="text-xs font-bold uppercase">Rosto não cadastrado</span>
                                      </div>
                                    )}
                                  </div>
                                  {newEmployee.photoBase64 && (
                                    <div className="absolute -bottom-1 -right-1 bg-green-500 p-2 rounded-full text-white shadow-lg border-4 border-slate-900">
                                      <CheckCircle className="w-5 h-5" />
                                    </div>
                                  )}
                                </div>
                                
                                {/* Camera Button - Primary Action */}
                                <button
                                  type="button"
                                  onClick={startCaptureCamera}
                                  disabled={!modelsLoaded}
                                  className={`mt-6 flex items-center gap-3 px-8 py-4 ${
                                    newEmployee.photoBase64 
                                      ? 'bg-slate-800 hover:bg-slate-700 text-white' 
                                      : 'bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white shadow-[0_0_25px_rgba(217,70,239,0.4)]'
                                  } font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  {!modelsLoaded ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Carregando IA...</>
                                  ) : newEmployee.photoBase64 ? (
                                    <><Camera className="w-5 h-5" /> RECADASTRAR ROSTO</>
                                  ) : (
                                    <><Camera className="w-5 h-5" /> INICIAR CADASTRO FACIAL</>
                                  )}
                                </button>
                                
                                {!newEmployee.photoBase64 && (
                                  <p className="mt-3 text-xs text-slate-500 text-center max-w-xs">
                                    O funcionário deve estar presente para o cadastro facial
                                  </p>
                                )}
                                
                                {newEmployee.photoBase64 && (
                                  <button
                                    type="button"
                                    onClick={() => setNewEmployee(prev => ({ ...prev, photoBase64: '' }))}
                                    className="mt-3 text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" /> Remover cadastro facial
                                  </button>
                                )}
                              </>
                            ) : (
                              /* Camera Capture Mode - Full Screen Style */
                              <div className="w-full max-w-lg animate-in fade-in zoom-in-95 duration-300">
                                <div className="relative aspect-[4/3] bg-black rounded-2xl overflow-hidden border-4 border-fuchsia-500 shadow-[0_0_40px_rgba(217,70,239,0.3)]">
                                  <video 
                                    ref={captureVideoRef} 
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    aria-label="Câmera para captura facial"
                                    className="w-full h-full object-cover transform scale-x-[-1]"
                                  />
                                  <canvas ref={captureCanvasRef} className="hidden" aria-hidden="true" />
                                  
                                  {/* Face Detection Overlay */}
                                  <div className="absolute inset-0 pointer-events-none">
                                    {/* Scanning line animation */}
                                    <div className="absolute top-0 left-0 w-full h-1 bg-fuchsia-500/80 shadow-[0_0_15px_#d946ef] animate-[scan_2s_linear_infinite]"></div>
                                    
                                    {/* Dark corners for focus effect */}
                                    <div className="absolute inset-0 border-[40px] border-slate-950/70 rounded-xl"></div>
                                    
                                    {/* Guide oval */}
                                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-56 border-4 rounded-full transition-colors duration-300 ${
                                      faceDetected === true ? 'border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.5)]' : 
                                      faceDetected === false ? 'border-red-400 shadow-[0_0_20px_rgba(248,113,113,0.5)]' : 
                                      'border-white/40'
                                    }`} aria-hidden="true"></div>
                                    
                                    {/* Status indicator */}
                                    <div 
                                      aria-live="polite" 
                                      aria-atomic="true"
                                      className={`absolute top-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-sm font-bold uppercase flex items-center gap-2 shadow-lg ${
                                        !isCaptureReady ? 'bg-yellow-500 text-yellow-900' :
                                        isValidatingFace ? 'bg-blue-500 text-white' :
                                        faceDetected === true ? 'bg-green-500 text-white' :
                                        faceDetected === false ? 'bg-red-500 text-white' :
                                        'bg-slate-800 text-white'
                                      }`}
                                    >
                                      {!isCaptureReady ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Iniciando câmera...</>
                                      ) : isValidatingFace ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Detectando...</>
                                      ) : faceDetected === true ? (
                                        <><CheckCircle className="w-4 h-4" /> Rosto Detectado!</>
                                      ) : faceDetected === false ? (
                                        <><X className="w-4 h-4" /> Posicione o Rosto</>
                                      ) : (
                                        <><ScanFace className="w-4 h-4" /> Aguardando...</>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Camera Controls */}
                                <div className="flex gap-4 mt-6">
                                  <button
                                    type="button"
                                    onClick={stopCaptureCamera}
                                    className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                                  >
                                    <X className="w-5 h-5" /> CANCELAR
                                  </button>
                                  <button
                                    type="button"
                                    onClick={capturePhotoFromCamera}
                                    disabled={!isCaptureReady || isProcessingPhoto || faceDetected !== true}
                                    className="flex-1 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all"
                                  >
                                    {isProcessingPhoto ? (
                                      <><Loader2 className="w-5 h-5 animate-spin" /> Processando...</>
                                    ) : (
                                      <><CheckCircle className="w-5 h-5" /> CADASTRAR ROSTO</>
                                    )}
                                  </button>
                                </div>
                                
                                <p className="text-center text-sm text-slate-400 mt-4">
                                  Posicione o rosto do funcionário dentro do oval e aguarde a detecção
                                </p>
                              </div>
                            )}
                         </div>

                         {/* Form Fields */}
                         <div className="space-y-4">
                           <TechInput label="Nome Completo" value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} required />
                           <TechInput label="CPF" value={newEmployee.cpf} onChange={e => setNewEmployee({...newEmployee, cpf: maskCPF(e.target.value)})} maxLength={14} required />
                           <TechInput label="Cargo / Função" value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})} />
                         </div>

                         <div className="space-y-4">
                           <TechInput label="WhatsApp" value={newEmployee.whatsapp} onChange={e => setNewEmployee({...newEmployee, whatsapp: e.target.value})} />
                           
                           <div className="space-y-2">
                             <label className="text-xs font-mono text-cyan-400 uppercase ml-1">Locais de Acesso</label>
                             <div className="bg-slate-950/50 border border-slate-700 rounded-lg p-3 max-h-40 overflow-y-auto custom-scrollbar">
                               {locations.length === 0 ? (
                                 <p className="text-slate-500 text-xs">Nenhum local cadastrado.</p>
                               ) : (
                                 locations.map(loc => (
                                   <label key={loc.id} className="flex items-center gap-3 p-2 hover:bg-slate-800/50 rounded cursor-pointer transition-colors">
                                     <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${newEmployee.locationIds.includes(loc.id) ? 'bg-cyan-600 border-cyan-500' : 'border-slate-600 bg-slate-900'}`}>
                                       {newEmployee.locationIds.includes(loc.id) && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                     </div>
                                     <input
                                       type="checkbox"
                                       className="hidden"
                                       checked={newEmployee.locationIds.includes(loc.id)}
                                       onChange={(e) => {
                                         if (e.target.checked) {
                                           setNewEmployee(prev => ({ ...prev, locationIds: [...prev.locationIds, loc.id] }));
                                         } else {
                                           setNewEmployee(prev => ({ ...prev, locationIds: prev.locationIds.filter(id => id !== loc.id) }));
                                         }
                                       }}
                                     />
                                     <span className={`text-sm ${newEmployee.locationIds.includes(loc.id) ? 'text-white' : 'text-slate-400'}`}>{loc.name}</span>
                                   </label>
                                 ))
                               )}
                             </div>
                           </div>

                           <div className="space-y-2">
                             <div className="flex justify-between items-center">
                               <label className="text-xs font-mono text-cyan-400 uppercase ml-1">Turnos de Trabalho</label>
                               <button 
                                 type="button" 
                                 onClick={handleAddShift}
                                 className="text-xs flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                               >
                                 <Plus className="w-3 h-3" /> Adicionar Turno
                               </button>
                             </div>
                             
                             <div className="space-y-3">
                               {newEmployee.shifts.length === 0 ? (
                                 <div className="text-center p-4 border border-dashed border-slate-700 rounded-lg text-slate-500 text-xs">
                                   Nenhum turno adicionado. Clique em "Adicionar Turno".
                                 </div>
                               ) : (
                                 newEmployee.shifts.map((shift, index) => (
                                   <div key={shift.id} className="bg-slate-950/50 border border-slate-700 rounded-lg p-3 relative group">
                                     <button 
                                       type="button"
                                       onClick={() => handleRemoveShift(index)}
                                       className="absolute top-2 right-2 text-slate-600 hover:text-red-400 transition-colors"
                                     >
                                       <X className="w-3 h-3" />
                                     </button>
                                     
                                     <div className="grid grid-cols-1 gap-2 mb-2">
                                       <TechInput 
                                         label="Nome do Turno" 
                                         placeholder="Ex: Manhã, Tarde, 12x36"
                                         value={shift.name} 
                                         onChange={e => handleShiftChange(index, 'name', e.target.value)} 
                                         className="mb-1"
                                       />
                                     </div>
                                     
                                     <div className="grid grid-cols-4 gap-2">
                                       <TechInput 
                                         label="Entrada" 
                                         type="time" 
                                         value={shift.entryTime} 
                                         onChange={e => handleShiftChange(index, 'entryTime', e.target.value)} 
                                       />
                                       <TechInput 
                                         label="Início Pausa" 
                                         type="time" 
                                         value={shift.breakTime || ''} 
                                         onChange={e => handleShiftChange(index, 'breakTime', e.target.value)} 
                                       />
                                       <TechInput 
                                         label="Fim Pausa" 
                                         type="time" 
                                         value={shift.breakEndTime || ''} 
                                         onChange={e => handleShiftChange(index, 'breakEndTime', e.target.value)} 
                                       />
                                       <TechInput 
                                         label="Saída" 
                                         type="time" 
                                         value={shift.exitTime} 
                                         onChange={e => handleShiftChange(index, 'exitTime', e.target.value)} 
                                       />
                                     </div>
                                   </div>
                                 ))
                               )}
                             </div>
                           </div>
                         </div>

                         <div className="md:col-span-2">
                            <TechInput label="PIN de Acesso (Login Manual)" value={newEmployee.pin} onChange={e => setNewEmployee({...newEmployee, pin: e.target.value.replace(/\D/g,'')})} maxLength={6} placeholder="Mínimo 4 dígitos" icon={<KeyRound className="w-4 h-4"/>} required />
                         </div>

                         <div className="md:col-span-2 pt-6 border-t border-slate-800">
                           <button 
                             disabled={isProcessingPhoto}
                             className={`w-full bg-gradient-to-r text-white py-4 rounded-lg font-bold shadow-lg uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${editingEmployeeId ? 'from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500' : 'from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500'}`}
                           >
                             {isProcessingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                             {editingEmployeeId ? 'Salvar Alterações' : 'Cadastrar Funcionário'}
                           </button>
                         </div>
                      </form>
                    </div>
                 ) : (
                    // LIST VIEW
                    <div className="animate-in fade-in zoom-in-95 duration-300">
                      {/* Tabs by Location */}
                      {locations.length > 0 ? (
                        <div className="flex overflow-x-auto gap-1 border-b border-slate-800 pb-0 mb-6 scrollbar-thin scrollbar-thumb-slate-700">
                          {locations.map(loc => (
                            <button
                              key={loc.id}
                              onClick={() => setActiveLocationTab(loc.id)}
                              className={`
                                px-6 py-3 text-sm font-mono whitespace-nowrap rounded-t-lg border-b-2 transition-all flex items-center gap-2
                                ${activeLocationTab === loc.id 
                                  ? 'border-cyan-500 text-cyan-400 bg-cyan-900/10 font-bold' 
                                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/30'}
                              `}
                            >
                              <MapPin className="w-3 h-3" />
                              {loc.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                         <div className="text-center p-8 border border-dashed border-slate-800 rounded-xl text-slate-500">
                           Nenhum local cadastrado. Cadastre um local primeiro.
                         </div>
                      )}

                      {/* Employee Grid */}
                      <div className="bg-slate-950/30 p-4 rounded-b-xl min-h-[400px]">
                        {(() => {
                          const filteredEmployees = employees.filter(e => e.locationIds?.includes(activeLocationTab));
                          if (!activeLocationTab) return <div className="text-center text-slate-500 py-10">Selecione um local acima.</div>;
                          if (filteredEmployees.length === 0) return (
                            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-500 opacity-50">
                              <Users className="w-16 h-16 mb-4 stroke-1" />
                              <p>Nenhum funcionário neste local.</p>
                            </div>
                          );

                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {filteredEmployees.map(emp => (
                                <div key={emp.id} className="bg-slate-950 border border-slate-800 rounded-xl p-6 relative group hover:border-cyan-500/40 transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] flex flex-col">
                                  {/* Action Buttons */}
                                  <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleEditEmployee(emp); }} 
                                      className="text-slate-500 hover:text-cyan-400 p-2 rounded-lg hover:bg-cyan-500/10 transition-all" title="Editar"
                                    > <Edit3 className="w-4 h-4"/> </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(emp.id); }} 
                                      className="text-slate-500 hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition-all" title="Excluir"
                                    > <Trash2 className="w-4 h-4"/> </button>
                                  </div>

                                  <div className="flex items-start gap-4">
                                    <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center overflow-hidden shrink-0 group-hover:border-cyan-500/50 transition-colors">
                                      {emp.photoBase64 ? (
                                        <img src={emp.photoBase64} className="w-full h-full object-cover"/>
                                      ) : (
                                        <User className="w-8 h-8 text-slate-700"/>
                                      )}
                                    </div>
                                    <div className="min-w-0 pt-1">
                                      <div className="text-white font-bold text-lg leading-tight truncate uppercase font-tech tracking-wide">{emp.name}</div>
                                      <div className="text-cyan-500 text-xs font-bold uppercase tracking-wider mb-2">{emp.role || 'SEM CARGO'}</div>
                                      <span className="inline-block bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-400 font-mono uppercase">
                                        {emp.shifts && emp.shifts.length > 0 ? `${emp.shifts.length} Turno(s)` : 'Sem Turno'}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex-grow"></div>

                                  {!emp.photoBase64 && (
                                    <div className="mt-4 pt-4 border-t border-slate-800/50">
                                      <button
                                        onClick={() => handleGenerateLink(emp.id)}
                                        className="w-full bg-amber-600/20 border border-amber-500/30 text-amber-300 text-xs font-bold py-2.5 px-3 rounded-lg hover:bg-amber-600/40 transition-colors flex items-center justify-center gap-2"
                                      >
                                        <Share2 className="w-3 h-3" />
                                        GERAR LINK DE CADASTRO FACIAL
                                      </button>
                                    </div>
                                  )}
                                  
                                  <div className="pt-4 border-t border-slate-800/80 flex justify-between items-center text-xs font-mono text-slate-500 mt-4">
                                    <span className="flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                                      CPF: {emp.cpf}
                                    </span>
                                    <span className="flex items-center gap-2">
                                      PIN: <span className="text-white tracking-[0.2em]">••••</span>
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                 )}
              </div>
            )}
            
            {activeTab === 'SETTINGS' && (
              <div className="bg-slate-900/40 border border-slate-700 rounded-xl p-6">
                <h3 className="font-tech text-white mb-4">Configurações</h3>
                <form onSubmit={handleSaveSettings} className="max-w-md space-y-4">
                  <TechInput label="Tenant ID" value={tenantCode} onChange={e => setTenantCode(e.target.value.toUpperCase())} readOnly={!isEditingSettings} />
                  <button type="button" onClick={() => setIsEditingSettings(!isEditingSettings)} className="text-cyan-400 text-sm flex gap-2"><Edit3 className="w-4 h-4"/> Editar</button>
                  {isEditingSettings && <button className="w-full bg-cyan-600 text-white py-2 rounded">{isSavingSettings ? 'Salvando...' : 'Salvar'}</button>}
                </form>
              </div>
            )}
          </div>
          {/* Link Generation Modal */}
          {showLinkModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-8 max-w-lg w-full shadow-[0_0_50px_rgba(245,158,11,0.2)] relative">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <Share2 className="w-6 h-6 text-amber-400"/>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">Link de Cadastro Facial</h2>
                    <p className="text-slate-400 text-sm">Envie este link para o funcionário. Ele é único e só pode ser usado uma vez.</p>
                  </div>
                </div>
                
                <div className="relative my-6">
                  <input 
                    type="text" 
                    readOnly 
                    value={generatedLink}
                    className="w-full bg-slate-950/80 border border-slate-700 text-amber-300 text-sm rounded-lg p-3 pr-12 font-mono"
                  />
                  <button 
                    onClick={() => copyToClipboard(generatedLink)}
                    className="absolute top-1/2 right-2 -translate-y-1/2 p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
                    title="Copiar link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex justify-end">
                  <button 
                    onClick={() => setShowLinkModal(false)}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-lg"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // -- RENDER: EMPLOYEE DASHBOARD (Biometric Lock) --

  if (!isBiometricVerified) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center p-4">
        <TechBackground />
        
        <div className="relative z-30 w-full max-w-md">
           <button onClick={handleDashboardLogout} className="absolute -top-12 left-0 text-slate-400 flex items-center gap-2 text-xs uppercase"><ArrowLeft className="w-4 h-4"/> Desconectar</button>
           
           <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-[0_0_60px_-10px_rgba(217,70,239,0.2)] text-center overflow-hidden transition-all duration-300">
              
              {!showPinLogin ? (
                /* BIOMETRIC MODE - CÂMERA AUTOMÁTICA */
                !cameraActive ? (
                  <>
                    <div className="w-24 h-24 bg-slate-950 rounded-full mx-auto mb-6 flex items-center justify-center border border-slate-800 shadow-[0_0_30px_rgba(217,70,239,0.3)] animate-pulse">
                      <Loader2 className="w-10 h-10 text-fuchsia-500 animate-spin" />
                    </div>
                    <h2 className="text-2xl font-tech font-bold text-white mb-2">Login Automático</h2>
                    <p className="text-slate-400 text-sm mb-2">
                      Iniciando reconhecimento facial...
                    </p>
                    <p className="text-fuchsia-400 text-xs font-mono mb-6">
                      {employeeContext?.companyName}
                    </p>

                    <div className="bg-slate-950/50 border border-slate-700 rounded-lg p-4 mb-6">
                      <p className="text-slate-300 text-sm text-center mb-2">
                        ✨ <strong>Sem botões necessários</strong>
                      </p>
                      <p className="text-slate-500 text-xs text-center">
                        A câmera abrirá automaticamente e reconhecerá seu rosto
                      </p>
                    </div>

                    <div className="space-y-4 text-left">
                      <button 
                        onClick={() => { setShowPinLogin(true); stopCamera(); }}
                        className="w-full text-center text-xs text-slate-500 hover:text-fuchsia-400 mt-4 transition-colors underline decoration-slate-700 hover:decoration-fuchsia-400"
                      >
                        Problemas com a câmera? Entrar com PIN
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center">
                     <div className="relative w-full aspect-[3/4] bg-black rounded-lg overflow-hidden border-2 border-fuchsia-500 shadow-2xl mb-4">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                        <canvas ref={canvasRef} className="hidden" />
                        
                        {/* Scanning Overlay */}
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute top-0 left-0 w-full h-1 bg-fuchsia-500/80 shadow-[0_0_15px_#d946ef] animate-[scan_2s_linear_infinite]"></div>
                          <div className="absolute inset-0 border-[50px] border-slate-950/60"></div>
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-64 border-2 border-fuchsia-400/50 rounded-full"></div>
                        </div>
                     </div>

                     {/* 🔥 Feedback visual de reconhecimento automático */}
                     <div className="bg-gradient-to-r from-fuchsia-950/50 to-purple-950/50 border border-fuchsia-500/30 rounded-lg p-5 mb-4">
                       <div className="flex items-center justify-center gap-3 mb-3">
                         {isScanning ? (
                           <Loader2 className="w-6 h-6 text-fuchsia-400 animate-spin" />
                         ) : (
                           <Activity className="w-6 h-6 text-fuchsia-400 animate-pulse" />
                         )}
                       </div>
                       <p className="text-white font-bold text-base mb-2 text-center">
                         Reconhecimento Automático Ativo
                       </p>
                       <p className="text-fuchsia-300 font-mono text-sm animate-pulse uppercase text-center">
                         {scanMessage || 'Posicione seu rosto'}
                       </p>
                       <p className="text-slate-400 text-xs text-center mt-3">
                         O sistema irá identificar você automaticamente
                       </p>
                     </div>

                     {/* Apenas botão de cancelar - SEM botão de identificar */}
                     <button onClick={stopCamera} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-sm flex justify-center items-center gap-2 transition-colors">
                       <X className="w-4 h-4" /> CANCELAR
                     </button>
                  </div>
                )
              ) : (
                /* PIN MODE - NEEDS CPF FOR IDENTIFICATION */
                <form onSubmit={handlePinLogin} className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                   <div className="w-20 h-20 bg-slate-950 rounded-full mx-auto mb-6 flex items-center justify-center border border-slate-800 shadow-[0_0_30px_rgba(217,70,239,0.3)]">
                      <KeyRound className="w-8 h-8 text-fuchsia-500" />
                   </div>
                   <h2 className="text-2xl font-tech font-bold text-white mb-6">Acesso Manual</h2>
                   
                   <div className="space-y-4 text-left">
                     <TechInput 
                        label="Seu CPF" 
                        value={cpfForLogin} 
                        onChange={(e) => setCpfForLogin(maskCPF(e.target.value))}
                        placeholder="000.000.000-00"
                        className="border-fuchsia-500/30 focus:border-fuchsia-500"
                        required
                      />
                     <TechInput 
                        label="PIN de Segurança" 
                        type="password"
                        value={pinForLogin} 
                        onChange={(e) => setPinForLogin(e.target.value.replace(/\D/g,''))}
                        placeholder="••••••"
                        className="border-fuchsia-500/30 focus:border-fuchsia-500"
                        maxLength={6}
                        required
                      />
                      
                      <button 
                        type="submit"
                        disabled={isScanning}
                        className="w-full py-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-lg uppercase tracking-wider text-sm transition-all shadow-[0_0_20px_rgba(217,70,239,0.4)] flex justify-center items-center gap-2"
                      >
                         {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : "VALIDAR ACESSO"}
                      </button>

                      <button 
                        type="button"
                        onClick={() => { setShowPinLogin(false); startCamera(); }}
                        className="w-full text-center text-xs text-slate-500 hover:text-fuchsia-400 mt-4 transition-colors"
                      >
                        Voltar para Biometria
                      </button>
                   </div>
                </form>
              )}

           </div>
        </div>
        <style>{`@keyframes scan { 0% { top: 0%; } 100% { top: 100%; } }`}</style>
        
        {/* Toast Notification */}
        <div className={`fixed top-4 right-4 z-50 transition-all duration-500 transform ${toast.visible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}>
          <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-md ${
            toast.type === 'success' ? 'bg-green-900/90 border-green-500/50 text-white' :
            toast.type === 'error' ? 'bg-red-900/90 border-red-500/50 text-white' :
            'bg-slate-900/90 border-slate-700/50 text-white'
          }`}>
            {toast.type === 'success' && <CheckCircle className="w-6 h-6 text-green-400" />}
            {toast.type === 'error' && <AlertCircle className="w-6 h-6 text-red-400" />}
            {toast.type === 'info' && <Info className="w-6 h-6 text-blue-400" />}
            <div>
              <p className="font-bold text-sm">{toast.type === 'success' ? 'Sucesso' : toast.type === 'error' ? 'Erro' : 'Informação'}</p>
              <p className="text-xs opacity-90 whitespace-pre-line">{toast.message}</p>
            </div>
            <button onClick={() => setToast(prev => ({ ...prev, visible: false }))} className="ml-4 opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -- RENDER: UNLOCKED EMPLOYEE DASHBOARD --

  return (
    <div className="relative min-h-screen p-4 md:p-6 flex flex-col items-center pb-24">
      <TechBackground />
      <div className="relative z-30 w-full max-w-4xl">
         {/* Header */}
         <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-10 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl backdrop-blur gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
               <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-fuchsia-500 overflow-hidden shadow-[0_0_20px_rgba(217,70,239,0.3)] shrink-0">
                 <img src={identifiedEmployee?.photoBase64} alt="Profile" className="w-full h-full object-cover" />
               </div>
               <div className="min-w-0 flex-1">
                 <h1 className="text-xl md:text-2xl font-bold text-white uppercase truncate">{identifiedEmployee?.name}</h1>
                 <div className="flex flex-wrap gap-2 md:gap-3 text-xs font-mono text-slate-400">
                   <span className="flex items-center gap-1 text-fuchsia-400"><Activity className="w-3 h-3"/> ONLINE</span>
                   <span className="truncate">{identifiedEmployee?.role}</span>
                   <span className="truncate">{employeeContext?.companyName}</span>
                 </div>
               </div>
            </div>
            <button onClick={handleDashboardLogout} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-slate-300 self-end md:self-auto"><ArrowLeft className="w-5 h-5" /></button>
         </div>

         {activeEmployeeTab === 'HISTORY' ? (
            // HISTORY VIEW
            <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-cyan-400" />
                  Histórico de Pontos
                </h2>
              </div>

              {/* Date Filter */}
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono text-cyan-400 uppercase mb-2 block">Data Início</label>
                  <input 
                    type="date" 
                    value={historyStartDate}
                    onChange={(e) => setHistoryStartDate(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-white rounded-lg p-3 w-full focus:border-cyan-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-cyan-400 uppercase mb-2 block">Data Fim</label>
                  <input 
                    type="date" 
                    value={historyEndDate}
                    onChange={(e) => setHistoryEndDate(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-white rounded-lg p-3 w-full focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>

              {/* Location Tabs */}
              {isLoadingHistory ? (
                <div className="py-10 text-center">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">Carregando histórico...</p>
                </div>
              ) : historyRecords.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-slate-800 rounded-xl">
                  <p className="text-slate-500">Nenhum registro encontrado neste período.</p>
                </div>
              ) : (
                <>
                  <div className="flex overflow-x-auto gap-2 mb-4 pb-2 custom-scrollbar">
                    {Array.from(new Set(historyRecords.map(r => r.locationName))).map(locName => (
                      <button
                        key={locName}
                        onClick={() => setSelectedHistoryLocation(locName)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                          selectedHistoryLocation === locName 
                            ? 'bg-cyan-600 text-white shadow-lg' 
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        <MapPin className="w-3 h-3 inline mr-2" />
                        {locName}
                      </button>
                    ))}
                  </div>

                  {/* Daily Summary and Records List */}
                  <div className="space-y-6">
                    {dailySummaries
                      .filter(daily => daily.records.some(r => r.locationName === selectedHistoryLocation))
                      .map(daily => (
                      <div key={daily.day} className="bg-slate-950/30 p-4 rounded-lg border border-slate-800">
                        <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">
                          {new Date(daily.day + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                        </h3>
                        
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4">
                          <div className="bg-slate-900 p-3 rounded-lg text-center border border-slate-700">
                            <p className="text-xs text-cyan-400 font-mono">Total a Trabalhar</p>
                            <p className="text-xl font-bold text-white">{daily.summary.totalToWork}</p>
                          </div>
                          <div className="bg-slate-900 p-3 rounded-lg text-center border border-slate-700">
                            <p className="text-xs text-green-400 font-mono">Horas Trabalhadas</p>
                            <p className="text-xl font-bold text-white">{daily.summary.totalWorked}</p>
                          </div>
                          <div className="bg-slate-900 p-3 rounded-lg text-center border border-slate-700">
                            <p className="text-xs text-yellow-400 font-mono">Horas Devendo</p>
                            <p className="text-xl font-bold text-white">{daily.summary.hoursOwed}</p>
                          </div>
                          <div className="bg-slate-900 p-3 rounded-lg text-center border border-slate-700">
                            <p className="text-xs text-fuchsia-400 font-mono">Horas Extras</p>
                            <p className="text-xl font-bold text-white">{daily.summary.overtime}</p>
                          </div>
                        </div>

                        {/* Records List for the day */}
                        <div className="space-y-2">
                          {daily.records
                            .filter(r => r.locationName === selectedHistoryLocation)
                            .map(record => {
                              const typeLabels = { ENTRY: 'Entrada', BREAK_START: 'Início Pausa', BREAK_END: 'Fim Pausa', EXIT: 'Saída' };
                              const typeColors = { ENTRY: 'border-green-500 text-green-400', BREAK_START: 'border-yellow-500 text-yellow-400', BREAK_END: 'border-blue-500 text-blue-400', EXIT: 'border-red-500 text-red-400' };
                              const statusColors = { PERFECT: 'text-green-400', GOOD: 'text-yellow-400', LATE: 'text-red-400', NEUTRAL: 'text-slate-400' };
                              const statusColor = statusColors[record.punctualityStatus as keyof typeof statusColors] || 'text-slate-400';

                              return (
                                <div key={record.id} className={`bg-slate-900/50 border-l-4 ${typeColors[record.type].split(' ')[0]} border-y border-r border-slate-800 p-3 rounded-r-lg flex justify-between items-center`}>
                                  <div>
                                    <div className={`font-bold text-sm ${typeColors[record.type].split(' ')[1]}`}>{typeLabels[record.type]}</div>
                                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                      <Clock className="w-3 h-3" /> {record.timestamp.toLocaleTimeString('pt-BR')}
                                    </div>
                                    {record.punctualityMessage && <div className={`text-xs font-bold mt-1 ${statusColor}`}>{record.punctualityMessage}</div>}
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xs text-slate-400 font-mono">{record.distance ? `${record.distance.toFixed(0)}m` : 'N/A'}</div>
                                    {record.score !== undefined && <div className={`text-[10px] font-bold flex items-center justify-end gap-1 mt-1 ${statusColor}`}><Trophy className="w-3 h-3" /> {record.score} XP</div>}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
         ) : (
            // MAIN DASHBOARD VIEW
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
               <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center text-center shadow-2xl">
                  <div className="text-5xl md:text-6xl font-tech font-bold text-white mb-2 tracking-widest">
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-slate-400 font-mono text-sm mb-6 md:mb-8">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                  
                  {/* Location Selector */}
                  <div className="w-full max-w-md mb-4">
                    <label className="text-xs font-mono text-cyan-400 uppercase mb-2 block text-left">Local de Trabalho</label>
                    <div className="relative">
                      <select 
                        value={currentLocation?.id || ''} 
                        onChange={(e) => {
                          const loc = locations.find(l => l.id === e.target.value);
                          if (loc) {
                            setCurrentLocation(loc);
                            showToast(`Local selecionado: ${loc.name}`, 'success');
                          }
                        }}
                        className="w-full bg-slate-950/50 border border-slate-700 text-white text-sm rounded-lg p-3 pl-10 outline-none focus:border-cyan-500 transition-colors appearance-none"
                      >
                        <option value="" disabled>Selecione um local...</option>
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-500 pointer-events-none" />
                      <div className="absolute right-3 top-3 pointer-events-none">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                  </div>

                  {/* Shift Selector (Filtered) */}
                  <div className="w-full max-w-md mb-6">
                    <label className="text-xs font-mono text-cyan-400 uppercase mb-2 block text-left">Turno de Trabalho</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                      {availableShifts.map(shift => (
                        <button
                          key={shift.id}
                          onClick={() => {
                            setCurrentShift(shift);
                            showToast(`Turno selecionado: ${shift.name}`, 'success');
                            playSound.click();
                          }}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            currentShift?.id === shift.id
                              ? 'bg-cyan-500/20 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                              : 'bg-slate-950/50 border-slate-700 hover:border-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed'
                          }`}
                          disabled={!currentLocation}
                        >
                          <p className="font-bold text-white">{shift.name || 'Turno sem nome'}</p>
                          <div className="text-xs text-slate-400 grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                            <span><strong className="text-slate-300 font-mono">Entrada:</strong> {shift.entryTime || 'N/A'}</span>
                            <span><strong className="text-slate-300 font-mono">Saída:</strong> {shift.exitTime || 'N/A'}</span>
                            <span><strong className="text-slate-300 font-mono">In. Pausa:</strong> {shift.breakTime || 'N/A'}</span>
                            <span><strong className="text-slate-300 font-mono">Fim Pausa:</strong> {shift.breakEndTime || 'N/A'}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    {!currentShift && currentLocation && (
                      <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Selecione um turno para registrar o ponto.
                      </p>
                    )}
                    {currentLocation && availableShifts.length === 0 && (
                      <div className="text-center p-4 border border-dashed border-slate-700 rounded-lg text-slate-500 text-xs">
                        {(!identifiedEmployee?.shifts || identifiedEmployee.shifts.length === 0)
                          ? "Nenhum turno cadastrado para este funcionário."
                          : "Nenhum turno disponível no horário atual."
                        }
                      </div>
                    )}
                  </div>

                  {/* Attendance Action Button */}
                  <div className="w-full max-w-md space-y-3 mb-6">
                    {currentLocation && currentShift ? (
                      <button 
                        onClick={() => startAttendanceFlow(nextAction.type)}
                        disabled={isCheckingLocation || isRegisteringAttendance}
                        className={`w-full py-3 md:py-4 bg-gradient-to-r ${nextAction.color} text-white font-bold rounded-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base`}
                      >
                        {nextAction.icon} {nextAction.label}
                      </button>
                    ) : (
                      <div className="text-center p-4 border border-dashed border-slate-700 rounded-lg text-slate-500 text-xs">
                        Selecione um local e turno para registrar o ponto.
                      </div>
                    )}
                  </div>
                  
                  {currentLocation && (
                    <p className="mt-4 text-xs text-slate-500 flex items-center gap-2 justify-center">
                      <MapPin className="w-3 h-3" /> Local: <span className="text-fuchsia-400 truncate max-w-[200px]">{currentLocation.name}</span>
                    </p>
                  )}
               </div>

               <div className="space-y-4">
                 <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2"><List className="w-4 h-4 text-cyan-400"/> Histórico Recente</h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                       {attendanceRecords.length === 0 ? (
                         <p className="text-slate-500 text-sm text-center py-4">Nenhum registro ainda</p>
                       ) : (
                         attendanceRecords.map((record) => {
                           const typeColors = {
                             ENTRY: 'border-green-500',
                             BREAK_START: 'border-yellow-500',
                             BREAK_END: 'border-blue-500',
                             EXIT: 'border-red-500'
                           };
                           const typeLabels = {
                             ENTRY: 'Entrada',
                             BREAK_START: 'Início Pausa',
                             BREAK_END: 'Fim Pausa',
                             EXIT: 'Saída'
                           };
                           const statusColors = {
                             PERFECT: 'text-green-400',
                             GOOD: 'text-yellow-400',
                             LATE: 'text-red-400',
                             NEUTRAL: 'text-slate-400',
                           };
                           const statusColor = statusColors[record.punctualityStatus as keyof typeof statusColors] || 'text-slate-400';

                           return (
                             <div key={record.id} className={`flex justify-between text-sm p-3 bg-slate-950/50 rounded border-l-2 ${typeColors[record.type]}`}>
                               <div>
                                 <span className="text-slate-300">{typeLabels[record.type]}</span>
                                 <div className="text-xs text-slate-500 mt-1">
                                   {record.timestamp.toLocaleDateString('pt-BR')}
                                 </div>
                               </div>
                               <div className="text-right">
                                 <span className="font-mono text-white block">{record.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                 {record.punctualityMessage && (
                                   <span className={`text-[10px] font-bold ${statusColor}`}>{record.punctualityMessage}</span>
                                 )}
                               </div>
                             </div>
                           );
                         })
                       )}
                    </div>
                    <button 
                      onClick={() => setActiveEmployeeTab('HISTORY')}
                      className="w-full mt-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Calendar className="w-4 h-4" /> Ver Histórico Completo
                    </button>
                 </div>
               </div>
            </div>
         )}

         {/* Attendance Flow Modal */}
         {showAttendanceFlow && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
             <div className="bg-slate-900 border-2 border-fuchsia-500/50 rounded-2xl p-4 md:p-8 max-w-2xl w-full shadow-[0_0_50px_rgba(217,70,239,0.3)] relative max-h-[90vh] overflow-y-auto">
               {/* Header */}
               <div className="flex justify-between items-center mb-4 md:mb-6">
                 <div>
                   <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2 md:gap-3 mb-1">
                     <Clock className="w-6 h-6 md:w-8 md:h-8 text-fuchsia-400" />
                     Registrar Ponto
                   </h2>
                   {attendanceType && (
                     <p className="text-fuchsia-400 text-sm font-mono ml-8 md:ml-11">
                       {attendanceType === 'ENTRY' && '🟢 Entrada'}
                       {attendanceType === 'BREAK_START' && '🟡 Início da Pausa'}
                       {attendanceType === 'BREAK_END' && '🔵 Fim da Pausa'}
                       {attendanceType === 'EXIT' && '🔴 Saída'}
                     </p>
                   )}
                 </div>
                 <button 
                   onClick={cancelAttendanceFlow}
                   className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                 >
                   <X className="w-6 h-6 text-slate-400" />
                 </button>
               </div>

               {/* Step 1: Verificando Localização */}
               {isCheckingLocation && (
                 <div className="text-center py-8">
                   <Loader2 className="w-16 h-16 text-fuchsia-400 animate-spin mx-auto mb-4" />
                   <p className="text-white text-lg font-semibold mb-2">Verificando sua localização...</p>
                   <p className="text-slate-400 text-sm">Aguarde enquanto confirmamos que você está no local de trabalho</p>
                 </div>
               )}

               {/* Step 2: Reconhecimento Facial Automático */}
               {locationVerified && !isRegisteringAttendance && (
                 <div className="space-y-4">
                   <div className="bg-green-950/30 rounded-xl p-4 border border-green-500/30">
                     <p className="text-green-400 text-sm font-semibold mb-2 flex items-center gap-2">
                       <CheckCircle className="w-4 h-4" /> Localização verificada
                     </p>
                     <p className="text-slate-400 text-xs">Você está no local de trabalho</p>
                   </div>

                   <div className="relative">
                     <video 
                       ref={videoRef}
                       autoPlay 
                       playsInline 
                       muted
                       className="w-full h-[300px] md:h-[400px] object-cover rounded-xl border-2 border-fuchsia-500/50 transform scale-x-[-1]"
                     />
                     <canvas ref={canvasRef} className="hidden" />
                     
                     {/* Overlay com guia de posicionamento */}
                     <div className="absolute inset-0 pointer-events-none">
                       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-64 border-2 border-fuchsia-400/50 rounded-full"></div>
                     </div>
                     
                     <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                       <div className="bg-black/80 backdrop-blur px-5 py-2.5 rounded-full border border-fuchsia-500/30">
                         <p className="text-white text-sm font-mono flex items-center gap-2">
                           {isScanning ? (
                             <><Loader2 className="w-4 h-4 animate-spin" /> {scanMessage}</>
                           ) : (
                             <><Activity className="w-4 h-4 animate-pulse" /> {scanMessage || 'Posicione seu rosto'}</>
                           )}
                         </p>
                       </div>
                     </div>
                   </div>

                   {/* 🔥 Feedback de reconhecimento automático - SEM BOTÕES DE CONFIRMAÇÃO */}
                   <div className="space-y-3">
                     <div className="bg-gradient-to-r from-fuchsia-950/50 to-purple-950/50 border border-fuchsia-500/30 rounded-xl p-6 text-center">
                       <div className="flex items-center justify-center gap-3 mb-3">
                         {isScanning || isRegisteringAttendance ? (
                           <Loader2 className="w-8 h-8 text-fuchsia-400 animate-spin" />
                         ) : (
                           <Activity className="w-8 h-8 text-fuchsia-400 animate-pulse" />
                         )}
                       </div>
                       <p className="text-white font-bold text-lg mb-2">
                         {isRegisteringAttendance ? '💾 Registrando ponto...' : '🤖 Validação Biométrica'}
                       </p>
                       <p className="text-fuchsia-300 font-mono text-sm mb-3">
                         {scanMessage || 'Posicione seu rosto na câmera'}
                       </p>
                       <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-700">
                         <p className="text-slate-300 text-xs mb-1">
                           🔐 <strong>Validação de Segurança</strong>
                         </p>
                         <p className="text-slate-400 text-xs">
                           O sistema irá verificar se você é o funcionário logado ({identifiedEmployee?.name}) para habilitar o registro
                         </p>
                       </div>
                     </div>

                     {/* Botão de Confirmação Manual */}
                     <button
                       onClick={registerAttendance}
                       disabled={!isIdentityConfirmed || isRegisteringAttendance}
                       className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                         isIdentityConfirmed 
                           ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-[0_0_20px_rgba(34,197,94,0.4)] cursor-pointer' 
                           : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                       }`}
                     >
                       {isRegisteringAttendance ? (
                         <><Loader2 className="w-5 h-5 animate-spin" /> Registrando...</>
                       ) : isIdentityConfirmed ? (
                         <><CheckCircle className="w-5 h-5" /> CONFIRMAR PONTO</>
                       ) : (
                         <><ScanFace className="w-5 h-5" /> Aguardando Identificação...</>
                       )}
                     </button>

                     {/* Apenas botão Cancelar */}
                     <button
                       onClick={cancelAttendanceFlow}
                       disabled={isRegisteringAttendance}
                       className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                     >
                       <X className="w-5 h-5" />
                       {isRegisteringAttendance ? 'Aguarde...' : 'Cancelar Registro'}
                     </button>
                   </div>
                 </div>
               )}

               {/* Step 3: Registrando Ponto */}
               {isRegisteringAttendance && (
                 <div className="text-center py-8">
                   <Loader2 className="w-16 h-16 text-green-400 animate-spin mx-auto mb-4" />
                   <p className="text-white text-lg font-semibold mb-2">Registrando ponto...</p>
                   <p className="text-slate-400 text-sm">Aguarde um momento</p>
                 </div>
               )}
             </div>
           </div>
         )}
         
         {/* Toast Notification */}
         <div className={`fixed top-4 right-4 z-50 transition-all duration-500 transform ${toast.visible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}>
           <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-md ${
             toast.type === 'success' ? 'bg-green-900/90 border-green-500/50 text-white' :
             toast.type === 'error' ? 'bg-red-900/90 border-red-500/50 text-white' :
             'bg-slate-900/90 border-slate-700/50 text-white'
           }`}>
             {toast.type === 'success' && <CheckCircle className="w-6 h-6 text-green-400" />}
             {toast.type === 'error' && <AlertCircle className="w-6 h-6 text-red-400" />}
             {toast.type === 'info' && <Info className="w-6 h-6 text-blue-400" />}
             <div>
               <p className="font-bold text-sm">{toast.type === 'success' ? 'Sucesso' : toast.type === 'error' ? 'Erro' : 'Informação'}</p>
               <p className="text-xs opacity-90 whitespace-pre-line">{toast.message}</p>
             </div>
             <button onClick={() => setToast(prev => ({ ...prev, visible: false }))} className="ml-4 opacity-70 hover:opacity-100">
               <X className="w-4 h-4" />
             </button>
           </div>
         </div>
      </div>

      {/* Navigation Menu */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-xl border border-slate-700 rounded-full px-6 py-3 shadow-2xl flex items-center gap-8">
        <button 
          onClick={() => { setActiveEmployeeTab('DASHBOARD'); playSound.click(); }}
          className={`flex flex-col items-center gap-1 transition-colors ${activeEmployeeTab === 'DASHBOARD' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <LayoutDashboard className={`w-6 h-6 ${activeEmployeeTab === 'DASHBOARD' ? 'fill-cyan-400/20' : ''}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Painel</span>
        </button>
        
        <div className="w-px h-8 bg-slate-800"></div>

        <button 
          onClick={() => { setActiveEmployeeTab('HISTORY'); playSound.click(); }}
          className={`flex flex-col items-center gap-1 transition-colors ${activeEmployeeTab === 'HISTORY' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <List className={`w-6 h-6 ${activeEmployeeTab === 'HISTORY' ? 'fill-cyan-400/20' : ''}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Histórico</span>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
