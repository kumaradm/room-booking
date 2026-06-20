import React from 'react';

export default function StatusDisplay({ currentStatus }) {
  return (
    <div className="w-full max-w-full py-2 sm:py-4 text-center flex flex-col items-center justify-center overflow-hidden px-4">
      
      {/* Responsive Main Status Text 
        - Balanced tracking and line-height for multi-line fallback
        - Responsive sizing optimized to fit "STARTING SOON" inside iPad Pro Portrait limits
      */}
      <h2 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-[9rem] font-black tracking-tight text-white drop-shadow-2xl select-none leading-none uppercase break-words max-w-full w-full block">
        {currentStatus.text}
      </h2>
      
      {/* Container for subtext elements (Countdown timers / Next meeting details)
        - Swapped 'p' to 'div' to cleanly inherit children element blocks without browser rendering bugs
      */}
      <div className="text-lg sm:text-2xl md:text-3xl xl:text-4xl text-white font-extrabold tracking-wide mt-6 max-w-full w-full mx-auto drop-shadow-md flex flex-col items-center justify-center">
        {currentStatus.subtext}
      </div>
      
    </div>
  );
}