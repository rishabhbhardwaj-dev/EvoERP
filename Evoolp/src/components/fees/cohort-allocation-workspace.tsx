"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  allocateFeesToCohort,
  getStudentFeeItemsForClass,
  type FormattedStudentFeeItem,
  type CohortAllocationResult,
} from "@/lib/actions/fees";
import { formatCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Zap,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Award,
  Filter,
  RefreshCw,
  Search,
} from "lucide-react";

export interface ClassOption {
  id: string;
  name: string;
  academicYear: string;
  sections: Array<{ id: string; name: string }>;
  enrolledCount?: number;
}

export interface FeeStructureOption {
  id: string;
  name: string;
  academicYear: string;
  classId: string;
  sectionId: string | null;
  status: string;
  items: Array<{
    id: string;
    amount: number;
    feeCategoryId: string;
    feeCategory: { name: string; code: string };
  }>;
}

export interface DiscountOption {
  id: string;
  name: string;
  code: string;
  type: string;
  value: number;
  isRteDefault: boolean;
  status: string;
}

interface CohortAllocationWorkspaceProps {
  classes: ClassOption[];
  structures: FeeStructureOption[];
  discounts: DiscountOption[];
  userRole: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
}

export function CohortAllocationWorkspace({
  classes,
  structures,
  discounts,
  userRole,
}: CohortAllocationWorkspaceProps) {
  const router = useRouter();
  const isAdmin = userRole === "ADMIN";

  const [activeTab, setActiveTab] = useState<"ALLOCATE" | "VIEW_ALLOCATIONS">(
    "ALLOCATE"
  );

  // Selector state for Allocation Form
  const initialClass = classes[0];
  const [selectedClassId, setSelectedClassId] = useState(initialClass?.id ?? "");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [academicYear, setAcademicYear] = useState(
    initialClass?.academicYear ?? "2025-2026"
  );
  const [selectedStructureId, setSelectedStructureId] = useState("");
  const [selectedDiscountId, setSelectedDiscountId] = useState("");

  // Confirmation Dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isAllocating, setIsAllocating] = useState(false);
  const [allocationSummary, setAllocationSummary] =
    useState<CohortAllocationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Allocated Fee Items View state
  const [viewClassId, setViewClassId] = useState(initialClass?.id ?? "");
  const [viewSectionId, setViewSectionId] = useState("");
  const [viewAcademicYear, setViewAcademicYear] = useState(
    initialClass?.academicYear ?? "2025-2026"
  );
  const [allocatedItems, setAllocatedItems] = useState<FormattedStudentFeeItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);

  // Available structures for selected class/year
  const availableStructures = structures.filter(
    (s) =>
      s.classId === selectedClassId &&
      s.academicYear === academicYear &&
      s.status === "ACTIVE"
  );

  const selectedStructure = structures.find((s) => s.id === selectedStructureId);
  const selectedClass = classes.find((c) => c.id === selectedClassId) ?? initialClass;
  const availableSections = selectedClass?.sections ?? [];

  // Update sections and academic year when class changes
  function handleClassChange(newClassId: string) {
    setSelectedClassId(newClassId);
    setSelectedSectionId("");
    const cls = classes.find((c) => c.id === newClassId);
    if (cls) {
      setAcademicYear(cls.academicYear);
    }
    setSelectedStructureId("");
  }

  // Load allocated student fee items for selected class/section/academicYear
  const fetchAllocatedItems = useCallback(async () => {
    if (!viewClassId || !viewAcademicYear) return;
    setIsLoadingItems(true);
    setViewError(null);

    try {
      const res = await getStudentFeeItemsForClass({
        classId: viewClassId,
        sectionId: viewSectionId || null,
        academicYear: viewAcademicYear,
      });

      if (!res.success) {
        setViewError(res.error ?? "Failed to fetch allocated fee items.");
        setAllocatedItems([]);
      } else {
        setAllocatedItems(res.data ?? []);
      }
    } catch (err) {
      console.error(err);
      setViewError("An unexpected error occurred.");
    } finally {
      setIsLoadingItems(false);
    }
  }, [viewClassId, viewSectionId, viewAcademicYear]);

  useEffect(() => {
    if (activeTab === "VIEW_ALLOCATIONS") {
      fetchAllocatedItems();
    }
  }, [activeTab, fetchAllocatedItems]);

  // Execute Cohort Allocation
  async function handleExecuteAllocation() {
    if (!selectedStructureId || !selectedClassId) return;
    setIsAllocating(true);
    setErrorMessage(null);

    try {
      const res = await allocateFeesToCohort({
        classId: selectedClassId,
        sectionId: selectedSectionId || null,
        academicYear,
        feeStructureId: selectedStructureId,
        discountId: selectedDiscountId || null,
      });

      if (!res.success) {
        setErrorMessage(res.error ?? "Allocation failed.");
        toast.error(res.error ?? "Allocation failed.");
        setIsAllocating(false);
        setConfirmOpen(false);
        return;
      }

      const summary = res.data;
      if (summary) {
        setAllocationSummary(summary);
        toast.success(
          `Fee allocation completed! ${summary.allocatedCount} item(s) assigned.`
        );
      }
      setConfirmOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      setErrorMessage("An unexpected error occurred during fee allocation.");
      toast.error("Allocation failed due to an unexpected error.");
    } finally {
      setIsAllocating(false);
    }
  }

  // Calculate gross structure sum per student
  const structureGrossSum = selectedStructure
    ? selectedStructure.items.reduce((acc, i) => acc + i.amount, 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* View Switcher Tabs */}
      <div className="flex border-b">
        <button
          type="button"
          onClick={() => setActiveTab("ALLOCATE")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "ALLOCATE"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Zap className="size-4" /> Allocate Fees to Cohort
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("VIEW_ALLOCATIONS")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "VIEW_ALLOCATIONS"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="size-4" /> View Allocated Student Fees
        </button>
      </div>

      {/* VIEW 1: ALLOCATE FEES TO COHORT */}
      {activeTab === "ALLOCATE" && (
        <div className="space-y-6">
          {/* Allocation Control Panel */}
          <div className="rounded-xl border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-base">Cohort Allocation Setup</h3>
                <p className="text-xs text-muted-foreground">
                  Select the target class, section, and fee structure to generate fee obligations.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Class Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="allocClass">Class</Label>
                <select
                  id="allocClass"
                  value={selectedClassId}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.academicYear})
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="allocSection">Section</Label>
                <select
                  id="allocSection"
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                >
                  <option value="">All Sections</option>
                  {availableSections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      Section {sec.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Academic Year */}
              <div className="space-y-1.5">
                <Label htmlFor="allocYear">Academic Year</Label>
                <Input
                  id="allocYear"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="YYYY-YYYY"
                />
              </div>

              {/* Fee Structure Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="allocStructure">Master Fee Structure</Label>
                <select
                  id="allocStructure"
                  value={selectedStructureId}
                  onChange={(e) => setSelectedStructureId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring font-medium"
                >
                  <option value="">Select Fee Structure</option>
                  {availableStructures.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.items.length} line items)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Optional Custom Discount */}
            <div className="pt-2 border-t grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="allocDiscount">Optional Custom Concession Policy</Label>
                <select
                  id="allocDiscount"
                  value={selectedDiscountId}
                  onChange={(e) => setSelectedDiscountId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                >
                  <option value="">Standard Fee (No Custom Concession)</option>
                  {discounts
                    .filter((d) => d.status === "ACTIVE")
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.type === "PERCENTAGE" ? `${d.value}%` : formatCurrency(d.value)})
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Note: RTE candidates automatically receive default 100% waiver regardless of custom discount.
                </p>
              </div>

              <div className="flex items-end justify-end">
                {isAdmin && (
                  <Button
                    onClick={() => setConfirmOpen(true)}
                    disabled={!selectedStructureId || !selectedClassId}
                    className="w-full sm:w-auto gap-2"
                  >
                    <Zap className="size-4" /> Review &amp; Execute Allocation
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Allocation Preview Card */}
          {selectedStructure && (
            <div className="rounded-xl border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                  Structure Line Items Breakdown
                </h4>
                <span className="text-xs font-semibold text-primary">
                  {selectedStructure.items.length} Category Items
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {selectedStructure.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border bg-muted/20 p-3 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-semibold text-sm">{item.feeCategory.name}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        {item.feeCategory.code}
                      </p>
                    </div>
                    <p className="font-bold text-base text-foreground">
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center rounded-lg bg-muted/40 p-3 border">
                <span className="text-xs font-semibold">Gross Payable Per Student</span>
                <span className="text-lg font-extrabold text-primary">
                  {formatCurrency(structureGrossSum)}
                </span>
              </div>
            </div>
          )}

          {/* Post Execution Result Summary Card */}
          {allocationSummary && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-xs space-y-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                <span>Cohort Fee Allocation Summary</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Enrolled Students</p>
                  <p className="text-lg font-bold">{allocationSummary.totalStudents}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Newly Allocated Items</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {allocationSummary.allocatedCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Skipped (Already Allocated)</p>
                  <p className="text-lg font-bold text-amber-600">
                    {allocationSummary.skippedCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Net Payable</p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(allocationSummary.netTotal)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: ALLOCATED STUDENT FEE ITEMS */}
      {activeTab === "VIEW_ALLOCATIONS" && (
        <div className="space-y-6">
          {/* View Filter Controls */}
          <div className="rounded-xl border bg-card p-4 shadow-xs flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Cohort Filter:
                </span>
              </div>

              <select
                value={viewClassId}
                onChange={(e) => {
                  setViewClassId(e.target.value);
                  setViewSectionId("");
                }}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.academicYear})
                  </option>
                ))}
              </select>

              <select
                value={viewSectionId}
                onChange={(e) => setViewSectionId(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
              >
                <option value="">All Sections</option>
                {(classes.find((c) => c.id === viewClassId)?.sections ?? []).map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    Section {sec.name}
                  </option>
                ))}
              </select>

              <Input
                className="h-8 w-28 text-xs font-medium"
                value={viewAcademicYear}
                onChange={(e) => setViewAcademicYear(e.target.value)}
                placeholder="YYYY-YYYY"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchAllocatedItems}
              disabled={isLoadingItems}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`size-3.5 ${isLoadingItems ? "animate-spin" : ""}`} />
              Refresh Roster
            </Button>
          </div>

          {/* Roster Table */}
          {isLoadingItems ? (
            <div className="rounded-xl border border-dashed py-16 text-center">
              <Loader2 className="size-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                Loading allocated fee records…
              </p>
            </div>
          ) : viewError ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center text-destructive">
              <AlertCircle className="size-8 mx-auto mb-2" />
              <p className="font-semibold">{viewError}</p>
            </div>
          ) : allocatedItems.length === 0 ? (
            <div className="rounded-xl border border-dashed py-16 text-center">
              <Search className="size-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-semibold text-muted-foreground">
                No fee allocations found for selected cohort
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Execute cohort allocation in the &quot;Allocate Fees to Cohort&quot; tab first.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Student</TableHead>
                    <TableHead>Admission No</TableHead>
                    <TableHead>Fee Category</TableHead>
                    <TableHead className="text-right">Gross Amount</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Net Payable</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocatedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>
                            {item.student.firstName} {item.student.lastName}
                          </span>
                          {item.student.rteCandidate && (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                              <Award className="size-3" /> RTE
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {item.student.admissionNumber}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold">
                          {item.feeCategory.code}
                        </span>{" "}
                        <span className="text-xs text-muted-foreground">
                          ({item.feeCategory.name})
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {formatCurrency(item.grossAmount)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-emerald-600 font-medium">
                        {item.discountAmount > 0 ? (
                          `-${formatCurrency(item.discountAmount)}`
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm text-primary">
                        {formatCurrency(item.netAmount)}
                      </TableCell>
                      <TableCell>
                        {item.status === "ASSIGNED" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            Assigned
                          </span>
                        )}
                        {item.status === "WAIVED" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                            Waived (100%)
                          </span>
                        )}
                        {item.status === "CANCELLED" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            Cancelled
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog before Allocation Execution */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Cohort Fee Allocation</DialogTitle>
            <DialogDescription>
              You are about to allocate master fee structure items to enrolled students.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 border-y my-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target Class:</span>
              <span className="font-semibold">{selectedClass?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target Section:</span>
              <span className="font-semibold">
                {selectedSectionId
                  ? `Section ${availableSections.find((s) => s.id === selectedSectionId)?.name}`
                  : "All Sections"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Academic Year:</span>
              <span className="font-semibold">{academicYear}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Master Structure:</span>
              <span className="font-semibold">{selectedStructure?.name}</span>
            </div>
            <div className="flex justify-between pt-2 border-t font-sm">
              <span className="font-semibold text-foreground">Gross Fee Per Student:</span>
              <span className="font-extrabold text-primary text-sm">
                {formatCurrency(structureGrossSum)}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isAllocating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleExecuteAllocation}
              disabled={isAllocating}
              className="gap-2"
            >
              {isAllocating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Allocating Fees…
                </>
              ) : (
                "Confirm & Execute Allocation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
