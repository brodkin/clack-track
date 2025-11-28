import { Routes, Route } from 'react-router-dom';
import { Welcome } from './pages/Welcome';
import { History } from './pages/History';
import { Account } from './pages/Account';
import { Login } from './pages/Login';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/flipside" element={<History />} />
      <Route path="/account" element={<Account />} />
      <Route path="/login" element={<Login />} />
    </Routes>
  );
}

export default App;
