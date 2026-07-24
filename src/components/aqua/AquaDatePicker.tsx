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
  const onChangeRef = useRef(onChange);
  const placeholderRef = useRef(placeholder);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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
      onReady: (_selectedDates, _dateStr, instance) => {
        if (instance.altInput) {
          instance.altInput.placeholder = placeholderRef.current;
          instance.altInput.setAttribute("dir", "ltr");
          instance.altInput.setAttribute("readOnly", "true");
        }
      },
      onChange: (_selectedDates, dateStr) => {
        onChangeRef.current(dateStr);
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
