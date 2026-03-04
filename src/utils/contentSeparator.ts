export interface ExtractedImage {
  src: string;
  alt: string;
}

export interface SeparatedContent {
  images: ExtractedImage[];
  textContent: string;
  videoEmbeds: string[];
}

/**
 * HTML 콘텐츠에서 이미지, 텍스트, 영상 임베드를 분리한다.
 */
export function separateContent(content: string): SeparatedContent {
  const images: ExtractedImage[] = [];
  const videoEmbeds: string[] = [];

  // HTML인지 확인
  const isHtml = /<[a-z][\s\S]*?>/i.test(content);

  if (!isHtml) {
    return separateMarkdownContent(content);
  }

  let textContent = content;

  // 이미지 추출 (<img> 태그)
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(content)) !== null) {
    const src = match[1];
    const altMatch = match[0].match(/alt=["']([^"']*?)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    images.push({ src, alt });
  }

  // 이미지를 감싸는 div나 img 자체를 텍스트에서 제거
  // 이미지만 포함한 div 제거
  textContent = textContent.replace(/<div[^>]*>\s*<img[^>]*\/?>\s*<\/div>/gi, '');
  // 단독 img 태그 제거
  textContent = textContent.replace(/<img[^>]+\/?>/gi, '');
  // 이미지를 감싼 p 태그 정리 (빈 p 태그 제거)
  textContent = textContent.replace(/<p[^>]*>\s*<\/p>/gi, '');

  // 비디오 임베드 추출 (iframe, video)
  const iframeRegex = /<(?:div[^>]*>\s*)?<iframe[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe>(?:\s*<\/div>)?/gi;
  while ((match = iframeRegex.exec(content)) !== null) {
    videoEmbeds.push(match[0]);
  }

  const videoRegex = /<video[^>]*>[\s\S]*?<\/video>/gi;
  while ((match = videoRegex.exec(content)) !== null) {
    videoEmbeds.push(match[0]);
  }

  // 비디오 임베드를 텍스트에서 제거
  for (const embed of videoEmbeds) {
    textContent = textContent.replace(embed, '');
  }

  // 연속 빈 줄 정리
  textContent = textContent.replace(/(<br\s*\/?>[\s]*){3,}/gi, '<br /><br />');
  textContent = textContent.trim();

  return { images, textContent, videoEmbeds };
}

/**
 * 마크다운 콘텐츠에서 이미지, 텍스트, 영상을 분리한다.
 */
function separateMarkdownContent(content: string): SeparatedContent {
  const images: ExtractedImage[] = [];
  const videoEmbeds: string[] = [];
  const textLines: string[] = [];

  const lines = content.split('\n');
  for (const line of lines) {
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    const videoMatch = line.match(/^!!\[([^\]]*)\]\(([^)]+)\)$/);

    if (videoMatch) {
      videoEmbeds.push(line);
    } else if (imgMatch) {
      images.push({ src: imgMatch[2], alt: imgMatch[1] });
    } else {
      textLines.push(line);
    }
  }

  // 연속 빈 줄 정리
  const textContent = textLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return { images, textContent, videoEmbeds };
}
