

import { Users, LayoutDashboard, Clock, FolderOpen, Settings, DollarSign, LogOut, Bot, Receipt, Briefcase } from 'lucide-react';

export const APP_NAME = "QUALITY M&E-HRMS";
export const CURRENCY = "SGD";

export const NAV_ITEMS = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Employees', path: '/employees', icon: Users },
  { name: 'Attendance', path: '/attendance', icon: Clock },
  { name: 'Payroll', path: '/payroll', icon: DollarSign },
  { name: 'Expenses', path: '/expenses', icon: Receipt },
  { name: 'Worker Documents', path: '/reports', icon: FolderOpen },
  { name: 'Office Documents', path: '/office-documents', icon: Briefcase },
  { name: 'AI Assistant', path: '/ai-assistant', icon: Bot },
];

// Constants for formulas
export const WORKING_DAYS_PER_MONTH = 26;
export const HOURS_PER_DAY = 8;
export const OT_MULTIPLIER = 1.5;
