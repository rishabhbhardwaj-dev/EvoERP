"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createFeeStructure,
  updateFeeStructure,
  archiveFeeStructure,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Edit2,
  Archive,
  Loader2,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronRight,
  Trash2,
  Info,
  CheckCircle2,
} from "lucide-react";

export interface CategoryOption {
  id: string;
  name: string;
  code: string;
}

export interface ClassOption {
  id: string;
  name: string;
  academicYear: string;
  sections: Array<{ id: string; name: string }>;
  enrolledCount?: number;
}

export interface FeeStructureItemSummary {
  id: string;
  feeCategoryId: string;
  amount: number;
  frequency: "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONE_TIME" | string;
  dueMonth: number | null;
  feeCategory: {
    id: string;
    name: string;
    code: string;
  };
}

export interface FeeStructureItem {
  id: string;
  name: string;
  academicYear: string;
  status: string;
  notes: string | null;
  classId: string;
  sectionId: string | null;
  class: { id: string; name: string };
  section: { id: string; name: string } | null;
  items: FeeStructureItemSummary[];
  createdAt: Date;
}

interface FeeStructureListProps {
  structures: FeeStructureItem[];
  classes: ClassOption[];
  categories: CategoryOption[];
  userRole: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
}

interface LineItemInput {
  feeCategoryId: string;
  amount: string;
  frequency: "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONE_TIME";
  dueMonth: string;
}

export function FeeStructureList({
  structures,
  classes,
  categories,
  userRole,
}: FeeStructureListProps) {
  const router = useRouter();
  const isAdmin = userRole === "ADMIN";

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create Dialog State
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createAcademicYear, setCreateAcademicYear] = useState("2025-2026");
  const [createClassId, setCreateClassId] = useState(classes[0]?.id ?? "");
  const [createSectionId, setCreateSectionId] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createLineItems, setCreateLineItems] = useState<LineItemInput[]>([
    {
      feeCategoryId: categories[0]?.id ?? "",
      amount: "5000",
      frequency: "MONTHLY",
      dueMonth: "4",
    },
  ]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Edit Dialog State
  const [editStructure, setEditStructure] = useState<FeeStructureItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLineItems, setEditLineItems] = useState<LineItemInput[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Archive Dialog State
  const [archiveStructure, setArchiveStructure] = useState<FeeStructureItem | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Line item helpers for Create Form
  function addCreateLineItem() {
    setCreateLineItems((prev) => [
      ...prev,
      {
        feeCategoryId: categories[0]?.id ?? "",
        amount: "1000",
        frequency: "MONTHLY",
        dueMonth: "",
      },
    ]);
  }

  function removeCreateLineItem(index: number) {
    setCreateLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCreateLineItem(
    index: number,
    field: keyof LineItemInput,
    value: string
  ) {
    setCreateLineItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  // Line item helpers for Edit Form
  function addEditLineItem() {
    setEditLineItems((prev) => [
      ...prev,
      {
        feeCategoryId: categories[0]?.id ?? "",
        amount: "1000",
        frequency: "MONTHLY",
        dueMonth: "",
      },
    ]);
  }

  function removeEditLineItem(index: number) {
    setEditLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateEditLineItem(
    index: number,
    field: keyof LineItemInput,
    value: string
  ) {
    setEditLineItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    if (createLineItems.length === 0) {
      setCreateError("At least one fee line item is required.");
      return;
    }

    // Check duplicate categories
    const catIds = createLineItems.map((i) => i.feeCategoryId);
    if (new Set(catIds).size !== catIds.length) {
      setCreateError("Duplicate fee categories are not allowed in the same structure.");
      return;
    }

    setIsCreating(true);

    try {
      const itemsPayload = createLineItems.map((item) => ({
        feeCategoryId: item.feeCategoryId,
        amount: parseFloat(item.amount) || 0,
        frequency: item.frequency,
        dueMonth: item.dueMonth ? parseInt(item.dueMonth, 10) : null,
      }));

      const res = await createFeeStructure({
        classId: createClassId,
        sectionId: createSectionId || null,
        academicYear: createAcademicYear,
        name: createName,
        notes: createNotes || null,
        items: itemsPayload,
      });

      if (!res.success) {
        setCreateError(res.error ?? "Failed to create fee structure.");
        return;
      }

      toast.success(`Fee structure "${createName}" created successfully!`);
      setCreateName("");
      setCreateNotes("");
      setCreateOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      setCreateError("An unexpected error occurred.");
    } finally {
      setIsCreating(false);
    }
  }

  function openEditModal(st: FeeStructureItem) {
    setEditStructure(st);
    setEditName(st.name);
    setEditNotes(st.notes ?? "");
    setEditLineItems(
      st.items.map((i) => ({
        feeCategoryId: i.feeCategoryId,
        amount: String(i.amount),
        frequency: (i.frequency as "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONE_TIME") ?? "MONTHLY",
        dueMonth: i.dueMonth ? String(i.dueMonth) : "",
      }))
    );
    setEditError(null);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editStructure) return;
    setEditError(null);

    if (editLineItems.length === 0) {
      setEditError("At least one fee line item is required.");
      return;
    }

    const catIds = editLineItems.map((i) => i.feeCategoryId);
    if (new Set(catIds).size !== catIds.length) {
      setEditError("Duplicate fee categories are not allowed in the same structure.");
      return;
    }

    setIsUpdating(true);

    try {
      const itemsPayload = editLineItems.map((item) => ({
        feeCategoryId: item.feeCategoryId,
        amount: parseFloat(item.amount) || 0,
        frequency: item.frequency,
        dueMonth: item.dueMonth ? parseInt(item.dueMonth, 10) : null,
      }));

      const res = await updateFeeStructure({
        id: editStructure.id,
        name: editName,
        notes: editNotes || null,
        items: itemsPayload,
      });

      if (!res.success) {
        setEditError(res.error ?? "Failed to update fee structure.");
        return;
      }

      toast.success(`Fee structure "${editName}" updated!`);
      setEditStructure(null);
      router.refresh();
    } catch (err) {
      console.error(err);
      setEditError("An unexpected error occurred.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleArchiveConfirm() {
    if (!archiveStructure) return;
    setIsArchiving(true);

    try {
      const res = await archiveFeeStructure(archiveStructure.id);
      if (!res.success) {
        toast.error(res.error ?? "Failed to archive fee structure.");
        return;
      }

      toast.success(`Fee structure "${archiveStructure.name}" archived.`);
      setArchiveStructure(null);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred while archiving.");
    } finally {
      setIsArchiving(false);
    }
  }

  const selectedClassObj = classes.find((c) => c.id === createClassId) ?? classes[0];
  const availableSections = selectedClassObj?.sections ?? [];

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Fee Structures</h2>
          <p className="text-sm text-muted-foreground">
            Master fee templates defining line items and frequencies for classes &amp; sections.
          </p>
        </div>

        {isAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger
              render={
                <Button className="gap-2" disabled={classes.length === 0 || categories.length === 0}>
                  <Plus className="size-4" /> Create Fee Structure
                </Button>
              }
            />
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleCreateSubmit}>
                <DialogHeader>
                  <DialogTitle>Create Master Fee Structure</DialogTitle>
                  <DialogDescription>
                    Define a class/section fee structure template with multiple line items.
                  </DialogDescription>
                </DialogHeader>

                {createError && (
                  <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="space-y-4 py-4">
                  {/* Name & Academic Year */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="stName">
                        Structure Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="stName"
                        placeholder="e.g. Class 6 Standard Annual Fee"
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="stYear">
                        Academic Year <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="stYear"
                        placeholder="YYYY-YYYY"
                        value={createAcademicYear}
                        onChange={(e) => setCreateAcademicYear(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Class & Section */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="stClass">
                        Class <span className="text-destructive">*</span>
                      </Label>
                      <select
                        id="stClass"
                        value={createClassId}
                        onChange={(e) => {
                          setCreateClassId(e.target.value);
                          setCreateSectionId("");
                        }}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                      >
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.academicYear})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="stSection">Section (Optional)</Label>
                      <select
                        id="stSection"
                        value={createSectionId}
                        onChange={(e) => setCreateSectionId(e.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                      >
                        <option value="">All Sections (Entire Class)</option>
                        {availableSections.map((sec) => (
                          <option key={sec.id} value={sec.id}>
                            Section {sec.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <Label htmlFor="stNotes">Notes</Label>
                    <Input
                      id="stNotes"
                      placeholder="Optional notes or remarks"
                      value={createNotes}
                      onChange={(e) => setCreateNotes(e.target.value)}
                    />
                  </div>

                  {/* Line Items Builder */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Fee Line Items</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addCreateLineItem}
                        className="gap-1 text-xs"
                      >
                        <Plus className="size-3.5" /> Add Line Item
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {createLineItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-12 items-end"
                        >
                          <div className="sm:col-span-4 space-y-1">
                            <Label className="text-xs">Fee Category</Label>
                            <select
                              value={item.feeCategoryId}
                              onChange={(e) =>
                                updateCreateLineItem(idx, "feeCategoryId", e.target.value)
                              }
                              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs"
                            >
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name} ({cat.code})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-3 space-y-1">
                            <Label className="text-xs">Amount (₹)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="5000"
                              className="h-8 text-xs"
                              value={item.amount}
                              onChange={(e) =>
                                updateCreateLineItem(idx, "amount", e.target.value)
                              }
                              required
                            />
                          </div>

                          <div className="sm:col-span-2 space-y-1">
                            <Label className="text-xs">Frequency</Label>
                            <select
                              value={item.frequency}
                              onChange={(e) =>
                                updateCreateLineItem(
                                  idx,
                                  "frequency",
                                  e.target.value as
                                    | "MONTHLY"
                                    | "QUARTERLY"
                                    | "ANNUAL"
                                    | "ONE_TIME"
                                )
                              }
                              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs"
                            >
                              <option value="MONTHLY">Monthly</option>
                              <option value="QUARTERLY">Quarterly</option>
                              <option value="ANNUAL">Annual</option>
                              <option value="ONE_TIME">One Time</option>
                            </select>
                          </div>

                          <div className="sm:col-span-2 space-y-1">
                            <Label className="text-xs">Due Month</Label>
                            <select
                              value={item.dueMonth}
                              onChange={(e) =>
                                updateCreateLineItem(idx, "dueMonth", e.target.value)
                              }
                              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs"
                            >
                              <option value="">None</option>
                              <option value="4">Apr (04)</option>
                              <option value="5">May (05)</option>
                              <option value="6">Jun (06)</option>
                              <option value="7">Jul (07)</option>
                              <option value="8">Aug (08)</option>
                              <option value="9">Sep (09)</option>
                              <option value="10">Oct (10)</option>
                              <option value="11">Nov (11)</option>
                              <option value="12">Dec (12)</option>
                              <option value="1">Jan (01)</option>
                              <option value="2">Feb (02)</option>
                              <option value="3">Mar (03)</option>
                            </select>
                          </div>

                          <div className="sm:col-span-1 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:bg-destructive/10"
                              onClick={() => removeCreateLineItem(idx)}
                              disabled={createLineItems.length === 1}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateOpen(false)}
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Create Fee Structure"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Fee Structures List */}
      {structures.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <Layers className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No fee structures defined</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Create master fee structure templates for classes and academic years.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {structures.map((st) => {
            const isExpanded = expandedId === st.id;
            const totalAmount = st.items.reduce((acc, i) => acc + i.amount, 0);

            return (
              <div
                key={st.id}
                className="rounded-xl border bg-card shadow-xs transition-colors overflow-hidden"
              >
                {/* Summary Header Row */}
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b bg-muted/10">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => setExpandedId(isExpanded ? null : st.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </Button>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base">{st.name}</h3>
                        {st.status === "ACTIVE" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            Archived
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Class: <span className="font-medium text-foreground">{st.class.name}</span>
                        {st.section ? ` (Sec ${st.section.name})` : " (All Sections)"} • Year:{" "}
                        <span className="font-medium text-foreground">{st.academicYear}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total Structure Value</p>
                      <p className="text-base font-bold text-primary">
                        {formatCurrency(totalAmount)}
                      </p>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(st)}
                          title="Edit Fee Structure"
                        >
                          <Edit2 className="size-4" />
                        </Button>
                        {st.status === "ACTIVE" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                            onClick={() => setArchiveStructure(st)}
                            title="Archive Fee Structure"
                          >
                            <Archive className="size-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Line Items Details (Collapsible or Always Visible) */}
                {isExpanded && (
                  <div className="p-4 bg-background">
                    {st.notes && (
                      <p className="text-xs text-muted-foreground mb-3 bg-muted/30 p-2.5 rounded-md">
                        <strong>Notes:</strong> {st.notes}
                      </p>
                    )}

                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-xs">Category</TableHead>
                            <TableHead className="text-xs">Code</TableHead>
                            <TableHead className="text-xs text-right">Amount</TableHead>
                            <TableHead className="text-xs">Frequency</TableHead>
                            <TableHead className="text-xs">Due Month</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {st.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium text-xs">
                                {item.feeCategory.name}
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                                  {item.feeCategory.code}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-xs">
                                {formatCurrency(item.amount)}
                              </TableCell>
                              <TableCell className="text-xs capitalize">
                                {item.frequency.toLowerCase().replace("_", " ")}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {item.dueMonth ? `Month ${item.dueMonth}` : "Standard"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Fee Structure Dialog */}
      <Dialog
        open={!!editStructure}
        onOpenChange={(open) => !open && setEditStructure(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Fee Structure</DialogTitle>
              <DialogDescription>
                Update fee structure template details and line items.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
              <Info className="size-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <span>
                <strong>Master Structure Notice:</strong> Editing master fee structure line items will update the template for future allocations. Already-allocated student fee item snapshots will remain unchanged.
              </span>
            </div>

            {editError && (
              <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="editStName">Structure Name</Label>
                <Input
                  id="editStName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editStNotes">Notes</Label>
                <Input
                  id="editStNotes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              {/* Line Items Builder */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Fee Line Items</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addEditLineItem}
                    className="gap-1 text-xs"
                  >
                    <Plus className="size-3.5" /> Add Line Item
                  </Button>
                </div>

                <div className="space-y-3">
                  {editLineItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-12 items-end"
                    >
                      <div className="sm:col-span-4 space-y-1">
                        <Label className="text-xs">Fee Category</Label>
                        <select
                          value={item.feeCategoryId}
                          onChange={(e) =>
                            updateEditLineItem(idx, "feeCategoryId", e.target.value)
                          }
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs"
                        >
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name} ({cat.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3 space-y-1">
                        <Label className="text-xs">Amount (₹)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="h-8 text-xs"
                          value={item.amount}
                          onChange={(e) =>
                            updateEditLineItem(idx, "amount", e.target.value)
                          }
                          required
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs">Frequency</Label>
                        <select
                          value={item.frequency}
                          onChange={(e) =>
                            updateEditLineItem(
                              idx,
                              "frequency",
                              e.target.value as
                                | "MONTHLY"
                                | "QUARTERLY"
                                | "ANNUAL"
                                | "ONE_TIME"
                            )
                          }
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs"
                        >
                          <option value="MONTHLY">Monthly</option>
                          <option value="QUARTERLY">Quarterly</option>
                          <option value="ANNUAL">Annual</option>
                          <option value="ONE_TIME">One Time</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs">Due Month</Label>
                        <select
                          value={item.dueMonth}
                          onChange={(e) =>
                            updateEditLineItem(idx, "dueMonth", e.target.value)
                          }
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs"
                        >
                          <option value="">None</option>
                          <option value="4">Apr (04)</option>
                          <option value="5">May (05)</option>
                          <option value="6">Jun (06)</option>
                          <option value="7">Jul (07)</option>
                          <option value="8">Aug (08)</option>
                          <option value="9">Sep (09)</option>
                          <option value="10">Oct (10)</option>
                          <option value="11">Nov (11)</option>
                          <option value="12">Dec (12)</option>
                          <option value="1">Jan (01)</option>
                          <option value="2">Feb (02)</option>
                          <option value="3">Mar (03)</option>
                        </select>
                      </div>

                      <div className="sm:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:bg-destructive/10"
                          onClick={() => removeEditLineItem(idx)}
                          disabled={editLineItems.length === 1}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditStructure(null)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  "Update Structure"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <Dialog
        open={!!archiveStructure}
        onOpenChange={(open) => !open && setArchiveStructure(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-600">Archive Fee Structure</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive structure{" "}
              <strong>&quot;{archiveStructure?.name}&quot;</strong>? Archived structures cannot be allocated to new cohorts.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setArchiveStructure(null)}
              disabled={isArchiving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleArchiveConfirm}
              disabled={isArchiving}
            >
              {isArchiving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Archiving…
                </>
              ) : (
                "Confirm Archive"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
