"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createStudentSchema, type CreateStudentInput } from "@/lib/validations/student";
import { createStudent } from "@/lib/actions/students";
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
import { UserPlus, Loader2, AlertCircle } from "lucide-react";

export interface ClassWithSectionsOption {
  id: string;
  name: string;
  academicYear: string;
  sections: Array<{
    id: string;
    name: string;
  }>;
}

interface CreateStudentDialogProps {
  classes: ClassWithSectionsOption[];
  defaultAcademicYear: string;
}

export function CreateStudentDialog({
  classes,
  defaultAcademicYear,
}: CreateStudentDialogProps) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const initialClass = classes[0];
  const initialSection = initialClass?.sections[0];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStudentInput>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: {
      admissionNumber: "",
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: null,
      category: "GENERAL",
      rteCandidate: false,
      address: "",
      academicYear: defaultAcademicYear,
      classId: initialClass?.id ?? "",
      sectionId: initialSection?.id ?? "",
    },
  });

  const selectedClassId = watch("classId");
  const selectedClass = classes.find((c) => c.id === selectedClassId) ?? initialClass;
  const availableSections = selectedClass?.sections ?? [];

  function handleClassChange(newClassId: string) {
    setValue("classId", newClassId);
    const targetClass = classes.find((c) => c.id === newClassId);
    const firstSec = targetClass?.sections[0];
    setValue("sectionId", firstSec ? firstSec.id : "");
  }

  async function onSubmit(data: CreateStudentInput) {
    setServerError(null);
    const result = await createStudent(data);

    if (!result.success) {
      setServerError(result.error ?? "Failed to admit student.");
      return;
    }

    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2" disabled={classes.length === 0}>
            <UserPlus className="size-4" /> Admit Student
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Student Admission</DialogTitle>
            <DialogDescription>
              Register a new student and enroll them into an academic class and section.
            </DialogDescription>
          </DialogHeader>

          {serverError && (
            <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            {/* Admission Number */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="admissionNumber">
                Admission Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="admissionNumber"
                placeholder="e.g. ADM-2025-002"
                {...register("admissionNumber")}
              />
              {errors.admissionNumber && (
                <p className="text-xs text-destructive">{errors.admissionNumber.message}</p>
              )}
            </div>

            {/* First Name */}
            <div className="space-y-1.5">
              <Label htmlFor="firstName">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                placeholder="e.g. Aarav"
                {...register("firstName")}
              />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>

            {/* Last Name */}
            <div className="space-y-1.5">
              <Label htmlFor="lastName">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                placeholder="e.g. Sharma"
                {...register("lastName")}
              />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName.message}</p>
              )}
            </div>

            {/* Date of Birth */}
            <div className="space-y-1.5">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                {...register("dateOfBirth")}
              />
              {errors.dateOfBirth && (
                <p className="text-xs text-destructive">{errors.dateOfBirth.message}</p>
              )}
            </div>

            {/* Gender */}
            <div className="space-y-1.5">
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                {...register("gender")}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              >
                <option value="">Select Gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="category">Category (Reservation)</Label>
              <select
                id="category"
                {...register("category")}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              >
                <option value="GENERAL">General</option>
                <option value="OBC">OBC (Other Backward Classes)</option>
                <option value="SC">SC (Scheduled Caste)</option>
                <option value="ST">ST (Scheduled Tribe)</option>
              </select>
            </div>

            {/* RTE Candidate Checkbox */}
            <div className="space-y-1.5 flex flex-col justify-center">
              <div className="flex items-center gap-2 pt-2">
                <input
                  id="rteCandidate"
                  type="checkbox"
                  className="size-4 rounded border-input text-primary focus:ring-primary"
                  {...register("rteCandidate")}
                />
                <Label htmlFor="rteCandidate" className="text-sm font-normal cursor-pointer">
                  RTE Candidate (25% Quota)
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Right to Education Act reserved seat.
              </p>
            </div>

            {/* Academic Year */}
            <div className="space-y-1.5">
              <Label htmlFor="academicYear">
                Academic Year <span className="text-destructive">*</span>
              </Label>
              <Input
                id="academicYear"
                placeholder="YYYY-YYYY"
                {...register("academicYear")}
              />
              {errors.academicYear && (
                <p className="text-xs text-destructive">{errors.academicYear.message}</p>
              )}
            </div>

            {/* Class Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="classId">
                Class <span className="text-destructive">*</span>
              </Label>
              <select
                id="classId"
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
              {errors.classId && (
                <p className="text-xs text-destructive">{errors.classId.message}</p>
              )}
            </div>

            {/* Section Selection (Cascading from selected class) */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sectionId">
                Section <span className="text-destructive">*</span>
              </Label>
              <select
                id="sectionId"
                {...register("sectionId")}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              >
                {availableSections.length === 0 ? (
                  <option value="">No sections available for selected class</option>
                ) : (
                  availableSections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      Section {sec.name}
                    </option>
                  ))
                )}
              </select>
              {errors.sectionId && (
                <p className="text-xs text-destructive">{errors.sectionId.message}</p>
              )}
            </div>

            {/* Address */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Residential Address</Label>
              <Input
                id="address"
                placeholder="Street address, city, pin code"
                {...register("address")}
              />
              {errors.address && (
                <p className="text-xs text-destructive">{errors.address.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || classes.length === 0}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Admitting…
                </>
              ) : (
                "Admit Student"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
