// Başlangıç Örnek Sevkiyat Verileri (Temsilci ve Ekleme Tarihli)
const INITIAL_SHIPMENTS = [
  {
    id: "SEV-1001",
    customerName: "Kadıköy Mağazası - Hakan Bey",
    representative: "Mehmet Kaya (Saha Satış)",
    deliveryAddress: "Caferağa Mah. Moda Cad. No:45/A Kadıköy / İstanbul",
    status: "Yolda",
    shipmentOrder: "1. Sevk",
    timeOfDay: "Sabah Sevkiyatı",
    notes: "Mağaza arkası mal kabul kapısından teslim edilecek.",
    dayOfWeek: 1, // Pazartesi
    weekKey: "2026-08-17",
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
  },
  {
    id: "SEV-1002",
    customerName: "Beşiktaş Mağazası - Mustafa Bey",
    representative: "Ahmet Yılmaz (Mağaza)",
    deliveryAddress: "Cihannüma Mah. Barbaros Bulvarı No:88 Beşiktaş / İstanbul",
    status: "Hazırlanıyor",
    shipmentOrder: "2. Sevk",
    timeOfDay: "Öğleden Sonra Sevkiyatı",
    notes: "Sürücü gelmeden 15 dk önce aramalı.",
    dayOfWeek: 1, // Pazartesi
    weekKey: "2026-08-17",
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  },
  {
    id: "SEV-1003",
    customerName: "Selin Yılmaz (Özel Teslimat)",
    representative: "Canan Hanım",
    deliveryAddress: "Barbaros Mah. Şerifali Cad. No:12 Ataşehir / İstanbul",
    status: "Teslim Edildi",
    shipmentOrder: "1. Sevk",
    timeOfDay: "Sabah Sevkiyatı",
    notes: "Teslim alındı.",
    dayOfWeek: 2, // Salı
    weekKey: "2026-08-17",
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  },
  {
    id: "SEV-1004",
    customerName: "Nişantaşı Mağazası - Ece Hanım",
    representative: "Mehmet Kaya (Saha Satış)",
    deliveryAddress: "Abdi İpekçi Cad. No:22 Nişantaşı, Şişli / İstanbul",
    status: "Beklemede",
    shipmentOrder: "1. Sevk",
    timeOfDay: "Sabah Sevkiyatı",
    notes: "Vitrindeki sergileme için ilk teslimat olmalı!",
    dayOfWeek: 3, // Çarşamba
    weekKey: "2026-08-17",
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
  },
  {
    id: "SEV-1005",
    customerName: "Bursa Merkez Mağaza - Ali Bey",
    representative: "Murat Bey (Lojistik)",
    deliveryAddress: "Fatih Sultan Mehmet Bulvarı No:104 Nilüfer / Bursa",
    status: "Beklemede",
    shipmentOrder: "1. Sevk",
    timeOfDay: "Gün Boyu / Esnek",
    notes: "Şehir dışı sevkiyat.",
    dayOfWeek: 4, // Perşembe
    weekKey: "2026-08-17",
    createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString()
  },
  {
    id: "SEV-1006",
    customerName: "Bakırköy Şubesi - Gökhan Bey",
    representative: "Ahmet Yılmaz (Mağaza)",
    deliveryAddress: "İncirli Cad. No:56 Bakırköy / İstanbul",
    status: "Beklemede",
    shipmentOrder: "1. Sevk",
    timeOfDay: "Öğleden Sonra Sevkiyatı",
    notes: "Asansörlü araç gerekiyor.",
    dayOfWeek: 5, // Cuma
    weekKey: "2026-08-17",
    createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString()
  },
  {
    id: "SEV-1007",
    customerName: "İzmir Alsancak Mağaza - Caner Bey",
    representative: "Tevfik Bey (Proje)",
    deliveryAddress: "Atatürk Cad. No:190 Alsancak, Konak / İzmir",
    status: "Beklemede",
    shipmentOrder: "1. Sevk",
    timeOfDay: "Sabah Sevkiyatı",
    notes: "Açılış özel sevkiyatı.",
    dayOfWeek: 6, // Cumartesi
    weekKey: "2026-08-17",
    createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString()
  }
];
