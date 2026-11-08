import { useEffect, useState } from "react";

export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [resolved, setResolved] = useState<{ blob: Blob; url: string }>();
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setResolved({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return resolved?.blob === blob ? resolved?.url : undefined;
}
