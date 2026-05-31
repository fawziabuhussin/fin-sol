"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, type ProjectInput } from "@/lib/validations/projects";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function ProjectSheet({
  open,
  onOpenChange,
  initial,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<ProjectInput>;
  projectId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema) as any,
    defaultValues: {
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      totalBudget: initial?.totalBudget ?? undefined,
      targetDate: initial?.targetDate ?? "",
      status: initial?.status ?? "PLANNED",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const endpoint = projectId ? `/api/projects/${projectId}` : "/api/projects";
      const method = projectId ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        onOpenChange(false);
        router.refresh();
      }
    });
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{projectId ? "تعديل مشروع" : "إنشاء مشروع"}</SheetTitle>
          <SheetDescription>
            استخدم أي نوع مشروع (بناء، زفاف، تمويل شركة، غيره).
          </SheetDescription>
        </SheetHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <Label>العنوان</Label>
            <Input {...form.register("title")} />
          </div>

          <div>
            <Label>الوصف</Label>
            <Textarea {...form.register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الميزانية</Label>
              <Input type="number" step="0.01" {...form.register("totalBudget")} />
            </div>
            <div>
              <Label>تاريخ البداية المخطط</Label>
              <Input type="date" {...form.register("targetDate")} />
            </div>
          </div>

          <div>
            <Label>الحالة</Label>
            <Select {...form.register("status")}>
              <option value="PLANNED">مخطط للمستقبل</option>
              <option value="ACTIVE">قيد التنفيذ — بدأ الآن</option>
              <option value="ON_HOLD">متوقف مؤقتاً</option>
              <option value="COMPLETED">مكتمل</option>
              <option value="CANCELLED">ملغى</option>
            </Select>
            <p className="mt-1 text-xs text-slate-500">
              اختر «مخطط للمستقبل» للبنود التي لم تبدأ بعد — لن تظهر في الدفعات
              القادمة حتى تفعّلها.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
