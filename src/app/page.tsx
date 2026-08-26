import { Suspense } from "react";

import { Loader } from "~/components/ui/loader";
import { AnimatedHeroBg } from "~/components/motion/animated-hero-bg";
import { Stagger, StaggerItem } from "~/components/motion/reveal";
import { CustomLink } from "~/components/links/custom-link";
import { LinkForm } from "~/components/links/link-form";
import { LinkList } from "~/components/links/link-list";

export default function Home() {
  return (
    <>
      <AnimatedHeroBg />
      <div className="relative flex flex-col items-center px-4">
      <Stagger className="my-16 w-full max-w-2xl text-center sm:my-24">
        <StaggerItem as="span" className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          URL shortener &amp; QR generator
        </StaggerItem>
        <StaggerItem as="h1" className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Short links,{" "}
          <span className="text-brand">smarter sharing.</span>
        </StaggerItem>
        <StaggerItem as="p" className="mx-auto mt-4 max-w-md text-balance text-base text-muted-foreground sm:text-lg">
          Paste any URL and get a clean MarLynk link with a scannable QR
          code — in a single click.
        </StaggerItem>
      </Stagger>

      <div className="w-full max-w-xl">
        <LinkForm
          renderCustomLink={
            <Suspense fallback={<Loader size="xl" />}>
              <CustomLink />
            </Suspense>
          }
        />
      </div>

      <div className="mt-10 w-full max-w-xl">
        <Suspense fallback={<Loader size="4xl" className="my-20" />}>
          <LinkList />
        </Suspense>
      </div>
      </div>
    </>
  );
}
