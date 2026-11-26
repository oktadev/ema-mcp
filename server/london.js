// Static London data and pure helpers. No I/O, so the server stays easy to read.

// Ordered station lists per line (simplified). Adjacent stations are connected.
export const LINES = {
  Central: ['Ealing Broadway', 'Notting Hill Gate', 'Marble Arch', 'Bond Street', 'Oxford Circus', 'Tottenham Court Road', 'Holborn', 'Chancery Lane', "St Paul's", 'Bank', 'Liverpool Street', 'Stratford'],
  Northern: ['Camden Town', 'Euston', "King's Cross St Pancras", 'Angel', 'Old Street', 'Moorgate', 'Bank', 'London Bridge', 'Borough', 'Elephant & Castle', 'Kennington'],
  'Northern (Charing Cross)': ['Camden Town', 'Euston', 'Warren Street', 'Goodge Street', 'Tottenham Court Road', 'Leicester Square', 'Charing Cross', 'Embankment', 'Waterloo', 'Kennington'],
  Victoria: ['Brixton', 'Stockwell', 'Vauxhall', 'Pimlico', 'Victoria', 'Green Park', 'Oxford Circus', 'Warren Street', 'Euston', "King's Cross St Pancras", 'Highbury & Islington'],
  Jubilee: ['Baker Street', 'Bond Street', 'Green Park', 'Westminster', 'Waterloo', 'Southwark', 'London Bridge', 'Bermondsey', 'Canada Water', 'Canary Wharf', 'North Greenwich', 'Canning Town', 'West Ham', 'Stratford'],
  'Elizabeth line': ['Heathrow Terminals 2 & 3', 'Hayes & Harlington', 'Southall', 'Hanwell', 'West Ealing', 'Ealing Broadway', 'Acton Main Line', 'Paddington', 'Bond Street', 'Tottenham Court Road', 'Farringdon', 'Liverpool Street', 'Whitechapel', 'Stratford'],
};

const displayLine = (line) => line.replace(/ \(.*\)$/, '');

// station -> [{ to, line }]
const GRAPH = new Map();
for (const [line, stations] of Object.entries(LINES)) {
  stations.forEach((station, i) => {
    if (!GRAPH.has(station)) GRAPH.set(station, []);
    const next = stations[i + 1];
    if (!next) return;
    if (!GRAPH.has(next)) GRAPH.set(next, []);
    GRAPH.get(station).push({ to: next, line: displayLine(line) });
    GRAPH.get(next).push({ to: station, line: displayLine(line) });
  });
}

export const STATIONS = [...GRAPH.keys()].sort();

const normalise = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function findStation(query) {
  const q = normalise(query);
  return (
    STATIONS.find((s) => normalise(s) === q) ??
    STATIONS.find((s) => normalise(s).includes(q)) ??
    null
  );
}

const CHANGE_PENALTY = 4; // "stops" worth of pain for switching lines

// Dijkstra over (station, line) states, so interchanges cost extra.
export function planJourney(from, to) {
  const start = findStation(from);
  const end = findStation(to);
  if (!start || !end) return null;

  const dist = new Map([[`${start}|`, 0]]);
  const prev = new Map();
  const queue = [{ station: start, line: '', cost: 0 }];

  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const { station, line, cost } = queue.shift();
    if (station === end) {
      const legs = [];
      let key = `${station}|${line}`;
      const path = [];
      while (prev.has(key)) {
        const p = prev.get(key);
        path.unshift({ from: p.station, to: p.nextStation, line: p.edgeLine });
        key = p.key;
      }
      for (const step of path) {
        const last = legs[legs.length - 1];
        if (last && last.line === step.line) {
          last.to = step.to;
          last.stops += 1;
        } else {
          legs.push({ line: step.line, from: step.from, to: step.to, stops: 1 });
        }
      }
      return { from: start, to: end, legs, stops: legs.reduce((n, l) => n + l.stops, 0) };
    }
    if (cost > (dist.get(`${station}|${line}`) ?? Infinity)) continue;
    for (const edge of GRAPH.get(station)) {
      const change = line && line !== edge.line ? CHANGE_PENALTY : 0;
      const nextCost = cost + 1 + change;
      const nextKey = `${edge.to}|${edge.line}`;
      if (nextCost < (dist.get(nextKey) ?? Infinity)) {
        dist.set(nextKey, nextCost);
        prev.set(nextKey, { key: `${station}|${line}`, station, nextStation: edge.to, edgeLine: edge.line });
        queue.push({ station: edge.to, line: edge.line, cost: nextCost });
      }
    }
  }
  return null;
}

export function fareFor(journey) {
  const airport = [journey.from, journey.to].some((s) => s.startsWith('Heathrow'));
  const pence = 280 + journey.stops * 25 + (airport ? 500 : 0);
  return pence;
}

const STATUSES = [
  'Good service',
  'Good service',
  'Good service',
  'Minor delays: a fox is on the track',
  'Minor delays: signal failure at an unspecified location',
  'Part suspended: a very large pigeon',
  'Severe delays: customer incident (somebody left a baguette on the train)',
];

// Deterministic per line per hour, so everyone in the room sees the same thing.
export function lineStatus(line, now = new Date()) {
  const seed = [...line].reduce((n, c) => n + c.charCodeAt(0), 0) + now.getUTCHours() + now.getUTCDate();
  return STATUSES[seed % STATUSES.length];
}

export const SLANG = {
  'apples and pears': 'stairs',
  'dog and bone': 'phone',
  'trouble and strife': 'wife',
  'plates of meat': 'feet',
  'butchers': 'look (butcher\'s hook)',
  'brown bread': 'dead',
  'porky pies': 'lies',
  'rosie lee': 'tea',
  'adam and eve': 'believe',
  'barnet': 'hair (Barnet Fair)',
  'ruby': 'curry (Ruby Murray)',
  'bread and honey': 'money',
  'boat race': 'face',
  'cream crackered': 'knackered',
  'pen and ink': 'stink',
};

export function translateSlang(phrase) {
  const key = phrase.toLowerCase().replace(/[^a-z' ]/g, '').trim().replace(/'/g, '');
  return SLANG[key] ?? null;
}
