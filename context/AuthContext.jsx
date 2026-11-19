import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { getSetting, setSetting } from '../utils/database';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [guest, setGuest] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.auth.getSession().then(({ data: { session } }) => session?.user ?? null).catch(() => null),
      getSetting('guest_mode', '0').catch(() => '0'),
    ]).then(([u, g]) => {
      setUser(u);
      setGuest(g === '1');
      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function continueAsGuest() {
    await setSetting('guest_mode', '1');
    setGuest(true);
  }

  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await setSetting('guest_mode', '0');
    setGuest(false);
  }

  return (
    <AuthContext.Provider value={{ user, guest, ready, signIn, signUp, signOut, continueAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
