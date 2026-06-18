import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

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

  @Column({ length: 255, nullable: true })
  website: string;

  @Column({ name: 'sip_number', length: 50, nullable: true })
  sipNumber: string;

  @Column({ name: 'operational_hours', type: 'json', nullable: true })
  operationalHours: Record<string, any>;

  @Column({ name: 'setup_complete', default: false })
  setupComplete: boolean;
}
