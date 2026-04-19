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
import {
  IMEI_BARCODE_HEIGHT,
  IMEI_PAGE_LABEL_WIDTH_MM,
  IMEI_PAGE_LABEL_HEIGHT_MM,
} from "@/lib/constants";

export interface BulkBarcodeEntry {
  imei: string;
  deviceName: string | null;
  grade: string | null;
  storage: string | null;
  sellingPrice: number | null;
}

interface LabelSetting {
  showRetailPrice: boolean;
  customPrice: string;
}

interface BulkBarcodeLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: BulkBarcodeEntry[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function BulkBarcodeLabelDialog({
  open,
  onOpenChange,
  entries,
}: BulkBarcodeLabelDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);
  const [settings, setSettings] = useState<LabelSetting[]>([]);

  // Initialise per-entry settings when the dialog opens
  useEffect(() => {
    if (open) {
      setSettings(
        entries.map((e) => ({
          showRetailPrice: false,
          customPrice: e.sellingPrice != null ? e.sellingPrice.toFixed(2) : "",
        })),
      );
      const timer = setTimeout(() => setRendered(true), 150);
      return () => clearTimeout(timer);
    }
    setRendered(false);
  }, [open, entries]);

  const updateSetting = useCallback((index: number, patch: Partial<LabelSetting>) => {
    setSettings((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const handlePrint = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvases = container.querySelectorAll<HTMLCanvasElement>("canvas[data-index]");
    const pages: Array<{
      src: string;
      deviceName: string;
      grade: string;
      storage: string;
      showRetailPrice: boolean;
      customPrice: string;
    }> = [];

    canvases.forEach((canvas) => {
      try {
        const idx = parseInt(canvas.dataset.index ?? "0", 10);
        const src = canvas.toDataURL("image/png");
        const setting = settings[idx] ?? { showRetailPrice: false, customPrice: "" };
        pages.push({
          src,
          deviceName: canvas.dataset.deviceName ?? "",
          grade: canvas.dataset.grade ?? "",
          storage: canvas.dataset.storage ?? "",
          showRetailPrice: setting.showRetailPrice,
          customPrice: setting.customPrice,
        });
      } catch {
        // skip canvases that failed to serialize
      }
    });

    if (pages.length === 0) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const widthMm = IMEI_PAGE_LABEL_WIDTH_MM;
    const heightMm = IMEI_PAGE_LABEL_HEIGHT_MM;

    const pageMarkup = pages
      .map(({ src, deviceName, grade, storage, showRetailPrice, customPrice }) => {
        const metaParts = [grade, storage].filter(Boolean);
        const metaLine = metaParts.join(" · ");
        const priceValue = showRetailPrice && customPrice.trim() ? parseFloat(customPrice) : null;

        const hasText = !!(deviceName || metaLine);
        const hasPrice = priceValue != null && !isNaN(priceValue);

        // Use split (space-between) layout when price is shown; centered otherwise.
        const topClass = hasPrice ? "label-top-split" : "label-top-centered";
        const textClass = hasPrice ? "label-text" : "label-text-centered";
        const topBlock =
          hasText || hasPrice
            ? `<div class="${topClass}">` +
              (hasText
                ? `<div class="${textClass}">` +
                  (deviceName ? `<div class="device-name">${escapeHtml(deviceName)}</div>` : "") +
                  (metaLine ? `<div class="meta">${escapeHtml(metaLine)}</div>` : "") +
                  `</div>`
                : "") +
              (hasPrice ? `<div class="price">$${(priceValue as number).toFixed(2)}</div>` : "") +
              `</div>`
            : "";

        return (
          `<section class="label">` +
          topBlock +
          `<div class="barcode-wrap"><img class="barcode-img" src="${src}" alt="barcode" /></div>` +
          `</section>`
        );
      })
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>IMEI Labels (${pages.length})</title>
          <style>
            @page {
              size: ${widthMm}mm ${heightMm}mm;
              margin: 0;
            }
            html, body { margin: 0; padding: 0; font-family: Arial, sans-serif; color: #000; }
            .label {
              width: ${widthMm}mm;
              height: ${heightMm}mm;
              box-sizing: border-box;
              padding: 0.75mm 1.5mm 0.5mm;
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 0.5mm;
              page-break-after: always;
              break-after: page;
              overflow: hidden;
            }
            .label:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            /* Shared top-row base */
            .label-top-centered, .label-top-split {
              display: flex;
              align-items: center;
              gap: 1.5mm;
              flex-shrink: 0;
              width: 100%;
            }
            /* No price → center the text block */
            .label-top-centered { justify-content: center; }
            /* Price present → text left, price right */
            .label-top-split { justify-content: space-between; }
            .label-text {
              display: flex;
              flex-direction: column;
              gap: 0.2mm;
              min-width: 0;
              flex: 1;
            }
            .label-text-centered {
              display: flex;
              flex-direction: column;
              gap: 0.2mm;
              min-width: 0;
              align-items: center;
            }
            .device-name {
              font-size: 8.5pt;
              font-weight: 700;
              font-family: Arial, sans-serif;
              line-height: 1.2;
              word-break: break-word;
            }
            .label-text-centered .device-name,
            .label-text-centered .meta { text-align: center; }
            .meta {
              font-size: 7.5pt;
              font-family: Arial, sans-serif;
              color: #333;
              line-height: 1.2;
              word-break: break-word;
            }
            .barcode-wrap {
              flex: 1;
              min-height: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            .barcode-img {
              width: 100%;
              height: auto;
              display: block;
              max-height: 100%;
              object-fit: contain;
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
          </style>
        </head>
        <body>
          ${pageMarkup}
          <script>
            window.onload = function() { window.print(); window.close(); };
          ${"<"}/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [settings]);

  const count = entries.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Bulk Barcode Labels</DialogTitle>
          <DialogDescription>
            Configure {count} label{count !== 1 ? "s" : ""} — toggle retail price per item, then
            print
          </DialogDescription>
        </DialogHeader>

        {/* Hidden canvases used for barcode rendering */}
        <div ref={containerRef} className="hidden">
          {entries.map((entry, i) => (
            <canvas
              key={`${entry.imei}-${i}`}
              data-index={i}
              data-device-name={entry.deviceName ?? ""}
              data-grade={entry.grade ?? ""}
              data-storage={entry.storage ?? ""}
              ref={(node) => {
                if (!node || !entry.imei) return;
                try {
                  JsBarcode(node, entry.imei, {
                    format: "CODE128",
                    width: 2,
                    height: IMEI_BARCODE_HEIGHT,
                    displayValue: true,
                    font: "Arial",
                    fontSize: 10,
                    margin: 4,
                  });
                } catch {
                  // Invalid input — canvas stays blank
                }
              }}
            />
          ))}
        </div>

        {/* Visible preview list */}
        <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-2">
          {entries.map((entry, i) => {
            const setting = settings[i] ?? { showRetailPrice: false, customPrice: "" };
            const metaParts = [entry.grade, entry.storage].filter(Boolean);
            const metaLine = metaParts.join(" · ");

            return (
              <div
                key={`${entry.imei}-${i}`}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                {/* Left: device info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {entry.deviceName ?? entry.imei}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">{entry.imei}</p>
                  {metaLine && <p className="text-xs text-muted-foreground mt-0.5">{metaLine}</p>}
                </div>

                {/* Right: retail price toggle + editable input */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id={`show-price-${i}`}
                      checked={setting.showRetailPrice}
                      onCheckedChange={(checked) =>
                        updateSetting(i, { showRetailPrice: !!checked })
                      }
                    />
                    <Label
                      htmlFor={`show-price-${i}`}
                      className="text-xs text-muted-foreground cursor-pointer select-none whitespace-nowrap"
                    >
                      Retail price
                    </Label>
                  </div>

                  {setting.showRetailPrice && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={setting.customPrice}
                        onChange={(e) => updateSetting(i, { customPrice: e.target.value })}
                        className="w-24 h-8 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="shrink-0 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePrint} disabled={!rendered} className="gap-2">
            <Printer className="h-4 w-4" />
            Print {count} Label{count !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
