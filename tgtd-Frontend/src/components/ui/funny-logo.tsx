"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";

type MascotMood = "cool" | "excited" | "dizzy";

export function FunnyLogo({
  className,
  size = "md",
  showText = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}) {
  const { locale } = useLocale();
  const [mood, setMood] = useState<MascotMood>("cool");
  const [isWiggling, setIsWiggling] = useState(false);

  // Click vào logo sẽ chuyển đổi biểu cảm hài hước
  const cycleMood = () => {
    setIsWiggling(true);
    setMood((prev) => {
      if (prev === "cool") return "excited";
      if (prev === "excited") return "dizzy";
      return "cool";
    });
    setTimeout(() => setIsWiggling(false), 500);
  };

  const taglines = {
    cool: locale === "vi" ? "Lưu lại rồi đi, không để bữa nào! 🧳" : "Save now, explore later! 🧳",
    excited: locale === "vi" ? "Lên lịch lẹ lên, đi trốn thôi! 🚀" : "Lock it in, let's fly! 🚀",
    dizzy: locale === "vi" ? "Wishlist dài quá chưa biết đi đâu 😵‍💫" : "Wishlist full, where to first? 😵‍💫",
  };

  const iconSizes = {
    sm: "h-9 w-9",
    md: "h-11 w-11",
    lg: "h-14 w-14",
  };

  return (
    <div
      onClick={cycleMood}
      title={locale === "vi" ? "Bấm vào tôi để đổi biểu cảm vui nhộn!" : "Click me for funny moods!"}
      className={cn(
        "group flex cursor-pointer select-none items-center gap-3 transition-transform active:scale-95",
        className,
      )}
    >
      {/* Mascot Badge: Vali Biết Chạy Đeo Kính Râm Siêu Ngầu */}
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-2xl border border-white/90 bg-gradient-to-br from-[#ffffff] via-[#f0f9ff] to-[#e0f2fe] shadow-[-3px_-3px_10px_rgba(255,255,255,1),4px_6px_14px_rgba(2,132,199,0.3)] transition-all duration-300 group-hover:rotate-6 group-hover:scale-105",
          iconSizes[size],
          isWiggling && "animate-bounce",
        )}
      >
        <svg
          viewBox="0 0 64 64"
          className="h-4/5 w-4/5 drop-shadow-sm"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Quai xách vali */}
          <rect
            x="24"
            y="7"
            width="16"
            height="8"
            rx="4"
            stroke="#ff6b4a"
            strokeWidth="3.5"
            fill="none"
          />

          {/* Thân vali cam san hô */}
          <rect
            x="12"
            y="14"
            width="40"
            height="38"
            rx="10"
            fill="url(#suitcase-grad)"
            stroke="#f25330"
            strokeWidth="2.5"
          />

          {/* Sọc trang trí vali */}
          <line x1="22" y1="18" x2="22" y2="48" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.6" strokeLinecap="round" />
          <line x1="42" y1="18" x2="42" y2="48" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.6" strokeLinecap="round" />

          {/* Sticker máy bay tí hon trên thân */}
          <circle cx="20" cy="40" r="5" fill="#fef08a" />
          <text x="17.5" y="43" fontSize="6" fill="#1e293b">✈️</text>

          {/* Biểu cảm thay đổi theo mood */}
          {mood === "cool" && (
            /* Kính râm phi công siêu ngầu (Aviator Shades) */
            <g>
              {/* Mắt kính trái */}
              <path
                d="M18 24C18 22.5 20 21 23 21H27C29 21 30 22.5 30 25C30 28.5 27.5 30.5 24 30.5C20.5 30.5 18 28.5 18 25V24Z"
                fill="#1e293b"
              />
              {/* Mắt kính phải */}
              <path
                d="M34 24C34 22.5 35 21 37 21H41C44 21 46 22.5 46 25C46 28.5 43.5 30.5 40 30.5C36.5 30.5 34 28.5 34 25V24Z"
                fill="#1e293b"
              />
              {/* Cầu nối kính */}
              <line x1="29" y1="23" x2="35" y2="23" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
              {/* Vệt bóng kính phản chiếu bầu trời */}
              <path d="M20 23L27 28" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
              <path d="M36 23L43 28" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
              {/* Nụ cười nhếch mép tự tin */}
              <path
                d="M26 36C28 38 34 38 36 35"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>
          )}

          {mood === "excited" && (
            /* Mắt to tròn lấp lánh & miệng há to sung sướng */
            <g>
              <circle cx="24" cy="25" r="4.5" fill="#1e293b" />
              <circle cx="26" cy="23.5" r="1.5" fill="#ffffff" />
              <circle cx="40" cy="25" r="4.5" fill="#1e293b" />
              <circle cx="42" cy="23.5" r="1.5" fill="#ffffff" />
              {/* Má hồng say xỉn vì sắp đi du lịch */}
              <ellipse cx="18" cy="31" rx="2.5" ry="1.5" fill="#fda4af" opacity="0.8" />
              <ellipse cx="46" cy="31" rx="2.5" ry="1.5" fill="#fda4af" opacity="0.8" />
              {/* Miệng cười há to lè lưỡi */}
              <path d="M27 34C27 38 37 38 37 34Z" fill="#be123c" />
              <path d="M29 36C30 38 34 38 35 36" fill="#f43f5e" />
            </g>
          )}

          {mood === "dizzy" && (
            /* Mắt xoắn ốc hoa mắt vì chưa biết đi đâu */
            <g>
              <text x="18" y="29" fontSize="11" fill="#1e293b">@</text>
              <text x="34" y="29" fontSize="11" fill="#1e293b">@</text>
              {/* Miệng lượn sóng phân vân */}
              <path d="M26 36Q29 33 32 36T38 36" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            </g>
          )}

          {/* Chân lon ton mang dép lào */}
          <g>
            {/* Chân trái */}
            <ellipse cx="23" cy="54" rx="4.5" ry="2.5" fill="#0284c7" />
            <path d="M20 53Q23 51 26 53" stroke="#fef08a" strokeWidth="1.5" />
            {/* Chân phải (nhấc lên như đang chạy) */}
            <ellipse cx="41" cy="52" rx="4.5" ry="2.5" fill="#0284c7" transform="rotate(-15 41 52)" />
            <path d="M38 51Q41 49 44 51" stroke="#fef08a" strokeWidth="1.5" />
          </g>

          <defs>
            <linearGradient id="suitcase-grad" x1="12" y1="14" x2="52" y2="52" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ff7a59" />
              <stop offset="0.6" stopColor="#ff6b4a" />
              <stop offset="1" stopColor="#f25330" />
            </linearGradient>
          </defs>
        </svg>

        {/* Khói bay nhỏ xíu phía sau khi đang chạy lon ton */}
        <span className="absolute -bottom-1 -left-1 text-[10px] opacity-75">💨</span>
      </div>

      {/* Brand Text & Slogan hài hước */}
      {showText && (
        <div className="flex flex-col">
          <div className="font-heading text-2xl font-black tracking-tight text-foreground flex items-center gap-1.5 leading-none">
            <span>Togo</span>
            <span className="gradient-text">Wishlist</span>
            <span className="text-xs transition-transform group-hover:scale-125">
              {mood === "cool" ? "🕶️" : mood === "excited" ? "🏖️" : "🧭"}
            </span>
          </div>
          <span className="mt-1 text-[11px] font-bold text-muted transition-colors group-hover:text-primary">
            {taglines[mood]}
          </span>
        </div>
      )}
    </div>
  );
}
