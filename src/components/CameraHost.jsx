import React, { useRef, useEffect, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { supabase } from '../supabaseClient';

export default function CameraHost({ roomId }) {
  const videoRef = useRef(null);
  const [model, setModel] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [personCount, setPersonCount] = useState(0);

  // Use a ref to track the last sent state so we only update Supabase on state change
  const lastOccupiedRef = useRef(false);

  // 1. Load the COCO-SSD Model on Mount
  useEffect(() => {
    async function loadModel() {
      try {
        setIsLoading(true);
        await tf.ready();
        const loadedModel = await cocoSsd.load({ base: 'mobilenet_v2' }); 
        setModel(loadedModel);
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading object detection model:", err);
        setErrorMsg("Failed to load AI model. Please reload.");
      }
    }
    loadModel();
  }, []);

  // 2. Start the Webcam Feed
  useEffect(() => {
    if (isLoading || !videoRef.current) return;

    navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false
    })
    .then((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    })
    .catch((err) => {
      console.error("Camera access denied:", err);
      setErrorMsg("Camera access denied. Please allow permissions.");
    });

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [isLoading]);

  // 3. Real-Time Processing loop (Runs AI model & calculates counts)
  useEffect(() => {
    if (!model || !videoRef.current) return;

    let animationFrameId;
    let lastDetectionTime = 0;
    const DETECTION_INTERVAL = 150; // Runs evaluation ~6-7 times a second (light on CPU)

    const detectFrame = async () => {
      const video = videoRef.current;
      if (!video || video.readyState !== 4) {
        animationFrameId = requestAnimationFrame(detectFrame);
        return;
      }

      const now = performance.now();
      if (now - lastDetectionTime > DETECTION_INTERVAL) {
        lastDetectionTime = now;

        try {
          // Run prediction frame analysis
          const predictions = await model.detect(video);
          
          // Count only objects identified as 'person' with >50% confidence
          const detectedPeople = predictions.filter(
            pred => pred.class === 'person' && pred.score > 0.5
          );

          const count = detectedPeople.length;
          setPersonCount(count);

          // Update database state only when occupancy status actually changes (empty vs occupied)
          const isOccupied = count > 0;
          if (roomId && isOccupied !== lastOccupiedRef.current) {
            lastOccupiedRef.current = isOccupied;
            
            await supabase
              .from('rooms')
              .update({ is_occupied: isOccupied, updated_at: new Date() })
              .eq('id', roomId);
          }

        } catch (err) {
          console.error("Detection iteration error:", err);
        }
      }

      animationFrameId = requestAnimationFrame(detectFrame);
    };

    detectFrame();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [model, roomId]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full max-w-4xl px-4 py-8">
      
      {/* Video Container viewport */}
      <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
        
        {/* Loading and Error Overlays */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-20 gap-3">
            <svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-emerald-400 font-mono text-xs uppercase tracking-widest">Initialising AI System...</span>
          </div>
        )}

        {errorMsg && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-25 text-red-500 font-mono text-sm px-4 text-center">
            {errorMsg}
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform -scale-x-100" // Mirrors webcam for normal viewing orientation
        />
      </div>

      {/* --- PEOPLE COUNTER DISPLAY BOARD (Positioned directly under camera) --- */}
      <div className="mt-6 bg-slate-900/60 border border-slate-800/80 px-8 py-5 rounded-[2rem] flex flex-row items-center justify-between gap-8 w-full shadow-2xl backdrop-blur-xl">
        
        {/* Left Side: Status Lights */}
        <div className="flex items-center gap-4">
          <span className="relative flex h-4 w-4">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 transition-all duration-500 ${personCount > 0 ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            <span className={`relative inline-flex rounded-full h-4 w-4 transition-all duration-500 ${personCount > 0 ? 'bg-emerald-500' : 'bg-slate-600'}`} />
          </span>
          <div className="flex flex-col">
            <span className="text-white/40 font-bold text-[10px] uppercase tracking-widest leading-none">Status</span>
            <span className={`text-lg font-bold tracking-tight uppercase mt-0.5 ${personCount > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
              {personCount > 0 ? 'Room Occupied' : 'Room Empty'}
            </span>
          </div>
        </div>

        {/* Vertical divider */}
        <div className="h-10 w-[1px] bg-slate-800" />

        {/* Right Side: Total Count Badge */}
        <div className="flex items-center gap-4">
          <span className="text-white/40 font-bold text-[10px] uppercase tracking-widest text-right leading-none block">
            Current<br />Headcount
          </span>
          <div className={`px-5 py-2.5 rounded-2xl border font-black text-3xl font-mono min-w-[70px] text-center transition-all duration-300 ${
            personCount > 0 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-slate-950/50 border-slate-800 text-slate-500'
          }`}>
            {personCount}
          </div>
        </div>

      </div>
    </div>
  );
}