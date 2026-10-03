"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createFeeDiscount } from "@/lib/actions/fees";
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
  Loader2,
  AlertCircle,
  Percent,
  CheckCircle2,
  XCircle,
  Award,
} from "lucide-react";

export interface FeeDiscountItem {
  id: string;
  name: string;
  code: string;
  type: string;
  value: number;
  isRteDefault: boolean;
  status: string;
  createdAt: Date;
}

interface FeeDiscountListProps {
  discounts: FeeDiscountItem[];
  userRole: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
}

export function FeeDiscountList({ discounts, userRole }: FeeDiscountListProps) {
  const router = useRouter();
  const isAdmin = userRole === "ADMIN";

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE");
  const [value, setValue] = useState("10");
  const [isRteDefault, setIsRteDefault] = useState(false);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);

    try {
      const numericVal = parseFloat(value) || 0;
      const res = await createFeeDiscount({
        name,
        code,
        type,
        value: numericVal,
        isRteDefault,
        status,
      });

      if (!res.success) {
        setCreateError(res.error ?? "Failed to create fee discount.");
        return;
      }

      toast.success(`Discount policy "${name}" created successfully!`);
      setName("");
      setCode("");
      setValue("10");
      setIsRteDefault(false);
      setCreateOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      setCreateError("An unexpected error occurred.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Discounts &amp; Concessions
          </h2>
          <p className="text-sm text-muted-foreground">
            Fee concession policies (e.g. Sibling Concession, Merit Scholarship, RTE 100% Waiver).
          </p>
        </div>

        {isAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger
              render={
                <Button className="gap-2">
                  <Plus className="size-4" /> Create Discount Policy
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleCreateSubmit}>
                <DialogHeader>
                  <DialogTitle>Create Fee Discount Policy</DialogTitle>
                  <DialogDescription>
                    Define a percentage or fixed amount fee concession policy.
                  </DialogDescription>
                </DialogHeader>

                {createError && (
                  <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="space-y-4 py-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="discName">
                      Policy Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="discName"
                      placeholder="e.g. Sibling Concession 10%"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="discCode">
                      Discount Code <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="discCode"
                      placeholder="e.g. SIB10 (auto-uppercased)"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      required
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="discType">Discount Type</Label>
                      <select
                        id="discType"
                        value={type}
                        onChange={(e) =>
                          setType(e.target.value as "PERCENTAGE" | "FIXED_AMOUNT")
                        }
                        className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                      >
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="discValue">
                        Value ({type === "PERCENTAGE" ? "%" : "₹"}){" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="discValue"
                        type="number"
                        step="0.01"
                        min="0"
                        max={type === "PERCENTAGE" ? "100" : undefined}
                        placeholder={type === "PERCENTAGE" ? "10" : "500"}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* RTE Default Checkbox */}
                  <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        id="isRteDefault"
                        type="checkbox"
                        className="size-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                        checked={isRteDefault}
                        onChange={(e) => setIsRteDefault(e.target.checked)}
                      />
                      <Label
                        htmlFor="isRteDefault"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Set as Default RTE Candidate Waiver
                      </Label>
                    </div>
                    <p className="text-[11px] text-muted-foreground pl-6">
                      Automatically applies this discount to Right to Education Act reserved candidate students during cohort allocation.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="discStatus">Status</Label>
                    <select
                      id="discStatus"
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as "ACTIVE" | "INACTIVE")
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
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
                      "Create Policy"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Discounts Table */}
      {discounts.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <Percent className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No discount policies defined</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Create concession policies for sibling discounts, merit waivers, or RTE candidates.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Code</TableHead>
                <TableHead>Policy Name</TableHead>
                <TableHead>Discount Type</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Special Designation</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discounts.map((disc) => (
                <TableRow key={disc.id}>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold tracking-wider text-foreground">
                      {disc.code}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{disc.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground capitalize">
                    {disc.type === "PERCENTAGE" ? "Percentage Waiver" : "Fixed Amount Concession"}
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary text-sm">
                    {disc.type === "PERCENTAGE"
                      ? `${disc.value}%`
                      : formatCurrency(disc.value)}
                  </TableCell>
                  <TableCell>
                    {disc.isRteDefault ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        <Award className="size-3" /> RTE Default (100% Waiver)
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {disc.status === "ACTIVE" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        <XCircle className="size-3" /> Inactive
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
  );
}
