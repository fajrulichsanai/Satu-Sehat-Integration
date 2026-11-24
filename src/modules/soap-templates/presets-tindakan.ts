import type { SoapPreset, SoapQuestion } from './presets';

/**
 * Template SOAP bawaan per TINDAKAN, format S/ O/ A/ Tr/ P/. `{gigi}` diganti
 * nomor gigi; `{kunci}` diganti jawaban pertanyaan cepat untuk asisten (belum
 * dijawab = "-"). Isinya tetap, jadi asisten cukup menekan jawaban dan dokter
 * tinggal memeriksa lalu tanda tangan.
 * Kode diagnosis memakai daftar terkurasi (terminology/data/dental-id.ts);
 * tindakan tanpa diagnosis tunggal (mis. cabut gigi) tanpa kode.
 */

const PN = ['(-)', '(+)'];
const GRADE = ['Derajat 0', 'Derajat 1', 'Derajat 2', 'Derajat 3'];
const OH = ['Baik', 'Sedang', 'Buruk'];
const FRANKL = ['1 (sangat negatif)', '2 (negatif)', '3 (positif)', '4 (sangat positif)'];

const q = (
  key: string,
  label: string,
  section: SoapQuestion['section'],
  options: SoapQuestion['options'],
  multi = false,
): SoapQuestion => ({ key, label, section, options, multi });

// Pemeriksaan klinis gigi (dipakai berulang).
const SONDASI = q('sondasi', 'Sondasi', 'O', PN);
const PALPASI = q('palpasi', 'Palpasi', 'O', PN);
const PERKUSI = q('perkusi', 'Perkusi', 'O', PN);
const DRUK = q('druk', 'Druk (tekan)', 'O', PN);
const TERMAL = q('termal', 'Termal', 'O', [
  '(-)',
  'Dingin (+) cepat hilang',
  'Dingin (+) bertahan lama',
  'Panas (+)',
]);
const BENGKAK = q('bengkak', 'Pembengkakan gingiva', 'O', PN);
const FISTULA = q('fistula', 'Fistula', 'O', PN);
const MOBILITY = q('mobility', 'Mobility', 'O', GRADE);

/** Susunan ke bawah, satu pemeriksaan per baris. */
const EXAM_LINES = [
  'Sondasi : {sondasi}',
  'Palpasi : {palpasi}',
  'Perkusi : {perkusi}',
  'Druk : {druk}',
  'Termal : {termal}',
  'Pembengkakan gingiva : {bengkak}',
  'Fistula : {fistula}',
  'Mobility : {mobility}',
];
const EXAM_QUESTIONS = [SONDASI, PALPASI, PERKUSI, DRUK, TERMAL, BENGKAK, FISTULA, MOBILITY];

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
    subjective: 'Pasien kontrol rutin perawatan ortodonti cekat. Keluhan: {keluhan}.',
    objective: [
      'Alat ortodonti cekat terpasang baik',
      'Bracket : terpasang lengkap RA RB',
      'Buccal Tube : 16 26 36 46 terpasang',
      'Wire : RA 12 RB 12',
      'OH : {oh}',
      'Pergerakan gigi : {progres}',
    ].join('\n'),
    assessment: 'Maloklusi dalam perawatan ortodonti cekat, progres {progres}.',
    treatment: [
      'Evaluasi alat, pembersihan dan penggantian ligasi',
      'Aktivasi / penggantian wire : RA - RB -',
      'Po : -',
      'Pc : -',
      'Aksesoris : -',
      'Lepas : -',
    ].join('\n'),
    plan: 'Jaga kebersihan behel, hindari makanan keras/lengket. Kontrol 21 hari.',
    questions: [
      q('keluhan', 'Keluhan', 'S', ['Bracket lepas', 'Kawat menusuk', 'Nyeri', 'Tidak ada keluhan'], true),
      q('oh', 'Kebersihan mulut (OH)', 'O', OH),
      q('progres', 'Pergerakan gigi', 'O', ['sesuai rencana', 'lambat', 'belum terlihat']),
    ],
  },
  {
    key: 'tindakan-scaling',
    name: 'Scaling',
    category: 'Tindakan · Preventif',
    icd10: 'K03.6',
    snomed: '17552000',
    extraIcd10: ['K05.1'],
    subjective: 'Pasien ingin membersihkan karang gigi. Keluhan: {keluhan}.',
    objective: [
      'Kalkulus supragingiva : {kalkulus}',
      'Plak : {plak}',
      'BOP : {bop}',
      'Gingiva hiperemis : {hiperemis}',
      'Mobility : {mobility}',
      'OH : {oh}',
    ].join('\n'),
    assessment: 'Kalkulus gigi dengan gingivitis kronis.',
    treatment:
      'Scaling ultrasonik rahang atas & bawah, pembersihan stain, polishing, irigasi. Edukasi cara menyikat gigi.',
    plan: 'Menyikat gigi 2x sehari, gunakan benang gigi. Kontrol 6 bulan.',
    questions: [
      q('keluhan', 'Keluhan', 'S', ['Karang gigi', 'Gusi mudah berdarah', 'Napas tidak sedap', 'Gigi terasa kotor'], true),
      q('kalkulus', 'Kalkulus', 'O', ['Sedikit', 'Sedang', 'Banyak']),
      q('plak', 'Plak', 'O', PN),
      q('bop', 'BOP (berdarah saat probing)', 'O', PN),
      q('hiperemis', 'Gingiva hiperemis', 'O', PN),
      MOBILITY,
      q('oh', 'Kebersihan mulut (OH)', 'O', OH),
    ],
  },
  {
    key: 'tindakan-tambal-gigi',
    name: 'Tambal gigi',
    category: 'Tindakan · Konservasi',
    icd10: 'K02.1',
    snomed: '44828002',
    subjective: 'Pasien mengeluhkan gigi {gigi} berlubang. Keluhan: {keluhan}.',
    objective: ['Gigi {gigi}: karies {kedalaman}', ...EXAM_LINES].join('\n'),
    assessment: 'Karies {kedalaman} gigi {gigi}.',
    treatment:
      'Preparasi kavitas, aplikasi liner/base bila perlu, etsa & bonding, tumpatan {bahan} gigi {gigi}, finishing, polishing, cek oklusi.',
    plan: 'Jangan makan keras 1 jam. Kontrol bila ngilu menetap atau tambalan terasa tinggi.',
    questions: [
      q('keluhan', 'Keluhan', 'S', ['Ngilu terkena dingin', 'Ngilu terkena manis', 'Makanan sering tersangkut', 'Nyeri spontan', 'Tidak ada keluhan'], true),
      q('kedalaman', 'Kedalaman karies', 'O', ['email', 'dentin', 'dentin dalam (profunda)']),
      ...EXAM_QUESTIONS,
      q('bahan', 'Bahan tumpatan', 'Tr', ['resin komposit', 'GIC', 'amalgam']),
    ],
  },
  {
    key: 'tindakan-pulp-capping',
    name: 'Pulp capping',
    category: 'Tindakan · Konservasi',
    icd10: 'K02.1',
    snomed: '44828002',
    subjective: 'Pasien mengeluhkan gigi {gigi} berlubang dalam. Keluhan: {keluhan}.',
    objective: [
      'Gigi {gigi}: kavitas dalam, dasar dekat pulpa / {pulpa}',
      ...EXAM_LINES,
    ].join('\n'),
    assessment: 'Karies profunda gigi {gigi} dengan pulpa vital, indikasi pulp capping {jenis}.',
    treatment:
      'Isolasi, pembersihan jaringan karies, pulp capping {jenis} ({bahan}) gigi {gigi}, tumpatan sementara / GIC.',
    plan: 'Kontrol 1-2 minggu untuk evaluasi vitalitas. Bila nyeri spontan muncul, lanjut perawatan saluran akar.',
    questions: [
      q('keluhan', 'Keluhan', 'S', ['Ngilu terkena dingin', 'Ngilu terkena manis', 'Nyeri saat mengunyah', 'Nyeri spontan'], true),
      q('pulpa', 'Kondisi pulpa', 'O', ['pulpa tidak terbuka', 'pulpa terbuka kecil']),
      ...EXAM_QUESTIONS,
      q('jenis', 'Jenis pulp capping', 'A', ['indirect', 'direct']),
      q('bahan', 'Bahan', 'Tr', ['Ca(OH)2', 'MTA']),
    ],
  },
  {
    key: 'tindakan-cabut-gigi',
    name: 'Cabut gigi',
    category: 'Tindakan · Bedah',
    icd10: '',
    subjective: 'Pasien ingin gigi {gigi} dicabut. Keluhan: {keluhan}. Riwayat penyakit sistemik: {sistemik}. Alergi: {alergi}.',
    objective: [
      'Gigi {gigi}: {kondisi}',
      'Perkusi : {perkusi}',
      'Palpasi : {palpasi}',
      'Pembengkakan gingiva : {bengkak}',
      'Fistula : {fistula}',
      'Mobility : {mobility}',
    ].join('\n'),
    assessment: 'Gigi {gigi} indikasi ekstraksi.',
    treatment:
      'Anestesi lokal ({anestesi}), ekstraksi gigi {gigi} dengan tang/elevator, kuretase soket, tampon kasa, instruksi pasca ekstraksi.',
    plan: 'Gigit tampon 30-60 menit, hindari makanan/minuman panas dan berkumur kuat 24 jam. Obat sesuai resep. Kontrol bila perdarahan/nyeri berlanjut.',
    questions: [
      q('keluhan', 'Keluhan', 'S', ['Sakit', 'Goyang', 'Sisa akar', 'Lubang besar', 'Bengkak'], true),
      q('sistemik', 'Riwayat penyakit sistemik', 'S', ['tidak ada', 'ada (tulis di catatan)']),
      q('alergi', 'Alergi obat/anestesi', 'S', ['tidak ada', 'ada (tulis di catatan)']),
      q('kondisi', 'Kondisi gigi', 'O', ['sisa akar', 'karies besar tidak dapat direstorasi', 'goyang derajat 3', 'persistensi']),
      PERKUSI,
      PALPASI,
      BENGKAK,
      FISTULA,
      MOBILITY,
      q('anestesi', 'Anestesi', 'Tr', ['infiltrasi', 'blok']),
    ],
  },
  {
    key: 'tindakan-odontektomi',
    name: 'Odontektomi',
    category: 'Tindakan · Bedah',
    icd10: 'K01.1',
    snomed: '38127003',
    subjective: 'Pasien mengeluhkan gigi bungsu {gigi} tumbuh miring. Keluhan: {keluhan}.',
    objective: [
      'Gigi {gigi} impaksi, posisi : {posisi}',
      'Operkulum : {operkulum}',
      'Pembengkakan gingiva : {bengkak}',
      'Trismus : {trismus}',
      'Foto panoramik : hubungan dengan kanalis mandibularis dan gigi sebelahnya dievaluasi',
    ].join('\n'),
    assessment: 'Impaksi gigi {gigi} ({posisi}).',
    treatment:
      'Anestesi {anestesi}, insisi dan pembukaan flap, ostektomi bila perlu, sectioning, pengangkatan gigi {gigi}, irigasi, penjahitan.',
    plan: 'Kompres dingin 24 jam, diet lunak, obat sesuai resep. Kontrol 7 hari untuk buka jahitan.',
    questions: [
      q('keluhan', 'Keluhan', 'S', ['Sakit', 'Bengkak berulang', 'Susah membuka mulut', 'Makanan tersangkut'], true),
      q('posisi', 'Posisi impaksi', 'O', ['mesioangular', 'vertikal', 'distoangular', 'horizontal']),
      q('operkulum', 'Operkulum', 'O', PN),
      BENGKAK,
      q('trismus', 'Trismus', 'O', PN),
      q('anestesi', 'Anestesi', 'Tr', ['infiltrasi', 'blok mandibula']),
    ],
  },
  {
    key: 'tindakan-psa',
    name: 'Perawatan saluran akar (PSA)',
    category: 'Tindakan · Endodonti',
    icd10: 'K04.0',
    snomed: '32620007',
    extraIcd10: ['K04.1'],
    subjective: 'Pasien mengeluhkan gigi {gigi} sakit. Keluhan: {keluhan}.',
    objective: [
      'Gigi {gigi}: karies profunda / tambalan lama',
      ...EXAM_LINES,
      'Radiografi : {radiografi}',
    ].join('\n'),
    assessment: '{diagnosis} gigi {gigi}.',
    treatment: '{tahap}',
    plan: 'Obat sesuai resep. Kontrol 1 minggu untuk kunjungan berikutnya.',
    questions: [
      q('keluhan', 'Keluhan', 'S', ['Sakit berdenyut', 'Nyeri spontan', 'Nyeri malam hari', 'Ngilu lama', 'Bengkak pada gusi', 'Pernah ditambal'], true),
      ...EXAM_QUESTIONS,
      q('radiografi', 'Radiografi', 'O', ['tidak dilakukan', 'tanpa radiolusen periapikal', 'radiolusen periapikal (+)']),
      q('diagnosis', 'Diagnosis', 'A', ['Pulpitis ireversibel', 'Nekrosis pulpa', 'Periodontitis apikalis kronis']),
      q('tahap', 'Kunjungan', 'Tr', [
        {
          label: 'Kunjungan 1 (preparasi)',
          text: 'Anestesi, isolasi, pembukaan akses, ekstirpasi pulpa, penentuan panjang kerja, preparasi biomekanis, irigasi NaOCl, medikamen Ca(OH)2, tumpatan sementara gigi {gigi}.',
        },
        {
          label: 'Kunjungan 2 (obturasi)',
          text: 'Isolasi, pembongkaran tumpatan sementara, irigasi, pengisian saluran akar (gutta percha + sealer), tumpatan sementara gigi {gigi}.',
        },
        {
          label: 'Kunjungan 3 (restorasi akhir)',
          text: 'Restorasi akhir (tumpatan komposit / mahkota) gigi {gigi}.',
        },
      ]),
    ],
  },
  {
    key: 'tindakan-gingivektomi',
    name: 'Gingivektomi',
    category: 'Tindakan · Periodonti',
    icd10: 'K06.1',
    subjective: 'Pasien mengeluhkan gusi regio {gigi}. Keluhan: {keluhan}.',
    objective: [
      'Pembesaran gingiva regio {gigi}',
      'Poket semu : {poket}',
      'BOP : {bop}',
      'OH : {oh}',
    ].join('\n'),
    assessment: 'Hiperplasia / pembesaran gingiva regio {gigi}.',
    treatment:
      'Anestesi infiltrasi, gingivektomi dan gingivoplasti regio {gigi}, kontrol perdarahan, periodontal pack.',
    plan: 'Kumur chlorhexidine 0,2% 2x sehari, jaga kebersihan mulut. Kontrol 1 minggu.',
    questions: [
      q('keluhan', 'Keluhan', 'S', ['Gusi berlebih', 'Gusi menutupi gigi', 'Ingin dirapikan (estetik)', 'Gusi mudah berdarah'], true),
      q('poket', 'Poket semu', 'O', PN),
      q('bop', 'BOP', 'O', PN),
      q('oh', 'Kebersihan mulut (OH)', 'O', OH),
    ],
  },
  {
    key: 'tindakan-tambal-anak',
    name: 'Tambal anak',
    category: 'Tindakan · Gigi anak',
    icd10: 'K02.1',
    snomed: '44828002',
    subjective: 'Orang tua mengeluhkan gigi {gigi} anak berlubang. Keluhan: {keluhan}.',
    objective: [
      'Gigi sulung {gigi}: karies',
      'Sondasi : {sondasi}',
      'Perkusi : {perkusi}',
      'Pembengkakan gingiva : {bengkak}',
      'Fistula : {fistula}',
      'Perilaku anak (Frankl) : {frankl}',
    ].join('\n'),
    assessment: 'Karies gigi sulung {gigi}.',
    treatment: 'Pembersihan karies, tumpatan {bahan} gigi {gigi}, edukasi anak dan orang tua.',
    plan: 'Orang tua mendampingi menyikat gigi 2x sehari, kurangi makanan manis. Kontrol 6 bulan.',
    questions: [
      q('keluhan', 'Keluhan', 'S', ['Berlubang', 'Ngilu', 'Nyeri', 'Makanan tersangkut'], true),
      SONDASI,
      PERKUSI,
      BENGKAK,
      FISTULA,
      q('frankl', 'Perilaku anak (Frankl)', 'O', FRANKL),
      q('bahan', 'Bahan tumpatan', 'Tr', ['GIC', 'resin komposit']),
    ],
  },
  {
    key: 'tindakan-cabut-anak',
    name: 'Cabut anak',
    category: 'Tindakan · Gigi anak',
    icd10: 'K00.6',
    subjective: 'Orang tua mengeluhkan gigi {gigi} anak. Keluhan: {keluhan}.',
    objective: [
      'Gigi sulung {gigi}: {kondisi}',
      'Mobility : {mobility}',
      'Gigi permanen pengganti : {pengganti}',
      'Perilaku anak (Frankl) : {frankl}',
    ].join('\n'),
    assessment: 'Gigi sulung {gigi} indikasi ekstraksi.',
    treatment:
      'Anestesi topikal dan infiltrasi, ekstraksi gigi {gigi}, tampon kasa, instruksi pasca ekstraksi untuk orang tua.',
    plan: 'Gigit tampon 30 menit, hindari makanan panas/keras 24 jam. Kontrol bila perdarahan atau nyeri berlanjut.',
    questions: [
      q('keluhan', 'Keluhan', 'S', ['Goyang', 'Sakit', 'Gigi permanen sudah tumbuh di sebelahnya'], true),
      q('kondisi', 'Kondisi gigi', 'O', ['persistensi', 'akar resorpsi', 'karies besar']),
      MOBILITY,
      q('pengganti', 'Gigi permanen pengganti', 'O', ['sudah erupsi', 'belum erupsi']),
      q('frankl', 'Perilaku anak (Frankl)', 'O', FRANKL),
    ],
  },
  {
    key: 'tindakan-pulpektomi-anak',
    name: 'Pulpektomi',
    category: 'Tindakan · Gigi anak',
    icd10: 'K04.0',
    snomed: '32620007',
    extraIcd10: ['K04.1'],
    subjective: 'Orang tua mengeluhkan gigi {gigi} anak sakit. Keluhan: {keluhan}.',
    objective: [
      'Gigi sulung {gigi}: karies besar',
      'Sondasi : {sondasi}',
      'Perkusi : {perkusi}',
      'Pembengkakan gingiva : {bengkak}',
      'Fistula : {fistula}',
      'Mobility : {mobility}',
      'Radiografi : {radiografi}',
    ].join('\n'),
    assessment: 'Pulpitis / nekrosis pulpa gigi sulung {gigi}.',
    treatment:
      'Anestesi, isolasi, pembukaan akses, ekstirpasi pulpa, irigasi, pengisian saluran akar ({pengisi}), restorasi sementara GIC gigi {gigi}.',
    plan: 'Obat sesuai resep. Kontrol 1 minggu, lanjut restorasi akhir (mahkota stainless steel bila perlu).',
    questions: [
      q('keluhan', 'Keluhan', 'S', ['Sakit berdenyut', 'Nyeri spontan', 'Bengkak pada gusi'], true),
      SONDASI,
      PERKUSI,
      BENGKAK,
      FISTULA,
      MOBILITY,
      q('radiografi', 'Radiografi', 'O', ['tidak dilakukan', 'resorpsi akar belum', 'resorpsi akar sebagian']),
      q('pengisi', 'Bahan pengisi', 'Tr', ['pasta Ca(OH)2-iodoform', 'ZOE']),
    ],
  },
];
