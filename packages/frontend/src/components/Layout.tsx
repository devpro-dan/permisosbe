import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Toast } from './Toast';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8">
        <Outlet />
      </main>
      <Toast />
    </div>
  );
}
