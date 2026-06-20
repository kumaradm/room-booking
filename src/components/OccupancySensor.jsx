import React, { useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { supabase } from '../supabaseClient';

export default function OccupancySensor({ roomId, onOccupancyChange }) {
  const webcamRef = useRef(null);
  const lastStateRef = useRef(false);

  useEffect(() => {
    let intervalId;
    let model;

    const updateRoomStatus = async (occupied) => {
      // 1. Bubble the status up to App.js instantly!
      if (onOccupancyChange) {
        onOccupancyChange(occupied);
      }

      // 2. Only write to Supabase if the state actually changes
      if (occupied !== lastStateRef.current) {
        lastStateRef.current = occupied;
        
        await supabase
          .from('rooms')
          .update({ is_occupied: occupied, updated_at: new Date() })
          .eq('id', roomId);
      }
    };

    const initSensor = async () => {
      await tf.ready();
      model = await cocoSsd.load();
      
      const performCheck = async () => {
        if (webcamRef.current && webcamRef.current.video.readyState === 4) {
          const video = webcamRef.current.video;
          const predictions = await model.detect(video);
          
          const personFound = predictions.some(p => p.class === 'person' && p.score > 0.6);
          updateRoomStatus(personFound);
          console.log(`[Smart Sensor Check] - Occupied: ${personFound}`);
        }
      };

      // Initial run
      performCheck();

      // Check every 10 seconds for faster kiosk responsiveness 
      // (Checking every 5 mins is too slow for a 5-min cancellation deadline)
      intervalId = setInterval(performCheck, 10000); 
    };

    if (roomId) {
      initSensor();
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [roomId, onOccupancyChange]);

  return (
    <div className="opacity-0 absolute bottom-0 right-0 w-1 h-1 overflow-hidden pointer-events-none">
      <Webcam ref={webcamRef} muted={true} width={160} height={120} />
    </div>
  );
}