import Link from 'next/link';
import { Shield, Lock, EyeOff, MapPin, Database, Award, ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 text-white p-8 sm:p-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-white/20 text-blue-100 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-md">
              Institutional Privacy Policy
            </span>
            <span className="bg-emerald-500/20 text-emerald-200 text-xs font-bold px-3 py-1 rounded-full border border-emerald-400/30">
              DPDP Act 2023 Compliant
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
            Privacy &amp; Biometric Data Policy
          </h1>
          <p className="text-blue-100 text-sm sm:text-base max-w-2xl">
            Indian Institute of Information Technology Bhagalpur (IIIT Bhagalpur) Attendance Management System (AMS).
          </p>
          <p className="text-xs text-blue-200/80 mt-3 font-mono">
            Last Updated: November 2026 · Version 2.4 (Neural Biometric Protocol)
          </p>
        </div>

        {/* Content Body */}
        <div className="p-8 sm:p-10 space-y-8 text-gray-700 text-sm sm:text-base leading-relaxed">
          
          {/* Summary Callout */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 sm:p-6 flex items-start gap-4">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shrink-0 mt-0.5">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base mb-1">Privacy-First Architecture</h3>
              <p className="text-sm text-gray-600 leading-normal">
                IIIT Bhagalpur AMS is built on a <strong>zero-image storage model</strong>. We never upload, store, or transmit your photos or video frames. All biometric facial calculations are executed strictly inside your device’s local browser, converting facial geometry into non-reversible mathematical vectors.
              </p>
            </div>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-bold text-gray-900 border-b pb-2">
              <EyeOff className="w-5 h-5 text-blue-600" />
              <h2>1. Biometric Data Processing &amp; Zero-Image Storage</h2>
            </div>
            <p>
              When setting up Face ID or verifying attendance, our AI engine operates entirely on the client side (using your browser’s local hardware WebGL pipeline).
            </p>
            <ul className="list-disc pl-5 space-y-2 text-gray-600 text-sm">
              <li>
                <strong>No Photo Uploads:</strong> Camera frames are processed transiently in device RAM and are immediately discarded. No photograph, selfie, or video recording is ever transmitted to or stored on our servers.
              </li>
              <li>
                <strong>128-Dimensional Mathematical Embeddings:</strong> Facial geometry (eye distance, jawline curve, nose bridge proportion) is converted into an irreversible 128-dimensional floating-point vector (e.g., <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">[0.041, -0.128, ... 128 values]</code>).
              </li>
              <li>
                <strong>Non-Reconstructible:</strong> It is mathematically and cryptographically impossible to reverse-engineer or reconstruct an individual’s face or photograph from these numerical vectors.
              </li>
              <li>
                <strong>Multi-Angle Mapping:</strong> Students register 3 natural angles (Look Straight, Turn Left, Turn Right) solely to allow robust verification across natural lighting and classroom angles.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-bold text-gray-900 border-b pb-2">
              <Database className="w-5 h-5 text-indigo-600" />
              <h2>2. Academic &amp; Personal Information Collected</h2>
            </div>
            <p>We collect only the minimum required information essential for institutional academic tracking:</p>
            <ul className="list-disc pl-5 space-y-2 text-gray-600 text-sm">
              <li><strong>Identity Details:</strong> Full Name, Official Roll Number, Institutional Email Address (<code className="bg-gray-100 px-1 py-0.5 rounded text-xs">@iiitbh.ac.in</code>), Academic Branch (CSE, ECE, MEA, MNC), and Assigned Group/Subgroup.</li>
              <li><strong>Attendance Logs:</strong> Course ID, Lecture Timestamps, Mode of Attendance (Face ID, QR, OTP, or Teacher Kiosk), and Presence Status (Present, Absent).</li>
              <li><strong>Device Metadata for Fraud Prevention:</strong> Browser user-agent and session tokens used exclusively by our anti-proxy security layer to detect simultaneous multi-account device sharing.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-bold text-gray-900 border-b pb-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              <h2>3. Geolocation &amp; Geofencing Protocol</h2>
            </div>
            <p>
              Attendance sessions may require geofence confirmation to verify on-campus classroom presence:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-gray-600 text-sm">
              <li><strong>Instantaneous / Ephemeral Check:</strong> Geolocation coordinates are queried strictly at the single moment you tap &ldquo;Mark Attendance&rdquo;.</li>
              <li><strong>Zero Background Tracking:</strong> We never track your location in the background, between classes, or outside attendance submission events.</li>
              <li><strong>Geofence Verification:</strong> The system computes Haversine distance against the classroom/campus perimeter coordinates to validate genuine physical presence.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-bold text-gray-900 border-b pb-2">
              <Lock className="w-5 h-5 text-amber-600" />
              <h2>4. Data Protection, Security &amp; Legal Compliance</h2>
            </div>
            <p>
              In full compliance with India&rsquo;s <strong>Digital Personal Data Protection (DPDP) Act, 2023</strong> and institutional data governance frameworks:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-gray-600 text-sm">
              <li><strong>Encryption in Transit:</strong> All communications between client devices and servers are strictly enforced using TLS 1.3 / HTTPS.</li>
              <li><strong>Role-Based Access Control (RBAC):</strong> Student attendance records are strictly partitioned. Teachers can only access enrolled courses; PseudoAdmins can only audit branch students; SuperAdmins hold full audit capability.</li>
              <li><strong>No Commercial Commercialization:</strong> We never sell, lease, monetize, or share student or faculty data with any third-party marketing, advertising, or commercial entities.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-bold text-gray-900 border-b pb-2">
              <Shield className="w-5 h-5 text-red-600" />
              <h2>5. ProxyShield Security &amp; Device Integrity</h2>
            </div>
            <p>
              To maintain academic integrity across IIIT Bhagalpur:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-gray-600 text-sm">
              <li><strong>ProxyShield Monitoring:</strong> The system detects if multiple student profiles are logged in and marking attendance from the identical physical device or network signature in the same live class.</li>
              <li><strong>3-Strike Warning Protocol:</strong> Detected proxy attempts issue structured institutional warnings (Strike 1, Strike 2). A 3rd strike results in automatic account suspension pending review by the Academic Disciplinary Committee.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-bold text-gray-900 border-b pb-2">
              <Award className="w-5 h-5 text-purple-600" />
              <h2>6. Data Retention, Updates &amp; Grievance Redressal</h2>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-gray-600 text-sm">
              <li><strong>Face ID Updates:</strong> Under institutional rules, students may update their biometric Face ID once every 30 days, or immediately upon administrative reset granted by faculty/admin.</li>
              <li><strong>Retention Period:</strong> Attendance records are retained for the duration of the student&rsquo;s academic program and audit periods, after which they are archived according to university archival guidelines.</li>
              <li><strong>Grievance Officer:</strong> For privacy inquiries, data rectification, or account assistance, students and faculty may contact the System Administrator via the in-app &ldquo;Contact Admin&rdquo; portal.</li>
            </ul>
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
