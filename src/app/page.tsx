import { Suspense } from "react";

import { Loader } from "~/components/ui/loader";
import { Stagger, StaggerItem } from "~/components/motion/reveal";
import { LinkForm } from "~/components/links/link-form";
import { LinkList } from "~/components/links/link-list";

export default function Home() {
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center py-10 sm:py-14 lg:py-16">
      {/* Subtle ambient light + fine grid, kept very quiet */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-20rem] h-[40rem] w-[80rem] -translate-x-1/2 rounded-full bg-brand/10 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,hsl(0_0%_50%)_1px,transparent_1px),linear-gradient(to_bottom,hsl(0_0%_50%)_1px,transparent_1px)] [background-size:64px_64px]" />
      </div>

      <Stagger className="w-full max-w-2xl text-center">
        <StaggerItem as="h1" className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Short links,{" "}
          <span className="text-brand">straight to the point.</span>
        </StaggerItem>
        <StaggerItem as="p" className="mx-auto mt-5 max-w-md text-balance text-base leading-relaxed text-muted-foreground">
          Paste a URL, get a clean MarLynk link — with an optional QR code — in
          one click.
        </StaggerItem>
      </Stagger>

      <div className="mt-12 w-full max-w-xl sm:mt-16">
        <LinkForm />
      </div>

      <div className="mt-14 w-full max-w-xl sm:mt-20">
        <Suspense fallback={<Loader size="4xl" className="my-20" />}>
          <LinkList />
        </Suspense>
      </div>
    </div>
  );
}
