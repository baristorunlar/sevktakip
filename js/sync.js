/**
 * GÜRKAN YAPI MALZEMELERİ - ANLIK VE KESİNTİSİZ ÇİFT KATMANLI VERİTABANI SENKRONİZASYON MOTORU
 * (Supabase Realtime WebSocket + Kalıcı PostgreSQL + Same-Tab Storage Event + Auto-Reconnect Polling)
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

  // --- 1. SAME BROWSER TAB REALTIME SYNC (Aynı Tarayıcıkmı Sekmeler Arası Anlık Akış) ---
  initSameBrowserSync() {
    window.addEventListener('storage', (e) => {
      if (
        e.key === 'sevkiyat_data_v1' ||
        e.key === 'sevkiyat_notes_v1' ||
        e.key === 'sevkiyat_disabled_days_v1' ||
        e.key === 'sevkiyat_reps_v1'
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
        .on('broadcast', { event: 'SHIPMENT_CHANGE' }, (payload) => {
          if (payload.payload && payload.payload.sender_id !== this.clientId) {
            this.handleIncomingBroadcast(payload.payload);
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
              if (payload.new.shipments) {
                localStorage.setItem('sevkiyat_data_v1', JSON.stringify(payload.new.shipments));
              }
              if (payload.new.disabled_days) {
                localStorage.setItem('sevkiyat_disabled_days_v1', JSON.stringify(payload.new.disabled_days));
              }
              if (payload.new.representatives) {
                localStorage.setItem('sevkiyat_reps_v1', JSON.stringify(payload.new.representatives));
              }
              if (payload.new.weekly_notes) {
                localStorage.setItem('sevkiyat_notes_v1', JSON.stringify(payload.new.weekly_notes));
              }
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

  // 10 SANİYEDE BİR SESSİZ ARKA PLAN VERİ VERİTABANI POLINGİ (AĞ KOPMALARINA KARŞI KESİNTİSİZ KORUMA)
  startFallbackPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(() => {
      this.pullFromSupabaseDB(true);
    }, 10000);
  }

  // SUPABASE VERİTABANINDAN TÜM VERİLERİ ÇEK
  async pullFromSupabaseDB(isSilentPolling = false) {
    if (!this.supabase) return;

    try {
      const { data, error } = await this.supabase
        .from('shipments_data')
        .select('*')
        .eq('id', 'global_state')
        .single();

      if (data && !error) {
        let hasChanges = false;

        if (data.shipments) {
          const localStr = localStorage.getItem('sevkiyat_data_v1');
          const newStr = JSON.stringify(data.shipments);
          if (localStr !== newStr) {
            localStorage.setItem('sevkiyat_data_v1', newStr);
            hasChanges = true;
          }
        }
        if (data.disabled_days) {
          const localStr = localStorage.getItem('sevkiyat_disabled_days_v1');
          const newStr = JSON.stringify(data.disabled_days);
          if (localStr !== newStr) {
            localStorage.setItem('sevkiyat_disabled_days_v1', newStr);
            hasChanges = true;
          }
        }
        if (data.representatives) {
          const localStr = localStorage.getItem('sevkiyat_reps_v1');
          const newStr = JSON.stringify(data.representatives);
          if (localStr !== newStr) {
            localStorage.setItem('sevkiyat_reps_v1', newStr);
            hasChanges = true;
          }
        }
        if (data.weekly_notes) {
          const localStr = localStorage.getItem('sevkiyat_notes_v1');
          const newStr = JSON.stringify(data.weekly_notes);
          if (localStr !== newStr) {
            localStorage.setItem('sevkiyat_notes_v1', newStr);
            hasChanges = true;
          }
        }

        if (hasChanges || !isSilentPolling) {
          this.triggerListeners({ action: 'RELOAD_FROM_DB' });
        }
      }
    } catch (e) {
      console.warn("Supabase DB okuma hatası:", e);
    }
  }

  // SUPABASE VERİTABANINA PERMANENT YAZMA
  async pushToSupabaseDB(action, dataPayload) {
    if (!this.supabase) return;

    try {
      const shipments = JSON.parse(localStorage.getItem('sevkiyat_data_v1') || '[]');
      const disabledDays = JSON.parse(localStorage.getItem('sevkiyat_disabled_days_v1') || '[]');
      const representatives = JSON.parse(localStorage.getItem('sevkiyat_reps_v1') || '[]');
      const weeklyNotes = JSON.parse(localStorage.getItem('sevkiyat_notes_v1') || '{}');

      await this.supabase
        .from('shipments_data')
        .upsert({
          id: 'global_state',
          shipments: shipments,
          disabled_days: disabledDays,
          representatives: representatives,
          weekly_notes: weeklyNotes,
          last_action: action,
          sender_id: this.getSenderId(),
          updated_at: new Date().toISOString()
        });

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
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      if (type === 'new_shipment') {
        // Çift Bip Ses Melodisi
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc1.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
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
    this.pushToSupabaseDB(action, data);

    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'SHIPMENT_CHANGE',
        action: action,
        data: data,
        sender_id: this.getSenderId(),
        timestamp: Date.now()
      });
    }
  }

  handleIncomingBroadcast(payload) {
    if (!payload) return;

    // 1. Eğer tam paket geldiyse doğrudan eşitle
    if (payload.data && payload.data.shipments) {
      localStorage.setItem('sevkiyat_data_v1', JSON.stringify(payload.data.shipments));
      if (payload.data.disabledDays) localStorage.setItem('sevkiyat_disabled_days_v1', JSON.stringify(payload.data.disabledDays));
      if (payload.data.representatives) localStorage.setItem('sevkiyat_reps_v1', JSON.stringify(payload.data.representatives));
      if (payload.data.weeklyNotes) localStorage.setItem('sevkiyat_notes_v1', JSON.stringify(payload.data.weeklyNotes));
      this.triggerListeners(payload);
    } else {
      // 2. Değilse veritabanından tam güncel halini anında çek
      this.pullFromSupabaseDB().then(() => {
        this.triggerListeners(payload);
      });
    }

    // Bildirim ve Sesler
    if (payload.action === 'ADD' && payload.data && payload.data.customerName) {
      this.announceNewShipment(payload.data.customerName);
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
