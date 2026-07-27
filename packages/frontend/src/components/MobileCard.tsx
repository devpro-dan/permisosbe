import { ReactNode, useEffect } from 'react';

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
            <button onClick={onEdit} className="text-blue-600 text-sm font-medium">
              Editar
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="text-red-600 text-sm font-medium">
              Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
