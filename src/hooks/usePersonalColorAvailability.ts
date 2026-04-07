"use client";

import { useEffect, useState } from "react";
import { PERSONAL_COLOR_LAB_ENABLED } from "@/lib/feature-flags";
import {
  PERSONAL_COLOR_CONTROL_ID,
  resolveFeatureControlState,
  type StyleControlState,
} from "@/lib/style-controls";

export function usePersonalColorAvailability() {
  const [state, setState] = useState(() =>
    resolveFeatureControlState(undefined, PERSONAL_COLOR_LAB_ENABLED)
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/style-controls", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const controls = Array.isArray(data.controls) ? data.controls : [];
        const personalColorControl = controls.find(
          (control: StyleControlState) => control.style_id === PERSONAL_COLOR_CONTROL_ID
        );
        setState(resolveFeatureControlState(personalColorControl, PERSONAL_COLOR_LAB_ENABLED));
      })
      .catch(() => {
        if (cancelled) return;
        setState(resolveFeatureControlState(undefined, PERSONAL_COLOR_LAB_ENABLED));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    isLoading,
    isVisible: state.is_visible,
    isEnabled: state.is_enabled,
  };
}
