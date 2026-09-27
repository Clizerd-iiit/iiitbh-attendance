'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/shared/Navbar';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday } from 'date-fns';

interface DayRecord {
  date: string;
  records: { subject_code: string; status: string }[];
}

const statusColor: Record<string, string> = {
  P: 'bg-green-500',
  A: 'bg-red-500',
  Late: 'bg-yellow-400',
  L: 'bg-blue-400',
};

export default function HistoryPage() {
  const [month, setMonth] = useState(new Date());
  const [data, setData] = useState<DayRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = () => {
      const start = format(startOfMonth(month), 'yyyy-MM-dd');
      const end   = format(endOfMonth(month),   'yyyy-MM-dd');
      fetch(`/api/attendance/history?start=${start}&end=${end}`)
        .then(r => r.json())
        .then(d => { setData(d.records || []); setLoading(false); });
    };
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [month]);

  const byDate: Record<string, DayRecord['records']> = {};
  data.forEach(d => { byDate[d.date] = d.records; });

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startPad = getDay(startOfMonth(month)); // 0=Sun

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">📅 Attendance History</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth()-1,1))}
              className="px-3 py-1 bg-white border rounded-lg hover:bg-gray-100 transition">←</button>
            <span className="font-semibold text-gray-800 w-36 text-center">
              {format(month, 'MMMM yyyy')}
            </span>
            <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth()+1,1))}
              className="px-3 py-1 bg-white border rounded-lg hover:bg-gray-100 transition">→</button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mb-4 text-sm">
          {[['P','Present','bg-green-500'],['A','Absent','bg-red-500'],['Late','Late','bg-yellow-400']].map(([s,l,c]) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded-full ${c}`}/>
              <span className="text-gray-700">{l}</span>
            </div>
          ))}
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="grid grid-cols-7 mb-2">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-700 py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array(startPad).fill(null).map((_, i) => <div key={`pad-${i}`}/>)}
            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const recs = byDate[key] || [];
              const today = isToday(day);
              return (
                <div key={key}
                  className={`min-h-[72px] rounded-xl p-1.5 border transition ${
                    today ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'
                  }`}>
                  <p className={`text-xs font-semibold mb-1 ${today ? 'text-blue-600' : 'text-gray-800'}`}>
                    {format(day, 'd')}
                  </p>
                  <div className="space-y-0.5">
                    {recs.length === 0 && (
                      <div className="text-xs text-gray-300">—</div>
                    )}
                    {recs.map((r, i) => (
                      <div key={i} className={`flex items-center gap-1 rounded px-1 py-0.5 ${statusColor[r.status] || 'bg-gray-300'} bg-opacity-20`}>
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor[r.status] || 'bg-gray-400'}`}/>
                        <span className="text-xs text-gray-800 truncate">{r.subject_code}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary row */}
        {!loading && (
          <div className="mt-4 grid grid-cols-4 gap-3">
            {(['P','A','Late','L'] as const).map(s => {
              const count = data.flatMap(d => d.records).filter(r => r.status === s).length;
              const labels = { P:'Present', A:'Absent', Late:'Late', L:'Leave' };
              return (
                <div key={s} className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <div className={`w-8 h-8 rounded-full ${statusColor[s]} mx-auto mb-2 flex items-center justify-center text-white font-bold text-sm`}>{s}</div>
                  <p className="text-2xl font-bold text-gray-800">{count}</p>
                  <p className="text-xs text-gray-700">{labels[s]}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
