import { getCurrentUser } from "@/lib/dal";
import { getFarmJoinCode } from "@/lib/queries";
import { JoinCodeCard } from "@/components/join-code-card";
import { ProfileCard } from "@/components/profile-card";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  // Presentational scoping on top of the real check — regenerateJoinCode()
  // itself re-verifies admin status server-side, the same pattern the
  // sidebar's canSwitchUser uses for Switch User.
  const joinCode = user.role === "admin" ? await getFarmJoinCode(user.farmId) : null;

  return (
    <div className="px-[30px] py-[30px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-black">Settings</h1>
        <p className="mt-1 text-base text-[#4d4d4d]">Farm profile, notification, and integration settings.</p>
      </div>
      <div className="flex flex-col gap-6">
        <ProfileCard
          name={user.name}
          email={user.email}
          role={user.role}
          avatarColor={user.avatarColor}
          avatarImage={user.avatarImage}
          isImpersonating={!!user.impersonatedBy}
        />
        {joinCode && <JoinCodeCard joinCode={joinCode} />}
      </div>
    </div>
  );
}
