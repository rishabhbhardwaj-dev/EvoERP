"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createFeeCategory,
  updateFeeCategory,
  deleteFeeCategory,
} from "@/lib/actions/fees";
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
  Trash2,
  Loader2,
  AlertCircle,
  Tag,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export interface FeeCategoryItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isSystem: boolean;
  status: string;
  createdAt: Date;
}

interface FeeCategoryListProps {
  categories: FeeCategoryItem[];
  userRole: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
}

export function FeeCategoryList({ categories, userRole }: FeeCategoryListProps) {
  const router = useRouter();
  const isAdmin = userRole === "ADMIN";

  // Create Dialog State
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createStatus, setCreateStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Edit Dialog State
  const [editCategory, setEditCategory] = useState<FeeCategoryItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [editError, setEditError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete Dialog State
  const [deleteCategory, setDeleteCategory] = useState<FeeCategoryItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);

    try {
      const res = await createFeeCategory({
        name: createName,
        code: createCode,
        description: createDesc || null,
        status: createStatus,
      });

      if (!res.success) {
        setCreateError(res.error ?? "Failed to create fee category.");
        return;
      }

      toast.success(`Fee category "${createName.trim()}" created successfully!`);
      setCreateName("");
      setCreateCode("");
      setCreateDesc("");
      setCreateStatus("ACTIVE");
      setCreateOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      setCreateError("An unexpected error occurred.");
    } finally {
      setIsCreating(false);
    }
  }

  function openEditModal(category: FeeCategoryItem) {
    setEditCategory(category);
    setEditName(category.name);
    setEditCode(category.code);
    setEditDesc(category.description ?? "");
    setEditStatus((category.status as "ACTIVE" | "INACTIVE") ?? "ACTIVE");
    setEditError(null);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editCategory) return;
    setEditError(null);
    setIsUpdating(true);

    try {
      const res = await updateFeeCategory({
        id: editCategory.id,
        name: editName,
        code: editCode,
        description: editDesc || null,
        status: editStatus,
      });

      if (!res.success) {
        setEditError(res.error ?? "Failed to update fee category.");
        return;
      }

      toast.success(`Fee category "${editName.trim()}" updated successfully!`);
      setEditCategory(null);
      router.refresh();
    } catch (err) {
      console.error(err);
      setEditError("An unexpected error occurred.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteCategory) return;
    setDeleteError(null);
    setIsDeleting(true);

    try {
      const res = await deleteFeeCategory(deleteCategory.id);

      if (!res.success) {
        setDeleteError(res.error ?? "Failed to delete fee category.");
        return;
      }

      toast.success(`Fee category "${deleteCategory.name}" deleted.`);
      setDeleteCategory(null);
      router.refresh();
    } catch (err) {
      console.error(err);
      setDeleteError("An unexpected error occurred while deleting category.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Fee Categories</h2>
          <p className="text-sm text-muted-foreground">
            Master fee classification heads (e.g. Tuition, Admission, Transport, Sports).
          </p>
        </div>

        {isAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger
              render={
                <Button className="gap-2">
                  <Plus className="size-4" /> Create Category
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleCreateSubmit}>
                <DialogHeader>
                  <DialogTitle>Create Fee Category</DialogTitle>
                  <DialogDescription>
                    Add a new fee classification category for your school.
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
                    <Label htmlFor="catName">
                      Category Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="catName"
                      placeholder="e.g. Tuition Fee"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="catCode">
                      Category Code <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="catCode"
                      placeholder="e.g. TUIT (auto-uppercased)"
                      value={createCode}
                      onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Unique uppercase identifier code for this category.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="catDesc">Description</Label>
                    <Input
                      id="catDesc"
                      placeholder="Optional details or description"
                      value={createDesc}
                      onChange={(e) => setCreateDesc(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="catStatus">Status</Label>
                    <select
                      id="catStatus"
                      value={createStatus}
                      onChange={(e) =>
                        setCreateStatus(e.target.value as "ACTIVE" | "INACTIVE")
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
                      "Create Category"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Categories Table */}
      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <Tag className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No fee categories defined</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Create fee categories like Tuition Fee or Admission Fee to build fee structures.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Code</TableHead>
                <TableHead>Category Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold tracking-wider text-foreground">
                      {cat.code}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {cat.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    {cat.status === "ACTIVE" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        <XCircle className="size-3" /> Inactive
                      </span>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(cat)}
                          title="Edit Category"
                        >
                          <Edit2 className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setDeleteCategory(cat);
                            setDeleteError(null);
                          }}
                          title="Delete Category"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Category Dialog */}
      <Dialog
        open={!!editCategory}
        onOpenChange={(open) => !open && setEditCategory(null)}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Fee Category</DialogTitle>
              <DialogDescription>
                Update the fee classification category details.
              </DialogDescription>
            </DialogHeader>

            {editError && (
              <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="editCatName">Category Name</Label>
                <Input
                  id="editCatName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editCatCode">Category Code</Label>
                <Input
                  id="editCatCode"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editCatDesc">Description</Label>
                <Input
                  id="editCatDesc"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editCatStatus">Status</Label>
                <select
                  id="editCatStatus"
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(e.target.value as "ACTIVE" | "INACTIVE")
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
                onClick={() => setEditCategory(null)}
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
                  "Update Category"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteCategory}
        onOpenChange={(open) => !open && setDeleteCategory(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Fee Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete category{" "}
              <strong>&quot;{deleteCategory?.name}&quot;</strong> ({deleteCategory?.code})?
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="flex flex-col gap-1.5 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="size-4 shrink-0" />
                <span>Cannot Delete Category</span>
              </div>
              <p className="text-xs text-destructive/90 pl-6">{deleteError}</p>
              <p className="text-[11px] text-muted-foreground pl-6 mt-1">
                Tip: Deactivate status to INACTIVE instead to keep historical references intact.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteCategory(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Confirm Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
