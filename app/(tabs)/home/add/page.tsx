"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import type { FoundProfile } from "@/lib/types";

export default function AddFriendPage() {
  const [myCode, setMyCode] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<FoundProfile | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("friend_code").eq("id", user.id).single();
      if (data) {
        setMyCode(data.friend_code);
        setQrDataUrl(await QRCode.toDataURL(data.friend_code, { width: 220, margin: 1 }));
      }
    })();
  }, []);

  function stopScan() {
    setScanning(false);
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => stopScan, []);

  async function runSearch(rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    setSearching(true);
    setError(null);
    setFound(null);
    setSent(false);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("find_profile_by_code", { code });
    setSearching(false);
    if (error) {
      setError("検索に失敗しました");
      return;
    }
    if (!data || data.length === 0) {
      setError("ユーザーが見つかりませんでした");
      return;
    }
    setFound(data[0]);
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    void runSearch(searchInput);
  }

  function tick() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height);
    if (result?.data) {
      stopScan();
      setSearchInput(result.data);
      void runSearch(result.data);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  async function startScan() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError("カメラを起動できませんでした。カメラへのアクセスを許可してください");
      setScanning(false);
    }
  }

  async function sendRequest() {
    if (!found) return;
    setSending(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("friend_requests").insert({ from_user: user.id, to_user: found.id });
    setSending(false);
    if (error) {
      setError(
        error.message.includes("duplicate") || error.code === "23505"
          ? "すでに申請中、またはブロックされています"
          : "送信に失敗しました",
      );
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-neutral-950">
        <Link href="/home" aria-label="友達一覧に戻る" className="text-lg">
          ←
        </Link>
        <h1 className="text-lg font-semibold">友達を追加</h1>
      </header>

      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-4 pb-20">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">自分のID・QRコード</h2>
          <div className="flex items-center gap-4 rounded-xl border border-black/10 p-4 dark:border-white/10">
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="自分のQRコード" className="h-28 w-28 shrink-0" />
            )}
            <div>
              <p className="text-xs text-black/50 dark:text-white/50">あなたのID</p>
              <p className="font-mono text-lg tracking-wider">{myCode ?? "..."}</p>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">QRコードを読み取る</h2>
          {scanning ? (
            <div className="space-y-2">
              <div className="overflow-hidden rounded-xl bg-black">
                <video ref={videoRef} playsInline muted className="w-full" />
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <button
                type="button"
                onClick={stopScan}
                className="w-full rounded-full border border-black/15 px-4 py-2 text-sm dark:border-white/20"
              >
                カメラを閉じる
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startScan}
              className="w-full rounded-full bg-[#06C755] px-4 py-2 text-sm font-medium text-white"
            >
              カメラでQRコードを読み取る
            </button>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">IDで検索</h2>
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="8桁のID"
              className="flex-1 rounded-lg border border-black/15 px-3 py-2 uppercase outline-none focus:border-black/40 dark:border-white/20 dark:bg-neutral-900 dark:focus:border-white/50"
            />
            <button
              type="submit"
              disabled={searching || !searchInput.trim()}
              className="shrink-0 rounded-full bg-[#06C755] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {searching ? "検索中..." : "検索"}
            </button>
          </form>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {found && (
            <div className="flex items-center gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
              <Avatar profile={found} />
              <span className="flex-1 font-medium">{found.display_name}</span>
              {sent ? (
                <span className="text-sm text-black/50 dark:text-white/50">申請済み</span>
              ) : (
                <button
                  type="button"
                  onClick={sendRequest}
                  disabled={sending}
                  className="shrink-0 rounded-full bg-[#06C755] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {sending ? "送信中..." : "友達申請を送る"}
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
