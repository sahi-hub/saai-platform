'use client';

import React, { ReactNode } from 'react';
import Image from 'next/image';

interface Theme {
  primaryColor: string;
  secondaryColor: string;
  headerTitle: string;
  logoUrl: string;
}

interface ChatLayoutProps {
  tenantId: string;
  theme: Theme;
  children: ReactNode;
  inputComponent: ReactNode;
}

export default function ChatLayout({ 
  tenantId,
  theme,
  children, 
  inputComponent 
}: ChatLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Fixed Header with Theme */}
      <header 
        className="sticky top-0 z-10 border-b border-slate-200 shadow-sm"
        style={{ backgroundColor: theme.primaryColor }}
      >
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Logo */}
              {theme.logoUrl && theme.logoUrl !== '/default-logo.png' ? (
                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-white">
                  <Image 
                    src={theme.logoUrl} 
                    alt="Tenant Logo" 
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                  <span className="text-slate-700 text-lg font-bold">AI</span>
                </div>
              )}
              
              {/* Title */}
              <div>
                <h1 className="text-xl font-semibold text-white">
                  {theme.headerTitle}
                </h1>
                <p className="text-sm text-white/80 mt-0.5">
                  Tenant: {tenantId}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable Messages Area */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {children}
        </div>
      </main>

      {/* Fixed Input Bar */}
      <footer className="sticky bottom-0 bg-white border-t border-slate-200 shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {inputComponent}
        </div>
      </footer>
    </div>
  );
}
