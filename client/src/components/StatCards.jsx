import React from 'react';

export default function StatCards({ leads }) {
  const total = leads.length;
  const withPhone = leads.filter((l) => l.phone).length;
  const withEmail = leads.filter((l) => l.email).length;
  const withSite = leads.filter((l) => l.website).length;
  const withSocial = leads.filter((l) => l.facebook || l.instagram || l.linkedin).length;

  const cards = [
    { label: 'Total Leads', value: total, icon: '📇', accent: 'text-brand-400' },
    { label: 'With Phone', value: withPhone, icon: '📞', accent: 'text-sky-400' },
    { label: 'With Email', value: withEmail, icon: '✉️', accent: 'text-violet-400' },
    { label: 'With Website', value: withSite, icon: '🌐', accent: 'text-amber-400' },
    { label: 'With Socials', value: withSocial, icon: '🔗', accent: 'text-pink-400' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="card p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-lg">{c.icon}</span>
            <span className={`text-2xl font-extrabold ${c.accent}`}>{c.value}</span>
          </div>
          <p className="text-[11px] font-semibold text-white/40 mt-1">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
