"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader } from "@/components/common/Loader";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  userCount: number;
  ownerEmail: string | null;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs",
        status === "active" && "border-success text-success",
        status === "suspended" && "border-warning text-warning",
        status === "inactive" && "border-muted-foreground text-muted-foreground"
      )}
    >
      {status}
    </Badge>
  );
}

export default function SuperAdminCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const loadCompanies = useCallback(async () => {
    try {
      const res = await fetch("/api/superadmin/companies");
      const json = await res.json() as { companies: Company[] };
      setCompanies(json.companies ?? []);
    } catch {
      toast.error("Failed to load companies");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const handleToggleStatus = async (company: Company) => {
    const newStatus = company.status === "active" ? "suspended" : "active";
    setUpdatingId(company.id);
    try {
      const res = await fetch(`/api/superadmin/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setCompanies((prev) =>
        prev.map((c) => (c.id === company.id ? { ...c, status: newStatus } : c))
      );
      toast.success(`${company.name} ${newStatus === "active" ? "activated" : "suspended"}`);
    } catch {
      toast.error("Failed to update company status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCompany) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/superadmin/companies/${deletingCompany.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete company");
      setCompanies((prev) => prev.filter((c) => c.id !== deletingCompany.id));
      toast.success(`"${deletingCompany.name}" and all its data have been deleted.`);
    } catch {
      toast.error("Failed to delete company. Please try again.");
    } finally {
      setIsDeleting(false);
      setDeletingCompany(null);
    }
  };

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase()) ||
      (c.ownerEmail ?? "").toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <Loader size="lg" text="Loading companies..." />;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background pb-3 space-y-3 border-b border-border mb-3 -mx-4 lg:-mx-6 px-4 lg:px-6 pt-3 lg:pt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Companies
            <span className="text-muted-foreground font-normal text-sm ml-2">
              {companies.length} total
            </span>
          </h2>
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, slug, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-4 lg:-mx-6 px-4 lg:px-6">
        {filtered.length === 0 ? (
          <EmptyState
            title="No companies found"
            description={search ? "Try a different search term." : "No companies registered yet."}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="text-left py-3 px-2 font-medium">Company</th>
                    <th className="text-left py-3 px-2 font-medium">Slug</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                    <th className="text-left py-3 px-2 font-medium">Owner</th>
                    <th className="text-right py-3 px-2 font-medium">Users</th>
                    <th className="text-right py-3 px-2 font-medium">Joined</th>
                    <th className="text-right py-3 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((company) => (
                    <tr
                      key={company.id}
                      className="hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => router.push(`/superadmin/companies/${company.id}`)}
                    >
                      <td className="py-3 px-2 font-medium text-foreground">
                        {company.name}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground font-mono text-xs">
                        {company.slug}
                      </td>
                      <td className="py-3 px-2">
                        <StatusBadge status={company.status} />
                      </td>
                      <td className="py-3 px-2 text-muted-foreground text-xs">
                        {company.ownerEmail ?? "—"}
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground">
                        {company.userCount}
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground text-xs">
                        {new Date(company.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updatingId === company.id}
                            onClick={() => handleToggleStatus(company)}
                            className={cn(
                              "h-7 text-xs",
                              company.status === "active"
                                ? "text-warning hover:text-warning"
                                : "text-success hover:text-success"
                            )}
                          >
                            {company.status === "active" ? "Suspend" : "Activate"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingCompany(company)}
                            className="h-7 text-xs text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3 py-2">
              {filtered.map((company) => (
                <div
                  key={company.id}
                  className="p-4 bg-card rounded-lg border border-border cursor-pointer"
                  onClick={() => router.push(`/superadmin/companies/${company.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{company.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{company.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={company.status} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{company.ownerEmail ?? "No owner"}</span>
                    <span>{company.userCount} users</span>
                  </div>
                  <div
                    className="mt-3 flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={updatingId === company.id}
                      onClick={() => handleToggleStatus(company)}
                      className={cn(
                        "h-7 text-xs flex-1",
                        company.status === "active"
                          ? "text-warning hover:text-warning"
                          : "text-success hover:text-success"
                      )}
                    >
                      {company.status === "active" ? "Suspend" : "Activate"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingCompany(company)}
                      className="h-7 text-xs text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <AlertDialog
        open={!!deletingCompany}
        onOpenChange={(open) => { if (!open && !isDeleting) setDeletingCompany(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete company?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">
                {deletingCompany?.name}
              </span>{" "}
              and all associated data — users, inventory, orders, and
              invitations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete company"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
