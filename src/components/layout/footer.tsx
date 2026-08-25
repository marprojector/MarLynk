import Link from "next/link";

import { Icons, iconVariants } from "~/components/ui/icons";

export const Footer = () => {
  return (
    <footer className="mx-auto mt-20 w-full max-w-5xl px-4 py-8">
      <div className="flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand text-brand-foreground">
            <Icons.Link2 className={iconVariants({ size: "xs" })} />
          </span>
          <span className="font-medium text-foreground">MarLynk</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
        <Link
          href="https://github.com/marprojector/MarLynk"
          target="_blank"
          className="flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          <Icons.github className={iconVariants({ size: "sm" })} />
          Source
        </Link>
      </div>
    </footer>
  );
};
