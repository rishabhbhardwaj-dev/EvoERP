"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTeacherSchema, type CreateTeacherInput } from "@/lib/validations/teacher";
import { createTeacher } from "@/lib/actions/teachers";
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
import { UserPlus, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";

const STANDARD_DEPARTMENTS = [
  "Mathematics",
  "Science",
  "Social Science",
  "English",
  "Hindi",
  "Computer Science",
  "Physical Education",
  "Arts & Craft",
  "Music",
  "Sanskrit",
];

export function CreateTeacherDialog() {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTeacherInput>({
    resolver: zodResolver(createTeacherSchema),
    defaultValues: {
      name: "",
      email: "",
      employeeCode: "",
      department: "",
      qualification: "",
      password: "Password123!",
    },
  });

  async function onSubmit(data: CreateTeacherInput) {
    setServerError(null);
    const result = await createTeacher(data);

    if (!result.success) {
      setServerError(result.error ?? "Failed to onboard teacher.");
      return;
    }

    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2">
            <UserPlus className="size-4" /> Onboard Teacher
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Onboard Teaching Staff</DialogTitle>
          <DialogDescription>
            Register a new teacher profile and provision their institutional login account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1">
            <Label htmlFor="teacher-name" className="text-xs font-medium">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="teacher-name"
              placeholder="e.g. Sunita Rao"
              {...register("name")}
              className="h-8 text-xs"
            />
            {errors.name && (
              <p className="text-[11px] text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Email Address */}
          <div className="space-y-1">
            <Label htmlFor="teacher-email" className="text-xs font-medium">
              Email Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="teacher-email"
              type="email"
              placeholder="e.g. sunita@demo.evoerp.in"
              {...register("email")}
              className="h-8 text-xs"
            />
            {errors.email && (
              <p className="text-[11px] text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Employee Code */}
          <div className="space-y-1">
            <Label htmlFor="teacher-code" className="text-xs font-medium">
              Employee Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="teacher-code"
              placeholder="e.g. TCH-002"
              {...register("employeeCode")}
              className="h-8 font-mono text-xs uppercase"
            />
            <p className="text-[11px] text-muted-foreground">
              Unique institutional staff identifier (e.g. TCH-002).
            </p>
            {errors.employeeCode && (
              <p className="text-[11px] text-destructive">{errors.employeeCode.message}</p>
            )}
          </div>

          {/* Department & Qualification Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="teacher-dept" className="text-xs font-medium">
                Department
              </Label>
              <Input
                id="teacher-dept"
                list="department-suggestions"
                placeholder="e.g. Science"
                {...register("department")}
                className="h-8 text-xs"
              />
              <datalist id="department-suggestions">
                {STANDARD_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept} />
                ))}
              </datalist>
              {errors.department && (
                <p className="text-[11px] text-destructive">{errors.department.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="teacher-qual" className="text-xs font-medium">
                Qualification
              </Label>
              <Input
                id="teacher-qual"
                placeholder="e.g. M.Sc, B.Ed"
                {...register("qualification")}
                className="h-8 text-xs"
              />
              {errors.qualification && (
                <p className="text-[11px] text-destructive">{errors.qualification.message}</p>
              )}
            </div>
          </div>

          {/* Initial Password */}
          <div className="space-y-1">
            <Label htmlFor="teacher-password" className="text-xs font-medium">
              Initial Password <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="teacher-password"
                type={showPassword ? "text" : "password"}
                placeholder="Minimum 8 characters"
                {...register("password")}
                className="h-8 pr-8 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Temporary password handed to the teacher for first login.
            </p>
            {errors.password && (
              <p className="text-[11px] text-destructive">{errors.password.message}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Onboarding…
                </>
              ) : (
                "Onboard Staff"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
