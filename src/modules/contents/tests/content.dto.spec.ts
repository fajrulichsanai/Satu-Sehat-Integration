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

describe('settings.series: susunan & ukuran baru', () => {
  it('accepts the hero arrangements and the size options (positive)', async () => {
    for (const arrangement of ['heroBottom', 'heroLeft', 'heroRight']) {
      expect(
        await errorsFor({
          settings: {
            series: { arrangement, cols: 3, split: 65, edgeText: true, areaPct: 80 },
          },
        }),
      ).toBe('[]');
    }
  });

  it('rejects out-of-range cols, split and areaPct (negative)', async () => {
    const errors = await errorsFor({
      settings: { series: { cols: 9, split: 10, areaPct: 5 } },
    });
    for (const field of ['cols', 'split', 'areaPct']) {
      expect(errors).toContain(field);
    }
  });
});

describe('UpdateContentDto settings.series (gaya rangkaian)', () => {
  it('accepts a full series style (positive)', async () => {
    expect(
      await errorsFor({
        settings: {
          series: {
            arrangement: 'hero',
            gap: 20,
            radius: 32,
            captionStyle: 'bar',
            captionPosition: 'bottom',
            showNumbers: true,
            bgColor: '#0f1f4d',
            accentColor: '#BCD0FF',
          },
        },
      }),
    ).toBe('[]');
  });

  it('accepts an empty colour meaning "follow the theme" (edge)', async () => {
    expect(
      await errorsFor({ settings: { series: { bgColor: '', accentColor: '' } } }),
    ).toBe('[]');
  });

  it('rejects unknown arrangement, out-of-range gap/radius and bad colours (negative)', async () => {
    const errors = await errorsFor({
      settings: {
        series: {
          arrangement: 'spiral',
          gap: 99,
          radius: -1,
          bgColor: 'red',
          captionStyle: 'huge',
        },
      },
    });
    for (const field of ['arrangement', 'gap', 'radius', 'bgColor', 'captionStyle']) {
      expect(errors).toContain(field);
    }
  });

  it('rejects an unknown series field (negative)', async () => {
    expect(await errorsFor({ settings: { series: { nope: 1 } } })).toContain('nope');
  });
});
