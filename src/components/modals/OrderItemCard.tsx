import { AlertTriangle, Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ClickableGradeBadge } from "@/components/common/ClickableGradeBadge";
import { formatPrice } from "@/lib/utils";
import type { OrderItem } from "@/types/order";

interface OrderItemCardProps {
  orderItem: OrderItem;
  /** Admin-only: colour assignments keyed by inventory item id */
  colorAssignments?: Record<string, { color: string; quantity: number }[]>;
  /** Fetched IMEI/serial labels keyed by inventoryIdentifierId */
  fetchedIdentifierLabels?: Record<string, string>;
  /** Fetched per-unit colours keyed by inventoryIdentifierId */
  fetchedIdentifierColors?: Record<string, string>;
  /** Fetched damage notes keyed by inventoryIdentifierId */
  fetchedIdentifierDamageNotes?: Record<string, string>;
}

export function OrderItemCard({
  orderItem,
  colorAssignments = {},
  fetchedIdentifierLabels = {},
  fetchedIdentifierColors = {},
  fetchedIdentifierDamageNotes = {},
}: OrderItemCardProps) {
  const { item, quantity, identifierLabel, inventoryIdentifierId } = orderItem;
  const itemColors = colorAssignments[item.id] ?? [];

  const resolvedLabel =
    identifierLabel ??
    (inventoryIdentifierId ? fetchedIdentifierLabels[inventoryIdentifierId] : undefined);

  const resolvedColor = inventoryIdentifierId
    ? fetchedIdentifierColors[inventoryIdentifierId]
    : undefined;

  const resolvedDamageNote = inventoryIdentifierId
    ? fetchedIdentifierDamageNotes[inventoryIdentifierId]
    : undefined;

  const unitPrice = item.sellingPrice ?? item.pricePerUnit ?? 0;

  return (
    <div className="p-4 bg-muted/50 rounded-lg border border-border">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h4 className="font-medium text-foreground">{item.deviceName || "Unknown Device"}</h4>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {item.grade && (
              <ClickableGradeBadge
                grade={item.grade}
                inventoryId={item.id}
                deviceName={item.deviceName || "this device"}
              />
            )}
            <Badge variant="outline" className="text-xs">
              {item.storage || "N/A"}
            </Badge>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              Quantity: {quantity || 0}
            </span>
          </div>

          {resolvedLabel && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-xs text-muted-foreground">IMEI/Serial:</span>
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-foreground select-all">
                {resolvedLabel}
              </span>
              {resolvedColor && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {resolvedColor}
                </span>
              )}
            </div>
          )}

          {resolvedDamageNote && (
            <div className="flex items-start gap-1.5 mt-2 rounded border border-destructive/30 bg-destructive/10 px-2.5 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive leading-snug">{resolvedDamageNote}</p>
            </div>
          )}

          {itemColors.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              <Palette className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {itemColors.map((c) => (
                <span
                  key={c.color}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                >
                  {c.color}
                  <span className="text-primary/70">×{c.quantity}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            {formatPrice(unitPrice)} each
          </p>
          <p className="font-semibold text-foreground mt-1 whitespace-nowrap">
            {formatPrice(unitPrice * (quantity || 0))}
          </p>
        </div>
      </div>
    </div>
  );
}
