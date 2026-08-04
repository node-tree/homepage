const fs = require('fs');
const path = require('path');
const { fillHwpx, buildInlinePicXml, readPngSize, mmToHwp } = require('./hwpxFill');

// ═══════════════════════════════════════════════════════════════
// 서식5 출강확인서 — body(클라이언트가 조립한 21개 값) → HWPX 채움.
//   프론트(FormsView)가 출강강사·기수회차·교육일자 등 합성문자열을 모두 만들어 보내고,
//   서버는 얇은 매퍼로만 동작한다(세션/프로그램 재조회·주강사 배열 처리 불필요).
//   템플릿 경로는 __dirname 기준(서버리스 번들) — vercel.json includeFiles 로 포함.
//   진행사진(선택): BinData/chulgang_photo.png 바이트를 업로드 PNG 로 교체(없으면 더미 유지).
//
//   ── 본문 셀 안전 belt(2026-06) ──
//   AI "자세하게" 강화로 본문(세부내용·평가)이 길어질 수 있어, AI/사용자 입력이 한글 셀을
//   넘치지 않게 항목별 글자수 상한(BODY_CELL_CAPS)을 둔다. 프롬프트 가이드가 1차 통제,
//   여기는 가이드를 어겨 길게 와도 셀이 터지지 않게 하는 2차 방어다(문장경계 절단).
// ═══════════════════════════════════════════════════════════════

// backend/lib → ../templates/forms/서식5_출강확인서.hwpx
const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'forms',
  '서식5_출강확인서.hwpx',
);

// 템플릿에 박힌 더미 사진 엔트리(BinData/<이 이름>) — 업로드 시 이 바이트만 교체.
const PHOTO_BINDATA_KEY = 'chulgang_photo.png';

// ── 담당자 서명 고정 삽입 ────────────────────────────────────────────────────
//   템플릿 마지막 줄이 「담당자: {{담당자}} (인)」 이다. 그 "(인)" 자리를 담당자 서명 이미지로
//   바꿔 이름 오른쪽에 붙인다(글자처럼 취급 = 이름 뒤에 그대로 흐름).
//   서명이 없으면 이 단계를 통째로 건너뛰어 기존 "(인)" 텍스트가 그대로 남는다(회귀 없음).
//
//   ⚠️ 서명 이미지는 저장소에 커밋하지 않는다 — 이 리포는 public 이라 실제 서명이 공개되면
//   위조에 쓰일 수 있고 커밋 히스토리라 되돌리기도 어렵다. 대신 환경변수로 주입한다:
//     · 운영(Vercel): env KKUMDARAK_SIGNATURE_PNG_B64 = PNG 의 base64(프리픽스 없음)
//     · 로컬: backend/templates/forms/signature_damdangja.png (.gitignore 됨)
//   우선순위는 env → 로컬파일. 둘 다 없으면 "(인)" 유지.
const SIGNATURE_PATH = path.join(__dirname, '..', 'templates', 'forms', 'signature_damdangja.png');
const SIGNATURE_ITEM_ID = 'imgSignature'; // content.hpf manifest item id (기존 image1 과 충돌 없음)
const SIGNATURE_BINDATA_KEY = 'signature_damdangja.png';
const SIGNATURE_WIDTH_MM = 20; // 이름 옆에 붙는 크기 — 셀 높이를 밀지 않는 선

// 서명 PNG 바이트 로드 — env(base64) 우선, 없으면 로컬 파일. 둘 다 없거나 깨졌으면 null.
//   서버리스 인스턴스마다 한 번만 디코드하도록 캐시한다(요청마다 40KB base64 디코드 방지).
let signatureCache; // undefined=미조회, null=없음, Buffer=로드됨
function loadSignatureBuffer() {
  if (signatureCache !== undefined) return signatureCache;
  const b64 = process.env.KKUMDARAK_SIGNATURE_PNG_B64;
  if (b64 && b64.trim()) {
    try {
      // data URL 로 붙여넣었을 경우까지 허용(프리픽스 제거)
      const raw = b64.trim().replace(/^data:image\/png;base64,/, '');
      const buf = Buffer.from(raw, 'base64');
      if (readPngSize(buf)) {
        signatureCache = buf;
        return signatureCache;
      }
      console.warn('KKUMDARAK_SIGNATURE_PNG_B64 이 PNG 로 해석되지 않습니다 — 파일 폴백');
    } catch (e) {
      console.warn('KKUMDARAK_SIGNATURE_PNG_B64 디코드 실패 — 파일 폴백:', e.message);
    }
  }
  signatureCache = fs.existsSync(SIGNATURE_PATH) ? fs.readFileSync(SIGNATURE_PATH) : null;
  return signatureCache;
}

// "(인)" 텍스트 run 을 서명 그림 run 으로 치환하는 sectionTransform 을 만든다.
//   서명이 없거나 PNG 가 아니면 null 을 반환(= 삽입 안 함).
function buildSignatureTransform() {
  const buffer = loadSignatureBuffer();
  if (!buffer) return null;
  const size = readPngSize(buffer);
  if (!size || !size.width || !size.height) return null;

  const width = mmToHwp(SIGNATURE_WIDTH_MM);
  const height = Math.round((width * size.height) / size.width);
  const picXml = buildInlinePicXml({ binaryItemId: SIGNATURE_ITEM_ID, width, height });

  // 템플릿의 " (인)" run 전체를 그림 run 으로 교체(앞 공백은 유지해 이름과 붙지 않게).
  const 인RunRe = /<hp:run charPrIDRef="(\d+)"><hp:t> \(인\)<\/hp:t><\/hp:run>/;
  const transform = (xml) => {
    if (!인RunRe.test(xml)) return xml; // 서식이 바뀌어 앵커가 없으면 아무것도 하지 않는다
    return xml.replace(
      인RunRe,
      (m, charPrIDRef) =>
        `<hp:run charPrIDRef="${charPrIDRef}"><hp:t>  </hp:t></hp:run>` + picXml,
    );
  };
  return { transform, image: { fileName: SIGNATURE_BINDATA_KEY, itemId: SIGNATURE_ITEM_ID, buffer } };
}

// 서식5 의 21개 플레이스홀더. body 누락 키는 ''(미치환 토큰 방지 — fillHwpx 가 throw).
const PLACEHOLDER_KEYS = [
  '출강강사',
  '교육장소',
  '교육장소상세',
  '강사수',
  '프로그램명',
  '기수회차',
  '정원',
  '실참여',
  '교육일자',
  '교육시간',
  '교육주제',
  '교육목표',
  '세부내용',
  '교육재료',
  '평가_운영',
  '평가_반응',
  '평가_보완',
  '확인년',
  '확인월',
  '확인일',
  '담당자',
];

// 본문(AI/사용자) 셀의 안전 상한 — "자세하게" 출력이 한글 셀을 넘치지 않게 하는 방어 belt.
//   상한은 서식6(작동셀당 ~300자)·출강확인서 셀 크기를 보수적으로 잡았다.
//   교육목표·교육재료는 짧게, 세부내용은 가장 크게, 평가 3종은 중간.
const BODY_CELL_CAPS = {
  교육목표: 160,
  세부내용: 420,
  교육재료: 140,
  평가_운영: 240,
  평가_반응: 240,
  평가_보완: 240,
};

// 단일run 셀: 개행은 한글에서 렌더 안 됨 → 공백 정규화. 상한 초과 시 문장/공백 경계 절단 + '…'.
function clampCell(value, cap) {
  const v = (value == null ? '' : String(value)).replace(/\s*[\r\n]+\s*/g, ' ').trim();
  if (!cap || v.length <= cap) return v;
  const slice = v.slice(0, cap);
  const sentEnd = Math.max(slice.lastIndexOf('다. '), slice.lastIndexOf('. '), slice.lastIndexOf('다.'));
  if (sentEnd > cap * 0.6) return slice.slice(0, sentEnd + (slice[sentEnd] === '다' ? 2 : 1)).trim();
  const sp = slice.lastIndexOf(' ');
  return (sp > cap * 0.6 ? slice.slice(0, sp) : slice).trim() + '…';
}

function buildChulgangReplacements(body) {
  const b = body || {};
  const repl = {};
  for (const key of PLACEHOLDER_KEYS) {
    const v = b[key];
    const capped = Object.prototype.hasOwnProperty.call(BODY_CELL_CAPS, key)
      ? clampCell(v, BODY_CELL_CAPS[key])
      : v == null ? '' : String(v);
    repl[`{{${key}}}`] = capped;
  }
  return repl;
}

// 파일시스템·헤더 안전을 위해 금지문자 제거(파일명 fallback 용)
function sanitizeForFilename(s) {
  return String(s || '')
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

// 다운로드 파일명 베이스: 출강확인서_{프로그램}_{N회차}
function buildFilenameBase(body) {
  const b = body || {};
  const program = sanitizeForFilename(b.프로그램명);
  // 기수회차 "(1기수 / 5회차)" 에서 "N회차" 추출(없으면 생략)
  const m = String(b.기수회차 || '').match(/(\d+)\s*회차/);
  const hoecha = m ? `${m[1]}회차` : '';
  return ['출강확인서', program, hoecha].filter(Boolean).join('_');
}

// photoBuffer(선택, Buffer): 있으면 BinData/chulgang_photo.png 교체. 없으면 더미 유지(회귀 없음).
async function generateChulgangForm(body, photoBuffer) {
  const replacements = buildChulgangReplacements(body);
  const imageReplacements =
    photoBuffer && Buffer.isBuffer(photoBuffer)
      ? { [PHOTO_BINDATA_KEY]: photoBuffer }
      : {};
  const signature = buildSignatureTransform(); // 서명 파일 없으면 null → "(인)" 유지
  const buffer = await fillHwpx(TEMPLATE_PATH, replacements, imageReplacements, {
    extraImages: signature ? [signature.image] : [],
    sectionTransforms: signature ? [signature.transform] : [],
  });
  const filenameBase = buildFilenameBase(body);
  return { buffer, filenameBase };
}

module.exports = {
  generateChulgangForm,
  buildChulgangReplacements,
  buildFilenameBase,
  buildSignatureTransform,
  clampCell,
  BODY_CELL_CAPS,
  PLACEHOLDER_KEYS,
  PHOTO_BINDATA_KEY,
  SIGNATURE_PATH,
  TEMPLATE_PATH,
};
