import React from 'react';

export default function ScheduleList({ bookings, selectedDate, onDateChange }) {
  
  const formatTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800/80 p-6 rounded-2xl h-full flex flex-col justify-between">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-400">Schedule</h3>
        <input 
          type="date" 
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="space-y-3 overflow-y-auto flex-1 pr-2 custom-scrollbar max-h-48">
        {bookings.length === 0 ? (
          <div className="text-center text-xs text-slate-500 py-12">No meetings scheduled for this day.</div>
        ) : (
          bookings.map((b) => (
            <div key={b.id} className="flex justify-between items-center bg-slate-900/80 p-3 rounded-xl border border-slate-800/60">
              <div>
                <p className={`text-sm font-semibold ${b.is_private ? 'text-slate-500 italic' : 'text-slate-200'}`}>
                  {b.is_private ? '🔒 Private Meeting' : b.title}
                </p>
              </div>
              <span className="text-xs font-mono bg-slate-800 px-3 py-1.5 rounded-md text-slate-400">
                {formatTime(b.start_time)} - {formatTime(b.end_time)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}