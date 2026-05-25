"use client";

import Link from "next/link";
import { ArrowLeft, BadgeCheck, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const TRUST_POINTS = [
  "Company-level workspace with isolated access",
  "Structured setup for regional settings and inventory operations",
  "Email verification before dashboard access",
];

interface SignupSplitLayoutProps {
  children: React.ReactNode;
  rightPaneClassName?: string;
}

export function SignupSplitLayout({ children, rightPaneClassName }: SignupSplitLayoutProps) {
  return (
    <div className="grid h-dvh grid-cols-1 overflow-hidden bg-background lg:grid-cols-[minmax(20rem,0.88fr)_minmax(36rem,1.12fr)] xl:grid-cols-[minmax(22rem,0.84fr)_minmax(40rem,1.16fr)]">
      <aside className="relative hidden overflow-hidden border-r border-border/60 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.22),transparent_34%),linear-gradient(155deg,hsl(var(--background)),hsl(var(--muted))_58%,hsl(var(--background)))] dark:bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.28),transparent_34%),linear-gradient(155deg,hsl(224_30%_13%),hsl(240_16%_9%)_60%,hsl(240_18%_8%))]" />
        <div className="absolute inset-y-10 right-[-10%] w-2/3 rounded-full bg-primary/10 blur-3xl dark:bg-primary/15" />
        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to website
          </Link>

          <div className="max-w-lg space-y-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
                <Package className="h-3.5 w-3.5 text-primary" />
                DeviceDock onboarding
              </div>
              <div className="space-y-3">
                <h2 className="max-w-lg text-4xl font-semibold tracking-tight text-foreground xl:text-5xl">
                  Set up your company workspace with the right defaults.
                </h2>
                <p className="max-w-xl text-base leading-7 text-muted-foreground">
                  Create the admin account, define company details, and review your setup before
                  access is activated.
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">What you can expect</p>
            <div className="mt-4 space-y-3">
              {TRUST_POINTS.map((point) => (
                <div key={point} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <section className={cn("min-h-0 overflow-y-auto", rightPaneClassName)}>
        <div className="mx-auto flex min-h-full w-full max-w-5xl items-start justify-center px-4 py-6 sm:px-6 lg:px-8 lg:py-10 xl:px-10">
          <div className="w-full max-w-3xl space-y-5">{children}</div>
        </div>
      </section>
    </div>
  );
}
