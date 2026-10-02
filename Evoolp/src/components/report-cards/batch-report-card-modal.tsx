"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BatchPrintableReportCards } from "./batch-printable-report-cards";
import {
  getBatchReportCardData,
  type ReportCardData,
} from "@/lib/actions/report-cards";

interface BatchReportCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentIds: string[];
  classId: string;
  sectionId: string;
  academicYear: string;
  examIds: string[];
  cycleName: string;
  cycleKey?: string;
}

export function BatchReportCardModal({
  open,
  onOpenChange,
  studentIds,
  classId,
  sectionId,
  academicYear,
  examIds,
  cycleName,
  cycleKey,
}: BatchReportCardModalProps) {
  const [cards, setCards] = useState<ReportCardData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open || studentIds.length === 0) {
      setCards([]);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    getBatchReportCardData({
      studentIds,
      academicYear,
      examIds,
      cycleName,
      cycleKey,
    })
      .then((res) => {
        if (cancelled) return;
        setIsLoading(false);
        if (res.success && res.data) {
          setCards(res.data);
        } else {
          setErrorMessage(res.error ?? "Failed to compile batch report cards.");
          toast.error(res.error ?? "Batch compilation failed.");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setIsLoading(false);
        setErrorMessage("An unexpected network error occurred while compiling batch report cards.");
        console.error("Batch compilation error:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [open, studentIds, academicYear, examIds, cycleName, cycleKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-w-5xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 print:hidden">
        <DialogHeader className="print:hidden sr-only">
          <DialogTitle>Batch Report Cards Preview</DialogTitle>
          <DialogDescription>
            Continuous batch printing preview for {studentIds.length} enrolled students.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="size-8 animate-spin mx-auto text-primary" />
            <h3 className="font-semibold text-base">Compiling Batch Report Cards...</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Calculating scholastic grades, CBSE attendance weighting, and appraisals for {studentIds.length} candidate{studentIds.length !== 1 ? "s" : ""}.
            </p>
          </div>
        ) : errorMessage ? (
          <div className="py-16 text-center space-y-3">
            <AlertCircle className="size-8 text-destructive mx-auto" />
            <h3 className="font-semibold text-base">Batch Compilation Failed</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {errorMessage}
            </p>
            <div className="pt-2 flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setIsLoading(true);
                  setErrorMessage(null);
                  getBatchReportCardData({
                    studentIds,
                    academicYear,
                    examIds,
                    cycleName,
                    cycleKey,
                  }).then((res) => {
                    setIsLoading(false);
                    if (res.success && res.data) setCards(res.data);
                    else setErrorMessage(res.error ?? "Failed to compile batch report cards.");
                  });
                }}
                className="gap-1.5"
              >
                <RefreshCw className="size-3.5" />
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <BatchPrintableReportCards
            cards={cards}
            classId={classId}
            sectionId={sectionId}
            academicYear={academicYear}
            cycleName={cycleName}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
