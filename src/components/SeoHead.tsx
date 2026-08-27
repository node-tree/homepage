import React from 'react';
import { Helmet } from 'react-helmet-async';

// ════════════════════════════════════════════════════════════════════════
// SeoHead — 라우트별 title/description/canonical/OG 를 head 에 얹는다.
//   ⚠️ 여기서 내는 태그는 public/index.html 의 같은 태그와 1:1 로 짝지어야 한다.
//      index.html 쪽에 data-rh="true" 가 붙어 있어야 react-helmet-async 가
//      「교체」하고, 없으면 2벌이 남아 첫 번째(정적=홈 값)가 크롤러에 잡힌다.
//   · og:type · og:site_name · og:locale · og:image:width/height/alt 는
//     전 라우트 공통이라 index.html 에만 두고 여기서는 내지 않는다(중복 방지).
// ════════════════════════════════════════════════════════════════════════

interface SeoHeadProps {
  title: string;
  description: string;
  url: string;
  image?: string;
  keywords?: string;
  /** 색인 제외(구 판식 보존 라우트 /legacy 등) */
  noindex?: boolean;
}

export default function SeoHead({ title, description, url, image, keywords, noindex }: SeoHeadProps) {
  const origin = url.split('/').slice(0, 3).join('/');
  // 상대경로로 넘어와도 og:image 는 절대 URL 이어야 한다(크롤러가 상대경로를 못 푼다).
  const ogImage = image
    ? image.startsWith('http')
      ? image
      : `${origin}${image.startsWith('/') ? '' : '/'}${image}`
    : `${origin}/logo.png`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="robots" content={noindex ? 'noindex, follow' : 'index, follow'} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}
