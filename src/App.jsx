import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Clock from './components/Clock';
import StatusDisplay from './components/StatusDisplay';
import SchedulePage from './components/SchedulePage';
import BookingPage from './components/BookingPage';
import OccupancySensor from './components/OccupancySensor';
import { supabase } from './supabaseClient';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [room, setRoom] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [isPersonDetected, setIsPersonDetected] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false); // Tracks explicit valid check-in state
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showToast, setShowToast] = useState(false);

  // Keep a running reference clock tracking exactly how long a room has sat empty during a live booking
  const emptyMinutesRef = useRef(0);
  const lastActiveMeetingIdRef = useRef(null);
  const lastMinuteRef = useRef(''); // Tracks minute changes to safely increment abandonment timers

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
      dateStr: currentTime.toISOString().split('T')[0]
    };
  }, [currentTime]);

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

      return {
        meetingToDisplay: nextAhead || null,
        activeMeeting: active, 
        status: {
          text: "IN USE",
          bgStyle: "from-[#FF3B30] to-[#5E0B08]",
          subtext: (
            <div className="flex flex-col gap-4 text-center items-center mt-4 bg-transparent border-0 shadow-none py-2 max-w-full px-6">
              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white drop-shadow-xl max-w-4xl px-2 leading-tight break-words uppercase">
                {active.is_private ? "Private Meeting" : active.title}
              </h2>
              <span className="text-lg sm:text-xl font-black tracking-widest text-red-400 uppercase block px-4 mt-2">
                Current meeting ends in
              </span>
              <div className="flex flex-row items-baseline justify-center gap-4 text-white max-w-full px-4">
                {Number(displayHrs) > 0 && (
                  <>
                    <div className="flex flex-col items-center">
                      <span className="text-5xl sm:text-6xl lg:text-8xl font-medium tabular-nums tracking-tight drop-shadow-md">
                        {displayHrs}
                      </span>
                      <span className="text-[11px] sm:text-xs font-bold text-white/70 tracking-wide uppercase mt-1">
                        Hours
                      </span>
                    </div>
                    <span className="text-2xl sm:text-4xl lg:text-7xl font-light text-white/40 self-center -translate-y-4">:</span>
                  </>
                )}
                <div className="flex flex-col items-center">
                  <span className="text-5xl sm:text-6xl lg:text-8xl font-black tabular-nums tracking-tight text-red-300 drop-shadow-md">
                    {displayMins}
                  </span>
                  <span className="text-[11px] sm:text-xs font-bold text-white/70 tracking-wide uppercase mt-1">
                    Minutes
                  </span>
                </div>
              </div>
            </div>
          )
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
            bgStyle: "from-[#FF9500] to-[#593400]",
            subtext: (
              <div className="flex flex-col gap-4 text-center items-center mt-4 bg-transparent border-0 shadow-none py-2 max-w-full px-6">
                <span className="text-lg sm:text-xl font-black tracking-widest text-amber-400 uppercase block px-4 mt-1">
                  Next meeting will start in
                </span>
                <div className="flex flex-row items-baseline justify-center gap-4 text-white max-w-full px-4">
                  <div className="flex flex-col items-center">
                    <span className="text-5xl sm:text-6xl lg:text-8xl font-medium tabular-nums tracking-tight drop-shadow-md">
                      {displayMins}
                    </span>
                    <span className="text-[11px] sm:text-xs font-bold text-white/70 tracking-wide uppercase mt-1">
                      Minutes
                    </span>
                  </div>
                  <span className="text-2xl sm:text-4xl lg:text-7xl font-light text-white/40 self-center -translate-y-4 animate-pulse">:</span>
                  <div className="flex flex-col items-center">
                    <span className="text-5xl sm:text-6xl lg:text-8xl font-black tabular-nums tracking-tight text-amber-300 drop-shadow-md">
                      {displaySecs}
                    </span>
                    <span className="text-[11px] sm:text-xs font-bold text-white/70 tracking-wide uppercase mt-1">
                      Seconds
                    </span>
                  </div>
                </div>
              </div>
            )
          }
        };
      }
    }

    return {
      meetingToDisplay: nextAhead || null,
      activeMeeting: null,
      status: {
        text: "AVAILABLE",
        subtext: nextAhead ? `Until ${formatTime(nextAhead.start_time)}` : "",
        bgStyle: "from-[#30D158] to-[#0C3E1E]"
      }
    };
  }, [bookings, timeStrings, currentTime]);

  const currentStatus = kioskState.status;
  const meetingToDisplay = kioskState.meetingToDisplay;
  const activeMeeting = kioskState.activeMeeting;
  const nextMeeting = kioskState.nextMeeting;

  // Evaluate structural constraints (5 mins before start, up to 10 mins after start window)
  const currentTargetMeeting = activeMeeting || nextMeeting;
  
  const isWithinCheckInWindow = useMemo(() => {
    if (!currentTargetMeeting) return false;
    const nowMins = timeToMinutes(timeStrings.timeStr);
    const startMins = timeToMinutes(currentTargetMeeting.start_time);
    return (nowMins >= startMins - 5) && (nowMins <= startMins + 10);
  }, [currentTargetMeeting, timeStrings.timeStr]);

  // Reset check-in state parameters across unique consecutive bookings
  useEffect(() => {
    if (currentTargetMeeting?.id !== lastActiveMeetingIdRef.current) {
      lastActiveMeetingIdRef.current = currentTargetMeeting?.id || null;
      setHasCheckedIn(false);
      emptyMinutesRef.current = 0;
      lastMinuteRef.current = '';
    }
  }, [currentTargetMeeting]);

  // Sync automatic camera visibility checks
  useEffect(() => {
    if (isPersonDetected && isWithinCheckInWindow) {
      setHasCheckedIn(true);
    }
  }, [isPersonDetected, isWithinCheckInWindow]);

  const handleCancelGhostMeeting = useCallback(async (meetingId) => {
    console.warn(`Ghost reservation detected (${meetingId}). No occupancy found. Cancelling.`);
    await supabase.from('bookings').delete().eq('id', meetingId);
    setBookings(prev => prev.filter(b => b.id !== meetingId));
    setHasCheckedIn(false);
  }, []);

  // FIXED: Real-time clock checker evaluating deadlines accurately every second
  useEffect(() => {
    if (!currentTargetMeeting) {
      emptyMinutesRef.current = 0;
      return;
    }

    const currentMinuteStr = timeStrings.timeStr.substring(0, 5); // e.g. "23:34"
    const nowMins = timeToMinutes(timeStrings.timeStr);
    const startMins = timeToMinutes(currentTargetMeeting.start_time);
    const checkInDeadline = startMins + 10;

    // 1. Check-In Expiration Rule evaluated instantly on the second change
    if (!hasCheckedIn && nowMins > checkInDeadline) {
      console.warn(`Check-in deadline missed for meeting ${currentTargetMeeting.id}. Cancelling reservation.`);
      handleCancelGhostMeeting(currentTargetMeeting.id);
      return;
    }

    // 2. While they are still inside the valid check-in window, freeze the mid-meeting countdown parameter
    if (!hasCheckedIn && nowMins <= checkInDeadline) {
      emptyMinutesRef.current = 0;
      return;
    }

    // 3. Post-Check-In Abandonment Rule evaluated safely when the minute updates
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
  }, [currentTime, isPersonDetected, currentTargetMeeting, hasCheckedIn, timeStrings.timeStr, handleCancelGhostMeeting]);

  // Show the check-in button if we are inside the window and haven't checked in yet
  const showCheckInButton = isWithinCheckInWindow && !hasCheckedIn;

  // Trigger the warning if the room is empty AFTER checking in, OR if a meeting has started/is starting, no one is detected, and they haven't checked in yet!
  const showRoomWarning = currentTargetMeeting && !isPersonDetected && (emptyMinutesRef.current > 0 || showCheckInButton);

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

  const fetchBookings = useCallback(async () => {
    if (!room?.id) return;
    const { data } = await supabase
      .from('bookings')
      .select('*, users(full_name, email)')
      .eq('room_id', room.id)
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true });
    
    if (data) setBookings(data);
  }, [room?.id]);

  useEffect(() => {
    const fetchRoomData = async () => {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_name', 'Gee Room')
        .single();
      
      if (data) {
        setRoom(data);
      }
    };
    fetchRoomData();
  }, []);

  useEffect(() => {
    if (room?.id) {
      fetchBookings();
    }
  }, [room?.id, fetchBookings]);

  const handleCheckIn = async () => {
    setHasCheckedIn(true);
    setShowToast(true);

    setTimeout(() => {
      setShowToast(false);
    }, 30000);

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

  const renderHeader = () => (
    <div className="flex flex-row justify-between items-center pb-4 z-10 shrink-0">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-4xl lg:text-6xl font-black tracking-tight text-white truncate">
          {room?.room_name || "Loading..."}
        </h1>
        <p className="text-slate-200/80 text-sm sm:text-lg lg:text-3xl font-medium flex items-center gap-2 mt-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-6 sm:size-8 lg:size-10 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>    
          <span className="truncate">{room?.capacity || 0} People Capacity</span>
        </p>
      </div>
      <div className="shrink-0 scale-90 sm:scale-110 lg:scale-125 origin-right">
        <Clock />
      </div>
    </div>
  );

  if (!room) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-mono text-sm tracking-widest">LOADING...</div>;

  if (currentPage === 'schedule') {
    return <SchedulePage bookings={bookings} renderHeader={renderHeader} goHome={() => setCurrentPage('dashboard')} />;
  }

  if (currentPage === 'booking') {
    return <BookingPage roomId={room.id} renderHeader={renderHeader} goHome={() => setCurrentPage('dashboard')} onSuccess={fetchBookings} />;
  }

  return (
    <div className={`h-screen w-screen max-h-screen bg-gradient-to-br ${currentStatus.bgStyle} text-slate-100 p-6 sm:p-8 lg:p-12 font-sans transition-all duration-1000 ease-in-out overflow-hidden select-none relative flex flex-col justify-between`}>  
      <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] ${showToast ? 'translate-y-4 opacity-100' : '-translate-y-12 opacity-0 pointer-events-none'}`}>
        <div className="bg-black/70 backdrop-blur-xl border border-white/10 px-6 py-3.5 rounded-full shadow-[0_24px_50px_-12px_rgba(0,0,0,0.5)] flex items-center gap-3 w-max">
          <div className="bg-emerald-500 rounded-full p-1 text-black flex items-center justify-center shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" className="size-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <span className="text-white text-sm sm:text-base font-semibold tracking-tight">Check-in Successful</span>
        </div>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] lg:w-[800px] h-[400px] sm:h-[600px] lg:h-[800px] rounded-full filter blur-[140px] pointer-events-none opacity-65 mix-blend-screen transition-all duration-1000 ease-in-out animate-pulse" />

      <div className="z-10 grid grid-rows-[auto_1fr_auto] h-full w-full gap-4 sm:gap-6">
        {renderHeader()}

        <div className="flex flex-col items-center justify-center gap-4 px-2 w-full max-w-7xl mx-auto text-center min-h-0">
          <div className="w-full flex justify-center items-center shrink-0 max-w-full px-4">
            <StatusDisplay currentStatus={currentStatus} />
          </div>
          
          {meetingToDisplay ? (
            <div className="bg-white/10 border border-white/20 p-6 sm:p-10 rounded-[4rem] sm:rounded-[6rem] w-full max-w-6xl flex flex-row items-center gap-6 sm:gap-10 text-left transition-all duration-300 shadow-2xl backdrop-blur-xl overflow-hidden flex-1 max-h-[45%] animate-fade-in">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-14 sm:size-24 lg:size-28 text-white/90 flex-shrink-0">
                <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H4.5ZM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06Z" />
              </svg>
              
              <div className="flex flex-col min-w-0 flex-1 justify-center gap-1 sm:gap-3 overflow-hidden">
                <h3 className="text-xs sm:text-lg lg:text-3xl font-medium text-white/70">
                  Next Meeting:
                </h3>
                
                <h4 className="text-xl sm:text-4xl lg:text-6xl font-bold text-white tracking-tight leading-tight select-text truncate whitespace-nowrap max-w-full block">
                  {meetingToDisplay.is_private ? "Private Meeting" : meetingToDisplay.title}
                </h4>
                
                <div className="flex flex-row gap-4 sm:gap-6 items-center flex-wrap lg:flex-nowrap text-white font-medium mt-1 sm:mt-2">
                  <div className="flex flex-col justify-start">
                    <div className="flex flex-row items-center gap-2.5 shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5 sm:size-8 text-white/80">
                        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm sm:text-2xl lg:text-3xl font-medium tracking-wide">
                        {formatTime(meetingToDisplay.start_time)} - {formatTime(meetingToDisplay.end_time)}
                      </span>
                    </div>
                  </div>
                  
                  <span className="hidden lg:inline text-white/30 text-3xl font-light self-start">|</span>

                  <div className="flex flex-row items-center gap-2.5 min-w-0 self-start">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5 sm:size-8 text-white/80">
                      <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm sm:text-2xl lg:text-3xl font-medium truncate max-w-[200px] sm:max-w-md">
                      {meetingToDisplay.users?.full_name || "Organizer"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 p-6 sm:p-10 rounded-[4rem] sm:rounded-[6rem] w-full max-w-6xl flex flex-row items-center gap-6 sm:gap-10 text-left shadow-xl backdrop-blur-md flex-1 max-h-[40%] shrink">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-14 sm:size-24 lg:size-28 text-white/30 flex-shrink-0">
                <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H4.5ZM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06Z" />
              </svg>
              <div className="flex flex-col min-w-0 flex-1 justify-center gap-2">
                <h3 className="text-xs sm:text-lg lg:text-3xl font-medium text-white/70">Next Meeting:</h3>
                <h4 className="text-xl sm:text-4xl lg:text-5xl font-black text-white/20 tracking-tight">No Upcoming Meetings</h4>
              </div>
            </div>
          )}
        </div>

        {/* Row 3: Contextual Footer layout */}
        <div className="w-full pt-4 sm:pt-6 pb-2 shrink-0 overflow-visible relative">
          <div className="flex flex-row justify-between items-center w-full gap-4">
            
            {/* Bottom Left: Schedule Button */}
            {currentStatus.text === "AVAILABLE" ? (
              <button 
                onClick={() => setCurrentPage('schedule')}
                className="group relative bg-white/10 hover:bg-white/20 border border-white/20 p-4 rounded-[1.5rem] sm:rounded-[2rem] w-40 sm:w-72 flex flex-row items-center justify-center gap-2 sm:gap-3 transition-all duration-300 hover:border-white/40 shadow-2xl whitespace-nowrap backdrop-blur-xl h-12 sm:h-20 z-10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5 sm:size-8 text-slate-200 group-hover:text-white transition-colors">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
                </svg>
                <span className="text-sm sm:text-2xl font-black text-white">Schedule</span>
              </button>
            ) : (
              <div className="w-40 sm:w-72 hidden sm:block pointer-events-none" />
            )}

            {/* Bottom Center: Warning notification ticker */}
            {showRoomWarning && (
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-row items-center gap-2 text-amber-400 font-medium max-w-[40%] text-center justify-center pointer-events-none animate-fade-in px-2 z-10">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-5 sm:size-6 shrink-0 animate-pulse">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <span className="text-xs sm:text-base font-bold tracking-tight whitespace-normal leading-tight">
                  {warningLabelText}
                </span>
              </div>
            )}

            {/* Bottom Right Contextual Call-to-Actions */}
            {showCheckInButton ? (
              <button 
                onClick={handleCheckIn}
                className="group relative ml-auto bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/40 p-4 rounded-[1.5rem] sm:rounded-[2rem] w-40 sm:w-72 flex flex-row items-center justify-center gap-2 sm:gap-3 transition-all duration-300 shadow-2xl whitespace-nowrap backdrop-blur-xl h-12 sm:h-20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="size-5 sm:size-8 text-amber-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-sm sm:text-2xl font-black text-amber-300 uppercase">Check In</span>
              </button>
            ) : currentStatus.text !== "AVAILABLE" ? (
              <div className="w-40 sm:w-72 h-12 sm:h-20 ml-auto" />
            ) : (
              <button 
                onClick={() => setCurrentPage('booking')}
                className="group relative ml-auto bg-white/10 hover:bg-white/20 border border-white/20 p-4 rounded-[1.5rem] sm:rounded-[2rem] w-40 sm:w-72 flex flex-row items-center justify-center gap-2 sm:gap-3 transition-all duration-300 hover:border-white/40 shadow-2xl whitespace-nowrap backdrop-blur-xl h-12 sm:h-20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5 sm:size-8 text-slate-200 group-hover:text-white transition-colors">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-sm sm:text-2xl font-black text-white">Quick Book</span>
              </button>
            )}

          </div>
        </div>
      </div>

      <OccupancySensor roomId={room.id} onOccupancyChange={setIsPersonDetected} />
    </div>
  );
}

export default App;