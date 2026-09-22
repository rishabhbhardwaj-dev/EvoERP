"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  userName: string;
  userEmail: string;
  roleLabel: string;
  schoolName: string;
}

export function Header({ userName, userEmail, roleLabel, schoolName }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div>
        <p className="text-sm font-medium">{schoolName}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium">{userName}</p>
          <p className="text-xs text-muted-foreground">
            {roleLabel} · {userEmail}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
