"use client";

import { useEffect, useState } from "react";
import { AUDITION_ENABLED } from "@/lib/feature-flags";
import {
  AUDITION_CONTROL_ID,
  resolveFeatureControlState,
  type StyleControlState,
} from "@/lib/style-controls";

export function useAuditionAvailability() {
  const [state, setState] = useState(() =>
    resolveFeatureControlState(undefined, AUDITION_ENABLED)
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/style-controls", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const controls = Array.isArray(data.controls) ? data.controls : [];
        const auditionControl = controls.find(
          (control: StyleControlState) => control.style_id === AUDITION_CONTROL_ID
        );
        setState(resolveFeatureControlState(auditionControl, AUDITION_ENABLED));
      })
      .catch(() => {
        if (cancelled) return;
        setState(resolveFeatureControlState(undefined, AUDITION_ENABLED));
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
