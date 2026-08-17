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

export function todaysPanchangam(dateKey) {
  const key = dateKey || istDateKey();            // YYYY-MM-DD in IST
  const [y, m, d] = key.split('-').map(Number);
  const ref = new Date(Date.UTC(y, m - 1, d, 0, 30, 0)); // ~06:00 IST (sunrise-ish)
  const c = new MhahPanchang().calendar(ref, LAT, LNG);
  const en = f => c[f]?.name_en_IN || null;
  const vaaraIdx = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const te = (map, v) => (v && map[v]) || v || '—';
  return {
    date: key,
    vaara: VAARA[vaaraIdx],
    tithi: te(TITHI, en('Tithi')),
    paksha: te(PAKSHA, en('Paksha')),
    nakshatra: te(NAK, en('Nakshatra')),
    masa: te(MASA, en('Masa')),
    // English fallbacks for anything the UI wants to show verbatim
    tithi_en: en('Tithi'), nakshatra_en: en('Nakshatra'), masa_en: en('Masa'),
    yoga_en: en('Yoga'), karana_en: en('Karna'),
  };
}
