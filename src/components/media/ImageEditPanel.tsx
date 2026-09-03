// ═══════════════════════════════════════════════════════════════
// ImageEditPanel — 파일 상세 패널의 「편집」 탭
//
//   두 경로를 명확히 갈라 놓는다(사용자가 무엇이 바뀌는지 알아야 한다):
//   ① 비파괴 — ImageKit 변환 URL(rt-/fl-/w-/ar-/q-/f- …)만 만들어 복사.
//      저장소 원본은 손대지 않는다. 새 URL 을 쓰는 곳에만 적용된다.
//   ② 파괴 — 브라우저 canvas 로 실제 픽셀을 바꾼 뒤 같은 경로·같은 파일명으로 재업로드
//      (useUniqueFileName=false + overwriteFile=true) → URL 이 유지돼 게시물이 안 깨진다.
//      실행 후 CDN 캐시 퍼지까지 자동 요청. 되돌릴 수 없다 → 2단계 확인.
//
//   GIF/SVG 는 양쪽 모두 차단하고 사유를 표시한다.
// ═══════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { imagekitAdminAPI, IkFileDetail } from '../../services/imagekitAdminApi';
import {
  DEFAULT_TRANSFORM,
  IkFlip,
  IkRotate,
  IkTransformOptions,
  canTransform,
  describeTransform,
  ikTransformUrl,
  transformBlockReason,
  withCacheBuster,
} from '../../utils/ikTransform';
import {
  CropRect,
  EditOps,
  IDENTITY_OPS,
  applyEdits,
  canEditDestructive,
  decodeImage,
  decodedSize,
  destructiveBlockReason,
  isIdentity,
  outputMime,
  previewSize,
} from '../../utils/imageEdit';
import { parentPath } from '../../utils/ikPath';
import CropBox from './CropBox';

const RATIOS: { label: string; value: number | null }[] = [
  { label: '자유', value: null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '16:9', value: 16 / 9 },
  { label: '3:4', value: 3 / 4 },
  { label: '9:16', value: 9 / 16 },
];

const FULL_RECT: CropRect = { x: 0, y: 0, w: 1, h: 1 };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export interface ImageEditPanelProps {
  file: IkFileDetail;
  onCopy: (url: string) => void;
  copiedUrl: string | null;
  /** 저장 완료(원본 교체) 후 목록/상세 갱신 요청 */
  onSaved: (message: string) => void;
}

const ImageEditPanel: React.FC<ImageEditPanelProps> = ({ file, onCopy, copiedUrl, onSaved }) => {
  const [mode, setMode] = useState<'url' | 'pixel'>('url');

  // ── ① 비파괴(URL 변환) ─────────────────────────────────────
  const [tr, setTr] = useState<IkTransformOptions>({ ...DEFAULT_TRANSFORM });
  const transformOk = canTransform(file.url);
  const transformBlock = transformBlockReason(file.url);
  const transformedUrl = useMemo(() => ikTransformUrl(file.url, tr), [file.url, tr]);

  // ── ② 파괴(원본 교체) ──────────────────────────────────────
  const [ops, setOps] = useState<EditOps>({ ...IDENTITY_OPS });
  const [ratio, setRatio] = useState<number | null>(null);
  const [cropOn, setCropOn] = useState(false);
  const [rect, setRect] = useState<CropRect>({ ...FULL_RECT });
  const [srcSize, setSrcSize] = useState<{ width: number; height: number } | null>(null);
  const [decodeErr, setDecodeErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewInfo, setPreviewInfo] = useState<{ w: number; h: number; size: number } | null>(null);
  const [busyPreview, setBusyPreview] = useState(false);
  const decodedRef = useRef<Awaited<ReturnType<typeof decodeImage>> | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const pixelOk = canEditDestructive(file.name || file.url);
  const pixelBlock = destructiveBlockReason(file.name || file.url);

  // 파일이 바뀌면 편집 상태 초기화
  useEffect(() => {
    setTr({ ...DEFAULT_TRANSFORM });
    setOps({ ...IDENTITY_OPS });
    setRect({ ...FULL_RECT });
    setRatio(null);
    setCropOn(false);
    setSrcSize(null);
    setDecodeErr(null);
    setSaveErr(null);
    setConfirmOpen(false);
    setPreviewInfo(null);
    decodedRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, [file.fileId]);

  // 언마운트 시 objectURL 정리(누수 방지)
  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

  // 픽셀 편집 탭 진입 시 원본 1회 디코딩(변환 파라미터 없는 진짜 원본)
  useEffect(() => {
    if (mode !== 'pixel' || !pixelOk || decodedRef.current || decodeErr) return;
    let alive = true;
    const origin = file.url.split('?')[0];
    decodeImage(origin)
      .then((d) => {
        if (!alive) return;
        decodedRef.current = d;
        setSrcSize(decodedSize(d));
      })
      .catch((e: any) => {
        if (alive) setDecodeErr(e?.message || '원본을 불러오지 못했습니다.');
      });
    return () => {
      alive = false;
    };
  }, [mode, pixelOk, file.url, decodeErr]);

  const effectiveOps: EditOps = useMemo(
    () => ({ ...ops, crop: cropOn ? rect : null }),
    [ops, cropOn, rect]
  );

  const outSize = useMemo(() => {
    if (!srcSize) return null;
    return previewSize(srcSize.width, srcSize.height, effectiveOps);
  }, [srcSize, effectiveOps]);

  // 미리보기 생성(디바운스) — 실제 저장에 쓰는 applyEdits 를 그대로 통과시켜
  // "보이는 것 = 저장되는 것" 을 보장한다.
  useEffect(() => {
    if (mode !== 'pixel' || !decodedRef.current) return;
    let alive = true;
    const t = window.setTimeout(async () => {
      setBusyPreview(true);
      try {
        const res = await applyEdits(decodedRef.current!, effectiveOps, {
          mime: outputMime(file.name || file.url),
        });
        if (!alive) return;
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const u = URL.createObjectURL(res.blob);
        objectUrlRef.current = u;
        setPreviewUrl(u);
        setPreviewInfo({ w: res.width, h: res.height, size: res.blob.size });
        setSaveErr(null);
      } catch (e: any) {
        if (alive) setSaveErr(e?.message || '미리보기를 만들지 못했습니다.');
      } finally {
        if (alive) setBusyPreview(false);
      }
    }, 220);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // srcSize 를 deps 에 반드시 포함한다 — 디코딩 결과는 ref 에 담기므로 완료해도 렌더가
    // 트리거되지 않는다. srcSize(state)가 채워지는 시점을 신호로 삼아야 첫 진입에서
    // 미리보기가 생성된다(빠뜨렸더니 "미리보기 준비 중…"에서 멈추는 결함이 실측으로 드러남).
  }, [mode, effectiveOps, file.name, file.url, srcSize]);

  const rotateBy = useCallback((deg: 90 | -90) => {
    setOps((o) => ({ ...o, rotate: (((o.rotate + deg + 360) % 360) as EditOps['rotate']) }));
  }, []);

  const resetPixel = useCallback(() => {
    setOps({ ...IDENTITY_OPS });
    setRect({ ...FULL_RECT });
    setCropOn(false);
    setRatio(null);
  }, []);

  // 원본 교체 저장
  const save = useCallback(async () => {
    if (!decodedRef.current || saving) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await applyEdits(decodedRef.current, effectiveOps, {
        mime: outputMime(file.name || file.url),
      });
      const folder = parentPath(file.filePath) || '/';
      // 같은 폴더 + 같은 파일명 + overwrite → URL 유지
      await imagekitAdminAPI.uploadFile(res.blob, file.name, {
        folder,
        useUniqueFileName: false,
        overwriteFile: true,
      });
      // 덮어썼으므로 URL 은 그대로다 → CDN 캐시를 비우지 않으면 옛 이미지가 계속 나온다.
      let purgeNote = '';
      try {
        const p = await imagekitAdminAPI.purgeCache(file.url.split('?')[0]);
        purgeNote = p.requestId ? ` · CDN 퍼지 요청됨(${p.requestId})` : ' · CDN 퍼지 요청됨';
      } catch (e: any) {
        purgeNote = ` · ⚠️ CDN 퍼지 실패(${e?.message || '알 수 없음'}) — 반영이 늦을 수 있습니다`;
      }
      setConfirmOpen(false);
      onSaved(
        `원본을 교체했습니다 (${res.width}×${res.height}, ${formatBytes(res.blob.size)}). URL은 그대로입니다${purgeNote}`
      );
    } catch (e: any) {
      setSaveErr(e?.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }, [saving, effectiveOps, file.name, file.filePath, file.url, onSaved]);

  const boxAspect = useMemo(() => {
    if (!srcSize) return 1;
    // 크롭 오버레이가 얹히는 미리보기는 "회전 전 원본" 기준으로 그린다.
    return srcSize.width / Math.max(1, srcSize.height);
  }, [srcSize]);

  return (
    <div className="ma-edit">
      <div className="ma-edit-tabs" role="tablist" aria-label="편집 방식">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'url'}
          className={`ma-edit-tab ${mode === 'url' ? 'on' : ''}`}
          onClick={() => setMode('url')}
        >
          비파괴 · URL 변환
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'pixel'}
          className={`ma-edit-tab ${mode === 'pixel' ? 'on' : ''}`}
          onClick={() => setMode('pixel')}
        >
          파괴 · 원본 교체
        </button>
      </div>

      {/* ───────── ① 비파괴 ───────── */}
      {mode === 'url' && (
        <div className="ma-edit-body">
          <p className="ma-edit-note">
            저장소 원본은 <strong>그대로 둡니다.</strong> 변환 파라미터가 붙은 새 URL만 만들어
            복사합니다 — 이 URL을 쓰는 곳에만 적용됩니다.
          </p>

          {!transformOk ? (
            <p className="ma-error">{transformBlock}</p>
          ) : (
            <>
              <div className="ma-edit-preview">
                <img src={transformedUrl} alt={`${file.name} 변환 미리보기`} />
              </div>

              <div className="ma-edit-row">
                <span className="ma-edit-label">회전</span>
                <div className="ma-edit-btns">
                  {([0, 90, 180, 270] as IkRotate[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`ma-btn ${tr.rotate === d ? 'on' : ''}`}
                      onClick={() => setTr((s) => ({ ...s, rotate: d }))}
                    >
                      {d}°
                    </button>
                  ))}
                </div>
              </div>

              <div className="ma-edit-row">
                <span className="ma-edit-label">반전</span>
                <div className="ma-edit-btns">
                  {([
                    { v: 'none', l: '없음' },
                    { v: 'h', l: '좌우' },
                    { v: 'v', l: '상하' },
                    { v: 'h_v', l: '양쪽' },
                  ] as { v: IkFlip; l: string }[]).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      className={`ma-btn ${tr.flip === o.v ? 'on' : ''}`}
                      onClick={() => setTr((s) => ({ ...s, flip: o.v }))}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ma-edit-row">
                <span className="ma-edit-label">가로폭</span>
                <div className="ma-edit-btns">
                  {[null, 2400, 1600, 1200, 800, 400].map((w) => (
                    <button
                      key={String(w)}
                      type="button"
                      className={`ma-btn ${tr.width === w ? 'on' : ''}`}
                      onClick={() => setTr((s) => ({ ...s, width: w }))}
                    >
                      {w ? `${w}` : '원본'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ma-edit-row">
                <span className="ma-edit-label">비율 크롭</span>
                <div className="ma-edit-btns">
                  {[
                    { l: '없음', v: null },
                    { l: '1:1', v: '1-1' },
                    { l: '4:3', v: '4-3' },
                    { l: '3:2', v: '3-2' },
                    { l: '16:9', v: '16-9' },
                  ].map((o) => (
                    <button
                      key={o.l}
                      type="button"
                      className={`ma-btn ${tr.aspect === o.v ? 'on' : ''}`}
                      onClick={() =>
                        setTr((s) => ({
                          ...s,
                          aspect: o.v,
                          // 비율 크롭은 cm-extract + fo-auto 조합이라야 실제로 잘린다.
                          cropMode: o.v ? 'extract' : null,
                          focus: o.v ? 'auto' : null,
                          width: o.v && !s.width ? 1200 : s.width,
                        }))
                      }
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ma-edit-row">
                <span className="ma-edit-label">품질/형식</span>
                <div className="ma-edit-btns">
                  {[null, 90, 80, 60].map((q) => (
                    <button
                      key={String(q)}
                      type="button"
                      className={`ma-btn ${tr.quality === q ? 'on' : ''}`}
                      onClick={() => setTr((s) => ({ ...s, quality: q }))}
                    >
                      {q ? `q-${q}` : '기본'}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`ma-btn ${tr.format === 'auto' ? 'on' : ''}`}
                    onClick={() => setTr((s) => ({ ...s, format: s.format === 'auto' ? null : 'auto' }))}
                  >
                    f-auto
                  </button>
                  <button
                    type="button"
                    className={`ma-btn ${tr.grayscale ? 'on' : ''}`}
                    onClick={() => setTr((s) => ({ ...s, grayscale: !s.grayscale }))}
                  >
                    흑백
                  </button>
                </div>
              </div>

              <div className="ma-edit-urlbox">
                <code className="ma-edit-tr">{describeTransform(tr)}</code>
                <div className="ma-edit-btns">
                  <button type="button" className="ma-btn primary" onClick={() => onCopy(transformedUrl)}>
                    {copiedUrl === transformedUrl ? '복사됨' : '변환 URL 복사'}
                  </button>
                  <button
                    type="button"
                    className="ma-btn ghost"
                    onClick={() => setTr({ ...DEFAULT_TRANSFORM })}
                  >
                    초기화
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ───────── ② 파괴 ───────── */}
      {mode === 'pixel' && (
        <div className="ma-edit-body">
          <p className="ma-edit-warn">
            브라우저에서 픽셀을 바꿔 <strong>같은 경로·같은 파일명으로 원본을 교체</strong>합니다.
            URL은 그대로라 게시물은 깨지지 않지만, <strong>되돌릴 수 없습니다.</strong>
          </p>

          {!pixelOk ? (
            <p className="ma-error">{pixelBlock}</p>
          ) : decodeErr ? (
            <p className="ma-error">{decodeErr}</p>
          ) : !srcSize ? (
            <p className="ma-sub">원본을 불러오는 중…</p>
          ) : (
            <>
              <div className="ma-edit-preview">
                {cropOn ? (
                  // 크롭 중에는 회전 전 원본 위에 선택 영역을 얹는다(좌표 혼동 방지).
                  <div className="ma-crop-stage">
                    <img src={file.url.split('?')[0]} alt={`${file.name} 크롭`} />
                    <CropBox rect={rect} onChange={setRect} ratio={ratio} boxAspect={boxAspect} />
                  </div>
                ) : previewUrl ? (
                  <img src={previewUrl} alt={`${file.name} 편집 미리보기`} />
                ) : (
                  <div className="ma-sub">미리보기 준비 중…</div>
                )}
              </div>

              <div className="ma-edit-row">
                <span className="ma-edit-label">회전</span>
                <div className="ma-edit-btns">
                  <button type="button" className="ma-btn" onClick={() => rotateBy(-90)}>
                    ↺ 왼쪽 90°
                  </button>
                  <button type="button" className="ma-btn" onClick={() => rotateBy(90)}>
                    ↻ 오른쪽 90°
                  </button>
                  <span className="ma-edit-cur">{ops.rotate}°</span>
                </div>
              </div>

              <div className="ma-edit-row">
                <span className="ma-edit-label">반전</span>
                <div className="ma-edit-btns">
                  <button
                    type="button"
                    className={`ma-btn ${ops.flipH ? 'on' : ''}`}
                    onClick={() => setOps((o) => ({ ...o, flipH: !o.flipH }))}
                  >
                    좌우
                  </button>
                  <button
                    type="button"
                    className={`ma-btn ${ops.flipV ? 'on' : ''}`}
                    onClick={() => setOps((o) => ({ ...o, flipV: !o.flipV }))}
                  >
                    상하
                  </button>
                </div>
              </div>

              <div className="ma-edit-row">
                <span className="ma-edit-label">크롭</span>
                <div className="ma-edit-btns">
                  <button
                    type="button"
                    className={`ma-btn ${cropOn ? 'on' : ''}`}
                    onClick={() => {
                      setCropOn((v) => !v);
                      if (!cropOn) setRect({ ...FULL_RECT });
                    }}
                  >
                    {cropOn ? '크롭 끝내기' : '크롭 시작'}
                  </button>
                  {cropOn &&
                    RATIOS.map((r) => (
                      <button
                        key={r.label}
                        type="button"
                        className={`ma-btn ${ratio === r.value ? 'on' : ''}`}
                        onClick={() => {
                          setRatio(r.value);
                          if (r.value) {
                            // 비율 선택 즉시 현재 사각형을 비율에 맞춘다.
                            const h = Math.min(1, (rect.w * boxAspect) / r.value);
                            setRect((s) => ({ ...s, h, y: Math.min(s.y, 1 - h) }));
                          }
                        }}
                      >
                        {r.label}
                      </button>
                    ))}
                  {cropOn && (
                    <button type="button" className="ma-btn ghost" onClick={() => setRect({ ...FULL_RECT })}>
                      전체
                    </button>
                  )}
                </div>
              </div>

              <dl className="ma-detail ma-edit-size">
                <dt>원본</dt>
                <dd>
                  {srcSize.width} × {srcSize.height}
                  {file.size ? ` · ${formatBytes(file.size)}` : ''}
                </dd>
                <dt>결과</dt>
                <dd>
                  {outSize ? `${outSize.width} × ${outSize.height}` : '-'}
                  {previewInfo ? ` · ${formatBytes(previewInfo.size)}` : ''}
                  {busyPreview ? ' · 계산 중…' : ''}
                </dd>
              </dl>

              {saveErr && <p className="ma-error">{saveErr}</p>}

              <div className="ma-modal-actions">
                <button type="button" className="ma-btn ghost" onClick={resetPixel} disabled={saving}>
                  되돌리기
                </button>
                {confirmOpen ? (
                  <>
                    <span className="ma-selbar-warn">원본을 덮어씁니다. 되돌릴 수 없습니다.</span>
                    <button type="button" className="ma-btn danger" onClick={save} disabled={saving}>
                      {saving ? '저장 중…' : '덮어쓰기 확인'}
                    </button>
                    <button
                      type="button"
                      className="ma-btn ghost"
                      onClick={() => setConfirmOpen(false)}
                      disabled={saving}
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="ma-btn primary"
                    disabled={isIdentity(effectiveOps) || saving || busyPreview}
                    onClick={() => setConfirmOpen(true)}
                  >
                    원본 교체 저장
                  </button>
                )}
              </div>
              <p className="ma-modal-hint">
                저장 후 CDN 캐시 퍼지를 자동 요청합니다. 반영에 수 분이 걸릴 수 있어 화면에는 즉시
                갱신용 캐시버스터({withCacheBuster('…', 0).split('?')[1]})를 붙여 보여줍니다.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageEditPanel;
