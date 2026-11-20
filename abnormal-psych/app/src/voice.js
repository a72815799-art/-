/* 음성: 브라우저 TTS(문장 단위 큐), 오디오 파일 재생(Media Session), 음성 인식 래퍼 */
(function (G) {
  'use strict';
  // ---------- TTS ----------
  function Speaker(synth) {
    this.synth = synth || (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);
    this.supported = !!(this.synth && typeof SpeechSynthesisUtterance !== 'undefined');
    this.rate = 1; this.token = 0; this.list = []; this.i = 0; this.playing = false; this.paused = false;
    this.onSentence = null; this.onEnd = null; this.onState = null; this.voice = null; this.lastError = null;
    if (this.supported) { const pick = () => { const vs = this.synth.getVoices() || []; this.voice = vs.find(v => /^ko(-|_|$)/i.test(v.lang) && /google/i.test(v.name)) || vs.find(v => /^ko/i.test(v.lang)) || null; }; pick(); if ('onvoiceschanged' in this.synth) this.synth.onvoiceschanged = pick; }
  }
  Speaker.prototype.hasKorean = function () { return !!this.voice; };
  Speaker.prototype._emit = function () { if (this.onState) this.onState({ playing: this.playing, paused: this.paused, i: this.i, n: this.list.length }); };
  // sentences: 문자열 배열. 문장 하나씩 말한다(긴 발화가 끊기는 브라우저 문제 회피).
  Speaker.prototype.speakList = function (sentences, opts) {
    opts = opts || {};
    if (!this.supported) { this.lastError = '이 브라우저는 음성 합성(TTS)을 지원하지 않습니다.'; if (opts.onEnd) opts.onEnd({ error: this.lastError }); return false; }
    this.stop(true);
    this.list = sentences.slice(); this.i = opts.startAt || 0; this.onSentence = opts.onSentence || null; this.onEnd = opts.onEnd || null;
    this.playing = true; this.paused = false; this._next(); return true;
  };
  Speaker.prototype._next = function () {
    const tok = ++this.token;
    if (this.i >= this.list.length) { this.playing = false; this._emit(); const cb = this.onEnd; this.onEnd = null; if (cb) cb({ done: true }); return; }
    const u = new SpeechSynthesisUtterance(this.list[this.i]);
    u.lang = 'ko-KR'; u.rate = this.rate; if (this.voice) u.voice = this.voice;
    u.onend = () => { if (tok !== this.token || this.paused) return; this.i++; this._next(); };
    u.onerror = (e) => { if (tok !== this.token) return; if (e && (e.error === 'interrupted' || e.error === 'canceled')) return; this.lastError = 'TTS 오류: ' + (e && e.error); this.i++; this._next(); };
    if (this.onSentence) this.onSentence(this.i, this.list[this.i]);
    this._emit();
    this.synth.speak(u);
  };
  // 일시정지: 안드로이드 크롬의 pause/resume 불안정 문제를 피하려고 취소 후 현재 문장부터 재개한다.
  Speaker.prototype.pause = function () { if (!this.playing) return; this.paused = true; this.token++; this.synth.cancel(); this._emit(); };
  Speaker.prototype.resume = function () { if (!this.playing || !this.paused) return; this.paused = false; this._next(); };
  Speaker.prototype.repeatSentence = function () { if (!this.playing) return; this.token++; this.synth.cancel(); this.paused = false; this._next(); };
  Speaker.prototype.stop = function (silent) { this.token++; if (this.synth) this.synth.cancel(); const was = this.playing; this.playing = false; this.paused = false; if (!silent && was) this._emit(); };
  Speaker.prototype.say = function (text, onEnd) { return this.speakList(Array.isArray(text) ? text : (G.Core ? G.Core.splitSentences(text) : [text]), { onEnd }); };

  // ---------- 오디오 파일 플레이어 (화면 잠금·백그라운드용) ----------
  function AudioPlayer(audioEl) {
    this.el = audioEl; this.tracks = []; this.i = 0; this.onTrack = null; this.onEndAll = null; this.repeat = false;
    this.el.addEventListener('ended', () => { if (this.repeat) { this.play(this.i); return; } if (this.i + 1 < this.tracks.length) this.play(this.i + 1); else if (this.onEndAll) this.onEndAll(); });
    if (typeof navigator !== 'undefined' && navigator.mediaSession) {
      const ms = navigator.mediaSession;
      try {
        ms.setActionHandler('play', () => this.el.play());
        ms.setActionHandler('pause', () => this.el.pause());
        ms.setActionHandler('nexttrack', () => this.next());
        ms.setActionHandler('previoustrack', () => this.prev());
        ms.setActionHandler('seekbackward', () => { this.el.currentTime = Math.max(0, this.el.currentTime - 10); });
        ms.setActionHandler('seekforward', () => { this.el.currentTime += 10; });
      } catch (e) { /* 일부 브라우저는 일부 동작 미지원 */ }
    }
  }
  AudioPlayer.prototype.load = function (tracks) { this.tracks = tracks; };
  AudioPlayer.prototype.play = function (i, t) {
    if (i != null) { this.i = i; this.el.src = this.tracks[i].src; if (t) this.el.currentTime = t; }
    const tr = this.tracks[this.i];
    if (typeof navigator !== 'undefined' && navigator.mediaSession && typeof MediaMetadata !== 'undefined') navigator.mediaSession.metadata = new MediaMetadata({ title: tr.title, artist: '이상심리학 기말 강의', album: tr.album || '' });
    if (this.onTrack) this.onTrack(this.i, tr);
    return this.el.play();
  };
  AudioPlayer.prototype.pause = function () { this.el.pause(); };
  AudioPlayer.prototype.next = function () { if (this.i + 1 < this.tracks.length) this.play(this.i + 1); };
  AudioPlayer.prototype.prev = function () { if (this.el.currentTime > 5) this.el.currentTime = 0; else if (this.i > 0) this.play(this.i - 1); };

  // ---------- 음성 인식 ----------
  function Recognizer() {
    const SR = (typeof window !== 'undefined') && (window.SpeechRecognition || window.webkitSpeechRecognition);
    this.supported = !!SR; this.SR = SR; this.active = null;
  }
  // 한 번 듣고 결과를 돌려준다. cb({text, confidence, alternatives}) 또는 cb({error})
  Recognizer.prototype.listenOnce = function (cb) {
    if (!this.supported) { cb({ error: '이 브라우저는 음성 인식을 지원하지 않습니다(안드로이드 크롬·PC 크롬 권장). 아래 입력창에 명령을 입력할 수 있습니다.' }); return; }
    if (this.active) try { this.active.abort(); } catch (e) {}
    const r = new this.SR(); this.active = r;
    r.lang = 'ko-KR'; r.interimResults = false; r.maxAlternatives = 3; r.continuous = false;
    let done = false;
    r.onresult = (e) => { done = true; const res = e.results[0]; const alts = []; for (let i = 0; i < res.length; i++) alts.push({ text: res[i].transcript, confidence: res[i].confidence }); cb({ text: alts[0].text, confidence: alts[0].confidence, alternatives: alts }); };
    r.onerror = (e) => { done = true; const map = { 'not-allowed': '마이크 권한이 거부되었습니다. 브라우저 주소창의 권한 설정에서 마이크를 허용하세요.', 'no-speech': '음성이 들리지 않았습니다. 다시 시도하세요.', 'network': '음성 인식 서버에 연결하지 못했습니다(인터넷 연결 필요).', 'service-not-allowed': '이 환경에서는 음성 인식 서비스가 허용되지 않습니다(file:// 실행이나 보안 정책 때문일 수 있음).' }; cb({ error: map[e.error] || ('음성 인식 오류: ' + e.error) }); };
    r.onend = () => { this.active = null; if (!done) cb({ error: '인식된 말이 없습니다.' }); };
    try { r.start(); } catch (e) { cb({ error: '음성 인식을 시작하지 못했습니다: ' + e.message }); }
  };
  Recognizer.prototype.abort = function () { if (this.active) try { this.active.abort(); } catch (e) {} };

  G.Voice = { Speaker, AudioPlayer, Recognizer };
})(typeof globalThis !== 'undefined' ? globalThis : this);
