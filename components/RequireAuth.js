'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

export default function RequireAuth({ children, role }) {
  const { user, profile, loading, profileLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // Wait until we know who the user is AND what roles they have
  if (loading || !user || profileLoading) {
    return <div className="wrap page"><p className="sub">Loading…</p></div>;
  }
  // If a role is required, deny unless the profile exists and has it
  if (role && !profile?.roles?.includes(role)) {
    return <div className="wrap page"><h1>Access denied</h1><p className="sub">This page is for {role}s only.</p></div>;
  }
  return children;
}