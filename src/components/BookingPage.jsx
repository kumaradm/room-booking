import React, { useState, useEffect, useRef, useMemo } from 'react';
import DatePicker from './DatePicker'; 
import { useMsal } from "@azure/msal-react";
import { supabase } from '../supabaseClient'; 

export default function BookingPage({ roomId, renderHeader, goHome, onSuccess }) {
  const { instance } = useMsal();
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

  // States for corporate directories and room details
  const [usersList, setUsersList] = useState([]);
  const [allBookingsOnDate, setAllBookingsOnDate] = useState([]);
  const [room, setRoom] = useState(null);

  // FETCH ROOM DETAILS FROM SUPABASE VIA UUID
  useEffect(() => {
    if (!roomId || roomId === 'undefined') return;

    const fetchRoom = async () => {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('id, name, email, capacity')
          .eq('id', roomId)
          .single();

        if (error) throw error;
        if (data) setRoom(data);
      } catch (err) {
        console.error("Error loading room meta properties:", err);
      }
    };
    
    fetchRoom();
  }, [roomId]);

  // --- BACKGROUND SILENT TOKEN ACQUISITION ---
  const getOutlookToken = async (customScopes = ["Calendars.ReadWrite", "Calendars.Read.Shared", "User.Read"]) => {
    const account = instance.getActiveAccount() || instance.getAllAccounts()[0];
    const request = {
      scopes: customScopes,
      account: account,
    };

    try {
      const silentResponse = await instance.acquireTokenSilent(request);
      return silentResponse.accessToken;
    } catch (silentError) {
      console.warn("Silent token acquisition failed, attempting fallback redirect...", silentError);
      try {
        await instance.acquireTokenRedirect(request);
      } catch (redirectError) {
        console.error("Microsoft redirect authentication request failed:", redirectError);
      }
      return null;
    }
  };

  const parsedDatePickerObject = useMemo(() => {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [date]);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Load verified team accounts
  useEffect(() => {
    const trustedPeople = [
      { id: "1", full_name: "Agus Pajrin J", email: "agus.pajrin@outlook.com" },
      { id: "2", full_name: "Mayta Kamila", email: "mayta.kamila@outlook.com" },
      { id: "3", full_name: "Yoseph H Paskarino", email: "yoseph.h@outlook.com" }
    ];
    setUsersList(trustedPeople);
  }, []);

  // Fetch busy schedule directly for the selected room via getSchedule API
  const fetchRoomScheduleForDate = async (targetRoomEmail, targetDateStr) => {
    const token = await getOutlookToken();
    if (!token || !targetRoomEmail) return [];

    const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Build start and end dates in ISO format for the full day
    const startIso = `${targetDateStr}T00:00:00`;
    const endIso = `${targetDateStr}T23:59:59`;

    try {
      const response = await fetch("https://graph.microsoft.com/v1.0/me/calendar/getSchedule", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Prefer": `outlook.timezone="${localTimezone}"`
        },
        body: JSON.stringify({
          schedules: [targetRoomEmail],
          startTime: { dateTime: startIso, timeZone: localTimezone },
          endTime: { dateTime: endIso, timeZone: localTimezone },
          availabilityViewInterval: 15
        })
      });

      if (!response.ok) {
        console.error("Failed to fetch schedule from Graph API");
        return [];
      }

      const data = await response.json();
      const scheduleData = data.value?.[0];
      const items = scheduleData?.scheduleItems || [];

      // Map busy slots into { start_time: 'HH:mm:ss', end_time: 'HH:mm:ss' }
      return items
        .filter(item => item.status !== "free" && item.status !== "workingElsewhere")
        .map(item => {
          const startTimePart = (item.start?.dateTime || '').split('T')[1]?.substring(0, 8) || '00:00:00';
          let endTimePart = (item.end?.dateTime || '').split('T')[1]?.substring(0, 8) || '23:59:59';
          if (endTimePart === '00:00:00') endTimePart = '23:59:59';

          return {
            start_time: startTimePart,
            end_time: endTimePart
          };
        });
    } catch (err) {
      console.error("Error fetching room schedule:", err);
      return [];
    }
  };

  // Trigger schedule fetch when room or date changes
  useEffect(() => {
    if (!room || !room.email) return;

    const loadSchedule = async () => {
      const busySlots = await fetchRoomScheduleForDate(room.email, date);
      setAllBookingsOnDate(busySlots);
    };

    loadSchedule();
  }, [date, room]);

  // Outside Click closing listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (startRef.current && !startRef.current.contains(event.target)) setIsStartOpen(false);
      if (endRef.current && !endRef.current.contains(event.target)) setIsEndOpen(false);
      if (userRef.current && !userRef.current.contains(event.target)) setIsUserOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const hh = String(hour).padStart(2, '0');
        const mm = String(min).padStart(2, '0');
        slots.push(`${hh}:${mm}`);
      }
    }
    return slots;
  }, []);

  const formatToAmPm = (timeStr) => {
    if (!timeStr) return '';
    const [hourStr, minStr] = timeStr.split(':');
    const hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${String(displayHour).padStart(2, '0')}:${minStr} ${ampm}`;
  };

  // --- FILTERED TIMES (PREVENTS COLLISION IN UI) ---
  const availableStartTimes = useMemo(() => {
    return timeSlots.filter(time => {
      const timeStr = `${time}:00`;
      const isRoomBusy = allBookingsOnDate.some(b => 
        timeStr >= b.start_time && timeStr < b.end_time
      );
      return !isRoomBusy;
    });
  }, [timeSlots, allBookingsOnDate]);

  const availableEndTimes = useMemo(() => {
    if (!startTime) return [];
    return timeSlots.filter(time => {
      if (time <= startTime) return false;
      const targetStartTimeStr = `${startTime}:00`;
      const targetEndTimeStr = `${time}:00`;

      const causesOverlappingCollision = allBookingsOnDate.some(b => 
        targetStartTimeStr < b.end_time && targetEndTimeStr > b.start_time
      );

      return !causesOverlappingCollision;
    });
  }, [startTime, timeSlots, allBookingsOnDate]);

  useEffect(() => {
    if (availableStartTimes.length && !availableStartTimes.includes(startTime)) {
      setStartTime(availableStartTimes[0]);
    }
  }, [date, allBookingsOnDate, availableStartTimes]);

  useEffect(() => {
    if (availableEndTimes.length && !availableEndTimes.includes(endTime)) {
      setEndTime(availableEndTimes[0]);
    }
  }, [startTime, allBookingsOnDate, availableEndTimes]);

  // --- SUBMIT RESERVATION WITH STRICT PRE-FLIGHT LOCK ---
  const handleBooking = async (e) => {
    if (e) e.preventDefault();
    
    if (!room || !room.email) {
      setToastType('error');
      setToastMessage('Room data or room email is missing. Please try again.');
      setShowToast(true);
      return;
    }
    if (!title || !selectedUserId || !startTime || !endTime) {
      setToastType('error');
      setToastMessage('Please fill out all reservation fields.');
      setShowToast(true);
      return;
    }

    setIsSubmitting(true);

    const outlookToken = await getOutlookToken();
    if (!outlookToken) {
      setIsSubmitting(false);
      return;
    }

    const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const startDateTime = `${date}T${startTime}:00`;
    const endDateTime = `${date}T${endTime}:00`;
    const targetStartTimeStr = `${startTime}:00`;
    const targetEndTimeStr = `${endTime}:00`;

    try {
      // 1. PRE-FLIGHT CHECK: Re-query room's schedule immediately before booking to avoid double-booking
      const freshBusySlots = await fetchRoomScheduleForDate(room.email, date);

      const isNowDoubleBooked = freshBusySlots.some(b => 
        targetStartTimeStr < b.end_time && targetEndTimeStr > b.start_time
      );

      if (isNowDoubleBooked) {
        setAllBookingsOnDate(freshBusySlots);
        setIsSubmitting(false);
        
        setToastType('error');
        setToastMessage('Slot Unavailable! This time window was just reserved by another user.');
        setShowToast(true);
        return;
      }

      // 2. Prepare payload including both user attendee AND room resource email
      const selectedUserObj = usersList.find(u => u.id === selectedUserId);

      const eventPayload = {
        subject: title,
        sensitivity: isPrivate ? "private" : "normal",
        start: { dateTime: startDateTime, timeZone: localTimezone },
        end: { dateTime: endDateTime, timeZone: localTimezone },
        location: { 
          displayName: room.name,
          locationEmailAddress: room.email 
        },
        attendees: [
          {
            emailAddress: {
              address: selectedUserObj?.email || '',
              name: selectedUserObj?.full_name || ''
            },
            type: "required"
          },
          {
            emailAddress: {
              address: room.email,
              name: room.name
            },
            type: "resource"
          }
        ]
      };

      // 3. Post event to Microsoft Graph
      const outlookResponse = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${outlookToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventPayload)
      });

      if (!outlookResponse.ok) {
        throw new Error("Calendar service rejected the reservation request.");
      }

      setToastType('success');
      setToastMessage('Room booked successfully!');
      setShowToast(true);
      setIsSubmitting(false); 
      
      setTimeout(() => {
        try {
          if (typeof onSuccess === 'function') onSuccess();
          if (typeof goHome === 'function') goHome();
        } catch (callbackErr) {
          console.error("Navigation error:", callbackErr);
        }
      }, 1800);

    } catch (err) {
      setToastType('error');
      setToastMessage(`Booking Failed: ${err.message}`);
      setShowToast(true);
      setIsSubmitting(false);
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
    <div className="min-h-screen w-full bg-[#C5C5C7] text-slate-900 p-6 font-sans overflow-hidden select-none relative flex flex-col justify-between">
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

      {/* Main Integrated Form Context Wrapper */}
      <form onSubmit={handleBooking} className="z-10 flex flex-col justify-start items-start h-full w-full gap-5 sm:gap-6 min-h-0 flex-1">
        <div className="w-full text-left shrink-0">
          {renderHeader()}
        </div>

        <div className="flex items-center justify-between w-full pr-4 mt-2">
          <h2 className="text-4xl font-normal tracking-tight text-[#333333]">
            Quick Book
          </h2>
          <button 
            type="button"
            onClick={goHome}
            aria-label="Close"
            className="bg-white hover:bg-neutral-100 active:scale-95 text-black rounded-full w-12 h-12 flex items-center justify-center transition shadow-md shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-6 text-slate-800">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main Platter Box */}
        <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col min-h-0 flex-1 p-8 sm:p-10 lg:p-12 mt-2">
          <div className="w-full flex flex-col justify-between h-full space-y-12 overflow-visible">
            <div className="space-y-12 text-left">
              
              {/* Row 1: Title Input Row */}
              <div className="flex items-center gap-6 w-full">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-8 text-black shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                </svg>

                <div className="flex-1 flex flex-row gap-4 justify-between items-center border-b border-neutral-200 pb-3 w-full">
                  <input 
                    type="text" 
                    placeholder="Add Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-11 bg-transparent border-none p-0 text-xl font-normal text-neutral-400 placeholder-neutral-400 focus:text-neutral-800 focus:outline-none focus:ring-0 w-full"
                    required
                  />

                  <label className="flex items-center gap-3 cursor-pointer select-none mb-1 text-slate-700 shrink-0">
                    <span className="font-normal text-lg tracking-tight text-neutral-400">
                      Private
                    </span>
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:bg-[#34C759] after:content-[''] after:absolute after:top-[3px] after:start-[3px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all shadow-inner"></div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Row 2: Date and Time Controls Field */}
              <div className="flex items-center gap-6 w-full">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-8 text-black shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>

                <div className="flex-1 flex flex-col gap-1.5 border-b border-neutral-200 pb-4 w-full">
                  <span className="text-neutral-400 text-lg font-normal">
                    Date and Time
                  </span>
                  
                  <div className="relative flex flex-wrap items-center gap-3 mt-1">
                    
                    {/* Start Time Dropdown */}
                    <div className="relative min-w-[130px]" ref={startRef}>
                      <button
                        type="button"
                        onClick={() => setIsStartOpen(!isStartOpen)}
                        className="w-full flex items-center justify-between rounded-full bg-neutral-100 hover:bg-neutral-200 active:scale-95 px-4 py-2 text-base font-normal text-neutral-800 transition-all cursor-pointer"
                      >
                        <span>{formatToAmPm(startTime)}</span>
                      </button>

                      {isStartOpen && (
                        <div className="absolute left-0 top-full mt-1.5 w-40 max-h-60 overflow-y-auto z-[70] bg-white border border-neutral-200 rounded-[12px] shadow-lg p-1">
                          {availableStartTimes.map(time => (
                            <button
                              key={time}
                              type="button"
                              onClick={() => { setStartTime(time); setIsStartOpen(false); }}
                              className={`w-full text-left px-3 py-1.5 text-sm rounded-[8px] flex items-center justify-between ${time === startTime ? 'bg-[#007AFF] text-white font-medium' : 'text-slate-900 hover:bg-neutral-100 font-normal'}`}
                            >
                              <span>{formatToAmPm(time)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <span className="text-lg font-normal text-neutral-800">—</span>
                    
                    {/* End Time Dropdown */}
                    <div className="relative min-w-[130px]" ref={endRef}>
                      <button
                        type="button"
                        onClick={() => setIsEndOpen(!isEndOpen)}
                        className="w-full flex items-center justify-between rounded-full bg-neutral-100 hover:bg-neutral-200 active:scale-95 px-4 py-2 text-base font-normal text-neutral-800 transition-all cursor-pointer"
                      >
                        <span>{formatToAmPm(endTime)}</span>
                      </button>

                      {isEndOpen && (
                        <div className="absolute left-0 top-full mt-1.5 w-40 max-h-60 overflow-y-auto z-[70] bg-white border border-neutral-200 rounded-[12px] shadow-lg p-1">
                          {availableEndTimes.map(time => (
                            <button
                              key={time}
                              type="button"
                              onClick={() => { setEndTime(time); setIsEndOpen(false); }}
                              className={`w-full text-left px-3 py-1.5 text-sm rounded-[8px] flex items-center justify-between ${time === endTime ? 'bg-[#007AFF] text-white font-medium' : 'text-slate-900 hover:bg-neutral-100 font-normal'}`}
                            >
                              <span>{formatToAmPm(time)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      {/* DatePicker Launcher */}
                      <button
                        type="button"
                        onClick={() => setIsDatePickerOpen(prev => !prev)}
                        className="rounded-full bg-neutral-100 hover:bg-neutral-200 active:scale-95 px-5 py-2 text-base font-normal text-neutral-800 transition-all flex items-center gap-2"
                      >
                        <span>
                          {(() => {
                            const [y, m, d] = date.split('-').map(Number);
                            return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                          })()}
                        </span>
                      </button>

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

              {/* Row 3: Organizer Selection Dropdown */}
              <div className="flex items-center gap-6 w-full">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-8 text-black shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                <div className="flex-1 flex flex-col relative border-b border-neutral-200 pb-3 w-full" ref={userRef}>
                  <button
                    type="button"
                    onClick={() => setIsUserOpen(!isUserOpen)}
                    className="h-11 w-full text-left bg-transparent border-none pl-0 pr-8 text-xl font-normal text-neutral-400 focus:outline-none flex items-center justify-between cursor-pointer"
                  >
                    <span className={selectedUserId ? 'text-neutral-800 font-normal' : 'text-neutral-400 font-normal'}>
                      {selectedUser ? `${selectedUser.full_name}` : 'Booked by'}
                    </span>
                  </button>

                  {isUserOpen && (
                    <div className="absolute left-0 top-full mt-1 w-full max-h-56 overflow-y-auto z-[70] bg-white border border-neutral-200 rounded-[14px] shadow-xl p-1.5">
                      {usersList.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => { setSelectedUserId(u.id); setIsUserOpen(false); }}
                          className={`w-full text-left px-3 py-2.5 my-0.5 text-sm rounded-[8px] flex items-center justify-between ${u.id === selectedUserId ? 'bg-[#007AFF] text-white font-medium' : 'text-slate-900 hover:bg-neutral-100 font-medium'}`}
                        >
                          <span className="truncate">{u.full_name} <span className={`text-xs ml-1 ${u.id === selectedUserId ? 'text-white/80' : 'text-slate-400 font-normal'}`}>({u.email})</span></span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Action Footer Button */}
        <div className="w-full pt-4 mt-2 shrink-0 flex justify-end items-center z-10">
          <button 
            type="submit"
            disabled={isSubmitting || !availableStartTimes.length}
            className="bg-[#0084FD] hover:bg-[#0071db] active:scale-[0.98] text-white font-medium px-16 py-3 rounded-full text-lg tracking-wide transition-all duration-200 disabled:opacity-30 disabled:pointer-events-none shadow-md flex items-center gap-2"
          >
            {isSubmitting && (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span>Book</span>
          </button>
        </div>

      </form>
    </div>
  );
}