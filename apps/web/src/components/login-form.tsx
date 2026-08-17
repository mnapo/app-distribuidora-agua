'use client';

import { FormEvent, useState } from 'react';
import { LogIn } from 'lucide-react';
import { apiRequest, AuthResponse } from '../lib/api';

export function LoginForm({ onLogin }: { onLogin: (session: AuthResponse) => void }) {
  const [email, setEmail] = useState('admin@norte.local');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const session = await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password
        })
      });
      onLogin(session);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar sesion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 border border-border bg-white p-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-10 w-full border border-border px-3 text-sm outline-none focus:border-primary"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-10 w-full border border-border px-3 text-sm outline-none focus:border-primary"
          required
        />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-10 items-center justify-center gap-2 bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        <LogIn className="h-4 w-4" />
        {loading ? 'Ingresando' : 'Ingresar'}
      </button>
    </form>
  );
}
