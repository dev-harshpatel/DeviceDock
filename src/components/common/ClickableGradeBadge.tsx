"use client";

import { useState } from "react";
import { GradeBadge } from "@/components/common/GradeBadge";
import { DamageNotesModal } from "@/components/modals/DamageNotesModal";
import type { Grade } from "@/lib/constants/grades";

interface ClickableGradeBadgeProps {
  grade: Grade;
  inventoryId: string;
  deviceName: string;
  className?: string;
}

/**
 * Drop-in replacement for GradeBadge when you have an inventory item in scope.
 * For Grade D: renders a clickable badge that opens the DamageNotesModal.
 * For all other grades: renders a plain GradeBadge.
 */
export function ClickableGradeBadge({
  grade,
  inventoryId,
  deviceName,
  className,
}: ClickableGradeBadgeProps) {
  const [open, setOpen] = useState(false);

  if (grade !== "D") {
    return <GradeBadge grade={grade} className={className} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
        title="Click to view damage notes"
        aria-label={`View damage notes for ${deviceName}`}
      >
        <GradeBadge
          grade="D"
          className="hover:opacity-80 transition-opacity underline decoration-dotted underline-offset-2"
        />
      </button>
      <DamageNotesModal
        open={open}
        onOpenChange={setOpen}
        inventoryId={inventoryId}
        deviceName={deviceName}
      />
    </>
  );
}
