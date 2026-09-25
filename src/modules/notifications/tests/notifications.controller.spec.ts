import { NotificationsController } from '../notifications.controller';

describe('NotificationsController', () => {
  const service = {
    listForClinic: jest.fn().mockResolvedValue([{ id: 1 }]),
    countUnread: jest.fn().mockResolvedValue(1),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
  };
  const controller = new NotificationsController(service as any);
  beforeEach(() => jest.clearAllMocks());

  it("lists the clinic's notifications (positive)", async () => {
    const res = await controller.list(7);
    expect(res.data).toEqual({ items: [{ id: 1 }], unreadCount: 1 });
    expect(service.countUnread).toHaveBeenCalledWith(7);
  });

  it('returns an empty feed for a Super Admin with no clinic instead of failing (negative)', async () => {
    const res = await controller.list(null as any);
    expect(res.data).toEqual({ items: [], unreadCount: 0 });
    expect(service.listForClinic).not.toHaveBeenCalled();
    await controller.markAllRead(null as any);
    await controller.markRead(1, null as any);
    expect(service.markAllRead).not.toHaveBeenCalled();
    expect(service.markRead).not.toHaveBeenCalled();
  });
});
