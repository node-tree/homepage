const path = require('path');
const { fillHwpx } = require('./hwpxFill');
const { buildPhotoItem, buildSignatureItem, linesToItems, headedItems } = require('./hwpxBlocks');

// ═══════════════════════════════════════════════════════════════
// 서식5 출강확인서 (2026-10 최신판).
//   템플릿 = 9월 출강확인서(한컴 저장본)에서 사진·서명·글을 뺀 것. 표·글자 서식은 제출본과 같다.
//   · 칸마다 여러 문단: 교육내용(「N회차」·○ 교육목표·○ 세부내용·가./나.…·○ 교육재료),
//     자체평가(○ 세 항목) — 입력 글의 줄바꿈이 그대로 문단이 된다.
//   · 진행사진 2장: 왼쪽 수업 사진, 오른쪽 다과비 증빙 사진(비율 유지). 없으면 서식 안내 글을 둔다.
//   · 담당자 서명: 「(인)」 글자 위에 떠 있는 그림(제출본과 같은 자리). 서명 없으면 「(인)」만.
//   · 운영방식은 「대면」 한 줄(체크 포함), 분은 교육시간에서 읽는다.
//   서버는 얇은 매퍼 — 값 조립은 프론트(ChulgangForm.tsx)가 한다.
// ═══════════════════════════════════════════════════════════════

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'forms', '서식5_출강확인서.hwpx');

// 9월 제출본에서 잰 자리(hwpunit). 사진 칸 안쪽 폭 19103, 서명은 「(인)」 위.
const PHOTO_BOX = { maxWidth: 19100, maxHeight: 14325 };
const SIGNATURE_PLACE = { width: 6602, height: 2917, vertOffset: 822, horzOffset: 25261 };

const PHOTO_GUIDE_CLASS = ['교육 진행 사진', '※ 강사, 프로그램 참여자(뒷모습 가능), 교육재료 등 파악할 수 있는 사진으로 첨부'];
const PHOTO_GUIDE_SNACK = ['(식/다과 준비 시)', '해당 회차 교육의 다과 구매 건을', '확인할 수 있는 사진', '(참여자가 시식 중인 사진 아님)'];

// 입력이 비정상적으로 길 때만 자르는 상한(제출본 9월 분량의 약 2배). 줄바꿈은 살린다.
const TEXT_CAPS = {
  교육목표: 500,
  세부내용: 2000,
  교육재료: 400,
  평가_운영: 900,
  평가_반응: 900,
  평가_보완: 900,
};

function clampText(value, cap) {
  const v = value == null ? '' : String(value).replace(/\r\n?/g, '\n').trim();
  if (!cap || v.length <= cap) return v;
  const slice = v.slice(0, cap);
  const cut = Math.max(slice.lastIndexOf('다.'), slice.lastIndexOf('\n'));
  return (cut > cap * 0.6 ? slice.slice(0, cut + (slice[cut] === '다' ? 2 : 0)) : slice).trim();
}

const DEFAULT_RUNTIME_MINUTES = 180;

// "(14:00~17:00 / 3시간)" · "3시간" · "180분" → 분. 못 읽으면 null.
function parseRuntimeMinutes(교육시간) {
  const t = String(교육시간 || '');
  const hour = t.match(/([\d.]+)\s*시간/);
  if (hour) {
    const m = Math.round(parseFloat(hour[1]) * 60);
    if (m > 0) return m;
  }
  const min = t.match(/(\d+)\s*분/);
  if (min) {
    const m = Number(min[1]);
    if (m > 0) return m;
  }
  return null;
}

function hoechaLabel(기수회차) {
  const m = String(기수회차 || '').match(/(\d+)\s*회차/);
  return m ? `${m[1]}회차` : '해당 회차';
}

const str = (v) => (v == null ? '' : String(v).trim());

// photos: { 수업: Buffer|null, 다과: Buffer|null }
function buildChulgangBlocks(body, photos = {}) {
  const b = body || {};
  const images = [];
  const photoBlock = (buffer, slot, guide) => {
    const p = buildPhotoItem(buffer, { slot, ...PHOTO_BOX });
    if (!p) return guide;
    images.push(p.image);
    return [p.item];
  };
  const sig = buildSignatureItem('damdangja', SIGNATURE_PLACE);
  if (sig) images.push(sig.image);

  const t = (k) => clampText(b[k], TEXT_CAPS[k]);
  const blocks = {
    출강강사: [str(b.출강강사)],
    교육장소: [str(b.교육장소), str(b.교육장소상세)].filter(Boolean),
    강사수: [str(b.강사수)],
    정원: [str(b.정원)],
    실참여: [str(b.실참여)],
    프로그램명: [str(b.프로그램명), str(b.프로그램부제), str(b.기수회차)].filter(Boolean),
    교육일자: [str(b.교육일자), str(b.교육시간)].filter(Boolean),
    교육주제: linesToItems(b.교육주제),
    교육내용: [
      hoechaLabel(b.기수회차),
      ...headedItems('○ 교육목표', t('교육목표')),
      ...headedItems('○ 세부내용', t('세부내용')),
      ...headedItems('○ 교육재료', t('교육재료')),
    ],
    자체평가: [
      ...headedItems('○ 운영 방식 및 교육 내용에 대한 평가', t('평가_운영')),
      ...headedItems('○ 인상 깊었던 참여자 반응 및 요청사항 등', t('평가_반응')),
      ...headedItems('○ 아쉬운 점, 보완 지점 등', t('평가_보완')),
    ],
    사진_수업: photoBlock(photos.수업, 'class', PHOTO_GUIDE_CLASS),
    사진_다과: photoBlock(photos.다과, 'snack', PHOTO_GUIDE_SNACK),
    서명: sig ? [sig.item] : [''],
  };
  return { blocks, images };
}

function buildChulgangReplacements(body) {
  const b = body || {};
  const minutes = parseRuntimeMinutes(b.교육시간) || DEFAULT_RUNTIME_MINUTES;
  return {
    '{{운영분}}': String(minutes),
    '{{확인년}}': str(b.확인년),
    '{{확인월}}': str(b.확인월),
    '{{확인일}}': str(b.확인일),
    '{{담당자}}': str(b.담당자),
  };
}

function sanitizeForFilename(s) {
  return String(s || '')
    .replace(/[/\\:*?"<>|〈〉]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

// 다운로드 파일명: 출강확인서_{프로그램}_{N회차} (부제가 있으면 부제를 쓴다 — 예 땅을달래는노래)
function buildFilenameBase(body) {
  const b = body || {};
  const program = sanitizeForFilename(b.프로그램부제 || b.프로그램명);
  const m = String(b.기수회차 || '').match(/(\d+)\s*회차/);
  return ['출강확인서', program, m ? `${m[1]}회차` : ''].filter(Boolean).join('_');
}

async function generateChulgangForm(body, photos = {}) {
  const { blocks, images } = buildChulgangBlocks(body, photos);
  const buffer = await fillHwpx(TEMPLATE_PATH, buildChulgangReplacements(body), {}, {
    blocks,
    extraImages: images,
  });
  return { buffer, filenameBase: buildFilenameBase(body) };
}

module.exports = {
  generateChulgangForm,
  buildChulgangBlocks,
  buildChulgangReplacements,
  buildFilenameBase,
  parseRuntimeMinutes,
  clampText,
  TEXT_CAPS,
  TEMPLATE_PATH,
};
