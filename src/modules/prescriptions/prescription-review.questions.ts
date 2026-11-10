/**
 * Pertanyaan pengkajian resep (Questionnaire Q0007, Playbook RME Rawat Jalan
 * bab 17 / Postman "Pengkajian Resep"). linkId & teks mengikuti contoh resmi.
 */
export interface ReviewQuestion {
  linkId: string;
  text: string;
  /** coding = Sesuai/Tidak Sesuai, boolean = Ya/Tidak (ada masalah) */
  kind: 'coding' | 'boolean';
}

export interface ReviewGroup {
  linkId: string;
  text: string;
  items: ReviewQuestion[];
}

export const PRESCRIPTION_REVIEW_QUESTIONNAIRE =
  'https://fhir.kemkes.go.id/Questionnaire/Q0007';

export const PRESCRIPTION_REVIEW_GROUPS: ReviewGroup[] = [
  {
    linkId: '1',
    text: 'Persyaratan Administrasi',
    items: [
      {
        linkId: '1.1',
        kind: 'coding',
        text: 'Apakah nama, umur, jenis kelamin, berat badan dan tinggi badan pasien sudah sesuai?',
      },
      {
        linkId: '1.2',
        kind: 'coding',
        text: 'Apakah nama, nomor ijin, alamat dan paraf dokter sudah sesuai?',
      },
      {
        linkId: '1.3',
        kind: 'coding',
        text: 'Apakah tanggal resep sudah sesuai?',
      },
      {
        linkId: '1.4',
        kind: 'coding',
        text: 'Apakah ruangan/unit asal resep sudah sesuai?',
      },
    ],
  },
  {
    linkId: '2',
    text: 'Persyaratan Farmasetik',
    items: [
      {
        linkId: '2.1',
        kind: 'coding',
        text: 'Apakah nama obat, bentuk dan kekuatan sediaan sudah sesuai?',
      },
      {
        linkId: '2.2',
        kind: 'coding',
        text: 'Apakah dosis dan jumlah obat sudah sesuai?',
      },
      {
        linkId: '2.3',
        kind: 'coding',
        text: 'Apakah stabilitas obat sudah sesuai?',
      },
      {
        linkId: '2.4',
        kind: 'coding',
        text: 'Apakah aturan dan cara penggunaan obat sudah sesuai?',
      },
    ],
  },
  {
    linkId: '3',
    text: 'Persyaratan Klinis',
    items: [
      {
        linkId: '3.1',
        kind: 'coding',
        text: 'Apakah ketepatan indikasi, dosis, dan waktu penggunaan obat sudah sesuai?',
      },
      {
        linkId: '3.2',
        kind: 'boolean',
        text: 'Apakah terdapat duplikasi pengobatan?',
      },
      {
        linkId: '3.3',
        kind: 'boolean',
        text: 'Apakah terdapat alergi dan reaksi obat yang tidak dikehendaki (ROTD)?',
      },
      {
        linkId: '3.4',
        kind: 'boolean',
        text: 'Apakah terdapat kontraindikasi pengobatan?',
      },
      {
        linkId: '3.5',
        kind: 'boolean',
        text: 'Apakah terdapat dampak interaksi obat?',
      },
    ],
  },
];

export const PRESCRIPTION_REVIEW_QUESTIONS = PRESCRIPTION_REVIEW_GROUPS.flatMap(
  (g) => g.items,
);
