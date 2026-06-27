"use client";

import flatpickr from "flatpickr";
import { Arabic } from "flatpickr/dist/l10n/ar";
import { useEffect, useRef } from "react";

type FlatpickrInput = HTMLInputElement & {
  _flatpickr?: flatpickr.Instance;
};

export default function AquaDatePicker({
  value,
  onChange,
  placeholder = "اختر التاريخ",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<FlatpickrInput | null>(null);

  useEffect(() => {
    if (!inputRef.current) return;

    const picker = flatpickr(inputRef.current, {
      locale: Arabic,
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d/m/Y",
      altInputClass: "form-control aqua-control aqua-date-input text-center",
      allowInput: false,
      disableMobile: true,
      defaultDate: value || undefined,
      onReady: (_selectedDates, _dateStr, instance) => {
        if (instance.altInput) {
          instance.altInput.placeholder = placeholder;
          instance.altInput.setAttribute("dir", "ltr");
          instance.altInput.setAttribute("readOnly", "true");
        }
      },
      onChange: (_selectedDates, dateStr) => {
        onChange(dateStr);
      },
    });

    return () => {
      picker.destroy();
    };
  }, []);

  useEffect(() => {
    const instance = inputRef.current?._flatpickr;

    if (instance) {
      instance.setDate(value || "", false, "Y-m-d");
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      type="text"
      className="aqua-date-original"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}