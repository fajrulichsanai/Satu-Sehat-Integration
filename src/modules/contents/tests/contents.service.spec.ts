import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContentsService } from '../contents.service';
import { S3StorageService } from '../../../common/storage/s3-storage.service';
import { ContentStatus } from '../entities/clinic-content.entity';

describe('ContentsService', () => {
  let service: ContentsService;
  let repo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let clinicRepo: { findOne: jest.Mock };
  let storage: S3StorageService;

  const file = {
    originalname: 'story.png',
    mimetype: 'image/png',
    buffer: Buffer.from('png'),
  } as Express.Multer.File;

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((d) => Promise.resolve({ id: 1, ...d })),
      remove: jest.fn(),
    };
    clinicRepo = { findOne: jest.fn() };
    // Real storage without S3 config: URLs are local /files/... paths.
    storage = new S3StorageService({ get: () => undefined } as any);
    jest
      .spyOn(storage, 'uploadBuffer')
      .mockImplementation((key) => Promise.resolve(`/files/${key}`));
    service = new ContentsService(repo as any, clinicRepo as any, storage);
  });

  it('rejects photo URLs that are not this clinic’s uploads', () => {
    for (const url of [
      'https://evil.example/x.png',
      '/files/contents/9/a.png',
      '/files/contents/5/../9/a.png',
    ]) {
      expect(() =>
        service.create(5, 1, { title: 'Hasil', beforeImageUrl: url }),
      ).toThrow(BadRequestException);
    }
  });

  it('creates drafts with the clinic’s own photos', async () => {
    const saved = await service.create(5, 1, {
      title: '  Veneer  ',
      beforeImageUrl: '/files/contents/5/a.png',
    });
    expect(saved).toMatchObject({
      clinicId: 5,
      title: 'Veneer',
      status: ContentStatus.DRAFT,
      showDisclaimer: true,
    });
  });

  it('stores uploads under the clinic prefix', async () => {
    const { url } = await service.uploadImage(5, file);
    expect(url).toMatch(/^\/files\/contents\/5\/[\w-]+\.png$/);
    await expect(service.uploadImage(5, undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('publishes only when both photos are set', async () => {
    repo.findOne.mockResolvedValue({ id: 1, clinicId: 5, beforeImageUrl: 'x' });
    await expect(service.publish(1, 5, 1, file)).rejects.toThrow(
      BadRequestException,
    );

    repo.findOne.mockResolvedValue({
      id: 1,
      clinicId: 5,
      beforeImageUrl: '/files/contents/5/a.png',
      afterImageUrl: '/files/contents/5/b.png',
      status: ContentStatus.DRAFT,
    });
    const published = await service.publish(1, 5, 1, file);
    expect(published.status).toBe(ContentStatus.PUBLISHED);
    expect(published.imageUrl).toMatch(/^\/files\/contents\/5\//);
    expect(published.publishedAt).toBeInstanceOf(Date);
  });

  it('keeps other clinics’ content out of reach', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne(1, 6)).rejects.toThrow(NotFoundException);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 1, clinicId: 6 },
    });
  });

  it('lists published stories with absolute image URLs', async () => {
    repo.find.mockResolvedValue([
      { id: 1, title: 'A', caption: null, imageUrl: '/files/contents/5/r.png' },
      {
        id: 2,
        title: 'B',
        caption: 'c',
        imageUrl: 'https://s3/b/contents/5/r.png',
      },
    ]);
    const rows = await service.listPublished(5, 'https://api.test');
    expect(rows.map((r) => r.imageUrl)).toEqual([
      'https://api.test/files/contents/5/r.png',
      'https://s3/b/contents/5/r.png',
    ]);
  });
});
