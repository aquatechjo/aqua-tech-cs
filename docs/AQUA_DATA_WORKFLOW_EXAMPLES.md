# Aqua.Tech Data and Workflow Examples

## Form section

```tsx
<AquaFormSection
  eyebrow="New record"
  title="إضافة سجل"
  description="اجمع الحقول المرتبطة بعملية واحدة داخل قسم واضح."
>
  <form>
    <div className="aqua-form-grid">
      <AquaInput label="الاسم" required />
      <AquaSelect label="الحالة" span={6}>...</AquaSelect>
      <AquaInput label="المالك" span={6} />
    </div>
    <div className="aqua-form-actions">
      <AquaButton type="submit">حفظ</AquaButton>
    </div>
  </form>
</AquaFormSection>
```

## Filters

```tsx
<AquaFilterBar action="/dashboard/items" method="get" activeCount={2}>
  <AquaInput name="q" label="بحث" span={4} />
  <AquaSelect name="status" label="الحالة" span={2}>...</AquaSelect>
  <div className="aqua-filter-bar__actions" data-aqua-span="2">...</div>
</AquaFilterBar>
```

## Responsive table

Use `stack` when every row can become a labelled mobile card. Use `scroll` when column comparison is essential.

```tsx
<AquaTable mobileStrategy="stack" caption="قائمة السجلات">
  <thead>...</thead>
  <tbody>
    <tr>
      <td data-label="الاسم">Aqua.Tech</td>
      <td data-label="الحالة"><AquaBadge>نشط</AquaBadge></td>
    </tr>
  </tbody>
</AquaTable>
```

## Confirmation

```tsx
<AquaConfirmDialog
  open={open}
  onClose={() => setOpen(false)}
  onConfirm={archiveItem}
  title="أرشفة السجل"
  description="سيبقى السجل محفوظًا ويمكن استرجاعه لاحقًا."
  confirmLabel="أرشفة"
  confirmVariant="danger"
  tone="warning"
/>
```

## Page states

Use `AquaPageState` for full panels and `AquaTableStateRow` inside tables. Do not create page-specific empty or permission cards.
