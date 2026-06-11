// ═══════════════════════════════════════════════════════════════
// 「소개」(Intro) — 로그인 편집 가능한 콘텐츠 모델 + 정적/오버라이드 병합
//   · 정적 기본값(data.ts)을 단일 진실 기준선으로 두고, 백엔드 override 버킷을
//     얹어 표시한다(마을소식 newsStatus 선례와 동일한 read-merge-write 패턴).
//   · 영속화: 새 컬렉션/스키마 없음 — kkumdarak-settings 싱글톤의 Mixed `data` 에
//     `intro` 버킷({ motto?, place?, isoMeaning?, ... members? })을 추가로 얹는다.
//   · 인증: 마을일기/마을소식과 동일한 꿈다락 전용 토큰(kkumdarak_token) 재사용.
//   · 멤버 캐릭터 이미지는 ImageKit URL(표시 시 ikUrl 로 사이징).
// ═══════════════════════════════════════════════════════════════

import {
  MEMBERS,
  ISO_MEANING,
  ISO_OWL_FIREFLY,
  ISO_GENERATIONS,
  type Member,
} from './data';

// 정적 모토/장소(Intro.tsx 에 하드코딩돼 있던 문구를 편집 가능한 기본값으로 승격).
export const INTRO_MOTTO_DEFAULT =
  '꿈다락 문화예술학교 「이소」는, 동아시아 개인 서정시의 출발점인 한 편의 시가 ' +
  '음률과 서정으로 2300년을 건너 오늘의 노래와 공동체의 자리가 되었듯, ' +
  '삶-터를 살아가는 사람들의 감각과 문화가 다음 세대로 이어지는 자리입니다. ' +
  '마을이 곧 학교가 되는 자리입니다.';

export const INTRO_PLACE_DEFAULT = '충청남도 부여군 장암면 · 2026. 5 – 12';

// 편집 가능한 단일 글 블록(제목 + 본문).
export interface IntroTextBlock {
  title: string;
  body: string;
}

// 편집 가능한 멤버(정적 Member 에서 편집 대상 필드만 추림 + 표시용 메타 유지).
export interface IntroMember {
  id: string;
  name: string;          // 활동명(표시 그대로 — 편집 가능)
  color: Member['color']; // 팔레트 토큰(편집 비대상, 정적 유지)
  role: string;
  desc: string;
  character: string;     // ImageKit URL(없으면 '')
}

// 소개 페이지 전체 편집 콘텐츠.
export interface IntroContent {
  motto: string;
  place: string;
  isoMeaning: IntroTextBlock;   // 제목만 텍스트, 한자 글리프는 정적 유지
  isoOwlFirefly: IntroTextBlock;
  isoGenerations: IntroTextBlock;
  members: IntroMember[];
}

// 백엔드 override 버킷(부분 형태 — 일부 필드만 저장돼 있을 수 있음).
export interface IntroOverride {
  motto?: string;
  place?: string;
  isoMeaning?: Partial<IntroTextBlock>;
  isoOwlFirefly?: Partial<IntroTextBlock>;
  isoGenerations?: Partial<IntroTextBlock>;
  // 멤버는 id 키 맵으로 저장(추가/삭제 없이 정적 5인의 필드만 덮어씀).
  members?: Record<string, Partial<Pick<IntroMember, 'name' | 'role' | 'desc' | 'character'>>>;
}

// ── 정적 기본 콘텐츠 ──────────────────────────────────────────────
export function defaultIntroContent(): IntroContent {
  return {
    motto: INTRO_MOTTO_DEFAULT,
    place: INTRO_PLACE_DEFAULT,
    isoMeaning: { title: ISO_MEANING.title, body: ISO_MEANING.body },
    isoOwlFirefly: { title: ISO_OWL_FIREFLY.title, body: ISO_OWL_FIREFLY.body },
    isoGenerations: { title: ISO_GENERATIONS.title, body: ISO_GENERATIONS.body },
    members: MEMBERS.map((m) => ({
      id: m.id,
      name: m.name,
      color: m.color,
      role: m.role,
      desc: m.desc,
      character: m.character ?? '',
    })),
  };
}

// 안전한 문자열 머지(override 값이 string 일 때만 채택).
function pickStr(base: string, override: unknown): string {
  return typeof override === 'string' ? override : base;
}

function mergeBlock(base: IntroTextBlock, ov?: Partial<IntroTextBlock>): IntroTextBlock {
  if (!ov || typeof ov !== 'object') return base;
  return {
    title: pickStr(base.title, ov.title),
    body: pickStr(base.body, ov.body),
  };
}

// ── 정적 기본값 + 백엔드 override 병합 ─────────────────────────────
//   override 가 undefined(콜드스타트 미도착)면 정적 기본값으로 낙관 렌더.
//   멤버는 정적 5인을 기준으로 id 매칭되는 필드만 덮어쓴다(목록 자체는 정적 고정).
export function mergeIntroContent(override?: IntroOverride | null): IntroContent {
  const base = defaultIntroContent();
  if (!override || typeof override !== 'object') return base;

  return {
    motto: pickStr(base.motto, override.motto),
    place: pickStr(base.place, override.place),
    isoMeaning: mergeBlock(base.isoMeaning, override.isoMeaning),
    isoOwlFirefly: mergeBlock(base.isoOwlFirefly, override.isoOwlFirefly),
    isoGenerations: mergeBlock(base.isoGenerations, override.isoGenerations),
    members: base.members.map((m) => {
      const ov = override.members && override.members[m.id];
      if (!ov || typeof ov !== 'object') return m;
      return {
        ...m,
        name: pickStr(m.name, ov.name),
        role: pickStr(m.role, ov.role),
        desc: pickStr(m.desc, ov.desc),
        character: pickStr(m.character, ov.character),
      };
    }),
  };
}

// ── 편집 콘텐츠 → 백엔드 override 직렬화 ───────────────────────────
//   정적 기본값과 다른 필드만 골라 저장(불필요한 중복 저장 방지 + 정적 기본 변경 시 자동 반영).
//   결과가 비면 {} 반환(저장은 호출측이 read-merge-write 로 처리).
export function toIntroOverride(content: IntroContent): IntroOverride {
  const base = defaultIntroContent();
  const out: IntroOverride = {};

  if (content.motto !== base.motto) out.motto = content.motto;
  if (content.place !== base.place) out.place = content.place;

  const blockDiff = (
    c: IntroTextBlock,
    b: IntroTextBlock,
  ): Partial<IntroTextBlock> | undefined => {
    const d: Partial<IntroTextBlock> = {};
    if (c.title !== b.title) d.title = c.title;
    if (c.body !== b.body) d.body = c.body;
    return Object.keys(d).length ? d : undefined;
  };

  const im = blockDiff(content.isoMeaning, base.isoMeaning);
  if (im) out.isoMeaning = im;
  const of = blockDiff(content.isoOwlFirefly, base.isoOwlFirefly);
  if (of) out.isoOwlFirefly = of;
  const ig = blockDiff(content.isoGenerations, base.isoGenerations);
  if (ig) out.isoGenerations = ig;

  const membersOut: IntroOverride['members'] = {};
  for (const m of content.members) {
    const b = base.members.find((x) => x.id === m.id);
    if (!b) continue;
    const d: Partial<Pick<IntroMember, 'name' | 'role' | 'desc' | 'character'>> = {};
    if (m.name !== b.name) d.name = m.name;
    if (m.role !== b.role) d.role = m.role;
    if (m.desc !== b.desc) d.desc = m.desc;
    if (m.character !== b.character) d.character = m.character;
    if (Object.keys(d).length) membersOut[m.id] = d;
  }
  if (Object.keys(membersOut).length) out.members = membersOut;

  return out;
}
