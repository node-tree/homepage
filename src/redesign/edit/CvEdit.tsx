import React, { useEffect, useState } from 'react';
import { cvAPI } from '../../services/api';
import { DbCv } from '../db';
import EditBar from './ui/EditBar';
import { TextArea, TextInput } from './ui/fields';
import { useToast } from './ui/Toast';

// ════════════════════════════════════════════════════════════════════════
// CvEdit — /cv 제자리 편집.
//   저장 포맷은 레거시와 **동일한 줄글**이다(파서는 CV.tsx 의 parseCv 가 읽는다):
//     [분류]        — 대괄호 한 줄이면 절(section) 머리
//     2024 항목_장소 — 앞 4자리는 연도, 밑줄(_) 뒤는 장소
//   구조화(행 단위 편집)는 2단계. 지금은 원문을 그대로 고친다.
// ════════════════════════════════════════════════════════════════════════

export interface CvEditProps {
  data: DbCv;
  onSaved: () => void;
  onClose: () => void;
}

const CvEdit: React.FC<CvEditProps> = ({ data, onSaved, onClose }) => {
  const toast = useToast();
  const [title, setTitle] = useState(data.title);
  const [subtitle, setSubtitle] = useState(data.subtitle);
  const [content, setContent] = useState(data.content);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setTitle(data.title);
    setSubtitle(data.subtitle);
    setContent(data.content);
    setDirty(false);
  }, [data]);

  const lines = content.split('\n').filter((l) => l.trim()).length;
  const sections = content.split('\n').filter((l) => /^\s*\[.+\]\s*$/.test(l)).length;

  const save = async () => {
    setBusy(true);
    try {
      const res: any = await cvAPI.updateCV({ title: title.trim(), subtitle: subtitle.trim(), content });
      if (res?.success === false) throw new Error(res?.message || '저장에 실패했습니다.');
      setDirty(false);
      toast.ok(`이력을 저장했습니다 · ${lines}행`);
      onSaved();
      onClose();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="nte-panel" aria-label="CV 편집">
        <div className="nte-in">
          <div className="nte-legend">
            <span>
              편집 EDIT · <b>CV</b> · /api/cv
            </span>
            <span>
              {sections}절 · {lines}행
            </span>
          </div>

          <TextInput
            label="표찰 LABEL"
            value={title}
            hint="표제 위 Mono 한 줄(예: CV)."
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
          />
          <TextInput
            label="표제 HEADING"
            value={subtitle}
            hint="예: 활동 이력"
            onChange={(e) => {
              setSubtitle(e.target.value);
              setDirty(true);
            }}
          />
          <TextArea
            label="원문 CONTENT"
            value={content}
            tall
            spellCheck={false}
            hint="[전시/공연] 처럼 대괄호 한 줄이면 절 머리. 「2024 제목_장소」— 앞 4자리는 연도, 밑줄 뒤는 장소로 앉는다."
            onChange={(e) => {
              setContent(e.target.value);
              setDirty(true);
            }}
          />
        </div>
      </section>

      <EditBar label="CV · 제자리 편집" busy={busy} dirty={dirty} onSave={save} onCancel={onClose} />
    </>
  );
};

export default CvEdit;
