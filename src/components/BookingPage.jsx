import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

export default function BookingPage({ roomId, renderHeader, goHome, onSuccess }) {
  const [title, setTitle] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  
  // FIX: Safely initialize initial state using local YYYY-MM-DD instead of .toISOString()
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
  const [teamsLink, setTeamsLink] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Embedded contextual Toast notification controls 
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState('success'); // 'success' | 'error'
  const [toastMessage, setToastMessage] = useState('');

  const [usersList, setUsersList] = useState([]);
  const [allBookingsOnDate, setAllBookingsOnDate] = useState([]);
  
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

  const todayDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

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

  const calendarGridDays = useMemo(() => {
    const firstDayOfMonth = new Date(pickerYear, pickerMonth, 1);
    const lastDayOfMonth = new Date(pickerYear, pickerMonth + 1, 0);
    
    const totalDays = lastDayOfMonth.getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= totalDays; day++) {
      days.push(new Date(pickerYear, pickerMonth, day));
    }
    return days;
  }, [pickerMonth, pickerYear]);

  // Handle auto-closing toast timelines
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

  // FIX: Safely build local date template blocks instead of parsing via .toISOString()
  const handleSelectCalendarDay = (dateObj) => {
    if (!dateObj) return;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    setDate(`${year}-${month}-${day}`);
    setIsDatePickerOpen(false);
  };

  const handleOpenPicker = () => {
    // Safely parse local components to open target frame
    const [y, m, d] = date.split('-').map(Number);
    const currentSelection = new Date(y, m - 1, d);
    setPickerMonth(currentSelection.getMonth());
    setPickerYear(currentSelection.getFullYear());
    setIsDatePickerOpen(true);
  };

  return (
    <div className="min-h-screen w-full bg-[#C7C7CC] text-slate-100 p-6 sm:p-8 lg:p-12 font-sans overflow-hidden select-none relative flex flex-col justify-between">
      
      {/* APP STYLE DYNAMIC TOAST SHEETS */}
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

      {/* Top Content Stack */}
      <div className="z-10 flex flex-col justify-start items-start h-full w-full gap-5 sm:gap-6 min-h-0 flex-1">
        
        <div className="text-white w-full text-left">
          {renderHeader()}
        </div>

        {/* Dynamic Layout Control Row synced with Schedule View Layout */}
        <div className="flex items-center justify-between w-full mb-1 gap-4">
          <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white">
            Quick Book
          </h2>

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

        {/* Schedule Style Frosted Glass Platter View */}
        <div className="bg-white/70 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-2xl w-full flex flex-col min-h-0 flex-1 p-6 sm:p-8">
          <form onSubmit={handleBooking} className="w-full flex flex-col justify-between h-full space-y-6 overflow-y-auto pr-1">
            <div className="space-y-6 text-left">
              
              {/* Title Input & Privacy Switch Row */}
              <div className="flex flex-col md:flex-row gap-5 items-stretch md:items-end">
                <div className="flex-1 flex flex-col gap-2 w-full">
                  <label className="text-slate-700 font-bold text-sm sm:text-base flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="size-5 text-slate-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                    Title
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g., 'Project Sync'"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-14 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 text-base font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-300 transition-all w-full shadow-sm"
                    required
                  />
                </div>

                {/* Private Meeting Toggle switch */}
                <label className="flex items-center justify-between px-5 h-14 bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200 cursor-pointer md:w-64 w-full shrink-0 select-none hover:bg-white transition-colors shadow-sm">
                  <span className="text-slate-700 font-bold text-sm sm:text-base flex items-center gap-2">
                    Private Meeting
                  </span>
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1F1F21]"></div>
                  </div>
                </label>
              </div>

              {/* User Dropdown Selector Row */}
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 font-bold text-sm sm:text-base flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="size-5 text-slate-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  Organizer
                </label>
                <div className="relative">
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="h-14 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl px-4 text-base font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-slate-300 w-full cursor-pointer appearance-none shadow-sm"
                    required
                  >
                    <option value="" disabled hidden>Select your verified profile account</option>
                    {usersList.map(u => (
                      <option key={u.id} value={u.id} className="bg-white text-slate-900 font-medium">
                        {u.full_name} ({u.email})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              {/* Window Segment Inner Platter */}
              <div className="bg-white/40 border border-white/40 p-5 sm:p-6 rounded-2xl space-y-4 shadow-sm">
                <span className="text-xs text-indigo-800 font-black uppercase tracking-wider flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Reservation Window
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  
                  {/* Customized Screen Picker Trigger */}
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 font-bold text-sm sm:text-base">Target Date</label>
                    <button
                      type="button"
                      onClick={handleOpenPicker}
                      className="h-14 bg-white border border-slate-200 rounded-2xl px-4 text-base font-bold text-slate-800 focus:outline-none w-full text-left flex justify-between items-center hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      <span>
                        {(() => {
                          const [y, m, d] = date.split('-').map(Number);
                          return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                        })()}
                      </span>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-5 text-slate-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                      </svg>
                    </button>
                  </div>

                  {/* Start Time Select */}
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 font-bold text-sm sm:text-base">Start Time</label>
                    <div className="relative">
                      <select 
                        value={startTime} 
                        onChange={(e) => setStartTime(e.target.value)} 
                        className="h-14 bg-white border border-slate-200 rounded-2xl px-4 text-base font-bold text-slate-800 focus:outline-none w-full cursor-pointer appearance-none shadow-sm"
                      >
                        {availableStartTimes.map(time => (
                          <option key={time} value={time} className="text-slate-900 font-semibold">{time}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                        <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>
                  </div>

                  {/* End Time Select */}
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 font-bold text-sm sm:text-base">End Time</label>
                    <div className="relative">
                      <select 
                        value={endTime} 
                        onChange={(e) => setEndTime(e.target.value)} 
                        className="h-14 bg-white border border-slate-200 rounded-2xl px-4 text-base font-bold text-slate-800 focus:outline-none w-full cursor-pointer appearance-none shadow-sm"
                      >
                        {availableEndTimes.map(time => (
                          <option key={time} value={time} className="text-slate-900 font-semibold">{time}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                        <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Teams Integration Row (with toggle) */}
              <div className="pt-2">
                <label className="flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200 cursor-pointer select-none hover:bg-white transition-colors shadow-sm">
                  <span className="text-slate-700 font-bold text-sm sm:text-base flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="size-5 text-slate-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
                    </svg>
                    Teams Meeting
                  </span>
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      checked={teamsLink}
                      onChange={(e) => setTeamsLink(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white handler-toggle after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1F1F21]"></div>
                  </div>
                </label>
              </div>

            </div>
          </form>
        </div>
      </div>

      {/* Action Footer Button Layout */}
      <div className="w-full pt-4 mt-4 shrink-0 flex justify-end items-center z-10 px-0">
        <button 
          type="button"
          onClick={() => handleBooking()}
          disabled={isSubmitting || !availableStartTimes.length}
          className="bg-[#1F1F21] hover:bg-neutral-800 text-white font-extrabold px-8 py-3.5 rounded-2xl text-base transition disabled:opacity-40 shadow-xl flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          {isSubmitting ? 'Confirming...' : 'Reserve Space'}
        </button>
      </div>

      {/* COHESIVE LARGER FULL-SCREEN DATE PICKER MODAL */}
      {isDatePickerOpen && (
        <div className="absolute inset-0 z-50 bg-[#C7C7CC]/60 backdrop-blur-2xl flex flex-col justify-center items-center p-4 sm:p-8 md:p-12 animate-fade-in">
          <div className="w-full max-w-4xl bg-white/95 backdrop-blur-xl border border-white/40 rounded-[2rem] p-6 sm:p-10 shadow-2xl relative flex flex-col gap-6 md:gap-8 my-auto">
            
            <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center border-b border-slate-200/60 pb-6">
              <div className="flex items-center gap-4">
                <select 
                  value={pickerMonth} 
                  onChange={(e) => setPickerMonth(parseInt(e.target.value, 10))}
                  className="bg-[#8E8E93]/15 hover:bg-[#8E8E93]/25 text-[#1F1F21] font-black text-xl md:text-2xl px-5 py-3 rounded-2xl focus:outline-none border border-slate-200/50 transition-all cursor-pointer appearance-none shadow-sm pr-10 relative bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%20%22%20fill%3D%22%231F1F21%22%3E%3Cpath%20d%3D%22M5.22%208.22a.75.75%200%20011.06%200L10%2011.94l3.72-3.72a.75.75%200%20111.06%201.06l-4.25%204.25a.75.75%200%2001-1.06%200L5.22%209.28a.75.75%200%20010-1.06z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.5rem] bg-[right_0.75rem_center] bg-no-repeat"
                >
                  {monthsArray.map((mName, index) => (
                    <option key={index} value={index}>{mName}</option>
                  ))}
                </select>

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
                type="button"
                onClick={() => setIsDatePickerOpen(false)}
                className="bg-[#1F1F21] hover:bg-neutral-800 text-white rounded-2xl px-8 py-3 text-base font-bold transition-all shadow-md"
              >
                Close Calendar
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-sm font-black tracking-widest text-slate-400 uppercase border-b border-slate-100 pb-3">
              <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
            </div>

            <div className="grid grid-cols-7 gap-3 md:gap-4 flex-1 items-center">
              {calendarGridDays.map((dayObj, idx) => {
                if (dayObj === null) {
                  return <div key={`empty-${idx}`} className="h-16 sm:h-20 w-full invisible" />;
                }

                // FIX: Map calendar layout directly via local component methods
                const year = dayObj.getFullYear();
                const month = String(dayObj.getMonth() + 1).padStart(2, '0');
                const day = String(dayObj.getDate()).padStart(2, '0');
                const blockDateStr = `${year}-${month}-${day}`;
                
                const isActiveSelection = blockDateStr === date;
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