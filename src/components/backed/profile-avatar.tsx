import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type ProfileAvatarProps = {
  avatarUrl?: string | null | undefined;
  displayName?: string | null | undefined;
  username?: string | null | undefined;
  className?: string | undefined;
  imageClassName?: string | undefined;
};

export function profileInitial(displayName?: string | null, username?: string | null) {
  return (displayName?.trim() || username?.trim() || "B").charAt(0).toUpperCase();
}

export function ProfileAvatar({
  avatarUrl,
  displayName,
  username,
  className,
  imageClassName,
}: ProfileAvatarProps) {
  const name = displayName?.trim() || username?.trim() || "Backed member";
  return (
    <Avatar className={cn("bg-secondary", className)}>
      {avatarUrl ? (
        <AvatarImage
          src={avatarUrl}
          alt={`${name} avatar`}
          loading="lazy"
          decoding="async"
          className={imageClassName}
        />
      ) : null}
      <AvatarFallback className="bg-secondary text-sm font-semibold text-secondary-foreground">
        {profileInitial(displayName, username)}
      </AvatarFallback>
    </Avatar>
  );
}
