'use client';
import { useState } from 'react';

// ─── Prayer data in Telugu ─────────────────────────────────────────────────────

const PRAYERS = [
  {
    id: 1,
    name: 'శుక్లాంబరధరం',
    sub: 'విష్ణు ధ్యాన శ్లోకం',
    category: 'విష్ణు',
    color: '#3b82f6',
    icon: '🪷',
    text:
`శుక్లాంబరధరం విష్ణుం
శశివర్ణం చతుర్భుజం |
ప్రసన్నవదనం ధ్యాయేత్
సర్వ విఘ్నోపశాంతయే ||`,
  },

  {
    id: 2,
    name: 'సంకట నాశన గణేశ స్తోత్రం',
    sub: 'గణపతి 12 దివ్య నామాలు',
    category: 'గణేశ',
    color: '#f97316',
    icon: '🐘',
    text:
`నారద ఉవాచ:

ప్రణమ్య శిరసా దేవం గౌరీపుత్రం వినాయకం |
భక్తావాసం స్మరేన్నిత్యమాయుః కామార్థ సిద్ధయే ||

ప్రథమం వక్రతుండం చ ఏకదంతం ద్వితీయకం |
తృతీయం కృష్ణపింగాక్షం గజవక్త్రం చతుర్థకం ||

లంబోదరం పంచమం చ షష్ఠం వికటమేవ చ |
సప్తమం విఘ్నరాజేంద్రం ధూమ్రవర్ణం తథాష్టమం ||

నవమం భాలచంద్రం చ దశమం తు వినాయకం |
ఏకాదశం గణపతిం ద్వాదశం తు గజాననం ||

ద్వాదశైతాని నామాని త్రిసంధ్యం యః పఠేన్నరః |
న చ విఘ్నభయం తస్య సర్వసిద్ధికరం ప్రభో ||

విద్యార్థీ లభతే విద్యాం ధనార్థీ లభతే ధనం |
పుత్రార్థీ లభతే పుత్రాన్ మోక్షార్థీ లభతే గతిం ||

జపేత్ గణపతిస్తోత్రం షడ్భిర్మాసైః ఫలం లభేత్ |
సంవత్సరేణ సిద్ధిం చ లభతే నాత్ర సంశయః ||

అష్టభ్యో బ్రాహ్మణేభ్యశ్చ లిఖిత్వా యః సమర్పయేత్ |
తస్య విద్యా భవేత్సర్వా గణేశస్య ప్రసాదతః ||

|| ఇతి శ్రీ నారద పురాణే సంకటనాశనం గణేశ స్తోత్రం సంపూర్ణం ||`,
  },

  {
    id: 3,
    name: 'క్షీరోదన్వత్',
    sub: 'నారాయణ ప్రార్థన',
    category: 'విష్ణు',
    color: '#3b82f6',
    icon: '🪷',
    text:
`క్షీరోదన్వత్ ప్రబోధాయ
నమస్తే విష్ణురూపిణే |
నమస్తే పద్మనాభాయ
నమో నారాయణాయ చ ||

నమో బ్రహ్మణ్యదేవాయ
గోబ్రాహ్మణ హితాయ చ |
జగద్ధితాయ కృష్ణాయ
గోవిందాయ నమో నమః ||

నమో నారాయణాయేతి
మంత్రేణోద్ధరతే నరః |
సంసార సాగరే మగ్నం
తస్మాదిదం జపేత్ సదా ||`,
  },

  {
    id: 4,
    name: 'వజ్ర కవచం',
    sub: 'శ్రీ విష్ణు వజ్ర కవచం',
    category: 'విష్ణు',
    color: '#3b82f6',
    icon: '🪷',
    text:
`ఓం నమో నారాయణాయ |

విష్ణుర్మే పాతు మూర్ధానం
ప్రభుః పాతు ప్రజాపతిః |
నయనే మాధవః పాతు
కర్ణయోః కేశవో వశీ ||

నాసికాం పాతు వైకుంఠః
ముఖం పాతు జనార్దనః |
జిహ్వాం గోవిందో పాతు
దంతాన్ చక్రాయుధో విభుః ||

కంఠం పాతు హృషీకేశః
స్కంధం పాతు త్రివిక్రమః |
భుజావీశః పాతు నిత్యం
కరయోః గరుడధ్వజః ||

హృదయం పాతు వరాహస్తు
ఉదరం పాతు మాధవః |
కటిం పాతు హరిః శ్రీమాన్
జంఘే పాతు మురారి చ ||

పాదయుగ్మం పాతు విష్ణుః
సర్వత్ర పురుషోత్తమః |
సర్వాంగాని సదా పాతు
నారాయణో నమోఽస్తుతే ||

ఏతత్కవచమజ్ఞాత్వా
విష్ణుం పూజయతే తు యః |
శతజన్మార్జితాత్ పాపాత్
ముచ్యతే నాత్ర సంశయః ||

|| ఇతి శ్రీ విష్ణు వజ్ర కవచం సంపూర్ణం ||`,
  },

  {
    id: 5,
    name: 'శ్రీ రామ రామేతి',
    sub: 'రామ తారక మంత్రం',
    category: 'రామ',
    color: '#22c55e',
    icon: '🏹',
    text:
`శ్రీ రామ రామ రామేతి
రమే రామే మనోరమే |
సహస్రనామ తత్తుల్యం
రామ నామ వరాననే ||

రామాయ రామచంద్రాయ
రామభద్రాయ వేధసే |
రఘునాథాయ నాథాయ
సీతాయాః పతయే నమః ||

ఆపదామపహర్తారం
దాతారం సర్వసంపదాం |
లోకాభిరామం శ్రీరామం
భూయో భూయో నమామ్యహం ||`,
  },

  {
    id: 6,
    name: 'రుద్ర మంత్రం',
    sub: 'నమస్తే అస్తు భగవన్ — మహాదేవ నమావళి',
    category: 'శివ',
    color: '#7c3aed',
    icon: '🔱',
    text:
`నమస్తే అస్తు భగవన్
విశ్వేశ్వరాయ మహాదేవాయ |
త్ర్యంబకాయ త్రిపురాంతకాయ
త్రికాగ్నికాలాయ కాలాగ్నిరుద్రాయ ||

నీలకంఠాయ మృత్యుంజయాయ
సర్వేశ్వరాయ సదాశివాయ |
శ్రీమన్మహాదేవాయ నమః ||

నమస్తే అస్తు భగవన్
ఉమాపతయే నమో నమః |
పశుపతయే నమో నమః
నమః శంభవే చ మయోభవే చ ||

నమః శంకరాయ చ మయస్కరాయ చ
నమః శివాయ చ శివతరాయ చ |
నమస్తే రుద్ర మన్యవ
ఉతో త ఇషవే నమః ||

నమ స్తే అస్తు ధన్వనే
బాహుభ్యాముత తే నమః |
నమో రుద్రాయ నమో రుద్రాయ
నమో రుద్రాయ తే నమః ||

|| ఇతి శ్రీ రుద్ర మంత్రం సంపూర్ణం ||`,
  },

  {
    id: 7,
    name: 'శివ అష్టోత్తరం',
    sub: 'శివుని 108 నామాలు',
    category: 'శివ',
    color: '#7c3aed',
    icon: '🔱',
    text:
`ఓం శివాయ నమః
ఓం మహేశ్వరాయ నమః
ఓం శంభవే నమః
ఓం పినాకినే నమః
ఓం శశిశేఖరాయ నమః
ఓం వామదేవాయ నమః
ఓం విరూపాక్షాయ నమః
ఓం కపర్దినే నమః
ఓం నీలలోహితాయ నమః
ఓం శంకరాయ నమః

ఓం శూలపానయే నమః
ఓం ఖట్వాంగినే నమః
ఓం విష్ణువల్లభాయ నమః
ఓం శిపివిష్టాయ నమః
ఓం అంబికానాథాయ నమః
ఓం శ్రీకంఠాయ నమః
ఓం భక్తవత్సలాయ నమః
ఓం భవాయ నమః
ఓం శర్వాయ నమః
ఓం త్రిలోకేశాయ నమః

ఓం శితికంఠాయ నమః
ఓం శివాప్రియాయ నమః
ఓం ఉగ్రాయ నమః
ఓం కపాలినే నమః
ఓం కామారయే నమః
ఓం అంధకాసుర సూదనాయ నమః
ఓం గంగాధరాయ నమః
ఓం లలాటాక్షాయ నమః
ఓం కాలకాలాయ నమః
ఓం కృపానిధయే నమః

ఓం భీమాయ నమః
ఓం పరశుహస్తాయ నమః
ఓం మృగపాణయే నమః
ఓం జటాధరాయ నమః
ఓం కైలాసవాసినే నమః
ఓం కవచినే నమః
ఓం కఠోరాయ నమః
ఓం త్రిపురాంతకాయ నమః
ఓం వృషాంకాయ నమః
ఓం వృషభారూఢాయ నమః

ఓం భస్మోద్ధూళిత విగ్రహాయ నమః
ఓం సామప్రియాయ నమః
ఓం స్వరమయాయ నమః
ఓం త్రయీమూర్తయే నమః
ఓం అనీశ్వరాయ నమః
ఓం సర్వజ్ఞాయ నమః
ఓం పరమాత్మనే నమః
ఓం సోమసూర్యాగ్నిలోచనాయ నమః
ఓం హవిషే నమః
ఓం యజ్ఞమయాయ నమః

ఓం సోమాయ నమః
ఓం పంచవక్త్రాయ నమః
ఓం సదాశివాయ నమః
ఓం విశ్వేశ్వరాయ నమః
ఓం వీరభద్రాయ నమః
ఓం గణనాథాయ నమః
ఓం ప్రజాపతయే నమః
ఓం హిరణ్యరేతసే నమః
ఓం దుర్ధర్షాయ నమః
ఓం గిరీశాయ నమః

ఓం గిరిశాయ నమః
ఓం అనఘాయ నమః
ఓం భుజంగభూషణాయ నమః
ఓం భర్గాయ నమః
ఓం గిరిధన్వినే నమః
ఓం గిరిప్రియాయ నమః
ఓం కృత్తివాసాయ నమః
ఓం పురారాతయే నమః
ఓం భగవతే నమః
ఓం ప్రమథాధిపాయ నమః

ఓం మృత్యుంజయాయ నమః
ఓం సూక్ష్మతనవే నమః
ఓం జగద్వ్యాపినే నమః
ఓం జగద్గురవే నమః
ఓం వ్యోమకేశాయ నమః
ఓం మహాసేనజనకాయ నమః
ఓం చారువిక్రమాయ నమః
ఓం రుద్రాయ నమః
ఓం భూతపతయే నమః
ఓం స్థాణవే నమః

ఓం అహిర్బుధ్న్యాయ నమః
ఓం దిగంబరాయ నమః
ఓం అష్టమూర్తయే నమః
ఓం అనేకాత్మనే నమః
ఓం సాత్త్వికాయ నమః
ఓం శుద్ధవిగ్రహాయ నమః
ఓం శాశ్వతాయ నమః
ఓం ఖండపరశవే నమః
ఓం అజాయ నమః
ఓం పాశవిమోచకాయ నమః

ఓం మృడాయ నమః
ఓం పశుపతయే నమః
ఓం దేవాయ నమః
ఓం మహాదేవాయ నమః
ఓం అవ్యయాయ నమః
ఓం హరయే నమః
ఓం పూషదంతభిదే నమః
ఓం అవ్యగ్రాయ నమః
ఓం దక్షాధ్వరహరాయ నమః
ఓం హరాయ నమః

ఓం భగనేత్రభిదే నమః
ఓం అవ్యక్తాయ నమః
ఓం సహస్రాక్షాయ నమః
ఓం సహస్రపాదే నమః
ఓం అపవర్గప్రదాయ నమః
ఓం అనంతాయ నమః
ఓం తారకాయ నమః
ఓం పరమేశ్వరాయ నమః

|| ఇతి శ్రీ శివ అష్టోత్తర శతనామావళి సంపూర్ణం ||`,
  },

  {
    id: 8,
    name: 'ప్రథమం సాయినాధాయ',
    sub: 'శ్రీ సాయిబాబా స్తోత్రం',
    category: 'సాయి',
    color: '#f59e0b',
    icon: '🕯️',
    text:
`ప్రథమం సాయినాధాయ
నమస్తే సత్గురో విభో |
ద్వితీయం చ గురుభ్యశ్చ
నమస్కారాన్ సమర్పయే ||

అనంతా తులా రే కసే స్తవావే
అనంతా తులా రే కసే నమావే |
అనంతా మురాలా తులా రే ధ్యావే
అనంతా తులా రే కసే ఓళఖావే ||

సాయిరామ సాయిరామ
సాయిరామ జయ జయ రామ |
సాయిశ్యామ సాయిశ్యామ
సాయిశ్యామ జయ జయ శ్యామ ||

పతితపావన నాద్యా కిర్తీ
సాయి అవతారా ఐసీ ||

శ్రద్ధా సబూరీ తే ద్వారికా చావీ
తే ద్వారికా చావీ |
సాయి చరణీ మన గుంతుని రాహీ
మన గుంతుని రాహీ ||

|| ఓం సాయి శ్రీ సాయి జయ జయ సాయి ||`,
  },

  {
    id: 9,
    name: 'యానికాని స్తోత్రం',
    sub: 'పాప నాశన ప్రదక్షిణ శ్లోకం',
    category: 'సార్వత్రిక',
    color: '#14b8a6',
    icon: '✨',
    text:
`యాని కాని చ పాపాని
జన్మాంతర కృతాని చ |
తాని తాని వినశ్యంతి
ప్రదక్షిణ పదే పదే ||

పాపోఽహం పాపకర్మాఽహం
పాపాత్మా పాపసంభవః |
త్రాహిమాం కృపయా దేవ
శరణాగత వత్సల ||

అన్యథా శరణం నాస్తి
త్వమేవ శరణం మమ |
తస్మాత్ కారుణ్యభావేన
రక్ష రక్ష జనార్దన ||`,
  },

  {
    id: 10,
    name: 'గోప ప్రదక్షిణం',
    sub: 'గోమాత ప్రదక్షిణ శ్లోకాలు',
    category: 'సార్వత్రిక',
    color: '#14b8a6',
    icon: '🐄',
    text:
`గావో మమాగ్రతో నిత్యం
గావః పృష్ఠత ఏవ చ |
గావో మే సర్వతశ్చైవ
గావో మే జీవనం మమ ||

సర్వతీర్థమయీ గావః
సర్వదేవమయా వృషాః |
తేషాం ప్రదక్షిణం కుర్వన్
సర్వపాపైః ప్రముచ్యతే ||

గావో లక్ష్మీస్తథా విష్ణుః
గావో ధన్వంతరిస్తథా |
సురభిః సర్వదేవానాం
మాతా భూతా ప్రతిష్ఠితా ||

గోమాతా జగదంబికా
నమస్తే నమో నమః |
పాపం హర కళ్యాణం దేహి
సర్వదా రక్ష మాం సదా ||`,
  },
];

const CATEGORIES = ['అన్నీ', 'గణేశ', 'విష్ణు', 'శివ', 'రామ', 'సాయి', 'సార్వత్రిక'];

// ─── Prayer card ───────────────────────────────────────────────────────────────

function PrayerCard({ prayer, fontSize, index }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      borderRadius: 16,
      border: `1px solid ${open ? prayer.color + '55' : '#1e1e1e'}`,
      background: open ? '#161616' : '#111',
      overflow: 'hidden',
      transition: 'all 0.2s',
    }}>
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
          cursor: 'pointer', padding: '16px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}
      >
        {/* Number + icon */}
        <div style={{
          width: 46, height: 46, borderRadius: 12, flexShrink: 0,
          background: `${prayer.color}18`, border: `1px solid ${prayer.color}33`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
        }}>
          <span style={{ fontSize: 18 }}>{prayer.icon}</span>
          <span style={{ fontSize: 9, fontWeight: 800, color: prayer.color, letterSpacing: 0.5 }}>{String(index + 1).padStart(2, '0')}</span>
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f0', lineHeight: 1.3 }}>{prayer.name}</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>{prayer.sub}</div>
        </div>

        {/* Expand arrow */}
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: open ? `${prayer.color}22` : '#1a1a1a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: open ? prayer.color : '#333', fontSize: 11,
          transition: 'all 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0,
        }}>▼</div>
      </button>

      {/* Expanded text */}
      {open && (
        <div style={{ borderTop: `1px solid ${prayer.color}22`, padding: '20px 18px 24px' }}>
          {/* Category badge */}
          <div style={{ marginBottom: 18 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 12px', borderRadius: 20,
              background: `${prayer.color}18`, border: `1px solid ${prayer.color}33`,
              fontSize: 11, fontWeight: 700, color: prayer.color, letterSpacing: 0.5,
            }}>
              {prayer.icon} {prayer.category}
            </span>
          </div>

          {/* Prayer text */}
          <pre style={{
            fontFamily: '"Noto Serif Telugu", "Mandali", "Gautami", serif',
            fontSize: fontSize,
            lineHeight: 1.9,
            color: '#e8e8e8',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
            letterSpacing: 0.3,
          }}>
            {prayer.text}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Prayers() {
  const [fontSize, setFontSize]         = useState(18);
  const [activeCategory, setCategory]   = useState('అన్నీ');
  const [expandAll, setExpandAll]       = useState(false);

  const filtered = activeCategory === 'అన్నీ'
    ? PRAYERS
    : PRAYERS.filter(p => p.category === activeCategory);

  return (
    <div style={{ background: '#0d0d0d', minHeight: '100%' }}>

      {/* Controls bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(13,13,13,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid #1e1e1e',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {/* Font size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid #2a2a2a', borderRadius: 10, overflow: 'hidden' }}>
          <button
            onClick={() => setFontSize(s => Math.max(14, s - 2))}
            style={{ padding: '7px 13px', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14 }}
          >A−</button>
          <span style={{ padding: '7px 4px', fontSize: 11, color: '#444', fontWeight: 600 }}>{fontSize}</span>
          <button
            onClick={() => setFontSize(s => Math.min(26, s + 2))}
            style={{ padding: '7px 13px', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16 }}
          >A+</button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Prayer count */}
        <span style={{ fontSize: 11, color: '#333', fontWeight: 600 }}>{filtered.length} స్తోత్రాలు</span>
      </div>

      {/* Category chips */}
      <div style={{
        display: 'flex', gap: 7, padding: '12px 14px',
        overflowX: 'auto', scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        borderBottom: '1px solid #1a1a1a',
      }}>
        {CATEGORIES.map(cat => {
          const isActive = cat === activeCategory;
          // pick color for active
          const matchPrayer = PRAYERS.find(p => p.category === cat);
          const accent = matchPrayer?.color ?? '#f59e0b';
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 20,
                border: isActive ? `1.5px solid ${accent}` : '1.5px solid #2a2a2a',
                background: isActive ? `${accent}18` : 'transparent',
                color: isActive ? accent : '#444',
                fontSize: 12, fontWeight: isActive ? 700 : 500, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Prayer list */}
      <div style={{ padding: '14px 12px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((prayer, i) => (
          <PrayerCard
            key={prayer.id}
            prayer={prayer}
            fontSize={fontSize}
            index={PRAYERS.indexOf(prayer)}
          />
        ))}
      </div>
    </div>
  );
}
