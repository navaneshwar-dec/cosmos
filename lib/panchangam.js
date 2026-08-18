import { MhahPanchang } from 'mhah-panchang';
import { istDateKey } from './dates';

// Today's Hindu almanac (tithi/nakshatra/masa…) computed locally — no API key, works offline.
// Reckoned near sunrise for the user's region (Proddatur, AP); recompute is per-day so it
// updates automatically each morning.
const LAT = 14.75, LNG = 78.55;

const TITHI = {
  Padyami: 'పాడ్యమి', Vidhiya: 'విదియ', Thadiya: 'తదియ', Chavithi: 'చవితి', Chaviti: 'చవితి',
  Panchami: 'పంచమి', Shasti: 'షష్ఠి', Sapthami: 'సప్తమి', Ashtami: 'అష్టమి', Navami: 'నవమి',
  Dasami: 'దశమి', Ekadasi: 'ఏకాదశి', Dvadasi: 'ద్వాదశి', Trayodasi: 'త్రయోదశి', Chaturdasi: 'చతుర్దశి',
  Punnami: 'పౌర్ణమి', Amavasya: 'అమావాస్య',
};
const PAKSHA = { Shukla: 'శుక్ల పక్షం', Krishna: 'బహుళ పక్షం' };
const NAK = {
  Ashwini: 'అశ్విని', Dwija: 'భరణి', Krittika: 'కృత్తిక', Rohini: 'రోహిణి', Mrigashirsha: 'మృగశిర',
  Ardra: 'ఆరుద్ర', Punarvasu: 'పునర్వసు', Pushya: 'పుష్యమి', Ashlesha: 'ఆశ్లేష', Magha: 'మఖ',
  'Purva Phalguni': 'పుబ్బ', 'Uttara Phalguni': 'ఉత్తర', Hasta: 'హస్త', Chitra: 'చిత్త', Swati: 'స్వాతి',
  Vishakha: 'విశాఖ', Anuradha: 'అనూరాధ', Jyeshtha: 'జ్యేష్ఠ', Mula: 'మూల', 'Purva Ashadha': 'పూర్వాషాఢ',
  'Uttara Ashadha': 'ఉత్తరాషాఢ', Sravana: 'శ్రవణం', Dhanishta: 'ధనిష్ఠ', Shatabhisha: 'శతభిషం',
  'Purva Bhadrapada': 'పూర్వాభాద్ర', 'Uttara Bhadrapada': 'ఉత్తరాభాద్ర', Rebati: 'రేవతి',
};
const MASA = {
  Chaitra: 'చైత్రం', Baisakha: 'వైశాఖం', Jyestha: 'జ్యేష్ఠం', Asadha: 'ఆషాఢం', Srabana: 'శ్రావణం',
  Bhadraba: 'భాద్రపదం', Aswina: 'ఆశ్వయుజం', Karttika: 'కార్తీకం', Margasira: 'మార్గశిరం',
  Pausa: 'పుష్యం', Magha: 'మాఘం', Phalguna: 'ఫాల్గుణం',
};
const VAARA = ['ఆదివారం', 'సోమవారం', 'మంగళవారం', 'బుధవారం', 'గురువారం', 'శుక్రవారం', 'శనివారం'];

// classical sankalpam weekday names (graha-based)
const VAASARA = { 'ఆదివారం': 'భాను', 'సోమవారం': 'ఇందు', 'మంగళవారం': 'భౌమ', 'బుధవారం': 'సౌమ్య', 'గురువారం': 'గురు', 'శుక్రవారం': 'భృగు', 'శనివారం': 'స్థిర' };

// the 60-year Telugu samvatsara cycle (index 0 = ప్రభవ); Parabhava is the 2026–27 year
const SAMVATSARA = ['ప్రభవ', 'విభవ', 'శుక్ల', 'ప్రమోద', 'ప్రజోత్పత్తి', 'అంగీరస', 'శ్రీముఖ', 'భావ', 'యువ', 'ధాత', 'ఈశ్వర', 'బహుధాన్య', 'ప్రమాది', 'విక్రమ', 'వృష', 'చిత్రభాను', 'స్వభాను', 'తారణ', 'పార్థివ', 'వ్యయ', 'సర్వజిత్తు', 'సర్వధారి', 'విరోధి', 'వికృతి', 'ఖర', 'నందన', 'విజయ', 'జయ', 'మన్మథ', 'దుర్ముఖి', 'హేవిళంబి', 'విళంబి', 'వికారి', 'శార్వరి', 'ప్లవ', 'శుభకృత్', 'శోభకృత్', 'క్రోధి', 'విశ్వావసు', 'పరాభవ', 'ప్లవంగ', 'కీలక', 'సౌమ్య', 'సాధారణ', 'విరోధికృత్', 'పరిధావి', 'ప్రమాదీచ', 'ఆనంద', 'రాక్షస', 'నల', 'పింగళ', 'కాళయుక్తి', 'సిద్ధార్థి', 'రౌద్రి', 'దుర్మతి', 'దుందుభి', 'రుధిరోద్గారి', 'రక్తాక్షి', 'క్రోధన', 'అక్షయ'];

// ritu keyed on the masa base (masa with the trailing 'ం' removed)
const RITU = { చైత్ర: 'వసంత', వైశాఖ: 'వసంత', జ్యేష్ఠ: 'గ్రీష్మ', ఆషాఢ: 'గ్రీష్మ', శ్రావణ: 'వర్ష', భాద్రపద: 'వర్ష', ఆశ్వయుజ: 'శరద్', కార్తీక: 'శరద్', మార్గశిర: 'హేమంత', పుష్య: 'హేమంత', మాఘ: 'శిశిర', ఫాల్గుణ: 'శిశిర' };

function buildSankalpam({ samvatsara, ayana, ritu, masaBase, pakshaBase, tithi, vaasara, nakshatra }) {
  return (
`శ్రీ గోవింద గోవింద గోవింద — మమోపాత్త సమస్త దురితక్షయద్వారా శ్రీ పరమేశ్వర ప్రీత్యర్థం, శుభే శోభనే ముహూర్తే, అద్య బ్రహ్మణః ద్వితీయ పరార్ధే శ్వేతవరాహ కల్పే వైవస్వత మన్వంతరే కలియుగే ప్రథమ పాదే జంబూద్వీపే భరతవర్షే భరతఖండే మేరోః దక్షిణ దిగ్భాగే అస్మిన్ వర్తమాన వ్యావహారిక చాంద్రమానేన —

శ్రీ ${samvatsara} నామ సంవత్సరే, ${ayana}నే, ${ritu} ఋతౌ, ${masaBase} మాసే, ${pakshaBase} పక్షే, ${tithi} తిథౌ, ${vaasara} వాసరే, ${nakshatra} నక్షత్రే, శుభయోగే శుభకరణే ఏవంగుణ విశేషణ విశిష్టాయాం అస్యాం శుభ తిథౌ —

శ్రీ పరమేశ్వర ప్రీత్యర్థం ధ్యానావాహనాది షోడశోపచార పూజాం కరిష్యే ||`
  );
}

const MASA_ORDER = ['Chaitra', 'Baisakha', 'Jyestha', 'Asadha', 'Srabana', 'Bhadraba', 'Aswina', 'Karttika', 'Margasira', 'Pausa', 'Magha', 'Phalguna'];

const at = (mp, utcMs) => mp.calendar(new Date(utcMs), LAT, LNG);
const DAY = 86400000;

// The amanta (Telugu) lunar month is named for the SOLAR month in which the amavasya
// that *began* it fell. The library's `Masa` is the solar month (it flips at sankranti,
// mid-lunar-month) and its `MoonMasa` is off by one — so neither is usable directly.
// Walk back to the amavasya that started this lunar month and read the solar month there.
function lunarMasa(mp, refMs) {
  for (let i = 1; i <= 32; i++) {                 // strictly before ref: on an amavasya the
    const ms = refMs - i * DAY;                   // month is ENDING, so its start is earlier
    const c = at(mp, ms);
    if (c?.Tithi?.name_en_IN === 'Amavasya') return { masaEn: c?.Masa?.name_en_IN || null, startMs: ms };
  }
  return { masaEn: at(mp, refMs)?.Masa?.name_en_IN || null, startMs: refMs };
}

export function todaysPanchangam(dateKey) {
  const key = dateKey || istDateKey();            // YYYY-MM-DD in IST
  const [y, m, d] = key.split('-').map(Number);
  const refMs = Date.UTC(y, m - 1, d, 0, 30, 0);  // ~06:00 IST (sunrise-ish)
  const mp = new MhahPanchang();
  const c = mp.calendar(new Date(refMs), LAT, LNG);
  const en = f => (f === 'Masa' ? masaEn : c[f]?.name_en_IN) || null;
  const { masaEn } = lunarMasa(mp, refMs);
  const vaaraIdx = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const te = (map, v) => (v && map[v]) || v || '—';

  const vaara = VAARA[vaaraIdx];
  const tithi = te(TITHI, en('Tithi'));
  const paksha = te(PAKSHA, en('Paksha'));
  const nakshatra = te(NAK, en('Nakshatra'));
  const masa = te(MASA, en('Masa'));

  // ── derived fields for the sankalpam ──
  // The samvatsara rolls at Ugadi (Chaitra Shukla Padyami). Step back by however many
  // lunar months we are past Chaitra to land in the lunar year's own Gregorian year,
  // rather than guessing with a fixed calendar date.
  const masaIdx = Math.max(0, MASA_ORDER.indexOf(masaEn));
  const ugadiYear = new Date(refMs - masaIdx * 29.53 * DAY).getUTCFullYear();
  const samvatsara = SAMVATSARA[(((ugadiYear - 1987) % 60) + 60) % 60];
  // ayana: Uttarayana ≈ Jan 14 → Jul 15, else Dakshinayana
  const afterMakara = m > 1 || (m === 1 && d >= 14);
  const beforeKarka = m < 7 || (m === 7 && d < 16);
  const ayana = afterMakara && beforeKarka ? 'ఉత్తరాయ' : 'దక్షిణాయ';
  const masaBase = masa.replace(/ం$/, '');
  const pakshaBase = paksha.replace(' పక్షం', '');
  const ritu = RITU[masaBase] || '—';
  const vaasara = VAASARA[vaara] || vaara.replace('వారం', '');

  const sankalpam = buildSankalpam({ samvatsara, ayana, ritu, masaBase, pakshaBase, tithi, vaasara, nakshatra });

  return {
    date: key, vaara, tithi, paksha, nakshatra, masa,
    samvatsara, ayana: ayana + 'నే', ritu, sankalpam,
    // English fallbacks for anything the UI wants to show verbatim
    tithi_en: en('Tithi'), nakshatra_en: en('Nakshatra'), masa_en: en('Masa'),
    yoga_en: en('Yoga'), karana_en: en('Karna'),
  };
}
