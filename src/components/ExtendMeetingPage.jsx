import React from 'react';

export default function ExtendMeetingPage({
  activeMeeting,
  extendHours = 0,
  setExtendHours,
  extendMinutes = 15,
  setExtendMinutes,
  isExtending = false,
  handleExtendMeeting,
  setCurrentPage,
  renderHeader
}) {

  // Format active meeting's existing end time safely
  const currentEndStr = activeMeeting?.end_time || "05:00 PM";

  // Parse meeting raw date and end time to calculate the dynamically changing new end time
  const getCalculatedNewEndTime = () => {
    try {
      if (!activeMeeting?.end_time) return "05:15 PM";
      
      const [hours24, mins] = activeMeeting.end_time.split(':').map(Number);
      const date = new Date();
      date.setHours(hours24, mins, 0, 0);

      // Add the user's custom extension selection
      date.setMinutes(date.getMinutes() + (extendHours * 60) + extendMinutes);

      let h = date.getHours();
      const m = String(date.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;

      return `${h}:${m} ${ampm}`;
    } catch (e) {
      return "05:15 PM";
    }
  };

  // Human-readable format of raw start/end times for display
  const formatDisplayTime = (rawTime) => {
    if (!rawTime) return "05:00 PM";
    const [hours, minutes] = rawTime.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  const currentEndTimeFormatted = activeMeeting ? formatDisplayTime(activeMeeting.end_time) : "5:00 PM";
  const calculatedNewEndTime = getCalculatedNewEndTime();

  return (
    <div className="min-h-screen w-full bg-[#C2C2C2] text-slate-900 p-6 md:p-10 flex flex-col justify-between font-sans select-none">
      
      {/* 1. Header Area (Brought down from App.jsx dynamically with black styling) */}
      <div className="w-full">
        {renderHeader('black')}
      </div>

      {/* 2. Main Centered Card Area */}
      <div className="flex-1 flex flex-col justify-center items-center py-6">
        <div className="w-full max-w-6xl">
          
          {/* Subheading & Close Button Row */}
          <div className="flex flex-row justify-between items-center mb-5 px-2">
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-[#4A4A4A]">
              Extend Meeting
            </h2>
            <button 
              onClick={() => {
                setExtendHours(0);
                setExtendMinutes(15);
                setCurrentPage('dashboard');
              }}
              className="w-12 h-12 rounded-full bg-white/80 hover:bg-white text-slate-700 flex items-center justify-center shadow-md transition-all active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Centered Main White Control Panel */}
          <div className="bg-white rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] p-10 md:p-14 w-full relative">
            
            <span className="block text-center text-[#9E9E9E] text-xl font-medium mb-6">
              Add Time
            </span>

            {/* Time Adjuster Section */}
            <div className="flex flex-row items-center justify-center gap-6 md:gap-10">
              
              {/* Hours Increment & Decrement Column */}
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => setExtendHours(prev => Math.min(prev + 1, 12))}
                  className="w-14 h-14 rounded-full bg-[#007AFF] text-white flex items-center justify-center shadow transition-all active:scale-90"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                  </svg>
                </button>
                <button 
                  onClick={() => setExtendHours(prev => Math.max(prev - 1, 0))}
                  className="w-14 h-14 rounded-full bg-[#BFBFBF] text-white flex items-center justify-center shadow transition-all active:scale-90"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                  </svg>
                </button>
              </div>

              {/* Huge Timer Digits */}
              <div className="flex flex-col items-center">
                <div className="flex items-center text-[10rem] md:text-[14rem] font-bold text-black tracking-tighter leading-none select-none tabular-nums">
                  <span>{String(extendHours).padStart(2, '0')}</span>
                  <span className="mx-2 -translate-y-4 animate-pulse">:</span>
                  <span>{String(extendMinutes).padStart(2, '0')}</span>
                </div>
                
                {/* Labels row */}
                <div className="flex flex-row w-full justify-between px-10 text-[#7D7D7D] text-lg font-medium">
                  <span>Hours</span>
                  <span>Minutes</span>
                </div>
              </div>

              {/* Minutes Increment & Decrement Column */}
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => setExtendMinutes(prev => (prev >= 45 ? 0 : prev + 15))}
                  className="w-14 h-14 rounded-full bg-[#007AFF] text-white flex items-center justify-center shadow transition-all active:scale-90"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                  </svg>
                </button>
                <button 
                  onClick={() => setExtendMinutes(prev => (prev <= 0 ? 45 : prev - 15))}
                  className="w-14 h-14 rounded-full bg-[#BFBFBF] text-white flex items-center justify-center shadow transition-all active:scale-90"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                  </svg>
                </button>
              </div>

            </div>

            {/* Bottom New End Time Indicator Line */}
            <div className="mt-14 pt-6 border-t border-slate-100 flex items-center gap-4 text-left">
              <div className="text-black/80">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[#8E8E93] text-base font-semibold">New End Time</span>
                <div className="flex items-center gap-3 mt-1 text-black font-semibold text-base">
                  <span className="bg-[#EFEFF4] px-4 py-1.5 rounded-full">{currentEndTimeFormatted}</span>
                  <span className="text-slate-400">—</span>
                  <span className="bg-[#EFEFF4] px-4 py-1.5 rounded-full text-[#007AFF]">{calculatedNewEndTime}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 3. Bottom Action Bar with Styled Blue Button */}
      <div className="w-full max-w-6xl mx-auto flex justify-end items-center">
        <button 
          onClick={handleExtendMeeting}
          disabled={isExtending || (extendHours === 0 && extendMinutes === 0)}
          className="px-14 py-4 bg-[#007AFF] hover:bg-[#006CDD] disabled:opacity-50 text-white font-bold text-xl rounded-full shadow-lg transition-all active:scale-95 flex items-center gap-3"
        >
          {isExtending ? 'Extending...' : 'Extend'}
        </button>
      </div>

    </div>
  );
}