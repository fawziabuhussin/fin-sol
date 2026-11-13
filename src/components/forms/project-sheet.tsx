"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FolderKanban, ListPlus } from "lucide-react";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";

export type ParentProjectOption = { id: string; title: string };

export function ProjectSheet({
  open,
  onOpenChange,
  initial,
  projectId,
  parentProjectId,
  parentTitle,
  parentOptions = [],
  variant = "master",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<ProjectInput>;
  projectId?: string;
  parentProjectId?: string;
  parentTitle?: string;
  parentOptions?: ParentProjectOption[];
  variant?: "master" | "child";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const lockedParent = Boolean(parentProjectId) && variant === "child";
  const isEditing = Boolean(projectId);
  const availableParents = parentOptions.filter((p) => p.id !== projectId);

  const [placement, setPlacement] = useState<"new" | "nested">(
    lockedParent ? "nested" : "new"
  );
  const [selectedParentId, setSelectedParentId] = useState(parentProjectId ?? "");

  const isNested = !isEditing && (lockedParent || placement === "nested");

  const form = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema) as any,
    defaultValues: {
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      profession: initial?.profession ?? "",
      totalBudget: initial?.totalBudget ?? undefined,
      targetDate: initial?.targetDate ?? "",
      status: initial?.status ?? "PLANNED",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      profession: initial?.profession ?? "",
      totalBudget: initial?.totalBudget ?? undefined,
      targetDate: initial?.targetDate ?? "",
      status: initial?.status ?? "PLANNED",
    });
    setPlacement(lockedParent ? "nested" : "new");
    setSelectedParentId(parentProjectId ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId, parentProjectId, lockedParent]);

  const resolvedParentId = lockedParent
    ? parentProjectId ?? ""
    : placement === "nested"
      ? selectedParentId
      : "";

  const onSubmit = form.handleSubmit((values) => {
    if (!isEditing && isNested && !resolvedParentId) {
      toast.error("اختر المشروع الرئيسي من القائمة");
      return;
    }

    startTransition(async () => {
      const endpoint = projectId ? `/api/projects/${projectId}` : "/api/projects";
      const method = projectId ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          ...(!isEditing && resolvedParentId ? { parentProjectId: resolvedParentId } : {}),
        }),
      });
      if (!res.ok) {
        toast.error("تعذّر الحفظ");
        return;
      }
      const created = projectId ? null : await res.json().catch(() => null);
      onOpenChange(false);
      if (isEditing) {
        toast.success("تم حفظ المشروع");
        router.refresh();
        return;
      }
      if (resolvedParentId) {
        toast.success("تمت إضافة البند داخل المشروع");
        router.push(`/projects/${resolvedParentId}`);
        router.refresh();
        return;
      }
      toast.success("تم إنشاء المشروع");
      if (created?.id) {
        router.push(`/projects/${created.id}`);
        return;
      }
      router.refresh();
    });
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {isEditing
              ? isNested
                ? "تعديل بند"
                : "تعديل مشروع"
              : isNested
                ? "إضافة بند داخل مشروع"
                : "إنشاء مشروع رئيسي"}
          </SheetTitle>
          <SheetDescription>
            {isNested
              ? "البند يُضاف تحت مشروع موجود (زفاف، بناء...). المشروع الواحد يضم أكثر من بند."
              : "أنشئ مشروعاً عاماً أولاً — مثل البناء — ثم أضف داخله بنوداً متعددة من القائمة."}
          </SheetDescription>
        </SheetHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          {!isEditing && !lockedParent && (
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setPlacement("new")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all",
                  placement === "new"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <FolderKanban className="h-4 w-4" />
                مشروع رئيسي
              </button>
              <button
                type="button"
                onClick={() => setPlacement("nested")}
                disabled={availableParents.length === 0}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all",
                  placement === "nested"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                  availableParents.length === 0 && "cursor-not-allowed opacity-50"
                )}
              >
                <ListPlus className="h-4 w-4" />
                بند داخل مشروع
              </button>
            </div>
          )}

          {isNested && !lockedParent && (
            <div>
              <Label>أضف إلى مشروع</Label>
              <Select
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
              >
                <option value="">اختر مشروعاً موجوداً...</option>
                {availableParents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </Select>
              {availableParents.length === 0 ? (
                <p className="mt-1 text-xs text-amber-700">
                  أنشئ مشروعاً رئيسياً أولاً ثم يمكنك إضافة بنود داخله.
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  المشروع المختار يحتفظ بكل البنود (مثل المقاولين في البناء).
                </p>
              )}
            </div>
          )}

          {lockedParent && (
            <p className="rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
              يُضاف داخل «{parentTitle || "المشروع الحالي"}»
            </p>
          )}

          <div>
            <Label>العنوان</Label>
            <Input
              {...form.register("title")}
              placeholder={isNested ? "مثال: DJ، قاعة، مصور" : "مثال: العرس، بناء البيت"}
            />
          </div>

          {isNested && (
            <div>
              <Label>المهنة / الدور</Label>
              <Input
                {...form.register("profession")}
                placeholder="مثال: DJ، مصور، مقاول كهرباء"
              />
            </div>
          )}

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
