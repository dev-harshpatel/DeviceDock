"use client";

import { useState } from "react";
import { Palette, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ColorEntry {
  color: string;
  quantity: number;
}

interface ColorBreakdownPopoverProps {
  inventoryId: string;
}

export function ColorBreakdownPopover({ inventoryId }: ColorBreakdownPopoverProps) {
  const [colors, setColors] = useState<ColorEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleOpen = async (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && colors === null && !isLoading) {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/inventory-colors?inventory_id=${encodeURIComponent(inventoryId)}`
        );
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setColors(data.colors ?? []);
      } catch {
        setError("Could not load colour data.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          title="View colour breakdown"
        >
          <Palette className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-3" side="left" align="center">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Colour Breakdown
        </p>
        {isLoading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : colors && colors.length > 0 ? (
          <div className="space-y-1.5">
            {colors.map((c) => (
              <div
                key={c.color}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-foreground">{c.color}</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {c.quantity}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No colour data recorded.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
