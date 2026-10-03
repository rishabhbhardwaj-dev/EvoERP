"use client";

import { useState } from "react";
import { FeeCategoryList, type FeeCategoryItem } from "./fee-category-list";
import { FeeStructureList, type FeeStructureItem, type ClassOption } from "./fee-structure-list";
import { FeeDiscountList, type FeeDiscountItem } from "./fee-discount-list";
import { CohortAllocationWorkspace } from "./cohort-allocation-workspace";
import { Zap, Layers, Tag, Percent } from "lucide-react";

export interface FeeWorkspaceProps {
  userRole: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
  classes: ClassOption[];
  categories: FeeCategoryItem[];
  structures: FeeStructureItem[];
  discounts: FeeDiscountItem[];
}

export function FeeWorkspace({
  userRole,
  classes,
  categories,
  structures,
  discounts,
}: FeeWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<
    "ALLOCATION" | "STRUCTURES" | "CATEGORIES" | "DISCOUNTS"
  >("ALLOCATION");

  const tabs = [
    {
      id: "ALLOCATION" as const,
      label: "Allocation Workspace",
      icon: Zap,
      count: null,
    },
    {
      id: "STRUCTURES" as const,
      label: "Fee Structures",
      icon: Layers,
      count: structures.length,
    },
    {
      id: "CATEGORIES" as const,
      label: "Fee Categories",
      icon: Tag,
      count: categories.length,
    },
    {
      id: "DISCOUNTS" as const,
      label: "Discounts & Concessions",
      icon: Percent,
      count: discounts.length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Workspace Tab Bar */}
      <div className="flex border-b overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content Panes */}
      {activeTab === "ALLOCATION" && (
        <CohortAllocationWorkspace
          classes={classes}
          structures={structures}
          discounts={discounts}
          userRole={userRole}
        />
      )}

      {activeTab === "STRUCTURES" && (
        <FeeStructureList
          structures={structures}
          classes={classes}
          categories={categories}
          userRole={userRole}
        />
      )}

      {activeTab === "CATEGORIES" && (
        <FeeCategoryList categories={categories} userRole={userRole} />
      )}

      {activeTab === "DISCOUNTS" && (
        <FeeDiscountList discounts={discounts} userRole={userRole} />
      )}
    </div>
  );
}
