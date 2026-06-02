import React, { useState } from 'react';
import { fileToFramedPng } from './imageToPng';

// ═══════════════════════════════════════════════════════════════
// 사진 첨부 (출강확인서 진행사진 / 회의록 회의사진 공용).
//   · accept="image/*" → canvas 로 템플릿 프레임 비율(≈1.583:1) 레터박스 PNG 변환
//     (비율보존 contain + 흰 여백) → base64(프리픽스 제거). HWPX 프레임 강제 늘림 왜곡 방지.
//   · 썸네일 미리보기 = 동일 레터박스 결과(dataUrl). 제거 버튼. base64 는 onChange 로 전달(없으면 '').
//   · 디자인 --kd-* 토큰(formsView.css).
// ═══════════════════════════════════════════════════════════════

interface PhotoUploadProps {
  label: string; // 예: '진행사진' / '회의사진'
  onChange: (base64: string) => void; // 프리픽스 없는 base64 (제거 시 '')
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({ label, onChange }) => {
  const [preview, setPreview] = useState<string>(''); // dataUrl (미리보기)
  const [err, setErr] = useState<string>('');
  const [working, setWorking] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    // 같은 파일 재선택 허용 위해 input 값 초기화
    e.target.value = '';
    if (!file) return;
    setErr('');
    setWorking(true);
    try {
      const { base64, dataUrl } = await fileToFramedPng(file, 1280);
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
      <span className="kd-field-label">{label} (선택 · 프레임 비율 맞춤·흰 여백)</span>
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
      {preview && (
        <img src={preview} alt={`${label} 미리보기`} className="kd-forms-photo-thumb" />
      )}
    </div>
  );
};

export default PhotoUpload;
