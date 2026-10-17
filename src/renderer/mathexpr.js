// Koordinat sistemine çizilecek fonksiyon ifadelerini ("y = 2x^2 - sin(x)" gibi) ayrıştırır.
// CSP eval'e izin vermediği için ifade küçük bir ayrıştırıcıyla JavaScript fonksiyonlarına çevrilir.
// Desteklenenler: + - * / ^, parantez, örtük çarpma (2x, 3(x+1), x sin x), sin cos tan cot
// (tg/cotg), asin acos atan, sqrt (√), abs, ln, log (10 tabanlı), exp, pi (π), e. Açılar radyandır.

const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, tg: Math.tan,
  cot: (v) => 1 / Math.tan(v), cotg: (v) => 1 / Math.tan(v),
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp,
};
const CONSTS = { pi: Math.PI, e: Math.E };
// Harf dizileri en uzun eşleşmeyle bölünür: "sinx" -> sin, x; "pix" -> pi, x.
const NAMES = [...Object.keys(FUNCS), ...Object.keys(CONSTS), 'x'].sort((a, b) => b.length - a.length);

function normalize(src) {
  return String(src).trim().toLowerCase()
    .replace(/^(?:y|f\s*\(\s*x\s*\))\s*=/, '')
    .replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/[·×]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-')
    .replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/(\d),(\d)/g, '$1.$2') // Türkçe ondalık virgül
    .trim();
}

function tokenize(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
      if (!m) throw new Error(`Anlaşılmayan sayı: "${ch}"`);
      out.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-zçğıöşü]/.test(ch)) {
      const word = /^[a-zçğıöşü]+/.exec(s.slice(i))[0];
      for (let j = 0; j < word.length;) {
        const name = NAMES.find((n) => word.startsWith(n, j));
        if (!name) throw new Error(`Bilinmeyen ifade: "${word.slice(j)}"`);
        if (FUNCS[name]) out.push({ t: 'fn', v: name });
        else if (name === 'x') out.push({ t: 'x' });
        else out.push({ t: 'num', v: CONSTS[name] });
        j += name.length;
      }
      i += word.length;
      continue;
    }
    if ('+-*/^()'.includes(ch)) {
      out.push({ t: ch });
      i++;
      continue;
    }
    throw new Error(`Anlaşılmayan karakter: "${ch}"`);
  }
  return out;
}

function parse(tokens) {
  let p = 0;
  const peek = () => tokens[p];
  const startsAtom = (tok) => tok && (tok.t === 'num' || tok.t === 'x' || tok.t === 'fn' || tok.t === '(');
  const eat = (t) => {
    if (peek()?.t !== t) throw new Error(t === ')' ? 'Kapanmayan parantez' : 'İfade eksik');
    p++;
  };

  function expr() {
    let a = term();
    while (peek()?.t === '+' || peek()?.t === '-') {
      const op = tokens[p++].t;
      const l = a;
      const b = term();
      a = op === '+' ? (x) => l(x) + b(x) : (x) => l(x) - b(x);
    }
    return a;
  }

  // Çarpma/bölme ve örtük çarpma ("2x", "x(x+1)").
  function term() {
    let a = unary();
    for (;;) {
      const tok = peek();
      const l = a;
      if (tok?.t === '*' || tok?.t === '/') {
        p++;
        const b = unary();
        a = tok.t === '*' ? (x) => l(x) * b(x) : (x) => l(x) / b(x);
      } else if (startsAtom(tok)) {
        const b = power();
        a = (x) => l(x) * b(x);
      } else return a;
    }
  }

  function unary() {
    const tok = peek();
    if (tok?.t === '-') {
      p++;
      const a = unary();
      return (x) => -a(x);
    }
    if (tok?.t === '+') {
      p++;
      return unary();
    }
    return power();
  }

  // Üs sağdan birleşir: x^2^3 = x^(2^3); -x^2 = -(x^2).
  function power() {
    const base = atom();
    if (peek()?.t !== '^') return base;
    p++;
    const e = unary();
    return (x) => Math.pow(base(x), e(x));
  }

  function atom() {
    const tok = tokens[p++];
    if (!tok) throw new Error('İfade eksik');
    if (tok.t === 'num') {
      const v = tok.v;
      return () => v;
    }
    if (tok.t === 'x') return (x) => x;
    if (tok.t === '(') {
      const a = expr();
      eat(')');
      return a;
    }
    if (tok.t === 'fn') {
      const f = FUNCS[tok.v];
      // sin^2 x = (sin x)^2
      let exp = null;
      if (peek()?.t === '^') {
        p++;
        exp = unary();
      }
      let arg;
      if (peek()?.t === '(') {
        p++;
        arg = expr();
        eat(')');
      } else {
        // Parantezsiz bağımsız değişken: "sin 2x" = sin(2x), "sin x cos x" = sin(x)·cos(x).
        arg = unary();
        while (startsAtom(peek()) && peek().t !== 'fn') {
          const l = arg;
          const b = power();
          arg = (x) => l(x) * b(x);
        }
      }
      const g = arg;
      return exp ? (x) => Math.pow(f(g(x)), exp(x)) : (x) => f(g(x));
    }
    throw new Error(tok.t === ')' ? 'Fazladan kapanan parantez' : `Beklenmeyen "${tok.t}"`);
  }

  const f = expr();
  if (p < tokens.length) {
    const t = tokens[p];
    throw new Error(t.t === ')' ? 'Fazladan kapanan parantez' : 'İfade anlaşılamadı');
  }
  return f;
}

// { fn } ya da { error } döndürür.
export function compileFunction(src) {
  try {
    const s = normalize(src);
    if (!s) return { error: 'Bir fonksiyon yaz (ör. x^2 - 2x)' };
    const fn = parse(tokenize(s));
    fn(0.5);
    return { fn };
  } catch (e) {
    return { error: e.message };
  }
}

// Gösterim için "y = …" biçimi.
export function functionLabel(src) {
  const s = String(src).trim();
  return /^(y|f\s*\(\s*x\s*\))\s*=/i.test(s) ? s : 'y = ' + s;
}
