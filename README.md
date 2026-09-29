# Republic Rising

[eRepublik](https://www.erepublik.com)'ten esinlenen, **CrazyGames** için hazırlanmış hızlı tempolu bir siyaset + savaş strateji oyunu.
Çalış, antrenman yap, savaş; şirket kur, seçim kazan, ülkeni dünya hâkimiyetine taşı.

- Tamamen HTML5 + saf JavaScript (ES modülleri), **derleme adımı yok**, harici görsel/ses dosyası yok (ilk yükleme ~100 KB).
- Masaüstü ve mobil (dokunmatik) uyumlu.
- CrazyGames SDK v3 entegre: reklamlar, gameplay sinyalleri, happytime, bulut kayıt.

Tasarım ayrıntıları ve eRepublik → CrazyGames uyarlama kararları: [`docs/GDD.md`](docs/GDD.md)

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
| `js/world.js` | Altıgen harita, komşuluk, kaynak bonusları |
| `js/battle.js` | Canvas savaş mini oyunu |
| `js/ui.js` | Sekme ekranları (Home, War, Map, Economy, Market, Politics, Medals) |
| `js/sdk.js` | CrazyGames SDK sarmalayıcısı (SDK yoksa güvenli geri dönüş) |
| `js/sfx.js` | WebAudio ile üretilen ses efektleri |
| `js/main.js` | Açılış, kayıt/yükleme, eylem yönlendirme, reklam akışı |
