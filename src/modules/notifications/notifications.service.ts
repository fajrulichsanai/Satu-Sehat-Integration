import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';

export interface CreateNotificationInput {
  clinicId: number | null;
  type: NotificationType;
  title: string;
  message?: string | null;
  entityType?: string | null;
  entityId?: string | number | null;
  actorId?: number | null;
  actorName?: string | null;
}

export interface ListNotificationsOptions {
  limit?: number;
  unreadOnly?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  /**
   * Never throws — a broken notification write must not block the business
   * operation it's describing (same contract as AuditLogService.record()).
   */
  async create(input: CreateNotificationInput): Promise<void> {
    if (!input.clinicId) return;

    try {
      const entry = this.notificationRepository.create({
        clinicId: input.clinicId,
        type: input.type,
        title: input.title,
        message: input.message ?? null,
        entityType: input.entityType ?? null,
        entityId:
          input.entityId !== undefined && input.entityId !== null
            ? String(input.entityId)
            : null,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        isRead: false,
      });
      await this.notificationRepository.save(entry);
    } catch (err) {
      this.logger.error(
        `Gagal mencatat notifikasi: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  async listForClinic(
    clinicId: number,
    options: ListNotificationsOptions = {},
  ): Promise<Notification[]> {
    const qb = this.notificationRepository
      .createQueryBuilder('n')
      .where('n.clinicId = :clinicId', { clinicId })
      .orderBy('n.createdAt', 'DESC')
      .limit(options.limit ?? 20);

    if (options.unreadOnly) {
      qb.andWhere('n.isRead = false');
    }

    return qb.getMany();
  }

  async countUnread(clinicId: number): Promise<number> {
    return this.notificationRepository.count({
      where: { clinicId, isRead: false },
    });
  }

  /** Scoped to clinicId so one clinic can never mark another clinic's notification read. */
  async markRead(id: number, clinicId: number): Promise<void> {
    await this.notificationRepository.update(
      { id, clinicId },
      { isRead: true },
    );
  }

  async markAllRead(clinicId: number): Promise<void> {
    await this.notificationRepository.update(
      { clinicId, isRead: false },
      { isRead: true },
    );
  }
}
