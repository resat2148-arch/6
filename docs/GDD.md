# Republic Rising — Oyun Tasarım Dokümanı (GDD)

> eRepublik'in temel mekaniklerini CrazyGames kitlesine uygun, hızlı oturumlu bir tarayıcı oyununa dönüştürme planı.

## 1. eRepublik'ten ne aldık?

| eRepublik mekaniği | Republic Rising uyarlaması |
|---|---|
| Vatandaş: seviye (XP), güç (strength), askeri rütbe | Aynen var. XP ile seviye, antrenmanla güç, verilen hasarla rütbe (Recruit → Titan, 69 rütbe). |
| Günlük döngü: **Work – Train – Fight** | Ana sayfadaki üç büyük buton. Her biri enerji harcar. |
| Enerji + “potansiyel enerji” (yiyecek sınırı) | **Enerji** yavaş dolar (+1/6 sn). **Yiyecek rezervi** hızlı dolar (+1/sn); yiyecek yiyerek rezervi enerjiye çevirirsin. |
| Hasar formülü `10 × (1+S/400) × (1+R/5) × (1+FP/100)` | Birebir kullanıldı. Silahsız ×0.5, Q1–Q5 silahlar +%20…+%100 ateş gücü. |
| Silah/yiyecek kaliteleri (Q1–Q7) | Q1–Q5 (sadeleştirildi). |
| Şirketler: ham madde → ürün | Çiftlik/Maden (ham madde), Fırın/Silah fabrikası (Q'ya göre ham madde tüketir). Oyuncu yokken de üretir (idle). |
| Evler (Q1–Q5), ev şirketleri | Kulübe → Malikâne. İçinde yaşadığın her kalite maksimum enerjiyi (+20…+100) ve enerji yenilenmesini (+%10…+%50) artırır; kaliteler üst üste eklenir, ev 4 saat sonra eskir. Taş ocağı yapı malzemesi üretir, inşaat şirketi ev yapar. |
| Bölge kaynakları üretim bonusu | Ülkenin sahip olduğu her farklı kaynak +%20 üretim. Fetih = ekonomik güç. |
| Savaşlar, raundlar, duvar (wall), bölge fethi | Her savaş **tek raund, 5 dakika**, dünya saatine bağlı. Yapay zekâ vatandaşlarının ve oyuncunun hasarı aynı duvara eklenir; süre dolunca duvarı önde olan taraf bölgeyi alır/korur. Oyuncu savaşa istediği an girip çıkabilir, hasarı kalır. Yeni oyunculara 10. seviyeye kadar azalan “Rookie boost” (×3 → ×1). Eğitim savaşı yok; her savaş gerçek. |
| Direniş savaşları (RW) | İşgal edilmiş anavatan bölgesinde 5 altınla başlatılabilir; yapay zekâ ülkeleri de başlatır. |
| Ülke sıralamaları | Citizens sekmesinde 37 ülke; bölge, askeri güç (vatandaşların toplam hasarı), kazanılan savaş, nüfus, servet ve ortalama seviyeye göre sıralanır. Her ülkenin başkanı, galibiyet/mağlubiyet sayısı ve fethettiği bölgeler görünür. Politics sekmesi ülkenin Avrupa sırasını gösterir. |
| Antrenman sahaları (Training Grounds) ve kaliteleri | 4 tesis (Ağırlık Odası, Tırmanma Merkezi, Atış Poligonu, Özel Kuvvetler Merkezi), her biri Q1–Q5. Kalite, tesisin güç kazancını çarpar (Q1 ×1, Q2 ×1,25, Q3 ×1,5, Q4 ×1,8, Q5 ×2,2); tüm tesisler her antrenmanda birlikte çalışır. İnşa ve yükseltme altınla. Hepsi Q5'te antrenman başına +49,5 güç. Süper Asker madalyası artan eşiklerle verilir (250 × k^1,6: 250, 758, 1450…) ki hızlı antrenman altın makinesine dönüşmesin. |
| Siyaset: parti, kongre, başkan | Parti → Kongre (+%20 maaş) → Başkan (savaş ilan eder, ulusal politika seçer). Seçimler her 10 dakikada bir, kongre/başkanlık dönüşümlü. |
| Gazete, abone, Media Mogul | Gazete kur, makale yayınla (3 dk bekleme), abone kazan → popülerlik → seçim şansı. |
| Madalyalar (+5 altın) | Hard Worker, Super Soldier, Battle Hero, Campaign Hero, True Patriot, Resistance Hero, Congress Member, President, Media Mogul, Tycoon. |
| Pazar, altın/para borsası | Dalgalanan fiyatlar; altın al/sat; altın dükkânı (Bazuka, Enerji barı). |
| Başlangıç görevleri (tutorial missions) | 13 adımlı görev zinciri + her gün 4 rastgele günlük emir + 7 günlük giriş ödülü serisi. |

## 2. CrazyGames için neyi değiştirdik?

eRepublik “günde 5 dakika, yıllarca” oynanan yavaş bir oyun. CrazyGames'te ise oyuncu ilk 30 saniyede eğlenmezse çıkıyor. Bu yüzden:

1. **Savaş aktif bir aksiyon mini oyunu oldu.** Siperden çıkan düşmanlara dokun/tıkla, kafaya vuruş ×2, seri vuruş kombosu +%50'ye kadar. Düşman ateş etmeden öldürmezsen enerjin gider. 5 dakika sonunda duvar %50'nin üstündeyse bölge sizin.
2. **Zaman sıkıştırıldı.** eRepublik'teki bir “gün” burada birkaç dakika: seçimler 10 dk, yapay zekâ savaş raundları 40–75 sn.
3. **Hiç bekletmeyen döngü.** Oyuncunun ülkesinin her zaman en az bir aktif cephesi vardır; ilk savaş oyunun ilk saniyesinden hazır.
4. **Idle/geri dönüş katmanı.** Şirketler çevrimdışı 3 saate kadar üretir; dünya sen yokken de değişir (“Welcome back” özeti).
5. **Gerçek Avrupa haritası.** 37 gerçek Avrupa ülkesi ve 174 gerçek bölge (ör. Türkiye'nin 7 coğrafi bölgesi, Bavyera, Katalonya). Sınırlar Natural Earth 1:50m verisinden üretilir (`scripts/build-map.mjs`); bölgeler, gerçek bölge merkezlerinden hesaplanan Voronoi hücrelerinin ülke sınırına kırpılmasıyla oluşur. Sınırlar uluslararası tanınan hâliyle çizilir (Kırım Ukrayna'da); Kosova, Kıbrıs, Lüksemburg gibi küçük/hassas topraklar oynanamaz tarafsız bölgedir. Görsel dil kansız.
6. **Kısa hedef zinciri.** Görev → seviye atlama (enerji dolar!) → rütbe → madalya → fetih → dünya hâkimiyeti.

## 2.1 Yapay zekâ vatandaşları

Dünya boş hissettirmesin diye ~210 yapay zekâ vatandaşı var (`js/citizens.js`). Her ülkede büyüklüğüne göre 4–11 kişi, yerel isimlerle (Mehmet Yılmaz, Hans Müller, Anna Smirnova…).

- **Aynı döngüyü yaşarlar:** Her dünya turunda (20 sn) enerji toplar, yiyecek yer, çalışır, antrenman yapar, seviye ve rütbe atlarlar.
- **Kişilik:** 🪖 Asker (çok savaşır), 🛠️ İşçi (çok çalışır), 🏭 Sanayici (şirket kurar, büyütür, kalite yükseltir).
- **Savaş:** Ülkelerinin cephelerinde savaşır, silah harcar. Oyuncunun olmadığı raundları onların hasarı belirler. Oyuncunun kampanyalarında müttefik vatandaşların hasarı raundu kolaylaştırır, düşmanlarınki zorlaştırır. Savaş kartında "en iyi savaşçılar" listelenir.
- **Ekonomi:** Şirketlerinde üretir, pazara ilan verir. Satamazlarsa fiyat düşürür, stok biterse fiyat artırır; depo dolunca üretimi durdurur. Hammaddeyi pazardan alır (oyuncunun çiftlik/madeninden de!), yiyecek, silah ve ev satın alır.
- **Nüfus bölgeleri izler:** Hedef nüfus ≈ 2 + 0,75 × bölge sayısı (bölgesiz ülkede 1 direniş vatandaşı). Her dünya turunda nüfus hedefe bir adım yaklaşır: küçülen ülkelerden vatandaşlar büyüyenlere göç eder, göçmen yetmezse yeni vatandaşlar katılır, gidecek yeri olmayanlar Avrupa'dan ayrılır (yerlerini yeni gelenler alır, kayıt büyümez). Daha kalabalık ülke, her savaşta duvara daha çok hasar ekler. Başkan ülkesini terk etmez. Ülke sıralaması ve Politics sekmesi büyüme/küçülme yönünü gösterir.
- **Seçimler (`js/elections.js`):** Kongre seçimlerinde hırslı vatandaşlar aday olur ve kampanya parası öder. Oylar popülerliğe (seviye, rütbe, gazete abonesi, mevcut görev) ve biraz da şansa göre dağılır. Koltuk sayısı ülkenin büyüklüğü ve nüfusuyla orantılıdır. Kongre üyeliği bir dönemliktir; oyuncu koltuğunu korumak için yeniden aday olmalıdır. Başkanlık seçiminde Kongre üyeleri yarışır, diğer ülkeler de kendi başkanlarını seçer. Politics sekmesinde rakipler, simülasyonla hesaplanan kazanma şansı ve son seçimin oy tablosu görünür.
- **Basın (`js/press.js`):** Hırslı vatandaşlar gazete kurar ve dünyadaki olaylardan (cepheler, seçimler, başkan, pazar fiyatları) başlıklar üreterek makale yazar. Okurlar makalelere oy verir, oylar abone getirir, abone de popülerliği artırır. Oyuncu başlıklı makale yazabilir ve başkalarının makalelerine oy verebilir.
- **Görünürlük:** Citizens sekmesinde ülke ve Avrupa sıralamaları (hasar, güç, seviye, servet) ile canlı haber akışı var.

**Pazar (ilan tahtası, `js/market.js`):** Alım en ucuz ilandan başlar. Oyuncu da ilan verir, vatandaşlar ucuz olanı alır ve para oyuncuya gelir. "Sell now" ile tüccara ortalama fiyatın %70'ine anında satılabilir. İlan tahtası boşsa devlet ithalatı taban fiyatın 1,8 katından satar.

## 2.2 Kayıt ve kaldığı yerden devam

- **Açılış menüsü:** Oyun her açılışta menüyle başlar. **Continue** (kayıtlı vatandaş kartıyla: ad, ülke, seviye, son oynama zamanı; kayıt yoksa pasif), **New game** (kayıt varsa onay ister, ülke seçiminden geri dönülebilir), **Settings** (ses, nasıl oynanır, yedek kodu al/geri yükle, kaydı sil) ve **Exit** (kaydeder ve “sekmeyi kapatabilirsin” ekranı gösterir; tarayıcılar sayfanın kendi sekmesini kapatmasına izin vermez). Oyun içindeyken üst çubuktaki ☰ kaydedip menüye döner.

Tarayıcıyı kapatan oyuncu ilerlemesini kaybetmez (`js/storage.js`):

- **Anında kayıt:** Her işlemden 0,3 sn sonra, her 5 sn'de bir, savaş raundu bitince, sekme gizlenince ya da kapanınca kaydedilir. Telefonun sekmeyi haber vermeden öldürmesi en fazla birkaç saniyelik işlemi kaybettirir.
- **Yedek:** Ana kayıt yazılmadan önce son geçerli kayıt yedek yuvasına kopyalanır. Ana kayıt bozulursa yedekten açılır.
- **Bulut:** CrazyGames'te SDK'nın `data` modülüne yazılır; giriş yapmış oyuncunun ilerlemesi cihazlar arasında taşınır. Claude önizleme bağlantısında oyuncunun özel `db` belgesine yazılır. Açılışta cihaz ve bulut kaydı okunur, en yeni geçerli olan seçilir.
- **Yedek kodu:** Ayarlar (Medals sekmesi) → "Backup code" ilerlemeyi sıkıştırılmış bir koda (~20 KB) çevirir; "Restore from code" ile başka cihazda devam edilir.
- **Sürüm yükseltme:** Eski kurgusal harita kayıtları silinmez; oyuncu yeni bir Avrupa ülkesi seçer, seviye, güç, rütbe, para, envanter, şirketler ve madalyalar korunur.
- **Yokken geçen zaman:** Dönüşte enerji dolmuş, şirketler (3 saate kadar) üretmiş, dünya savaşları ve seçimler ilerlemiş olur; "Welcome back" penceresi özetler.

## 3. Çekirdek döngü

```
Work (para) ─┐
Train (güç) ─┼─► Fight (hasar → XP, rütbe, para, madalya) ─► Bölge fethi ─► Kaynak bonusu ─► Daha fazla üretim
Eat (enerji)─┘                                   ▲                                                   │
          Market ◄── Şirketler (idle üretim) ◄───┴───────────────────────────────────────────────────┘
Siyaset: popülerlik → seçim → Başkanlık → savaş hedefini sen seçersin
```

## 4. Denge değerleri (js/data.js → `CONFIG`)

- Başlangıç: 100 enerji, 200 rezerv, 50 para, 5 altın, 20× Q1 yiyecek, 150× Q1 silah, 1 bazuka.
- Work: −10 enerji, maaş `10 + 1.5×seviye`. Train: −10 enerji, +5 güç (tesislerle +22.5'e kadar).
- Her atış 1 enerji + 1 silah. Düşman ateşi −4 enerji.
- Raund zorluğu: ülkelerin güç oranı, savunma avantajı, başkent, raund numarası ve oyuncunun seviyesi ile ölçeklenir. Düşman gücü kısmen oyuncunun kendi gücüne bağlıdır, böylece antrenman ve rütbe hissedilir ama oyun hiç imkânsız olmaz.

## 5. Monetizasyon (CrazyGames SDK v3)

| Yer | Reklam türü |
|---|---|
| Enerji menüsü / savaşta “Out of energy” → **Supply drop** (tam enerji + rezerv, 4 dk bekleme) | Rewarded |
| Ekonomi → **Collect 2×** (5 dk bekleme) | Rewarded |
| Pazar → **+2 altın** (10 dk bekleme) | Rewarded |
| Günlük giriş ödülü → **2× al** | Rewarded |
| Raund sonrası HQ'ya dönüş / sonraki raund (en az 3 dk arayla, ilk 2 raunddan sonra) | Midgame |

SDK çağrıları: `init`, `loadingStart/Stop`, `gameplayStart/Stop` (sekme gizlenince ve reklam sırasında durur), `happytime` (seviye, fetih, seçim zaferi), `data` modülü (bulut kayıt), `user` (kullanıcı adı), ayarlardan ses kapatma.

## 6. Yol haritası (sonraki adımlar)

1. **Türkçe + diğer diller** (i18n; CrazyGames `SDK.user.systemInfo` ile dil algılama).
2. **Gerçek müzik ve sprite'lar** (şu an tüm grafik/ses kod ile üretiliyor → çok hızlı yükleme).
3. **Liderlik tablosu / sezonlar** (CrazyGames hesabı ile); ileride çok oyunculu ortak dünya (Supabase/Node sunucu).
4. **Askerî birlikler (Military Units)** ve günlük emir ödülleri.
5. **Uçak/tank savaşları** (eRepublik'teki hava savaşları) — yeni mini oyun türü.
6. **Prestij**: dünyayı fethedince yeni harita + kalıcı bonus.
7. Denge ayarları için analitik (raund kazanma oranı, oturum süresi).
