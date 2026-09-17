"use client";

import { useActionState, useRef, useTransition } from "react";
import { Camera } from "lucide-react";
import { updateAvatar, removeAvatar, updateProfileName } from "@/app/actions/profile";
import { Avatar } from "@/components/avatar";

export function ProfileCard({
  name,
  email,
  role,
  avatarColor,
  avatarImage,
  isImpersonating = false,
}: {
  name: string;
  email: string;
  role: string;
  avatarColor: string | null;
  avatarImage: string | null;
  // True only while an admin is "viewing as" this employee — editing
  // someone else's name/photo while spectating is blocked server-side
  // regardless, but the controls are disabled here too rather than
  // inviting a click that's just going to fail.
  isImpersonating?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarState, avatarAction, avatarPending] = useActionState(updateAvatar, undefined);
  const [isRemoving, startRemoveTransition] = useTransition();
  const [nameState, nameAction, namePending] = useActionState(updateProfileName, undefined);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      e.target.form?.requestSubmit();
    }
  };

  const handleRemove = () => {
    startRemoveTransition(async () => {
      await removeAvatar();
    });
  };

  return (
    <div className="max-w-xl rounded-[14px] border border-[#f2f2f2] bg-white p-6">
      <p className="text-base text-black">Your profile</p>

      <div className="mt-4 flex items-center gap-4">
        <div className="relative">
          <Avatar name={name} avatarColor={avatarColor} avatarImage={avatarImage} size={64} className="text-lg" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarPending || isImpersonating}
            title={isImpersonating ? "Switch back to your own account to change this." : undefined}
            className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-black text-white hover:bg-zinc-800 disabled:opacity-60"
            aria-label="Change photo"
          >
            <Camera size={12} />
          </button>
        </div>
        <div>
          <form action={avatarAction}>
            <input
              ref={fileInputRef}
              type="file"
              name="avatar"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </form>
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarPending || isImpersonating}
              className="font-medium text-[#146c44] hover:underline disabled:opacity-60"
            >
              {avatarPending ? "Uploading…" : "Change photo"}
            </button>
            {avatarImage && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isRemoving || isImpersonating}
                className="text-[#808080] hover:text-black disabled:opacity-60"
              >
                {isRemoving ? "Removing…" : "Remove"}
              </button>
            )}
          </div>
          {avatarState?.message && avatarState.message !== "success" && (
            <p className="mt-1 text-xs text-red-600">{avatarState.message}</p>
          )}
        </div>
      </div>

      <form action={nameAction} className="mt-6 space-y-4">
        <div>
          <label htmlFor="profile-name" className="mb-1.5 block text-sm font-medium text-zinc-700">
            Name
          </label>
          <input
            id="profile-name"
            name="name"
            defaultValue={name}
            disabled={isImpersonating}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500"
          />
          {nameState?.errors?.name && <p className="mt-1 text-xs text-red-600">{nameState.errors.name[0]}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">Email</label>
          <input
            value={email}
            disabled
            readOnly
            className="w-full cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">Role</label>
          <input
            value={role}
            disabled
            readOnly
            className="w-full cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm capitalize text-zinc-500"
          />
        </div>
        {nameState?.message && nameState.message !== "success" && (
          <p className="text-sm text-red-600">{nameState.message}</p>
        )}
        <button
          type="submit"
          disabled={namePending || isImpersonating}
          title={isImpersonating ? "Switch back to your own account to make changes." : undefined}
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {namePending ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
