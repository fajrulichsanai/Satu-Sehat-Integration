import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('owner_codes')
export class OwnerCode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20, unique: true })
  code: string;

  @Column({ name: 'is_used', default: false })
  isUsed: boolean;

  @Column({ name: 'used_by', nullable: true })
  usedBy: number;

  @Column({ name: 'used_at', nullable: true })
  usedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
