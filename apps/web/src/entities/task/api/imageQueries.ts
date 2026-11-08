import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { taskImagesApi } from "./api.js";

export function useTaskImageUrl(imageId: string | null) {
  const image = useQuery({
    queryKey: ["task-images", imageId],
    queryFn: ({ signal }) => taskImagesApi.blob(imageId!, signal),
    enabled: imageId !== null,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });
  const [resolved, setResolved] = useState<{ blob: Blob; url: string } | null>(null);

  useEffect(() => {
    if (!image.data) return;
    const url = URL.createObjectURL(image.data);
    setResolved({ blob: image.data, url });
    return () => URL.revokeObjectURL(url);
  }, [image.data]);

  return { src: resolved?.blob === image.data ? resolved?.url ?? null : null, failed: image.isError };
}
