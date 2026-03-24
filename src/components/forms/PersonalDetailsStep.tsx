'use client'

import { UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form'
import { SignupFormData } from '@/lib/validations/signup'

interface PersonalDetailsStepProps {
  form: UseFormReturn<SignupFormData>
}

export function PersonalDetailsStep({ form }: PersonalDetailsStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Personal Information</h3>
        <p className="text-sm text-muted-foreground">
          Let's start with your basic information
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First Name</FormLabel>
              <FormControl>
                <Input placeholder="Your first name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last Name</FormLabel>
              <FormControl>
                <Input placeholder="Your last name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="phone"
        render={({ field }) => {
          // Extract the number part (everything after +1)
          const displayValue = field.value.startsWith('+1') 
            ? field.value.slice(2).trim() 
            : field.value.replace(/^\+1/, '').trim()
          
          return (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-muted border border-r-0 border-input rounded-l-md text-sm text-foreground font-medium">
                    +1
                  </span>
                  <Input
                    type="tel"
                    placeholder="(555) 123-4567"
                    className="rounded-l-none"
                    value={displayValue}
                    onChange={(e) => {
                      const value = e.target.value
                      // Always prepend +1 to the value
                      field.onChange('+1' + value)
                    }}
                    onBlur={field.onBlur}
                  />
                </div>
              </FormControl>
              <FormDescription>
                Phone number for Canada/USA (country code +1 is included)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </div>
  )
}
