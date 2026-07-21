// OccupancySensor.jsx
import React, { useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function OccupancySensor({ roomId, onOccupancyChange }) {
  useEffect(() => {
    if (!roomId) return;

    // 1. Fetch initial status from Supabase
    async function fetchInitialStatus() {
      const { data, error } = await supabase
        .from('rooms')
        .select('is_occupied')
        .eq('id', roomId)
        .single();

      if (data && !error && onOccupancyChange) {
        onOccupancyChange(!!data.is_occupied);
      }
    }

    fetchInitialStatus();

    // 2. Real-time WebSocket listener
    const channel = supabase
      .channel('room-occupancy-sync')
      .on(
        'broadcast',
        { event: 'occupancy_change' },
        (payload) => {
          if (payload.payload.roomId === roomId && onOccupancyChange) {
            onOccupancyChange(payload.payload.isPersonDetected);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, onOccupancyChange]);

  // Return null so nothing renders on screen
  return null;
}