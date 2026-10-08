// Desktop-focused notification alert system: Sound, Visual Vibration, Toast, & Native Desktop Notifications

// 1. Play subtle professional audio chime (via new Audio('/sounds/notification.mp3') with Web Audio API synthesizer fallback)
export const playNotificationSound = () => {
  try {
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.6;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback to Web Audio API synthesized chime if HTML5 audio playback is restricted
        playSynthesizedChime();
      });
    }
  } catch (e) {
    playSynthesizedChime();
  }
};

// Web Audio API dual-tone chime synthesizer fallback
export const playSynthesizedChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Tone 1 (High bell sound - 880 Hz A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.4);

    // Tone 2 (Harmonic bell response - 1320 Hz E6 starting 80ms later)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
    gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.6);
  } catch (err) {
    // Ignore audio context errors
  }
};

// 2. Request Native Desktop Notification Permission
export const requestDesktopNotificationPermission = async () => {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (err) {
        console.warn('Desktop Notification permission request error:', err);
      }
    }
  }
};

// 3. Trigger Native Desktop Web Notification (alerts user even if browser tab is minimized or in background)
export const triggerDesktopWebNotification = ({ title = 'ELS CMMS Alert', body = '', icon = '/els-logo.png', onClick }) => {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body,
          icon,
          tag: 'els-cmms-notif-' + Date.now(),
          renotify: true
        });
        notif.onclick = () => {
          window.focus();
          if (typeof onClick === 'function') onClick();
          notif.close();
        };
      } catch (err) {
        console.warn('Error creating desktop notification:', err);
      }
    }
  }
};

// 4. Combined Notification Alert Dispatcher
export const notifyNewNotification = ({ title = 'ELS CMMS Notification', message = '', type = 'info', toast }) => {
  // Play subtle audio chime
  playNotificationSound();

  // Trigger Native Desktop Web Notification
  triggerDesktopWebNotification({
    title,
    body: message
  });

  // Display Animated Floating Toast Message (top-right)
  if (toast && typeof toast[type] === 'function') {
    toast[type](message, 6000);
  } else if (toast && typeof toast.info === 'function') {
    toast.info(message, 6000);
  }
};
