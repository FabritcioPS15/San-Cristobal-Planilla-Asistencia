import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { LogOut, User as UserIcon, CalendarCheck } from 'lucide-react';
import PeopleManagement from './PeopleManagement';
import AttendanceManagement from './AttendanceManagement';

interface AuthFormData {
  email: string;
  password: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authFormData, setAuthFormData] = useState<AuthFormData>({ email: '', password: '' });
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [showWelcome, setShowWelcome] = useState<boolean>(true);
  const [currentView, setCurrentView] = useState<'people' | 'attendances' | 'admin'>('people');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => setShowWelcome(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleAuthInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAuthFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, authFormData.email, authFormData.password);
      } else {
        await signInWithEmailAndPassword(auth, authFormData.email, authFormData.password);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Error desconocido');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-indigo-600 py-6 px-8 text-center">
              <h2 className="text-3xl font-bold text-white">Inicio de Sesión</h2>
              <p className="mt-1 text-indigo-200">Ingrese sus credenciales para continuar</p>
            </div>
            
            <form onSubmit={handleAuthSubmit} className="p-8 space-y-6">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12H8m0 0l-4 4m4-4l4-4" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={authFormData.email}
                    onChange={handleAuthInputChange}
                    className="block w-full pl-10 px-4 py-3 rounded-md border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    placeholder="usuario@ejemplo.com"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0-1.1-.9-2-2-2s-2 .9-2 2m4 0c0 1.1-.9 2-2 2s-2-.9-2-2m4 0v1m-4 0v1m4-1h-4" />
                    </svg>
                  </div>
                  <input
                    type="password"
                    name="password"
                    value={authFormData.password}
                    onChange={handleAuthInputChange}
                    className="block w-full pl-10 px-4 py-3 rounded-md border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {authError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {authError}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-3 px-4 rounded-md shadow-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Ingresar
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <div className="flex justify-around bg-white shadow-md sticky top-0 z-10">
        <button
          onClick={() => setCurrentView('people')}
          className={`py-3 px-4 text-center flex flex-col items-center text-xs font-medium w-full ${
            currentView === 'people' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
          }`}
        >
          <UserIcon className="w-5 h-5 mb-1" />
          Personal
        </button>
        <button
          onClick={() => setCurrentView('attendances')}
          className={`py-3 px-4 text-center flex flex-col items-center text-xs font-medium w-full ${
            currentView === 'attendances' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
          }`}
        >
          <CalendarCheck className="w-5 h-5 mb-1" />
          Asistencias
        </button>
        {user.email === 'admin@example.com' && ( // Verifica si el usuario es un administrador
          <button
            onClick={() => setCurrentView('admin')}
            className={`py-3 px-4 text-center flex flex-col items-center text-xs font-medium w-full ${
              currentView === 'admin' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
            }`}
          >
            <LogOut className="w-5 h-5 mb-1" />
            Admin
          </button>
        )}
      </div>

      {/* Contenido principal */}
      <main className="flex-grow">
        {currentView === 'people' && <PeopleManagement />}
        {currentView === 'attendances' && <AttendanceManagement />}
        {currentView === 'admin' && <div>Sección de administración</div>}
      </main>
    </div>
  );
}

export default App;