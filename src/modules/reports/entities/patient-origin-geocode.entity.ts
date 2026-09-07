import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

/**
 * Cache hasil geocoding kecamatan -> koordinat (untuk peta sebaran asal
 * pasien, PRD 5.14 lanjutan). Dibagi lintas klinik (bukan per clinicId) —
 * nama kecamatan+kota yang sama selalu berada di lokasi yang sama, jadi
 * tidak perlu di-geocode ulang untuk tiap klinik. Diisi lazy saat pertama
 * kali sebuah kecamatan muncul di laporan; kalau gagal di-geocode, resolved
 * tetap disimpan false supaya tidak dicoba ulang terus setiap request.
 */
@Entity('patient_origin_geocodes')
@Unique(['kecamatan', 'city'])
export class PatientOriginGeocode extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  kecamatan: string;

  @Column({ type: 'varchar', length: 150 })
  city: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lat: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lng: number | null;

  @Column({ type: 'boolean', default: false })
  resolved: boolean;
}
