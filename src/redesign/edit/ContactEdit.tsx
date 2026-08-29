import React, { useEffect, useState } from 'react';
import { contactAPI } from '../../services/api';
import { DbContact } from '../db';
import EditBar from './ui/EditBar';
import { TextInput } from './ui/fields';
import { useToast } from './ui/Toast';

// ════════════════════════════════════════════════════════════════════════
// ContactEdit — /contact 제자리 편집(이메일 배열 · 소재지 · 매개 링크 배열).
//   순서 바꾸기는 ↑↓ 단추다 — 짧은 배열이라 드래그보다 정확하고 키보드로도 된다.
// ════════════════════════════════════════════════════════════════════════

interface Social {
  name: string;
  url: string;
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

export interface ContactEditProps {
  data: DbContact;
  onSaved: () => void;
  onClose: () => void;
}

const ContactEdit: React.FC<ContactEditProps> = ({ data, onSaved, onClose }) => {
  const toast = useToast();
  const [emails, setEmails] = useState<string[]>(data.emails.length ? data.emails : ['']);
  const [location, setLocation] = useState(data.location);
  const [links, setLinks] = useState<Social[]>(data.socialLinks);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setEmails(data.emails.length ? data.emails : ['']);
    setLocation(data.location);
    setLinks(data.socialLinks);
    setDirty(false);
  }, [data]);

  const touch = () => setDirty(true);

  const save = async () => {
    const cleanEmails = emails.map((e) => e.trim()).filter(Boolean);
    const cleanLinks = links.map((l) => ({ name: l.name.trim(), url: l.url.trim() })).filter((l) => l.name && l.url);
    if (cleanEmails.length === 0) {
      toast.err('이메일이 최소 한 줄은 있어야 합니다.');
      return;
    }
    setBusy(true);
    try {
      const res: any = await contactAPI.updateContact({
        emails: cleanEmails,
        location: location.trim(),
        socialLinks: cleanLinks,
      });
      if (res?.success === false) throw new Error(res?.message || '저장에 실패했습니다.');
      setDirty(false);
      toast.ok(`연락처를 저장했습니다 · 메일 ${cleanEmails.length} · 매개 ${cleanLinks.length}`);
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
      <section className="nte-panel" aria-label="CONTACT 편집">
        <div className="nte-in">
          <div className="nte-legend">
            <span>
              편집 EDIT · <b>CONTACT</b> · /api/contact
            </span>
          </div>

          <div className="nte-field">
            <div className="nte-label">이메일 EMAILS</div>
            <div className="nte-arr">
              {emails.map((email, i) => (
                <div className="nte-arrrow one" key={`email-${i}`}>
                  <div className="nte-field">
                    <input
                      className="nte-input"
                      type="email"
                      value={email}
                      aria-label={`이메일 ${i + 1}`}
                      placeholder="name@nodetree.kr"
                      onChange={(e) => {
                        setEmails((prev) => prev.map((v, k) => (k === i ? e.target.value : v)));
                        touch();
                      }}
                    />
                  </div>
                  <span className="nte-rowacts">
                    <button
                      type="button"
                      className="nte-btn"
                      aria-label={`이메일 ${i + 1} 위로`}
                      disabled={i === 0}
                      onClick={() => {
                        setEmails((prev) => move(prev, i, i - 1));
                        touch();
                      }}
                    >
                      위
                    </button>
                    <button
                      type="button"
                      className="nte-btn"
                      aria-label={`이메일 ${i + 1} 아래로`}
                      disabled={i === emails.length - 1}
                      onClick={() => {
                        setEmails((prev) => move(prev, i, i + 1));
                        touch();
                      }}
                    >
                      아래
                    </button>
                    <button
                      type="button"
                      className="nte-btn warn"
                      aria-label={`이메일 ${i + 1} 삭제`}
                      disabled={emails.length <= 1}
                      onClick={() => {
                        setEmails((prev) => prev.filter((_, k) => k !== i));
                        touch();
                      }}
                    >
                      삭제
                    </button>
                  </span>
                </div>
              ))}
            </div>
            <div className="nte-acts" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="nte-btn"
                onClick={() => {
                  setEmails((prev) => [...prev, '']);
                  touch();
                }}
              >
                이메일 추가
              </button>
            </div>
          </div>

          <TextInput
            label="소재지 LOCATION"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              touch();
            }}
          />

          <div className="nte-field">
            <div className="nte-label">매개 SOCIAL</div>
            <div className="nte-arr">
              {links.length === 0 && <div className="nte-empty">ABSENT · 매개 링크가 없습니다.</div>}
              {links.map((l, i) => (
                <div className="nte-arrrow" key={`link-${i}`}>
                  <div className="nte-field">
                    <input
                      className="nte-input"
                      type="text"
                      value={l.name}
                      aria-label={`매개 ${i + 1} 이름`}
                      placeholder="Instagram"
                      onChange={(e) => {
                        setLinks((prev) => prev.map((v, k) => (k === i ? { ...v, name: e.target.value } : v)));
                        touch();
                      }}
                    />
                  </div>
                  <div className="nte-field">
                    <input
                      className="nte-input"
                      type="url"
                      value={l.url}
                      aria-label={`매개 ${i + 1} 주소`}
                      placeholder="https://…"
                      onChange={(e) => {
                        setLinks((prev) => prev.map((v, k) => (k === i ? { ...v, url: e.target.value } : v)));
                        touch();
                      }}
                    />
                  </div>
                  <span className="nte-rowacts">
                    <button
                      type="button"
                      className="nte-btn"
                      aria-label={`매개 ${i + 1} 위로`}
                      disabled={i === 0}
                      onClick={() => {
                        setLinks((prev) => move(prev, i, i - 1));
                        touch();
                      }}
                    >
                      위
                    </button>
                    <button
                      type="button"
                      className="nte-btn"
                      aria-label={`매개 ${i + 1} 아래로`}
                      disabled={i === links.length - 1}
                      onClick={() => {
                        setLinks((prev) => move(prev, i, i + 1));
                        touch();
                      }}
                    >
                      아래
                    </button>
                    <button
                      type="button"
                      className="nte-btn warn"
                      aria-label={`매개 ${i + 1} 삭제`}
                      onClick={() => {
                        setLinks((prev) => prev.filter((_, k) => k !== i));
                        touch();
                      }}
                    >
                      삭제
                    </button>
                  </span>
                </div>
              ))}
            </div>
            <div className="nte-acts" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="nte-btn"
                onClick={() => {
                  setLinks((prev) => [...prev, { name: '', url: '' }]);
                  touch();
                }}
              >
                매개 추가
              </button>
            </div>
            <div className="nte-hint">이름·주소가 둘 다 있는 줄만 저장된다. 표시는 도메인부터, 링크는 전체 주소.</div>
          </div>
        </div>
      </section>

      <EditBar label="CONTACT · 제자리 편집" busy={busy} dirty={dirty} onSave={save} onCancel={onClose} />
    </>
  );
};

export default ContactEdit;
