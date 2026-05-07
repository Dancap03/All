import './App.css'
import { useState } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Layout from './Layout.jsx';
import Dashboard from './pages/Dashboard';
import Gym from './pages/Gym';
import Finanzas from './pages/Finanzas';
import Calendario from './pages/Calendario';

// FORMULARIO DE LOGIN PRIVADO
const SimpleLogin = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch (err) {
      setError('Correo o contraseña incorrectos');
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <form onSubmit={handleLogin} className="flex flex-col gap-4 p-8 border rounded-lg bg-card w-[90%] max-w-sm shadow-lg text-foreground">
        <h2 className="text-2xl font-bold text-center">Mi Área Privada</h2>
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <input type="email" placeholder="Tu correo de Firebase" className="p-2 border rounded bg-background" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="Tu contraseña" className="p-2 border rounded bg-background" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit" className="p-2 bg-primary text-primary-foreground rounded font-bold hover:opacity-90">Entrar</button>
      </form>
    </div>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">Cargando tu espacio...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <SimpleLogin />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/gym" element={<Gym />} />
        <Route path="/finanzas" element={<Finanzas />} />
        <Route path="/calendario" element={<Calendario />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
