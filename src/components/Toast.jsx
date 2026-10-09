import { useToastStore } from '../lib/toastStore';

const COLORS = {
  success: '#22C97A',
  error:   '#E8453C',
  info:    '#6B7280',
  warn:    '#F59E0B',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none w-[min(360px,calc(100vw-32px))]">
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          className="pointer-events-auto w-full bg-white rounded-xl shadow-lg border border-[#E0E0E0] px-4 py-3 text-sm font-semibold cursor-pointer"
          style={{ borderLeft: `4px solid ${COLORS[toast.type] ?? COLORS.info}` }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
