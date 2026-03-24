"use client";

import { useRouter } from "next/navigation";
import { Menu, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useAuth } from "@/lib/auth/context";
import { toast } from "sonner";

interface SuperAdminNavbarProps {
  onMenuClick: () => void;
}

export function SuperAdminNavbar({ onMenuClick }: SuperAdminNavbarProps) {
  const { signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push("/superadmin/login");
  };

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-card flex-shrink-0">
      {/* Left — mobile menu + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-destructive" />
          <span className="text-sm font-semibold text-foreground">
            Platform Admin
          </span>
        </div>
      </div>

      {/* Right — theme toggle + logout */}
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
