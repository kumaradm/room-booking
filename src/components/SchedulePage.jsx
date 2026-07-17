import React, { useState, useEffect, useMemo } from 'react';
import DatePicker from './DatePicker';
import { useMsal } from "@azure/msal-react";

export default function SchedulePage({ roomEmail, renderHeader, goHome }) {
  const { instance } = useMsal();
  const [searchTerm, setSearchTerm] = useState('');
  const [dayOffset, setDayOffset] = useState(0); 
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [liveEvents, setLiveEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Set reference timeline coordinates based on local clock
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

  // Generate exact UTC ISO bounds spanning the FULL LOCAL DAY
  const queryRange = useMemo(() => {
    const startLocal = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
    const endLocal = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    const pad = (n) => String(n).padStart(2, '0');
    const targetDateStr = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;

    return {
      startISO: startLocal.toISOString(),
      endISO: endLocal.toISOString(),
      targetDateStr
    };
  }, [targetDate]);

  // Acquire authentication tokens silently
  const getOutlookToken = async () => {
    const account = instance.getActiveAccount() || instance.getAllAccounts()[0];
    const request = {
      scopes: ["Calendars.Read", "User.Read"],
      account,
    };
    try {
      const silentResponse = await instance.acquireTokenSilent(request);
      return silentResponse.accessToken;
    } catch (err) {
      console.warn("Silent token acquisition failed, using redirect fallback", err);
      await instance.acquireTokenRedirect(request);
      return null;
    }
  };

  // FETCH LIVE DATA DIRECTLY FROM OUTLOOK CALENDAR
  useEffect(() => {
    const fetchOutlookDaySchedule = async () => {
      if (!roomEmail) return;
      setIsLoading(true);
      const token = await getOutlookToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      try {
        const response = await fetch(
          `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(roomEmail)}/calendarView` +
          `?startDateTime=${encodeURIComponent(queryRange.startISO)}&endDateTime=${encodeURIComponent(queryRange.endISO)}`,
          {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Prefer": `outlook.timezone="${localTimezone}"`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          const scheduleItems = (data.value || [])
            .filter(event => {
              const eventStartDate = (event.start?.dateTime || '').split('T')[0];
              return eventStartDate === queryRange.targetDateStr;
            })
            .map(event => {
              const requiredAttendees = (event.attendees || []).filter(
                attendee => attendee.type === 'required'
              );
              const attendeeNames = requiredAttendees
                .map(a => a.emailAddress?.name || a.emailAddress?.address)
                .filter(Boolean)
                .join(', ');
              const finalOrganizer = attendeeNames
                || event.organizer?.emailAddress?.name
                || event.organizer?.emailAddress?.address
                || '';

              return {
                subject: event.subject,
                sensitivity: event.sensitivity,
                start: event.start,
                end: event.end,
                organizer: finalOrganizer
              };
            })
            .sort((a, b) => {
              const aTime = a.start?.dateTime || '';
              const bTime = b.start?.dateTime || '';
              return aTime.localeCompare(bTime);
            });

          setLiveEvents(scheduleItems);
        }
      } catch (err) {
        console.error("Failed to fetch live schedule window from Outlook:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOutlookDaySchedule();
  }, [queryRange, roomEmail]);

  const filteredBookings = useMemo(() => {
    return liveEvents.filter(event => {
      const normalizedSearch = searchTerm.toLowerCase();
      
      const isPrivate = event.sensitivity === 'private';
      const eventTitle = isPrivate ? 'private meeting' : (event.subject || '').toLowerCase();
      
      const organizerName = typeof event.organizer === 'object' 
        ? (event.organizer?.name || event.organizer?.address || '').toLowerCase()
        : (event.organizer || '').toLowerCase();

      const titleMatch = eventTitle.includes(normalizedSearch);
      const hostMatch = organizerName.includes(normalizedSearch);
      
      return titleMatch || hostMatch;
    });
  }, [liveEvents, searchTerm]);

  const formatTime = (timeInput) => {
    if (!timeInput) return "";
    
    const isoString = typeof timeInput === 'object' ? timeInput.dateTime : timeInput;
    if (!isoString) return "";

    const timePart = isoString.split('T')[1] || '';
    const [hours, minutes] = timePart.split(':');
    if (hours === undefined || minutes === undefined) return "";
    
    const hr = parseInt(hours, 10);
    const displayHr = hr % 12 || 12;
    return `${displayHr}:${minutes} ${hr >= 12 ? 'PM' : 'AM'}`;
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
    <div className="min-h-screen w-full bg-[#C5C5C7] text-slate-900 p-6 font-sans overflow-hidden select-none relative flex flex-col">
      <div className="z-10 flex flex-col h-full w-full gap-5 sm:gap-6 min-h-0 flex-1">
        <div className="w-full text-left shrink-0">
          {renderHeader()}
        </div>

        {/* Layout Row matching the second reference image */}
        <div className="flex items-center justify-between w-full mt-2 pr-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <h2 className="text-4xl font-normal tracking-tight text-[#333333] shrink-0">
              Meeting's Schedule
            </h2>

            {/* Date Pill Selector */}
            <div className="relative inline-block text-left shrink-0">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDatePickerOpen(prev => !prev);
                }}
                type="button"
                className="flex items-center gap-1 bg-[#E1E1E4] hover:bg-neutral-300 active:scale-95 text-[#333333] text-sm font-normal px-4 py-2 rounded-full transition-all focus:outline-none shadow-sm"
              >
                <span>
                  {targetDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
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

            {/* Styled Search Box */}
            <div className="relative flex-1 max-w-lg flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="absolute left-4 size-4 text-slate-500 z-20">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.604 10.604Z" />
              </svg>
              <input 
                type="text"
                placeholder="Search Meeting"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#E1E1E4] text-slate-800 placeholder-slate-500 rounded-full pl-10 pr-10 py-2 text-sm w-full focus:outline-none transition-all relative z-10 shadow-sm"
              />
              {/* Mic Icon matches picture right edge input */}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="absolute right-4 size-4 text-slate-500 z-20">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            </div>
          </div>

          <button 
            onClick={goHome}
            aria-label="Close"
            className="bg-white hover:bg-neutral-100 text-black rounded-full w-12 h-12 flex items-center justify-center transition shadow-md shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-6 text-slate-800">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Dynamic Card Container Box */}
        <div className="w-full flex-1 min-h-0 overflow-y-auto pr-1 pb-4 mt-2">
          {isLoading ? (
            <div className="bg-white rounded-[1.5rem] p-10 text-center text-slate-500 text-lg font-medium shadow-sm h-full flex flex-col items-center justify-center border border-neutral-200/60 gap-3">
              <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Synchronizing with Outlook...</span>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-10 text-center text-slate-400 text-xl font-normal shadow-md h-full flex items-center justify-center">
              No Meetings Scheduled
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredBookings.map((event, index) => {
                const isPrivate = event.sensitivity === 'private';
                const displayOrganizer = event.organizer || 'Unknown';

                return (
                  <div 
                    key={index} 
                    className="bg-white rounded-[2rem] flex flex-col justify-center px-8 py-6 hover:bg-neutral-50 transition-all duration-150 text-left shadow-md"
                  >
                    <h4 className={`text-2xl font-semibold tracking-tight truncate ${isPrivate ? 'text-neutral-500 italic' : 'text-slate-900'}`}>
                      {isPrivate ? 'Private Meeting' : (event.subject || 'No Title')}
                    </h4>
                    
                    <div className="flex flex-wrap items-center gap-6 mt-3 text-slate-500">
                      {/* Time Field Block */}
                      <span className="inline-flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5 text-slate-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                        <span className="text-base font-normal text-slate-500">
                          {formatTime(event.start)} - {formatTime(event.end)}
                        </span>
                      </span>

                      {/* User Organizer Block */}
                      <span className="inline-flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5 text-slate-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
                        <span className="text-base font-normal text-slate-500">
                          {displayOrganizer}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}