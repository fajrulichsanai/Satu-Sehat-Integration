import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from '../reports.controller';
import { ReportsService } from '../reports.service';
import { InvestorReportPdfService } from '../investor-report-pdf.service';
import { FinancialReportPdfService } from '../financial-report-pdf.service';
import { UserRole } from '../../../enums/user-role.enum';

/**
 * Focused on getDoctorFeeShare's role-based scoping — the actual security
 * boundary that stops a DOKTER from reading a colleague's fee breakdown.
 * ReportsService's own SQL/aggregation logic is covered exhaustively in
 * reports.service.spec.ts; this file only verifies the controller wires the
 * right practitionerId (or blocks it) based on the caller's role.
 */
describe('ReportsController', () => {
  let controller: ReportsController;
  let reportsService: { getDoctorFeeShareReport: jest.Mock };

  beforeEach(async () => {
    reportsService = {
      getDoctorFeeShareReport: jest.fn().mockResolvedValue({ success: true, data: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: reportsService },
        { provide: InvestorReportPdfService, useValue: {} },
        { provide: FinancialReportPdfService, useValue: {} },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  describe('getDoctorFeeShare', () => {
    const query = { year: 2026, month: 6 } as any;

    it('does not restrict by practitioner for an OWNER caller (positive)', async () => {
      await controller.getDoctorFeeShare(1, query, {
        userId: 1,
        role: UserRole.OWNER,
        practitionerId: null,
      });

      expect(reportsService.getDoctorFeeShareReport).toHaveBeenCalledWith(1, query);
    });

    it('does not restrict by practitioner for an ADMIN caller (positive)', async () => {
      await controller.getDoctorFeeShare(1, query, {
        userId: 2,
        role: UserRole.ADMIN,
        practitionerId: null,
      });

      expect(reportsService.getDoctorFeeShareReport).toHaveBeenCalledWith(1, query);
    });

    it('forces the filter to the caller’s own practitionerId for a DOKTER (positive)', async () => {
      await controller.getDoctorFeeShare(1, query, {
        userId: 5,
        role: UserRole.DOKTER,
        practitionerId: 42,
      });

      expect(reportsService.getDoctorFeeShareReport).toHaveBeenCalledWith(1, query, 42);
    });

    it('ignores any attempt to pass a different practitionerId — DOKTER always gets their own from the JWT (negative)', async () => {
      const dokterUser = { userId: 5, role: UserRole.DOKTER, practitionerId: 42 };
      // Even if a malicious/malformed query object smuggled a practitionerId,
      // the DTO has no such field and the controller must not read it from
      // anywhere but the authenticated user's own JWT claim.
      await controller.getDoctorFeeShare(1, { ...query, practitionerId: 999 } as any, dokterUser);

      expect(reportsService.getDoctorFeeShareReport).toHaveBeenCalledWith(
        1,
        expect.anything(),
        42, // the caller's own id, never 999
      );
    });

    it('returns exactly what the service resolves for a DOKTER’s own scoped report, unmodified (positive, integration)', async () => {
      // Guards against the controller re-shaping or dropping fields on the
      // way out — the earlier tests only assert on the call *args*.
      const scopedReport = {
        success: true,
        data: [
          {
            practitionerId: 42,
            practitionerName: 'Dr. Own',
            breakdown: [{ tarifId: 7, tarifName: 'Scaling', count: 2, feeType: 'percentage', feeValue: 15, totalShare: 60000 }],
            totalTindakan: 2,
            totalShareFee: 60000,
          },
        ],
      };
      reportsService.getDoctorFeeShareReport.mockResolvedValue(scopedReport);

      const result = await controller.getDoctorFeeShare(1, query, {
        userId: 5,
        role: UserRole.DOKTER,
        practitionerId: 42,
      });

      expect(result).toBe(scopedReport);
    });

    it('returns an empty report without querying at all when a DOKTER has no linked practitioner yet (negative/edge)', async () => {
      const result = await controller.getDoctorFeeShare(1, query, {
        userId: 5,
        role: UserRole.DOKTER,
        practitionerId: null,
      });

      expect(result).toEqual({ success: true, data: [] });
      expect(reportsService.getDoctorFeeShareReport).not.toHaveBeenCalled();
    });

    it('treats practitionerId=0 the same as unlinked rather than an inherited "everyone" filter (negative/edge)', async () => {
      const result = await controller.getDoctorFeeShare(1, query, {
        userId: 5,
        role: UserRole.DOKTER,
        practitionerId: 0,
      });

      expect(result).toEqual({ success: true, data: [] });
      expect(reportsService.getDoctorFeeShareReport).not.toHaveBeenCalled();
    });
  });
});
