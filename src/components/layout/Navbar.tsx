'use client';

import { Menu, LogOut, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth/context";
import { useCompany } from "@/contexts/CompanyContext";
import { useNavigation } from "@/contexts/NavigationContext";
import { ROLE_LABELS } from "@/types/company";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavbarProps {
  onMenuClick: () => void;
  className?: string;
}

export function Navbar({ onMenuClick, className }: NavbarProps) {
  const { user, signOut } = useAuth();
  const { companyName, role } = useCompany();
  const { startNavigation } = useNavigation();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      toast.success(TOAST_MESSAGES.LOGOUT_SUCCESS);
      startNavigation();
      router.push("/login");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : TOAST_MESSAGES.LOGOUT_FAILED;
      toast.error(errorMessage);
      setIsLoggingOut(false);
    }
  };

  const getUserInitials = () => {
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "AD";
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full min-w-0 border-b border-border bg-card/80 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-6 min-w-0">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex flex-col min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">
              {companyName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4 lg:gap-6 shrink-0 pr-1">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarFallback className="bg-accent text-accent-foreground text-xs font-medium">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.email || "User"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {ROLE_LABELS[role]}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>Logging out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
