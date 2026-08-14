type Props = {
  xHandle: string | null;
  instagramHandle: string | null;
};

export default function SnsLinks({ xHandle, instagramHandle }: Props) {
  if (!xHandle && !instagramHandle) return null;

  return (
    <div className="flex justify-center gap-4">
      {xHandle && (
        <a
          href={`https://x.com/${xHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-black/60 underline dark:text-white/60"
        >
          X: @{xHandle}
        </a>
      )}
      {instagramHandle && (
        <a
          href={`https://instagram.com/${instagramHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-black/60 underline dark:text-white/60"
        >
          Instagram: @{instagramHandle}
        </a>
      )}
    </div>
  );
}
