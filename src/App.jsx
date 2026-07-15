import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Clock from './components/Clock';
import SchedulePage from './components/SchedulePage';
import BookingPage from './components/BookingPage';
import OccupancySensor from './components/OccupancySensor';
import { supabase } from './supabaseClient';

// --- MOCK DATA INITIALIZATION ---
// const MOCK_ROOM = {
//   id: 'room-123',
//   room_name: 'Gee Room',
//   capacity: 8,
//   is_occupied: false
// };

// const generateMockBookings = () => {
//   const today = new Date().toISOString().split('T')[0];
//   const formatTimeStr = (dateObj) => dateObj.toTimeString().split(' ')[0];

//   const activeStart = new Date();
//   activeStart.setMinutes(activeStart.getMinutes() + 32); 
//   const activeEnd = new Date();
//   activeEnd.setMinutes(activeEnd.getMinutes() + 30);

//   const nextStart = new Date();
//   nextStart.setMinutes(nextStart.getMinutes() + 45);
//   const nextEnd = new Date();
//   nextEnd.setMinutes(nextEnd.getMinutes() + 90);

//   return [
//     {
//       id: 'booking-001',
//       room_id: 'room-123',
//       booking_date: today,
//       start_time: formatTimeStr(activeStart),
//       end_time: formatTimeStr(activeEnd),
//       title: 'Q3 Product Strategy Sync',
//       is_private: false,
//       users: { full_name: 'Sarah Jenkins', email: 'sarah@company.com' }
//     },
//     {
//       id: 'booking-002',
//       room_id: 'room-123',
//       booking_date: today,
//       start_time: formatTimeStr(nextStart),
//       end_time: formatTimeStr(nextEnd),
//       title: 'Dev Team Standup & Backlog Grooming',
//       is_private: false,
//       users: { full_name: 'Alex Rivera', email: 'alex@company.com' }
//     }
//   ];
// };
// ---------------------------------

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [room, setRoom] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [isPersonDetected, setIsPersonDetected] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false); 
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showToast, setShowToast] = useState(false);

  const emptyMinutesRef = useRef(0);
  const lastActiveMeetingIdRef = useRef(null);
  const lastMinuteRef = useRef('');

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
  }, [bookings, timeStrings, currentTime]);

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

  const handleCancelGhostMeeting = useCallback(async (meetingId) => {
    // --- MOCK CANCEL GHOST MEETING ---
    // console.warn(`[MOCK] Ghost reservation detected (${meetingId}). No occupancy found. Cancelling.`);
    // setBookings(prev => prev.filter(b => b.id !== meetingId));
    // setHasCheckedIn(false);

    // --- SUPABASE CANCEL GHOST MEETING ---
    console.warn(`Ghost reservation detected (${meetingId}). No occupancy found. Cancelling.`);
    await supabase.from('bookings').delete().eq('id', meetingId);
    setBookings(prev => prev.filter(b => b.id !== meetingId));
    setHasCheckedIn(false);
  }, []);

  useEffect(() => {
    if (!currentTargetMeeting) {
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
  }, [currentTime, isPersonDetected, currentTargetMeeting, hasCheckedIn, timeStrings.timeStr, handleCancelGhostMeeting]);

  const showCheckInButton = isWithinCheckInWindow && !hasCheckedIn;
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
    // --- MOCK FETCH BOOKINGS ---
    // console.log("[MOCK] Fetching bookings list");
    // setBookings(generateMockBookings());

    // --- SUPABASE FETCH BOOKINGS ---
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, users(full_name, email)')
        .eq('room_id', room.id)
        .order('booking_date', { ascending: true })
        .order('start_time', { ascending: true });
      if (error) throw error;
      setBookings(data);
    } catch (error) {
      console.error("Error fetching bookings:", error.message);
    }
  }, [room?.id]);

  useEffect(() => {
    const fetchRoomData = async () => {
      try{
        // --- MOCK FETCH ROOM DATA ---
        // console.log("[MOCK] Fetching room metadata setup profile");
        // setRoom(MOCK_ROOM);

        // --- SUPABASE FETCH ROOM DATA ---
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('room_name', 'Gee Room')
          .single();

        if (error) throw error;
        setRoom(data);
      } catch (error) {
        console.error("Error fetching room data:", error.message);
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
    setTimeout(() => setShowToast(false), 3000);

    if (room?.id) {
      // --- MOCK CHECK-IN ACTION ---
      // console.log(`[MOCK] Room '${room.id}' status set to occupied.`);
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
            {room?.room_name || "Loading..."}
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

  if (!room) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-mono text-lg tracking-widest">LOADING...</div>;

  if (currentPage === 'schedule') {
    return (
      <SchedulePage 
        bookings={bookings} 
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

  return (
    <div className={`h-screen w-screen max-h-screen bg-gradient-to-br ${currentStatus.bgStyle} text-slate-100 p-4 font-sans transition-all duration-1000 ease-in-out overflow-hidden select-none relative flex flex-col justify-between`}>  
      <div className={`absolute top-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] ${showToast ? 'translate-y-4 opacity-100' : '-translate-y-12 opacity-0 pointer-events-none'}`}>
        <div className="bg-black/70 backdrop-blur-xl border border-white/10 px-8 py-3.5 rounded-full shadow-[0_24px_50px_-12px_rgba(0,0,0,0.5)] flex items-center gap-4 w-max">
          <div className="bg-emerald-500 rounded-full p-1.5 text-black flex items-center justify-center shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <span className="text-white text-lg font-semibold tracking-tight">Check-in Successful</span>
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

        <div className="w-full pt-4 pb-2 shrink-0 overflow-visible relative">
          <div className="flex flex-row justify-between items-center w-full gap-6">
            
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
            ) : (
              <div className="w-56 md:w-80 hidden md:block pointer-events-none" />
            )}

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

            {showCheckInButton ? (
              <button 
                onClick={handleCheckIn}
                className={`${actionButtonClass} ml-auto`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="size-7 text-amber-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-lg md:text-2xl font-black text-amber-300 uppercase">Check In</span>
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

export default App;