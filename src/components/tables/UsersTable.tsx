import { UserProfile } from "@/types/user";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getStatusColor, getStatusLabel } from "@/lib/utils/status";
import { User, Mail, Building2, MapPin, Calendar, Eye } from "lucide-react";

interface UsersTableProps {
  users: UserProfile[];
  className?: string;
  onReviewUser?: (user: UserProfile) => void;
}

export function UsersTable({
  users,
  className,
  onReviewUser,
}: UsersTableProps) {
  if (users.length === 0) {
    return <EmptyState />;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      {/* Desktop Table */}
      <div
        className={cn(
          "hidden md:block overflow-hidden rounded-lg border border-border bg-card",
          className
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                  User
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                  Business
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                  Contact
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                  Location
                </th>
                <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                  Role
                </th>
                <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-4">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                  Joined
                </th>
                <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user, index) => {
                const fullName =
                  [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                  "N/A";
                const businessName = user.businessName || "N/A";
                const location =
                  [user.businessCity, user.businessState, user.businessCountry]
                    .filter(Boolean)
                    .join(", ") || "N/A";

                return (
                  <tr
                    key={user.id}
                    className={cn(
                      "transition-colors hover:bg-table-hover",
                      index % 2 === 1 && "bg-table-zebra"
                    )}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {fullName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ID: {user.userId.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-foreground">
                          {businessName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        {user.businessEmail && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-foreground">
                              {user.businessEmail}
                            </span>
                          </div>
                        )}
                        {user.phone && (
                          <span className="text-xs text-muted-foreground">
                            {user.phone}
                          </span>
                        )}
                        {!user.businessEmail && !user.phone && (
                          <span className="text-xs text-muted-foreground">
                            N/A
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-foreground">
                          {location}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Badge
                        variant={
                          user.role === "admin" ? "default" : "secondary"
                        }
                        className={cn(
                          user.role === "admin" &&
                            "bg-primary text-primary-foreground"
                        )}
                      >
                        {user.role === "admin" ? "Admin" : "User"}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          getStatusColor(user.approvalStatus)
                        )}
                      >
                        {getStatusLabel(user.approvalStatus)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(user.createdAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {onReviewUser && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onReviewUser(user)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Review
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {users.map((user) => {
          const fullName =
            [user.firstName, user.lastName].filter(Boolean).join(" ") || "N/A";
          const businessName = user.businessName || "N/A";
          const location =
            [user.businessCity, user.businessState, user.businessCountry]
              .filter(Boolean)
              .join(", ") || "N/A";

          return (
            <div
              key={user.id}
              className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">
                      {fullName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ID: {user.userId.slice(0, 8)}...
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge
                    variant={user.role === "admin" ? "default" : "secondary"}
                    className={cn(
                      user.role === "admin" &&
                        "bg-primary text-primary-foreground"
                    )}
                  >
                    {user.role === "admin" ? "Admin" : "User"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      getStatusColor(user.approvalStatus)
                    )}
                  >
                    {getStatusLabel(user.approvalStatus)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground">{businessName}</span>
                </div>
                {user.businessEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-foreground">
                      {user.businessEmail}
                    </span>
                  </div>
                )}
                {user.phone && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{user.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground">{location}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(user.createdAt)}</span>
                </div>
              </div>
              {onReviewUser && (
                <div className="pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReviewUser(user)}
                    className="w-full gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Review Profile
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
