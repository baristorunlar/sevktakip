// Başlangıç Örnek Sevkiyat Verileri (Haftaya özel weekKey ile)
const INITIAL_SHIPMENTS = [
  {
    id: "SEV-1001",
    customerName: "Kadıköy Mağazası - Hakan Bey",
    deliveryAddress: "Caferağa Mah. Moda Cad. No:45/A Kadıköy / İstanbul",
    status: "Yolda", // Beklemede, Hazırlanıyor, Yolda, Teslim Edildi, İptal
    shipmentOrder: "1. Sevk",
    timeOfDay: "Sabah Sevkiyatı",
    notes: "Mağaza arkası mal kabul kapısından teslim edilecek.",
    dayOfWeek: 1, // Pazartesi
    weekKey: "2026-08-17", // Belirli haftaya bağlı
    createdAt: new Date().toISOString()
  },
  {
    id: "SEV-1002",
    customerName: "Beşiktaş Mağazası - Mustafa Bey",
    deliveryAddress: "Cihannüma Mah. Barbaros Bulvarı No:88 Beşiktaş / İstanbul",
    status: "Hazırlanıyor",
    shipmentOrder: "2. Sevk",
    timeOfDay: "Öğleden Sonra Sevkiyatı",
    notes: "Sürücü gelmeden 15 dk önce aramalı.",
    dayOfWeek: 1, // Pazartesi
    weekKey: "2026-08-17",
    createdAt: new Date().toISOString()
  },
  {
    id: "SEV-1003",
    customerName: "Selin Yılmaz (Özel Teslimat)",
    deliveryAddress: "Barbaros Mah. Şerifali Cad. No:12 Ataşehir / İstanbul",
    status: "Teslim Edildi",
    shipmentOrder: "1. Sevk",
    timeOfDay: "Sabah Sevkiyatı",
    notes: "Teslim alındı.",
    dayOfWeek: 2, // Salı
    weekKey: "2026-08-17",
    createdAt: new Date().toISOString()
  },
  {
    id: "SEV-1004",
    customerName: "Nişantaşı Mağazası - Ece Hanım",
    deliveryAddress: "Abdi İpekçi Cad. No:22 Nişantaşı, Şişli / İstanbul",
    status: "Beklemede",
    shipmentOrder: "1. Sevk",
    timeOfDay: "Sabah Sevkiyatı",
    notes: "Vitrindeki sergileme için ilk teslimat olmalı!",
    dayOfWeek: 3, // Çarşamba
    weekKey: "2026-08-17",
    createdAt: new Date().toISOString()
  },
  {
    id: "SEV-1005",
    customerName: "Bursa Merkez Mağaza - Ali Bey",
    deliveryAddress: "Fatih Sultan Mehmet Bulvarı No:104 Nilüfer / Bursa",
    status: "Beklemede",
    shipmentOrder: "1. Sevk",
    timeOfDay: "Gün Boyu / Esnek",
    notes: "Şehir dışı sevkiyat.",
    dayOfWeek: 4, // Perşembe
    weekKey: "2026-08-17",
    createdAt: new Date().toISOString()
  },
  {
    id: "SEV-1006",
    customerName: "Bakırköy Şubesi - Gökhan Bey",
    deliveryAddress: "İncirli Cad. No:56 Bakırköy / İstanbul",
    status: "Beklemede",
    shipmentOrder: "1. Sevk",
    timeOfDay: "Öğleden Sonra Sevkiyatı",
    notes: "Asansörlü araç gerekiyor.",
    dayOfWeek: 5, // Cuma
    weekKey: "2026-08-17",
    createdAt: new Date().toISOString()
  },
  {
    id: "SEV-1007",
    customerName: "İzmir Alsancak Mağaza - Caner Bey",
    deliveryAddress: "Atatürk Cad. No:190 Alsancak, Konak / İzmir",
    status: "Beklemede",
    shipmentOrder: "1. Sevk",
    timeOfDay: "Sabah Sevkiyatı",
    notes: "Açılış özel sevkiyatı.",
    dayOfWeek: 6, // Cumartesi
    weekKey: "2026-08-17",
    createdAt: new Date().toISOString()
  }
];
