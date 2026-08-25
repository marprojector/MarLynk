"use client";

import * as React from "react";
import { toast } from "sonner";

import { Icons, iconVariants } from "~/components/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

type LinkCopyButtonProps = {
  textToCopy: string;
};

export const LinkCopyButton = ({ textToCopy }: LinkCopyButtonProps) => {
  const [copied, setCopied] = React.useState(false);

  const handleOnCopy = async () => {
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast("Copied to clipboard");
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Copy to clipboard"
          type="button"
          onClick={handleOnCopy}
        >
          {copied ? (
            <Icons.Check
              className={iconVariants({ size: "sm", className: "text-brand" })}
            />
          ) : (
            <Icons.Copy className={iconVariants({ size: "sm" })} />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-sans">
          {copied ? "Copied!" : "Copy link to clipboard"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
};
