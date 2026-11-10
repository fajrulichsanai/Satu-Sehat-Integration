process.env.PATIENT_DATA_ENCRYPTION_KEY ??= 'test-key-not-for-production';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SatusehatClientService } from '../../satusehat/satusehat-client.service';
import { PractitionersService } from '../practitioners.service';
import { Practitioner } from '../entities/practitioner.entity';
import { PractitionerRevision } from '../entities/practitioner-revision.entity';
import { User } from '../../users/entities/user.entity';

describe('PractitionersService', () => {
  let satusehatClient: {
    searchPractitionerByNik: jest.Mock;
    getFhir: jest.Mock;
  };
  let revisions: { find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let users: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let service: PractitionersService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    satusehatClient = {
      searchPractitionerByNik: jest.fn(),
      getFhir: jest.fn(),
    };
    users = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((d) => d),
      save: jest.fn((d) => Promise.resolve({ id: 77, ...d })),
      update: jest.fn().mockResolvedValue(undefined),
    };
    revisions = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((d) => d),
      save: jest.fn((d) => Promise.resolve(d)),
    };
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PractitionersService,
        { provide: getRepositoryToken(Practitioner), useValue: repo },
        {
          provide: getRepositoryToken(PractitionerRevision),
          useValue: revisions,
        },
        { provide: getRepositoryToken(User), useValue: users },
        { provide: SatusehatClientService, useValue: satusehatClient },
      ],
    }).compile();

    service = module.get<PractitionersService>(PractitionersService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findAll', () => {
    it('lists practitioners scoped to clinic (positive)', async () => {
      repo.find.mockResolvedValue([{ id: 1 }]);
      const result = await service.findAll(1);
      expect(result.data).toHaveLength(1);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clinicId: 1 } }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the practitioner when found (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      const result = await service.findOne(1, 1);
      expect(result.data).toMatchObject({ id: 1, hasNik: false });
    });

    it('throws NotFoundException when missing (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('registers a new practitioner and stores a NIK hash for the duplicate check (positive)', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.create(
        { nik: '3201012312310001', name: 'Dr. A' } as any,
        1,
        9,
      );
      const saved = repo.save.mock.calls[0][0];
      expect(saved.nik).toBe('3201012312310001');
      expect(saved.nikHash).toEqual(expect.any(String));
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { nikHash: saved.nikHash, clinicId: 1 },
      });
      // NIK tidak pernah dikembalikan utuh ke klien
      expect(result.data).not.toHaveProperty('nik');
      expect(result.data).not.toHaveProperty('nikHash');
      expect(result.data.nikMasked).toBe('***0001');
    });

    it('throws ConflictException for a duplicate NIK within the clinic (negative)', async () => {
      repo.findOne.mockResolvedValue({ id: 2, nik: '3201012312310001' });
      await expect(
        service.create({ nik: '3201012312310001' } as any, 1, 9),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('merges dto fields into the practitioner (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, clinicId: 1, name: 'Old' });
      const result = await service.update(1, { name: 'New' } as any, 1, 9);
      expect(result.data.name).toBe('New');
    });

    it('records only changed fields with the reason in the revision history', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        name: 'drg Ratna Sar',
        phone: '0811',
        birthDate: '1990-06-12',
      });
      await service.update(
        1,
        {
          name: 'drg. Ratna Sari',
          phone: '0811',
          birthDate: '1990-06-12',
          reason: 'Salah ketik nama',
        } as any,
        1,
        { userId: 9, name: 'Owner' },
      );
      expect(revisions.save).toHaveBeenCalledWith(
        expect.objectContaining({
          practitionerId: 1,
          changedBy: 9,
          changedByName: 'Owner',
          reason: 'Salah ketik nama',
          changes: [
            {
              field: 'name',
              label: 'Nama',
              from: 'drg Ratna Sar',
              to: 'drg. Ratna Sari',
            },
          ],
        }),
      );
    });

    it('a corrected NIK resets the SATUSEHAT ID and is masked in the history', async () => {
      repo.findOne
        .mockResolvedValueOnce({
          id: 1,
          clinicId: 1,
          name: 'A',
          nik: '3201012312310001',
          satusehatPractitionerId: 'OLD-IHS',
        })
        .mockResolvedValueOnce(null);
      const result = await service.update(
        1,
        { nik: '3201012312310009' } as any,
        1,
        9,
      );
      expect(result.data.satusehatPractitionerId).toBeNull();
      const { changes } = revisions.save.mock.calls[0][0];
      expect(changes[0]).toEqual({
        field: 'nik',
        label: 'NIK',
        from: '***0001',
        to: '***0009',
      });
      expect(JSON.stringify(changes)).not.toContain('3201012312310009');
    });

    it('rejects a NIK already used by another practitioner (negative)', async () => {
      repo.findOne
        .mockResolvedValueOnce({ id: 1, clinicId: 1, nik: '3201012312310001' })
        .mockResolvedValueOnce({ id: 2, name: 'drg. Lain' });
      await expect(
        service.update(1, { nik: '3201012312310009' } as any, 1, 9),
      ).rejects.toThrow(ConflictException);
      expect(revisions.save).not.toHaveBeenCalled();
    });

    it('does not write a revision when nothing changed', async () => {
      repo.findOne.mockResolvedValue({ id: 1, clinicId: 1, name: 'A' });
      const r = await service.update(1, { name: 'A' } as any, 1, 9);
      expect(r.message).toBe('Tidak ada perubahan');
      expect(repo.save).not.toHaveBeenCalled();
      expect(revisions.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when missing (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update(999, {} as any, 1, 9)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('removes the practitioner when found (positive)', async () => {
      const p = { id: 1, clinicId: 1 };
      repo.findOne.mockResolvedValue(p);
      await service.remove(1, 1);
      expect(repo.remove).toHaveBeenCalledWith(p);
    });

    it('throws NotFoundException when missing (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('searchSatusehat', () => {
    it('returns the IHS id from the SATUSEHAT Practitioner bundle (positive)', async () => {
      satusehatClient.searchPractitionerByNik.mockResolvedValue({
        resourceType: 'Bundle',
        entry: [
          {
            resource: {
              id: '10009880728',
              name: [{ text: 'drg. Budi' }],
              gender: 'male',
            },
          },
        ],
      });
      repo.find.mockResolvedValue([]);
      const result = await service.searchSatusehat(
        { nik: '9999999999999999' } as any,
        1,
      );
      expect(satusehatClient.searchPractitionerByNik).toHaveBeenCalledWith(
        1,
        '9999999999999999',
      );
      expect(result.data).toMatchObject({
        found: true,
        id: '10009880728',
        name: 'drg. Budi',
        gender: 'male',
      });
      expect(result.data.results[0]).toMatchObject({
        id: '10009880728',
        inClinic: null,
      });
    });

    it('searches by name + gender + birth date and flags practitioners already in the clinic', async () => {
      satusehatClient.getFhir.mockResolvedValue({
        status: 200,
        data: {
          entry: [
            { resource: { id: 'IHS-1', name: [{ text: 'Ratna' }] } },
            { resource: { id: 'IHS-2', name: [{ text: 'Ratna S' }] } },
          ],
        },
      });
      repo.find.mockResolvedValue([
        { id: 5, name: 'drg. Ratna', satusehatPractitionerId: 'IHS-2' },
      ]);
      const r = await service.searchSatusehat(
        { name: 'Ratna', gender: 'female', birthDate: '1990-06-12' } as any,
        1,
      );
      expect(satusehatClient.getFhir.mock.calls[0][1]).toBe(
        'Practitioner?name=Ratna&gender=female&birthdate=1990-06-12',
      );
      expect(r.data.results.map((x: any) => x.inClinic)).toEqual([
        null,
        { id: 5, name: 'drg. Ratna' },
      ]);
    });

    it('requires a search key (negative)', async () => {
      await expect(
        service.searchSatusehat({ name: 'Ratna' } as any, 1),
      ).rejects.toThrow('Isi NIK');
    });

    it('reports not found when the bundle is empty (negative)', async () => {
      satusehatClient.searchPractitionerByNik.mockResolvedValue({
        resourceType: 'Bundle',
        total: 0,
      });
      repo.find.mockResolvedValue([]);
      const result = await service.searchSatusehat(
        { nik: '9999999999999999' } as any,
        1,
      );
      expect(result.data.found).toBe(false);
    });
  });

  describe('matchSatusehat', () => {
    it('stores the IHS id and returns the official name for comparison', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        name: 'drg. Ratna Sar',
        nik: '3201012312310001',
      });
      satusehatClient.searchPractitionerByNik.mockResolvedValue({
        entry: [{ resource: { id: 'IHS-9', name: [{ text: 'Ratna Sari' }] } }],
      });
      const r = await service.matchSatusehat(1, 1, { userId: 9 });
      expect(r.data).toMatchObject({
        found: true,
        satusehatId: 'IHS-9',
        satusehatName: 'Ratna Sari',
        nameMatches: false,
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ satusehatPractitionerId: 'IHS-9' }),
      );
    });

    it('needs a NIK (negative)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, clinicId: 1, name: 'A' });
      await expect(service.matchSatusehat(1, 1, { userId: 9 })).rejects.toThrow(
        'Isi NIK',
      );
    });
  });

  describe('akun login nakes', () => {
    it('membuat akun yang tertaut ke data nakes (tanpa data dokter ganda)', async () => {
      const p = {
        id: 1,
        clinicId: 1,
        name: 'drg. Ratna',
        profession: 'dokter_gigi',
      };
      repo.findOne.mockResolvedValue(p);
      await service.createAccount(
        1,
        1,
        { email: 'Ratna@Klinik.id', password: 'Rahasia123' },
        { userId: 9, name: 'Owner' },
      );
      const created = users.save.mock.calls[0][0];
      expect(created).toMatchObject({
        email: 'ratna@klinik.id',
        name: 'drg. Ratna',
        role: 'dokter',
        clinicId: 1,
        practitionerId: 1,
        isActive: true,
      });
      expect(created.passwordHash).not.toContain('Rahasia123');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          userId: 77,
          email: 'ratna@klinik.id',
        }),
      );
    });

    it('profesi perawat/bidan otomatis berperan perawat', async () => {
      repo.findOne.mockResolvedValue({
        id: 2,
        clinicId: 1,
        name: 'Ns. Rina',
        profession: 'perawat',
      });
      await service.createAccount(
        2,
        1,
        { email: 'rina@k.id', password: 'Rahasia123' },
        { userId: 9 },
      );
      expect(users.save.mock.calls[0][0].role).toBe('perawat');
    });

    it('menolak email yang sudah dipakai (negative)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, clinicId: 1, name: 'A' });
      users.findOne.mockResolvedValue({ id: 5, email: 'x@k.id' });
      await expect(
        service.createAccount(
          1,
          1,
          { email: 'x@k.id', password: 'Rahasia123' },
          { userId: 9 },
        ),
      ).rejects.toThrow(ConflictException);
      expect(users.save).not.toHaveBeenCalled();
    });

    it('reset password mengeluarkan sesi lama', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        name: 'A',
        userId: 77,
      });
      users.findOne.mockResolvedValue({
        id: 77,
        email: 'a@k.id',
        isActive: true,
        tokenVersion: 3,
      });
      await service.updateAccount(
        1,
        1,
        { password: 'BaruSekali9' },
        { userId: 9 },
      );
      expect(users.save).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 4 }),
      );
    });

    it('revisi nama ikut memperbarui nama akun login', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        name: 'drg Ratna Sar',
        userId: 77,
      });
      await service.update(1, { name: 'drg. Ratna Sari' } as any, 1, 9);
      expect(users.update).toHaveBeenCalledWith(77, {
        name: 'drg. Ratna Sari',
      });
    });
  });
});
