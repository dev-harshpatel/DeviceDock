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
          fontSize: 12,
          margin: 6,
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
              margin: 0; padding: 0;
              font-family: Arial, sans-serif;
              color: #000;
            }
            .label {
              width: ${IMEI_LABEL_WIDTH_MM}mm;
              height: ${IMEI_LABEL_HEIGHT_MM}mm;
              box-sizing: border-box;
              padding: 0.75mm 2mm;
              display: flex;
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
              gap: 1.5mm;
            }
            .label-text {
              flex: 1 1 30%;
              min-width: 0;
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 0.25mm;
            }
            .device-name {
              font-size: 6pt;
              font-weight: 700;
              font-family: Arial, sans-serif;
              text-align: left;
              line-height: 1.1;
              max-width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .meta {
              font-size: 5pt;
              font-family: Arial, sans-serif;
              text-align: left;
              color: #333;
              line-height: 1.1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .barcode-img {
              flex: 0 1 auto;
              max-height: 96%;
              max-width: 48%;
              width: auto;
              height: auto;
              object-fit: contain;
            }
            .price {
              flex: 0 0 auto;
              font-size: 7pt;
              font-weight: 700;
              font-family: Arial, sans-serif;
              text-align: right;
              white-space: nowrap;
            }
          </style>
        </head>
        <body>
          <div class="label">
            ${
              deviceName || metaLine
                ? `<div class="label-text">${
                    deviceName ? `<div class="device-name">${escapeHtml(deviceName)}</div>` : ""
                  }${metaLine ? `<div class="meta">${escapeHtml(metaLine)}</div>` : ""}</div>`
                : ""
            }
            <img class="barcode-img" src="${dataUrl}" alt="barcode" onload="window.print();window.close();" />
            ${priceValue != null && !isNaN(priceValue) ? `<div class="price">$${priceValue.toFixed(2)}</div>` : ""}
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
