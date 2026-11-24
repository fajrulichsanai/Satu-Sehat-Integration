import type { SoapPreset } from './presets';

/**
 * Template SOAP bawaan per TINDAKAN (bukan per diagnosis): tinggal pilih
 * tindakan yang dikerjakan, isi nomor gigi bila perlu, lalu sesuaikan.
 * Format S/ O/ A/ Tr/ P/ — `{gigi}` diganti nomor gigi saat dipakai.
 * Kode diagnosis memakai daftar terkurasi (terminology/data/dental-id.ts);
 * tindakan tanpa diagnosis tunggal (mis. cabut gigi) dibiarkan tanpa kode
 * supaya dokter memilih sendiri.
 */
export const TINDAKAN_PRESETS: SoapPreset[] = [
  {
    key: 'tindakan-insersi-behel',
    name: 'Insersi behel',
    category: 'Tindakan · Ortodonti',
    icd10: 'K07.4',
    snomed: '47944004',
    subjective: 'Pasien ingin merapikan giginya.',
    objective: [
      'EO : mandibula protrusif 2 mm, pasien merasa gigi bawahnya maju',
      'IO',
      'Anterior edge to edge',
      'Missing : 0',
      'Gigi belum dalam lengkung rahang',
      'RB sedikit maju',
      'Ada space di antara C dan P1 sebesar 2 - 3 mm kiri kanan',
      'Hubungan molar klas 1',
    ].join('\n'),
    assessment: 'Maloklusi Angle Dewey klas 1 tipe 3.',
    treatment: [
      'Perawatan ortho cekat',
      'Bracket : P2 ke P2 RA RB',
      'Buccal Tube : 16 26 36 46',
      'Wire : RA 12 RB 12',
      'Po : semua gigi',
      'Pc : -',
      'Ligasi : -',
      'Aksesoris : -',
      'Tujuan Aksesoris : -',
      'Lepas : -',
    ].join('\n'),
    plan: 'Kontrol 21 hari.',
  },
  {
    key: 'tindakan-kontrol-behel',
    name: 'Kontrol behel',
    category: 'Tindakan · Ortodonti',
    icd10: 'K07.4',
    snomed: '47944004',
    subjective:
      'Pasien kontrol rutin perawatan ortodonti cekat. Bracket lepas (-), kawat menusuk (-), nyeri (-).',
    objective: [
      'Alat ortodonti cekat terpasang baik',
      'Bracket : terpasang lengkap RA RB',
      'Buccal Tube : 16 26 36 46 terpasang',
      'Wire : RA 12 RB 12',
      'OH : baik / sedang / buruk',
      'Pergerakan gigi sesuai rencana (+)',
    ].join('\n'),
    assessment: 'Maloklusi dalam perawatan ortodonti cekat, progres sesuai rencana.',
    treatment: [
      'Evaluasi alat, pembersihan dan penggantian ligasi',
      'Aktivasi / penggantian wire : RA - RB -',
      'Po : -',
      'Pc : -',
      'Aksesoris : -',
      'Lepas : -',
    ].join('\n'),
    plan: 'Jaga kebersihan behel, hindari makanan keras/lengket. Kontrol 21 hari.',
  },
  {
    key: 'tindakan-scaling',
    name: 'Scaling',
    category: 'Tindakan · Preventif',
    icd10: 'K03.6',
    snomed: '17552000',
    extraIcd10: ['K05.1'],
    subjective:
      'Pasien ingin membersihkan karang gigi. Gusi mudah berdarah saat menyikat gigi (+/-), napas tidak sedap (+/-).',
    objective:
      'Kalkulus supragingiva (+) pada rahang atas & bawah, plak (+), gingiva hiperemis, BOP (+). Mobilitas gigi (-).',
    assessment: 'Kalkulus gigi dengan gingivitis kronis.',
    treatment:
      'Scaling ultrasonik rahang atas & bawah, pembersihan stain, polishing, irigasi. Edukasi cara menyikat gigi.',
    plan: 'Menyikat gigi 2x sehari, gunakan benang gigi. Kontrol 6 bulan.',
  },
  {
    key: 'tindakan-tambal-gigi',
    name: 'Tambal gigi',
    category: 'Tindakan · Konservasi',
    icd10: 'K02.1',
    snomed: '44828002',
    subjective:
      'Pasien mengeluhkan gigi {gigi} berlubang dan ngilu bila terkena dingin/manis. Nyeri spontan (-).',
    objective:
      'Gigi {gigi}: kavitas mencapai dentin. Sondasi (+), perkusi (-), tekan (-), CE (+) hilang setelah stimulus dihilangkan.',
    assessment: 'Karies dentin gigi {gigi}.',
    treatment:
      'Preparasi kavitas, aplikasi liner/base bila perlu, etsa & bonding, tumpatan resin komposit gigi {gigi}, finishing, polishing, cek oklusi.',
    plan: 'Jangan makan keras 1 jam. Kontrol bila ngilu menetap atau tambalan terasa tinggi.',
  },
  {
    key: 'tindakan-pulp-capping',
    name: 'Pulp capping',
    category: 'Tindakan · Konservasi',
    icd10: 'K02.1',
    snomed: '44828002',
    subjective:
      'Pasien mengeluhkan gigi {gigi} berlubang dalam, ngilu bila dingin/manis. Nyeri spontan (-).',
    objective:
      'Gigi {gigi}: kavitas dalam, dasar kavitas dekat pulpa / terbuka kecil, perdarahan terkontrol. Perkusi (-), vitalitas (+).',
    assessment: 'Karies profunda gigi {gigi} dengan pulpa vital, indikasi pulp capping.',
    treatment:
      'Isolasi, pembersihan jaringan karies, pulp capping (Ca(OH)2 / MTA) gigi {gigi}, tumpatan sementara / GIC.',
    plan: 'Kontrol 1-2 minggu untuk evaluasi vitalitas. Bila nyeri spontan muncul, lanjut perawatan saluran akar.',
  },
  {
    key: 'tindakan-cabut-gigi',
    name: 'Cabut gigi',
    category: 'Tindakan · Bedah',
    icd10: '',
    subjective:
      'Pasien ingin gigi {gigi} dicabut (sakit / goyang / sisa akar). Riwayat penyakit sistemik dan alergi disangkal.',
    objective:
      'Gigi {gigi}: sisa akar / goyang derajat - / karies besar tidak dapat direstorasi. Perkusi (+/-). Gingiva sekitar tenang.',
    assessment: 'Gigi {gigi} indikasi ekstraksi.',
    treatment:
      'Anestesi lokal, ekstraksi gigi {gigi} dengan tang/elevator, kuretase soket, tampon kasa, instruksi pasca ekstraksi.',
    plan: 'Gigit tampon 30-60 menit, hindari makanan/minuman panas dan berkumur kuat 24 jam. Obat sesuai resep. Kontrol bila perdarahan/nyeri berlanjut.',
  },
  {
    key: 'tindakan-odontektomi',
    name: 'Odontektomi',
    category: 'Tindakan · Bedah',
    icd10: 'K01.1',
    snomed: '38127003',
    subjective:
      'Pasien mengeluhkan gigi bungsu {gigi} tumbuh miring, sakit/bengkak berulang.',
    objective:
      'Gigi {gigi} impaksi (posisi/kedalaman: -), operkulum (+/-). Foto panoramik: hubungan dengan kanalis mandibularis dan gigi sebelahnya dievaluasi. Buka mulut normal.',
    assessment: 'Impaksi gigi {gigi}.',
    treatment:
      'Anestesi, insisi dan pembukaan flap, ostektomi bila perlu, sectioning, pengangkatan gigi {gigi}, irigasi, penjahitan.',
    plan: 'Kompres dingin 24 jam, diet lunak, obat sesuai resep. Kontrol 7 hari untuk buka jahitan.',
  },
  {
    key: 'tindakan-psa',
    name: 'Perawatan saluran akar (PSA)',
    category: 'Tindakan · Endodonti',
    icd10: 'K04.0',
    snomed: '32620007',
    extraIcd10: ['K04.1'],
    subjective:
      'Pasien mengeluhkan gigi {gigi} sakit berdenyut / ngilu lama, pernah ditambal atau berlubang besar.',
    objective:
      'Gigi {gigi}: karies profunda / tambalan lama. Perkusi (+), tekan (+/-), vitalitas (-/menurun). Radiografi: gambaran periapikal dievaluasi.',
    assessment: 'Pulpitis ireversibel / nekrosis pulpa gigi {gigi}.',
    treatment:
      'Anestesi, isolasi, pembukaan akses, ekstirpasi pulpa, penentuan panjang kerja, preparasi biomekanis, irigasi NaOCl, medikamen Ca(OH)2, tumpatan sementara gigi {gigi}.',
    plan: 'Obat sesuai resep. Kontrol 1 minggu untuk kunjungan berikutnya (obturasi dan restorasi akhir).',
  },
  {
    key: 'tindakan-gingivektomi',
    name: 'Gingivektomi',
    category: 'Tindakan · Periodonti',
    icd10: 'K06.1',
    subjective:
      'Pasien mengeluhkan gusi regio {gigi} tampak berlebih / menutupi gigi, ingin dirapikan.',
    objective:
      'Pembesaran gingiva regio {gigi}, poket semu, BOP (+/-), kebersihan mulut sedang.',
    assessment: 'Hiperplasia / pembesaran gingiva regio {gigi}.',
    treatment:
      'Anestesi infiltrasi, gingivektomi dan gingivoplasti regio {gigi}, kontrol perdarahan, periodontal pack.',
    plan: 'Kumur chlorhexidine 0,2% 2x sehari, jaga kebersihan mulut. Kontrol 1 minggu.',
  },
  {
    key: 'tindakan-tambal-anak',
    name: 'Tambal anak',
    category: 'Tindakan · Gigi anak',
    icd10: 'K02.1',
    snomed: '44828002',
    subjective:
      'Orang tua mengeluhkan gigi {gigi} anak berlubang. Nyeri spontan (-).',
    objective:
      'Gigi sulung {gigi}: kavitas, sondasi (+), perkusi (-), tidak ada fistula/abses. Anak kooperatif.',
    assessment: 'Karies gigi sulung {gigi}.',
    treatment:
      'Pembersihan karies, tumpatan GIC / resin komposit gigi {gigi}, edukasi anak dan orang tua.',
    plan: 'Orang tua mendampingi menyikat gigi 2x sehari, kurangi makanan manis. Kontrol 6 bulan.',
  },
  {
    key: 'tindakan-cabut-anak',
    name: 'Cabut anak',
    category: 'Tindakan · Gigi anak',
    icd10: 'K00.6',
    subjective:
      'Orang tua mengeluhkan gigi {gigi} anak goyang / sakit / gigi permanen sudah tumbuh di sebelahnya.',
    objective:
      'Gigi sulung {gigi}: goyang derajat -, persistensi (+/-), akar resorpsi, gigi permanen pengganti erupsi (+/-). Anak kooperatif.',
    assessment: 'Gigi sulung {gigi} indikasi ekstraksi.',
    treatment:
      'Anestesi topikal dan infiltrasi, ekstraksi gigi {gigi}, tampon kasa, instruksi pasca ekstraksi untuk orang tua.',
    plan: 'Gigit tampon 30 menit, hindari makanan panas/keras 24 jam. Kontrol bila perdarahan atau nyeri berlanjut.',
  },
  {
    key: 'tindakan-pulpektomi-anak',
    name: 'Pulpektomi',
    category: 'Tindakan · Gigi anak',
    icd10: 'K04.0',
    snomed: '32620007',
    extraIcd10: ['K04.1'],
    subjective:
      'Orang tua mengeluhkan gigi {gigi} anak sakit berdenyut / nyeri spontan, bengkak pada gusi (+/-).',
    objective:
      'Gigi sulung {gigi}: karies besar, perkusi (+), fistula (+/-), mobilitas (-/+). Radiografi: resorpsi akar belum/sebagian.',
    assessment: 'Pulpitis / nekrosis pulpa gigi sulung {gigi}.',
    treatment:
      'Anestesi, isolasi, pembukaan akses, ekstirpasi pulpa, irigasi, pengisian saluran akar (pasta Ca(OH)2-iodoform / ZOE), restorasi sementara GIC gigi {gigi}.',
    plan: 'Obat sesuai resep. Kontrol 1 minggu, lanjut restorasi akhir (mahkota stainless steel bila perlu).',
  },
];
