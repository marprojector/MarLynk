"use client";

import React, { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createShortLink } from "~/server/actions/link";
import { useAction } from "next-safe-action/hooks";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { getBaseUrl, setFormErrors } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
} from "~/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "~/components/ui/form";
import { Icons, iconVariants } from "~/components/ui/icons";
import { Input } from "~/components/ui/input";
import { LinkCopyButton } from "~/components/links/link-copy-button";
import { LinkQRCodeDialog } from "~/components/links/link-qrcode-dialog";

const formSchema = z.object({
  url: z.string().url(),
});

type FormSchema = z.infer<typeof formSchema>;

type LinkFormProps = {
  renderCustomLink: React.ReactNode;
};

type CreatedLink = { slug: string; url: string };

export const LinkForm = ({ renderCustomLink }: LinkFormProps) => {
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
    },
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

  const onSubmit = (values: FormSchema) => {
    createLink({ url: values.url, slug: "" });
  };

  const shortenedURL = created ? `${getBaseUrl()}/${created.slug}` : "";

  if (created) {
    return (
      <div className="flex flex-col gap-3">
        <Card className="border-brand/30 shadow-brand">
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-brand">
              <Icons.Check className={iconVariants({ size: "sm" })} />
              Your link is ready
            </div>
            <div className="flex items-center gap-2">
              <a
                href={shortenedURL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-sm font-medium"
              >
                {shortenedURL.split("://")[1]}
              </a>
              <LinkCopyButton textToCopy={shortenedURL} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setIsQrOpen(true)}
              >
                <Icons.QrCode className={iconVariants({ size: "sm" })} />
                QR Code
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => setCreated(null)}
              >
                <Icons.Plus className={iconVariants({ size: "sm" })} />
                Create another
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-center">{renderCustomLink}</div>
        <LinkQRCodeDialog
          isOpen={isQrOpen}
          onOpenChange={setIsQrOpen}
          slug={created.slug}
          url={shortenedURL}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <div className="flex-1">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      aria-label="URL to shorten"
                      placeholder="Paste a long URL to shorten…"
                      className="h-12 text-base shadow-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button
            type="submit"
            size="lg"
            isLoading={createLinkStatus === "executing"}
            className="gap-2 shadow-brand"
          >
            <Icons.Scissors className={iconVariants({ size: "lg" })} />
            Shorten
          </Button>
        </form>
      </Form>
      <div className="flex justify-center">{renderCustomLink}</div>
    </div>
  );
};
