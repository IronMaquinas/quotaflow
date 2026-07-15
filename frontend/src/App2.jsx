// src/App2.jsx
import { useState } from 'react';
import TelaLogin from './TelaLogin';

export default function App2() {
  console.log('🚀 APPTESTE está rodando!');
  const [usuario, setUsuario] = useState(null);

  const login = (user) => {
    console.log('🔍 login chamado', user);
    setUsuario(user);
  };

  if (!usuario) {
    return <TelaLogin onLogin={login} />;
  }

  return <h1 style={{ color: 'white', padding: 40 }}>Logado com sucesso!</h1>;
}