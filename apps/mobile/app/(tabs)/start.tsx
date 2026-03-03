import { useCallback } from "react";
import { router } from "expo-router";
import { useFocusEffect } from "expo-router";

// The + tab navigates to the Routines screen every time it's tapped
export default function StartTab() {
  useFocusEffect(
    useCallback(() => {
      router.navigate("/(tabs)/routines");
    }, [])
  );

  return null;
}
