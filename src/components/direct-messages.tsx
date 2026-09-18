"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { format } from "date-fns";
import { Mail, MailOpen } from "lucide-react";
import { sendDirectMessage, markConversationRead, markConversationUnread } from "@/app/actions/messages";
import { Avatar } from "@/components/avatar";

export type Conversation = {
  otherUserId: string;
  otherUserName: string;
  otherUserAvatarColor: string | null;
  otherUserAvatarImage: string | null;
  lastBody: string;
  lastCreatedAt: string | Date;
  lastFromMe: boolean;
  unreadCount: number;
};

export type FarmMember = { id: string; name: string; avatarColor: string | null; avatarImage: string | null };

export type ThreadMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string | Date;
  readAt: string | Date | null;
};

export function DirectMessages({
  currentUserId,
  conversations,
  farmMembers,
  selectedUserId,
  thread,
  disabled = false,
}: {
  currentUserId: string;
  conversations: Conversation[];
  farmMembers: FarmMember[];
  selectedUserId: string | null;
  thread: ThreadMessage[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [showPicker, setShowPicker] = useState(false);
  const [isTogglingRead, startToggleReadTransition] = useTransition();

  const toggleConversationRead = (otherUserId: string, isUnread: boolean) => {
    startToggleReadTransition(async () => {
      if (isUnread) {
        await markConversationRead(otherUserId);
      } else {
        await markConversationUnread(otherUserId);
      }
    });
  };

  // Opening a conversation marks the other person's messages read — this
  // is a real write (readAt), so it's a server action call, not something
  // derived during the page's server render.
  useEffect(() => {
    if (selectedUserId && !disabled) {
      markConversationRead(selectedUserId);
    }
  }, [selectedUserId, disabled]);

  const selectConversation = (userId: string) => {
    setShowPicker(false);
    router.push(`${pathname}?tab=direct&with=${userId}`);
  };

  const selectedConversation = conversations.find((c) => c.otherUserId === selectedUserId);
  const selectedMember = farmMembers.find((m) => m.id === selectedUserId);
  const selectedName = selectedConversation?.otherUserName ?? selectedMember?.name ?? "";

  const contactedIds = new Set(conversations.map((c) => c.otherUserId));
  const notYetContacted = farmMembers.filter((m) => !contactedIds.has(m.id));

  return (
    <div className="flex h-[600px] overflow-hidden rounded-[14px] border border-[#f2f2f2] bg-white">
      <div className="flex w-72 shrink-0 flex-col border-r border-[#f2f2f2]">
        <div className="relative border-b border-[#f2f2f2] p-3">
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className="w-full rounded-full bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            + New Message
          </button>
          {showPicker && (
            <div className="absolute left-3 right-3 z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
              {farmMembers.length === 0 && <p className="p-3 text-xs text-zinc-400">No one else on this farm yet.</p>}
              {notYetContacted.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectConversation(m.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50"
                >
                  <Avatar name={m.name} avatarColor={m.avatarColor} avatarImage={m.avatarImage} size={24} />
                  {m.name}
                </button>
              ))}
              {notYetContacted.length === 0 && farmMembers.length > 0 && (
                <p className="p-3 text-xs text-zinc-400">You&apos;ve already messaged everyone — pick them from the list.</p>
              )}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && <p className="p-4 text-center text-xs text-zinc-400">No conversations yet.</p>}
          {conversations.map((c) => (
            <div
              key={c.otherUserId}
              className={`group flex w-full items-start gap-1 border-b border-[#f2f2f2] pl-3 pr-1.5 py-3 hover:bg-zinc-50 ${
                c.otherUserId === selectedUserId ? "bg-zinc-50" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => selectConversation(c.otherUserId)}
                className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
              >
                <Avatar
                  name={c.otherUserName}
                  avatarColor={c.otherUserAvatarColor}
                  avatarImage={c.otherUserAvatarImage}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-black">{c.otherUserName}</p>
                    {c.unreadCount > 0 && (
                      <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-semibold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-zinc-500">
                    {c.lastFromMe ? "You: " : ""}
                    {c.lastBody}
                  </p>
                </div>
              </button>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggleConversationRead(c.otherUserId, c.unreadCount > 0)}
                  disabled={isTogglingRead}
                  title={c.unreadCount > 0 ? "Mark as read" : "Mark as unread"}
                  className="mt-0.5 shrink-0 rounded-full p-1.5 text-zinc-400 opacity-0 hover:bg-zinc-100 hover:text-zinc-600 group-hover:opacity-100 disabled:opacity-60"
                >
                  {c.unreadCount > 0 ? <MailOpen size={14} /> : <Mail size={14} />}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        {selectedUserId ? (
          <>
            <div className="border-b border-[#f2f2f2] px-4 py-3">
              <p className="text-sm font-medium text-black">{selectedName}</p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {thread.length === 0 && <p className="text-center text-xs text-zinc-400">Say hello.</p>}
              {thread.map((m) => {
                const fromMe = m.senderId === currentUserId;
                return (
                  <div key={m.id} className={`flex ${fromMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                        fromMe ? "bg-black text-white" : "bg-zinc-100 text-black"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className={`mt-1 text-[10px] ${fromMe ? "text-zinc-300" : "text-zinc-400"}`}>
                        {format(new Date(m.createdAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <ComposeBox key={selectedUserId} recipientId={selectedUserId} disabled={disabled} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
            Select a conversation, or start a new one.
          </div>
        )}
      </div>
    </div>
  );
}

function ComposeBox({ recipientId, disabled }: { recipientId: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(sendDirectMessage, undefined);
  const [formKey, setFormKey] = useState(0);
  const [handledState, setHandledState] = useState(state);

  if (state?.message === "success" && state !== handledState) {
    setHandledState(state);
    setFormKey((k) => k + 1);
  }

  return (
    <form key={formKey} action={formAction} className="border-t border-[#f2f2f2] p-3">
      <input type="hidden" name="recipientId" value={recipientId} />
      <div className="flex items-end gap-2">
        <textarea
          name="body"
          required
          rows={1}
          disabled={disabled}
          placeholder={disabled ? "Switch back to your own account to send messages." : "Type a message…"}
          className="flex-1 resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-50"
        />
        <button
          type="submit"
          disabled={pending || disabled}
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {pending ? "…" : "Send"}
        </button>
      </div>
      {state?.message && state.message !== "success" && <p className="mt-1 text-xs text-red-600">{state.message}</p>}
    </form>
  );
}
