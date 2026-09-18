// ═══════════════════════════════════════════════════════════════════════
// YeokryuWalk.tsx — 〈역류〉 사운드 산책 전용 모바일 페이지 (라우트 /yeokryu/walk)
//
// 쓰임: 2026-10-11(일) 16:00 강경창작스튜디오 → 강경 갑문 선택 산책.
//   참여자는 안내 카드 QR 로 이 페이지를 열고 재생을 누른 뒤 휴대폰을 주머니에 넣는다.
//   소리는 갑문 도착 시점에 끝난다. 비가 오면 같은 주소를 집에서 듣는 링크로 쓴다.
// 공개 방식: QR 로만 닿는다. 메뉴·sitemap·다른 페이지 링크에 넣지 않는다.
//   robots meta = noindex, nofollow. robots.txt 에는 적지 않는다(주소가 드러나므로).
// 단독 화면: 사이트 헤더 없이 선다. SambeWalker 는 v5 경로에서만 켜지므로 여기엔 안 뜬다.
// 소리 연결: WALK_AUDIO_SRC 한 곳에 URL 만 넣으면 재생 UI 가 켜진다.
//   비어 있으면 버튼은 비활성이고 「소리는 10월 11일 현장에서 열립니다」를 띄운다.
// 화면을 꺼도 이어지게: Web Audio 가 아니라 <audio> 요소로 스트리밍하고 Media Session 을 건다.
// 끊겨도 이어서: 갑문 도착에 맞춘 소리라 처음부터 다시 나오면 안 된다.
//   · 재생 중 불러오기가 끊겨 오류가 나면 마지막 위치를 잡아 두고, 다시 눌러 성공하면 그 자리로 되돌린다.
//   · 같은 탭 새로고침에 대비해 위치를 sessionStorage 에 둔다(3초 간격 + pause·화면 전환·오류·떠날 때).
//     끝까지 들었거나, 저장 뒤 2시간이 지났거나, 저장 위치가 전체 길이 이상이면 처음부터.
//   · 저장소가 막혀 있어도(사생활 모드·쿠키 차단) 조용히 처음부터 재생한다.
// 서체: ./fonts 의 페이지 전용 서브셋(이 파일의 글자만). 문구를 바꾸면
//   scripts/build-fonts-yeokryu-walk.sh 를 다시 돌린다(누락 글자는 시스템 한글 서체로 폴백).
// ═══════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import './YeokryuWalk.css';

/** 산책 소리 파일 URL. 비워 두면 재생 버튼이 비활성으로 선다. */
const WALK_AUDIO_SRC: string = '';

const PAPER = '#F5F2EC';
const TITLE_SERIES = '위성악보시리즈 :';
const TITLE_WORK = '역류(逆流), 회귀된 포구';
const SUBTITLE = '사운드 산책 · 강경 갑문까지';
const ARTIST = 'NODE TREE';

type Phase = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

// ── 이어 듣기 위치 저장(같은 탭 한정)
const STORE_KEY = 'yw-walk-position';
const STORE_TTL_MS = 2 * 60 * 60 * 1000; // 저장 뒤 2시간이 지나면 처음부터
const SAVE_EVERY_MS = 3000;
const RESUME_NOTE_MS = 3000;
/** 이보다 앞이면 이어 듣지 않고 처음부터(「이어서 듣습니다 · 00:00」 같은 빈 안내를 막는다) */
const MIN_RESUME_S = 2;

interface SavedPosition {
  src: string;
  t: number;
  at: number;
}

/** 저장된 위치(초). 없거나 다른 소리·만료·손상이면 null. 저장소 접근이 막혀 있어도 null. */
function readSaved(): number | null {
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SavedPosition>;
    const valid =
      v.src === WALK_AUDIO_SRC &&
      typeof v.t === 'number' &&
      Number.isFinite(v.t) &&
      v.t >= MIN_RESUME_S &&
      typeof v.at === 'number' &&
      Date.now() - v.at <= STORE_TTL_MS;
    if (!valid) {
      window.sessionStorage.removeItem(STORE_KEY);
      return null;
    }
    return v.t as number;
  } catch {
    return null;
  }
}

function writeSaved(t: number): void {
  try {
    const v: SavedPosition = { src: WALK_AUDIO_SRC, t, at: Date.now() };
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(v));
  } catch {
    /* 저장소가 막혀 있으면 새로고침 이어 듣기만 빠진다 */
  }
}

function clearSaved(): void {
  try {
    window.sessionStorage.removeItem(STORE_KEY);
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
  const hasAudio = WALK_AUDIO_SRC.trim() !== '';
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 새로고침 전 위치 — 첫 렌더에서 한 번만 읽는다
  const [initialSaved] = useState<number | null>(() => (hasAudio ? readSaved() : null));
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

  // ── <audio> 이벤트 → 화면 상태
  useEffect(() => {
    const a = audioRef.current;
    if (!hasAudio || !a) return undefined;

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
      if (posRef.current >= MIN_RESUME_S) writeSaved(posRef.current);
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
        clearSaved();
        posRef.current = 0;
        setCurrent(0);
      }
    };
    const onTime = () => {
      // load() 직후 0 으로 돌아간 값·오류 뒤 값으로 기억한 위치를 덮지 않는다
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
      // 실패 순서: load → play → error → play() 거부 → pause. load() 가 error 를 null 로 되돌리므로
      // 정상 일시정지에는 영향이 없다.
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
      // 끝까지 들었으면 다음에는 처음부터
      posRef.current = 0;
      resumeRef.current = null;
      resumedAtRef.current = null;
      clearSaved();
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
  }, [hasAudio]);

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

  // ── Media Session — 잠금화면·이어폰 버튼으로 재생/일시정지
  useEffect(() => {
    if (!hasAudio || !('mediaSession' in navigator)) return undefined;
    const ms = navigator.mediaSession;
    if (typeof MediaMetadata !== 'undefined') {
      ms.metadata = new MediaMetadata({
        title: `${TITLE_SERIES} ${TITLE_WORK}`,
        artist: ARTIST,
        album: SUBTITLE,
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
    return () => {
      set('play', null);
      set('pause', null);
      ms.metadata = null;
      ms.playbackState = 'none';
    };
  }, [hasAudio, play, pause]);

  const isPlaying = phase === 'playing';
  const isBusy = phase === 'loading';
  const onPress = () => {
    if (isPlaying || isBusy) pause();
    else play();
  };

  const ratio = Number.isFinite(duration) && duration > 0 ? Math.min(1, current / duration) : 0;
  const label = !hasAudio ? '재생' : isPlaying ? '일시정지' : isBusy ? '불러오는 중' : '재생';

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
          <button
            type="button"
            className="yw__play"
            data-phase={hasAudio ? phase : 'off'}
            disabled={!hasAudio}
            aria-label={label}
            onClick={onPress}
          >
            <span className="yw__glyph">{isPlaying || isBusy ? <PauseGlyph /> : <PlayGlyph />}</span>
            <span className="yw__label">{label}</span>
          </button>

          {hasAudio ? (
            <div className="yw__track" aria-hidden="true">
              <span className="yw__fill" style={{ transform: `scaleX(${ratio})` }} />
            </div>
          ) : null}

          {hasAudio ? (
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
          ) : (
            <p className="yw__notice" role="status">
              소리는 10월 11일 현장에서 열립니다
            </p>
          )}
          {resumeNote !== null && (
            <p className="yw__resume" role="status">
              이어서 듣습니다 · <span className="yw__resume-time">{fmt(resumeNote)}</span>
            </p>
          )}
          {phase === 'error' && (
            <p className="yw__notice" role="alert">
              소리를 불러오지 못했습니다. 다시 눌러 주세요.
            </p>
          )}

          {hasAudio && <audio ref={audioRef} src={WALK_AUDIO_SRC} preload="metadata" />}
        </section>

        <section className="yw__info">
          <p className="yw__route">강경창작스튜디오에서 강경 갑문까지 걷습니다. 소리는 갑문에 닿을 때 끝납니다.</p>
          <p className="yw__dest">
            <span className="yw__place">강경 갑문</span> · <span className="yw__addr">충남 논산시 강경읍 금백로 101-9</span>
          </p>
          <ul className="yw__safety">
            <li>도로 구간에서는 한쪽 귀를 열어 두고 들어 주세요.</li>
            <li>재생을 누른 뒤 화면을 꺼도 소리는 이어집니다.</li>
          </ul>
        </section>

        <footer className="yw__foot">NODE TREE · 2026</footer>
      </main>
    </div>
  );
};

export default YeokryuWalk;
