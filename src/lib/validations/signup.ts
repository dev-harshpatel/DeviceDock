import { z } from 'zod';

// Personal Details Schema (Step 1)
export const personalDetailsSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),
  phone: z
    .string()
    .min(3, 'Phone number is required')
    .regex(/^\+1[\d\s\-\(\)]+$/, 'Phone number must start with +1 and contain only digits, spaces, hyphens, and parentheses')
    .refine(
      (val) => val.startsWith('+1'),
      'Phone number must start with +1 for Canada/USA'
    )
    .refine(
      (val) => {
        // Remove +1 and count digits
        const digitsOnly = val.replace(/[^\d]/g, '').slice(1) // Remove +1
        return digitsOnly.length === 10
      },
      'Phone number must have exactly 10 digits after country code'
    ),
});

// Business Details Schema (Step 2)
export const businessDetailsSchema = z.object({
  businessName: z
    .string()
    .min(2, 'Business name must be at least 2 characters')
    .max(100, 'Business name must be less than 100 characters'),
  businessAddress: z
    .string()
    .min(5, 'Please enter a valid address (at least 5 characters)')
    .max(200, 'Address is too long'),
  businessAddressComponents: z.record(z.any()).optional().nullable(),
  businessState: z
    .string()
    .min(2, 'State/Province is required')
    .max(100, 'State/Province name is too long'),
  businessCity: z
    .string()
    .min(2, 'City is required')
    .max(100, 'City name is too long'),
  businessCountry: z
    .enum(['Canada', 'USA'], {
      errorMap: () => ({ message: 'Country must be Canada or USA' }),
    })
    .default('Canada'),
  businessYears: z
    .number()
    .int('Years must be a whole number')
    .min(1, 'Must be at least 1 year')
    .max(100, 'Years cannot exceed 100'),
  businessWebsite: z
    .string()
    .max(200, 'Website URL is too long')
    .refine(
      (val) => val === '' || val === undefined || /^https?:\/\/.+/.test(val),
      'Please enter a valid URL starting with http:// or https://'
    )
    .optional(),
  businessEmail: z
    .string()
    .email('Please enter a valid business email address')
    .max(100, 'Email is too long'),
});

// Combined Signup Form Schema
export const signupFormSchema = z.object({
  // Auth fields
  email: z
    .string()
    .email('Please enter a valid email address')
    .max(100, 'Email is too long'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  // Personal details
  ...personalDetailsSchema.shape,
  // Business details
  ...businessDetailsSchema.shape,
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Type exports
export type PersonalDetailsFormData = z.infer<typeof personalDetailsSchema>;
export type BusinessDetailsFormData = z.infer<typeof businessDetailsSchema>;
export type SignupFormData = z.infer<typeof signupFormSchema>;
