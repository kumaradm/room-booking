import React, { useState, useMemo, useEffect, useRef } from 'react';

export default function DatePicker({ isOpen, onClose, selectedDate, onSelectDate }) {
  // 'days' | 'months' | 'years'
  const [viewMode, setViewMode] = useState('days');
  
  const [pickerMonth, setPickerMonth] = useState(selectedDate.getMonth());
  const [pickerYear, setPickerYear] = useState(selectedDate.getFullYear());
  
  // Pivot year to track which decade grid chunk is currently displayed
  const [decadeStartYear, setDecadeStartYear] = useState(Math.floor(selectedDate.getFullYear() / 10) * 10 + 1);
  
  const containerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPickerMonth(selectedDate.getMonth());
      setPickerYear(selectedDate.getFullYear());
      setDecadeStartYear(Math.floor(selectedDate.getFullYear() / 10) * 10 + 1);
      setViewMode('days');
    }
  }, [isOpen, selectedDate]);

  useEffect(() => {
    if (!isOpen) return;
    function handleOutsideClick(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, onClose]);

  const monthsArray = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  // Computes the 10 years belonging to the active decade window
  const decadeYearsRange = useMemo(() => {
    const years = [];
    for (let i = 0; i < 10; i++) {
      years.push(decadeStartYear + i);
    }
    return years;
  }, [decadeStartYear]);

  const calendarGridDays = useMemo(() => {
    const firstDayOfMonth = new Date(pickerYear, pickerMonth, 1);
    const lastDayOfMonth = new Date(pickerYear, pickerMonth + 1, 0);
    
    const totalDays = lastDayOfMonth.getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= totalDays; day++) {
      days.push(new Date(pickerYear, pickerMonth, day));
    }
    return days;
  }, [pickerMonth, pickerYear]);

  if (!isOpen) return null;

  const systemTodayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const targetDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

  // Helper formatting for labels matching requested short template style (e.g., 2021-2030 -> '21-30')
  const formattedDecadeLabel = `${String(decadeStartYear).slice(-2)}-${String(decadeStartYear + 9).slice(-2)}`;

  // Header chevron navigation logic based on current structural view layout
  const handleHeaderNav = (direction) => {
    const offset = direction === 'next' ? 1 : -1;
    
    if (viewMode === 'days') {
      if (direction === 'prev' && pickerMonth === 0) {
        setPickerMonth(11);
        setPickerYear(prev => prev - 1);
      } else if (direction === 'next' && pickerMonth === 11) {
        setPickerMonth(0);
        setPickerYear(prev => prev + 1);
      } else {
        setPickerMonth(prev => prev + offset);
      }
    } else if (viewMode === 'months') {
      setPickerYear(prev => prev + offset);
    } else if (viewMode === 'years') {
      setDecadeStartYear(prev => prev + (offset * 10));
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative z-[60] w-[300px] bg-white rounded-2xl p-4 shadow-xl border border-neutral-200/80 flex flex-col gap-3 transition-all origin-top"
    >
      {/* Header Controls Segment */}
      <div className="flex items-center justify-between px-1 border-b border-neutral-100 pb-2">
        <div className="flex items-center gap-1 font-bold text-sm text-[#1C1C1E]">
          {viewMode === 'days' && (
            <>
              <button 
                type="button" 
                onClick={() => setViewMode('months')}
                className="hover:bg-neutral-100 px-2 py-0.5 rounded-md text-[#007AFF] border-0 bg-transparent font-bold transition"
              >
                {monthsArray[pickerMonth]}
              </button>
              <button 
                type="button" 
                onClick={() => setViewMode('years')}
                className="hover:bg-neutral-100 px-2 py-0.5 rounded-md text-neutral-700 border-0 bg-transparent font-semibold transition"
              >
                {pickerYear}
              </button>
            </>
          )}

          {viewMode === 'months' && (
            <button 
              type="button"
              onClick={() => setViewMode('years')}
              className="hover:bg-neutral-100 px-2 py-0.5 rounded-md text-[#007AFF] border-0 bg-transparent font-bold transition"
            >
              {pickerYear}
            </button>
          )}

          {viewMode === 'years' && (
            <span className="px-2 py-0.5 text-neutral-800 font-bold tracking-tight">
              Years ({formattedDecadeLabel})
            </span>
          )}
        </div>

        {/* Dynamic Chevron Action Buttons */}
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => handleHeaderNav('prev')}
            className="text-[#007AFF] hover:bg-neutral-100 rounded-lg p-1.5 transition border-0 bg-transparent"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="size-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button 
            type="button"
            onClick={() => handleHeaderNav('next')}
            className="text-[#007AFF] hover:bg-neutral-100 rounded-lg p-1.5 transition border-0 bg-transparent"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="size-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* VIEW PANEL MODE 1: DAYS MATRIX */}
      {viewMode === 'days' && (
        <>
          <div className="grid grid-cols-7 text-center text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">
            <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
          </div>

          <div className="grid grid-cols-7 gap-y-1 gap-x-1 text-center items-center">
            {calendarGridDays.map((dayObj, idx) => {
              if (dayObj === null) {
                return <div key={`empty-${idx}`} className="w-8 h-8" />;
              }

              const curYear = dayObj.getFullYear();
              const curMonth = String(dayObj.getMonth() + 1).padStart(2, '0');
              const curDay = String(dayObj.getDate()).padStart(2, '0');
              const blockDateStr = `${curYear}-${curMonth}-${curDay}`;

              const isSelected = blockDateStr === targetDateStr;
              const isToday = blockDateStr === systemTodayStr;

              return (
                <button
                  key={blockDateStr}
                  type="button"
                  onClick={() => onSelectDate(dayObj)}
                  className={`w-8 h-8 mx-auto rounded-full font-medium text-[13px] flex flex-col items-center justify-center transition-all relative border-0 ${
                    isSelected
                      ? 'bg-[#007AFF] text-white font-semibold shadow-sm'
                      : isToday
                      ? 'text-[#007AFF] font-bold'
                      : 'bg-transparent hover:bg-neutral-100 text-black'
                  }`}
                >
                  <span>{dayObj.getDate()}</span>
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 bg-[#007AFF] rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* VIEW PANEL MODE 2: MONTHS GRID */}
      {viewMode === 'months' && (
        <div className="grid grid-cols-3 gap-2 py-1 text-center">
          {monthsArray.map((monthName, index) => {
            const isCurrentSelection = index === pickerMonth;
            return (
              <button
                key={monthName}
                type="button"
                onClick={() => {
                  setPickerMonth(index);
                  setViewMode('days');
                }}
                className={`py-2.5 rounded-xl text-sm font-semibold transition border-0 ${
                  isCurrentSelection
                    ? 'bg-[#007AFF] text-white shadow-sm'
                    : 'bg-neutral-50 hover:bg-neutral-100 text-[#1C1C1E]'
                }`}
              >
                {monthName}
              </button>
            );
          })}
        </div>
      )}

      {/* VIEW PANEL MODE 3: YEARS GRID (DECADAL WRAPPER) */}
      {viewMode === 'years' && (
        <div className="grid grid-cols-2 gap-2 py-1 text-center">
          {decadeYearsRange.map((yearItem) => {
            const isCurrentSelection = yearItem === pickerYear;
            return (
              <button
                key={yearItem}
                type="button"
                onClick={() => {
                  setPickerYear(yearItem);
                  setViewMode('months'); // Step downwards back into Month Selection matrix
                }}
                className={`py-2 rounded-xl text-sm font-semibold transition border-0 ${
                  isCurrentSelection
                    ? 'bg-[#007AFF] text-white shadow-sm'
                    : 'bg-neutral-50 hover:bg-neutral-100 text-[#1C1C1E]'
                }`}
              >
                {yearItem}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}