# Orbital Conflict

Tahová 3D dělostřelecká hra v JavaScriptu pro dva hráče na jednom počítači. Three.js vykresluje planety, kanóny, trajektorie a destrukci. Fyzika i pravidla hry jsou samostatný modul bez závislosti na vykreslování.

## Spuštění

Vyžaduje Node.js 20.19+ nebo 22.12+ a prohlížeč s WebGL 2 a hardwarovou akcelerací.

```sh
npm install
npm run dev
```

Otevři adresu, kterou vypíše Vite (standardně http://127.0.0.1:5173).

```sh
npm test          # testy herních pravidel a fyziky
npm run build    # hotová aplikace v dist/
npm run preview  # náhled sestavené aplikace
```

Obsah `dist/` lze nasadit na libovolný statický HTTP server. Hra nepotřebuje serverovou logiku ani účty. Zápas se automaticky ukládá do localStorage tohoto prohlížeče.

Sestavení vytváří také **`dist/OrbitalConflict.html`**: samostatný soubor obsahující hru, 3D knihovnu, styly i písma. Stačí jej otevřít dvojklikem v moderním prohlížeči; nepotřebuje Node.js, webový server ani připojení k internetu. Dostupnost automatického ukládání při otevření přes `file://` závisí na prohlížeči.

## Ovládání a pravidla

- Vše se ovládá myší. Levé kliknutí vybere planetu nebo směr střelby. Levé tažení současně nastavuje směr a sílu (dál od kanónu = větší síla); uvolnění tlačítka pouze dokončí míření, vystřeluje se tlačítkem v panelu. Pouze pravé tažení otáčí a naklání mapu od téměř kolmého pohledu až do 82° od svislice, kolečko přibližuje. Pohled lze obnovit tlačítkem v mapě.
- Hráč 1 vybírá z osmi okrajových planet. Hráč 2 má na výběr pouze protější planety s úhlovým odstupem alespoň přibližně 129°.
- Každý má 100 životů a 100 kreditů. Po odehrání obou tahů dostanou oba dalších 100 kreditů. Neutracené prostředky se převádějí.
- Levým tažením do mapy nastav směr i sílu, posuvníky umožňují přesné doladění. Rozsah rychlostí je jemnější: 10–100 % odpovídá 9,05–18,5 herních jednotek/s. Základní kinetická střela je zdarma a bez omezení.
- Každá živá planeta, asteroid i kanón působí na projektil gravitací. Planetární přitažlivost ve větší vzdálenosti klesá přibližně jako 1 / vzdálenost^1,5, takže je zakřivení významné i dál od povrchu. Náhled ukazuje první 1,1 sekundy letu; výzkum navigace odemkne celou dráhu. Náhled i výstřel používají stejnou integraci s krokem 1/120 s.
- Arzenál nabízí plazmu, průbojník, trojitou salvu, Novu, opravy, štíty a přetížení. Munice se kupuje po výstřelech a před střelbou se vybavuje. Vybavení se aktivuje ihned.
- Bod výzkumu stojí 25 kreditů. Výzkumný strom má závislosti a je samostatný pro každého hráče. Odemknutí trvá do konce aktuálního zápasu; zbraně a vybavení je potom potřeba zvlášť koupit.
- Každý zásah vykousne kráter do skutečné geometrie tělesa; další projektily se mohou pohybovat vyhloubeným prostorem. Hmotnost se průběžně snižuje s integritou podle (zbývající integrita / původní integrita)^1,15, tedy mírně rychleji než integrita, i u velkých planet. Krátery a zbylá hmotnost se ukládají se zápasem. Zásah domovské planety poškodí planetu i hráče. Štít absorbuje škody před životy. Exploze mohou poškodit i více těles nebo střelce.
- Zničené těleso okamžitě přestane působit gravitací, což ovlivní i další projektily právě letící salvy. Po zničení domovské planety zůstane na jejím místě malá zasažitelná orbitální stanice s kanónem.
- Výstřel ukončuje tah. Další hráč je ihned na tahu bez potvrzovacího okna; jeho barva a jméno jsou výrazně označené v mapě, velitelském panelu i u základny. Vítězí poslední hráč s nenulovými životy; současné zničení znamená remízu.

## Struktura

- `src/game.js` – deterministická mapa, ekonomika, výzkum, kolize, gravitace, poškození a ukládání.
- `src/scene.js` – Three.js scéna, procedurální textury, kamera, výběr objektů a efekty.
- `src/main.js` – české rozhraní, hot seat, ovládání a propojení modelu s vykreslováním.
- `tests/game.test.js` – testy klíčových pravidel v Node.js.

Planety jsou záměrně nehybné; gravitace ovlivňuje střely, nikoliv vzájemnou polohu těles. Herní jednotky jsou stylizované pro taktickou hratelnost. Zvuk je ve výchozím stavu vypnutý, zapíná se tlačítkem v horní liště.
