import { Outlet, useLocation } from 'react-router';
import { Navigation } from '../components/Navigation';
import { useEffect, useState } from 'react';

export function Root() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <Navigation />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}