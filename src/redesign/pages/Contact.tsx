import React, { useState } from 'react';
import { AdminLine, State } from '../components/bits';
import NtPage from '../components/NtPage';
import { useContact } from '../db';
import { useAuth } from '../../contexts/AuthContext';
import { contactAPI } from '../../services/api';

// ════════════════════════════════════════════════════════════════════════
// CONTACT(/contact) — 내용·기능은 레거시 그대로(DB /api/contact + 메시지 전송),
//   판식만 about.html 의 Contact 블록으로: 이메일·주소·매개 링크를 계선 행에 앉히고
//   매개(외부 도메인) 행만 점선 = 「바깥」 표시. 양식은 계선 입력(둥근 모서리·그림자 없음).
// ════════════════════════════════════════════════════════════════════════

const ensureProtocol = (url: string): string =>
  !url ? url : url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;

// 표시 텍스트만 줄인다(href 는 언제나 전체 URL).
//   'https://www.instagram.com/node.tree' → 'instagram.com/node.tree'
//   390px 에서 프로토콜·www 까지 한 토막이라 값 칸을 20px 밀어냈다(계선 밖 넘침).
const displayUrl = (url: string): string =>
  !url ? url : url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');

const Contact: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { data, error, loading, reload } = useContact();

  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusText, setStatusText] = useState('');

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setStatus('idle');
    try {
      const res = await contactAPI.sendMessage(form);
      if (res.success) {
        setStatus('success');
        setStatusText(res.message || '메시지가 전송되었습니다.');
        setForm({ name: '', email: '', subject: '', message: '' });
      } else {
        setStatus('error');
        setStatusText(res.message || '전송에 실패했습니다.');
      }
    } catch (err) {
      setStatus('error');
      setStatusText(err instanceof Error ? err.message : '전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  return (
    <NtPage
      path="/contact"
      title="NODE TREE | Contact — 연락처"
      description="NODE TREE에 문의하기. 협업 및 전시 문의를 환영합니다."
      keywords="NODE TREE 연락처, 문의, 협업"
    >
      <section className="pagehead">
        <div className="lab">CONTACT</div>
        <h1>
          CONTACT
          <em>Find Us</em>
        </h1>
      </section>
      <div className="hair dae" />

      {loading && <State text="LOADING · 연락처를 불러오는 중…" />}
      {error && <State text={`ERROR · ${error}`} onRetry={reload} />}

      <section className="about" style={{ paddingTop: 56 }}>
        <div className="lft">
          <div className="blk">
            <b>메시지 CONTACT US</b>
            <form className="form" onSubmit={submit}>
              <div className="fld">
                <label htmlFor="name">NAME</label>
                <input id="name" name="name" type="text" value={form.name} onChange={change} required placeholder="이름" />
              </div>
              <div className="fld">
                <label htmlFor="email">EMAIL</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={change}
                  required
                  placeholder="your@email.com"
                />
              </div>
              <div className="fld">
                <label htmlFor="subject">SUBJECT</label>
                <input
                  id="subject"
                  name="subject"
                  type="text"
                  value={form.subject}
                  onChange={change}
                  required
                  placeholder="제목"
                />
              </div>
              <div className="fld">
                <label htmlFor="message">MESSAGE</label>
                <textarea id="message" name="message" value={form.message} onChange={change} required placeholder="내용" />
              </div>
              <button type="submit" disabled={sending}>
                {sending ? 'SENDING…' : 'SEND MESSAGE'}
              </button>
              {status !== 'idle' && <p className={`msg${status === 'error' ? ' err' : ''}`}>{statusText}</p>}
            </form>
          </div>
        </div>

        <div className="rgt">
          <div className="blk">
            <b>연락 CONTACT</b>
            {(data?.emails ?? []).map((email) => (
              <div className="prow" key={email}>
                <span className="n">Email</span>
                <span>
                  <a href={`mailto:${email}`}>{email}</a>
                </span>
              </div>
            ))}
            <div className="prow">
              <span className="n">Location</span>
              <span>{data?.location || '—'}</span>
            </div>
          </div>

          {(data?.socialLinks ?? []).length > 0 && (
            <div className="blk out">
              <b>매개 SOCIAL — 본체는 각자의 플랫폼에 있다</b>
              {(data?.socialLinks ?? []).map((l) => (
                <div className="prow out" key={`${l.name}-${l.url}`}>
                  <span className="n">{l.name}</span>
                  <span>
                    {/* href 는 DB 원문(프로토콜 보강)을 그대로, 표시만 도메인부터 */}
                    <a href={ensureProtocol(l.url)} target="_blank" rel="noopener noreferrer">
                      {displayUrl(l.url)}
                    </a>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="src">출처 · nodetree.kr DB /api/contact</div>
          {isAuthenticated && <AdminLine page="contact" />}
        </div>
      </section>
    </NtPage>
  );
};

export default Contact;
