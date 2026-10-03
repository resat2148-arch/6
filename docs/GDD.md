# Republic Rising — Oyun Tasarım Dokümanı (GDD)

> Klasik tarayıcı siyaset-savaş oyunlarının temel mekaniklerini CrazyGames kitlesine uygun, hızlı oturumlu bir tarayıcı oyununa dönüştürme planı.

## 1. Türden ne aldık?

| Türün klasik mekaniği | Republic Rising uyarlaması |
|---|---|
| Vatandaş: seviye (XP), güç (strength), askeri rütbe | Aynen var. XP ile seviye, antrenmanla güç, verilen hasarla rütbe (Recruit → Titan, 69 rütbe). |
| Günlük döngü: **Work – Train – Fight** | Ana sayfadaki büyük butonlar. Work, Train ve Eat, savaş gibi kendi tam ekran sahnesini açar (aşağıda “Günlük rutin ekranları”). Her eylem enerji harcar. |
| Enerji + “potansiyel enerji” (yiyecek sınırı) | **Enerji** yavaş dolar (+1/6 sn). **Yiyecek rezervi** hızlı dolar (+1/sn); yiyecek yiyerek rezervi enerjiye çevirirsin. |
| Hasar formülü `10 × (1+S/400) × (1+R/5) × (1+FP/100)` | Birebir kullanıldı. Silahsız ×0.5, Q1–Q5 silahlar +%20…+%100 ateş gücü. |
| Silah/yiyecek kaliteleri (Q1–Q7) | Q1–Q5 (sadeleştirildi). |
| Şirketler: ham madde → ürün | Çiftlik/Maden (ham madde), Fırın/Silah fabrikası (Q'ya göre ham madde tüketir). Oyun açıkken üretir (3 saatlik depo); oyuncu yokken dünya gibi şirketler de durur. |
| Evler (Q1–Q5), ev şirketleri | Kulübe → Malikâne. İçinde yaşadığın her kalite maksimum enerjiyi (+20…+100) ve enerji yenilenmesini (+%10…+%50) artırır; kaliteler üst üste eklenir, ev 4 saat sonra eskir. Taş ocağı yapı malzemesi üretir, inşaat şirketi ev yapar. |
| Bölge kaynakları üretim bonusu | Ülkenin sahip olduğu her farklı kaynak +%20 üretim. Fetih = ekonomik güç. |
| Savaşlar, raundlar, duvar (wall), bölge fethi | Her savaş **tek raund, 5 dakika**, dünya saatine bağlı. Yapay zekâ vatandaşlarının ve oyuncunun hasarı aynı duvara eklenir; süre dolunca duvarı önde olan taraf bölgeyi alır/korur. Oyuncu savaşa istediği an girip çıkabilir, hasarı kalır. Yeni oyunculara 10. seviyeye kadar azalan “Rookie boost” (×3 → ×1). Eğitim savaşı yok; her savaş gerçek. |
| Direniş savaşları (RW) | İşgal edilmiş anavatan bölgesinde 5 altınla başlatılabilir; yapay zekâ ülkeleri de başlatır. |
| Avrupa'nın fethi ve çağlar | Büyük ülkeler aynı anda birden çok cephede saldırır (1 + bölge/4, en fazla 14). Oyuncu Başkan ise aynı kuralla birden çok savaş ilan edebilir (War sekmesinde “Attack fronts x / y”); Başkan değilken ülkenin kendiliğinden açtığı savaşlar ve ona yapılan saldırılar en fazla 5'tir (oyuncunun açtığı savaşlar saldırılara karşı kalkan sayılmaz). Güçlüler zayıf komşulara ve sınırdaki düşman başkentlerine yönelir. Başkentini kaybeden ülke teslim olur: 5 bölge veya daha azı kaldıysa tamamen, değilse fatihin sınırındaki bütün bölgelerini verir; ayrıca moral cezası alır (temel güç ve vatandaş hasarı ×0,7). Her dünyada ülkelerin saldırganlığı rastgeledir (×0,35–1,65; savaş isteği, cephe sayısı ve savaşma azmi), böylece kazanan her dünyada değişir. Direniş savaşları seyrekleşti (bölge başına tur başına %0,4, ülke yok olduysa beşte biri). Simülasyonda bir ülke Avrupa'nın tamamını yaklaşık 3–7 oyun saatinde alır (önceden 24 saatte en büyük ülke %13'teydi). Tek ülke tüm Avrupa'ya hükmedince taç giyer (👑, ülke sıralamasında sayılır); 10 dakika sonra **Yeni Çağ** başlar: bütün ülkeler eski sınırlarında yeniden doğar, nüfus yeniden dağılır, yeni hükümetler kurulur, oyuncunun ilerlemesi korunur. Ana sayfadaki ülke kartı lideri, kalan ülke sayısını, son şampiyonu ve Yeni Çağ geri sayımını gösterir. |
| Sekme arka planları | Her sekmenin kendi teması var (`js/backgrounds.js`, kodla çizilen SVG, ~10–45 KB, indirme boyutuna eklenmez): Home gece başkent ve kubbe, War yanan cephe hattı, tanklar ve jetler, Economy sanayi bölgesi ve dişliler, Market konteyner limanı ve mum grafiği, Politics projektörlü meclis ve kalabalık, Citizens ışıklı apartmanlar ve miting, Medals altın ışınlar ve defne çelengi. Kartlar yarı saydam; sekme değişince arka plan yumuşakça geçer. |
| Ana sayfa haritası | Avrupa haritası ana sayfadadır (ayrı Map sekmesi yok): sürükle/yakınlaştır, bölgeye dokununca bilgi kartı ve Fight / Declare war / resistance düğmeleri. Masaüstünde harita solda, vatandaş kartı ve günlük işler sağda; telefonda harita en üstte. Altında ülke tablosu (bölge sayıları). |
| Ülke sıralamaları | Citizens sekmesinde 37 ülke; bölge, askeri güç (vatandaşların toplam hasarı), kazanılan savaş, nüfus, servet ve ortalama seviyeye göre sıralanır. Her ülkenin başkanı, galibiyet/mağlubiyet sayısı ve fethettiği bölgeler görünür. Politics sekmesi ülkenin Avrupa sırasını gösterir. |
| Antrenman sahaları (Training Grounds) ve kaliteleri | 4 tesis (Ağırlık Odası, Tırmanma Merkezi, Atış Poligonu, Özel Kuvvetler Merkezi), her biri Q1–Q5. Kalite, tesisin güç kazancını çarpar (Q1 ×1, Q2 ×1,25, Q3 ×1,5, Q4 ×1,8, Q5 ×2,2); tüm tesisler her antrenmanda birlikte çalışır. İnşa ve yükseltme altınla. Hepsi Q5'te antrenman başına +49,5 güç. Süper Asker madalyası artan eşiklerle verilir (250 × k^1,6: 250, 758, 1450…) ki hızlı antrenman altın makinesine dönüşmesin. |
| Siyaset: parti, kongre, başkan | Parti → Kongre (+%20 maaş) → Başkan (savaş ilan eder, ulusal politika seçer). Seçimler her 10 dakikada bir, kongre/başkanlık dönüşümlü. |
| Gazete, abone, Media Mogul | Gazete kur, makale yayınla (3 dk bekleme), abone kazan → popülerlik → seçim şansı. |
| Madalyalar (+5 altın) | Hard Worker, Super Soldier, Battle Hero, Campaign Hero, True Patriot, Resistance Hero, Congress Member, President, Media Mogul, Tycoon. |
| Pazar, altın/para borsası | Dalgalanan fiyatlar; altın al/sat; altın dükkânı (Bazuka, Enerji barı). |
| Başlangıç görevleri (tutorial missions) | 16 adımlı görev zinciri (ilk 6'sı ekranda adım adım yönlendirilir) + her gün 4 rastgele günlük emir + 7 günlük giriş ödülü serisi. |

## 2. CrazyGames için neyi değiştirdik?

Bu türün klasik oyunları “günde 5 dakika, yıllarca” oynanan yavaş oyunlar. CrazyGames'te ise oyuncu ilk 30 saniyede eğlenmezse çıkıyor. Bu yüzden:

1. **Savaş aktif bir aksiyon mini oyunu oldu.** Siperden çıkan düşmanlara dokun/tıkla, kafaya vuruş ×2, seri vuruş kombosu +%50'ye kadar. Düşman ateş etmeden öldürmezsen enerjin gider. 5 dakika sonunda duvar %50'nin üstündeyse bölge sizin.
   - **Görsel dil (modern çatışma):** Alacakaranlıkta yıkık modern bir şehir (silüet, vinç, elektrik direkleri, yanan araç enkazları, yükselen duman sütunları, uzakta topçu parlamaları, uçuşan kıvılcımlar), iki hat halinde HESCO bariyerleri, uyarı şeritli beton bloklar ve kum torbaları. Düşmanlar modern teçhizatlı (kask + NVG yuvası, gözlük, plaka taşıyıcı yelek, nişangâhlı tüfek) ve omuzlarında ülke bayrağı var; üniforma ülke rengine göre tonlanır. Ateş etmeden önce oyuncuya kırmızı lazer tutar ve kırmızı hedef köşeleriyle işaretlenir. Oyuncunun holografik nişangâhlı karabinası imleci takip eder; geri tepme, namlu alevi, fırlayan kovanlar, mermi izleri ve isabet işaretleri (beyaz isabet, sarı kafaya vuruş, kırmızı öldürme) var. Bazuka seçilince silah roketatara dönüşür, roket uçar ve ateş topu, şok dalgası, duman ve ekran parlamasıyla patlar. Her şey kodla çizilir (görsel dosya yok); statik katmanlar ve askerler bir kez önbelleğe çizildiği için eski ekranla aynı hızda çalışır (`js/battle-art.js`).
   - **Yan yana savaş (canlı):** Vatandaşların savaşı artık bir **hücum**dur: dünya turunda savaşmaya karar veren vatandaşın hasarı tek seferde değil, sonraki ~12–20 saniyeye yayılarak duvara işlenir (`deliverSorties`; başlangıçlar biraz kaydırılır, savaş bitince o ana kadar işlenen sayılır). Ekranın alt köşelerinde yalnızca **o anda hücumu süren** kendi ülkenin vatandaşları durur (masaüstünde 3, telefonda 2 yuva): hücum başlayınca siperden yükselir, biterken geri çekilir, yerini o anda vuran bir başkası alır; kimse vurmuyorsa yuva boş kalır. Etiket (bayrak · ad · seviye) hücum sürerken yeşildir. Her atışın üstünde, o vatandaşın bir önceki atışından beri duvara gerçekten işlenen hasar yeşil “+N” olarak çıkar. 🤝 çipi şu an senin tarafında vuran vatandaş sayısını, hasar tablosu her taraf için “🔥 şu an vuran” sayısını gösterir. Görsel isabetler (düşman devirme) oyuncunun skoruna sayılmaz.
   - **Eldeki silah kaliteye göre değişir:** O an ateşlenen silah (seçilen kalite; stok biterse eldeki en iyi alt kalite; bazuka seçiliyse roketatar) çizilir. ✊ Çıplak el: yumruk, ileri savrulur, mermi izi/alev/kovan yok, hedefte şok halkası. Q1 tabanca (küçük alev, hafif tepme), Q2 hafif makineli/SMG (kısa namlu, düz şarjör, kızıl nokta), Q3 taarruz tüfeği (ahşap kundak, eğri şarjör), Q4 holografik nişangâhlı taktik karabina, Q5 ağır makineli tüfek (mermi kutusu ve fişek şeridi, ayaklık, dürbün, en büyük alev ve en sert tepme), 🚀 roketatar. Alev, kovan boyutu ve namlu kalkması kaliteyle büyür. Silah değişince eski silah aşağı iner, yenisi kalkar (~0,4 sn) ve adı kısa süre görünür. Masaüstünde silah alt panelin sağında, sağ alt köşede tutulur (müttefikler bu yüzden solda dizilir); telefonda alt panelin üstünde.
   - **Hasar tablosu:** Üst çipteki 📊 ile açılıp kapanan canlı sıralama (masaüstünde varsayılan açık, telefonda kapalı; tercih hatırlanır). İki taraf ayrı panelde: ülke, o savaşta vuruş yapan kişi sayısı ve duvardaki toplam; altında en çok hasar veren 5 kişi (ad, seviye, duvara işlenen hasar). Oyuncu ⭐ ile vurgulanır; ilk 5'te değilse kendi sırası ayrıca gösterilir. Oyuncunun değeri duvara işlenen hasardır (çaylak bonusu dahil), vatandaşlarınkiyle aynı birimdedir. Panel tıklamaları geçirir, savaş alanını engellemez. Ekrandaki müttefik yuvalarına bu savaşta gerçekten vuruş yapmış vatandaşlar öncelikli yerleşir.
   - **HUD:** Cam efektli üst panel (bayraklar, parlayan duvar çubuğu, savaş bilgisi), süre/hasar/öldürme/kombo çipleri (son 30 saniyede süre kırmızı yanıp söner) ve yüzen alt panel (enerji, yemek, silah kaliteleri, bazuka, Leave).
2. **Zaman sıkıştırıldı.** Klasik oyunlardaki bir “gün” burada birkaç dakika: seçimler 10 dk, yapay zekâ savaş raundları 40–75 sn.
3. **Hiç bekletmeyen döngü.** Oyuncunun ülkesinin her zaman en az bir aktif cephesi vardır; ilk savaş oyunun ilk saniyesinden hazır.
4. **Dünya seni bekler.** Oyuncu oyunda değilken hiçbir şey ilerlemez (dünya, savaşlar, şirketler, enerji); döndüğünde her şey bıraktığı andan devam eder.
5. **Gerçek Avrupa haritası.** 37 gerçek Avrupa ülkesi ve 174 gerçek bölge (ör. Türkiye'nin 7 coğrafi bölgesi, Bavyera, Katalonya). Sınırlar Natural Earth 1:50m verisinden üretilir (`scripts/build-map.mjs`); bölgeler, gerçek bölge merkezlerinden hesaplanan Voronoi hücrelerinin ülke sınırına kırpılmasıyla oluşur. Sınırlar uluslararası tanınan hâliyle çizilir (Kırım Ukrayna'da); Kosova, Kıbrıs, Lüksemburg gibi küçük/hassas topraklar oynanamaz tarafsız bölgedir. Görsel dil kansız.
6. **Kısa hedef zinciri.** Görev → seviye atlama (enerji dolar!) → rütbe → madalya → fetih → dünya hâkimiyeti.

## 2.1 Yapay zekâ vatandaşları

Dünya boş hissettirmesin diye ~210 yapay zekâ vatandaşı var (`js/citizens.js`). Her ülkede büyüklüğüne göre 4–11 kişi, yerel isimlerle (Mehmet Yılmaz, Hans Müller, Anna Smirnova…).

- **Aynı döngüyü yaşarlar:** Her dünya turunda (20 sn) enerji toplar, yiyecek yer, çalışır, antrenman yapar, seviye ve rütbe atlarlar.
- **Kişilik:** 🪖 Asker (çok savaşır), 🛠️ İşçi (çok çalışır), 🏭 Sanayici (şirket kurar, büyütür, kalite yükseltir).
- **Savaş:** Ülkelerinin cephelerinde savaşır, silah harcar. Oyuncunun olmadığı raundları onların hasarı belirler. Oyuncunun kampanyalarında müttefik vatandaşların hasarı raundu kolaylaştırır, düşmanlarınki zorlaştırır. Savaş kartında "en iyi savaşçılar" listelenir.
- **Ekonomi:** Şirketlerinde üretir, pazara ilan verir. Satamazlarsa fiyat düşürür, stok biterse fiyat artırır; depo dolunca üretimi durdurur. Hammaddeyi pazardan alır (oyuncunun çiftlik/madeninden de!), yiyecek, silah ve ev satın alır.
- **Nüfus bölgeleri izler:** Hedef nüfus ≈ 5 × (2 + 0,75 × bölge sayısı) (bölgesiz ülkede 5 direniş vatandaşı); Avrupa'da toplam ~1.040 yapay zekâ vatandaşı yaşar. Her vatandaşın duvara katkısı 5'e bölünmüştür (`CITIZEN_WALL_WEIGHT` 0,03), böylece savaş dengesi ve oyuncunun etkisi aynı kalır. Kayıtta vatandaşlar kısa diziler halinde sıkıştırılır (~190 KB); eski kayıtlar açılınca nüfus yeni ölçeğe otomatik tamamlanır. Her dünya turunda nüfus hedefe bir adım yaklaşır: küçülen ülkelerden vatandaşlar büyüyenlere göç eder (göç eden, yeni ülkesine uygun ve aynı cinsiyette bir isim alır; adı zaten o ülkede yaygınsa, ör. Almanya↔İsviçre'de Müller, değişmez; gazetesinin adı da yenilenir; haberde “… moved from X to Y and is now called …” yazar; eski kayıtlarda yabancı isim taşıyan göçmenler yüklenince yerelleştirilir), göçmen yetmezse yeni vatandaşlar katılır, gidecek yeri olmayanlar Avrupa'dan ayrılır (yerlerini yeni gelenler alır, kayıt büyümez). Daha kalabalık ülke, her savaşta duvara daha çok hasar ekler. Başkan ülkesini terk etmez. Ülke sıralaması ve Politics sekmesi büyüme/küçülme yönünü gösterir.
- **Seçimler (`js/elections.js`):** Kongre seçimlerinde hırslı vatandaşlar aday olur ve kampanya parası öder. Oylar popülerliğe (seviye, rütbe, gazete abonesi, mevcut görev) ve biraz da şansa göre dağılır. Koltuk sayısı ülkenin büyüklüğü ve nüfusuyla orantılıdır. Kongre üyeliği bir dönemliktir; oyuncu koltuğunu korumak için yeniden aday olmalıdır. Başkanlık seçiminde Kongre üyeleri yarışır, diğer ülkeler de kendi başkanlarını seçer. Politics sekmesinde rakipler, simülasyonla hesaplanan kazanma şansı ve son seçimin oy tablosu görünür.
- **Basın (`js/press.js`):** Hırslı vatandaşlar gazete kurar ve dünyadaki olaylardan (cepheler, seçimler, başkan, pazar fiyatları) başlıklar üreterek makale yazar. Okurlar makalelere oy verir, oylar abone getirir, abone de popülerliği artırır. Oyuncu başlıklı makale yazabilir ve başkalarının makalelerine oy verebilir.
- **Görünürlük:** Citizens sekmesinde ülke ve Avrupa sıralamaları (hasar, güç, seviye, servet) ile canlı haber akışı var.

**Pazar (ilan tahtası, `js/market.js`):** Alım en ucuz ilandan başlar. Oyuncu da ilan verir, vatandaşlar ucuz olanı alır ve para oyuncuya gelir. "Sell now" ile tüccara ortalama fiyatın %70'ine anında satılabilir. İlan tahtası boşsa devlet ithalatı taban fiyatın 1,8 katından satar.

## 2.2 Kayıt ve kaldığı yerden devam

- **İlk açılış (CrazyGames kalite rehberi: “doğrudan oyuna”):** Hiç kariyer yoksa menü ve ülke ekranı atlanır: oyuncu tarayıcı dilinin ülkesinde (yoksa Almanya), o ülkeye uygun bir isimle (giriş yaptıysa CrazyGames kullanıcı adıyla) 1. kariyeri başlatır ve **sıfır tıklamayla** ülkesinin en acil savaşına girer. İlk savaşta kayan tablo kapalı başlar, ilk düşmanın üstünde “TAP!” halkası ve “Tap the enemies to shoot” ipucu görünür; 10 düşman vurulunca “Mission done!” yazar ve ⟵ Leave düğmesi parlar. Ülke sonradan Politics → Citizenship ile **ilk seferde ücretsiz** değiştirilebilir. Uzun “How to play” metni artık açılışta gösterilmez (menüde Settings → How to play'de durur).
- **Ekranda adım adım yönlendirme (`js/coach.js`):** İlk görevler metin yerine tek bir dokunma hedefiyle anlatılır: ekran hafifçe kararır, yapılacak düğme altın bir halkayla parlar ve yanında kısa bir balon çıkar (ör. “🛠️ Work to earn money”, “🎁 Mission complete! Claim your reward”). Görev sırası: 10 düşman vur → çalış → antrenman yap → ye → Market'ten bir şey al → Citizens sıralamasına bak. Fabrika ve kampta ilk girişte altın bölge ipucu çıkar; görev orada tamamlanınca “⟵ HQ to claim your reward” yazar ve HQ düğmesi parlar. Balondaki **Skip tutorial** yönlendirmeyi kapatır (görev kartı Ana sayfada kalır, tüm sekmeler açılır). Görev kartı Ana sayfanın en üstündedir.
- **İlk görevlerde pencere ve uyarı yok:** İlk 4 görev bitene (ya da öğretici atlanana) kadar günlük ödül penceresi açılmaz ve “X is attacking Y” gibi savaş uyarıları açılır pencere/ses olarak gelmez (haber akışında durur); kazanılan zaferler yine gösterilir. 4. görev alınınca bekleyen günlük ödül açılır.
- **Sekmeler seviyeyle açılır:** Home, War ve Economy hep açık; Market seviye 2, Citizens ve Medals seviye 3, Politics seviye 4'te açılır (bir görev o sekmeyi gerektiriyorsa daha erken). Kilitli sekme soluk ve “🔒Lv3” etiketlidir; dokununca hangi seviyede açılacağını söyler. Açıldığı anda “🔓 Market unlocked!” bildirimi gelir ve sekme ziyaret edilene kadar parlar.
- **Açılış menüsü ve 3 kariyer:** Kariyeri olan oyuncu için oyun her açılışta menüyle başlar. Menüde **3 kariyer yuvası** vardır; her biri ayrı bir vatandaş, ayrı bir dünya ve ayrı bir kayıttır. Dolu yuva kartı bayrak, ad, seviye, ülke, rütbe ve son oynama zamanını gösterir; **▶ Continue** o kariyerden devam eder, **✚ New** onay sorup o yuvada yeni oyun başlatır (eski vatandaş ancak “Become a citizen” denince yenisiyle değiştirilir, o ana kadar geri dönülebilir; eskisinin yedeği tutulmaz), **🗑** onay sorup yalnızca o kariyeri siler. Boş yuvada **✚ New game** ülke seçimini açar (geri dönülebilir) ve yeni vatandaş o yuvaya kaydedilir. En son oynanan kariyer “Last played” ile işaretlenir. Altta **Settings** (ses, müzik, nasıl oynanır, yedek kodunu seçilen yuvaya geri yükleme) ve **Exit** (kaydeder, “sekmeyi kapatabilirsin” ekranı; tarayıcılar sayfanın kendi sekmesini kapatmasına izin vermez). CrazyGames'te oyun portalın sayfasında çalıştığı ve portal kuralları çıkış düğmesi istemediği için Exit gizlenir (SDK ortamı `crazygames` veya `local` olduğunda). Oyun içindeyken üst çubuktaki ☰ açık kariyeri kaydedip menüye döner; başka bir kariyere geçmek böyle yapılır. Kariyerlerin dünyaları birbirinden bağımsızdır; kapalı bir kariyerin dünyası, açıldığında aradaki süre kadar ilerletilir.
- **Müzik:** Ses dosyası yok; müzik de WebAudio ile kodla çalınır (`js/music.js`). Menüde ve haritada sakin bir Re minör tema (“Homeland”, 76 BPM: yaylı pad, arp, timpani, 16 ölçülük döngünün ikinci yarısında melodi), savaşta marş (“Front Line”, 132 BPM: trampet açılışı, staccato yaylılar, davul, korno melodisi). Savaşa girince/çıkınca iki tema yumuşakça geçiş yapar. Üst çubuktaki 🎵 yalnızca müziği, 🔊 tüm sesi açıp kapatır (Settings'te de var; müzik tercihi cihazda tutulur). Ses kapalıyken, reklam sırasında ve sekme arka plandayken müzik durur; ilk dokunuşta başlar (tarayıcı kuralı).
- **Vatandaşlık değiştirme (Politics → 🧳 Citizenship → Move):** Oyuncu başka bir ülkeye göç edebilir: 🪙10 altın, 30 dakikada bir, yalnızca bölgesi olan ülkelere. Önce ülke, sonra o ülkeye uygun bir isim seçilir (♂/♀ ve “🎲 Other names” ile üç öneri; kutuya elle de yazılabilir). Seviye, güç, rütbe, para, eşyalar, şirketler ve gazete korunur; parti üyeliği, Kongre koltuğu ve başkanlık eski ülkede kalır (oyuncu başkansa eski ülkeye yapay zekâ bir başkan seçilir). Haber akışı: “🧳 … moved from X to Y and is now called …”.
- **Başlangıçta isim önerisi:** Yeni oyunda isim kutusu seçili ülkeye uygun bir isimle dolar; başka ülke kartına dokununca isim o ülkeye göre değişir, 🎲 ♂ / 🎲 ♀ yeni öneri getirir. Oyuncunun kendi yazdığı isim ya da CrazyGames kullanıcı adı hiç değiştirilmez. Önerilen ismin cinsiyeti sonraki göçlerde varsayılan olarak kullanılır.
- **Tek kayıttan geçiş:** Kariyerlerden önceki tek kayıt (cihaz ve bulut kopyası) ilk açılışta otomatik olarak 1. kariyere taşınır.

Tarayıcıyı kapatan oyuncu ilerlemesini kaybetmez (`js/storage.js`):

- **Anında kayıt:** Her işlemden 0,3 sn sonra, her 5 sn'de bir, savaş raundu bitince, sekme gizlenince ya da kapanınca kaydedilir. Telefonun sekmeyi haber vermeden öldürmesi en fazla birkaç saniyelik işlemi kaybettirir.
- **Yedek:** Ana kayıt yazılmadan önce son geçerli kayıt yedek yuvasına kopyalanır. Ana kayıt bozulursa yedekten açılır.
- **Bulut:** CrazyGames'te SDK'nın `data` modülüne yazılır; giriş yapmış oyuncunun ilerlemesi cihazlar arasında taşınır. Claude önizleme bağlantısında oyuncunun özel `db` belgesine yazılır. Açılışta cihaz ve bulut kaydı okunur, en yeni geçerli olan seçilir.
- **Yedek kodu:** Oyun içinde Medals sekmesi → "Backup code" açık kariyeri sıkıştırılmış bir koda (~20 KB) çevirir. Menüde Settings → "Restore from code" kodu seçilen yuvaya (varsayılan: ilk boş yuva) yükler; oyun içinden geri yükleme açık kariyerin yerine geçer.
- **Yuva başına katmanlar:** Her kariyerin kendi cihaz anahtarı, yedeği, CrazyGames `data` anahtarı ve önizleme `db` belgesi vardır (kayıt ~80 KB, 3 kariyer toplam ~250 KB).
- **Sürüm yükseltme:** Eski kurgusal harita kayıtları silinmez; oyuncu yeni bir Avrupa ülkesi seçer, seviye, güç, rütbe, para, envanter, şirketler ve madalyalar korunur.
- **Yokken ilerleme yok:** Oyun kapalıyken, menüdeyken, sekme/uygulama arka plandayken veya cihaz uykudayken dünya durur. Dönüşte (`G.resume`) kayıttaki bütün saatler yokluk süresi kadar ileri kaydırılır: savaş bitiş süreleri ve vatandaş hücumları, dünya turu, seçim, ev süreleri, reklam/ödül bekleme süreleri, haber ve makale zamanları, Yeni Çağ geri sayımı. Enerji, rezerv ve şirket üretimi de yalnızca oyun açıkken artar. Ana döngü 3 saniyeden uzun bir boşluk görürse (donmuş sayfa) o süreyi de saymaz. Günlük ödül ve görevler takvim gününe bağlıdır, kaydırılmaz. Dönüşte kısa bir “Welcome back” bildirimi çıkar.

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
- **Günlük rutin ekranları** (`js/routine.js`, çizimler `js/routine-art.js`): Ana sayfadaki Work / Train / Eat düğmeleri savaş ekranı gibi tam ekran, kodla çizilmiş bir sahne açar; üstteki sekmelerle üçü arasında geçilir, **⟵ HQ** ana sayfaya döner.
  - 🏭 **Factory (Work):** baretli, yelekli vatandaş tezgâhta çekiçle kızgın metali döver; kıvılcımlar, banttaki sandıklar, uçuşan paralar.
  - 🎖️ **Training camp (Train):** ülke bayrağı dalgalanan kampta halter kaldırır (dizler bükülür, bar başın üstünde kilitlenir); tesislerin kaliteleri başlıkta görünür, plaka sayısı en iyi tesise göre artar.
  - 🍽️ **Mess hall (Eat):** yemekhanede masada kaşıkla yer; tabaktaki yemek elindeki en iyi kaliteye göre değişir, enerji topları yükselir. Yemek al (🛒 +20) ve 📺 Supply drop buradan.
  - **Zamanlama göstergesi (Work ve Train):** işaretçi gidip gelir; altın bölgedeyken dokunursan **PERFECT**: vardiya +%20 maaş, antrenman +%25 güç (enerji aynı). Ardışık perfect'ler “PERFECT ×n” olarak sayılır. Ana düğme, sahneye dokunmak, Boşluk veya Enter aynı eylemi yapar. **⏩ ×n** kalan enerjiyi tek seferde harcar (bonussuz). Enerji bitince 🍞 düğmesi yanıp söner ve yemekhaneye götürür.
  - Ekranda o ziyaretin özeti (vardiya/antrenman sayısı, toplam kazanç, perfect sayısı) çip olarak görünür.
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
2. **Gerçek sprite'lar ve kayıtlı müzik** (şu an tüm grafik, ses ve müzik kod ile üretiliyor → çok hızlı yükleme).
3. **Liderlik tablosu / sezonlar** (CrazyGames hesabı ile); ileride çok oyunculu ortak dünya (Supabase/Node sunucu).
4. **Askerî birlikler (Military Units)** ve günlük emir ödülleri.
5. **Uçak/tank savaşları** (hava savaşları) — yeni mini oyun türü.
6. **Prestij**: dünyayı fethedince yeni harita + kalıcı bonus.
7. Denge ayarları için analitik (raund kazanma oranı, oturum süresi).
