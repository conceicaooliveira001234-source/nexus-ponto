import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import CompanyLogin from './components/auth/CompanyLogin';
import CompanyRegister from './components/auth/CompanyRegister';
import EmployeeLogin from './components/auth/EmployeeLogin';
import FacialOnboarding from './components/auth/FacialOnboarding';
import { UserRole, ViewState, CompanyData, EmployeeContext, ServiceLocation } from './types';
import { auth, db } from './lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import InstallButton from './components/InstallButton';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('LANDING');
  const [currentCompany, setCurrentCompany] = useState<CompanyData | null>(null);
  const [employeeContext, setEmployeeContext] = useState<EmployeeContext | null>(null);
  const [employeeIdForOnboarding, setEmployeeIdForOnboarding] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Auth Listener
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/register-face/')) {
      const employeeId = path.split('/')[2];
      if (employeeId) {
        setEmployeeIdForOnboarding(employeeId);
        setView('FACIAL_ONBOARDING');
        setIsLoading(false);
        return;
      }
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // 1. Check for persisted employee context first (for Employee Dashboard persistence)
      const storedEmployeeContext = localStorage.getItem('nexus_employee_context');
      
      if (storedEmployeeContext) {
        try {
          const context = JSON.parse(storedEmployeeContext);
          setEmployeeContext(context);
          setView('DASHBOARD_EMPLOYEE');
          setIsLoading(false);
          // If we have a context, we assume we are in employee mode, 
          // even if firebase auth user is present (anonymous or not)
          return; 
        } catch (e) {
          console.error("Error parsing stored employee context", e);
          localStorage.removeItem('nexus_employee_context');
        }
      }

      // 2. If no employee context, check for Company Auth
      if (user) {
        // User is signed in, fetch company details
        try {
          const docRef = doc(db, "companies", user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data() as CompanyData;
            setCurrentCompany({ ...data, uid: user.uid });
            setView('DASHBOARD_COMPANY');
          } else {
            // It might be an employee (Anonymous) or data missing
            setCurrentCompany(null);
            
            // Only redirect to LANDING if it's a standard user (not anonymous) 
            // that is missing company data (avoids breaking Employee flow)
            if (!user.isAnonymous) {
              setView('LANDING');
            }
          }
        } catch (error) {
          console.error("Error fetching company data:", error);
        }
      } else {
        setCurrentCompany(null);
        // Don't force view change here to allow landing page navigation
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Initial role selection from Landing Page
  const handleRoleSelect = (role: UserRole) => {
    if (role === UserRole.COMPANY) {
      if (currentCompany) {
        setView('DASHBOARD_COMPANY');
      } else {
        setView('LOGIN_COMPANY');
      }
    } else if (role === UserRole.EMPLOYEE) {
      setView('LOGIN_EMPLOYEE');
    }
  };

  // Login Logic (Firebase)
  const handleCompanyLogin = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // Listener will handle redirection
    } catch (error: any) {
      console.error(error);
      let msg = "Erro ao fazer login.";
      if (error.code === 'auth/invalid-credential') msg = "E-mail ou senha incorretos.";
      alert(msg);
    }
  };

  // Registration Logic (Firebase)
  const handleCompanyRegister = async (data: CompanyData) => {
    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password!);
      const user = userCredential.user;

      // 2. Save additional company data to Firestore
      const companyDataToSave = {
        cnpj: data.cnpj,
        companyName: data.companyName,
        whatsapp: data.whatsapp,
        email: data.email,
        uid: user.uid
        // We do NOT save the password in Firestore
      };

      await setDoc(doc(db, "companies", user.uid), companyDataToSave);

      alert("Conta criada com sucesso!");
      // Listener will redirect to Dashboard automatically
    } catch (error: any) {
      console.error(error);
      let msg = "Erro ao criar conta.";
      if (error.code === 'auth/email-already-in-use') msg = "Este e-mail já está em uso.";
      if (error.code === 'auth/weak-password') msg = "A senha deve ter pelo menos 6 caracteres.";
      alert(msg);
    }
  };

  const handleEmployeeLogin = (context: EmployeeContext) => {
    setEmployeeContext(context);
    // Persist context to survive refreshes
    localStorage.setItem('nexus_employee_context', JSON.stringify(context));
    setView('DASHBOARD_EMPLOYEE');
  };

  const handleSetEmployeeLocation = (location: ServiceLocation | null) => {
    if (employeeContext) {
      const newContext = location
        ? { ...employeeContext, locationId: location.id, locationName: location.name }
        : { ...employeeContext, locationId: undefined, locationName: undefined };
      
      if (!newContext.companyId) return;

      setEmployeeContext(newContext);
      localStorage.setItem('nexus_employee_context', JSON.stringify(newContext));
    }
  };

  // Navigation handlers
  const handleLogout = async () => {
    try {
      // Sign out regardless of role (works for anonymous too)
      await signOut(auth);
      setCurrentCompany(null);
      setEmployeeContext(null);
      
      // Clear all local storage related to session
      localStorage.removeItem('nexus_employee_context');
      localStorage.removeItem('nexus_employee');
      localStorage.removeItem('nexus_verified');

      setView('LANDING');
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-500">
        <div className="animate-spin h-8 w-8 border-4 border-current border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const renderView = () => {
    switch (view) {
      case 'LANDING':
        return <LandingPage onSelect={handleRoleSelect} />;
      
      case 'LOGIN_COMPANY':
        return (
          <CompanyLogin 
            onLogin={handleCompanyLogin}
            onRegisterClick={() => setView('REGISTER_COMPANY')}
            onBack={() => setView('LANDING')}
          />
        );
      
      case 'REGISTER_COMPANY':
        return (
          <CompanyRegister 
            onRegister={handleCompanyRegister}
            onBack={() => setView('LOGIN_COMPANY')}
          />
        );

      case 'LOGIN_EMPLOYEE':
        return (
          <EmployeeLogin 
            onLogin={handleEmployeeLogin}
            onBack={() => setView('LANDING')}
          />
        );

      case 'FACIAL_ONBOARDING':
        return (
          <FacialOnboarding
            employeeId={employeeIdForOnboarding!}
          />
        );
      
      case 'DASHBOARD_COMPANY':
        return (
          <Dashboard 
            role={UserRole.COMPANY} 
            onBack={handleLogout} 
            currentCompanyId={currentCompany?.uid}
          />
        );
      
      case 'DASHBOARD_EMPLOYEE':
        return (
          <Dashboard 
            role={UserRole.EMPLOYEE} 
            onBack={handleLogout} 
            currentCompanyId={employeeContext?.companyId}
            employeeContext={employeeContext}
            onSetLocation={handleSetEmployeeLocation}
          />
        );
        
      default:
        return <LandingPage onSelect={handleRoleSelect} />;
    }
  };

  return (
    <div className="min-h-screen w-full text-slate-100 overflow-hidden relative selection:bg-cyan-500/30">
      {renderView()}
      <InstallButton />
    </div>
  );
};

export default App;
