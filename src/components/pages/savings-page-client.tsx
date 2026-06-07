"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { savingsSchema, type SavingsInput } from "@/lib/validations/savings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { InlineSavingsTable } from "@/components/tables/inline-savings-table";

type SavingsRow = {
  id: string;
  title: string;
  type: "JAMIYA" | "PERSONAL" | "KUPOT";
  monthlyContribution: number;
  targetAmount: number | null;
  status: "ACTIVE" | "COMPLETED" | "PAUSED" | "CANCELLED";
};

export function SavingsPageClient({ items }: { items: SavingsRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<SavingsInput>({
    resolver: zodResolver(savingsSchema) as any,
    defaultValues: {
      title: "",
      type: "JAMIYA",
      monthlyContribution: 0,
      targetAmount: undefined,
      payoutDate: "",
      startDate: new Date().toISOString().slice(0, 10),
      status: "ACTIVE",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await fetch("/api/savings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        toast.error("فشل الإضافة");
        return;
      }
      toast.success("تمت إضافة خطة الادخار");
      form.reset();
      router.refresh();
    });
  });

  return (
    <div className="space-y-6">
      <InlineSavingsTable items={items} />

      <Card>
        <CardHeader>
          <CardTitle>إضافة خطة جديدة</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={onSubmit}>
            <div>
              <Label>العنوان</Label>
              <Input {...form.register("title")} />
            </div>
            <div>
              <Label>النوع</Label>
              <Select {...form.register("type")}>
                <option value="JAMIYA">جمعية</option>
                <option value="PERSONAL">ادخار شخصي</option>
                <option value="KUPOT">קופות (פנסיה)</option>
              </Select>
            </div>
            <div>
              <Label>المساهمة الشهرية</Label>
              <Input type="number" step="0.01" {...form.register("monthlyContribution")} />
            </div>
            <div>
              <Label>الهدف</Label>
              <Input type="number" step="0.01" {...form.register("targetAmount")} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? "..." : "إضافة"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
