import React from 'react';

export enum UserRole {
  COMPANY = 'COMPANY',
  EMPLOYEE = 'EMPLOYEE',
  NONE = 'NONE'
}

export type ViewState = 'LANDING' | 'LOGIN_COMPANY' | 'REGISTER_COMPANY' | 'LOGIN_EMPLOYEE' | 'DASHBOARD_COMPANY' | 'DASHBOARD_EMPLOYEE' | 'FACIAL_ONBOARDING';

export interface CompanyData {
  uid?: string; // Firebase Auth UID
  cnpj: string;
  companyName: string;
  whatsapp: string;
  email: string;
  password?: string; // Optional as we don't store it in Firestore
  tenantCode?: string; // Custom code created by the company
}

export interface ServiceLocation {
  id: string;
  companyId: string; // Tenant ID
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number; // Geofence radius in meters
}

export interface Shift {
  id: string;
  companyId?: string;
  name: string; // Ex: "Manhã", "Tarde", "Segunda-Sexta"
  entryTime: string;
  breakTime?: string;
  breakEndTime?: string;
  exitTime: string;
}

export interface Employee {
  id: string;
  companyId: string; // Tenant ID
  name: string;
  cpf: string;
  role: string;
  whatsapp: string;
  shifts: Shift[]; // Array de turnos
  locationIds: string[]; // Changed to array for multiple locations
  workDays?: number[]; // 0=Dom, 1=Seg, ..., 6=Sáb. Padrão [1,2,3,4,5]
  photoBase64?: string; // Reference photo for facial recognition
  pin?: string;
  // Legacy fields (kept for compatibility, but should migrate to shifts array)
  shift?: string;
  entryTime?: string;
  breakTime?: string;
  exitTime?: string;
}

export interface EmployeeContext {
  companyId: string;
  companyName: string;
  locationId?: string;
  locationName?: string;
}

export type AttendanceType = 'ENTRY' | 'BREAK_START' | 'BREAK_END' | 'EXIT';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  companyId: string;
  locationId: string;
  locationName: string;
  timestamp: Date;
  type: AttendanceType;
  latitude: number;
  longitude: number;
  photoBase64?: string; // Foto do reconhecimento facial
  verified: boolean; // Se passou pelo reconhecimento facial
  distance?: number; // Distância do local em metros
  score?: number;
  punctualityStatus?: string;
  punctualityMessage?: string;
}

export interface SelectionCardProps {
  role: UserRole;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: 'cyan' | 'fuchsia';
  onClick: (role: UserRole) => void;
}
