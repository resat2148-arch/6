// Name pools for AI citizens: [first names (5 male, then 5 female), surnames] per country.
const P = {
  PT: ['João,José,António,Pedro,Rui,Ana,Maria,Inês,Beatriz,Sofia', 'Silva,Santos,Ferreira,Pereira,Costa,Oliveira,Rodrigues,Martins'],
  ES: ['Antonio,Manuel,José,Javier,Carlos,Lucía,María,Carmen,Laura,Elena', 'García,López,Martínez,Sánchez,Pérez,Gómez,Fernández,Ruiz'],
  FR: ['Jean,Pierre,Louis,Lucas,Hugo,Marie,Camille,Léa,Chloé,Manon', 'Martin,Bernard,Dubois,Durand,Lefebvre,Moreau,Laurent,Girard'],
  GB: ['James,Oliver,Harry,George,Jack,Emily,Olivia,Amelia,Sophie,Grace', 'Smith,Jones,Taylor,Brown,Wilson,Evans,Walker,Wright'],
  IE: ['Seán,Conor,Patrick,Liam,Cian,Aoife,Siobhán,Niamh,Ciara,Saoirse', "Murphy,Kelly,Byrne,Ryan,Walsh,O'Brien,Doyle,McCarthy"],
  BE: ['Lucas,Arthur,Louis,Noah,Liam,Emma,Olivia,Louise,Elise,Marie', 'Peeters,Janssens,Maes,Jacobs,Mertens,Willems,Claes,Dubois'],
  NL: ['Daan,Sem,Lucas,Bram,Jesse,Emma,Julia,Sophie,Tess,Anna', 'de Jong,Jansen,de Vries,van Dijk,Bakker,Visser,Smit,Meijer'],
  DE: ['Lukas,Maximilian,Felix,Jonas,Paul,Anna,Lena,Laura,Sophie,Marie', 'Müller,Schmidt,Schneider,Fischer,Weber,Meyer,Wagner,Becker'],
  CH: ['Luca,Noah,Leon,Nico,Jan,Mia,Lea,Laura,Sara,Nina', 'Müller,Meier,Schmid,Keller,Weber,Huber,Favre,Rossi'],
  AT: ['Lukas,Tobias,Florian,David,Simon,Anna,Katharina,Julia,Lisa,Hannah', 'Gruber,Huber,Bauer,Wagner,Pichler,Steiner,Moser,Mayer'],
  IT: ['Marco,Luca,Giuseppe,Alessandro,Matteo,Giulia,Francesca,Chiara,Sara,Martina', 'Rossi,Russo,Ferrari,Esposito,Bianchi,Romano,Colombo,Ricci'],
  DK: ['Mikkel,Frederik,Rasmus,Mads,Emil,Sofie,Freja,Ida,Emma,Anna', 'Nielsen,Jensen,Hansen,Pedersen,Andersen,Christensen,Larsen,Sørensen'],
  NO: ['Ole,Lars,Magnus,Henrik,Jonas,Ingrid,Nora,Emma,Kari,Sofie', 'Hansen,Johansen,Olsen,Larsen,Andersen,Pedersen,Nilsen,Berg'],
  SE: ['Erik,Lars,Karl,Johan,Oscar,Anna,Maja,Elsa,Astrid,Linnea', 'Andersson,Johansson,Karlsson,Nilsson,Eriksson,Larsson,Olsson,Lindberg'],
  FI: ['Juhani,Mikko,Matti,Antti,Ville,Aino,Emilia,Sanna,Laura,Helmi', 'Korhonen,Virtanen,Mäkinen,Nieminen,Mäkelä,Hämäläinen,Laine,Heikkinen'],
  EE: ['Martin,Rasmus,Karl,Markus,Andres,Maria,Liis,Kristiina,Anna,Laura', 'Tamm,Saar,Sepp,Mägi,Kask,Kukk,Rebane,Ilves'],
  LV: ['Jānis,Andris,Māris,Kārlis,Roberts,Anna,Līga,Laura,Ilze,Kristīne', 'Bērziņš,Kalniņš,Ozoliņš,Jansons,Liepiņš,Krūmiņš,Balodis,Eglītis'],
  LT: ['Jonas,Lukas,Mantas,Tomas,Darius,Emilija,Gabija,Ieva,Rūta,Austėja', 'Kazlauskas,Jankauskas,Petrauskas,Stankevičius,Vasiliauskas,Žukauskas,Butkus,Paulauskas'],
  PL: ['Jakub,Kacper,Piotr,Tomasz,Michał,Anna,Zofia,Julia,Katarzyna,Maja', 'Nowak,Kowalski,Wiśniewski,Wójcik,Kowalczyk,Kamiński,Lewandowski,Zieliński'],
  CZ: ['Jan,Jakub,Tomáš,Petr,Lukáš,Tereza,Eliška,Anna,Klára,Veronika', 'Novák,Svoboda,Novotný,Dvořák,Černý,Procházka,Kučera,Veselý'],
  SK: ['Martin,Peter,Tomáš,Marek,Michal,Zuzana,Katarína,Lucia,Jana,Mária', 'Horváth,Kováč,Varga,Tóth,Nagy,Baláž,Szabó,Molnár'],
  HU: ['Bence,Máté,Levente,Dániel,Ádám,Anna,Hanna,Zsófia,Réka,Eszter', 'Nagy,Kovács,Tóth,Szabó,Horváth,Varga,Kiss,Molnár'],
  SI: ['Luka,Jan,Nejc,Žiga,Matej,Nika,Eva,Maja,Ana,Sara', 'Novak,Horvat,Krajnc,Kovačič,Zupančič,Potočnik,Kovač,Mlakar'],
  HR: ['Luka,Ivan,Marko,Josip,Petar,Ana,Ivana,Marija,Petra,Lucija', 'Horvat,Kovačević,Babić,Marić,Jurić,Novak,Knežević,Vuković'],
  BA: ['Amar,Adnan,Emir,Haris,Tarik,Lejla,Amra,Emina,Sara,Ajla', 'Hodžić,Hadžić,Begić,Delić,Kovačević,Mehić,Šehić,Jovanović'],
  RS: ['Nikola,Luka,Stefan,Marko,Milan,Milica,Jelena,Ana,Teodora,Sara', 'Jovanović,Petrović,Nikolić,Marković,Đorđević,Stojanović,Ilić,Pavlović'],
  ME: ['Marko,Luka,Nikola,Stefan,Petar,Milica,Ana,Jovana,Marija,Tijana', 'Popović,Vujović,Radulović,Vuković,Perović,Kovačević,Šćepanović,Bulatović'],
  MK: ['Aleksandar,Nikola,Stefan,Filip,Dimitar,Elena,Marija,Ana,Ivana,Sara', 'Stojanovski,Nikolovski,Trajkovski,Petrovski,Jovanovski,Georgievski,Dimitrovski,Ristovski'],
  AL: ['Arben,Besnik,Endrit,Klajdi,Erion,Ana,Elira,Jonida,Klea,Megi', 'Hoxha,Shehu,Leka,Krasniqi,Gashi,Berisha,Kola,Dervishi'],
  GR: ['Giorgos,Dimitris,Nikos,Kostas,Giannis,Maria,Eleni,Katerina,Sofia,Anna', 'Papadopoulos,Papadakis,Georgiou,Nikolaidis,Oikonomou,Vlachos,Karagiannis,Dimitriou'],
  BG: ['Georgi,Ivan,Dimitar,Nikolay,Petar,Maria,Ivana,Elena,Desislava,Yana', 'Ivanov,Georgiev,Dimitrov,Petrov,Nikolov,Todorov,Stoyanov,Kolev'],
  RO: ['Andrei,Alexandru,Mihai,Ionuț,Ștefan,Maria,Elena,Ioana,Andreea,Ana', 'Popescu,Ionescu,Popa,Radu,Dumitru,Stan,Stoica,Munteanu'],
  MD: ['Ion,Vasile,Andrei,Mihai,Victor,Ana,Maria,Elena,Cristina,Natalia', 'Rusu,Ceban,Ciobanu,Lupu,Țurcanu,Cojocaru,Munteanu,Rotaru'],
  UA: ['Oleksandr,Andriy,Dmytro,Serhiy,Taras,Olena,Kateryna,Iryna,Oksana,Natalia', 'Shevchenko,Kovalenko,Bondarenko,Tkachenko,Kravchenko,Melnyk,Boyko,Moroz'],
  BY: ['Aliaksandr,Siarhei,Dzmitry,Andrei,Pavel,Volha,Nasta,Hanna,Iryna,Alena', 'Ivanou,Kazlou,Novik,Kavaliou,Lukashevich,Marozau,Bandarenka,Karpovich'],
  RU: ['Ivan,Dmitry,Alexei,Sergei,Nikolai,Anna,Olga,Natalia,Elena,Tatiana', 'Ivanov,Smirnov,Kuznetsov,Popov,Sokolov,Volkov,Morozov,Petrov'],
  TR: ['Mehmet,Mustafa,Ahmet,Emre,Burak,Zeynep,Elif,Ayşe,Merve,Esra', 'Yılmaz,Kaya,Demir,Şahin,Çelik,Yıldız,Aydın,Öztürk'],
};

// Female surname forms where the language changes them.
function feminine(c, last) {
  if ((c === 'RU' || c === 'BG') && /(ov|ev|in)$/.test(last)) return last + 'a';
  if ((c === 'PL' || c === 'MK') && last.endsWith('ski')) return last.slice(0, -1) + 'a';
  if (c === 'GR' && last.endsWith('os')) return last.slice(0, -2) + 'ou';
  if (c === 'GR' && last.endsWith('is')) return last.slice(0, -1);
  if (c === 'CZ' && last.endsWith('ý')) return last.slice(0, -1) + 'á';
  if (c === 'CZ' && /[kr]$/.test(last)) return last.replace(/á(?=[kr]$)/, 'á') + 'ová';
  return last;
}

export function citizenName(c, rnd) {
  const [f, l] = (P[c] || P.GB).map((x) => x.split(','));
  const i = Math.floor(rnd() * f.length);
  const female = i >= 5;
  const last = l[Math.floor(rnd() * l.length)];
  return { name: `${f[i]} ${female ? feminine(c, last) : last}`, female };
}
