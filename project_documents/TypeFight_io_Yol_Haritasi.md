# TypeFight.io — Yol haritası ve görev listesi

**Tarih:** 3 Eylül 2026
**Yöntem:** Tek kişi, ağırlıklı olarak yapay zekâ destekli geliştirme (vibe coding)
**Referans:** TypeFight.io Spesifikasyonu v2.0

---

## 0. Bu planın vibe coding'e göre neyi değiştirdiği

Görevler, **tek oturumda bitirilebilecek ve sonucu gözle doğrulanabilecek** büyüklüğe bölündü. Bir görevin çıktısı çalışan ve commit edilebilir bir şey değilse, görev fazla büyüktür.

Sıra da buna göre değişti: veri hatları ve arayüz erkene, zamanlama ve denge işleri sona alındı. Yapay zekâ ilkini hızlı ve doğru yazar, ikincisinde sessizce yanılır.

### Zorunlu çalışma kuralları

| Kural | Gerekçe |
|---|---|
| Spesifikasyon repoda dursun, her oturumda bağlama verilsin | Oturumlar arası mimari kayması en büyük risk |
| `CLAUDE.md` / `AGENTS.md` yaz: yığın, klasör yapısı, adlandırma, yasaklar | Aynı kararları her seferinde yeniden anlatmamak için |
| TypeScript `strict` açık, `any` yasak | Derleyici, kaymayı yakalayan tek otomatik bekçidir |
| Her görev sonunda commit | İki bozuk şey aynı anda var olmasın |
| Oyun mantığı saf fonksiyonlarda, React'ten ayrı | Test edilebilirlik ve prompt edilebilirlik aynı şeyden gelir |
| İçerik JSON'da, kodda değil | Zaten kararlaştırıldı; vibe coding'de değeri iki katına çıkar |

### Vibe coding'e bırakılmayacak işler

Bunlar elle yazılmalı veya en azından satır satır okunmalı:

- **Giriş motorunun zamanlama katmanı.** `performance.now()` yakalama noktası, `requestAnimationFrame` bağlama, olay kuyruğu sırası. Yapay zekâ burada doğru *görünen* ama bir kare geciken kod yazar ve bu testle yakalanmaz.
- **Denge parametreleri.** Oynamadan ayarlanamaz. Prompt edilemez.
- **Deterministik replay testi.** Testin kendisi doğru değilse tüm güvence sahtedir.
- **Telif kontrolü.** Kaynak eser seçimini modele bırakmayın.

---

## Faz 0 — Dikey dilim

**Amaç:** Döngünün eğlenceli olup olmadığını öğrenmek. Cila yok, içerik yok, tek tier.

**Çıkış kriteri:** Bir tier baştan sona oynanabiliyor, parametreler oyun içinde canlı ayarlanabiliyor, giriş gecikmesi ekranda ölçülüyor.

### A — İskelet

- [ ] **A1** Vite + React + TypeScript kurulumu, `strict` açık
- [ ] **A2** Spesifikasyonu repoya koy, `CLAUDE.md` yaz (yığın, klasör yapısı, yasaklar)
- [ ] **A3** Klasör yapısı: `engine/` (saf mantık), `ui/`, `content/`, `store/`
- [ ] **A4** Zustand store iskeleti ve temel tipler
- [ ] **A5** Ekran iskeleti: menü → oyun → sonuç

### B — Giriş motoru

Projenin en kritik parçası. Sırayı bozmayın: saf mantık önce, tarayıcı bağlama sonra.

- [ ] **B1** Saf reducer: `(state, key, timestamp) => state`. Bloklama, indeks ilerlemesi, ilk-deneme doğruluk sayacı. React yok, DOM yok.
- [ ] **B2** B1 için birim testler. Bloklama, yanlış tuş, kelime geçişi, sınır durumları. *Bu testleri okuyun, atlamayın.*
- [ ] **B3** `keydown` köprüsü: tuş → reducer, `performance.now()` zaman damgası tamponu
- [ ] **B4** `requestAnimationFrame` render bağlama
- [ ] **B5** Gecikme ölçüm HUD'ı: input-to-paint p50/p99, ekranda canlı

### C — Metrikler

- [ ] **C1** WPM, doğruluk, bileşik puan hesabı — saf fonksiyon
- [ ] **C2** C1 için birim testler
- [ ] **C3** Koşu sonu ekranı
- [ ] **C4** IndexedDB koşu kaydı (tuş zaman damgaları dâhil — sonradan üretilemez)

### D — Kelime havuzu hattı

Vibe coding'in en verimli olduğu blok. Tek oturumda bitebilir.

- [ ] **D1** Kaynak eser seçimi + telif kontrolü *(elle yapılacak)*
- [ ] **D2** İndirme + PG başlık/altbilgi temizleme scripti
- [ ] **D3** Normalizasyon: küçük harf, `a–z` + boşluk dışını at
- [ ] **D4** Frekans sayımı, sıklık katmanlarına bölme
- [ ] **D5** Uzunluk bandı etiketleme, tier ataması
- [ ] **D6** JSON çıktı + TypeScript tip tanımı
- [ ] **D7** Elle gözden geçirme: dönemsel sözcükler, özel adlar

### E — Gauntlet dalga çekirdeği

- [ ] **E1** Kelime spawn ve iniş sistemi
- [ ] **E2** Hedef kilitleme; benzersiz baş harf kısıtını üreticiye koy
- [ ] **E3** Boşta yanlış basış → ceza spawn'ı, aktif kelime tavanı
- [ ] **E4** Tehlike hattı, bütünlük barı, hasar
- [ ] **E5** Tek oynanabilir tier, uçtan uca

### F — Debug paneli

Faz 0 bitmeden yazılmalı; sonrası çok geç olur.

- [ ] **F1** Canlı parametre kaydırıcıları: uzunluk bandı, spawn aralığı, iniş hızı, tavan
- [ ] **F2** Durum müfettişi: aktif kelimeler, kilit durumu, anlık WPM
- [ ] **F3** Parametre setini JSON olarak dışa aktar

### G — Değerlendirme

- [ ] **G1** 30 dakika kesintisiz oyna. Eğlenceli mi?
- [ ] **G2** Gecikme hedefi tutuyor mu (p99 < 30 ms)?
- [ ] **G3** Devam / düzelt / yön değiştir kararı

---

## Faz 1 — MVP

**Amaç:** Yayınlanabilir sürüm. Simulator tam, Gauntlet 3 tier + boss.

> Spesifikasyondaki boss modu, Faz 0'dan buraya taşındı. Dalga döngüsü doğrulanmadan boss yazmak erken; boss zaten Simulator döngüsünün üstüne kuruluyor.

### H — Simulator tamamlama

- [ ] **H1** Sıklık katmanı geçişiyle artan zorluk
- [ ] **H2** Koşu geçmişi ve kişisel rekor ekranı
- [ ] **H3** Tuş başına gecikme dağılımı görselleştirmesi

### I — Boss modu

- [ ] **I1** Doğrusal pasaj modu (Simulator döngüsünün yeniden kullanımı)
- [ ] **I2** Boss HP barı, sabit ritimli hasar
- [ ] **I3** Mod geçiş animasyonu: dalga → pasaj
- [ ] **I4** Boss pasaj metinleri, normalize edilmiş

### J — İçerik

- [ ] **J1** 3 tier parametre seti, debug panelinden ayarlanmış
- [ ] **J2** Tier başına kelime havuzu ataması (min. 400 benzersiz kelime)
- [ ] **J3** Anlatı çerçevesi metni (500–800 kelime, özgün)
- [ ] **J4** Anlatı ekranları + **atlama düğmesi**
- [ ] **J5** 15 karşılaşma + 1 boss akışı

### K — Görsel katman

- [ ] **K1** Cyberpunk palet ve tipografi sistemi
- [ ] **K2** 5–6 paylaşılan piksel silüet + renk varyasyonu
- [ ] **K3** Hasar efektleri: harf sönmesi, parçalanma
- [ ] **K4** `image-rendering: pixelated` ölçekleme
- [ ] **K5** Menü ve HUD cilası

### L — İlerleme

- [ ] **L1** Tier kilit açma koşulu
- [ ] **L2** XP ve seviye formülü
- [ ] **L3** IndexedDB şeması ve göç stratejisi
- [ ] **L4** İlerleme dışa/içe aktarma (yerel veri kaybına karşı)

### M — Yayın

- [ ] **M1** Bundle boyutu ve yükleme süresi denetimi
- [ ] **M2** Tarayıcı uyumluluğu (Chrome, Firefox, Safari)
- [ ] **M3** Statik dağıtım kurulumu
- [ ] **M4** Analitik olayları (hangi tier'da bırakılıyor)
- [ ] **M5** Geri bildirim kanalı

---

## Faz 2 — Sunucu

Hesap sistemi, Postgres veya Supabase, sıralama tabloları, sunucu tarafı skor doğrulama, KVKK/GDPR politikası.

**Kritik kural:** İstemci skor tablosuna doğrudan yazamaz. Gönderim, tuş zaman damgalarını doğrulayan bir sunucu fonksiyonundan geçer.

## Faz 3 — PvP

Socket.io, asimetrik tick, The Pit, Elo, bölgesel eşleştirme, glitch mekanikleri.

## Faz 4 — Ölçek

Velocity Highway, lobi ve oylama, Phaser yeniden değerlendirmesi, sezon ve kozmetik ekonomi, bahis için hukuki inceleme.

---

## Tarih önerisi

Faz 0 için dıştan görünür bir tarih koyun. "Süre serbest" tercihi solo projede kapsam kaymasının ana sebebidir; tek zorlayıcı kısıt sizin koyduğunuz tarihtir.

Faz 0'ın G bloğuna kadar olan kısmı, düzenli çalışılırsa birkaç haftalık bir iştir. Tarihi oraya koyun, sonrasını G1'in sonucuna göre planlayın.
