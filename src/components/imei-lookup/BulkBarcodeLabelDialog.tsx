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
import {
  IMEI_LABEL_WIDTH_MM,
  IMEI_LABEL_HEIGHT_MM,
  IMEI_BARCODE_HEIGHT,
  BULK_LABEL_COLUMNS,
  BULK_LABEL_GAP_MM,
} from "@/lib/constants";

interface BulkBarcodeLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imeis: string[];
}

function BarcodeCanvas({ imei }: { imei: string }) {
  const setRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (!node || !imei) return;
      try {
        JsBarcode(node, imei, {
          format: "CODE128",
          width: 2,
          height: IMEI_BARCODE_HEIGHT,
          displayValue: true,
          fontSize: 12,
          margin: 6,
        });
      } catch {
        // Invalid input — canvas stays blank
      }
    },
    [imei],
  );

  return <canvas ref={setRef} className="max-w-full" />;
}

export function BulkBarcodeLabelDialog({ open, onOpenChange, imeis }: BulkBarcodeLabelDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);

  // Track when canvases have rendered
  useEffect(() => {
    if (open && imeis.length > 0) {
      // Allow a tick for callback refs to fire
      const timer = setTimeout(() => setRendered(true), 150);
      return () => clearTimeout(timer);
    }
    setRendered(false);
  }, [open, imeis]);

  const handlePrint = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvases = container.querySelectorAll<HTMLCanvasElement>("canvas");
    const images = Array.from(canvases)
      .map((canvas) => {
        try {
          return canvas.toDataURL("image/png");
        } catch {
          return null;
        }
      })
      .filter(Boolean) as string[];

    if (images.length === 0) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const labelWidthMm = IMEI_LABEL_WIDTH_MM;
    const labelHeightMm = IMEI_LABEL_HEIGHT_MM;
    const gapMm = BULK_LABEL_GAP_MM;
    const cols = BULK_LABEL_COLUMNS;

    const imgTags = images
      .map(
        (src) =>
          `<div style="width:${labelWidthMm}mm;height:${labelHeightMm}mm;display:flex;align-items:center;justify-content:center;overflow:hidden;">` +
          `<img src="${src}" style="max-width:100%;max-height:100%;" />` +
          `</div>`,
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>IMEI Labels (${images.length})</title>
          <style>
            @media print {
              @page { margin: 6mm; }
              body { margin: 0; }
            }
            body { margin: 0; padding: 6mm; }
            .grid {
              display: grid;
              grid-template-columns: repeat(${cols}, ${labelWidthMm}mm);
              gap: ${gapMm}mm;
            }
          </style>
        </head>
        <body>
          <div class="grid">${imgTags}</div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          ${"<"}/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Bulk Barcode Labels</DialogTitle>
          <DialogDescription>
            Preview {imeis.length} barcode label{imeis.length !== 1 ? "s" : ""} ready to print
          </DialogDescription>
        </DialogHeader>

        <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto py-4 px-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {imeis.map((imei, i) => (
              <div
                key={`${imei}-${i}`}
                className="flex flex-col items-center rounded-md border border-border bg-muted/20 p-2"
              >
                <BarcodeCanvas imei={imei} />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePrint} disabled={!rendered} className="gap-2">
            <Printer className="h-4 w-4" />
            Print All Labels
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
