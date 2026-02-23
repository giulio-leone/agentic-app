/**
 * Hook for picking images and documents from the device.
 */

import { useCallback } from 'react';
import type * as ImagePickerTypes from 'expo-image-picker';
import { v4 as uuidv4 } from 'uuid';
import { Attachment } from '../acp/models/types';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// Map file extensions to MIME types
function guessMimeType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    txt: 'text/plain',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    md: 'text/markdown',
    zip: 'application/zip',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
  };
  return map[ext] ?? 'application/octet-stream';
}

async function readFileAsBase64(uri: string): Promise<string> {
  const FileSystem = await import('expo-file-system');
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });
  return base64;
}

async function getFileSize(uri: string): Promise<number | undefined> {
  try {
    const FileSystem = await import('expo-file-system');
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? info.size : undefined;
  } catch { /* file stat unavailable */
    return undefined;
  }
}

export function useFilePicker() {
  const pickImage = useCallback(async (): Promise<Attachment[]> => {
    const ImagePicker = await import('expo-image-picker');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as ImagePickerTypes.MediaType[],
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) return [];

    return Promise.all(
      result.assets.map(async (asset) => {
        const name = asset.fileName ?? `image_${Date.now()}.jpg`;
        const mediaType = asset.mimeType ?? guessMimeType(name);
        const base64 = asset.base64 ?? await readFileAsBase64(asset.uri);
        const size = asset.fileSize ?? await getFileSize(asset.uri);

        if (size && size > MAX_FILE_SIZE) {
          throw new Error(`File "${name}" exceeds 20MB limit`);
        }

        return {
          id: uuidv4(),
          name,
          mediaType,
          uri: asset.uri,
          base64,
          size,
        } as Attachment;
      }),
    );
  }, []);

  const pickCamera = useCallback(async (): Promise<Attachment | null> => {
    const ImagePicker = await import('expo-image-picker');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Camera permission is required');
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'] as ImagePickerTypes.MediaType[],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return null;

    const asset = result.assets[0];
    const name = asset.fileName ?? `photo_${Date.now()}.jpg`;
    const mediaType = asset.mimeType ?? 'image/jpeg';
    const base64 = asset.base64 ?? await readFileAsBase64(asset.uri);
    const size = asset.fileSize ?? await getFileSize(asset.uri);

    return {
      id: uuidv4(),
      name,
      mediaType,
      uri: asset.uri,
      base64,
      size,
    };
  }, []);

  const pickDocument = useCallback(async (): Promise<Attachment[]> => {
    const DocumentPicker = await import('expo-document-picker');
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (result.canceled) return [];

    return Promise.all(
      result.assets.map(async (asset) => {
        const name = asset.name;
        const mediaType = asset.mimeType ?? guessMimeType(name);
        const base64 = await readFileAsBase64(asset.uri);
        const size = asset.size ?? await getFileSize(asset.uri);

        if (size && size > MAX_FILE_SIZE) {
          throw new Error(`File "${name}" exceeds 20MB limit`);
        }

        return {
          id: uuidv4(),
          name,
          mediaType,
          uri: asset.uri,
          base64,
          size,
        } as Attachment;
      }),
    );
  }, []);

  return { pickImage, pickCamera, pickDocument };
}
