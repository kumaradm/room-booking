import React, { useState, useEffect } from 'react';

export default function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-right">
      <div className="text-4xl font-light tracking-wide tabular-nums text-white">
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-wider">
        {time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
      </div>
    </div>
  );
}