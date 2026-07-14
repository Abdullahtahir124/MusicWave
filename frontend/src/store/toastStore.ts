import { createContext, useContext } from 'react';
import type { Toast } from '../types';

export interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => string;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
