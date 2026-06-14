import React from 'react';

export default function StatusDisplay({ currentStatus }) {
  return (
    <div className={`w-full p-12 rounded-3xl text-center transition-all duration-500 ${currentStatus.style}`}>
      <h2 className="text-[12vw] font-black tracking-wider transition-all">
        {currentStatus.text}
      </h2>
      <p className="text-[4vw] opacity-70 font-medium">
        {currentStatus.subtext}
      </p>
    </div>
  );
}