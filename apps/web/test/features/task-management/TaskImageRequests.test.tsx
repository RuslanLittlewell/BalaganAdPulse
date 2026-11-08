import { render, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { hookWrapper, server } from "@test/shared/index.js";
import { TaskAttachments } from "@/features/task-management/ui/TaskAttachments.js";
import { TaskImagePreview } from "@/features/task-management/ui/TaskImagePreview.js";

it("reuses attachment bytes after text changes and when a preview opens, releasing view URLs", async () => {
  const reads: string[] = [];
  server.use(http.get("/api/task-images/:id", ({ params }) => {
    reads.push(String(params.id));
    return new HttpResponse(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } });
  }));
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  const wrapper = hookWrapper();
  const views = (open: boolean) => <>
    <TaskAttachments imageIds={["i1", "i2"]} />
    <TaskImagePreview imageId="i1" label="Image" open={open} onOpenChange={() => {}} />
  </>;
  const view = render(views(false), { wrapper });
  await waitFor(() => expect(view.container.querySelectorAll("img")).toHaveLength(2));
  view.rerender(views(false));
  view.rerender(views(true));
  await waitFor(() => expect(document.querySelectorAll("img")).toHaveLength(3));
  expect(reads.sort()).toEqual(["i1", "i2"]);
  view.unmount();
  expect(revoke).toHaveBeenCalledTimes(3);
  wrapper.client.clear();
  revoke.mockRestore();
});
