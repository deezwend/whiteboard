// Periyodik tablonun element verileri (periodic.js kullanır). Her satır:
//   Z|Sembol|Türkçe ad|İngilizce ad|Atom kütlesi|Sınıf|Elektron dizilimi|Elektronegatiflik|Hâl|Erime °C|Kaynama °C
// Kütle köşeli parantezliyse ([98]) kararlı izotopu olmayan elementin en uzun ömürlü izotopunun kütle numarasıdır.
// Sınıf: a alkali, ae toprak alkali, tm geçiş metali, pt zayıf metal, md yarı metal, nm ametal, h halojen,
// ng soy gaz, la lantanit, ac aktinit, un özellikleri bilinmiyor. Hâl (25 °C): s katı, l sıvı, g gaz, u bilinmiyor.
// Elektronegatiflik Pauling ölçeğindedir. Boş alan bilinmiyor demektir; kaynama değerinin sonundaki "s"
// maddenin erimeden süblimleştiğini (değerin süblimleşme sıcaklığı olduğunu) gösterir.

const RAW = `
1|H|Hidrojen|Hydrogen|1.008|nm|1s1|2.20|g|-259.16|-252.87
2|He|Helyum|Helium|4.0026|ng|1s2||g||-268.93
3|Li|Lityum|Lithium|6.94|a|[He] 2s1|0.98|s|180.5|1342
4|Be|Berilyum|Beryllium|9.0122|ae|[He] 2s2|1.57|s|1287|2469
5|B|Bor|Boron|10.81|md|[He] 2s2 2p1|2.04|s|2076|3927
6|C|Karbon|Carbon|12.011|nm|[He] 2s2 2p2|2.55|s||3642s
7|N|Azot|Nitrogen|14.007|nm|[He] 2s2 2p3|3.04|g|-210.0|-195.8
8|O|Oksijen|Oxygen|15.999|nm|[He] 2s2 2p4|3.44|g|-218.8|-183.0
9|F|Flor|Fluorine|18.998|h|[He] 2s2 2p5|3.98|g|-219.7|-188.1
10|Ne|Neon|Neon|20.180|ng|[He] 2s2 2p6||g|-248.6|-246.0
11|Na|Sodyum|Sodium|22.990|a|[Ne] 3s1|0.93|s|97.79|882.9
12|Mg|Magnezyum|Magnesium|24.305|ae|[Ne] 3s2|1.31|s|650|1091
13|Al|Alüminyum|Aluminium|26.982|pt|[Ne] 3s2 3p1|1.61|s|660.32|2470
14|Si|Silisyum|Silicon|28.085|md|[Ne] 3s2 3p2|1.90|s|1414|3265
15|P|Fosfor|Phosphorus|30.974|nm|[Ne] 3s2 3p3|2.19|s|44.15|280.5
16|S|Kükürt|Sulfur|32.06|nm|[Ne] 3s2 3p4|2.58|s|115.21|444.6
17|Cl|Klor|Chlorine|35.45|h|[Ne] 3s2 3p5|3.16|g|-101.5|-34.04
18|Ar|Argon|Argon|39.95|ng|[Ne] 3s2 3p6||g|-189.3|-185.8
19|K|Potasyum|Potassium|39.098|a|[Ar] 4s1|0.82|s|63.5|759
20|Ca|Kalsiyum|Calcium|40.078|ae|[Ar] 4s2|1.00|s|842|1484
21|Sc|Skandiyum|Scandium|44.956|tm|[Ar] 3d1 4s2|1.36|s|1541|2836
22|Ti|Titanyum|Titanium|47.867|tm|[Ar] 3d2 4s2|1.54|s|1668|3287
23|V|Vanadyum|Vanadium|50.942|tm|[Ar] 3d3 4s2|1.63|s|1910|3407
24|Cr|Krom|Chromium|51.996|tm|[Ar] 3d5 4s1|1.66|s|1907|2671
25|Mn|Mangan|Manganese|54.938|tm|[Ar] 3d5 4s2|1.55|s|1246|2061
26|Fe|Demir|Iron|55.845|tm|[Ar] 3d6 4s2|1.83|s|1538|2861
27|Co|Kobalt|Cobalt|58.933|tm|[Ar] 3d7 4s2|1.88|s|1495|2927
28|Ni|Nikel|Nickel|58.693|tm|[Ar] 3d8 4s2|1.91|s|1455|2913
29|Cu|Bakır|Copper|63.546|tm|[Ar] 3d10 4s1|1.90|s|1084.62|2562
30|Zn|Çinko|Zinc|65.38|tm|[Ar] 3d10 4s2|1.65|s|419.53|907
31|Ga|Galyum|Gallium|69.723|pt|[Ar] 3d10 4s2 4p1|1.81|s|29.76|2400
32|Ge|Germanyum|Germanium|72.630|md|[Ar] 3d10 4s2 4p2|2.01|s|938.25|2833
33|As|Arsenik|Arsenic|74.922|md|[Ar] 3d10 4s2 4p3|2.18|s||615s
34|Se|Selenyum|Selenium|78.971|nm|[Ar] 3d10 4s2 4p4|2.55|s|221|685
35|Br|Brom|Bromine|79.904|h|[Ar] 3d10 4s2 4p5|2.96|l|-7.2|58.8
36|Kr|Kripton|Krypton|83.798|ng|[Ar] 3d10 4s2 4p6|3.00|g|-157.37|-153.42
37|Rb|Rubidyum|Rubidium|85.468|a|[Kr] 5s1|0.82|s|39.30|688
38|Sr|Stronsiyum|Strontium|87.62|ae|[Kr] 5s2|0.95|s|777|1377
39|Y|İtriyum|Yttrium|88.906|tm|[Kr] 4d1 5s2|1.22|s|1526|2930
40|Zr|Zirkonyum|Zirconium|91.224|tm|[Kr] 4d2 5s2|1.33|s|1855|4409
41|Nb|Niyobyum|Niobium|92.906|tm|[Kr] 4d4 5s1|1.6|s|2477|4744
42|Mo|Molibden|Molybdenum|95.95|tm|[Kr] 4d5 5s1|2.16|s|2623|4639
43|Tc|Teknesyum|Technetium|[98]|tm|[Kr] 4d5 5s2|1.9|s|2157|4265
44|Ru|Rutenyum|Ruthenium|101.07|tm|[Kr] 4d7 5s1|2.2|s|2334|4150
45|Rh|Rodyum|Rhodium|102.91|tm|[Kr] 4d8 5s1|2.28|s|1964|3695
46|Pd|Paladyum|Palladium|106.42|tm|[Kr] 4d10|2.20|s|1554.9|2963
47|Ag|Gümüş|Silver|107.87|tm|[Kr] 4d10 5s1|1.93|s|961.78|2162
48|Cd|Kadmiyum|Cadmium|112.41|tm|[Kr] 4d10 5s2|1.69|s|321.07|767
49|In|İndiyum|Indium|114.82|pt|[Kr] 4d10 5s2 5p1|1.78|s|156.60|2072
50|Sn|Kalay|Tin|118.71|pt|[Kr] 4d10 5s2 5p2|1.96|s|231.93|2602
51|Sb|Antimon|Antimony|121.76|md|[Kr] 4d10 5s2 5p3|2.05|s|630.63|1635
52|Te|Tellür|Tellurium|127.60|md|[Kr] 4d10 5s2 5p4|2.1|s|449.51|988
53|I|İyot|Iodine|126.90|h|[Kr] 4d10 5s2 5p5|2.66|s|113.7|184.3
54|Xe|Ksenon|Xenon|131.29|ng|[Kr] 4d10 5s2 5p6|2.6|g|-111.75|-108.1
55|Cs|Sezyum|Caesium|132.91|a|[Xe] 6s1|0.79|s|28.5|671
56|Ba|Baryum|Barium|137.33|ae|[Xe] 6s2|0.89|s|727|1897
57|La|Lantan|Lanthanum|138.91|la|[Xe] 5d1 6s2|1.10|s|920|3464
58|Ce|Seryum|Cerium|140.12|la|[Xe] 4f1 5d1 6s2|1.12|s|795|3443
59|Pr|Praseodim|Praseodymium|140.91|la|[Xe] 4f3 6s2|1.13|s|935|3520
60|Nd|Neodim|Neodymium|144.24|la|[Xe] 4f4 6s2|1.14|s|1024|3074
61|Pm|Prometyum|Promethium|[145]|la|[Xe] 4f5 6s2|1.13|s|1042|3000
62|Sm|Samaryum|Samarium|150.36|la|[Xe] 4f6 6s2|1.17|s|1072|1794
63|Eu|Evropiyum|Europium|151.96|la|[Xe] 4f7 6s2|1.2|s|826|1529
64|Gd|Gadolinyum|Gadolinium|157.25|la|[Xe] 4f7 5d1 6s2|1.20|s|1312|3273
65|Tb|Terbiyum|Terbium|158.93|la|[Xe] 4f9 6s2|1.2|s|1356|3230
66|Dy|Disprosyum|Dysprosium|162.50|la|[Xe] 4f10 6s2|1.22|s|1407|2562
67|Ho|Holmiyum|Holmium|164.93|la|[Xe] 4f11 6s2|1.23|s|1461|2720
68|Er|Erbiyum|Erbium|167.26|la|[Xe] 4f12 6s2|1.24|s|1529|2868
69|Tm|Tulyum|Thulium|168.93|la|[Xe] 4f13 6s2|1.25|s|1545|1950
70|Yb|İterbiyum|Ytterbium|173.05|la|[Xe] 4f14 6s2|1.1|s|824|1196
71|Lu|Lutesyum|Lutetium|174.97|la|[Xe] 4f14 5d1 6s2|1.27|s|1652|3402
72|Hf|Hafniyum|Hafnium|178.49|tm|[Xe] 4f14 5d2 6s2|1.3|s|2233|4603
73|Ta|Tantal|Tantalum|180.95|tm|[Xe] 4f14 5d3 6s2|1.5|s|3017|5458
74|W|Tungsten|Tungsten|183.84|tm|[Xe] 4f14 5d4 6s2|2.36|s|3422|5555
75|Re|Renyum|Rhenium|186.21|tm|[Xe] 4f14 5d5 6s2|1.9|s|3186|5596
76|Os|Osmiyum|Osmium|190.23|tm|[Xe] 4f14 5d6 6s2|2.2|s|3033|5012
77|Ir|İridyum|Iridium|192.22|tm|[Xe] 4f14 5d7 6s2|2.20|s|2446|4428
78|Pt|Platin|Platinum|195.08|tm|[Xe] 4f14 5d9 6s1|2.28|s|1768.3|3825
79|Au|Altın|Gold|196.97|tm|[Xe] 4f14 5d10 6s1|2.54|s|1064.18|2970
80|Hg|Cıva|Mercury|200.59|tm|[Xe] 4f14 5d10 6s2|2.00|l|-38.83|356.73
81|Tl|Talyum|Thallium|204.38|pt|[Xe] 4f14 5d10 6s2 6p1|1.62|s|304|1473
82|Pb|Kurşun|Lead|207.2|pt|[Xe] 4f14 5d10 6s2 6p2|2.33|s|327.46|1749
83|Bi|Bizmut|Bismuth|208.98|pt|[Xe] 4f14 5d10 6s2 6p3|2.02|s|271.4|1564
84|Po|Polonyum|Polonium|[209]|pt|[Xe] 4f14 5d10 6s2 6p4|2.0|s|254|962
85|At|Astatin|Astatine|[210]|h|[Xe] 4f14 5d10 6s2 6p5|2.2|s|302|
86|Rn|Radon|Radon|[222]|ng|[Xe] 4f14 5d10 6s2 6p6|2.2|g|-71|-61.7
87|Fr|Fransiyum|Francium|[223]|a|[Rn] 7s1|0.7|s||
88|Ra|Radyum|Radium|[226]|ae|[Rn] 7s2|0.9|s|700|1737
89|Ac|Aktinyum|Actinium|[227]|ac|[Rn] 6d1 7s2|1.1|s|1050|3200
90|Th|Toryum|Thorium|232.04|ac|[Rn] 6d2 7s2|1.3|s|1750|4788
91|Pa|Protaktinyum|Protactinium|231.04|ac|[Rn] 5f2 6d1 7s2|1.5|s|1568|
92|U|Uranyum|Uranium|238.03|ac|[Rn] 5f3 6d1 7s2|1.38|s|1132.2|4131
93|Np|Neptünyum|Neptunium|[237]|ac|[Rn] 5f4 6d1 7s2|1.36|s|639|
94|Pu|Plütonyum|Plutonium|[244]|ac|[Rn] 5f6 7s2|1.28|s|639.4|3228
95|Am|Amerikyum|Americium|[243]|ac|[Rn] 5f7 7s2|1.3|s|1176|
96|Cm|Küriyum|Curium|[247]|ac|[Rn] 5f7 6d1 7s2|1.28|s|1340|3110
97|Bk|Berkelyum|Berkelium|[247]|ac|[Rn] 5f9 7s2|1.3|s|986|
98|Cf|Kaliforniyum|Californium|[251]|ac|[Rn] 5f10 7s2|1.3|s|900|
99|Es|Aynştaynyum|Einsteinium|[252]|ac|[Rn] 5f11 7s2|1.3|s|860|
100|Fm|Fermiyum|Fermium|[257]|ac|[Rn] 5f12 7s2|1.3|u||
101|Md|Mendelevyum|Mendelevium|[258]|ac|[Rn] 5f13 7s2|1.3|u||
102|No|Nobelyum|Nobelium|[259]|ac|[Rn] 5f14 7s2|1.3|u||
103|Lr|Lavrensiyum|Lawrencium|[266]|ac|[Rn] 5f14 7s2 7p1||u||
104|Rf|Rutherfordiyum|Rutherfordium|[267]|tm|[Rn] 5f14 6d2 7s2||u||
105|Db|Dubniyum|Dubnium|[268]|tm|[Rn] 5f14 6d3 7s2||u||
106|Sg|Seaborgiyum|Seaborgium|[269]|tm|[Rn] 5f14 6d4 7s2||u||
107|Bh|Bohriyum|Bohrium|[270]|tm|[Rn] 5f14 6d5 7s2||u||
108|Hs|Hassiyum|Hassium|[269]|tm|[Rn] 5f14 6d6 7s2||u||
109|Mt|Meitneriyum|Meitnerium|[278]|un|[Rn] 5f14 6d7 7s2||u||
110|Ds|Darmstadtiyum|Darmstadtium|[281]|un|[Rn] 5f14 6d8 7s2||u||
111|Rg|Röntgenyum|Roentgenium|[282]|un|[Rn] 5f14 6d9 7s2||u||
112|Cn|Kopernikyum|Copernicium|[285]|un|[Rn] 5f14 6d10 7s2||u||
113|Nh|Nihonyum|Nihonium|[286]|un|[Rn] 5f14 6d10 7s2 7p1||u||
114|Fl|Flerovyum|Flerovium|[289]|un|[Rn] 5f14 6d10 7s2 7p2||u||
115|Mc|Moskovyum|Moscovium|[290]|un|[Rn] 5f14 6d10 7s2 7p3||u||
116|Lv|Livermoryum|Livermorium|[293]|un|[Rn] 5f14 6d10 7s2 7p4||u||
117|Ts|Tennesin|Tennessine|[294]|un|[Rn] 5f14 6d10 7s2 7p5||u||
118|Og|Oganesson|Oganesson|[294]|un|[Rn] 5f14 6d10 7s2 7p6||u||
`;

const num = (s) => (s === '' ? null : Number(s));

export const ELEMENTS = RAW.trim().split('\n').map((line) => {
  const [z, sym, tr, en, mass, cat, config, eneg, phase, mp, bp] = line.split('|');
  const sub = bp.endsWith('s');
  return {
    z: Number(z), sym, tr, en, mass, cat, config,
    eneg: num(eneg), phase, mp: num(mp), bp: num(sub ? bp.slice(0, -1) : bp), sublimes: sub,
    ...position(Number(z)),
  };
});

export const BY_SYMBOL = new Map(ELEMENTS.map((e) => [e.sym, e]));

// Tablodaki yer: grup (1-18, f bloğunda null), periyot, ızgara satırı/sütunu (f bloğu 9. ve 10. satırlar).
function position(z) {
  const starts = [1, 3, 11, 19, 37, 55, 87, 119];
  const period = starts.findIndex((s, i) => z >= s && z < starts[i + 1]) + 1;
  const off = z - starts[period - 1];
  let group = null;
  let row = period;
  let col;
  if (period === 1) group = z === 1 ? 1 : 18;
  else if (period <= 3) group = off < 2 ? off + 1 : off + 11;
  else if (period <= 5) group = off + 1;
  else if (off < 2) group = off + 1;
  else if (off <= 16) { row = period + 3; col = off + 1; } // La–Lu, Ac–Lr: 3.–17. sütunlar
  else group = off - 13;
  return { group, period, row, col: col ?? group };
}

// Elektron dizilimindeki her katmanın elektron sayısı: [K, L, M, ...]. Soy gaz kısaltması açılır.
export function shells(e) {
  const out = [];
  const core = e.config.match(/^\[(\w+)\]/);
  if (core) out.push(...shells(BY_SYMBOL.get(core[1])));
  for (const [, n, , c] of e.config.matchAll(/(\d)([spdf])(\d+)/g)) {
    while (out.length < n) out.push(0);
    out[n - 1] += Number(c);
  }
  return out;
}

// Dizilim kabuk sırasına göre yazıldığından (enerji sırasına göre değil) blok tablodaki yerden çıkarılır.
export function block(e) {
  if (e.row > 7) return 'f';
  if (e.group <= 2 || e.z === 2) return 's';
  return e.group >= 13 ? 'p' : 'd';
}
