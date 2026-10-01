"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PrintableReportCard } from "./printable-report-card";
import type { ReportCardData } from "@/lib/actions/report-cards";

interface ReportCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportCardData: ReportCardData | null;
}

export function ReportCardModal({
  open,
  onOpenChange,
  reportCardData,
}: ReportCardModalProps) {
  if (!reportCardData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 print:p-0 print:border-none print:shadow-none">
        <DialogHeader className="print:hidden sr-only">
          <DialogTitle>Institutional Report Card Preview</DialogTitle>
          <DialogDescription>
            Official report card for {reportCardData.student.name}
          </DialogDescription>
        </DialogHeader>

        <PrintableReportCard
          data={reportCardData}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
