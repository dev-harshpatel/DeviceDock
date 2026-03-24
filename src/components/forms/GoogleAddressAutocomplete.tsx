"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  loadGooglePlacesScript,
  initAutocomplete,
  extractAddressComponents,
  type AddressComponents,
} from "@/lib/google/places";

interface GoogleAddressAutocompleteProps {
  value: string;
  onChange: (address: string, components: AddressComponents | null) => void;
  onError?: (error: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  error?: string;
  disabled?: boolean;
}

export function GoogleAddressAutocomplete({
  value,
  onChange,
  onError,
  label = "Postal Address",
  placeholder = "Start typing your address...",
  required = false,
  className,
  error,
  disabled = false,
}: GoogleAddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey) {
      // API key not configured - allow manual entry
      setHasError(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    loadGooglePlacesScript(apiKey)
      .then(() => {
        setIsScriptLoaded(true);
        setHasError(false);
      })
      .catch((err) => {
        // Don't treat this as an error - just allow manual entry
        setHasError(false);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [apiKey, onError]);

  useEffect(() => {
    if (!isScriptLoaded || !inputRef.current || disabled) {
      return;
    }

    try {
      autocompleteRef.current = initAutocomplete(inputRef.current, (place) => {
        if (place.formatted_address) {
          const components = extractAddressComponents(place);
          onChange(place.formatted_address, components);
          setHasError(false);
        }
      });
    } catch (err) {
      onError?.("Failed to initialize address autocomplete");
      setHasError(true);
    }

    return () => {
      if (autocompleteRef.current) {
        // Cleanup if needed
        autocompleteRef.current = null;
      }
    };
  }, [isScriptLoaded, onChange, onError, disabled]);

  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue, null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label
          htmlFor="address-input"
          className={cn(error && "text-destructive")}
        >
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          id="address-input"
          type="text"
          value={value}
          onChange={handleManualChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled || isLoading}
          className={cn(
            "pl-10",
            error && "border-destructive focus-visible:ring-destructive",
            hasError && "border-warning"
          )}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      {!apiKey && (
        <p className="text-sm text-muted-foreground">
          Going to be used for billing and shipping purposes.
        </p>
      )}
      {isScriptLoaded && value && (
        <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md border border-border">
          <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-foreground">{value}</p>
        </div>
      )}
    </div>
  );
}
