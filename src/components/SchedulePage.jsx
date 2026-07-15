import React, { useState, useMemo } from 'react';
import DatePicker from './DatePicker';

export default function SchedulePage({ bookings, renderHeader, goHome }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dayOffset, setDayOffset] = useState(0); 
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const todayDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const targetDate = useMemo(() => {
    const d = new Date(todayDate);
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [dayOffset, todayDate]);

  const targetDateStr = useMemo(() => {
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [targetDate]);

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

  const handleSelectCalendarDay = (dateObj) => {
    const targetZero = new Date(dateObj);
    targetZero.setHours(0, 0, 0, 0);

    const differenceInTime = targetZero.getTime() - todayDate.getTime();
    const differenceInDays = Math.round(differenceInTime / (1000 * 3600 * 24));
    setDayOffset(differenceInDays);
    setIsDatePickerOpen(false);
  };

  return (
    <div className="min-h-screen w-full bg-[#F2F2F7] text-[#1C1C1E] p-6 font-sans overflow-hidden select-none relative flex flex-col">
      <div className="z-10 flex flex-col h-full w-full gap-5 sm:gap-6 min-h-0 flex-1">
        <div className="w-full text-left shrink-0">
          {renderHeader()}
        </div>

        <div className="flex flex-wrap items-center justify-between w-full gap-2">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 justify-start flex-1 min-w-0">
            <h2 className="text-[1.35rem] sm:text-[1.7rem] lg:text-[2rem] font-semibold tracking-tight text-black">
              Meeting's Schedule
            </h2>

            {/* Anchor wrapper container */}
            <div className="relative inline-block text-left shrink-0">
              {/* Added e.stopPropagation() to allow toggling close smoothly */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDatePickerOpen(prev => !prev);
                }}
                type="button"
                className="flex items-center gap-1.5 bg-[#E5E5EA] hover:bg-[#D1D1D6] active:scale-95 text-black text-sm sm:text-base font-medium px-4 py-2.5 rounded-full transition-all focus:outline-none shadow-sm"
              >
                <span>
                  {dayOffset === 0 ? "Today" : targetDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5 opacity-80">
                  <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>

              {isDatePickerOpen && (
                <div className="absolute left-0 top-full mt-2 z-[60]">
                  <DatePicker 
                    isOpen={isDatePickerOpen}
                    onClose={() => setIsDatePickerOpen(false)}
                    selectedDate={targetDate}
                    onSelectDate={handleSelectCalendarDay}
                  />
                </div>
              )}
            </div>

            <div className="relative flex-1 min-w-[180px] flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="absolute left-3.5 size-4 text-[#8E8E93] z-20">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.604 10.604Z" />
              </svg>
              <input 
                type="text"
                placeholder="Search title or host"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#E5E5EA]/80 text-black placeholder-[#8E8E93] rounded-full pl-10 pr-4 py-2.5 text-sm sm:text-base w-full focus:outline-none focus:bg-[#E5E5EA] transition-all relative z-10 shadow-sm"
              />
            </div>
          </div>

          <button 
            onClick={goHome}
            aria-label="Close"
            className="bg-white hover:bg-[#E5E5EA] active:scale-95 text-black border border-neutral-200 rounded-full w-11 h-11 flex items-center justify-center transition shadow-sm group shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-4 opacity-70">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="w-full flex-1 min-h-0 overflow-y-auto pr-1 pb-2">
          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-[1.5rem] p-10 sm:p-12 text-center text-[#8E8E93] text-lg sm:text-xl font-medium shadow-sm h-full flex items-center justify-center border border-neutral-200/60">
              No Meetings Scheduled
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredBookings.map((b) => (
                <div 
                  key={b.id} 
                  className="bg-white border border-neutral-200/60 rounded-[1.2rem] flex justify-between items-center px-5 sm:px-6 py-4 sm:py-5 hover:bg-neutral-50 transition-all duration-150 text-left shadow-sm"
                >
                  <div className="min-w-0 text-left">
                    <h4 className={`text-[1rem] sm:text-[1.05rem] font-semibold tracking-tight truncate ${b.is_private ? 'text-neutral-500 italic font-medium' : 'text-[#1C1C1E]'}`}>
                      {b.is_private ? 'Private Meeting' : b.title}
                    </h4>
                    
                    <p className="text-sm sm:text-[0.95rem] text-[#8E8E93] mt-1.5 font-medium truncate flex items-center gap-x-2">
                      <span className="inline-flex items-center gap-0.5">
                        <span className="font-semibold text-neutral-600">{formatTime(b.start_time)} - {formatTime(b.end_time)}</span>
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-0.5">
                        <span>{b.users?.full_name || 'Organizer'}</span>
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}