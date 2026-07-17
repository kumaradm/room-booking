import React, { useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function OccupancySensor({ roomId, onOccupancyChange }) {
  useEffect(() => {
    if (!roomId) return;

    // Listen to the WebSocket broadcast channel emitted by the CameraHost
    const channel = supabase.channel('room-occupancy-sync');

    channel
      .on('broadcast', { event: 'occupancy_change' }, (response) => {
        const { payload } = response;
        
        // Ensure the payload matches the specific room
        if (payload && payload.roomId === roomId) {
          if (onOccupancyChange) {
            onOccupancyChange(payload.isPersonDetected);
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Kiosk Sensor Client] Realtime synchronization linked.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, onOccupancyChange]);

  // Acts purely as a network-to-state proxy component, returning nothing to render
  return null;
}