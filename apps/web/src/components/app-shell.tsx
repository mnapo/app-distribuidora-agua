'use client';

import { useEffect, useState } from 'react';
import { Dashboard } from './dashboard';
import { LoginForm } from './login-form';
import { AuthResponse } from '../lib/api';

const storageKey = 'agua-distri-session';

export function AppShell() {
  const [session, setSession] = useState<AuthResponse | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      setSession(JSON.parse(stored) as AuthResponse);
    }
  }, []);

  function handleLogin(nextSession: AuthResponse) {
    window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
    setSession(nextSession);
  }

  function handleSessionUpdate(nextSession: AuthResponse) {
    window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
    setSession(nextSession);
  }

  function handleLogout() {
    window.localStorage.removeItem(storageKey);
    setSession(null);
  }

  if (session) {
    return <Dashboard session={session} onSessionUpdate={handleSessionUpdate} onLogout={handleLogout} />;
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2 border-b border-border pb-6">
          <p className="text-sm font-semibold uppercase tracking-normal text-primary">Etapa 1</p>
          <h1 className="text-3xl font-semibold tracking-normal">Agua Distri</h1>
          <p className="max-w-3xl text-base leading-7 text-slate-600">
            Nucleo SaaS con autenticacion, tenants, usuarios, roles, permisos y auditoria inicial.
          </p>
        </header>

          <section className="grid gap-6 md:grid-cols-[1fr_380px]">
            <div className="border border-border bg-white p-5">
              <h2 className="text-xl font-semibold">Acceso</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Usar usuarios del seed para validar autenticacion y aislamiento tenant. Platform Admin
                y usuarios de distribuidora ingresan solo con email y password.
              </p>
              <div className="mt-5 grid gap-2 text-sm text-slate-700">
                <p>Tenant Norte: admin@norte.local / Admin123!</p>
                <p>Tenant Sur: admin@sur.local / Admin123!</p>
                <p>Platform: platform@aguadistri.local / Admin123!</p>
              </div>
            </div>
            <LoginForm onLogin={handleLogin} />
          </section>
      </section>
    </main>
  );
}
