/**
 * GÜRKAN YAPI MALZEMELERİ - KURUMSAL SEVKİYAT TAKİP VE YÖNETİM SİSTEMİ
 */

// Kullanıcı isteği üzerine başlangıç pazarlamacı listesi boş bırakılmıştır
const DEFAULT_REPRESENTATIVES = [];

class ShipmentApp {
  constructor() {
    this.shipments = [];
    this.disabledDays = [];
    this.representatives = [];
    this.weeklyNotes = {}; // Haftalık özel operasyonel notlar/duyurular { weekKey: noteText }
    this.auditLogs = []; // İşlem ve değişiklik denetim log kayıtları
    this.fuelPrices = { diesel: '47.10', gasoline: '46.65' }; // Artvin / Arhavi Canlı Akaryakıt Fiyatları
    this.currentWeekStart = this.getMonday(new Date());
    this.draggedShipmentId = null;
    this.searchTerm = '';
    this.statusFilter = 'ALL';
    this.editingShipmentId = null;
    this.transferringShipmentId = null;

    // 📺 SAYFA KİPLERİ: (isReadOnly = true -> Canlı İzleme Ekranı / false -> Yönetici Paneli)
    this.isReadOnly = document.body.classList.contains('mode-display') || window.location.pathname.includes('display.html');

    this.initElements();
    this.loadData();
    this.initEventListeners();
    this.initSyncEngine();
    this.startLiveClock();
    this.render();
  }

  // --- 1. ELEMENT REFERANSLARI ---
  initElements() {
    this.weeklyGridEl = document.getElementById('weeklyGrid');
    this.weekTitleEl = document.getElementById('weekTitle');
    this.prevWeekBtn = document.getElementById('prevWeekBtn');
    this.nextWeekBtn = document.getElementById('nextWeekBtn');
    this.todayWeekBtn = document.getElementById('todayWeekBtn');

    this.totalCountEl = document.getElementById('totalCount');
    this.pendingCountEl = document.getElementById('pendingCount');
    this.transitCountEl = document.getElementById('transitCount');
    this.deliveredCountEl = document.getElementById('deliveredCount');
    this.dieselPriceValEl = document.getElementById('dieselPriceVal');
    this.gasolinePriceValEl = document.getElementById('gasolinePriceVal');
    this.dieselCardBtn = document.getElementById('dieselCardBtn');
    this.gasolineCardBtn = document.getElementById('gasolineCardBtn');
    this.metricsDrawer = document.getElementById('metricsDrawer');
    this.toggleMetricsDrawerBtn = document.getElementById('toggleMetricsDrawerBtn');

    this.searchInput = document.getElementById('searchInput');
    this.filterStatusSelect = document.getElementById('filterStatusSelect');
    this.newShipmentBtn = document.getElementById('newShipmentBtn');
    this.manageRepsBtn = document.getElementById('manageRepsBtn');
    this.audioToggleBtn = document.getElementById('audioToggleBtn');
    this.testSoundBtn = document.getElementById('testSoundBtn');
    this.viewAuditLogsBtn = document.getElementById('viewAuditLogsBtn');

    this.shipmentModal = document.getElementById('shipmentModal');
    this.modalTitle = document.getElementById('modalTitle');
    this.shipmentForm = document.getElementById('shipmentForm');
    this.closeModalBtn = document.getElementById('closeModalBtn');
    this.cancelModalBtn = document.getElementById('cancelModalBtn');

    this.inputDaySelect = document.getElementById('inputDay');
    this.inputOrderSelect = document.getElementById('inputShipmentOrder');
    this.inputRepSelect = document.getElementById('inputRepresentative');

    // Pazarlamacı Yönetimi Modal Elemanları
    this.repManagerModal = document.getElementById('repManagerModal');
    this.closeRepModalBtn = document.getElementById('closeRepModalBtn');
    this.doneRepModalBtn = document.getElementById('doneRepModalBtn');
    this.newRepInput = document.getElementById('newRepInput');
    this.addRepBtn = document.getElementById('addRepBtn');
    this.repListEl = document.getElementById('repListEl');

    // Haftalık Duyuru / Bekleyen Yük Not Modal Elemanları
    this.noteModal = document.getElementById('noteModal');
    this.closeNoteModalBtn = document.getElementById('closeNoteModalBtn');
    this.cancelNoteModalBtn = document.getElementById('cancelNoteModalBtn');
    this.noteForm = document.getElementById('noteForm');
    this.inputWeeklyNoteText = document.getElementById('inputWeeklyNoteText');

    // Sevkiyat Aktar / Transfer Modal Elemanları
    this.transferModal = document.getElementById('transferModal');
    this.closeTransferModalBtn = document.getElementById('closeTransferModalBtn');
    this.cancelTransferModalBtn = document.getElementById('cancelTransferModalBtn');
    this.transferForm = document.getElementById('transferForm');
    this.inputTargetDay = document.getElementById('inputTargetDay');
    this.inputTransferReason = document.getElementById('inputTransferReason');
    this.transferShipmentInfoText = document.getElementById('transferShipmentInfoText');

    // İşlem Logları Modal Elemanları
    this.auditLogModal = document.getElementById('auditLogModal');
    this.closeAuditLogModalBtn = document.getElementById('closeAuditLogModalBtn');
    this.doneAuditLogModalBtn = document.getElementById('doneAuditLogModalBtn');
    this.clearAuditLogsBtn = document.getElementById('clearAuditLogsBtn');
    this.auditLogSearchInput = document.getElementById('auditLogSearchInput');
    this.auditLogActionFilter = document.getElementById('auditLogActionFilter');
    this.auditLogListEl = document.getElementById('auditLogListEl');
    this.auditLogTotalCount = document.getElementById('auditLogTotalCount');

    this.toastContainer = document.getElementById('toastContainer');
    this.weeklyNoteBannerContainer = document.getElementById('weeklyNoteBannerContainer');
  }

  // --- 2. VERİ YÜKLEME VE SAKLAMA ---
  loadData() {
    try {
      const savedShipments = localStorage.getItem('sevkiyat_data_v1');
      if (savedShipments) {
        this.shipments = JSON.parse(savedShipments);
      } else {
        this.shipments = typeof INITIAL_SHIPMENTS !== 'undefined' ? JSON.parse(JSON.stringify(INITIAL_SHIPMENTS)) : [];
        this.saveData(false);
      }

      const savedDisabled = localStorage.getItem('sevkiyat_disabled_days_v1');
      if (savedDisabled) {
        this.disabledDays = JSON.parse(savedDisabled);
      } else {
        this.disabledDays = [];
      }

      const savedReps = localStorage.getItem('sevkiyat_reps_v1');
      if (savedReps) {
        this.representatives = JSON.parse(savedReps);
      } else {
        this.representatives = [...DEFAULT_REPRESENTATIVES];
      }

      const savedNotes = localStorage.getItem('sevkiyat_notes_v1');
      if (savedNotes) {
        this.weeklyNotes = JSON.parse(savedNotes);
      } else {
        this.weeklyNotes = {};
      }

      const savedLogs = localStorage.getItem('sevkiyat_audit_logs_v1');
      if (savedLogs) {
        this.auditLogs = JSON.parse(savedLogs);
      } else {
        this.auditLogs = [];
      }

      const savedFuel = localStorage.getItem('sevkiyat_fuel_prices_v1');
      if (savedFuel) {
        this.fuelPrices = JSON.parse(savedFuel);
      } else {
        this.fuelPrices = { diesel: '47.10', gasoline: '46.65' };
      }

      this.populateRepDropdown();
    } catch (e) {
      console.error("Veri yükleme hatası:", e);
      this.shipments = [];
      this.representatives = [...DEFAULT_REPRESENTATIVES];
      this.weeklyNotes = {};
      this.auditLogs = [];
      this.fuelPrices = { diesel: '47.10', gasoline: '46.65' };
    }
  }

  populateRepDropdown() {
    if (!this.inputRepSelect) return;
    this.inputRepSelect.innerHTML = '';
    
    if (this.representatives.length === 0) {
      const option = document.createElement('option');
      option.value = "";
      option.textContent = "-- Henüz Pazarlamacı Eklenmedi --";
      this.inputRepSelect.appendChild(option);
      return;
    }

    this.representatives.forEach(rep => {
      const option = document.createElement('option');
      option.value = rep;
      option.textContent = rep;
      this.inputRepSelect.appendChild(option);
    });
  }

  saveData(shouldBroadcast = true, actionType = 'UPDATE', dataPayload = null) {
    try {
      localStorage.setItem('sevkiyat_data_v1', JSON.stringify(this.shipments));
      localStorage.setItem('sevkiyat_disabled_days_v1', JSON.stringify(this.disabledDays));
      localStorage.setItem('sevkiyat_reps_v1', JSON.stringify(this.representatives));
      localStorage.setItem('sevkiyat_notes_v1', JSON.stringify(this.weeklyNotes));
      localStorage.setItem('sevkiyat_audit_logs_v1', JSON.stringify(this.auditLogs));
      localStorage.setItem('sevkiyat_fuel_prices_v1', JSON.stringify(this.fuelPrices));

      if (window.syncManager) {
        window.syncManager.markLocalMutation();
      }

      if (shouldBroadcast && window.syncManager) {
        window.syncManager.broadcast(actionType, dataPayload || {
          shipments: this.shipments,
          disabledDays: this.disabledDays,
          representatives: this.representatives,
          weeklyNotes: this.weeklyNotes,
          auditLogs: this.auditLogs,
          fuelPrices: this.fuelPrices
        });
      }
    } catch (e) {
      console.error("Veri kaydetme hatası:", e);
    }
  }

  // LOG EKLEME MOTORU (KİM NE ZAMAN NE İŞLEM YAPTI?)
  addAuditLog(actionType, title, details = '', repName = '') {
    const now = new Date();
    const formattedTime = now.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const logEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: now.toISOString(),
      formattedTime: formattedTime,
      actionType: actionType,
      title: title,
      details: details,
      repName: repName || 'Yönetici'
    };

    this.auditLogs.unshift(logEntry);

    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }

    localStorage.setItem('sevkiyat_audit_logs_v1', JSON.stringify(this.auditLogs));
  }

  getMondayISOString(mondayDate) {
    const d = new Date(mondayDate);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  startLiveClock() {
    const update = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const clockEl = document.getElementById('liveClock');
      if (clockEl) {
        clockEl.textContent = `${hours}:${minutes}:${seconds}`;
      }
    };
    update();
    setInterval(update, 1000);
  }

  formatDateTime(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
      return d.toLocaleDateString('tr-TR', options);
    } catch (e) {
      return '';
    }
  }

  getNextAvailableOrder(dayIndex, excludeShipmentId = null) {
    const currentWeekKey = this.getMondayISOString(this.currentWeekStart);

    const existingOrders = this.shipments
      .filter(s => {
        const itemWeekKey = s.weekKey || currentWeekKey;
        return itemWeekKey === currentWeekKey && s.dayOfWeek === dayIndex && s.id !== excludeShipmentId;
      })
      .map(s => s.shipmentOrder);

    const availableOrders = ['1. Sevk', '2. Sevk', '3. Sevk', '4. Sevk'];
    
    for (let order of availableOrders) {
      if (!existingOrders.includes(order)) {
        return order;
      }
    }
    return 'Ek Sevk';
  }

  getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  }

  formatDate(date) {
    const options = { day: 'numeric', month: 'long' };
    return date.toLocaleDateString('tr-TR', options);
  }

  getWeekDays() {
    const days = [];
    const monday = new Date(this.currentWeekStart);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

    for (let i = 0; i < 6; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      
      const checkDate = new Date(dayDate);
      checkDate.setHours(0, 0, 0, 0);

      const isToday = checkDate.getTime() === today.getTime();
      const isPast = checkDate.getTime() < today.getTime();

      days.push({
        dayIndex: i + 1,
        name: dayNames[i],
        dateStr: this.formatDate(dayDate),
        fullDate: dayDate,
        isToday: isToday,
        isPast: isPast
      });
    }
    return days;
  }

  initSyncEngine() {
    if (window.syncManager) {
      window.syncManager.onSync((payload) => {
        this.loadData();
        this.render();

        if (payload.action === 'ADD' && payload.data) {
          const item = payload.data;
          this.showToast(
            'Yeni Sevkiyat Eklendi',
            `${item.customerName} (${item.shipmentOrder}) sisteme eklendi.`
          );
        } else if (payload.action === 'TRANSFER') {
          this.showToast('Sevkiyat Transfer Edildi', 'Bir sevkiyat kartı başka güne aktarıldı ve önceki gününde transfer kaydı bırakıldı.');
        } else if (payload.action === 'UPDATE_NOTE') {
          this.showToast('Sevkiyat Notu Güncellendi', 'Ekran üstündeki sevkiyat duyuru notu canlı olarak güncellendi.');
        } else if (payload.action === 'UPDATE_REPS') {
          this.showToast('Pazarlamacı Listesi Güncellendi', 'Pazarlamacı/temsilci listesi canlı olarak güncellendi.');
        } else if (payload.action === 'MOVE') {
          this.showToast(
            'Sıralama Güncellendi',
            `Sevkiyat planı canlı olarak güncellendi.`
          );
        }
      });
    }
  }

  initEventListeners() {
    if (this.prevWeekBtn) {
      this.prevWeekBtn.addEventListener('click', () => {
        this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
        this.triggerWeekAnimation('prev');
        this.render();
      });
    }

    if (this.nextWeekBtn) {
      this.nextWeekBtn.addEventListener('click', () => {
        this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
        this.triggerWeekAnimation('next');
        this.render();
      });
    }

    if (this.todayWeekBtn) {
      this.todayWeekBtn.addEventListener('click', () => {
        const todayMonday = this.getMonday(new Date());
        const direction = todayMonday > this.currentWeekStart ? 'next' : 'prev';
        this.currentWeekStart = todayMonday;
        this.triggerWeekAnimation(direction);
        this.render();
      });
    }

    if (this.toggleMetricsDrawerBtn) {
      this.toggleMetricsDrawerBtn.addEventListener('click', () => {
        if (!this.metricsDrawer) return;
        const isCollapsed = this.metricsDrawer.classList.contains('collapsed');
        if (isCollapsed) {
          this.metricsDrawer.classList.remove('collapsed');
          this.toggleMetricsDrawerBtn.innerHTML = '📊 Özet Metrikler & Fiyatlar ▲';
        } else {
          this.metricsDrawer.classList.add('collapsed');
          this.toggleMetricsDrawerBtn.innerHTML = '📊 Özet Metrikler & Fiyatlar ▼';
        }
      });
    }

    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase().trim();
        this.renderGridOnly();
      });
    }

    if (this.filterStatusSelect) {
      this.filterStatusSelect.addEventListener('change', (e) => {
        this.statusFilter = e.target.value;
        this.renderGridOnly();
      });
    }

    if (this.audioToggleBtn) {
      this.audioToggleBtn.addEventListener('click', () => {
        const isMuted = this.audioToggleBtn.classList.contains('muted');
        const newState = isMuted;
        window.syncManager.setAudioEnabled(newState);
        this.updateAudioBtnUI(newState);
      });
    }

    if (this.testSoundBtn) {
      this.testSoundBtn.addEventListener('click', () => {
        window.syncManager.testSound();
        this.showToast('Ses Testi', 'Bildirim sesi çalındı.');
      });
    }

    if (!this.isReadOnly) {
      if (this.inputDaySelect) {
        this.inputDaySelect.addEventListener('change', () => {
          const selectedDay = parseInt(this.inputDaySelect.value, 10);
          const suggestedOrder = this.getNextAvailableOrder(selectedDay, this.editingShipmentId);
          this.inputOrderSelect.value = suggestedOrder;
        });
      }

      if (this.newShipmentBtn) this.newShipmentBtn.addEventListener('click', () => this.openModal());
      if (this.closeModalBtn) this.closeModalBtn.addEventListener('click', () => this.closeModal());
      if (this.cancelModalBtn) this.cancelModalBtn.addEventListener('click', () => this.closeModal());

      if (this.shipmentForm) {
        this.shipmentForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleFormSubmit();
        });
      }

      if (this.manageRepsBtn) this.manageRepsBtn.addEventListener('click', () => this.openRepManagerModal());
      if (this.closeRepModalBtn) this.closeRepModalBtn.addEventListener('click', () => this.closeRepManagerModal());
      if (this.doneRepModalBtn) this.doneRepModalBtn.addEventListener('click', () => this.closeRepManagerModal());

      if (this.addRepBtn) this.addRepBtn.addEventListener('click', () => this.handleAddRep());
      if (this.newRepInput) {
        this.newRepInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.handleAddRep();
          }
        });
      }

      // Sevkiyat Notu Modal Event Listeners
      if (this.closeNoteModalBtn) this.closeNoteModalBtn.addEventListener('click', () => this.closeNoteModal());
      if (this.cancelNoteModalBtn) this.cancelNoteModalBtn.addEventListener('click', () => this.closeNoteModal());
      if (this.noteForm) {
        this.noteForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSaveWeeklyNote();
        });
      }

      // Sevkiyat Aktar / Transfer Modal Event Listeners
      if (this.closeTransferModalBtn) this.closeTransferModalBtn.addEventListener('click', () => this.closeTransferModal());
      if (this.cancelTransferModalBtn) this.cancelTransferModalBtn.addEventListener('click', () => this.closeTransferModal());
      if (this.transferForm) {
        this.transferForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleTransferSubmit();
        });
      }

      // İşlem Logları Modal Event Listeners
      if (this.viewAuditLogsBtn) this.viewAuditLogsBtn.addEventListener('click', () => this.openAuditLogModal());
      if (this.closeAuditLogModalBtn) this.closeAuditLogModalBtn.addEventListener('click', () => this.closeAuditLogModal());
      if (this.doneAuditLogModalBtn) this.doneAuditLogModalBtn.addEventListener('click', () => this.closeAuditLogModal());
      if (this.clearAuditLogsBtn) this.clearAuditLogsBtn.addEventListener('click', () => this.clearAuditLogs());

      if (this.auditLogSearchInput) {
        this.auditLogSearchInput.addEventListener('input', () => this.renderAuditLogList());
      }
      if (this.auditLogActionFilter) {
        this.auditLogActionFilter.addEventListener('change', () => this.renderAuditLogList());
      }

      // Hızlı Not Şablon Butonları
      document.querySelectorAll('.btn-template-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const template = btn.dataset.template;
          if (this.inputWeeklyNoteText && template) {
            this.inputWeeklyNoteText.value = template;
          }
        });
      });
      // Akaryakıt Fiyat Güncelleme Click Listeners
      if (this.dieselCardBtn) {
        this.dieselCardBtn.addEventListener('click', () => this.promptUpdateFuel('diesel'));
      }
      if (this.gasolineCardBtn) {
        this.gasolineCardBtn.addEventListener('click', () => this.promptUpdateFuel('gasoline'));
      }
    }

    if (this.audioToggleBtn && window.syncManager) {
      this.updateAudioBtnUI(window.syncManager.audioEnabled);
    }
  }

  // --- İŞLEM & DENETİM LOG METOTLARI ---
  openAuditLogModal() {
    if (this.isReadOnly) return;
    this.renderAuditLogList();
    if (this.auditLogModal) this.auditLogModal.classList.add('active');
  }

  closeAuditLogModal() {
    if (this.auditLogModal) this.auditLogModal.classList.remove('active');
  }

  clearAuditLogs() {
    if (this.isReadOnly) return;
    if (confirm('Tüm işlem log geçmişini silmek istediğinizden emin misiniz?')) {
      this.auditLogs = [];
      localStorage.setItem('sevkiyat_audit_logs_v1', JSON.stringify([]));
      if (window.syncManager) {
        window.syncManager.pushToSupabaseDB('CLEAR_LOGS');
      }
      this.renderAuditLogList();
      this.showToast('Loglar Temizlendi', 'Tüm işlem log kaydı silindi.');
    }
  }

  renderAuditLogList() {
    if (!this.auditLogListEl) return;
    this.auditLogListEl.innerHTML = '';

    const searchVal = this.auditLogSearchInput ? this.auditLogSearchInput.value.toLowerCase().trim() : '';
    const filterVal = this.auditLogActionFilter ? this.auditLogActionFilter.value : 'ALL';

    const filteredLogs = this.auditLogs.filter(log => {
      if (filterVal !== 'ALL' && log.actionType !== filterVal) return false;
      if (searchVal) {
        const matchTarget = `${log.title} ${log.details} ${log.repName} ${log.formattedTime}`.toLowerCase();
        if (!matchTarget.includes(searchVal)) return false;
      }
      return true;
    });

    if (this.auditLogTotalCount) {
      this.auditLogTotalCount.textContent = filteredLogs.length;
    }

    if (filteredLogs.length === 0) {
      this.auditLogListEl.innerHTML = `
        <li style="text-align: center; padding: 1.5rem; color: #64748b; font-size: 0.85rem;">
          Gösterilecek işlem log kaydı bulunmamaktadır.
        </li>
      `;
      return;
    }

    filteredLogs.forEach(log => {
      const li = document.createElement('li');
      li.style.cssText = 'background: #ffffff; padding: 0.65rem 0.85rem; border-radius: 6px; border: 1px solid #cbd5e1; display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.82rem; border-left: 4px solid #2563eb;';

      if (log.actionType === 'TRANSFER') li.style.borderLeftColor = '#0284c7';
      else if (log.actionType === 'DELETE') li.style.borderLeftColor = '#dc2626';
      else if (log.actionType === 'STATUS') li.style.borderLeftColor = '#16a34a';
      else if (log.actionType === 'NOTE') li.style.borderLeftColor = '#d97706';
      else if (log.actionType === 'SERVICE') li.style.borderLeftColor = '#9333ea';

      li.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: #0f172a; font-size: 0.85rem;">${log.title}</strong>
          <span style="font-size: 0.7rem; color: #64748b; font-weight: 600;">🕒 ${log.formattedTime}</span>
        </div>
        <div style="color: #475569; font-size: 0.78rem;">${log.details}</div>
        <div style="font-size: 0.7rem; color: #1e293b; font-weight: 700; display: flex; align-items: center; gap: 0.3rem;">
          <span>👤 Temsilci / Pazarlamacı:</span>
          <span style="background: #f1f5f9; padding: 0.05rem 0.35rem; border-radius: 3px; border: 1px solid #cbd5e1;">${log.repName || 'Yönetici'}</span>
        </div>
      `;

      this.auditLogListEl.appendChild(li);
    });
  }

  // --- SEVKİYAT AKTAR / TRANSFER METOTLARI ---
  openTransferModal(shipment) {
    if (this.isReadOnly || !shipment) return;
    this.transferringShipmentId = shipment.id;

    const dayNames = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const currentDayName = dayNames[shipment.dayOfWeek] || '';

    if (this.transferShipmentInfoText) {
      this.transferShipmentInfoText.textContent = `Sevkiyat: "${shipment.customerName}" (${currentDayName} Günü)`;
    }

    if (this.inputTargetDay) {
      const nextDay = (shipment.dayOfWeek % 6) + 1;
      this.inputTargetDay.value = nextDay;
    }

    if (this.inputTransferReason) {
      this.inputTransferReason.value = '';
    }

    if (this.transferModal) this.transferModal.classList.add('active');
  }

  closeTransferModal() {
    if (this.transferModal) this.transferModal.classList.remove('active');
    this.transferringShipmentId = null;
  }

  handleTransferSubmit() {
    if (this.isReadOnly || !this.transferringShipmentId) return;

    const targetDayIndex = parseInt(this.inputTargetDay.value, 10);
    const reason = this.inputTransferReason ? this.inputTransferReason.value.trim() : '';

    this.transferShipment(this.transferringShipmentId, targetDayIndex, reason);
    this.closeTransferModal();
  }

  transferShipment(id, targetDayIndex, reason = '') {
    if (this.isReadOnly) return;
    const shipment = this.shipments.find(s => s.id === id);
    if (!shipment) return;

    const dayNames = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const oldDayIndex = shipment.dayOfWeek;
    const oldDayName = dayNames[oldDayIndex] || 'Eski Gün';
    const newDayName = dayNames[targetDayIndex] || 'Yeni Gün';

    if (oldDayIndex === targetDayIndex) {
      alert("Sevkiyat zaten seçilen günde yer almaktadır!");
      return;
    }

    const currentWeekKey = this.getMondayISOString(this.currentWeekStart);

    // 1. Önceki günde kalan kayıt için "TRANSFER EDİLDİ" iz bırakma kartı oluştur
    const transferRecordId = 'trans_rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const transferRecordCard = {
      id: transferRecordId,
      dayOfWeek: oldDayIndex,
      shipmentOrder: shipment.shipmentOrder,
      customerName: shipment.customerName,
      timeOfDay: shipment.timeOfDay,
      representative: shipment.representative,
      deliveryAddress: shipment.deliveryAddress,
      status: 'Transfer Edildi',
      notes: reason ? `Transfer Notu: ${reason}` : `Aktarıldı -> ${newDayName}`,
      weekKey: currentWeekKey,
      isTransferredRecord: true,
      transferredToDayName: newDayName,
      createdAt: new Date().toISOString()
    };

    // 2. Aktarılan ana sevkiyat kartını hedef güne taşı ve transfer geçmişini kaydet
    const suggestedOrder = this.getNextAvailableOrder(targetDayIndex);
    shipment.dayOfWeek = targetDayIndex;
    shipment.shipmentOrder = suggestedOrder;
    shipment.weekKey = currentWeekKey;
    shipment.transferredFromDayName = oldDayName;
    if (reason) shipment.notes = (shipment.notes ? shipment.notes + ' | ' : '') + `Aktarım (${oldDayName}->${newDayName}): ${reason}`;

    this.shipments.push(transferRecordCard);

    // LOG EKLEME
    this.addAuditLog(
      'TRANSFER',
      `↗️ Sevkiyat Gün Transferi: "${shipment.customerName}"`,
      `${oldDayName} gününden ${newDayName} gününe aktarıldı. ${reason ? 'Transfer Sebebi: ' + reason : ''}`,
      shipment.representative
    );

    this.saveData(true, 'TRANSFER', { shipment, transferRecordCard });
    this.render();

    this.showToast('Sevkiyat Transfer Edildi', `${shipment.customerName} ${newDayName} gününe aktarıldı. Önceki günde transfer bilgisi bırakıldı.`);

    if (window.syncManager && window.syncManager.audioEnabled) {
      window.syncManager.speakText(`${shipment.customerName} sevkiyatı ${newDayName} gününe aktarıldı.`);
    }
  }

  openNoteModal() {
    if (this.isReadOnly) return;
    const currentWeekKey = this.getMondayISOString(this.currentWeekStart);
    const existingNote = this.weeklyNotes[currentWeekKey] || '';
    if (this.inputWeeklyNoteText) {
      this.inputWeeklyNoteText.value = existingNote || 'Borçka yükü için 2. müşteri beklenmektedir.';
    }
    if (this.noteModal) this.noteModal.classList.add('active');
  }

  closeNoteModal() {
    if (this.noteModal) this.noteModal.classList.remove('active');
  }

  handleSaveWeeklyNote() {
    if (this.isReadOnly || !this.inputWeeklyNoteText) return;
    const noteText = this.inputWeeklyNoteText.value.trim();
    const currentWeekKey = this.getMondayISOString(this.currentWeekStart);

    if (noteText) {
      this.weeklyNotes[currentWeekKey] = noteText;
      this.addAuditLog('NOTE', `📢 Sevkiyat Duyuru Notu Güncellendi`, `Yayınlanan Not: "${noteText}"`, 'Yönetici');
      this.showToast('Sevkiyat Notu Kaydedildi', 'Haftalık duyuru notu canlı olarak yayınlandı.');
      if (window.syncManager && window.syncManager.audioEnabled) {
        window.syncManager.speakText(`Yeni sevkiyat notu yayınlandı: ${noteText}`);
      }
    } else {
      delete this.weeklyNotes[currentWeekKey];
      this.addAuditLog('NOTE', `📢 Sevkiyat Duyuru Notu Kaldırıldı`, `Duyuru notu silindi.`, 'Yönetici');
      this.showToast('Sevkiyat Notu Silindi', 'Haftalık duyuru notu kaldırıldı.');
    }

    this.saveData(true, 'UPDATE_NOTE', { weekKey: currentWeekKey, note: noteText });
    this.closeNoteModal();
    this.renderWeeklyNoteBanner();
  }

  clearWeeklyNote() {
    if (this.isReadOnly) return;
    const currentWeekKey = this.getMondayISOString(this.currentWeekStart);
    if (confirm('Bu haftaya ait sevkiyat duyuru notunu silmek istediğinizden emin misiniz?')) {
      delete this.weeklyNotes[currentWeekKey];
      this.addAuditLog('NOTE', `📢 Sevkiyat Duyuru Notu Temizlendi`, `Not temizlendi.`, 'Yönetici');
      this.saveData(true, 'UPDATE_NOTE', { weekKey: currentWeekKey, note: '' });
      this.renderWeeklyNoteBanner();
      this.showToast('Not Kaldırıldı', 'Duyuru notu kaldırıldı.');
    }
  }

  openRepManagerModal() {
    if (this.isReadOnly) return;
    this.renderRepList();
    if (this.repManagerModal) this.repManagerModal.classList.add('active');
  }

  closeRepManagerModal() {
    if (this.repManagerModal) this.repManagerModal.classList.remove('active');
    if (this.newRepInput) this.newRepInput.value = '';
  }

  renderRepList() {
    if (!this.repListEl) return;
    this.repListEl.innerHTML = '';
    
    if (this.representatives.length === 0) {
      this.repListEl.innerHTML = `<li class="rep-item" style="justify-content: center; color: var(--text-subtle);">Henüz kayıtlı pazarlamacı bulunmamaktadır.</li>`;
      return;
    }

    this.representatives.forEach((rep, index) => {
      const li = document.createElement('li');
      li.className = 'rep-item';
      li.innerHTML = `
        <span class="rep-item-name">👤 ${rep}</span>
        <div class="rep-item-actions">
          <button class="action-btn delete-btn delete-rep-btn" data-index="${index}" title="Pazarlamacıyı Sil">🗑️</button>
        </div>
      `;

      li.querySelector('.delete-rep-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleDeleteRep(index);
      });

      this.repListEl.appendChild(li);
    });
  }

  handleAddRep() {
    if (this.isReadOnly || !this.newRepInput) return;
    const name = this.newRepInput.value.trim();
    if (!name) {
      alert("Lütfen geçerli bir temsilci/pazarlamacı adı giriniz.");
      return;
    }

    if (this.representatives.includes(name)) {
      alert("Bu temsilci zaten listede mevcut!");
      return;
    }

    this.representatives.push(name);
    this.newRepInput.value = '';
    this.addAuditLog('UPDATE', `👤 Yeni Pazarlamacı Eklendi`, `Temsilci Listesine "${name}" eklendi.`, name);
    this.saveData(true, 'UPDATE_REPS');
    this.populateRepDropdown();
    this.renderRepList();
    this.renderGridOnly();
    this.showToast('Pazarlamacı Eklendi', `${name} temsilci listesine eklendi.`);
  }

  handleDeleteRep(index) {
    if (this.isReadOnly) return;
    const repName = this.representatives[index];
    if (confirm(`"${repName}" isimli temsilciyi silmek istediğinize emin misiniz?`)) {
      this.representatives.splice(index, 1);
      this.addAuditLog('DELETE', `👤 Pazarlamacı Silindi`, `Temsilci Listesinden "${repName}" kaldırıldı.`, repName);
      this.saveData(true, 'UPDATE_REPS');
      this.populateRepDropdown();
      this.renderRepList();
      this.renderGridOnly();
      this.showToast('Pazarlamacı Silindi', `${repName} listeden kaldırıldı.`);
    }
  }

  updateAudioBtnUI(enabled) {
    if (!this.audioToggleBtn) return;
    if (enabled) {
      this.audioToggleBtn.classList.remove('muted');
      this.audioToggleBtn.innerHTML = '🔊 Ses: Açık';
    } else {
      this.audioToggleBtn.classList.add('muted');
      this.audioToggleBtn.innerHTML = '🔇 Ses: Kapalı';
    }
  }

  triggerWeekAnimation(direction) {
    if (!this.weeklyGridEl) return;
    this.weeklyGridEl.classList.remove('slide-next', 'slide-prev');
    void this.weeklyGridEl.offsetWidth;
    this.weeklyGridEl.classList.add(direction === 'next' ? 'slide-next' : 'slide-prev');
  }

  // --- 3. RENDERING ENGINE ---
  render() {
    this.updateWeekTitle();
    this.updateDashboardMetrics();
    this.renderWeeklyNoteBanner();
    this.renderGridOnly();
  }

  updateWeekTitle() {
    if (!this.weekTitleEl) return;
    const monday = new Date(this.currentWeekStart);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    const startDay = monday.getDate();
    const startMonth = monday.toLocaleDateString('tr-TR', { month: 'long' });
    const endDay = saturday.getDate();
    const endMonth = saturday.toLocaleDateString('tr-TR', { month: 'long' });
    const year = saturday.getFullYear();

    if (startMonth === endMonth) {
      this.weekTitleEl.textContent = `${startDay} - ${endDay} ${startMonth} ${year}`;
    } else {
      this.weekTitleEl.textContent = `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
    }
  }

  updateDashboardMetrics() {
    const currentWeekKey = this.getMondayISOString(this.currentWeekStart);
    
    const weekShipments = this.shipments.filter(s => {
      const itemWeekKey = s.weekKey || currentWeekKey;
      return itemWeekKey === currentWeekKey;
    });

    const activeShipments = weekShipments.filter(s => !s.isTransferredRecord);
    const total = activeShipments.length;
    const pending = activeShipments.filter(s => s.status === 'Beklemede').length;
    const transit = activeShipments.filter(s => s.status === 'Hazırlanıyor' || s.status === 'Yolda').length;
    const delivered = activeShipments.filter(s => s.status === 'Teslim Edildi').length;
    const transferred = weekShipments.filter(s => s.isTransferredRecord).length;

    // Tamamlanma Başarı Oranı (%)
    const completionRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

    // En Yoğun İlçe Tespiti
    const districtCounts = {};
    activeShipments.forEach(s => {
      const d = this.extractDistrict(s.deliveryAddress) || 'Belirtilmedi';
      districtCounts[d] = (districtCounts[d] || 0) + 1;
    });

    let topDistrict = 'Yok';
    let maxDistCount = 0;
    for (let d in districtCounts) {
      if (districtCounts[d] > maxDistCount) {
        maxDistCount = districtCounts[d];
        topDistrict = `${d} (${maxDistCount})`;
      }
    }

    // En Yoğun Pazarlamacı Tespiti
    const repCounts = {};
    activeShipments.forEach(s => {
      const r = s.representative || 'Temsilcisiz';
      repCounts[r] = (repCounts[r] || 0) + 1;
    });

    let topRep = 'Yok';
    let maxRepCount = 0;
    for (let r in repCounts) {
      if (repCounts[r] > maxRepCount) {
        maxRepCount = repCounts[r];
        topRep = `${r} (${maxRepCount})`;
      }
    }

    if (this.totalCountEl) this.totalCountEl.textContent = total;
    if (this.pendingCountEl) this.pendingCountEl.textContent = pending;
    if (this.transitCountEl) this.transitCountEl.textContent = transit;
    if (this.deliveredCountEl) this.deliveredCountEl.textContent = delivered;

    const completionRateEl = document.getElementById('completionRateVal');
    if (completionRateEl) completionRateEl.textContent = `%${completionRate}`;

    const topDistrictEl = document.getElementById('topDistrictVal');
    if (topDistrictEl) topDistrictEl.textContent = topDistrict;

    const topRepEl = document.getElementById('topRepVal');
    if (topRepEl) topRepEl.textContent = topRep;

    const transferredCountEl = document.getElementById('transferredCountVal');
    if (transferredCountEl) transferredCountEl.textContent = transferred;
  }

  promptUpdateFuel(type) {
    if (this.isReadOnly) return;
    const isDiesel = type === 'diesel';
    const fuelName = isDiesel ? 'Motorin (Dizel)' : 'Benzin (95 Oktan)';
    const currentPrice = isDiesel ? (this.fuelPrices.diesel || '45.40') : (this.fuelPrices.gasoline || '44.85');

    const newPrice = prompt(`Güncel ${fuelName} Litre Fiyatını Giriniz (TL):`, currentPrice);
    if (newPrice !== null && newPrice.trim() !== '') {
      const formattedPrice = parseFloat(newPrice.replace(',', '.')).toFixed(2);
      if (isNaN(formattedPrice) || formattedPrice <= 0) {
        alert("Lütfen geçerli bir fiyat giriniz!");
        return;
      }

      if (isDiesel) {
        this.fuelPrices.diesel = formattedPrice;
      } else {
        this.fuelPrices.gasoline = formattedPrice;
      }

      this.addAuditLog('UPDATE', `⛽ Akaryakıt Fiyatı Güncellendi`, `${fuelName} güncel litre fiyatı ₺${formattedPrice} / Lt olarak ayarlandı.`, 'Yönetici');
      this.saveData(true, 'UPDATE_FUEL', { fuelPrices: this.fuelPrices });
      this.updateDashboardMetrics();
      this.showToast('Akaryakıt Fiyatı Güncellendi', `${fuelName} fiyatı ₺${formattedPrice} / Lt olarak kaydedildi.`);
    }
  }

  // HAFTALIK SEVKİYAT / BEKLEYEN YÜK DUYURU NOTU BÖLÜMÜ
  renderWeeklyNoteBanner() {
    if (!this.weeklyNoteBannerContainer) return;
    this.weeklyNoteBannerContainer.innerHTML = '';

    const currentWeekKey = this.getMondayISOString(this.currentWeekStart);
    const noteText = this.weeklyNotes ? this.weeklyNotes[currentWeekKey] : null;

    const banner = document.createElement('div');
    banner.className = `weekly-announcement-banner ${!noteText ? 'empty-banner' : ''}`;

    if (noteText) {
      banner.innerHTML = `
        <div class="announcement-left">
          <span class="announcement-badge">📢 SEVKİYAT DUYURUSU & NOTU</span>
          <span class="announcement-text">"${noteText}"</span>
        </div>
        ${!this.isReadOnly ? `
          <div class="announcement-controls">
            <button class="btn-announcement-action edit-btn" title="Duyuru Notunu Düzenle">✏️ Düzenle</button>
            <button class="btn-announcement-action delete-btn" title="Duyuruyu Sil">🗑️ Temizle</button>
          </div>
        ` : ''}
      `;

      if (!this.isReadOnly) {
        banner.querySelector('.edit-btn').addEventListener('click', () => this.openNoteModal());
        banner.querySelector('.delete-btn').addEventListener('click', () => this.clearWeeklyNote());
      }
    } else {
      banner.innerHTML = `
        <div class="announcement-left placeholder">
          <span class="announcement-badge placeholder">📢 SEVKİYAT NOT ALANI</span>
          <span class="announcement-text placeholder">${this.isReadOnly ? 'Şu an için aktif bir sevk duyuru notu bulunmamaktadır.' : 'Henüz bu hafta için duyuru notu eklenmedi. (Örn: "Borçka yükü için 2. müşteri beklenmektedir.")'}</span>
        </div>
        ${!this.isReadOnly ? `
          <div class="announcement-controls">
            <button class="btn-announcement-action add-btn">➕ Sevkiyat Notu Ekle</button>
          </div>
        ` : ''}
      `;

      if (!this.isReadOnly) {
        banner.querySelector('.add-btn').addEventListener('click', () => this.openNoteModal());
      }
    }

    this.weeklyNoteBannerContainer.appendChild(banner);
  }

  isDayDisabled(dayIndex) {
    const currentWeekKey = this.getMondayISOString(this.currentWeekStart);
    return this.disabledDays.some(d => d.weekKey === currentWeekKey && d.dayOfWeek === dayIndex);
  }

  toggleDayDisabled(dayIndex, dayName) {
    if (this.isReadOnly) return;
    const currentWeekKey = this.getMondayISOString(this.currentWeekStart);
    const existingIndex = this.disabledDays.findIndex(d => d.weekKey === currentWeekKey && d.dayOfWeek === dayIndex);

    if (existingIndex > -1) {
      this.disabledDays.splice(existingIndex, 1);
      this.addAuditLog('SERVICE', `🚫 Servis Açıldı`, `${dayName} günü tekrar sevkiyata açıldı.`, 'Yönetici');
      this.showToast('Servis Açıldı', `${dayName} günü tekrar sevkiyata açıldı.`);
    } else {
      this.disabledDays.push({ weekKey: currentWeekKey, dayOfWeek: dayIndex });
      this.addAuditLog('SERVICE', `🚫 Araç Serviste İle Kapatıldı`, `${dayName} günü sevk alımına kapatıldı.`, 'Yönetici');
      this.showToast('Araç Serviste', `${dayName} günü için sevk alımı kapatıldı.`);
    }

    this.saveData(true, 'UPDATE_DISABLED_DAYS');
    this.renderGridOnly();
  }

  renderGridOnly() {
    if (!this.weeklyGridEl) return;
    const days = this.getWeekDays();
    const currentWeekKey = this.getMondayISOString(this.currentWeekStart);

    this.weeklyGridEl.innerHTML = '';

    days.forEach(day => {
      const isDayDisabled = this.isDayDisabled(day.dayIndex);

      const dayShipments = this.shipments.filter(s => {
        const itemWeekKey = s.weekKey || currentWeekKey;
        if (itemWeekKey !== currentWeekKey) return false;
        if (s.dayOfWeek !== day.dayIndex) return false;

        if (this.searchTerm) {
          const matchTarget = `${s.customerName} ${s.representative} ${s.deliveryAddress} ${s.notes}`.toLowerCase();
          if (!matchTarget.includes(this.searchTerm)) return false;
        }

        if (this.statusFilter !== 'ALL' && s.status !== this.statusFilter) {
          return false;
        }

        return true;
      });

      const orderRank = { '1. Sevk': 1, '2. Sevk': 2, '3. Sevk': 3, '4. Sevk': 4, 'Ek Sevk': 5 };
      dayShipments.sort((a, b) => (orderRank[a.shipmentOrder] || 99) - (orderRank[b.shipmentOrder] || 99));

      const activeDayShipmentsCount = dayShipments.filter(s => !s.isTransferredRecord).length;
      const isOverCapacity = activeDayShipmentsCount > 5 && !isDayDisabled;
      const capacityPercent = Math.min(100, Math.round((activeDayShipmentsCount / 5) * 100));

      const colEl = document.createElement('div');
      colEl.className = `day-column ${day.isToday ? 'today' : ''} ${day.isPast ? 'past-day' : ''} ${isOverCapacity ? 'over-capacity' : ''} ${isDayDisabled ? 'is-out-of-service' : ''}`;
      colEl.dataset.dayIndex = day.dayIndex;

      colEl.innerHTML = `
        <div class="day-header ${day.isToday ? 'today-header' : ''} ${isOverCapacity ? 'over-capacity-header' : ''} ${isDayDisabled ? 'out-of-service-header' : ''}">
          <div class="day-header-top">
            <div class="day-title-group">
              <span class="day-name">${day.name}</span>
              <span class="day-date">${day.dateStr}</span>
            </div>
            <div class="day-header-controls">
              ${!this.isReadOnly ? `
                <button class="toggle-service-btn ${isDayDisabled ? 'active' : ''}" title="${day.name} günü için Araç Serviste / Sevk İptali İşaretle">🚫</button>
              ` : ''}
              <button class="print-day-btn" title="${day.name} Yükleme Listesini Yazdır">🖨️</button>
              <span class="shipment-count-badge ${isOverCapacity ? 'over-capacity-badge' : ''}">
                ${isDayDisabled ? 'SEVK YOK' : (isOverCapacity ? 'Aşım (' + activeDayShipmentsCount + ')' : activeDayShipmentsCount + ' Sevk')}
              </span>
            </div>
          </div>

          ${!isDayDisabled ? `
            <div class="capacity-label">
              <span>Kapasite</span>
              <span>%${capacityPercent}</span>
            </div>
            <div class="capacity-progress-bar">
              <div class="capacity-fill ${isOverCapacity ? 'over' : ''}" style="width: ${capacityPercent}%;"></div>
            </div>
          ` : ''}
        </div>
        <div class="cards-dropzone" data-day-index="${day.dayIndex}"></div>
      `;

      if (!this.isReadOnly) {
        const toggleBtn = colEl.querySelector('.toggle-service-btn');
        if (toggleBtn) {
          toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDayDisabled(day.dayIndex, day.name);
          });
        }
      }

      colEl.querySelector('.print-day-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.printDayManifest(day.name, day.dateStr, dayShipments.filter(s => !s.isTransferredRecord));
      });

      const dropzone = colEl.querySelector('.cards-dropzone');

      if (isDayDisabled) {
        dropzone.innerHTML = `
          <div class="out-of-service-banner">
            <span class="title">🚫 ARAÇ SERVİSTE / SEVK YOK</span>
            <span class="desc">Araç bakımda veya bu gün için sevk alımı kapatılmıştır.</span>
          </div>
        `;
        if (dayShipments.length > 0) {
          dayShipments.forEach(shipment => {
            const cardEl = this.createShipmentCard(shipment);
            dropzone.appendChild(cardEl);
          });
        }
      } else if (dayShipments.length === 0) {
        dropzone.innerHTML = `<div class="empty-day-state">Sevkiyat Bulunmuyor</div>`;
      } else {
        dayShipments.forEach(shipment => {
          const cardEl = this.createShipmentCard(shipment);
          dropzone.appendChild(cardEl);
        });
      }

      if (!this.isReadOnly) {
        this.attachDropzoneEvents(dropzone);
      }
      
      this.weeklyGridEl.appendChild(colEl);
    });
  }

  extractDistrict(address) {
    if (!address) return null;
    const knownDistricts = [
      'Borçka', 'Hopa', 'Artvin', 'Arhavi', 'Ardanuç', 'Şavşat', 'Yusufeli', 'Murgul',
      'Rize', 'Pazar', 'Ardeşen', 'Fındıklı', 'Çayeli', 'Trabzon', 'Of', 'Akçaabat', 'Sürmene',
      'Kadıköy', 'Ataşehir', 'Ümraniye', 'Maltepe', 'Kartal', 'Pendik', 'Tuzla',
      'Üsküdar', 'Beykoz', 'Sancaktepe', 'Sultanbeyli', 'Şile', 'Çekmeköy',
      'Beşiktaş', 'Şişli', 'Sarıyer', 'Fatih', 'Zeytinburnu', 'Bakırköy', 'Başakşehir',
      'Giresun', 'Ordu', 'Samsun', 'Ankara', 'İzmir', 'Bursa'
    ];

    for (let district of knownDistricts) {
      if (address.toLowerCase().includes(district.toLowerCase())) {
        return district;
      }
    }

    const words = address.trim().split(/[\s,.-]+/);
    if (words.length > 0 && words[0].length >= 3) {
      return words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
    }

    return null;
  }

  createShipmentCard(shipment) {
    const card = document.createElement('div');
    
    const isCancelled = shipment.status === 'İptal';
    const isDelivered = shipment.status === 'Teslim Edildi';
    const isPreparing = shipment.status === 'Hazırlanıyor';
    const isTransferredRecord = shipment.isTransferredRecord;

    const createdTime = shipment.createdAt ? new Date(shipment.createdAt).getTime() : Date.now();
    const isWithin45Mins = (Date.now() - createdTime) < (45 * 60 * 1000);
    const isStillPending = shipment.status === 'Beklemede';
    const isNewShipment = (shipment.isNew !== false) && isStillPending && isWithin45Mins && !isTransferredRecord;

    if (!isNewShipment && shipment.isNew) {
      shipment.isNew = false;
    }

    card.className = `shipment-card ${isCancelled ? 'is-cancelled' : ''} ${isDelivered ? 'is-delivered' : ''} ${isPreparing ? 'is-preparing' : ''} ${isNewShipment ? 'is-new' : ''} ${isTransferredRecord ? 'is-transferred-card' : ''} ${this.isReadOnly ? 'read-only-card' : ''}`;
    card.draggable = !this.isReadOnly && !isTransferredRecord;
    card.dataset.id = shipment.id;

    const statusSlug = shipment.status.toLowerCase().replace(/\s+/g, '-').replace(/ı/g, 'i').replace(/ş/g, 's');

    let statusText = shipment.status;
    if (isTransferredRecord) {
      statusText = '↗️ AKTARILDI';
    } else if (isDelivered) statusText = '✓ TESLİM EDİLDİ';
    else if (isPreparing) statusText = '⚡ HAZIRLANIYOR';
    else if (isCancelled) statusText = '✕ İPTAL EDİLDİ';
    else if (shipment.status === 'Beklemede') statusText = '⏳ BEKLEMEDE';
    else if (shipment.status === 'Yolda') statusText = '🚛 YOLDA';

    const formattedCreatedDate = this.formatDateTime(shipment.createdAt);

    card.innerHTML = `
      ${isNewShipment ? `
        <div class="floating-new-badge-on-top">✨ YENİ SEVKİYAT</div>
      ` : ''}

      ${isTransferredRecord ? `
        <div class="transferred-to-badge" title="Bu sevkiyat ${shipment.transferredToDayName || 'başka bir'} gününe aktarılmıştır">
          ↗️ ${shipment.transferredToDayName ? shipment.transferredToDayName.toUpperCase() + ' GÜNÜNE AKTARILDI' : 'BAŞKA GÜNE AKTARILDI'}
        </div>
      ` : ''}

      ${shipment.transferredFromDayName && !isTransferredRecord ? `
        <div class="transferred-from-badge" title="Bu sevkiyat ${shipment.transferredFromDayName} gününden aktarılmıştır">
          ↗️ ${shipment.transferredFromDayName.toUpperCase()} GÜNÜNDEN AKTARILDI
        </div>
      ` : ''}

      <div class="card-top">
        <div class="order-handle-group" title="${this.isReadOnly ? 'Sevk Sırası' : 'Sıralamayı değiştirmek için sürükleyin'}">
          ${!this.isReadOnly && !isTransferredRecord ? '<span class="drag-handle-icon">⋮⋮</span>' : ''}
          <span class="order-badge">${shipment.shipmentOrder || '1. Sevk'}</span>
        </div>
        <div class="status-pill status-${statusSlug} ${isTransferredRecord ? 'status-transferred' : ''}" title="${this.isReadOnly ? 'Sevkiyat Durumu' : 'Tıklayarak durumu hızlıca değiştirin'}">
          <span>${statusText}</span>
        </div>
      </div>

      <div class="card-customer-title" title="Müşteri / Alıcı">
        <span>${shipment.customerName || 'Alıcı Unvanı Yok'}</span>
      </div>

      <div class="card-meta-bar">
        <span class="rep-tag" title="Pazarlamacı / Temsilci: ${shipment.representative || 'Belirtilmedi'}">
          ${shipment.representative || 'Belirtilmedi'}
        </span>
        ${formattedCreatedDate ? `<span class="created-at-tag" title="Kayıt / Ekleme Zamanı">🕒 ${formattedCreatedDate}</span>` : ''}
      </div>

      <div class="card-address-box" title="Teslimat Adresi">
        <span class="district-pill">📍 ${shipment.deliveryAddress || 'Adres Girilmedi'}</span>
      </div>

      ${shipment.notes ? `<div class="card-note-snippet">Not: ${shipment.notes}</div>` : ''}

      <div class="card-footer">
        <span class="time-tag">${shipment.timeOfDay || 'Gün Boyu / Esnek'}</span>
        ${!this.isReadOnly && !isTransferredRecord ? `
          <div class="card-actions">
            <button class="action-btn transfer-btn" title="Başka Güne Aktar / Transfer Et">↗️</button>
            <button class="action-btn edit-btn" title="Düzenle">✏️</button>
            <button class="action-btn delete-btn" title="Sil">🗑️</button>
          </div>
        ` : (!this.isReadOnly && isTransferredRecord ? `
          <div class="card-actions">
            <button class="action-btn delete-btn" title="Transfer Kaydını Sil">🗑️</button>
          </div>
        ` : '')}
      </div>
    `;

    if (!this.isReadOnly) {
      if (!isTransferredRecord) {
        const statusPill = card.querySelector('.status-pill');
        if (statusPill) {
          statusPill.addEventListener('click', (e) => {
            e.stopPropagation();
            this.cycleShipmentStatus(shipment.id);
          });
        }

        card.addEventListener('dragstart', (e) => {
          this.draggedShipmentId = shipment.id;
          card.classList.add('dragging');
          e.dataTransfer.setData('text/plain', shipment.id);
          e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
          this.draggedShipmentId = null;
        });

        const transferBtn = card.querySelector('.transfer-btn');
        if (transferBtn) {
          transferBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openTransferModal(shipment);
          });
        }

        const editBtn = card.querySelector('.edit-btn');
        if (editBtn) {
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openModal(shipment);
          });
        }
      }

      const deleteBtn = card.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteShipment(shipment.id);
        });
      }
    } else {
      const statusPill = card.querySelector('.status-pill');
      if (statusPill) {
        statusPill.style.cursor = 'default';
      }
    }

    return card;
  }

  cycleShipmentStatus(id) {
    if (this.isReadOnly) return;
    const statusCycle = ['Beklemede', 'Hazırlanıyor', 'Yolda', 'Teslim Edildi', 'İptal'];
    const shipment = this.shipments.find(s => s.id === id);
    if (!shipment) return;

    const currentIndex = statusCycle.indexOf(shipment.status);
    const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];

    shipment.status = nextStatus;
    shipment.isNew = false;

    // LOG EKLEME
    this.addAuditLog(
      'STATUS',
      `🔄 Durum Güncellendi: "${shipment.customerName}"`,
      `Sevkiyat durumu "${nextStatus}" olarak değiştirildi.`,
      shipment.representative
    );

    this.saveData(true, 'UPDATE', shipment);
    this.render();

    if (window.syncManager) {
      window.syncManager.playAlertSound('update_shipment');
    }

    this.showToast('Durum Güncellendi', `${shipment.customerName} durumu "${nextStatus}" olarak değiştirildi.`);
  }

  // --- 4. DRAG AND DROP HANDLERS ---
  attachDropzoneEvents(dropzone) {
    if (this.isReadOnly) return;

    const targetDayIndex = parseInt(dropzone.dataset.dayIndex, 10);

    dropzone.addEventListener('dragover', (e) => {
      if (this.isDayDisabled(targetDayIndex)) {
        return;
      }

      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      dropzone.classList.add('drag-over');

      const draggingCard = document.querySelector('.shipment-card.dragging');
      if (!draggingCard) return;

      const afterElement = this.getDragAfterElement(dropzone, e.clientY);
      if (afterElement == null) {
        dropzone.appendChild(draggingCard);
      } else {
        dropzone.insertBefore(draggingCard, afterElement);
      }
    });

    dropzone.addEventListener('dragleave', (e) => {
      if (!dropzone.contains(e.relatedTarget)) {
        dropzone.classList.remove('drag-over');
      }
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');

      const draggedId = this.draggedShipmentId;

      if (!draggedId || !targetDayIndex) return;

      if (this.isDayDisabled(targetDayIndex)) {
        alert("Bu gün araç serviste/sevk kapalı olarak işaretlendiği için sevkiyat bu güne taşınamaz!");
        this.render();
        return;
      }

      const shipment = this.shipments.find(s => s.id === draggedId);
      if (!shipment || shipment.isTransferredRecord) return;

      const dayNames = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
      const oldDayIndex = shipment.dayOfWeek;

      // Günler arası sürükleniyorsa onay iste
      if (oldDayIndex !== targetDayIndex) {
        const oldDayName = dayNames[oldDayIndex] || 'Eski Gün';
        const newDayName = dayNames[targetDayIndex] || 'Yeni Gün';
        const confirmMsg = `"${shipment.customerName}" sevkiyatını ${oldDayName} gününden ${newDayName} gününe taşımak istediğinizden emin misiniz?`;

        if (!confirm(confirmMsg)) {
          this.render();
          return;
        }

        // LOG EKLEME (SÜRÜKLE BIRAK TRANSFERİ)
        this.addAuditLog(
          'TRANSFER',
          `↗️ Sürükle-Bırak Gün Transferi: "${shipment.customerName}"`,
          `${oldDayName} gününden ${newDayName} gününe taşındı.`,
          shipment.representative
        );
      }

      const currentWeekKey = this.getMondayISOString(this.currentWeekStart);

      shipment.dayOfWeek = targetDayIndex;
      shipment.weekKey = currentWeekKey;

      this.reorderDayShipmentsFromDOM(dropzone, targetDayIndex);
      this.saveData(true, 'MOVE', shipment);
      this.render();

      const newDayName = dayNames[targetDayIndex] || '';
      this.showToast('Sevkiyat Taşındı', `${shipment.customerName} ${newDayName} gününe taşındı.`);
    });
  }

  reorderDayShipmentsFromDOM(dropzone, dayIndex) {
    const cardElements = Array.from(dropzone.querySelectorAll('.shipment-card'));
    const orderRanks = ['1. Sevk', '2. Sevk', '3. Sevk', '4. Sevk', 'Ek Sevk'];

    cardElements.forEach((card, index) => {
      const id = card.dataset.id;
      const shipment = this.shipments.find(s => s.id === id);
      if (shipment) {
        shipment.shipmentOrder = orderRanks[Math.min(index, 4)];
      }
    });
  }

  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.shipment-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // --- 5. MODAL FORM & ACTIONS ---
  openModal(shipmentToEdit = null) {
    if (this.isReadOnly) return;
    this.editingShipmentId = shipmentToEdit ? shipmentToEdit.id : null;

    if (this.editingShipmentId) {
      if (this.modalTitle) this.modalTitle.textContent = 'SEVKİYAT DÜZENLE';
      
      const s = shipmentToEdit;
      if (this.inputDaySelect) this.inputDaySelect.value = s.dayOfWeek;
      if (this.inputOrderSelect) this.inputOrderSelect.value = s.shipmentOrder;
      
      document.getElementById('inputCustomerName').value = s.customerName;
      document.getElementById('inputTimeOfDay').value = s.timeOfDay;
      document.getElementById('inputRepresentative').value = s.representative;
      document.getElementById('inputAddress').value = s.deliveryAddress;
      document.getElementById('inputStatus').value = s.status;
      document.getElementById('inputNotes').value = s.notes || '';
    } else {
      if (this.modalTitle) this.modalTitle.textContent = 'YENİ SEVKİYAT GİRİŞİ';
      if (this.shipmentForm) this.shipmentForm.reset();
      
      const defaultDay = 1;
      if (this.inputDaySelect) this.inputDaySelect.value = defaultDay;
      const suggestedOrder = this.getNextAvailableOrder(defaultDay);
      if (this.inputOrderSelect) this.inputOrderSelect.value = suggestedOrder;
      
      document.getElementById('inputStatus').value = 'Beklemede';

      if (this.representatives.length > 0) {
        document.getElementById('inputRepresentative').value = this.representatives[0];
      }
    }

    if (this.shipmentModal) this.shipmentModal.classList.add('active');
  }

  closeModal() {
    if (this.shipmentModal) this.shipmentModal.classList.remove('active');
    this.editingShipmentId = null;
    if (this.shipmentForm) this.shipmentForm.reset();
  }

  handleFormSubmit() {
    if (this.isReadOnly) return;
    const dayOfWeek = parseInt(document.getElementById('inputDay').value, 10);
    const shipmentOrder = document.getElementById('inputShipmentOrder').value;
    const customerName = document.getElementById('inputCustomerName').value.trim();
    const timeOfDay = document.getElementById('inputTimeOfDay').value;
    const representative = document.getElementById('inputRepresentative').value;
    const deliveryAddress = document.getElementById('inputAddress').value.trim();
    const status = document.getElementById('inputStatus').value;
    const notes = document.getElementById('inputNotes').value.trim();

    if (!customerName || !deliveryAddress || !representative) {
      alert("Lütfen müşteri unvanını, pazarlamacıyı ve adresi tam giriniz!");
      return;
    }

    const currentWeekKey = this.getMondayISOString(this.currentWeekStart);

    if (this.editingShipmentId) {
      const index = this.shipments.findIndex(s => s.id === this.editingShipmentId);
      if (index !== -1) {
        this.shipments[index] = {
          ...this.shipments[index],
          dayOfWeek,
          shipmentOrder,
          customerName,
          timeOfDay,
          representative,
          deliveryAddress,
          status,
          notes,
          weekKey: currentWeekKey
        };

        // LOG EKLEME
        this.addAuditLog(
          'UPDATE',
          `✏️ Sevkiyat Düzenlendi: "${customerName}"`,
          `Sıra: ${shipmentOrder} | Temsilci: ${representative} | Durum: ${status} | Adres: ${deliveryAddress}`,
          representative
        );

        this.saveData(true, 'UPDATE', this.shipments[index]);
        this.showToast('Sevkiyat Güncellendi', `${customerName} bilgileri güncellendi.`);
      }
    } else {
      const newShipment = {
        id: 'ship_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        dayOfWeek,
        shipmentOrder,
        customerName,
        timeOfDay,
        representative,
        deliveryAddress,
        status,
        notes,
        weekKey: currentWeekKey,
        isNew: true,
        createdAt: new Date().toISOString()
      };

      this.shipments.push(newShipment);

      // LOG EKLEME
      this.addAuditLog(
        'ADD',
        `➕ Yeni Sevkiyat Eklendi: "${customerName}"`,
        `Sıra: ${shipmentOrder} | Pazarlamacı: ${representative} | Adres: ${deliveryAddress}`,
        representative
      );

      this.saveData(true, 'ADD', newShipment);
      this.showToast('Yeni Sevkiyat Eklendi', `${customerName} (${shipmentOrder}) eklendi.`);

      if (window.syncManager) {
        window.syncManager.announceNewShipment(customerName);
      }
    }

    this.closeModal();
    this.render();
  }

  deleteShipment(id) {
    if (this.isReadOnly) return;
    const shipment = this.shipments.find(s => s.id === id);
    if (!shipment) return;

    if (confirm(`"${shipment.customerName}" sevkiyat kaydını silmek istediğinizden emin misiniz?`)) {
      // LOG EKLEME
      this.addAuditLog(
        'DELETE',
        `🗑️ Sevkiyat Silindi: "${shipment.customerName}"`,
        `${shipment.shipmentOrder} kaydı yönetici paneli üzerinden silindi.`,
        shipment.representative
      );

      this.shipments = this.shipments.filter(s => s.id !== id);
      this.saveData(true, 'DELETE', { id: id });
      this.render();
      this.showToast('Sevkiyat Silindi', `${shipment.customerName} kaydı silindi.`);
    }
  }

  // --- 6. PRINT MANIFEST ENGINE ---
  printDayManifest(dayName, dateStr, dayShipments) {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    
    let tableRowsHTML = '';
    if (dayShipments.length === 0) {
      tableRowsHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:#64748b;">Bu gün için planlanmış sevkiyat bulunmamaktadır.</td></tr>`;
    } else {
      dayShipments.forEach((s, idx) => {
        tableRowsHTML += `
          <tr>
            <td style="font-weight:bold; text-align:center;">${idx + 1}</td>
            <td><strong>${s.shipmentOrder}</strong></td>
            <td><strong>${s.customerName}</strong></td>
            <td>${s.representative}</td>
            <td>${s.deliveryAddress} ${s.notes ? '<br><small><i>Not: ' + s.notes + '</i></small>' : ''}</td>
            <td>${s.timeOfDay}</td>
          </tr>
        `;
      });
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>Gürkan Yapı - ${dayName} Sevkiyat Yükleme Listesi</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 2rem; color: #0f172a; }
          .print-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #c5a059; padding-bottom: 1rem; margin-bottom: 1.5rem; }
          .print-header h1 { font-size: 1.4rem; margin: 0; text-transform: uppercase; color: #0f172a; }
          .print-header p { margin: 0.2rem 0 0 0; color: #64748b; font-size: 0.9rem; }
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          th, td { border: 1px solid #cbd5e1; padding: 0.75rem 0.85rem; font-size: 0.88rem; text-align: left; }
          th { background: #f1f5f9; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; }
          .print-footer { margin-top: 3rem; display: flex; justify-content: space-between; font-size: 0.85rem; color: #475569; }
          .signature-box { border-top: 1px solid #94a3b8; width: 200px; text-align: center; padding-top: 0.5rem; }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div>
            <h1>GÜRKAN YAPI MALZEMELERİ</h1>
            <p><strong>SEVKİYAT YÜKLEME VE TESLİMAT LİSTESİ</strong></p>
          </div>
          <div style="text-align:right;">
            <h2 style="margin:0; font-size:1.2rem; color:#2563eb;">${dayName.toUpperCase()}</h2>
            <p style="margin:0.2rem 0 0 0;"> Tarih: ${dateStr}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:40px; text-align:center;">#</th>
              <th style="width:90px;">SEVK SIRASI</th>
              <th>MÜŞTERİ / ALICI UNVANI</th>
              <th style="width:140px;">PAZARLAMACI</th>
              <th>TESLİMAT ADRESİ & NOTLAR</th>
              <th style="width:140px;">ZAMAN DİLİMİ</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHTML}
          </tbody>
        </table>

        <div class="print-footer">
          <div class="signature-box">Teslim Eden / Sürücü Imza</div>
          <div class="signature-box">Sevkiyat Sorumlusu Imza</div>
        </div>

        <script>
          window.onload = function() { window.print(); window.close(); };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  showToast(title, desc) {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.innerHTML = `
      <div class="toast-content">
        <div class="title">${title}</div>
        <div class="desc">${desc}</div>
      </div>
    `;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }
}

// Uygulamayı Başlat
document.addEventListener('DOMContentLoaded', () => {
  window.app = new ShipmentApp();
});
