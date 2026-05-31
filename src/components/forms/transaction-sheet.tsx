"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { transactionSchema, type TransactionInput } from "@/lib/validations/transactions";
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

type LookupOption = { id: string; name: string };

export function TransactionSheet({
  open,
  onOpenChange,
  initial,
  transactionId,
  lookups,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<TransactionInput>;
  transactionId?: string;
  lookups: {
    categories: LookupOption[];
    projects: LookupOption[];
    payees: LookupOption[];
    paymentMethods: LookupOption[];
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<TransactionInput>({
    resolver: zodResolver(transactionSchema) as any,
    defaultValues: {
      type: initial?.type ?? "EXPENSE",
      amount: initial?.amount ?? 0,
      occurredAt: initial?.occurredAt ?? new Date().toISOString().slice(0, 10),
      description: initial?.description ?? "",
      notes: initial?.notes ?? "",
      projectId: initial?.projectId ?? "",
      categoryId: initial?.categoryId ?? "",
      payeeId: initial?.payeeId ?? "",
      paymentMethodId: initial?.paymentMethodId ?? "",
      currency: "ILS",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const endpoint = transactionId ? `/api/transactions/${transactionId}` : "/api/transactions";
      const method = transactionId ? "PATCH" : "POST";
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
          <SheetTitle>{transactionId ? "تعديل معاملة" : "إضافة معاملة"}</SheetTitle>
          <SheetDescription>
            يتم الحفظ مباشرة مع تحديث الجدول بشكل فوري.
          </SheetDescription>
        </SheetHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>النوع</Label>
              <Select {...form.register("type")}>
                <option value="INCOME">دخل</option>
                <option value="EXPENSE">مصروف</option>
                <option value="TRANSFER">تحويل</option>
                <option value="SAVINGS_CONTRIBUTION">ادخار</option>
              </Select>
            </div>
            <div>
              <Label>المبلغ</Label>
              <Input type="number" step="0.01" {...form.register("amount")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>التاريخ</Label>
              <Input type="date" {...form.register("occurredAt")} />
            </div>
            <div>
              <Label>المشروع (اختياري)</Label>
              <Select {...form.register("projectId")}>
                <option value="">بدون مشروع</option>
                {lookups.projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الفئة</Label>
              <Select {...form.register("categoryId")}>
                <option value="">بدون فئة</option>
                {lookups.categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>طريقة الدفع</Label>
              <Select {...form.register("paymentMethodId")}>
                <option value="">غير محدد</option>
                {lookups.paymentMethods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label>الوصف</Label>
            <Input {...form.register("description")} />
          </div>

          <div>
            <Label>ملاحظات</Label>
            <Textarea {...form.register("notes")} />
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
