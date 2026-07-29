'use client';

import { useState } from 'react';

export default function Home() {
  const [count, setCount] = useState(0);

  return (
    <main style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: '#0f172a',
      color: '#f8fafc',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: '#1e293b',
        padding: '2rem',
        borderRadius: '12px',
        border: '1px solid #334155',
        textAlign: 'center'
      }}>
        <h2>Vercel + Framer Test</h2>
        <p>Test state inside your Framer iframe embed.</p>
        <p>Clicks: <strong>{count}</strong></p>
        <button 
          onClick={() => setCount(count + 1)}
          style={{
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            marginTop: '1rem'
          }}
        >
          Click Me
        </button>
      </div>
    </main>
  );
}