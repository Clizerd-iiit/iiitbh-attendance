"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Sparkles } from "lucide-react"

export function MakeupClassSuggester() {
  const [isSearching, setIsSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])

  const handleSuggest = () => {
    setIsSearching(true)
    // Mock algorithm delay
    setTimeout(() => {
      setSuggestions([
        { date: "Tomorrow", time: "10:00 AM - 11:00 AM", confidence: "95%" },
        { date: "Tomorrow", time: "2:00 PM - 3:00 PM", confidence: "80%" },
        { date: "Next Monday", time: "11:00 AM - 12:00 PM", confidence: "75%" }
      ])
      setIsSearching(false)
    }, 1500)
  }

  return (
    <Card className="shadow-lg border-blue-100">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-teal-50 rounded-t-lg border-b border-blue-100 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl text-blue-900 flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-blue-600" />
              Smart Makeup Class
            </CardTitle>
            <CardDescription className="text-blue-700/80 mt-1">
              AI-powered slot suggestions based on student free time
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {!suggestions.length && !isSearching ? (
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-gray-500 mb-6">Need to reschedule a class? Find the perfect slot where most students are free.</p>
            <Button onClick={handleSuggest} className="bg-blue-600 hover:bg-blue-700">
              Find Free Slots
            </Button>
          </div>
        ) : isSearching ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-blue-600 font-medium">Analyzing timetables...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">Recommended Slots</h3>
            {suggestions.map((slot, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{slot.date}</p>
                    <p className="text-sm text-gray-500">{slot.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-sm font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                    {slot.confidence} Match
                  </span>
                  <div className="mt-2">
                    <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                      Schedule
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <Button variant="ghost" className="w-full mt-4 text-gray-500" onClick={() => setSuggestions([])}>
              Reset
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
