import { ReactNode, useEffect } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

interface MobileCardProps {
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MobileCard({ children, onEdit, onDelete }: MobileCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-3 md:hidden">
      <div className="space-y-2">{children}</div>
      {(onEdit || onDelete) && (
        <div className="flex justify-end gap-3 mt-3 pt-3 border-t">
          {onEdit && (
            <button onClick={onEdit} className="flex items-center gap-1 text-blue-600 text-sm font-medium">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="flex items-center gap-1 text-red-600 text-sm font-medium">
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
