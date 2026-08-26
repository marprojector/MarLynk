import { cookies } from "next/headers";
import { getLinkBySlug, getLinksByUserLinkId } from "~/server/api/link";
import { getUserLinkByUserId } from "~/server/api/user-link";
import { getServerAuthSession } from "~/server/auth";
import { type ShortLink } from "~/server/db/schema";
import { type Session } from "next-auth";

import { SigninDialog } from "~/components/auth/signin-dialog";
import { ScrollReveal } from "~/components/motion/scroll-reveal";
import { LinkCard } from "~/components/links/link-card";
import { Card, CardContent } from "~/components/ui/card";
import { Icons, iconVariants } from "~/components/ui/icons";

const fetchLinksBySessionOrCookie = async (
  session: Session | null,
): Promise<ShortLink[]> => {
  const cookieStore = cookies();

  if (session) {
    const userLink = await getUserLinkByUserId(session.user.id);
    return userLink?.links ?? [];
  } else {
    const userLinkIdCookie = cookieStore.get("user-link-id")?.value;
    if (!userLinkIdCookie) {
      return [];
    }

    return await getLinksByUserLinkId(userLinkIdCookie);
  }
};

export const LinkList = async () => {
  const session = await getServerAuthSession();
  let shortLinks: ShortLink[] = [];
  let defaultAppLink: ShortLink | undefined;

  if (!session) {
    defaultAppLink = await getLinkBySlug("github");
  }

  try {
    shortLinks = await fetchLinksBySessionOrCookie(session);
  } catch (err) {
    throw new Error("Failed to fetch links");
  }

  const hasLinks = Boolean(defaultAppLink) || shortLinks.length > 0;

  return (
    <>
      <ScrollReveal className="flex w-full flex-col gap-2">
        {defaultAppLink && <LinkCard link={defaultAppLink} />}
        {shortLinks.map((link) => (
          <LinkCard key={link.slug} link={link} session={session} />
        ))}
        {!hasLinks && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
              <div className="rounded-full bg-muted p-3 text-muted-foreground">
                <Icons.Link className={iconVariants({ size: "lg" })} />
              </div>
              <p className="font-medium">No links yet</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Paste a URL above to create your first short link. It will
                show up here instantly.
              </p>
            </CardContent>
          </Card>
        )}
      </ScrollReveal>
      {!session && shortLinks.length > 0 && (
        <div className="text-xs text-muted-foreground px-4">
          Maximize your link's lifespan beyond 24 hours by{" "}
          <SigninDialog>
            <span className="underline cursor-pointer underline-offset-4 text-foreground">
              signing in
            </span>
          </SigninDialog>{" "}
          and accessing exclusive editing features!
        </div>
      )}
    </>
  );
};
