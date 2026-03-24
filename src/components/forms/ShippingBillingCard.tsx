"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserProfile } from "@/types/user";
import { updateUserProfileDetails } from "@/lib/supabase/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { GoogleAddressAutocomplete } from "@/components/forms/GoogleAddressAutocomplete";
import {
  Edit2,
  Save,
  X,
  MapPin,
  Truck,
  CreditCard,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { cn } from "@/lib/utils";

// Validation schema for addresses
const addressSchema = z.object({
  // Shipping
  shippingSameAsBusiness: z.boolean().default(false),
  shippingAddress: z.string().optional(),
  shippingAddressComponents: z.record(z.any()).nullable().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional(),
  shippingCountry: z.string().optional(),
  shippingPostalCode: z.string().optional(),
  // Billing
  billingSameAsBusiness: z.boolean().default(false),
  billingAddress: z.string().optional(),
  billingAddressComponents: z.record(z.any()).nullable().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingCountry: z.string().optional(),
  billingPostalCode: z.string().optional(),
});

type AddressFormData = z.infer<typeof addressSchema>;

interface ShippingBillingCardProps {
  profile: UserProfile;
  userId: string;
  onProfileUpdate?: (profile: UserProfile) => void;
}

export function ShippingBillingCard({
  profile,
  userId,
  onProfileUpdate,
}: ShippingBillingCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      shippingSameAsBusiness: profile.shippingSameAsBusiness || false,
      shippingAddress: profile.shippingAddress || "",
      shippingAddressComponents: profile.shippingAddressComponents,
      shippingCity: profile.shippingCity || "",
      shippingState: profile.shippingState || "",
      shippingCountry: profile.shippingCountry || "",
      shippingPostalCode: profile.shippingPostalCode || "",
      billingSameAsBusiness: profile.billingSameAsBusiness || false,
      billingAddress: profile.billingAddress || "",
      billingAddressComponents: profile.billingAddressComponents,
      billingCity: profile.billingCity || "",
      billingState: profile.billingState || "",
      billingCountry: profile.billingCountry || "",
      billingPostalCode: profile.billingPostalCode || "",
    },
  });

  const shippingSameAsBusiness = form.watch("shippingSameAsBusiness");
  const billingSameAsBusiness = form.watch("billingSameAsBusiness");

  // Update form when profile changes
  useEffect(() => {
    form.reset({
      shippingSameAsBusiness: profile.shippingSameAsBusiness || false,
      shippingAddress: profile.shippingAddress || "",
      shippingAddressComponents: profile.shippingAddressComponents,
      shippingCity: profile.shippingCity || "",
      shippingState: profile.shippingState || "",
      shippingCountry: profile.shippingCountry || "",
      shippingPostalCode: profile.shippingPostalCode || "",
      billingSameAsBusiness: profile.billingSameAsBusiness || false,
      billingAddress: profile.billingAddress || "",
      billingAddressComponents: profile.billingAddressComponents,
      billingCity: profile.billingCity || "",
      billingState: profile.billingState || "",
      billingCountry: profile.billingCountry || "",
      billingPostalCode: profile.billingPostalCode || "",
    });
  }, [profile, form]);

  const handleCancel = () => {
    form.reset();
    setIsEditing(false);
  };

  const onSubmit = async (data: AddressFormData) => {
    setIsSaving(true);
    try {
      const updatedProfile = await updateUserProfileDetails(userId, {
        shippingSameAsBusiness: data.shippingSameAsBusiness,
        shippingAddress: data.shippingSameAsBusiness
          ? null
          : data.shippingAddress,
        shippingAddressComponents: data.shippingSameAsBusiness
          ? null
          : data.shippingAddressComponents,
        shippingCity: data.shippingSameAsBusiness ? null : data.shippingCity,
        shippingState: data.shippingSameAsBusiness ? null : data.shippingState,
        shippingCountry: data.shippingSameAsBusiness
          ? null
          : data.shippingCountry,
        shippingPostalCode: data.shippingSameAsBusiness
          ? null
          : data.shippingPostalCode,
        billingSameAsBusiness: data.billingSameAsBusiness,
        billingAddress: data.billingSameAsBusiness ? null : data.billingAddress,
        billingAddressComponents: data.billingSameAsBusiness
          ? null
          : data.billingAddressComponents,
        billingCity: data.billingSameAsBusiness ? null : data.billingCity,
        billingState: data.billingSameAsBusiness ? null : data.billingState,
        billingCountry: data.billingSameAsBusiness ? null : data.billingCountry,
        billingPostalCode: data.billingSameAsBusiness
          ? null
          : data.billingPostalCode,
      });

      if (updatedProfile) {
        onProfileUpdate?.(updatedProfile);
        toast.success(TOAST_MESSAGES.ADDRESSES_UPDATED);
        setIsEditing(false);
      } else {
        toast.error(TOAST_MESSAGES.ADDRESSES_UPDATE_FAILED);
      }
    } catch (error) {
      toast.error("Failed to update addresses");
    } finally {
      setIsSaving(false);
    }
  };

  const getDisplayAddress = (type: "shipping" | "billing") => {
    if (type === "shipping") {
      if (profile.shippingSameAsBusiness) {
        return profile.businessAddress || "Not set";
      }
      return profile.shippingAddress || "Not set";
    } else {
      if (profile.billingSameAsBusiness) {
        return profile.businessAddress || "Not set";
      }
      return profile.billingAddress || "Not set";
    }
  };

  const hasShippingAddress =
    profile.shippingSameAsBusiness || !!profile.shippingAddress;
  const hasBillingAddress =
    profile.billingSameAsBusiness || !!profile.billingAddress;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              Shipping & Billing Addresses
            </CardTitle>
          </div>
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={form.handleSubmit(onSubmit)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </div>
          )}
        </div>
        <CardDescription>
          Manage your shipping and billing addresses for orders
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Form {...form}>
            <form className="space-y-6">
              {/* Shipping Address Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Truck className="h-4 w-4" />
                  Shipping Address
                </div>

                <FormField
                  control={form.control}
                  name="shippingSameAsBusiness"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Same as business address</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                {!shippingSameAsBusiness && (
                  <FormField
                    control={form.control}
                    name="shippingAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <GoogleAddressAutocomplete
                            value={field.value || ""}
                            onChange={(address, components) => {
                              field.onChange(address);
                              if (components) {
                                form.setValue(
                                  "shippingAddressComponents",
                                  components as any
                                );
                                form.setValue(
                                  "shippingCity",
                                  components.locality || ""
                                );
                                form.setValue(
                                  "shippingState",
                                  components.administrative_area_level_1 || ""
                                );
                                form.setValue(
                                  "shippingCountry",
                                  components.country || ""
                                );
                                form.setValue(
                                  "shippingPostalCode",
                                  components.postal_code || ""
                                );
                              }
                            }}
                            placeholder="Enter shipping address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {!shippingSameAsBusiness && form.watch("shippingCity") && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">City</Label>
                      <p className="font-medium">
                        {form.watch("shippingCity")}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        State/Province
                      </Label>
                      <p className="font-medium">
                        {form.watch("shippingState")}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Country</Label>
                      <p className="font-medium">
                        {form.watch("shippingCountry")}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        Postal Code
                      </Label>
                      <p className="font-medium">
                        {form.watch("shippingPostalCode")}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-border" />

              {/* Billing Address Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CreditCard className="h-4 w-4" />
                  Billing Address
                </div>

                <FormField
                  control={form.control}
                  name="billingSameAsBusiness"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Same as business address</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                {!billingSameAsBusiness && (
                  <FormField
                    control={form.control}
                    name="billingAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <GoogleAddressAutocomplete
                            value={field.value || ""}
                            onChange={(address, components) => {
                              field.onChange(address);
                              if (components) {
                                form.setValue(
                                  "billingAddressComponents",
                                  components as any
                                );
                                form.setValue(
                                  "billingCity",
                                  components.locality || ""
                                );
                                form.setValue(
                                  "billingState",
                                  components.administrative_area_level_1 || ""
                                );
                                form.setValue(
                                  "billingCountry",
                                  components.country || ""
                                );
                                form.setValue(
                                  "billingPostalCode",
                                  components.postal_code || ""
                                );
                              }
                            }}
                            placeholder="Enter billing address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {!billingSameAsBusiness && form.watch("billingCity") && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">City</Label>
                      <p className="font-medium">{form.watch("billingCity")}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        State/Province
                      </Label>
                      <p className="font-medium">
                        {form.watch("billingState")}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Country</Label>
                      <p className="font-medium">
                        {form.watch("billingCountry")}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        Postal Code
                      </Label>
                      <p className="font-medium">
                        {form.watch("billingPostalCode")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </Form>
        ) : (
          <div className="space-y-6">
            {/* Shipping Address Display */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Truck className="h-4 w-4" />
                Shipping Address
                {!hasShippingAddress && (
                  <span className="text-xs text-destructive">(Required)</span>
                )}
              </div>
              <div
                className={cn(
                  "p-3 rounded-lg border",
                  hasShippingAddress
                    ? "bg-muted/50"
                    : "bg-destructive/5 border-destructive/20"
                )}
              >
                {profile.shippingSameAsBusiness ? (
                  <p className="text-sm text-muted-foreground">
                    Same as business address
                  </p>
                ) : null}
                <p
                  className={cn(
                    "text-sm",
                    !hasShippingAddress && "text-muted-foreground italic"
                  )}
                >
                  {getDisplayAddress("shipping")}
                </p>
              </div>
            </div>

            {/* Billing Address Display */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CreditCard className="h-4 w-4" />
                Billing Address
                {!hasBillingAddress && (
                  <span className="text-xs text-destructive">(Required)</span>
                )}
              </div>
              <div
                className={cn(
                  "p-3 rounded-lg border",
                  hasBillingAddress
                    ? "bg-muted/50"
                    : "bg-destructive/5 border-destructive/20"
                )}
              >
                {profile.billingSameAsBusiness ? (
                  <p className="text-sm text-muted-foreground">
                    Same as business address
                  </p>
                ) : null}
                <p
                  className={cn(
                    "text-sm",
                    !hasBillingAddress && "text-muted-foreground italic"
                  )}
                >
                  {getDisplayAddress("billing")}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
