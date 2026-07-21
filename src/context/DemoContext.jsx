import React, { createContext, useContext, useState } from 'react';

const DemoContext = createContext();

export const DemoProvider = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(() => {
    return localStorage.getItem('kiosk_demo_mode') === 'true';
  });

  const toggleDemoMode = () => {
    setIsDemoMode((prev) => {
      const next = !prev;
      localStorage.setItem('kiosk_demo_mode', String(next));
      return next;
    });
  };

  return (
    <DemoContext.Provider value={{ isDemoMode, toggleDemoMode }}>
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
};