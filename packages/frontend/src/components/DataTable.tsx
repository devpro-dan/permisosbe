import { ReactNode } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

interface DataTableProps {
  columns: { key: string; label: string; render?: (value: any, row: any) => ReactNode }[];
  data: any[];
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
}

export function DataTable({ columns, data, onEdit, onDelete }: DataTableProps) {
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
            {(onEdit || onDelete) && (
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
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
              {(onEdit || onDelete) && (
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-3">
                  {onEdit && (
                    <button onClick={() => onEdit(row)} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800">
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                  )}
                  {onDelete && (
                    <button onClick={() => onDelete(row)} className="inline-flex items-center gap-1 text-red-600 hover:text-red-800">
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
