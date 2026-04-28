"use client";

import { useEffect, useState } from "react";
import { resolveFeatureControlState, type StyleControlState } from "@/lib/style-controls";

export function useLabFeatureAvailability(controlId: string, fallbackEnabled: boolean) {
  const [state, setState] = useState(() =>
    resolveFeatureControlState(undefined, fallbackEnabled)
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/style-controls", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const controls = Array.isArray(data.controls) ? data.controls : [];
        const control = controls.find(
          (item: StyleControlState) => item.style_id === controlId
        );
        setState(resolveFeatureControlState(control, fallbackEnabled));
      })
      .catch(() => {
        if (cancelled) return;
        setState(resolveFeatureControlState(undefined, fallbackEnabled));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [controlId, fallbackEnabled]);

  return {
    isLoading,
    isVisible: state.is_visible,
    isEnabled: state.is_enabled,
  };
}
