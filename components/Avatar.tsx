import { avatarColorFor } from "@/lib/avatarColor";
import type { Profile } from "@/lib/types";

type Props = {
  profile: Pick<Profile, "id" | "avatar_emoji" | "avatar_url">;
  size?: string;
};

export default function Avatar({ profile, size = "h-12 w-12" }: Props) {
  if (profile.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profile.avatar_url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center rounded-full text-2xl ${avatarColorFor(profile.id)}`}
    >
      {profile.avatar_emoji}
    </span>
  );
}
