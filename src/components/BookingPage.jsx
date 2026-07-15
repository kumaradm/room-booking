import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import DatePicker from './DatePicker'; 

export default function BookingPage({ roomId, renderHeader, goHome, onSuccess }) {
  const [title, setTitle] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  
  const [date, setDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Dropdown open states
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEndOpen, setIsEndOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);

  // Dropdown references for outside click closing
  const startRef = useRef(null);
  const endRef = useRef(null);
  const userRef = useRef(null);

  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState('success'); 
  const [toastMessage, setToastMessage] = useState('');

  const [usersList, setUsersList] = useState([]);
  const [allBookingsOnDate, setAllBookingsOnDate] = useState([]);

  const parsedDatePickerObject = React.useMemo(() => {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [date]);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .order('full_name', { ascending: true });
      if (!error && data) setUsersList(data);
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchDaySchedule = async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('room_id, booker_id, start_time, end_time')
        .eq('booking_date', date);
      if (!error && data) setAllBookingsOnDate(data);
    };
    fetchDaySchedule();
  }, [date]);

  // Handle clicking outside of custom dropdown menus to close them
  useEffect(() => {
    function handleClickOutside(event) {
      if (startRef.current && !startRef.current.contains(event.target)) setIsStartOpen(false);
      if (endRef.current && !endRef.current.contains(event.target)) setIsEndOpen(false);
      if (userRef.current && !userRef.current.contains(event.target)) setIsUserOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const hh = String(hour).padStart(2, '0');
        const mm = String(min).padStart(2, '0');
        slots.push(`${hh}:${mm}`);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const formatToAmPm = (timeStr) => {
    if (!timeStr) return '';
    const [hourStr, minStr] = timeStr.split(':');
    const hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:${minStr} ${ampm}`;
  };

  const getFilteredStartTimes = () => {
    return timeSlots.filter(time => {
      const timeStr = `${time}:00`;
      const isRoomBusy = allBookingsOnDate.some(b => 
        b.room_id === roomId && b.start_time <= timeStr && b.end_time > timeStr
      );
      const isUserBusy = selectedUserId && allBookingsOnDate.some(b => 
        b.booker_id === selectedUserId && b.start_time <= timeStr && b.end_time > timeStr
      );
      return !isRoomBusy && !isUserBusy;
    });
  };

  const getFilteredEndTimes = () => {
    if (!startTime) return [];
    return timeSlots.filter(time => {
      if (time <= startTime) return false;
      const targetEndTimeStr = `${time}:00`;
      const targetStartTimeStr = `${startTime}:00`;

      const causesOverlappingCollision = allBookingsOnDate.some(b => {
        const isConflictTarget = b.room_id === roomId || b.booker_id === selectedUserId;
        return isConflictTarget && b.start_time >= targetStartTimeStr && b.start_time < targetEndTimeStr;
      });

      return !causesOverlappingCollision;
    });
  };

  const availableStartTimes = getFilteredStartTimes();
  const availableEndTimes = getFilteredEndTimes();

  useEffect(() => {
    if (availableStartTimes.length && !availableStartTimes.includes(startTime)) {
      setStartTime(availableStartTimes[0]);
    }
  }, [date, selectedUserId]);

  useEffect(() => {
    if (availableEndTimes.length && !availableEndTimes.includes(endTime)) {
      setEndTime(availableEndTimes[0]);
    }
  }, [startTime]);

  const handleBooking = async (e) => {
    if (e) e.preventDefault();
    if (!title || !selectedUserId || !startTime || !endTime) {
      setToastType('error');
      setToastMessage('Please fill out all reservation parameters.');
      setShowToast(true);
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase
      .from('bookings')
      .insert([
        {
          room_id: roomId,
          title: title,
          booking_date: date,
          start_time: `${startTime}:00`,
          end_time: `${endTime}:00`,
          is_private: isPrivate,
          booker_id: selectedUserId
        }
      ]);

    setIsSubmitting(false);

    if (error) {
      setToastType('error');
      setToastMessage(`Allocation Error: ${error.message}`);
      setShowToast(true);
    } else {
      setToastType('success');
      setToastMessage('Room allocated successfully!');
      setShowToast(true);
      
      setTimeout(() => {
        onSuccess();
        goHome();
      }, 1800);
    }
  };

  const handleDateChangeFromPicker = (incomingDateObj) => {
    if (incomingDateObj instanceof Date && !isNaN(incomingDateObj)) {
      const year = incomingDateObj.getFullYear();
      const month = String(incomingDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(incomingDateObj.getDate()).padStart(2, '0');
      setDate(`${year}-${month}-${day}`);
    }
    setIsDatePickerOpen(false);
  };

  const selectedUser = usersList.find(u => u.id === selectedUserId);

  return (
    <div className="min-h-screen w-full bg-[#ECECEC] text-slate-100 p-6 font-sans overflow-hidden select-none relative flex flex-col justify-between">
      
      {/* TOAST SYSTEM */}
      <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] ${showToast ? 'translate-y-4 opacity-100' : '-translate-y-12 opacity-0 pointer-events-none'}`}>
        <div className="bg-black/70 backdrop-blur-xl border border-white/10 px-6 py-3.5 rounded-full shadow-[0_24px_50px_-12px_rgba(0,0,0,0.5)] flex items-center gap-3 w-max">
          {toastType === 'success' ? (
            <div className="bg-emerald-500 rounded-full p-1 text-black flex items-center justify-center shadow-inner shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
          ) : (
            <div className="bg-red-500 rounded-full p-1 text-white flex items-center justify-center shadow-inner shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </div>
          )}
          <span className="text-white text-sm sm:text-base font-semibold tracking-tight">{toastMessage}</span>
        </div>
      </div>

      {/* Top Content Layout */}
      <div className="z-10 flex flex-col justify-start items-start h-full w-full gap-5 sm:gap-6 min-h-0 flex-1">
        
        <div className="w-full text-left shrink-0">
          {renderHeader()}
        </div>

        <div className="flex items-center justify-between w-full gap-2">
          <h2 className="text-[1.35rem] sm:text-[1.7rem] lg:text-[2rem] font-semibold tracking-tight text-black">
            Quick Book
          </h2>
          <button 
            type="button"
            onClick={goHome}
            aria-label="Close"
            className="bg-white hover:bg-[#E5E5EA] active:scale-95 text-black border border-neutral-200 rounded-full w-11 h-11 flex items-center justify-center transition shadow-sm shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-4 opacity-70">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main Platter Box */}
        <div className="bg-white backdrop-blur-xl border border-neutral-200/70 rounded-[2rem] overflow-visible shadow-[0_20px_50px_rgba(0,0,0,0.08)] w-full flex flex-col min-h-0 flex-1 p-6 sm:p-8 lg:p-10">
          <form onSubmit={handleBooking} className="w-full flex flex-col justify-between h-full space-y-8 overflow-visible pr-1">
            <div className="space-y-7 sm:space-y-8 text-left">
              
              {/* Row 1: Title Input Row */}
              <div className="flex items-start gap-4 w-full">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-7 text-slate-400 shrink-0 mt-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>

                <div className="flex-1 flex flex-col sm:flex-row gap-4 justify-between items-end border-b border-slate-200 focus-within:border-slate-800 transition-colors pb-2 w-full">
                  <div className="flex-1 flex flex-col gap-0.5 w-full">
                    <label className="text-slate-400 font-bold text-xs uppercase tracking-wider">
                      Title
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g., 'Project Sync'"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="h-11 bg-transparent border-none p-0 text-base sm:text-lg font-semibold text-slate-900 focus:outline-none focus:ring-0 w-full"
                      required
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none mb-1 text-slate-700 shrink-0">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#34C759] after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                    </div>
                    <span className="font-semibold text-sm tracking-tight text-slate-600">
                      Private
                    </span>
                  </label>
                </div>
              </div>

              {/* Row 2: Date and Time Controls Field */}
              <div className="flex items-start gap-4 w-full">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-7 text-slate-400 shrink-0 mt-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>

                <div className="flex-1 flex flex-col gap-1 border-b border-slate-200 focus-within:border-slate-800 transition-colors pb-2.5 w-full">
                  <label className="text-slate-400 font-bold text-xs uppercase tracking-wider">
                    Date and Time
                  </label>
                  
                  <div className="relative flex flex-wrap items-center gap-3 mt-1">
                    
                    {/* Start Time Apple Dropdown */}
                    <div className="relative min-w-[126px]" ref={startRef}>
                      <button
                        type="button"
                        onClick={() => setIsStartOpen(!isStartOpen)}
                        className="w-full flex items-center justify-between rounded-[10px] border border-black/[0.08] bg-black/[0.04] active:bg-black/[0.08] px-3 py-2 text-[13px] sm:text-[14px] font-medium tracking-tight text-slate-800 transition-all cursor-pointer"
                      >
                        <span>{formatToAmPm(startTime)}</span>
                        <svg className="h-3 w-3 text-slate-500 opacity-70 ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                      </button>

                      {isStartOpen && (
                        <div className="absolute left-0 top-full mt-1.5 w-40 max-h-60 overflow-y-auto z-[70] bg-[#FAF9F6]/95 backdrop-blur-xl border border-black/[0.06] rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.15)] p-1 scrollbar-thin">
                          {availableStartTimes.map(time => (
                            <button
                              key={time}
                              type="button"
                              onClick={() => { setStartTime(time); setIsStartOpen(false); }}
                              className={`w-full text-left px-3 py-1.5 text-[13px] rounded-[8px] flex items-center justify-between ${time === startTime ? 'bg-[#007AFF] text-white font-medium' : 'text-slate-900 hover:bg-black/[0.04] font-normal'}`}
                            >
                              <span>{formatToAmPm(time)}</span>
                              {time === startTime && (
                                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <span className="text-base font-semibold text-slate-400">-</span>
                    
                    {/* End Time Apple Dropdown */}
                    <div className="relative min-w-[126px]" ref={endRef}>
                      <button
                        type="button"
                        onClick={() => setIsEndOpen(!isEndOpen)}
                        className="w-full flex items-center justify-between rounded-[10px] border border-black/[0.08] bg-black/[0.04] active:bg-black/[0.08] px-3 py-2 text-[13px] sm:text-[14px] font-medium tracking-tight text-slate-800 transition-all cursor-pointer"
                      >
                        <span>{formatToAmPm(endTime)}</span>
                        <svg className="h-3 w-3 text-slate-500 opacity-70 ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                      </button>

                      {isEndOpen && (
                        <div className="absolute left-0 top-full mt-1.5 w-40 max-h-60 overflow-y-auto z-[70] bg-[#FAF9F6]/95 backdrop-blur-xl border border-black/[0.06] rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.15)] p-1 scrollbar-thin">
                          {availableEndTimes.map(time => (
                            <button
                              key={time}
                              type="button"
                              onClick={() => { setEndTime(time); setIsEndOpen(false); }}
                              className={`w-full text-left px-3 py-1.5 text-[13px] rounded-[8px] flex items-center justify-between ${time === endTime ? 'bg-[#007AFF] text-white font-medium' : 'text-slate-900 hover:bg-black/[0.04] font-normal'}`}
                            >
                              <span>{formatToAmPm(time)}</span>
                              {time === endTime && (
                                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      {/* DatePicker Menu Launcher Tag */}
                      <button
                        type="button"
                        onClick={() => setIsDatePickerOpen(prev => !prev)}
                        className="rounded-[10px] border border-black/[0.08] bg-black/[0.04] active:bg-black/[0.08] px-3 py-2 text-[13px] sm:text-[14px] font-medium tracking-tight text-slate-800 transition-all flex items-center gap-2"
                      >
                        <span>
                          {(() => {
                            const [y, m, d] = date.split('-').map(Number);
                            return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                          })()}
                        </span>
                      </button>

                      {/* Mounted Here: anchored directly under the date button */}
                      {isDatePickerOpen && (
                        <div className="absolute left-0 top-full mt-2 z-[60]">
                          <DatePicker 
                            isOpen={isDatePickerOpen}
                            selectedDate={parsedDatePickerObject} 
                            onSelectDate={handleDateChangeFromPicker} 
                            onClose={() => setIsDatePickerOpen(false)} 
                          />
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>

              {/* Row 3: Organizer Selection Apple Dropdown */}
              <div className="flex items-start gap-4 w-full">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="size-7 text-slate-400 shrink-0 mt-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                <div className="flex-1 flex flex-col gap-0.5 relative border-b border-slate-200 focus-within:border-slate-800 transition-colors pb-2 w-full" ref={userRef}>
                  <label className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">
                    Booked By
                  </label>
                  
                  <button
                    type="button"
                    onClick={() => setIsUserOpen(!isUserOpen)}
                    className="h-11 w-full text-left bg-transparent border-none pl-0 pr-8 text-base sm:text-lg font-semibold text-slate-900 focus:outline-none flex items-center justify-between cursor-pointer"
                  >
                    <span className={selectedUserId ? 'text-slate-900' : 'text-slate-400 font-normal'}>
                      {selectedUser ? `${selectedUser.full_name} (${selectedUser.email})` : 'Select your verified profile account'}
                    </span>
                    <svg className="h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                  </button>

                  {isUserOpen && (
                    <div className="absolute left-0 bottom-full mb-1 w-full max-h-56 overflow-y-auto z-[70] bg-[#FAF9F6]/95 backdrop-blur-xl border border-black/[0.06] rounded-[14px] shadow-[0_10px_35px_rgba(0,0,0,0.18)] p-1.5 scrollbar-thin">
                      {usersList.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => { setSelectedUserId(u.id); setIsUserOpen(false); }}
                          className={`w-full text-left px-3 py-2.5 my-0.5 text-sm rounded-[8px] flex items-center justify-between ${u.id === selectedUserId ? 'bg-[#007AFF] text-white font-medium' : 'text-slate-900 hover:bg-black/[0.04] font-medium'}`}
                        >
                          <span className="truncate">{u.full_name} <span className={`text-xs ml-1 ${u.id === selectedUserId ? 'text-white/80' : 'text-slate-400 font-normal'}`}>({u.email})</span></span>
                          {u.id === selectedUserId && (
                            <svg className="h-4 w-4 fill-current shrink-0 ml-2" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </form>
        </div>
      </div>

      {/* Action Footer Platter Controls */}
      <div className="w-full pt-4 mt-4 shrink-0 flex justify-end items-center z-10 px-0">
        <button 
          type="button"
          onClick={() => handleBooking()}
          disabled={isSubmitting || !availableStartTimes.length}
          className="bg-[#007AFF] hover:bg-[#0066CC] active:scale-[0.98] text-white font-medium px-12 py-2.5 rounded-[2rem] text-[15px] sm:text-[20px] tracking-tight transition-all duration-200 disabled:opacity-30 disabled:pointer-events-none shadow-sm flex items-center gap-2"
        >
          {isSubmitting && (
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          <span>{isSubmitting ? 'Booking...' : 'Book'}</span>
        </button>
      </div>

    </div>
  );
}