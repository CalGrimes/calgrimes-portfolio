"use client";

import { motion } from "framer-motion";
import { FilePlus2, LogOut, Receipt } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import * as React from "react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/invoices/new", label: "New invoice", icon: FilePlus2 },
];

export function AdminHotbarClient() {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
      className="fixed bottom-6 left-6 z-50"
      onHoverStart={() => setExpanded(true)}
      onHoverEnd={() => setExpanded(false)}
    >
      <div
        className={cn(
          "flex items-center gap-1 rounded-full border border-border/60 bg-background/80 p-1.5",
          "shadow-lg shadow-black/5 backdrop-blur-md",
          "supports-[backdrop-filter]:bg-background/60"
        )}
      >
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={cn(
              "group flex h-9 items-center gap-2 rounded-full px-2.5",
              "text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <motion.span
              initial={false}
              animate={{
                width: expanded ? "auto" : 0,
                opacity: expanded ? 1 : 0,
              }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden whitespace-nowrap text-xs font-medium"
            >
              {label}
            </motion.span>
          </Link>
        ))}

        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />

        <button
          type="button"
          aria-label="Sign out"
          onClick={() => void signOut({ callbackUrl: "/admin/login" })}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
