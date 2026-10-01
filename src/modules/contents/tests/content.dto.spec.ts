import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateContentDto } from '../dto/content.dto';

const errorsFor = async (body: object) => {
  const dto = plainToInstance(UpdateContentDto, body);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return JSON.stringify(errors);
};

describe('UpdateContentDto settings', () => {
  it('accepts rotation, mirroring and treatment details (positive)', async () => {
    expect(
      await errorsFor({
        settings: {
          before: { zoom: 4.5, ox: 10, oy: -20, rot: -93.5, flip: true },
          after: { zoom: 1, ox: 0, oy: 0 },
          template: 'veneer',
          teeth: ['11', '21', '48'],
          region: 'Rahang atas depan',
          condition: 'Gigi berlubang',
          visits: 2,
          autoCaption: true,
        },
      }),
    ).toBe('[]');
  });

  it('rejects a tooth number that is not FDI (negative)', async () => {
    expect(await errorsFor({ settings: { teeth: ['11', '19'] } })).toContain(
      'FDI',
    );
  });

  it('rejects zoom above 5 and rotation beyond a full turn (negative)', async () => {
    const errors = await errorsFor({
      settings: { before: { zoom: 6, ox: 0, oy: 0, rot: 400 } },
    });
    expect(errors).toContain('zoom');
    expect(errors).toContain('rot');
  });

  it('rejects an unknown settings field (negative)', async () => {
    expect(await errorsFor({ settings: { nope: 1 } })).toContain('nope');
  });
});
