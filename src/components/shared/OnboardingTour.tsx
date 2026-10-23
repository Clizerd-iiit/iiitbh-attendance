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
  role: 'student' | 'teacher' | 'superadmin' | 'admin' | 'pseudoadmin';
  customSteps?: TourStep[];
}

const DEFAULT_STEPS: Record<string, TourStep[]> = {
  student: [
    {
      target: '#tour-welcome',
      title: 'Welcome to IIIT Bhagalpur AMS! 👋',
      description: 'Your personalized academic portal. Monitor live attendance, safe class margins, official circulars, and study materials in one place.',
      position: 'bottom',
    },
    {
      target: '#tour-mark-attendance',
      title: 'Mark Live Attendance 📷',
      description: 'When class starts, tap here! Verify your presence using 4-digit OTP or Teacher QR scan, alongside GPS Geofencing and Face ID AI.',
      position: 'bottom',
    },
    {
      target: '#tour-overall-attendance',
      title: 'Overall Attendance & Streak 🔥',
      description: 'Keep your attendance comfortably above 75%! This card calculates your active lecture streak and exactly how many classes you can safely miss.',
      position: 'bottom',
    },
    {
      target: '#tour-subject-breakdown',
      title: 'Subject-wise Breakdown 📚',
      description: 'Course-by-course analytics. Monitor theory, lab, and tutorial lectures with real-time percentages and color-coded safety indicators.',
      position: 'top',
    },
    {
      target: '#tour-student-announcements',
      title: 'Announcements & Circulars 📢',
      description: 'Stay informed with real-time class rescheduling notices, quiz alerts, exam updates, and official notifications posted by teachers and admins.',
      position: 'right',
    },
    {
      target: '#tour-student-history',
      title: 'My Attendance Calendar 📅',
      description: 'Review your complete lecture history. Check attended and missed classes day-by-day, with exact timestamps and verification modes.',
      position: 'right',
    },
    {
      target: '#tour-student-vault',
      title: 'Notes & Study Vault 📖',
      description: 'Access subject study materials, class presentations, syllabus outlines, and past exam resources uploaded by professors.',
      position: 'right',
    },
    {
      target: '#tour-student-profile',
      title: 'Profile & 3D Face Biometrics 👤',
      description: 'Verify your registered branch, semester, and roll number. Set up or update your 3D Face ID biometric model for proxy-free verification.',
      position: 'right',
    },
    {
      target: '#tour-cr-nav',
      title: 'CR Take Attendance 🎖️',
      description: 'When authorized by your professor as Class Representative, you can conduct and manage live attendance right from this tab.',
      position: 'right',
    },
    {
      target: '#tour-student-contact',
      title: 'Contact Admin & Support 🎧',
      description: 'Need help with registration, attendance disputes, or face scanner issues? Send a direct message to system administrators.',
      position: 'right',
    },
  ],
  teacher: [
    {
      target: '#tour-teacher-welcome',
      title: 'Welcome Professor! 🎓',
      description: 'Your central teaching hub. Launch live classes, monitor attendance in real time, and export official academic reports.',
      position: 'bottom',
    },
    {
      target: '#tour-teacher-subjects',
      title: 'Start Live Attendance ⚡',
      description: 'Select any of your assigned subjects and launch a live lecture session with custom topic, date, and verification criteria.',
      position: 'top',
    },
    {
      target: '#tour-teacher-modes',
      title: 'Dynamic QR & OTP Modes 🔐',
      description: 'Choose between auto-refreshing Dynamic QR codes for projector screens or quick 4-digit OTPs for fast classroom check-in.',
      position: 'bottom',
    },
    {
      target: '#tour-teacher-verification',
      title: 'AI Face Recognition & Geofence 🛡️',
      description: 'Stop proxies completely. Enable 3D facial recognition and GPS classroom boundaries, or selectively disable any check as needed.',
      position: 'bottom',
    },
    {
      target: '#tour-teacher-kiosk',
      title: 'Live Student Grid & Kiosk Mode 👥',
      description: 'Watch student check-ins stream live on your screen. Easily toggle Present, Absent, or Late for any student with instant search.',
      position: 'bottom',
    },
    {
      target: '#tour-cr-delegation',
      title: 'CR Attendance Delegation 🎖️',
      description: 'Going on leave or attending a conference? Authorize your trusted Class Representative with temporary attendance permissions.',
      position: 'bottom',
    },
    {
      target: '#tour-teacher-history',
      title: 'Lecture History & Testing Cleanup 🕒',
      description: 'Audit conducted classes across all subjects, inspect attendance records, and delete test or accidental sessions.',
      position: 'bottom',
    },
    {
      target: '#tour-teacher-reports',
      title: 'Reports & Roll-Number Export 📑',
      description: 'Download ready-to-submit Excel & CSV attendance sheets automatically sorted in natural ascending Roll Number order.',
      position: 'right',
    },
    {
      target: '#tour-teacher-appoint',
      title: 'Appoint Class Representatives 🎖️',
      description: 'Assign authoritative CRs for your branch sections to assist with class coordination, proxy checks, and announcements.',
      position: 'right',
    },
    {
      target: '#tour-teacher-announcements',
      title: 'Broadcast Class Announcements 📢',
      description: 'Post extra class notices, quiz schedules, syllabus updates, or urgent circulars directly to students in your subjects.',
      position: 'right',
    },
  ],
  superadmin: [
    {
      target: '#tour-admin-stats',
      title: 'Administrative Control Center 🦸',
      description: 'Comprehensive overview of active students, verified faculty, registered subjects, and daily live sessions across all departments.',
      position: 'bottom',
    },
    {
      target: '#tour-admin-verify',
      title: 'Verify User Registrations ⏳',
      description: 'Review pending student and teacher signups. Validate official credentials, roll numbers, and face descriptors before granting access.',
      position: 'right',
    },
    {
      target: '#tour-admin-users',
      title: 'Manage All Users 👥',
      description: 'Directory of all university students and faculty sorted by Roll Number. Filter by Branch/Group, edit details, or suspend accounts.',
      position: 'bottom',
    },
    {
      target: '#tour-admin-student-edit',
      title: 'Student Biometric & Details Edit ✏️',
      description: 'Update student credentials and launch the 5-angle camera calibrator to update or reset 3D Face biometric descriptors.',
      position: 'bottom',
    },
    {
      target: '#tour-admin-enrollments',
      title: 'Manage Course Enrollments 📚',
      description: 'View subjects enrolled by each student, inspect assigned faculty, and seamlessly remove or add course enrollments.',
      position: 'bottom',
    },
    {
      target: '#tour-admin-appoint',
      title: 'Appoint Branch Admins & CRs 🎖️',
      description: 'Appoint Branch Admins (Pseudoadmins) with scoped administrative access and designate Class Representatives in isolated compartments.',
      position: 'bottom',
    },
    {
      target: '#tour-admin-subjects',
      title: 'Course & Curriculum Directory 📖',
      description: 'Create new semester subjects, assign course codes, allocate teaching faculty, and manage department sections.',
      position: 'bottom',
    },
    {
      target: '#tour-admin-announcements',
      title: 'Campus-Wide Announcements 📢',
      description: 'Broadcast official circulars, exam notifications, and campus-wide updates visible to all students and faculty.',
      position: 'right',
    },
    {
      target: '#tour-admin-logs',
      title: 'Security & Audit Logs 🔍',
      description: 'Immutable audit trail tracking all actions: attendance modifications, user status changes, position appointments, and deletions.',
      position: 'bottom',
    },
    {
      target: '#tour-admin-settings',
      title: 'System Settings & Issue Resolver ⚙️',
      description: 'Review and resolve reported login issues, configure attendance percentage thresholds (default 75%), and customize system policies.',
      position: 'bottom',
    },
  ],
  pseudoadmin: [
    {
      target: '#tour-admin-stats',
      title: 'Branch Admin Control Center 🛡️',
      description: 'Dedicated departmental administration hub. Monitor branch students, faculty, active subjects, and daily live lectures.',
      position: 'bottom',
    },
    {
      target: '#tour-admin-verify',
      title: 'Verify Department Registrations ⏳',
      description: 'Review and approve pending student registrations for your branch. Verify student IDs and face setup before approval.',
      position: 'right',
    },
    {
      target: '#tour-admin-users',
      title: 'Branch Students Directory 👥',
      description: 'Complete directory of students in your department sorted by Roll Number, with instant filtering by Group (G1/G2) and Subgroups.',
      position: 'bottom',
    },
    {
      target: '#tour-admin-student-edit',
      title: 'Edit Branch Student Details ✏️',
      description: 'Update student name, roll number, section, group, and subgroup to keep your branch academic records 100% accurate.',
      position: 'bottom',
    },
    {
      target: '#tour-admin-face-id',
      title: 'Update & Reset 3D Face ID 📸',
      description: 'Calibrate 3D facial descriptors with the 5-angle camera scanner or delete existing Face IDs for students requiring biometric re-registration.',
      position: 'bottom',
    },
    {
      target: '#tour-admin-enrollments',
      title: 'Manage Course Enrollments 📚',
      description: 'Inspect courses enrolled by students in your department and remove unassigned or dropped subject mappings.',
      position: 'bottom',
    },
    {
      target: '#tour-admin-subjects',
      title: 'Departmental Courses 📖',
      description: 'View semester courses, course codes, syllabus mappings, and teaching professors assigned to your branch.',
      position: 'bottom',
    },
    {
      target: '#tour-admin-announcements',
      title: 'Broadcast Branch Announcements 📢',
      description: 'Publish departmental notices, extra lecture schedules, and reminders automatically signed with your official Branch Admin badge.',
      position: 'right',
    },
    {
      target: '#tour-admin-logs',
      title: 'Departmental Audit Logs 🕵️',
      description: 'Track verification actions, student updates, and administrative events within your branch for complete transparency.',
      position: 'bottom',
    },
    {
      target: '#tour-student-switcher',
      title: 'Dual Portal Switching 📱',
      description: 'Seamlessly switch between Branch Admin responsibilities and your personal Student Portal using the sidebar switcher.',
      position: 'right',
    },
  ],
};

export function OnboardingTour({ role, customSteps }: OnboardingTourProps) {
  const effectiveRole = role === 'admin' ? 'superadmin' : role;
  const initialSteps = customSteps || DEFAULT_STEPS[effectiveRole] || [];
  const storageKey = `ams_tour_completed_${effectiveRole}_v4`;

  const [active, setActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [steps, setSteps] = useState<TourStep[]>(initialSteps);

  // Filter out steps if their target element is not present on the page (e.g. #tour-cr-nav for non-CR students)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const valid = initialSteps.filter(s => {
        if (s.target.startsWith('#') || s.target.startsWith('.')) {
          // If it's a conditional target like CR navigation, verify existence
          if (s.target === '#tour-cr-nav') {
            return !!document.querySelector(s.target);
          }
        }
        return true;
      });
      setSteps(valid);
    }
  }, [initialSteps]);

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
