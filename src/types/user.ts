/**
 * User-related types
 */

export type UserRole = 'user' | 'admin';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type AddressType = 'business' | 'shipping' | 'billing';

export interface Address {
  address: string | null;
  addressComponents: Record<string, any> | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
}

export interface UserProfile {
  id: string;
  userId: string;
  role: UserRole;
  approvalStatus: ApprovalStatus;
  approvalStatusUpdatedAt: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  businessName: string | null;
  businessAddress: string | null;
  businessAddressComponents: Record<string, any> | null;
  businessState: string | null;
  businessCity: string | null;
  businessCountry: string | null;
  businessYears: number | null;
  businessWebsite: string | null;
  businessEmail: string | null;
  // Shipping Address
  shippingAddress: string | null;
  shippingAddressComponents: Record<string, any> | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingCountry: string | null;
  shippingPostalCode: string | null;
  // Billing Address
  billingAddress: string | null;
  billingAddressComponents: Record<string, any> | null;
  billingCity: string | null;
  billingState: string | null;
  billingCountry: string | null;
  billingPostalCode: string | null;
  // Flag for same as business
  shippingSameAsBusiness: boolean;
  billingSameAsBusiness: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileInsert {
  id?: string;
  userId: string;
  role?: UserRole;
  approvalStatus?: ApprovalStatus;
  approvalStatusUpdatedAt?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  businessName?: string | null;
  businessAddress?: string | null;
  businessAddressComponents?: Record<string, any> | null;
  businessState?: string | null;
  businessCity?: string | null;
  businessCountry?: string | null;
  businessYears?: number | null;
  businessWebsite?: string | null;
  businessEmail?: string | null;
  // Shipping Address
  shippingAddress?: string | null;
  shippingAddressComponents?: Record<string, any> | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingCountry?: string | null;
  shippingPostalCode?: string | null;
  // Billing Address
  billingAddress?: string | null;
  billingAddressComponents?: Record<string, any> | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingCountry?: string | null;
  billingPostalCode?: string | null;
  // Flags
  shippingSameAsBusiness?: boolean;
  billingSameAsBusiness?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfileUpdate {
  id?: string;
  userId?: string;
  role?: UserRole;
  approvalStatus?: ApprovalStatus;
  approvalStatusUpdatedAt?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  businessName?: string | null;
  businessAddress?: string | null;
  businessAddressComponents?: Record<string, any> | null;
  businessState?: string | null;
  businessCity?: string | null;
  businessCountry?: string | null;
  businessYears?: number | null;
  businessWebsite?: string | null;
  businessEmail?: string | null;
  // Shipping Address
  shippingAddress?: string | null;
  shippingAddressComponents?: Record<string, any> | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingCountry?: string | null;
  shippingPostalCode?: string | null;
  // Billing Address
  billingAddress?: string | null;
  billingAddressComponents?: Record<string, any> | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingCountry?: string | null;
  billingPostalCode?: string | null;
  // Flags
  shippingSameAsBusiness?: boolean;
  billingSameAsBusiness?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
