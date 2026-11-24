import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSoapTemplateDto } from '../dto/soap-template.dto';

const check = async (body: object) =>
  validate(plainToInstance(CreateSoapTemplateDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('CreateSoapTemplateDto', () => {
  const dx = { system: 'icd10', code: 'K02.1', display: 'Caries of dentine', primary: true };

  it('accepts a diagnosis that carries a note, as the SOAP form sends it (regression: template tidak tersimpan)', async () => {
    expect(await check({ name: 'T', diagnoses: [{ ...dx, note: 'gigi 36' }] })).toEqual([]);
    expect(await check({ name: 'T', diagnoses: [{ ...dx, note: null }] })).toEqual([]);
  });

  it('still rejects unknown diagnosis fields (negative)', async () => {
    expect((await check({ name: 'T', diagnoses: [{ ...dx, hack: 1 }] })).length).toBeGreaterThan(0);
  });
});
