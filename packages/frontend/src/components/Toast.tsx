import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface ToastData {
  message: string;
  type: 'success' | 'error';
}

let showToastFn: ((data: ToastData) => void) | null = null;

export function toast(data: ToastData) {
  showToastFn?.(data);
}

export function Toast() {
  const [data, setData] = useState<ToastData | null>(null);

  useEffect(() => {
    showToastFn = setData;
    return () => { showToastFn = null; };
  }, []);

  const dismiss = useCallback(() => setData(null), []);

  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(dismiss, 3000);
    return () => clearTimeout(timer);
  }, [data, dismiss]);

  if (!data) return null;

  const bg = data.type === 'success' ? 'bg-success-600' : 'bg-danger-600';

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className={`${bg} text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md`}>
        <span className="text-sm">{data.message}</span>
        <button onClick={dismiss} className="text-white/80 hover:text-white p-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
