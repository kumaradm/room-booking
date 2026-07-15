import React, { useState, useEffect } from 'react';

// Added textColor prop (defaults to 'white')
export default function Clock({ textColor = 'white' }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine classes based on the textColor prop
  const isDark = textColor === 'black';
  const mainTextClass = isDark ? 'text-black' : 'text-white';
  const subTextClass = isDark ? 'text-black' : 'text-slate-200/80';

  return (
    <div className="text-right">
      {/* Replaced hardcoded text-white with dynamic mainTextClass */}
      <div className={`text-3xl sm:text-5xl lg:text-4xl font-medium tracking-tight truncate ${mainTextClass}`}>
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
      {/* Replaced hardcoded text-slate-200/80 with dynamic subTextClass */}
      <div className={`sm:text-xl lg:text-xl font-thin gap-2 mt-1 ${subTextClass}`}>
        {time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
    </div>
  );
}