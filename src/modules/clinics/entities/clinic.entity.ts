import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { SatusehatEnvironment } from '../../../enums';

@Entity('clinics')
export class Clinic extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column('text')
  address: string;

  @Column({ length: 100 })
  city: string;

  @Column({ length: 100 })
  province: string;

  @Column({ name: 'postal_code', length: 10, nullable: true })
  postalCode: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column({ name: 'sip_number', length: 50, nullable: true })
  sipNumber: string;

  @Column({ name: 'operational_hours', type: 'json', nullable: true })
  operationalHours: Record<string, any>;

  @Column({ name: 'satusehat_org_id', length: 100, nullable: true })
  satusehatOrgId: string;

  @Column({ name: 'satusehat_client_id', length: 255, nullable: true })
  satusehatClientId: string;

  @Column({ name: 'satusehat_client_secret', length: 255, nullable: true })
  satusehatClientSecret: string;

  @Column({
    name: 'satusehat_environment',
    type: 'enum',
    enum: SatusehatEnvironment,
    default: SatusehatEnvironment.SANDBOX,
  })
  satusehatEnvironment: SatusehatEnvironment;

  @Column({ name: 'satusehat_token', type: 'text', nullable: true })
  satusehatToken: string | undefined;

  @Column({ name: 'satusehat_token_expires_at', nullable: true })
  satusehatTokenExpiresAt: Date;

  @Column({ name: 'setup_complete', default: false })
  setupComplete: boolean;
}
