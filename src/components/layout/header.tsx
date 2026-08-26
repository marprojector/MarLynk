import { Suspense } from "react";
import Link from "next/link";

import { Button } from "~/components/ui/button";
import { Icons, iconVariants } from "~/components/ui/icons";
import { Loader } from "~/components/ui/loader";
import { Magnetic } from "~/components/motion/magnetic";
import { UserProfile } from "~/components/auth/user-profile";
import { ThemeToggle } from "~/components/theme-toggle";

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between p-4">
        <Magnetic strength={0.4}>
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm">
              <Icons.Link2 className={iconVariants({ size: "sm" })} />
            </span>
            <span className="text-lg font-semibold tracking-tight">MarLynk</span>
          </Link>
        </Magnetic>
        <div className="flex items-center gap-1 sm:gap-2">
          <Magnetic strength={0.5}>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground transition-colors hover:text-foreground"
              asChild
            >
              <Link
                href="https://github.com/marprojector/MarLynk"
                target="_blank"
              >
                <Icons.github className={iconVariants({ size: "lg" })} />
                <span className="sr-only">github repository</span>
              </Link>
            </Button>
          </Magnetic>
          <ThemeToggle />
          <Suspense fallback={<Loader size="xl" />}>
            <UserProfile />
          </Suspense>
        </div>
      </div>
    </header>
  );
};
