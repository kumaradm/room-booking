import { useMemo } from 'react';

export const SIMULATED_STATUS_CONFIGS = {
  STARTING_SOON: {
    text: "STARTING SOON",
    bgStyle: "from-[#FFD60A] to-[#3D2800]",
    textSize: "md:text-[6rem] xl:text-[7.5rem]",
    subtext: "",
    countdown: { 
      label: "Next meeting will start in", 
      primaryLabel: "Minutes", 
      secondaryLabel: "Seconds",
      highlightSecondary: true
    },
    meeting: {
      id: "mock-1",
      title: "Weekly Sync & Alignment",
      is_private: false,
      users: { full_name: "Sarah Jenkins" }
    }
  },
  IN_USE: {
    text: "IN USE",
    bgStyle: "from-[#FF3B30] to-[#5E0B08]",
    textSize: "md:text-[8rem] xl:text-[9.5rem]",
    subtext: "",
    countdown: { 
      label: "Meeting will end in", 
      primaryLabel: "Hours", 
      secondaryLabel: "Minutes",
      highlightSecondary: false
    },
    meeting: {
      id: "mock-2",
      title: "Design Review & Retro",
      is_private: false,
      users: { full_name: "Alex Rivera" }
    }
  },
  BREAK: {
    text: "BREAK",
    bgStyle: "from-[#007AFF] to-[#002D6C]", 
    textSize: "md:text-[8rem] xl:text-[9.5rem]",
    subtext: "Calm down period active",
    countdown: { 
      label: "Break ends when meeting ends in", 
      primaryLabel: "Hours", 
      secondaryLabel: "Minutes",
      highlightSecondary: false
    },
    meeting: {
      id: "mock-3",
      title: "Scheduled Team Coffee Break",
      is_private: false,
      users: { full_name: "Operations Team" }
    }
  }
};

const timeToMinutes = (tStr) => {
  if (!tStr) return 0;
  const [h, m] = tStr.split(':').map(Number);
  return h * 60 + m;
};

export function useKioskState({ 
  useSimulator, 
  simulatedStatus, 
  bookings, 
  timeStrings, 
  currentTime, 
  isBreakActive,
  formatTime 
}) {
  
  const liveState = useMemo(() => {
    const nowMinutes = timeToMinutes(timeStrings.timeStr);

    const active = bookings.find(b => {
      if (b.booking_date !== timeStrings.dateStr) return false;
      const start = timeToMinutes(b.start_time);
      const end = timeToMinutes(b.end_time);
      return nowMinutes >= start && nowMinutes < end;
    });

    const nextAhead = bookings.find(b => {
      if (b.booking_date !== timeStrings.dateStr) return false;
      return timeToMinutes(b.start_time) > nowMinutes;
    });

    // FIX: Check-in window is 5 mins BEFORE to 5 mins AFTER start time (10 min total window)
    const canCheckIn = bookings.some(b => {
      if (b.booking_date !== timeStrings.dateStr) return false;
      const start = timeToMinutes(b.start_time);
      return nowMinutes >= (start - 5) && nowMinutes <= (start + 5);
    });

    if (active) {
      const totalEndMinutes = timeToMinutes(active.end_time);
      const diffMins = Math.max(0, totalEndMinutes - nowMinutes);
      
      const displayHrs = Math.floor(diffMins / 60).toString().padStart(2, '0');
      const displayMins = (diffMins % 60).toString().padStart(2, '0');

      return {
        // FIX: Bubble notification displays NEXT meeting only (or null if none)
        meetingToDisplay: nextAhead || null, 
        activeMeeting: active, 
        nextMeeting: nextAhead || null,
        canCheckIn,
        status: {
          text: isBreakActive ? "BREAK" : "IN USE",
          bgStyle: isBreakActive ? "from-[#007AFF] to-[#002D6C]" : "from-[#FF3B30] to-[#5E0B08]",
          textSize: "md:text-[8rem] xl:text-[9.5rem]",
          // FIX: Pass plain text title to display directly under "IN USE" text
          activeTitle: active.is_private ? "Private Meeting" : active.title,
          activeHost: active.users?.full_name || "Organizer",
          countdown: { 
            label: isBreakActive ? "Break ends when meeting ends in" : "Meeting will end in", 
            primary: displayHrs, 
            primaryLabel: "Hours", 
            secondary: displayMins, 
            secondaryLabel: "Minutes",
            highlightSecondary: false
          }
        }
      };
    } 
    
    if (nextAhead) {
      const minutesUntilNext = timeToMinutes(nextAhead.start_time) - nowMinutes;
      if (minutesUntilNext <= 5 && minutesUntilNext >= 0) {
        const [targetH, targetM] = nextAhead.start_time.split(':').map(Number);
        const targetDate = new Date(currentTime);
        targetDate.setHours(targetH, targetM, 0, 0);
        
        const diffMs = targetDate - currentTime;
        const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
        const displayMins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const displaySecs = (totalSeconds % 60).toString().padStart(2, '0');

        return {
          meetingToDisplay: nextAhead,
          activeMeeting: null,
          nextMeeting: nextAhead,
          canCheckIn,
          status: {
            text: "STARTING SOON",
            bgStyle: "from-[#FFD60A] to-[#3D2800]",
            textSize: "md:text-[6rem] xl:text-[7.5rem]",
            activeTitle: nextAhead.is_private ? "Private Meeting" : nextAhead.title,
            activeHost: nextAhead.users?.full_name || "Organizer",
            countdown: { 
              label: "Next meeting will start in", 
              primary: displayMins, 
              primaryLabel: "Minutes", 
              secondary: displaySecs, 
              secondaryLabel: "Seconds",
              highlightSecondary: true
            }
          }
        };
      }
    }

    return {
      meetingToDisplay: nextAhead || null,
      activeMeeting: null,
      nextMeeting: null,
      canCheckIn,
      status: {
        text: "AVAILABLE",
        subtext: nextAhead ? `Until ${formatTime(nextAhead.start_time)}` : "For the rest of the day",
        bgStyle: "from-[#30D158] to-[#0C3E1E]",
        textSize: "md:text-[8rem] xl:text-[9.5rem]"
      }
    };
  }, [bookings, timeStrings, currentTime, isBreakActive, formatTime]);

  const simulatedState = useMemo(() => {
    const baseConfig = SIMULATED_STATUS_CONFIGS[simulatedStatus];
    
    const mockActive = simulatedStatus !== 'STARTING_SOON' ? {
      ...baseConfig.meeting,
      booking_date: timeStrings.dateStr,
      start_time: new Date(currentTime.getTime() - 15 * 60000).toTimeString().substring(0,5),
      end_time: new Date(currentTime.getTime() + 20 * 60000).toTimeString().substring(0,5),
    } : null;

    const mockNext = {
      id: "mock-next-1",
      title: "Quarterly Strategy Review",
      is_private: false,
      users: { full_name: "Elena Rostova" },
      start_time: "15:00",
      end_time: "16:00"
    };

    let displayPri = "00";
    let displaySec = "18";

    if (simulatedStatus === 'STARTING_SOON') {
      const targetDate = new Date(currentTime.getTime() + 4 * 60000 + 12 * 1000); 
      const diffMs = Math.max(0, targetDate - currentTime);
      displayPri = Math.floor(diffMs / 60000).toString().padStart(2, '0');
      displaySec = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
    }

    return {
      activeMeeting: mockActive,
      nextMeeting: mockNext,
      // FIX: Ensure bubble notification card tracks UPCOMING meeting only
      meetingToDisplay: mockNext, 
      canCheckIn: true,
      status: {
        ...baseConfig,
        activeTitle: mockActive ? mockActive.title : null,
        activeHost: mockActive ? mockActive.users?.full_name : null,
        countdown: baseConfig.countdown ? {
          ...baseConfig.countdown,
          primary: displayPri,
          secondary: displaySec
        } : null
      }
    };
  }, [simulatedStatus, currentTime, timeStrings.dateStr]);

  return useSimulator ? simulatedState : liveState;
}