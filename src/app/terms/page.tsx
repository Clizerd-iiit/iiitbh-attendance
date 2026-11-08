import Link from 'next/link';
import { Scale, AlertTriangle, UserCheck, ShieldAlert, FileText, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 text-white p-8 sm:p-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-white/20 text-blue-100 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-md">
              Institutional Regulations
            </span>
            <span className="bg-amber-400/20 text-amber-200 text-xs font-bold px-3 py-1 rounded-full border border-amber-300/30">
              Code of Academic Conduct
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
            Terms &amp; Conditions of Service
          </h1>
          <p className="text-blue-100 text-sm sm:text-base max-w-2xl">
            Rules, operational requirements, and ethical guidelines governing the IIIT Bhagalpur Attendance Management System (AMS).
          </p>
          <p className="text-xs text-blue-200/80 mt-3 font-mono">
            Effective Date: Academic Year 2026–2027 · Version 2.4
          </p>
        </div>

        {/* Content Body */}
        <div className="p-8 sm:p-10 space-y-8 text-gray-700 text-sm sm:text-base leading-relaxed">
          
          {/* Important Notice Callout */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 sm:p-6 flex items-start gap-4">
            <div className="p-2.5 bg-amber-600 text-white rounded-xl shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base mb-1">Mandatory Institutional Compliance</h3>
              <p className="text-sm text-gray-700 leading-normal">
                All registered students, faculty members, Class Representatives (CRs), and administrative staff of IIIT Bhagalpur must adhere to these terms. Unauthorized access, proxy attendance, tampering with biometric models, or spoofing location constitutes an act of academic misconduct.
              </p>
            </div>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-bold text-gray-900 border-b pb-2">
              <Scale className="w-5 h-5 text-blue-600" />
              <h2>1. Institutional Scope &amp; Eligibility</h2>
            </div>
            <p>
              The IIIT Bhagalpur Attendance Management System is an official institutional resource provided solely for tracking curricular and laboratory attendance:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-gray-600 text-sm">
              <li>Access is strictly restricted to students, faculty, and authorized administrators possessing verified <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">@iiitbh.ac.in</code> credentials.</li>
              <li>Attendance percentages recorded through this platform serve as the authoritative record for semester examination eligibility (including the 75% minimum attendance rule enforced by the Academic Section).</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-bold text-gray-900 border-b pb-2">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              <h2>2. Biometric Face ID Setup &amp; Ethical Usage</h2>
            </div>
            <p>
              Every student is required to complete their Multi-Angle Biometric Face ID setup honestly:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-gray-600 text-sm">
              <li><strong>Self-Enrollment Only:</strong> A student must only register their own face. Registering a peer’s face or photographs on your personal account is strictly prohibited.</li>
              <li><strong>Anti-Spoofing Rules:</strong> Any attempt to present printed photographs, recorded videos, 3D masks, digital screens, or AI-generated deepfakes to the biometric camera will be flagged by automated liveness filters and reported to the system administration.</li>
              <li><strong>30-Day Update Cadence:</strong> Face ID profiles can be updated once every 30 days to accommodate natural appearance changes, or immediately via administrative reset upon faculty review.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-bold text-gray-900 border-b pb-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <h2>3. Anti-Proxy Enforcement &amp; ProxyShield 3-Strike Rule</h2>
            </div>
            <p>
              Marking proxy attendance undermines academic integrity and is treated with zero tolerance:
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2.5 text-sm">
              <div className="flex items-center gap-2 font-bold text-gray-900">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                <span>Automated ProxyShield Penalty Protocol:</span>
              </div>
              <ul className="list-disc pl-5 space-y-1.5 text-gray-600">
                <li><strong>Strike 1 (Warning):</strong> First instance of device-sharing or dual-account attendance logs a formal institutional warning in the student portal and SuperAdmin ProxyShield dashboard.</li>
                <li><strong>Strike 2 (Strict Warning):</strong> Second violation logs a strict warning with notification to the respective Course Faculty and Head of Department (HoD).</li>
                <li><strong>Strike 3 (Account Suspension):</strong> Third strike triggers an <strong>immediate automatic account suspension</strong>. The student is locked out of digital attendance marking and referred directly to the Institute Academic Disciplinary Committee.</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-bold text-gray-900 border-b pb-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h2>4. Geofencing &amp; Location Spoofing Violations</h2>
            </div>
            <p>
              When a course session enforces geofence validation:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-gray-600 text-sm">
              <li>Students must physically be inside the designated lecture hall or classroom radius.</li>
              <li>The use of Mock GPS apps, location-spoofing browser extensions, emulators, or VPNs to bypass geolocation boundaries constitutes a deliberate breach of discipline and results in an automatic forfeiture of attendance for the respective lecture.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-bold text-gray-900 border-b pb-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <h2>5. QR Code &amp; One-Time Password (OTP) Integrity</h2>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-gray-600 text-sm">
              <li>Dynamic QR codes regenerate every 15 seconds. Taking screenshots or distributing QR codes or OTPs in chat groups (WhatsApp, Telegram, Discord) to mark attendance for absent peers is strictly illegal under institute regulations.</li>
              <li>Faculty members hold full authority to invalidate an attendance session if session credentials are leaked outside the classroom.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-bold text-gray-900 border-b pb-2">
              <CheckCircle2 className="w-5 h-5 text-purple-600" />
              <h2>6. Class Representative (CR) Delegation Guidelines</h2>
            </div>
            <p>
              When faculty delegates attendance rights to an appointed Class Representative:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-gray-600 text-sm">
              <li>Delegated permissions are session-specific and automatically expire at the conclusion of the allotted lecture window.</li>
              <li>All actions performed under delegated mode are tied to the CR’s user ID and cryptographically auditable. Any misuse of delegated authority results in immediate permanent revocation of CR privileges and disciplinary action.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-bold text-gray-900 border-b pb-2">
              <Scale className="w-5 h-5 text-gray-900" />
              <h2>7. Record Finality &amp; Administrative Review</h2>
            </div>
            <p className="text-gray-600 text-sm">
              Attendance records recorded on the platform are submitted directly to the Academic Section for semester evaluation. In the event of a technical dispute (e.g., verified network failure or emergency medical leave), students may request an attendance correction exclusively through the formal faculty review procedure within 3 working days.
            </p>
          </section>

        </div>

        {/* Footer Navigation */}
        <div className="bg-gray-50 border-t border-gray-200 px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-bold text-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Portal</span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <Link href="/terms" className="hover:underline font-semibold text-gray-700">Terms &amp; Conditions</Link>
            <span>•</span>
            <Link href="/privacy" className="hover:underline font-semibold text-gray-700">Privacy Policy</Link>
            <span>•</span>
            <span>IIIT Bhagalpur © {new Date().getFullYear()}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
