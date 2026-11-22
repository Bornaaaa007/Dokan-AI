'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

export default function RequireAuth({ children, role }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) return <div className="wrap page"><p className="sub">Loading…</p></div>;
  if (role && profile && !profile.roles.includes(role)) {
    return <div className="wrap page"><h1>Access denied</h1><p className="sub">This page is for {role}s only.</p></div>;
  }
  return children;
}