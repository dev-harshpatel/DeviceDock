"use client";

import { useCallback, useRef } from "react";
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
import { IMEI_LABEL_WIDTH_MM, IMEI_LABEL_HEIGHT_MM, IMEI_BARCODE_HEIGHT } from "@/lib/constants";

interface BarcodeLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imei: string;
}

export function BarcodeLabelDialog({ open, onOpenChange, imei }: BarcodeLabelDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
          fontSize: 14,
          margin: 10,
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

    printWindow.document.write(`
      <html>
        <head>
          <title>IMEI Label - ${imei}</title>
          <style>
            @media print {
              @page {
                size: ${IMEI_LABEL_WIDTH_MM}mm ${IMEI_LABEL_HEIGHT_MM}mm;
                margin: 0;
              }
              body { margin: 0; display: flex; align-items: center; justify-content: center; }
              img { max-width: 100%; max-height: 100%; }
            }
            body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            img { max-width: 100%; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" onload="window.print();window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [imei]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>IMEI Barcode Label</DialogTitle>
          <DialogDescription>Preview the barcode label for IMEI: {imei}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center py-4">
          <canvas ref={setCanvasRef} className="max-w-full" />
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
