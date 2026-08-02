# erhan-x-oto-haber

`@erhanbagirtlak` X hesabı için haber sitelerini tarayan, haber içeriğinden kısa ve tarafsız bir özet hazırlayan otomatik paylaşım sistemi.

## Paylaşım biçimi

Normal haber:

```text
Cumhurbaşkanı Erdoğan, gençlerle bir araya gelerek yürütülen projeler ve gelecek hedefleri hakkında konuştu.
```

Gerçek son dakika gelişmesi:

```text
#SONDAKİKA | İstanbul'da etkili olan sağanak nedeniyle bazı yollar geçici olarak trafiğe kapatıldı.
```

## Temel özellikler

- Haber sitelerini RSS kullanmadan ana sayfaları üzerinden tarar.
- Makalenin başlık, açıklama ve yayın zamanı bilgilerini okur.
- Tıklama tuzağı ifadeleri temizleyerek tek cümlelik özet hazırlar.
- Yalnızca başlığında açıkça son dakika/flaş ifadesi bulunan gelişmelere `#SONDAKİKA` ekler.
- URL ve metin benzerliğine göre tekrar paylaşımını engeller.
- İlk çalışmada mevcut haberleri kaydeder; eski haberleri topluca paylaşmaz.
- `DRY_RUN=true` durumunda X hesabına gönderim yapmadan metni test eder.

## Güvenli kurulum sırası

1. Projeyi önce `DRY_RUN=true` ile çalıştırın.
2. GitHub deposunda **Settings → Secrets and variables → Actions** bölümüne X API anahtarlarını ekleyin.
3. Hazırlanan metinleri kontrol edin.
4. Yayına geçmek için Actions Variables bölümündeki `DRY_RUN` değerini `false` yapın.

## Gerekli GitHub Secrets

- `X_API_KEY`
- `X_API_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_TOKEN_SECRET`

## İsteğe bağlı GitHub Variables

- `DRY_RUN`: Başlangıçta `true`
- `MAX_POSTS_PER_RUN`: Varsayılan `2`
- `INCLUDE_SOURCE_LINK`: Varsayılan `false`
- `SOURCE_NAMES`: Yalnızca belirli kaynaklar taranacaksa virgülle ayrılmış kaynak adları

## Otomatik çalışma

`.github/workflows/auto-news.yml` iş akışı 15 dakikada bir çalışır. İlk çalışma yalnızca mevcut bağlantıları kaydeder. Sonraki çalışmalarda bulunan yeni haberler işlenir.

## Önemli not

X'e otomatik gönderim yalnızca resmî X API üzerinden yapılır. API anahtarlarını hiçbir zaman kaynak koduna veya README dosyasına yazmayın.
