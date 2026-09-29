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
| Bölge kaynakları üretim bonusu | Ülkenin sahip olduğu her farklı kaynak +%20 üretim. Fetih = ekonomik güç. |
| Savaşlar, raundlar, duvar (wall), bölge fethi | Her kampanya “ilk 3 raundu kazanan” formatında. Raund = 60 sn'lik aksiyon mini oyunu. |
| Direniş savaşları (RW) | İşgal edilmiş anavatan bölgesinde 5 altınla başlatılabilir; yapay zekâ ülkeleri de başlatır. |
| Eğitim savaşları | Her zaman açık “Training War” (yarı ödül, haritayı değiştirmez). |
| Siyaset: parti, kongre, başkan | Parti → Kongre (+%20 maaş) → Başkan (savaş ilan eder, ulusal politika seçer). Seçimler her 10 dakikada bir, kongre/başkanlık dönüşümlü. |
| Gazete, abone, Media Mogul | Gazete kur, makale yayınla (3 dk bekleme), abone kazan → popülerlik → seçim şansı. |
| Madalyalar (+5 altın) | Hard Worker, Super Soldier, Battle Hero, Campaign Hero, True Patriot, Resistance Hero, Congress Member, President, Media Mogul, Tycoon. |
| Pazar, altın/para borsası | Dalgalanan fiyatlar; altın al/sat; altın dükkânı (Bazuka, Enerji barı). |
| Başlangıç görevleri (tutorial missions) | 13 adımlı görev zinciri + her gün 4 rastgele günlük emir + 7 günlük giriş ödülü serisi. |

## 2. CrazyGames için neyi değiştirdik?

eRepublik “günde 5 dakika, yıllarca” oynanan yavaş bir oyun. CrazyGames'te ise oyuncu ilk 30 saniyede eğlenmezse çıkıyor. Bu yüzden:

1. **Savaş aktif bir aksiyon mini oyunu oldu.** Siperden çıkan düşmanlara dokun/tıkla, kafaya vuruş ×2, seri vuruş kombosu +%50'ye kadar. Düşman ateş etmeden öldürmezsen enerjin gider. Duvarı %50'nin üstünde bitir → raundu kazan.
2. **Zaman sıkıştırıldı.** eRepublik'teki bir “gün” burada birkaç dakika: seçimler 10 dk, yapay zekâ savaş raundları 40–75 sn.
3. **Hiç bekletmeyen döngü.** Oyuncunun ülkesinin her zaman en az bir aktif cephesi vardır; ilk savaş oyunun ilk saniyesinden hazır.
4. **Idle/geri dönüş katmanı.** Şirketler çevrimdışı 3 saate kadar üretir; dünya sen yokken de değişir (“Welcome back” özeti).
5. **Kurgusal ülkeler.** Gerçek ülkeler yerine 6 kurgusal ulus (Valoria, Karthos, Norvik, Solmara, Drakmir, Esteran): siyasi hassasiyet yok, küresel kitleye uygun, kansız görsel dil.
6. **Kısa hedef zinciri.** Görev → seviye atlama (enerji dolar!) → rütbe → madalya → fetih → dünya hâkimiyeti.

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
