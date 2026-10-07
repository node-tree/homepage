// ═══════════════════════════════════════════════════════════════════════
// YeokryuWalk.tsx — 〈역류〉 사운드 산책 전용 모바일 페이지 (라우트 /yeokryu/walk)
//
// 쓰임: 2026-10-11(일) 16:35 흙물 걷기 · 스페이스 전원 → 강경 갑문(약 800 m).
//   리플렛 지도의 ①–④ 자리에 닿으면 멈춰 서서 그 번호를 누른다. 한 번호가 끝나도 다음 번호로
//   저절로 넘어가지 않는다(걷는 빠르기가 사람마다 달라서). 비가 오면 「전체 듣기」 한 파일을 집에서 듣는다.
// 공개 방식: 리플렛 QR 로만 닿는다. 메뉴·sitemap·다른 페이지 링크에 넣지 않는다.
//   robots meta = noindex, nofollow. robots.txt 에는 적지 않는다(주소가 드러나므로).
// 단독 화면: 사이트 헤더 없이 선다. SambeWalker 는 v5 경로에서만 켜지므로 여기엔 안 뜬다.
// 소리: public/audio/yeokryu-walk/walk-{1..4,full}.m4a (AAC 모노 128 kbps, 목소리 -17 LUFS).
//   원본 · 대본 · 믹스 스크립트 = ~/역류-lab/_collab/claude/walk-sound-20261006/
// 화면을 꺼도 이어지게: Web Audio 가 아니라 <audio> 요소 하나로 스트리밍하고 Media Session 을 건다.
//   번호를 바꿀 때는 누른 그 순간 src 를 바꾸고 play() 를 부른다(iOS 제스처 조건).
//   잠금화면 · 이어폰의 「다음 · 이전」으로도 번호를 넘긴다(기기마다 지원이 다르다 → 현장 시험).
// 끊겨도 이어서: 번호마다 마지막 위치를 sessionStorage 에 둔다(3초 간격 + pause · 화면 전환 · 오류 · 떠날 때).
//   끝까지 들었거나, 저장 뒤 2시간이 지났거나, 저장 위치가 전체 길이 이상이면 처음부터.
//   저장소가 막혀 있어도(사생활 모드 · 쿠키 차단) 조용히 처음부터 재생한다.
// 서체: ./fonts 의 페이지 전용 서브셋(이 파일의 글자만). 문구를 바꾸면
//   scripts/build-fonts-yeokryu-walk.sh 를 다시 돌린다(누락 글자는 시스템 한글 서체로 폴백).
// ═══════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import './YeokryuWalk.css';

interface Track {
  id: string;
  no: string;
  title: string;
  place: string;
  len: string;
  src: string;
}
/** 걷는 길의 네 자리(리플렛 지도 ①–④) */
const TRACKS: Track[] = [
  { id: '1', no: '①', title: '나서기', place: '스페이스 전원 앞', len: '3:44', src: '/audio/yeokryu-walk/walk-1.m4a' },
  { id: '2', no: '②', title: '싣고 내려가다', place: '큰길에서 골목으로 꺾은 곳', len: '2:16', src: '/audio/yeokryu-walk/walk-2.m4a' },
  { id: '3', no: '③', title: '물길', place: '대흥천 쪽으로 꺾은 곳', len: '3:50', src: '/audio/yeokryu-walk/walk-3.m4a' },
  { id: '4', no: '④', title: '문', place: '강경 갑문 앞', len: '1:59', src: '/audio/yeokryu-walk/walk-4.m4a' },
];
/** 집에서 · 비 오는 날 — ①–④를 이은 한 파일 */
const FULL: Track = { id: 'full', no: '전체', title: '전체 듣기', place: '집에서 · 비 오는 날', len: '12:09', src: '/audio/yeokryu-walk/walk-full.m4a' };
const ALL: Track[] = [...TRACKS, FULL];
const FULL_IDX = ALL.length - 1;
/** 번호를 읽는 소리에 맞춘 조사: ①일 · ③삼 → 을, ②이 · ④사 → 를 */
const JOSA: Record<string, string> = { '①': '을', '②': '를', '③': '을', '④': '를' };

const PAPER = '#F5F2EC';
const TITLE_SERIES = '위성악보시리즈 :';
const TITLE_WORK = '역류(逆流), 회귀된 포구';
const SUBTITLE = '사운드 산책 · 강경 갑문까지';
const ARTIST = 'NODE TREE';

type Phase = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

// ── 이어 듣기 위치 저장(같은 탭 한정, 번호마다)
const STORE_KEY = 'yw-walk-position-v2';
const LAST_KEY = 'yw-walk-last';
const STORE_TTL_MS = 2 * 60 * 60 * 1000; // 저장 뒤 2시간이 지나면 처음부터
const SAVE_EVERY_MS = 3000;
const RESUME_NOTE_MS = 3000;
/** 이보다 앞이면 이어 듣지 않고 처음부터(「이어서 듣습니다 · 00:00」 같은 빈 안내를 막는다) */
const MIN_RESUME_S = 2;

type Store = Record<string, { t: number; at: number }>;

function readStore(): Store {
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY);
    const v = raw ? (JSON.parse(raw) as Store) : {};
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function writeStore(s: Store): void {
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* 저장소가 막혀 있으면 새로고침 이어 듣기만 빠진다 */
  }
}

/** 저장된 위치(초). 없거나 만료 · 손상이면 null. */
function readSaved(src: string): number | null {
  const v = readStore()[src];
  if (!v || typeof v.t !== 'number' || !Number.isFinite(v.t) || v.t < MIN_RESUME_S || typeof v.at !== 'number' || Date.now() - v.at > STORE_TTL_MS) {
    return null;
  }
  return v.t;
}

function writeSaved(src: string, t: number): void {
  const s = readStore();
  s[src] = { t, at: Date.now() };
  writeStore(s);
}

function clearSaved(src: string): void {
  const s = readStore();
  delete s[src];
  writeStore(s);
}

function readLast(): number {
  try {
    const id = window.sessionStorage.getItem(LAST_KEY);
    const i = ALL.findIndex((t) => t.id === id);
    return i >= 0 ? i : 0;
  } catch {
    return 0;
  }
}

function writeLast(i: number): void {
  try {
    window.sessionStorage.setItem(LAST_KEY, ALL[i].id);
  } catch {
    /* 위와 같음 */
  }
}

/** 초 → m:ss (한 시간을 넘으면 h:mm:ss). 모르는 값은 --:-- */
function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '--:--';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}

const PlayGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
    <path d="M6 3.5 L20 12 L6 20.5 Z" fill="currentColor" />
  </svg>
);

const PauseGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
    <rect x="5" y="3.5" width="4.5" height="17" fill="currentColor" />
    <rect x="14.5" y="3.5" width="4.5" height="17" fill="currentColor" />
  </svg>
);

/**
 * 이 라우트에서만 머리 설정을 바꾼다. 떠날 때 원래대로 돌려놓는다.
 *  · viewport-fit=cover — 없으면 iOS 에서 env(safe-area-inset-*) 가 0 으로만 나온다.
 *  · theme-color — index.html 의 #000000 이면 종이 위에 검은 상태줄이 선다.
 *    (index.html 쪽 태그에 data-rh 가 없어 Helmet 으로 내면 2벌이 된다 → 직접 바꾼다)
 *  · html/body 배경 — iOS 오버스크롤(바운스) 틈으로 흰 바탕이 비치지 않게.
 */
function useStandaloneHead(): void {
  useEffect(() => {
    const vp = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const prevVp = vp?.getAttribute('content') ?? null;
    if (vp && prevVp !== null && !/viewport-fit/.test(prevVp)) {
      vp.setAttribute('content', `${prevVp}, viewport-fit=cover`);
    }
    const tc = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevTc = tc?.getAttribute('content') ?? null;
    tc?.setAttribute('content', PAPER);
    const { documentElement: html, body } = document;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    html.style.backgroundColor = PAPER;
    body.style.backgroundColor = PAPER;
    return () => {
      if (vp && prevVp !== null) vp.setAttribute('content', prevVp);
      if (tc && prevTc !== null) tc.setAttribute('content', prevTc);
      html.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
    };
  }, []);
}

const YeokryuWalk: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 마지막으로 듣던 번호와 그 위치 — 첫 렌더에서 한 번만 읽는다
  const [idx, setIdx] = useState<number>(() => readLast());
  const idxRef = useRef(idx);
  const [initialSaved] = useState<number | null>(() => readSaved(ALL[idx].src));
  const [phase, setPhase] = useState<Phase>('idle');
  const [current, setCurrent] = useState(initialSaved ?? 0);
  const [duration, setDuration] = useState(NaN);
  const [resumeNote, setResumeNote] = useState<number | null>(null);
  /** 마지막으로 정상 재생된 위치(초). load() 가 0 으로 되돌려도 이 값은 남는다. */
  const posRef = useRef(initialSaved ?? 0);
  /** 메타데이터가 오면 되돌릴 위치. 되돌리기 전에는 timeupdate 0 으로 덮지 않는다. */
  const resumeRef = useRef<number | null>(initialSaved);
  /** 되돌린 위치 — 다음 playing 때 「이어서 듣습니다」로 한 번 알린다 */
  const resumedAtRef = useRef<number | null>(null);
  const lastSaveRef = useRef(0);

  useStandaloneHead();

  // 이어 듣기 안내는 3초 뒤 사라진다
  useEffect(() => {
    if (resumeNote === null) return undefined;
    const id = window.setTimeout(() => setResumeNote(null), RESUME_NOTE_MS);
    return () => window.clearTimeout(id);
  }, [resumeNote]);

  // ── <audio> 이벤트 → 화면 상태(요소 하나, 번호는 idxRef 로 읽는다)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return undefined;
    const src = () => ALL[idxRef.current].src;

    const syncPosition = () => {
      if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
      if (!Number.isFinite(a.duration) || a.duration <= 0) return;
      try {
        navigator.mediaSession.setPositionState({
          duration: a.duration,
          playbackRate: a.playbackRate || 1,
          position: Math.min(a.currentTime, a.duration),
        });
      } catch {
        /* position > duration 경계 등 — 잠금화면 진행 표시만 빠진다 */
      }
    };
    const save = () => {
      if (resumeRef.current !== null) return; // 되돌리기 전: 이미 저장된 위치를 덮지 않는다
      if (posRef.current >= MIN_RESUME_S && !a.ended) writeSaved(src(), posRef.current);
      lastSaveRef.current = Date.now();
    };
    const onDuration = () => {
      setDuration(a.duration);
      syncPosition();
    };
    const onMeta = () => {
      onDuration();
      const r = resumeRef.current;
      if (r === null) return;
      resumeRef.current = null;
      if (Number.isFinite(a.duration) && r < a.duration) {
        a.currentTime = r;
        posRef.current = r;
        setCurrent(r);
        resumedAtRef.current = r;
      } else {
        // 저장 위치가 전체 길이 이상 → 처음부터
        clearSaved(src());
        posRef.current = 0;
        setCurrent(0);
      }
    };
    const onTime = () => {
      // load() 직후 0 으로 돌아간 값 · 오류 뒤 값으로 기억한 위치를 덮지 않는다
      if (resumeRef.current !== null || a.error) return;
      posRef.current = a.currentTime;
      setCurrent(a.currentTime);
      if (!a.paused && Date.now() - lastSaveRef.current >= SAVE_EVERY_MS) save();
    };
    const onPlaying = () => {
      setPhase('playing');
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      syncPosition();
      if (resumedAtRef.current !== null) {
        setResumeNote(resumedAtRef.current);
        resumedAtRef.current = null;
      }
    };
    const onWaiting = () => {
      if (!a.paused) setPhase('loading');
    };
    const onPause = () => {
      // 곡 끝(ended)과 불러오기 실패(error) 뒤에 따라오는 pause 는 그 상태를 덮어쓰지 않는다.
      if (a.ended || a.error) return;
      setPhase('paused');
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      syncPosition();
      save();
    };
    const onEnded = () => {
      setPhase('ended');
      setCurrent(a.duration);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
      // 끝까지 들었으면 그 번호는 다음에 처음부터. 다음 번호로 저절로 넘어가지 않는다.
      posRef.current = 0;
      resumeRef.current = null;
      resumedAtRef.current = null;
      clearSaved(src());
    };
    const onError = () => {
      setPhase('error');
      setResumeNote(null);
      // 재생 중 끊긴 경우 잠금화면이 playing 으로 남지 않게
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
      save();
    };
    // 화면이 꺼지거나 탭을 떠날 때(새로고침 포함) 위치를 남긴다
    const onHide = () => {
      if (document.visibilityState === 'hidden') save();
    };

    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('durationchange', onDuration);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('playing', onPlaying);
    a.addEventListener('waiting', onWaiting);
    a.addEventListener('pause', onPause);
    a.addEventListener('seeked', syncPosition);
    a.addEventListener('ended', onEnded);
    a.addEventListener('error', onError);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    // 소리 주소는 React 가 아니라 여기서 한 번만 넣는다. 번호를 바꿀 때는 select() 가 직접 바꾼다.
    // (src 를 React 속성으로 두면 다시 그릴 때 같은 주소를 또 넣어 방금 시작한 재생을 취소한다 · 2026-10-07 실측)
    if (!a.getAttribute('src')) a.src = src();
    // 캐시된 메타데이터가 리스너보다 먼저 도착한 경우
    if (a.readyState >= 1) onMeta();
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('durationchange', onDuration);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('playing', onPlaying);
      a.removeEventListener('waiting', onWaiting);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('seeked', syncPosition);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('error', onError);
    };
  }, []);

  const play = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.error) {
      // 불러오기 실패 뒤 다시 누르면 새로 받는다. load() 가 currentTime 을 0 으로 되돌리므로
      // 끊긴 자리를 먼저 잡아 두고 loadedmetadata 에서 되돌린다(play() 는 누른 순간 바로 부른다: iOS 제스처 조건).
      if (resumeRef.current === null && posRef.current >= MIN_RESUME_S) resumeRef.current = posRef.current;
      a.load();
    }
    setResumeNote(null);
    setPhase('loading');
    a.play().catch((err: unknown) => {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'AbortError') return; // 곧바로 일시정지를 누른 경우
      setPhase(name === 'NotAllowedError' ? 'paused' : 'error');
    });
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  /** 번호를 고르면 그 자리에서 바로 재생한다(누른 순간 src 교체 + play: iOS 제스처 조건). */
  const select = useCallback(
    (i: number) => {
      const a = audioRef.current;
      if (!a) return;
      const cur = idxRef.current;
      if (i !== cur) {
        // 지금 번호의 위치를 남기고 바꾼다
        if (posRef.current >= MIN_RESUME_S && !a.ended && resumeRef.current === null) writeSaved(ALL[cur].src, posRef.current);
        idxRef.current = i;
        setIdx(i);
        writeLast(i);
        const saved = readSaved(ALL[i].src);
        resumeRef.current = saved;
        resumedAtRef.current = null;
        posRef.current = saved ?? 0;
        setCurrent(saved ?? 0);
        setDuration(NaN);
        a.src = ALL[i].src;
        a.load();
      }
      play();
    },
    [play],
  );

  // ── Media Session — 잠금화면 · 이어폰 버튼으로 재생/일시정지 · 다음/이전 번호
  useEffect(() => {
    if (!('mediaSession' in navigator)) return undefined;
    const ms = navigator.mediaSession;
    const t = ALL[idx];
    if (typeof MediaMetadata !== 'undefined') {
      ms.metadata = new MediaMetadata({
        title: `${t.no} ${t.title}`,
        artist: ARTIST,
        album: `${TITLE_WORK} · ${SUBTITLE}`,
        artwork: [{ src: `${window.location.origin}/logo.png`, sizes: '512x512', type: 'image/png' }],
      });
    }
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* 지원하지 않는 동작 */
      }
    };
    set('play', () => play());
    set('pause', () => pause());
    const field = idx < FULL_IDX;
    set('nexttrack', field && idx < FULL_IDX - 1 ? () => select(idx + 1) : null);
    set('previoustrack', field && idx > 0 ? () => select(idx - 1) : null);
    return () => {
      set('play', null);
      set('pause', null);
      set('nexttrack', null);
      set('previoustrack', null);
    };
  }, [idx, play, pause, select]);

  // 페이지를 떠날 때 잠금화면 정보를 비운다
  useEffect(
    () => () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
      }
    },
    [],
  );

  const track = ALL[idx];
  const isPlaying = phase === 'playing';
  const isBusy = phase === 'loading';
  const onPress = () => {
    if (isPlaying || isBusy) pause();
    else play();
  };

  const ratio = Number.isFinite(duration) && duration > 0 ? Math.min(1, current / duration) : 0;
  const label = isPlaying ? '일시정지' : isBusy ? '불러오는 중' : '재생';
  const next = idx < FULL_IDX - 1 ? TRACKS[idx + 1] : null;

  return (
    <div className="yw">
      <Helmet>
        <title>{`${TITLE_WORK} · 사운드 산책`}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="description" content={`${TITLE_SERIES} ${TITLE_WORK} · ${SUBTITLE}`} />
      </Helmet>

      <main className="yw__col">
        <header className="yw__head">
          <h1 className="yw__title">
            <span className="yw__series">{TITLE_SERIES}</span> <span className="yw__work">{TITLE_WORK}</span>
          </h1>
          <p className="yw__sub">{SUBTITLE}</p>
        </header>

        <section className="yw__player" aria-label="사운드 산책 재생">
          <button type="button" className="yw__play" data-phase={phase} aria-label={`${track.no} ${track.title} ${label}`} onClick={onPress}>
            <span className="yw__glyph">{isPlaying || isBusy ? <PauseGlyph /> : <PlayGlyph />}</span>
            <span className="yw__label">
              <span className="yw__label-now">
                {track.no} {track.title}
              </span>
              <span className="yw__label-act">{label}</span>
            </span>
          </button>

          <div className="yw__track" aria-hidden="true">
            <span className="yw__fill" style={{ transform: `scaleX(${ratio})` }} />
          </div>

          <div className="yw__status">
            <span className="yw__now">
              <i className="yw__dot" data-on={isPlaying ? 'true' : 'false'} aria-hidden="true" />
              <span className="yw__time" aria-label="경과 시간">
                {fmt(current)}
              </span>
            </span>
            <span className="yw__time yw__time--total" aria-label="전체 시간">
              {fmt(duration)}
            </span>
          </div>

          {resumeNote !== null && (
            <p className="yw__resume" role="status">
              이어서 듣습니다 · <span className="yw__resume-time">{fmt(resumeNote)}</span>
            </p>
          )}
          {phase === 'ended' && (
            <p className="yw__notice" role="status">
              {next
                ? `다음은 ${next.no} ${next.place}입니다. 닿으면 멈춰 서서 ${next.no}${JOSA[next.no]} 눌러 주세요.`
                : idx === FULL_IDX - 1
                  ? '끝까지 들었습니다. 이어폰을 빼고 이 자리의 소리를 들어 주세요.'
                  : '끝까지 들었습니다.'}
            </p>
          )}
          {phase === 'error' && (
            <p className="yw__notice" role="alert">
              소리를 불러오지 못했습니다. 다시 눌러 주세요.
            </p>
          )}

          <audio ref={audioRef} preload="metadata" />
        </section>

        <section className="yw__stops" aria-label="걷는 길의 네 자리">
          <p className="yw__stops-head">지도의 번호 자리에 닿으면 멈춰 서서 누릅니다</p>
          <ol className="yw__list">
            {TRACKS.map((t, i) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="yw__stop"
                  aria-current={i === idx ? 'true' : undefined}
                  data-playing={i === idx && isPlaying ? 'true' : 'false'}
                  onClick={() => (i === idx ? onPress() : select(i))}
                >
                  <span className="yw__stop-no">{t.no}</span>
                  <span className="yw__stop-text">
                    <span className="yw__stop-title">{t.title}</span>
                    <span className="yw__stop-place">{t.place}</span>
                  </span>
                  <span className="yw__stop-len">{t.len}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="yw__info">
          <p className="yw__route">스페이스 전원에서 강경 갑문까지 약 800 m를 걷습니다.</p>
          <p className="yw__dest">
            <span className="yw__place">강경 갑문</span> · <span className="yw__addr">충남 논산시 강경읍 금백로 101-9</span>
          </p>
          <ul className="yw__safety">
            <li>도로 구간에서는 한쪽 귀를 열어 두고 들어 주세요.</li>
            <li>번호는 멈춰 선 다음에 눌러 주세요.</li>
            <li>재생을 누른 뒤 화면을 꺼도 소리는 이어집니다.</li>
          </ul>
          <button
            type="button"
            className="yw__full"
            aria-current={idx === FULL_IDX ? 'true' : undefined}
            onClick={() => (idx === FULL_IDX ? onPress() : select(FULL_IDX))}
          >
            <span className="yw__stop-text">
              <span className="yw__stop-title">{FULL.title}</span>
              <span className="yw__stop-place">{FULL.place}</span>
            </span>
            <span className="yw__stop-len">{FULL.len}</span>
          </button>
          <p className="yw__credit">
            부여 장암면 어르신들의 구술(2026)을 허락을 받아 발췌해 한 사람의 목소리로 다시 읽었습니다.
          </p>
        </section>

        <footer className="yw__foot">NODE TREE · 2026</footer>
      </main>
    </div>
  );
};

export default YeokryuWalk;
