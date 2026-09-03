# TypeFight.io — Proje Spesifikasyonu

**Sürüm:** 2.0
**Tarih:** 3 Eylül 2026
**Durum:** Çekirdek kurallar ve MVP kapsamı kararlaştırıldı; parametre ayarı ve ilerleme tasarımı açık.

> Bu sürüm, v1 dokümanının kapsam ve mimari kararlarını gözden geçirilmiş hâlidir. En büyük değişiklikler: MVP tek kişilik ve tamamen yerel hâle getirildi, gerçek zamanlı ağ katmanı ertelendi, ve v1'de tanımsız kalan yazma kuralları netleştirildi.

---

## 1. Özet

TypeFight.io, klavye girişini silah ve hareket mekanizması olarak kullanan, tarayıcı tabanlı rekabetçi bir yazma oyunudur. Uzun vadeli vizyon dört mod içerir: Simulator (antrenman), Gauntlet (RPG kampanya), The Pit (1v1 PvP) ve Velocity Highway (10 kişilik yarış).

**MVP, Simulator ve Gauntlet ile sınırlıdır.** PvP modları ve gerçek zamanlı altyapı sonraki fazlara ertelenmiştir.

**Geliştirme kapasitesi:** tek kişi. Bu kısıt, aşağıdaki tüm mimari ve kapsam kararlarının belirleyicisidir.

---

## 2. Çekirdek yazma kuralları

Bu bölüm dokümanın en kritik parçasıdır. Hasar formülleri, sıralama, anti-cheat ve zorluk eğrisi buradan türetilir.

### 2.1 Giriş modeli

| Kural | Karar |
|---|---|
| Hata yönetimi | **Bloklama.** Doğru harf gelene kadar imleç ilerlemez. |
| Yanlış tuş (Simulator) | Yok sayılır. Ceza yalnızca kaybedilen zamandır. |
| Yanlış tuş (Gauntlet) | Hedef kilitli değilken yeni kelime doğurur (bkz. 4.3). |
| Backspace | Yok. Bloklama nedeniyle gereksiz. |
| Karakter seti | Yalnızca `a–z` ve boşluk. Büyük harf yok, noktalama yok. |
| Shift tuşu | Devre dışı. Modifier durumu takibi yok. |
| Tuş tekrarı (repeat) | **Yok sayılır.** `event.repeat === true` giriş köprüsünde elenir ve motora iletilmez. |
| Dil / düzen | İngilizce, QWERTY. Tek dil, tek düzen. |

**Tuş tekrarı (key repeat) kuralı:** Tuş tekrar olayları (`event.repeat === true`) giriş köprüsünde elenir ve redüktöre asla ulaşmaz. Gerekçe: Bir tuşu basılı tutmak yinelenen harfleri otomatik ilerletir, tek bir basılı tutulan hatayı art arda sayılan birden fazla hataya dönüştürür ve anti-cheat için kullanılan tuş vuruş zamanlama verisine makine düzeyinde kusursuz aralıklar enjekte eder.

**Bloklama kararının kazandırdıkları:** Üretilen metin her oyuncuda birebir aynı olur. Bu, sunucu doğrulamasını "metin ne yazıldı" sorusundan "hangi indeks ne zaman tamamlandı" sorusuna indirir. Backspace suistimali ortadan kalkar. Hata cezası ayrı bir mekanik yazmadan doğal olarak zaman kaybı biçiminde ortaya çıkar.

**Küçük harf kararının kazandırdıkları:** Her tuş vuruşu tam olarak bir karakterdir. Klavye düzeni kaynaklı sorunların neredeyse tamamı kapanır. Giriş modülü tek bir küçük saf fonksiyona iner.

### 2.2 Metrikler

**WPM:** Klasik standart, 5 karakter = 1 kelime. Monkeytype, TypeRacer ve 10FastFingers ile karşılaştırılabilirlik için gerçek kelime sayımı yerine bu seçildi.

```
wpm = (doğru_karakter_sayısı / 5) / (geçen_süre_dakika)
```

**Doğruluk:** İlk denemede doğru basış oranı.

```
doğruluk = ilk_denemede_doğru_basış / toplam_basış
```

**Bileşik puan:**

```
puan = wpm × doğruluk
```

Bloklama modunda yanlış tuş zaten zaman kaybettirdiği için bu formül aynı hatayı iki kez cezalandırır. Bu bilinçli bir tercihtir; doğruluğu ödüllendirir. Karesel varyant (`wpm × doğruluk²`) sıralamayı hızdan doğruluğa çevirdiği için reddedildi.

### 2.3 Metin kaynağı

Dört ayrı içerik hattı vardır. İlk üçü yazılan metindir ve 2.1'deki karakter setine tabidir; dördüncüsü okunan metindir ve kısıt dışıdır.

| Hat | Kaynak | Kısıt | Not |
|---|---|---|---|
| Simulator akışı | Sıklık katmanlarına ayrılmış kelime listesi | `a–z` + boşluk | Zorluk artışı katman geçişiyle |
| Gauntlet dalgası | Tier'a atanmış temalı kelime havuzu | `a–z` + boşluk | Bkz. 4.4, 4.6 |
| Boss pasajı | Özgün düzyazı, normalize edilmiş | `a–z` + boşluk | Doğrusal, sıralı; bkz. 4.6 |
| Anlatı çerçevesi | Özgün cyberpunk metni | **Yok** | Okunur, yazılmaz; normal imla |

Kelime havuzları kamu malı kaynaklardan türetilir (bkz. 4.6). Anlatı ve boss pasajları özgün olarak yazılır.

---

## 3. Simulator (antrenman modu)

**Amaç:** Isınma, beceri ölçümü, oyuncu istatistiklerinin kaynağı.

**Mekanik:** Kesintisiz akış, artan zorluk. Tek satır kelime akışı, bloklama girişi.

**Ölçülenler:** WPM, doğruluk, bileşik puan, tuş başına gecikme dağılımı.

**Kalıcılık:** Koşu geçmişi yereldir. MVP'de sunucu tarafı sıralama yoktur.

---

## 4. Gauntlet (RPG kampanya)

### 4.1 Savaş modeli

**Dalga + süre baskısı birleşik.** Kelimeler ekranın üstünden belirir ve aşağı iner. Ekranın altındaki *tehlike hattına* ulaşan kelime, oyuncunun bütünlük barından hasar keser.

Ayrı bir geri sayım sayacı **yoktur**. Dalganın inişi zamanlayıcının kendisidir. İki ayrı zamanlayıcı aynı şeyi ölçeceği ve oyuncuyu bölünmüş dikkate zorlayacağı için reddedildi.

### 4.2 Hedef kilitleme

Ekranda aynı anda birden çok kelime bulunduğundan hedef seçimi gerekir:

1. Boşta yapılan ilk basış, o harfle başlayan kelimeyi hedef olarak kilitler.
2. Kilit, kelime tamamlanana veya kelime yok olana kadar sürer.
3. Kilitliyken diğer kelimelere geçilemez.

**Üretici kısıtı:** Aynı anda ekranda aynı harfle başlayan iki aktif kelime bulunamaz. Kelime üreticisi aktif baş harf kümesini takip etmek zorundadır.

### 4.3 Boşta yanlış basış

Hedef kilitli değilken hiçbir aktif kelimeyle eşleşmeyen tuşa basılırsa **yeni bir kelime doğar.** Baskıyı artıran aktif ceza.

İki koruma zorunludur:

- **Tavan:** Ekranda en fazla `N` aktif kelime bulunabilir (başlangıç değeri 8, ayarlanacak). Tavana ulaşıldığında ceza spawn'ı çalışmaz. Bu olmadan panik → yanlış basış → daha çok kelime → daha çok panik sarmalı karşılaşmayı kurtarılamaz hâle getirir.
- **Kilitliyken muafiyet:** Bir kelimenin ortasındayken yapılan yanlış basış kelime doğurmaz, yalnızca yok sayılır. Aksi hâlde uzun kelimeler orantısız riskli olur.

### 4.4 Prosedürel üretim

Düşman ve tier'lar elle tasarlanmaz. Zorluk üç parametreyle modellenir:

| Parametre | Açıklama |
|---|---|
| `kelime_uzunluk_bandı` | Seçilecek kelimelerin min–maks karakter aralığı |
| `spawn_aralığı` | Yeni kelime doğma sıklığı (ms) |
| `iniş_hızı` | Kelimenin tehlike hattına ulaşma süresi (px/s) |

Bir **tier** bu üçünün bir parametre setidir. Bir **düşman**, bir parametre seti + bir davranış değiştirici + bir sprite referansından oluşan bir veri satırıdır. Yeni düşman eklemek kod değil, JSON satırı yazmaktır.

**Zorunlu araç:** Bu parametreleri çalışma anında değiştirebilen bir debug paneli, ilk yazılacak araçlardan biridir. Prosedürel üretim denge işini ortadan kaldırmaz, yalnızca merkezileştirir — formül bozuksa tüm karşılaşmalar aynı anda bozulur.

### 4.5 MVP kapsamı — dikey dilim

3 tier × 5 karşılaşma + 1 boss. Tam kampanya değil. Döngü çalışıyorsa genişletmek ucuzdur; çalışmıyorsa 40 karşılaşmalık içerik çöpe gitmez.

### 4.6 Hikâye katmanı

Hikâye üç ayrı biçimde taşınır. Hiçbiri dalga mekaniğini bozmaz.

**Anlatı çerçevesi.** Karşılaşmalar arasında, tier girişlerinde ve boss öncesinde görünen metin. Okunur, yazılmaz — karakter seti kısıtı uygulanmaz, normal imlayla yazılır. Özgün cyberpunk anlatısı; dikey dilim için toplam 500–800 kelime yeterlidir.

**Atlanabilirlik zorunludur.** Rekabetçi oyuncu ikinci oynayışta metni geçmek isteyecektir. Zorunlu anlatı tekrar oynanabilirliği öldürür.

**Temalı kelime havuzu.** Her tier'ın dalga kelimeleri, o tier'a atanmış bir havuzdan seçilir. Havuzlar kamu malı metinlerden türetilir; hikâye *sırası* yoktur, hikâye *dokusu* vardır. Prosedürel üretimle tam uyumludur.

*Hacim kısıtı:* Havuz hem `kelime_uzunluk_bandı` filtresinden hem de "aynı baş harfle iki aktif kelime olamaz" kuralından geçer. Tek bir kısa eserin dağarcığı, özellikle uzun kelime bantlarında incelir ve tekrar hissi doğurur. **Tier başına en az 400 benzersiz kelime**; gerekirse tier başına 2–3 eser birleştirilir.

**Boss'ta mod değişimi.** Boss dövüşünde ekran dalgadan çıkar, tek bir düzyazı pasajına geçer. Sıralı, tek hedefli — Simulator döngüsünün yeniden kullanımı, üstüne HP barı ve bir tehdit kaynağı.

| Boss modu kuralı | Karar |
|---|---|
| Giriş modeli | Bloklama; yanlış tuş yok sayılır (Simulator ile aynı) |
| Kelime doğurma | Yok. Dalga mekaniği devre dışı |
| Baskı kaynağı | Boss sabit ritimde bütünlükten hasar keser |
| Kazanma | Bütünlük tükenmeden pasajı bitirmek |
| Pasaj metni | Özgün, normalize edilmiş (`a–z` + boşluk) |

Yarış doğrudan yazma hızı ile boss'un saati arasındadır; ayrı bir mekanik gerekmez. Yan fayda: boss dövüşleri normal karşılaşmalardan belirgin biçimde farklı hisseder.

### 4.7 Kelime havuzu üretim hattı

Kaynak: Project Gutenberg. **Çifte telif kontrolü gereklidir** — ABD'de 1930 ve öncesi yayın kamu malıdır, Türkiye ve AB ise yazarın ölümünden 70 yıl kuralını uygular. İkisini birden karşılamak için yazarı 1956'dan önce ölmüş eserler seçilir. Gutenberg dosyalarındaki PG lisans başlığı ve altbilgisi temizlenmelidir; ticari üründe PG markası taşıyan dosyalar olduğu gibi paketlenmez. *Bu hukuki tavsiye değildir; lansman öncesi doğrulanmalıdır.*

Hat: indir → PG başlık/altbilgi kes → küçük harfe indir → `a–z` dışını at → frekans say → sıklık katmanlarına böl → uzunluk bandına göre etiketle → tier'a ata → JSON paketle.

*Temizlik notu:* Ham çıktı dönemsel sözcükler (`thee`, `whilst`, `hath`) ve özel adlar içerir. Frekans eşiği çoğunu eler; liste yine de bir kez elden geçirilmelidir.

Beklenen boyut: 5–8 bin benzersiz kelime, sıkıştırılmış birkaç yüz KB. Statik varlık olarak paketlenir; veritabanı gerekmez.

---

## 5. Görsel yaklaşım

**Minimal piksel sprite + tipografi.**

- Ana görsel dil metindir. Düşman, ekranda süzülen kelimenin kendisidir.
- Hasar, harflerin sönmesi/parçalanmasıyla gösterilir. HP, kelime altındaki çizgidir.
- Sprite'lar düşman *kimliği* değil, kelime arkasındaki dekordur. **5–6 paylaşılan silüet + renk varyasyonu**, düşman türü başına ayrı varlık değil. Prosedürel üretim sonsuz düşman ürettiği için bu zorunludur.
- Efektler CSS ve SVG ile yapılır. Piksel sprite'lar `image-rendering: pixelated` ile ölçeklenir.
- Tema: cyberpunk, yüksek kontrast, düşük dikkat dağıtımı.

**Phaser 3 MVP'den çıkarılmıştır.** Tipografi ağırlıklı görsel dil ve DOM/CSS efektleri yeterlidir. Phaser'ın React içine gömülmesinin bilinen sürtünmesi ve bundle maliyeti bu aşamada karşılığını vermez. Velocity Highway geldiğinde yeniden değerlendirilecektir.

---

## 6. Teknik mimari

### 6.1 MVP yığını

| Katman | Seçim |
|---|---|
| Frontend | React + TypeScript |
| Durum yönetimi | Zustand |
| Görsel | CSS / SVG + piksel sprite |
| Kalıcılık | IndexedDB (yerel) |
| Arka uç | **Yok** |
| Dağıtım | Statik site |

**Hesap sistemi MVP'de yoktur.** İlerleme tamamen yereldir. Bunun bedeli, sıralama tablosunun MVP'den çıkmasıdır. Karşılığında arka uç tamamen gereksiz hâle gelir: sunucu maliyeti sıfır, dağıtım tek komut, tek kişilik ekip için taşınabilir bir yük.

### 6.2 Ertelenen bileşenler

Aşağıdakiler v1 dokümanında MVP kapsamındaydı; artık PvP fazına ertelenmiştir:

Node.js + Express · PostgreSQL · Redis · Socket.io · Phaser 3 · Elo/derecelendirme · eşleştirme · sunucu tarafı anti-cheat.

### 6.3 Giriş gecikmesi

v1'deki "sub-millisecond input registration" hedefi gerçekçi değildi. USB polling (1000 Hz'de zaten 1 ms), OS olay kuyruğu, tarayıcı olay döngüsü ve ekran yenileme hızı bu sınırın altına inmeyi engeller.

**Yeni hedef:** input-to-paint p99 < 30 ms.

Uygulama notları: `keydown` üzerinde doğrudan dinleyici, `event.key` kullanımı (düzen farkındalığı için doğru olan), zaman damgası için `performance.now()`, render'ın `requestAnimationFrame` ile tek kareye bağlanması.

### 6.4 Ağ mimarisi (PvP fazı için tasarım kararı)

MVP'de uygulanmayacak, ancak karar alınmıştır:

**Asimetrik tick.** Bloklama kuralı sayesinde metin deterministiktir; ağ üzerinden karakter değil, indeks + zaman farkı taşınır.

- **İstemci → sunucu:** ~50 ms'de bir tuş tamponu. Zaman damgaları yerel olarak `performance.now()` ile yakalanır, pakette delta olarak gider. Zamanlama hassasiyeti ağ tick'ine bağlı değildir.
- **Sunucu → istemci:** 100 ms'de bir, tüm oyuncuları içeren tek anlık görüntü. Oyuncu başına saniyede ~170 mesaj yerine ~10 mesaj.
- **Yerel imleç ağı beklemez.** Kendi girişi tamamen iyimser çizilir. Rakipler snapshot'lar arasında interpolasyonla hareket eder.

Bu mimari, giriş gecikmesini ağ tick oranından tamamen ayırır.

**Bölge stratejisi (v1'de eksikti):** Yazma yarışında 40 ms ile 120 ms arasındaki fark maçı belirler. PvP fazında bölgesel sunucu ve bölge-içi eşleştirme zorunludur.

---

## 7. Anti-cheat

MVP'de PvE ve yerel olduğu için aciliyet yoktur. Ancak veri **baştan itibaren** toplanmalıdır, çünkü sonradan geriye dönük üretilemez.

**Toplanacak sinyaller:** tuş başına zaman damgaları, ilk-deneme doğruluğu, tuş aralıklarının varyansı.

**Bilinen açık ve kapanışı:** Bloklama + yanlış tuşun yok sayılması, tuş yağmuru (mashing) saldırısına kapı aralar — rastgele basan bir makro sonunda doğru harfi bulur. Bu, `puan = wpm × doğruluk` formülü tarafından kendiliğinden cezalandırılır: doğruluğu %10'a düşen bir makronun bileşik puanı da çöker. Ayrı bir tespit mekanizması gerekmez. Bu nedenle doğruluk, oyun mekaniğini etkilemese bile **her koşuda kaydedilmek zorundadır.**

**Sunucu tarafı (PvP fazı):** İstemci geçen süreyi iddia eder, sunucu paketin varış zamanını kaydeder. Maç boyunca iddia edilen ve gözlemlenen süreler arasındaki sapma, saat manipülasyonunun tespit yoludur.

**Yanlış pozitif politikası:** 220+ WPM yazan gerçek insanlar vardır ve donanım seviyesinde makro çalıştıran klavyeler heuristiklere yakalanmaz. Otomatik ban yerine kademeli yaklaşım: gölge kuyruk → insan incelemesi → itiraz mekanizması.

---

## 8. Yol haritası

v1'deki fazlandırma, "ilk adım WebSocket sunucusu" varsayımıyla kurulmuştu. Bu varsayım geçersizdir.

| Faz | Odak | Çıktılar |
|---|---|---|
| **0 — Dikey dilim** | Doğrulama | Giriş motoru, Simulator temel döngüsü, tek oynanabilir Gauntlet tier'ı, debug paneli |
| **1 — MVP** | Yayın | Simulator tam, Gauntlet 3 tier + boss, yerel ilerleme, prosedürel üretim, piksel + tipografi görsel katman |
| **2 — Sunucu** | Sosyal | Hesap sistemi, Postgres, sıralama tabloları, sunucu tarafı doğrulama |
| **3 — PvP** | Rekabet | Socket.io, asimetrik tick, The Pit, Elo, bölgesel eşleştirme |
| **4 — Ölçek** | Genişleme | Velocity Highway, lobi + oylama, Phaser değerlendirmesi, sezon ve kozmetik ekonomi |

**Zaman hedefi:** "Süre serbest, kalite öncelikli" tercih edildi. Solo projelerde bu, zorlayıcı kısıt olmadığı için kapsam büyümesi riskini doğurur. Kalite hedefinden vazgeçmeden, **Faz 0 için dıştan görünür bir tarih** belirlenmesi önerilir.

---

## 9. Ertelenen ekonomik ve sosyal sistemler

Aşağıdakiler vizyonun parçasıdır ancak MVP kapsamı dışındadır:

- **Sezon geçişi:** Aylık döngüler, kozmetik yükseltmeler.
- **Klanlar:** Kolektif WPM skorlaması, klan sıralamaları.
- **Key-Skin koleksiyonu:** Gauntlet ilerlemesinden düşen kozmetikler.
- **Bahis (Type-Credits):** ⚠️ **Hukuki inceleme gerektirir.** Type-Credits gerçek parayla satın alınabilir hâle gelirse, "beceri oyunu" savunmasına rağmen birçok yargı bölgesinde kumar mevzuatına girebilir. Türkiye'deki çevrimiçi bahis düzenlemeleri özellikle kısıtlayıcıdır. Bu özellik ürünün merkezine yerleştirilmeden önce hukuk görüşü alınmalıdır. *Bu bir hukuki tavsiye değil, ürün riski uyarısıdır.*

---

## 10. Geliştirme ilkeleri

- **Rekabetçi bütünlük önce gelir.** Varyans ekleyen her mekanik, beceri sinyalini zayıflatma maliyetiyle birlikte değerlendirilir. (The Pit'teki glitch saldırıları bu gerilimin somut örneğidir; dereceli modda dengelenmeli veya ayrı moda taşınmalıdır.)
- **Sadelik.** Cyberpunk temalı, dikkat dağıtmayan arayüz.
- **Veri baştan toplanır.** Metrik ve zamanlama verisi geriye dönük üretilemez.
- **İçerik veri olarak tanımlanır.** Kod değişikliği gerektiren içerik ekleme, solo projede ölçeklenmez.
- **Mobil**, PC/mekanik klavye deneyimi oturduktan sonra ele alınır.

---

## 11. Açık kalan başlıklar

Karara bağlanmamış, sıradaki oturumların konusu:

1. Prosedürel zorluk parametrelerinin somut başlangıç değerleri ve tier eğrisi
2. Boss modu denge parametreleri (hasar ritmi, pasaj uzunluğu, bütünlük havuzu)
3. Dikey dilimin anlatı taslağı ve tier temaları
4. Tier başına kaynak eser seçimi
5. İlerleme ve ödül döngüsü (XP formülü, Key-Skin düşme oranları, tier kilit açma koşulu)
6. Faz 0 dikey dilim tarihi
7. Test stratejisi (giriş motoru için deterministik replay testi, zorluk formülü için simülasyon)
8. Veri modeli ve IndexedDB şeması
9. Analitik: hangi olaylar toplanacak
10. KVKK/GDPR ve veri saklama politikası (Faz 2, hesap sistemiyle birlikte)
11. Faz 1 sonrası ilk genişleme yönü: sunucu mu, PvP mi
