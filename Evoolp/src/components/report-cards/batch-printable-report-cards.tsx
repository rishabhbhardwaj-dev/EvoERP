"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, Users } from "lucide-react";
import { ReportCardDocumentContent } from "./printable-report-card";
import {
  recordBatchReportCardPrintAudit,
  type ReportCardData,
} from "@/lib/actions/report-cards";

interface BatchPrintableReportCardsProps {
  cards: ReportCardData[];
  classId: string;
  sectionId: string;
  academicYear: string;
  cycleName: string;
  onClose?: () => void;
}

export function BatchPrintableReportCards({
  cards,
  classId,
  sectionId,
  academicYear,
  cycleName,
  onClose,
}: BatchPrintableReportCardsProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handlePrintAll() {
    setIsPrinting(true);
    try {
      await recordBatchReportCardPrintAudit({
        classId,
        sectionId,
        academicYear,
        cycleName,
        studentCount: cards.length,
      });
    } catch (err) {
      console.error("Batch print audit failed (non-blocking):", err);
    } finally {
      setIsPrinting(false);
      if (typeof window !== "undefined") {
        window.print();
      }
    }
  }

  if (cards.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        No student report cards selected for batch printing.
      </div>
    );
  }

  const batchPrintStyles = `
    @media print {
      @page {
        size: A4 portrait;
        margin: 8mm 6mm;
      }
      html, body {
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: visible !important;
        background: white !important;
        color: black !important;
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body:has(#report-card-print-root) > *:not(#report-card-print-root) {
        display: none !important;
      }
      body > *:not(#report-card-print-root) {
        display: none !important;
      }
      #report-card-print-root {
        display: block !important;
        position: static !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        color: black !important;
        visibility: visible !important;
        transform: none !important;
      }
      .report-card-page {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .report-card-page:not(:last-child) {
        page-break-after: always !important;
        break-after: page !important;
      }
      .report-card-page + .report-card-page {
        page-break-before: always !important;
        break-before: page !important;
      }
    }
    @media screen {
      #report-card-print-root {
        display: none !important;
      }
    }
  `;

  return (
    <div className="space-y-6">
      {/* Interactive Batch Toolbar (Visible only on screen) */}
      <div className="flex items-center justify-between gap-4 p-4 border rounded-xl bg-card shadow-xs print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            <h2 className="font-semibold text-base">Batch Printing Preview</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {cards.length} student report card{cards.length !== 1 ? "s" : ""} compiled for {cycleName} ({academicYear})
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Back to Roster
            </Button>
          )}
          <Button
            size="sm"
            onClick={handlePrintAll}
            disabled={isPrinting}
            className="gap-2 shadow-xs"
            id="print-batch-report-cards-button"
          >
            {isPrinting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Printer className="size-4" />
            )}
            Print All Cards ({cards.length})
          </Button>
        </div>
      </div>

      {/* Screen Preview Container (Continuous stack inside modal) */}
      <div className="space-y-6 print:hidden">
        {cards.map((card) => (
          <div
            key={card.student.id}
            className="bg-white text-black p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm max-w-4xl mx-auto font-sans"
          >
            <ReportCardDocumentContent data={card} />
          </div>
        ))}
      </div>

      {/* Dedicated Clean Batch Print Root Portal */}
      {mounted && typeof document !== "undefined" && createPortal(
        <div id="report-card-print-root">
          <style dangerouslySetInnerHTML={{ __html: batchPrintStyles }} />
          {cards.map((card, idx) => {
            const isLast = idx === cards.length - 1;
            return (
              <div
                key={card.student.id}
                className="report-card-page"
                style={{
                  pageBreakAfter: isLast ? "auto" : "always",
                  breakAfter: isLast ? "auto" : "page",
                }}
              >
                <ReportCardDocumentContent data={card} />
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
