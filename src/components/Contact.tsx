import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import './Contact.css';
import { useAuth } from '../contexts/AuthContext';
import { contactAPI } from '../services/api';

interface SocialLink {
  name: string;
  url: string;
}

interface ContactData {
  emails: string[];
  location: string;
  socialLinks: SocialLink[];
}

// URL에 프로토콜이 없으면 https:// 추가
const ensureProtocol = (url: string): string => {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
};

const Contact: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Contact 설정 상태
  const [contactData, setContactData] = useState<ContactData>({
    emails: ['contact@nodetree.kr'],
    location: 'Seoul, South Korea',
    socialLinks: [
      { name: 'Instagram', url: 'https://www.instagram.com/nodetree_kr' },
      { name: 'YouTube', url: 'https://www.youtube.com/@nodetree' }
    ]
  });

  // 편집용 임시 상태
  const [editData, setEditData] = useState<ContactData>(contactData);

  // 폼 상태
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  // Contact 설정 로드
  useEffect(() => {
    const loadContact = async () => {
      try {
        const response = await contactAPI.getContact();
        if (response.success && response.data) {
          setContactData({
            emails: response.data.emails || ['contact@nodetree.kr'],
            location: response.data.location || 'Seoul, South Korea',
            socialLinks: response.data.socialLinks || []
          });
        }
      } catch (error) {
        console.error('Contact 로딩 오류:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadContact();
  }, []);

  // 편집 시작
  const handleStartEdit = () => {
    setEditData({ ...contactData });
    setIsEditing(true);
  };

  // 편집 취소
  const handleCancelEdit = () => {
    setEditData({ ...contactData });
    setIsEditing(false);
  };

  // 설정 저장
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await contactAPI.updateContact(editData);
      setContactData(editData);
      setIsEditing(false);
      alert('저장되었습니다.');
    } catch (error) {
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 소셜 링크 추가
  const handleAddSocialLink = () => {
    setEditData(prev => ({
      ...prev,
      socialLinks: [...prev.socialLinks, { name: '', url: '' }]
    }));
  };

  // 소셜 링크 삭제
  const handleRemoveSocialLink = (index: number) => {
    setEditData(prev => ({
      ...prev,
      socialLinks: prev.socialLinks.filter((_, i) => i !== index)
    }));
  };

  // 소셜 링크 수정
  const handleUpdateSocialLink = (index: number, field: 'name' | 'url', value: string) => {
    setEditData(prev => ({
      ...prev,
      socialLinks: prev.socialLinks.map((link, i) =>
        i === index ? { ...link, [field]: value } : link
      )
    }));
  };

  // 이메일 추가
  const handleAddEmail = () => {
    setEditData(prev => ({
      ...prev,
      emails: [...prev.emails, '']
    }));
  };

  // 이메일 삭제
  const handleRemoveEmail = (index: number) => {
    setEditData(prev => ({
      ...prev,
      emails: prev.emails.filter((_, i) => i !== index)
    }));
  };

  // 이메일 수정
  const handleUpdateEmail = (index: number, value: string) => {
    setEditData(prev => ({
      ...prev,
      emails: prev.emails.map((email, i) =>
        i === index ? value : email
      )
    }));
  };

  // 폼 입력 처리
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 메시지 전송
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await contactAPI.sendMessage(formData);
      if (response.success) {
        setSubmitStatus('success');
        setSubmitMessage(response.message || '메시지가 전송되었습니다.');
        setFormData({ name: '', email: '', subject: '', message: '' });
      } else {
        setSubmitStatus('error');
        setSubmitMessage(response.message || '전송에 실패했습니다.');
      }
    } catch (error) {
      setSubmitStatus('error');
      setSubmitMessage(error instanceof Error ? error.message : '전송에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="contact-container">
        <div className="contact-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="contact-container">
      {/* 관리자 편집 버튼 */}
      {isAuthenticated && !isEditing && (
        <motion.button
          className="contact-edit-button"
          onClick={handleStartEdit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          편집
        </motion.button>
      )}

      <motion.div
        className="contact-content"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* Left Column - Find Us */}
        <motion.div
          className="contact-info-section"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h2 className="contact-section-title">Find Us</h2>

          {isEditing ? (
            <div className="contact-edit-form">
              <div className="edit-field">
                <label>Email</label>
                {editData.emails.map((email, index) => (
                  <div key={index} className="email-edit">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => handleUpdateEmail(index, e.target.value)}
                      placeholder="contact@nodetree.kr"
                    />
                    {editData.emails.length > 1 && (
                      <button
                        type="button"
                        className="remove-link-btn"
                        onClick={() => handleRemoveEmail(index)}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="add-link-btn"
                  onClick={handleAddEmail}
                >
                  + 이메일 추가
                </button>
              </div>

              <div className="edit-field">
                <label>Location</label>
                <input
                  type="text"
                  value={editData.location}
                  onChange={(e) => setEditData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Seoul, South Korea"
                />
              </div>

              <div className="edit-field">
                <label>Social Links</label>
                {editData.socialLinks.map((link, index) => (
                  <div key={index} className="social-link-edit">
                    <input
                      type="text"
                      value={link.name}
                      onChange={(e) => handleUpdateSocialLink(index, 'name', e.target.value)}
                      placeholder="이름 (예: Instagram)"
                    />
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => handleUpdateSocialLink(index, 'url', e.target.value)}
                      placeholder="URL"
                    />
                    <button
                      type="button"
                      className="remove-link-btn"
                      onClick={() => handleRemoveSocialLink(index)}
                    >
                      삭제
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="add-link-btn"
                  onClick={handleAddSocialLink}
                >
                  + 링크 추가
                </button>
              </div>

              <div className="edit-actions">
                <button
                  className="save-btn"
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                >
                  {isSaving ? '저장 중...' : '저장'}
                </button>
                <button
                  className="cancel-btn"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="contact-info-group">
                <div className="contact-info-item">
                  <span className="contact-label">Email</span>
                  <div className="contact-emails">
                    {contactData.emails.map((email, index) => (
                      <a key={index} href={`mailto:${email}`} className="contact-link">
                        {email}
                      </a>
                    ))}
                  </div>
                </div>

                <div className="contact-info-item">
                  <span className="contact-label">Location</span>
                  <span className="contact-text">{contactData.location}</span>
                </div>

                {contactData.socialLinks.length > 0 && (
                  <div className="contact-info-item">
                    <span className="contact-label">Social</span>
                    <div className="contact-social-links">
                      {contactData.socialLinks.map((link, index) => (
                        <a
                          key={index}
                          href={ensureProtocol(link.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="social-link"
                        >
                          {link.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>

        {/* Right Column - Contact Form */}
        <motion.div
          className="contact-form-section"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h2 className="contact-section-title">Contact Us</h2>

          <form onSubmit={handleSubmit} className="contact-form">
            <div className="form-group">
              <label htmlFor="name" className="form-label">Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                required
                className="form-input"
                placeholder="Your name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleFormChange}
                required
                className="form-input"
                placeholder="your@email.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="subject" className="form-label">Subject</label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleFormChange}
                required
                className="form-input"
                placeholder="Subject"
              />
            </div>

            <div className="form-group">
              <label htmlFor="message" className="form-label">Message</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleFormChange}
                required
                className="form-textarea"
                placeholder="Your message..."
                rows={6}
              />
            </div>

            <motion.button
              type="submit"
              className="submit-button"
              disabled={isSubmitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </motion.button>

            {submitStatus === 'success' && (
              <motion.p
                className="submit-message success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {submitMessage}
              </motion.p>
            )}

            {submitStatus === 'error' && (
              <motion.p
                className="submit-message error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {submitMessage}
              </motion.p>
            )}
          </form>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Contact;
