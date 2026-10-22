'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Sparkles, HelpCircle } from 'lucide-react';

export interface TourStep {
  target: string; // CSS selector e.g. '#tour-mark-attendance'
  title: string;
  description: string;
  position?: 'bottom' | 'top' | 'left' | 'right' | 'center';
}

interface OnboardingTourProps {
  role: 'student' | 'teacher' | 'superadmin' | 'admin';
  customSteps?: TourStep[];
}

const DEFAULT_STEPS: Record<string, TourStep[]> = {
  student: [
    {
      target: '#tour-welcome',
      title: 'Welcome to IIIT Bhagalpur AMS! 👋',
      description: 'Your personalized academic portal. Track your real-time attendance, safe class margins, and live notifications here.',
      position: 'bottom',
    },
    {
      target: '#tour-mark-attendance',
      title: 'Mark Live Attendance 📷',
      description: 'When class starts, tap here! Verify your attendance via 4-digit OTP or Teacher QR scan, alongside GPS Geofencing and Face ID AI.',
      position: 'bottom',
    },
    {
      target: '#tour-overall-attendance',
      title: 'Overall Attendance & Streak 🔥',
      description: 'Keep your attendance above 75%! This card calculates your active lecture streak and exactly how many classes you can safely miss.',
      position: 'bottom',
    },
    {
      target: '#tour-subject-breakdown',
      title: 'Subject-wise Breakdown 📚',
      description: 'Course-by-course analytics. Monitor each subject with color-coded safety indicators (Green: Safe, Red: Low attendance).',
      position: 'top',
    },
    {
      target: '#tour-cr-nav',
      title: 'CR Take Attendance 🎖️',
      description: 'When authorized by your professor as Class Representative, you can conduct and manage live attendance right from this tab.',
      position: 'right',
    },
  ],
  teacher: [
    {
      target: '#tour-teacher-welcome',
      title: 'Welcome Professor! 🎓',
      description: 'Manage your classes, verify student records, and conduct automated high-speed attendance from your central dashboard.',
      position: 'bottom',
    },
    {
      target: '#tour-cr-delegation',
      title: 'CR Take Attendance Delegation 🎖️',
      description: 'Urgent meeting or leave? Grant temporary Take Attendance access to your branch CR with custom validity hours or days.',
      position: 'bottom',
    },
    {
      target: '#tour-teacher-subjects',
      title: 'Start Live Attendance ⚡',
      description: 'Launch attendance sessions using OTP, Dynamic QR, or Multi-factor Face + Geofence. You can selectively toggle any verification check.',
      position: 'top',
    },
    {
      target: '#tour-teacher-reports',
      title: 'Reports & Excel Export 📑',
      description: 'Download aggregated attendance reports sorted in natural ascending Roll Number order, ready for academic office submission.',
      position: 'right',
    },
    {
      target: '#tour-teacher-appoint',
      title: 'Appoint Class Representatives 🎖️',
      description: 'Easily appoint and manage CRs for your branch sections to assist with class coordination and proxy-free verification.',
      position: 'right',
    },
  ],
  superadmin: [
    {
      target: '#tour-admin-stats',
      title: 'Administrative Control Center 🦸',
      description: 'Real-time overview of active students, verified teachers, registered subjects, and daily live sessions across all departments.',
      position: 'bottom',
    },
    {
      target: '#tour-admin-verify',
      title: 'Verify New Registrations ⏳',
      description: 'Review pending student and teacher signups. Verify official credentials and face descriptors before granting system access.',
      position: 'right',
    },
    {
      target: '#tour-admin-users',
      title: 'Manage All Users 👥',
      description: 'Comprehensive directory sorted by Roll Number. Filter by Branch and Group, edit details, or deactivate accounts when needed.',
      position: 'bottom',
    },
    {
      target: '#tour-admin-appoint',
      title: 'Appoint Positions & Admins 🎖️',
      description: 'Appoint Branch Admins (Pseudoadmins) with scoped administrative access and designate Class Representatives in isolated compartments.',
      position: 'bottom',
    },
    {
      target: '#tour-admin-subjects',
      title: 'Course & Subject Directory 📚',
      description: 'Create semester subjects, assign faculty teachers, and configure departmental sections and batches.',
      position: 'bottom',
    },
  ],
};

export function OnboardingTour({ role, customSteps }: OnboardingTourProps) {
  const effectiveRole = role === 'admin' ? 'superadmin' : role;
  const steps = customSteps || DEFAULT_STEPS[effectiveRole] || [];
  const storageKey = `ams_tour_completed_${effectiveRole}_v2`;

  const [active, setActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Check if tour should auto-open on first visit
  useEffect(() => {
    try {
      const hasCompleted = localStorage.getItem(storageKey);
      if (!hasCompleted && steps.length > 0) {
        const timer = setTimeout(() => {
          setActive(true);
          setCurrentStepIndex(0);
        }, 1200);
        return () => clearTimeout(timer);
      }
    } catch (e) {}
  }, [storageKey, steps.length]);

  // Measure and position highlight box
  const updateRect = useCallback(() => {
    if (!active || !steps[currentStepIndex]) return;
    const step = steps[currentStepIndex];
    const el = document.querySelector(step.target);

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [active, currentStepIndex, steps]);

  useEffect(() => {
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [updateRect]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleFinish = () => {
    try {
      localStorage.setItem(storageKey, 'true');
    } catch (e) {}
    setActive(false);
  };

  const restartTour = () => {
    setCurrentStepIndex(0);
    setActive(true);
  };

  if (!active || steps.length === 0) {
    // Floating Help / Tour pill to restart anytime
    return (
      <button
        onClick={restartTour}
        className="fixed bottom-5 right-5 z-40 bg-white dark:bg-[#2b211a] text-blue-700 dark:text-amber-300 border border-blue-200 dark:border-amber-800/80 shadow-lg hover:shadow-xl px-3.5 py-2 rounded-full text-xs font-black flex items-center gap-2 hover:scale-105 active:scale-95 transition-all duration-200 backdrop-blur-md"
        title="Start Feature Walkthrough Tour"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" />
        <span>Feature Tour</span>
      </button>
    );
  }

  const step = steps[currentStepIndex];
  const totalSteps = steps.length;

  // Calculate popover positioning relative to targetRect
  let popoverStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
  };

  if (targetRect) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const padding = 14;

    if (isMobile) {
      // Centered on mobile bottom/middle so it's always readable
      popoverStyle = {
        position: 'fixed',
        bottom: 24,
        left: 16,
        right: 16,
        zIndex: 9999,
      };
    } else {
      const preferredPos = step.position || 'bottom';
      if (preferredPos === 'bottom') {
        popoverStyle.top = Math.min(window.innerHeight - 240, targetRect.bottom + padding);
        popoverStyle.left = Math.max(16, Math.min(window.innerWidth - 380, targetRect.left + (targetRect.width / 2) - 170));
      } else if (preferredPos === 'top') {
        popoverStyle.top = Math.max(16, targetRect.top - 210);
        popoverStyle.left = Math.max(16, Math.min(window.innerWidth - 380, targetRect.left + (targetRect.width / 2) - 170));
      } else if (preferredPos === 'right') {
        popoverStyle.top = Math.max(16, Math.min(window.innerHeight - 240, targetRect.top));
        popoverStyle.left = Math.min(window.innerWidth - 380, targetRect.right + padding);
      } else {
        popoverStyle.top = Math.min(window.innerHeight - 240, targetRect.bottom + padding);
        popoverStyle.left = Math.max(16, Math.min(window.innerWidth - 380, targetRect.left));
      }
    }
  } else {
    // Fallback centered
    popoverStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 9999,
      width: '90%',
      maxWidth: 380,
    };
  }

  return (
    <>
      {/* ── Spotlight Backdrop ── */}
      <div
        className="fixed inset-0 z-[9990] bg-black/65 backdrop-blur-[2px] transition-all duration-300"
        onClick={handleFinish}
      />

      {/* ── Active Element Glowing Highlight Box ── */}
      {targetRect && (
        <div
          className="fixed z-[9995] pointer-events-none rounded-2xl ring-4 ring-blue-500/90 dark:ring-amber-400 shadow-[0_0_25px_rgba(59,130,246,0.6)] transition-all duration-300"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      {/* ── Tour Popover Card (Unstop Style) ── */}
      <div
        style={popoverStyle}
        className="w-full max-w-[360px] sm:max-w-[380px] bg-white dark:bg-[#241c16] text-gray-900 dark:text-[#fcf7f2] rounded-2xl p-5 shadow-2xl border border-gray-200 dark:border-amber-700/50 animate-in fade-in zoom-in-95 duration-200 select-none"
      >
        {/* Header with Title and Close */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-amber-100 leading-snug">
            {step.title}
          </h3>
          <button
            onClick={handleFinish}
            className="text-gray-400 hover:text-gray-800 dark:hover:text-white p-1 rounded-lg transition"
            title="Close Tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-gray-700 dark:text-amber-200/90 font-medium leading-relaxed mb-5">
          {step.description}
        </p>

        {/* Footer with Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-amber-900/40">
          <button
            onClick={handleFinish}
            className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition px-2 py-1.5"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                onClick={handlePrev}
                className="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-[#4d3a2d] hover:bg-gray-100 dark:hover:bg-[#34271e] text-xs font-bold text-gray-700 dark:text-amber-200 transition flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-4 py-1.5 rounded-xl bg-blue-600 dark:bg-amber-600 hover:bg-blue-700 dark:hover:bg-amber-700 text-white text-xs font-black shadow-md transition flex items-center gap-1.5 active:scale-95"
            >
              {currentStepIndex === totalSteps - 1 ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Finish
                </>
              ) : (
                <>
                  <span>Next {currentStepIndex + 1}/{totalSteps}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
