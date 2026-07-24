# Aqua.Tech Primitive State Examples

These examples document the approved DS-02 public component API. They are not page-specific visual specifications.

## Button

```tsx
<AquaButton>حفظ</AquaButton>
<AquaButton variant="secondary">معاينة</AquaButton>
<AquaButton variant="ghost">إلغاء</AquaButton>
<AquaButton variant="danger">حذف</AquaButton>
<AquaButton loading loadingLabel="جارٍ الحفظ">حفظ</AquaButton>
<AquaButton disabled>غير متاح</AquaButton>
```

## Fields

```tsx
<AquaInput label="اسم العميل" placeholder="أدخل الاسم" required />
<AquaInput label="البريد الإلكتروني" dir="ltr" error="البريد غير صالح" />

<AquaSelect label="الحالة" defaultValue="active">
  <option value="active">نشط</option>
  <option value="inactive">غير نشط</option>
</AquaSelect>

<AquaTextarea
  label="الملاحظات"
  hint="اكتب المعلومات الضرورية فقط"
  rows={5}
/>
```

## Feedback

```tsx
<AquaAlert variant="success" title="تم الحفظ">
  تم تحديث البيانات بنجاح.
</AquaAlert>

<AquaSpinner label="جارٍ تحميل البيانات" />
<AquaSkeleton shape="card" />

aquaToast.success("تم حفظ التعديلات")
aquaToast.error("تعذر إكمال العملية")
```

## Empty state

```tsx
<AquaEmptyState
  title="لا توجد مشاريع بعد"
  description="أنشئ أول مشروع لبدء متابعة التنفيذ."
  action={<AquaButton>إنشاء مشروع</AquaButton>}
/>
```

## Usage rules

- Use semantic variants for meaning; do not recolor success, warning, danger, or information with a product accent.
- Use `loading` rather than manually swapping labels and disabling buttons.
- Use `error` on fields so `aria-invalid` and descriptive IDs are generated consistently.
- Keep email, phone, IDs, codes, and machine dates in `dir="ltr"` when shown inside RTL layouts.
- Do not add utility-class recipes to shared primitives. Extend the token and contract layer only when a reusable requirement is approved.
