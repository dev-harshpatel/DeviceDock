"use client";

import { UseFormReturn } from "react-hook-form";
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { GoogleAddressAutocomplete } from "@/components/forms/GoogleAddressAutocomplete";
import { SignupFormData } from "@/lib/validations/signup";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BusinessDetailsStepProps {
  form: UseFormReturn<SignupFormData>;
}

const CANADIAN_PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Northwest Territories",
  "Nova Scotia",
  "Nunavut",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Yukon",
];

const USA_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "District of Columbia",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

export function BusinessDetailsStep({ form }: BusinessDetailsStepProps) {
  const addressValue = form.watch("businessAddress") || "";
  const addressError = form.formState.errors.businessAddress?.message;
  const businessCountry = form.watch("businessCountry") || "Canada";
  const businessAddressComponents = form.watch("businessAddressComponents");

  // Extract state and city from Google Places address components
  useEffect(() => {
    if (businessAddressComponents) {
      // Extract state/province
      const state =
        businessAddressComponents.administrative_area_level_1 ||
        businessAddressComponents.administrative_area_level_2 ||
        businessAddressComponents.administrative_area_level_3;
      if (state && !form.getValues("businessState")) {
        form.setValue("businessState", state);
      }

      // Extract city
      const city =
        businessAddressComponents.locality ||
        businessAddressComponents.sublocality ||
        businessAddressComponents.sublocality_level_1;
      if (city && !form.getValues("businessCity")) {
        form.setValue("businessCity", city);
      }

      // Extract country
      const country = businessAddressComponents.country;
      if (country) {
        const countryName =
          country === "CA" || country === "Canada"
            ? "Canada"
            : country === "US" || country === "United States"
              ? "USA"
              : null;
        if (countryName && !form.getValues("businessCountry")) {
          form.setValue("businessCountry", countryName as "Canada" | "USA");
        }
      }
    }
  }, [businessAddressComponents, form]);

  const stateOptions =
    businessCountry === "Canada" ? CANADIAN_PROVINCES : USA_STATES;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">
          Business Information
        </h3>
        <p className="text-sm text-muted-foreground">
          Tell us about your business
        </p>
      </div>

      <FormField
        control={form.control}
        name="businessName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Business Name</FormLabel>
            <FormControl>
              <Input placeholder="Your business name" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="businessCountry"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Country</FormLabel>
            <Select
              onValueChange={(value) => {
                field.onChange(value);
                // Reset state when country changes
                form.setValue("businessState", "");
              }}
              defaultValue={field.value || "Canada"}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="Canada">Canada</SelectItem>
                <SelectItem value="USA">United States</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="businessState"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {businessCountry === "Canada" ? "Province/Territory" : "State"}
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={`Select ${businessCountry === "Canada" ? "province/territory" : "state"}`}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent
                  className="max-h-60 overscroll-contain"
                  onWheelCapture={(event) => event.stopPropagation()}
                >
                  {stateOptions.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="businessCity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl>
                <Input placeholder="Enter city name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="businessAddress"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <GoogleAddressAutocomplete
                value={addressValue}
                onChange={(address, components) => {
                  field.onChange(address);
                  if (components) {
                    form.setValue("businessAddressComponents", components);
                  }
                }}
                onError={(error) => {
                  // Only set error if it's a validation error, not API configuration issues
                  if (
                    error &&
                    !error.includes("not configured") &&
                    !error.includes("unavailable")
                  ) {
                    form.setError("businessAddress", { message: error });
                  }
                }}
                label="Postal Address"
                placeholder="Enter your business address"
                required
                error={addressError}
              />
            </FormControl>
            <FormDescription>
              {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                ? "Start typing to see address suggestions"
                : "Enter your complete business address"}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="businessYears"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Years in Business</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  placeholder="e.g. 5"
                  {...field}
                  value={field.value || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    field.onChange(val === "" ? 0 : parseInt(val));
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="businessEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="contact@business.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="businessWebsite"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Business Website (Optional)</FormLabel>
            <FormControl>
              <Input
                type="url"
                placeholder="https://www.business.com"
                {...field}
                value={field.value || ""}
              />
            </FormControl>
            <FormDescription>
              Include https:// or http:// in the URL
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
