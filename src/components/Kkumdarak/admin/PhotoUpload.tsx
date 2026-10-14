import React, { useState } from 'react';
import { fileToJpeg } from './imageToPng';

// ═══════════════════════════════════════════════════════════════
// 사진 첨부 (출강확인서·회의록·결과보고서·검수조서 공용).
//   · 원래 비율 그대로 긴 변 1600px JPEG 로 줄여 base64(프리픽스 제거)로 넘긴다(2026-10).
//     서버가 사진 비율에 맞춰 한글 칸 안 그림 크기를 정한다 — 늘림·여백 없음.
//   · 썸네일 미리보기, 제거 버튼. 없으면 '' 를 넘긴다(서식에는 안내 글이 남는다).
// ═══════════════════════════════════════════════════════════════

interface PhotoUploadProps {
  label: string; // 예: '수업 사진' / '다과비 증빙 사진'
  hint?: string;
  onChange: (base64: string) => void; // 프리픽스 없는 base64 (제거 시 '')
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({ label, hint, onChange }) => {
  const [preview, setPreview] = useState<string>('');
  const [err, setErr] = useState<string>('');
  const [working, setWorking] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // 같은 파일 재선택 허용
    if (!file) return;
    setErr('');
    setWorking(true);
    try {
      const { base64, dataUrl } = await fileToJpeg(file);
      setPreview(dataUrl);
      onChange(base64);
    } catch (e2: any) {
      setErr(e2?.message || '이미지 처리에 실패했습니다.');
      setPreview('');
      onChange('');
    } finally {
      setWorking(false);
    }
  };

  const remove = () => {
    setPreview('');
    setErr('');
    onChange('');
  };

  return (
    <div className="kd-forms-photo">
      <span className="kd-field-label">{label} (선택)</span>
      {hint && <span className="kd-forms-hint">{hint}</span>}
      <div className="kd-forms-photo-row">
        <input
          type="file"
          accept="image/*"
          className="kd-forms-photo-input"
          onChange={handleFile}
          disabled={working}
          aria-label={`${label} 첨부`}
        />
        {preview && (
          <button type="button" className="kd-ledger-action kd-ledger-action--danger" onClick={remove}>
            제거
          </button>
        )}
      </div>
      {working && <span className="kd-forms-photo-status">이미지 처리 중…</span>}
      {err && <span className="kd-ledger-warning">{err}</span>}
      {preview && <img src={preview} alt={`${label} 미리보기`} className="kd-forms-photo-thumb" />}
    </div>
  );
};

export default PhotoUpload;
