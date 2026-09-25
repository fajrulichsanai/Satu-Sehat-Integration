/**
 * Indonesian names, everyday synonyms and short explanations for the
 * diagnoses a dental clinic uses most. The source code lists (ICD-10 WHO,
 * SNOMED CT) are English only; these let doctors search in Indonesian
 * ("gigi berlubang", "radang gusi") and give a plain explanation next to a
 * code. Every code here was checked against data/terminology/*.tsv.gz
 * (tests/dental-id.spec.ts keeps it that way); `snomed` is set only where
 * the SNOMED description matches the concept exactly.
 */
export interface CuratedDiagnosis {
  icd10: string;
  snomed?: string;
  nameId: string;
  /** Other names people use — searched too. */
  aliases: string[];
  explanation: string;
}

export const DENTAL_DIAGNOSES: CuratedDiagnosis[] = [
  {
    icd10: 'K00.1',
    snomed: '266414008',
    nameId: 'Gigi berlebih (supernumerary)',
    aliases: ['gigi lebih', 'mesiodens', 'gigi tambahan'],
    explanation:
      'Jumlah gigi melebihi normal, misalnya mesiodens di antara gigi seri atas. Dapat menghambat erupsi atau menyebabkan gigi berjejal.',
  },
  {
    icd10: 'K00.6',
    nameId: 'Gangguan erupsi gigi',
    aliases: [
      'persistensi gigi susu',
      'gigi susu tidak tanggal',
      'erupsi terlambat',
      'gigi tumbuh dobel',
    ],
    explanation:
      'Gigi tumbuh terlambat, di posisi yang salah, atau gigi susu belum tanggal saat gigi tetap sudah tumbuh (persistensi).',
  },
  {
    icd10: 'K00.7',
    snomed: '8004003',
    nameId: 'Sindrom tumbuh gigi (teething)',
    aliases: ['tumbuh gigi', 'teething'],
    explanation:
      'Keluhan pada bayi/anak saat gigi susu tumbuh: rewel, gusi gatal atau bengkak, banyak air liur.',
  },
  {
    icd10: 'K01.1',
    snomed: '38127003',
    nameId: 'Gigi impaksi',
    aliases: [
      'gigi bungsu',
      'gigi geraham bungsu',
      'impaksi',
      'gigi terpendam',
      'wisdom tooth',
    ],
    explanation:
      'Gigi gagal tumbuh sempurna karena terhalang gigi lain, tulang, atau jaringan lunak — paling sering gigi geraham bungsu (M3). Biasanya ditangani dengan odontektomi.',
  },
  {
    icd10: 'K02.0',
    snomed: '80353004',
    nameId: 'Karies email',
    aliases: ['karies superfisial', 'gigi berlubang kecil', 'white spot'],
    explanation:
      'Lubang atau demineralisasi yang masih terbatas pada lapisan email. Belum menimbulkan ngilu; dapat ditangani dengan fluor atau tambalan kecil.',
  },
  {
    icd10: 'K02.1',
    snomed: '44828002',
    nameId: 'Karies dentin',
    aliases: [
      'gigi berlubang',
      'karies media',
      'karies profunda',
      'lubang gigi',
    ],
    explanation:
      'Lubang gigi yang sudah mencapai dentin. Sering terasa ngilu saat makan manis atau dingin; ditangani dengan penambalan.',
  },
  {
    icd10: 'K02.3',
    snomed: '80753001',
    nameId: 'Karies terhenti',
    aliases: ['karies arrested', 'karies tidak aktif'],
    explanation:
      'Karies yang tidak lagi berkembang; permukaannya keras dan biasanya berwarna gelap.',
  },
  {
    icd10: 'K02.9',
    snomed: '80967001',
    nameId: 'Karies gigi (tidak spesifik)',
    aliases: ['gigi berlubang', 'karies', 'gigi keropos', 'caries'],
    explanation:
      'Kerusakan jaringan keras gigi akibat asam dari bakteri plak. Gunakan kode yang lebih spesifik (K02.0/K02.1) bila kedalamannya diketahui.',
  },
  {
    icd10: 'K03.0',
    nameId: 'Atrisi gigi',
    aliases: [
      'gigi aus',
      'bruxism',
      'gigi terkikis karena gesekan',
      'menggertakkan gigi',
    ],
    explanation:
      'Keausan permukaan gigi karena gesekan antar gigi, misalnya akibat kebiasaan menggertakkan gigi (bruxism).',
  },
  {
    icd10: 'K03.1',
    nameId: 'Abrasi gigi',
    aliases: ['gigi terkikis', 'abrasi servikal', 'lekukan leher gigi'],
    explanation:
      'Terkikisnya gigi oleh benda asing, paling sering karena cara menyikat gigi yang terlalu keras di leher gigi.',
  },
  {
    icd10: 'K03.2',
    snomed: '82212003',
    nameId: 'Erosi gigi',
    aliases: ['erosi asam', 'gigi terkikis asam'],
    explanation:
      'Larutnya email gigi oleh asam non-bakteri, misalnya minuman bersoda, jus asam, atau asam lambung (GERD).',
  },
  {
    icd10: 'K03.6',
    snomed: '17552000',
    nameId: 'Deposit pada gigi (karang gigi)',
    aliases: [
      'karang gigi',
      'kalkulus',
      'plak',
      'stain',
      'noda gigi',
      'tartar',
    ],
    explanation:
      'Endapan pada permukaan gigi: plak, karang gigi (kalkulus), atau noda (stain). Ditangani dengan scaling dan poles.',
  },
  {
    icd10: 'K03.8',
    nameId: 'Gigi sensitif (hipersensitivitas dentin)',
    aliases: ['gigi sensitif', 'ngilu', 'gigi ngilu', 'hipersensitif dentin'],
    explanation:
      'Ngilu singkat dan tajam saat terkena dingin, manis, atau sikat gigi karena dentin terbuka (resesi gusi, abrasi, erosi).',
  },
  {
    icd10: 'K04.0',
    snomed: '32620007',
    nameId: 'Pulpitis',
    aliases: [
      'radang saraf gigi',
      'saraf gigi meradang',
      'pulpitis reversibel',
      'pulpitis ireversibel',
      'sakit gigi berdenyut',
    ],
    explanation:
      'Peradangan pulpa (saraf gigi), biasanya karena karies dalam. Reversibel: ngilu sebentar, cukup ditambal. Ireversibel: nyeri spontan/berdenyut, perlu perawatan saluran akar atau cabut.',
  },
  {
    icd10: 'K04.1',
    snomed: '196332000',
    nameId: 'Nekrosis pulpa',
    aliases: [
      'gigi mati',
      'saraf gigi mati',
      'gangren pulpa',
      'gigi berubah warna',
    ],
    explanation:
      'Pulpa (saraf gigi) sudah mati; gigi tidak lagi merespons dingin dan bisa berubah warna. Perlu perawatan saluran akar atau pencabutan.',
  },
  {
    icd10: 'K04.4',
    snomed: '109605000',
    nameId: 'Periodontitis apikalis akut',
    aliases: ['sakit saat menggigit', 'ujung akar meradang'],
    explanation:
      'Peradangan akut di ujung akar gigi akibat infeksi pulpa; gigi terasa sakit saat digigit atau diketuk.',
  },
  {
    icd10: 'K04.5',
    snomed: '87782002',
    nameId: 'Periodontitis apikalis kronis',
    aliases: ['granuloma periapikal', 'lesi periapikal'],
    explanation:
      'Peradangan kronis di ujung akar, sering tanpa keluhan dan terlihat sebagai gambaran radiolusen pada rontgen.',
  },
  {
    icd10: 'K04.6',
    nameId: 'Abses periapikal dengan fistula',
    aliases: [
      'abses gigi dengan fistula',
      'parulis',
      'bisul di gusi',
      'gusi bernanah',
    ],
    explanation:
      'Kumpulan nanah di ujung akar gigi yang keluar melalui saluran (fistula) di gusi, tampak seperti bisul kecil.',
  },
  {
    icd10: 'K04.7',
    snomed: '196341005',
    nameId: 'Abses periapikal tanpa fistula',
    aliases: [
      'abses gigi',
      'gigi bengkak',
      'gigi bernanah',
      'pipi bengkak karena gigi',
    ],
    explanation:
      'Kumpulan nanah di ujung akar gigi tanpa saluran keluar; biasanya nyeri hebat dan bengkak. Perlu drainase dan perawatan penyebabnya.',
  },
  {
    icd10: 'K04.8',
    snomed: '89988002',
    nameId: 'Kista radikular',
    aliases: ['kista akar gigi', 'kista periapikal'],
    explanation:
      'Kista di ujung akar gigi yang pulpanya sudah mati; umumnya ditemukan dari rontgen.',
  },
  {
    icd10: 'K05.0',
    snomed: '31642005',
    nameId: 'Gingivitis akut',
    aliases: ['radang gusi akut', 'gusi berdarah', 'gusi bengkak mendadak'],
    explanation:
      'Peradangan gusi yang muncul mendadak: merah, bengkak, mudah berdarah, kadang nyeri.',
  },
  {
    icd10: 'K05.1',
    snomed: '72621003',
    nameId: 'Gingivitis kronis',
    aliases: ['radang gusi', 'gusi berdarah', 'gusi bengkak', 'gingivitis'],
    explanation:
      'Peradangan gusi menahun akibat plak dan karang gigi; gusi merah dan mudah berdarah saat sikat gigi. Dapat pulih dengan scaling dan kebersihan mulut yang baik.',
  },
  {
    icd10: 'K05.2',
    snomed: '21638000',
    nameId: 'Periodontitis akut',
    aliases: [
      'abses periodontal',
      'perikoronitis',
      'gusi bengkak di gigi bungsu',
    ],
    explanation:
      'Infeksi akut jaringan penyangga gigi, termasuk abses periodontal dan perikoronitis akut (radang gusi di sekitar gigi bungsu yang tumbuh).',
  },
  {
    icd10: 'K05.3',
    snomed: '5689008',
    nameId: 'Periodontitis kronis',
    aliases: [
      'gigi goyang',
      'penyakit gusi',
      'jaringan penyangga rusak',
      'poket periodontal',
    ],
    explanation:
      'Kerusakan jaringan penyangga gigi (gusi, ligamen, tulang) secara bertahap; gigi bisa goyang. Perlu scaling, root planing, dan kontrol rutin.',
  },
  {
    icd10: 'K06.0',
    snomed: '4356008',
    nameId: 'Resesi gingiva',
    aliases: ['gusi turun', 'akar gigi terlihat'],
    explanation:
      'Gusi turun sehingga akar gigi terbuka; sering disertai gigi sensitif.',
  },
  {
    icd10: 'K06.1',
    snomed: '196377003',
    nameId: 'Pembesaran gingiva',
    aliases: ['gusi membesar', 'hiperplasia gingiva', 'gusi tumbuh'],
    explanation:
      'Gusi membesar karena radang, efek obat tertentu, atau faktor hormonal.',
  },
  {
    icd10: 'K07.3',
    snomed: '12351004',
    nameId: 'Anomali posisi gigi',
    aliases: [
      'gigi berjejal',
      'gigi tidak rata',
      'crowding',
      'diastema',
      'gigi renggang',
      'gigi gingsul',
    ],
    explanation:
      'Gigi berada di posisi yang tidak normal: berjejal, renggang, miring, atau gingsul. Ditangani dengan ortodonti (behel).',
  },
  {
    icd10: 'K07.4',
    snomed: '47944004',
    nameId: 'Maloklusi',
    aliases: [
      'gigitan tidak pas',
      'gigi tonggos',
      'overbite',
      'crossbite',
      'gigi cakil',
    ],
    explanation: 'Hubungan gigitan rahang atas dan bawah yang tidak normal.',
  },
  {
    icd10: 'K07.6',
    snomed: '41888000',
    nameId: 'Gangguan sendi temporomandibular (TMJ)',
    aliases: [
      'sendi rahang sakit',
      'rahang bunyi klik',
      'tmd',
      'rahang terkunci',
    ],
    explanation:
      'Gangguan pada sendi rahang: nyeri, bunyi klik saat membuka mulut, atau pembukaan mulut terbatas.',
  },
  {
    icd10: 'K08.1',
    snomed: '25540007',
    nameId: 'Kehilangan gigi',
    aliases: ['gigi ompong', 'gigi hilang', 'bekas cabut', 'edentulous'],
    explanation:
      'Gigi hilang karena dicabut, kecelakaan, atau penyakit periodontal. Dapat diganti dengan gigi tiruan, jembatan, atau implan.',
  },
  {
    icd10: 'K08.3',
    snomed: '66569006',
    nameId: 'Sisa akar gigi',
    aliases: ['radix', 'sisa akar', 'akar gigi tertinggal'],
    explanation:
      'Akar gigi yang tertinggal di rahang karena mahkotanya sudah hancur atau patah saat dicabut.',
  },
  {
    icd10: 'K08.8',
    snomed: '27355003',
    nameId: 'Sakit gigi (gangguan gigi lain)',
    aliases: ['sakit gigi', 'nyeri gigi', 'toothache'],
    explanation:
      'Termasuk keluhan sakit gigi yang penyebabnya belum dapat dipastikan. Ganti dengan diagnosis spesifik setelah pemeriksaan.',
  },
  {
    icd10: 'K10.3',
    nameId: 'Alveolitis (dry socket)',
    aliases: [
      'dry socket',
      'soket kering',
      'nyeri setelah cabut gigi',
      'alveolar osteitis',
    ],
    explanation:
      'Radang soket bekas cabut gigi karena bekuan darah lepas; nyeri hebat 2–4 hari setelah pencabutan.',
  },
  {
    icd10: 'K11.6',
    snomed: '69825009',
    nameId: 'Mukokel',
    aliases: ['benjolan bening di bibir', 'kista kelenjar ludah', 'mukokel'],
    explanation:
      'Benjolan berisi cairan ludah, paling sering di bibir bawah, akibat saluran kelenjar ludah kecil tersumbat atau pecah.',
  },
  {
    icd10: 'K12.0',
    nameId: 'Sariawan berulang (stomatitis aftosa rekuren)',
    aliases: [
      'sariawan',
      'SAR',
      'stomatitis aftosa',
      'aphthous ulcer',
      'panas dalam',
    ],
    explanation:
      'Luka bulat putih-kekuningan dengan tepi merah di mulut yang kambuh berulang; biasanya sembuh sendiri dalam 1–2 minggu.',
  },
  {
    icd10: 'K12.1',
    snomed: '61170000',
    nameId: 'Stomatitis lain',
    aliases: ['radang mulut', 'stomatitis', 'luka di mulut'],
    explanation:
      'Peradangan mukosa mulut selain sariawan berulang, misalnya karena trauma, iritasi, atau gigi tiruan.',
  },
  {
    icd10: 'K12.2',
    nameId: 'Selulitis dan abses mulut',
    aliases: ['bengkak pipi bernanah', 'infeksi dasar mulut', 'selulitis'],
    explanation:
      'Infeksi yang menyebar ke jaringan lunak mulut dan wajah; perlu penanganan segera bila bengkak meluas atau sulit menelan.',
  },
  {
    icd10: 'K13.1',
    nameId: 'Kebiasaan menggigit pipi atau bibir',
    aliases: ['menggigit pipi', 'menggigit bibir', 'tergigit'],
    explanation:
      'Luka atau penebalan mukosa pipi/bibir karena sering tergigit.',
  },
  {
    icd10: 'B37.0',
    snomed: '187006006',
    nameId: 'Kandidiasis oral',
    aliases: ['jamur mulut', 'sariawan jamur', 'oral thrush', 'candida'],
    explanation:
      'Infeksi jamur Candida di mulut: bercak putih yang bisa dikerok, sering pada bayi, lansia, pengguna gigi tiruan, atau daya tahan tubuh rendah.',
  },
  {
    icd10: 'S02.5',
    snomed: '36202009',
    nameId: 'Fraktur gigi',
    aliases: ['gigi patah', 'gigi retak', 'gigi gompal', 'gigi pecah'],
    explanation:
      'Gigi patah atau retak karena trauma atau menggigit benda keras; penanganan tergantung apakah pulpa terbuka.',
  },
  {
    icd10: 'Z01.2',
    nameId: 'Pemeriksaan gigi rutin',
    aliases: ['kontrol gigi', 'cek gigi', 'pemeriksaan gigi', 'check up gigi'],
    explanation:
      'Kunjungan untuk pemeriksaan gigi rutin tanpa keluhan tertentu.',
  },
  {
    icd10: 'Z46.3',
    nameId: 'Pemasangan/penyesuaian gigi tiruan',
    aliases: ['gigi palsu', 'gigi tiruan', 'protesa', 'penyesuaian gigi palsu'],
    explanation: 'Kunjungan untuk memasang atau menyesuaikan gigi tiruan.',
  },
];

/**
 * Common systemic conditions a dental patient may have — searchable by
 * their everyday Indonesian names ("darah tinggi", "kencing manis", "DM").
 */
export const GENERAL_DIAGNOSES: CuratedDiagnosis[] = [
  {
    icd10: 'I10',
    snomed: '59621000',
    nameId: 'Hipertensi esensial',
    aliases: ['hipertensi', 'darah tinggi', 'tekanan darah tinggi', 'HT'],
    explanation:
      'Tekanan darah tinggi tanpa penyebab spesifik. Perhatikan tekanan darah sebelum tindakan dan penggunaan anestesi dengan vasokonstriktor.',
  },
  {
    icd10: 'E11',
    nameId: 'Diabetes melitus tipe 2',
    aliases: [
      'diabetes',
      'kencing manis',
      'gula darah tinggi',
      'DM',
      'DM tipe 2',
      'diabetes tipe 2',
      'diabetes type 2',
    ],
    explanation:
      'Diabetes yang tidak bergantung insulin. Meningkatkan risiko periodontitis dan memperlambat penyembuhan luka setelah tindakan.',
  },
  {
    icd10: 'E10',
    nameId: 'Diabetes melitus tipe 1',
    aliases: [
      'diabetes tipe 1',
      'DM tipe 1',
      'diabetes type 1',
      'diabetes insulin',
    ],
    explanation:
      'Diabetes yang bergantung insulin. Jadwalkan tindakan setelah pasien makan dan waspadai hipoglikemia.',
  },
  {
    icd10: 'E14',
    snomed: '73211009',
    nameId: 'Diabetes melitus (tidak spesifik)',
    aliases: ['diabetes', 'kencing manis', 'DM'],
    explanation:
      'Diabetes tanpa keterangan tipe. Gunakan E10/E11 bila tipenya diketahui.',
  },
  {
    icd10: 'J45',
    nameId: 'Asma',
    aliases: ['asma', 'sesak napas', 'bengek'],
    explanation:
      'Penyakit saluran napas kronis dengan serangan sesak. Siapkan inhaler pasien saat tindakan; hati-hati dengan obat golongan NSAID.',
  },
  {
    icd10: 'K21',
    nameId: 'Penyakit refluks gastroesofageal (GERD)',
    aliases: ['GERD', 'asam lambung naik', 'refluks'],
    explanation:
      'Naiknya asam lambung ke kerongkongan; dapat menyebabkan erosi gigi.',
  },
  {
    icd10: 'K29.7',
    snomed: '4556007',
    nameId: 'Gastritis',
    aliases: ['maag', 'sakit maag', 'radang lambung'],
    explanation:
      'Peradangan lambung. Hati-hati memberi obat anti-nyeri golongan NSAID.',
  },
  {
    icd10: 'Z33',
    snomed: '77386006',
    nameId: 'Sedang hamil',
    aliases: ['hamil', 'kehamilan', 'ibu hamil'],
    explanation:
      'Pasien sedang hamil. Pertimbangkan waktu tindakan, rontgen, dan pilihan obat yang aman.',
  },
  {
    icd10: 'R50.9',
    snomed: '386661006',
    nameId: 'Demam',
    aliases: ['demam', 'panas', 'febris'],
    explanation: 'Demam tanpa penyebab yang disebutkan.',
  },
  {
    icd10: 'R51',
    snomed: '25064002',
    nameId: 'Sakit kepala',
    aliases: ['sakit kepala', 'pusing', 'cefalgia', 'nyeri kepala'],
    explanation: 'Keluhan nyeri kepala.',
  },
  {
    icd10: 'D64.9',
    nameId: 'Anemia',
    aliases: ['anemia', 'kurang darah', 'Hb rendah'],
    explanation:
      'Kadar hemoglobin rendah; dapat memperlambat penyembuhan dan membuat mukosa mulut pucat.',
  },
  {
    icd10: 'E78.5',
    snomed: '55822004',
    nameId: 'Hiperlipidemia',
    aliases: ['kolesterol tinggi', 'hiperkolesterolemia', 'lemak darah tinggi'],
    explanation: 'Kadar lemak/kolesterol darah tinggi.',
  },
  {
    icd10: 'N18',
    snomed: '709044004',
    nameId: 'Penyakit ginjal kronis',
    aliases: ['gagal ginjal', 'sakit ginjal', 'CKD', 'cuci darah'],
    explanation:
      'Fungsi ginjal menurun menahun. Sesuaikan dosis obat dan perhatikan jadwal cuci darah.',
  },
  {
    icd10: 'I50',
    snomed: '84114007',
    nameId: 'Gagal jantung',
    aliases: ['gagal jantung', 'sakit jantung', 'lemah jantung'],
    explanation:
      'Jantung tidak memompa darah secara optimal; batasi lama tindakan dan posisikan pasien setengah duduk.',
  },
  {
    icd10: 'G40',
    snomed: '84757009',
    nameId: 'Epilepsi',
    aliases: ['epilepsi', 'ayan', 'kejang'],
    explanation:
      'Gangguan saraf dengan kejang berulang. Pastikan obat rutin diminum; siapkan penanganan kejang.',
  },
  {
    icd10: 'Z88.0',
    snomed: '91936005',
    nameId: 'Riwayat alergi penisilin',
    aliases: ['alergi penisilin', 'alergi amoksisilin', 'alergi antibiotik'],
    explanation:
      'Riwayat alergi terhadap penisilin — hindari amoksisilin dan golongan penisilin lain.',
  },
  {
    icd10: 'Z92.1',
    nameId: 'Riwayat penggunaan antikoagulan jangka panjang',
    aliases: [
      'pengencer darah',
      'antikoagulan',
      'warfarin',
      'minum obat pengencer darah',
    ],
    explanation:
      'Pasien rutin memakai obat pengencer darah; risiko perdarahan saat pencabutan atau tindakan bedah.',
  },
  {
    icd10: 'B24',
    snomed: '86406008',
    nameId: 'Penyakit HIV (tidak spesifik)',
    aliases: ['HIV', 'ODHA'],
    explanation:
      'Infeksi HIV. Terapkan kewaspadaan standar dan perhatikan lesi mulut terkait.',
  },
];

/** Every entry with an Indonesian name. */
export const CURATED_DIAGNOSES: CuratedDiagnosis[] = [
  ...DENTAL_DIAGNOSES,
  ...GENERAL_DIAGNOSES,
];

/** ICD-10 chapters (WHO), Indonesian names. */
export const ICD10_CHAPTERS: Array<{
  from: string;
  to: string;
  roman: string;
  name: string;
}> = [
  {
    from: 'A00',
    to: 'B99',
    roman: 'I',
    name: 'Penyakit infeksi dan parasit tertentu',
  },
  { from: 'C00', to: 'D48', roman: 'II', name: 'Neoplasma' },
  {
    from: 'D50',
    to: 'D89',
    roman: 'III',
    name: 'Penyakit darah, organ pembentuk darah, dan gangguan imun tertentu',
  },
  {
    from: 'E00',
    to: 'E90',
    roman: 'IV',
    name: 'Penyakit endokrin, nutrisi, dan metabolik',
  },
  { from: 'F00', to: 'F99', roman: 'V', name: 'Gangguan mental dan perilaku' },
  { from: 'G00', to: 'G99', roman: 'VI', name: 'Penyakit sistem saraf' },
  { from: 'H00', to: 'H59', roman: 'VII', name: 'Penyakit mata dan adneksa' },
  {
    from: 'H60',
    to: 'H95',
    roman: 'VIII',
    name: 'Penyakit telinga dan prosesus mastoid',
  },
  { from: 'I00', to: 'I99', roman: 'IX', name: 'Penyakit sistem sirkulasi' },
  { from: 'J00', to: 'J99', roman: 'X', name: 'Penyakit sistem pernapasan' },
  { from: 'K00', to: 'K93', roman: 'XI', name: 'Penyakit sistem pencernaan' },
  {
    from: 'L00',
    to: 'L99',
    roman: 'XII',
    name: 'Penyakit kulit dan jaringan subkutan',
  },
  {
    from: 'M00',
    to: 'M99',
    roman: 'XIII',
    name: 'Penyakit sistem muskuloskeletal dan jaringan ikat',
  },
  {
    from: 'N00',
    to: 'N99',
    roman: 'XIV',
    name: 'Penyakit sistem genitourinaria',
  },
  {
    from: 'O00',
    to: 'O99',
    roman: 'XV',
    name: 'Kehamilan, persalinan, dan nifas',
  },
  {
    from: 'P00',
    to: 'P96',
    roman: 'XVI',
    name: 'Kondisi tertentu yang bermula pada masa perinatal',
  },
  {
    from: 'Q00',
    to: 'Q99',
    roman: 'XVII',
    name: 'Malformasi kongenital, deformitas, dan kelainan kromosom',
  },
  {
    from: 'R00',
    to: 'R99',
    roman: 'XVIII',
    name: 'Gejala, tanda, dan temuan klinis/laboratorium abnormal',
  },
  {
    from: 'S00',
    to: 'T98',
    roman: 'XIX',
    name: 'Cedera, keracunan, dan akibat lain dari sebab eksternal',
  },
  { from: 'U00', to: 'U99', roman: 'XXII', name: 'Kode untuk tujuan khusus' },
  {
    from: 'V01',
    to: 'Y98',
    roman: 'XX',
    name: 'Sebab eksternal morbiditas dan mortalitas',
  },
  {
    from: 'Z00',
    to: 'Z99',
    roman: 'XXI',
    name: 'Faktor yang memengaruhi status kesehatan dan kontak dengan layanan kesehatan',
  },
];

/** Sub-block worth naming for a dental clinic. */
export const ICD10_BLOCKS: Array<{ from: string; to: string; name: string }> = [
  {
    from: 'K00',
    to: 'K14',
    name: 'Penyakit rongga mulut, kelenjar ludah, dan rahang',
  },
];
