import { AlertCircle } from "lucide-react";

interface RejectionNoteProps {
  rejectionReason?: string | null;
  rejectionComment?: string | null;
}

export function RejectionNote({ rejectionReason, rejectionComment }: RejectionNoteProps) {
  if (!rejectionReason && !rejectionComment) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex items-start gap-2 max-w-xs">
      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
      <div className="flex-1 space-y-1">
        {rejectionReason && (
          <p className="text-xs text-foreground">
            <span className="font-medium">Reason:</span> {rejectionReason}
          </p>
        )}
        {rejectionComment && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {rejectionComment}
          </p>
        )}
      </div>
    </div>
  );
}
