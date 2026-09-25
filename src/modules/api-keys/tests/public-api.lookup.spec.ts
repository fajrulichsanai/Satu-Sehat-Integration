import {
  PublicApiService,
  normalizeName,
  normalizePhone,
} from '../public-api.service';
import { ReservationStatus } from '../../../enums';

const upcoming = (over: Record<string, unknown> = {}) => ({
  token: 'ABCD1234',
  status: ReservationStatus.PENDING,
  reservationDate: '2099-01-02',
  jamSlot: '10:00:00',
  patientName: 'Sri Wahyuni',
  patientPhone: '0838-3231-2487',
  practitionerId: 3,
  practitioner: { name: 'drg. Daffa' },
  ...over,
});

function makeService(rows: unknown[]) {
  const reservationRepository = {
    find: jest.fn().mockResolvedValue(rows),
    exists: jest.fn(),
  };
  const service = new PublicApiService(
    {} as any,
    {} as any,
    {} as any,
    reservationRepository as any,
    {} as any,
    {} as any,
  );
  return { service, reservationRepository };
}

const code = (p: Promise<unknown>) =>
  p.then(
    () => 'OK',
    (e) => e.getResponse?.().error?.code ?? e.message,
  );

describe('PublicApiService.lookupReservations', () => {
  it('finds a reservation by phone + name, whatever their formatting (positive)', async () => {
    const { service, reservationRepository } = makeService([upcoming()]);
    const res = await service.lookupReservations(7, 1, {
      patientPhone: '+62 838 3231 2487',
      patientName: '  sri  WAHYUNI ',
    });
    expect(res).toEqual([
      expect.objectContaining({
        token: 'ABCD1234',
        jamSlot: '10:00',
        practitionerName: 'drg. Daffa',
      }),
    ]);
    // Only this clinic's active, upcoming bookings are searched.
    expect(reservationRepository.find.mock.calls[0][0].where.clinicId).toBe(7);
  });

  it('does not reveal a reservation when only the phone matches (negative)', async () => {
    const { service } = makeService([upcoming()]);
    expect(
      await code(
        service.lookupReservations(7, 1, {
          patientPhone: '083832312487',
          patientName: 'Orang Lain',
        }),
      ),
    ).toBe('RESERVATION_NOT_FOUND');
    expect(
      await code(
        service.lookupReservations(7, 1, {
          patientPhone: '081111111111',
          patientName: 'Sri Wahyuni',
        }),
      ),
    ).toBe('RESERVATION_NOT_FOUND');
  });

  it('locks a phone number after 5 failed attempts, even with the right name after (negative)', async () => {
    const { service } = makeService([upcoming()]);
    for (let i = 0; i < 5; i++) {
      await code(
        service.lookupReservations(7, 1, {
          patientPhone: '083832312487',
          patientName: `tebakan ${i}`,
        }),
      );
    }
    expect(
      await code(
        service.lookupReservations(7, 1, {
          patientPhone: '083832312487',
          patientName: 'Sri Wahyuni',
        }),
      ),
    ).toBe('LOOKUP_LIMITED');
    // Another clinic's same number is a separate counter.
    const other = await service.lookupReservations(8, 2, {
      patientPhone: '083832312487',
      patientName: 'Sri Wahyuni',
    });
    expect(other).toHaveLength(1);
  });

  it('skips the query for a too-short number or empty name (edge)', async () => {
    const { service, reservationRepository } = makeService([upcoming()]);
    expect(
      await code(
        service.lookupReservations(7, 1, {
          patientPhone: '0838',
          patientName: 'Sri Wahyuni',
        }),
      ),
    ).toBe('RESERVATION_NOT_FOUND');
    expect(
      await code(
        service.lookupReservations(7, 1, {
          patientPhone: '083832312487',
          patientName: ' .. ',
        }),
      ),
    ).toBe('RESERVATION_NOT_FOUND');
    expect(reservationRepository.find).not.toHaveBeenCalled();
  });
});

describe('lookup normalisers', () => {
  it('normalises phone numbers and names', () => {
    expect(normalizePhone('+62 812-3456-789')).toBe('08123456789');
    expect(normalizePhone('6281234')).toBe('081234');
    expect(normalizePhone('0812 3456')).toBe('08123456');
    expect(normalizeName("  Muh. D'affa  SAFRA ")).toBe('muh d affa safra');
  });
});
