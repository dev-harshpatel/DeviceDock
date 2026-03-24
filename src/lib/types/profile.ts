/**
 * Dynamic profile field configuration
 * Easy to add/remove fields without code changes
 */

export interface ProfileFieldConfig {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "url" | "number" | "address";
  section: "personal" | "business";
  editable: boolean;
  required?: boolean;
  placeholder?: string;
  description?: string;
}

export const profileFields: ProfileFieldConfig[] = [
  // Personal Details
  {
    key: "firstName",
    label: "First Name",
    type: "text",
    section: "personal",
    editable: true,
    required: true,
    placeholder: "Your first name",
  },
  {
    key: "lastName",
    label: "Last Name",
    type: "text",
    section: "personal",
    editable: true,
    required: true,
    placeholder: "Your last name",
  },
  {
    key: "phone",
    label: "Phone Number",
    type: "tel",
    section: "personal",
    editable: true,
    required: false,
    placeholder: "(555) 123-4567",
    description: "Phone number for Canada/USA (country code +1 is included)",
  },
  // Business Details
  {
    key: "businessName",
    label: "Business Name",
    type: "text",
    section: "business",
    editable: true,
    required: true,
    placeholder: "Your business name",
  },
  {
    key: "businessAddress",
    label: "Business Address",
    type: "address",
    section: "business",
    editable: true,
    required: true,
    placeholder: "Enter business address",
  },
  {
    key: "businessCity",
    label: "City",
    type: "text",
    section: "business",
    editable: false,
    required: true,
    placeholder: "Toronto",
    description: "City cannot be changed (used for tax calculation)",
  },
  {
    key: "businessCountry",
    label: "Country",
    type: "text",
    section: "business",
    editable: false,
    required: true,
    placeholder: "Canada",
    description: "Country cannot be changed (used for tax calculation)",
  },
  {
    key: "businessYears",
    label: "Years in Business",
    type: "number",
    section: "business",
    editable: true,
    required: false,
    placeholder: "5",
  },
  {
    key: "businessEmail",
    label: "Business Email",
    type: "email",
    section: "business",
    editable: true,
    required: true,
    placeholder: "contact@business.com",
  },
  {
    key: "businessWebsite",
    label: "Business Website",
    type: "url",
    section: "business",
    editable: true,
    required: false,
    placeholder: "https://www.business.com",
  },
];

export const getFieldsBySection = (
  section: "personal" | "business"
): ProfileFieldConfig[] => {
  return profileFields.filter((field) => field.section === section);
};

export const getFieldByKey = (key: string): ProfileFieldConfig | undefined => {
  return profileFields.find((field) => field.key === key);
};
