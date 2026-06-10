// ═══════════════════════════════════════════════════════════════
// AI 글쓰기 라우트 — POST /api/ai/write
//   · KNUH(factchat) chat() 재사용. KNUH 는 유료 크레딧 → 반드시 인증 게이팅.
//   · 인증: 사이트 JWT(req.user) 또는 꿈다락 scope JWT 둘 다 허용(둘 중 하나면 통과).
//     비로그인/무효 토큰 → 401. (마을일기는 꿈다락 인증, Work/About 은 사이트 인증.)
//   · mode: 'write'(새로 쓰기) | 'refine'(서정적으로 다듬기).
//   · 시스템 프롬프트에 "반드시 서정적으로" 지시를 명시적으로 박는다.
//   · 응답: { success, text } — 생성 본문만. 실패 시 한국어 메시지.
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const jwt = require('jsonwebtoken');
const { chat } = require('../lib/knuhChat');
// 꿈다락 프로그램 마스터(단일 진실원). 로드 실패해도 라우트는 동작(맥락 주입만 생략).
let PROGRAMS = [];
let PROGRAM_MAP = {};
try {
  const kp = require('../data/kkumdarakPrograms');
  PROGRAMS = kp.PROGRAMS || [];
  PROGRAM_MAP = kp.PROGRAM_MAP || {};
} catch (e) {
  console.warn('kkumdarakPrograms 로드 실패 — 프로그램 맥락 주입 비활성:', e.message);
}

// 한자 괄호·공백 차이를 무시한 느슨한 이름 비교용 정규화.
function normName(n) {
  return String(n || '').replace(/[（(].*?[)）]/g, '').replace(/\s+/g, '').trim();
}
// programId(key) 우선, 없으면 programName 으로 프로그램 조회. 못 찾으면 null.
function findProgram(programId, programName) {
  if (programId && PROGRAM_MAP[programId]) return PROGRAM_MAP[programId];
  if (programName) {
    const target = normName(programName);
    const hit = PROGRAMS.find((p) => normName(p.name) === target);
    if (hit) return hit;
  }
  return null;
}

const router = express.Router();

// ── 결합 인증 미들웨어 ─────────────────────────────────────────
//   사이트 JWT(모든 role) 또는 꿈다락 scope JWT 중 하나라도 유효하면 통과.
//   둘 다 아니면 401. KNUH 크레딧 보호가 목적이므로 "로그인 여부"만 본다
//   (역할 제한은 두지 않음 — 마을일기 편집자도 호출해야 하므로).
const requireAnyAuth = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
  }
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!token) {
    return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // 사이트 JWT(role 보유) 또는 꿈다락 JWT(scope:'kkumdarak') 모두 허용.
    if (decoded && (decoded.role || decoded.scope === 'kkumdarak')) {
      req.aiUser = decoded;
      return next();
    }
    return res.status(401).json({ success: false, message: '유효하지 않은 인증입니다.' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: '인증이 만료되었습니다. 다시 로그인해주세요.' });
    }
    return res.status(401).json({ success: false, message: '유효하지 않은 인증입니다.' });
  }
};

// ── 시스템 프롬프트(서정 지시 명시) ────────────────────────────
const LYRIC_SYSTEM_PROMPT = `너는 NODE TREE(이화영·정강현, 부여 기반 미디어아트 듀오)의 글을 쓰는 작가다.
**반드시 서정적으로 작성하라.** 정보 나열이 아니라 감각과 정서가 흐르는 산문이어야 한다.

서정의 기준:
- 소리·빛·계절·장소의 감각 묘사로 문을 열고 닫는다
- 마을, 주민, 아이들, 일상의 사물을 따뜻한 시선으로 관찰한다
- 행정 용어·성과 보고 어투 금지 ("실시하였다", "진행되었다", "참여자 N명" 같은 표현 대신 장면을 그려라)
- 짧은 문장과 긴 문장의 리듬, 여백을 살린다
- 과장된 수사나 상투적 감탄("아름다운", "소중한" 남발) 금지 — 구체적 장면이 정서를 만들게 하라`;

// 마을일기(문화예술교육) — '한 줄 일기' 가 정체성. 다단락 산문 지시는 적용하지 않는다.
const VILLAGE_DIARY_BASE = `
이 글은 '마을일기' 카드의 제목이다. **반드시 한 문장으로**, 40자 내외, 마침표(.)로 끝나는 서정적 일기 한 줄로 써라.
- 한 문장만. 줄바꿈·여러 문장·제목·설명 금지. 결과는 그 한 줄만 출력하라.
- 마을에서 벌어진 하나의 장면·행위를 담담하고 따뜻하게 담는다.
- 행정 어투("실시하였다"·"참여자 N명") 금지. 상투적 감탄 금지.
- 기존 마을일기 제목 스타일 예시:
  · "도서관 자리를 함께 측량했어요."
  · "주민들이 책을 채우기 시작했다."
  · "목공 — 책장의 뼈대를 세우다."`;

const ARTWORK_NOTE = `

작품 글의 결:
- 작품의 개념·기술을 설명하되, 그 감각적 경험과 정서를 함께 그린다
- 도시·기록·사라지는 것들에 대한 NODE TREE 의 시선을 담는다`;

// 프로그램 맥락 문장(있을 때만). intro 를 활동 설명으로 사용.
function programContextNote(program) {
  if (!program) return '';
  const desc = (program.intro || '').trim();
  return `

이 일기는 〈${program.name}〉 프로그램의 활동 기록이다.${desc ? ` (프로그램 설명: ${desc})` : ''} 이 프로그램의 활동 성격에 맞는 장면·내용으로 써라.`;
}

function buildSystemPrompt(context, program) {
  if (context === 'village-diary') {
    return LYRIC_SYSTEM_PROMPT + '\n' + VILLAGE_DIARY_BASE + programContextNote(program);
  }
  if (context === 'artwork') return LYRIC_SYSTEM_PROMPT + ARTWORK_NOTE;
  return LYRIC_SYSTEM_PROMPT;
}

// ── POST /api/ai/write ─────────────────────────────────────────
router.post('/write', requireAnyAuth, async (req, res) => {
  const { mode, topic, keywords, originalText, context, format, programId, programName } = req.body || {};

  const m = mode === 'refine' ? 'refine' : 'write';
  const isVillageDiary = context === 'village-diary';
  // 존재하지 않는 programId/name 이면 null → 일반 village-diary 모드로 동작.
  const program = isVillageDiary ? findProgram(programId, programName) : null;
  const sys = buildSystemPrompt(context, program);

  let userPrompt;
  if (m === 'refine') {
    const src = (originalText || '').trim();
    if (!src) {
      return res.status(400).json({ success: false, message: '다듬을 원문이 비어 있습니다.' });
    }
    if (src.length > 8000) {
      return res.status(400).json({ success: false, message: '원문이 너무 깁니다(최대 8000자).' });
    }
    userPrompt = isVillageDiary
      ? `다음 마을일기 한 줄을 위 기준(한 문장·40자 내외·마침표로 끝)에 맞게 더 서정적으로 다시 써라. 사실은 보존하되 행정 어투를 걷어내라. 결과는 그 한 문장만 출력하라.

[원문]
${src}`
      : `다음 글을 위 서정의 기준에 맞게 다시 써라. 사실과 정보는 보존하되, 행정 어투를 걷어내고 장면과 정서가 흐르는 서정적 산문으로 바꿔라. 결과는 본문만 출력하라(제목·머리말·설명 금지).

[원문]
${src}`;
  } else {
    const subject = [topic, keywords].filter(Boolean).join(' / ').trim();
    if (!subject) {
      return res.status(400).json({ success: false, message: '주제 또는 키워드를 입력해주세요.' });
    }
    if (subject.length > 2000) {
      return res.status(400).json({ success: false, message: '주제가 너무 깁니다(최대 2000자).' });
    }
    userPrompt = isVillageDiary
      ? `다음 주제/키워드로 위 기준(한 문장·40자 내외·마침표로 끝나는 마을일기 한 줄)에 맞는 일기 한 줄을 써라. 결과는 그 한 문장만 출력하라.

[주제/키워드]
${subject}`
      : `다음 주제/키워드로 위 서정의 기준에 맞는 글을 써라. 결과는 본문만 출력하라(제목·머리말·설명 금지). 2~4개 단락 분량.

[주제/키워드]
${subject}`;
  }

  try {
    const plainNote = format === 'plain'
      ? '\n\n출력은 HTML 태그 없이 순수 텍스트로만 작성하라(단락 구분은 빈 줄로).'
      : '';
    const text = await chat(
      [
        { role: 'system', content: sys },
        { role: 'user', content: userPrompt + plainNote },
      ],
      { maxTokens: isVillageDiary ? 200 : 1500 }
    );
    let out = (text || '').trim();
    if (format === 'plain') {
      // 혹시 모를 태그/엔티티 제거(서버측 방어). 텍스트 노드만 남긴다.
      out = out.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').trim();
    }
    return res.json({ success: true, text: out });
  } catch (error) {
    console.error('AI write 오류:', error.code || '', error.message);
    if (error.code === 'KNUH_NO_KEY') {
      return res.status(503).json({ success: false, message: 'AI 기능이 현재 설정되지 않았습니다(KNUH 키 없음).' });
    }
    if (error.code === 'KNUH_TIMEOUT') {
      return res.status(504).json({ success: false, message: 'AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.' });
    }
    return res.status(502).json({ success: false, message: 'AI 글 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

module.exports = router;
