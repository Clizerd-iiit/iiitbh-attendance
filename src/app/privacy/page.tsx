import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-3xl w-full rounded-2xl shadow-sm p-8 md:p-12">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Privacy Policy</h1>
        <div className="prose text-gray-600 space-y-4 text-sm md:text-base">
          <p>At IIIT-BH Attendance System, we take your privacy seriously. This policy explains how we collect, use, and protect your personal information.</p>
          <h2 className="text-xl font-semibold text-gray-800 mt-6">1. Information Collection</h2>
          <p>We collect information you provide directly to us when you create an account, including your name, institutional email address, roll number, and profile photo.</p>
          <h2 className="text-xl font-semibold text-gray-800 mt-6">2. Information Usage</h2>
          <p>The collected information is used solely for the purpose of managing and recording academic attendance, verifying identities, and facilitating academic communication (like announcements).</p>
          <h2 className="text-xl font-semibold text-gray-800 mt-6">3. Data Security</h2>
          <p>We implement appropriate security measures to protect against unauthorized access, alteration, disclosure, or destruction of your personal information and attendance records.</p>
          <h2 className="text-xl font-semibold text-gray-800 mt-6">4. Data Sharing</h2>
          <p>We do not sell, trade, or rent users' personal identification information to others. Data is only accessible to authorized faculty and system administrators for official purposes.</p>
        </div>
        <div className="mt-8 pt-6 border-t">
          <Link href="/" className="text-blue-600 font-medium hover:underline">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
