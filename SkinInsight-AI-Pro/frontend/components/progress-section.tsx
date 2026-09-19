"use client"

import { useState } from "react"
import { Calendar, CheckCircle2, Circle, Plus, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ProgressEntry {
  id: number
  day: number
  date: string
  status: "completed" | "current" | "upcoming"
  note?: string
}

const initialProgress: ProgressEntry[] = [
  { id: 1, day: 1, date: "Today", status: "current", note: "Started tracking" },
  { id: 2, day: 7, date: "In 6 days", status: "upcoming" },
  { id: 3, day: 14, date: "In 13 days", status: "upcoming" },
  { id: 4, day: 30, date: "In 29 days", status: "upcoming" },
]

export function ProgressSection() {
  const [progress] = useState<ProgressEntry[]>(initialProgress)
  const [isSaved, setIsSaved] = useState(false)

  const handleSaveResult = () => {
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }

  return (
    <section id="progress" className="py-16 sm:py-24 bg-background relative overflow-hidden">
      {/* Background blob */}
      <div className="absolute top-1/2 left-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center mb-10 sm:mb-12">
          <p className="text-primary font-semibold mb-2 text-sm uppercase tracking-wider">Care Journey</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 text-balance">
            Track Your{" "}
            <span className="gradient-text">Improvement</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-pretty text-base sm:text-lg">
            Monitor your skin health progress over time. Save your results and see how your skin improves with consistent care.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto">
          {/* Timeline Card */}
          <Card className="shadow-xl rounded-2xl glass-card animate-fade-in-left delay-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5 text-foreground">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                Progress Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Timeline Line — gradient */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-secondary to-border rounded-full" />
                
                <div className="space-y-5">
                  {progress.map((entry, index) => (
                    <div key={entry.id} className="relative flex items-start gap-4 pl-2">
                      {/* Timeline Dot */}
                      <div className={`relative z-10 flex items-center justify-center w-6 h-6 rounded-full shadow-sm transition-all ${
                        entry.status === "completed" 
                          ? "bg-secondary shadow-secondary/30" 
                          : entry.status === "current"
                          ? "bg-primary shadow-primary/30 ring-4 ring-primary/15"
                          : "bg-muted border-2 border-border"
                      }`}>
                        {entry.status === "completed" && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-secondary-foreground" />
                        )}
                        {entry.status === "current" && (
                          <Circle className="w-2.5 h-2.5 fill-primary-foreground text-primary-foreground" />
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className={`flex-1 p-4 rounded-2xl transition-all hover:shadow-md ${
                        entry.status === "current" 
                          ? "bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 shadow-sm" 
                          : entry.status === "completed"
                          ? "bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20"
                          : "bg-muted/40 border border-border/50 hover:border-border"
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-foreground">Day {entry.day}</span>
                          <span className="text-xs text-muted-foreground font-medium">{entry.date}</span>
                        </div>
                        {entry.note && (
                          <p className="text-sm text-muted-foreground">{entry.note}</p>
                        )}
                        {entry.status === "current" && (
                          <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold">
                            <Circle className="w-1.5 h-1.5 fill-current animate-pulse" />
                            Current
                          </span>
                        )}
                        {entry.status === "upcoming" && index === progress.length - 1 && (
                          <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-secondary/20 text-secondary text-xs font-semibold">
                            <TrendingUp className="w-3 h-3" />
                            Goal
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save & Tips Card */}
          <div className="space-y-5 animate-fade-in-right delay-300">
            <Card className="shadow-xl rounded-2xl glass-card overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-secondary via-primary to-secondary" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2.5 text-foreground">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-secondary" />
                  </div>
                  Save Your Result
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Keep track of your analysis results to monitor changes over time. 
                  Regular tracking helps you understand what works best for your skin.
                </p>
                <Button 
                  onClick={handleSaveResult}
                  className={`w-full gap-2 rounded-xl h-11 font-semibold transition-all ${!isSaved ? 'animate-pulse-glow' : ''}`}
                  variant={isSaved ? "outline" : "default"}
                >
                  {isSaved ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-secondary" />
                      Result Saved!
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Save Current Result
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-xl rounded-2xl bg-gradient-to-br from-primary/8 to-secondary/8 border-primary/10">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-2">Consistency is Key</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Most skin conditions show visible improvement within 4-6 weeks of consistent care. 
                      {"Don't get discouraged if you don't see immediate results — healing takes time."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xl rounded-2xl glass-card">
              <CardContent className="pt-6">
                <h3 className="font-bold text-foreground mb-4">Quick Tips for Better Results</h3>
                <ul className="space-y-2.5">
                  <li className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4.5 h-4.5 text-secondary shrink-0 mt-0.5" />
                    Take photos in the same lighting conditions
                  </li>
                  <li className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4.5 h-4.5 text-secondary shrink-0 mt-0.5" />
                    Scan at the same time each day
                  </li>
                  <li className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4.5 h-4.5 text-secondary shrink-0 mt-0.5" />
                    Note any changes in diet or routine
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}
