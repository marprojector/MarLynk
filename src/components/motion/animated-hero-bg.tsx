"use client";

export function AnimatedHeroBg() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-hidden"
    >
      <div className="absolute inset-0 bg-[#050507]" />
      <div className="absolute left-1/2 top-1/2 h-[150vh] w-[200vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_var(--brand)_0%,_transparent_70%)] opacity-10 blur-[200px]" />
    </div>
  );
}
