"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin } from "lucide-react"

export function AttendanceHeatmap() {
  // A simple mock of a campus heatmap using grid cells
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
  const times = ["9 AM", "11 AM", "1 PM", "3 PM", "5 PM"]

  // 1 = low, 2 = medium, 3 = high density
  const mockData = [
    [1, 2, 3, 2, 1],
    [2, 3, 3, 2, 2],
    [1, 1, 2, 1, 1],
    [3, 3, 2, 1, 1],
    [2, 2, 1, 1, 1],
  ]

  const getColor = (value: number) => {
    switch (value) {
      case 1: return "bg-blue-100"
      case 2: return "bg-blue-300"
      case 3: return "bg-blue-600"
      default: return "bg-gray-100"
    }
  }

  return (
    <Card className="shadow-lg border-blue-100">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-t-lg border-b border-blue-100 pb-6">
        <div className="flex items-center gap-2">
          <MapPin className="h-6 w-6 text-blue-600" />
          <div>
            <CardTitle className="text-2xl text-slate-800">Campus Heatmap</CardTitle>
            <CardDescription className="text-slate-500 mt-1">
              Live attendance density across academic blocks
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-2">
          {/* Header row */}
          <div className="flex gap-2 mb-2">
            <div className="w-12"></div>
            {times.map((t) => (
              <div key={t} className="flex-1 text-center text-xs font-medium text-gray-500">
                {t}
              </div>
            ))}
          </div>
          
          {/* Grid */}
          {days.map((day, rowIdx) => (
            <div key={day} className="flex gap-2 items-center">
              <div className="w-12 text-sm font-medium text-gray-600">{day}</div>
              {mockData[rowIdx].map((val, colIdx) => (
                <div 
                  key={colIdx} 
                  className={`flex-1 h-12 rounded-md ${getColor(val)} transition-all hover:scale-105 cursor-pointer hover:shadow-md border border-white/50`}
                  title={`Density: ${val === 3 ? 'High' : val === 2 ? 'Medium' : 'Low'}`}
                />
              ))}
            </div>
          ))}
        </div>
        
        <div className="mt-6 flex items-center justify-center gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm bg-blue-100"></div> Low
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm bg-blue-300"></div> Medium
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm bg-blue-600"></div> High
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
