"use client";

import { useNavigation } from "@/contexts/NavigationContext";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef } from "react";

interface NavLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  activeClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ className, activeClassName, href, onClick, ...props }, ref) => {
    const pathname = usePathname();
    const { startNavigation } = useNavigation();
    const isActive = pathname === href || pathname?.startsWith(href + "/");

    return (
      <Link
        ref={ref}
        href={href}
        className={cn(className, isActive && activeClassName)}
        onClick={(e) => {
          if (isActive) {
            e.preventDefault();
            return;
          }

          startNavigation();
          onClick?.(e);
        }}
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
