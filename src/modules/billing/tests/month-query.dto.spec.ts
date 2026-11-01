import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BillingQueryDto } from '../dto/billing.dto';
import { EncounterListQueryDto } from '../../encounters/dto/encounter.dto';

const errorsFor = async (cls: any, body: object) =>
  JSON.stringify(
    await validate(plainToInstance(cls, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

describe.each([
  ['BillingQueryDto', BillingQueryDto],
  ['EncounterListQueryDto', EncounterListQueryDto],
])('%s month filter', (_name, cls) => {
  it('accepts YYYY-MM with paging (positive)', async () => {
    expect(
      await errorsFor(cls, { month: '2026-10', page: '2', limit: '20' }),
    ).toBe('[]');
  });

  it('works without month for backwards compatibility (edge)', async () => {
    expect(await errorsFor(cls, {})).toBe('[]');
  });

  it('rejects malformed months and injection attempts (negative)', async () => {
    for (const month of [
      '2026-13',
      '2026-00',
      '26-10',
      '2026/10',
      '2026-1',
      "2026-10' OR 1=1",
    ]) {
      expect(await errorsFor(cls, { month })).toContain('month');
    }
  });
});

describe('EncounterListQueryDto active flag', () => {
  it('parses the string "true" from the query string (positive)', async () => {
    const dto = plainToInstance(EncounterListQueryDto, { active: 'true' });
    expect(dto.active).toBe(true);
    expect(await errorsFor(EncounterListQueryDto, { active: 'true' })).toBe(
      '[]',
    );
  });
});
