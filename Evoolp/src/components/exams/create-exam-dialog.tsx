"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, PlusCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { createExam } from "@/lib/actions/exams";
import {
  createExamSchema,
  type CreateExamInput,
} from "@/lib/validations/exam";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring";

const EXAM_TYPE_OPTIONS = [
  { value: "PERIODIC_TEST", label: "Periodic Test" },
  { value: "HALF_YEARLY", label: "Half-Yearly Exam" },
  { value: "ANNUAL", label: "Annual Exam" },
  { value: "PRACTICE", label: "Practice / Mock" },
] as const;

export interface ClassOption {
  id: string;
  name: string;
  academicYear: string;
  sections: { id: string; name: string }[];
}

export interface SubjectOption {
  id: string;
  name: string;
  code: string;
}

interface CreateExamDialogProps {
  classes: ClassOption[];
  subjects: SubjectOption[];
}

export function CreateExamDialog({ classes, subjects }: CreateExamDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const firstClass = classes[0];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateExamInput>({
    resolver: zodResolver(createExamSchema),
    defaultValues: {
      name: "",
      examType: "PERIODIC_TEST",
      classId: firstClass?.id ?? "",
      sectionId: firstClass?.sections[0]?.id ?? "",
      subjectId: subjects[0]?.id ?? "",
      academicYear: firstClass?.academicYear ?? "",
      maxMarks: undefined,
      passingMarks: undefined,
      examDate: "",
      notes: "",
    },
  });

  const selectedClassId = watch("classId");
  const selectedClass = classes.find((c) => c.id === selectedClassId) ?? firstClass;
  const availableSections = selectedClass?.sections ?? [];

  function handleClassChange(newClassId: string) {
    const cls = classes.find((c) => c.id === newClassId);
    setValue("classId", newClassId);
    setValue("academicYear", cls?.academicYear ?? "");
    setValue("sectionId", cls?.sections[0]?.id ?? "");
  }

  function handleClose() {
    reset({
      name: "",
      examType: "PERIODIC_TEST",
      classId: firstClass?.id ?? "",
      sectionId: firstClass?.sections[0]?.id ?? "",
      subjectId: subjects[0]?.id ?? "",
      academicYear: firstClass?.academicYear ?? "",
      maxMarks: undefined,
      passingMarks: undefined,
      examDate: "",
      notes: "",
    });
    setServerError(null);
    setOpen(false);
  }

  async function onSubmit(data: CreateExamInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await createExam(data);
      if (result.success) {
        toast.success("Exam created successfully.");
        handleClose();
        router.refresh();
      } else {
        setServerError(result.error ?? "Failed to create exam.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); else setOpen(true); }}>
      <DialogTrigger
        render={
          <Button className="gap-2" disabled={classes.length === 0}>
            <PlusCircle className="size-4" />
            Create Exam
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create New Exam</DialogTitle>
            <DialogDescription>
              Define a new exam for a class, section, and subject. Marks can be
              entered after the exam is created.
            </DialogDescription>
          </DialogHeader>

          {serverError && (
            <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            {/* Exam Name */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="examName">
                Exam Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="examName"
                placeholder='e.g. "Periodic Test 1 – Mathematics"'
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Exam Type */}
            <div className="space-y-1.5">
              <Label htmlFor="examType">
                Exam Type <span className="text-destructive">*</span>
              </Label>
              <select id="examType" {...register("examType")} className={selectClass}>
                {EXAM_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {errors.examType && (
                <p className="text-xs text-destructive">{errors.examType.message}</p>
              )}
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <Label htmlFor="examSubject">
                Subject <span className="text-destructive">*</span>
              </Label>
              <select id="examSubject" {...register("subjectId")} className={selectClass}>
                <option value="">Select subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
              {errors.subjectId && (
                <p className="text-xs text-destructive">{errors.subjectId.message}</p>
              )}
            </div>

            {/* Class */}
            <div className="space-y-1.5">
              <Label htmlFor="examClass">
                Class <span className="text-destructive">*</span>
              </Label>
              <select
                id="examClass"
                value={selectedClassId}
                onChange={(e) => handleClassChange(e.target.value)}
                className={selectClass}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.academicYear})
                  </option>
                ))}
              </select>
              {errors.classId && (
                <p className="text-xs text-destructive">{errors.classId.message}</p>
              )}
            </div>

            {/* Section */}
            <div className="space-y-1.5">
              <Label htmlFor="examSection">
                Section <span className="text-destructive">*</span>
              </Label>
              <select id="examSection" {...register("sectionId")} className={selectClass}>
                {availableSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    Section {s.name}
                  </option>
                ))}
                {availableSections.length === 0 && (
                  <option value="">No sections available</option>
                )}
              </select>
              {errors.sectionId && (
                <p className="text-xs text-destructive">{errors.sectionId.message}</p>
              )}
            </div>

            {/* Max Marks */}
            <div className="space-y-1.5">
              <Label htmlFor="maxMarks">
                Max Marks <span className="text-destructive">*</span>
              </Label>
              <Input
                id="maxMarks"
                type="number"
                step="0.01"
                min="0.01"
                max="9999.99"
                placeholder="e.g. 25"
                {...register("maxMarks", { valueAsNumber: true })}
              />
              {errors.maxMarks && (
                <p className="text-xs text-destructive">{errors.maxMarks.message}</p>
              )}
            </div>

            {/* Passing Marks */}
            <div className="space-y-1.5">
              <Label htmlFor="passingMarks">
                Passing Marks <span className="text-destructive">*</span>
              </Label>
              <Input
                id="passingMarks"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 8.25"
                {...register("passingMarks", { valueAsNumber: true })}
              />
              {errors.passingMarks && (
                <p className="text-xs text-destructive">{errors.passingMarks.message}</p>
              )}
            </div>

            {/* Exam Date (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="examDate">Exam Date (optional)</Label>
              <Input id="examDate" type="date" {...register("examDate")} />
              {errors.examDate && (
                <p className="text-xs text-destructive">{errors.examDate.message}</p>
              )}
            </div>

            {/* Notes (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="examNotes">Notes (optional)</Label>
              <Input
                id="examNotes"
                placeholder="Any instructions or remarks"
                {...register("notes")}
              />
              {errors.notes && (
                <p className="text-xs text-destructive">{errors.notes.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Create Exam
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
