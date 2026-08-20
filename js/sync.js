/**
 * GÜRKAN YAPI MALZEMELERİ - ANLIK VE KESİNTİSİZ ÇİFT KATMANLI VERİTABANI SENKRONİZASYON MOTORU
 * (Supabase Realtime WebSocket + Kalıcı PostgreSQL + Same-Tab Storage Event + Auto-Reconnect Polling + Automatic Column Fallback & Local Data Protection Guard)
 */

class SyncManager {
  constructor() {
    this.listeners = [];
    this.audioEnabled = true;
    this.clientId = 'CLIENT_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    this.channel = null;
    this.supabase = null;
    this.pollingInterval = null;

    this.initAudio();
    this.initSupabase();
    this.initSameBrowserSync();
  }

  // --- 1. SAME BROWSER TAB REALTIME SYNC (Aynı Tarayıcı Sekmeler Arası Anlık Akış) ---
  initSameBrowserSync() {
    window.addEventListener('storage', (e) => {
      if (
        e.key === 'sevkiyat_data_v1' ||
        e.key === 'sevkiyat_notes_v1' ||
        e.key === 'sevkiyat_disabled_days_v1' ||
        e.key === 'sevkiyat_reps_v1' ||
        e.key === 'sevkiyat_audit_logs_v1'
      ) {
        this.triggerListeners({ action: 'LOCAL_TAB_SYNC' });
      }
    });

    // Sekme/Ekran Görünür Olduğunda Otomatik Canlı Veri Çek
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.pullFromSupabaseDB();
      }
    });
  }

  // --- 2. SUPABASE REALTIME & PERMANENT POSTGRESQL ENGINE ---
  initSupabase() {
    if (typeof window.SUPABASE_CONFIG === 'undefined') {
      console.warn("Supabase yapılandırma dosyası (supabase-config.js) bulunamadı.");
      return;
    }

    const config = window.SUPABASE_CONFIG;
    if (!config.url || !config.anonKey || config.url.includes('YOUR_SUPABASE_URL')) {
      console.warn("Supabase anahtarları henüz girilmemiş. Yerel depolama modunda çalışılıyor.");
      return;
    }

    if (window.supabase) {
      this.loadSupabaseSDK(config);
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = () => this.loadSupabaseSDK(config);
      script.onerror = () => {
        console.warn("Supabase SDK CDN'den yüklenemedi.");
      };
      document.head.appendChild(script);
    }
  }

  async loadSupabaseSDK(config) {
    try {
      this.supabase = window.supabase.createClient(config.url, config.anonKey, {
        auth: { persistSession: false },
        realtime: { heartbeatIntervalMs: 2500 }
      });

      await this.setupSupabaseListeners(config);
      this.startFallbackPolling();
      this.updateCloudStatusUI(true);
    } catch (err) {
      console.warn("Supabase başlatma hatası:", err);
      this.updateCloudStatusUI(false);
    }
  }

  async setupSupabaseListeners(config) {
    try {
      // A) Başlangıçta Tüm Verileri Doğrudan Supabase Veritabanından Çek (Kalıcı PostgreSQL)
      await this.pullFromSupabaseDB();

      // B) Supabase Realtime WebSocket Kanalını Başlat (Değişiklikleri Anlık 0-50ms Yayınla)
      this.channel = this.supabase.channel('public:shipments_data', {
        config: {
          broadcast: { self: false }
        }
      });

      this.channel
        .on('broadcast', { event: 'SHIPMENT_CHANGE' }, (msg) => {
          const payload = msg.payload || msg;
          if (payload && payload.sender_id !== this.clientId) {
            this.handleIncomingBroadcast(payload);
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.updateCloudStatusUI(true);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            this.updateCloudStatusUI(false);
          }
        });

      // C) Supabase Database Tablo Değişikliklerini Canlı Dinle (Postgres Changes CDC)
      this.supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'shipments_data' },
          (payload) => {
            if (payload.new && payload.new.sender_id !== this.clientId) {
              const dbRecord = payload.new;
              if (dbRecord.shipments) localStorage.setItem('sevkiyat_data_v1', JSON.stringify(dbRecord.shipments));
              if (dbRecord.disabled_days) localStorage.setItem('sevkiyat_disabled_days_v1', JSON.stringify(dbRecord.disabled_days));
              if (dbRecord.representatives) localStorage.setItem('sevkiyat_reps_v1', JSON.stringify(dbRecord.representatives));
              if (dbRecord.weekly_notes) localStorage.setItem('sevkiyat_notes_v1', JSON.stringify(dbRecord.weekly_notes));
              if (dbRecord.audit_logs) localStorage.setItem('sevkiyat_audit_logs_v1', JSON.stringify(dbRecord.audit_logs));
              if (dbRecord.fuel_prices) localStorage.setItem('sevkiyat_fuel_prices_v1', JSON.stringify(dbRecord.fuel_prices));
              
              const remoteTime = dbRecord.last_mutation_time || (dbRecord.updated_at ? new Date(dbRecord.updated_at).getTime() : Date.now());
              localStorage.setItem('sevkiyat_last_mutation_time', remoteTime.toString());
              this.lastLocalMutationTime = remoteTime;

              this.triggerListeners({ action: 'DB_LIVE_UPDATE' });
            }
          }
        )
        .subscribe();

    } catch (err) {
      console.warn("Supabase bağlantı hatası:", err);
      this.updateCloudStatusUI(false);
    }
  }

  markLocalMutation() {
    const now = Date.now();
    this.lastLocalMutationTime = now;
    localStorage.setItem('sevkiyat_last_mutation_time', now.toString());
  }

  // 10 SANİYEDE BİR SESSİZ ARKA PLAN VERİ VERİTABANI POLINGİ (AĞ KOPMALARINA KARŞI KESİNTİSİZ KORUMA)
  startFallbackPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(() => {
      this.pullFromSupabaseDB(true);
    }, 10000);
  }

  // SUPABASE VERİTABANINDAN TÜM VERİLERİ ÇEK (LOKAL VE GİZLİ SEKME / KART TEMİZLEME KORUMALI)
  async pullFromSupabaseDB(isSilentPolling = false) {
    if (!this.supabase) return;

    try {
      const { data, error } = await this.supabase
        .from('shipments_data')
        .select('*')
        .eq('id', 'global_state')
        .single();

      const localStr = localStorage.getItem('sevkiyat_data_v1');
      const localShipments = JSON.parse(localStr || '[]');

      // SEED KONTROLÜ: Eğer veritabanında henüz hiç veri yoksa (veya boşsa), fakat tarayıcımızda sevkler varsa, verileri DB'ye SEED et!
      if ((!data || !data.shipments || data.shipments.length === 0) && localShipments.length > 0) {
        console.log("🌱 Veritabanında veri bulunamadı. Yerel veriler veritabanına aktarılıyor (Initial Seed)...");
        this.pushToSupabaseDB('INITIAL_SEED_PUSH');
        return;
      }

      if (data && !error && data.shipments) {
        const dbTime = data.last_mutation_time || (data.updated_at ? new Date(data.updated_at).getTime() : 0);
        const localTime = parseInt(localStorage.getItem('sevkiyat_last_mutation_time') || '0', 10);

        // KURAL 1 (GİZLİ SEKME & YENİ CİHAZ KORUMA KALKANI):
        // Eğer yerel hafızada 0 sevk varsa, fakat Veritabanında sevkler varsa (örn. Gizli sekme / Yeni cihaz / Cache temizleme):
        // KESİNLİKLE VERİTABANINI EZME! Veritabanındaki dolu verileri doğrudan çek ve yerel hafızaya yükle!
        if (localShipments.length === 0 && data.shipments.length > 0) {
          console.log("📥 Gizli sekme/yeni cihaz algılandı. Veritabanındaki canlı veriler çekiliyor...");
          localStorage.setItem('sevkiyat_data_v1', JSON.stringify(data.shipments));
          if (data.disabled_days) localStorage.setItem('sevkiyat_disabled_days_v1', JSON.stringify(data.disabled_days));
          if (data.representatives) localStorage.setItem('sevkiyat_reps_v1', JSON.stringify(data.representatives));
          if (data.weekly_notes) localStorage.setItem('sevkiyat_notes_v1', JSON.stringify(data.weekly_notes));
          if (data.audit_logs) localStorage.setItem('sevkiyat_audit_logs_v1', JSON.stringify(data.audit_logs));
          if (data.fuel_prices) localStorage.setItem('sevkiyat_fuel_prices_v1', JSON.stringify(data.fuel_prices));
          
          if (dbTime > 0) {
            localStorage.setItem('sevkiyat_last_mutation_time', dbTime.toString());
            this.lastLocalMutationTime = dbTime;
          }
          this.triggerListeners({ action: 'RELOAD_FROM_DB' });
          return;
        }

        // KURAL 2 (YEREL İŞLEM KORUMASI):
        // Sadece ve sadece yerel hafızada DAHA YENİ bir kullanıcı işlemi varsa VE yerelde en az 1 sevk bulunuyorsa DB'ye it:
        if (localTime > dbTime + 1000 && localShipments.length > 0) {
          console.log("🛡️ Yerel hafıza veritabanından daha yeni! DB güncelleniyor...");
          this.pushToSupabaseDB('RECOVERY_PUSH_LOCAL_NEWER');
          return;
        }

        // KURAL 3: Veritabanı verisi yerel veriden YENİ VEYA EŞİTSE: Eşitle ve Güncelle
        let hasChanges = false;

        const newStr = JSON.stringify(data.shipments);
        if (localStr !== newStr) {
          localStorage.setItem('sevkiyat_data_v1', newStr);
          hasChanges = true;
        }
        if (data.disabled_days) {
          const lStr = localStorage.getItem('sevkiyat_disabled_days_v1');
          const nStr = JSON.stringify(data.disabled_days);
          if (lStr !== nStr) { localStorage.setItem('sevkiyat_disabled_days_v1', nStr); hasChanges = true; }
        }
        if (data.representatives) {
          const lStr = localStorage.getItem('sevkiyat_reps_v1');
          const nStr = JSON.stringify(data.representatives);
          if (lStr !== nStr) { localStorage.setItem('sevkiyat_reps_v1', nStr); hasChanges = true; }
        }
        if (data.weekly_notes) {
          const lStr = localStorage.getItem('sevkiyat_notes_v1');
          const nStr = JSON.stringify(data.weekly_notes);
          if (lStr !== nStr) { localStorage.setItem('sevkiyat_notes_v1', nStr); hasChanges = true; }
        }
        if (data.audit_logs) {
          const lStr = localStorage.getItem('sevkiyat_audit_logs_v1');
          const nStr = JSON.stringify(data.audit_logs);
          if (lStr !== nStr) { localStorage.setItem('sevkiyat_audit_logs_v1', nStr); hasChanges = true; }
        }
        if (data.fuel_prices) {
          const lStr = localStorage.getItem('sevkiyat_fuel_prices_v1');
          const nStr = JSON.stringify(data.fuel_prices);
          if (lStr !== nStr) { localStorage.setItem('sevkiyat_fuel_prices_v1', nStr); hasChanges = true; }
        }
        if (data.users) {
          const lStr = localStorage.getItem('sevkiyat_users_v1');
          const nStr = JSON.stringify(data.users);
          if (lStr !== nStr) { localStorage.setItem('sevkiyat_users_v1', nStr); hasChanges = true; }
        }
        if (data.vehicles) {
          const lStr = localStorage.getItem('sevkiyat_vehicles_v1');
          const nStr = JSON.stringify(data.vehicles);
          if (lStr !== nStr) { localStorage.setItem('sevkiyat_vehicles_v1', nStr); hasChanges = true; }
        }

        if (dbTime > 0) {
          localStorage.setItem('sevkiyat_last_mutation_time', dbTime.toString());
          this.lastLocalMutationTime = dbTime;
        }

        if (hasChanges || !isSilentPolling) {
          this.triggerListeners({ action: 'RELOAD_FROM_DB' });
        }
      }
    } catch (e) {
      console.warn("Supabase DB okuma hatası:", e);
    }
  }

  // SUPABASE VERİTABANINA PERMANENT YAZMA (SALT-OKUNUR GÜVENLİK KALKANI İLE KARIŞIKLIK %100 ENGELLENİR)
  async pushToSupabaseDB(action, dataPayload) {
    // GÜVENLİK KİLİDİ: Eğer izleme ekranı ise (mode-display / index.html) veya PIN ile oturum açılmamışsa, DB'ye ezme yaptırma!
    const isDisplayPage = document.body.classList.contains('mode-display') || window.location.pathname.includes('index.html') || window.location.pathname.includes('display.html');
    const isAuth = window.authManager ? window.authManager.isAuthenticated() : true;
    if (isDisplayPage && !isAuth) {
      console.warn("🛡️ İzleme ekranı / yetkisiz oturumda DB yazma engellendi (Strict Read-Only Mode).");
      return;
    }

    this.markLocalMutation();
    if (!this.supabase) return;

    try {
      const shipments = JSON.parse(localStorage.getItem('sevkiyat_data_v1') || '[]');
      const disabledDays = JSON.parse(localStorage.getItem('sevkiyat_disabled_days_v1') || '[]');
      const representatives = JSON.parse(localStorage.getItem('sevkiyat_reps_v1') || '[]');
      const weeklyNotes = JSON.parse(localStorage.getItem('sevkiyat_notes_v1') || '{}');
      const auditLogs = JSON.parse(localStorage.getItem('sevkiyat_audit_logs_v1') || '[]');
      const fuelPrices = JSON.parse(localStorage.getItem('sevkiyat_fuel_prices_v1') || '{"diesel":"47.10","gasoline":"46.65"}');
      const users = JSON.parse(localStorage.getItem('sevkiyat_users_v1') || '[]');
      const vehicles = JSON.parse(localStorage.getItem('sevkiyat_vehicles_v1') || '[]');
      const localTime = parseInt(localStorage.getItem('sevkiyat_last_mutation_time') || Date.now().toString(), 10);

      const payload = {
        id: 'global_state',
        shipments: shipments,
        disabled_days: disabledDays,
        representatives: representatives,
        weekly_notes: weeklyNotes,
        audit_logs: auditLogs,
        fuel_prices: fuelPrices,
        users: users,
        vehicles: vehicles,
        last_mutation_time: localTime,
        last_action: action,
        sender_id: this.getSenderId(),
        updated_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('shipments_data')
        .upsert(payload);

      if (error) {
        console.warn("Supabase upsert uyarısı, minimal payload ile kaydediliyor:", error.message);
        const minimalPayload = {
          id: 'global_state',
          shipments: shipments,
          disabled_days: disabledDays,
          representatives: representatives,
          last_action: action,
          sender_id: this.getSenderId(),
          updated_at: new Date().toISOString()
        };
        const { error: minError } = await this.supabase
          .from('shipments_data')
          .upsert(minimalPayload);

        if (minError) {
          console.error("Supabase minimal upsert hatası:", minError.message);
        } else {
          console.log("✅ Supabase minimal payload ile başarıyla kaydedildi.");
        }
      } else {
        console.log("✅ Supabase tam payload ile başarıyla kaydedildi.");
      }

    } catch (e) {
      console.warn("Supabase DB kalıcı yazma hatası:", e);
    }
  }

  updateCloudStatusUI(isConnected) {
    const syncBadge = document.querySelector('.sync-badge');
    if (syncBadge) {
      if (isConnected) {
        syncBadge.innerHTML = `<span class="pulse-dot"></span><span>CANLI</span>`;
      } else {
        syncBadge.innerHTML = `<span class="pulse-dot" style="background:#ef4444; animation:none;"></span><span>ÇEVRİMDIŞI</span>`;
      }
    }
  }

  // --- 3. SES VE BİLDİRİM MOTORU ---
  initAudio() {
    const savedAudio = localStorage.getItem('sevkiyat_audio_enabled');
    if (savedAudio !== null) {
      this.audioEnabled = (savedAudio === 'true');
    } else {
      this.audioEnabled = true;
    }
  }

  setAudioEnabled(enabled) {
    this.audioEnabled = enabled;
    localStorage.setItem('sevkiyat_audio_enabled', enabled ? 'true' : 'false');
  }

  playAlertSound(type = 'new_shipment') {
    if (!this.audioEnabled) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      
      const audioCtx = new AudioContext();

      if (type === 'new_shipment') {
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
        gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start();
        osc1.stop(audioCtx.currentTime + 0.25);
      } else {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
      }
    } catch (e) {
      console.warn("Ses çalma hatası:", e);
    }
  }

  getGlobalFemaleVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    let targetVoice = voices.find(v => 
      (v.lang.startsWith('tr') || v.lang.includes('TR')) && 
      (v.name.includes('Google') || v.name.includes('Neural') || v.name.includes('Yelda') || v.name.includes('Siri') || v.name.includes('Emel'))
    );

    if (!targetVoice) {
      targetVoice = voices.find(v => (v.lang.startsWith('tr') || v.lang.includes('TR')));
    }

    return targetVoice;
  }

  speakCustomerNameNative(textToRead) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.lang = 'tr-TR';
      utterance.rate = 1.10;
      utterance.pitch = 1.05;

      const femaleVoice = this.getGlobalFemaleVoice();
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Yerel seslendirme hatası:", e);
    }
  }

  speakCustomerName(customerName) {
    if (!this.audioEnabled) return;
    if (!customerName) return;
    const textToRead = `Yeni sevkiyat eklendi: ${customerName}`;
    if ('speechSynthesis' in window) {
      this.speakCustomerNameNative(textToRead);
    }
  }

  speakText(text) {
    if (!this.audioEnabled) return;
    if (!text) return;
    if ('speechSynthesis' in window) {
      this.speakCustomerNameNative(text);
    }
  }

  announceNewShipment(customerName) {
    this.playAlertSound('new_shipment');
    setTimeout(() => {
      this.speakCustomerName(customerName);
    }, 400);
  }

  testSound() {
    this.playAlertSound('new_shipment');
    setTimeout(() => {
      this.speakCustomerName("Gürkan Yapı Malzemeleri Test");
    }, 450);
  }

  getSenderId() {
    return this.clientId;
  }

  // --- 4. BROADCAST ANLIK İLETİŞİM MOTORU ---
  broadcast(action, data) {
    const now = Date.now();
    this.markLocalMutation();

    const shipments = JSON.parse(localStorage.getItem('sevkiyat_data_v1') || '[]');
    const disabledDays = JSON.parse(localStorage.getItem('sevkiyat_disabled_days_v1') || '[]');
    const representatives = JSON.parse(localStorage.getItem('sevkiyat_reps_v1') || '[]');
    const weeklyNotes = JSON.parse(localStorage.getItem('sevkiyat_notes_v1') || '{}');
    const auditLogs = JSON.parse(localStorage.getItem('sevkiyat_audit_logs_v1') || '[]');
    const fuelPrices = JSON.parse(localStorage.getItem('sevkiyat_fuel_prices_v1') || '{}');

    const broadcastPayload = {
      action: action,
      shipments: shipments,
      disabledDays: disabledDays,
      representatives: representatives,
      weeklyNotes: weeklyNotes,
      auditLogs: auditLogs,
      fuelPrices: fuelPrices,
      customPayload: data,
      sender_id: this.getSenderId(),
      timestamp: now
    };

    this.pushToSupabaseDB(action, broadcastPayload);

    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'SHIPMENT_CHANGE',
        payload: broadcastPayload
      });
    }
  }

  handleIncomingBroadcast(payload) {
    if (!payload) return;
    if (payload.sender_id === this.getSenderId()) return;

    const shipments = payload.shipments || (payload.data && payload.data.shipments);
    if (shipments) {
      localStorage.setItem('sevkiyat_data_v1', JSON.stringify(shipments));
      
      const disabledDays = payload.disabledDays || (payload.data && payload.data.disabledDays);
      if (disabledDays) localStorage.setItem('sevkiyat_disabled_days_v1', JSON.stringify(disabledDays));
      
      const representatives = payload.representatives || (payload.data && payload.data.representatives);
      if (representatives) localStorage.setItem('sevkiyat_reps_v1', JSON.stringify(representatives));
      
      const weeklyNotes = payload.weeklyNotes || (payload.data && payload.data.weeklyNotes);
      if (weeklyNotes) localStorage.setItem('sevkiyat_notes_v1', JSON.stringify(weeklyNotes));
      
      const auditLogs = payload.auditLogs || (payload.data && payload.data.auditLogs);
      if (auditLogs) localStorage.setItem('sevkiyat_audit_logs_v1', JSON.stringify(auditLogs));

      const fuelPrices = payload.fuelPrices || (payload.data && payload.data.fuelPrices);
      if (fuelPrices) localStorage.setItem('sevkiyat_fuel_prices_v1', JSON.stringify(fuelPrices));

      const remoteTime = payload.timestamp || Date.now();
      localStorage.setItem('sevkiyat_last_mutation_time', remoteTime.toString());
      this.lastLocalMutationTime = remoteTime;

      this.triggerListeners({ action: 'REMOTE_LIVE_UPDATE' });
    } else {
      this.pullFromSupabaseDB(false);
    }

    const addedCustomer = payload.customerName || (payload.customPayload && payload.customPayload.customerName);
    if (payload.action === 'ADD' && addedCustomer) {
      this.announceNewShipment(addedCustomer);
    }
  }

  onSync(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  triggerListeners(payload) {
    this.listeners.forEach(cb => {
      try {
        cb(payload);
      } catch (e) {
        console.error("Sync listener hatası:", e);
      }
    });
  }
}

window.syncManager = new SyncManager();
