"use client";

import { useState } from "react";
import { AlertTriangle, FileText, Pencil, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

interface IdentifierEntry {
  identifierId: string;
  imei: string | null;
  serialNumber: string | null;
  damageNote: string | null;
}

interface DamageNotesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryId: string;
  deviceName: string;
}

async function fetchIdentifiers(
  inventoryId: string,
  page: number,
): Promise<{ entries: IdentifierEntry[]; totalCount: number }> {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await (supabase as any)
    .from("inventory_identifiers")
    .select("id, imei, serial_number, damage_note", { count: "exact" })
    .eq("inventory_id", inventoryId)
    .order("created_at", { ascending: true })
    .range(from, to);

  if (error) throw new Error(error.message);

  const entries: IdentifierEntry[] = (data ?? []).map(
    (row: {
      id: string;
      imei: string | null;
      serial_number: string | null;
      damage_note: string | null;
    }) => ({
      identifierId: row.id,
      imei: row.imei,
      serialNumber: row.serial_number,
      damageNote: row.damage_note,
    }),
  );

  return { entries, totalCount: count ?? 0 };
}

export function DamageNotesModal({
  open,
  onOpenChange,
  inventoryId,
  deviceName,
}: DamageNotesModalProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.damageNotes(inventoryId), page],
    queryFn: () => fetchIdentifiers(inventoryId, page),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    enabled: open && Boolean(inventoryId),
  });

  const entries = data?.entries ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const startEdit = (entry: IdentifierEntry) => {
    setEditingId(entry.identifierId);
    setEditValue(entry.damageNote ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleSave = async (identifierId: string) => {
    setIsSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("inventory_identifiers")
        .update({ damage_note: editValue.trim() || null })
        .eq("id", identifierId);
      if (error) throw new Error(error.message);
      await queryClient.invalidateQueries({ queryKey: queryKeys.damageNotes(inventoryId) });
      setEditingId(null);
      setEditValue("");
    } catch {
      toast.error(TOAST_MESSAGES.ERROR_GENERIC);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-1rem)] mx-auto max-h-[80vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 shrink-0">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            Damage Notes
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {deviceName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 mt-2 space-y-2">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          )}

          {!isLoading && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No units found for this device.</p>
            </div>
          )}

          {!isLoading &&
            entries.map((entry) => {
              const label = entry.imei ?? entry.serialNumber ?? entry.identifierId;
              const isEditing = editingId === entry.identifierId;
              const hasNote = Boolean(entry.damageNote);

              return (
                <div
                  key={entry.identifierId}
                  className={cn(
                    "rounded-lg border p-3 space-y-1.5",
                    hasNote
                      ? "border-destructive/25 bg-destructive/5"
                      : "border-border bg-muted/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs text-muted-foreground truncate">{label}</p>
                    {!isEditing && (
                      <button
                        onClick={() => startEdit(entry)}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="Edit damage note"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isEditing && (
                      <button
                        onClick={cancelEdit}
                        disabled={isSaving}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="Cancel edit"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="Describe the damage (e.g. cracked screen, dead battery)…"
                        rows={2}
                        className="text-sm resize-none"
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={isSaving}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSave(entry.identifierId)}
                          disabled={isSaving}
                        >
                          {isSaving ? "Saving…" : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : hasNote ? (
                    <p className="text-sm text-destructive leading-snug">{entry.damageNote}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No note added</p>
                  )}
                </div>
              );
            })}
        </div>

        {!isLoading && totalPages > 1 && (
          <div className="shrink-0 pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </Button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
