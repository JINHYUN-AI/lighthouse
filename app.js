
  /**
   * [22. 등대의집] 메타버스 엔진 v8.4 - 직원 하이패스 & 실명 네임택 버전
   */

  const firebaseConfig = {
    apiKey: "AIzaSyCHpf6GMmBNebEsxfev_6EeJs9RWmoGhxA",
    authDomain: "lighthouse-metaverse.firebaseapp.com",
    projectId: "lighthouse-metaverse",
    storageBucket: "lighthouse-metaverse.firebasestorage.app",
    messagingSenderId: "775698570684",
    appId: "1:775698570684:web:21028310dea709b0445fb9",
    measurementId: "G-TH13P9FLC0",
    databaseURL: "https://lighthouse-metaverse-default-rtdb.firebaseio.com/"
  };

  // [v34.6] 워크스페이스 동적 링크 관리
  window.workspaceUrl = "https://workspace.jinhyun.ai.kr";
  window.openWorkspace = function () {
    window.open(window.workspaceUrl, '_blank');
  };

  /* ════════════════════════════════════════════════════════════
     [MONITORING & ACCESS LOGGING MODULE]
     - 접속일시, 접속구분, 방문자유형, 계정, 접속기기, 브라우저/OS, 유입경로, 체류시간, 비고
  ════════════════════════════════════════════════════════════ */
  const Monitoring = {
    startTime: Date.now(),
    metaverseStartTime: null,
    hasLoggedHome: false,

    getDeviceInfo: function () {
      const ua = navigator.userAgent || "";
      let device = "PC";
      if (/tablet|ipad|playbook|silk/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        device = "Tablet";
      } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer/i.test(ua)) {
        device = "Mobile";
      }

      // 브라우저 파싱
      let browser = "Other";
      if (/Whale/i.test(ua)) browser = "Naver Whale";
      else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
      else if (/Edg/i.test(ua)) browser = "Edge";
      else if (/Chrome/i.test(ua)) browser = "Chrome";
      else if (/Safari/i.test(ua)) browser = "Safari";
      else if (/Firefox/i.test(ua)) browser = "Firefox";

      // OS 파싱
      let os = "Other";
      if (/Windows/i.test(ua)) os = "Windows";
      else if (/Android/i.test(ua)) os = "Android";
      else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
      else if (/Mac/i.test(ua)) os = "Mac";
      else if (/Linux/i.test(ua)) os = "Linux";

      return {
        device: device,
        browserOs: `${browser} (${os})`
      };
    },

    getReferrer: function () {
      let ref = document.referrer;
      if (!ref) {
        if (window.location && window.location.href.indexOf('light4u.kr') !== -1) {
          return 'light4u.kr (도메인)';
        }
        return '직접접속';
      }
      try {
        const url = new URL(ref);
        return url.hostname || '외부링크';
      } catch (e) {
        return ref.substring(0, 50);
      }
    },

    send: function (logData) {
      if (typeof google === 'undefined' || !google.script || !google.script.run) return;
      const dev = this.getDeviceInfo();
      const isStaffUser = (state.userEmail && state.staffConfigs && state.staffConfigs[state.userEmail]);
      const payload = {
        accessType: logData.accessType || "홈페이지",
        userType: logData.userType || (isStaffUser ? "직원" : "일반방문자"),
        account: logData.account || (state.userEmail || (state.avatar && state.avatar.name ? state.avatar.name : "익명")),
        device: dev.device,
        browserOs: dev.browserOs,
        referrer: this.getReferrer(),
        stayDuration: (logData.stayDuration !== undefined) ? logData.stayDuration : Math.floor((Date.now() - this.startTime) / 1000),
        notes: logData.notes || ""
      };

      google.script.run
        .withSuccessHandler(function (res) { })
        .withFailureHandler(function (err) {
          console.warn("모니터링 로그 전송 실패 (무시):", err);
        })
        .recordMonitoringLog(payload);
    },

    logHomepageAccess: function () {
      if (this.hasLoggedHome) return;
      this.hasLoggedHome = true;
      const isStaffUser = (state.userEmail && state.staffConfigs && state.staffConfigs[state.userEmail]);
      this.send({
        accessType: "홈페이지",
        userType: isStaffUser ? "직원" : "일반방문자",
        account: state.userEmail || "일반방문자",
        stayDuration: 0,
        notes: "홈페이지 접속"
      });
    },

    logMetaverseAccess: function (persona, isStaff) {
      this.metaverseStartTime = Date.now();
      this.send({
        accessType: "메타버스",
        userType: isStaff ? "직원" : "일반방문자",
        account: persona + (state.userEmail ? ` (${state.userEmail})` : ""),
        stayDuration: 0,
        notes: `메타버스 월드 입장 [${persona}]`
      });
    },

    logMetaverseExit: function () {
      const staySec = this.metaverseStartTime ? Math.floor((Date.now() - this.metaverseStartTime) / 1000) : 0;
      const persona = (state.avatar && state.avatar.name) ? state.avatar.name : "Guest";
      const isStaffUser = (state.staffConfigs && state.staffConfigs[persona]);
      this.send({
        accessType: "메타버스",
        userType: isStaffUser ? "직원" : "일반방문자",
        account: persona + (state.userEmail ? ` (${state.userEmail})` : ""),
        stayDuration: staySec,
        notes: `메타버스 정상 퇴장 (체류 ${staySec}초)`
      });
    },

    logEvent: function (eventName, category) {
      this.send({
        accessType: category || "홈페이지",
        stayDuration: Math.floor((Date.now() - this.startTime) / 1000),
        notes: eventName
      });
    }
  };

  let db = null;

  let state = {
    mapLoaded: false,
    currentFloor: 1,
    currentMapImg: null,
    collisionMask: null,
    foregroundMask: null,
    foregroundCanvas: null,
    colorMap: null, // [v9.2] 컬러 매칭 맵
    objectColorMap: null, // [v12.8] 오브젝트 매칭 맵 (F열)
    aiBotConfig: null, // [신규] AIbot 탭 캐릭터 폴더 ID
    fountainConfig: null, // [분수대] AIbot 탭 B3 셀 폴더 ID
    isNightMap: false, // [야간 모드 여부] I2 체크박스 또는 18시~06시 활성화 시 true
    fountain: {
      x: 1947,
      y: 1710,
      frames: [],
      frameIdx: 0,
      animTimer: 0,
      active: false
    },
    cinemaConfig: null, // [시네마] 극장 조명 애니메이션 폴더 ID (AIbot 탭 B4 셀)
    cinema: {
      x: 3060, // [기본 좌표] 국장님이 추후 수정 가능
      y: 340,
      displayW: 320, // 렌더링 너비
      frames: [], // 12개 프레임 이미지 배열
      frameOrder: ['1.png', '2.png', '3.png', '4.png', '5.png', '6.png', '1-1.png', '2-1.png', '3-1.png', '4-1.png', '5-1.png', '6-1.png'],
      seqIdx: 0, // 현재 재생 프레임 인덱스
      direction: 1, // 1: 정방향, -1: 역방향 (요요 루프)
      animTimer: 0,
      frameInterval: 0.1, // 프레임 전환 간격 (0.1초 = 100ms)
      active: false
    },
    aiBot: {
      active: false,
      x: 0,
      y: 0,
      direction: 'down',
      animFrame: 1,
      bitmaps: {},
      waypoints: [],
      waypointIdx: 0,
      forward: true,
      speed: 2.5,
      isPaused: false,
      speechText: "궁금하신점은 저에게 물어보세요.",
      animTimer: 0
    },
    // [신규] 빨간 동선(#ff0000) AI봇 2호 — 기존 aiBot과 완전히 독립
    aiBot2: {
      active: false,
      folderId: '1l6cVcdvn_ErSelnXb48IS-ayICH_NQrc',
      x: 0,
      y: 0,
      direction: 'down',
      animFrame: 1,
      bitmaps: {},
      waypoints: [],
      waypointIdx: 0,
      forward: true,
      speed: 2.5,
      isPaused: false,
      speechText: "궁금하신점은 저에게 물어보세요.",
      animTimer: 0,
      avatarLoaded: false
    },
    activeZone: null, // 현재 캐릭터가 서 있는 구역 정보
    auraAlpha: 0,
    auraDir: 1,
    avatar: {
      x: 350, y: 350,
      direction: 'down',
      animFrame: 1,
      bitmaps: {},
      shadowImg: null,
      personality: 'Persona_A',
      name: 'Guest',
      canJump: false, // [v9.6]
      canSpeed: false, // [v9.6]
      canFire: false, // [v16.0] 장풍 권한
      canSuperFire: false, // [v16.2] H열: 불꽃 슈퍼 장풍 권한
      isGhost: false, // [v10.0] 벽 투과 모드
      jumpY: 0,
      jumpVel: 0,
      isJumping: false,
      isFiring: false, // [v16.0] 장풍 발사 중 상태
      fireType: 'normal', // [v16.2] normal or flaming
      fireDirection: 'down',
      lastMoveTime: Date.now(), // 마지막 이동 시간 체크
      isBeingPulled: false, // [v19.0] 블랙홀에 빨려 들어가는 중 여부
      isDissolving: false, // [v16.2] 불꽃 피격 소멸 중 여부
      dissolveProgress: 0,
      hp: 100, // [신규] 체력 (최대 100)
      pullTargetX: 0,
      pullTargetY: 0
    },
    fireEffects: [], // [v16.0] 화면에 그려질 장풍 이펙트들
    allBitmaps: {},
    otherPlayers: {},
    mySessionId: null,
    keys: {},
    mapConfigs: {},
    charConfigs: {},
    staffConfigs: {},
    zoneConfigs: {}, // [v12.2] 층별 영역 이벤트 정보 객체 {'1층': [...], '2층': [...]}
    objectConfigs: {}, // [v12.3] 층별 동적 오브젝트 정보
    activeObjects: [], // [v12.3] 현재 맵에서 활성화된 오브젝트 목록과 위치 데이터
    userEmail: null,
    isRunning: false,
    firstEntry: true, // [v9.4] 최초 월드 입장 여부 체크
    zoneTimer: null,  // [v9.5] 안내 카드 자동 숨김 타이머
    isChatting: false, // [v11.0] 채팅 중 여부
    nearestPlayer: null, // [v11.0] 현재 마주보고 있는 플레이어
    vpW: 0, vpH: 0,
    lastFrameTime: 0,
    // [신규] 카메라 오프셋 (마우스 드래그 및 네비게이션 미니맵 클릭 이동용)
    camOffset: { x: 0, y: 0 },
    targetCamOffset: { x: 0, y: 0 },
    isDraggingMap: false,
    dragStart: { x: 0, y: 0 },
    // [신규] 특수 애니메이션 오브젝트 (챌린지 부스 등)
    specialMarkers: [
      { id: 'challenge_booth', text: '인권 감수성 챌린지 진행중', floor: 1, x: 1405, y: 20, active: false, color: "#00f2ff", shadow: "#00f2ff" },
      { id: 'recruit_booth', text: '직원채용 진행중', floor: 1, x: 2280, y: 760, active: false, color: "#ff00e1", shadow: "#ff00e1" }, // 핑크색 (#ff00e1)
      { id: 'practice_booth', text: '현장실습생 모집중', floor: 1, x: 2565, y: 760, active: false, color: "#00ff66", shadow: "#00ff66" }, // 초록색 (#00ff66)
      { id: 'cinema_booth', text: '등대 시네마 상영중', floor: 1, x: 3210, y: 310, active: true, color: "#ffcc00", shadow: "#ffcc00" }, // 황금색 (#ffcc00), 상시 활성
      { id: 'ai_center_marker', text: 'AI 센터', floor: 1, x: 460, y: 270, active: true, color: "#00f2ff", shadow: "#00f2ff", type: "cylindrical" } // 사이언 네온, 실린더형 디자인 적용 예정
    ]
  };

  /* [속도] 정적 음원 스트리밍: 사이트에 올려둔 audio/<구글드라이브 파일ID>.mp3 를 바로 재생(서버 Base64 변환 불필요).
     파일이 없거나 재생 불가(error)이면 onMissing() 으로 기존 Base64 방식 대체. 아이폰은 사용자 터치 전에는 미리 받지 않으므로
     로드 완료를 기다리지 않고 즉시 ready 로 간주한다. */
  function useStaticAudio(el, fileId, onMissing) {
    el.preload = 'auto';
    const onErr = () => { el.removeEventListener('error', onErr); try { onMissing(); } catch (e) { console.warn('[AUDIO] 대체 로드 실패:', e); } };
    el.addEventListener('error', onErr);
    el.src = 'audio/' + fileId + '.mp3';
  }

  /* ════════════════════════════════════════════════════════════
     [HOMEPAGE BGM MODULE] 홈페이지 배경음악 엔진
     - 기본값은 "켜짐(음소거 아님)" 상태이며, 접속 즉시 재생을 시도한다.
     - 재방문: 음원을 브라우저(IndexedDB)에 저장해 두고 서버 응답을 기다리지 않고 즉시 재생
     - 브라우저 자동재생(Autoplay) 정책 대응:
       1) 음원이 준비되면 즉시 play() 시도
       2) 차단되면 안내 말풍선을 띄우고, 화면 어디든 첫 클릭/터치/키 입력 시 즉시 재생
          (음원 로딩이 끝나기 전에 클릭해도 로딩 완료 즉시 재생)
       3) 좌측 하단 플로팅 버튼으로 수동 ON/OFF 토글 가능
     - 메타버스 진입 시 홈페이지 BGM 즉시 정지
  ════════════════════════════════════════════════════════════ */
  const HOMEPAGE_BGM = {
    el: null,
    ready: false,
    userInteracted: false,
    wantPlay: true,
    suspended: false,
    currentId: '',
    _bound: false,
    init() {
      if (this.el) return;
      this.el = document.getElementById('homepage-bgm');
      if (!this.el) return;
      this.el.volume = 0.35;
      this.el.loop = true;
      this.bindGesture();
    },
    bindGesture() {
      if (this._bound) return;
      this._bound = true;
      const unlock = (e) => {
        if (e && e.target && e.target.closest && e.target.closest('#homepage-bgm-btn')) return;
        this.userInteracted = true;
        if (this.wantPlay && !this.suspended && this.ready && this.el.paused) {
          this.el.play().then(() => { this.hideHint(); this.updateIcon(); }).catch(() => {});
        }
      };
      ['pointerup', 'click', 'touchend', 'keydown'].forEach(evt => window.addEventListener(evt, unlock, true));
    },
    _db() {
      return new Promise((resolve, reject) => {
        try {
          const req = indexedDB.open('hp_bgm_cache', 1);
          req.onupgradeneeded = () => req.result.createObjectStore('audio');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        } catch (e) { reject(e); }
      });
    },
    cacheGet(id) {
      return this._db().then(db => new Promise(resolve => {
        const r = db.transaction('audio').objectStore('audio').get(id);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => resolve(null);
      })).catch(() => null);
    },
    cachePut(id, val) {
      this._db().then(db => {
        const tx = db.transaction('audio', 'readwrite');
        tx.objectStore('audio').clear();
        tx.objectStore('audio').put(val, id);
      }).catch(() => {});
    },
    boot() {
      this.init();
      let id = '';
      try { id = localStorage.getItem('hp_bgm_id') || ''; } catch (e) { }
      if (!id) return;
      this.cacheGet(id).then(v => {
        if (v && v.base64 && !this.ready) {
          this.currentId = id;
          this.setSource(v.mimeType, v.base64);
        }
      });
    },
    setSource(mimeType, base64) {
      this.el.src = 'data:' + mimeType + ';base64,' + base64;
      this.ready = true;
      const btn = document.getElementById('homepage-bgm-btn');
      if (btn) btn.style.display = 'flex';
      if (!this.suspended) this.play();
    },
    loadFromFileId(fileId) {
      this.init();
      if (!this.el || !fileId) return;
      if (this.ready && this.currentId === fileId) return;
      if (typeof google === 'undefined' || !google.script) return;
      const legacy = () => google.script.run
        .withSuccessHandler(res => {
          if (!res || !res.success) {
            console.warn('[HP_BGM] 음원 로드 실패:', res && res.error);
            return;
          }
          this.currentId = fileId;
          try { localStorage.setItem('hp_bgm_id', fileId); } catch (e) { }
          this.cachePut(fileId, { mimeType: res.mimeType, base64: res.base64 });
          this.setSource(res.mimeType, res.base64);
        })
        .withFailureHandler(err => console.warn('[HP_BGM] 음원 요청 실패:', err))
        .getAudioBase64(fileId);
      useStaticAudio(this.el, fileId, legacy);
      this.currentId = fileId;
      try { localStorage.setItem('hp_bgm_id', fileId); } catch (e) { }
      this.ready = true;
      const hpBtn = document.getElementById('homepage-bgm-btn');
      if (hpBtn) hpBtn.style.display = 'flex';
      if (!this.suspended) this.play();
    },
    play() {
      this.init();
      if (!this.el || !this.ready) return;
      this.wantPlay = true;
      this.el.play().then(() => {
        this.hideHint();
        this.updateIcon();
      }).catch(() => {
        // 브라우저 자동재생 차단: 안내 후 첫 사용자 제스처 때 재생
        this.updateIcon();
        if (!this.userInteracted) this.showHint();
      });
    },
    stop() {
      this.suspended = true;
      this.hideHint();
      if (!this.el) return;
      this.el.pause();
      this.el.currentTime = 0;
      this.updateIcon();
    },
    pause() {
      this.wantPlay = false;
      this.hideHint();
      if (!this.el) return;
      this.el.pause();
      this.updateIcon();
    },
    toggle() {
      this.init();
      if (!this.el || !this.ready) return;
      this.suspended = false;
      if (this.el.paused) {
        this.play();
      } else {
        this.pause();
      }
    },
    showHint() {
      let h = document.getElementById('homepage-bgm-hint');
      if (!h) {
        h = document.createElement('div');
        h.id = 'homepage-bgm-hint';
        h.textContent = '🎵 화면을 한 번 터치(클릭)하면 배경음악이 시작됩니다';
        document.body.appendChild(h);
      }
      h.classList.add('show');
    },
    hideHint() {
      const h = document.getElementById('homepage-bgm-hint');
      if (h) h.classList.remove('show');
    },
    updateIcon() {
      const btn = document.getElementById('homepage-bgm-btn');
      if (!btn) return;
      const playing = !!(this.el && !this.el.paused);
      const on = playing || (this.wantPlay && !this.suspended);
      const icon = btn.querySelector('.hp-bgm-icon');
      btn.classList.toggle('muted', !on);
      btn.classList.toggle('pending', on && !playing);
      if (icon) icon.textContent = on ? '🎵' : '🔇';
    }
  };

  function toggleHomepageBGM() {
    HOMEPAGE_BGM.toggle();
  }

  /* ════════════════════════════════════════════════════════════
     [BGM MODULE] 메타버스 배경음악 엔진
     - 랜딩 로딩과 완전 분리: 메타버스 진입 후 getMetaverseData() 응답으로만 설정 수신
     - 구글 드라이브 uc?export=download 직링크는 HTML 확인페이지를 내려줘 재생 불가 →
       서버(getAudioBase64)에서 Base64로 받아 data URI로 재생 (백그라운드 비동기, 로딩 체인과 분리)
     - 자동재생 정책 대응: 로드 완료 시 & 월드 표시 시점에 play() 시도, 차단되면 버튼으로 재시도
  ════════════════════════════════════════════════════════════ */
  const BGM = {
    el: null,
    ready: false,
    worldVisible: false,
    entering: false,
    pendingLegacy: null,
    currentId: '',
    init() {
      if (this.el) return;
      this.el = document.getElementById('metaverse-bgm');
      if (!this.el) return;
      this.el.volume = 0.35;
      this.el.loop = true;
    },
    loadFromFileId(fileId) {
      this.init();
      if (!this.el || !fileId) return;
      if (this.currentId === fileId) return;
      this.currentId = fileId;
      const legacy = () => google.script.run
        .withSuccessHandler(res => {
          if (!res || !res.success) {
            console.warn('[BGM] 음원 로드 실패:', res && res.error);
            return;
          }
          this.el.src = 'data:' + res.mimeType + ';base64,' + res.base64;
          this.ready = true;
          if (this.worldVisible || this.entering) this.play();
        })
        .withFailureHandler(err => console.warn('[BGM] 음원 요청 실패:', err))
        .getAudioBase64(fileId);
      // [속도] 정적 mp3 스트리밍으로 즉시 재생 — 파일이 없으면 입장 완료 후 기존 Base64 방식으로 대체
      useStaticAudio(this.el, fileId, () => {
        if (this.worldVisible) legacy(); else this.pendingLegacy = legacy;
      });
      this.ready = true;
      if (this.worldVisible || this.entering) this.play();
    },
    play() {
      this.init();
      if (!this.el || !this.ready) return;
      this.el.play().then(() => this.updateIcon()).catch(err => {
        console.warn('[BGM] 자동재생 차단됨, 버튼 클릭으로 재생 가능:', err);
        this.updateIcon();
      });
    },
    stop() {
      if (!this.el) return;
      this.el.pause();
      this.el.currentTime = 0;
      this.worldVisible = false;
      this.entering = false;
      this.updateIcon();
    },
    toggle() {
      this.init();
      if (!this.el || !this.ready) return;
      if (this.el.paused) {
        this.play();
      } else {
        this.el.pause();
        this.updateIcon();
      }
    },
    updateIcon() {
      const btn = document.getElementById('hud-bgm-btn');
      if (!btn) return;
      const playing = !!(this.el && !this.el.paused);
      const icon = btn.querySelector('.hud-bgm-icon');
      btn.classList.toggle('muted', !playing);
      if (icon) icon.textContent = playing ? '🎵' : '🔇';
    }
  };

  function toggleMetaBGM() {
    BGM.toggle();
  }

  /* ════════════════════════════════════════════════════════════
     [FOOTSTEP MODULE] 캐릭터 발자국 효과음
     - '배경음악' 시트에 구분="발자국소리"로 등록된 음원을 사용(사용유무 체크 시에만 동작).
     - 원본 음원이 약 4초짜리 루프(걸음마다 짧게 끊어 재생하는 방식이 아님)라 BGM과 동일하게
       <audio loop> 엘리먼트로 "이동 시작 시 1번 재생(반복) → 멈추면 즉시 정지"만 제어한다.
       (내 캐릭터 이동에만 반응, 다른 접속자 이동 소리는 재생하지 않음)
  ════════════════════════════════════════════════════════════ */
  const FOOTSTEP = {
    el: null,
    ready: false,
    init() {
      if (this.el) return;
      this.el = document.getElementById('metaverse-footstep');
      if (!this.el) return;
      this.el.volume = 0.6; // [국장님 튜닝] 기존(0.3) 대비 2배
      this.el.loop = true;
    },
    loadFromFileId(fileId) {
      this.init();
      if (!this.el || !fileId) return;
      google.script.run
        .withSuccessHandler(res => {
          if (!res || !res.success) { console.warn('[발자국] 음원 로드 실패:', res && res.error); return; }
          this.el.src = 'data:' + res.mimeType + ';base64,' + res.base64;
          this.ready = true;
        })
        .withFailureHandler(err => console.warn('[발자국] 음원 요청 실패:', err))
        .getAudioBase64(fileId);
    },
    /** 이동 시작 시 호출 - 이미 재생 중이면 다시 처음부터 끊지 않고 그대로 둔다 */
    play() {
      this.init();
      if (!this.el || !this.ready || !this.el.paused) return;
      this.el.currentTime = 0;
      this.el.play().catch(() => { /* 자동재생 정책 등으로 실패해도 게임 진행에 지장 없도록 무시 */ });
    },
    /** 이동이 멈추는 즉시 호출 - 바로 정지시켜 잔향이 따라오지 않게 함 */
    stop() {
      if (!this.el || this.el.paused) return;
      this.el.pause();
      this.el.currentTime = 0;
    }
  };

  let canvas, ctx, bgCanvas, bgCtx;

  /**
   * [직원 인증] 구글 로그인 → 토큰을 서버가 직접 검증 → 시트 직원 이메일과 대조
   * (GitHub Pages 구조에서는 서버가 접속자 이메일을 알 수 없어 로그인 토큰으로 확인)
   */
  function staffGoogleLogin(subtitle, onOk) {
    // [Apps Script 직접 접속용] 서버가 접속자 이메일을 이미 알려준 경우(구글 계정 로그인 상태)는 팝업 없이 시트와 대조
    try {
      const srvEmail = state.userEmail ? state.userEmail.toLowerCase().trim() : "";
      if (srvEmail && state.staffConfigs) {
        let direct = null;
        Object.keys(state.staffConfigs).forEach(n => {
          const c = state.staffConfigs[n];
          if (c && c.email && c.email === srvEmail) direct = n;
        });
        if (direct) { onOk(direct); return; }
      }
    } catch (e) { }
    subtitle.innerText = "🔐 구글 계정 선택창에서 직원 계정을 선택해주세요...";
    try { if (!firebase.apps.length) firebase.initializeApp(firebaseConfig); } catch (e) { }
    const provider = new firebase.auth.GoogleAuthProvider();
    // 이전에 성공한 직원 계정을 기억해 두었다가 계정 선택창 없이 바로 통과 (처음 1회만 선택)
    let hint = '';
    try { hint = localStorage.getItem('staffEmailHint') || ''; } catch (e) { }
    provider.setCustomParameters(hint ? { login_hint: hint } : { prompt: 'select_account' });
    firebase.auth().signInWithPopup(provider).then(result => {
      const idToken = result && result.credential && result.credential.idToken;
      if (!idToken) throw new Error('로그인 토큰을 받지 못했습니다.');
      subtitle.innerText = "🔐 직원 명단 확인 중입니다...";
      google.script.run
        .withSuccessHandler(res => {
          if (res && res.success && res.name) {
            state.userEmail = res.email;
            try { localStorage.setItem('staffEmailHint', res.email); } catch (e) { }
            onOk(res.name);
          } else if (res && res.success) {
            try { localStorage.removeItem('staffEmailHint'); } catch (e) { }
            subtitle.innerText = `🛑 미등록 계정: [${res.email}] 은(는) 직원 명단에 등록되지 않았습니다.
시트의 이메일 주소를 확인해주세요.`;
          } else {
            subtitle.innerText = "🛑 구글 계정 확인에 실패했습니다. 다시 시도해주세요.";
          }
        })
        .withFailureHandler(() => { subtitle.innerText = "🛑 서버 연결에 실패했습니다. 다시 시도해주세요."; })
        .verifyStaffGoogle(idToken);
    }).catch(err => {
      const cancelled = err && (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request');
      subtitle.innerText = cancelled ? "로그인이 취소되었습니다. 직원 버튼을 다시 눌러주세요."
        : "🛑 구글 로그인 실패: " + ((err && err.message) || err);
    });
  }

  /**
   * [v8.4] 입장 메뉴 전환 시스템 (직원용 하이패스)
   */
  function showSubMenu(type) {
    const main = document.getElementById('main-choices');
    const guest = document.getElementById('guest-menu');
    const back = document.getElementById('back-btn');
    const subtitle = document.querySelector('.subtitle');

    if (type === 'guest') {
      main.style.display = 'none';
      guest.style.display = 'grid';
      back.style.display = 'block';
      subtitle.innerText = "📍 게스트 유형을 선택해주세요";
    } else if (type === 'staff') {
      // [직원 인증] 구글 로그인 후 서버 검증
      staffGoogleLogin(subtitle, matchedName => {
        alert(`✅ 직원 인증 성공: [${matchedName}] 님 환영합니다.`);
        startMetaverse(matchedName, true);
      });
    } else {
      main.style.display = 'flex'; // [v8.61] grid 대신 flex로 변경하여 버튼 한 줄 유지
      guest.style.display = 'none';
      back.style.display = 'none';
      subtitle.innerText = "사회복지법인 예맥재단 등대의집 | 방문자 유형을 선택해주세요";
    }
  }

  // ── [v35.0] [에메랄드 반중력 플라즈마 포털] Canvas 애니메이션 엔진 ──
  let portalAnimId = null;
  let portalParticles = [];

  class PortalParticle {
    constructor(x, y, angle, speed, life, size, colorType, pType = 'ring') {
      this.x = x;
      this.y = y;
      this.px = x;
      this.py = y;
      this.pType = pType; // 'ring' (소용돌이 고리) 또는 'ember' (반중력 상승 불씨)

      if (this.pType === 'ring') {
        const spread = 0.55;
        const finalAngle = angle + (Math.random() - 0.5) * spread;
        this.vx = Math.cos(finalAngle) * speed;
        this.vy = Math.sin(finalAngle) * speed;
        this.life = life;
        this.maxLife = life;
        this.size = size;
      } else {
        // 'ember' (반중력 불씨): 하단에서 수직 상승 속도 부여
        this.vx = (Math.random() - 0.5) * 0.7; // 좌우 미세 비산
        this.vy = -(1.2 + Math.random() * 2.0); // 위로 상승
        this.life = 40 + Math.random() * 45; // 공중에 더 오래 머무르도록 수명 확장
        this.maxLife = this.life;
        this.size = 0.7 + Math.random() * 1.8; // 섬세한 불씨 크기
      }

      // [에메랄드 그린 플라즈마 광원 컬러 스펙트럼]
      if (colorType === 'white') {
        this.color = `rgba(240, 255, 245, `; // 초고온 순백색 불꽃 코어
      } else if (colorType === 'lime') {
        this.color = `rgba(163, 230, 53, `; // 라이트 라임 그린
      } else if (colorType === 'mint') {
        this.color = `rgba(110, 231, 183, `; // 부드러운 일렉트릭 민트
      } else { // emerald
        this.color = `rgba(16, 185, 129, `; // 비비드 에메랄드 그린
      }
    }

    update() {
      this.px = this.x;
      this.py = this.y;

      this.x += this.vx;
      this.y += this.vy;

      if (this.pType === 'ring') {
        this.vy -= 0.02; // 메인 링의 미세한 반중력 기류 작용 (위로 가볍게 뜨는 경향)
        this.vx *= 0.965;
        this.vy *= 0.965;
      } else {
        // [반중력 상승 물리엔진]
        this.vy -= 0.045; // 위쪽 방향으로 반중력 가속도 발생 (점점 빨라짐)
        // [기류 표류(Drift) 물리] : 지그재그 기류를 타며 스르르 흔들리는 기류 현상
        this.vx += Math.sin(this.life / 6) * 0.08;
        this.vx *= 0.95;
        this.vy *= 0.95;
      }
      this.life--;
    }

    draw(ctx) {
      const alpha = Math.max(0, this.life / this.maxLife);
      ctx.save();
      ctx.beginPath();

      if (this.pType === 'ring') {
        // 링 입자는 속도 궤적 선으로 극사실적 연출
        ctx.moveTo(this.px, this.py);
        ctx.lineTo(this.x, this.y);
        ctx.lineWidth = this.size * alpha;
        ctx.strokeStyle = this.color + alpha + ')';
        ctx.lineCap = 'round';
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(16, 185, 129, 0.9)';
        ctx.stroke();
      } else {
        // 반중력 불씨는 부드러운 둥근 입자 글로우로 몽환적 우주 먼지 연출
        ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = this.color + (alpha * 0.85) + ')';
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(52, 211, 153, 0.7)';
        ctx.fill();
      }

      ctx.restore();
    }
  }

  function startPortalAnimation() {
    const canvas = document.getElementById('portalCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const modalBox = document.querySelector('.metaverse-modal-box');
    if (modalBox) {
      modalBox.classList.remove('portal-active');
    }

    let drawProgress = 0;
    let phase = 'drawing';
    let rotationAngle = 0;
    let revealed = false;

    portalParticles = [];
    if (portalAnimId) cancelAnimationFrame(portalAnimId);

    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;

      // [Pulsing Heat] 심장박동처럼 미세하게 일렁이는 링 맥동 파동 연산
      const pulse = Math.sin(Date.now() / 200) * 4.5;
      const R = Math.min(285, window.innerWidth * 0.45) + pulse;

      // 1. 차원의 내부 에메랄드 원형막(Portal Disk) 렌더링
      if (drawProgress > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, drawProgress * 2 * Math.PI);
        ctx.clip();

        // 에메랄드 심연 그라데이션 (초고대비 고정밀 백드롭으로 글씨 최상의 식별성 유지)
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        grad.addColorStop(0, 'rgba(4, 9, 12, 0.94)'); // 다크 딥 스페이스 코어
        grad.addColorStop(0.75, 'rgba(6, 12, 17, 0.97)');
        grad.addColorStop(0.95, 'rgba(16, 185, 129, 0.25)'); // 영롱한 테두리 에메랄드 반사광
        grad.addColorStop(1, 'rgba(52, 211, 153, 0.85)');    // 에메랄드 플라즈마 활성 림
        ctx.fillStyle = grad;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
        ctx.restore();

        // 2. 고리 라인 용융 광원 (Molten Green Ring Overlay)
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, drawProgress * 2 * Math.PI);
        ctx.lineWidth = 4.0;
        ctx.strokeStyle = `rgba(52, 211, 153, ${0.45 + drawProgress * 0.5})`;
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(16, 185, 129, 0.95)';
        ctx.stroke();
        ctx.restore();
      }

      // 3. 입자 방출 및 물리 시뮬레이션
      if (phase === 'drawing') {
        drawProgress += 0.022; // 드로잉 고속화
        if (drawProgress >= 1.0) {
          drawProgress = 1.0;
          phase = 'active';
        }

        // 그리는 선두(Tip) 불꽃 방출
        const tipAngle = drawProgress * 2 * Math.PI - Math.PI / 2;
        const tx = cx + R * Math.cos(tipAngle);
        const ty = cy + R * Math.sin(tipAngle);

        const tangent = tipAngle + Math.PI / 2;
        for (let i = 0; i < 16; i++) {
          const speed = 3.2 + Math.random() * 8.5;
          const outAngle = tangent + (Math.random() - 0.7) * 1.5;
          const life = 18 + Math.random() * 32;
          const size = 1.6 + Math.random() * 2.8;
          const colorType = Math.random() < 0.12 ? 'white' : (Math.random() < 0.32 ? 'lime' : (Math.random() < 0.65 ? 'mint' : 'emerald'));
          portalParticles.push(new PortalParticle(tx, ty, outAngle, speed, life, size, colorType, 'ring'));
        }
      } else {
        // active 페이즈: 모달 웅장하게 활성화
        if (!revealed) {
          revealed = true;
          if (modalBox) {
            modalBox.classList.add('portal-active');
          }
        }

        // 메인 링의 지글지글 끓는 고속 소용돌이 고주파 플라즈마 파티클
        rotationAngle += 0.055;
        const ringCount = 7 + Math.floor(Math.random() * 4);
        for (let i = 0; i < ringCount; i++) {
          const randAngle = Math.random() * Math.PI * 2;
          const px = cx + R * Math.cos(randAngle);
          const py = cy + R * Math.sin(randAngle);

          const outAngle = randAngle + (Math.random() - 0.5) * 0.95;
          const speed = 1.6 + Math.random() * 5.8;
          const life = 15 + Math.random() * 25;
          const size = 1.2 + Math.random() * 2.6;
          const colorType = Math.random() < 0.1 ? 'white' : (Math.random() < 0.3 ? 'lime' : (Math.random() < 0.65 ? 'mint' : 'emerald'));
          portalParticles.push(new PortalParticle(px, py, outAngle, speed, life, size, colorType, 'ring'));
        }

        // [반중력 상승 불씨(Anti-gravity Embers) 시스템 가동]
        // 포털 하단 영역(바닥 림 및 하단 전체)에서 생성되어 둥둥 위로 피어오르는 중력 역전 입자들
        if (Math.random() < 0.85) {
          const spawnCount = 2 + Math.floor(Math.random() * 3);
          for (let k = 0; k < spawnCount; k++) {
            // 포털 하단 고리와 중심 사이의 넓은 영역 분포
            const angleVal = Math.PI * 0.25 + Math.random() * Math.PI * 0.5; // 하단 45도 ~ 135도
            const radDist = R * (0.2 + Math.random() * 0.8);
            const ex = cx + radDist * Math.cos(angleVal);
            const ey = cy + radDist * Math.sin(angleVal);

            const colorType = Math.random() < 0.05 ? 'white' : (Math.random() < 0.4 ? 'lime' : (Math.random() < 0.75 ? 'mint' : 'emerald'));
            portalParticles.push(new PortalParticle(ex, ey, 0, 0, 0, 0, colorType, 'ember'));
          }
        }
      }

      // 4. 입자 업데이트 및 렌더링
      for (let i = portalParticles.length - 1; i >= 0; i--) {
        const p = portalParticles[i];
        p.update();
        if (p.life <= 0) {
          portalParticles.splice(i, 1);
        } else {
          p.draw(ctx);
        }
      }

      portalAnimId = requestAnimationFrame(loop);
    }

    portalAnimId = requestAnimationFrame(loop);
  }

  /**
   * [신규] 우측 퀵 메뉴를 통한 메타버스 진입 모달 열기
   * - 모달 오픈 시 매번 닥터 스트레인지 불꽃 포털 드로잉 엔진 시동
   */
  function openMetaverseEntryModal() {
    const modal = document.getElementById('metaverseEntryModal');
    if (modal) {
      modal.classList.add('open');
      showMetaverseModalSub('main'); // 초기 화면으로 설정

      // [포털 애니메이션 작동]
      startPortalAnimation();
    }
  }

  /**
   * [신규] 메타버스 진입 모달 내부 메뉴 전환
   */
  function showMetaverseModalSub(type) {
    const main = document.getElementById('metaverse-modal-main');
    const guest = document.getElementById('metaverse-modal-guest');
    const back = document.getElementById('metaverse-modal-back');
    const subtitle = document.getElementById('metaverse-modal-subtitle');

    if (type === 'guest') {
      main.style.display = 'none';
      guest.style.display = 'flex';
      back.style.display = 'block';
      subtitle.innerText = "📍 게스트 유형을 선택해주세요";
    } else if (type === 'staff') {
      staffGoogleLogin(subtitle, matchedName => {
        alert(`✅ 직원 인증 성공: [${matchedName}] 님 환영합니다.`);
        closeModal('metaverseEntryModal');
        startMetaverse(matchedName, true);
      });
    } else {
      main.style.display = 'flex';
      guest.style.display = 'none';
      back.style.display = 'none';
      subtitle.innerText = "방문자 유형을 선택해주세요";
    }
  }


  /**
   * [가림 영역 엔진] 검은색 도안(D열) 분석
   */
  function analyzeForeground(maskImg, w, h) {
    const maskTemp = document.createElement('canvas');
    maskTemp.width = w; maskTemp.height = h;
    const mCtx = maskTemp.getContext('2d');
    mCtx.drawImage(maskImg, 0, 0, w, h);
    const mData = mCtx.getImageData(0, 0, w, h);
    const d = mData.data;
    state.foregroundMask = new Uint8Array(w * h);
    for (let i = 0; i < d.length; i += 4) {
      const br = (d[i] + d[i + 1] + d[i + 2]) / 3;
      if (d[i + 3] > 50 && br < 150) { state.foregroundMask[i / 4] = 1; }
      else { state.foregroundMask[i / 4] = 0; d[i + 3] = 0; }
    }
    mCtx.putImageData(mData, 0, 0);
    state.foregroundCanvas = document.createElement('canvas');
    state.foregroundCanvas.width = w; state.foregroundCanvas.height = h;
    const fCtx = state.foregroundCanvas.getContext('2d');
    if (state.currentMapImg) fCtx.drawImage(state.currentMapImg, 0, 0, w, h);
    fCtx.globalCompositeOperation = 'destination-in';
    fCtx.drawImage(maskTemp, 0, 0);
  }

  /**
   * [마스크 엔진] 벽 충돌 데이터 생성
   */
  function analyzeCollisions(collisionImg, w, h) {
    const tCanvas = document.createElement('canvas');
    tCanvas.width = w; tCanvas.height = h;
    const tCtx = tCanvas.getContext('2d');
    tCtx.drawImage(collisionImg, 0, 0, w, h);
    const d = tCtx.getImageData(0, 0, w, h).data;
    state.collisionMask = new Uint8Array(w * h);
    for (let i = 0; i < d.length; i += 4) {
      const alpha = d[i + 3], br = (d[i] + d[i + 1] + d[i + 2]) / 3;
      state.collisionMask[i / 4] = (alpha > 50 && br < 150) ? 1 : 0;
    }
  }

  function isColliding(x, y) {
    if (!state.collisionMask || !state.currentMapImg) return false;
    const mw = state.currentMapImg.width, mh = state.currentMapImg.height;
    const px = Math.floor(x + 32);
    const py = Math.floor(y + 90);

    if (px < 0 || px >= mw || py < 0 || py >= mh) return true;
    return state.collisionMask[py * mw + px] === 1;
  }

  function startMetaverse(selectedPersona, isStaff = false) {
    state.avatar.personality = selectedPersona;
    state.avatar.name = selectedPersona; // 네임택용 이름 설정

    // [모니터링] 메타버스 입장 로그 기록
    try {
      Monitoring.logMetaverseAccess(selectedPersona, isStaff);
    } catch (e) { console.warn("메타버스 접속 로깅 오류:", e); }

    if (isStaff) {
      const staffInfo = state.staffConfigs[selectedPersona];
      if (staffInfo) {
        state.avatar.canJump = staffInfo.canJump || false; // D열
        state.avatar.canSpeed = staffInfo.canSpeed || false; // E열
        state.avatar.isGhost = staffInfo.isGhost || false; // F열
        state.avatar.canFire = staffInfo.canFire || false; // G열
        state.avatar.canSuperFire = staffInfo.canSuperFire || false; // H열
      }
    } else {
      state.avatar.canJump = false;
      state.avatar.canSpeed = false;
      state.avatar.canFire = false;
      state.avatar.canSuperFire = false;
      state.avatar.isGhost = false;
    }

    // [속도] 메타버스 데이터 요청을 Firebase 확인과 동시에 시작 (기존: Firebase 확인 후 순차 요청)
    const metaReq = { data: null, error: null, onOk: null, onFail: null };
    google.script.run
      .withSuccessHandler(d => { metaReq.data = d; if (metaReq.onOk) metaReq.onOk(d); })
      .withFailureHandler(e => { metaReq.error = e || new Error('메타버스 데이터 로드 실패'); if (metaReq.onFail) metaReq.onFail(metaReq.error); })
      .getMetaverseData();

    // Firebase 초기화 (실패해도 계속 진행)
    try {
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      db = firebase.database();
    } catch (err) {
      console.warn("Firebase 초기화 실패 — 솔로모드 진행:", err);
      db = null;
    }

    // Firebase DB 세션 정리 (연결 실패 시 건너뜀)
    const proceedToLoad = () => {
    // [모바일 최적화] 메타버스 진입 시 뷰포트를 device-width로 전환
      document.body.classList.add('metaverse-active');
      const vp = document.getElementById('viewport-meta') || document.querySelector('meta[name="viewport"]');
      if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');

      // [수정] 메타버스 진입 팝업 공지 호출 (안정성을 위해 100ms 지연 호출)
      if (!state.noticeChecked) {
        state.noticeChecked = true;
        setTimeout(checkMetaverseNotice, 100);
      }

      const homepageWrap = document.getElementById('homepage-wrap');
      const wlOverlay = document.getElementById('world-loading-overlay');

      // [BGM] 홈페이지 배경음악 정지 및 버튼 숨김
      try {
        HOMEPAGE_BGM.stop();
        const hpBtn = document.getElementById('homepage-bgm-btn');
        if (hpBtn) hpBtn.style.display = 'none';
      } catch (e) { console.warn('[HP_BGM] 정지 실패:', e); }

      BGM.entering = true; // [BGM] 입장 클릭(사용자 제스처) 직후부터 재생 허용 — 로딩 화면부터 음악
      // 즉시 로딩 화면 표시
      if (wlOverlay) wlOverlay.classList.remove('overlay-hidden');

      if (homepageWrap) {
        homepageWrap.style.transition = 'opacity 0.8s ease';
        homepageWrap.style.opacity = '0';
        homepageWrap.style.pointerEvents = 'none';
        setTimeout(() => {
          homepageWrap.style.display = 'none';
          const chatbotBtn = document.getElementById('chatbot-trigger');
          const chatbotSidebar = document.getElementById('chatbot-sidebar');
          if (chatbotBtn) chatbotBtn.style.display = 'none';
          if (chatbotSidebar) chatbotSidebar.classList.remove('open');
        }, 800);
      }

      // 메타버스 데이터 (입장 클릭 시점에 이미 요청을 시작해 둠)
      const onMeta = (metaData) => {
          state.mapConfigs = metaData.mapConfigs;
          state.zoneConfigs = metaData.zoneConfigs;
          state.charConfigs = metaData.charConfigs;
          state.objectConfigs = metaData.objectConfigs;
          state.loadingId = metaData.loadingId;
          state.aiBotConfig = metaData.aiBotConfig; // [신규] AIbot 탭 캐릭터 폴더 ID
          state.fountainConfig = metaData.fountainConfig || null; // [분수대] 폴더 ID
          state.cinemaConfig = metaData.cinemaConfig || null; // [시네마] 극장 조명 폴더 ID
          // [속도] 메타버스 BGM(약 9MB)/발자국 음원은 입장 완료 후 내려받음 (맵 로딩 대역폭 확보)
          try {
            const bgmFileId = metaData.bgmConfigs && metaData.bgmConfigs.metaverseId;
            const footstepCfg = metaData.bgmConfigs && metaData.bgmConfigs.all &&
              metaData.bgmConfigs.all.find(x => x.category === '발자국소리');
            if (bgmFileId) BGM.loadFromFileId(bgmFileId); // 정적 스트리밍이라 입장 로딩에 부담 없음
            state.pendingAudio = { bgm: '', foot: (footstepCfg && footstepCfg.fileId) || '' };
          } catch (e) { console.warn('[BGM] 설정 준비 실패:', e); }
          showWorldLoading();
      };
      const onMetaFail = (err) => {
          console.error('메타버스 데이터 로드 실패:', err);
          if (wlOverlay) wlOverlay.classList.add('overlay-hidden');
          if (homepageWrap) {
            homepageWrap.style.display = 'block';
            setTimeout(() => { homepageWrap.style.opacity = '1'; homepageWrap.style.pointerEvents = 'auto'; }, 50);
          }
          alert('메타버스 데이터를 불러오지 못했습니다.\n새로고침 후 다시 시도해주세요.');
      };
      if (metaReq.data) onMeta(metaReq.data);
      else if (metaReq.error) onMetaFail(metaReq.error);
      else { metaReq.onOk = onMeta; metaReq.onFail = onMetaFail; }
    };

    if (db) {
      // Firebase 연결 성공 시: 세션 정리 후 진행
      firebase.auth().signInAnonymously()
        .then(() => db.ref('players').once('value'))
        .then(snap => {
        const players = snap.val() || {};
        const now = Date.now();
        if (isStaff) {
          const isDuplicate = Object.values(players).some(p =>
            p.name === selectedPersona && (now - (p.lastUpdate || 0) < 15000)
          );
          if (isDuplicate) {
            alert(`🛑 이미 [${selectedPersona}]님으로 접속 중인 '활성' 세션이 존재합니다.\n직원 계정은 중복 접속이 불가능합니다.`);
            return;
          }
          Object.keys(players).forEach(id => {
            if (players[id].name === selectedPersona) db.ref('players/' + id).remove();
          });
        }
        proceedToLoad();
      }).catch(err => {
        console.warn('Firebase 세션 체크 실패 — 솔로모드 진행:', err);
        proceedToLoad(); // Firebase 실패해도 입장은 계속
      });
    } else {
      // Firebase 없이 바로 진행 (솔로모드)
      proceedToLoad();
    }
  }

  // [v23.2] 메타버스 진입 속도 필살 최적화: 맵 분석은 필요한 경우에만 최소화 수행
  function loadFloorMap(f) {
    state.mapLoaded = false;
    state.currentFloor = f;
    state.mapChanged = true; // [v35.5] 미니맵 갱신 알림
    const cfg = (state.mapConfigs && (state.mapConfigs[f] || state.mapConfigs[String(f)] || state.mapConfigs[Number(f)])) || {};
    if (!cfg || (!cfg.id && !cfg.nightId)) {
      console.warn("맵 설정(cfg)을 찾을 수 없습니다:", f, state.mapConfigs);
      return;
    }

    toggleGlobalLoader(false); // 홈페이지 로더 종료 (진입 로더가 대신함)

    // [야간 맵 전환] 18시~06시 또는 I열 상시 활성화 체크박스 적용 시 H열 저녁 맵 활성화
    const nowHour = new Date().getHours();
    const isNightTime = (nowHour >= 18 || nowHour < 6);
    const isAlwaysNight = (cfg.alwaysNight === true || String(cfg.alwaysNight).trim().toLowerCase() === 'true');
    const useNightMap = Boolean((isAlwaysNight || isNightTime) && cfg.nightId);
    state.isNightMap = useNightMap; // [야간 모드 상태 저장] 분수대 등 야간 전용 표시 제어용
    const activeMapFileId = useNightMap ? cfg.nightId : cfg.id;
    console.log(`🌙 [맵 모드] 현재 시각: ${nowHour}시 | 상시야간(I열): ${isAlwaysNight} | 저녁맵ID(H열): ${cfg.nightId} ➔ ${useNightMap ? '저녁 맵(야간 - 분수대 OFF)' : '낮 맵(주간 - 분수대 ON)'} 로드 (ID: ${activeMapFileId})`);

    // 1. 핵심 비주얼(맵 이미지) 우선 로드 (썸네일 직링크 - 초고속)
    const loadVisual = () => new Promise(res => {
      const img = new Image();
      img.onload = () => {
        state.currentMapImg = img;
        if (state.firstEntry) {
          state.avatar.x = 1900; // 좌상단(0,0) 기준 X 좌표
          state.avatar.y = 1900; // 좌상단(0,0) 기준 Y 좌표
          state.firstEntry = false;
        }
        res(img);
      };
      img.onerror = () => { console.error("Map Load Error"); res(null); };
      img.src = "https://drive.google.com/thumbnail?id=" + activeMapFileId + "&sz=w4000";
    });

    // 2. 부가 리소스(충돌/가림/컬러/오브젝트) — getMapImageBase64 (Base64) 방식 유지
    // ⚠️ Drive 직링크는 CORS 미지원 → canvas.getImageData() 실패 → 벽 무시 현상 발생
    // 픽셀 분석이 필요한 4개 맵은 반드시 서버 Base64 변환 사용
    const loadMapImg = (id) => new Promise(res => {
      if (!id) { res(null); return; }
      google.script.run
        .withSuccessHandler(src => {
          if (!src) { res(null); return; }
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = () => { console.warn('맵 이미지 로드 실패:', id); res(null); };
          img.src = src;
        })
        .withFailureHandler(err => {
          console.warn('맵 Base64 변환 실패 (건너뜀):', id, err);
          res(null); // 실패해도 게임은 계속
        })
        .getMapImageBase64(id);
    });

    // [속도] 맵 배경·아바타·맵 이미지 5장을 동시에 내려받기 시작 (기존: 배경 → 아바타 → 맵 순차)
    const pAvatar = loadSingleAvatar(state.avatar.personality);
    const pColl = loadMapImg(cfg.collisionId);
    const pFore = loadMapImg(cfg.foregroundId);
    const pColor = loadMapImg(cfg.colorMapId);
    const pObj = loadMapImg(cfg.objectMapId);
    const pAi = loadMapImg(cfg.aiPathMapId);

    loadVisual().then(img => {
      if (!img) return;
      return pAvatar.then(() => img);
    }).then(img => {
      if (!img) return;
      // 충돌/가림은 필수, 컬러/오브젝트는 실패해도 진행
      return Promise.all([
        pColl.then(cImg => { if (cImg) analyzeCollisions(cImg, img.width, img.height); }),
        pFore.then(fImg => { if (fImg) analyzeForeground(fImg, img.width, img.height); }),
        pColor.then(cMapImg => { if (cMapImg) analyzeColorMap(cMapImg, img.width, img.height); }),
        pObj.then(oImg => { if (oImg) analyzeObjectMap(oImg, img.width, img.height); }),
        pAi.then(aImg => { if (aImg) analyzeAIPathMap(aImg, img.width, img.height); })
      ]);
    }).then(() => {
      state.mapLoaded = true;
      state.avatar.spawnTimer = 2.0;
      setTimeout(hideWorldLoading, 200);
      // [속도] 장식(AI봇·분수대·시네마 프레임 24장)은 입장 완료 후 내려받아 준비되는 대로 표시
      loadAIBotAvatar();
      loadFountainImages();
      loadCinemaImages();
      // [v24.0] 입장 직후 3회 연속 강제 전송 — 다른 접속자에게 내 존재를 확실히 알림
      syncMyPosition(true);
      setTimeout(() => syncMyPosition(true), 500);
      setTimeout(() => syncMyPosition(true), 1500);

      // [삭제] 기존의 맵 로드 완료 후 호출 로직 제거 (proceedToLoad로 이동됨)

    }).catch(err => {
      console.error('맵 로드 에러:', err);
      hideWorldLoading();
    });
  }

  // [v9.2] 컬러 맵 데이터 분석 엔진
  function analyzeColorMap(img, w, h) {
    const cvs = document.createElement('canvas');
    cvs.width = w; cvs.height = h;
    const ctx_m = cvs.getContext('2d');
    ctx_m.drawImage(img, 0, 0, w, h);
    state.colorMap = ctx_m.getImageData(0, 0, w, h);
  }

  // [v12.8] 오브젝트 컬러 맵 데이터 분석 엔진 (GIF 배제 버전)
  function analyzeObjectMap(img, w, h) {
    const cvs = document.createElement('canvas');
    cvs.width = w; cvs.height = h;
    const ctx_o = cvs.getContext('2d');
    ctx_o.drawImage(img, 0, 0, w, h);
    state.objectColorMap = ctx_o.getImageData(0, 0, w, h);
    const gifContainer = document.getElementById('map-gif-container');
    if (gifContainer) gifContainer.innerHTML = '';
  }

  // [신규] AI봇 순찰 동선 맵(#000000 검정 선 + #ff0000 빨강 선) 분석 및 웨이포인트 경로 생성 엔진
  function analyzeAIPathMap(img, w, h) {
    state.aiBot.waypoints = [];
    state.aiBot.active = false;
    state.aiBot2.waypoints = [];
    state.aiBot2.active = false;
    if (!img) return;

    const cvs = document.createElement('canvas');
    cvs.width = w; cvs.height = h;
    const ctx_a = cvs.getContext('2d');
    ctx_a.drawImage(img, 0, 0, w, h);
    const imgData = ctx_a.getImageData(0, 0, w, h);
    const data = imgData.data;

    // 검정색(R<30, G<30, B<30) + 빨강색(R>180, G<60, B<60) 픽셀 동시 수집
    const pointsBlack = [];
    const pointsRed = [];
    const step = 8;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        if (a > 200) {
          if (r < 30 && g < 30 && b < 30) {
            pointsBlack.push({ x: x - 32, y: y - 48 });
          } else if (r > 180 && g < 60 && b < 60) {
            pointsRed.push({ x: x - 32, y: y - 48 });
          }
        }
      }
    }

    // 공통 헬퍼: 픽셀 목록 → 웨이포인트 체인
    function buildChain(pts) {
      if (pts.length < 2) return [];
      const pool = [...pts];
      const wps = [];
      let cur = pool.shift();
      wps.push(cur);
      while (pool.length > 0) {
        let minD = Infinity, ni = -1;
        for (let i = 0; i < pool.length; i++) {
          const d = Math.hypot(pool[i].x - cur.x, pool[i].y - cur.y);
          if (d < minD) { minD = d; ni = i; }
        }
        if (minD > 150) break;
        cur = pool.splice(ni, 1)[0];
        const last = wps[wps.length - 1];
        if (Math.hypot(cur.x - last.x, cur.y - last.y) >= 20) wps.push(cur);
      }
      return wps.length >= 2 ? wps : [];
    }

    // 검정 동선 → aiBot (기존)
    const wpBlack = buildChain(pointsBlack);
    if (wpBlack.length >= 2) {
      state.aiBot.waypoints = wpBlack;
      state.aiBot.waypointIdx = 0;
      state.aiBot.forward = true;
      state.aiBot.x = wpBlack[0].x;
      state.aiBot.y = wpBlack[0].y;
      state.aiBot.active = true;
    }

    // 빨강 동선 → aiBot2 (신규)
    const wpRed = buildChain(pointsRed);
    if (wpRed.length >= 2) {
      state.aiBot2.waypoints = wpRed;
      state.aiBot2.waypointIdx = 0;
      state.aiBot2.forward = true;
      state.aiBot2.x = wpRed[0].x;
      state.aiBot2.y = wpRed[0].y;
      state.aiBot2.active = true;
      // 이미지는 별도 백그라운드 로딩 (메인 체인 무관)
      if (!state.aiBot2.avatarLoaded) loadAIBot2AvatarBg();
    }
  }

  // [신규] AI봇 캐릭터 아바타 비트맵 로딩
  function loadAIBotAvatar() {
    return new Promise(res => {
      const folderId = state.aiBotConfig;
      if (!folderId) { res(); return; }
      const dirs = ['up', 'down', 'left', 'right'];
      const frames = [1, 2];
      const promises = [];
      state.aiBot.bitmaps = {};

      dirs.forEach(d => {
        frames.forEach(f => {
          const fn = `${d}_${f}.png`;
          const p = new Promise(r => {
            google.script.run
              .withSuccessHandler(src => {
                if (src) {
                  const img = new Image();
                  img.onload = () => {
                    if (!state.aiBot.bitmaps[d]) state.aiBot.bitmaps[d] = {};
                    state.aiBot.bitmaps[d][f] = img;
                    r();
                  };
                  img.onerror = () => r();
                  img.src = src;
                } else r();
              })
              .withFailureHandler(() => r())
              .getAvatarFrameBase64(folderId, fn);
          });
          promises.push(p);
        });
      });

      Promise.all(promises).then(() => res());
    });
  }

  // [신규] AI봇2 이미지 백그라운드 로딩 (메인 로딩 체인과 완전 분리 — 검은화면 방지)
  function loadAIBot2AvatarBg() {
    const folderId = state.aiBot2.folderId;
    if (!folderId) return;
    const dirs = ['up', 'down', 'left', 'right'];
    const frames = [1, 2];
    state.aiBot2.bitmaps = {};
    state.aiBot2.avatarLoaded = false;

    let loaded = 0;
    const total = dirs.length * frames.length;

    dirs.forEach(d => {
      state.aiBot2.bitmaps[d] = {};
      frames.forEach(f => {
        const fn = `${d}_${f}.png`;
        google.script.run
          .withSuccessHandler(src => {
            loaded++;
            if (src) {
              const img = new Image();
              img.onload = () => { state.aiBot2.bitmaps[d][f] = img; };
              img.src = src;
            }
            if (loaded >= total) state.aiBot2.avatarLoaded = true;
          })
          .withFailureHandler(() => {
            loaded++;
            if (loaded >= total) state.aiBot2.avatarLoaded = true;
          })
          .getAvatarFrameBase64(folderId, fn);
      });
    });
  }

  // ====================================================
  // [분수대] 이미지 로딩 - AIbot탭 B3 폴더의 1.png~3.png
  // ====================================================
  function loadFountainImages() {
    return new Promise(res => {
      const folderId = state.fountainConfig;
      if (!folderId) { res(); return; }

      const ft = state.fountain;
      ft.frames = [];
      const promises = [];

      for (let i = 1; i <= 4; i++) {
        const fn = `${i}.png`;
        const p = new Promise(r => {
          google.script.run
            .withSuccessHandler(src => {
              if (src) {
                const img = new Image();
                img.onload = () => {
                  ft.frames[i - 1] = img;
                  r();
                };
                img.onerror = () => r();
                img.src = src;
              } else r();
            })
            .withFailureHandler(() => r())
            .getAvatarFrameBase64(folderId, fn);
        });
        promises.push(p);
      }

      Promise.all(promises).then(() => {
        // 프레임이 1개 이상 성공적으로 로드된 경우에만 활성화
        if (ft.frames.some(f => f)) {
          ft.active = true;
          console.log('[분수대] 이미지 로딩 완료:', ft.frames.filter(f => f).length, '/ 4 프레임');
        }
        res();
      });
    });
  }

  // ====================================================
  // [분수대] 애니메이션 업데이트 - 0.15초마다 1→2→3→1 루프 (야간 맵일 때는 작동 중단)
  // ====================================================
  function updateFountain(dt) {
    if (state.isNightMap) return; // 야간 맵일 때는 프레임 업데이트 중단
    const ft = state.fountain;
    if (!ft.active || ft.frames.length === 0) return;
    ft.animTimer += dt;
    if (ft.animTimer >= 0.15) {
      ft.animTimer = 0;
      ft.frameIdx = (ft.frameIdx + 1) % ft.frames.length;
    }
  }

  // ====================================================
  // [분수대] 레이어 렌더링 - 원본 비율 유지 + Z-index 원근감 처리 (야간 맵일 때는 완전 미표시)
  // ====================================================
  function drawFountain(filterBehind = null) {
    if (state.isNightMap) return; // 야간 맵(I2 체크박스 또는 18시~06시)일 때는 프레임 완전 비표시
    const ft = state.fountain;
    if (!ft.active) return;

    const img = ft.frames[ft.frameIdx];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    // 건물 벽 뒤/앞 레이어 필터링 (AI봇과 동일 방식)
    if (filterBehind !== null && state.currentMapImg) {
      const mapW = state.currentMapImg.width;
      const px = Math.floor(ft.x + img.naturalWidth / 2);
      const py = Math.floor(ft.y + img.naturalHeight);
      const isBehind = (state.foregroundMask && state.foregroundMask[py * mapW + px] === 1);
      if (isBehind !== filterBehind) return;
    }

    // 기존 맵 분수보다 아주 약간 크게 - 너비 200px 기준 원본 비율 유지 렌더링
    const displayW = 275;
    const displayH = (img.naturalHeight / img.naturalWidth) * displayW;
    ctx.drawImage(img, ft.x, ft.y, displayW, displayH);
  }

  // ====================================================
  // [분수대] Y-sorting 원근감 정렬용 스킵 판단 헬퍼
  // ====================================================
  function shouldSkipForFountain(x, y, fountainSort) {
    if (state.isNightMap || fountainSort === null || !state.fountain || !state.fountain.active) return false;

    const ft = state.fountain;
    const img = ft.frames[ft.frameIdx];
    const h = img ? img.naturalHeight : 275;
    const w = img ? img.naturalWidth : 275;
    // drawFountain과 동일한 크기(275px) 적용
    const displayW = 275;
    const displayH = (h / w) * displayW;

    // Y-sorting의 기준선을 최하단이 아닌 실제 분수대 접지 부분(높이의 약 78% 지점)으로 설정하여 자연스러운 원근감 유도
    const fountainBottomY = ft.y + displayH * 0.78;
    const bottomY = y + 90; // 발밑 Y

    // 분수대 가로 영역 오버랩 체크
    const buffer = 10;
    const overlapX = (x + 32 >= ft.x - buffer && x + 32 <= ft.x + displayW + buffer);

    if (overlapX) {
      const isBehind = (bottomY <= fountainBottomY);
      if (fountainSort === 'behind' && !isBehind) return true;
      if (fountainSort === 'front' && isBehind) return true;
    } else {
      if (fountainSort === 'front') return true;
    }
    return false;
  }

  // ====================================================
  // [시네마 극장] 조명 애니메이션 이미지 로딩 (12 프레임)
  // 순서: 1~6.png -> 1-1~6-1.png
  // ====================================================
  function loadCinemaImages() {
    return new Promise(res => {
      const folderId = state.cinemaConfig || '1tvVlR0aP_xGrr76MaoqGJBQiTJhWRRe0';
      if (!folderId) { res(); return; }

      const cin = state.cinema;
      cin.frames = [];
      const order = cin.frameOrder || ['1.png', '2.png', '3.png', '4.png', '5.png', '6.png', '1-1.png', '2-1.png', '3-1.png', '4-1.png', '5-1.png', '6-1.png'];
      const promises = [];

      order.forEach((fn, idx) => {
        const p = new Promise(r => {
          google.script.run
            .withSuccessHandler(src => {
              if (src) {
                const img = new Image();
                img.onload = () => {
                  cin.frames[idx] = img;
                  r();
                };
                img.onerror = () => r();
                img.src = src;
              } else r();
            })
            .withFailureHandler(() => r())
            .getAvatarFrameBase64(folderId, fn);
        });
        promises.push(p);
      });

      Promise.all(promises).then(() => {
        if (cin.frames.some(f => f)) {
          cin.active = true;
          console.log('🎬 [시네마 극장] 조명 애니메이션 로딩 완료:', cin.frames.filter(f => f).length, '/ 12 프레임');
        }
        res();
      });
    });
  }

  // ====================================================
  // [시네마 극장] 애니메이션 업데이트 - 정방향 회전 후 역방향 무한 왕복 (요요 루프)
  // ====================================================
  function updateCinema(dt) {
    const cin = state.cinema;
    if (!cin.active || cin.frames.length === 0) return;

    cin.animTimer += dt;
    if (cin.animTimer >= (cin.frameInterval || 0.1)) {
      cin.animTimer = 0;
      cin.seqIdx += cin.direction;

      // 끝(6-1)에 도달하면 역방향 전환
      if (cin.seqIdx >= cin.frames.length - 1) {
        cin.seqIdx = cin.frames.length - 1;
        cin.direction = -1;
      }
      // 시작(1)에 도달하면 정방향 전환
      else if (cin.seqIdx <= 0) {
        cin.seqIdx = 0;
        cin.direction = 1;
      }
    }
  }

  // ====================================================
  // [시네마 극장] 레이어 렌더링 - 원본 비율 유지 + 벽 뒤/앞 레이어링 지원
  // ====================================================
  function drawCinema(filterBehind = null) {
    const cin = state.cinema;
    if (!cin.active || cin.frames.length === 0) return;

    const img = cin.frames[cin.seqIdx];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    // 건물 벽 뒤/앞 레이어 필터링
    if (filterBehind !== null && state.currentMapImg) {
      const mapW = state.currentMapImg.width;
      const px = Math.floor(cin.x + img.naturalWidth / 2);
      const py = Math.floor(cin.y + img.naturalHeight);
      const isBehind = (state.foregroundMask && state.foregroundMask[py * mapW + px] === 1);
      if (isBehind !== filterBehind) return;
    }

    const displayW = cin.displayW || 320;
    const displayH = (img.naturalHeight / img.naturalWidth) * displayW;
    ctx.drawImage(img, cin.x, cin.y, displayW, displayH);
  }


  function showWorldLoading() {
    const overlay = document.getElementById('world-loading-overlay');
    if (overlay) overlay.classList.remove('overlay-hidden');
    initWorld(); // 데이터 로딩 시작
  }

  function hideWorldLoading() {
    const overlay = document.getElementById('world-loading-overlay');
    if (overlay) overlay.classList.add('overlay-hidden');

    // [BGM] 월드 진입 완료 시점(=입장하기 클릭 제스처 체인 내)에 재생 시도 + HUD 버튼 노출
    try {
      BGM.worldVisible = true;
      if (BGM.pendingLegacy) { const lg = BGM.pendingLegacy; BGM.pendingLegacy = null; lg(); }
      const btn = document.getElementById('hud-bgm-btn');
      if (btn) btn.style.display = 'flex';
      if (BGM.ready) BGM.play();
    } catch (e) { console.warn('[BGM] 재생 시도 실패:', e); }

    // [속도] 입장 완료 후 메타버스 음원 내려받기 시작 (준비되는 즉시 재생)
    try {
      if (state.pendingAudio) {
        const pa = state.pendingAudio;
        state.pendingAudio = null;
        if (pa.bgm) BGM.loadFromFileId(pa.bgm);
        if (pa.foot) FOOTSTEP.loadFromFileId(pa.foot);
      }
    } catch (e) { console.warn('[BGM] 음원 로드 시작 실패:', e); }

    // [v35.5] 맵 로딩 완료 0.5초 후 네비게이션 서서히 등장
    setTimeout(() => {
      const topUiGroup = document.getElementById('meta-top-ui-group');
      if (topUiGroup) {
        topUiGroup.style.display = 'flex';
        topUiGroup.style.opacity = '0';
        topUiGroup.style.transition = 'opacity 0.8s ease';
        setTimeout(() => { topUiGroup.style.opacity = '1'; }, 50);
      }
    }, 500);
  }

  /**
   * [v35.5] 미니맵 토글 (접기/펴기)
   */
  function toggleMiniMap() {
    const wrap = document.getElementById('meta-mini-map-wrap');
    const btn = document.getElementById('mini-map-toggle-btn');
    if (!wrap) return;

    wrap.classList.toggle('minimized');
    if (btn) {
      btn.innerText = wrap.classList.contains('minimized') ? '▶' : '◀';
    }
  }

  function initWorld() {
    if (state.isRunning) return; // [v14.5] 중복 실행 방지 (속도 비정상 가속 차단)
    state.lastFrameTime = Date.now(); // 델타 타임 초기화

    const container = document.getElementById('world-container');
    if (container) container.style.display = 'block';
    canvas = document.getElementById('meta-canvas');
    if (canvas) ctx = canvas.getContext('2d');

    // [v12.5] 원경 배경용 캔버스 초기화
    bgCanvas = document.getElementById('bg-canvas');
    if (bgCanvas) bgCtx = bgCanvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // [v12.0] 채팅 입력창 전용 리스너 (한글 IME 안전)
    function setupChatInput() {
      const input = document.getElementById('chat-input');
      if (!input) return;
      let composing = false;
      input.addEventListener('compositionstart', () => { composing = true; });
      input.addEventListener('compositionend', () => { composing = false; });
      input.addEventListener('keydown', e => {
        // 채팅창 내부 키 이벤트는 모두 바깥으로 새어나지 않도록 차단 (Space 점프 버그 해결)
        e.stopPropagation();

        if (e.key === 'Enter') {
          e.preventDefault(); // 브라우저 기본 전송/줄바꿈 동작을 일단 모두 차단

          if (e.ctrlKey) {
            // [Ctrl + Enter] 줄바꿈 강제 삽입
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const val = input.value;
            input.value = val.substring(0, start) + "\n" + val.substring(end);
            // 커서 위치 이동
            input.selectionStart = input.selectionEnd = start + 1;
            // 스크롤 하단 이동
            input.scrollTop = input.scrollHeight;
          } else {
            // [Enter] 전송
            if (!composing) sendChat();
          }
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          closeChat();
        }
      });
    }
    setupChatInput();

    window.addEventListener('keydown', e => {
      if (state.isChatting) return;

      // [수정] AI 챗봇 모달이 열려있으면 메타버스 방향키/점프 조작 차단
      const aiModal = document.getElementById('metaAIChatModal');
      if (aiModal && aiModal.style.display === 'flex') {
        if (e.key === 'Escape') closeAIChatbot(); // ESC 누르면 닫기 지원
        return;
      }

      state.keys[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
      if (e.code === 'KeyF') handleInteraction();
      if (e.code === 'KeyX' && state.avatar.canFire) startFireAction('normal');
      if (e.code === 'KeyZ' && state.avatar.canSuperFire) startFireAction('flaming');
      const isLongTextZone = state.activeZone && (state.activeZone.place === '다목적실' || state.activeZone.place === '상담실');
      if (e.code === 'Enter' && (state.nearestPlayer || isLongTextZone)) {
        e.preventDefault();
        openChat();
      }
    });

    window.addEventListener('keyup', e => state.keys[e.code] = false);

    // [신규] 메타버스 화면(캔버스) 마우스 클릭+드래그 맵 탐색 기능
    if (canvas) {
      canvas.style.cursor = 'grab';
      canvas.addEventListener('mousedown', e => {
        if (e.button !== 0 || state.isChatting) return; // 좌클릭만 허용
        state.isDraggingMap = true;
        state.dragStart = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
      });

      window.addEventListener('mousemove', e => {
        if (!state.isDraggingMap) return;
        const dx = e.clientX - state.dragStart.x;
        const dy = e.clientY - state.dragStart.y;
        state.dragStart = { x: e.clientX, y: e.clientY };

        // 마우스를 끈 만큼 카메라 오프셋 반대 이동 (드래그 감도 적용)
        state.camOffset.x -= dx;
        state.camOffset.y -= dy;
        state.targetCamOffset.x = state.camOffset.x;
        state.targetCamOffset.y = state.camOffset.y;
      });

      window.addEventListener('mouseup', () => {
        if (state.isDraggingMap) {
          state.isDraggingMap = false;
          if (canvas) canvas.style.cursor = 'grab';
        }
      });
    }

    initMultiplayer();
    loadFloorMap(state.currentFloor);
    state.isRunning = true;
    initMobileControls();
    requestAnimationFrame(gameLoop);
  }

  /**
   * [v12.0] 채팅 제어 엔진 (IME 안전 버전)
   */
  function openChat() {
    if (state.isChatting) return;
    state.isChatting = true;
    for (let k in state.keys) state.keys[k] = false;
    const wrapper = document.getElementById('chat-input-wrapper');
    const input = document.getElementById('chat-input');

    // [v38.0] 구역별 글자 수 제한 동적 설정
    const isLongTextZone = state.activeZone && (state.activeZone.place === '다목적실' || state.activeZone.place === '상담실');
    if (isLongTextZone) {
      input.maxLength = 2000; // 사실상 제한 없음
      input.placeholder = "긴 문장이나 문제를 입력할 수 있습니다...";
    } else {
      input.maxLength = 100; // 일반 구역 100자
      input.placeholder = "대화용 메시지를 입력하세요 (최대 100자)...";
    }

    wrapper.classList.add('active');
    input.value = "";
    setTimeout(() => input.focus(), 80);
  }

  function openWorkspace() {
    if (window.workspaceUrl) window.open(window.workspaceUrl, '_blank');
  }

  function closeChat() {
    state.isChatting = false;
    const wrapper = document.getElementById('chat-input-wrapper');
    const input = document.getElementById('chat-input');
    wrapper.classList.remove('active');
    input.blur();
    input.value = "";
    for (let k in state.keys) state.keys[k] = false;
  }

  function sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    const isLongTextZone = state.activeZone && (state.activeZone.place === '다목적실' || state.activeZone.place === '상담실');

    if (!isLongTextZone) {
      closeChat();
    } else {
      input.value = "";
    }

    if (msg && state.mySessionId) {
      state.avatar.message = msg;
      state.avatar.msgTime = Date.now();
      appendChatEntry(state.avatar.name, msg);
      syncMyPosition();
    }
  }

  function appendChatEntry(name, msg) {
    const logWindow = document.getElementById('chat-log-window');
    if (!logWindow) return;
    const entry = document.createElement('div');
    entry.className = 'chat-entry';
    entry.innerHTML = `<span class="user-name" style="color: ${getUserColor(name)}">${name}:</span><span class="msg-text">${msg}</span>`;
    logWindow.appendChild(entry);
    logWindow.scrollTop = logWindow.scrollHeight;
    if (logWindow.childNodes.length > 50) logWindow.removeChild(logWindow.firstChild);
  }

  /**
   * [v23.0] 초경량 랜딩 데이터 사전 로딩 — 홈페이지 즉시 표시용
   */
  // [BGM] 재방문자는 저장된 음원으로 서버 응답 전에 즉시 재생 시도
  try { HOMEPAGE_BGM.boot(); } catch (e) { console.warn('[HP_BGM] boot 오류:', e); }

  (function setup() {
    if (typeof google !== 'undefined' && google.script) {
      google.script.run.withSuccessHandler(data => {
        if (!data) return;
        state.userEmail = data.userEmail;
        state.staffConfigs = data.staffConfigs;
        state.loadingId = data.loadingId;

        // [v34.6] 워크스페이스 링크 동적 할당 (대문 시트 B3 셀 연동)
        if (data.workspaceUrl) {
          window.workspaceUrl = data.workspaceUrl;
        }

        // [BGM] 홈페이지 배경음악 비동기 로드 시작 (대문 진입 시 자동재생 시도)
        if (data.bgmHomepageId) {
          try {
            HOMEPAGE_BGM.loadFromFileId(data.bgmHomepageId);
          } catch (e) { console.warn('[HP_BGM] 로드 호출 오류:', e); }
        }

        // [모니터링] 홈페이지 초기 방문 로그 기록
        try {
          Monitoring.logHomepageAccess();
        } catch (e) { console.warn("홈페이지 접속 로깅 오류:", e); }

        // [v23.2] 로딩 GIF 미리 확보 (원본 크기로 표시)
        if (data.loadingId) {
          const gif = document.getElementById('loading-gif');
          if (gif) {
            gif.onload = function () {
              // 이미지 원본 크기(naturalWidth x naturalHeight)를 그대로 적용
              gif.style.width = gif.naturalWidth + 'px';
              gif.style.height = gif.naturalHeight + 'px';
              gif.style.maxWidth = 'none';   // CSS max-width 제한 해제
              gif.style.maxHeight = 'none';  // CSS max-height 제한 해제
              gif.style.opacity = '1';
            };
            // sz=w9999 → 구글 드라이브가 지원하는 최대 크기 반환
            gif.src = "https://drive.google.com/thumbnail?id=" + data.loadingId + "&sz=w9999";
          }
        }

        // 대문 배경 이미지 로드 및 프리로더 해제
        (function (id) {
          var bgEl = document.getElementById('landing-bg');
          var spinner = document.getElementById('loading-spinner');
          var content = document.querySelector('.overlay-content');
          if (id) {
            var directUrl = "https://drive.google.com/thumbnail?id=" + id + "&sz=w1920";
            var imgLoader = new Image();
            imgLoader.onload = function () {
              if (bgEl) {
                bgEl.style.backgroundImage = "url('" + directUrl + "')";
                bgEl.style.opacity = "1";
                // [v24.8] 1단계: 배경 줌인 시작 (Total 2.5s)
                setTimeout(() => { bgEl.classList.add('active-zoom'); }, 100);
              }
              if (spinner) spinner.style.display = 'none';

              var wrapper = document.querySelector('.hero-box-wrapper');

              if (wrapper && content) {
                // [v24.9] 2단계: 배경 확대가 약 70% 진행된 시점 (약 1.6초 후)
                // 팝업창이 수직 중심에서 좌우로 매끄럽게 개방
                setTimeout(() => {
                  wrapper.classList.add('active');
                  wrapper.classList.add('open');
                  content.style.opacity = "1";
                }, 1600);

                // [v24.9] 3단계: 개방 직후 무지개 레이싱 및 입체 그림자 활성화
                setTimeout(() => {
                  content.classList.add('rainbow-active');
                  content.classList.add('shadow-active');
                }, 3200);

                // [v24.9] 4단계: 최종 문구 등장
                setTimeout(() => { content.classList.add('fade-visible'); }, 4200);
              }
              hidePreloader();
            };
            imgLoader.onerror = function () {
              if (spinner) spinner.style.display = 'none';
              if (content) content.classList.add('fade-visible');
              hidePreloader();
            };
            imgLoader.src = directUrl;
          } else {
            if (spinner) spinner.style.display = 'none';
            if (content) content.classList.add('fade-visible');
            hidePreloader();
          }
        })(data.landingId);
      }).getLandingData(); // [v23.0] 초경량 버전으로 교체 (staffConfigs + landingId만)
    }
  })();

  function hidePreloader() {
    const p = document.getElementById('preloader');
    if (p) p.classList.add('preloader-hidden');
  }

  // ─── 이하 게임 엔진 함수 ───────────────────────────────

  function drawAvatar(filterBehind = null, fountainSort = null) {
    const av = state.avatar;
    if (shouldSkipForFountain(av.x, av.y, fountainSort)) return;

    // [보정] 벽 뒤/앞 필터링 체크
    if (filterBehind !== null && state.currentMapImg) {
      const mapW = state.currentMapImg.width;
      const px = Math.floor(av.x + 32);
      const py = Math.floor(av.y + 90);
      const isBehind = (state.foregroundMask && state.foregroundMask[py * mapW + px] === 1);
      if (isBehind !== filterBehind) return;
    }
    const drawY = av.y + av.jumpY;

    // [v9.2] 공간 안내 광채 애니메이션 (Aura)
    if (state.activeZone) {
      state.auraAlpha += 0.02 * state.auraDir;
      if (state.auraAlpha > 0.5) state.auraDir = -1;
      if (state.auraAlpha < 0.2) state.auraDir = 1;

      const grad = ctx.createRadialGradient(av.x + 32, drawY + 75, 5, av.x + 32, drawY + 75, 40);
      grad.addColorStop(0, `rgba(255, 255, 100, ${state.auraAlpha})`);
      grad.addColorStop(1, 'rgba(255, 255, 100, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(av.x + 32, drawY + 75, 50, 0, Math.PI * 2); ctx.fill();
    }

    // [v20.0] 바닥 스폰 광채 레이어 (Spawn Beam)
    if (av.spawnTimer > 0) {
      const progress = 1 - (av.spawnTimer / 2.0);
      const beamAlpha = av.spawnTimer / 2.0;
      const radius = 50 + (80 * Math.sin(progress * Math.PI)); // [v20.1] 더 역동적인 수축/팽창

      const beamGrad = ctx.createRadialGradient(av.x + 32, av.y + 90, 5, av.x + 32, av.y + 90, radius);
      beamGrad.addColorStop(0, `rgba(255, 255, 255, ${beamAlpha * 0.9})`); // [v20.1] 화이트 코어 추가
      beamGrad.addColorStop(0.3, `rgba(100, 200, 255, ${beamAlpha * 0.8})`);
      beamGrad.addColorStop(0.7, `rgba(50, 150, 255, ${beamAlpha * 0.4})`);
      beamGrad.addColorStop(1, 'rgba(0, 100, 255, 0)');

      ctx.save();
      ctx.shadowBlur = 20; ctx.shadowColor = "rgba(0, 150, 255, 0.5)";
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.ellipse(av.x + 32, av.y + 90, radius, radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 일반 보행 애니메이션 (1-2-3-2 루프)
    const seq = [1, 2, 3, 2], fIdx = seq[Math.floor(av.animFrame) % 4];
    const asset = av.direction + "_" + fIdx;

    // 에셋 존재 여부 확인
    let bit = null;
    if (state.allBitmaps[av.personality]) {
      bit = state.allBitmaps[av.personality][asset];
    }

    if (bit) {
      ctx.save();
      // 점프 시 발바닥 그림자 (음수 에러 방지 Math.max 적용)
      const shadowRadiusX = Math.max(0, 20 * (1 + av.jumpY / 150));
      const shadowRadiusY = Math.max(0, 8 * (1 + av.jumpY / 150));
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(av.x + 32, av.y + 90, shadowRadiusX, shadowRadiusY, 0, 0, Math.PI * 2);
      ctx.fill();

      // 본체 (상태에 따른 연출 분기)
      if (av.isBeingPulled) {
        // [v19.0] 블랙홀 소용돌이 연출
        ctx.save();
        ctx.translate(av.x + 32, drawY + 48);
        ctx.rotate(Date.now() / 100);
        const s = Math.max(0.1, 1 - (Date.now() % 1000 / 1000));
        ctx.scale(s, s);
        ctx.translate(-(av.x + 32), -(drawY + 48));
        ctx.drawImage(bit, av.x, drawY, 64, 96);
        ctx.restore();
      } else if (av.isDissolving) {
        // [v16.2] 불꽃 피격 연출 (까맣게 타며 작아짐 + 3초간 불타는 빨간 효과)
        ctx.save();
        ctx.translate(av.x + 32, drawY + 48);
        const s = Math.max(0.4, 1 - av.dissolveProgress * 0.6); // 소멸 대신 0.4 크기까지만 작아짐
        ctx.scale(s, s);

        // 캐릭터를 검게 그을린 효과
        ctx.filter = `brightness(${0.2 + (1 - av.dissolveProgress) * 0.3}) grayscale(0.8)`;
        ctx.translate(-(av.x + 32), -(drawY + 48));
        ctx.drawImage(bit, av.x, drawY, 64, 96);

        // [추가] 몸 위에 불이 붙은 듯한 빨간색 오버레이 (깜빡임 포함)
        ctx.globalCompositeOperation = "source-atop";
        const flicker = Math.sin(Date.now() / 50) * 0.3 + 0.5;
        ctx.fillStyle = `rgba(255, 60, 0, ${flicker})`;
        ctx.fillRect(av.x, drawY, 64, 96);

        ctx.restore();
      } else {
        // [신규] 대기(정지) 상태일 때 상체만 숨쉬는 모션 (다리/하체는 바닥 고정, 이격 빈 공간 방지 오버랩 처리)
        const isIdle = (av.animFrame === 1 || Math.floor(av.animFrame) === 1) && !av.isJumping;
        if (isIdle) {
          const breath = Math.sin(Date.now() / 450) * 1.0; // -1px ~ +1px 상체 미세 움직임
          const splitY = 58; // 96px 중 약 60% 지점 (상체와 하체 분리점)
          // 2) 하체/다리 (legs: splitY ~ 96) - 원래 위치 고정 (먼저 그리기)
          ctx.drawImage(bit, 0, bit.height * (splitY / 96), bit.width, bit.height * (1 - splitY / 96), av.x, drawY + splitY, 64, 96 - splitY);
          // 1) 상체 (head & torso: 0 ~ splitY + 2px 오버랩) - 미세 위아래 이동 및 하단 2px 덮기
          const overlap = 3; // 이격 구멍 방지용 연결부 덮개 오버랩 픽셀
          ctx.drawImage(bit, 0, 0, bit.width, bit.height * ((splitY + overlap) / 96), av.x, drawY + breath, 64, splitY + overlap);
        } else {
          ctx.drawImage(bit, av.x, drawY, 64, 96);
        }
      }

      // 네임택 (흰색 원복 및 점프 좌표 동화)
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.shadowColor = "black"; ctx.shadowBlur = 4;
      ctx.textAlign = "center";

      // [v20.0] 스폰 중 깜빡임 삭제 (이름표 상시 표시)
      if (!av.isDissolving) {
        // [v20.0] 이름표 위치 상단으로 조정 (체력바 자리를 위해)
        ctx.fillText(av.name, av.x + 32, drawY - 26);

        // [신규] 체력바 (HP Bar) 렌더링 - 이름과 캐릭터 사이
        const hpWidth = 40;
        const hpHeight = 5;
        const hpX = av.x + 32 - (hpWidth / 2);
        const hpY = drawY - 16;

        // 배경 (어두운 투명 + 외곽선)
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(hpX, hpY, hpWidth, hpHeight);

        // 생명력 (빨간색 그라데이션 또는 강조)
        if (av.hp > 0) {
          ctx.fillStyle = (av.hp > 33) ? "#FF3B30" : "#CC0000";
          ctx.fillRect(hpX, hpY, hpWidth * (av.hp / 100), hpHeight);
        }
      }
      ctx.restore();
    }
  }

  function initMultiplayer() {
    // [v24.0] db 미연결 시 1초 후 자동 재시도 (최대 5회)
    if (!db) {
      if ((initMultiplayer._retryCount = (initMultiplayer._retryCount || 0) + 1) <= 5) {
        console.warn(`Firebase 미연결 — ${initMultiplayer._retryCount}초 후 재시도...`);
        setTimeout(initMultiplayer, 1000);
      } else {
        console.error('Firebase 연결 실패 — 솔로모드로 운영합니다.');
      }
      return;
    }
    initMultiplayer._retryCount = 0; // 성공 시 카운터 초기화

    const ref = db.ref('players');
    // [v24.0] mySessionId가 이미 있으면 재사용 (층 이동 시 중복 생성 방지)
    if (!state.mySessionId) {
      state.mySessionId = ref.push().key;
    }
    ref.child(state.mySessionId).onDisconnect().remove();
    // ⚠️ 여기서 Firebase set() 즉시 등록 제거:
    // initWorld → initMultiplayer 시점엔 아직 맵 로드 전이라 av.x/av.y가 기본값(350,350)
    // → 상대방 화면에 좌측 복도 끝 유령 캐릭터가 보이는 버그 원인
    // → 실제 등록은 loadFloorMap 완료 후 syncMyPosition(true)가 올바른 스폰 위치로 처리함
    console.log('✅ Firebase 리스너 준비 — mySessionId:', state.mySessionId);

    // [v11.3] 다른 플레이어 감지 및 메시지 로컬 타이머 갱신
    ref.on('value', snap => {
      const currentPlayers = snap.val() || {};

      for (const id in currentPlayers) {
        if (id === state.mySessionId) continue;
        const p = currentPlayers[id];
        const prev = state.otherPlayers[id] || {};

        // [v20.4 FIX] 게이지 딜레이 방지: 서버 데이터가 오더라도 최근 2초 내에 내가 예측 데미지를 줬다면 그 값을 우선 유지
        if (prev.lastPredictHitTime && (Date.now() - prev.lastPredictHitTime < 2000)) {
          if (p.hp > (prev.hp || 0)) {
            p.hp = prev.hp;
            p.lastPredictHitTime = prev.lastPredictHitTime;
          }
        }

        // 기존 상태 및 타이머 계승 (보간 좌표 보존)
        p.renderX = prev.renderX;
        p.renderY = prev.renderY;
        p.localSpawnTimer = prev.localSpawnTimer || 0;
        p.localMsgTime = prev.localMsgTime;

        // [v24.1] 새 장풍 발사 감지 시 내 로컬 시간으로 갱신 (서버 시간차 보정)
        // fireStartTime이 바뀌면 = 새 장풍 발사 → 내 화면에서도 지금 시점부터 애니메이션 시작
        if (p.isFiring && p.fireStartTime !== (prev.fireStartTime || 0)) {
          p.localFireStartTime = Date.now();
        } else {
          p.localFireStartTime = prev.localFireStartTime;
        }

        if (!state.otherPlayers[id]) {
          if (state.mapLoaded) showJoinToast(p.name || 'Guest');
          p.localSpawnTimer = 2.0;
          if (p.personality && (!state.allBitmaps[p.personality] || Object.keys(state.allBitmaps[p.personality]).length === 0)) {
            loadSingleAvatar(p.personality);
          }
        }
        if (p.message && p.msgTime !== prev.msgTime) {
          p.localMsgTime = Date.now();
          appendChatEntry(p.name || 'Guest', p.message);
        }
      }

      const me = currentPlayers[state.mySessionId];
      if (me) {
        if (me.isStunned && !state.avatar.isBeingPulled) startPullingEffect(me.pullToX, me.pullToY);
        if (me.lastHitId && state.avatar.lastHitId !== me.lastHitId) {
          state.avatar.lastHitId = me.lastHitId;
          if (state.avatar.hp > 0) {
            state.avatar.hp = Math.max(0, state.avatar.hp - 33.4);
            if (state.avatar.hp <= 0) startDissolvingEffect(false);
          } else {
            startDissolvingEffect(true);
          }
        }
      }
      state.otherPlayers = currentPlayers;
    });
  }

  /**
   * [v16.2] 불꽃 장풍 피격 소멸/부활 연출 (3초 정지 후 부활)
   */
  function startDissolvingEffect(shouldBounceOut = false) {
    const av = state.avatar;
    if (av.isDissolving && !shouldBounceOut) return;

    // [v20.2] 이미 체력이 0인 상태에서 또 맞으면 즉시 퇴장
    if (shouldBounceOut) {
      db.ref('players/' + state.mySessionId).remove();
      alert('⚠️ 방어력이 소진된 상태에서 공격받아 월드에서 퇴장되었습니다.');
      location.reload();
      return;
    }

    av.isDissolving = true;
    av.dissolveProgress = 0;
    av.vx = 0; av.vy = 0;

    // 3초간 불타는 연출 (Defense Zero 상태)
    let timer = 0;
    const interval = setInterval(() => {
      timer += (1 / 60);
      av.dissolveProgress = Math.min(1, timer / 3);
      av.vx = 0; av.vy = 0; // 움직임 강제 고정

      if (timer >= 3) {
        clearInterval(interval);
        av.isDissolving = false;
        av.dissolveProgress = 0;
        av.hp = 10; // 부활 시 실피로 부활 (국장님 요청에 따라 조정 가능, 일단 10으로 설정하여 회복 유도)
        db.ref('players/' + state.mySessionId).update({ isBurned: false, hp: 10 });
      }
    }, 16);
  }

  /**
   * [v10.7] 특정 페르소나의 아바타 에셋을 동적으로 로딩합니다.
   */
  // [v21.0] 특정 아바타 로딩 (Promise 지원으로 로딩 시퀀스 동기화 보장)
  function loadSingleAvatar(name) {
    if (!name) return Promise.resolve();
    if (state.allBitmaps[name] && !state.allBitmaps[name].loading) return Promise.resolve();

    return new Promise(resolve => {
      const folderId = (state.staffConfigs[name] ? state.staffConfigs[name].folderId : null) || state.charConfigs[name];
      if (!folderId) return resolve();

      state.allBitmaps[name] = { loading: true };
      google.script.run.withSuccessHandler(assets => {
        state.allBitmaps[name] = {};
        const keys = Object.keys(assets);
        let loadedCount = 0;
        if (keys.length === 0) return resolve();

        keys.forEach(k => {
          const img = new Image();
          img.onload = () => {
            state.allBitmaps[name][k] = img;
            loadedCount++;
            if (loadedCount === keys.length) resolve();
          };
          img.onerror = () => {
            loadedCount++;
            if (loadedCount === keys.length) resolve();
          };
          img.src = assets[k];
        });
      }).getAvatarAssets(folderId);
    });
  }

  function syncMyPosition(force = false) {
    // [v24.0] mySessionId 누락 시 initMultiplayer 재시도 폴백
    if (!state.mySessionId || !db) {
      if (db && !state.mySessionId) initMultiplayer();
      return;
    }
    const av = state.avatar;
    const now = Date.now();

    // [v8.5] 너무 잦은 네트워크 요청 방지 (최소 50ms 간격, 강제 전송 시 제외)
    if (!force && state.lastSync && now - state.lastSync < 50) return;

    // [v19.3] set 대신 update 사용 (상대방이 나를 공격하여 추가한 상태값 덮어쓰기 방지)
    db.ref('players/' + state.mySessionId).update({
      x: av.x, y: av.y, jumpY: av.jumpY, direction: av.direction,
      animFrame: av.animFrame,
      personality: av.personality, name: av.name, floor: state.currentFloor,
      isGhost: av.isGhost,
      message: av.message || "",
      msgTime: av.msgTime || 0,
      isFiring: av.isFiring,
      fireType: av.fireType,
      fireDir: av.fireDirection,
      fireStartTime: av.fireStartTime || 0,
      isBurned: av.isDissolving, // 현재 내가 불타는 중인지 공유
      hp: av.hp, // 내 HP 서버 공유
      lastHitId: av.lastHitId || "",
      vx: av.vx || 0, // [v8.5] 현재 속도 정보 추가 (추정용)
      vy: av.vy || 0,
      lastUpdate: now
    });

    state.lastSync = now;
  }

  /**
   * [v14.7] 유저별 고유 색상 결정 (해시 기반)
   */
  function getUserColor(name) {
    if (!name) return "#FFFFFF";
    const colors = ["#FF6B6B", "#4ECDC4", "#FFD93D", "#6C5CE7", "#A8E6CF", "#FF8ED4", "#00A8FF"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) { hash = name.charCodeAt(i) + ((hash << 5) - hash); }
    return colors[Math.abs(hash) % colors.length];
  }



  function drawOtherPlayers(filterBehind = null, fountainSort = null) {
    if (!state.otherPlayers) return;
    const mapW = state.currentMapImg ? state.currentMapImg.width : 0;
    Object.keys(state.otherPlayers).forEach(id => {
      if (id === state.mySessionId) return;
      const p = state.otherPlayers[id];
      if (p.floor !== state.currentFloor) return;
      // [v24.2] 위치 미확정 플레이어(맵 로드 전 기본값) 렌더링 제외
      if (!p.lastUpdate || p.x === undefined || p.y === undefined) return;

      if (shouldSkipForFountain(p.x, p.y, fountainSort)) return;

      // [보정] 벽 뒤/앞 필터링 체크
      if (filterBehind !== null && state.foregroundMask && mapW > 0) {
        const opPx = Math.floor((p.x || 0) + 32);
        const opPy = Math.floor((p.y || 0) + 90);
        const isBehind = (state.foregroundMask[opPy * mapW + opPx] === 1);
        if (isBehind !== filterBehind) return;
      }

      const seq = [1, 2, 3, 2], fIdx = seq[Math.floor(p.animFrame) % 4];
      const asset = p.direction + "_" + fIdx;

      if (state.allBitmaps[p.personality] && state.allBitmaps[p.personality][asset]) {
        ctx.save(); // [v20.2 FIX] 매트릭스 스택 보호를 위해 save 추가
        const bit = state.allBitmaps[p.personality][asset];
        const drawY = p.y + (p.jumpY || 0);

        // [v20.2 FIX] 발바닥 그림자 (그림자 색상 명시적 지정으로 빨간 그림자 버그 수정)
        const otherShadowX = Math.max(0, 20 * (1 + (p.jumpY || 0) / 150));
        const otherShadowY = Math.max(0, 8 * (1 + (p.jumpY || 0) / 150));
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(p.x + 32, p.y + 90, otherShadowX, otherShadowY, 0, 0, Math.PI * 2);
        ctx.fill();

        // [신규] 다른 유저의 체력바 렌더링 (그림자 이후에 그려서 오염 방지)
        const hpWidth = 40;
        const hpHeight = 5;
        const hpX = p.x + 32 - (hpWidth / 2);
        const hpY = drawY - 16;
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(hpX, hpY, hpWidth, hpHeight);
        const otherHp = (p.hp !== undefined) ? p.hp : 100;
        if (otherHp > 0) {
          ctx.fillStyle = otherHp > 33 ? "#FF3B30" : "#CC0000";
          ctx.fillRect(hpX, hpY, hpWidth * (otherHp / 100), hpHeight);
        }

        // [v20.1 Fix] 타 플레이어 바닥 스폰 광채 (localSpawnTimer 사용)
        if (p.localSpawnTimer > 0) {
          const progress = 1 - (p.localSpawnTimer / 2.0);
          const beamAlpha = p.localSpawnTimer / 2.0;
          const radius = 50 + (80 * Math.sin(progress * Math.PI));
          const beamGrad = ctx.createRadialGradient(p.x + 32, p.y + 90, 5, p.x + 32, p.y + 90, radius);
          beamGrad.addColorStop(0, `rgba(100, 200, 255, ${beamAlpha * 0.8})`);
          beamGrad.addColorStop(0.6, `rgba(50, 150, 255, ${beamAlpha * 0.3})`);
          beamGrad.addColorStop(1, 'rgba(0, 100, 255, 0)');
          ctx.fillStyle = beamGrad;
          ctx.beginPath();
          ctx.ellipse(p.x + 32, p.y + 90, radius, radius * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // [v16.2] 타 플레이어 소멸 연출 (불꽃 피격 시)
        let otherScale = 1;
        let otherFilter = '';
        if (p.isBurned) {
          otherFilter = `brightness(0) grayscale(1)`;
          otherScale = Math.max(0, 1 - (p.burnProgress || 0)); // 사실 로컬 타이머로 계산하는게 더 부드러움
        }

        // [v8.5] 위치 보간 (클라이언트 간 시간 비동기화 문제를 해결하기 위해 순수 Lerp 적용)
        let targetX = p.x;
        let targetY = p.y;

        // 2. Interpolation: 현재 렌더링 위치에서 목표 위치로 부드럽게 이동 (보간 계수 0.4로 민첩성 확보)
        p.renderX = p.renderX !== undefined ? p.renderX + (targetX - p.renderX) * 0.4 : targetX;
        p.renderY = p.renderY !== undefined ? p.renderY + (targetY - p.renderY) * 0.4 : targetY;

        // [v20.1 Fix] 타 플레이어 스폰 중 깜빡임 삭제
        if (true) {
          if (otherScale > 0) {
            ctx.save();
            ctx.translate(p.renderX + 32, drawY + 48);
            ctx.scale(otherScale, otherScale);
            if (otherFilter) ctx.filter = otherFilter;
            ctx.translate(-(p.renderX + 32), -(drawY + 48));

            // [신규] 다른 유저 대기 정지 상태 시 상체만 분할 숨쉬는 연출 (이격 빈 공간 방지 오버랩)
            const isOtherIdle = (p.animFrame === 1 || Math.floor(p.animFrame) === 1) && !p.jumpY;
            if (isOtherIdle && !p.isBurned) {
              const breath = Math.sin((Date.now() + (p.renderX || 0)) / 450) * 1.0;
              const splitY = 58;
              const overlap = 3;
              // 1) 다리 (원래 위치 고정)
              ctx.drawImage(bit, 0, bit.height * (splitY / 96), bit.width, bit.height * (1 - splitY / 96), p.renderX, drawY + splitY, 64, 96 - splitY);
              // 2) 상체 (미세 위아래 이동 및 하단 오버랩)
              ctx.drawImage(bit, 0, 0, bit.width, bit.height * ((splitY + overlap) / 96), p.renderX, drawY + breath, 64, splitY + overlap);
            } else {
              ctx.drawImage(bit, p.renderX, drawY, 64, 96);
            }
            ctx.restore();
          }

          // [v15.7] 상대방 이름표도 흰색으로 원복
          if (!p.isBurned) {
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.font = "bold 11px Inter, sans-serif";
            ctx.shadowColor = "black"; ctx.shadowBlur = 4;
            ctx.textAlign = "center";
            ctx.fillText(p.name || `Guest`, p.renderX + 32, drawY - 26);
            ctx.shadowBlur = 0;
          }
        }

        drawSpeechBubble(p, p.message, p.localMsgTime || p.msgTime);

        // [v16.0] 타 플레이어 장풍 렌더링
        if (p.isFiring) {
          // [v16.4] 타 플레이어의 장풍 발사 시작 시간 적용 (로컬 시간 동기화)
          const oldStart = state.avatar.fireStartTime;
          state.avatar.fireStartTime = p.localFireStartTime || Date.now();
          drawJangPung(p.renderX, p.renderY + (p.jumpY || 0), p.fireDir, p.fireType || 'normal');
          state.avatar.fireStartTime = oldStart; // 원상 복구 (전역 상태 오염 방지)
        }
        ctx.restore();
      }
    });
  }

  /**
   * [v16.0] 장풍(장진현 풍) 발사 로직
   */
  function startFireAction(type) {
    const av = state.avatar;
    if (av.isFiring) return; // 연속 발사 제한

    av.isFiring = true;
    av.fireType = type; // [v16.3] 인자로 받은 타입 적용 (normal or flaming)
    av.fireDirection = av.direction;
    av.fireStartTime = Date.now(); // [v16.4] 발사 시작 시간 기록
    syncMyPosition();

    // 0.5초 후 상태 해제
    setTimeout(() => {
      av.isFiring = false;
      syncMyPosition(true); // [v16.5] 강제 동기화 (패킷 누락으로 인한 장풍 멈춤 방지)
    }, 500);

    // [v19.0] 장풍 충돌 및 블랙홀/불꽃 흡수 체크
    checkJangPungHit(av.x, av.y, av.direction, av.fireType);
  }

  /**
   * [v19.0] 장풍 적중 엔진: 사정거리 내의 유저를 끌어당겨 소멸시키거나 태워버림
   */
  function checkJangPungHit(fireX, fireY, dir, type) {
    if (!state.otherPlayers) return;
    const isFlame = (type === 'flaming');
    const range = isFlame ? 640 : 400; // [v16.4] 불꽃 장풍 사거리 10배(640px) 확장
    const angleTolerance = 0.6; // 각도 허용 오차 (라디안)

    Object.keys(state.otherPlayers).forEach(id => {
      if (id === state.mySessionId) return;
      const p = state.otherPlayers[id];
      if (p.floor !== state.currentFloor) return;

      const dx = p.x - fireX;
      const dy = p.y - fireY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < range) {
        // [v20.4] 히트박스 확대 (40px -> 80px) 및 움직이는 적 판정 완화
        let isHit = false;
        const hitWidth = 80;

        // 현재 내가 보고 있는 상대방의 위치(렌더링 좌표 또는 x,y)가 장풍 궤적에 걸려 있는지 체크
        const px = p.renderX || p.x;
        const py = p.renderY || p.y;
        const tDx = px - fireX;
        const tDy = py - fireY;

        if (dir === 'up' && tDy < 0 && Math.abs(tDx) < hitWidth) isHit = true;
        if (dir === 'down' && tDy > 0 && Math.abs(tDx) < hitWidth) isHit = true;
        if (dir === 'left' && tDx < 0 && Math.abs(tDy) < hitWidth) isHit = true;
        if (dir === 'right' && tDx > 0 && Math.abs(tDy) < hitWidth) isHit = true;

        if (isHit) {
          // [v20.4 FIX] 이동 중인 적 맞추기 성능 상향
          // 1. 발사 시점의 시각적 위치(renderX) 기반 즉각 히트 판정 병행
          // 2. 히트박스 범위를 50->80px로 확대하여 스치기만 해도 맞도록 수정
          const hitDelay = (dist / range) * 400; // 도달 시간 약간 단축 (0.5s->0.4s)

          const hitId = Date.now() + "_" + Math.random().toString(36).substr(2, 5);

          // [클라이언트 예측] 즉각적인 게이지 감소 연출
          const targetPlayer = state.otherPlayers[id];
          if (targetPlayer) {
            const currentHP = (targetPlayer.hp !== undefined) ? targetPlayer.hp : 100;
            targetPlayer.hp = Math.max(0, currentHP - 33.4);
            targetPlayer.lastPredictHitTime = Date.now(); // 2초간 서버 데이터보다 로컬(내) 데미지 우선 표시
          }

          setTimeout(() => {
            // [HIT 최종 전송] 서버에 명중 이벤트 전송
            db.ref('players/' + id).update({
              lastHitId: hitId,
              attackerId: state.mySessionId
            });

            // [유령 청소]
            const curP = state.otherPlayers[id];
            if (curP && Date.now() - (curP.lastUpdate || 0) > 15000) {
              setTimeout(() => db.ref('players/' + id).remove(), 1000);
            }
          }, hitDelay);
        }
      }
    });
  }

  /**
   * [v16.0] 장풍 그래픽 렌더러 (네온 블루 파동)
   */
  function drawJangPung(x, y, dir, type = 'normal') {
    ctx.save();
    const startTime = state.avatar.fireStartTime || Date.now();
    const elapsed = Date.now() - startTime;

    // [v16.5] 발사 시간(500ms)을 초과한 오래된 장풍은 잔상이 남지 않도록 렌더링 중단
    if (elapsed > 600) {
      ctx.restore();
      return;
    }

    const progress = Math.min(1, elapsed / 500); // 0.5초 동안 발사

    const time = Date.now() / 100;
    const pulse = Math.sin(time) * 5;

    ctx.translate(x + 32, y + 48);
    // 방향에 따른 회전
    if (dir === 'up') ctx.rotate(-Math.PI / 2);
    if (dir === 'down') ctx.rotate(Math.PI / 2);
    if (dir === 'left') ctx.rotate(Math.PI);

    if (type === 'flaming') {
      // [v16.4] 불꽃 장풍 (H열 - 돌진하는 화염 파동)
      const travelDist = progress * 640; // 최대 640px까지 뻗어나감
      ctx.translate(travelDist, 0); // 앞으로 쭈욱 이동

      // 1. 역동적이고 긴 화염 꼬리 (Long Realistic Trailing Flame)
      const tailLength = Math.max(50, Math.min(400, travelDist)); // 이동 거리에 비례하여 꼬리가 길어짐

      for (let i = 0; i < 12; i++) {
        const ratio = i / 12; // 0 (앞) ~ 1 (뒤)
        const tailOffset = -ratio * tailLength * (1 + Math.random() * 0.1);

        // 뒤로 갈수록 얇아지고 사라지는 эффект
        const sizeRadius = 45 * (1 - ratio) * (1 - progress * 0.3);
        const tailAlpha = (1 - ratio * 0.8) * (1 - progress);

        const tailGrad = ctx.createRadialGradient(tailOffset, 0, 0, tailOffset, 0, sizeRadius * 1.5);
        tailGrad.addColorStop(0, `rgba(255, 230, 100, ${tailAlpha})`); // 옐로우 코어
        tailGrad.addColorStop(0.3, `rgba(255, 80, 0, ${tailAlpha * 0.8})`); // 오렌지 화염
        tailGrad.addColorStop(1, `rgba(100, 0, 0, 0)`); // 암적색 소멸

        ctx.fillStyle = tailGrad;
        ctx.beginPath();
        ctx.ellipse(tailOffset, 0, sizeRadius * 2.5, sizeRadius, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. 메인 화염 머리 (Main Flame Head)
      const grad = ctx.createRadialGradient(20, 0, 5, 50, 0, 80);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');     // 코어
      grad.addColorStop(0.2, 'rgba(255, 220, 50, 0.9)');   // 밝은 노랑
      grad.addColorStop(0.6, 'rgba(255, 80, 0, 0.7)');     // 강렬한 주황
      grad.addColorStop(1, 'rgba(150, 0, 0, 0)');          // 소멸 레드

      ctx.fillStyle = grad;
      ctx.beginPath();
      // 앞으로 뻗어나가는 뾰족한 모양
      ctx.moveTo(80 + pulse, 0);
      ctx.quadraticCurveTo(30, 40, -20, 20);
      ctx.quadraticCurveTo(-10, 0, -20, -20);
      ctx.quadraticCurveTo(30, -40, 80 + pulse, 0);
      ctx.fill();

      // 3. 화염 불꽃 파티클 (배경 흐름)
      for (let i = 0; i < 8; i++) {
        const px = (Math.random() - 0.5) * 100;
        const py = (Math.random() - 0.5) * 60;
        ctx.fillStyle = `rgba(255, ${150 + Math.random() * 100}, 0, ${1 - progress})`;
        ctx.beginPath();
        ctx.arc(px, py, Math.random() * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // [v16.0] 기존 장풍 (G열 - 네온 블루)
      const grad = ctx.createRadialGradient(20, 0, 5, 40, 0, 50);
      grad.addColorStop(0, 'rgba(0, 200, 255, 0.9)');
      grad.addColorStop(0.5, 'rgba(0, 100, 255, 0.4)');
      grad.addColorStop(1, 'rgba(0, 50, 255, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(30 + pulse, 0, 50 + pulse, 30, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 코어 스파크 (공통)
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(20, (Math.random() - 0.5) * 10, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * [v11.4] 공통 말풍선 렌더러
   */
  function drawSpeechBubble(target, msg, time) {
    if (!msg || !time || Date.now() - time > 4000) return;

    ctx.save();
    ctx.font = "bold 13px 'Noto Sans KR', sans-serif";

    const lines = msg.split('\n');
    const lineHeight = 18;
    let maxWidth = 0;
    lines.forEach(line => {
      const tw = ctx.measureText(line).width;
      if (tw > maxWidth) maxWidth = tw;
    });

    const w = maxWidth + 30;
    const h = (lines.length * lineHeight) + 12;
    const x = target.x + 32;
    const y = target.y - 12;

    // 말풍선 박스
    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 10;
    roundRect(ctx, x - w / 2, y - h - 10, w, h, 15);
    ctx.fill();

    // 말풍선 꼬리
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 10);
    ctx.lineTo(x + 8, y - 10);
    ctx.lineTo(x, y - 2);
    ctx.fill();

    // 텍스트 출력
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#111";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    lines.forEach((line, i) => {
      const lineY = (y - h - 10) + (i * lineHeight) + (lineHeight / 2) + 6;
      ctx.fillText(line, x, lineY);
    });

    ctx.restore();
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
  // [v9.2] 공간 컬러 감지 및 정보 업데이트

  function updateEffects() {
    state.effects = state.effects.filter(fx => {
      if (fx.type === 'fire') {
        fx.x += fx.vx; fx.y += fx.vy;
        fx.life -= 0.03;
      } else {
        fx.life -= 0.05;
      }
      return fx.life > 0;
    });
  }

  function createSpawnEffect(ex, ey) {
    // [v9.5] 번개 이펙트 (순간적으로 생성)
    state.effects.push({ type: 'lightning', x: ex + 32, y: ey + 80, life: 1, color: '#FFF' });
    // [v9.5] 펑! 연기 소환 이펙트
    for (let i = 0; i < 12; i++) {
      state.effects.push({
        type: 'smoke',
        x: ex + 32 + (Math.random() - 0.5) * 40,
        y: ey + 80 + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        size: 10 + Math.random() * 20,
        life: 1 + Math.random()
      });
    }
  }

  function checkZoneColor() {
    if (!state.colorMap) return;
    const footX = Math.round(state.avatar.x + 32);
    const footY = Math.round(state.avatar.y + 90);
    const idx = (footY * state.colorMap.width + footX) * 4;
    const r = state.colorMap.data[idx];
    const g = state.colorMap.data[idx + 1];
    const b = state.colorMap.data[idx + 2];
    const a = state.colorMap.data[idx + 3];

    if (a > 50) { // 어느 정도 투명하지 않은 구역 진입
      const zone = findClosestZone(r, g, b);
      if (zone) {
        updateZoneUI(zone);
        state.activeZone = zone;
        return;
      }
    }
    updateZoneUI(null);
    state.activeZone = null;
  }

  // [v9.3] 색상 간의 거리를 계산하여 가장 유사한 구역 찾기 (Tolerance: 100)
  function findClosestZone(r, g, b) {
    let minGap = 100; // 최대 허용 오차 거리
    let closest = null;

    // [v12.2] 현재 층의 영역 정보만 조회
    const zones = state.zoneConfigs[state.currentFloor] || [];

    zones.forEach(z => {
      const target = hexToRgb(z.color);
      if (!target) return;

      // 색상 거리 계산 (유클리드 거리)
      const gap = Math.sqrt(
        Math.pow(r - target.r, 2) +
        Math.pow(g - target.g, 2) +
        Math.pow(b - target.b, 2)
      );

      if (gap < minGap) {
        minGap = gap;
        closest = z;
      }
    });
    return closest;
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  function updateZoneUI(zone) {
    const card = document.getElementById('zone-card');
    const title = document.getElementById('zone-title');
    const desc = document.getElementById('zone-desc');
    const action = document.getElementById('zone-action');
    const hudLoc = document.getElementById('location-name');

    if (zone) {
      const zoneTitle = zone.place || zone.name || "안내";
      if (title && title.innerText !== zoneTitle) { // 새로운 구역일 때만 갱신
        title.innerText = zoneTitle;
        if (desc) desc.innerText = zone.desc || "";
        if (hudLoc) hudLoc.innerText = `${state.currentFloor}F ${zoneTitle}`;

        if (card) {
          card.classList.add('active');
        }

        if (state.zoneTimer) { clearTimeout(state.zoneTimer); state.zoneTimer = null; }

        // [v37.0] 휴대폰 뷰 가림 방지: 일반 구역은 3초 뒤 자동 숨김, 오브젝트 구역은 상시 노출
        if (!zone.isObject) {
          state.zoneTimer = setTimeout(() => {
            if (card) card.classList.remove('active');
            state.zoneTimer = null;
          }, 3000);
        }
      }
      if (zone.url && action) action.classList.remove('action-hidden');
      else if (action) action.classList.add('action-hidden');
    } else {
      // 구역을 완전히 벗어났을 때 즉시 숨김 및 초기화
      if (card) card.classList.remove('active');
      if (state.zoneTimer) { clearTimeout(state.zoneTimer); state.zoneTimer = null; }
      if (title) title.innerText = "";
      if (hudLoc) hudLoc.innerText = `${state.currentFloor}F 로비`;
    }
  }

  // [v12.9] 모든 센서 통합 감지 (오브젝트 우선)
  function checkAllSensors() {
    if (!state.mapLoaded || state.isChatting) return;

    const footX = Math.round(state.avatar.x + 32);
    const footY = Math.round(state.avatar.y + 90);

    let found = null;

    // 1순위: 오브젝트 영역 감지 (F열)
    if (state.objectColorMap) {
      const idx = (footY * state.objectColorMap.width + footX) * 4;
      const r = state.objectColorMap.data[idx], g = state.objectColorMap.data[idx + 1], b = state.objectColorMap.data[idx + 2], a = state.objectColorMap.data[idx + 3];
      if (a > 50) {
        const obj = findClosestObject(r, g, b);
        if (obj) found = { place: obj.name, desc: obj.desc, url: obj.url, isObject: true, persist: true };
      }
    }

    // 2순위: 일반 구역 감지 (E열)
    if (!found && state.colorMap) {
      const idx = (footY * state.colorMap.width + footX) * 4;
      const r = state.colorMap.data[idx], g = state.colorMap.data[idx + 1], b = state.colorMap.data[idx + 2], a = state.colorMap.data[idx + 3];
      if (a > 50) {
        const zone = findClosestZone(r, g, b);
        if (zone) found = zone;
      }
    }

    // UI 상태 업데이트 (통합 1회 호출)
    if (found) {
      if (!state.activeZone || state.activeZone.place !== found.place) {
        updateZoneUI(found);
        state.activeZone = found;
      }
    } else {
      if (state.activeZone) {
        updateZoneUI(null);
        state.activeZone = null;
      }
    }
  }

  // [v12.3] 상호작용(F키) 처리 — 층 이동 + 외부링크 + AI챗봇 통합
  function handleInteraction() {
    // [신규] AI봇 또는 AI봇2 근접 시 F키 → AI 챗봇 모달 실행
    if ((state.aiBot && state.aiBot.active && state.aiBot.isPaused) ||
      (state.aiBot2 && state.aiBot2.active && state.aiBot2.isPaused)) {
      openAIChatbot();
      return;
    }

    if (state.activeZone && state.activeZone.url) {
      const url = state.activeZone.url.trim();
      const urlUpper = url.toUpperCase();
      // 층간 이동 (예: "2F", "3F")
      if (/^\d+F$/i.test(url)) {
        const floor = parseInt(url);
        if (!isNaN(floor)) loadFloorMap(floor);
      } else if (urlUpper === '#RECRUIT' || urlUpper === '#채용공고') {
        openRecruitPopup('채용');
      } else if (urlUpper === '#PRACTICE' || urlUpper === '#현장실습') {
        openRecruitPopup('실습');
      } else if (urlUpper === '#NOTICE' || urlUpper === '#공지사항') {
        openMetaNoticeList();
      } else if (urlUpper === '#AICENTER' || urlUpper === '#AI센터') {
        openAIChatbot();
      } else if (url.startsWith('http')) {
        window.open(url, '_blank');
      }
    }
  }

  // [신규] 메타버스 팝업 로직 (공지사항 I열 기준 + 키워드 필터링)
  function openRecruitPopup(keyword) {
    if (typeof ALL_NOTICES_DATA === 'undefined' || ALL_NOTICES_DATA.length === 0) {
      // 데이터가 없을 경우 재호출
      if (typeof google !== 'undefined' && google.script) {
        showJoinToast("안내", "데이터를 불러오는 중입니다...");
        google.script.run.withSuccessHandler((data) => {
          ALL_NOTICES_DATA = data;
          processRecruitPopup(keyword);
        }).getNoticeList();
      }
      return;
    }
    processRecruitPopup(keyword);
  }

  function processRecruitPopup(keyword) {
    // 1. 팝업 플래그가 켜진 것들 중에서 키워드(채용/실습)가 제목이나 구분에 포함된 첫번째 공지 찾기
    const recruitData = ALL_NOTICES_DATA.find(n =>
      n.isPopup === true &&
      ((n.title && n.title.includes(keyword)) || (n.type && n.type.includes(keyword)))
    );

    const popup = document.getElementById('metaverseRecruitPopup');
    const defaultTitle = keyword === '실습' ? '현장실습 안내' : '입사지원 안내';

    if (!recruitData) {
      // 팝업 데이터가 없을 경우
      document.getElementById('meta-recruit-title').innerText = defaultTitle;
      document.getElementById('meta-recruit-date').innerText = "";
      document.getElementById('meta-recruit-content').innerText = "현재 예정된 공고가 없습니다.";
      document.getElementById('meta-recruit-attachment').innerHTML = "";
    } else {
      document.getElementById('meta-recruit-title').innerText = recruitData.title || defaultTitle;
      document.getElementById('meta-recruit-date').innerText = recruitData.date ? "등록일: " + recruitData.date.substring(0, 10) : "";
      document.getElementById('meta-recruit-content').innerText = recruitData.content || "";

      const attachmentHtml = recruitData.attachment
        ? `<a href="${recruitData.attachment}" target="_blank" class="meta-recruit-btn">안내문/양식(첨부파일) 다운로드</a>`
        : '';
      document.getElementById('meta-recruit-attachment').innerHTML = attachmentHtml;
    }

    popup.style.display = 'flex';
    // 페이드인 효과를 위해 약간의 딜레이
    setTimeout(() => popup.classList.add('show'), 10);
  }

  // =========================================================================
  // [신규] 메타버스 전용 공지사항 전체 목록 로직
  // =========================================================================
  let metaNoticeCurrentPage = 1;
  const META_NOTICE_PAGE_SIZE = 6;
  let metaNoticeSearchQuery = '';

  function openMetaNoticeList() {
    if (typeof ALL_NOTICES_DATA === 'undefined' || ALL_NOTICES_DATA.length === 0) {
      if (typeof google !== 'undefined' && google.script) {
        showJoinToast("안내", "공지사항 데이터를 불러오는 중입니다...");
        google.script.run.withSuccessHandler((data) => {
          ALL_NOTICES_DATA = data;
          initMetaNoticeList();
        }).getNoticeList();
      }
      return;
    }
    initMetaNoticeList();
  }

  function initMetaNoticeList() {
    metaNoticeCurrentPage = 1;
    metaNoticeSearchQuery = '';
    const searchInput = document.getElementById('meta-notice-search-input');
    if (searchInput) searchInput.value = '';

    const popup = document.getElementById('metaverseNoticeListPopup');
    if (popup) {
      popup.style.display = 'flex';
      setTimeout(() => popup.classList.add('show'), 10);
      renderMetaNoticeList();
    }
  }

  function closeMetaNoticeList() {
    const popup = document.getElementById('metaverseNoticeListPopup');
    if (popup) {
      popup.classList.remove('show');
      setTimeout(() => popup.style.display = 'none', 300);
    }
  }

  function searchMetaNotice() {
    const searchInput = document.getElementById('meta-notice-search-input');
    metaNoticeSearchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';
    metaNoticeCurrentPage = 1;
    renderMetaNoticeList();
  }

  function renderMetaNoticeList() {
    const ul = document.getElementById('meta-noticelist-content');
    const pagination = document.getElementById('meta-noticelist-pagination');

    if (!ul || !pagination) return;

    // 1. 공지사항만 보이게 하려면 필터링 (필요시 type 체크)
    // 검색 필터링
    let filtered = ALL_NOTICES_DATA;
    if (metaNoticeSearchQuery) {
      filtered = filtered.filter(n =>
        (n.title && n.title.toLowerCase().includes(metaNoticeSearchQuery)) ||
        (n.content && n.content.toLowerCase().includes(metaNoticeSearchQuery)) ||
        (n.type && n.type.toLowerCase().includes(metaNoticeSearchQuery))
      );
    }

    if (filtered.length === 0) {
      ul.innerHTML = '<li class="meta-notice-empty">조건에 맞는 공지사항이 없습니다.</li>';
      pagination.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(filtered.length / META_NOTICE_PAGE_SIZE);
    if (metaNoticeCurrentPage > totalPages) metaNoticeCurrentPage = totalPages;
    if (metaNoticeCurrentPage < 1) metaNoticeCurrentPage = 1;

    const startIdx = (metaNoticeCurrentPage - 1) * META_NOTICE_PAGE_SIZE;
    const pageData = filtered.slice(startIdx, startIdx + META_NOTICE_PAGE_SIZE);

    let html = '';
    pageData.forEach(n => {
      // openNoticeDetail에 전달하기 위해 전체 목록에서의 원본 인덱스 검색
      const originalIndex = ALL_NOTICES_DATA.indexOf(n);
      const badge = n.isPinned ? '<span style="color:#ff4757; font-weight:bold; margin-right:5px;">[중요]</span>' : '';
      const dateStr = n.date ? String(n.date).substring(0, 10) : '';
      const typeStr = n.type || '일반';

      html += `
        <li onclick="openNoticeDetail(${originalIndex})">
          <div>
            <div class="meta-notice-item-title">${badge}[${typeStr}] ${n.title}</div>
            <div class="meta-notice-item-date">${dateStr}</div>
          </div>
        </li>
      `;
    });
    ul.innerHTML = html;

    // 페이지네이션 렌더링 (최대 5페이지 버튼 표시)
    let pageHtml = '';
    const maxVisiblePages = 5;
    let startPage = Math.max(1, metaNoticeCurrentPage - Math.floor(maxVisiblePages / 2));
    let endPage = startPage + maxVisiblePages - 1;
    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    pageHtml += `<button class="meta-page-arrow" onclick="changeMetaNoticePage(${metaNoticeCurrentPage - 1})" ${metaNoticeCurrentPage === 1 ? 'disabled' : ''}>◀</button>`;

    for (let i = startPage; i <= endPage; i++) {
      const activeClass = i === metaNoticeCurrentPage ? 'active' : '';
      pageHtml += `<button class="meta-page-btn ${activeClass}" onclick="changeMetaNoticePage(${i})">${i}</button>`;
    }

    pageHtml += `<button class="meta-page-arrow" onclick="changeMetaNoticePage(${metaNoticeCurrentPage + 1})" ${metaNoticeCurrentPage === totalPages ? 'disabled' : ''}>▶</button>`;

    pagination.innerHTML = pageHtml;
  }

  function changeMetaNoticePage(page) {
    metaNoticeCurrentPage = page;
    renderMetaNoticeList();
  }

  function closeRecruitPopup() {
    const popup = document.getElementById('metaverseRecruitPopup');
    if (popup) {
      popup.classList.remove('show');
      setTimeout(() => popup.style.display = 'none', 300);
    }
  }

  /**
   * [v12.1] 우측 상단 입장 알림 토스트
   */
  function showJoinToast(name) {
    const container = document.getElementById('join-toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'join-toast';
    toast.innerHTML = `<span class="toast-avatar">👤</span><span><b>${name}</b>님이 입장했습니다</span>`;
    container.appendChild(toast);
    // 애니메이션 시작
    setTimeout(() => toast.classList.add('toast-show'), 10);
    // 4초 후 미끄러지며 삭제
    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 500);
    }, 4000);
  }

  // [v12.8] 오브젝트 영역 감지 엔진 (픽셀 기반)
  function checkObjectInteraction() {
    if (!state.objectColorMap || state.isChatting) return;
    const footX = Math.round(state.avatar.x + 32);
    const footY = Math.round(state.avatar.y + 90);

    if (footX < 0 || footX >= state.objectColorMap.width || footY < 0 || footY >= state.objectColorMap.height) return;

    const idx = (footY * state.objectColorMap.width + footX) * 4;
    const r = state.objectColorMap.data[idx], g = state.objectColorMap.data[idx + 1], b = state.objectColorMap.data[idx + 2], a = state.objectColorMap.data[idx + 3];

    if (a > 50) {
      const obj = findClosestObject(r, g, b);
      if (obj) {
        const mockZone = { place: obj.name, desc: obj.desc, url: obj.url, isObject: true };
        if (!state.activeZone || state.activeZone.place !== obj.name) {
          state.activeZone = mockZone;
          updateZoneUI(mockZone);
        }
        return;
      }
    }
    // 오브젝트 영역이 아니고, 현재 존이 오브젝트라면 클리어
    if (state.activeZone && state.activeZone.isObject) {
      state.activeZone = null;
      updateZoneUI(null);
    }
  }

  function findClosestObject(r, g, b) {
    let minGap = 100;
    let closest = null;
    const objs = state.objectConfigs[state.currentFloor] || [];
    objs.forEach(o => {
      const target = hexToRgb(o.color);
      if (!target) return;
      const gap = Math.sqrt(Math.pow(r - target.r, 2) + Math.pow(g - target.g, 2) + Math.pow(b - target.b, 2));
      if (gap < minGap) { minGap = gap; closest = o; }
    });
    return closest;
  }

  /**
   * [v9.5] 영역 감지 엔진 (E열 도안 컬러 매칭 + 사각형 영역 통합)
   */
  function checkZones() {
    const av = state.avatar;

    // 1. 도안 기반 실시간 감지 (E열)
    if (state.colorMap) {
      const px = Math.round(av.x + 32);
      const py = Math.round(av.y + 90);
      if (px >= 0 && px < state.colorMap.width && py >= 0 && py < state.colorMap.height) {
        const idx = (py * state.colorMap.width + px) * 4;
        const r = state.colorMap.data[idx], g = state.colorMap.data[idx + 1], b = state.colorMap.data[idx + 2], a = state.colorMap.data[idx + 3];
        if (a > 50) {
          const zone = findClosestZoneFromColor(r, g, b);
          if (zone) {
            if (!state.activeZone || (state.activeZone.place !== zone.place)) {
              state.activeZone = zone;
              updateZoneUI(zone);
            }
            return; // 컬러 매칭 성공 시 리턴
          }
        }
      }
    }

    // 2. 사각형(Rect) 기반 감지 (하위 호환 및 보조용)
    const zones = state.zoneConfigs[state.currentFloor] || [];
    let found = null;
    for (const z of zones) {
      if (z.x1 !== undefined && av.x >= z.x1 && av.x <= z.x2 && av.y >= z.y1 && av.y <= z.y2) {
        found = z;
        break;
      }
    }

    if (found) {
      if (!state.activeZone || state.activeZone.place !== found.place) {
        state.activeZone = found;
        updateZoneUI(found);
      }
    } else {
      // 오브젝트 영역이 아닐 때만 일반 클리어
      if (state.activeZone && !state.activeZone.isObject) {
        state.activeZone = null;
        updateZoneUI(null);
      }
    }
  }

  function findClosestZoneFromColor(r, g, b) {
    let minGap = 100;
    let closest = null;
    const floorKey = String(state.currentFloor);
    const zones = state.zoneConfigs[floorKey] || [];
    zones.forEach(z => {
      if (!z.color) return;
      const target = hexToRgb(z.color);
      if (!target) return;
      const gap = Math.sqrt(Math.pow(r - target.r, 2) + Math.pow(g - target.g, 2) + Math.pow(b - target.b, 2));
      if (gap < minGap) { minGap = gap; closest = z; }
    });
    return closest;
  }

  function hexToRgb(hex) {
    if (!hex) return null;
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(s => s + s).join('');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return isNaN(r) ? null : { r, g, b };
  }

  function update(dt) {
    if (!state.mapLoaded) return;
    const av = state.avatar;

    // [신규] 체력 자동 회복 (초당 1씩, 최대 100까지)
    if (!av.isDissolving && av.hp < 100) {
      av.hp = Math.min(100, av.hp + 1 * dt);
    }

    // [v15.2] 델타타임 기반 이동 제어
    let nX = av.x, nY = av.y, moved = false;

    // [v12.8] 영역 감지 실행 (일반 사각형 + 픽셀 오브젝트)
    checkZones();
    checkObjectInteraction();

    // [중요] 대화 중이거나 불에 타는 중에는 아바타 이동 차단
    if (!state.isChatting && !av.isDissolving) {
      let baseSpeed = (state.keys['ShiftLeft'] || state.keys['ShiftRight']) ? 480 : 240;
      if (av.canSpeed) baseSpeed *= 1.5;
      let speed = baseSpeed * dt;
      let vx = 0, vy = 0;

      if (state.keys['ArrowUp']) { nY -= speed; av.direction = 'up'; moved = true; vy = -baseSpeed; }
      if (state.keys['ArrowDown']) { nY += speed; av.direction = 'down'; moved = true; vy = baseSpeed; }
      if (state.keys['ArrowLeft']) { nX -= speed; av.direction = 'left'; moved = true; vx = -baseSpeed; }
      if (state.keys['ArrowRight']) { nX += speed; av.direction = 'right'; moved = true; vx = baseSpeed; }

      av.vx = vx; av.vy = vy; // 속도 정보 저장 (동기화용)

      // 충돌 체크 및 위치 반영
      const overrideCollision = state.keys['ShiftLeft'] || state.keys['ShiftRight'] || av.isGhost;

      // [v16.0] 맵 밖으로 튕김 방지 (Bound Check) 및 최종 위치 클램핑
      const mw = state.currentMapImg.width, mh = state.currentMapImg.height;
      if (overrideCollision || !isColliding(nX, nY)) {
        // 캐릭터 중심점 기준 맵을 벗어나지 않도록 강제 제한
        av.x = Math.max(-32, Math.min(mw - 32, nX));
        av.y = Math.max(-80, Math.min(mh - 80, nY));
      }
    }

    // [v16.0] 내 장풍 렌더링용 상태 체크 (draw 단계에서 호출)
    // ... 별도 draw 함수에서 처리됨

    // [v16.1] 점프 물리 엔진 (수치 정상화 및 NaN 방지)
    if (av.canJump && state.keys['Space'] && !av.isJumping && !state.isChatting) {
      av.jumpVel = -400; // 초기 점속 (델타타임 미적용, 초당 픽셀)
      av.isJumping = true;
    }

    if (av.isJumping) {
      av.jumpY += av.jumpVel * dt; // 이동량에 dt 적용
      av.jumpVel += 1200 * dt;    // 중력 가속도 (초당 1200px 강화)
      if (av.jumpY >= 0) { av.jumpY = 0; av.jumpVel = 0; av.isJumping = false; }
    }

    // [v14.5] 델타타임 기반 프레임 독립적 애니메이션
    if (moved) {
      av.lastMoveTime = Date.now(); // 움직임 감지 시 시간 갱신
      const animSpeed = (av.canSpeed ? 12.0 : 6.0) * dt;
      av.animFrame = (av.animFrame + animSpeed) % 4;
      // [발자국] 이동 중엔 계속 재생(이미 재생 중이면 유지) - 걸음마다 끊어 재생하지 않음
      FOOTSTEP.play();
      // [신규] 캐릭터가 직접 움직이면 카메라를 캐릭터 중심으로 부드럽게 복귀
      if (state.targetCamOffset) {
        state.targetCamOffset.x = 0;
        state.targetCamOffset.y = 0;
      }
    } else {
      av.animFrame = 1; // 정지 시 차렷 자세 고정
      FOOTSTEP.stop(); // [발자국] 멈추는 즉시 정지
    }

    // [v20.0] 각종 타이머 및 물리 수치 업데이트
    if (av.spawnTimer > 0) av.spawnTimer -= dt;

    // [v15.5] 네트워크 과부하 방지: 실제 이동 위치가 변했거나 특수 동작(장풍) 중일 때 동기화
    if (moved || av.isFiring) {
      syncMyPosition();
    } else if (av.vx !== 0 || av.vy !== 0) {
      // 멈췄을 때만 한 번 더 전송하여 속도를 0으로 동기화
      av.vx = 0; av.vy = 0;
      syncMyPosition(true);
    }

    const now = Date.now();
    if (!state.lastSync || now - state.lastSync > 5000) { syncMyPosition(); }

    // 대면 마주보기 체크 및 가이드 (Face-to-Face)
    state.nearestPlayer = null;
    let minChatDist = 60;
    Object.keys(state.otherPlayers).forEach(id => {
      if (id === state.mySessionId) return;
      const p = state.otherPlayers[id];
      if (p.floor !== state.currentFloor) return;
      const dist = Math.sqrt(Math.pow(av.x - p.x, 2) + Math.pow(av.y - p.y, 2));
      if (dist < minChatDist) {
        const isFacing = (
          (av.direction === 'right' && p.direction === 'left') ||
          (av.direction === 'left' && p.direction === 'right') ||
          (av.direction === 'up' && p.direction === 'down') ||
          (av.direction === 'down' && p.direction === 'up')
        );
        if (isFacing) { state.nearestPlayer = p; minChatDist = dist; }
      }
    });

    const chatBar = document.getElementById('chat-input-wrapper');
    const chatInput = document.getElementById('chat-input');
    const isLongTextZone = state.activeZone && (state.activeZone.place === '다목적실' || state.activeZone.place === '상담실');
    const logWindow = document.getElementById('chat-log-window');

    if (state.nearestPlayer || isLongTextZone) {
      chatBar.classList.add('active');
      if (logWindow && isLongTextZone) logWindow.classList.add('visible');
      if (!state.isChatting) {
        if (isLongTextZone) chatInput.placeholder = `${state.activeZone.place} 모드: 모두와 대화가 가능합니다...`;
        else chatInput.placeholder = `${state.nearestPlayer.name || '상대'}님과 대화를 위해 메세지를 입력하세요...`;
      }
    } else if (!state.isChatting) {
      chatBar.classList.remove('active');
      if (logWindow) logWindow.classList.remove('visible');
      chatInput.placeholder = "상대에게 다가가서 대화를 시작하세요...";
    }

    checkAllSensors();

    // [신규] AI봇 순찰 이동 및 근접 감지 로직 업데이트
    updateAIBot(dt);
    updateAIBot2(dt);
    // [분수대] 애니메이션 프레임 업데이트
    updateFountain(dt);
    // [시네마 극장] 조명 회전 애니메이션 프레임 업데이트
    updateCinema(dt);

    // [신규] 카메라 오프셋 부드러운 이동 (LERP 보정)
    if (state.camOffset && state.targetCamOffset) {
      const lerpFactor = state.isDraggingMap ? 1.0 : Math.min(1.0, dt * 8); // 드래그 중에는 직관적 반응, 클릭/복귀 시에는 8.0 속도로 부드러운 스무딩
      state.camOffset.x += (state.targetCamOffset.x - state.camOffset.x) * lerpFactor;
      state.camOffset.y += (state.targetCamOffset.y - state.camOffset.y) * lerpFactor;
    }
  }

  // [신규] AI봇 순찰 이동 및 플레이어 접근 감지 엔진
  function updateAIBot(dt) {
    const bot = state.aiBot;
    if (!bot || !bot.active || !bot.waypoints || bot.waypoints.length < 2) return;

    const av = state.avatar;
    const distToPlayer = Math.hypot(av.x - bot.x, av.y - bot.y);

    // 플레이어 감지범위(80px 내) 근접 시 이동 멈춤 및 정지 상태 전환
    if (distToPlayer < 80) {
      bot.isPaused = true;
      // 플레이어를 바라보도록 방향 설정
      const dx = av.x - bot.x;
      const dy = av.y - bot.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        bot.direction = dx > 0 ? 'right' : 'left';
      } else {
        bot.direction = dy > 0 ? 'down' : 'up';
      }
      return;
    }

    bot.isPaused = false;
    const targetWp = bot.waypoints[bot.waypointIdx];
    if (!targetWp) return;

    const dx = targetWp.x - bot.x;
    const dy = targetWp.y - bot.y;
    const dist = Math.hypot(dx, dy);

    // 웨이포인트 노드 도달 시 다음 노드로 전환 (끝점 도달 시 반대 방향 전환)
    if (dist < 10) {
      if (bot.forward) {
        if (bot.waypointIdx >= bot.waypoints.length - 1) {
          bot.forward = false;
          bot.waypointIdx = bot.waypoints.length - 2;
        } else {
          bot.waypointIdx++;
        }
      } else {
        if (bot.waypointIdx <= 0) {
          bot.forward = true;
          bot.waypointIdx = 1;
        } else {
          bot.waypointIdx--;
        }
      }
      return;
    }

    // 이동 속도 및 방향 설정
    const moveDist = bot.speed * 60 * dt;
    const vx = (dx / dist) * moveDist;
    const vy = (dy / dist) * moveDist;

    bot.x += vx;
    bot.y += vy;

    if (Math.abs(dx) > Math.abs(dy)) {
      bot.direction = dx > 0 ? 'right' : 'left';
    } else {
      bot.direction = dy > 0 ? 'down' : 'up';
    }

    // 걸음 애니메이션 프레임 스위칭
    bot.animTimer += dt;
    if (bot.animTimer >= 0.25) {
      bot.animTimer = 0;
      bot.animFrame = bot.animFrame === 1 ? 2 : 1;
    }
  }

  // [신규] AI봇2 순찰 이동 및 플레이어 접근 감지 엔진 (빨간 동선)
  function updateAIBot2(dt) {
    const bot = state.aiBot2;
    if (!bot || !bot.active || !bot.waypoints || bot.waypoints.length < 2) return;

    const av = state.avatar;
    const distToPlayer = Math.hypot(av.x - bot.x, av.y - bot.y);

    if (distToPlayer < 80) {
      bot.isPaused = true;
      const dx = av.x - bot.x;
      const dy = av.y - bot.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        bot.direction = dx > 0 ? 'right' : 'left';
      } else {
        bot.direction = dy > 0 ? 'down' : 'up';
      }
      return;
    }

    bot.isPaused = false;
    const targetWp = bot.waypoints[bot.waypointIdx];
    if (!targetWp) return;

    const dx = targetWp.x - bot.x;
    const dy = targetWp.y - bot.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 10) {
      if (bot.forward) {
        if (bot.waypointIdx >= bot.waypoints.length - 1) {
          bot.forward = false;
          bot.waypointIdx = bot.waypoints.length - 2;
        } else {
          bot.waypointIdx++;
        }
      } else {
        if (bot.waypointIdx <= 0) {
          bot.forward = true;
          bot.waypointIdx = 1;
        } else {
          bot.waypointIdx--;
        }
      }
      return;
    }

    const moveDist = bot.speed * 60 * dt;
    bot.x += (dx / dist) * moveDist;
    bot.y += (dy / dist) * moveDist;

    if (Math.abs(dx) > Math.abs(dy)) {
      bot.direction = dx > 0 ? 'right' : 'left';
    } else {
      bot.direction = dy > 0 ? 'down' : 'up';
    }

    bot.animTimer += dt;
    if (bot.animTimer >= 0.25) {
      bot.animTimer = 0;
      bot.animFrame = bot.animFrame === 1 ? 2 : 1;
    }
  }

  // [신규] AI봇 캐릭터 및 말풍선 렌더링 엔진
  function drawAIBot(filterBehind = null, fountainSort = null) {
    const bot = state.aiBot;
    if (!bot || !bot.active) return;
    if (shouldSkipForFountain(bot.x, bot.y, fountainSort)) return;

    // 건물 벽 뒤/앞 필터링 체크
    if (filterBehind !== null && state.currentMapImg) {
      const mapW = state.currentMapImg.width;
      const px = Math.floor(bot.x + 32);
      const py = Math.floor(bot.y + 90);
      const isBehind = (state.foregroundMask && state.foregroundMask[py * mapW + px] === 1);
      if (isBehind !== filterBehind) return;
    }

    // 1. AI봇 그림자
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(bot.x + 32, bot.y + 88, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. AI봇 스프라이트 렌더링
    let drawn = false;
    if (bot.bitmaps && bot.bitmaps[bot.direction] && bot.bitmaps[bot.direction][bot.animFrame]) {
      const img = bot.bitmaps[bot.direction][bot.animFrame];
      if (img && img.complete) {
        ctx.drawImage(img, bot.x, bot.y, 64, 96);
        drawn = true;
      }
    }

    // 비트맵 미로드 시 가이드 더미 원형 박스 렌더링
    if (!drawn) {
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(bot.x + 32, bot.y + 48, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 3. AI봇 상시 말풍선 (맨 위에만 표기)
    if (!filterBehind) {
      // 상시 말풍선 & F키 안내
      ctx.font = '500 13px "Inter", sans-serif';
      ctx.textAlign = 'center';
      let speechMsg = bot.speechText;
      let isPrompt = false;

      if (bot.isPaused) {
        speechMsg = "💡 [F] 키를 눌러 AI 어시스턴트와 대화해보세요!";
        isPrompt = true;
      }

      const msgW = ctx.measureText(speechMsg).width + 24;
      const bX = bot.x + 32;
      const bY = bot.y - 25;

      ctx.fillStyle = isPrompt ? 'rgba(37, 99, 235, 0.95)' : 'rgba(255, 255, 255, 0.95)';
      roundRect(ctx, bX - msgW / 2, bY - 24, msgW, 30, 10);
      ctx.fill();
      ctx.strokeStyle = isPrompt ? '#93c5fd' : '#2563eb';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 말풍선 꼬리표
      ctx.beginPath();
      ctx.moveTo(bX - 6, bY + 6);
      ctx.lineTo(bX + 6, bY + 6);
      ctx.lineTo(bX, bY + 12);
      ctx.closePath();
      ctx.fillStyle = isPrompt ? 'rgba(37, 99, 235, 0.95)' : 'rgba(255, 255, 255, 0.95)';
      ctx.fill();

      // 글자
      ctx.fillStyle = isPrompt ? '#ffffff' : '#0f172a';
      ctx.fillText(speechMsg, bX, bY - 9);
    }
  }

  // [신규] AI봇2 캐릭터 및 말풍선 렌더링 엔진 (빨간 동선)
  function drawAIBot2(filterBehind = null, fountainSort = null) {
    const bot = state.aiBot2;
    if (!bot || !bot.active) return;
    if (shouldSkipForFountain(bot.x, bot.y, fountainSort)) return;

    if (filterBehind !== null && state.currentMapImg) {
      const mapW = state.currentMapImg.width;
      const px = Math.floor(bot.x + 32);
      const py = Math.floor(bot.y + 90);
      const isBehind = (state.foregroundMask && state.foregroundMask[py * mapW + px] === 1);
      if (isBehind !== filterBehind) return;
    }

    // 그림자
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(bot.x + 32, bot.y + 88, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 스프라이트
    let drawn = false;
    if (bot.bitmaps && bot.bitmaps[bot.direction] && bot.bitmaps[bot.direction][bot.animFrame]) {
      const img = bot.bitmaps[bot.direction][bot.animFrame];
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, bot.x, bot.y, 64, 96);
        drawn = true;
      }
    }
    if (!drawn) {
      // 이미지 로드 전 임시 표시 (빨간 원)
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(bot.x + 32, bot.y + 48, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 말풍선
    if (!filterBehind) {
      ctx.font = '500 13px "Inter", sans-serif';
      ctx.textAlign = 'center';
      let speechMsg = bot.speechText;
      let isPrompt = false;

      if (bot.isPaused) {
        speechMsg = "💡 [F] 키를 눌러 AI 어시스턴트와 대화해보세요!";
        isPrompt = true;
      }

      const msgW = ctx.measureText(speechMsg).width + 24;
      const bX = bot.x + 32;
      const bY = bot.y - 25;

      ctx.fillStyle = isPrompt ? 'rgba(220, 38, 38, 0.95)' : 'rgba(255, 255, 255, 0.95)';
      roundRect(ctx, bX - msgW / 2, bY - 24, msgW, 30, 10);
      ctx.fill();
      ctx.strokeStyle = isPrompt ? '#fca5a5' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bX - 6, bY + 6);
      ctx.lineTo(bX + 6, bY + 6);
      ctx.lineTo(bX, bY + 12);
      ctx.closePath();
      ctx.fillStyle = isPrompt ? 'rgba(220, 38, 38, 0.95)' : 'rgba(255, 255, 255, 0.95)';
      ctx.fill();

      ctx.fillStyle = isPrompt ? '#ffffff' : '#0f172a';
      ctx.fillText(speechMsg, bX, bY - 9);
    }
  }

  function drawMyChatBubble() {
    drawSpeechBubble(state.avatar, state.avatar.message, state.avatar.msgTime);
  }

  function draw() {
    const vW = state.vpW || window.innerWidth;
    const vH = state.vpH || window.innerHeight;

    if (!state.mapLoaded || !state.currentMapImg) {
      if (bgCtx) { bgCtx.fillStyle = '#111'; bgCtx.fillRect(0, 0, vW, vH); }
      // [v12.1] 추가 안내 텍스트가 겹치지 않도록 깔끔한 배경만 노출
      return;
    }

    // [v12.5] 캔버스 분리 클리어
    if (bgCtx) bgCtx.clearRect(0, 0, vW, vH);
    ctx.clearRect(0, 0, vW, vH);

    const camX = Math.max(0, Math.min(state.currentMapImg.width - vW, state.avatar.x - vW / 2 + 32 + (state.camOffset ? state.camOffset.x : 0)));
    const camY = Math.max(0, Math.min(state.currentMapImg.height - vH, state.avatar.y - vH / 2 + 48 + (state.camOffset ? state.camOffset.y : 0)));

    // [v12.5] 원경 배경 분리 렌더링
    if (bgCtx) {
      bgCtx.save(); bgCtx.translate(-camX, -camY);
      bgCtx.drawImage(state.currentMapImg, 0, 0);
      bgCtx.restore();
    }

    ctx.save(); ctx.translate(-camX, -camY);

    // 1. Z-Index 1단계: 건물 벽/전경 뒤에 가려져야 하는 플레이어(뒤에 있는 사람)들을 먼저 그림
    drawOtherPlayers(true, 'behind');
    drawAvatar(true, 'behind');
    drawAIBot(true, 'behind');
    drawAIBot2(true, 'behind');
    drawFountain(true);
    drawCinema(true);
    drawOtherPlayers(true, 'front');
    drawAvatar(true, 'front');
    drawAIBot(true, 'front');
    drawAIBot2(true, 'front');

    // 2. Z-Index 2단계: 건물 벽, 창문 틀, 난간 등 전경 레이어(foregroundCanvas)를 그 위에 덮어씌움
    if (state.foregroundCanvas) {
      ctx.drawImage(state.foregroundCanvas, 0, 0);
    }

    // 3. Z-Index 3단계: 건물 벽 앞(도로 등)에 서 있는 플레이어들을 최종 렌더링
    drawOtherPlayers(false, 'behind');
    drawAvatar(false, 'behind');
    drawAIBot(false, 'behind');
    drawAIBot2(false, 'behind');
    drawFountain(false);
    drawCinema(false);
    drawOtherPlayers(false, 'front');
    drawAvatar(false, 'front');
    drawAIBot(false, 'front');
    drawAIBot2(false, 'front');


    // 4. 이펙트 및 말풍선 렌더링 (항상 최상단 노출)
    if (state.avatar.isFiring) drawJangPung(state.avatar.x, state.avatar.y + state.avatar.jumpY, state.avatar.fireDirection, state.avatar.fireType);
    drawMyChatBubble();

    // [v11.2] 대화 가능 시 보조 시각 가이드 (연결선) - 방해되지 않도록 매우 흐리게
    if (state.nearestPlayer) {
      const p = state.nearestPlayer;
      ctx.save();
      ctx.strokeStyle = "rgba(0,122,255,0.15)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(state.avatar.x + 32, state.avatar.y + 48);
      ctx.lineTo(p.x + 32, p.y + 48);
      ctx.stroke();
      ctx.restore();
    }

    // [신규] 맵상의 특수 마커 애니메이션 (챌린지 부스 3D 글자 등)
    drawSpecialMarkers();

    ctx.restore();

    // [v35.5] 미니맵 업데이트 호출
    updateMiniMap();
  }

  /**
   * [v35.5] 실시간 미니맵 네비게이션 렌더러
   */
  function updateMiniMap() {
    const miniWrap = document.getElementById('meta-mini-map-wrap');
    if (!miniWrap || miniWrap.offsetParent === null) return; // 화면에 안 보이면 스킵

    const miniCanvas = document.getElementById('mini-map-canvas');
    if (!miniCanvas) return;
    const mCtx = miniCanvas.getContext('2d');
    const mLoc = document.getElementById('mini-map-location-text');

    if (!state.currentMapImg) {
      mCtx.fillStyle = '#000';
      mCtx.fillRect(0, 0, miniCanvas.width, miniCanvas.height);
      return;
    }

    // 캔버스 크기 동기화 (처음 한 번 또는 맵 변경 시)
    if (miniCanvas.width === 0 || state.mapChanged) {
      miniCanvas.width = 260;
      miniCanvas.height = 180;
      state.mapChanged = false;
    }

    mCtx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);

    // 1. 전체 맵 축소 렌더링
    const scale = Math.min(miniCanvas.width / state.currentMapImg.width, miniCanvas.height / state.currentMapImg.height);
    const mWidth = state.currentMapImg.width * scale;
    const mHeight = state.currentMapImg.height * scale;
    const offsetX = (miniCanvas.width - mWidth) / 2;
    const offsetY = (miniCanvas.height - mHeight) / 2;

    mCtx.globalAlpha = 0.6;
    mCtx.drawImage(state.currentMapImg, offsetX, offsetY, mWidth, mHeight);
    mCtx.globalAlpha = 1.0;

    // 2. 다른 플레이어들 위치 표기 (파란색 점)
    if (state.otherPlayers) {
      Object.values(state.otherPlayers).forEach(op => {
        if (!op || op.floor !== state.currentFloor) return; // 같은 층에 있는 플레이어만 표기
        const opX = offsetX + ((op.x || 0) + 32) * scale;
        const opY = offsetY + ((op.y || 0) + 48) * scale;

        mCtx.shadowBlur = 8;
        mCtx.shadowColor = "#00bfff";
        mCtx.fillStyle = "rgba(0, 191, 255, 0.9)";
        mCtx.beginPath();
        mCtx.arc(opX, opY, 3.5, 0, Math.PI * 2);
        mCtx.fill();

        mCtx.strokeStyle = "#ffffff";
        mCtx.lineWidth = 1;
        mCtx.stroke();
        mCtx.shadowBlur = 0;
      });
    }

    // 3. 나의 위치 표기 (빨간색 깜빡이는 점)
    const myX = offsetX + (state.avatar.x + 32) * scale;
    const myY = offsetY + (state.avatar.y + 48) * scale;

    const time = Date.now();
    const pulse = Math.sin(time / 200) * 0.5 + 0.5;

    mCtx.shadowBlur = 10;
    mCtx.shadowColor = "#ff3b3b";
    mCtx.fillStyle = `rgba(255, 59, 59, ${0.5 + pulse * 0.5})`;
    mCtx.beginPath();
    mCtx.arc(myX, myY, 4, 0, Math.PI * 2);
    mCtx.fill();

    // 테두리 강조
    mCtx.strokeStyle = "#fff";
    mCtx.lineWidth = 1;
    mCtx.stroke();
    mCtx.shadowBlur = 0;

    // 4. [신규] 현재 화면 시야 범위 (뷰포트) 미니맵 표시
    const vW = state.vpW || window.innerWidth;
    const vH = state.vpH || window.innerHeight;
    const curCamX = Math.max(0, Math.min(state.currentMapImg.width - vW, state.avatar.x - vW / 2 + 32 + (state.camOffset ? state.camOffset.x : 0)));
    const curCamY = Math.max(0, Math.min(state.currentMapImg.height - vH, state.avatar.y - vH / 2 + 48 + (state.camOffset ? state.camOffset.y : 0)));

    const vpX = offsetX + curCamX * scale;
    const vpY = offsetY + curCamY * scale;
    const vpW_mini = vW * scale;
    const vpH_mini = vH * scale;

    mCtx.strokeStyle = "rgba(0, 242, 255, 0.85)";
    mCtx.lineWidth = 1.5;
    mCtx.fillStyle = "rgba(0, 242, 255, 0.12)";
    mCtx.fillRect(vpX, vpY, vpW_mini, vpH_mini);
    mCtx.strokeRect(vpX, vpY, vpW_mini, vpH_mini);

    // 미니맵 마우스 클릭 & 드래그 탐색 리스너 최초 1회 바인딩
    if (!miniCanvas._hasClickListener) {
      miniCanvas._hasClickListener = true;
      miniCanvas.style.cursor = 'crosshair';

      let isMiniDragging = false;

      const handleMiniMove = (e) => {
        if (!state.currentMapImg) return;
        const rect = miniCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const curScale = Math.min(miniCanvas.width / state.currentMapImg.width, miniCanvas.height / state.currentMapImg.height);
        const curOffX = (miniCanvas.width - state.currentMapImg.width * curScale) / 2;
        const curOffY = (miniCanvas.height - state.currentMapImg.height * curScale) / 2;

        const targetMapX = (clickX - curOffX) / curScale;
        const targetMapY = (clickY - curOffY) / curScale;

        // 클릭/드래그 위치가 화면 중앙에 오도록 목표 오프셋 계산
        if (state.targetCamOffset) {
          state.targetCamOffset.x = targetMapX - (state.avatar.x + 32);
          state.targetCamOffset.y = targetMapY - (state.avatar.y + 48);
        }
      };

      miniCanvas.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        isMiniDragging = true;
        handleMiniMove(e);
      });

      window.addEventListener('mousemove', e => {
        if (isMiniDragging) {
          handleMiniMove(e);
        }
      });

      window.addEventListener('mouseup', () => {
        if (isMiniDragging) {
          isMiniDragging = false;
        }
      });
    }

    // 5. 현재 층 및 위치 텍스트 업데이트
    const floorNames = { '1': '본관 1층', '2': '본관 2층', '3': '별관', 'outside': '야외 광장' };
    const curFloor = floorNames[state.currentFloor] || `층: ${state.currentFloor}`;
    const zoneName = state.activeZone ? ` [${state.activeZone.place}]` : "";
    mLoc.innerText = `${curFloor}${zoneName}`;
  }

  /**
   * [신규] 3D 회전 챌린지 간판 렌더러
   */
  function drawSpecialMarkers() {
    if (!state.specialMarkers) return;

    state.specialMarkers.forEach(m => {
      if (m.floor !== state.currentFloor || !m.active) return;

      const time = Date.now();
      const floatY = Math.sin(time / 800) * 5; // [v35.4] 더 천천히, 더 작게 위아래 흔들림 (800ms, 5px)

      ctx.save();
      ctx.translate(m.x, m.y + floatY);

      // 1. 그림자/바닥 광채
      const grad = ctx.createRadialGradient(0, 40 - floatY, 5, 0, 40 - floatY, 30);
      grad.addColorStop(0, 'rgba(0, 255, 255, 0.3)');
      grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 40 - floatY, 20, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. 텍스트 처리 (회전 제거, 정면 고정)

      // 외곽광채 (Neon Glow)
      ctx.shadowBlur = 15;
      ctx.shadowColor = m.shadow || "#00f2ff";

      // 텍스트 박스/배경 (반투명 블랙 또는 실린더 그라데이션)
      ctx.font = "bold 16px 'Inter', sans-serif";
      const txt = m.text;
      const tw = ctx.measureText(txt).width + 24;
      const th = 32;

      if (m.type === 'cylindrical') {
        // [신규] 실린더형 디자인: 좌우로 어두워지는 그라데이션으로 입체감 부여
        const grad3d = ctx.createLinearGradient(-tw / 2, 0, tw / 2, 0);
        grad3d.addColorStop(0, 'rgba(0, 0, 0, 0.9)');   // 왼쪽 어둠
        grad3d.addColorStop(0.2, 'rgba(20, 20, 30, 0.7)');
        grad3d.addColorStop(0.5, 'rgba(40, 60, 80, 0.5)'); // 중앙 밝음 (반사광)
        grad3d.addColorStop(0.8, 'rgba(20, 20, 30, 0.7)');
        grad3d.addColorStop(1, 'rgba(0, 0, 0, 0.9)');   // 오른쪽 어둠
        ctx.fillStyle = grad3d;

        // 약간 더 둥글게 처리 (실린더 느낌)
        roundRect(ctx, -tw / 2, -th / 2, tw, th, 15);
      } else {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        roundRect(ctx, -tw / 2, -th / 2, tw, th, 8);
      }
      ctx.fill();

      // 테두리 (네온 효과 강화)
      ctx.strokeStyle = m.color || "#00f2ff";
      ctx.lineWidth = m.type === 'cylindrical' ? 3 : 2;
      ctx.stroke();

      if (m.type === 'cylindrical') {
        // 실린더 상하단에 하이라이트 추가
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-tw / 2 + 10, -th / 2 + 2);
        ctx.lineTo(tw / 2 - 10, -th / 2 + 2);
        ctx.stroke();
      }

      // 실제 텍스트
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, 0, 0);

      ctx.restore();
    });
  }

  function gameLoop() {
    if (!state.isRunning) return;
    const now = Date.now();
    const dt = Math.min((now - state.lastFrameTime) / 1000, 0.1); // 초 단위 델타타임 (최대 0.1초 제한)
    state.lastFrameTime = now;

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
  }

  function resizeCanvas() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    // [v12.5] 원경 캔버스 동기화 스케일링
    if (bgCanvas) {
      bgCanvas.width = Math.round(w * dpr);
      bgCanvas.height = Math.round(h * dpr);
      bgCanvas.style.width = w + 'px';
      bgCanvas.style.height = h + 'px';
      if (bgCtx) bgCtx.scale(dpr, dpr);
    }

    state.vpW = w;
    state.vpH = h;
    if (ctx) ctx.scale(dpr, dpr);
  }

  /**
   * [v15.0] 모바일 가상 컨트롤러 엔진
   */
  function initMobileControls() {
    const zone = document.getElementById('joystick-zone');
    const base = document.getElementById('joystick-base');
    const stick = document.getElementById('joystick-stick');
    if (!zone) return;

    let dragging = false;
    const center = { x: 50, y: 50 }; // base 대비 중심 %

    const handleTouch = (e) => {
      e.preventDefault();
      dragging = true;
      const rect = base.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      // 중심점 기준 거리 및 각도 계산
      const dx = x - (rect.width / 2);
      const dy = y - (rect.height / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = rect.width / 2;

      const angle = Math.atan2(dy, dx);
      const clampedDist = Math.min(dist, maxDist);

      const stickX = (clampedDist * Math.cos(angle)) + (rect.width / 2);
      const stickY = (clampedDist * Math.sin(angle)) + (rect.height / 2);

      stick.style.left = `${stickX}px`;
      stick.style.top = `${stickY}px`;

      // 방향키 매핑 (8방향)
      const threshold = 15;
      state.keys['ArrowUp'] = dy < -threshold;
      state.keys['ArrowDown'] = dy > threshold;
      state.keys['ArrowLeft'] = dx < -threshold;
      state.keys['ArrowRight'] = dx > threshold;
    };

    const stopTouch = () => {
      dragging = false;
      stick.style.left = '50%';
      stick.style.top = '50%';
      state.keys['ArrowUp'] = false;
      state.keys['ArrowDown'] = false;
      state.keys['ArrowLeft'] = false;
      state.keys['ArrowRight'] = false;
    };

    zone.addEventListener('touchstart', handleTouch);
    zone.addEventListener('touchmove', handleTouch);
    zone.addEventListener('touchend', stopTouch);

    // 액션 버튼 리스너 - [S(점프), Z(슈퍼발사), X(일반발사), F(상호작용), 💬(채팅)]
    const btnS = document.getElementById('m-btn-s');
    const btnZ = document.getElementById('m-btn-z');
    const btnX = document.getElementById('m-btn-x');
    const btnF = document.getElementById('m-btn-f');
    const btnEnter = document.getElementById('m-btn-enter');

    // S 버튼: 스페이스바(Space) 점프 기능 바인딩
    if (btnS) {
      const startJump = (e) => {
        if (e) e.preventDefault();
        state.keys['Space'] = true;
      };
      const stopJump = (e) => {
        if (e) e.preventDefault();
        state.keys['Space'] = false;
      };
      btnS.addEventListener('touchstart', startJump, { passive: false });
      btnS.addEventListener('touchend', stopJump, { passive: false });
      btnS.addEventListener('touchcancel', stopJump, { passive: false });
      btnS.addEventListener('mousedown', startJump);
      btnS.addEventListener('mouseup', stopJump);
      btnS.addEventListener('mouseleave', stopJump);
    }

    // Z 버튼: 슈퍼 화염 발사
    if (btnZ) {
      btnZ.onclick = (e) => {
        if (e) e.preventDefault();
        if (state.avatar && state.avatar.canSuperFire) {
          startFireAction('flaming');
        }
      };
    }

    // X 버튼: 일반 발사
    if (btnX) {
      btnX.onclick = (e) => {
        if (e) e.preventDefault();
        if (state.avatar && state.avatar.canFire) {
          startFireAction('normal');
        }
      };
    }

    // F 버튼: 상호작용
    if (btnF) {
      btnF.onclick = (e) => {
        if (e) e.preventDefault();
        handleInteraction();
      };
    }

    // 💬(엔터) 버튼: 채팅 열기/전송
    if (btnEnter) {
      btnEnter.onclick = (e) => {
        if (e) e.preventDefault();
        if (state.isChatting) sendChat();
        else openChat();
      };
    }
  }

  /* ============================================================ 
   * [v10.0] 스마트 스크롤 & 홈페이지 데이터 렌더링
   * ============================================================ */

  function smoothScroll(targetId) {
    // [v26.1] 프로그램 관련 ID인 경우 슬라이더 인덱스 먼저 전환
    if (targetId.startsWith('program-')) {
      const slides = document.querySelectorAll('.program-slide');
      slides.forEach((s, idx) => {
        if (s.id === targetId) {
          switchProgram(idx);
        }
      });
      // 슬라이더를 돌린 후 페이지 스크롤 타겟은 프로그램 섹션으로 고정
      targetId = 'sec-programs';
    }

    const el = document.getElementById(targetId);
    if (!el) return;
    const headerOffset = 72; // GNB height
    const elementPosition = el.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }

  // GNB 스크롤 이벤트 감지
  window.addEventListener('scroll', () => {
    const header = document.getElementById('gnb');
    const topBtn = document.getElementById('scrollTopBtn');
    const sideDots = document.getElementById('side-dots-nav');
    const quickMenu = document.getElementById('quick-menu-nav');

    if (window.scrollY > 50) {
      header.classList.add('scrolled');
      if (topBtn) topBtn.classList.add('show');
      if (sideDots) sideDots.classList.add('visible');
      if (quickMenu) quickMenu.classList.add('visible');
    } else {
      header.classList.remove('scrolled');
      if (topBtn) topBtn.classList.remove('show');
      if (sideDots) sideDots.classList.remove('visible');
      if (quickMenu) quickMenu.classList.remove('visible');
    }

    // 좌측 점 네비게이터 Active 갱신 로직
    if (sideDots) {
      const SNAP_SECTIONS = [
        'sec-hero', 'sec-about', 'sec-notices', 'sec-hof',
        'sec-programs', 'sec-newsletter', 'sec-gallery'
      ];
      const viewMid = window.scrollY + window.innerHeight / 2;
      let bestIdx = 0;
      let bestDist = Infinity;
      SNAP_SECTIONS.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY;
        const mid = top + el.offsetHeight / 2;
        const dist = Math.abs(viewMid - mid);
        if (dist < bestDist) { bestDist = dist; bestIdx = idx; }
      });
      const dots = sideDots.querySelectorAll('.dot-item');
      dots.forEach((dot, idx) => {
        if (idx === bestIdx) dot.classList.add('active');
        else dot.classList.remove('active');
      });
    }
  });

  /* ============================================================
   * [v28.2] 섹션 휠 스냅 네비게이션 엔진
   * 마우스 휠 1회 = 다음/이전 섹션으로 부드럽게 이동
   * ============================================================ */
  (function initSectionSnapScroll() {
    // 스냅 대상 섹션 ID 순서 (히어로 포함)
    const SNAP_SECTIONS = [
      'sec-hero',
      'sec-about',
      'sec-notices',
      'sec-hof',
      'sec-programs',
      'sec-newsletter',  // [순서변경] 전자소식지가 갤러리 앞로
      'sec-gallery',     // [순서변경] 갤러리가 전자소식지 뒤로 (index 6)
      'sec-footer'
    ];

    let isScrolling = false;       // 스냅 이동 중 여부 (중복 이벤트 방지)
    const SCROLL_COOLDOWN = 900;   // 다음 스냅까지 대기 시간(ms) — 애니메이션 완료 고려
    const GNB_HEIGHT = 72;         // GNB 높이

    // 현재 가장 많이 보이는 섹션 인덱스 계산
    function getCurrentSectionIndex() {
      const viewMid = window.scrollY + window.innerHeight / 2;
      let bestIdx = 0;
      let bestDist = Infinity;
      SNAP_SECTIONS.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY;
        const mid = top + el.offsetHeight / 2;
        const dist = Math.abs(viewMid - mid);
        if (dist < bestDist) { bestDist = dist; bestIdx = idx; }
      });
      return bestIdx;
    }

    // 목표 섹션으로 스냅 이동
    function snapToSection(idx) {
      if (idx < 0 || idx >= SNAP_SECTIONS.length) return;
      const el = document.getElementById(SNAP_SECTIONS[idx]);
      if (!el) return;

      const targetTop = el.getBoundingClientRect().top + window.scrollY;
      // 히어로(첫 섹션)는 헤더 오프셋 없이 맨 위로
      const offset = idx === 0 ? 0 : GNB_HEIGHT;

      isScrolling = true;
      window.scrollTo({ top: targetTop - offset, behavior: 'smooth' });

      setTimeout(() => { isScrolling = false; }, SCROLL_COOLDOWN);
    }

    // 섹션 내부에 스크롤 가능한 요소가 있고 아직 끝에 닿지 않았으면 true
    function isSectionInternallyScrollable(el, direction) {
      // 게시판 테이블, 갤러리, 뉴스레터 그리드, 명예의 전당 뷰 등 내부 스크롤 감지
      const scrollables = el.querySelectorAll('.table-wrap, .gallery-full-container, .newsletter-grid, .hof-full-view');
      for (const s of scrollables) {
        const { scrollTop, scrollHeight, clientHeight } = s;
        if (direction > 0 && scrollTop + clientHeight < scrollHeight - 4) return true;
        if (direction < 0 && scrollTop > 4) return true;
      }
      return false;
    }

    // 휠 이벤트 핸들러
    function onWheel(e) {
      // 메타버스 월드가 활성화된 경우 스냅 비활성화
      const worldContainer = document.getElementById('world-container');
      if (worldContainer && worldContainer.style.display !== 'none') return;

      // 챗봇, 모달 등 오버레이 활성화 시 스냅 비활성화
      const openModal = document.querySelector('.modal-backdrop.open, .lightbox-modal.open');
      if (openModal) return;

      // [v34.16] 챗봇 사이드바 내부 스크롤 시 홈페이지 스냅 스크롤 방지
      const chatbotSidebar = document.getElementById('chatbot-sidebar');
      if (chatbotSidebar && chatbotSidebar.classList.contains('open')) {
        // 이벤트 타겟이 챗봇 사이드바 내부라면 홈페이지 스크롤 로직 중단
        if (chatbotSidebar.contains(e.target)) return;
      }

      const direction = e.deltaY > 0 ? 1 : -1;
      const currentIdx = getCurrentSectionIndex();

      // [순서변경 v34.11] 활동갤러리는 이제 index 6으로 이동 → 6 이상일 때 자연 스크롤 예외 적용
      if (currentIdx >= 6) {
        if (direction > 0) return; // 아래로 갈 때는 무조건 자연 스크롤

        // 위로 갈 때: 현재 위치가 갤러리 최상단보다 아래라면 자연 스크롤로 올라감
        const galleryEl = document.getElementById('sec-gallery');
        if (galleryEl && window.scrollY > galleryEl.offsetTop + 10) {
          return;
        }
      }

      if (isScrolling) {
        e.preventDefault();
        return;
      }

      const currentEl = document.getElementById(SNAP_SECTIONS[currentIdx]);

      // 현재 섹션 내부 스크롤이 아직 남아 있으면 자연 스크롤 허용
      if (currentEl && isSectionInternallyScrollable(currentEl, direction)) return;

      e.preventDefault();
      snapToSection(currentIdx + direction);
    }

    // passive: false 로 등록해야 preventDefault() 가 동작
    window.addEventListener('wheel', onWheel, { passive: false });

    // 외부에서 호출 가능하도록 전역 노출 (smoothScroll 연동)
    window.snapToSectionById = function (id) {
      const idx = SNAP_SECTIONS.indexOf(id);
      if (idx >= 0) snapToSection(idx);
    };
  })();





  // [v34.0] 활동갤러리 카테고리 버튼 렌더러 (순서 최적화: loadHomepageData보다 위로 이동)
  const GALLERY_CATEGORIES = ['전체', '일상생활', '교육/재활', '야외활동', '행사/이벤트', '나눔/소통'];
  window.currentGalleryCategory = GALLERY_CATEGORIES[0]; // '전체'로 초기화

  function renderGalleryCategoryButtons() {
    const navTarget = document.getElementById('gallery-nav-target');
    if (!navTarget) return;

    let html = '';
    GALLERY_CATEGORIES.forEach(cat => {
      // [v34.13] 문자열 공백 제거 후 비교 (안정성 강화)
      const activeClass = (cat.trim() === window.currentGalleryCategory.trim()) ? 'active' : '';
      html += `<button class="a-nav-btn ${activeClass}" onclick="switchGalleryCategory('${cat}')">${cat}</button>`;
    });
    navTarget.innerHTML = html;
  }

  function switchGalleryCategory(cat) {
    window.currentGalleryCategory = cat;
    renderGalleryCategoryButtons(); // 버튼 상태 업데이트

    const searchInput = document.getElementById('gallery-search-input');
    if (searchInput) searchInput.value = '';

    filterGallery();
  }

  // 애니메이션 관찰자 (섹션 페이드인)
  const animObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  function loadHomepageData() {
    // [v34.0] 갤러리/공지사항 카테고리 버튼 초기화 (데이터 로드 전 선제 렌더링)
    if (typeof renderGalleryCategoryButtons === 'function') renderGalleryCategoryButtons();
    if (typeof renderNoticeCategoryButtons === 'function') renderNoticeCategoryButtons();

    // 1. 페이지 로드 애니메이션 등록
    document.querySelectorAll('.page-section').forEach(sec => animObserver.observe(sec));
    const overlayContent = document.querySelector('.overlay-content');
    if (overlayContent) setTimeout(() => overlayContent.classList.add('fade-visible'), 100);

    // 2. 공지사항 / 갤러리 / 전자소식지 로드 (스피너 없이 배경에서 로드)
    if (typeof google !== 'undefined' && google.script) {
      google.script.run.withSuccessHandler(renderNotices).getNoticeList();
      google.script.run.withSuccessHandler(initGallery).getGalleryImages();
      google.script.run.withSuccessHandler(renderNewsletter).getNewsletterList();
      google.script.run.withSuccessHandler(renderAboutUs).getAboutUsList();
      google.script.run.withSuccessHandler(renderPrograms).getProgramsList();
      google.script.run.withSuccessHandler(renderHallOfFame).getHallOfFameList(); // [명예의전당 로드]
    }
  }

  // ── [신규] 명예의 전당 렌더링 (v33.0)
  let currentHofCategory = null;
  let allHofData = null;
  let currentHofIdx = 0; // [v33.0] 애니메이션 방향 판별용

  function renderHallOfFame(data) {
    if (!data) return;
    allHofData = data;

    const navTarget = document.getElementById('hof-nav-target');
    if (!navTarget) return;

    // 카테고리 탭 생성 (J열 분류 기반)
    let navHtml = '';
    const categories = data.categories || [];

    // 기본적으로 첫 번째 카테고리 선택
    if (!currentHofCategory && categories.length > 0) {
      currentHofCategory = categories[0];
      currentHofIdx = 0;
    }

    categories.forEach((cat, idx) => {
      const activeClass = (cat === currentHofCategory) ? 'active' : '';
      navHtml += `<button class="a-nav-btn ${activeClass}" onclick="switchHof('${cat}', ${idx})">${cat}</button>`;
    });
    navTarget.innerHTML = navHtml;

    // 메인 뷰 렌더링
    updateHofView();
  }

  function switchHof(category, newIdx) {
    currentHofIdx = newIdx;
    currentHofCategory = category;

    // 1. 버튼 활성화 상태 업데이트
    const btns = document.querySelectorAll('#hof-nav-target .a-nav-btn');
    btns.forEach((btn, i) => btn.classList.toggle('active', i === newIdx));

    // 2. 데이터 즉시 업데이트 (애니메이션 삭제)
    updateHofView();
  }

  function updateHofView() {
    const mainView = document.getElementById('hof-main-view');
    if (!mainView || !allHofData) return;

    // [v33.3] 국장님 오더: 기업 4열(이미지), 개인 3열(이름만) 분기
    const filtered = allHofData.allItems.filter(item => item.category === currentHofCategory);
    const isIndividual = currentHofCategory.includes('개인') || currentHofCategory.includes('정기');
    const colCount = isIndividual ? 9 : 4;

    let html = `<div class="hof-ticker-container cols-${colCount}" id="hof-grid-grid">`;

    if (filtered.length === 0) {
      html += `<p style="grid-column: span ${colCount}; text-align:center; padding:100px; color:#888;">등록된 데이터가 없습니다.</p>`;
    } else {
      for (let col = 0; col < colCount; col++) {
        const colItems = filtered.filter((_, idx) => idx % colCount === col);

        if (colItems.length === 0) {
          html += `<div class="hof-ticker-track track-${col + 1}"></div>`;
          continue;
        }

        // 무한 루프 렌더링용 복제 (개인은 더 촘촘하게)
        let displayItems = [...colItems];
        while (displayItems.length < (isIndividual ? 15 : 10)) {
          displayItems = [...displayItems, ...colItems];
        }
        displayItems = [...displayItems, ...displayItems];

        // [v33.4] 국장님 오더: 개인 후원자 배경 이미지 5종 (Thumbnail 방식으로 안정성 강화)
        const nameBgs = [
          'https://drive.google.com/thumbnail?id=1z1tiTy4bVmU70X2OGpHe6wE4QInVh-uY&sz=w1000',
          'https://drive.google.com/thumbnail?id=1_wkRywF7IpOK8f7sPpV13as4G-Spzw4h&sz=w1000',
          'https://drive.google.com/thumbnail?id=1163EvMgfYMzcikn4P2DnACsyGlh1J3aL&sz=w1000',
          'https://drive.google.com/thumbnail?id=1pIdz3-ilr17PIKVUv2ACMbtlpwsRMSUK&sz=w1000',
          'https://drive.google.com/thumbnail?id=1kbVPj4uxkJglNQq7vpEw6ZnLPKwdOpzv&sz=w1000'
        ];

        html += `<div class="hof-ticker-track track-${col + 1}">`;
        displayItems.forEach((item, idx) => {
          if (isIndividual) {
            // 개인 후원자: 이름 + 랜덤 배경 (인덱스 기반 분산)
            const bgUrl = nameBgs[(idx + col) % nameBgs.length];
            html += `<div class="hof-ticker-item name-only" style="background-image: url('${bgUrl}');">${item.name}</div>`;
          } else {
            // 기업 후원자: 이미지 카드 노출
            const linkAttr = item.link ? `onclick="window.open('${item.link}', '_blank')"` : '';
            const logoUrl = item.logoUrl || 'https://via.placeholder.com/300x150?text=Lighthouse';
            html += `
              <div class="hof-ticker-item" ${linkAttr}>
                <img src="${logoUrl}" alt="${item.name}">
              </div>
            `;
          }
        });
        html += `</div>`;
      }
    }

    html += `</div>`;
    mainView.innerHTML = html;
  }

  // ── 갤러리 데이터 및 더보기 상태
  let ALL_GALLERY_DATA = [];
  let FILTERED_GALLERY_DATA = [];
  let galleryItemsToShow = 20;

  function initGallery(data) {
    ALL_GALLERY_DATA = data || [];
    FILTERED_GALLERY_DATA = [...ALL_GALLERY_DATA];
    renderGallery();
  }

  function renderGallery() {
    const grid = document.getElementById('gallery-grid');
    const moreBtnContainer = document.getElementById('gallery-more-container');
    if (!grid) return;

    if (FILTERED_GALLERY_DATA.length === 0) {
      grid.innerHTML = `
        <div class="no-result-container">
          <p>검색 결과가 없거나 등록된 사진이 없습니다.</p>
          <small>다른 검색어를 입력해 보세요.</small>
        </div>
      `;
      if (moreBtnContainer) moreBtnContainer.style.display = 'none';
      return;
    }

    const itemsToDisplay = FILTERED_GALLERY_DATA.slice(0, galleryItemsToShow);
    let html = '';

    const now = new Date(); // [신규] 시간 비교용 현재 시간

    itemsToDisplay.forEach((item, idx) => {
      let titleSafe = item.name ? item.name.replace(/'/g, "\\'") : '';
      let dateSafe = item.date ? item.date.replace(/'/g, "\\'") : '';

      // [신규] 24시간 내 등록(NEW) 뱃지 로직
      let isNewGallery = false;
      if (item.date) {
        const postDate = new Date(item.date);
        const diff = now - postDate;
        // 등록일 기준 7일(일주일) 이내면 true
        if (diff > 0 && diff < 7 * 24 * 60 * 60 * 1000) {
          isNewGallery = true;
        }
      }
      const newBadgeHtml = isNewGallery ? '<div class="gallery-new-badge">NEW</div>' : '';

      html += `
        <div class="gallery-item" onclick="openLightbox('${item.url}', '${titleSafe}', '${dateSafe}', ${idx})">
          ${newBadgeHtml}
          <img src="${item.url}" loading="lazy" alt="Gallery Image">
          <div class="gallery-overlay">
            <div class="gallery-title-text">${item.name}</div>
            <div class="gallery-date-text">${item.date}</div>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;

    // 더보기 버튼 노출 여부 결정
    if (moreBtnContainer) {
      if (galleryItemsToShow < FILTERED_GALLERY_DATA.length) {
        moreBtnContainer.style.display = 'block';
      } else {
        moreBtnContainer.style.display = 'none';
      }
    }
  }

  function loadMorePhotos() {
    galleryItemsToShow += 20;
    renderGallery();
  }

  function filterGallery() {
    const keyword = (document.getElementById('gallery-search-input').value || '').toLowerCase().trim();
    galleryItemsToShow = 20; // 검색 시 처음부터 다시 보여줌

    let baseData = [...ALL_GALLERY_DATA];

    // [v34.4] 카테고리 필터 (H열 기준)
    if (window.currentGalleryCategory && window.currentGalleryCategory !== '전체') {
      baseData = baseData.filter(item => (item.category || '').includes(window.currentGalleryCategory));
    }

    if (!keyword) {
      FILTERED_GALLERY_DATA = baseData;
    } else {
      FILTERED_GALLERY_DATA = baseData.filter(item => {
        const title = (item.name || '').toLowerCase();
        const date = (item.date || '').toLowerCase();
        return title.includes(keyword) || date.includes(keyword);
      });
    }
    renderGallery();
  }

  /* 카테고리 렌더러 이동됨 */

  // [v34.0] GNB 메가메뉴 전용 명예의 전당 이름으로 찾기
  function switchHofByName(catName) {
    if (!allHofData || !allHofData.categories) return;
    const targetIdx = allHofData.categories.findIndex(c => c.includes(catName));
    if (targetIdx > -1) {
      switchHof(allHofData.categories[targetIdx], targetIdx);
    }
  }

  // [v34.0] GNB 메가메뉴 전용 프로그램 전환
  function switchProgram(idx) {
    if (typeof window.switchPrograms === 'function') {
      window.switchPrograms(idx);
    }
  }

  // ── 기관소개 렌더링 (v27.0 - 프리미엄 슬라이더)
  let currentAboutIndex = 0;
  window._aboutData = []; // GNB 드롭다운 연동용

  function renderAboutUs(data) {
    const container = document.getElementById('about-us-content');
    if (!container) return;
    if (!data || data.length === 0) {
      container.innerHTML = '<p style="padding:60px; color:#888; text-align:center;">등록된 기관소개 내용이 없습니다.</p>';
      return;
    }

    window._aboutData = data; // 탭 연동용 전역 저장

    // 1. 탭 네비게이션 버튼 생성 (target div 가 있으면 거기에)
    const navTarget = document.getElementById('about-nav-target');
    let navHtml = '';
    data.forEach((item, idx) => {
      navHtml += `<button class="a-nav-btn ${idx === currentAboutIndex ? 'active' : ''}" onclick="switchAbout(${idx})">${item.title}</button>`;
    });

    if (navTarget) navTarget.innerHTML = navHtml;

    // 2. 슬라이더 윈도우 생성
    let sliderHtml = `
      <div class="about-window">
        <div id="about-slider" class="about-slider">
    `;

    data.forEach((item, idx) => {
      let imageUrl = item.imageUrl ? item.imageUrl.trim() : '';
      let isEmbed = false;

      // URL 파싱 (canva / drive)
      if (imageUrl.includes('canva.link/')) {
        const m = imageUrl.match(/canva\.link\/([-\w]+)/);
        if (m) imageUrl = "https://www.canva.com/design/" + m[1] + "/view?embed";
        isEmbed = true;
      } else if (imageUrl.includes('drive.google.com')) {
        const m = imageUrl.match(/[-\w]{25,}/);
        if (m) imageUrl = "https://drive.google.com/thumbnail?id=" + m[0] + "&sz=w1200";
      } else if (imageUrl.includes('canva.com') || imageUrl.includes('/view?embed')) {
        isEmbed = true;
      }

      let mediaHtml = '';
      if (imageUrl) {
        if (isEmbed) {
          mediaHtml = `<div class="a-media-frame about-iframe-wrap"><iframe src="${imageUrl}" allowfullscreen="allowfullscreen" allow="fullscreen"></iframe></div>`;
        } else {
          mediaHtml = `<div class="a-media-frame"><img src="${imageUrl}"></div>`;
        }
      }

      // 텍스트 내용 (이미지 아래 표시)
      const textHtml = item.content
        ? `<div class="a-card-text">${item.content}</div>`
        : '';

      const subId = 'about-' + (item.title || '').replace(/\s+/g, '');
      sliderHtml += `
        <div id="${subId}" class="about-slide ${idx === currentAboutIndex ? 'active' : ''}">
          <div class="a-card-content">
            ${mediaHtml}
            ${textHtml}
          </div>
        </div>
      `;
    });

    sliderHtml += `</div></div>`;
    container.innerHTML = (navTarget ? '' : `<div class="about-nav">${navHtml}</div>`) + sliderHtml;

    // 초기 배치
    setTimeout(() => {
      switchAbout(currentAboutIndex);
      window.removeEventListener('resize', reCenterAbout);
      window.addEventListener('resize', reCenterAbout);
    }, 200);
  }

  function reCenterAbout() {
    switchAbout(currentAboutIndex);
  }

  // 슬라이드 전환 로직
  function switchAbout(index) {
    const slides = document.querySelectorAll('.about-slide');
    const btns = document.querySelectorAll('.a-nav-btn');
    if (slides.length === 0) return;

    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;

    currentAboutIndex = index;

    btns.forEach((btn, i) => btn.classList.toggle('active', i === index));
    slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
  }

  function moveAbout(delta) {
    switchAbout(currentAboutIndex + delta);
  }

  // GNB 드롭다운 연동 — 해당 탭으로 스크롤 + 슬라이드 전환
  function scrollToAboutTab(titleKey) {
    smoothScroll('sec-about');
    const doSwitch = () => {
      if (!window._aboutData || window._aboutData.length === 0) return;
      const idx = window._aboutData.findIndex(item =>
        (item.title || '').replace(/\s+/g, '') === titleKey.replace(/\s+/g, '')
      );
      if (idx >= 0) switchAbout(idx);
    };
    // 스크롤 후 약간 지연하여 슬라이드 전환
    setTimeout(doSwitch, 400);
  }

  /**
   * [v31.0] 공지사항 페이지네이션 렌더러 (9단위 블록 방식)
   * 국장님 오더: 그룹당 9개 페이지 노출 + 좌우 화살표 9칸 이동
   */
  function renderNoticePagination(totalItems) {
    const wrap = document.getElementById('notice-pagination');
    if (!wrap) return;

    const totalPages = Math.ceil(totalItems / noticeItemsPerPage);
    if (totalPages <= 1) {
      wrap.innerHTML = '';
      return;
    }

    // 9개 단위의 블록 계산
    const PAGE_BLOCK_SIZE = 9;
    const currentBlock = Math.floor((noticeCurrentPage - 1) / PAGE_BLOCK_SIZE);
    const startPage = currentBlock * PAGE_BLOCK_SIZE + 1;
    const endPage = Math.min(startPage + PAGE_BLOCK_SIZE - 1, totalPages);

    let html = '<div class="pagination-inner" style="display:flex; align-items:center; gap:5px;">';

    // [이전] 버튼
    if (startPage > 1) {
      html += `<button class="page-btn arrow" onclick="changeNoticePage(${startPage - 1})">◀</button>`;
    }

    // [숫자] 버튼
    for (let i = startPage; i <= endPage; i++) {
      const activeClass = (i === noticeCurrentPage) ? 'active' : '';
      html += `<button class="page-btn num ${activeClass}" onclick="changeNoticePage(${i})">${i}</button>`;
    }

    // [다음] 버튼
    if (endPage < totalPages) {
      html += `<button class="page-btn arrow" onclick="changeNoticePage(${endPage + 1})">▶</button>`;
    }

    html += '</div>';
    wrap.innerHTML = html;
  }

  function changeNoticePage(p) {
    noticeCurrentPage = p;
    displayNoticePage(p);
    // 페이지 변경 시 섹션 상단으로 부드럽게 스크롤 (필요시)
    // const sec = document.getElementById('sec-notices');
    // if(sec) sec.scrollIntoView({ behavior: 'smooth' });
  }

  // ── 프로그램 렌더링 (v26.0)
  // ── 프로그램 렌더링 (v26.0 - 프리미엄 슬라이더)
  let currentProgramIndex = 0;

  function renderPrograms(data) {
    const container = document.getElementById('programs-content');
    if (!container) return;
    if (!data || data.length === 0) {
      container.innerHTML = '<p style="padding:60px; color:#888; text-align:center;">등록된 프로그램 내용이 없습니다.</p>';
      return;
    }

    // 1. 네비게이션 버튼 생성 (상단 중앙 타겟 전용)
    const navTarget = document.getElementById('programs-nav-target');
    let navHtml = '';
    data.forEach((item, idx) => {
      navHtml += `<button class="p-nav-btn ${idx === currentProgramIndex ? 'active' : ''}" onclick="switchProgram(${idx})">${item.title}</button>`;
    });

    if (navTarget) navTarget.innerHTML = navHtml;

    // 2. 슬라이더 윈도우 및 슬라이더 생성
    let sliderHtml = `
      <div class="programs-window">
        <div class="p-arrow prev" onclick="moveProgram(-1)">‹</div>
        <div class="p-arrow next" onclick="moveProgram(+1)">›</div>
        <div id="programs-slider" class="programs-slider">
    `;

    data.forEach((item, idx) => {
      let imageUrl = item.imageUrl ? item.imageUrl.trim() : '';
      let isEmbed = false;

      if (imageUrl.includes('canva.link/')) {
        const canvaCodeMatch = imageUrl.match(/canva\.link\/([-\w]+)/);
        if (canvaCodeMatch) imageUrl = "https://www.canva.com/design/" + canvaCodeMatch[1] + "/view?embed";
        isEmbed = true;
      } else if (imageUrl.includes('drive.google.com')) {
        const driveIdMatch = imageUrl.match(/[-\w]{25,}/);
        if (driveIdMatch) imageUrl = "https://drive.google.com/thumbnail?id=" + driveIdMatch[0] + "&sz=w1200";
      } else if (imageUrl.includes('canva.com') || imageUrl.includes('/view?embed')) {
        isEmbed = true;
      }

      let mediaHtml = '';
      if (imageUrl) {
        if (isEmbed) {
          mediaHtml = `<div class="p-media-frame about-iframe-wrap"><iframe src="${imageUrl}" allowfullscreen="allowfullscreen" allow="fullscreen"></iframe></div>`;
        } else {
          mediaHtml = `<div class="p-media-frame"><img src="${imageUrl}" style="width:100%; display:block;"></div>`;
        }
      }

      const subId = 'program-' + (item.title || '').replace(/\s+/g, '');
      sliderHtml += `
        <div id="${subId}" class="program-slide ${idx === currentProgramIndex ? 'active' : ''}">
          <div class="p-card-content">
            <div class="p-card-info">
              <h3 class="p-card-title">${item.title}</h3>
            </div>
            <div class="p-card-media">
              ${mediaHtml}
            </div>
            <div class="p-card-info">
              <div class="p-card-desc">${item.content}</div>
            </div>
          </div>
        </div>
      `;
    });

    sliderHtml += `</div></div>`;
    container.innerHTML = sliderHtml;

    // 초기 정렬 (중앙 배치)
    setTimeout(() => {
      switchProgram(currentProgramIndex);
      // 창 크기 조절 시 리밸런싱
      window.removeEventListener('resize', reCenterSlider);
      window.addEventListener('resize', reCenterSlider);
    }, 200);
  }

  function reCenterSlider() {
    switchProgram(currentProgramIndex);
  }

  // 슬라이드 전환 로직
  function switchProgram(index) {
    const slides = document.querySelectorAll('.program-slide');
    const btns = document.querySelectorAll('.p-nav-btn');
    if (slides.length === 0) return;

    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;

    currentProgramIndex = index;

    btns.forEach((btn, i) => btn.classList.toggle('active', i === index));
    slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
  }

  function moveProgram(delta) {
    switchProgram(currentProgramIndex + delta);
  }


  // ── 공지사항 데이터 및 페이지네이션 상태
  let ALL_NOTICES_DATA = [];
  let noticeCurrentPage = 1;
  const NOTICE_PAGE_SIZE = 11;

  function renderNotices(data) {
    const tbody = document.getElementById('notice-tbody');
    if (!tbody) return;
    if (!data || data.length === 0) {
      let html = '<tr><td colspan="5" class="loading-cell" style="padding:40px;">등록된 공지사항이 없습니다.</td></tr>';
      const emptyRowsCount = NOTICE_PAGE_SIZE - 1;
      for (let i = 0; i < emptyRowsCount; i++) {
        html += `
          <tr style="cursor: default;">
            <td style="color:rgba(255,255,255,0.1);">-</td>
            <td style="color:rgba(255,255,255,0.1);">-</td>
            <td></td>
            <td style="color:rgba(255,255,255,0.1);">-</td>
            <td style="color:rgba(255,255,255,0.1);">-</td>
          </tr>
        `;
      }
      tbody.innerHTML = html;
      document.getElementById('notice-pagination').innerHTML = '';
      return;
    }

    // [정렬 로직] 중요공지(isPinned) true인 것을 최상단으로, 그 다음은 날짜 역순(num 기준)
    const sortedData = [...data].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.num - a.num; // 동일 조건이면 num(최신행)이 큼 = 위로
    });

    ALL_NOTICES_DATA = sortedData;
    currentNoticeCategory = NOTICE_CATEGORIES[0]; // '전체'로 초기화 강제 (배열 참조)

    // [v28.0] 공지사항 카테고리 버튼 생성
    renderNoticeCategoryButtons();

    FILTERED_NOTICES_DATA = [...ALL_NOTICES_DATA]; // 초기 필터용 데이터 설정
    displayNoticePage(1);

    // [v30.0] 평택대 스타일 이미지 팝업 엔진 실행 (독립 연동)
    initMainNoticePopup();
  }

  // [v28.0] 공지사항 카테고리 버튼 렌더러
  const NOTICE_CATEGORIES = ['전체', '채용공고', '입찰/계약', '운영/행정', '교육/프로그램', '소식/홍보'];
  let currentNoticeCategory = NOTICE_CATEGORIES[0]; // '전체'로 초기화
  function renderNoticeCategoryButtons() {
    const navTarget = document.getElementById('notice-nav-target');
    if (!navTarget) return;

    let html = '';
    NOTICE_CATEGORIES.forEach(cat => {
      // [v34.13] 문자열 공백 제거 후 비교 (안정성 강화)
      const activeClass = (cat.trim() === currentNoticeCategory.trim()) ? 'active' : '';
      html += `<button class="a-nav-btn ${activeClass}" onclick="switchNoticeCategory('${cat}')">${cat}</button>`;
    });
    navTarget.innerHTML = html;
  }

  function switchNoticeCategory(cat) {
    currentNoticeCategory = cat;
    renderNoticeCategoryButtons();
    filterNotices(); // 카테고리 변경 시 필터 즉시 적용
  }

  // [v28.0] 공지사항 검색 필터 (카테고리 + 검색어 병합)
  let FILTERED_NOTICES_DATA = [];
  function filterNotices() {
    const searchInput = document.getElementById('notice-search-input');
    const keyword = (searchInput ? searchInput.value : '').toLowerCase().trim();

    FILTERED_NOTICES_DATA = ALL_NOTICES_DATA.filter(item => {
      // 1. 카테고리 필터 (C열 'type' 필드 기준)
      const matchCategory = (currentNoticeCategory === '전체') || (item.type === currentNoticeCategory);

      // 2. 검색어 필터
      const matchKeyword = !keyword ||
        (item.title || '').toLowerCase().includes(keyword) ||
        (item.content || '').toLowerCase().includes(keyword);

      return matchCategory && matchKeyword;
    });

    noticeCurrentPage = 1;
    displayNoticePage(1);
  }

  function displayNoticePage(page) {
    noticeCurrentPage = page;
    const tbody = document.getElementById('notice-tbody');
    if (!tbody) return;

    const start = (page - 1) * NOTICE_PAGE_SIZE;
    const end = start + NOTICE_PAGE_SIZE;
    const pagedData = FILTERED_NOTICES_DATA.slice(start, end);

    if (pagedData.length === 0) {
      let html = '<tr><td colspan="5" style="padding:40px; color:#888;">검색 결과가 없습니다.</td></tr>';
      // [v34.4] 결과가 0개여도 높이 고정 (1칸은 안내문구, 나머지 10칸 빈칸)
      const emptyRowsCount = NOTICE_PAGE_SIZE - 1;
      for (let i = 0; i < emptyRowsCount; i++) {
        html += `
          <tr style="cursor: default;">
            <td style="color:rgba(255,255,255,0.1);">-</td>
            <td style="color:rgba(255,255,255,0.1);">-</td>
            <td></td>
            <td style="color:rgba(255,255,255,0.1);">-</td>
            <td style="color:rgba(255,255,255,0.1);">-</td>
          </tr>
        `;
      }
      tbody.innerHTML = html;
      return;
    }

    let html = '';
    const now = new Date();

    pagedData.forEach((item, idx) => {
      const realIdx = ALL_NOTICES_DATA.indexOf(item); // 현재 페이지 내 인덱스를 전체 배열 기준 인덱스로 변환
      const isUrgent = item.type === '긴급' || item.isPinned;
      const rowClass = item.isPinned ? 'notice-important-row' : '';
      const colorStyle = 'color: #333333;'; // 국장님 오더: Bright Mode 적용에 맞춰 구분열(카테고리) 텍스트를 검정 계열로 통일

      // [NEW] 정확한 7일(일주일) 체크
      let isNewPost = false;
      if (item.date) {
        const postDate = new Date(item.date);
        const diff = now - postDate;
        if (diff > 0 && diff < 7 * 24 * 60 * 60 * 1000) isNewPost = true;
      }

      // 중요공지 및 NEW 뱃지 조합
      const pinnedTag = item.isPinned ? '<span class="badge-important">중요</span>' : '';
      const newTag = isNewPost ? '<span class="badge-new">NEW</span>' : '';

      html += `
        <tr class="${rowClass}" onclick="openNoticeDetail(${realIdx})">
          <td>${item.isPinned ? '📌' : item.num}</td>
          <td><span class="category-badge" style="${colorStyle}">${item.type}</span></td>
          <td style="text-align:left; padding-left:15px;">
            ${pinnedTag}${item.title}${newTag}
          </td>
          <td>${item.date.split(' ')[0]}</td>
          <td>${item.attachment ? '<span class="badge-file">FILE</span>' : '-'}</td>
        </tr>
      `;
    });

    // [v34.4] 국장님 오더: 데이터가 11개(NOTICE_PAGE_SIZE) 미만일 경우 빈 행을 추가하여 표 높이 고정 유지
    const emptyRowsCount = NOTICE_PAGE_SIZE - pagedData.length;
    for (let i = 0; i < emptyRowsCount; i++) {
      html += `
        <tr style="cursor: default;">
          <td style="color:rgba(255,255,255,0.1);">-</td>
          <td style="color:rgba(255,255,255,0.1);">-</td>
          <td></td>
          <td style="color:rgba(255,255,255,0.1);">-</td>
          <td style="color:rgba(255,255,255,0.1);">-</td>
        </tr>
      `;
    }

    tbody.innerHTML = html;
    renderNoticePagination();
  }

  /**
   * [v31.1] 공지사항 페이지네이션 렌더러 (9단위 블록 방식)
   * 국장님 오더: 그룹당 9개 페이지 노출 + 좌우 화살표 9칸 이동
   */
  function renderNoticePagination() {
    const paginContainer = document.getElementById('notice-pagination');
    if (!paginContainer) return;

    const totalPages = Math.ceil(FILTERED_NOTICES_DATA.length / NOTICE_PAGE_SIZE);
    if (totalPages <= 1) {
      paginContainer.innerHTML = '';
      return;
    }

    // 9개 단위의 블록 계산
    const PAGE_BLOCK_SIZE = 9;
    const currentBlock = Math.floor((noticeCurrentPage - 1) / PAGE_BLOCK_SIZE);
    const startPage = currentBlock * PAGE_BLOCK_SIZE + 1;
    const endPage = Math.min(startPage + PAGE_BLOCK_SIZE - 1, totalPages);

    let html = '<div class="pagination-inner" style="display:flex; align-items:center; justify-content:center; gap:8px;">';

    // [이전] 버튼 (◀)
    if (startPage > 1) {
      html += `<button class="page-num-btn arrow" onclick="displayNoticePage(${startPage - 1})">◀</button>`;
    }

    // [숫자] 버튼
    for (let i = startPage; i <= endPage; i++) {
      const activeClass = (i === noticeCurrentPage) ? 'active' : '';
      html += `<button class="page-num-btn ${activeClass}" onclick="displayNoticePage(${i})">${i}</button>`;
    }

    // [다음] 버튼 (▶)
    if (endPage < totalPages) {
      html += `<button class="page-num-btn arrow" onclick="displayNoticePage(${endPage + 1})">▶</button>`;
    }

    html += '</div>';
    paginContainer.innerHTML = html;
  }

  // 공지 상세 팝업 열기
  function openNoticeDetail(idx) {
    const item = ALL_NOTICES_DATA[idx];
    if (!item) return;
    const modal = document.getElementById('noticeDetailModal');
    if (!modal) return;
    document.getElementById('nDetail-title').innerText = item.title || '제목 없음';
    document.getElementById('nDetail-meta').innerText = '구분: ' + (item.type || '-') + ' | 게시일: ' + (item.date || '-');
    document.getElementById('nDetail-content').innerText = item.content || '상세 내용이 없습니다.';
    const attachEl = document.getElementById('nDetail-attachment');
    if (item.attachment && item.attachment !== 'null' && item.attachment !== '') {
      const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(item.attachment) || item.attachment.indexOf('lh3.googleusercontent') >= 0;
      if (isImg) {
        attachEl.innerHTML = `<hr style="margin:20px 0; border-color:#eee"><img src="${item.attachment}" style="max-width:100%; border-radius:12px; margin-top:10px;">`;
      } else {
        attachEl.innerHTML = `<hr style="margin:20px 0; border-color:#eee"><a href="${item.attachment}" target="_blank" style="color:var(--jh-blue); font-weight:700;">📎 첨부 파일 다운로드</a>`;
      }
    } else { attachEl.innerHTML = ''; }
    openModal('noticeDetailModal');
  }

  // 공지 등록 제출 (23번 방식)
  function submitNotice() {
    const title = document.getElementById('nWrite-title').value.trim();
    const category = document.getElementById('nWrite-category').value;
    const content = document.getElementById('nWrite-content').value.trim();
    const fileInput = document.getElementById('nWrite-attachment');
    if (!title) return alert('제목을 입력해주세요.');

    toggleGlobalLoader(true, '공지사항을 안전하게 등록 중입니다...');

    function doSubmit(attachUrl) {
      if (typeof google !== 'undefined' && google.script) {
        google.script.run
          .withSuccessHandler(() => {
            toggleGlobalLoader(false);
            closeModal('writeNoticeModal');
            document.getElementById('nWrite-title').value = '';
            document.getElementById('nWrite-content').value = '';
            document.getElementById('nWrite-attachment').value = '';
            google.script.run.withSuccessHandler(renderNotices).getNoticeList();
            alert('✅ 공지사항이 등록되었습니다.');
          })
          .withFailureHandler(err => {
            toggleGlobalLoader(false);
            alert('❌ 등록 실패: ' + err.message);
          })
          .appendNotice({ type: category, title: title, content: content, attachment: attachUrl || '' });
      }
    }

    if (fileInput && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = e => {
        if (typeof google !== 'undefined' && google.script) {
          google.script.run
            .withSuccessHandler(res => {
              if (res && res.url) doSubmit(res.url);
              else doSubmit('');
            })
            .withFailureHandler(err => {
              toggleGlobalLoader(false);
              alert('❌ 파일 업로드 에러: ' + err.message);
            })
            .uploadAttachment({ data: e.target.result.split(',')[1], name: file.name, mimeType: file.type });
        }
      };
      reader.readAsDataURL(file);
    } else { doSubmit(''); }
  }

  /* [이전 renderGallery 함수는 제거됨 - 상단 initGallery/renderGallery로 통합됨] */

  // [전자소식지] 렌더링 (세로형 그리드 방식 복구)
  let ALL_NEWSLETTER_DATA = [];
  function renderNewsletter(data) {
    if (data) ALL_NEWSLETTER_DATA = data;
    renderNewsletterUI();
  }

  function renderNewsletterUI() {
    const grid = document.getElementById('newsletter-grid');
    if (!grid) return;

    if (ALL_NEWSLETTER_DATA.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1; color:#888; padding:100px; text-align:center;">등록된 전자소식지가 없습니다.</div>';
      return;
    }

    let html = '';
    ALL_NEWSLETTER_DATA.forEach(item => {
      let thumbUrl = item.thumbUrl || '';
      if (thumbUrl.includes('drive.google.com')) {
        const idMatch = thumbUrl.match(/[-\w]{25,}/);
        if (idMatch) thumbUrl = "https://drive.google.com/thumbnail?id=" + idMatch[0] + "&sz=w600";
      }

      html += `
        <a class="newsletter-card" href="${item.link || '#'}" target="_blank">
          <div class="newsletter-thumb">
            <img src="${thumbUrl}" alt="${item.title}" loading="lazy">
            <div class="newsletter-overlay"><span class="nl-view-btn">VIEW</span></div>
          </div>
          <div class="newsletter-info">
            <div class="newsletter-title" title="${item.title}">${item.title}</div>
            <div class="newsletter-date">${item.date}</div>
          </div>
        </a>
      `;
    });
    grid.innerHTML = html;
  }

  // ── [신규] 챗봇 기능 로직
  function toggleChatbot() {
    const sidebar = document.getElementById('chatbot-sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  }

  // [국장님 오더] 챗봇 창 외부 클릭 시 닫기
  window.addEventListener('mousedown', function (e) {
    const sidebar = document.getElementById('chatbot-sidebar');
    const trigger = document.getElementById('chatbot-trigger');

    // 사이드바가 열려있고, 클릭한 대상이 사이드바 내부가 아니며, 트리거 버튼도 아닐 때 닫기
    if (sidebar && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target) && !trigger.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    }
  });

  function sendChatMessage() {
    const input = document.getElementById('chatbot-input');
    const msg = input.value.trim();
    if (!msg) return;

    appendChat('user', msg);
    input.value = '';

    // [국장님 오더] 백엔드 AI 연동 (지침서 기반 답변 + 생각 중 인디케이터)
    const loadingId = 'bot-loading-' + Date.now();
    const typingIndicator = `
      <div id="${loadingId}" class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    appendChat('bot', typingIndicator, true); // 세 번째 인자로 로딩 여부 전달

    google.script.run
      .withSuccessHandler(function (response) {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) {
          const bubble = loadingEl.parentElement;
          bubble.classList.remove('loading-bubble'); // 로딩 클래스 제거
          bubble.innerHTML = response;
        }
      })
      .withFailureHandler(function (err) {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) {
          const bubble = loadingEl.parentElement;
          bubble.classList.remove('loading-bubble'); // 로딩 클래스 제거
          bubble.innerHTML = "죄송합니다. 서비스 연결에 실패했습니다.";
        }
      })
      .processChatbotMessage(msg);
  }

  function appendChat(role, text, isLoading = false) {
    const container = document.getElementById('chatbot-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'chat-bubble ' + role + (isLoading ? ' loading-bubble' : '');

    // [v34.15] 강력한 링크 탐지 및 줄바꿈 처리
    let processed = text;
    if (role === 'bot' && !isLoading) {
      // 1. [텍스트](URL) 패턴 (공백/줄바꿼 허용)
      processed = processed.replace(/\[([^\]]+)\]\s*\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" class="chat-link">$1</a>');
      // 2. [텍스트: URL] 패턴 (콜론 구분, 공백/줄바꿼 허용)
      processed = processed.replace(/\[([^\]:]+):\s*[\s\n]*(https?:\/\/[^\s\]]+)[\s\n]*\]/g, '<a href="$2" target="_blank" class="chat-link">$1</a>');
      // 3. 생 URL 탐지 (앞서 변환된 <a> 태그 제외)
      processed = processed.replace(/(?<!href=")(?<!">)(https?:\/\/[^\s<\]\)\n]+)/g, '<a href="$1" target="_blank" class="chat-link">$1</a>');

      // 줄바꿼 변환
      processed = processed.replace(/\n/g, '<br>');
    }

    div.innerHTML = processed;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  // 라이트박스 로직
  /* ────────────────────────────────────────────
   * [v36.2] 라이트박스 — 좌우 화살표 탐색 지원
   * FILTERED_GALLERY_DATA 배열을 기준으로 인덱스 이동
   * ──────────────────────────────────────────── */
  let _lbIndex = 0;   // 현재 보여지는 이미지 인덱스

  function openLightbox(url, title, date, indexHint) {
    const modal = document.getElementById('lightbox-modal');
    if (!modal) return;

    // 인덱스 결정: 외부에서 직접 인덱스를 넘기거나, URL로 탐색
    const data = (typeof FILTERED_GALLERY_DATA !== 'undefined' && FILTERED_GALLERY_DATA.length > 0)
      ? FILTERED_GALLERY_DATA : [];

    if (typeof indexHint === 'number') {
      _lbIndex = indexHint;
    } else {
      const found = data.findIndex(d => d.url === url);
      _lbIndex = found >= 0 ? found : 0;
    }

    _lbShowCurrent(data);
    modal.classList.add('open');

    // 키보드 지원 (중복 등록 방지)
    document.removeEventListener('keydown', _lbKeyHandler);
    document.addEventListener('keydown', _lbKeyHandler);
  }

  function _lbShowCurrent(data) {
    if (!data || data.length === 0) return;
    const item = data[_lbIndex];
    if (!item) return;

    const img = document.getElementById('lightbox-img');
    const caption = document.getElementById('lightbox-caption');
    const counter = document.getElementById('lightbox-counter');

    // 이미지 페이드 전환
    if (img) {
      img.style.opacity = '0';
      img.src = item.url;
      img.onload = () => { img.style.opacity = '1'; };
      img.onerror = () => { img.style.opacity = '1'; };
    }
    if (caption) caption.innerText = item.name || '';
    if (counter) counter.innerText = `${_lbIndex + 1} / ${data.length}`;

    // 화살표 활성화 토글
    const btnL = document.querySelector('.lightbox-arrow-left');
    const btnR = document.querySelector('.lightbox-arrow-right');
    if (btnL) btnL.disabled = (_lbIndex === 0);
    if (btnR) btnR.disabled = (_lbIndex === data.length - 1);
  }

  function prevLightbox() {
    const data = (typeof FILTERED_GALLERY_DATA !== 'undefined') ? FILTERED_GALLERY_DATA : [];
    if (_lbIndex > 0) { _lbIndex--; _lbShowCurrent(data); }
  }

  function nextLightbox() {
    const data = (typeof FILTERED_GALLERY_DATA !== 'undefined') ? FILTERED_GALLERY_DATA : [];
    if (_lbIndex < data.length - 1) { _lbIndex++; _lbShowCurrent(data); }
  }

  function _lbKeyHandler(e) {
    if (!document.getElementById('lightbox-modal')?.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); prevLightbox(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); nextLightbox(); }
    if (e.key === 'Escape') { closeLightbox(); }
  }

  function closeLightbox() {
    const modal = document.getElementById('lightbox-modal');
    if (modal) modal.classList.remove('open');
    document.removeEventListener('keydown', _lbKeyHandler);
  }

  // 로드 후 데이터 가져오기 실행
  window.addEventListener('DOMContentLoaded', () => {
    loadHomepageData();
    initDropZone();
  });

  /* ════════════════════════
     [MODAL & UPLOAD LOGIC]
  ════════════════════════ */
  let UPLOAD_FILES = [];

  function openExitModal() {
    const modal = document.getElementById('meta-exit-modal');
    if (modal) modal.classList.add('open');
  }

  function closeExitModal() {
    const modal = document.getElementById('meta-exit-modal');
    if (modal) modal.classList.remove('open');
  }

  function confirmExit() {
    // [BGM] 퇴장 시 배경음악 정지
    try { BGM.stop(); } catch (e) { console.warn('[BGM] 정지 실패:', e); }

    // [모니터링] 메타버스 퇴장 및 체류시간 로그 기록
    try {
      Monitoring.logMetaverseExit();
    } catch (e) { console.warn("메타버스 퇴장 로깅 오류:", e); }

    // 1. Firebase 실시간 데이터베이스에서 나 자신 제거 (Cleanup)
    if (state.mySessionId && db) {
      db.ref('players/' + state.mySessionId).remove().then(() => {
        // [v25.1] GAS 환경 리로드 문제 해결을 위해 명시적 URL 이동 (국장님 제공 주소)
        const homeUrl = 'https://script.google.com/a/macros/light4u.kr/s/AKfycbzd6I2JFN_xcS4YCl-JkkfVa7JIPgmBrkLmW1q3SbsolUhI4Wf93vaqaTGtn5PfuaJY/exec';
        if (window.top) {
          window.top.location.href = homeUrl;
        } else {
          location.href = homeUrl;
        }
      }).catch(err => {
        console.error("퇴장 세션 정리 실패:", err);
        const homeUrl = 'https://script.google.com/a/macros/light4u.kr/s/AKfycbzd6I2JFN_xcS4YCl-JkkfVa7JIPgmBrkLmW1q3SbsolUhI4Wf93vaqaTGtn5PfuaJY/exec';
        if (window.top) window.top.location.href = homeUrl;
        else location.href = homeUrl;
      });
    } else {
      const homeUrl = 'https://script.google.com/a/macros/light4u.kr/s/AKfycbzd6I2JFN_xcS4YCl-JkkfVa7JIPgmBrkLmW1q3SbsolUhI4Wf93vaqaTGtn5PfuaJY/exec';
      if (window.top) window.top.location.href = homeUrl;
      else location.href = homeUrl;
    }
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('open');
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('open');

      // [v35.0] 메타버스 진입 포털 루프 및 스타일 정리
      if (id === 'metaverseEntryModal') {
        const modalBox = modal.querySelector('.metaverse-modal-box');
        if (modalBox) {
          modalBox.classList.remove('portal-active');
        }
        if (portalAnimId) {
          cancelAnimationFrame(portalAnimId);
          portalAnimId = null;
        }
        portalParticles = [];
        const canvas = document.getElementById('portalCanvas');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
  }

  function checkCloseModal(e, id) {
    if (e.target.id === id) closeModal(id);
  }

  /**
   * [신규] 푸터 메뉴 팝업 열기
   */
  function openFooterModal(type) {
    const titleEl = document.getElementById('footermodal-title');
    const bodyEl = document.getElementById('footermodal-body');
    let title = '';
    let content = '';

    if (type === 'privacy') {
      title = '개인정보처리방침';
      content = `
        <div style="font-size:14px; color:#555; line-height:1.7;">
          <h4 style="color:#111; margin-bottom:10px;">1. 개인정보의 처리 목적</h4>
          <p>등대의집은 개인정보를 고유 목적 사업 수행 및 원활한 상담 제공을 위해 처리합니다. 처리한 개인정보는 목적 이외의 용도로는 사용되지 않으며 이용 목적이 변경될 시에는 사전동의를 구할 예정입니다.</p>
          <h4 style="color:#111; margin-top:20px; margin-bottom:10px;">2. 처리하는 개인정보의 항목</h4>
          <p>성명, 연락처, 이메일 주소 등 상담 및 서비스 제공을 위해 필요한 최소한의 개인정보를 수집하고 있습니다.</p>
          <h4 style="color:#111; margin-top:20px; margin-bottom:10px;">3. 개인정보의 보유 및 이용기간</h4>
          <p>이용자의 개인정보는 원칙적으로 개인정보의 수집 및 이용목적이 달성되면 지체 없이 파기합니다.</p>
          <p style="margin-top:20px; font-weight:700;">※ 자세한 내용은 관내 게시된 상세 방침을 참고해 주시기 바랍니다.</p>
        </div>
      `;
    } else if (type === 'terms') {
      title = '이용약관';
      content = `
        <div style="font-size:14px; color:#555; line-height:1.7;">
          <h4 style="color:#111; margin-bottom:10px;">제 1 조 (목적)</h4>
          <p>본 약관은 등대의집(이하 "시설")이 운영하는 웹사이트에서 제공하는 인터넷 관련 서비스의 이용조건 및 절차, 시설과 이용자의 권리, 의무, 책임사항을 규정함을 목적으로 합니다.</p>
          <h4 style="color:#111; margin-top:20px; margin-bottom:10px;">제 2 조 (이용자의 의무)</h4>
          <p>이용자는 본 약관 및 관계 법령에서 규정한 사항을 준수해야 하며, 기타 시설의 업무에 방해되는 행위를 하여서는 안 됩니다.</p>
          <h4 style="color:#111; margin-top:20px; margin-bottom:10px;">제 3 조 (서비스의 중단)</h4>
          <p>시설은 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신의 두절 등의 사유가 발생한 경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.</p>
        </div>
      `;
    } else if (type === 'no-email') {
      title = '이메일무단수집거부';
      content = `
        <div style="font-size:14px; color:#555; line-height:1.7; text-align:center; padding: 20px 0;">
          <div style="font-size:40px; margin-bottom:20px;">🚫</div>
          <p style="font-size:16px; font-weight:700; color:#d32f2f; margin-bottom:15px;">이메일 주소 무단 수집을 거부합니다.</p>
          <p>본 웹사이트에 게시된 이메일 주소가 전자우편 수집 프로그램이나 그 밖의 기술적 장치를 이용하여 무단으로 수집되는 것을 거부하며, 이를 위반 시 정보통신망법에 의해 형사 처벌됨을 유념하시기 바랍니다.</p>
          <p style="margin-top:10px; font-size:12px; color:#999;">[게시일 2026년 4월 14일]</p>
        </div>
      `;
    } else if (type === 'map') {
      title = '찾아오시는 길';
      content = `
        <div style="font-size:14px; color:#333;">
          <!-- 구글 지도 API 임베드 (주소 기반) -->
          <div style="width:100%; height:320px; border-radius:12px; overflow:hidden; border:1px solid #ddd; margin-bottom:25px;">
            <iframe 
              src="https://maps.google.com/maps?q=%EC%B6%A9%EC%B2%AD%EB%82%A8%EB%8F%84%20%EC%B2%9C%EC%95%88%EC%8B%9C%20%EC%84%9C%EB%B6%81%EA%B5%AC%20%EC%84%B1%EC%A7%84%EB%A1%9C%20410-11&t=&z=17&ie=UTF8&iwloc=&output=embed" 
              width="100%" height="100%" style="border:0;" allowfullscreen="" loading="lazy"></iframe>
          </div>

          <div style="margin-bottom:20px;">
            <h4 style="font-size:16px; color:#004282; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
               <span style="font-size:18px;">🚗</span> 자가용 이용 시
            </h4>
            <table style="width:100%; border-collapse:collapse; border-top:2px solid #004282; font-size:13.5px;">
              <tr>
                <td style="padding:15px; border-bottom:1px solid #eee; background:#f9f9f9; width:100px; font-weight:700; text-align:center; color:#d35400;">천안 IC</td>
                <td style="padding:15px; border-bottom:1px solid #eee; line-height:1.6;">천안고가도로 ➔ 천안터널 통과 후 1번국도 우회전(평택방면) 直進 후 1번국도 내 복지관사거리에서 34번국도로 우회전 ➔ 입장방면 直進 후 ➔ 남서울대학교, 삼육식품, 사조산업을 지나 우회전 ➔ <strong style="color:#27ae60;">등대의 집</strong></td>
              </tr>
              <tr>
                <td style="padding:15px; border-bottom:1px solid #eee; background:#f9f9f9; font-weight:700; text-align:center; color:#d35400;">안성 IC</td>
                <td style="padding:15px; border-bottom:1px solid #eee; line-height:1.6;">38번국도 내 비전지하차도사거리에서 1번국도 좌회전 ➔ 천안방면 直進 후 1번국도 내 복지관사거리에서 34번국도로 좌회전 ➔ 입장방면 直進 후 남서울대학교, 사조산업을 지나 우회전 ➔ <strong style="color:#27ae60;">등대의 집</strong></td>
              </tr>
              <tr>
                <td style="padding:15px; border-bottom:1px solid #eee; background:#f9f9f9; font-weight:700; text-align:center; color:#d35400;">북천안 IC</td>
                <td style="padding:15px; border-bottom:1px solid #eee; line-height:1.6;">입장·진천방향 우회전 ➔ 우측 입장방면으로 나와 다리 밑 신호에서 좌회전 ➔ 200m앞 좌측에 <strong style="color:#27ae60;">등대의 집</strong></td>
              </tr>
            </table>
          </div>

          <div>
            <h4 style="font-size:16px; color:#004282; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
               <span style="font-size:18px;">🚌</span> 대중교통 이용 시
            </h4>
            <table style="width:100%; border-collapse:collapse; border-top:2px solid #004282; font-size:13.5px;">
              <tr>
                <td style="padding:15px; border-bottom:1px solid #eee; background:#f9f9f9; width:100px; font-weight:700; text-align:center; color:#2980b9;">버스 노선</td>
                <td style="padding:15px; border-bottom:1px solid #eee; line-height:1.6;">
                  성환 ➔ 입장방면 : 160번, 162번, 164번<br>
                  입장 ➔ 성환방면 : 161번, 163번, 165번
                </td>
              </tr>
              <tr>
                <td style="padding:15px; border-bottom:1px solid #eee; background:#f9f9f9; font-weight:700; text-align:center; color:#2980b9;">성환역</td>
                <td style="padding:15px; border-bottom:1px solid #eee; line-height:1.6;">
                  성환역 2번 출구로 나와서 입장방면 버스 이용 (160번, 162번, 164번)
                </td>
              </tr>
            </table>
          </div>
        </div>
      `;
    }

    if (titleEl) titleEl.innerText = title;
    if (bodyEl) bodyEl.innerHTML = content;
    openModal('footerMenuModal');
  }

  function initDropZone() {
    const dz = document.getElementById('photo-drop-zone');
    if (!dz) return;
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
      dz.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); });
    });
    dz.addEventListener('dragover', () => dz.classList.add('drag-over'));
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => {
      dz.classList.remove('drag-over');
      handleFileSelect(e.dataTransfer.files);
    });
  }

  function handleFileSelect(files) {
    if (!files.length) return;
    const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (UPLOAD_FILES.length + newFiles.length > 3) {
      alert('사진은 최대 3장까지만 업로드 가능합니다.');
      return;
    }
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        UPLOAD_FILES.push({ file: file, data: e.target.result });
        renderFileList();
      };
      reader.readAsDataURL(file);
    });
  }

  function renderFileList() {
    const list = document.getElementById('photo-file-list');
    list.innerHTML = UPLOAD_FILES.map((item, idx) => `
      <div class="file-item-chip">
        <img src="${item.data}">
        <span class="file-item-remove" onclick="removeFile(${idx})">✕</span>
      </div>
    `).join('');
  }

  function removeFile(idx) {
    UPLOAD_FILES.splice(idx, 1);
    renderFileList();
  }

  /**
   * [v22.0] 통합 로딩 스피너 제어 (국장님 요청 반영)
   */
  function toggleGlobalLoader(show, text) {
    const loader = document.getElementById('global-loader');
    const txt = document.getElementById('loader-text');
    if (!loader) return;
    if (show) {
      if (txt && text) txt.innerText = text;
      loader.classList.add('active');
    } else {
      loader.classList.remove('active');
    }
  }

  function handlePhotoUpload() {
    const title = document.getElementById('photoTitle').value || '등대의집 활동 사진';

    toggleGlobalLoader(true, '현장의 소중한 기록을 업로드 중입니다... (1/' + UPLOAD_FILES.length + ')');
    const totalFiles = UPLOAD_FILES.length;

    function uploadNext(idx) {
      if (idx >= totalFiles) {
        toggleGlobalLoader(false);
        closeModal('uploadPhotoModal');
        UPLOAD_FILES = [];
        document.getElementById('photoTitle').value = '';
        renderFileList();
        loadHomepageData(); // 갤러리 새로고침
        return;
      }
      const item = UPLOAD_FILES[idx];
      const loaderTxt = document.getElementById('loader-text');
      if (loaderTxt) loaderTxt.innerText = '현장의 소중한 기록을 업로드 중입니다... (' + (idx + 1) + '/' + totalFiles + ')';

      google.script.run
        .withSuccessHandler(() => {
          uploadNext(idx + 1);
        })
        .withFailureHandler(err => {
          toggleGlobalLoader(false);
          alert('❌ 업로드 중 오류 발생 (' + (idx + 1) + '번째 파일): ' + err.message);
        })
        .uploadGalleryPhoto({
          data: item.data.split(',')[1],
          name: item.file.name,
          mimeType: item.file.type,
          description: title + (totalFiles > 1 ? ' (' + (idx + 1) + '/' + totalFiles + ')' : '')
        });
    }
    uploadNext(0);
  }

  /* ════════════════════════════════════════
   * ★ [v30.0] 평택대 스타일 이미지 배너 팝업 엔진
   * ════════════════════════════════════════ */
  function initMainNoticePopup() {
    // 1. 오늘 하루 보지 않기 체크
    const hideUntil = localStorage.getItem('hideMainPopupUntil');
    if (hideUntil && new Date().getTime() < parseInt(hideUntil)) return;

    // 2. 서버에서 '팝업공지' 전용 시트 데이터 로드
    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler(banners => {
          if (!banners || banners.length === 0) return;
          renderPTUPopup(banners);
        })
        .getPopupBannerList();
    }
  }

  /**
   * [신규] 퀴 메뉴 POPUP 버튼클릭 시 원래 팝업을 강제 재엸
   * - localStorage 숨기기 무시
   * - 변수에 배너 데이터가 이미 로드되어 있으면 바로 올림, 없으면 서버에서 다시 가져와 올림
   */
  let _cachedBanners = null;  // 서버에서 가져온 배너 데이터 캐시

  function reopenMainPopup() {
    const overlay = document.getElementById('main-notice-popup');
    if (!overlay) return;

    // [강화] 연속 2회 rAF로 안정적 스우시 애니메이션 재트리거
    const refresh = () => {
      overlay.classList.remove('active');
      const items = overlay.querySelectorAll('.ptu-banner-item');
      // Step 1: 모든 아이템 애니메이션 즉시 정지
      items.forEach(item => {
        item.style.animation = 'none';
      });
      // Step 2: 브라우저 레이아웃 재계산 강제 (double rAF)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          items.forEach(item => {
            item.style.animation = ''; // 원래 CSS 애니메이션으로 복원
          });
          overlay.classList.add('active');
        });
      });
    };

    if (_cachedBanners && _cachedBanners.length > 0) {
      // 이미 데이터 있으면 바로 재실행
      refresh();
    } else {
      // 캐시 없으면 서버에서 새로 로드
      if (typeof google !== 'undefined' && google.script) {
        google.script.run
          .withSuccessHandler(banners => {
            if (!banners || banners.length === 0) return;
            renderPTUPopup(banners);
          })
          .getPopupBannerList();
      }
    }
  }

  // [v32.6] 팝업 배너 스크롤 (viewport 기준 타겟팅)
  function scrollPtu(dir) {
    const viewport = document.getElementById('ptu-banner-viewport');
    if (viewport) {
      // 배너 넓이(380) + 간격(25) = 405px
      viewport.scrollBy({ left: dir * 405, behavior: 'smooth' });
    }
  }

  function renderPTUPopup(banners) {
    _cachedBanners = banners;  // 캐시 저장
    const container = document.getElementById('ptu-banner-container');
    const viewport = document.getElementById('ptu-banner-viewport');
    if (!container || !viewport) return;

    // 퀴 메뉴 및더 수 브브 자동 업데이트
    const badge = document.getElementById('popup-quick-badge');
    if (badge) badge.textContent = banners.length;

    // 팝업이 3개를 초과하면 화살표 등장
    const useArrows = banners.length > 3;
    const arrowL = document.getElementById('ptu-arrow-left');
    const arrowR = document.getElementById('ptu-arrow-right');
    if (arrowL) arrowL.style.display = useArrows ? 'flex' : 'none';
    if (arrowR) arrowR.style.display = useArrows ? 'flex' : 'none';

    // 3개 이하면 컨테이너 안에서 가운데 정렬, 이상이면 왼쪽 정렬 + 무한 증식 너비
    if (useArrows) {
      container.style.width = 'max-content';
      container.style.justifyContent = 'flex-start';
    } else {
      container.style.width = '100%';
      container.style.justifyContent = 'center';
    }

    let html = '';
    banners.forEach((item, idx) => {
      html += `
        <div class="ptu-banner-item">
          <div class="ptu-banner-content" onclick="openPopupDetailByNum('${item.linkNum}')">
            <img src="${item.img}" alt="공지 팝업 ${idx + 1}">
          </div>
          <div class="ptu-banner-footer">
            <label class="ptu-hide-today-item">
              <input type="checkbox" class="popup-hide-today-chk"> 오늘 하루 보지 않기
            </label>
            <button class="ptu-close-btn-item" onclick="closeMainPopup()">✕ 닫기</button>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;

    // 팝업 표시
    const overlay = document.getElementById('main-notice-popup');
    if (overlay) {
      overlay.classList.add('active');
    }
  }

  function openPopupDetailByNum(num) {
    if (!num || num === 'null') return;

    // 1. 공지사항 데이터에서 해당 번호(A열) 찾기
    const itemIdx = ALL_NOTICES_DATA.findIndex(n => n.num == num);
    if (itemIdx >= 0) {
      closeMainPopup();
      // 해당 섹션으로 이동 후 상세 모달 오픈
      if (typeof smoothScroll === 'function') smoothScroll('sec-notices');
      setTimeout(() => {
        if (typeof openNoticeDetail === 'function') openNoticeDetail(itemIdx);
      }, 500);
    } else {
      // 만약 데이터를 아직 못 불러왔다면 잠시 후 재시도
      alert('공지 데이터를 불러오는 중입니다. 잠시 후 다시 클릭해 주세요.');
    }
  }

  function closeMainPopup() {
    const overlay = document.getElementById('main-notice-popup');
    const checkboxes = document.querySelectorAll('.popup-hide-today-chk');
    let hideToday = false;
    checkboxes.forEach(chk => {
      if (chk.checked) hideToday = true;
    });

    if (hideToday) {
      const expiry = new Date().getTime() + (24 * 60 * 60 * 1000);
      localStorage.setItem('hideMainPopupUntil', expiry.toString());
    }

    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.classList.remove('active');
        overlay.style.opacity = '';
      }, 400);
    }
  }

  // [신규 v2] 메타버스 진입 프리미엄 팝업 — position:fixed + display 직접 제어 방식
  function checkMetaverseNotice() {
    console.log("🔔 메타버스 팝업 공지 체크 시작...");

    try {
      google.script.run
        .withSuccessHandler(function (notices) {
          console.log("🔔 서버에서 받은 공지 목록:", JSON.stringify(notices));

          // [수정] 각 행별(Row 2, Row 3, Row 4) 체크박스 상태에 따라 독립적으로 네온사인 활성화
          if (state.specialMarkers && state.specialMarkers.length >= 3) {
            // 초기화
            state.specialMarkers[0].active = false;
            state.specialMarkers[1].active = false;
            state.specialMarkers[2].active = false;

            if (notices && notices.length > 0) {
              notices.forEach(n => {
                if (n.id === 2) state.specialMarkers[0].active = true; // 2행 (챌린지)
                if (n.id === 3) state.specialMarkers[1].active = true; // 3행 (직원채용)
                if (n.id === 4) state.specialMarkers[2].active = true; // 4행 (현장실습)
              });
            }
          }

          if (notices && notices.length > 0) {
            showMetaDropNotices(notices);
          } else {
            console.warn("🔔 활성 공지가 없습니다 (체크박스 미체크 또는 시트 데이터 없음).");
          }
        })
        .withFailureHandler(function (error) {
          console.error("🔔 getMetaverseNoticeList 호출 실패:", error);
        })
        .getMetaverseNoticeList();
    } catch (e) {
      console.error("🔔 checkMetaverseNotice 예외:", e);
    }
  }

  function showMetaDropNotices(notices) {
    console.log("🔔 공지 팝업 렌더링 시작 (개수: " + notices.length + ")");
    const container = document.getElementById('meta-notice-top-container');
    if (!container) {
      console.error("❌ #meta-notice-top-container를 찾을 수 없습니다!");
      return;
    }

    container.innerHTML = ''; // 초기화
    container.style.display = 'flex';

    notices.forEach((n, idx) => {
      const noticeEl = document.createElement('div');
      noticeEl.className = 'meta-drop-notice';
      if (n.id === 3) noticeEl.classList.add('notice-pink'); // 직원채용은 핑크색

      const contentHtml = String(n.content || '').replace(/\n/g, '<br>');

      noticeEl.innerHTML = `
        <div class="drop-notice-header">
          <span class="drop-notice-icon">${n.id === 3 ? '📋' : '🔔'}</span>
          <span class="drop-notice-title">${n.title || '공지사항'}</span>
        </div>
        <div class="drop-notice-body">${contentHtml}</div>
      `;

      container.appendChild(noticeEl);

      // 11초 후 자동으로 사라지게 (기존 8초에서 3초 연장)
      setTimeout(() => {
        noticeEl.style.transform = 'translateY(-150%)';
        noticeEl.style.opacity = '0';
        setTimeout(() => {
          if (noticeEl.parentNode) container.removeChild(noticeEl);
          if (container.children.length === 0) container.style.display = 'none';
        }, 600);
      }, 11000);
    });
  }

  /**
   * [v34.5] 푸터 서명 타이핑 효과 (코딩하는 사회복지사 장진현)
   */
  /**
   * [v34.8] 상단 이동 버튼 로직
   */
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 스크롤 감지하여 버튼 표시/숨김 및 하단 스크롤 유도 아이콘 숨김
  window.addEventListener('scroll', () => {
    const btn = document.getElementById('scrollTopBtn');
    if (btn) {
      if (window.scrollY > 300) btn.style.display = 'flex';
      else btn.style.display = 'none';
    }

    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
      if (window.scrollY > 100) scrollIndicator.classList.add('hidden');
      else scrollIndicator.classList.remove('hidden');
    }
  });
  /**
   * [v35.5] 헤더 디지털 시계 — 심플 텍스트 스타일
   *   위: 14:52:49  /  아래: 2026.05.19 TUE
   */
  function updateHeaderClock() {
    const clockEl = document.getElementById('header-clock');
    if (!clockEl) return;

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const day = dayNames[now.getDay()];

    clockEl.innerHTML = `
      <div class="clock-time-simple">${hours}:${minutes}:${seconds}</div>
      <div class="clock-date-simple">${year}.${month}.${date} ${day}</div>
    `;
  }


  // 매 초마다 시계 업데이트
  setInterval(updateHeaderClock, 1000);
  updateHeaderClock(); // 최초 실행

  /* ════════════════════════════════════════════════════════════
   * [신규 v35.4] 실시간 날씨 및 초미세먼지 연동 (Open-Meteo API)
   * - 등대의집 정밀 좌표: 위도 36.9176, 경도 127.2078 (천안 성환읍)
   * - Promise.all 병렬 fetch + 15분 캐싱 + 이중 try-catch Failsafe
   * ════════════════════════════════════════════════════════════ */

  // ── 캐싱 키 상수 ──
  const _WX_CACHE_KEY = 'wxCache_v1';
  const _WX_CACHE_TTL = 15 * 60 * 1000; // 15분

  // ── WMO 날씨 코드 → 이모지 변환 ──
  function _wmoToEmoji(code) {
    if (code === 0) return '☀️';
    if (code <= 2) return '🌤️';
    if (code === 3) return '☁️';
    if (code >= 45 && code <= 48) return '🌫️';
    if (code >= 51 && code <= 55) return '🌦️';
    if (code >= 56 && code <= 57) return '🌧️';
    if (code >= 61 && code <= 65) return '🌧️';
    if (code >= 66 && code <= 67) return '🌨️';
    if (code >= 71 && code <= 77) return '❄️';
    if (code >= 80 && code <= 82) return '🌧️';
    if (code >= 85 && code <= 86) return '🌨️';
    if (code >= 95 && code <= 99) return '⛈️';
    return '🌡️';
  }

  // ── PM2.5 값 → 등급 객체 변환 ──
  function _pm25Grade(pm25) {
    if (pm25 === null || pm25 === undefined) return { cls: 'good', label: '좋음' };
    if (pm25 <= 15) return { cls: 'good', label: `좋음 ${pm25}㎍` };
    if (pm25 <= 35) return { cls: 'moderate', label: `보통 ${pm25}㎍` };
    if (pm25 <= 75) return { cls: 'bad', label: `나쁨 ${pm25}㎍` };
    return { cls: 'very-bad', label: `매우나쁨 ${pm25}㎍` };
  }

  // ── DOM 업데이트 헬퍼 ──
  function _applyWeatherDOM(emoji, tempStr, grade) {
    const iconEl = document.getElementById('weather-icon-el');
    const tempEl = document.getElementById('weather-temp-el');
    const dotEl = document.getElementById('dust-dot-el');
    const textEl = document.getElementById('dust-text-el');
    if (iconEl) iconEl.textContent = emoji;
    if (tempEl) tempEl.textContent = tempStr;
    if (dotEl) { dotEl.className = 'dust-dot ' + grade.cls; }
    if (textEl) textEl.textContent = grade.label;
  }

  // ── Failsafe 기본값 렌더링 ──
  function _applyWeatherFallback() {
    _applyWeatherDOM('☀️', '21.5°C', { cls: 'good', label: '좋음' });
  }

  // ── 메인 날씨 업데이트 함수 ──
  function updateWeather() {
    try {
      // fetch 미지원 환경 즉시 Failsafe
      if (typeof fetch === 'undefined') {
        _applyWeatherFallback();
        return;
      }

      // 캐시 확인 (15분 이내라면 API 호출 없이 캐시 사용)
      try {
        const cached = localStorage.getItem(_WX_CACHE_KEY);
        if (cached) {
          const obj = JSON.parse(cached);
          if (Date.now() - obj.ts < _WX_CACHE_TTL) {
            _applyWeatherDOM(obj.emoji, obj.tempStr, obj.grade);
            return;
          }
        }
      } catch (_) { /* 캐시 읽기 실패 시 무시하고 API 호출 진행 */ }

      // ── API 병렬 호출 ──
      const LAT = 36.9176, LON = 127.2078;
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&timezone=Asia%2FSeoul`;
      const dustUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=pm2_5&timezone=Asia%2FSeoul`;

      Promise.all([
        fetch(weatherUrl).then(r => r.json()),
        fetch(dustUrl).then(r => r.json())
      ])
        .then(([wx, aq]) => {
          try {
            const temp = wx.current.temperature_2m;
            const code = wx.current.weather_code;
            const pm25 = aq.current && aq.current.pm2_5 !== undefined
              ? Math.round(aq.current.pm2_5) : null;

            const emoji = _wmoToEmoji(code);
            const tempStr = temp !== undefined ? `${Math.round(temp * 10) / 10}°C` : '--°C';
            const grade = _pm25Grade(pm25);

            _applyWeatherDOM(emoji, tempStr, grade);

            // 캐시 저장
            try {
              localStorage.setItem(_WX_CACHE_KEY, JSON.stringify({
                ts: Date.now(), emoji, tempStr, grade
              }));
            } catch (_) { /* 저장 실패 무시 */ }
          } catch (e) {
            console.warn('[날씨] 파싱 실패, Failsafe 적용:', e);
            _applyWeatherFallback();
          }
        })
        .catch(err => {
          console.warn('[날씨] fetch 실패, Failsafe 적용:', err);
          _applyWeatherFallback();
        });

    } catch (e) {
      console.warn('[날씨] 예기치 않은 오류, Failsafe 적용:', e);
      _applyWeatherFallback();
    }
  }

  // ── 초기 실행 및 15분 갱신 주기 설정 (이중 try-catch 보호) ──
  try { updateWeather(); } catch (_) { _applyWeatherFallback(); }
  try { setInterval(updateWeather, _WX_CACHE_TTL); } catch (_) { }

  /**
   * [v34.10] 관련기관링크 로드 및 이동 기능
   */
  function loadAgencyLinks() {
    if (typeof google !== 'undefined' && google.script) {
      google.script.run.withSuccessHandler((links) => {
        const select = document.getElementById('agencySelect');
        if (!select) return;

        // 기존 옵션 유지하며 데이터 기반으로 옵션 생성
        select.innerHTML = '<option value="">관련 기관 선택</option>';

        links.forEach(link => {
          const opt = document.createElement('option');
          opt.value = link.url;
          opt.innerText = link.name;
          select.appendChild(opt);
        });
      }).getAgencyLinks();
    }
  }

  function goToAgencyLink() {
    const select = document.getElementById('agencySelect');
    if (!select || !select.value) {
      alert('이동하실 기관을 선택해주세요.');
      return;
    }
    window.open(select.value, '_blank');
  }

  // 초기 로딩 시 관련기관 링크 불러오기
  loadAgencyLinks();

  /**
   * [v34.12] 챗봇 말풍선 주기적 멘트 로직
   */
  const CHAT_HINTS = [
    "자원봉사 문의는 어떠세요? 🙋",
    "후원 방법이 궁금하신가요? ❤️",
    "등대의집 소식이 궁금해요! 📰",
    "메타버스 이용 가이드 드릴까요? 🌐",
    "시설 이용 안내 도와드려요! 🏢",
    "무엇이든 물어보세요! 🤖"
  ];

  function rotateChatBubble() {
    const bubble = document.getElementById('chatbot-bubble');
    if (!bubble) return;

    // 이미 말풍선이 보이는 중이면 숨겼다 바꿈
    bubble.classList.remove('show');

    setTimeout(() => {
      const randIdx = Math.floor(Math.random() * CHAT_HINTS.length);
      bubble.innerText = CHAT_HINTS[randIdx];
      bubble.classList.add('show');

      // 5초 후에 다시 숨김
      setTimeout(() => {
        bubble.classList.remove('show');
      }, 5000);
    }, 600);
  }

  // 20초마다 실행 (사용자 방해 최소화)
  setInterval(rotateChatBubble, 20000);
  // 첫 실행은 4초 후
  setTimeout(rotateChatBubble, 4000);

  /* ════════════════════════════════════════════════
   * [AI센터] 메타버스 AI 챗봇 엔진
   * F키 → openAIChatbot() → 글래스모피즘 모달 등장
   * ════════════════════════════════════════════════ */

  let _aiChatInited = false; // 환영메시지 중복 방지

  function openAIChatbot() {
    const modal = document.getElementById('metaAIChatModal');
    if (!modal) return;

    // 키 상태 전체 초기화 (아바타 이동 차단)
    for (let k in state.keys) state.keys[k] = false;

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);

    // 최초 1회 환영 메시지
    if (!_aiChatInited) {
      _aiChatInited = true;
      setTimeout(() => {
        appendAIMsg('bot', '안녕하세요! 저는 등대의집 AI 어시스턴트입니다. 🤖\n후원, 봉사, 프로그램, 시설 이용 등 무엇이든 편하게 물어보세요!');
      }, 300);
    }

    // 입력창 포커스
    setTimeout(() => {
      const input = document.getElementById('ai-chat-input');
      if (input) input.focus();
    }, 400);
  }

  function closeAIChatbot() {
    const modal = document.getElementById('metaAIChatModal');
    if (!modal) return;
    modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
  }

  function sendAIChat() {
    const input = document.getElementById('ai-chat-input');
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;

    input.value = '';
    appendAIMsg('user', msg);

    // 로딩 dot 표시
    const loadingId = 'ai-loading-' + Date.now();
    appendAIMsg('loading', '', loadingId);

    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler(function (response) {
          removeAIMsg(loadingId);
          appendAIMsg('bot', response || '죄송합니다. 잠시 후 다시 시도해주세요.');
        })
        .withFailureHandler(function () {
          removeAIMsg(loadingId);
          appendAIMsg('bot', '⚠️ 연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        })
        .processChatbotMessage(msg);
    } else {
      removeAIMsg(loadingId);
      appendAIMsg('bot', '현재 데모 환경입니다. 배포 후 실제 AI와 연결됩니다.');
    }
  }

  function appendAIMsg(type, text, id) {
    const log = document.getElementById('ai-chat-log');
    if (!log) return;

    const div = document.createElement('div');
    div.className = 'ai-msg ai-msg-' + type;
    if (id) div.id = id;

    if (type === 'loading') {
      div.innerHTML = '<span class="ai-typing"><span></span><span></span><span></span></span>';
    } else {
      // 줄바꿈 처리
      div.innerHTML = String(text).replace(/\n/g, '<br>');
    }

    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function removeAIMsg(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  /* ════════════════════════════════════════════════════════
   * ★ [v36.1] 좌측 이동형 직원 아바타 가이드 엔진
   *    - 기관소개 / 공지사항 / 명예의 전당 / 주요 프로그램 / 전자소식지
   *    - 직원 랜덤 선택 → 섹션 스크롤 시 좌측 이동 + AI 말풍선
   * ════════════════════════════════════════════════════════ */
  (function initAvatarGuide() {

    // 활동 대상 섹션 정의 (기관소개 ~ 전자소식지)
    const GUIDE_SECTIONS = [
      { id: 'sec-about', menuName: '기관소개' },
      { id: 'sec-notices', menuName: '공지사항' },
      { id: 'sec-hof', menuName: '명예의 전당' },
      { id: 'sec-programs', menuName: '주요 프로그램' },
      { id: 'sec-newsletter', menuName: '전자소식지' }
    ];

    let selectedStaffName = null;     // 오늘 선택된 직원 이름
    let selectedFolderId = null;      // 해당 직원 캐릭터 폴더 ID
    let avatarFrames = {};            // 로드된 캐릭터 이미지 (down_1, down_2, down_3 등)
    let currentSection = null;        // 현재 활성 섹션 ID
    let isWalking = false;
    let walkInterval = null;
    let walkFrame = 1;
    let walkDir = 'down';             // 걷는 방향
    let msgCache = {};                // 섹션별 AI 멘트 캐시

    // ── 1. 직원 랜덤 선택 ─────────────────────────────
    function pickRandomStaff() {
      const configs = state.staffConfigs;
      if (!configs || Object.keys(configs).length === 0) return false;
      const names = Object.keys(configs).filter(n => configs[n].folderId);
      if (names.length === 0) return false;

      // 매 접속 시 완전 랜덤 선택 (Math.random 사용)
      const picked = names[Math.floor(Math.random() * names.length)];

      selectedStaffName = picked;
      selectedFolderId = configs[picked].folderId;
      return true;
    }

    // ── 2. 캐릭터 이미지 로드 (getAvatarAssets 재활용) ─
    function loadAvatarFrames(callback) {
      if (!selectedFolderId) { callback(false); return; }
      if (typeof google === 'undefined' || !google.script) { callback(false); return; }

      google.script.run
        .withSuccessHandler(assets => {
          if (!assets || Object.keys(assets).length === 0) { callback(false); return; }
          avatarFrames = {};
          let loaded = 0;
          const keys = Object.keys(assets);
          keys.forEach(k => {
            const img = new Image();
            img.onload = () => { avatarFrames[k] = img.src; loaded++; if (loaded === keys.length) callback(true); };
            img.onerror = () => { loaded++; if (loaded === keys.length) callback(true); };
            img.src = assets[k];
          });
        })
        .withFailureHandler(() => callback(false))
        .getAvatarAssets(selectedFolderId);
    }

    // ── 3. 아바타 이미지 CSS 설정 ─────────────────────
    function setAvatarFrame(dir, frameNum) {
      const charEl = document.getElementById('avatar-guide-char');
      if (!charEl) return;
      const key = dir + '_' + frameNum;
      if (avatarFrames[key]) {
        charEl.style.backgroundImage = `url('${avatarFrames[key]}')`;
      } else if (avatarFrames[dir + '_1']) {
        charEl.style.backgroundImage = `url('${avatarFrames[dir + '_1']}')`;
      }
    }

    // ── 4. 걷기 애니메이션 시작 / 정지 ──────────────
    const SEQ = [1, 2, 3, 2];
    function startWalking(dir) {
      if (isWalking && walkDir === dir) return;
      stopWalking();
      isWalking = true;
      walkDir = dir;
      walkFrame = 0;
      const guide = document.getElementById('avatar-guide');
      if (guide) guide.classList.add('walking');
      walkInterval = setInterval(() => {
        setAvatarFrame(walkDir, SEQ[walkFrame % 4]);
        walkFrame++;
      }, 225); // 150ms → 225ms (50% 느리게)
    }

    function stopWalking() {
      isWalking = false;
      clearInterval(walkInterval);
      walkInterval = null;
      const guide = document.getElementById('avatar-guide');
      if (guide) guide.classList.remove('walking');
      setAvatarFrame(walkDir, 1);
    }

    // ── 5. 아바타 위치 계산 및 이동 ──────────────────
    function getAvatarTargetTop(sectionId) {
      const sec = document.getElementById(sectionId);
      const wrap = document.getElementById('homepage-wrap');
      if (!sec || !wrap) return 300;
      const secRect = sec.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      // 섹션 안에서 상단 30% 지점 정도에 위치
      return (secRect.top - wrapRect.top) + sec.offsetHeight * 0.25;
    }

    function moveAvatarToSection(sectionId, dir) {
      const guide = document.getElementById('avatar-guide');
      if (!guide) return;

      const targetTop = getAvatarTargetTop(sectionId);
      const currentTop = parseInt(guide.style.top) || 0;
      const dist = Math.abs(targetTop - currentTop);

      // 거리 비례로 걷기 시간 조절 (최소 600ms, 최대 2100ms) — 50% 느리게
      const walkTime = Math.min(2100, Math.max(600, dist * 0.75));

      startWalking(dir);
      guide.style.top = targetTop + 'px';

      setTimeout(() => {
        stopWalking();
        setAvatarFrame('down', 1); // 정지 후 정면 바라보기
      }, walkTime);
    }

    // ── 6. AI 말풍선 멘트 표시 ────────────────────────
    function showBubble(text) {
      const bubble = document.getElementById('avatar-speech-bubble');
      if (!bubble) return;
      bubble.classList.remove('show');
      bubble.innerHTML = text;
      setTimeout(() => bubble.classList.add('show'), 100);
    }

    function showTypingBubble() {
      showBubble(`<div class="avatar-typing-dots"><span></span><span></span><span></span></div>`);
    }

    function fetchAndShowMessage(sectionId, menuName) {
      if (msgCache[sectionId]) {
        showBubble(msgCache[sectionId]);
        return;
      }
      showTypingBubble();
      if (typeof google === 'undefined' || !google.script) {
        const fallbacks = {
          'sec-about': '🏢 기관소개입니다! 등대의집의 설립 목적과 운영 철학, 조직 구성을 확인해 보세요. 더 자세한 사항은 저를 클릭해서 AI 챗봇에게 물어보세요! 😊',
          'sec-notices': '📋 공지사항입니다! 최근 올라온 새 소식을 확인해 보세요. 더 자세한 사항은 저를 클릭해서 AI 챗봇에게 물어보세요! 😊',
          'sec-hof': '🏆 명예의 전당입니다! 저희 기관을 후원해주신 소중한 분들의 명단입니다. 더 자세한 사항은 저를 클릭해서 AI 챗봇에게 물어보세요! 😊',
          'sec-programs': '🎯 주요 프로그램입니다! 등대의집에서 운영 중인 다양한 복지 프로그램을 확인해 보세요. 더 자세한 사항은 저를 클릭해서 AI 챗봇에게 물어보세요! 😊',
          'sec-newsletter': '📰 전자소식지입니다! 등대의집의 따뜻한 소식을 담은 소식지를 클릭해서 읽어보세요. 더 자세한 사항은 저를 클릭해서 AI 챗봇에게 물어보세요! 😊'
        };
        const msg = fallbacks[sectionId] || `${menuName} 섹션입니다. 저를 클릭해서 챗봇에게 물어보세요! 😊`;
        msgCache[sectionId] = msg;
        showBubble(msg);
        return;
      }
      google.script.run
        .withSuccessHandler(msg => {
          if (!msg) msg = `${menuName}입니다. 자세한 내용은 저를 클릭해 AI 챗봇에게 물어보세요! 😊`;
          msgCache[sectionId] = msg;
          showBubble(msg);
        })
        .withFailureHandler(() => {
          const msg = `${menuName}입니다. 자세한 내용은 저를 클릭해 챗봇에게 물어보세요! 😊`;
          msgCache[sectionId] = msg;
          showBubble(msg);
        })
        .getAvatarIntroForMenu(menuName);
    }

    // ── 7. 섹션 진입 감지 (IntersectionObserver) ─────
    function setupSectionObserver() {
      const GUIDE_SECTION_IDS = GUIDE_SECTIONS.map(s => s.id);
      let lastIdx = -1;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;

          const sectionId = entry.target.id;
          const secInfo = GUIDE_SECTIONS.find(s => s.id === sectionId);
          if (!secInfo) return;
          if (currentSection === sectionId) return;

          const newIdx = GUIDE_SECTION_IDS.indexOf(sectionId);
          const dir = (newIdx > lastIdx) ? 'down' : 'up';
          lastIdx = newIdx;
          currentSection = sectionId;

          // 말풍선 숨기기
          const bubble = document.getElementById('avatar-speech-bubble');
          if (bubble) bubble.classList.remove('show');

          // 이동 후 말풍선 표시
          moveAvatarToSection(sectionId, dir);
          setTimeout(() => {
            fetchAndShowMessage(sectionId, secInfo.menuName);
          }, 1000);
        });
      }, { threshold: 0.35 });

      GUIDE_SECTION_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }

    // ── 8. 초기화 ─────────────────────────────────────
    function init() {
      const guide = document.getElementById('avatar-guide');
      if (!guide) return;

      // staffConfigs 준비 대기 (최대 10초)
      let attempts = 0;
      const waitForStaff = setInterval(() => {
        attempts++;
        const ready = state.staffConfigs && Object.keys(state.staffConfigs).length > 0;
        if (ready || attempts > 50) {
          clearInterval(waitForStaff);
          if (!ready) return; // staffConfigs 없으면 아바타 비활성화

          if (!pickRandomStaff()) return;

          loadAvatarFrames(success => {
            if (!success || Object.keys(avatarFrames).length === 0) return;

            // 초기 위치 (첫 번째 대상 섹션 근처)
            const firstSec = document.getElementById(GUIDE_SECTIONS[0].id);
            const wrap = document.getElementById('homepage-wrap');
            if (firstSec && wrap) {
              const wrapRect = wrap.getBoundingClientRect();
              const secRect = firstSec.getBoundingClientRect();
              guide.style.top = (secRect.top - wrapRect.top + 80) + 'px';
            } else {
              guide.style.top = '400px';
            }

            // 초기 프레임 세팅
            setAvatarFrame('down', 1);

            // 이름 툴팁 추가
            guide.title = `오늘의 가이드: ${selectedStaffName}`;

            // 섹션 감지 시작
            setupSectionObserver();

            // 초기 인사 말풍선 표시 (1.5초 후)
            setTimeout(() => {
              showBubble(`안녕하세요? 오늘의 가이드 ${selectedStaffName}입니다 😊`);
              // 7초 후 말풍선 자동 숨김
              setTimeout(() => {
                const bubble = document.getElementById('avatar-speech-bubble');
                if (bubble) bubble.classList.remove('show');
              }, 7000);
            }, 1500);
          });
        }
      }, 200);
    }

    // DOMContentLoaded 이후 실행 보장
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }

  })(); // initAvatarGuide 즉시 실행 함수 끝

  /* ════════════════════════════════════════════════════════════
     [ADMIN MONITORING DASHBOARD SCRIPT]
  ════════════════════════════════════════════════════════════ */
  let currentAdminPassword = "";
  let cachedMonitoringLogs = [];
  let currentFilterType = 'ALL';

  function openAdminAuthModal() {
    const modal = document.getElementById('admin-auth-modal');
    const input = document.getElementById('admin-pw-input');
    const err = document.getElementById('admin-auth-error');
    if (input) input.value = '';
    if (err) err.innerText = '';
    if (modal) modal.classList.add('open');
    setTimeout(() => { if (input) input.focus(); }, 150);
  }

  function closeAdminAuthModal() {
    const modal = document.getElementById('admin-auth-modal');
    if (modal) modal.classList.remove('open');
  }

  function submitAdminAuth() {
    const input = document.getElementById('admin-pw-input');
    const err = document.getElementById('admin-auth-error');
    const val = input ? input.value.trim() : '';
    if (!val) {
      if (err) err.innerText = '비밀번호를 입력해주세요.';
      return;
    }
    if (val !== 'emdeodmlwlq4495') {
      if (err) err.innerText = '⛔ 비밀번호가 일치하지 않습니다.';
      if (input) { input.value = ''; input.focus(); }
      return;
    }
    currentAdminPassword = val;
    closeAdminAuthModal();
    openAdminDashboard();
  }

  function openAdminDashboard() {
    const modal = document.getElementById('admin-dashboard-modal');
    if (modal) modal.classList.add('open');
    refreshMonitoringDashboard();
  }

  function closeAdminDashboard() {
    const modal = document.getElementById('admin-dashboard-modal');
    if (modal) modal.classList.remove('open');
  }

  function refreshMonitoringDashboard() {
    const loading = document.getElementById('admin-table-loading');
    const table = document.getElementById('admin-log-table');
    const empty = document.getElementById('admin-table-empty');
    if (loading) loading.style.display = 'flex';
    if (table) table.style.display = 'none';
    if (empty) empty.style.display = 'none';

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(res => {
          if (!res || !res.success) {
            if (loading) loading.style.display = 'none';
            if (empty) {
              empty.style.display = 'flex';
              empty.innerHTML = `<p style="color:#ef4444;">⚠️ 오류: ${res ? res.message : '데이터를 가져오지 못했습니다.'}</p>`;
            }
            return;
          }
          renderMonitoringDashboard(res);
        })
        .withFailureHandler(err => {
          console.error("대시보드 데이터 로드 실패:", err);
          if (loading) loading.style.display = 'none';
          if (empty) {
            empty.style.display = 'flex';
            empty.innerHTML = `<p style="color:#ef4444;">⚠️ 서버 통신 에러가 발생했습니다.</p>`;
          }
        })
        .getMonitoringLogs(currentAdminPassword);
    }
  }

  function renderMonitoringDashboard(data) {
    const loading = document.getElementById('admin-table-loading');
    if (loading) loading.style.display = 'none';

    const summary = data.summary || { total: 0, today: 0, metaverse: 0, devices: {} };
    const logs = data.logs || [];
    cachedMonitoringLogs = logs;

    // 요약 카드 업데이트
    const totalEl = document.getElementById('stat-total-val');
    const todayEl = document.getElementById('stat-today-val');
    const metaEl = document.getElementById('stat-metaverse-val');
    const devPillsEl = document.getElementById('stat-device-pills');
    if (totalEl) totalEl.innerText = Number(summary.total || 0).toLocaleString() + '회';
    if (todayEl) todayEl.innerText = Number(summary.today || 0).toLocaleString() + '명';
    if (metaEl) metaEl.innerText = Number(summary.metaverse || 0).toLocaleString() + '회';
    if (devPillsEl) {
      const dev = summary.devices || {};
      devPillsEl.innerHTML =
        `<span class="dev-pill">PC: ${dev.PC || 0}</span>` +
        `<span class="dev-pill">모바일: ${dev.Mobile || 0}</span>` +
        (dev.Tablet > 0 ? `<span class="dev-pill">태블릿: ${dev.Tablet}</span>` : '');
    }

    // 탭 카운트
    let homeCount = 0, metaCount = 0;
    logs.forEach(item => {
      if (item.accessType && item.accessType.includes('메타버스')) metaCount++;
      else homeCount++;
    });
    const cntAll = document.getElementById('filter-cnt-all');
    const cntHome = document.getElementById('filter-cnt-home');
    const cntMeta = document.getElementById('filter-cnt-meta');
    if (cntAll) cntAll.innerText = logs.length;
    if (cntHome) cntHome.innerText = homeCount;
    if (cntMeta) cntMeta.innerText = metaCount;

    filterMonitoringLogs(currentFilterType);
  }

  function filterMonitoringLogs(category, btnEl) {
    currentFilterType = category || 'ALL';
    if (btnEl) {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      btnEl.classList.add('active');
    }

    const table = document.getElementById('admin-log-table');
    const empty = document.getElementById('admin-table-empty');
    const tbody = document.getElementById('admin-log-tbody');
    if (!tbody) return;

    let filtered = cachedMonitoringLogs;
    if (currentFilterType === '홈페이지') {
      filtered = cachedMonitoringLogs.filter(l => !(l.accessType && l.accessType.includes('메타버스')));
    } else if (currentFilterType === '메타버스') {
      filtered = cachedMonitoringLogs.filter(l => l.accessType && l.accessType.includes('메타버스'));
    }

    if (filtered.length === 0) {
      if (table) table.style.display = 'none';
      if (empty) { empty.style.display = 'flex'; empty.innerHTML = '<p>해당 조건의 로그가 없습니다.</p>'; }
      return;
    }

    if (table) table.style.display = 'table';
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = filtered.map(row => {
      const isMeta = row.accessType && row.accessType.includes('메타버스');
      const isStaff = row.userType && row.userType.includes('직원');
      const isMob = row.device && (row.device.includes('Mobile') || row.device.includes('Tablet'));
      const accessBadge = isMeta
        ? '<span class="log-badge badge-meta">메타버스</span>'
        : '<span class="log-badge badge-home">홈페이지</span>';
      const userBadge = isStaff
        ? '<span class="log-badge badge-staff">직원</span>'
        : '<span class="log-badge badge-guest">일반</span>';
      const devBadge = isMob
        ? `<span class="log-badge badge-mobile">${row.device}</span>`
        : `<span class="log-badge badge-pc">${row.device || 'PC'}</span>`;
      return `<tr>
        <td style="color:#64748b;font-family:monospace;font-size:0.8rem;">${row.timestamp || '-'}</td>
        <td>${accessBadge}</td>
        <td>${userBadge}</td>
        <td style="font-weight:600;color:#0f172a;">${row.account || '-'}</td>
        <td>${devBadge}</td>
        <td style="color:#475569;">${row.browserOs || '-'}</td>
        <td style="color:#2563eb;">${row.referrer || '-'}</td>
        <td style="font-weight:700;text-align:right;">${row.stayDuration ? row.stayDuration + 's' : '-'}</td>
        <td style="color:#334155;">${row.notes || '-'}</td>
      </tr>`;
    }).join('');
  }

