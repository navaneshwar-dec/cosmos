'use client';

const placeholders = [
  { icon: '💰', label: 'Income', desc: 'Track monthly income & sources' },
  { icon: '💸', label: 'Expenses', desc: 'Categorize and monitor spending' },
  { icon: '🏦', label: 'Savings', desc: 'Goals, SIPs, emergency fund' },
  { icon: '📈', label: 'Investments', desc: 'Stocks, MFs, crypto portfolio' },
];

export default function Finances() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>₹</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
          Finances
        </div>
        <div style={{ fontSize: 14, color: '#555', maxWidth: 340, margin: '0 auto', lineHeight: 1.6 }}>
          Your financial dashboard is on its way. Modules are being planned.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {placeholders.map(p => (
          <div
            key={p.label}
            style={{
              background: '#1a1a1a',
              border: '1px dashed #2a2a2a',
              borderRadius: 12,
              padding: '20px 16px',
              opacity: 0.6,
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>{p.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#888', marginBottom: 4 }}>{p.label}</div>
            <div style={{ fontSize: 12, color: '#444', lineHeight: 1.5 }}>{p.desc}</div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 32,
        padding: '16px',
        background: '#111',
        border: '1px solid #1e1e1e',
        borderRadius: 10,
        textAlign: 'center',
        fontSize: 12,
        color: '#333',
      }}>
        Coming soon — tell me what to build first
      </div>
    </div>
  );
}
