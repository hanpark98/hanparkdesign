import React, { useMemo, useState, useId } from "react";

type Category = "film" | "book" | "music";
type Review = {
  id: string;
  title: string;
  category: Category;
  rating: number; // 0~5, 0.5 단위 허용
  date: string;   // "2025-11-02" 같은 ISO 날짜
  blurb: string;
  link?: string;
  creator?: string; // 감독/저자/아티스트
  tags?: string[];
  cover?: string;   // 썸네일(optional)
};

type Props = {
  reviews: Review[];
  initialCategory?: Category | "all";
  initialSort?: "date" | "rating";
  className?: string;
};

export default function ReviewList({
  reviews,
  initialCategory = "all",
  initialSort = "date",
  className = "",
}: Props) {
  const [category, setCategory] = useState<"all" | Category>(initialCategory);
  const [sort, setSort] = useState<"date" | "rating">(initialSort);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const byCat = reviews.filter((r) => category === "all" || r.category === category);
    const term = q.trim().toLowerCase();
    if (!term) return byCat;
    return byCat.filter((r) => {
      const hay = [r.title, r.creator ?? "", r.blurb, ...(r.tags ?? []), r.category]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [reviews, category, q]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "rating") {
      arr.sort((a, b) => b.rating - a.rating || cmpDate(b.date, a.date));
    } else {
      arr.sort((a, b) => cmpDate(b.date, a.date));
    }
    return arr;
  }, [filtered, sort]);

  return (
    <section
      className={`mt-6 ${className}`}
      style={{
        // 네비게이션과 동일한 좌우 여백
        paddingInlineStart: "max(var(--nav-side-gap), env(safe-area-inset-left))",
        paddingInlineEnd: "max(var(--nav-side-gap), env(safe-area-inset-right))",
      }}
    >
      {/* 중앙정렬 컨테이너 */}
      <div className="mx-auto max-w-3xl">
        {/* Controls */}
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {(["all", "film", "book", "music"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={[
                  "px-3 py-1.5 rounded-full text-sm border cursor-pointer",
                  category === c
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
                ].join(" ")}
              >
                {label(c)}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="검색: 제목·감독/저자·태그"
              className="w-48 sm:w-64 px-3 py-1.5 rounded-md border border-gray-200 text-sm placeholder:text-gray-400"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "date" | "rating")}
              className="px-3 py-1.5 rounded-md border border-gray-200 text-sm bg-white"
            >
              <option value="date">최신순</option>
              <option value="rating">별점순</option>
            </select>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-3">
          총 {sorted.length}개 · {label(category)} · {sort === "date" ? "최신순" : "별점순"}
        </p>

        <ul className="grid gap-3">
          {sorted.map((r, i) => {
            // 영화/책: 2:3 포스터, 음악: 1:1 앨범커버
            const isSquare = r.category === "music";
            const aspect = isSquare ? "aspect-square" : "aspect-[2/3]";
            const w = 256;                   // 고정 intrinsic width
            const h = isSquare ? 256 : 384;  // 고정 intrinsic height

            return (
              <li
                key={r.id}
                className="border border-gray-200 rounded-2xl p-4 hover:shadow-xs transition"
              >
                <div className="flex items-start gap-4">
                  {r.cover ? (
                    <img
                      alt={`${r.title} 썸네일`}
                      src={r.cover}
                      width={w}
                      height={h}                                      // CLS 방지
                      className={`w-48 sm:w-56 md:w-64 ${aspect} rounded-2xl object-cover flex-none`}
                      loading={i < 2 ? "eager" : "lazy"}             // 상단 2개만 즉시 로딩
                      decoding="async"
                    />
                  ) : null}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold leading-tight">
                        {r.link ? (
                          <a href={r.link} target="_blank" rel="noreferrer" className="hover:underline">
                            {r.title}
                          </a>
                        ) : (
                          r.title
                        )}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {fmtDate(r.date)} · {label(r.category)}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2">
                      <Stars value={r.rating} />
                      <span className="text-sm text-gray-600">{r.rating.toFixed(1)}</span>
                      {r.creator ? <span className="text-sm text-gray-500">· {r.creator}</span> : null}
                    </div>

                    <p className="mt-2 text-sm text-gray-800">{r.blurb}</p>

                    {r.tags && r.tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {r.tags.map((t) => (
                          <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            #{t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <noscript>
          <p className="mt-6 text-sm text-gray-500">필터·정렬은 자바스크립트 활성화 시 동작한다.</p>
        </noscript>
      </div>
    </section>
  );
}

function label(c: "all" | Category) {
  return c === "all" ? "전체" : c === "film" ? "영화" : c === "book" ? "책" : "음악";
}

function fmtDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric" }).format(dt);
}

// ISO 문자열은 문자열 비교로 정렬 안전
function cmpDate(a: string, b: string) {
  return a.localeCompare(b);
}

function Stars({ value }: { value: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="inline-flex items-center" aria-label={`별점 ${value} / 5`}>
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} filled />
      ))}
      {half ? <Star half /> : null}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} />
      ))}
    </span>
  );
}

function Star({ filled, half }: { filled?: boolean; half?: boolean }) {
  const gid = useId();
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`half-${gid}`}>
          <stop offset="50%" stopColor="currentColor" />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 17.3l-6.18 3.25 1.18-6.88L1.99 8.9l6.92-1 3.09-6.27 3.09 6.27 6.92 1-5.01 4.77 1.18 6.88z"
        fill={filled ? "currentColor" : half ? `url(#half-${gid})` : "none"}
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}
