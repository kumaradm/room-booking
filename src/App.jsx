import React, { useState, useEffect, useCallback } from 'react';
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

  const releaseGhostRoom = async (bookingId) => {
    const now = new Date();
    const abortedEndTime = now.toTimeString().split(' ')[0]; 

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ end_time: abortedEndTime })
        .eq('id', bookingId);

      if (error) throw error;
      
      fetchBookings(); 
    } catch (err) {
      console.error("Failed to automatically release ghost room:", err.message);
    }
  };

  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchRoomData = async () => {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_name', 'Gee Room')
        .single();
      
      if (data) {
        setRoom(data);
        setIsPersonDetected(data.is_occupied);
      }
    };
    fetchRoomData();
  }, []);

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
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    if (!room?.id) return;

    const roomSub = supabase
      .channel('room-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, 
        (payload) => setIsPersonDetected(payload.new.is_occupied)
      ).subscribe();

    const bookingSub = supabase
      .channel('bookings-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchBookings())
      .subscribe();

    return () => {
      supabase.removeChannel(roomSub);
      supabase.removeChannel(bookingSub);
    };
  }, [room?.id, fetchBookings]);

  const renderHeader = () => (
    <div className="flex justify-between items-start h-30 border-b border-slate-900 pb-4 mb-6">
      <div>
        <h1 className="text-6xl font-black tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          {room?.room_name || "Loading..."}
        </h1>
        <p className="text-slate-400 text-2xl flex items-center gap-2 mt-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
          {room?.capacity || 0} People
        </p>
      </div>
      <div className="scale-150 origin-top-right">
        <Clock />
      </div>
    </div>
  );

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    return timeStr.substring(0, 5);
  };

  const getUpcomingMeeting = () => {
    const now = new Date();
    const currentTimeStr = now.toTimeString().split(' ')[0];
    const todayStr = now.toISOString().split('T')[0];

    return bookings.find(b => 
      b.booking_date === todayStr && b.start_time > currentTimeStr
    );
  };

  const getRoomStatus = () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const currentTimeStr = now.toTimeString().split(' ')[0]; 

    const currentMeeting = bookings.find(b => 
      b.booking_date === todayStr && b.start_time <= currentTimeStr && b.end_time >= currentTimeStr
    );

    const nextMeeting = bookings.find(b => 
      b.booking_date === todayStr && b.start_time > currentTimeStr
    );

    if (currentMeeting) {
      if (isPersonDetected) {
        return { 
          text: "IN USE", 
          subtext: `Meeting: ${currentMeeting.is_private ? '🔒 Private' : currentMeeting.title}`, 
          style: "bg-rose-500/10 text-rose-400 border-rose-500/30" 
        };
      }

      const [startH, startM] = currentMeeting.start_time.split(':').map(Number);
      const meetingStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM, 0);
      const minutesElapsed = Math.floor((now - meetingStartTime) / 60000);

      const minutesIntoCurrentWindow = minutesElapsed % 10; 
      const gracePeriodMinutes = 3;

      if (minutesIntoCurrentWindow >= gracePeriodMinutes) {
        releaseGhostRoom(currentMeeting.id);

        return { 
          text: "AVAILABLE", 
          subtext: "Room automatically released due to no-show", 
          style: "bg-slate-900/40 text-slate-400 border-slate-800" 
        };
      } else {
        return { 
          text: "IN USE", 
          subtext: `Waiting for presence check-in (${gracePeriodMinutes - minutesIntoCurrentWindow}m remaining)`, 
          style: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" 
        };
      }
    }

    if (nextMeeting) {
      const [nextH, nextM] = nextMeeting.start_time.split(':').map(Number);
      const nextMeetingTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), nextH, nextM, 0);
      const minutesUntilMeeting = Math.floor((nextMeetingTime - now) / 60000);

      if (minutesUntilMeeting >= 0 && minutesUntilMeeting <= 5) {
        return { 
          text: "STARTING SOON", 
          subtext: `Next meeting begins in ${minutesUntilMeeting} mins`, 
          style: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 animate-pulse" 
        };
      }
    }

    if (isPersonDetected) {
      return { 
        text: "UNBOOKED USE", 
        subtext: nextMeeting ? `Room occupied without reservation until ${formatTime(nextMeeting.start_time)}` : "Room occupied without active reservation", 
        style: "bg-purple-500/10 text-purple-400 border-purple-500/30" 
      };
    }

    return { 
      text: "AVAILABLE", 
      subtext: nextMeeting ? `Until ${formatTime(nextMeeting.start_time)}` : "", 
      style: "bg-slate-900/40 text-slate-400 border-slate-800" 
    };
  };

  if (!room) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-mono text-xs tracking-widest">LOADING...</div>;

  if (currentPage === 'schedule') {
    return <SchedulePage bookings={bookings} renderHeader={renderHeader} goHome={() => setCurrentPage('dashboard')} />;
  }

  if (currentPage === 'booking') {
    return <BookingPage roomId={room.id} renderHeader={renderHeader} goHome={() => setCurrentPage('dashboard')} onSuccess={fetchBookings} />;
  }

  const nextMeeting = getUpcomingMeeting();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-8 font-sans overflow-hidden select-none">
      {renderHeader()}

      <div className="flex-1 flex flex-col items-center justify-center gap-6 my-4">
        <StatusDisplay currentStatus={getRoomStatus()} />
        
        {nextMeeting ? (
          <div className="bg-slate-900/40 border border-slate-800 backdrop-blur-md px-6 py-3 rounded-full flex items-center gap-3 shadow-lg max-w-xl animate-fade-in">
            <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
            <p className="text-sm text-slate-400 font-medium tracking-wide">
              Next: <span className="text-slate-200 font-semibold">{nextMeeting.is_private ? "🔒 Private Meeting" : nextMeeting.title}</span> 
              <span className="mx-2 text-slate-600">|</span> 
              🕒 {formatTime(nextMeeting.start_time)} - {formatTime(nextMeeting.end_time)}
              <span className="mx-2 text-slate-600">|</span> 
              Host: <span className="text-indigo-400 font-medium">{nextMeeting.users?.full_name || "Unknown"}</span>
            </p>
          </div>
        ) : (
          <div className="bg-slate-900/10 border border-slate-900/60 px-6 py-3 rounded-full text-3xl text-slate-600 font-medium tracking-wide">
            No more meetings scheduled for today
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-40 items-end">
        <button 
          onClick={() => setCurrentPage('schedule')}
          className="group relative bg-slate-900/50 hover:bg-slate-900 border border-slate-800/80 p-6 rounded-2xl h-full flex flex-col justify-between text-left transition-all duration-300 hover:border-slate-700 shadow-xl"
        >
          <div className="bg-slate-800/80 w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-white transition">📅</div>
          <div>
            <h3 className="text-sm font-bold text-slate-200">Schedule</h3>
          </div>
        </button>

        <button 
          onClick={() => setCurrentPage('booking')}
          className="group relative bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/30 p-6 rounded-2xl h-full flex flex-col justify-between text-left transition-all duration-300 shadow-xl shadow-indigo-950/20"
        >
          <div className="bg-white/10 w-10 h-10 rounded-xl flex items-center justify-center text-white">⚡</div>
          <div>
            <h3 className="text-sm font-bold text-white">Quick Book</h3>
          </div>
        </button>
      </div>

      <OccupancySensor roomId={room.id} />
    </div>
  );
}

export default App;