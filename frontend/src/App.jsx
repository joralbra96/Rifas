import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, LogIn, LogOut, Phone, MapPin, Tag, RefreshCcw } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function App() {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [view, setView] = useState('sales'); // 'sales', 'admin'
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [adminData, setAdminData] = useState([]);

  useEffect(() => {
    if (token) {
      fetchTickets();
    }
  }, [token]);

  const fetchTickets = async () => {
    try {
      const response = await axios.get(`${API_URL}/tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTickets(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        handleLogout();
      } else {
        alert('Error cargando los números');
      }
    }
  };

  const fetchAdminTickets = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdminData(response.data);
    } catch (error) {
      handleLogout();
    }
  };

  const handleBuy = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/tickets/${selectedTicket}/buy`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('¡Venta registrada con éxito!');
      setSelectedTicket(null);
      setFormData({ name: '', phone: '', address: '' });
      fetchTickets();
      if (view === 'admin') fetchAdminTickets();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al registrar venta');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/login`, loginData);
      localStorage.setItem('token', response.data.token);
      setToken(response.data.token);
      setView('sales');
    } catch (error) {
      alert('Credenciales inválidas');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setAdminData([]);
    setTickets([]);
  };

  const resetTicket = async (number) => {
    if (!confirm(`¿Seguro que quieres liberar el número ${number}?`)) return;
    try {
      await axios.post(`${API_URL}/admin/tickets/${number}/reset`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAdminTickets();
      fetchTickets();
    } catch (error) {
      alert('Error al resetear');
    }
  };

  const handleDownloadCsv = () => {
    const soldTickets = adminData.filter(t => t.status === 'sold');
    if (soldTickets.length === 0) {
      alert('No hay ventas para exportar');
      return;
    }

    const headers = ['Numero', 'Nombre', 'Telefono', 'Direccion'];
    const csvContent = [
      headers.join(','),
      ...soldTickets.map(t => [t.number, `"${t.name}"`, `"${t.phone}"`, `"${t.address || ''}"`].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'ventas_rifa.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-indigo-600">Rifas 200</h1>
            <p className="text-gray-500 mt-2">Inicia sesión para gestionar ventas</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Usuario</label>
              <input
                type="text"
                required
                className="mt-1 block w-full border rounded-md p-2"
                value={loginData.username}
                onChange={e => setLoginData({...loginData, username: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contraseña</label>
              <input
                type="password"
                required
                className="mt-1 block w-full border rounded-md p-2"
                value={loginData.password}
                onChange={e => setLoginData({...loginData, password: e.target.value})}
              />
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-md font-bold hover:bg-indigo-700 transition">
              Entrar
                  </button>
                </form>
                  </div>
                </div>
  );
}

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <nav className="max-w-6xl mx-auto flex justify-between items-center mb-8 bg-white p-4 rounded-lg shadow-sm">
        <h1 className="text-2xl font-bold text-indigo-600">Rifas 200</h1>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => {
              const nextView = view === 'admin' ? 'sales' : 'admin';
              setView(nextView); 
              if (nextView === 'admin') fetchAdminTickets();
              if (nextView === 'sales') fetchTickets();
            }} 
            className="text-indigo-600 font-semibold px-4 py-2 hover:bg-indigo-50 rounded-md transition"
          >
            {view === 'admin' ? 'Registrar Ventas' : 'Ver Panel Admin'}
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 text-red-500 hover:bg-red-50 px-4 py-2 rounded-md transition">
            <LogOut size={20} /> Salir
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto">
        {view === 'sales' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <h2 className="text-xl font-semibold mb-4">Selecciona un número para vender</h2>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {tickets.map(t => (
                  <button
                    key={t.number}
                    onClick={() => t.status === 'available' && setSelectedTicket(t.number)}
                    disabled={t.status === 'sold'}
                    className={`h-12 rounded flex items-center justify-center font-bold text-sm transition-all
                      ${t.status === 'sold'
                        ? 'bg-red-100 text-red-400 cursor-not-allowed border-red-200 border'
                        : 'bg-white text-gray-700 border-2 border-indigo-100 hover:border-indigo-500 hover:scale-105 shadow-sm'
                      }
                      ${selectedTicket === t.number ? 'ring-4 ring-indigo-500 bg-indigo-50 border-transparent' : ''}
                    `}
                  >
                    {t.number}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg h-fit sticky top-8 border border-indigo-50">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Tag className="text-indigo-600" />
                {selectedTicket ? `Venta: Número ${selectedTicket}` : 'Selecciona un número'}
              </h2>
              {selectedTicket ? (
                <form onSubmit={handleBuy} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nombre del Comprador</label>
                    <input
                      required
                      type="text"
                      placeholder="Ej: Juan Pérez"
                      className="mt-1 block w-full border rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Teléfono / WhatsApp</label>
                    <input
                      required
                      type="tel"
                      placeholder="Ej: 123456789"
                      className="mt-1 block w-full border rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Dirección (Opcional)</label>
                    <input
                      type="text"
                      className="mt-1 block w-full border rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={formData.address}
                      onChange={e => setFormData({...formData, address: e.target.value})}
                    />
                  </div>
                  <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-md font-bold hover:bg-green-700 transition shadow-md">
                    Registrar Venta
                  </button>
                  <button type="button" onClick={() => setSelectedTicket(null)} className="w-full text-gray-500 text-sm hover:underline">
                    Cancelar
                  </button>
                </form>
              ) : (
                <div className="text-center py-8">
                  <div className="bg-gray-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Tag className="text-gray-300" size={32} />
                  </div>
                  <p className="text-gray-500 italic">Haz clic en una casilla disponible para registrar la venta.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'admin' && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Control de Ventas</h2>
                <p className="text-sm text-gray-500">Resumen de todos los números</p>
              </div>
              <button onClick={fetchAdminTickets} className="p-2 hover:bg-gray-200 rounded-full transition">
                <RefreshCcw size={20} className="text-gray-600" />
              </button>
            </div>
            <div className="flex justify-end mt-4 mb-6">
              <button
                onClick={handleDownloadCsv}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-flex items-center transition"
              >
                <svg className="fill-current w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10-4.486-10-10-10zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"/><path d="M13 13h-2v-4h2v4zm0 4h-2v-2h2v2z"/></svg>
                <span>Descargar Ventas (CSV)</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold">
                  <tr>
                    <th className="px-6 py-4">Nº</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">Comprador</th>
                    <th className="px-6 py-4">Teléfono</th>
                    <th className="px-6 py-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {adminData.map(t => (
                    <tr key={t.number} className={t.status === 'sold' ? 'hover:bg-gray-50' : 'bg-gray-50/50 opacity-60'}>
                      <td className="px-6 py-4 font-bold text-indigo-600">#{t.number}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${t.status === 'sold' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                          {t.status === 'sold' ? 'Vendido' : 'Disponible'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">{t.name || '-'}</td>
                      <td className="px-6 py-4 text-sm">{t.phone || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        {t.status === 'sold' ? (
                          <button onClick={() => resetTicket(t.number)} className="text-red-500 hover:text-red-700 text-sm font-medium">
                            Liberar Número
                          </button>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

