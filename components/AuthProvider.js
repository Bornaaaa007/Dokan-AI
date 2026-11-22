'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const Ctx = createContext({ user: null, profile: null, loading: true, signOut: async () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load the matching row from public.users (its id is what the complaints API calls x-user-id)
  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase
      .from('users')
      .select('id,name,roles')
      .eq('auth_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [session]);

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, profile, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}