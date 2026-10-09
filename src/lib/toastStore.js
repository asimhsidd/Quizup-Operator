import { create } from 'zustand';

let _nextId = 1;

export const useToastStore = create((set) => ({
  toasts: [],

  addToast(message, type = 'info') {
    const id = _nextId++;
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
    // Auto-dismiss after 3.5s
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
    }, 3500);
  },

  removeToast(id) {
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
  },
}));
