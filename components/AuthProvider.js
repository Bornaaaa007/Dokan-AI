'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const Ctx = createContext({
  user: null, profile: null, loading: true, profileLoading: false,
  signOut: async () => {}, refreshProfile: async () => {},
});
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileUid, setProfileUid] = useState(null); // user id whose profile fetch has finished
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
    if (!session) { setProfile(null); setProfileUid(null); return; }
    const uid = session.user.id;
    let off = false;
    supabase
      .from('users')
      .select('id,name,phone,roles')
      .eq('auth_id', uid)
      .maybeSingle()
      .then(({ data }) => {
        if (off) return;
        setProfile(data ?? null);
        setProfileUid(uid);
      });
    return () => { off = true; };
  }, [session]);

  const refreshProfile = async () => {
    if (!session) return;
    const { data } = await supabase
      .from('users')
      .select('id,name,phone,roles')
      .eq('auth_id', session.user.id)
      .maybeSingle();
    setProfile(data ?? null);
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  // True from the moment a user is logged in until their profile has been fetched
  const profileLoading = !!session && profileUid !== session.user.id;

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, profile, loading, profileLoading, signOut, refreshProfile }}>
      {children}
    </Ctx.Provider>
  );
}