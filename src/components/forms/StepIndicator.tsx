'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
  stepLabels: string[]
}

export function StepIndicator({ currentStep, totalSteps, stepLabels }: StepIndicatorProps) {
  return (
    <div className="w-full px-4 pt-6">
      <div className="flex w-full items-start">
        {stepLabels.map((label, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep
          const isUpcoming = stepNumber > currentStep

          return (
            <div
              key={stepNumber}
              className={cn(
                'relative flex flex-1 flex-col items-center',
                index < totalSteps - 1 && 'pr-4'
              )}
            >
              <div className="relative flex w-full justify-center">
                {/* Step Circle */}
                <div
                  className={cn(
                    'relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300',
                    isCompleted &&
                      'bg-primary border-primary text-primary-foreground',
                    isCurrent &&
                      'bg-primary/10 border-primary text-primary ring-2 ring-primary/20',
                    isUpcoming &&
                      'bg-background border-muted-foreground/30 text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-semibold">{stepNumber}</span>
                  )}
                </div>

                {/* Connector Line */}
                {index < totalSteps - 1 && (
                  <div className="absolute left-[calc(50%+1.5rem)] top-1/2 h-0.5 w-[calc(100%-3rem)] -translate-y-1/2">
                    <div
                      className={cn(
                        'h-full w-full transition-colors duration-300',
                        stepNumber < currentStep ? 'bg-primary' : 'bg-muted'
                      )}
                    />
                  </div>
                )}
              </div>

                {/* Step Label */}
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      'text-xs font-medium transition-colors',
                      isCurrent && 'text-primary',
                      isCompleted && 'text-foreground',
                      isUpcoming && 'text-muted-foreground'
                    )}
                  >
                    {label}
                  </p>
                </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
