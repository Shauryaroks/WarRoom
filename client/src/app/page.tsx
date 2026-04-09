'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace('/game');
      } else {
        router.replace('/register');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-[#FFB000] tracking-widest uppercase text-sm animate-pulse">
        Initializing...
      </div>
    </div>
  );
}