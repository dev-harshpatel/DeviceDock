"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Loader2, Maximize2, RectangleHorizontal, Square, ZoomIn, ZoomOut } from "lucide-react";
import { getCroppedImageBlob } from "@/lib/utils/crop-image";

type CropShape = "rectangle" | "square";

const SHAPES: { id: CropShape; label: string; aspect: number; icon: React.ReactNode }[] = [
  {
    id: "rectangle",
    label: "Rectangle",
    aspect: 2, // 140 × 70 — matches the invoice PDF logo bounding box
    icon: <RectangleHorizontal className="h-4 w-4" />,
  },
  {
    id: "square",
    label: "Square",
    aspect: 1,
    icon: <Square className="h-4 w-4" />,
  },
];

// Output pixel dimensions per shape (4× PDF size for crisp HiDPI rendering)
const OUTPUT: Record<CropShape, { width: number; height: number }> = {
  rectangle: { width: 560, height: 280 },
  square: { width: 280, height: 280 },
};

/**
 * Returns the zoom level at which the entire image is just contained within
 * the crop area (no overflow on either axis).
 *
 * react-easy-crop defines zoom=1 as the image covering the crop area (cover).
 * A wider image (imageAspect > cropAspect) overflows horizontally at zoom=1;
 * we need to zoom out by the ratio of the aspects to bring it fully in.
 */
function calcFitZoom(imageAspect: number, cropAspect: number): number {
  return Math.min(cropAspect, imageAspect) / Math.max(cropAspect, imageAspect);
}

interface LogoCropModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Object-URL created from the raw selected file */
  imageSrc: string;
  onConfirm: (croppedBlob: Blob) => void;
}

export function LogoCropModal({ open, onOpenChange, imageSrc, onConfirm }: LogoCropModalProps) {
  const [shape, setShape] = useState<CropShape>("rectangle");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  /** Natural aspect ratio of the loaded image (width / height). */
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);

  const currentAspect = SHAPES.find((s) => s.id === shape)!.aspect;

  /** Zoom that shows the whole image inside the crop box (no overflow). */
  const fitZoom = naturalAspect !== null ? calcFitZoom(naturalAspect, currentAspect) : 1;
  /** Allow zooming out to 60 % of fit so there's clear whitespace around the logo. */
  const minZoom = Math.max(fitZoom * 0.6, 0.05);

  /** Auto-reset zoom / position when the image first loads or when the shape changes. */
  useEffect(() => {
    if (naturalAspect === null) return;
    setCrop({ x: 0, y: 0 });
    setZoom(fitZoom);
    setCroppedAreaPixels(null);
  }, [shape, naturalAspect, fitZoom]);

  const handleMediaLoaded = useCallback(
    ({ naturalWidth, naturalHeight }: { naturalWidth: number; naturalHeight: number }) => {
      setNaturalAspect(naturalWidth / naturalHeight);
    },
    [],
  );

  const handleShapeChange = (next: CropShape) => {
    setShape(next);
    // naturalAspect stays; useEffect above will recalculate fitZoom for new shape
  };

  const handleFit = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(fitZoom);
  };

  const handleCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const { width, height } = OUTPUT[shape];
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, width, height);
      onConfirm(blob);
      onOpenChange(false);
    } catch {
      // blob failure — modal stays open so user can retry
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    if (!isProcessing) onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isProcessing) onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>Adjust Logo</DialogTitle>
          <DialogDescription>
            Choose a shape · drag to reposition · zoom in/out to frame your logo · the highlighted
            area is what will appear on invoices.
          </DialogDescription>
        </DialogHeader>

        {/* Shape toggle + Fit button */}
        <div className="flex items-center justify-between px-6 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Shape:</span>
            {SHAPES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleShapeChange(s.id)}
                disabled={isProcessing}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                  shape === s.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-muted",
                )}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleFit}
            disabled={isProcessing}
            title="Reset to show entire image"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-background hover:bg-muted transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Fit
          </button>
        </div>

        {/* Crop canvas */}
        <div className="relative w-full h-64 bg-muted/60">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={minZoom}
            maxZoom={4}
            aspect={currentAspect}
            restrictPosition={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
            onMediaLoaded={handleMediaLoaded}
            showGrid={false}
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: { border: "2px solid hsl(var(--primary))" },
            }}
          />
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 px-6 py-3 border-t border-border">
          <ZoomOut className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Slider
            min={minZoom}
            max={4}
            step={0.05}
            value={[zoom]}
            onValueChange={([v]) => setZoom(v)}
            aria-label="Zoom"
            className="flex-1"
          />
          <ZoomIn className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        <DialogFooter className="px-6 pb-6 gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing…
              </>
            ) : (
              "Apply & Upload"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
