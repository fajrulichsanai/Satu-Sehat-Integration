import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { SatusehatEnvironment } from '../../../enums';

@Entity('clinics')
export class Clinic extends BaseEntity {
  @Column({ length: 100 })
  name: string | undefined;

  @Column('text')
  address: string | undefined;

  @Column({ length: 100 })
  city: string | undefined;

  @Column({ length: 100 })
  province: string | undefined;

  @Column({ name: 'postal_code', length: 10, nullable: true })
  postalCode: string | undefined;

  @Column({ length: 20 })
  phone: string | undefined;

  @Column({ length: 100, nullable: true })
  email: string | undefined;

  @Column({ name: 'sip_number', length: 50, nullable: true })
  sipNumber: string | undefined;

  @Column({ name: 'operational_hours', type: 'json', nullable: true })
  operationalHours: Record<string, any> | undefined;

  @Column({ name: 'satusehat_org_id', length: 100, nullable: true })
  satusehatOrgId: string | undefined;

  @Column({ name: 'satusehat_client_id', length: 255, nullable: true })
  satusehatClientId: string | undefined;

  @Column({ name: 'satusehat_client_secret', length: 255, nullable: true })
  satusehatClientSecret: string | undefined;

  @Column({
    name: 'satusehat_environment',
    type: 'enum',
    enum: SatusehatEnvironment,
    default: SatusehatEnvironment.SANDBOX,
  })
  satusehatEnvironment: SatusehatEnvironment | undefined;

  @Column({ name: 'satusehat_token', type: 'text', nullable: true })
  satusehatToken: string | undefined ;

  @Column({ name: 'satusehat_token_expires_at', nullable: true })
  satusehatTokenExpiresAt: Date | undefined;

  @Column({ name: 'setup_complete', default: false })
  setupComplete: boolean | undefined;
}
