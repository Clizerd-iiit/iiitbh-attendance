import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-3xl w-full rounded-2xl shadow-sm p-8 md:p-12">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Terms & Conditions</h1>
        <div className="prose text-gray-700 space-y-4 text-sm md:text-base">
          <p>Welcome to the IIIT-BH Attendance System. By using this system, you agree to comply with and be bound by the following terms and conditions of use.</p>
          <h2 className="text-xl font-semibold text-gray-800 mt-6">1. Acceptance of Terms</h2>
          <p>By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement.</p>
          <h2 className="text-xl font-semibold text-gray-800 mt-6">2. Use of Service</h2>
          <p>You agree to use this system for official academic purposes only. Any unauthorized access, tampering of attendance records, or sharing of OTPs/QR codes is strictly prohibited and subject to disciplinary action.</p>
          <h2 className="text-xl font-semibold text-gray-800 mt-6">3. Accuracy of Data</h2>
          <p>Users are responsible for ensuring the accuracy of the information they provide during profile setup and while marking attendance.</p>
          <h2 className="text-xl font-semibold text-gray-800 mt-6">4. Modification of Terms</h2>
          <p>The administrators reserve the right to change these conditions from time to time as they see fit and your continued use of the site will signify your acceptance of any adjustment to these terms.</p>
        </div>
        <div className="mt-8 pt-6 border-t">
          <Link href="/" className="text-blue-600 font-medium hover:underline">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
