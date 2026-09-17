"use client";

import { useActionState, useState } from "react";
import { format } from "date-fns";
import { postAnnouncement } from "@/app/actions/announcements";
import { Avatar } from "@/components/avatar";

export type Announcement = {
  id: string;
  body: string;
  createdAt: string | Date;
  authorId: string;
  authorName: string;
  authorAvatarColor: string | null;
  authorAvatarImage: string | null;
};

export function AnnouncementsBoard({
  announcements,
  canPost,
}: {
  announcements: Announcement[];
  canPost: boolean;
}) {
  const [state, formAction, pending] = useActionState(postAnnouncement, undefined);
  // The textarea is uncontrolled (matches the rest of this app's forms), so
  // clearing it after a successful post needs a fresh mount — bumping this
  // key remounts the <form>, resetting its inputs. Adjusted during render
  // (not an effect) the same way NewLogForm closes itself on success:
  // `state` is a fresh object each time the action runs, so comparing
  // identity against the last-handled one makes this a one-shot bump.
  const [formKey, setFormKey] = useState(0);
  const [handledState, setHandledState] = useState(state);

  if (state?.message === "success" && state !== handledState) {
    setHandledState(state);
    setFormKey((k) => k + 1);
  }

  return (
    <div className="space-y-4">
      {canPost && (
        <form key={formKey} action={formAction} className="rounded-[14px] border border-[#f2f2f2] bg-white p-5">
          <label className="mb-1.5 block text-xs font-medium text-zinc-600">Post an announcement</label>
          <textarea
            name="body"
            required
            rows={3}
            placeholder="Share something with the whole farm…"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
          {state?.errors?.body && <p className="mt-1 text-xs text-red-600">{state.errors.body[0]}</p>}
          {state?.message && state.message !== "success" && (
            <p className="mt-1 text-xs text-red-600">{state.message}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-3 rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {pending ? "Posting…" : "Post"}
          </button>
        </form>
      )}

      {announcements.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
          No announcements yet.
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="rounded-[14px] border border-[#f2f2f2] bg-white p-5">
              <div className="flex items-center gap-3">
                <Avatar name={a.authorName} avatarColor={a.authorAvatarColor} avatarImage={a.authorAvatarImage} size={32} />
                <div>
                  <p className="text-sm font-medium text-black">{a.authorName}</p>
                  <p className="text-xs text-[#808080]">{format(new Date(a.createdAt), "MMM d, yyyy · h:mm a")}</p>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-black">{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
