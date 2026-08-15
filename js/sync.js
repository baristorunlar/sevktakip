/**
 * GÜRKAN YAPI MALZEMELERİ - SUPABASE KALICI VERİTABANI & CANLI SENKRONİZASYON MOTORU
 */

class SyncManager {
  constructor() {
    this.channelName = 'sevkiyat_takip_channel_v1';
    this.broadcastChannel = null;
    this.audioEnabled = true;
    this.audioContext = null;
    this.listeners = [];
    this.supabase = null;
    this.realtimeChannel = null;
    this.isCloudConnected = false;

    this.initAudio();
    this.initBroadcastChannel();
    this.initStorageListener();
    this.initSupabase();
  }

  // --- 1. SUPABASE KALICI VERİTABANI BAĞLANTISI ---
  initSupabase() {
    const savedConfig = localStorage.getItem('sevkiyat_supabase_config');
    let config = null;

    if (savedConfig) {
      try { config = JSON.parse(savedConfig); } catch (e) {}
    }

    if (!config && window.SUPABASE_CONFIG) {
      config = window.SUPABASE_CONFIG;
    }

    if (config && config.url && config.url.includes('supabase.co')) {
      this.loadSupabaseSDK(config);
    }
  }

  loadSupabaseSDK(config) {
    if (window.supabase) {
      this.setupSupabaseListeners(config);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = () => {
      this.setupSupabaseListeners(config);
    };
    script.onerror = () => {
      console.warn("Supabase SDK yüklenemedi.");
    };
    document.head.appendChild(script);
  }

  async setupSupabaseListeners(config) {
    try {
      if (!window.supabase || !window.supabase.createClient) return;

      this.supabase = window.supabase.createClient(config.url, config.anonKey);
      this.isCloudConnected = true;
      this.updateCloudStatusUI(true);

      // A) Başlangıçta Tüm Verileri Doğrudan Supabase Veritabanından Çek
      await this.pullFromSupabaseDB();

      // B) Supabase Database Tablo Değişikliklerini Canlı Dinle (Postgres Changes)
      this.supabase
        .channel('db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'shipments_data' },
          (payload) => {
            if (payload && payload.new) {
              const newRec = payload.new;
              if (newRec.sender_id !== this.getSenderId()) {
                if (newRec.shipments) {
                  localStorage.setItem('sevkiyat_data_v1', JSON.stringify(newRec.shipments));
                }
                if (newRec.disabled_days) {
                  localStorage.setItem('sevkiyat_disabled_days_v1', JSON.stringify(newRec.disabled_days));
                }
                this.handleIncomingMessage({
                  action: newRec.last_action || 'UPDATE',
                  senderId: newRec.sender_id
                });
              }
            }
          }
        )
        .subscribe();

      // C) Realtime WebSocket Broadcast Kanalı
      this.realtimeChannel = this.supabase.channel('sevkiyat-live-sync');
      this.realtimeChannel.on('broadcast', { event: 'sync_action' }, (event) => {
        if (event && event.payload) {
          this.handleIncomingMessage(event.payload);
        }
      });
      this.realtimeChannel.subscribe();

    } catch (err) {
      console.warn("Supabase bağlantı hatası:", err);
    }
  }

  // SUPABASE VERİTABANINDAN VERİ ÇEKME (Çerezler silinse bile buradan gelir)
  async pullFromSupabaseDB() {
    if (!this.supabase) return;

    try {
      const { data, error } = await this.supabase
        .from('shipments_data')
        .select('*')
        .eq('id', 'global_state')
        .single();

      if (data && !error) {
        if (data.shipments) {
          localStorage.setItem('sevkiyat_data_v1', JSON.stringify(data.shipments));
        }
        if (data.disabled_days) {
          localStorage.setItem('sevkiyat_disabled_days_v1', JSON.stringify(data.disabled_days));
        }
        this.triggerListeners({ action: 'RELOAD_FROM_DB' });
      }
    } catch (e) {
      console.warn("Supabase DB okuma hatası:", e);
    }
  }

  // SUPABASE VERİTABANINA PERMANENT YAZMA (Kalıcı Kayıt)
  async pushToSupabaseDB(action, dataPayload) {
    if (!this.supabase) return;

    try {
      const shipments = JSON.parse(localStorage.getItem('sevkiyat_data_v1') || '[]');
      const disabledDays = JSON.parse(localStorage.getItem('sevkiyat_disabled_days_v1') || '[]');

      await this.supabase
        .from('shipments_data')
        .upsert({
          id: 'global_state',
          shipments: shipments,
          disabled_days: disabledDays,
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
        syncBadge.innerHTML = `<span class="pulse-dot" style="background:#22c55e;"></span><span>Supabase Veritabanı Kalıcı Bağlı</span>`;
      }
    }
  }

  // --- 2. AKUSTİK MÜKEMMEL SES MOTORU ---
  initAudio() {
    const savedAudio = localStorage.getItem('sevkiyat_audio_enabled');
    if (savedAudio !== null) {
      this.audioEnabled = savedAudio === 'true';
    }

    const unlockAudio = () => {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
        }
      } else if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    };

    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
  }

  setAudioEnabled(enabled) {
    this.audioEnabled = enabled;
    localStorage.setItem('sevkiyat_audio_enabled', enabled ? 'true' : 'false');
  }

  playAlertSound(type = 'new_shipment') {
    if (!this.audioEnabled) return;

    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.audioContext = new AudioCtx();
      }

      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      if (!this.audioContext) return;

      const now = this.audioContext.currentTime;

      if (type === 'new_shipment') {
        // PREMİUM KRİSTAL ZİL AKORU (F5 -> A5 -> C6)
        const playAcousticNote = (fundamentalFreq, startTime, duration, gainVal = 0.22) => {
          const osc1 = this.audioContext.createOscillator();
          const gain1 = this.audioContext.createGain();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(fundamentalFreq, startTime);

          gain1.gain.setValueAtTime(0.0001, startTime);
          gain1.gain.linearRampToValueAtTime(gainVal, startTime + 0.008);
          gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

          const osc2 = this.audioContext.createOscillator();
          const gain2 = this.audioContext.createGain();

          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(fundamentalFreq * 2.005, startTime);

          gain2.gain.setValueAtTime(0.0001, startTime);
          gain2.gain.linearRampToValueAtTime(gainVal * 0.35, startTime + 0.005);
          gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + (duration * 0.5));

          const filter = this.audioContext.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(2600, startTime);

          osc1.connect(gain1);
          osc2.connect(gain2);

          gain1.connect(filter);
          gain2.connect(filter);

          filter.connect(this.audioContext.destination);

          osc1.start(startTime);
          osc2.start(startTime);

          osc1.stop(startTime + duration);
          osc2.stop(startTime + duration);
        };

        playAcousticNote(698.46, now, 0.4, 0.22);
        playAcousticNote(880.00, now + 0.1, 0.5, 0.26);
        playAcousticNote(1046.50, now + 0.22, 0.7, 0.30);

      } else if (type === 'update_shipment') {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.08);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1900, now);

        osc.connect(gain);
        gain.connect(filter);
        filter.connect(this.audioContext.destination);

        osc.start(now);
        osc.stop(now + 0.09);
      }
    } catch (e) {
      console.warn("Sesli ikaz çalınamadı:", e);
    }
  }

  testSound() {
    this.playAlertSound('new_shipment');
  }

  // --- 3. SENKRONİZASYON VE MESAJ YAYINLAMA ---
  initBroadcastChannel() {
    if ('BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(this.channelName);
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingMessage(event.data);
        };
      } catch (e) {}
    }
  }

  initStorageListener() {
    window.addEventListener('storage', (e) => {
      if (e.key === 'sevkiyat_trigger_sync') {
        try {
          const payload = JSON.parse(e.newValue);
          if (payload) {
            this.handleIncomingMessage(payload);
          }
        } catch (err) {}
      }
    });
  }

  broadcast(action, data) {
    const payload = {
      action,
      data,
      timestamp: Date.now(),
      senderId: this.getSenderId(),
      shipments: JSON.parse(localStorage.getItem('sevkiyat_data_v1') || '[]'),
      disabledDays: JSON.parse(localStorage.getItem('sevkiyat_disabled_days_v1') || '[]')
    };

    // 1. Yerel Sekmeler Arası Gönder
    if (this.broadcastChannel) {
      try { this.broadcastChannel.postMessage(payload); } catch (e) {}
    }
    try { localStorage.setItem('sevkiyat_trigger_sync', JSON.stringify(payload)); } catch (e) {}

    // 2. Supabase Kalıcı PostgreSQL Veritabanına Yaz
    this.pushToSupabaseDB(action, data);

    // 3. Supabase Realtime Broadcast Gönder
    if (this.realtimeChannel) {
      try {
        this.realtimeChannel.send({
          type: 'broadcast',
          event: 'sync_action',
          payload: payload
        });
      } catch (e) {}
    }
  }

  getSenderId() {
    if (!this.senderId) {
      this.senderId = 'client_' + Math.random().toString(36).substr(2, 9);
    }
    return this.senderId;
  }

  handleIncomingMessage(payload) {
    if (!payload || payload.senderId === this.getSenderId()) return;

    if (payload.shipments) {
      localStorage.setItem('sevkiyat_data_v1', JSON.stringify(payload.shipments));
    }
    if (payload.disabledDays) {
      localStorage.setItem('sevkiyat_disabled_days_v1', JSON.stringify(payload.disabledDays));
    }

    if (payload.action === 'ADD') {
      this.playAlertSound('new_shipment');
    } else if (payload.action === 'MOVE' || payload.action === 'UPDATE' || payload.action === 'DISABLE_DAY') {
      this.playAlertSound('update_shipment');
    }

    this.triggerListeners(payload);
  }

  triggerListeners(payload) {
    this.listeners.forEach(callback => callback(payload));
  }

  onSync(callback) {
    this.listeners.push(callback);
  }
}

window.syncManager = new SyncManager();
