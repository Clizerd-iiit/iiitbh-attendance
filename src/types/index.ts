export type Role = 'student' | 'teacher' | 'superadmin';
export type AttendanceStatus = 'P' | 'A' | 'Late' | 'L';
export type AttendanceMethod = 'qr' | 'otp' | 'manual' | 'auto';
export type ClassStatus = 'scheduled' | 'active' | 'closed';
export type AnnouncementType = 'extra_class' | 'cancellation' | 'test' | 'quiz' | 'update' | 'pdf' | 'link' | 'text';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  roll_no?: string;
  bio?: string;
  profile_photo_url?: string;
  section?: string;
  branch?: string;
  is_cr?: boolean;
  semester?: number;
  is_active: boolean;
  created_at: string;
  signup_info?: any;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  teacher_id: string;
  teacher?: User;
  section: string;
  semester: number;
  is_active: boolean;
}

export interface ClassSession {
  id: string;
  subject_id: string;
  subject?: Subject;
  date: string;
  start_time: string;
  end_time?: string;
  qr_code?: string;
  qr_expires_at?: string;
  otp?: string;
  otp_expires_at?: string;
  status: ClassStatus;
}

export interface AttendanceRecord {
  id: string;
  class_id: string;
  student_id: string;
  student?: User;
  class?: ClassSession;
  status: AttendanceStatus;
  method: AttendanceMethod;
  marked_at: string;
  edited_by?: string;
  edited_at?: string;
}

export interface Announcement {
  id: string;
  teacher_id: string;
  teacher?: User;
  subject_id?: string;
  subject?: Subject;
  type: AnnouncementType;
  title: string;
  content?: string;
  file_url?: string;
  link_url?: string;
  created_at: string;
  signup_info?: any;
}


export interface StudentAttendanceSummary {
  student_id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  total_classes: number;
  attended: number;
  percentage: number;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user?: User;
  action: string;
  table_name?: string;
  record_id?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
  signup_info?: any;
}
