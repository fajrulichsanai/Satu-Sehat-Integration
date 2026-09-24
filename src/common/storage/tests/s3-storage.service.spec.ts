import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Point LOCAL_PUBLIC_DIR (derived from process.cwd()) at a temp dir.
const tempRoot = mkdtempSync(join(tmpdir(), 'apex-storage-'));
jest.spyOn(process, 'cwd').mockReturnValue(tempRoot);

import {
  S3StorageService,
  readLocalPublicFile,
  resolveLocalPublicPath,
} from '../s3-storage.service';

describe('S3StorageService (no S3 configured)', () => {
  const service = new S3StorageService({ get: () => undefined } as any);

  afterAll(() => rmSync(tempRoot, { recursive: true, force: true }));

  it('stores the file on local disk and returns a /files/ URL (positive)', async () => {
    const url = await service.uploadBuffer(
      'clinics/1/logo-1.png',
      Buffer.from('png-bytes'),
      'image/png',
    );
    expect(url).toBe('/files/clinics/1/logo-1.png');
    await expect(readLocalPublicFile(url)).resolves.toEqual(Buffer.from('png-bytes'));
  });

  it('refuses keys that escape the public directory (negative)', async () => {
    expect(resolveLocalPublicPath('../../etc/passwd')).toBeNull();
    await expect(
      service.uploadBuffer('../x.png', Buffer.from('x'), 'image/png'),
    ).rejects.toThrow();
  });

  it('readLocalPublicFile ignores S3 URLs (edge)', async () => {
    await expect(
      readLocalPublicFile('https://is3.cloudhost.id/bucket/a.png'),
    ).resolves.toBeNull();
  });
});
