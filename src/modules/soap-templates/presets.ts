/**
 * Template SOAP bawaan untuk klinik gigi. Kode diagnosis diambil dari daftar
 * terkurasi di terminology/data/dental-id.ts (sudah dicek ke data ICD-10 WHO
 * & SNOMED CT). `{gigi}` diganti nomor gigi yang diisi dokter saat memakai
 * template, supaya catatan tidak perlu diketik ulang setiap kunjungan.
 */
export interface SoapPreset {
  key: string;
  name: string;
  category: string;
  icd10: string;
  snomed?: string;
  extraIcd10?: string[];
  subjective: string;
  objective: string;
  assessment: string;
  treatment: string;
  plan: string;
}

export const SOAP_PRESETS: SoapPreset[] = [
  {
    key: 'karies-dentin',
    name: 'Karies dentin — tumpatan komposit',
    category: 'Konservasi',
    icd10: 'K02.1',
    snomed: '44828002',
    subjective:
      'Pasien mengeluhkan gigi {gigi} berlubang dan ngilu bila terkena makanan/minuman dingin atau manis. Nyeri spontan disangkal.',
    objective:
      'Gigi {gigi}: kavitas mencapai dentin. Sondasi (+), perkusi (-), tekan (-), CE (+) hilang setelah stimulus dihilangkan. Gingiva sekitar normal.',
    assessment: 'Karies dentin gigi {gigi} (pulpa vital normal / reversibel).',
    treatment:
      'Preparasi kavitas, aplikasi etsa & bonding, tumpatan resin komposit gigi {gigi}, oklusi dicek dan dipoles.',
    plan: 'Edukasi menyikat gigi 2x sehari dengan pasta berfluoride, kurangi makanan manis. Kontrol 6 bulan atau bila ngilu menetap.',
  },
  {
    key: 'karies-email',
    name: 'Karies email — tumpatan / sealant',
    category: 'Konservasi',
    icd10: 'K02.0',
    snomed: '80353004',
    subjective:
      'Pasien datang untuk pemeriksaan, ada noda/bercak kecoklatan pada gigi {gigi}. Keluhan ngilu disangkal.',
    objective:
      'Gigi {gigi}: lesi karies terbatas pada email. Sondasi (-/+), perkusi (-), CE (+) normal.',
    assessment: 'Karies email gigi {gigi}.',
    treatment:
      'Pembersihan pit & fisur, aplikasi sealant / tumpatan komposit minimal gigi {gigi}.',
    plan: 'Edukasi kebersihan mulut, aplikasi fluor berkala. Kontrol 6 bulan.',
  },
  {
    key: 'pulpitis',
    name: 'Pulpitis — perawatan saluran akar (kunjungan 1)',
    category: 'Endodonti',
    icd10: 'K04.0',
    snomed: '32620007',
    subjective:
      'Pasien mengeluhkan gigi {gigi} sakit berdenyut, nyeri spontan terutama malam hari, menjalar dan menetap setelah minum dingin.',
    objective:
      'Gigi {gigi}: karies profunda mencapai pulpa. CE (+) memanjang, perkusi (+/-), tekan (-). Tidak tampak pembengkakan.',
    assessment: 'Pulpitis ireversibel gigi {gigi}.',
    treatment:
      'Anestesi lokal, open akses, ekstirpasi pulpa, penentuan panjang kerja, preparasi saluran akar, irigasi, dressing Ca(OH)2, tumpatan sementara gigi {gigi}.',
    plan: 'Analgesik bila perlu. Kontrol 1 minggu untuk lanjut preparasi/obturasi. Hindari mengunyah di sisi gigi {gigi}.',
  },
  {
    key: 'nekrosis-pulpa',
    name: 'Nekrosis pulpa — perawatan saluran akar',
    category: 'Endodonti',
    icd10: 'K04.1',
    snomed: '196332000',
    subjective:
      'Pasien mengeluhkan gigi {gigi} berubah warna/berlubang besar, dulu pernah sakit hebat namun sekarang tidak terasa.',
    objective:
      'Gigi {gigi}: karies profunda, diskolorasi. CE (-), perkusi (-/+), tekan (-), mobilitas normal.',
    assessment: 'Nekrosis pulpa gigi {gigi}.',
    treatment:
      'Open akses, debridement saluran akar, irigasi NaOCl, dressing, tumpatan sementara gigi {gigi}.',
    plan: 'Kontrol 1 minggu untuk lanjutan perawatan saluran akar dan restorasi akhir (onlay/crown) gigi {gigi}.',
  },
  {
    key: 'periodontitis-apikalis-kronis',
    name: 'Periodontitis apikalis kronis',
    category: 'Endodonti',
    icd10: 'K04.5',
    snomed: '87782002',
    subjective:
      'Pasien mengeluhkan gigi {gigi} kadang terasa tidak nyaman saat menggigit. Riwayat sakit sebelumnya.',
    objective:
      'Gigi {gigi}: karies profunda/tumpatan lama. CE (-), perkusi (+), tekan (+). Radiografi: radiolusen periapikal.',
    assessment: 'Periodontitis apikalis kronis gigi {gigi}.',
    treatment:
      'Open akses, debridement & irigasi saluran akar, dressing, tumpatan sementara gigi {gigi}.',
    plan: 'Kontrol 1 minggu. Bila prognosis buruk, rencana ekstraksi gigi {gigi}.',
  },
  {
    key: 'abses-periapikal',
    name: 'Abses periapikal — drainase & medikasi',
    category: 'Endodonti',
    icd10: 'K04.7',
    snomed: '196341005',
    subjective:
      'Pasien mengeluhkan gusi di sekitar gigi {gigi} bengkak dan sakit berdenyut sejak beberapa hari.',
    objective:
      'Gigi {gigi}: karies profunda. Pembengkakan vestibulum regio gigi {gigi}, fluktuasi (+), perkusi (+), tekan (+).',
    assessment: 'Abses periapikal tanpa fistula gigi {gigi}.',
    treatment:
      'Insisi & drainase / open akses untuk drainase gigi {gigi}, irigasi.',
    plan: 'Antibiotik & analgesik sesuai resep. Kontrol 3 hari. Lanjut perawatan saluran akar atau ekstraksi gigi {gigi} setelah peradangan reda.',
  },
  {
    key: 'karang-gigi',
    name: 'Karang gigi — scaling',
    category: 'Periodonti',
    icd10: 'K03.6',
    snomed: '17552000',
    subjective:
      'Pasien ingin membersihkan karang gigi. Keluhan gusi mudah berdarah saat sikat gigi (+/-).',
    objective:
      'Kalkulus supra-gingiva pada regio anterior bawah dan posterior. Gingiva sedikit hiperemis, perdarahan saat probing (+/-).',
    assessment: 'Deposit pada gigi (kalkulus).',
    treatment:
      'Scaling rahang atas & bawah dengan ultrasonic scaler, polishing.',
    plan: 'Edukasi teknik menyikat gigi & penggunaan benang gigi. Kontrol & scaling ulang 6 bulan.',
  },
  {
    key: 'gingivitis-kronis',
    name: 'Gingivitis kronis — scaling',
    category: 'Periodonti',
    icd10: 'K05.1',
    snomed: '72621003',
    subjective:
      'Pasien mengeluhkan gusi mudah berdarah saat menyikat gigi dan bau mulut.',
    objective:
      'Gingiva hiperemis dan oedem pada regio {gigi}, perdarahan saat probing (+), kalkulus (+), poket < 4 mm.',
    assessment: 'Gingivitis kronis.',
    treatment: 'Scaling & polishing, instruksi kebersihan mulut.',
    plan: 'Obat kumur sesuai anjuran. Kontrol 2 minggu untuk evaluasi gingiva.',
  },
  {
    key: 'periodontitis-kronis',
    name: 'Periodontitis kronis — scaling & root planing',
    category: 'Periodonti',
    icd10: 'K05.3',
    snomed: '5689008',
    subjective:
      'Pasien mengeluhkan gusi turun, gigi terasa goyang, dan sering berdarah.',
    objective:
      'Poket periodontal ≥ 4 mm regio {gigi}, resesi gingiva, kalkulus sub-gingiva, mobilitas derajat 1.',
    assessment: 'Periodontitis kronis.',
    treatment: 'Scaling & root planing regio {gigi}, irigasi.',
    plan: 'Edukasi kebersihan mulut, kontrol 1 bulan untuk evaluasi poket. Pertimbangkan splinting bila mobilitas bertambah.',
  },
  {
    key: 'gigi-impaksi',
    name: 'Gigi impaksi — odontektomi',
    category: 'Bedah Mulut',
    icd10: 'K01.1',
    snomed: '38127003',
    subjective:
      'Pasien mengeluhkan nyeri di belakang rahang, gusi di area gigi {gigi} sering bengkak.',
    objective:
      'Gigi {gigi} erupsi sebagian/tidak erupsi. Radiografi panoramik: impaksi gigi {gigi}. Operkulum (+/-).',
    assessment: 'Gigi impaksi {gigi}.',
    treatment:
      'Anestesi lokal, flap, pengambilan tulang, odontektomi gigi {gigi}, penjahitan.',
    plan: 'Kompres dingin 24 jam pertama, makan lunak, antibiotik & analgesik sesuai resep. Kontrol & lepas jahitan 7 hari.',
  },
  {
    key: 'sisa-akar',
    name: 'Sisa akar — ekstraksi',
    category: 'Bedah Mulut',
    icd10: 'K08.3',
    snomed: '66569006',
    subjective: 'Pasien ingin mencabut sisa akar gigi {gigi}.',
    objective:
      'Gigi {gigi}: radiks, mahkota tidak ada. Perkusi (-), gingiva sekitar normal.',
    assessment: 'Sisa akar gigi {gigi}.',
    treatment:
      'Anestesi lokal, ekstraksi sisa akar gigi {gigi}, kuretase soket, tampon.',
    plan: 'Gigit tampon 30–60 menit, jangan berkumur keras 24 jam, makan lunak. Analgesik bila perlu.',
  },
  {
    key: 'persistensi',
    name: 'Persistensi gigi sulung — ekstraksi',
    category: 'Pedodonti',
    icd10: 'K00.6',
    subjective:
      'Orang tua mengeluhkan gigi tetap anak tumbuh di belakang/depan gigi susu {gigi} yang belum tanggal.',
    objective:
      'Gigi sulung {gigi} masih ada, mobilitas (+), gigi pengganti sudah erupsi.',
    assessment: 'Persistensi gigi sulung {gigi}.',
    treatment: 'Anestesi topikal/lokal, ekstraksi gigi sulung {gigi}.',
    plan: 'Gigit tampon 30 menit, makan lunak hari ini. Kontrol erupsi gigi tetap 1 bulan.',
  },
  {
    key: 'sensitif',
    name: 'Gigi sensitif — desensitisasi',
    category: 'Konservasi',
    icd10: 'K03.8',
    subjective:
      'Pasien mengeluhkan gigi {gigi} ngilu bila minum dingin atau sikat gigi, hilang segera setelah rangsang dihilangkan.',
    objective:
      'Gigi {gigi}: resesi gingiva/abrasi servikal, tes udara (+), perkusi (-), tidak ada karies.',
    assessment: 'Hipersensitivitas dentin gigi {gigi}.',
    treatment: 'Aplikasi bahan desensitizer / fluor varnish gigi {gigi}.',
    plan: 'Pasta gigi untuk gigi sensitif, sikat gigi dengan bulu lembut. Kontrol 2 minggu.',
  },
  {
    key: 'dry-socket',
    name: 'Alveolitis (dry socket)',
    category: 'Bedah Mulut',
    icd10: 'K10.3',
    subjective:
      'Pasien mengeluhkan nyeri hebat di bekas cabut gigi {gigi} hari ke-2–4 setelah ekstraksi, bau tidak sedap.',
    objective:
      'Soket gigi {gigi} kosong tanpa bekuan darah, tulang terbuka, debris (+).',
    assessment: 'Alveolitis (dry socket) soket gigi {gigi}.',
    treatment:
      'Irigasi soket dengan salin, pengisian dressing alveolar soket gigi {gigi}.',
    plan: 'Analgesik sesuai resep, jangan berkumur keras/merokok. Kontrol 3 hari.',
  },
  {
    key: 'fraktur',
    name: 'Fraktur gigi — restorasi',
    category: 'Konservasi',
    icd10: 'S02.5',
    snomed: '36202009',
    subjective:
      'Pasien mengeluhkan gigi {gigi} patah setelah trauma/menggigit benda keras.',
    objective:
      'Gigi {gigi}: fraktur mahkota (email/dentin), pulpa tidak terbuka. CE (+), perkusi (-/+).',
    assessment: 'Fraktur gigi {gigi}.',
    treatment:
      'Restorasi resin komposit gigi {gigi} / pembuatan mahkota sementara.',
    plan: 'Hindari menggigit keras. Kontrol vitalitas pulpa 1 bulan.',
  },
  {
    key: 'maloklusi-kontrol',
    name: 'Maloklusi — kontrol ortodonti',
    category: 'Ortodonti',
    icd10: 'K07.4',
    snomed: '47944004',
    subjective:
      'Pasien datang kontrol rutin behel. Keluhan kawat menusuk/bracket lepas (+/-).',
    objective:
      'Alat ortodonti cekat terpasang baik, kebersihan mulut cukup. Pergerakan gigi sesuai rencana.',
    assessment: 'Maloklusi dalam perawatan ortodonti cekat.',
    treatment: 'Penggantian karet/kawat, aktivasi alat ortodonti.',
    plan: 'Jaga kebersihan behel, hindari makanan keras/lengket. Kontrol 4 minggu.',
  },
  {
    key: 'kehilangan-gigi',
    name: 'Kehilangan gigi — gigi tiruan',
    category: 'Prostodonti',
    icd10: 'K08.1',
    snomed: '25540007',
    extraIcd10: ['Z46.3'],
    subjective:
      'Pasien ingin dibuatkan gigi tiruan untuk gigi {gigi} yang hilang, sulit mengunyah.',
    objective:
      'Edentulus regio {gigi}. Linggir alveolar baik, gigi tetangga sehat.',
    assessment: 'Kehilangan gigi {gigi}.',
    treatment:
      'Pencetakan rahang atas & bawah untuk pembuatan gigi tiruan, penentuan warna gigi.',
    plan: 'Insersi gigi tiruan pada kunjungan berikutnya (± 1–2 minggu).',
  },
  {
    key: 'pemeriksaan-rutin',
    name: 'Pemeriksaan gigi rutin',
    category: 'Umum',
    icd10: 'Z01.2',
    subjective:
      'Pasien datang untuk pemeriksaan gigi rutin, tidak ada keluhan.',
    objective:
      'Kebersihan mulut baik/sedang. Tidak ditemukan karies aktif. Gingiva normal.',
    assessment: 'Pemeriksaan gigi rutin, tidak ada kelainan.',
    treatment:
      'Pemeriksaan intra oral & ekstra oral, edukasi kebersihan gigi dan mulut.',
    plan: 'Kontrol rutin 6 bulan sekali.',
  },
];
