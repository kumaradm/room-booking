import React, { useState } from 'react';

export default function SchedulePage({ bookings, renderHeader, goHome }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dayOffset, setDayOffset] = useState(0); // 0 = Today, 1 = Tomorrow, etc.

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dayOffset);
  const targetDateStr = targetDate.toISOString().split('T')[0];

  const filteredBookings = bookings.filter(b => {
    if (b.booking_date !== targetDateStr) return false;
    
    const titleMatch = b.title.toLowerCase().includes(searchTerm.toLowerCase());
    const hostName = b.users?.full_name || '';
    const hostEmail = b.users?.email || '';
    const hostMatch = hostName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      hostEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    return titleMatch || hostMatch;
  });

  const formatTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':');
    const hr = parseInt(hours, 10);
    return `${hr % 12 || 12}:${minutes} ${hr >= 12 ? 'PM' : 'AM'}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex flex-col justify-between select-none">
      <div>
        {renderHeader()}

        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center mb-6">
          <input 
            type="text"
            placeholder="🔍 Search meeting titles or host names..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-full sm:w-80"
          />

          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button 
              onClick={() => setDayOffset(prev => Math.max(0, prev - 1))}
              disabled={dayOffset === 0}
              className="px-3 py-1.5 text-xs bg-slate-950 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none font-medium transition"
            >
              ◀ Back
            </button>
            <span className="text-xs px-4 font-bold text-slate-200 font-mono tracking-wide">
              {dayOffset === 0 ? "TODAY" : targetDate.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' })}
            </span>
            <button 
              onClick={() => setDayOffset(prev => prev + 1)}
              className="px-3 py-1.5 text-xs bg-slate-950 rounded-lg text-slate-400 hover:text-white font-medium transition"
            >
              Next ▶
            </button>
          </div>
        </div>

        <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-2 custom-scrollbar">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-20 text-slate-600 text-xs font-medium border border-dashed border-slate-900 rounded-2xl">
              No meetings found on this schedule lane.
            </div>
          ) : (
            filteredBookings.map((b) => (
              <div key={b.id} className="flex justify-between items-center bg-slate-900/40 border border-slate-800/60 p-4 rounded-xl">
                <div>
                  <h4 className={`text-sm font-bold ${b.is_private ? 'text-slate-500 italic' : 'text-slate-200'}`}>
                    {b.is_private ? '🔒 Private Meeting' : b.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                    Reserved by: <span className="text-slate-400">{b.users?.full_name || 'System User'}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono bg-slate-900 px-3 py-1.5 rounded-lg text-indigo-400 border border-slate-800">
                    {formatTime(b.start_time)} - {formatTime(b.end_time)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-900 mt-6">
        <button 
          onClick={goHome}
          className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold px-6 py-2.5 rounded-xl text-xs transition shadow-lg"
        >
          🏠 Return Dashboard
        </button>
      </div>
    </div>
  );
}