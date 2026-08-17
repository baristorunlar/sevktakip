/**
 * GÜRKAN YAPI MALZEMELERİ - ANLIK CANLI VERİTABANI & DÜNYANIN EN POPÜLER 1 NUMARALI KADIN SES MOTORU
 */

class SyncManager {
  constructor() {
    this.listeners = [];
    this.audioContext = null;
    this.audioEnabled = true;
    this.clientId = 'CLIENT_' + Math.random().toString(36).substring(2, 9);
    this.channel = null;
    this.supabase = null;

    this.initAudio();
    this.initSupabase();
  }

  // --- 1. SUPABASE REALTIME & PERMANENT POSTGRESQL ENGINE ---
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
      this.supabase = window.supabase.createClient(config.url, config.anonKey);
      await this.setupSupabaseListeners(config);
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

      // B) Supabase Realtime WebSocket Kanalını Başlat (Değişiklikleri Anlık Yayınla)
      this.channel = this.supabase.channel('public:shipments_data');

      this.channel
        .on('broadcast', { event: 'SHIPMENT_CHANGE' }, (payload) => {
          if (payload.payload && payload.payload.sender_id !== this.clientId) {
            this.handleIncomingBroadcast(payload.payload);
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.updateCloudStatusUI(true);
          }
        });

      // C) Supabase Database Tablo Değişikliklerini Canlı Dinle (Postgres Changes)
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

  // SUPABASE VERİTABANINDAN TÜM VERİLERİ ÇEK
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
        if (data.representatives) {
          localStorage.setItem('sevkiyat_reps_v1', JSON.stringify(data.representatives));
        }
        if (data.weekly_notes) {
          localStorage.setItem('sevkiyat_notes_v1', JSON.stringify(data.weekly_notes));
        }
        this.triggerListeners({ action: 'RELOAD_FROM_DB' });
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

  // --- 2. DÜNYANIN EN ÇOK KULLANILAN KADIN YAPAY ZEKA SES MOTORU ---
  initAudio() {
    const savedAudio = localStorage.getItem('sevkiyat_audio_enabled');
    if (savedAudio !== null) {
      this.audioEnabled = savedAudio === 'true';
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
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

    ['click', 'touchstart', 'keydown'].forEach(evt => {
      document.addEventListener(evt, unlockAudio, { once: true });
    });
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

      const startTime = this.audioContext.currentTime;

      if (type === 'new_shipment') {
        // Melodik tatlı bildirim tonu (Do - Mi - Sol)
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, idx) => {
          const osc = this.audioContext.createOscillator();
          const gain = this.audioContext.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime + idx * 0.1);

          gain.gain.setValueAtTime(0.0001, startTime + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.3, startTime + idx * 0.1 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + idx * 0.1 + 0.22);

          osc.connect(gain);
          gain.connect(this.audioContext.destination);

          osc.start(startTime + idx * 0.1);
          osc.stop(startTime + idx * 0.1 + 0.25);
        });
      } else {
        // Yumuşak güncelleme tonu
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, startTime);
        osc.frequency.exponentialRampToValueAtTime(880, startTime + 0.15);

        filter.type = 'lowpass';
        filter.frequency.value = 1200;

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.25);
      }
    } catch (e) {
      console.warn("Ses çalma hatası:", e);
    }
  }

  getGlobalFemaleVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();

    if (!voices || voices.length === 0) return null;

    // Dünyanın En Çok Kullanılan Türkçe Kadın Sesleri Öncelik Sıralaması
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
      utterance.rate = 1.10; // Hızlı ve dinamik anons temposu
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

  // --- 3. BROADCAST VERİ İLETİŞİM HİZMETLERİ ---
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
    if (payload.action === 'ADD' && payload.data) {
      const shipments = JSON.parse(localStorage.getItem('sevkiyat_data_v1') || '[]');
      const exists = shipments.some(s => s.id === payload.data.id);
      if (!exists) {
        shipments.push(payload.data);
        localStorage.setItem('sevkiyat_data_v1', JSON.stringify(shipments));
        this.announceNewShipment(payload.data.customerName);
      }
    } else if (payload.action === 'UPDATE_NOTE') {
      if (payload.data && payload.data.weekKey) {
        const notes = JSON.parse(localStorage.getItem('sevkiyat_notes_v1') || '{}');
        if (payload.data.note) {
          notes[payload.data.weekKey] = payload.data.note;
        } else {
          delete notes[payload.data.weekKey];
        }
        localStorage.setItem('sevkiyat_notes_v1', JSON.stringify(notes));
      } else {
        this.pullFromSupabaseDB();
      }
    } else if (payload.action === 'UPDATE_REPS') {
      this.pullFromSupabaseDB();
    } else if (payload.action === 'MOVE') {
      this.pullFromSupabaseDB();
    }

    this.triggerListeners(payload);
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
