"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Search, ShieldCheck } from "lucide-react";
import { Loader } from "@/components/common/Loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AuditLog {
  action: string;
  actor_email: string | null;
  actor_user_id: string;
  company_id: string | null;
  created_at: string;
  id: string;
  ip_address: string | null;
  metadata_json: Record<string, boolean | number | string | null>;
  resource_id: string;
  resource_type: string;
  user_agent: string | null;
}

interface AuditLogResponse {
  logs: AuditLog[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface CompaniesResponse {
  companies: Array<{ id: string; name: string }>;
}

const ACTION_OPTIONS = [
  { label: "All actions", value: "all" },
  { label: "Company status updated", value: "company.status_updated" },
  { label: "Company deleted", value: "company.deleted" },
  { label: "Member role changed", value: "member.role_changed" },
  { label: "Member suspended", value: "member.suspended" },
  { label: "Member reactivated", value: "member.reactivated" },
  { label: "Member removed", value: "member.removed" },
  { label: "Invitation sent", value: "invitation.sent" },
  { label: "Invitation cancelled", value: "invitation.cancelled" },
];

const RESOURCE_TYPE_OPTIONS = [
  { label: "All resources", value: "all" },
  { label: "Company", value: "company" },
  { label: "Member", value: "member" },
  { label: "Invitation", value: "invitation" },
];

export default function SuperAdminAuditLogs() {
  const [actionFilter, setActionFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [toDate, setToDate] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadCompanies = useCallback(async () => {
    try {
      const response = await fetch("/api/superadmin/companies");
      if (!response.ok) {
        throw new Error("Failed to load companies");
      }
      const data = (await response.json()) as CompaniesResponse;
      const companyOptions = (data.companies ?? []).map((company) => ({
        id: company.id,
        name: company.name,
      }));
      setCompanies(companyOptions);
    } catch {
      toast.error("Failed to load company filter options.");
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (query.trim()) {
        params.set("q", query.trim());
      }
      if (actionFilter !== "all") {
        params.set("action", actionFilter);
      }
      if (resourceTypeFilter !== "all") {
        params.set("resourceType", resourceTypeFilter);
      }
      if (companyFilter !== "all") {
        params.set("companyId", companyFilter);
      }
      if (fromDate) {
        params.set("from", fromDate);
      }
      if (toDate) {
        params.set("to", toDate);
      }

      const response = await fetch(`/api/superadmin/audit-logs?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to load audit logs");
      }
      const data = (await response.json()) as AuditLogResponse;
      setLogs(data.logs ?? []);
      setTotalCount(data.totalCount ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      toast.error("Failed to load audit logs.");
    } finally {
      setIsLoading(false);
    }
  }, [actionFilter, companyFilter, fromDate, page, query, resourceTypeFilter, toDate]);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    setPage(1);
  }, [actionFilter, companyFilter, fromDate, query, resourceTypeFilter, toDate]);

  const companyNameMap = useMemo(() => {
    return companies.reduce<Record<string, string>>((accumulator, company) => {
      accumulator[company.id] = company.name;
      return accumulator;
    }, {});
  }, [companies]);

  if (isLoading && logs.length === 0) {
    return <Loader size="lg" text="Loading audit logs..." />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 -mx-4 mb-4 space-y-4 border-b border-border bg-background px-4 pb-4 pt-4 lg:-mx-6 lg:px-6 lg:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
              <ShieldCheck className="h-6 w-6" />
              Audit Logs
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalCount} {totalCount === 1 ? "event" : "events"} recorded
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search actor, action, resource..."
              value={query}
            />
          </div>

          <Select onValueChange={setActionFilter} value={actionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={setResourceTypeFilter} value={resourceTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Resource type" />
            </SelectTrigger>
            <SelectContent>
              {RESOURCE_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={setCompanyFilter} value={companyFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All companies</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            onChange={(event) => setFromDate(event.target.value)}
            type="date"
            value={fromDate}
          />
          <Input
            onChange={(event) => setToDate(event.target.value)}
            type="date"
            value={toDate}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto -mx-4 px-4 lg:-mx-6 lg:px-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader size="md" text="Refreshing logs..." />
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No logs found for current filters.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Resource</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 text-right font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[220px] truncate text-foreground">
                        {log.actor_email ?? log.actor_user_id}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className="font-mono text-[11px]" variant="outline">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="font-medium text-foreground">{log.resource_type}</span>
                      <span className="mx-1">·</span>
                      <span className="font-mono text-xs">{log.resource_id}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {log.company_id ? companyNameMap[log.company_id] ?? log.company_id : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button onClick={() => setSelectedLog(log)} size="sm" variant="outline">
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex items-center justify-between border-t border-border bg-background px-4 py-3 lg:-mx-6 lg:px-6">
        <p className="text-xs text-muted-foreground">
          Page {page} of {Math.max(1, totalPages)}
        </p>
        <div className="flex items-center gap-2">
          <Button
            disabled={page <= 1}
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            size="sm"
            variant="outline"
          >
            Previous
          </Button>
          <Button
            disabled={page >= totalPages}
            onClick={() =>
              setPage((currentPage) => Math.min(totalPages, currentPage + 1))
            }
            size="sm"
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog onOpenChange={(open) => !open && setSelectedLog(null)} open={!!selectedLog}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Audit Event Details
            </DialogTitle>
            <DialogDescription>
              Full event payload captured for this action.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Action</p>
                  <p className="font-mono text-foreground">{selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Time</p>
                  <p className="text-foreground">
                    {new Date(selectedLog.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Actor</p>
                  <p className="text-foreground">
                    {selectedLog.actor_email ?? selectedLog.actor_user_id}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">IP</p>
                  <p className={cn("text-foreground", !selectedLog.ip_address && "text-muted-foreground")}>
                    {selectedLog.ip_address ?? "—"}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Metadata
                </p>
                <pre className="overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground">
                  {JSON.stringify(selectedLog.metadata_json ?? {}, null, 2)}
                </pre>
              </div>

              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  User agent
                </p>
                <p className="break-all rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                  {selectedLog.user_agent ?? "—"}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
