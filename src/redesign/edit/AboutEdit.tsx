import React, { useCallback, useEffect, useRef, useState } from 'react';
import Editor2 from '../editor2/Editor2';
import { aboutAPI } from '../../services/api';
import { DbAbout } from '../db';
import EditBar from './ui/EditBar';
import PromptDialog from './ui/PromptDialog';
import { TextInput } from './ui/fields';
import { useToast } from './ui/Toast';

// ════════════════════════════════════════════════════════════════════════
// AboutEdit — /about 제자리 편집.
//   DB 필드 뜻(레거시 About.tsx 와 동일):
//     title      = Mono 표찰(ABOUT)
//     content    = 표제 한 줄(예: '노드 트리(NODE TREE)')
//     htmlContent= 본문(BlockEditor)
// ════════════════════════════════════════════════════════════════════════

export interface AboutEditProps {
  data: DbAbout;
  onSaved: () => void;
  onClose: () => void;
}

const AboutEdit: React.FC<AboutEditProps> = ({ data, onSaved, onClose }) => {
  const toast = useToast();
  const [title, setTitle] = useState(data.title);
  const [content, setContent] = useState(data.content);
  const [html, setHtml] = useState(data.htmlContent);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [linkAsk, setLinkAsk] = useState(false);
  const linkCb = useRef<((url: string) => void) | null>(null);

  useEffect(() => {
    setTitle(data.title);
    setContent(data.content);
    setHtml(data.htmlContent);
    setDirty(false);
  }, [data]);

  const requestLink = useCallback((cb: (url: string) => void) => {
    linkCb.current = cb;
    setLinkAsk(true);
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      // 서버는 빈 문자열을 '수정할 내용 없음'으로 흘려보낸다(about.js: if (title) …).
      // 그래서 비운 칸은 보내지 않는다 — 지우기는 2단계(초안/발행)에서 다룬다.
      const res: any = await aboutAPI.updateAbout({
        title: title.trim(),
        content: content.trim(),
        htmlContent: html,
      });
      if (res?.success === false) throw new Error(res?.message || '저장에 실패했습니다.');
      setDirty(false);
      toast.ok('소개를 저장했습니다.');
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
      <section className="nte-panel" aria-label="ABOUT 편집">
        <div className="nte-in">
          <div className="nte-legend">
            <span>
              편집 EDIT · <b>ABOUT</b> · /api/about
            </span>
          </div>

          <TextInput
            label="표찰 LABEL"
            value={title}
            hint="표제 위 Mono 한 줄(예: ABOUT)."
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
          />
          <TextInput
            label="표제 HEADING"
            value={content}
            hint="한글(영문) 꼴로 적으면 괄호 안이 곁말로 앉는다 — 예: 노드 트리(NODE TREE)."
            onChange={(e) => {
              setContent(e.target.value);
              setDirty(true);
            }}
          />

          <div className="nte-field">
            <div className="nte-label">본문 BODY</div>
            <div className="nte-blockeditor">
              <Editor2
                value={html}
                onChange={(next) => {
                  setHtml(next);
                  setDirty(true);
                }}
                placeholder="소개글을 입력하십시오"
                onRequestLink={requestLink}
              />
            </div>
            <div className="nte-hint">본문에 실린 도판은 읽기 화면 우단 「도판 PLATES」에 그대로 뽑힌다.</div>
          </div>
        </div>
      </section>

      <EditBar label="ABOUT · 제자리 편집" busy={busy} dirty={dirty} onSave={save} onCancel={onClose} />

      <PromptDialog
        open={linkAsk}
        title="링크 걸기"
        label="링크 URL"
        placeholder="https://…"
        onCancel={() => {
          linkCb.current = null;
          setLinkAsk(false);
        }}
        onSubmit={(url) => {
          linkCb.current?.(url);
          linkCb.current = null;
          setLinkAsk(false);
        }}
      />
    </>
  );
};

export default AboutEdit;
