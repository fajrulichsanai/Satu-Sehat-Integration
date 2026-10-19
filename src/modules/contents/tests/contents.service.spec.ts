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
  let photoRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    count: jest.Mock;
  };
  let storage: S3StorageService;
  let templates: { assertOwned: jest.Mock };
  let clinicalPhotos: { isConsented: jest.Mock; listForPatient: jest.Mock; findByIdForClinic: jest.Mock; getFilePathById: jest.Mock };
  let supportingExam: { listByPatient: jest.Mock; findByIdForClinic: jest.Mock; getFilePathById: jest.Mock };

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
    photoRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((d) => Promise.resolve({ id: 1, ...d })),
      remove: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };
    // Real storage without S3 config: URLs are local /files/... paths.
    storage = new S3StorageService({ get: () => undefined } as any);
    jest
      .spyOn(storage, 'uploadBuffer')
      .mockImplementation((key) => Promise.resolve(`/files/${key}`));
    templates = { assertOwned: jest.fn().mockResolvedValue(undefined) };
    clinicalPhotos = {
      isConsented: jest.fn().mockResolvedValue(false),
      listForPatient: jest.fn(),
      findByIdForClinic: jest.fn(),
      getFilePathById: jest.fn(),
    };
    supportingExam = {
      listByPatient: jest.fn(),
      findByIdForClinic: jest.fn(),
      getFilePathById: jest.fn(),
    };
    service = new ContentsService(
      repo as any,
      clinicRepo as any,
      photoRepo as any,
      storage,
      templates as any,
      clinicalPhotos as any,
      supportingExam as any,
    );
  });

  it('rejects photo URLs that are not this clinic’s uploads', async () => {
    for (const url of [
      'https://evil.example/x.png',
      '/files/contents/9/a.png',
      '/files/contents/5/../9/a.png',
    ]) {
      await expect(
        service.create(5, 1, { title: 'Hasil', beforeImageUrl: url }),
      ).rejects.toThrow(BadRequestException);
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

  it('publishes a series layout once it has 2+ photos, no before/after needed (positive/negative)', async () => {
    repo.findOne.mockResolvedValue({ id: 2, clinicId: 5, layout: 'series', status: ContentStatus.DRAFT });
    photoRepo.count.mockResolvedValue(1);
    await expect(service.publish(2, 5, 1, file)).rejects.toThrow(BadRequestException);

    photoRepo.count.mockResolvedValue(2);
    const published = await service.publish(2, 5, 1, file);
    expect(published.status).toBe(ContentStatus.PUBLISHED);
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

  it('tells the website which treatment each published story belongs to', async () => {
    repo.find.mockResolvedValue([
      {
        id: 1,
        title: 'A',
        imageUrl: null,
        template: { id: 7, name: 'Tambal' },
      },
      { id: 2, title: 'B', imageUrl: null, template: null },
    ]);
    const rows = await service.listPublished(5, 'https://api.test');
    expect(rows.map((r) => r.treatment)).toEqual([
      { id: 7, name: 'Tambal' },
      null,
    ]);
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ relations: { template: true } }),
    );
  });

  it('saves the template a new story was made from (positive)', async () => {
    const saved = await service.create(5, 9, {
      title: 'Tambal',
      templateId: 7,
    });
    expect(templates.assertOwned).toHaveBeenCalledWith(5, 7);
    expect(saved.templateId).toBe(7);
  });

  it("rejects another clinic's template (negative)", async () => {
    templates.assertOwned.mockRejectedValue(
      new BadRequestException('Template tidak ditemukan'),
    );
    await expect(
      service.create(5, 9, { title: 'X', templateId: 99 } as any),
    ).rejects.toThrow(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('moves a story to another treatment, or out of one (positive)', async () => {
    repo.findOne.mockResolvedValue({ id: 1, clinicId: 5, templateId: 7 });
    expect(
      (await service.update(1, 5, 9, { templateId: null } as any)).templateId,
    ).toBeNull();
    repo.findOne.mockResolvedValue({ id: 1, clinicId: 5, templateId: 7 });
    expect(
      (await service.update(1, 5, 9, { templateId: 8 } as any)).templateId,
    ).toBe(8);
  });

  describe('pickerForPatient', () => {
    it("returns nothing when the patient hasn't consented (negative)", async () => {
      clinicalPhotos.isConsented.mockResolvedValue(false);
      const result = await service.pickerForPatient(10, 5);
      expect(result).toEqual({ consentMarketing: false, folders: [], supportingExam: [] });
      expect(clinicalPhotos.listForPatient).not.toHaveBeenCalled();
    });

    it('combines folders and Pemeriksaan Penunjang once consented (positive)', async () => {
      clinicalPhotos.isConsented.mockResolvedValue(true);
      clinicalPhotos.listForPatient.mockResolvedValue({ folders: [{ group: null, photos: [] }] });
      supportingExam.listByPatient.mockResolvedValue([{ id: 1, imageType: 'xray' }]);
      const result = await service.pickerForPatient(10, 5);
      expect(result.consentMarketing).toBe(true);
      expect(result.folders).toHaveLength(1);
      expect(result.supportingExam).toHaveLength(1);
    });
  });

  describe('addPhoto', () => {
    beforeEach(() => {
      repo.findOne.mockResolvedValue({ id: 1, clinicId: 5 });
    });

    it('rejects a patient_photo this clinic does not own (negative)', async () => {
      clinicalPhotos.findByIdForClinic.mockResolvedValue(null);
      await expect(
        service.addPhoto(1, 5, { sourceType: 'patient_photo', sourceId: 99 } as any),
      ).rejects.toThrow(BadRequestException);
      expect(photoRepo.save).not.toHaveBeenCalled();
    });

    it('accepts a supporting_exam_image this clinic owns (positive)', async () => {
      supportingExam.findByIdForClinic.mockResolvedValue({ id: 2 });
      photoRepo.count.mockResolvedValue(2);
      const saved = await service.addPhoto(1, 5, {
        sourceType: 'supporting_exam_image',
        sourceId: 2,
      } as any);
      expect(saved.sortOrder).toBe(2);
    });
  });
});
