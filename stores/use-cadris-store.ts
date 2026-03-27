"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FramingStyle, RecordingMode } from "@/lib/domain/cadris";

interface CadrisStore {
  defaultMode: RecordingMode;
  defaultStyle: FramingStyle;
  showFaceBoxes: boolean;
  cinematicSmoothing: number;
  setDefaults: (mode: RecordingMode, style: FramingStyle) => void;
  setShowFaceBoxes: (value: boolean) => void;
  setCinematicSmoothing: (value: number) => void;
}

export const useCadrisStore = create<CadrisStore>()(
  persist(
    (set) => ({
      defaultMode: "podcast",
      defaultStyle: "calm",
      showFaceBoxes: true,
      cinematicSmoothing: 0.72,
      setDefaults: (mode, style) =>
        set({
          defaultMode: mode,
          defaultStyle: style
        }),
      setShowFaceBoxes: (value) => set({ showFaceBoxes: value }),
      setCinematicSmoothing: (value) => set({ cinematicSmoothing: value })
    }),
    {
      name: "cadris-store"
    }
  )
);
