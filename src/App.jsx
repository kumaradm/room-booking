import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useMsal, useIsAuthenticated, MsalProvider } from "@azure/msal-react"; 
import { PublicClientApplication, InteractionStatus } from "@azure/msal-browser";
import Clock from './components/Clock';
import SchedulePage from './components/SchedulePage';
import BookingPage from './components/BookingPage';
import OccupancySensor from './components/OccupancySensor';
import { supabase } from './supabaseClient';

const msalConfig = {
  auth: {
    clientId: "10126d5f-6b01-491d-9eb1-2d1b27298605",
    authority: "https://login.microsoftonline.com/common",
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: true,
  }
};

const msalInstance = new PublicClientApplication(msalConfig);

// --- INNER APP LOGIC (Consumes MSAL Context Safely) ---
function AppContent({ isMsalInitialized }) {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const [currentPage, setCurrentPage] = useState('dashboard');
  const [room, setRoom] = useState(null);
  const [bookings, setBookings] = useState([]); 
  const [isPersonDetected, setIsPersonDetected] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false); 
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showToast, setShowToast] = useState(false);
  const [isAuthResolving, setIsAuthResolving] = useState(true);

  // Extend Page State
  const [extendHours, setExtendHours] = useState(0);
  const [extendMinutes, setExtendMinutes] = useState(15);
  const [isExtending, setIsExtending] = useState(false);

  const emptyMinutesRef = useRef(0);
  const lastActiveMeetingIdRef = useRef(null);
  const lastMinuteRef = useRef('');

  // Get token helper for Graph API calls
  const getOutlookToken = async () => {
    const account = instance.getActiveAccount() || instance.getAllAccounts()[0];
    const request = {
      scopes: ["Calendars.ReadWrite", "User.Read"],
      account: account,
    };
    try {
      const response = await instance.acquireTokenSilent(request);
      return response.accessToken;
    } catch (err) {
      console.warn("Silent token fallback routing active...", err);
      return null;
    }
  };

// --- MICROSOFT UPFRONT AUTHENTICATION LOGIC ---
useEffect(() => {
  if (!isMsalInitialized) return;
  
  // 1. If MSAL is currently processing a redirect or token, freeze and wait.
  if (inProgress !== InteractionStatus.None) return;
  
  const accounts = instance.getAllAccounts();

  // 2. SAFETY CHECK: If accounts exist, but isAuthenticated is briefly false 
  // during state transitions, DO NOT redirect! Just wait for MSAL to catch up.
  if (accounts.length > 0) {
    if (!instance.getActiveAccount()) {
      instance.setActiveAccount(accounts[0]);
    }
    setIsAuthResolving(false);
    return; // Stop here, do not trigger a login redirect!
  }

  // 3. Only redirect if there are absolutely no accounts found and we aren't authenticated.
  if (!isAuthenticated && accounts.length === 0) {
    instance.loginRedirect({
      scopes: ["Calendars.ReadWrite", "User.Read"]
    }).catch(err => {
      console.error("Redirect login failed to initiate:", err);
    });
  } else {
    setIsAuthResolving(false);
  }
}, [instance, isMsalInitialized, inProgress, isAuthenticated]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  const timeToMinutes = (tStr) => {
    if (!tStr) return 0;
    const [h, m] = tStr.split(':').map(Number);
    return h * 60 + m;
  };

  const timeStrings = useMemo(() => {
    return {
      timeStr: currentTime.toTimeString().split(' ')[0],
      dateStr: (() => {
  const d = currentTime;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})()
    };
  }, [currentTime]);

  // --- AUTOMATIC TIME-BASED BREAK CALCULATION (3:00 PM - 3:30 PM) ---
  const isBreakActive = useMemo(() => {
    const nowMinutes = timeToMinutes(timeStrings.timeStr);
    const breakStart = 15 * 60;     // 3:00 PM
    const breakEnd = 15 * 60 + 30;  // 3:30 PM
    return nowMinutes >= breakStart && nowMinutes < breakEnd;
  }, [timeStrings.timeStr]);

  // --- OUTLOOK DYNAMIC EVENT FETCHING AND NORMALIZATION ---
  const fetchBookings = useCallback(async () => {
    if (!room?.email) return; 
    const token = await getOutlookToken();
    if (!token) return;

    const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = new Date(currentTime);
    
    const startLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const pad = (num) => String(num).padStart(2, '0');
    
    const formatLocalISO = (d) => 
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const startStr = formatLocalISO(startLocal);
    const endStr = formatLocalISO(endLocal);

    try {
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${startStr}&endDateTime=${endStr}&$orderby=start/dateTime`,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Prefer": `outlook.timezone="${localTimezone}"`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        
const normalized = (data.value || [])
  .map(event => {
    const rawStart = event.start.dateTime.split('T')[1] || '';
    const rawEnd = event.end.dateTime.split('T')[1] || '';
    const requiredAttendees = (event.attendees || []).filter(a => a.type === 'required');
    const attendeeNames = requiredAttendees
      .map(a => a.emailAddress?.name || a.emailAddress?.address)
      .filter(Boolean)
      .join(', ');
    const displayName = attendeeNames
      || event.organizer?.emailAddress?.name
      || event.organizer?.emailAddress?.address
      || 'Unknown';

    return {
      id: event.id,
      booking_date: event.start.dateTime.split('T')[0],
      start_time: rawStart.substring(0, 5),
      end_time: rawEnd.substring(0, 5),
      title: event.subject || 'No Title',
      is_private: event.sensitivity === 'private',
      users: { full_name: displayName }
    };
  })
  // Only keep events belonging to today's local date
  .filter(b => {
    const pad = (n) => String(n).padStart(2, '0');
    const today = new Date(currentTime);
    const localDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    return b.booking_date === localDate;
  })
  .sort((a, b) => {
    const [aH, aM] = a.start_time.split(':').map(Number);
    const [bH, bM] = b.start_time.split(':').map(Number);
    return (aH * 60 + aM) - (bH * 60 + bM);
  });

        setBookings(normalized);
      }
    } catch (error) {
      console.error("Error synchronization with live Outlook graph records:", error);
    }
  }, [room?.email, currentTime]);

  // Read Static data from Supabase Directory
  useEffect(() => {
    const fetchRoomData = async () => {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('name', 'Gee Room')
          .single();

        if (error) throw error;
        setRoom(data);
      } catch (error) {
        console.error("Error fetching static directory from Supabase rooms layout:", error.message);
      }
    };
    fetchRoomData();
  }, []);

  useEffect(() => {
    if (room?.email) {
      fetchBookings();
      const pollInterval = setInterval(fetchBookings, 30000);
      return () => clearInterval(pollInterval);
    }
  }, [room?.email, fetchBookings]);

  // --- KIOSK STATE LOGIC MATCHES LIVE ARRAY HOOKS ---
  const kioskState = useMemo(() => {
    const nowMinutes = timeToMinutes(timeStrings.timeStr);

    const active = bookings.find(b => {
      if (b.booking_date !== timeStrings.dateStr) return false;
      const start = timeToMinutes(b.start_time);
      const end = timeToMinutes(b.end_time);
      return nowMinutes >= start && nowMinutes < end;
    });

    const nextAhead = bookings.find(b => {
      if (b.booking_date !== timeStrings.dateStr) return false;
      return timeToMinutes(b.start_time) > nowMinutes;
    });

    if (active) {
      const totalEndMinutes = timeToMinutes(active.end_time);
      const diffMins = Math.max(0, totalEndMinutes - nowMinutes);
      
      const displayHrs = Math.floor(diffMins / 60).toString().padStart(2, '0');
      const displayMins = (diffMins % 60).toString().padStart(2, '0');

      if (isBreakActive) {
        return {
          meetingToDisplay: active,
          activeMeeting: active,
          status: {
            text: "BREAK",
            bgStyle: "from-[#007AFF] to-[#002D6C]", 
            textSize: "md:text-[8rem] xl:text-[9.5rem]",
            subtext: "",
            countdown: { 
              label: "Break ends when meeting ends in", 
              primary: displayHrs, 
              primaryLabel: "Hours", 
              secondary: displayMins, 
              secondaryLabel: "Minutes",
              highlightSecondary: false
            }
          }
        };
      }

      return {
        meetingToDisplay: active, 
        activeMeeting: active, 
        status: {
          text: "IN USE",
          bgStyle: "from-[#FF3B30] to-[#5E0B08]",
          textSize: "md:text-[8rem] xl:text-[9.5rem]",
          subtext: "",
          countdown: { 
            label: "Meeting will end in", 
            primary: displayHrs, 
            primaryLabel: "Hours", 
            secondary: displayMins, 
            secondaryLabel: "Minutes",
            highlightSecondary: false
          }
        }
      };
    } 
    
    if (nextAhead) {
      const minutesUntilNext = timeToMinutes(nextAhead.start_time) - nowMinutes;
      if (minutesUntilNext <= 5 && minutesUntilNext >= 0) {
        const [targetH, targetM] = nextAhead.start_time.split(':').map(Number);
        const targetDate = new Date(currentTime);
        targetDate.setHours(targetH, targetM, 0, 0);
        
        const diffMs = targetDate - currentTime;
        const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
        const displayMins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const displaySecs = (totalSeconds % 60).toString().padStart(2, '0');

        return {
          meetingToDisplay: nextAhead,
          activeMeeting: null,
          nextMeeting: nextAhead,
          status: {
            text: "STARTING SOON",
            bgStyle: "from-[#FFD60A] to-[#3D2800]",
            textSize: "md:text-[6rem] xl:text-[7.5rem]",
            subtext: "",
            countdown: { 
              label: "Next meeting will start in", 
              primary: displayMins, 
              primaryLabel: "Minutes", 
              secondary: displaySecs, 
              secondaryLabel: "Seconds",
              highlightSecondary: true
            }
          }
        };
      }
    }

    return {
      meetingToDisplay: nextAhead || null,
      activeMeeting: null,
      status: {
        text: "AVAILABLE",
        subtext: nextAhead ? `Until ${formatTime(nextAhead.start_time)}` : "For the rest of the day",
        bgStyle: "from-[#30D158] to-[#0C3E1E]",
        textSize: "md:text-[8rem] xl:text-[9.5rem]"
      }
    };
  }, [bookings, timeStrings, currentTime, isBreakActive]);

  const currentStatus = kioskState.status;
  const meetingToDisplay = kioskState.meetingToDisplay;
  const activeMeeting = kioskState.activeMeeting;
  const nextMeeting = kioskState.nextMeeting;

  const currentTargetMeeting = activeMeeting || nextMeeting;
  
  const isWithinCheckInWindow = useMemo(() => {
    if (!currentTargetMeeting) return false;
    const nowMins = timeToMinutes(timeStrings.timeStr);
    const startMins = timeToMinutes(currentTargetMeeting.start_time);
    return (nowMins >= startMins - 5) && (nowMins <= startMins + 10);
  }, [currentTargetMeeting, timeStrings.timeStr]);

  // Determine if the "IN USE" meeting is in its last 5 minutes
  const isLastFiveMinutes = useMemo(() => {
    if (currentStatus?.text !== "IN USE" || !activeMeeting) return false;
    const nowMins = timeToMinutes(timeStrings.timeStr);
    const endMins = timeToMinutes(activeMeeting.end_time);
    const remaining = endMins - nowMins;
    return remaining > 0 && remaining <= 5;
  }, [currentStatus, activeMeeting, timeStrings.timeStr]);

  // Handle auto-reset of details if the meeting finishes or swaps
  useEffect(() => {
    if (currentTargetMeeting?.id !== lastActiveMeetingIdRef.current) {
      lastActiveMeetingIdRef.current = currentTargetMeeting?.id || null;
      setHasCheckedIn(false);
      emptyMinutesRef.current = 0;
      lastMinuteRef.current = '';
    }
  }, [currentTargetMeeting]);

  useEffect(() => {
    if (isPersonDetected && isWithinCheckInWindow) {
      setHasCheckedIn(true);
    }
  }, [isPersonDetected, isWithinCheckInWindow]);

  // --- LIVE OUTLOOK RESCISSION OF GHOST MEETINGS ---
  const handleCancelGhostMeeting = useCallback(async (meetingId) => {
    console.warn(`Meeting ended or ghost detected (${meetingId}). Cleaning up calendar.`);
    const token = await getOutlookToken();
    if (!token) return;

    try {
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${meetingId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        setBookings(prev => prev.filter(b => b.id !== meetingId));
        setHasCheckedIn(false);
      }
    } catch (error) {
      console.error("Failed executing ghost cancellation callback against Graph framework:", error);
    }
  }, []);

  // --- OUTLOOK EVENT PATCH (EXTEND MEETING FUNCTION) ---
  const handleExtendMeeting = async () => {
    if (!activeMeeting) return;
    setIsExtending(true);

    const token = await getOutlookToken();
    if (!token) {
      setIsExtending(false);
      return;
    }

    try {
      const addedMinutes = extendHours * 60 + extendMinutes;
      const currentEndMinutes = timeToMinutes(activeMeeting.end_time);
      const targetEndMinutes = currentEndMinutes + addedMinutes;

      const updatedEndH = Math.floor(targetEndMinutes / 60);
      const updatedEndM = targetEndMinutes % 60;
      const targetEndTimeStr = `${String(updatedEndH).padStart(2, '0')}:${String(updatedEndM).padStart(2, '0')}:00`;

      const targetEndDateTimeLocal = `${activeMeeting.booking_date}T${targetEndTimeStr}`;

      const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${activeMeeting.id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          end: {
            dateTime: targetEndDateTimeLocal,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        })
      });

      if (response.ok) {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        await fetchBookings();
        setCurrentPage('dashboard');
      } else {
        const errorDetails = await response.json();
        console.error("Failed to patch Outlook event extending session timeline:", errorDetails);
      }
    } catch (error) {
      console.error("Failed to make target dynamic calendar changes on Graph layer:", error);
    } finally {
      setIsExtending(false);
    }
  };

  // --- OCCUPANCY SENSOR WATCHDOG (Bypassed automatically on BREAK) ---
  useEffect(() => {
    if (!currentTargetMeeting || isBreakActive) { 
      emptyMinutesRef.current = 0;
      return;
    }

    const currentMinuteStr = timeStrings.timeStr.substring(0, 5); 
    const nowMins = timeToMinutes(timeStrings.timeStr);
    const startMins = timeToMinutes(currentTargetMeeting.start_time);
    const checkInDeadline = startMins + 10;

    if (!hasCheckedIn && nowMins > checkInDeadline) {
      console.warn(`Check-in deadline missed for meeting ${currentTargetMeeting.id}. Cancelling reservation.`);
      handleCancelGhostMeeting(currentTargetMeeting.id);
      return;
    }

    if (!hasCheckedIn && nowMins <= checkInDeadline) {
      emptyMinutesRef.current = 0;
      return;
    }

    if (lastMinuteRef.current !== currentMinuteStr) {
      lastMinuteRef.current = currentMinuteStr;

      if (!isPersonDetected) {
        emptyMinutesRef.current += 1;
        if (emptyMinutesRef.current >= 5) {
          handleCancelGhostMeeting(currentTargetMeeting.id);
        }
      } else {
        emptyMinutesRef.current = 0; 
      }
    }
  }, [currentTime, isPersonDetected, currentTargetMeeting, hasCheckedIn, isBreakActive, timeStrings.timeStr, handleCancelGhostMeeting]);

  const showCheckInButton = isWithinCheckInWindow && !hasCheckedIn;
  const showRoomWarning = currentTargetMeeting && !isPersonDetected && (emptyMinutesRef.current > 0 || showCheckInButton) && !isBreakActive;

  const warningLabelText = useMemo(() => {
    if (!showRoomWarning) return "";
    
    if (showCheckInButton) {
      const nowMins = timeToMinutes(timeStrings.timeStr);
      const startMins = timeToMinutes(currentTargetMeeting.start_time);
      const windowEndMins = startMins + 10;
      const minutesLeftToCheckIn = Math.max(0, windowEndMins - nowMins);

      if (minutesLeftToCheckIn === 0) {
        return `Please check in within less than a minute to save your booking!`;
      }
      return `Please check in within ${minutesLeftToCheckIn} ${minutesLeftToCheckIn === 1 ? 'minute' : 'minutes'} to save your booking.`;
    }

    const remaining = 5 - emptyMinutesRef.current;
    return `Room is empty. Auto-vacating in ${remaining} ${remaining === 1 ? 'minute' : 'minutes'}.`;
  }, [showRoomWarning, showCheckInButton, timeStrings.timeStr, currentTargetMeeting]);

  const handleCheckIn = async () => {
    setHasCheckedIn(true);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);

    if (room?.id) {
      try {
        await supabase
          .from('rooms')
          .update({ is_occupied: true, updated_at: new Date() })
          .eq('id', room.id);
      } catch (error) {
        console.error("Failed to sync check-in status to database:", error);
      }
    }
  };

  const actionButtonClass =
    'group relative bg-white/10 hover:bg-white/20 border border-white/20 p-5 rounded-[1.75rem] md:w-56 flex flex-row items-center justify-center gap-3 transition-all duration-300 hover:border-white/40 shadow-2xl whitespace-nowrap backdrop-blur-xl h-16 md:h-20';
  const scheduleButtonClass = `${actionButtonClass} md:w-80 z-10`;

  const renderStatusDisplay = () => (
    <div className="w-full max-w-full text-center flex flex-col items-center justify-center overflow-hidden px-4">
      <h2 className={`text-6xl md:leading-none tracking-tight font-black text-white drop-shadow-2xl select-none uppercase break-words max-w-full w-full block ${currentStatus.textSize}`}>
        {currentStatus.text}
      </h2>

      {currentStatus.countdown && (
        <div className="mt-4 md:mt-6 flex flex-col items-center animate-fade-in">
          <p className="text-white/60 text-lg md:text-2xl font-semibold uppercase tracking-widest mb-2">
            {currentStatus.countdown.label}
          </p>
          <div className="flex items-center gap-5 text-white font-black drop-shadow-2xl">
            <div className="flex flex-col items-center">
              <span className="text-6xl md:text-8xl tracking-tight leading-none">
                {currentStatus.countdown.primary}
              </span>
              <span className="text-xs md:text-sm uppercase tracking-wider text-white/40 mt-1">
                {currentStatus.countdown.primaryLabel}
              </span>
            </div>
            <span className="text-6xl md:text-8xl leading-none text-white/30 -translate-y-2">:</span>
            <div className="flex flex-col items-center">
              <span className={`text-6xl md:text-8xl tracking-tight leading-none ${currentStatus.countdown.highlightSecondary ? 'text-amber-400' : 'text-white'}`}>
                {currentStatus.countdown.secondary}
              </span>
              <span className="text-xs md:text-sm uppercase tracking-wider text-white/40 mt-1">
                {currentStatus.countdown.secondaryLabel}
              </span>
            </div>
          </div>
        </div>
      )}

      {currentStatus.subtext && (
        <div className="mt-4 text-2xl md:text-4xl text-white/90 font-light tracking-wide max-w-full w-full mx-auto drop-shadow-md">
          {currentStatus.subtext}
        </div>
      )}
    </div>
  );

  const renderUpcomingMeetingCard = () => {
    const isActive = meetingToDisplay === activeMeeting;
    return (
      <div className="bg-white/10 border border-white/20 p-6 md:p-8 rounded-[2.5rem] w-full max-w-5xl flex flex-row items-center gap-6 md:gap-10 text-left transition-all duration-300 shadow-2xl backdrop-blur-xl overflow-hidden mt-6 md:mt-10 animate-fade-in">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-16 md:size-24 text-white/90 flex-shrink-0">
          <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H4.5ZM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06Z" />
        </svg>

        <div className="flex flex-col min-w-0 flex-1 justify-center gap-1.5 overflow-hidden">
          <h3 className="text-xs md:text-base font-semibold text-white/50 uppercase tracking-wider">
            {isActive ? 'Current Meeting:' : 'Next Meeting:'}
          </h3>

          <h4 className="text-2xl md:text-4xl font-bold text-white tracking-tight leading-tight truncate block max-w-full">
            {meetingToDisplay.is_private ? 'Private Meeting' : meetingToDisplay.title}
          </h4>

          <div className="flex flex-row gap-6 items-center flex-wrap md:flex-nowrap text-white font-medium mt-1">
            <div className="flex flex-row items-center gap-2.5 shrink-0 text-white/90">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6 md:size-7 text-white/70">
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
              </svg>
              <span className="text-lg md:text-2xl font-light">
                {formatTime(meetingToDisplay.start_time)} - {formatTime(meetingToDisplay.end_time)}
              </span>
            </div>

            <span className="hidden md:inline text-white/20 text-2xl font-thin">|</span>

            <div className="flex flex-row items-center gap-2.5 min-w-0 text-white/90">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6 md:size-7 text-white/70">
                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
              </svg>
              <span className="text-lg md:text-2xl font-light truncate">
                {meetingToDisplay.users?.full_name || 'Organizer'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEmptyMeetingCard = () => (
    <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] w-full max-w-5xl flex flex-row items-center gap-6 text-left shadow-xl backdrop-blur-md mt-6 md:mt-10 animate-fade-in">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 shadow-lg shadow-green-500/20 flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-10 text-white">
          <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H4.5ZM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06Z" />
        </svg>
      </div>
      <div className="flex flex-col min-w-0 flex-1 gap-1">
        <h3 className="text-xs md:text-sm font-semibold text-white/50 uppercase tracking-wider">Next Meeting:</h3>
        <h4 className="text-xl md:text-3xl font-light text-white/40">No Upcoming Meetings Scheduled</h4>
      </div>
    </div>
  );

  const renderHeader = (theme = 'white') => {
    const isDark = theme === "black";
    const titleColor = isDark ? "text-black" : "text-white";
    const subtitleColor = isDark ? "text-black" : "text-slate-200/80";
    const iconColor = isDark ? "text-black" : "text-white/30";

    const bgWrapperClass = isDark 
      ? "bg-white -mx-10 -mt-10 px-10 py-8 border-b border-slate-100" 
      : "bg-transparent pb-4";

    return (
      <div className={`flex flex-row justify-between items-center z-10 shrink-0 ${bgWrapperClass}`}>
        <div className="min-w-0">
          <h1 className={`text-3xl md:text-5xl font-bold tracking-tight truncate ${titleColor}`}>
            {room?.name || "Loading..."}
          </h1>
          <p className={`text-lg md:text-3xl font-light flex items-center gap-3 mt-1.5 ${subtitleColor}`}>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={2} 
              stroke="currentColor" 
              className={`size-6 md:size-9 shrink-0 ${iconColor}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>    
            <span className="truncate">{room?.capacity || 0} People</span>
          </p>
        </div>
        <div className="shrink-0 scale-110 md:scale-150 origin-right translate-x-2">
          <Clock textColor={theme} />
        </div>
      </div>
    );
  };

  if (isAuthResolving || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-500 font-mono text-lg tracking-widest gap-4">
        <svg className="animate-spin h-8 w-8 text-white/50" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>CONNECTING TO OUTLOOK...</span>
      </div>
    );
  }

  if (!room) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-mono text-lg tracking-widest">LOADING...</div>;

  if (currentPage === 'schedule') {
    return (
      <SchedulePage 
        roomEmail={room.email} 
        renderHeader={() => renderHeader('black')} 
        goHome={() => setCurrentPage('dashboard')} 
      />
    );
  }

  if (currentPage === 'booking') {
    return (
      <BookingPage 
        roomId={room.id}
        renderHeader={() => renderHeader('black')} 
        goHome={() => setCurrentPage('dashboard')} 
        onSuccess={fetchBookings} 
      />
    );
  }

  // --- EXTEND MEETING PAGE (Shares booking page styling) ---
  if (currentPage === 'extend') {
    return (
      <div className="min-h-screen w-full bg-[#f8fafc] text-slate-900 p-6 md:p-10 flex flex-col justify-between font-sans relative">
        <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto flex-1">
          {renderHeader('black')}

          <div className="flex flex-col gap-4 mt-4 animate-fade-in">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
              Extend Active Meeting
            </h2>
            <p className="text-lg text-slate-500 max-w-xl">
              Specify the extra duration you want to append to this current block.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center justify-center flex-1 py-4 max-w-4xl mx-auto w-full">
            {/* Hours Counter Component */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center shadow-lg gap-6">
              <span className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Hours</span>
              <div className="flex flex-col items-center gap-4 w-full">
                <button 
                  onClick={() => setExtendHours(prev => Math.min(prev + 1, 12))}
                  className="w-20 h-20 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shadow-md transition-all active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="size-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <span className="text-6xl md:text-8xl font-black text-slate-800 tabular-nums">
                  {extendHours}
                </span>
                <button 
                  onClick={() => setExtendHours(prev => Math.max(prev - 1, 0))}
                  className="w-20 h-20 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shadow-md transition-all active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="size-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Minutes Counter Component */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center shadow-lg gap-6">
              <span className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Minutes</span>
              <div className="flex flex-col items-center gap-4 w-full">
                <button 
                  onClick={() => setExtendMinutes(prev => (prev >= 45 ? 0 : prev + 15))}
                  className="w-20 h-20 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shadow-md transition-all active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="size-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <span className="text-6xl md:text-8xl font-black text-slate-800 tabular-nums">
                  {String(extendMinutes).padStart(2, '0')}
                </span>
                <button 
                  onClick={() => setExtendMinutes(prev => (prev <= 0 ? 45 : prev - 15))}
                  className="w-20 h-20 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shadow-md transition-all active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="size-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="w-full max-w-7xl mx-auto mt-8 border-t border-slate-200 pt-6 flex flex-row justify-between items-center">
          <button 
            onClick={() => {
              setExtendHours(0);
              setExtendMinutes(15);
              setCurrentPage('dashboard');
            }}
            className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all"
          >
            Cancel
          </button>

          <button 
            onClick={handleExtendMeeting}
            disabled={isExtending || (extendHours === 0 && extendMinutes === 0)}
            className="px-10 py-4 bg-[#007AFF] hover:bg-[#0051C3] disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center gap-3"
          >
            {isExtending ? 'Extending...' : 'Extend'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen w-screen max-h-screen bg-gradient-to-br ${currentStatus.bgStyle} text-slate-100 p-4 font-sans transition-all duration-1000 ease-in-out overflow-hidden select-none relative flex flex-col justify-between`}>  
      <div className={`absolute top-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] ${showToast ? 'translate-y-4 opacity-100' : '-translate-y-12 opacity-0 pointer-events-none'}`}>
        <div className="bg-black/70 backdrop-blur-xl border border-white/10 px-8 py-3.5 rounded-full shadow-[0_24px_50px_-12px_rgba(0,0,0,0.5)] flex items-center gap-4 w-max">
          <div className="bg-emerald-500 rounded-full p-1.5 text-black flex items-center justify-center shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <span className="text-white text-lg font-semibold tracking-tight">Meeting Updated Successfully</span>
        </div>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full filter blur-[160px] pointer-events-none opacity-60 mix-blend-screen transition-all duration-1000 ease-in-out animate-pulse" />

      <div className="z-10 grid grid-rows-[auto_1fr_auto] h-full w-full gap-6 md:gap-8">
        {renderHeader()}

        <div className="flex flex-col items-center justify-center px-4 w-full max-w-7xl mx-auto text-center min-h-0 self-center">
          <div className="w-full flex justify-center items-center shrink-0 max-w-full px-6">
            {renderStatusDisplay()}
          </div>
          
          {meetingToDisplay ? renderUpcomingMeetingCard() : renderEmptyMeetingCard()}
        </div>

        {/* --- BOTTOM CONTROLS FOOTER --- */}
        <div className="w-full pt-4 pb-2 shrink-0 overflow-visible relative">
          <div className="flex flex-row justify-between items-center w-full gap-6">
            
            {/* LEFT COMPONENT SLOT */}
            {currentStatus.text === "AVAILABLE" ? (
              <button 
                onClick={() => setCurrentPage('schedule')}
                className={scheduleButtonClass}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-7 text-slate-200 group-hover:text-white transition-colors">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
                </svg>
                <span className="text-lg md:text-2xl font-light text-white">Meeting's Schedule</span>
              </button>
            ) : currentStatus.text === "BREAK" ? (
              // BREAK STATE LEFT BUTTON -> END MEETING EARLY
              <button 
                onClick={() => handleCancelGhostMeeting(activeMeeting?.id)}
                className={`${scheduleButtonClass} border-red-500/30 hover:border-red-500/60 bg-red-500/10 hover:bg-red-500/20`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-7 text-red-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-lg md:text-2xl font-semibold text-red-200">End Meeting Early</span>
              </button>
            ) : (
              <div className="w-56 md:w-80 hidden md:block pointer-events-none" />
            )}

            {/* MIDDLE WARNING BANNER (Hidden during breaks) */}
            {showRoomWarning && (
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-row items-center gap-3 text-amber-400 font-medium max-w-[45%] text-center justify-center pointer-events-none animate-fade-in px-4 z-10">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-6 shrink-0 animate-pulse">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <span className="text-sm md:text-xl font-bold tracking-tight whitespace-normal leading-tight">
                  {warningLabelText}
                </span>
              </div>
            )}

            {/* RIGHT COMPONENT SLOT */}
            {currentStatus.text === "BREAK" ? (
              <div className="w-56 md:w-80 h-16 md:h-20 ml-auto pointer-events-none" />
            ) : showCheckInButton ? (
              <button 
                onClick={handleCheckIn}
                className={`${actionButtonClass} ml-auto`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="size-7 text-amber-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-lg md:text-2xl font-black text-amber-300 uppercase">Check In</span>
              </button>
            ) : isLastFiveMinutes ? (
              // --- DYNAMIC "EXTEND MEETING" BUTTON TRIGGER ---
              <button 
                onClick={() => setCurrentPage('extend')}
                className={`${actionButtonClass} ml-auto border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/20`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-7 text-emerald-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="text-lg md:text-2xl font-bold text-emerald-300">Extend Meeting</span>
              </button>
            ) : currentStatus.text !== "AVAILABLE" ? (
              <div className="w-56 md:w-80 h-16 md:h-20 ml-auto" />
            ) : (
              <button 
                onClick={() => setCurrentPage('booking')}
                className={`${actionButtonClass} ml-auto`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-7 text-slate-200 group-hover:text-white transition-colors">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-lg md:text-2xl font-light text-white">Quick Book</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <OccupancySensor roomId={room.id} onOccupancyChange={setIsPersonDetected} />
    </div>
  );
}

// --- OUTER WRAPPER ---
export default function App() {
  const [isMsalInitialized, setIsMsalInitialized] = useState(false);

  useEffect(() => {
    msalInstance.initialize()
      .then(() => {
        setIsMsalInitialized(true);
      })
      .catch((err) => {
        console.error("Critical failure initializing MSAL framework:", err);
      });
  }, []);

  if (!isMsalInitialized) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-500 font-mono text-lg tracking-widest gap-4">
        <div className="animate-pulse">INITIALIZING AUTHENTICATION SYSTEM...</div>
      </div>
    );
  }

  return (
    <MsalProvider instance={msalInstance}>
      <AppContent isMsalInitialized={isMsalInitialized} />
    </MsalProvider>
  );
}