import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function QuickBook({ roomId, onBookingSuccess }) {
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !email) return alert('Please fill out all fields.');

    setIsSubmitting(true);

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (userError) {
      alert('Database error during verification.');
      setIsSubmitting(false);
      return;
    }

    if (!user) {
      alert('❌ Access Denied: This email is not verified to book rooms.');
      setIsSubmitting(false);
      return;
    }

    const { error: bookingError } = await supabase
      .from('bookings')
      .insert([
        {
          room_id: roomId,
          title: title,
          booking_date: date,
          start_time: startTime,
          end_time: endTime,
          is_private: isPrivate,
          booker_id: user.id
        }
      ]);

    setIsSubmitting(false);

    if (bookingError) {
      alert('Error booking room: ' + bookingError.message);
    } else {
      alert('🎉 Room booked successfully!');
      setTitle('');
      setEmail('');
      setIsPrivate(false);
      if (onBookingSuccess) onBookingSuccess();
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800/80 p-6 rounded-2xl h-full flex flex-col justify-between overflow-y-auto max-h-64 custom-scrollbar">
      <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-400 mb-2">Quick Book</h3>
      
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <input 
          type="email" 
          placeholder="Enter Verified Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
          required
        />

        <input 
          type="text" 
          placeholder="Meeting Title / Occasion"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
          required
        />

        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 font-medium">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-200 focus:outline-none focus:border-indigo-500" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 font-medium">Start</span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-200 focus:outline-none focus:border-indigo-500" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500 font-medium">End</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-200 focus:outline-none focus:border-indigo-500" />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center space-x-2 text-slate-400 cursor-pointer">
            <input 
              type="checkbox" 
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-indigo-500 focus:ring-0 w-4 h-4"
            />
            <span>Private meeting</span>
          </label>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-xl font-medium transition disabled:opacity-50 text-white shadow-lg shadow-indigo-600/10"
          >
            {isSubmitting ? 'Verifying...' : 'Reserve'}
          </button>
        </div>
      </form>
    </div>
  );
}