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

export function sampleData(lang) {
  const source = TEXT[lang] || TEXT.en;
  const people = source.people.map(p => cleanPerson({ ...p, id: newId() }));
  const stories = source.stories.map(s => cleanStory({
    ...s,
    id: newId(),
    people: s.people.map(index => people[index].id)
  }));
  return { people, stories };
}
