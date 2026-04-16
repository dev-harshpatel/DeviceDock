import { User, Phone, Calendar } from "lucide-react";
import { formatDateTimeInOntario } from "@/lib/utils/formatters";
import type { UserProfile } from "@/types/user";

interface UserPersonalInfoTabProps {
  user: UserProfile;
  fullName: string;
}

export function UserPersonalInfoTab({ user, fullName }: UserPersonalInfoTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>Full Name</span>
        </div>
        <p className="font-medium text-foreground">{fullName}</p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-4 w-4" />
          <span>Phone</span>
        </div>
        <p className="font-medium text-foreground">{user.phone || "N/A"}</p>
      </div>

      <div className="space-y-1 md:col-span-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>User ID</span>
        </div>
        <p className="font-medium text-foreground font-mono text-xs">{user.userId}</p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Joined</span>
        </div>
        <p className="font-medium text-foreground">{formatDateTimeInOntario(user.createdAt)}</p>
      </div>

      {user.approvalStatusUpdatedAt && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Status Updated</span>
          </div>
          <p className="font-medium text-foreground">
            {formatDateTimeInOntario(user.approvalStatusUpdatedAt)}
          </p>
        </div>
      )}
    </div>
  );
}
