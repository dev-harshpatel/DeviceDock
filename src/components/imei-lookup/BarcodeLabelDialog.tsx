"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IMEI_LABEL_WIDTH_MM, IMEI_LABEL_HEIGHT_MM, IMEI_BARCODE_HEIGHT } from "@/lib/constants";

interface BarcodeLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imei: string;
  deviceName?: string | null;
  storage?: string | null;
  grade?: string | null;
  sellingPrice?: number | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function BarcodeLabelDialog({
  open,
  onOpenChange,
  imei,
  deviceName,
  storage,
  grade,
  sellingPrice,
}: BarcodeLabelDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showRetailPrice, setShowRetailPrice] = useState(false);
  const [customPrice, setCustomPrice] = useState("");

  // Pre-fill price from device data when checkbox is first enabled
  useEffect(() => {
    if (showRetailPrice && customPrice === "" && sellingPrice != null) {
      setCustomPrice(sellingPrice.toFixed(2));
    }
  }, [showRetailPrice, customPrice, sellingPrice]);

  // Reset controls when dialog closes
  useEffect(() => {
    if (!open) {
      setShowRetailPrice(false);
      setCustomPrice("");
    }
  }, [open]);

  // Callback ref — fires when the canvas mounts into the DOM
  const setCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      canvasRef.current = node;
      if (!node || !imei) return;

      try {
        JsBarcode(node, imei, {
          format: "CODE128",
          width: 2,
          height: IMEI_BARCODE_HEIGHT,
          displayValue: true,
          font: "Arial",
          fontSize: 10,
          margin: 4,
        });
      } catch {
        // JsBarcode may throw on invalid input — canvas stays blank
      }
    },
    [imei],
  );

  const handlePrint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const metaParts = [grade, storage].filter(Boolean);
    const metaLine = metaParts.length > 0 ? metaParts.join(" · ") : null;
    const priceValue = showRetailPrice && customPrice.trim() ? parseFloat(customPrice) : null;
    const hasText = !!(deviceName || metaLine);
    const hasPrice = priceValue != null && !isNaN(priceValue);

    printWindow.document.write(`
      <html>
        <head>
          <title>IMEI Label - ${imei}</title>
          <style>
            @page {
              size: ${IMEI_LABEL_WIDTH_MM}mm ${IMEI_LABEL_HEIGHT_MM}mm;
              margin: 0;
            }
            html, body {
              margin: 0;
              padding: 0;
              width: ${IMEI_LABEL_WIDTH_MM}mm;
              height: ${IMEI_LABEL_HEIGHT_MM}mm;
              overflow: hidden;
              font-family: Arial, sans-serif;
              color: #000;
            }
            .label {
              width: 100%;
              height: 100%;
              box-sizing: border-box;
              padding: 1.25mm 1.5mm 0.5mm;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
              gap: 0.5mm;
            }
            .label-top {
              display: flex;
              align-items: center;
              justify-content: ${hasPrice ? "space-between" : "center"};
              gap: 1.5mm;
              flex-shrink: 0;
              width: 100%;
            }
            .label-text {
              display: flex;
              flex-direction: column;
              gap: 0.2mm;
              min-width: 0;
              flex: ${hasPrice ? "1" : "none"};
              align-items: ${hasPrice ? "flex-start" : "center"};
            }
            .device-name {
              font-size: 8.5pt;
              font-weight: 700;
              font-family: Arial, sans-serif;
              line-height: 1.2;
              word-break: break-word;
              text-align: ${hasPrice ? "left" : "center"};
            }
            .meta {
              font-size: 7.5pt;
              font-family: Arial, sans-serif;
              color: #333;
              line-height: 1.2;
              word-break: break-word;
              text-align: ${hasPrice ? "left" : "center"};
            }
            .price {
              font-size: 8.5pt;
              font-weight: 700;
              font-family: Arial, sans-serif;
              white-space: nowrap;
              text-align: right;
              flex-shrink: 0;
              align-self: center;
            }
            .barcode-wrap {
              flex: 1;
              min-height: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              padding-top: 1mm;
            }
            .barcode-img {
              width: 100%;
              height: auto;
              display: block;
              max-height: 100%;
              object-fit: contain;
            }
          </style>
        </head>
        <body>
          <div class="label">
            ${
              hasText || hasPrice
                ? `
            <div class="label-top">
              ${
                hasText
                  ? `
              <div class="label-text">
                ${deviceName ? `<div class="device-name">${escapeHtml(deviceName)}</div>` : ""}
                ${metaLine ? `<div class="meta">${escapeHtml(metaLine)}</div>` : ""}
              </div>`
                  : ""
              }
              ${hasPrice ? `<div class="price">$${(priceValue as number).toFixed(2)}</div>` : ""}
            </div>`
                : ""
            }
            <div class="barcode-wrap">
              <img class="barcode-img" src="${dataUrl}" alt="barcode" onload="window.print();window.close();" />
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [imei, deviceName, grade, storage, showRetailPrice, customPrice]);

  const metaSummary = [grade, storage].filter(Boolean).join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>IMEI Barcode Label</DialogTitle>
          <DialogDescription>
            {deviceName ? (
              <>
                {deviceName}
                {metaSummary && <span className="text-muted-foreground"> · {metaSummary}</span>}
              </>
            ) : (
              <>Preview the barcode label for IMEI: {imei}</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center py-4 bg-muted/30 rounded-lg">
          <canvas ref={setCanvasRef} className="max-w-full" />
        </div>

        {/* Retail price toggle */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-retail-price"
              checked={showRetailPrice}
              onCheckedChange={(checked) => setShowRetailPrice(!!checked)}
            />
            <Label htmlFor="show-retail-price" className="text-sm cursor-pointer select-none">
              Show retail price on label
            </Label>
          </div>

          {showRetailPrice && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="w-36 h-9 text-sm"
                autoFocus
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Print Label
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
