import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function BookingPage({ roomId, renderHeader, goHome, onSuccess }) {
  const [title, setTitle] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isPrivate, setIsPrivate] = useState(false);
  const [teamsLink, setTeamsLink] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [usersList, setUsersList] = useState([]);
  const [allBookingsOnDate, setAllBookingsOnDate] = useState([]);

  const getTodayString = () => {
  return new Date().toISOString().split('T')[0];
};

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
      return alert('Please enter all parameters completely.');
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
      alert('Allocation error: ' + error.message);
    } else {
      alert('🎉 Room allocated successfully!');
      onSuccess();
      goHome();
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 p-8 flex flex-col justify-between select-none">
      <div>
        {renderHeader()}
      </div>

      <div className="flex-1 flex items-center justify-center w-full my-4">
        <form onSubmit={handleBooking} className="w-full max-w-xl h-full flex-1 flex flex-col justify-between bg-slate-900/30 border border-slate-900 p-8 rounded-2xl text-xs">
          <div className="space-y-5">
            <span className="text-[14px] uppercase font-bold tracking-widest text-indigo-400 block mb-2">
              Workspace Reservation Module
            </span>

            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 flex flex-col gap-1.5 w-full">
                <label className="text-slate-400 font-medium">Title</label>
                <input 
                  type="text" 
                  placeholder="e.g., 'Project Sync'"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-11 bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500 w-full"
                  required
                />
              </div>

              <label className="flex items-center justify-between px-4 h-11 bg-slate-950 rounded-xl border border-slate-800/60 cursor-pointer sm:w-56 w-full shrink-0">
                <span className="text-slate-400 font-medium">🔒 Private Meeting</span>
                <input 
                  type="checkbox" 
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 bg-slate-900 rounded border-slate-800 focus:ring-0"
                />
              </label>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 font-medium">Booked By (Organizer Identity)</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="h-11 bg-slate-950 border border-slate-800/80 rounded-xl px-3 text-slate-200 focus:outline-none focus:border-indigo-500 w-full cursor-pointer"
                required
              >
                <option value="" disabled hidden>Select your verified profile account</option>
                {usersList.map(u => (
                  <option key={u.id} value={u.id} className="bg-slate-950 text-slate-200">
                    {u.full_name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-950/60 border border-slate-900 p-5 rounded-xl space-y-4">
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">Reservation Window</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400 font-medium">Target Date</label>
                  <input 
                    type="date" 
                    value={date} 
                    min={getTodayString()}
                    onChange={(e) => setDate(e.target.value)} 
                    className="h-11 bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-slate-200 focus:outline-none w-full cursor-pointer" 
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400 font-medium">Start Time</label>
                  <select 
                    value={startTime} 
                    onChange={(e) => setStartTime(e.target.value)} 
                    className="h-11 bg-slate-950 border border-slate-800/80 rounded-xl px-3 text-slate-200 focus:outline-none w-full cursor-pointer"
                  >
                    {availableStartTimes.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400 font-medium">End Time</label>
                  <select 
                    value={endTime} 
                    onChange={(e) => setEndTime(e.target.value)} 
                    className="h-11 bg-slate-950 border border-slate-800/80 rounded-xl px-3 text-slate-200 focus:outline-none w-full cursor-pointer"
                  >
                    {availableEndTimes.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-auto">
            <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800/60 cursor-pointer">
              <span className="text-slate-400 font-medium">💻 Add Teams Meeting Link Instance</span>
              <input 
                type="checkbox" 
                checked={teamsLink}
                onChange={(e) => setTeamsLink(e.target.checked)}
                className="w-4 h-4 text-indigo-600 bg-slate-900 rounded border-slate-800 focus:ring-0"
              />
            </label>
          </div>
        </form>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-slate-900 mt-6">
        <button 
          type="button"
          onClick={goHome}
          className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold px-6 py-2.5 rounded-xl text-xs transition shadow-lg"
        >
          🏠 Return Dashboard
        </button>

        <button 
          onClick={() => handleBooking()}
          disabled={isSubmitting || !availableStartTimes.length}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-2.5 rounded-xl text-xs transition disabled:opacity-40 shadow-lg shadow-indigo-600/10"
        >
          {isSubmitting ? 'Confirming Reservation...' : '⚡ Reserve Space'}
        </button>
      </div>
    </div>
  );
}