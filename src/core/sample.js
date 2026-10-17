// Example data so a new user can see how the journal looks.
import { cleanPerson, cleanStory, newId } from './model.js';

const TEXT = {
  ru: {
    people: [
      { firstName: 'Кира', lastName: 'Смирнова', status: 'На связи', games: ['Dota 2', 'Deep Rock Galactic'], nicks: [{ game: 'Dota 2', nick: 'k1ra' }, { game: 'Deep Rock Galactic', nick: 'Kira the Driller' }], contacts: [{ label: 'Discord', value: 'k1ra.dev' }], note: 'Всегда берёт саппорта. Не любит, когда её зовут «Кирюха».', met: { text: 'Попалась в рандоме на пятой позиции и вытащила игру, которую все уже сдали. Я написал «го ещё», она ответила «го».', game: 'Dota 2', when: { kind: 'approx', year: 2019, season: 'autumn' } } },
      { firstName: 'Ваня', lastName: '', status: 'На связи', games: ['Deep Rock Galactic', 'Valheim'], nicks: [{ game: 'Deep Rock Galactic', nick: 'vanyok_dwarf' }], contacts: [{ label: 'Telegram', value: '@vanyok' }], note: 'Поёт в голосовом, когда нервничает.', met: { text: 'Одноклассник. Первым позвал в Deep Rock.', game: '', when: { kind: 'approx', year: 2018, season: null } } },
      { firstName: 'Лена', lastName: '', status: 'На связи', games: ['Minecraft', 'Valheim'], nicks: [{ game: 'Minecraft', nick: 'lenochka' }], contacts: [], note: 'Строит лучше всех на сервере.', met: { text: '', game: 'Minecraft', when: { kind: 'approx', year: 2020, season: 'summer' } } },
      { firstName: 'Мэтт', lastName: '', status: 'Потерялись', games: ['Lethal Company'], nicks: [{ game: 'Lethal Company', nick: 'mattgg' }], contacts: [{ label: 'Steam', value: 'https://steamcommunity.com/' }], note: 'Из Канады, по-русски знает одно слово.', met: { text: 'Попался в случайном лобби.', game: 'Lethal Company', when: { kind: 'approx', year: 2023, season: 'winter' } } },
      { firstName: 'Дэн', lastName: '', status: 'Потерялись', games: ['Minecraft'], nicks: [], contacts: [], note: 'Ушёл в армию в 2021, с тех пор пропал.', met: { text: '', game: '', when: null } }
    ],
    stories: [
      { title: 'Ночной рейд, который всех спас', text: 'Шёл второй час ночи, и мы взяли ещё одну миссию «на сон грядущий». Рой пришёл раньше, чем Ваня успел поставить турель.\n\nКира встала в проходе и держала дверь до последнего патрона, а Ваня в голосовом пел гимн гномов. До капсулы добежали за три секунды до взлёта.', game: 'Deep Rock Galactic', people: [0, 1], tags: ['эпик', 'кооп', 'ночь'], when: { kind: 'approx', year: 2021, season: 'spring' }, starred: true },
      { title: 'Как мы нашли Киру в рандоме', text: 'Она взяла пятую позицию и вытащила игру, которую все уже сдали. Через неделю мы играли каждый вечер.', game: 'Dota 2', people: [0], tags: ['знакомство'], when: { kind: 'approx', year: 2019, season: 'autumn' }, starred: true },
      { title: 'Мэтт не знал ни слова по-русски', text: 'Объяснялись жестами фонариком. Сосед Мэтта переводил через раз и всегда неправильно. К концу вечера Мэтт выучил слово «беги» и кричал его громче всех.', game: 'Lethal Company', people: [3], names: ['Сосед Мэтта'], randomPlayers: 2, tags: ['смешно', 'знакомство'], when: { kind: 'approx', year: 2023, season: 'winter' } },
      { title: 'Похоронили драккар с почестями', text: 'Корабль утонул в первом же шторме, вместе с железом за две недели. Лена сказала речь, Ваня сыграл на губной гармошке прямо в микрофон.', game: 'Valheim', people: [2, 1], tags: ['смешно', 'фейл'], when: { kind: 'exact', date: '2022-08-12' } },
      { title: 'Сервер, который мы строили полгода', text: 'Лена отвечала за замок, Дэн за фермы, я за дороги между ними. Дороги вышли кривые, зато их видно из космоса.', game: 'Minecraft', people: [2, 4], tags: ['кооп'], when: { kind: 'approx', year: 2020, season: null } },
      { title: 'Дэн уходит в армию', text: 'Последний вечер на сервере. Дэн поставил табличку у фермы: «вернусь, не трогайте коров». Коров никто не трогал.', game: 'Minecraft', people: [4, 2], tags: ['грустно'], when: { kind: 'approx', year: 2021, season: 'autumn' }, starred: true },
      { title: 'Новый год в шахте', text: 'Встретили полночь в пещере, под обвалом, с последней бутылкой из бара на станции. Ваня считал секунды вслух и сбился на семи.', game: 'Deep Rock Galactic', people: [0, 1], tags: ['праздник', 'кооп'], when: { kind: 'exact', date: '2023-12-31' } },
      { title: '40 минут на миде', text: 'Самая длинная катка года. Выиграли, когда у противника пропал интернет, и смеялись до утра.', game: 'Dota 2', people: [0], randomPlayers: 3, tags: ['эпик'], when: { kind: 'approx', year: 2020, season: 'summer' } }
    ]
  },
  en: {
    people: [
      { firstName: 'Kira', lastName: 'Smith', status: 'In touch', games: ['Dota 2', 'Deep Rock Galactic'], nicks: [{ game: 'Dota 2', nick: 'k1ra' }, { game: 'Deep Rock Galactic', nick: 'Kira the Driller' }], contacts: [{ label: 'Discord', value: 'k1ra.dev' }], note: 'Always plays support.', met: { text: 'Matched with her as position five. She carried a game everyone had given up on. I wrote "one more?", she wrote "sure".', game: 'Dota 2', when: { kind: 'approx', year: 2019, season: 'autumn' } } },
      { firstName: 'Vanya', lastName: '', status: 'In touch', games: ['Deep Rock Galactic', 'Valheim'], nicks: [{ game: 'Deep Rock Galactic', nick: 'vanyok_dwarf' }], contacts: [], note: 'Sings in voice chat when nervous.', met: { text: 'Classmate. First to invite me to Deep Rock.', game: '', when: { kind: 'approx', year: 2018, season: null } } },
      { firstName: 'Lena', lastName: '', status: 'In touch', games: ['Minecraft', 'Valheim'], nicks: [{ game: 'Minecraft', nick: 'lenochka' }], contacts: [], note: 'Best builder on the server.', met: { text: '', game: 'Minecraft', when: { kind: 'approx', year: 2020, season: 'summer' } } },
      { firstName: 'Matt', lastName: '', status: 'Lost touch', games: ['Lethal Company'], nicks: [{ game: 'Lethal Company', nick: 'mattgg' }], contacts: [], note: 'From Canada.', met: { text: 'Random lobby.', game: 'Lethal Company', when: { kind: 'approx', year: 2023, season: 'winter' } } },
      { firstName: 'Dan', lastName: '', status: 'Lost touch', games: ['Minecraft'], nicks: [], contacts: [], note: '', met: { text: '', game: '', when: null } }
    ],
    stories: [
      { title: 'The night raid that saved everyone', text: 'It was past one in the morning and we took one more mission. The swarm came before Vanya could place the turret.\n\nKira held the door until her last bullet while Vanya sang the dwarf anthem in voice chat. We reached the pod three seconds before launch.', game: 'Deep Rock Galactic', people: [0, 1], tags: ['epic', 'coop', 'night'], when: { kind: 'approx', year: 2021, season: 'spring' }, starred: true },
      { title: 'How we found Kira in matchmaking', text: 'She played position five and carried a lost game. A week later we were playing every evening.', game: 'Dota 2', people: [0], tags: ['first meeting'], when: { kind: 'approx', year: 2019, season: 'autumn' }, starred: true },
      { title: 'Matt spoke no Russian at all', text: 'We talked with flashlight signals. By the end of the night Matt learned the word for "run" and shouted it louder than anyone.', game: 'Lethal Company', people: [3], names: ["Matt's neighbour"], randomPlayers: 2, tags: ['funny'], when: { kind: 'approx', year: 2023, season: 'winter' } },
      { title: 'A proper funeral for the longship', text: 'The ship sank in the first storm with two weeks of iron. Lena gave a speech, Vanya played harmonica into the mic.', game: 'Valheim', people: [2, 1], tags: ['funny', 'fail'], when: { kind: 'exact', date: '2022-08-12' } },
      { title: 'The server we built for half a year', text: 'Lena did the castle, Dan the farms, I did the roads. The roads came out crooked, but you can see them from space.', game: 'Minecraft', people: [2, 4], tags: ['coop'], when: { kind: 'approx', year: 2020, season: null } },
      { title: 'Dan leaves for the army', text: 'Last evening on the server. Dan put a sign by the farm: "back soon, do not touch the cows". Nobody touched the cows.', game: 'Minecraft', people: [4, 2], tags: ['sad'], when: { kind: 'approx', year: 2021, season: 'autumn' }, starred: true },
      { title: 'New Year in the mine', text: 'We met midnight in a cave under a collapse, with the last drink from the station bar. Vanya counted down out loud and lost track at seven.', game: 'Deep Rock Galactic', people: [0, 1], tags: ['holiday', 'coop'], when: { kind: 'exact', date: '2023-12-31' } },
      { title: '40 minutes in mid', text: 'Longest game of the year. We won when the other team lost internet and laughed until morning.', game: 'Dota 2', people: [0], randomPlayers: 3, tags: ['epic'], when: { kind: 'approx', year: 2020, season: 'summer' } }
    ]
  }
};

// Other languages reuse the English example and replace only the words.
// People: [status, note, how you met]. Stories: [title, text, tags, plain names].
const WORDS = {
  es: {
    people: [
      ['En contacto', 'Siempre va de support.', 'Me tocó con ella en una partida, iba de posición cinco. Salvó una partida que todos daban por perdida. Le escribí «¿otra?», me contestó «va».'],
      ['En contacto', 'Canta en el chat de voz cuando se pone nervioso.', 'Compañero de clase. Fue el primero en invitarme a Deep Rock.'],
      ['En contacto', 'La que mejor construye del servidor.', ''],
      ['Perdimos el contacto', 'Es de Canadá.', 'Lobby aleatorio.'],
      ['Perdimos el contacto', '', '']
    ],
    stories: [
      ['La incursión nocturna que nos salvó a todos', 'Era más de la una de la madrugada y aceptamos una misión más. El enjambre llegó antes de que Vanya pudiera poner la torreta.\n\nKira aguantó la puerta hasta la última bala mientras Vanya cantaba el himno de los enanos por el chat de voz. Llegamos a la cápsula tres segundos antes del despegue.', ['épico', 'coop', 'noche']],
      ['Cómo encontramos a Kira en una partida', 'Jugó de posición cinco y remontó una partida perdida. Una semana después jugábamos juntos cada noche.', ['primer encuentro']],
      ['Matt no sabía ni una palabra de ruso', 'Nos entendíamos con señales de linterna. Al final de la noche Matt aprendió a decir «corre» en ruso y lo gritaba más fuerte que nadie.', ['divertido'], ['El vecino de Matt']],
      ['Un funeral digno para el drakkar', 'El barco se hundió en la primera tormenta con dos semanas de hierro dentro. Lena dio un discurso y Vanya tocó la armónica por el micro.', ['divertido', 'fail']],
      ['El servidor que construimos durante medio año', 'Lena hizo el castillo, Dan las granjas y yo los caminos. Los caminos quedaron torcidos, pero se ven desde el espacio.', ['coop']],
      ['Dan se va al servicio militar', 'Última noche en el servidor. Dan puso un cartel junto a la granja: «vuelvo pronto, que nadie toque las vacas». Nadie tocó las vacas.', ['triste']],
      ['Año Nuevo en la mina', 'Recibimos la medianoche en una cueva, bajo un derrumbe, con la última bebida del bar de la estación. Vanya contaba en voz alta y se perdió en el siete.', ['fiesta', 'coop']],
      ['40 minutos en mid', 'La partida más larga del año. Ganamos cuando al otro equipo se le cayó internet y nos reímos hasta el amanecer.', ['épico']]
    ]
  },
  pt: {
    people: [
      ['Em contato', 'Sempre joga de suporte.', 'Caiu comigo numa partida, de posição cinco. Virou um jogo que todo mundo já tinha dado como perdido. Mandei “mais uma?”, ela respondeu “bora”.'],
      ['Em contato', 'Canta no chat de voz quando fica nervoso.', 'Colega de escola. Foi o primeiro a me chamar para o Deep Rock.'],
      ['Em contato', 'A melhor construtora do servidor.', ''],
      ['Perdemos contato', 'É do Canadá.', 'Lobby aleatório.'],
      ['Perdemos contato', '', '']
    ],
    stories: [
      ['A invasão da madrugada que salvou todo mundo', 'Já passava da uma da manhã e pegamos mais uma missão. O enxame chegou antes de o Vanya conseguir montar a torreta.\n\nA Kira segurou a porta até a última bala enquanto o Vanya cantava o hino dos anões no chat de voz. Chegamos na cápsula três segundos antes da decolagem.', ['épico', 'coop', 'madrugada']],
      ['Como achamos a Kira numa partida', 'Ela jogou de posição cinco e virou uma partida perdida. Uma semana depois a gente jogava junto toda noite.', ['primeiro encontro']],
      ['O Matt não falava nada de russo', 'A gente se comunicava piscando a lanterna. No fim da noite o Matt aprendeu a dizer “corre” em russo e gritava mais alto que todo mundo.', ['engraçado'], ['O vizinho do Matt']],
      ['Um enterro digno para o drakkar', 'O barco afundou na primeira tempestade com duas semanas de ferro dentro. A Lena fez um discurso e o Vanya tocou gaita no microfone.', ['engraçado', 'fail']],
      ['O servidor que construímos por meio ano', 'A Lena fez o castelo, o Dan as fazendas e eu as estradas. As estradas ficaram tortas, mas dá para ver do espaço.', ['coop']],
      ['O Dan vai para o exército', 'Última noite no servidor. O Dan deixou uma placa na fazenda: “volto logo, não mexam nas vacas”. Ninguém mexeu nas vacas.', ['triste']],
      ['Ano-novo na mina', 'Viramos a meia-noite numa caverna, debaixo de um desabamento, com a última bebida do bar da estação. O Vanya contava em voz alta e se perdeu no sete.', ['festa', 'coop']],
      ['40 minutos no mid', 'A partida mais longa do ano. Ganhamos quando a internet do outro time caiu e rimos até de manhã.', ['épico']]
    ]
  },
  de: {
    people: [
      ['In Kontakt', 'Spielt immer Support.', 'Wurde mir als Position fünf zugelost. Hat ein Spiel gedreht, das alle schon aufgegeben hatten. Ich schrieb „noch eine?“, sie schrieb „klar“.'],
      ['In Kontakt', 'Singt im Voice-Chat, wenn er nervös ist.', 'Klassenkamerad. Hat mich als Erster zu Deep Rock eingeladen.'],
      ['In Kontakt', 'Baut am besten auf dem ganzen Server.', ''],
      ['Aus den Augen verloren', 'Kommt aus Kanada.', 'Zufällige Lobby.'],
      ['Aus den Augen verloren', '', '']
    ],
    stories: [
      ['Der Nachtangriff, der uns alle gerettet hat', 'Es war schon nach eins, und wir haben noch eine Mission angenommen. Der Schwarm kam, bevor Vanya den Geschützturm aufstellen konnte.\n\nKira hat die Tür bis zur letzten Kugel gehalten, während Vanya im Voice-Chat die Zwergenhymne gesungen hat. Wir waren drei Sekunden vor dem Start an der Kapsel.', ['episch', 'koop', 'nachts']],
      ['Wie wir Kira im Matchmaking gefunden haben', 'Sie spielte Position fünf und hat ein verlorenes Spiel gedreht. Eine Woche später haben wir jeden Abend zusammen gezockt.', ['kennenlernen']],
      ['Matt konnte kein Wort Russisch', 'Wir haben uns mit Taschenlampen-Signalen verständigt. Am Ende des Abends konnte Matt „lauf“ auf Russisch und hat es lauter gerufen als alle anderen.', ['lustig'], ['Matts Nachbar']],
      ['Ein würdiges Begräbnis für das Langschiff', 'Das Schiff ist im ersten Sturm gesunken, mit dem Eisen von zwei Wochen an Bord. Lena hat eine Rede gehalten, Vanya hat ins Mikro Mundharmonika gespielt.', ['lustig', 'fail']],
      ['Der Server, an dem wir ein halbes Jahr gebaut haben', 'Lena hat die Burg gebaut, Dan die Farmen und ich die Straßen. Die Straßen sind schief geworden, aber man sieht sie aus dem Weltall.', ['koop']],
      ['Dan geht zur Armee', 'Der letzte Abend auf dem Server. Dan hat ein Schild an die Farm gestellt: „bin bald zurück, lasst die Kühe in Ruhe“. Niemand hat die Kühe angerührt.', ['traurig']],
      ['Silvester in der Mine', 'Wir haben Mitternacht in einer Höhle unter einem Einsturz erlebt, mit dem letzten Drink aus der Stationsbar. Vanya hat laut runtergezählt und sich bei sieben verzählt.', ['feiertag', 'koop']],
      ['40 Minuten auf Mid', 'Das längste Spiel des Jahres. Gewonnen haben wir, als beim anderen Team das Internet ausfiel, und dann bis zum Morgen gelacht.', ['episch']]
    ]
  },
  fr: {
    people: [
      ['En contact', 'Joue toujours support.', 'Tombée avec moi en partie, en position cinq. Elle a retourné une partie que tout le monde avait abandonnée. J’ai écrit «\u00a0on en refait une\u00a0?\u00a0», elle a répondu «\u00a0vas-y\u00a0».'],
      ['En contact', 'Chante dans le vocal quand il stresse.', 'Camarade de classe. Le premier à m’inviter sur Deep Rock.'],
      ['En contact', 'La meilleure bâtisseuse du serveur.', ''],
      ['Perdu de vue', 'Vient du Canada.', 'Lobby au hasard.'],
      ['Perdu de vue', '', '']
    ],
    stories: [
      ['Le raid de nuit qui nous a tous sauvés', 'Il était plus d’une heure du matin et on a lancé une mission de plus. La nuée est arrivée avant que Vanya ait posé la tourelle.\n\nKira a tenu la porte jusqu’à sa dernière balle pendant que Vanya chantait l’hymne des nains dans le vocal. On a atteint la capsule trois secondes avant le décollage.', ['épique', 'coop', 'nuit']],
      ['Comment on a trouvé Kira en partie rapide', 'Elle jouait position cinq et a retourné une partie perdue. Une semaine plus tard, on jouait ensemble tous les soirs.', ['rencontre']],
      ['Matt ne parlait pas un mot de russe', 'On communiquait avec des signaux de lampe torche. À la fin de la soirée, Matt savait dire «\u00a0cours\u00a0» en russe et le criait plus fort que tout le monde.', ['drôle'], ['Le voisin de Matt']],
      ['Des funérailles dignes pour le drakkar', 'Le bateau a coulé dans la première tempête avec deux semaines de fer à bord. Lena a fait un discours, Vanya a joué de l’harmonica dans le micro.', ['drôle', 'fail']],
      ['Le serveur qu’on a bâti pendant six mois', 'Lena s’est occupée du château, Dan des fermes et moi des routes. Les routes sont tordues, mais on les voit depuis l’espace.', ['coop']],
      ['Dan part à l’armée', 'Dernière soirée sur le serveur. Dan a planté un panneau près de la ferme\u00a0: «\u00a0je reviens vite, ne touchez pas aux vaches\u00a0». Personne n’a touché aux vaches.', ['triste']],
      ['Le Nouvel An dans la mine', 'On a passé minuit dans une grotte, sous un éboulement, avec le dernier verre du bar de la station. Vanya comptait à voix haute et s’est perdu à sept.', ['fête', 'coop']],
      ['40 minutes en mid', 'La partie la plus longue de l’année. On a gagné quand l’équipe d’en face a perdu internet, et on a ri jusqu’au matin.', ['épique']]
    ]
  }
};

function translated(lang) {
  const words = WORDS[lang];
  if (!words) return TEXT[lang] || TEXT.en;
  const base = TEXT.en;
  return {
    people: base.people.map((person, i) => {
      const [status, note, met] = words.people[i];
      return { ...person, status, note, met: { ...person.met, text: met } };
    }),
    stories: base.stories.map((story, i) => {
      const [title, text, tags, names] = words.stories[i];
      return { ...story, title, text, tags, ...(names ? { names } : {}) };
    })
  };
}

export function sampleData(lang) {
  const source = translated(lang);
  const people = source.people.map(p => cleanPerson({ ...p, id: newId() }));
  const stories = source.stories.map(s => cleanStory({
    ...s,
    id: newId(),
    people: s.people.map(index => people[index].id)
  }));
  return { people, stories };
}
