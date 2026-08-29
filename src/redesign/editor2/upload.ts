import { imagekitAdminAPI } from '../../services/imagekitAdminApi';
import { prepareImageForUpload } from '../../utils/imageResize';

/** 파일 → (브라우저 리사이즈) → ImageKit 업로드 → URL. ImageKitPicker 와 같은 경로. */
export async function uploadImage(file: File, folder = '/uploads'): Promise<string> {
  const prepared = await prepareImageForUpload(file);
  const result: { url: string } = await imagekitAdminAPI.uploadFile(prepared.blob, prepared.fileName, {
    folder,
    useUniqueFileName: true,
  });
  return result.url;
}

export function imageFilesOf(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  return Array.from(dt.files || []).filter((f) => f.type.startsWith('image/'));
}
