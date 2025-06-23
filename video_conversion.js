// 영상 태그 변환 함수
function convertVideoTags(line) {
  if (line.includes('[영상:') && line.includes(']')) {
    const videoMatch = line.match(/\[영상:\s*(.+?)\]/);
    if (videoMatch) {
      const url = videoMatch[1].trim();
      let videoHtml = '';
      
      if (url.includes('youtube.com/watch?v=') || url.includes('youtu.be/')) {
        let videoId = '';
        if (url.includes('youtube.com/watch?v=')) {
          videoId = url.split('v=')[1]?.split('&')[0] || '';
        } else if (url.includes('youtu.be/')) {
          videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
        }
        if (videoId) {
          videoHtml = `<div style="text-align: center; margin: 1rem 0;"><iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen style="max-width: 100%; height: auto;"></iframe></div>`;
        }
      } else if (url.includes('vimeo.com/')) {
        const videoId = url.split('vimeo.com/')[1]?.split('?')[0] || '';
        if (videoId) {
          videoHtml = `<div style="text-align: center; margin: 1rem 0;"><iframe src="https://player.vimeo.com/video/${videoId}" width="560" height="315" frameborder="0" allowfullscreen style="max-width: 100%; height: auto;"></iframe></div>`;
        }
      } else if (url.match(/\.(mp4|webm|ogg)$/i)) {
        videoHtml = `<div style="text-align: center; margin: 1rem 0;"><video controls style="max-width: 100%; height: auto;"><source src="${url}" type="video/${url.split('.').pop()}">브라우저가 비디오를 지원하지 않습니다.</video></div>`;
      } else {
        videoHtml = `<div style="text-align: center; margin: 1rem 0;"><iframe src="${url}" width="560" height="315" frameborder="0" style="max-width: 100%; height: auto;"></iframe></div>`;
      }
      
      return videoHtml || `<p>${line}</p>`;
    }
  }
  return `<p>${line}</p>`;
}
