import React, { useState, useMemo } from 'react';

export default function SchedulePage({ bookings, renderHeader, goHome }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dayOffset, setDayOffset] = useState(0); // 0 = Today, 1 = Tomorrow, etc.
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Core calendar navigation states (tracked when user opens custom picker)
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

  // Anchor point representing absolute start of today
  const todayDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Compute targeted view date properties from dayOffset
  const targetDate = useMemo(() => {
    const d = new Date(todayDate);
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [dayOffset, todayDate]);

  // FIX: Safely parse year-month-day locally instead of .toISOString() to avoid UTC timezone shifts
  const targetDateStr = useMemo(() => {
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [targetDate]);

  // Generates month selections dynamically (5 years forward, 2 years back)
  const yearsArray = useMemo(() => {
    const currentY = new Date().getFullYear();
    const range = [];
    for (let y = currentY - 2; y <= currentY + 5; y++) {
      range.push(y);
    }
    return range;
  }, []);

  const monthsArray = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Dynamic Month Engine: Generates exact calendar days layout for selected month/year
  const calendarGridDays = useMemo(() => {
    const firstDayOfMonth = new Date(pickerYear, pickerMonth, 1);
    const lastDayOfMonth = new Date(pickerYear, pickerMonth + 1, 0);
    
    const totalDays = lastDayOfMonth.getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon, etc.
    
    const days = [];
    
    // Padding spaces for days from previous month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add real days of current month
    for (let day = 1; day <= totalDays; day++) {
      days.push(new Date(pickerYear, pickerMonth, day));
    }
    
    return days;
  }, [pickerMonth, pickerYear]);

  // Handle derived bookings filter logic cleanly
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (b.booking_date !== targetDateStr) return false;
      
      const normalizedSearch = searchTerm.toLowerCase();
      const titleMatch = b.title?.toLowerCase().includes(normalizedSearch);
      const hostName = b.users?.full_name || '';
      const hostEmail = b.users?.email || '';
      const hostMatch = hostName.toLowerCase().includes(normalizedSearch) || 
                        hostEmail.toLowerCase().includes(normalizedSearch);
      
      return titleMatch || hostMatch;
    });
  }, [bookings, targetDateStr, searchTerm]);

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(':');
    const hr = parseInt(hours, 10);
    return `${hr % 12 || 12}:${minutes} ${hr >= 12 ? 'PM' : 'AM'}`;
  };

  // Maps absolute calendar selection back to relative dayOffset tracker
  const handleSelectCalendarDay = (dateObj) => {
    if (!dateObj) return;
    
    const targetZero = new Date(dateObj);
    targetZero.setHours(0, 0, 0, 0);

    const differenceInTime = targetZero.getTime() - todayDate.getTime();
    const differenceInDays = Math.round(differenceInTime / (1000 * 3600 * 24));
    setDayOffset(differenceInDays);
    setIsDatePickerOpen(false);
  };

  const handleOpenPicker = () => {
    setPickerMonth(targetDate.getMonth());
    setPickerYear(targetDate.getFullYear());
    setIsDatePickerOpen(true);
  };

  return (
    <div className="min-h-screen w-full bg-[#C7C7CC] text-slate-100 p-6 sm:p-8 lg:p-12 font-sans overflow-hidden select-none relative flex flex-col justify-between">
      
      {/* Top Main Content Layout */}
      <div className="z-10 flex flex-col justify-start items-start h-full w-full gap-5 sm:gap-6 min-h-0 flex-1">
        
        <div className="text-white w-full text-left">
          {renderHeader()}
        </div>

        {/* Title, Pagination, and Close Button Control Row */}
        <div className="flex items-center justify-between w-full mb-1 gap-4">
          <div className="flex flex-wrap items-center gap-6 justify-start">
            <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white">
              Meeting Schedule
            </h2>

            {/* iOS Segmented Date Control Switcher */}
            <div className="flex items-center bg-white/40 backdrop-blur-md p-1 rounded-2xl border border-white/20 shadow-md shrink-0 relative">
              <button 
                onClick={() => setDayOffset(prev => prev - 1)}
                className="p-3 text-slate-700 hover:text-slate-900 transition rounded-xl z-20 relative bg-transparent border-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="size-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </button>
              
              <button 
                onClick={handleOpenPicker}
                type="button"
                className="relative px-6 py-3 min-w-[160px] flex items-center justify-center gap-2 group focus:outline-none bg-transparent border-0"
              >
                <span className="text-sm font-extrabold tracking-wide text-slate-800 uppercase group-hover:text-neutral-900 transition-colors select-none z-10">
                  {dayOffset === 0 ? "Today" : targetDate.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' })}
                </span>
                
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 text-slate-600 group-hover:text-neutral-800 transition-colors mt-0.5 z-10">
                  <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
              
              <button 
                onClick={() => setDayOffset(prev => prev + 1)}
                className="p-3 text-slate-700 hover:text-slate-900 transition rounded-xl z-20 relative bg-transparent border-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="size-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>

          <button 
            onClick={goHome}
            aria-label="Close"
            className="bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm border border-white/20 rounded-full w-12 h-12 flex items-center justify-center transition shadow-lg group shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="size-5 group-hover:scale-110 transition-transform">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Separated Meeting List Container */}
        <div className="w-full flex-1 min-h-0 overflow-y-auto pr-1">
          {filteredBookings.length === 0 ? (
            /* Centered Element Configuration Block inside a matching individual container */
            <div className="bg-white/70 backdrop-blur-xl border border-white/20 rounded-3xl p-12 text-center text-slate-500 text-3xl font-semibold shadow-2xl h-full flex items-center justify-center">
              No Meetings Scheduled
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredBookings.map((b) => (
                <div 
                  key={b.id} 
                  className="bg-white/70 backdrop-blur-xl border border-white/20 rounded-2xl flex justify-between items-center px-8 py-5 sm:py-6 hover:bg-white/90 transition-all duration-200 group text-left shadow-md hover:shadow-lg hover:-translate-y-0.5"
                >
                  <div className="min-w-0 pr-6 text-left">
                    <h4 className={`text-lg sm:text-xl font-bold tracking-tight truncate ${b.is_private ? 'text-slate-500 font-normal italic' : 'text-slate-900'}`}>
                      {b.is_private ? '🔒 Private Meeting' : b.title}
                    </h4>
                    <p className="text-sm text-slate-600 mt-1 font-semibold truncate">
                      Hosted by <span className="text-slate-800 font-bold">{b.users?.full_name || 'Organizer'}</span>
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-sm sm:text-base font-bold tracking-tight text-indigo-700 bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-full border border-indigo-100 shadow-sm">
                      {formatTime(b.start_time)} - {formatTime(b.end_time)}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-5 text-slate-400 group-hover:text-slate-600 transition-colors hidden md:block">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Search Area Layer */}
      <div className="w-full pt-4 mt-4 shrink-0 flex justify-center items-center z-10 px-0">
        <div className="relative w-full max-w-md flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="absolute left-4 size-5 text-white/80 z-20">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.604 10.604Z" />
          </svg>
          <input 
            type="text"
            placeholder="Search title or host"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-[#8E8E93]/80 backdrop-blur-md text-white placeholder-white/60 border border-white/10 rounded-2xl pl-12 pr-5 py-3.5 text-base w-full focus:outline-none focus:bg-[#8E8E93] transition-all shadow-2xl relative z-10"
          />
        </div>
      </div>

      {/* LARGER FULL-SCREEN GLASS DATE PICKER MODAL */}
      {isDatePickerOpen && (
        <div className="absolute inset-0 z-50 bg-[#C7C7CC]/60 backdrop-blur-2xl flex flex-col justify-center items-center p-4 sm:p-8 md:p-12 animate-fade-in">
          <div className="w-full max-w-4xl bg-white/95 backdrop-blur-xl border border-white/40 rounded-[2rem] p-6 sm:p-10 shadow-2xl relative flex flex-col gap-6 md:gap-8 my-auto">
            
            {/* Header with Large Controls */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center border-b border-slate-200/60 pb-6">
              <div className="flex items-center gap-4">
                {/* Month Dropdown */}
                <select 
                  value={pickerMonth} 
                  onChange={(e) => setPickerMonth(parseInt(e.target.value, 10))}
                  className="bg-[#8E8E93]/15 hover:bg-[#8E8E93]/25 text-[#1F1F21] font-black text-xl md:text-2xl px-5 py-3 rounded-2xl focus:outline-none border border-slate-200/50 transition-all cursor-pointer appearance-none shadow-sm pr-10 relative bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%20%22%20fill%3D%22%231F1F21%22%3E%3Cpath%20d%3D%22M5.22%208.22a.75.75%200%20011.06%200L10%2011.94l3.72-3.72a.75.75%200%20111.06%201.06l-4.25%204.25a.75.75%200%2001-1.06%200L5.22%209.28a.75.75%200%20010-1.06z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5rem] bg-[right_0.75rem_center] bg-no-repeat"
                >
                  {monthsArray.map((mName, index) => (
                    <option key={index} value={index}>{mName}</option>
                  ))}
                </select>

                {/* Year Dropdown */}
                <select 
                  value={pickerYear} 
                  onChange={(e) => setPickerYear(parseInt(e.target.value, 10))}
                  className="bg-[#8E8E93]/15 hover:bg-[#8E8E93]/25 text-[#1F1F21] font-black text-xl md:text-2xl px-5 py-3 rounded-2xl focus:outline-none border border-slate-200/50 transition-all cursor-pointer appearance-none shadow-sm pr-10 relative bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%20%22%20fill%3D%22%231F1F21%22%3E%3Cpath%20d%3D%22M5.22%208.22a.75.75%200%20011.06%200L10%2011.94l3.72-3.72a.75.75%200%20111.06%201.06l-4.25%204.25a.75.75%200%2001-1.06%200L5.22%209.28a.75.75%200%20010-1.06z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5rem] bg-[right_0.75rem_center] bg-no-repeat"
                >
                  {yearsArray.map((yearVal) => (
                    <option key={yearVal} value={yearVal}>{yearVal}</option>
                  ))}
                </select>
              </div>
              
              <button 
                onClick={() => setIsDatePickerOpen(false)}
                className="bg-[#1F1F21] hover:bg-neutral-800 text-white rounded-2xl px-8 py-3 text-base font-bold transition-all shadow-md active:scale-98"
              >
                Close Calendar
              </button>
            </div>

            {/* Seven-Day Weekday Labels (Bigger Typography) */}
            <div className="grid grid-cols-7 text-center text-sm font-black tracking-widest text-slate-400 uppercase border-b border-slate-100 pb-3">
              <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
            </div>

            {/* EXPANDED CALENDAR DAY GRID MATRIX */}
            <div className="grid grid-cols-7 gap-3 md:gap-4 flex-1 items-center">
              {calendarGridDays.map((dayObj, idx) => {
                if (dayObj === null) {
                  return <div key={`empty-${idx}`} className="h-16 sm:h-20 w-full invisible" />;
                }

                const year = dayObj.getFullYear();
                const month = String(dayObj.getMonth() + 1).padStart(2, '0');
                const day = String(dayObj.getDate()).padStart(2, '0');
                const blockDateStr = `${year}-${month}-${day}`;

                const isActiveSelection = blockDateStr === targetDateStr;
                const isSystemToday = dayObj.getTime() === todayDate.getTime();

                return (
                  <button
                    key={blockDateStr}
                    type="button"
                    onClick={() => handleSelectCalendarDay(dayObj)}
                    className={`h-16 sm:h-20 w-full rounded-2xl font-bold text-lg md:text-xl flex flex-col items-center justify-center relative transition-all border shadow-sm ${
                      isActiveSelection
                        ? 'bg-[#1F1F21] text-white border-transparent shadow-lg font-black scale-95'
                        : 'bg-white hover:bg-slate-50 border-slate-200/80 text-[#1F1F21]'
                    }`}
                  >
                    <span>{dayObj.getDate()}</span>
                    
                    {/* System Day Dot Indicator */}
                    {isSystemToday && !isActiveSelection && (
                      <span className="absolute bottom-2 w-2 h-2 bg-indigo-600 rounded-full shadow-sm" />
                    )}
                  </button>
                );
              })}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}