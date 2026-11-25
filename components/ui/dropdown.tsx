"use client";

import * as React from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const Menu = Dropdown.Root;
export const MenuTrigger = Dropdown.Trigger;

export function MenuContent({ className, ...props }: React.ComponentProps<typeof Dropdown.Content>) {
  return (
    <Dropdown.Portal>
      <Dropdown.Content
        align="end"
        sideOffset={8}
        className={cn(
          "z-50 min-w-52 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg",
          className,
        )}
        {...props}
      />
    </Dropdown.Portal>
  );
}

export function MenuItem({ className, ...props }: React.ComponentProps<typeof Dropdown.Item>) {
  return (
    <Dropdown.Item
      className={cn(
        "cursor-pointer rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-accent",
        className,
      )}
      {...props}
    />
  );
}
