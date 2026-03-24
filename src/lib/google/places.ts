/**
 * Google Places API utility functions
 */

declare global {
  interface Window {
    google?: any;
    initGooglePlaces?: () => void;
  }
}

export interface AddressComponents {
  street_number?: string;
  route?: string;
  locality?: string;
  administrative_area_level_1?: string;
  country?: string;
  postal_code?: string;
  formatted_address?: string;
  [key: string]: any;
}

/**
 * Load Google Places Autocomplete script
 */
export const loadGooglePlacesScript = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps && window.google.maps.places) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        resolve();
      } else {
        reject(new Error("Google Places API failed to load"));
      }
    };
    script.onerror = () => {
      reject(new Error("Failed to load Google Places API script"));
    };
    document.head.appendChild(script);
  });
};

/**
 * Initialize Google Places Autocomplete on an input element
 */
export const initAutocomplete = (
  input: HTMLInputElement,
  onPlaceSelect: (place: any) => void
): any => {
  if (!window.google || !window.google.maps || !window.google.maps.places) {
    return null;
  }

  const autocomplete = new window.google.maps.places.Autocomplete(input, {
    types: ["address"],
    componentRestrictions: { country: [] }, // Allow all countries, can be restricted if needed
  });

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (place && place.formatted_address) {
      onPlaceSelect(place);
    }
  });

  return autocomplete;
};

/**
 * Extract address components from Google Places result
 */
export const extractAddressComponents = (place: any): AddressComponents => {
  const components: AddressComponents = {
    formatted_address: place.formatted_address || "",
  };

  if (place.address_components) {
    place.address_components.forEach((component) => {
      const type = component.types[0];
      components[type] = component.long_name;
    });
  }

  return components;
};
