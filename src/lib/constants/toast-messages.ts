/**
 * Toast message constants
 * Centralized toast messages for consistent messaging across the application
 */

// Authentication messages
export const TOAST_MESSAGES = {
  // Login
  LOGIN_SUCCESS: "Welcome back!",
  LOGIN_FAILED: "Invalid email or password",

  // Logout
  LOGOUT_SUCCESS: "You have been successfully logged out.",
  LOGOUT_FAILED: "Failed to logout",

  // Password reset
  PASSWORD_RESET_EMAIL_SENT:
    "If an account exists with that email, you'll receive a password reset link shortly.",
  PASSWORD_RESET_SUCCESS: "Password updated! Redirecting you to the dashboard...",
  PASSWORD_RESET_FAILED: "Failed to reset password. Please try again.",

  // Signup
  SIGNUP_SUCCESS: "Welcome to Devicedock! 🎉",
  SIGNUP_FAILED: "Signup failed",
  SIGNUP_RATE_LIMIT: "Rate limit active",
  SIGNUP_FIX_FIELDS: "Please fix the following fields",
  SIGNUP_FIX_STEP_1: "Please fix errors in Step 1",
  SIGNUP_FIX_STEP: "Please fix errors in this step",

  // Order messages
  ORDER_APPROVED: (orderId: string) =>
    `Order #${orderId
      .slice(-8)
      .toUpperCase()} has been approved. Inventory quantities have been updated.`,
  ORDER_REJECTED: (orderId: string) =>
    `Order #${orderId.slice(-8).toUpperCase()} has been rejected.`,
  ORDER_NO_ITEMS: "Order has no items to approve.",
  ORDER_PLACED: (orderId: string) =>
    `Order #${orderId.slice(-8)} has been submitted. Admin will contact you soon.`,
  ORDER_FAILED_APPROVE: "Failed to update inventory quantities. Please try again.",
  ORDER_FAILED_REJECT: "Failed to reject order. Please try again.",
  ORDER_FAILED_CREATE: "Failed to create order. Please try again.",

  // Invoice messages
  INVOICE_DOWNLOADED: "Invoice PDF has been downloaded.",
  INVOICE_DOWNLOAD_FAILED: "Failed to download invoice. Please try again.",

  // Cart messages
  CART_EMPTY: "Add items to cart before checkout",
  CART_ADDED: (quantity: number, itemName: string) =>
    `${quantity} unit(s) of ${itemName} added to cart`,
  CART_USER_NOT_FOUND: "User information not found",
  CART_PROFILE_NOT_APPROVED:
    "Your profile must be approved before placing orders. Please wait for admin approval.",
  CART_ADDRESSES_REQUIRED: "Please select shipping and billing addresses before checkout.",
  CART_OUT_OF_STOCK: (items: string[]) =>
    `${items.join(", ")} ${items.length === 1 ? "is" : "are"} now out of stock. Please remove ${
      items.length === 1 ? "it" : "them"
    } from your cart.`,
  CART_INSUFFICIENT_STOCK: (itemDetails: string) =>
    `Some items have less stock than requested: ${itemDetails}. Please adjust quantities.`,
  CART_PRICE_CHANGED: "Prices changed again. Please review the updated prices before continuing.",
  CART_VERIFY_PRICES_FAILED: "Failed to verify prices. Please try again.",

  // Purchase modal messages
  PURCHASE_INVALID_QUANTITY: "Please enter a valid quantity",
  PURCHASE_INSUFFICIENT_STOCK: (available: number, reason: string) =>
    `Only ${available} more unit(s) available. ${reason}`,

  // Product/Inventory messages
  PRODUCT_UPDATED: "Product updated",
  INVENTORY_RESET: "Inventory reset",

  // Settings messages
  SETTINGS_IMAGE_REQUIRED: "Please upload an image file",
  SETTINGS_IMAGE_SIZE: "Image size should be less than 2MB",
  SETTINGS_LOGO_UPLOADED: "Logo uploaded successfully",
  SETTINGS_LOGO_UPLOAD_FAILED: "Failed to upload logo",
  SETTINGS_LOGO_REMOVED: "Logo removed successfully",
  SETTINGS_LOGO_REMOVE_BEFORE_UPLOAD: "Remove the current logo before uploading a new one.",
  SETTINGS_LOGO_REMOVE_FAILED: "Failed to remove logo",
  SETTINGS_COMPANY_SAVED: "Company settings saved successfully",
  SETTINGS_COMPANY_SAVE_FAILED: "Failed to save company settings",
  SETTINGS_SAVED: "Settings saved successfully",

  // User profile messages
  PROFILE_UPDATED: "User business details have been updated successfully.",
  PROFILE_UPDATE_FAILED: "Failed to update profile. Please try again.",
  PROFILE_APPROVED: "User profile has been approved. They can now place orders.",
  PROFILE_APPROVE_FAILED: "Failed to approve profile. Please try again.",
  PROFILE_REJECTED: "User profile has been rejected.",
  PROFILE_REJECT_FAILED: "Failed to reject profile. Please try again.",

  // Address messages
  ADDRESSES_UPDATED: "Addresses updated successfully",
  ADDRESSES_UPDATE_FAILED: "Failed to update addresses",

  // Export messages
  EXPORT_NO_DATA: "No data to export",
  EXPORT_SUCCESS: "Export successful",
  EXPORT_FAILED: "Export failed",

  // Team / invite messages
  INVITE_SENT: (email: string) => `Invitation sent to ${email}`,
  INVITE_CANCELLED: "Invitation cancelled",
  MEMBER_ROLE_UPDATED: "Member role updated",
  MEMBER_REMOVED: "Member removed from company",
  MEMBER_SUSPENDED: "Member suspended",
  MEMBER_REACTIVATED: "Member reactivated",

  // IMEI Lookup
  IMEI_NOT_FOUND: "No device found with that IMEI number.",
  IMEI_LOOKUP_ERROR: "Failed to look up IMEI. Please try again.",

  // Generic error messages
  ERROR_GENERIC: "An error occurred. Please try again.",
  ERROR_TRY_AGAIN: "Please try again.",
} as const;
