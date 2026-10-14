import {
  classifyLocation,
  datesBetween,
  dayOfWeek,
  evaluateDay,
  haversineMeters,
  monthRange,
  weekFromOperationalHours,
  wibDate,
  wibDateTime,
  wibMinutes,
} from '../attendance-rules';

describe('attendance rules', () => {
  const work = { mode: 'work' as const, start: '08:00', end: '16:00' };
  const at = (date: string, hhmm: string) => wibDateTime(date, hhmm);

  describe('WIB time', () => {
    it('uses the WIB calendar day, not UTC (edge)', () => {
      // 00:30 WIB 15 Okt = 17:30 UTC 14 Okt
      const t = new Date('2026-10-14T17:30:00Z');
      expect(wibDate(t)).toBe('2026-10-15');
      expect(wibMinutes(t)).toBe(30);
      expect(wibDateTime('2026-10-15', '00:30').toISOString()).toBe(
        '2026-10-14T17:30:00.000Z',
      );
    });

    it('lists days and month bounds (positive)', () => {
      expect(datesBetween('2026-02-27', '2026-03-02')).toEqual([
        '2026-02-27',
        '2026-02-28',
        '2026-03-01',
        '2026-03-02',
      ]);
      expect(monthRange('2028-02')).toEqual({
        from: '2028-02-01',
        to: '2028-02-29',
      });
      expect(dayOfWeek('2026-10-18')).toBe(0); // Minggu
    });
  });

  describe('schedule from operational hours', () => {
    it('maps open days and treats "Tutup" as off (positive)', () => {
      const week = weekFromOperationalHours({
        senin: '08:00-16:00',
        sabtu: '09:00 - 12:00',
        minggu: 'Tutup',
      });
      expect(week[1]).toEqual(work);
      expect(week[6]).toEqual({ mode: 'work', start: '09:00', end: '12:00' });
      expect(week[0].mode).toBe('off');
      expect(week[2].mode).toBe('off'); // tidak diisi
    });

    it('is flexible when the clinic has no hours at all (edge)', () => {
      expect(
        weekFromOperationalHours(null).every((d) => d.mode === 'flexible'),
      ).toBe(true);
    });

    it('ignores malformed hours (negative)', () => {
      expect(weekFromOperationalHours({ senin: '16:00-08:00' })[1].mode).toBe(
        'off',
      );
      expect(weekFromOperationalHours({ senin: 'pagi' })[1].mode).toBe('off');
    });
  });

  describe('location', () => {
    const clinic = { latitude: -6.2, longitude: 106.816666 };

    it('measures distance in meters (positive)', () => {
      // ~111 m per 0.001° lintang
      const d = haversineMeters(-6.2, 106.816666, -6.201, 106.816666);
      expect(d).toBeGreaterThan(105);
      expect(d).toBeLessThan(117);
    });

    it('is inside within the radius (positive)', () => {
      expect(
        classifyLocation(
          { latitude: -6.2003, longitude: 106.816666, accuracy: 12 },
          clinic,
          100,
        ),
      ).toEqual({ status: 'inside', distanceM: 33, accuracyM: 12 });
    });

    it('records the distance when outside the radius (negative)', () => {
      const res = classifyLocation(
        { latitude: -6.2032, longitude: 106.816666, accuracy: 15 },
        clinic,
        100,
      );
      expect(res.status).toBe('outside');
      expect(res.distanceM).toBeGreaterThan(340);
      expect(res.distanceM).toBeLessThan(370);
    });

    it('does not call a coarse GPS fix "outside" (edge)', () => {
      expect(
        classifyLocation(
          { latitude: -6.2032, longitude: 106.816666, accuracy: 800 },
          clinic,
          100,
        ).status,
      ).toBe('inaccurate');
    });

    it('flags missing positions and an unset clinic point (edge)', () => {
      expect(classifyLocation({}, clinic, 100).status).toBe('unknown');
      expect(
        classifyLocation(
          { latitude: -6.2, longitude: 106.8 },
          { latitude: null, longitude: null },
          100,
        ).status,
      ).toBe('clinic_unset');
    });
  });

  describe('day status', () => {
    const base = {
      today: '2026-10-14',
      nowMinutes: 12 * 60,
      toleranceMinutes: 10,
    };
    const rec = (
      inAt: string | null,
      outAt: string | null,
      date = '2026-10-13',
    ) => ({
      scheduleMode: 'work' as const,
      scheduledStart: '08:00',
      scheduledEnd: '16:00',
      clockInAt: inAt ? at(date, inAt) : null,
      clockOutAt: outAt ? at(date, outAt) : null,
    });

    it('is present within the tolerance, late after it (positive)', () => {
      expect(
        evaluateDay({
          ...base,
          date: '2026-10-13',
          schedule: work,
          record: rec('08:09', '16:00'),
        }),
      ).toEqual({
        status: 'present',
        lateMinutes: 0,
        earlyMinutes: 0,
        workedMinutes: 471,
      });
      const late = evaluateDay({
        ...base,
        date: '2026-10-13',
        schedule: work,
        record: rec('08:25', '16:00'),
      });
      expect(late.status).toBe('late');
      expect(late.lateMinutes).toBe(25);
    });

    it('counts leaving early (positive)', () => {
      const day = evaluateDay({
        ...base,
        date: '2026-10-13',
        schedule: work,
        record: rec('08:00', '15:30'),
      });
      expect(day.status).toBe('early_leave');
      expect(day.earlyMinutes).toBe(30);
    });

    it('marks a past day without clock-out as forgotten, today as still working (edge)', () => {
      expect(
        evaluateDay({
          ...base,
          date: '2026-10-13',
          schedule: work,
          record: rec('08:00', null),
        }).status,
      ).toBe('forgot_clock_out');
      expect(
        evaluateDay({
          ...base,
          date: '2026-10-14',
          schedule: work,
          record: rec('08:00', null, '2026-10-14'),
        }).status,
      ).toBe('working');
    });

    it('is absent on a past work day, not yet in before the shift ends today (negative)', () => {
      expect(
        evaluateDay({
          ...base,
          date: '2026-10-13',
          schedule: work,
          record: null,
        }).status,
      ).toBe('absent');
      expect(
        evaluateDay({
          ...base,
          date: '2026-10-14',
          schedule: work,
          record: null,
        }).status,
      ).toBe('not_in_yet');
      expect(
        evaluateDay({
          ...base,
          nowMinutes: 17 * 60,
          date: '2026-10-14',
          schedule: work,
          record: null,
        }).status,
      ).toBe('absent');
    });

    it('never marks off or flexible days absent, nor counts lateness on them (edge)', () => {
      const flexible = { mode: 'flexible' as const, start: null, end: null };
      expect(
        evaluateDay({
          ...base,
          date: '2026-10-13',
          schedule: flexible,
          record: null,
        }).status,
      ).toBe('off');
      const day = evaluateDay({
        ...base,
        date: '2026-10-13',
        schedule: flexible,
        record: {
          ...rec('13:00', '17:00'),
          scheduleMode: 'flexible',
          scheduledStart: null,
          scheduledEnd: null,
        },
      });
      expect(day).toEqual({
        status: 'present',
        lateMinutes: 0,
        earlyMinutes: 0,
        workedMinutes: 240,
      });
    });
  });
});
