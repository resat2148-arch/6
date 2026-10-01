# Republic Rising

Klasik tarayıcı siyaset-savaş oyunlarından esinlenen, **CrazyGames** için hazırlanmış hızlı tempolu bir siyaset + savaş strateji oyunu.
Çalış, antrenman yap, savaş; şirket kur, seçim kazan, ülkeni dünya hâkimiyetine taşı.

- Tamamen HTML5 + saf JavaScript (ES modülleri), **derleme adımı yok**, harici görsel/ses dosyası yok (ilk yükleme ~100 KB).
- Masaüstü ve mobil (dokunmatik) uyumlu.
- CrazyGames SDK v3 entegre: reklamlar, gameplay sinyalleri, happytime, bulut kayıt.
- Açılış menüsünde 3 kariyer yuvası: 3 ayrı vatandaş tut, istediğinden devam et.

Tasarım ayrıntıları ve CrazyGames uyarlama kararları: [`docs/GDD.md`](docs/GDD.md)

## Çalıştırma

```bash
npm start          # http://localhost:8080 (http-server gerekir: npm i -g http-server)
# veya
python3 -m http.server 8080
```

> ES modülleri kullandığı için `index.html` dosyasını doğrudan `file://` ile açmak çalışmaz; bir yerel sunucu gerekir.

## Test

```bash
npm test           # oyun kuralları için Node testleri (dünya, ekonomi, savaş, seçimler, kayıt)
```

## CrazyGames'e yükleme

```bash
npm run build      # dist/republic-rising.zip
```

Zip dosyasını CrazyGames Developer Portal → *Submit game* → *HTML5* olarak yükleyin. Portalın önizleme aracında SDK otomatik olarak `crazygames` ortamında çalışır.

## Dosya yapısı

| Dosya | İçerik |
|---|---|
| `index.html`, `css/style.css` | Arayüz iskeleti ve stil |
| `js/data.js` | Tüm denge değerleri, ülkeler, rütbeler, madalyalar, görevler |
| `js/game.js` | Oyun kuralları (DOM'suz, test edilebilir): enerji, iş, antrenman, şirketler, pazar, siyaset, savaş, yapay zekâ |
| `js/world.js` | Avrupa haritası mantığı: komşuluk, kaynak bonusları |
| `js/europe.js` | **Üretilen** harita verisi (ülkeler, bölgeler, SVG yolları). Yeniden üretmek için: `node scripts/build-map.mjs` |
| `store/` | CrazyGames mağaza sayfası metinleri (`crazygames-listing.md`) ve pazarlama kiti (`marketing/`: kapaklar ve logo `node scripts/build-covers.mjs`, önizleme videoları ve ekran görüntüleri `node scripts/build-preview-videos.mjs` ile üretilir) |
| `scripts/build-icon-font.py` | Windows 10'da eksik emojiler (🪙 🪖 🪨 🛖) için renkli simge yazı tipini üretip `css/style.css` içine gömer (`pip install fonttools`) |
| `js/citizens.js` | Yapay zekâ vatandaşları: çalışma, antrenman, savaş, üretim, alışveriş, yatırım |
| `js/market.js` | İlan tahtası pazarı (alış, ilan verme, ithalat, tüccar) |
| `js/names.js` | Ülkelere göre isim havuzları |
| `js/elections.js` | Yapay zekâ adaylı Kongre ve başkanlık seçimleri |
| `js/press.js` | Vatandaş gazeteleri, makale başlıkları, okur oyları |
| `js/battle.js` | Canvas savaş mini oyunu |
| `js/ui.js` | Sekme ekranları (Home + Avrupa haritası, War, Economy, Market, Politics, Citizens, Medals) |
| `js/battle.js` / `js/battle-art.js` | Savaş ekranı: oyun mantığı ve efektler / kodla çizilen modern çatışma sahnesi, askerler, karabina |
| `js/storage.js` | 3 kariyer yuvası; her yuva için katmanlı kayıt: cihaz + yedek + bulut (CrazyGames data / önizleme db), yedek kodu |
| `js/sdk.js` | CrazyGames SDK sarmalayıcısı (SDK yoksa güvenli geri dönüş) |
| `js/sfx.js` | WebAudio ile üretilen ses efektleri |
| `js/main.js` | Açılış, kayıt/yükleme, eylem yönlendirme, reklam akışı |
