"use client"

import { useEffect, useState } from "react"
import { WifiOff } from "lucide-react"

export function OfflineNotifier() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    // Check initial state
    setIsOffline(!navigator.onLine)

    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-6 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 max-w-sm w-full border border-red-500/50">
        <div className="bg-white/20 p-2 rounded-full">
          <WifiOff className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-lg leading-tight">You are offline</h3>
          <p className="text-red-100 text-sm">Please turn on your internet connection to continue.</p>
        </div>
      </div>
    </div>
  )
}
