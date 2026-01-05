import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RouteLoading } from './components/RouteLoading';
import './App.css';

const Welcome = lazy(() => import('./pages/Welcome'));
const History = lazy(() => import('./pages/History'));
const Account = lazy(() => import('./pages/Account'));
const Login = lazy(() => import('./pages/Login'));

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/flipside" element={<History />} />
          <Route path="/account" element={<Account />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
