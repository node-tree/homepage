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

const VILLAGE_DIARY_NOTE = `

문화예술교육(마을일기) 글의 결:
- 교육 활동을 '수업'이 아니라 마을에서 벌어진 하나의 장면으로 기록한다
- 아이들과 주민의 말·몸짓·소리를 구체적으로 담는다
- 예술가의 시선: 비가시적인 것(소리, 진동, 계절의 결, 사라지는 것들)을 포착한다`;

const ARTWORK_NOTE = `

작품 글의 결:
- 작품의 개념·기술을 설명하되, 그 감각적 경험과 정서를 함께 그린다
- 도시·기록·사라지는 것들에 대한 NODE TREE 의 시선을 담는다`;

function buildSystemPrompt(context) {
  if (context === 'village-diary') return LYRIC_SYSTEM_PROMPT + VILLAGE_DIARY_NOTE;
  if (context === 'artwork') return LYRIC_SYSTEM_PROMPT + ARTWORK_NOTE;
  return LYRIC_SYSTEM_PROMPT;
}

// ── POST /api/ai/write ─────────────────────────────────────────
router.post('/write', requireAnyAuth, async (req, res) => {
  const { mode, topic, keywords, originalText, context, format } = req.body || {};

  const m = mode === 'refine' ? 'refine' : 'write';
  const sys = buildSystemPrompt(context);

  let userPrompt;
  if (m === 'refine') {
    const src = (originalText || '').trim();
    if (!src) {
      return res.status(400).json({ success: false, message: '다듬을 원문이 비어 있습니다.' });
    }
    if (src.length > 8000) {
      return res.status(400).json({ success: false, message: '원문이 너무 깁니다(최대 8000자).' });
    }
    userPrompt = `다음 글을 위 서정의 기준에 맞게 다시 써라. 사실과 정보는 보존하되, 행정 어투를 걷어내고 장면과 정서가 흐르는 서정적 산문으로 바꿔라. 결과는 본문만 출력하라(제목·머리말·설명 금지).

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
    userPrompt = `다음 주제/키워드로 위 서정의 기준에 맞는 글을 써라. 결과는 본문만 출력하라(제목·머리말·설명 금지). 2~4개 단락 분량.

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
      { maxTokens: 1500 }
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
