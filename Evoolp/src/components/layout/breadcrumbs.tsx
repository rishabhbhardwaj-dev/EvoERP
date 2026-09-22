"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <Breadcrumb className="px-6 py-3">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/dashboard">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {segments.slice(1).map((segment, index, arr) => {
          const href = `/dashboard/${segments.slice(1, index + 2).join("/")}`;
          const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
          const isLast = index === arr.length - 1;
          return (
            <BreadcrumbItem key={href}>
              <BreadcrumbSeparator />
              {isLast ? (
                <BreadcrumbPage>{label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={href}>{label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
