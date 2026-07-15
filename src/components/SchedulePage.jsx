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

  // Set reference timeline coordinates based on the device's local clock
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

  // Generate strict, UTC-translated ISO bounds matching the user's local day boundaries
  const queryRange = useMemo(() => {
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    return {
      startISO: start.toISOString(), // Automatically produces UTC "YYYY-MM-DDTHH:MM:SS.sssZ"
      endISO: end.toISOString()
    };
  }, [targetDate]);

  // Acquire authentication tokens silently
  const getOutlookToken = async () => {
    const account = instance.getActiveAccount() || instance.getAllAccounts()[0];
    const request = {
      scopes: ["User.Read"],
      account: account,
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

      // 1. Detect device timezone to format returned event times correctly
      const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      try {
        const response = await fetch(
          `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(roomEmail)}/calendarView` +
          `?startDateTime=${queryRange.startISO}&endDateTime=${queryRange.endISO}`,
          {
            headers: {
              "Authorization": `Bearer ${token}`,
              // 2. Instruct Microsoft to translate the matching payloads back into local time
              "Prefer": `outlook.timezone="${localTimezone}"`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          const scheduleItems = (data.value || []).map(event => {
            // Find attendees marked as 'required'
            const requiredAttendees = (event.attendees || []).filter(
              attendee => attendee.type === 'required'
            );

            // Map to names, fallback to email addresses, and join if there are multiple
            const attendeeNames = requiredAttendees
              .map(a => a.emailAddress?.name || a.emailAddress?.address)
              .filter(Boolean)
              .join(', ');

            // Fallback to the default organizer if no required attendees are present
            const finalOrganizer = attendeeNames || event.organizer?.emailAddress?.name || event.organizer?.emailAddress?.address || '';

            return {
              subject: event.subject,
              sensitivity: event.sensitivity,
              start: event.start,
              end: event.end,
              organizer: finalOrganizer
            };
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

  // Filter local live state values based on the search criteria string
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

  // Helper utility formatting Microsoft payload objects safely into AM/PM
  const formatTime = (timeInput) => {
    if (!timeInput) return "";
    
    const isoString = typeof timeInput === 'object' ? timeInput.dateTime : timeInput;
    if (!isoString) return "";

    // Because Outlook returns data matching our local timezone header config,
    // we can safely extract the time part without UTC adjustment shifting the visual display.
    const timePart = isoString.split('T')[1] || '';
    const [hours, minutes] = timePart.split(':');
    if (!hours || !minutes) return "";
    
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
              Meeting Schedule
            </h2>

            <div className="relative inline-block text-left shrink-0">
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
            className="bg-white hover:bg-[#E5E5EA] text-black border border-neutral-200 rounded-full w-11 h-11 flex items-center justify-center transition shadow-sm group shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-4 opacity-70">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="w-full flex-1 min-h-0 overflow-y-auto pr-1 pb-2">
          {isLoading ? (
            <div className="bg-white rounded-[1.5rem] p-10 text-center text-[#8E8E93] text-lg font-medium shadow-sm h-full flex flex-col items-center justify-center border border-neutral-200/60 gap-3">
              <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Synchronizing with Outlook...</span>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="bg-white rounded-[1.5rem] p-10 sm:p-12 text-center text-[#8E8E93] text-lg sm:text-xl font-medium shadow-sm h-full flex items-center justify-center border border-neutral-200/60">
              No Meetings Scheduled
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredBookings.map((event, index) => {
                const isPrivate = event.sensitivity === 'private';
                const displayOrganizer = typeof event.organizer === 'object'
                  ? (event.organizer?.name || event.organizer?.address || 'Outlook Organizer')
                  : (event.organizer || 'Outlook Organizer');

                return (
                  <div 
                    key={index} 
                    className="bg-white border border-neutral-200/60 rounded-[1.2rem] flex justify-between items-center px-5 sm:px-6 py-4 sm:py-5 hover:bg-neutral-50 transition-all duration-150 text-left shadow-sm"
                  >
                    <div className="min-w-0 text-left">
                      <h4 className={`text-[1rem] sm:text-[1.05rem] font-semibold tracking-tight truncate ${isPrivate ? 'text-neutral-500 italic font-medium' : 'text-[#1C1C1E]'}`}>
                        {isPrivate ? 'Private Meeting' : (event.subject || 'No Title')}
                      </h4>
                      
                      <p className="text-sm sm:text-[0.95rem] text-[#8E8E93] mt-1.5 font-medium truncate flex items-center gap-x-2">
                        <span className="inline-flex items-center gap-0.5">
                          <span className="font-semibold text-neutral-600">
                            {formatTime(event.start)} - {formatTime(event.end)}
                          </span>
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-0.5">
                          <span>{displayOrganizer}</span>
                        </span>
                      </p>
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