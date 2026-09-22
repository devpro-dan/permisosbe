import { ReactNode } from 'react';
import { Pencil, Trash2, CheckCircle } from 'lucide-react';

interface DataTableProps {
  columns: { key: string; label: string; render?: (value: any, row: any) => ReactNode }[];
  data: any[];
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onApprove?: (row: any) => void;
  canEdit?: (row: any) => boolean;
  canApprove?: (row: any) => boolean;
}

export function DataTable({ columns, data, onEdit, onDelete, onApprove, canEdit, canApprove }: DataTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">
        No hay registros disponibles
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow hidden md:block">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {col.label}
              </th>
            ))}
            {(onEdit || onDelete || onApprove) && (
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((row, idx) => (
            <tr key={row.id || idx} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
              {(onEdit || onDelete || onApprove) && (
                <td className="px-3 py-4 text-right text-sm">
                  <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                    {onApprove && (!canApprove || canApprove(row)) && (
                      <button onClick={() => onApprove(row)} className="inline-flex items-center gap-1 whitespace-nowrap text-green-600 hover:text-green-800 font-medium">
                        <CheckCircle className="w-3.5 h-3.5" /> Aprobar
                      </button>
                    )}
                    {onEdit && (!canEdit || canEdit(row)) && (
                      <button onClick={() => onEdit(row)} className="inline-flex items-center gap-1 whitespace-nowrap text-blue-600 hover:text-blue-800">
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </button>
                    )}
                    {onDelete && (
                      <button onClick={() => onDelete(row)} className="inline-flex items-center gap-1 whitespace-nowrap text-red-600 hover:text-red-800">
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
