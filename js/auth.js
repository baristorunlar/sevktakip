/**
 * GÜRKAN YAPI MALZEMELERİ - YÖNETİCİ PANELİ ŞİFRELİ KİMLİK DOĞRULAMA MOTORU
 */

class AuthManager {
  constructor() {
    this.SESSION_KEY = "gurkan_admin_authenticated_session_v1";

    this.checkAdminProtection();
    this.initPINModal();
  }

  // Obfuskasyonlu Şifre Doğrulama (file://, http://, https:// tüm ortamlarda 100% sorunsuz çalışır)
  verifyPIN(enteredPin) {
    if (!enteredPin) return false;
    const cleanPin = String(enteredPin).trim();
    
    // 8426 Şifresinin Gizlenmiş ASCII Karşılığı (56='8', 52='4', 50='2', 54='6')
    const encryptedSecret = String.fromCharCode(56, 52, 50, 54);
    
    return cleanPin === encryptedSecret;
  }

  isAuthenticated() {
    return sessionStorage.getItem(this.SESSION_KEY) === 'true';
  }

  loginSuccess() {
    sessionStorage.setItem(this.SESSION_KEY, 'true');
    window.location.href = 'admin.html';
  }

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    window.location.href = 'index.html';
  }

  checkAdminProtection() {
    const isAdminPage = window.location.pathname.includes('admin.html');
    
    if (isAdminPage) {
      // Eğer yönetici sayfasındaysak ve yetki yoksa ana sayfaya şifre uyarısıyla yönlendir
      if (!this.isAuthenticated()) {
        window.location.href = 'index.html?auth_required=true';
      }
    } else {
      // İzleme ekranına her dönüldüğünde yetkiyi sıfırla ki her Yönetici Girişinde 8426 sorsun!
      sessionStorage.removeItem(this.SESSION_KEY);
    }
  }

  initPINModal() {
    document.addEventListener('DOMContentLoaded', () => {
      const btnOpenAdminAuth = document.getElementById('btnOpenAdminAuth');
      const pinAuthModal = document.getElementById('pinAuthModal');
      const closePinModalBtn = document.getElementById('closePinModalBtn');
      const cancelPinModalBtn = document.getElementById('cancelPinModalBtn');
      const pinAuthForm = document.getElementById('pinAuthForm');
      const pinAuthInput = document.getElementById('pinAuthInput');
      const pinErrorMessage = document.getElementById('pinErrorMessage');
      const btnLogoutAdmin = document.getElementById('btnLogoutAdmin');

      if (btnLogoutAdmin) {
        btnLogoutAdmin.addEventListener('click', () => {
          if (confirm('Yönetici oturumunu kapatmak istediğinizden emin misiniz?')) {
            this.logout();
          }
        });
      }

      if (btnOpenAdminAuth && pinAuthModal) {
        // HER SEFERİNDE 8426 ŞİFRESİNİ SORMASI İÇİN DİREKT MODALI AÇAR
        btnOpenAdminAuth.addEventListener('click', (e) => {
          e.preventDefault();
          pinAuthModal.classList.add('active');
          if (pinAuthInput) {
            pinAuthInput.value = '';
            setTimeout(() => pinAuthInput.focus(), 150);
          }
          if (pinErrorMessage) pinErrorMessage.style.display = 'none';
        });

        const closeModal = () => {
          pinAuthModal.classList.remove('active');
          if (pinAuthInput) pinAuthInput.value = '';
          if (pinErrorMessage) pinErrorMessage.style.display = 'none';
        };

        if (closePinModalBtn) closePinModalBtn.addEventListener('click', closeModal);
        if (cancelPinModalBtn) cancelPinModalBtn.addEventListener('click', closeModal);

        if (pinAuthForm) {
          pinAuthForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const entered = pinAuthInput ? pinAuthInput.value : '';
            const isValid = this.verifyPIN(entered);

            if (isValid) {
              closeModal();
              this.loginSuccess();
            } else {
              if (pinErrorMessage) pinErrorMessage.style.display = 'block';
              if (pinAuthInput) {
                pinAuthInput.classList.add('pin-shake');
                setTimeout(() => pinAuthInput.classList.remove('pin-shake'), 400);
              }
            }
          });
        }

        if (window.location.search.includes('auth_required=true')) {
          pinAuthModal.classList.add('active');
          if (pinAuthInput) {
            setTimeout(() => pinAuthInput.focus(), 150);
          }
        }
      }
    });
  }
}

window.authManager = new AuthManager();
