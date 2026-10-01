'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/shared/Navbar';
import { format } from 'date-fns';

export default function IssuesPage() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/public-issue')
      .then(res => res.json())
      .then(data => {
        setIssues(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-3xl">⚠️</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Common ISSUES Reported</h1>
            <p className="text-gray-700">Problems reported by unauthenticated users from the login page</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading issues...</div>
        ) : issues.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
            <span className="text-4xl">🎉</span>
            <p className="mt-4 text-gray-700">No issues reported!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {issues.map((issue) => (
              <div key={issue.id} className="bg-white p-6 rounded-xl shadow-sm border border-red-100 relative">
                <div className="absolute top-4 right-4 text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded">
                  {issue.status.toUpperCase()}
                </div>
                <h3 className="font-bold text-lg text-gray-800 mb-1">{issue.name}</h3>
                <p className="text-xs text-gray-500 mb-4">{format(new Date(issue.date), 'PPpp')}</p>
                <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-800 whitespace-pre-wrap font-mono border border-gray-100">
                  {issue.details}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
