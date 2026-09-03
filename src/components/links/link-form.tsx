"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAction } from "next-safe-action/hooks";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { getBaseUrl, setFormErrors } from "~/lib/utils";
import { createShortLink } from "~/server/actions/link";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { LinkCopyButton } from "~/components/links/link-copy-button";
import { LinkQRCodeDialog } from "~/components/links/link-qrcode-dialog";

const formSchema = z.object({
  url: z.string().url("Enter a valid URL, including the protocol"),
});

type CreatedLink = { slug: string; url: string };

export const LinkForm = () => {
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);

  const form = useForm<{ url: string }>({
    resolver: zodResolver(formSchema),
    defaultValues: { url: "" },
  });

  const { execute: createLink, status: createLinkStatus } = useAction(
    createShortLink,
    {
      onSuccess() {
        toast.success("Link created successfully");
        form.reset();
      },
      onError(error) {
        if (error.validationErrors) {
          return setFormErrors(form, error.validationErrors);
        }
        toast.error(error.serverError ?? error.fetchError);
      },
    },
  );

  const shortenedURL = created ? `${getBaseUrl()}/${created.slug}` : "";

  const onSubmit = (values: { url: string }) => {
    createLink({ url: values.url, slug: "" });
  };

  return (
    <div>
      {created ? (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
          <a
            href={shortenedURL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 truncate font-mono font-medium"
          >
            {shortenedURL.split("://")[1]}
          </a>
          <LinkCopyButton textToCopy={shortenedURL} />
          <Button variant="ghost" size="sm" onClick={() => setCreated(null)}>
            Dismiss
        </Button>
        </div>
      ) : null}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input
                    aria-label="URL to shorten"
                    placeholder="Paste a long URL to shorten…"
                    className="h-12 text-base"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            size="lg"
            isLoading={createLinkStatus === "executing"}
          >
            Shorten
          </Button>
        </form>
      </Form>
      {created ? (
        <LinkQRCodeDialog
          isOpen={isQrOpen}
          onOpenChange={setIsQrOpen}
          slug={created.slug}
          url={shortenedURL}
        />
      ) : null}
    </div>
  );
};
